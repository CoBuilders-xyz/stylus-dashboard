import { getDayId } from './stats.js';
import { hexToNumber } from './utils.js';
import {
  ARBITRUM_ONE_CHAIN_ID,
  HISTORICAL_END_BLOCK,
  HISTORICAL_WINDOW,
  STYLUS_CODE_PREFIX,
} from '../config.js';

export function isArbitrumOne(chainId: number): boolean {
  return chainId === ARBITRUM_ONE_CHAIN_ID;
}

export type EvmCreation = {
  address: string;
  deployer: string;
  blockNumber: number;
  timestamp: number;
  isStylus: boolean;
};

type HypersyncTrace = {
  type?: string;
  address?: string;
  from?: string;
  block_number?: number;
  code?: string;
};

type HypersyncBlock = {
  number?: number;
  timestamp?: string;
};

export type HypersyncPage = {
  data?: { traces?: HypersyncTrace[]; blocks?: HypersyncBlock[] }[];
  next_block: number;
  archive_height?: number;
};

type RpcTransaction = {
  hash: string;
  to: string | null;
};

export type RpcBlock = {
  number: string;
  timestamp: string;
  transactions: RpcTransaction[];
};

export type RpcReceipt = {
  status?: string;
  contractAddress?: string | null;
  from: string;
  blockNumber: string;
};

// Misaligned windows would silently overlap or leave gaps in the scan,
// so refuse to start instead.
export function assertHistoricalAlignment(startBlock: number): void {
  if ((HISTORICAL_END_BLOCK - startBlock) % HISTORICAL_WINDOW !== 0) {
    throw new Error(
      `HISTORICAL_END_BLOCK (${HISTORICAL_END_BLOCK}) must be aligned to start_block ` +
        `(${startBlock}) in HISTORICAL_WINDOW (${HISTORICAL_WINDOW}) strides`,
    );
  }
}

type DayBucket = {
  dayId: string;
  count: number;
  timestamp: number;
};

export function groupCreationsByDay(creations: EvmCreation[]): DayBucket[] {
  const byDay = new Map<string, DayBucket>();
  for (const creation of creations) {
    const dayId = getDayId(creation.timestamp);
    const bucket = byDay.get(dayId);
    if (bucket) {
      bucket.count += 1;
    } else {
      byDay.set(dayId, { dayId, count: 1, timestamp: creation.timestamp });
    }
  }
  return [...byDay.values()];
}

// First block the realtime scan owns: right after the historical boundary,
// or the chain start when it begins above the boundary.
export function realtimeFloor(startBlock: number): number {
  return Math.max(HISTORICAL_END_BLOCK + 1, startBlock);
}

// A handler firing at block N is responsible for the N-W+1..N range.
// The clamp keeps the first window from reaching below the chain start.
export function windowBounds(
  firingBlock: number,
  windowSize: number,
  floorBlock: number,
): { fromBlock: number; toBlock: number } {
  return {
    fromBlock: Math.max(floorBlock, firingBlock - windowSize + 1),
    toBlock: firingBlock,
  };
}

// Traces only carry block numbers; timestamps come from the blocks table
// in the same response. Failed creations arrive without an address, so
// requiring one filters reverts out.
export function extractCreations(pages: HypersyncPage[]): EvmCreation[] {
  const timestamps = new Map<number, number>();
  for (const page of pages) {
    for (const batch of page.data ?? []) {
      for (const block of batch.blocks ?? []) {
        if (block.number !== undefined && block.timestamp !== undefined) {
          timestamps.set(block.number, hexToNumber(block.timestamp));
        }
      }
    }
  }

  const creations: EvmCreation[] = [];
  for (const page of pages) {
    for (const batch of page.data ?? []) {
      for (const trace of batch.traces ?? []) {
        if (trace.type !== 'create' || !trace.address || !trace.from || trace.block_number === undefined) {
          continue;
        }
        const timestamp = timestamps.get(trace.block_number);
        if (timestamp === undefined) {
          throw new Error(`Missing block timestamp for block ${trace.block_number}`);
        }
        creations.push({
          address: trace.address,
          deployer: trace.from,
          blockNumber: trace.block_number,
          timestamp,
          isStylus: (trace.code ?? '').toLowerCase().startsWith(STYLUS_CODE_PREFIX),
        });
      }
    }
  }
  return creations.sort((a, b) => a.blockNumber - b.blockNumber);
}

// Devnode path sees direct deployments only: a tx without `to` plus a
// successful receipt carrying the new contract address.
export function extractDirectCreations(
  blocks: RpcBlock[],
  receipts: (RpcReceipt | null)[],
): EvmCreation[] {
  const timestamps = new Map<number, number>();
  for (const block of blocks) {
    timestamps.set(hexToNumber(block.number), hexToNumber(block.timestamp));
  }

  const creations: EvmCreation[] = [];
  for (const receipt of receipts) {
    if (!receipt || receipt.status !== '0x1' || !receipt.contractAddress) {
      continue;
    }
    const blockNumber = hexToNumber(receipt.blockNumber);
    const timestamp = timestamps.get(blockNumber);
    if (timestamp === undefined) {
      throw new Error(`Missing block timestamp for block ${blockNumber}`);
    }
    creations.push({
      address: receipt.contractAddress,
      deployer: receipt.from,
      blockNumber,
      timestamp,
      isStylus: false,
    });
  }
  return creations.sort((a, b) => a.blockNumber - b.blockNumber);
}
