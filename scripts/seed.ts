/**
 * Seed script: continuously deploys EVM and Stylus contracts on the local testnode.
 *
 * Generates random on-chain activity so the indexer has data to process.
 * - EVM contracts: minimal bytecode contracts (simulates Solidity deployments)
 * - Stylus contracts: uses `cargo stylus deploy` to deploy + activate (emits ProgramActivated)
 *
 * Prerequisites:
 *   - Arbitrum nitro-testnode running with --stylus flag
 *   - cargo-stylus installed (for Stylus deployments)
 *   - A Stylus project at scripts/fixtures/stylus-contract/ (auto-created on first run)
 *
 * Usage:
 *   pnpm seed                          # runs until Ctrl+C
 *   DEPLOY_INTERVAL_MS=3000 pnpm seed  # deploy every 3s (default: 2s)
 */

import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createPublicClient,
  createWalletClient,
  http,
  parseAbi,
  type Hex,
} from 'viem';
import { privateKeyToAccount, generatePrivateKey } from 'viem/accounts';
import { arbitrumLocal } from './chains.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const TESTNODE_RPC = process.env.TESTNODE_RPC || 'http://localhost:8547';
const DEPLOY_INTERVAL_MS = Number(process.env.DEPLOY_INTERVAL_MS) || 2000;
const STYLUS_PROJECT_PATH = resolve(__dirname, 'fixtures/stylus-contract');

const ARB_WASM_ADDRESS = '0x0000000000000000000000000000000000000071' as const;

const arbWasmAbi = parseAbi([
  'function stylusVersion() view returns (uint16 version)',
]);

// Testnode pre-funded account (from nitro-testnode genesis)
const FUNDER_KEY =
  '0xb6b15c8cb491557369f3c7d2c287b053eb229daa9c22138887752191c9520659' as const;

const NUM_DEPLOYERS = 3;

// ---------------------------------------------------------------------------

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomChoice<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Init code that deploys `runtimeBytecode` as the contract code.
 */
function makeInitCode(runtimeHex: string): Hex {
  const runtimeLen = runtimeHex.length / 2;
  const runtimeLenHex = runtimeLen.toString(16).padStart(4, '0');
  const initcodeLen = 13;
  const offsetHex = initcodeLen.toString(16).padStart(2, '0');
  const initcode =
    `61${runtimeLenHex}60${offsetHex}600039` +
    `61${runtimeLenHex}6000f3`;
  return `0x${initcode}${runtimeHex}` as Hex;
}

/**
 * Random minimal EVM contract that returns a random value on any call.
 */
function randomEvmBytecode(): Hex {
  const val = randomInt(1, 0xffffff).toString(16).padStart(6, '0');
  return makeInitCode(`62${val}60005260206000f3`);
}

let stylusNonce = Date.now();

/**
 * Mutates the Stylus source code so each deploy produces a unique codehash.
 * This is necessary because ProgramActivated only fires for new codehashes.
 * We inject/replace a const with a unique value inside the contract module.
 */
function mutateStylusSource(): void {
  stylusNonce++;
  const libPath = resolve(STYLUS_PROJECT_PATH, 'src/lib.rs');
  let source = readFileSync(libPath, 'utf-8');

  const marker = /const _SEED_NONCE: u64 = \d+;/;
  const newConst = `const _SEED_NONCE: u64 = ${stylusNonce};`;

  if (marker.test(source)) {
    source = source.replace(marker, newConst);
  } else {
    source = source.replace(
      'extern crate alloc;',
      `extern crate alloc;\n\n${newConst}`,
    );
  }
  writeFileSync(libPath, source);
}

/**
 * Deploy a Stylus contract using cargo stylus deploy.
 * Mutates source before each deploy so each contract gets a unique codehash,
 * guaranteeing a ProgramActivated event is emitted.
 * Uses --no-verify: the default reproducible build pulls the ~1GB
 * offchainlabs/cargo-stylus-base image, which fails on any machine that
 * doesn't already have it. Seeding a local devnode doesn't need it.
 * Returns the deployed contract address or null on failure.
 */
function deployStylus(privateKey: string): string | null {
  try {
    mutateStylusSource();
    const output = execSync(
      `cargo stylus deploy --no-verify --private-key ${privateKey} --endpoint ${TESTNODE_RPC}`,
      { cwd: STYLUS_PROJECT_PATH, timeout: 120000, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] },
    );
    const match = output.match(/deployed code at address:\s*\x1b\[[^m]*m(0x[0-9a-fA-F]+)/);
    if (match) return match[1];
    const plainMatch = output.match(/deployed code at address:\s*(0x[0-9a-fA-F]+)/);
    if (plainMatch) return plainMatch[1];
    return null;
  } catch (err: unknown) {
    const msg = err instanceof Error ? (err as { stderr?: string }).stderr?.slice(0, 120) || err.message.slice(0, 120) : '';
    console.error(`  [STYLUS ERR] ${msg}`);
    return null;
  }
}

