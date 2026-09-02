import { describe, it, expect, vi, afterEach } from 'vitest';
import { createTestIndexer } from 'envio';
import {
  ARBITRUM_ONE_CHAIN_ID,
  HISTORICAL_END_BLOCK,
  HISTORICAL_WINDOW,
  REALTIME_WINDOW,
  STYLUS_DEPLOYER_ADDRESS,
} from '../src/config';
import { hexToNumber } from '../src/helpers/utils';
import {
  assertHistoricalAlignment,
  extractCreations,
  extractDirectCreations,
  firstDayByDeployer,
  groupCreationsByDay,
  isArbitrumOne,
  realtimeFloor,
  windowBounds,
  type HypersyncPage,
  type RpcBlock,
  type RpcReceipt,
} from '../src/helpers/evm';
import { fetchHypersyncCreations, fetchRpcCreations } from '../src/effects/creations';
import {
  carryGlobalStats,
  getDayId,
  getDayStartTimestamp,
  EXPIRY_SECONDS,
} from '../src/helpers/stats';
import { stubBlock } from './support/rpcStub';
import '../src/handlers/ArbWasm.js';
import '../src/handlers/EvmDeployments.js';

const MAINNET_START_BLOCK = 240_000_000;

const CODEHASH = '0x' + 'ab'.repeat(32);
const MODULE_HASH = '0x' + 'cd'.repeat(32);
const PROGRAM = '0x525c2aBA45F66102bC4F45cA629C93F0f0dcC9e8';
const DEPLOYER = '0xF39FD6e51aad88F6F4ce6aB8827279cffFb92266';
const ACTIVATION_TS = 1705318200; // 2024-01-15 12:30:00 UTC
const DEPLOY_TS = ACTIVATION_TS - 24 * 60 * 60; // 2024-01-14

