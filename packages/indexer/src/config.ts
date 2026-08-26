export const ARBITRUM_ONE_CHAIN_ID = 42161;
export const STYLUS_DEPLOYER_ADDRESS = '0xcecba2f1dc234f70dd89f2041029807f8d03a990';
export const STYLUS_CODE_PREFIX = '0xeff000';

export const HISTORICAL_WINDOW = 10_000;
export const REALTIME_WINDOW = 300;
// Must stay aligned with the mainnet start_block: (HISTORICAL_END_BLOCK - start_block) % HISTORICAL_WINDOW === 0
export const HISTORICAL_END_BLOCK = 490_000_000;

export const DEFAULT_DEVNODE_RPC_URL = 'http://localhost:8547';
export const hypersyncTracesUrl = (chainId: number) =>
  `https://${chainId}-traces.hypersync.xyz/query`;

export const LAG_RETRY_ATTEMPTS = 10;
export const LAG_RETRY_DELAY_MS = 5_000;
export const TRANSIENT_RETRY_ATTEMPTS = 5;
export const TRANSIENT_RETRY_DELAY_MS = 2_000;
