import { indexer, type EvmOnBlockContext } from 'envio';
import { getCreations } from '../effects/creations.js';
import { newDailyStats } from '../helpers/stats.js';
import {
  CATCHUP_WINDOW,
  REALTIME_WINDOW,
  STYLUS_DEPLOYER_ADDRESS,
} from '../config.js';
import {
  groupCreationsByDay,
  isArbitrumOne,
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
  const creations = await context.effect(getCreations, { chainId, fromBlock, toBlock });

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

// Deferred traces strategy: let Envio's event sync complete unimpeded (no
// HyperSync traces during backfill), then catch up all historical traces
// once the chain reaches realtime. This avoids competing for rate-limit
// budget with Envio's internal pipeline.
let catchUpDone = false;

indexer.onBlock(
  {
    name: 'evmDeploymentsRealtime',
    where: ({ chain }) =>
      isArbitrumOne(chain.id)
        ? { block: { number: { _every: REALTIME_WINDOW } } }
        : false,
  },
  async ({ block, context }) => {
    context.log.info(`onBlock #${block.number} isRealtime=${context.chain.isRealtime}`);
    if (!context.chain.isRealtime) return;

    const { startBlock } = indexer.chains[context.chain.id];

    if (!catchUpDone) {
      catchUpDone = true;
      const totalChunks = Math.ceil((block.number - startBlock) / CATCHUP_WINDOW);
      context.log.info(`Starting EVM catch-up: ${startBlock} → ${block.number} (${totalChunks} chunks of ${CATCHUP_WINDOW})`);
      let chunk = 0;
      for (let from = startBlock; from < block.number; from += CATCHUP_WINDOW) {
        chunk++;
        const to = Math.min(from + CATCHUP_WINDOW - 1, block.number - 1);
        context.log.info(`Catch-up chunk ${chunk}/${totalChunks}: blocks ${from}→${to}`);
        await indexCreations(context, context.chain.id, from, to);
      }
      context.log.info('EVM catch-up complete');
    }

    // Process the current realtime window
    const fromBlock = Math.max(startBlock, block.number - REALTIME_WINDOW + 1);
    await indexCreations(context, context.chain.id, fromBlock, block.number);
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