describe('evm helpers', () => {
  it('isArbitrumOne matches only mainnet', () => {
    expect(isArbitrumOne(ARBITRUM_ONE_CHAIN_ID)).toBe(true);
    expect(isArbitrumOne(412346)).toBe(false);
  });

  it('hexToNumber parses hex timestamps', () => {
    expect(hexToNumber('0x66d855ad')).toBe(0x66d855ad);
    expect(hexToNumber('0x0')).toBe(0);
  });

  it('HISTORICAL_END_BLOCK is aligned to mainnet start_block', () => {
    expect((HISTORICAL_END_BLOCK - MAINNET_START_BLOCK) % HISTORICAL_WINDOW).toBe(0);
  });

  describe('assertHistoricalAlignment', () => {
    it('accepts an aligned start block', () => {
      expect(() => assertHistoricalAlignment(MAINNET_START_BLOCK)).not.toThrow();
    });

    it('rejects a misaligned start block', () => {
      expect(() => assertHistoricalAlignment(MAINNET_START_BLOCK + 1)).toThrow('aligned');
    });
  });

  describe('firstDayByDeployer', () => {
    const creation = (deployer: string, timestamp: number) => ({
      address: '0x' + timestamp,
      deployer,
      blockNumber: 1,
      timestamp,
      isStylus: false,
    });
    const endOfDay = 1705363199; // 2024-01-15 23:59:59 UTC
    const startOfNext = 1705363200; // 2024-01-16 00:00:00 UTC

    it('keeps the day of a deployer earliest creation, not its later ones', () => {
      const map = firstDayByDeployer([
        creation('0xAAA', endOfDay - 10),
        creation('0xAAA', startOfNext),
      ]);
      expect(map.get('0xaaa')).toBe('2024-01-15');
    });

    it('gives the same answer when the creations arrive out of order', () => {
      const map = firstDayByDeployer([
        creation('0xAAA', startOfNext),
        creation('0xAAA', endOfDay - 10),
      ]);
      expect(map.get('0xaaa')).toBe('2024-01-15');
    });

    it('lowercases the deployer so it matches the registry ids', () => {
      const map = firstDayByDeployer([creation('0xABCDEF', endOfDay)]);
      expect([...map.keys()]).toEqual(['0xabcdef']);
    });

    it('reports one entry per deployer even with many creations', () => {
      const map = firstDayByDeployer([
        creation('0xAAA', endOfDay),
        creation('0xBBB', endOfDay),
        creation('0xAAA', endOfDay + 1),
      ]);
      expect(map.size).toBe(2);
    });
  });

  describe('groupCreationsByDay', () => {
    it('buckets creations on both sides of a UTC midnight into separate days', () => {
      const creation = (timestamp: number, address: string) => ({
        address,
        deployer: '0xD',
        blockNumber: 1,
        timestamp,
        isStylus: false,
      });
      const endOfDay = 1705363199; // 2024-01-15 23:59:59 UTC
      const startOfNext = 1705363200; // 2024-01-16 00:00:00 UTC

      const buckets = groupCreationsByDay([
        creation(endOfDay, '0xA'),
        creation(endOfDay - 10, '0xB'),
        creation(startOfNext, '0xC'),
      ]);

      expect(buckets).toEqual([
        { dayId: '2024-01-15', count: 2, timestamp: endOfDay },
        { dayId: '2024-01-16', count: 1, timestamp: startOfNext },
      ]);
    });
  });

  describe('windowBounds', () => {
    it('clamps the first historical window to the start block', () => {
      expect(windowBounds(MAINNET_START_BLOCK, HISTORICAL_WINDOW, MAINNET_START_BLOCK)).toEqual({
        fromBlock: MAINNET_START_BLOCK,
        toBlock: MAINNET_START_BLOCK,
      });
    });

    it('partitions adjacent historical windows without gaps or overlaps', () => {
      const first = windowBounds(
        MAINNET_START_BLOCK + HISTORICAL_WINDOW,
        HISTORICAL_WINDOW,
        MAINNET_START_BLOCK,
      );
      const second = windowBounds(
        MAINNET_START_BLOCK + 2 * HISTORICAL_WINDOW,
        HISTORICAL_WINDOW,
        MAINNET_START_BLOCK,
      );
      expect(first).toEqual({
        fromBlock: MAINNET_START_BLOCK + 1,
        toBlock: MAINNET_START_BLOCK + HISTORICAL_WINDOW,
      });
      expect(second.fromBlock).toBe(first.toBlock + 1);
    });

    it('partitions the historical-realtime seam exactly', () => {
      const lastHistorical = windowBounds(
        HISTORICAL_END_BLOCK,
        HISTORICAL_WINDOW,
        MAINNET_START_BLOCK,
      );
      const firstRealtime = windowBounds(
        HISTORICAL_END_BLOCK + REALTIME_WINDOW,
        REALTIME_WINDOW,
        HISTORICAL_END_BLOCK + 1,
      );
      expect(lastHistorical.toBlock).toBe(HISTORICAL_END_BLOCK);
      expect(firstRealtime.fromBlock).toBe(HISTORICAL_END_BLOCK + 1);
      expect(firstRealtime.toBlock).toBe(HISTORICAL_END_BLOCK + REALTIME_WINDOW);
    });

    it('covers a start block above the historical boundary from its first firing', () => {
      const startBlock = HISTORICAL_END_BLOCK + 450;
      const floor = realtimeFloor(startBlock);
      const firstFiring = floor + REALTIME_WINDOW - 1;
      expect(windowBounds(firstFiring, REALTIME_WINDOW, floor)).toEqual({
        fromBlock: startBlock,
        toBlock: startBlock + REALTIME_WINDOW - 1,
      });
      const secondFiring = firstFiring + REALTIME_WINDOW;
      expect(windowBounds(secondFiring, REALTIME_WINDOW, floor).fromBlock).toBe(
        startBlock + REALTIME_WINDOW,
      );
    });

    it('partitions adjacent realtime windows', () => {
      const first = windowBounds(
        HISTORICAL_END_BLOCK + REALTIME_WINDOW,
        REALTIME_WINDOW,
        HISTORICAL_END_BLOCK + 1,
      );
      const second = windowBounds(
        HISTORICAL_END_BLOCK + 2 * REALTIME_WINDOW,
        REALTIME_WINDOW,
        HISTORICAL_END_BLOCK + 1,
      );
      expect(second.fromBlock).toBe(first.toBlock + 1);
    });
  });

  describe('extractCreations', () => {
    const page = (
      traces: HypersyncPage['data'] extends (infer B)[] | undefined
        ? B extends { traces?: infer T }
          ? T
          : never
        : never,
      blocks: { number: number; timestamp: string }[],
    ): HypersyncPage => ({
      data: [{ traces, blocks }],
      next_block: 0,
    });

    it('joins block timestamps and lowercases nothing (raw passthrough)', () => {
      const result = extractCreations([
        page(
          [{ type: 'create', address: '0xAAA', from: '0xBBB', block_number: 10 }],
          [{ number: 10, timestamp: '0x64' }],
        ),
      ]);
      expect(result).toEqual([
        { address: '0xAAA', deployer: '0xBBB', blockNumber: 10, timestamp: 100, isStylus: false },
      ]);
    });

    it('prefers the transaction sender over the trace creator', () => {
      // The trace creator is the factory; the deployer we want sent the tx
      const result = extractCreations([
        {
          data: [
            {
              traces: [
                {
                  type: 'create',
                  address: '0xAAA',
                  from: '0xFACTORY',
                  block_number: 10,
                  transaction_hash: '0xHASH',
                },
              ],
              transactions: [{ hash: '0xhash', from: '0xWALLET' }],
              blocks: [{ number: 10, timestamp: '0x64' }],
            },
          ],
          next_block: 0,
        },
      ]);
      expect(result[0].deployer).toBe('0xWALLET');
    });

    it('falls back to the trace creator when the transaction is missing', () => {
      const result = extractCreations([
        page(
          [
            {
              type: 'create',
              address: '0xAAA',
              from: '0xFACTORY',
              block_number: 10,
              transaction_hash: '0xHASH',
            },
          ],
          [{ number: 10, timestamp: '0x64' }],
        ),
      ]);
      expect(result[0].deployer).toBe('0xFACTORY');
    });

    it('drops failed creations (traces without address)', () => {
      const result = extractCreations([
        page(
          [
            { type: 'create', from: '0xBBB', block_number: 10 },
            { type: 'create', address: '0xAAA', from: '0xBBB', block_number: 10 },
          ],
          [{ number: 10, timestamp: '0x64' }],
        ),
      ]);
      expect(result).toHaveLength(1);
    });

    it('sorts by block number across pages', () => {
      const result = extractCreations([
        page(
          [{ type: 'create', address: '0xC', from: '0xD', block_number: 20 }],
          [{ number: 20, timestamp: '0xc8' }],
        ),
        page(
          [{ type: 'create', address: '0xA', from: '0xB', block_number: 10 }],
          [{ number: 10, timestamp: '0x64' }],
        ),
      ]);
      expect(result.map((c) => c.blockNumber)).toEqual([10, 20]);
    });

    it('throws when a trace references a block without timestamp', () => {
      expect(() =>
        extractCreations([
          page([{ type: 'create', address: '0xA', from: '0xB', block_number: 10 }], []),
        ]),
      ).toThrow('Missing block timestamp');
    });
  });

  describe('extractDirectCreations', () => {
    const block: RpcBlock = { number: '0xa', timestamp: '0x64', transactions: [] };

    it('keeps only successful receipts with a contract address', () => {
      const receipts: (RpcReceipt | null)[] = [
        { status: '0x1', contractAddress: '0xAAA', from: '0xBBB', blockNumber: '0xa' },
        { status: '0x0', contractAddress: '0xCCC', from: '0xBBB', blockNumber: '0xa' },
        { status: '0x1', contractAddress: null, from: '0xBBB', blockNumber: '0xa' },
        null,
      ];
      const result = extractDirectCreations([block], receipts);
      expect(result).toEqual([
        { address: '0xAAA', deployer: '0xBBB', blockNumber: 10, timestamp: 100, isStylus: false },
      ]);
    });
  });
});

