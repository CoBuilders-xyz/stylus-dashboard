// handlers/DailyActivityBatch.ts
import { indexer } from 'envio';
import { isArbitrumOne } from '../helpers/evm';
import { getTransactionsTo } from '../helpers/hypersync';
import { getDayId, newDailyStats } from '../helpers/stats';

export const BLOCK_INTERVAL = 14_400;
const BATCH_STATE_ID = 'global';


type ActivityBatchContext = {
  ActivityBatchState: {
    get: (id: string) => Promise<{ id: string; lastProcessedBlock: number } | undefined>;
    set: (e: { id: string; lastProcessedBlock: number }) => void;
  };
  DailyContractCaller: {
    get: (id: string) => Promise<{ id: string } | undefined>;
    set: (e: { id: string }) => void;
  };
  DailyContractActivity: {
    get: (id: string) => Promise<
      { id: string; contractId: string; date: string; transactionCount: number; uniqueCallers: number } | undefined
    >;
    set: (e: {
      id: string;
      contractId: string;
      date: string;
      transactionCount: number;
      uniqueCallers: number;
    }) => void;
  };
  DailyStats: {
    get: (id: string) => Promise<ReturnType<typeof newDailyStats> | undefined>;
    set: (e: ReturnType<typeof newDailyStats>) => void;
  };
  GlobalStats: {
    get: (id: string) => Promise<{ cumulativeDeployers: number; totalEvmContracts: number } | undefined>;
  };
};
export interface ActivityTx {
  hash: string;
  from: string;
  to: string;
  blockNumber: number;
  timestamp: number;
}

/** Core batch logic, separated from the onBlock wrapper so it can be
 * called directly in tests — `indexer.onBlock` handlers can't be
 * triggered via `createTestIndexer`. */
export async function processActivityBatch(
  txs: ActivityTx[],
  currentBlock: number,
  context: ActivityBatchContext,
): Promise<void> {
  const dayDeltas = new Map<string, { timestamp: number; newActiveContracts: number; newTransactions: number }>();

  for (const tx of txs) {
    const dayId = getDayId(tx.timestamp);
    const delta = dayDeltas.get(dayId) ?? { timestamp: tx.timestamp, newActiveContracts: 0, newTransactions: 0 };

    const callerId = `${tx.to}-${dayId}-${tx.from}`;
    const isNewCaller = !(await context.DailyContractCaller.get(callerId));
    if (isNewCaller) context.DailyContractCaller.set({ id: callerId });

    const activityId = `${tx.to}-${dayId}`;
    const existing = await context.DailyContractActivity.get(activityId);
    if (!existing) delta.newActiveContracts += 1; // primera vez que ESTE contrato aparece ESTE día
    delta.newTransactions += 1;

    context.DailyContractActivity.set({
      id: activityId,
      contractId: tx.to,
      date: dayId,
      transactionCount: (existing?.transactionCount ?? 0) + 1,
      uniqueCallers: (existing?.uniqueCallers ?? 0) + (isNewCaller ? 1 : 0),
    });

    dayDeltas.set(dayId, delta);
  }

  const globalStats = await context.GlobalStats.get('global');

  for (const [dayId, { timestamp, newActiveContracts, newTransactions }] of dayDeltas) {
    const existingStats = await context.DailyStats.get(dayId);
    const base = existingStats ?? newDailyStats(dayId, timestamp, globalStats);
    context.DailyStats.set({
      ...base,
      dailyActiveContracts: base.dailyActiveContracts + newActiveContracts,
      totalTransactions: base.totalTransactions + newTransactions,
    });
  }

  context.ActivityBatchState.set({
    id: BATCH_STATE_ID,
    lastProcessedBlock: currentBlock,
  });
}
indexer.onBlock(
  {
    name: 'dailyContractActivity',
    where: ({ chain }) =>
      isArbitrumOne(chain.id)
        ? { block: { number: { _every: BLOCK_INTERVAL } } }
        : false,
  },
  async ({ block, context }) => {
    const state = await context.ActivityBatchState.get(BATCH_STATE_ID);
    const fromBlock = state?.lastProcessedBlock ?? block.number - BLOCK_INTERVAL;

    const known = await context.KnownStylusAddresses.get('global');
    const addresses = [...(known?.addresses ?? [])];

    const txs = await context.effect(getTransactionsTo, {
      addresses,
      fromBlock,
      toBlock: block.number,
    });

    await processActivityBatch(txs, block.number, context);
  },
);
