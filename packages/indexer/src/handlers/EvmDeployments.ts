import { indexer, type EvmOnBlockContext } from 'envio';
import { getHypersyncCreations, getRpcCreations } from '../effects/creations.js';
import { newDailyStats } from '../helpers/stats.js';
import {
  HISTORICAL_END_BLOCK,
  HISTORICAL_WINDOW,
  REALTIME_WINDOW,
  STYLUS_DEPLOYER_ADDRESS,
} from '../config.js';
import {
  assertHistoricalAlignment,
  groupCreationsByDay,
  isArbitrumOne,
  realtimeFloor,
  windowBounds,
} from '../helpers/evm.js';

// Records every creation in the window as an EVM deployment, except known
// Stylus programs and anything created by the StylusDeployer factory
// (a second deploy of an already-activated codehash never emits its own
// ProgramActivated, so the factory filter is the only thing catching it).
async function indexCreations(
  context: EvmOnBlockContext,
  chainId: number,
  fromBlock: number,
  toBlock: number,
): Promise<void> {
  const creations = await context.effect(
    isArbitrumOne(chainId) ? getHypersyncCreations : getRpcCreations,
    { chainId, fromBlock, toBlock },
  );

  const candidates = creations.filter(
    (creation) => creation.deployer.toLowerCase() !== STYLUS_DEPLOYER_ADDRESS,
  );
  const ids = candidates.map((creation) => creation.address.toLowerCase());
  // Issued in one tick so envio batches them into two queries for the
  // whole window instead of two per creation.
  const [stylusContracts, evmDeployments] = await Promise.all([
    Promise.all(ids.map((id) => context.StylusContract.get(id))),
    Promise.all(ids.map((id) => context.EvmDeployment.get(id))),
  ]);

  const seen = new Set<string>();
  const fresh = [];
  for (const [i, creation] of candidates.entries()) {
    const id = ids[i];
    if (stylusContracts[i] || evmDeployments[i] || seen.has(id)) {
      continue;
    }
    seen.add(id);
    context.EvmDeployment.set({
      id,
      deployer: creation.deployer.toLowerCase(),
      blockNumber: creation.blockNumber,
      timestamp: creation.timestamp,
      chainId,
    });
    fresh.push(creation);
  }
  if (fresh.length === 0) {
    return;
  }

  const globalStats = await context.GlobalStats.get('global');
  let totalEvmContracts = globalStats?.totalEvmContracts ?? 0;

  for (const { dayId, count, timestamp } of groupCreationsByDay(fresh)) {
    totalEvmContracts += count;
    const existingStats = await context.DailyStats.get(dayId);
    if (existingStats) {
      context.DailyStats.set({
        ...existingStats,
        evmDeployments: existingStats.evmDeployments + count,
        totalEvmContracts: totalEvmContracts,
      });
    } else {
      context.DailyStats.set({
        ...newDailyStats(dayId, timestamp, globalStats),
        evmDeployments: count,
        totalEvmContracts: totalEvmContracts,
      });
    }
  }

  context.GlobalStats.set({
    id: 'global',
    cumulativeDeployers: globalStats?.cumulativeDeployers ?? 0,
    totalEvmContracts: totalEvmContracts,
  });
}

// Big windows for the historical backfill, small ones near the head.
// Both sides meet exactly at HISTORICAL_END_BLOCK with no gap or overlap.
indexer.onBlock(
  {
    name: 'evmDeploymentsHistorical',
    where: ({ chain }) => {
      if (!isArbitrumOne(chain.id) || chain.startBlock > HISTORICAL_END_BLOCK) {
        return false;
      }
      assertHistoricalAlignment(chain.startBlock);
      return { block: { number: { _lte: HISTORICAL_END_BLOCK, _every: HISTORICAL_WINDOW } } };
    },
  },
  async ({ block, context }) => {
    const { startBlock } = indexer.chains[context.chain.id];
    const { fromBlock, toBlock } = windowBounds(block.number, HISTORICAL_WINDOW, startBlock);
    await indexCreations(context, context.chain.id, fromBlock, toBlock);
  },
);

indexer.onBlock(
  {
    name: 'evmDeploymentsRealtime',
    where: ({ chain }) =>
      isArbitrumOne(chain.id)
        ? {
            block: {
              number: {
                _gte: realtimeFloor(chain.startBlock) + REALTIME_WINDOW - 1,
                _every: REALTIME_WINDOW,
              },
            },
          }
        : false,
  },
  async ({ block, context }) => {
    const floor = realtimeFloor(indexer.chains[context.chain.id].startBlock);
    const { fromBlock, toBlock } = windowBounds(block.number, REALTIME_WINDOW, floor);
    await indexCreations(context, context.chain.id, fromBlock, toBlock);
  },
);

// The devnode has no HyperSync, so it scans block by block over local RPC.
indexer.onBlock(
  {
    name: 'evmDeploymentsDevnode',
    where: ({ chain }) => !isArbitrumOne(chain.id),
  },
  async ({ block, context }) => {
    await indexCreations(context, context.chain.id, block.number, block.number);
  },
);