describe('getCreations fetchers', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.useRealTimers();
  });

  const hypersyncInput = { chainId: ARBITRUM_ONE_CHAIN_ID, fromBlock: 100, toBlock: 299 };

  const jsonResponse = (body: unknown) =>
    new Response(JSON.stringify(body), { status: 200 });

  it('paginates until the range is covered and merges pages', async () => {
    vi.stubEnv('ENVIO_API_TOKEN', 'test-token');
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          data: [
            {
              traces: [{ type: 'create', address: '0xA', from: '0xB', block_number: 150 }],
              blocks: [{ number: 150, timestamp: '0x64' }],
            },
          ],
          next_block: 200,
          archive_height: 1000,
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          data: [
            {
              traces: [{ type: 'create', address: '0xC', from: '0xD', block_number: 250 }],
              blocks: [{ number: 250, timestamp: '0xc8' }],
            },
          ],
          next_block: 300,
          archive_height: 1000,
        }),
      );
    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchHypersyncCreations(hypersyncInput);

    expect(result.map((c) => c.address)).toEqual(['0xA', '0xC']);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const firstBody = JSON.parse(fetchMock.mock.calls[0][1].body);
    const secondBody = JSON.parse(fetchMock.mock.calls[1][1].body);
    expect(firstBody.from_block).toBe(100);
    expect(firstBody.to_block).toBe(300);
    expect(secondBody.from_block).toBe(200);
    expect(fetchMock.mock.calls[0][0]).toBe('https://42161-traces.hypersync.xyz/query');
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer test-token');
  });

  it('throws without ENVIO_API_TOKEN', async () => {
    vi.stubEnv('ENVIO_API_TOKEN', '');
    await expect(fetchHypersyncCreations(hypersyncInput)).rejects.toThrow('ENVIO_API_TOKEN');
  });

  it('throws on non-ok responses', async () => {
    vi.stubEnv('ENVIO_API_TOKEN', 'test-token');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('nope', { status: 401 })));
    await expect(fetchHypersyncCreations(hypersyncInput)).rejects.toThrow('401');
  });

  it('retries when the traces archive lags the requested range', async () => {
    vi.stubEnv('ENVIO_API_TOKEN', 'test-token');
    vi.useFakeTimers();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ data: [], next_block: 100, archive_height: 250 }))
      .mockResolvedValueOnce(
        jsonResponse({
          data: [
            {
              traces: [{ type: 'create', address: '0xA', from: '0xB', block_number: 150 }],
              blocks: [{ number: 150, timestamp: '0x64' }],
            },
          ],
          next_block: 300,
          archive_height: 1000,
        }),
      );
    vi.stubGlobal('fetch', fetchMock);

    const promise = fetchHypersyncCreations(hypersyncInput);
    await vi.advanceTimersByTimeAsync(5_000);
    const result = await promise;

    expect(result).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('gives each pagination step its own lag-retry budget', async () => {
    vi.stubEnv('ENVIO_API_TOKEN', 'test-token');
    vi.useFakeTimers();
    const stall = () => jsonResponse({ data: [], next_block: 0, archive_height: 250 });
    const okPage = (nextBlock: number, blockNumber: number, address: string) =>
      jsonResponse({
        data: [
          {
            traces: [{ type: 'create', address, from: '0xB', block_number: blockNumber }],
            blocks: [{ number: blockNumber, timestamp: '0x64' }],
          },
        ],
        next_block: nextBlock,
        archive_height: 250,
      });
    const responses = [
      ...Array.from({ length: 5 }, () => stall),
      () => okPage(200, 150, '0xA'),
      ...Array.from({ length: 6 }, () => stall),
      () => okPage(300, 250, '0xC'),
    ];
    const fetchMock = vi.fn().mockImplementation(async () => responses.shift()!());
    vi.stubGlobal('fetch', fetchMock);

    const promise = fetchHypersyncCreations(hypersyncInput);
    await vi.advanceTimersByTimeAsync(11 * 5_000);
    const result = await promise;

    expect(result.map((c) => c.address)).toEqual(['0xA', '0xC']);
    expect(fetchMock).toHaveBeenCalledTimes(13);
  });

  it('throws when pagination stalls despite the archive covering the range', async () => {
    vi.stubEnv('ENVIO_API_TOKEN', 'test-token');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse({ data: [], next_block: 100, archive_height: 1000 })),
    );
    await expect(fetchHypersyncCreations(hypersyncInput)).rejects.toThrow('stalled');
  });

  it('retries transient network failures before succeeding', async () => {
    vi.stubEnv('ENVIO_API_TOKEN', 'test-token');
    vi.useFakeTimers();
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('fetch failed'))
      .mockResolvedValueOnce(
        jsonResponse({
          data: [
            {
              traces: [{ type: 'create', address: '0xA', from: '0xB', block_number: 150 }],
              blocks: [{ number: 150, timestamp: '0x64' }],
            },
          ],
          next_block: 300,
          archive_height: 1000,
        }),
      );
    vi.stubGlobal('fetch', fetchMock);

    const promise = fetchHypersyncCreations(hypersyncInput);
    await vi.advanceTimersByTimeAsync(2_000);
    const result = await promise;

    expect(result).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('retries 5xx responses before succeeding', async () => {
    vi.stubEnv('ENVIO_API_TOKEN', 'test-token');
    vi.useFakeTimers();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response('bad gateway', { status: 502 }))
      .mockResolvedValueOnce(jsonResponse({ data: [], next_block: 300, archive_height: 1000 }));
    vi.stubGlobal('fetch', fetchMock);

    const promise = fetchHypersyncCreations(hypersyncInput);
    await vi.advanceTimersByTimeAsync(2_000);
    const result = await promise;

    expect(result).toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('fetches devnode creations via JSON-RPC batches', async () => {
    vi.stubEnv('DEVNODE_RPC_URL', 'http://localhost:8547');
    const blocks: Record<number, RpcBlock> = {
      0: {
        number: '0x5',
        timestamp: '0x64',
        transactions: [
          { hash: '0xdeploy', to: null },
          { hash: '0xcall', to: '0x1234' },
        ],
      },
    };
    const fetchMock = vi.fn().mockImplementation(async (_url, init) => {
      const calls = JSON.parse(init.body) as { id: number; method: string; params: unknown[] }[];
      const results = calls.map((call) => {
        if (call.method === 'eth_getBlockByNumber') {
          return { id: call.id, result: blocks[0] };
        }
        expect(call.method).toBe('eth_getTransactionReceipt');
        expect(call.params[0]).toBe('0xdeploy');
        return {
          id: call.id,
          result: {
            status: '0x1',
            contractAddress: '0xNEW',
            from: '0xSENDER',
            blockNumber: '0x5',
          } satisfies RpcReceipt,
        };
      });
      return jsonResponse(results);
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchRpcCreations({ chainId: 412346, fromBlock: 5, toBlock: 5 });

    expect(result).toEqual([
      { address: '0xNEW', deployer: '0xSENDER', blockNumber: 5, timestamp: 100, isStylus: false },
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][0]).toBe('http://localhost:8547');
  });

  it('surfaces RPC errors', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          jsonResponse([{ id: 0, error: { message: 'block not found' } }]),
        ),
    );
    await expect(fetchRpcCreations({ chainId: 412346, fromBlock: 5, toBlock: 5 })).rejects.toThrow(
      'block not found',
    );
  });

  it('rejects RPC responses that carry neither result nor error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse([{ id: 0 }])));
    await expect(fetchRpcCreations({ chainId: 412346, fromBlock: 5, toBlock: 5 })).rejects.toThrow(
      'returned no result',
    );
  });
});

