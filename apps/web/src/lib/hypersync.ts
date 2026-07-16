/**
 * HyperSync client for querying EVM contract creation data directly.
 * Used for the Stylus vs Solidity comparison section.
 *
 * This queries Arbitrum's HyperSync endpoint for contract creation
 * transactions and classifies them by bytecode prefix (0xEFF000 = Stylus).
 */

const _HYPERSYNC_ENDPOINT = process.env.HYPERSYNC_ENDPOINT || 'https://arbitrum.hypersync.xyz';

const STYLUS_PREFIX = '0xeff000';

export interface DeploymentStats {
  date: string;
  stylus: number;
  solidity: number;
}

export async function getDeploymentComparison(
  _fromBlock: number,
  _toBlock: number,
): Promise<DeploymentStats[]> {
  // TODO: Implement HyperSync query for contract creation transactions
  // 1. Query receipts where contractAddress is set
  // 2. For each, get the bytecode and check prefix
  // 3. Aggregate by day
  //
  // Example HyperSync query structure:
  // POST ${HYPERSYNC_ENDPOINT}/query
  // {
  //   "from_block": fromBlock,
  //   "to_block": toBlock,
  //   "receipts": [{ "contract_address": [] }],
  //   "field_selection": {
  //     "receipt": ["contract_address", "block_number"]
  //   }
  // }

  return [];
}

export function isStylusContract(bytecode: string): boolean {
  return bytecode.toLowerCase().startsWith(STYLUS_PREFIX);
}
