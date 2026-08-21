import { createEffect, S } from 'envio';
import { HYPER_SYNC_QUERY_URL, LAG_RETRY_ATTEMPTS, LAG_RETRY_DELAY_MS } from '../config';
import { hexToNumber, postJson, sleep } from './utils';
type HypersyncTx = {
  hash?: string;
  from?: string;
  to?: string;
  block_number?: number;
};
type HypersyncBlock = {
  number?: number;
  timestamp?: string;
};
type TxPage = {
  data?: { transactions?: HypersyncTx[]; blocks?: HypersyncBlock[] }[];
  next_block: number;
  archive_height?: number;
};
async function fetchHyperSyncTransactionsTo(
  addresses: string[],
  fromBlock: number,
  toBlock: number,
): Promise<{ hash: string; from: string; to: string; blockNumber: number; timestamp: number }[]> {
  const token = process.env.ENVIO_API_TOKEN;
  if (!token) {
    throw new Error('ENVIO_API_TOKEN is required to query HyperSync');
  }
  
  const blockTimestamps = new Map<number, number>();
  const results: { hash: string; from: string; to: string; blockNumber: number; timestamp: number }[] = [];
  let from = fromBlock;
  let lagRetries = 0;
  while (from <= toBlock) {
    const res = await postJson(
      HYPER_SYNC_QUERY_URL,
      {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      JSON.stringify({
        from_block: from,
        to_block: toBlock + 1,
        transactions: [{ to: addresses }],
        field_selection: {
          transaction: ['hash', 'from', 'to', 'block_number'],
          block: ['number', 'timestamp'],
        },
      }),
    );
    if (!res.ok) {
      throw new Error(`HyperSync query failed: ${res.status} ${await res.text()}`);
    }
    const page = (await res.json()) as TxPage;
    if (typeof page?.next_block !== 'number') {
      throw new Error('HyperSync response is missing next_block');
    }
    if (page.next_block <= from) {
      const archiveCoversTarget = (page.archive_height ?? 0) >= toBlock;
      if (archiveCoversTarget || lagRetries >= LAG_RETRY_ATTEMPTS) {
        throw new Error(`HyperSync pagination stalled at block ${from}`);
      }
      lagRetries += 1;
      await sleep(LAG_RETRY_DELAY_MS);
      continue;
    }
    for (const batch of page.data ?? []) {
      for (const block of batch.blocks ?? []) {
        if (block.number !== undefined && block.timestamp !== undefined) {
          blockTimestamps.set(block.number, hexToNumber(block.timestamp));
        }
      }
    }
    for (const batch of page.data ?? []) {
      for (const tx of batch.transactions ?? []) {
        if (!tx.from || !tx.to || tx.block_number === undefined) continue;
        const timestamp = blockTimestamps.get(tx.block_number);
        if (timestamp === undefined) continue; // bloque no llegó todavía, se resuelve en una página posterior
        results.push({
          hash: tx.hash ?? '',
          from: tx.from.toLowerCase(),
          to: tx.to.toLowerCase(),
          blockNumber: tx.block_number,
          timestamp,
        });
      }
    }
    from = page.next_block;
    lagRetries = 0;
  }
  return results;
}
export const getTransactionsTo = createEffect(
  {
    name: 'getTransactionsTo',
    input: S.schema({
      addresses: S.array(S.string),
      fromBlock: S.number,
      toBlock: S.number,
    }),
    output: S.array(
      S.schema({
        hash: S.string,
        from: S.string,
        to: S.string,
        blockNumber: S.number,
        timestamp: S.number,
      }),
    ),
    rateLimit: false,
    cache: false,
  },
  async ({ input }) => {
    if (input.addresses.length === 0) return [];
    return fetchHyperSyncTransactionsTo(input.addresses, input.fromBlock, input.toBlock);
  },
);