describe('ProgramActivated reconciliation with EvmDeployment', () => {

  const activateProgram = (
    testIndexer: ReturnType<typeof createTestIndexer>,
    blockNumber: number,
    timestamp: number,
  ) =>
    testIndexer.process({
      chains: {
        412346: {
          simulate: [
            {
              contract: 'ArbWasm',
              event: 'ProgramActivated',
              params: {
                codehash: CODEHASH,
                moduleHash: MODULE_HASH,
                program: PROGRAM,
                dataFee: 1000n,
                version: 1n,
              },
              block: { number: blockNumber, timestamp },
              transaction: { hash: '0x' + '11'.repeat(32), from: DEPLOYER },
            },
          ],
        },
      },
    });

  const seedEvmState = (
    testIndexer: ReturnType<typeof createTestIndexer>,
    deployTimestamp: number,
  ) => {
    testIndexer.EvmDeployment.set({
      id: PROGRAM.toLowerCase(),
      deployer: STYLUS_DEPLOYER_ADDRESS,
      blockNumber: 90,
      timestamp: deployTimestamp,
      chainId: 412346,
    });
    testIndexer.GlobalStats.set({ ...carryGlobalStats(undefined), totalEvmContracts: 5 });
    testIndexer.DailyStats.set({
      id: getDayId(deployTimestamp),
      date: getDayStartTimestamp(deployTimestamp),
      stylusActivations: 0,
      stylusReactivations: 0,
      uniqueDeployers: 0,
      uniqueStylusDeployers: 0,
      uniqueEvmDeployers: 0,
      cumulativeDeployers: 0,
      totalStylusContracts: 0,
      evmDeployments: 2,
      totalEvmContracts: 5,
      cacheEvents: 0,
    });
  };

  it('removes the EvmDeployment and decrements deploy-day and global counters', async () => {
    const testIndexer = createTestIndexer();
    seedEvmState(testIndexer, DEPLOY_TS);

    await activateProgram(testIndexer, 100, ACTIVATION_TS);

    expect(await testIndexer.EvmDeployment.get(PROGRAM.toLowerCase())).toBeUndefined();

    const deployDay = await testIndexer.DailyStats.getOrThrow(getDayId(DEPLOY_TS));
    expect(deployDay.evmDeployments).toBe(1);
    expect(deployDay.totalEvmContracts).toBe(4);

    const globalStats = await testIndexer.GlobalStats.getOrThrow('global');
    expect(globalStats.totalEvmContracts).toBe(4);
    expect(globalStats.cumulativeDeployers).toBe(1);
  });

  it('snapshots the post-reconciliation cumulative on the activation day row', async () => {
    const testIndexer = createTestIndexer();
    seedEvmState(testIndexer, DEPLOY_TS);

    await activateProgram(testIndexer, 100, ACTIVATION_TS);

    const activationDay = await testIndexer.DailyStats.getOrThrow(getDayId(ACTIVATION_TS));
    expect(activationDay.totalEvmContracts).toBe(4);
    expect(activationDay.evmDeployments).toBe(0);
    expect(activationDay.stylusActivations).toBe(1);
  });

  it('cascades the cumulative decrement to days between deployment and activation', async () => {
    const testIndexer = createTestIndexer();
    const twoDaysBefore = ACTIVATION_TS - 2 * 24 * 60 * 60;
    seedEvmState(testIndexer, twoDaysBefore);
    testIndexer.DailyStats.set({
      id: getDayId(DEPLOY_TS),
      date: getDayStartTimestamp(DEPLOY_TS),
      stylusActivations: 0,
      stylusReactivations: 1,
      uniqueDeployers: 0,
      uniqueStylusDeployers: 0,
      uniqueEvmDeployers: 0,
      cumulativeDeployers: 0,
      totalStylusContracts: 0,
      evmDeployments: 0,
      totalEvmContracts: 5,
      cacheEvents: 0,
    });

    await activateProgram(testIndexer, 100, ACTIVATION_TS);

    const deployDay = await testIndexer.DailyStats.getOrThrow(getDayId(twoDaysBefore));
    expect(deployDay.evmDeployments).toBe(1);
    expect(deployDay.totalEvmContracts).toBe(4);

    const intermediateDay = await testIndexer.DailyStats.getOrThrow(getDayId(DEPLOY_TS));
    expect(intermediateDay.evmDeployments).toBe(0);
    expect(intermediateDay.totalEvmContracts).toBe(4);

    const activationDay = await testIndexer.DailyStats.getOrThrow(getDayId(ACTIVATION_TS));
    expect(activationDay.totalEvmContracts).toBe(4);
  });

  it('reconciles a same-day deployment without corrupting stylus counters', async () => {
    const testIndexer = createTestIndexer();
    seedEvmState(testIndexer, ACTIVATION_TS - 60);

    await activateProgram(testIndexer, 100, ACTIVATION_TS);

    const day = await testIndexer.DailyStats.getOrThrow(getDayId(ACTIVATION_TS));
    expect(day.evmDeployments).toBe(1);
    expect(day.totalEvmContracts).toBe(4);
    expect(day.stylusActivations).toBe(1);

    const globalStats = await testIndexer.GlobalStats.getOrThrow('global');
    expect(globalStats.totalEvmContracts).toBe(4);
  });

  it('is a no-op when the activated address was never counted as EVM', async () => {
    const testIndexer = createTestIndexer();
    testIndexer.GlobalStats.set({ ...carryGlobalStats(undefined), totalEvmContracts: 7 });

    await activateProgram(testIndexer, 100, ACTIVATION_TS);

    const globalStats = await testIndexer.GlobalStats.getOrThrow('global');
    expect(globalStats.totalEvmContracts).toBe(7);

    const day = await testIndexer.DailyStats.getOrThrow(getDayId(ACTIVATION_TS));
    expect(day.totalEvmContracts).toBe(7);
    expect(day.evmDeployments).toBe(0);
  });
});