/**
 * Ensures a Stylus project exists at the fixtures path.
 */
function ensureStylusProject(): boolean {
  if (existsSync(resolve(STYLUS_PROJECT_PATH, 'Cargo.toml'))) {
    return true;
  }
  console.log('Creating Stylus fixture project...');
  try {
    execSync(`cargo stylus new ${STYLUS_PROJECT_PATH}`, { stdio: 'pipe', timeout: 30000 });
    return true;
  } catch {
    console.error('Failed to create Stylus project. Is cargo-stylus installed?');
    return false;
  }
}

// ---------------------------------------------------------------------------

async function main() {
  const publicClient = createPublicClient({
    chain: arbitrumLocal,
    transport: http(TESTNODE_RPC),
  });

  // Generate deployer wallets and fund them from the pre-funded account
  const funder = privateKeyToAccount(FUNDER_KEY);
  const funderClient = createWalletClient({
    account: funder,
    chain: arbitrumLocal,
    transport: http(TESTNODE_RPC),
  });

  const allKeys = Array.from({ length: NUM_DEPLOYERS }, () => generatePrivateKey());
  const accounts = allKeys.map((key) => privateKeyToAccount(key));
  const walletClients = accounts.map((account) =>
    createWalletClient({ account, chain: arbitrumLocal, transport: http(TESTNODE_RPC) }),
  );

  // Check Stylus support
  try {
    const version = await publicClient.readContract({
      address: ARB_WASM_ADDRESS,
      abi: arbWasmAbi,
      functionName: 'stylusVersion',
    });
    console.log(`Stylus version: ${version}`);
  } catch {
    console.error('ERROR: Cannot reach testnode or Stylus not enabled.');
    process.exit(1);
  }

  // Fund all deployers
  console.log('Funding deployer wallets...');
  for (const account of accounts) {
    const tx = await funderClient.sendTransaction({
      to: account.address,
      value: 100_000_000_000_000_000_000n, // 100 ETH
    });
    await publicClient.waitForTransactionReceipt({ hash: tx });
  }
  console.log(`Funded ${NUM_DEPLOYERS} wallets with 100 ETH each`);

  // Ensure Stylus project exists
  const hasStylusProject = ensureStylusProject();

  console.log('');
  console.log('Seed script - Stylus Dashboard');
  console.log('==============================');
  console.log(`RPC: ${TESTNODE_RPC} | Interval: ${DEPLOY_INTERVAL_MS}ms`);
  console.log(`Mode: ${hasStylusProject ? 'EVM + Stylus' : 'EVM only'}`);
  console.log(`Deployers: ${accounts.map((a) => a.address.slice(0, 10) + '...').join(', ')}`);
  console.log('');
  console.log('Deploying contracts... (Ctrl+C to stop)');
  console.log('');

  let evmCount = 0;
  let stylusCount = 0;

  while (true) {
    const keyIdx = randomInt(0, allKeys.length - 1);
    const deployer = walletClients[keyIdx];
    const attemptStylus = hasStylusProject && Math.random() < 0.35;

    try {
      if (attemptStylus) {
        const address = deployStylus(allKeys[keyIdx]);
        if (address) {
          stylusCount++;
          console.log(
            `  [STYLUS #${stylusCount}] contract=${address} deployer=${accounts[keyIdx].address.slice(0, 10)}...`,
          );
        }
      } else {
        const bytecode = randomEvmBytecode();
        const hash = await deployer.deployContract({ bytecode, abi: [] });
        const receipt = await publicClient.waitForTransactionReceipt({ hash });
        evmCount++;
        if (evmCount <= 3 || evmCount % 5 === 0) {
          console.log(
            `  [EVM    #${evmCount}] contract=${receipt.contractAddress} deployer=${accounts[keyIdx].address.slice(0, 10)}...`,
          );
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message.slice(0, 80) : String(err);
      console.error(`  [ERROR] ${msg}`);
    }

    const jitter = randomInt(-500, 500);
    await new Promise((r) => setTimeout(r, Math.max(500, DEPLOY_INTERVAL_MS + jitter)));
  }
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
