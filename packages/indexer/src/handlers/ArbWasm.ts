import { indexer } from 'envio';
import {
  getDayId,
  getDayStartTimestamp,
  newDailyStats,
  EXPIRY_SECONDS,
  SECONDS_PER_DAY,
} from '../helpers/stats.js';
import { DEPLOYER_BOTH, DEPLOYER_EVM, DEPLOYER_STYLUS } from '../config.js';

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
    
    const known = await context.KnownStylusAddresses.getOrCreate({ id: 'global', addresses: [] });
    if (!known.addresses.includes(programId)) {
      context.KnownStylusAddresses.set({ id: 'global', addresses: [...known.addresses, programId] });
    }
  }

  context.CodehashIndex.set({
    id: codehash,
    contractId: programId,
  });

  // Registered as `evm` means it has never deployed Stylus, so it is still new
  // here. Without that, uniqueDeployers would start counting EVM deployers too.
  const registered = await context.DeployerRegistry.get(deployer);
  const isNewDeployer =
    !isReactivation && (!registered || registered.deployerType === DEPLOYER_EVM);
  if (isNewDeployer) {
    context.DeployerRegistry.set({
      id: deployer,
      deployerType: registered ? DEPLOYER_BOTH : DEPLOYER_STYLUS,
    });
  }

  const evmDeployment = await context.EvmDeployment.get(programId);
  const globalStats = await context.GlobalStats.get('global');
  let totalEvmContracts = globalStats?.totalEvmContracts ?? 0;
  const cumulativeDeployers =
    (globalStats?.cumulativeDeployers ?? 0) + (isNewDeployer ? 1 : 0);

  // This address was counted as an EVM deployment before we knew it was
  // Stylus: un-count it, walking every day between deployment and
  // activation so the running total stays consistent.
  if (evmDeployment) {
    context.EvmDeployment.deleteUnsafe(programId);
    totalEvmContracts = Math.max(0, totalEvmContracts - 1);

    const deployDayStart = getDayStartTimestamp(evmDeployment.timestamp);
    const activationDayStart = getDayStartTimestamp(timestamp);
    const dayStarts = [];
    for (let dayStart = deployDayStart; dayStart <= activationDayStart; dayStart += SECONDS_PER_DAY) {
      dayStarts.push(dayStart);
    }
    const dayRows = await Promise.all(
      dayStarts.map((dayStart) => context.DailyStats.get(getDayId(dayStart))),
    );
    for (const [i, dayStats] of dayRows.entries()) {
      const isDeployDay = dayStarts[i] === deployDayStart;
      if (!dayStats) {
        if (isDeployDay) {
          context.log.warn(`No DailyStats for reconciled EVM deployment ${programId}`);
        }
        continue;
      }
      context.DailyStats.set({
        ...dayStats,
        evmDeployments: isDeployDay
          ? Math.max(0, dayStats.evmDeployments - 1)
          : dayStats.evmDeployments,
        totalEvmContracts: Math.max(0, dayStats.totalEvmContracts - 1),
      });
    }
  }

  if (isNewDeployer || evmDeployment) {
    context.GlobalStats.set({
      id: 'global',
      cumulativeDeployers: cumulativeDeployers,
      totalEvmContracts: totalEvmContracts,
    });
  }

  const dayId = getDayId(timestamp);
  const existingStats = await context.DailyStats.get(dayId);

  if (existingStats) {
    context.DailyStats.set({
      ...existingStats,
      stylusActivations: existingStats.stylusActivations + (isReactivation ? 0 : 1),
      stylusReactivations: existingStats.stylusReactivations + (isReactivation ? 1 : 0),
      uniqueDeployers: existingStats.uniqueDeployers + (isNewDeployer ? 1 : 0),
      uniqueStylusDeployers: existingStats.uniqueStylusDeployers + (isNewDeployer ? 1 : 0),
      cumulativeDeployers: cumulativeDeployers,
      totalStylusContracts: existingStats.totalStylusContracts + (isReactivation ? 0 : 1),
    });
  } else {
    context.DailyStats.set({
      ...newDailyStats(dayId, timestamp, globalStats),
      stylusActivations: isReactivation ? 0 : 1,
      stylusReactivations: isReactivation ? 1 : 0,
      uniqueDeployers: isNewDeployer ? 1 : 0,
      uniqueStylusDeployers: isNewDeployer ? 1 : 0,
      cumulativeDeployers: cumulativeDeployers,
      totalStylusContracts: isReactivation ? 0 : 1,
      totalEvmContracts: totalEvmContracts,
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
        ...newDailyStats(dayId, timestamp, globalStats),
        stylusReactivations: 1,
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
        ...newDailyStats(dayId, timestamp, globalStats),
        cacheEvents: 1,
      });
    }
  },
);