describe('devnode onBlock indexing', () => {
  const EVM_CONTRACT = '0x' + 'Aa'.repeat(20);
  const EVM_SENDER = '0x' + 'Bb'.repeat(20);

  const stubDeployAt = (blockNumber: number, timestamp: number) => {
    stubBlock(
      blockNumber,
      {
        number: `0x${blockNumber.toString(16)}`,
        timestamp: `0x${timestamp.toString(16)}`,
        transactions: [{ hash: '0xevmdeploy', to: null }],
      },
      {
        '0xevmdeploy': {
          status: '0x1',
          contractAddress: EVM_CONTRACT,
          from: EVM_SENDER,
          blockNumber: `0x${blockNumber.toString(16)}`,
        },
      },
    );
  };

  const processUpToActivation = (testIndexer: ReturnType<typeof createTestIndexer>) =>
    testIndexer.process({
      chains: {
        412346: {
          simulate: [
            {
              contract: 'ArbWasm',
              event: 'ProgramActivated',
              params: {
                codehash: CODEHASH,
                moduleHash: MODULE_HASH,
                program: PROGRAM,
                dataFee: 1000n,
                version: 1n,
              },
              block: { number: 100, timestamp: ACTIVATION_TS },
              transaction: { hash: '0x' + '22'.repeat(32), from: DEPLOYER },
            },
          ],
        },
      },
    });

  it('persists a direct deployment and updates daily and global stats', async () => {
    const testIndexer = createTestIndexer();
    stubDeployAt(50, DEPLOY_TS);

    await processUpToActivation(testIndexer);

    const deployment = await testIndexer.EvmDeployment.getOrThrow(EVM_CONTRACT.toLowerCase());
    expect(deployment.deployer).toBe(EVM_SENDER.toLowerCase());
    expect(deployment.blockNumber).toBe(50);
    expect(deployment.timestamp).toBe(DEPLOY_TS);
    expect(deployment.chainId).toBe(412346);

    const deployDay = await testIndexer.DailyStats.getOrThrow(getDayId(DEPLOY_TS));
    expect(deployDay.evmDeployments).toBe(1);
    expect(deployDay.totalEvmContracts).toBe(1);
    expect(deployDay.stylusActivations).toBe(0);

    const activationDay = await testIndexer.DailyStats.getOrThrow(getDayId(ACTIVATION_TS));
    expect(activationDay.totalEvmContracts).toBe(1);

    const globalStats = await testIndexer.GlobalStats.getOrThrow('global');
    expect(globalStats.totalEvmContracts).toBe(1);
  });

  it('keeps the Stylus totals when the deployer later turns up on the EVM side', async () => {
    // Given a deployer whose Stylus activation is already indexed
    const testIndexer = createTestIndexer();
    const LATER_CONTRACT = '0x' + 'Cc'.repeat(20);
    await processUpToActivation(testIndexer);
    const before = await testIndexer.DeployerRegistry.getOrThrow(DEPLOYER.toLowerCase());
    expect(before.deployerType).toBe('stylus');
    expect(before.stylusContractCount).toBe(1);

    // When that same address deploys a plain EVM contract afterwards
    stubBlock(
      150,
      {
        number: '0x96',
        timestamp: `0x${(ACTIVATION_TS + 3600).toString(16)}`,
        transactions: [{ hash: '0xlaterdeploy', to: null }],
      },
      {
        '0xlaterdeploy': {
          status: '0x1',
          contractAddress: LATER_CONTRACT,
          from: DEPLOYER,
          blockNumber: '0x96',
        },
      },
    );
    await testIndexer.process({
      chains: {
        412346: {
          simulate: [
            {
              contract: 'ArbWasm',
              event: 'ProgramLifetimeExtended',
              params: { codehash: CODEHASH, dataFee: 500n },
              block: { number: 200, timestamp: ACTIVATION_TS + 7200 },
              transaction: { hash: '0x' + '33'.repeat(32), from: DEPLOYER },
            },
          ],
        },
      },
    });

    // Then it covers both sides without losing what the Stylus side counted
    const registry = await testIndexer.DeployerRegistry.getOrThrow(DEPLOYER.toLowerCase());
    expect(registry.deployerType).toBe('both');
    expect(registry.stylusContractCount).toBe(1);
    expect(registry.firstStylusAt).toBe(ACTIVATION_TS);
    expect(registry.stylusWeeks).toBe(1);
  });

  it('indexes an EVM and a Stylus deployment side by side without mixing them', async () => {
    const testIndexer = createTestIndexer();
    stubDeployAt(50, DEPLOY_TS);

    await processUpToActivation(testIndexer);

    const evm = await testIndexer.EvmDeployment.getOrThrow(EVM_CONTRACT.toLowerCase());
    expect(evm.deployer).toBe(EVM_SENDER.toLowerCase());

    const stylus = await testIndexer.StylusContract.getOrThrow(PROGRAM.toLowerCase());
    expect(stylus.deployer).toBe(DEPLOYER.toLowerCase());

    expect(await testIndexer.EvmDeployment.get(PROGRAM.toLowerCase())).toBeUndefined();
    expect(await testIndexer.StylusContract.get(EVM_CONTRACT.toLowerCase())).toBeUndefined();

    const deployDay = await testIndexer.DailyStats.getOrThrow(getDayId(DEPLOY_TS));
    expect(deployDay.evmDeployments).toBe(1);
    expect(deployDay.stylusActivations).toBe(0);

    const activationDay = await testIndexer.DailyStats.getOrThrow(getDayId(ACTIVATION_TS));
    expect(activationDay.stylusActivations).toBe(1);
    expect(activationDay.evmDeployments).toBe(0);
    expect(activationDay.totalEvmContracts).toBe(1);

    const globalStats = await testIndexer.GlobalStats.getOrThrow('global');
    expect(globalStats.totalEvmContracts).toBe(1);
    expect(globalStats.cumulativeDeployers).toBe(1);
  });

  it('skips creations whose address is already a known StylusContract', async () => {
    const testIndexer = createTestIndexer();
    testIndexer.StylusContract.set({
      id: EVM_CONTRACT.toLowerCase(),
      deployer: DEPLOYER.toLowerCase(),
      codehash: CODEHASH,
      moduleHash: MODULE_HASH,
      version: 1,
      dataFee: 1000n,
      activatedAt: DEPLOY_TS - 100,
      activatedBlock: 40,
      chainId: 412346,
      isCached: false,
      lastKeepalive: undefined,
      expiresAt: DEPLOY_TS - 100 + EXPIRY_SECONDS,
    });
    stubDeployAt(60, DEPLOY_TS);

    await processUpToActivation(testIndexer);

    expect(await testIndexer.EvmDeployment.get(EVM_CONTRACT.toLowerCase())).toBeUndefined();
    expect(await testIndexer.DailyStats.get(getDayId(DEPLOY_TS))).toBeUndefined();

    const globalStats = await testIndexer.GlobalStats.getOrThrow('global');
    expect(globalStats.totalEvmContracts).toBe(0);
  });

  it('skips creations coming from the StylusDeployer factory', async () => {
    const testIndexer = createTestIndexer();
    stubBlock(
      80,
      {
        number: '0x50',
        timestamp: `0x${DEPLOY_TS.toString(16)}`,
        transactions: [{ hash: '0xwasmdeploy', to: null }],
      },
      {
        '0xwasmdeploy': {
          status: '0x1',
          contractAddress: EVM_CONTRACT,
          from: '0x' + STYLUS_DEPLOYER_ADDRESS.slice(2).toUpperCase(),
          blockNumber: '0x50',
        },
      },
    );

    await processUpToActivation(testIndexer);

    expect(await testIndexer.EvmDeployment.get(EVM_CONTRACT.toLowerCase())).toBeUndefined();
    expect(await testIndexer.DailyStats.get(getDayId(DEPLOY_TS))).toBeUndefined();

    const globalStats = await testIndexer.GlobalStats.getOrThrow('global');
    expect(globalStats.totalEvmContracts).toBe(0);
  });

  it('counts a redeployed address only once', async () => {
    const testIndexer = createTestIndexer();
    stubBlock(
      70,
      {
        number: '0x46',
        timestamp: `0x${DEPLOY_TS.toString(16)}`,
        transactions: [
          { hash: '0xredeploy1', to: null },
          { hash: '0xredeploy2', to: null },
        ],
      },
      {
        '0xredeploy1': {
          status: '0x1',
          contractAddress: EVM_CONTRACT,
          from: EVM_SENDER,
          blockNumber: '0x46',
        },
        '0xredeploy2': {
          status: '0x1',
          contractAddress: EVM_CONTRACT,
          from: EVM_SENDER,
          blockNumber: '0x46',
        },
      },
    );

    await processUpToActivation(testIndexer);

    const deployment = await testIndexer.EvmDeployment.getOrThrow(EVM_CONTRACT.toLowerCase());
    expect(deployment.blockNumber).toBe(70);

    const deployDay = await testIndexer.DailyStats.getOrThrow(getDayId(DEPLOY_TS));
    expect(deployDay.evmDeployments).toBe(1);
    expect(deployDay.totalEvmContracts).toBe(1);

    const globalStats = await testIndexer.GlobalStats.getOrThrow('global');
    expect(globalStats.totalEvmContracts).toBe(1);
  });
});
