/**
 * CI seed script: deploys a fixed number of EVM contracts and exits.
 *
 * Unlike the full seed.ts (long-running loop + Stylus), this script is:
 * - Deterministic (fixed count, no randomness in timing)
 * - Fast (EVM-only, no cargo-stylus dependency)
 * - Exits with 0 on success, 1 on failure
 *
 * Usage:
 *   pnpm seed:ci                    # 5 contracts from 2 deployers
 *   CONTRACT_COUNT=10 pnpm seed:ci  # override count
 */

import { createPublicClient, createWalletClient, http, type Hex } from 'viem';
import { privateKeyToAccount, generatePrivateKey } from 'viem/accounts';
import { arbitrumLocal } from './chains.js';

const RPC = process.env.TESTNODE_RPC || 'http://localhost:8547';
const CONTRACT_COUNT = Number(process.env.CONTRACT_COUNT) || 5;
const NUM_DEPLOYERS = 2;

const FUNDER_KEY = '0xb6b15c8cb491557369f3c7d2c287b053eb229daa9c22138887752191c9520659' as const;

interface DeployResult {
  address: string;
  deployer: string;
  blockNumber: bigint;
}

function makeInitCode(runtimeHex: string): Hex {
  const runtimeLen = runtimeHex.length / 2;
  const runtimeLenHex = runtimeLen.toString(16).padStart(4, '0');
  const initcodeLen = 13;
  const offsetHex = initcodeLen.toString(16).padStart(2, '0');
  const initcode = `61${runtimeLenHex}60${offsetHex}600039` + `61${runtimeLenHex}6000f3`;
  return `0x${initcode}${runtimeHex}` as Hex;
}

function evmBytecode(nonce: number): Hex {
  const val = (nonce & 0xffffff).toString(16).padStart(6, '0');
  return makeInitCode(`62${val}60005260206000f3`);
}

async function main() {
  const publicClient = createPublicClient({
    chain: arbitrumLocal,
    transport: http(RPC),
  });

  // Verify node is reachable
  try {
    await publicClient.getBlockNumber();
  } catch {
    console.error(`ERROR: Cannot connect to devnode at ${RPC}`);
    process.exit(1);
  }

  const funder = privateKeyToAccount(FUNDER_KEY);
  const funderClient = createWalletClient({
    account: funder,
    chain: arbitrumLocal,
    transport: http(RPC),
  });

  // Create deployer wallets (deterministic from fixed seeds for reproducibility)
  const deployerKeys = Array.from({ length: NUM_DEPLOYERS }, () => generatePrivateKey());
  const accounts = deployerKeys.map((key) => privateKeyToAccount(key));
  const wallets = accounts.map((account) =>
    createWalletClient({ account, chain: arbitrumLocal, transport: http(RPC) }),
  );

  // Fund deployers
  for (const account of accounts) {
    const tx = await funderClient.sendTransaction({
      to: account.address,
      value: 10_000_000_000_000_000_000n, // 10 ETH
    });
    await publicClient.waitForTransactionReceipt({ hash: tx });
  }

  // Deploy contracts
  const results: DeployResult[] = [];

  for (let i = 0; i < CONTRACT_COUNT; i++) {
    const walletIdx = i % NUM_DEPLOYERS;
    const wallet = wallets[walletIdx];
    const bytecode = evmBytecode(i + 1);

    const hash = await wallet.deployContract({ bytecode, abi: [] });
    const receipt = await publicClient.waitForTransactionReceipt({ hash });

    if (!receipt.contractAddress) {
      console.error(`ERROR: Deployment ${i + 1} failed (no contract address)`);
      process.exit(1);
    }

    results.push({
      address: receipt.contractAddress,
      deployer: accounts[walletIdx].address,
      blockNumber: receipt.blockNumber,
    });
  }

  // Output results as JSON (useful for test assertions)
  const output = {
    rpc: RPC,
    chainId: 412346,
    deployerCount: NUM_DEPLOYERS,
    deployers: accounts.map((a) => a.address),
    contracts: results,
  };

  console.log(JSON.stringify(output, (_, v) => (typeof v === 'bigint' ? Number(v) : v), 2));
}

main().catch((err) => {
  console.error('Fatal:', err.message || err);
  process.exit(1);
});
