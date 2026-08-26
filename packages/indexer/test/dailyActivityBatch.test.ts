// test/dailyActivityBatch.test.ts
import { describe, it, expect } from 'vitest';
import { createTestIndexer } from 'envio';
import { processActivityBatch, type ActivityTx } from '../src/handlers/DailyActivityBatch';
import { getDayId } from '../src/helpers/stats';

const CONTRACT_A = '0xaaaa000000000000000000000000000000000a';
const CONTRACT_B = '0xbbbb000000000000000000000000000000000b';
const CALLER_1 = '0x1111000000000000000000000000000000001a';
const CALLER_2 = '0x2222000000000000000000000000000000002a';

const DAY_1_TS = 1705318200; // 2024-01-15
const DAY_2_TS = DAY_1_TS + 24 * 60 * 60; // 2024-01-16

const tx = (overrides: Partial<ActivityTx>): ActivityTx => ({
  hash: '0x' + '11'.repeat(32),
  from: CALLER_1,
  to: CONTRACT_A,
  blockNumber: 100,
  timestamp: DAY_1_TS,
  ...overrides,
});

describe('processActivityBatch', () => {
  it('creates a new DailyContractActivity row with count 1 for a first-seen tx', async () => {
    const testIndexer = createTestIndexer();
    await processActivityBatch([tx({})], 100, testIndexer);

    const activity = await testIndexer.DailyContractActivity.getOrThrow(
      `${CONTRACT_A}-${getDayId(DAY_1_TS)}`,
    );
    expect(activity.transactionCount).toBe(1);
    expect(activity.uniqueCallers).toBe(1);
  });

  it('does not double-count uniqueCallers for repeat callers within the same day', async () => {
    const testIndexer = createTestIndexer();
    await processActivityBatch(
      [
        tx({ from: CALLER_1, hash: '0xa' }),
        tx({ from: CALLER_1, hash: '0xb' }),
        tx({ from: CALLER_2, hash: '0xc' }),
      ],
      100,
      testIndexer,
    );

    const activity = await testIndexer.DailyContractActivity.getOrThrow(
      `${CONTRACT_A}-${getDayId(DAY_1_TS)}`,
    );
    expect(activity.transactionCount).toBe(3);
    expect(activity.uniqueCallers).toBe(2); // CALLER_1 solo cuenta una vez
  });

  it('creates a separate row when the same contract is touched on a different day', async () => {
    const testIndexer = createTestIndexer();
    await processActivityBatch(
      [tx({ timestamp: DAY_1_TS }), tx({ timestamp: DAY_2_TS, hash: '0xd' })],
      100,
      testIndexer,
    );

    const day1 = await testIndexer.DailyContractActivity.getOrThrow(
      `${CONTRACT_A}-${getDayId(DAY_1_TS)}`,
    );
    const day2 = await testIndexer.DailyContractActivity.getOrThrow(
      `${CONTRACT_A}-${getDayId(DAY_2_TS)}`,
    );
    expect(day1.transactionCount).toBe(1);
    expect(day2.transactionCount).toBe(1);
  });

  it('rolls up dailyActiveContracts and totalTransactions on DailyStats', async () => {
    const testIndexer = createTestIndexer();
    await processActivityBatch(
      [
        tx({ to: CONTRACT_A, from: CALLER_1, hash: '0xa' }),
        tx({ to: CONTRACT_A, from: CALLER_2, hash: '0xb' }),
        tx({ to: CONTRACT_B, from: CALLER_1, hash: '0xc' }),
      ],
      100,
      testIndexer,
    );

    const stats = await testIndexer.DailyStats.getOrThrow(getDayId(DAY_1_TS));
    expect(stats.dailyActiveContracts).toBe(2); // CONTRACT_A y CONTRACT_B
    expect(stats.totalTransactions).toBe(3);
  });

  it('creates a DailyStats row when none exists yet for that day', async () => {
    const testIndexer = createTestIndexer();
    expect(await testIndexer.DailyStats.get(getDayId(DAY_1_TS))).toBeUndefined();

    await processActivityBatch([tx({})], 100, testIndexer);

    const stats = await testIndexer.DailyStats.getOrThrow(getDayId(DAY_1_TS));
    expect(stats.dailyActiveContracts).toBe(1);
    expect(stats.totalTransactions).toBe(1);
    expect(stats.stylusActivations).toBe(0); // resto de campos en su default
  });

  it('preserves existing DailyStats fields when only updating the roll-up', async () => {
    const testIndexer = createTestIndexer();
    testIndexer.GlobalStats.set({ id: 'global', cumulativeDeployers: 3, totalEvmContracts: 2 });
    testIndexer.DailyStats.set({
      id: getDayId(DAY_1_TS),
      date: DAY_1_TS,
      stylusActivations: 5,
      stylusReactivations: 1,
      uniqueDeployers: 2,
      uniqueStylusDeployers: 2,
      uniqueEvmDeployers: 0,
      cumulativeDeployers: 3,
      totalStylusContracts: 5,
      evmDeployments: 0,
      totalEvmContracts: 2,
      cacheEvents: 0,
      dailyActiveContracts: 0,
      totalTransactions: 0,
    });

    await processActivityBatch([tx({})], 100, testIndexer);

    const stats = await testIndexer.DailyStats.getOrThrow(getDayId(DAY_1_TS));
    expect(stats.stylusActivations).toBe(5); // no lo tocamos, se preserva
    expect(stats.dailyActiveContracts).toBe(1); // esto sí se actualiza
  });

  it('advances lastProcessedBlock via the caller-provided currentBlock', async () => {
    const testIndexer = createTestIndexer();
    await processActivityBatch([tx({})], 12345, testIndexer);

    const state = await testIndexer.ActivityBatchState.getOrThrow('global');
    expect(state.lastProcessedBlock).toBe(12345);
  });

  it('does not double-count dailyActiveContracts for repeated txs to the same contract on the same day', async () => {
  const testIndexer = createTestIndexer();
  await processActivityBatch(
    [
      tx({ to: CONTRACT_A, hash: '0xa' }),
      tx({ to: CONTRACT_A, hash: '0xb' }),
      tx({ to: CONTRACT_A, hash: '0xc' }),
    ],
    100,
    testIndexer,
  );

  const stats = await testIndexer.DailyStats.getOrThrow(getDayId(DAY_1_TS));
  expect(stats.dailyActiveContracts).toBe(1); // mismo contrato, 3 tx, cuenta una sola vez
  expect(stats.totalTransactions).toBe(3);
});
});
