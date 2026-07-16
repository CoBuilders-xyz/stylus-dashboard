/**
 * Seed script for local development with Arbitrum testnode.
 *
 * This script deploys and activates sample Stylus contracts on the local
 * testnode to generate ProgramActivated events for the indexer.
 *
 * Prerequisites:
 * - Arbitrum nitro-testnode running with --stylus flag
 * - cargo-stylus installed (for compiling WASM contracts)
 *
 * Usage:
 *   npx tsx scripts/seed.ts
 */

import { createPublicClient, createWalletClient, http, parseAbi } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { arbitrumLocal } from './chains';

const TESTNODE_RPC = process.env.TESTNODE_RPC || 'http://localhost:8547';

// Default testnode funded account
const FUNDED_KEY = '0xb6b15c8cb491557369f3c7d2c287b053eb229daa9c22138887752191c9520659';

const ARB_WASM_ADDRESS = '0x0000000000000000000000000000000000000071' as const;

const arbWasmAbi = parseAbi([
  'function activateProgram(address program) payable returns (uint16 version, uint256 dataFee)',
  'function stylusVersion() view returns (uint16 version)',
  'event ProgramActivated(bytes32 indexed codehash, bytes32 moduleHash, address program, uint256 dataFee, uint16 version)',
]);

async function main() {
  const account = privateKeyToAccount(FUNDED_KEY);

  const publicClient = createPublicClient({
    chain: arbitrumLocal,
    transport: http(TESTNODE_RPC),
  });

  const walletClient = createWalletClient({
    account,
    chain: arbitrumLocal,
    transport: http(TESTNODE_RPC),
  });

  console.log('Seed script for Stylus Dashboard');
  console.log('=================================');
  console.log(`RPC: ${TESTNODE_RPC}`);
  console.log(`Account: ${account.address}`);

  // Check Stylus version to verify testnode is running with Stylus
  try {
    const version = await publicClient.readContract({
      address: ARB_WASM_ADDRESS,
      abi: arbWasmAbi,
      functionName: 'stylusVersion',
    });
    console.log(`Stylus version: ${version}`);
  } catch (error) {
    console.error('ERROR: Cannot read stylusVersion. Is the testnode running with --stylus?');
    console.error(
      'Start it with: cd ../nitro-testnode && ./test-node.bash --init --stylus',
    );
    process.exit(1);
  }

  console.log('\nTo generate test events, deploy a Stylus contract:');
  console.log('  1. cd to a Stylus project (e.g. stylus-hello-world)');
  console.log('  2. cargo stylus deploy --private-key <key> --endpoint http://localhost:8547');
  console.log('  3. The deployment will emit a ProgramActivated event');
  console.log('\nAlternatively, if you have a pre-compiled WASM contract:');
  console.log('  1. Deploy the WASM bytecode as a contract');
  console.log('  2. Call activateProgram(contractAddress) on ArbWasm (0x71)');
  console.log('\nThe indexer will pick up the events automatically.');
}

main().catch(console.error);
