import { indexer } from 'envio';
import { getDayId, getDayStartTimestamp, EXPIRY_SECONDS } from '../helpers/stats.js';

// --- ArbWasm: ProgramActivated ---
indexer.onEvent({ contract: 'ArbWasm', event: 'ProgramActivated' }, async ({ event, context }) => {
  const { codehash, moduleHash, program, dataFee, version } = event.params;
  const timestamp = event.block.timestamp;
  const blockNumber = event.block.number;
  const chainId = event.chainId;
  const deployer = event.transaction.from!.toLowerCase();
  const programId = program.toLowerCase();

  const existingContract = await context.StylusContract.get(programId);
  const isReactivation = existingContract !== undefined;

  if (existingContract) {
    context.StylusContract.set({
      ...existingContract,
      moduleHash: moduleHash,
      version: Number(version),
      dataFee: dataFee,
      lastKeepalive: timestamp,
      expiresAt: timestamp + EXPIRY_SECONDS,
    });
  } else {
    context.StylusContract.set({
      id: programId,
      deployer: deployer,
      codehash: codehash,
      moduleHash: moduleHash,
      version: Number(version),
      dataFee: dataFee,
      activatedAt: timestamp,
      activatedBlock: blockNumber,
      chainId: chainId,
      isCached: false,
      lastKeepalive: undefined,
      expiresAt: timestamp + EXPIRY_SECONDS,
    });
  }

  context.CodehashIndex.set({
    id: codehash,
    contractId: programId,
  });

  const isNewDeployer = !isReactivation && !(await context.DeployerRegistry.get(deployer));
  if (isNewDeployer) {
    context.DeployerRegistry.set({ id: deployer });
  }

  const globalStats = await context.GlobalStats.get('global');
  const cumulativeDeployers =
    (globalStats?.cumulativeDeployers ?? 0) + (isNewDeployer ? 1 : 0);
  if (isNewDeployer) {
    context.GlobalStats.set({ id: 'global', cumulativeDeployers });
  }

  const dayId = getDayId(timestamp);
  const existingStats = await context.DailyStats.get(dayId);

  if (existingStats) {
    context.DailyStats.set({
      ...existingStats,
      stylusActivations: existingStats.stylusActivations + (isReactivation ? 0 : 1),
      stylusReactivations: existingStats.stylusReactivations + (isReactivation ? 1 : 0),
      uniqueDeployers: existingStats.uniqueDeployers + (isNewDeployer ? 1 : 0),
      cumulativeDeployers: cumulativeDeployers,
      totalStylusContracts: existingStats.totalStylusContracts + (isReactivation ? 0 : 1),
    });
  } else {
    context.DailyStats.set({
      id: dayId,
      date: getDayStartTimestamp(timestamp),
      stylusActivations: isReactivation ? 0 : 1,
      stylusReactivations: isReactivation ? 1 : 0,
      uniqueDeployers: isNewDeployer ? 1 : 0,
      cumulativeDeployers: cumulativeDeployers,
      totalStylusContracts: isReactivation ? 0 : 1,
      evmDeployments: 0,
      totalEvmContracts: 0,
      cacheEvents: 0,
    });
  }
});

// --- ArbWasm: ProgramLifetimeExtended ---
indexer.onEvent(
  { contract: 'ArbWasm', event: 'ProgramLifetimeExtended' },
  async ({ event, context }) => {
    const { codehash, dataFee } = event.params;
    const timestamp = event.block.timestamp;
    const blockNumber = event.block.number;

    const extensionId = `${event.transaction.hash}-${event.logIndex}`;
    context.LifetimeExtension.set({
      id: extensionId,
      codehash: codehash,
      dataFee: dataFee,
      timestamp: timestamp,
      blockNumber: blockNumber,
    });

    const index = await context.CodehashIndex.get(codehash);
    const contract = index ? await context.StylusContract.get(index.contractId) : undefined;
    if (contract) {
      context.StylusContract.set({
        ...contract,
        lastKeepalive: timestamp,
        expiresAt: timestamp + EXPIRY_SECONDS,
      });
    } else {
      context.log.warn(`Keepalive for unknown codehash ${codehash}, skipping contract update`);
    }

    const dayId = getDayId(timestamp);
    const existingStats = await context.DailyStats.get(dayId);

    if (existingStats) {
      context.DailyStats.set({
        ...existingStats,
        stylusReactivations: existingStats.stylusReactivations + 1,
      });
    } else {
      const globalStats = await context.GlobalStats.get('global');
      context.DailyStats.set({
        id: dayId,
        date: getDayStartTimestamp(timestamp),
        stylusActivations: 0,
        stylusReactivations: 1,
        uniqueDeployers: 0,
        cumulativeDeployers: globalStats?.cumulativeDeployers ?? 0,
        totalStylusContracts: 0,
        evmDeployments: 0,
        totalEvmContracts: 0,
        cacheEvents: 0,
      });
    }
  },
);

// --- ArbWasmCache: UpdateProgramCache ---
indexer.onEvent(
  { contract: 'ArbWasmCache', event: 'UpdateProgramCache' },
  async ({ event, context }) => {
    const { manager, codehash, cached } = event.params;
    const timestamp = event.block.timestamp;
    const blockNumber = event.block.number;

    const cacheEventId = `${event.transaction.hash}-${event.logIndex}`;
    context.CacheEvent.set({
      id: cacheEventId,
      manager: manager.toLowerCase(),
      codehash: codehash,
      cached: cached,
      timestamp: timestamp,
      blockNumber: blockNumber,
    });

    const index = await context.CodehashIndex.get(codehash);
    const contract = index ? await context.StylusContract.get(index.contractId) : undefined;
    if (contract) {
      context.StylusContract.set({
        ...contract,
        isCached: cached,
      });
    } else {
      context.log.warn(`Cache update for unknown codehash ${codehash}, skipping contract update`);
    }

    const dayId = getDayId(timestamp);
    const existingStats = await context.DailyStats.get(dayId);

    if (existingStats) {
      context.DailyStats.set({
        ...existingStats,
        cacheEvents: existingStats.cacheEvents + 1,
      });
    } else {
      const globalStats = await context.GlobalStats.get('global');
      context.DailyStats.set({
        id: dayId,
        date: getDayStartTimestamp(timestamp),
        stylusActivations: 0,
        stylusReactivations: 0,
        uniqueDeployers: 0,
        cumulativeDeployers: globalStats?.cumulativeDeployers ?? 0,
        totalStylusContracts: 0,
        evmDeployments: 0,
        totalEvmContracts: 0,
        cacheEvents: 1,
      });
    }
  },
);
