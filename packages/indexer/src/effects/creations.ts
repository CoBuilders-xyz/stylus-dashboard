import { createEffect, S } from 'envio';
import {
  extractCreations,
  extractDirectCreations,
  type EvmCreation,
  type HypersyncPage,
  type RpcBlock,
  type RpcReceipt,
} from '../helpers/evm.js';
import { postJson, RateLimiter, sleep } from '../helpers/utils.js';
import {
  DEFAULT_DEVNODE_RPC_URL,
  HYPERSYNC_CALLS_PER_MINUTE,
  LAG_RETRY_ATTEMPTS,
  LAG_RETRY_DELAY_MS,
  hypersyncTracesUrl,
} from '../config.js';

// Envio rate-limits effect invocations, while this shared limiter also covers
// pagination and transient retries performed inside a single invocation.
const hypersyncRateLimiter = new RateLimiter(HYPERSYNC_CALLS_PER_MINUTE, 60_000);

type CreationsInput = {
  chainId: number;
  fromBlock: number;
  toBlock: number;
};

// Pages through HyperSync until the range is covered (to_block is
// exclusive, next_block marks the resume point). When the traces archive
// is still behind the range we need, wait and retry instead of failing.
export async function fetchHypersyncCreations(input: CreationsInput): Promise<EvmCreation[]> {
  const token = process.env.ENVIO_API_TOKEN;
  if (!token) {
    throw new Error('ENVIO_API_TOKEN is required to query HyperSync traces');
  }

  const url = hypersyncTracesUrl(input.chainId);
  // Extracted per page and dropped. Keeping the raw pages for a whole window
  // is what ran the process out of memory.
  const creations: EvmCreation[] = [];
  let fromBlock = input.fromBlock;
  let lagRetries = 0;

  while (fromBlock <= input.toBlock) {
    const res = await postJson(
      url,
      {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      JSON.stringify({
        from_block: fromBlock,
        to_block: input.toBlock + 1,
        traces: [{ type: ['create'] }],
        // Brings in the transaction behind each trace, the only way to get the
        // deployer rather than the factory that ran the creation.
        join_mode: 'JoinAll',
        field_selection: {
          // `code` is the deployed bytecode.
          trace: ['type', 'address', 'from', 'block_number', 'transaction_hash', 'code'],
          transaction: ['hash', 'from'],
          block: ['number', 'timestamp'],
        },
      }),
      hypersyncRateLimiter,
    );
    if (!res.ok) {
      throw new Error(`HyperSync traces query failed: ${res.status} ${res.body}`);
    }
    const page = JSON.parse(res.body) as HypersyncPage;
    if (typeof page?.next_block !== 'number') {
      throw new Error('HyperSync response is missing next_block');
    }
    if (page.next_block <= fromBlock) {
      const archiveCoversTarget = (page.archive_height ?? 0) >= input.toBlock;
      if (archiveCoversTarget || lagRetries >= LAG_RETRY_ATTEMPTS) {
        throw new Error(`HyperSync pagination stalled at block ${fromBlock}`);
      }
      lagRetries += 1;
      await sleep(LAG_RETRY_DELAY_MS);
      continue;
    }
    for (const creation of extractCreations([page])) {
      creations.push(creation);
    }
    fromBlock = page.next_block;
    lagRetries = 0;
  }

  return creations;
}

type RpcCall = { method: string; params: unknown[] };

// Sends every call in one JSON-RPC batch request, then matches responses
// back by id (they may arrive out of order).
async function rpcBatch<T>(calls: RpcCall[]): Promise<T[]> {
  if (calls.length === 0) {
    return [];
  }
  const rpcUrl = process.env.DEVNODE_RPC_URL ?? DEFAULT_DEVNODE_RPC_URL;
  const res = await postJson(
    rpcUrl,
    { 'Content-Type': 'application/json' },
    JSON.stringify(
      calls.map((call, id) => ({ jsonrpc: '2.0', id, method: call.method, params: call.params })),
    ),
  );
  if (!res.ok) {
    throw new Error(`RPC batch failed: ${res.status} ${res.body}`);
  }
  const results = JSON.parse(res.body) as { id: number; result?: T; error?: { message: string } }[];
  const byId = new Map(results.map((r) => [r.id, r]));
  return calls.map((call, id) => {
    const entry = byId.get(id);
    if (!entry || entry.error) {
      throw new Error(`RPC ${call.method} failed: ${entry?.error?.message ?? 'missing response'}`);
    }
    if (entry.result === undefined) {
      throw new Error(`RPC ${call.method} returned no result`);
    }
    return entry.result as T;
  });
}

// Devnode source: there is no HyperSync for a local chain, so creations
// come straight from the node's RPC — blocks with full transactions to
// find `to: null` deploys, then their receipts for address and status.
export async function fetchRpcCreations(input: CreationsInput): Promise<EvmCreation[]> {
  const blockNumbers = [];
  for (let n = input.fromBlock; n <= input.toBlock; n++) {
    blockNumbers.push(n);
  }
  const blocks = await rpcBatch<RpcBlock | null>(
    blockNumbers.map((n) => ({ method: 'eth_getBlockByNumber', params: [`0x${n.toString(16)}`, true] })),
  );

  const presentBlocks = blocks.filter((b): b is RpcBlock => b !== null);
  for (const block of presentBlocks) {
    if (!Array.isArray(block.transactions)) {
      throw new Error(`RPC block ${block.number} is missing its transactions array`);
    }
  }
  const candidates = presentBlocks.flatMap((block) =>
    block.transactions.filter((tx) => tx.to == null),
  );
  const receipts = await rpcBatch<RpcReceipt | null>(
    candidates.map((tx) => ({ method: 'eth_getTransactionReceipt', params: [tx.hash] })),
  );

  return extractDirectCreations(presentBlocks, receipts);
}

// One instance per effect: createEffect attaches metadata to the schema.
const creationsInput = () => ({
  chainId: S.number,
  fromBlock: S.number,
  toBlock: S.number,
});

const creationsOutput = () =>
  S.array(
    S.schema({
      address: S.string,
      deployer: S.string,
      blockNumber: S.number,
      timestamp: S.number,
      isStylus: S.boolean,
    }),
  );

// Cached: after a restart, already-scanned windows replay from the cache
// instead of hitting the upstream again. Capped because the preload pass
// fires the whole batch at once and the token allows 30 requests a minute.
export const getHypersyncCreations = createEffect(
  {
    name: 'getHypersyncCreations',
    input: creationsInput(),
    output: creationsOutput(),
    rateLimit: { calls: HYPERSYNC_CALLS_PER_MINUTE, per: 'minute' },
    cache: true,
  },
  async ({ input }) => fetchHypersyncCreations(input),
);

// No cap: the devnode is not metered and runs a block at a time.
export const getRpcCreations = createEffect(
  {
    name: 'getRpcCreations',
    input: creationsInput(),
    output: creationsOutput(),
    rateLimit: false,
    cache: true,
  },
  async ({ input }) => fetchRpcCreations(input),
);
