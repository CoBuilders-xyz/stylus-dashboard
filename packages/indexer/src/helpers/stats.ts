export const SECONDS_PER_DAY = 86400;

export function getDayId(timestamp: number): string {
  const date = new Date(timestamp * 1000);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getDayStartTimestamp(timestamp: number): number {
  return Math.floor(timestamp / SECONDS_PER_DAY) * SECONDS_PER_DAY;
}

export const EXPIRY_DAYS = 365;
export const EXPIRY_SECONDS = EXPIRY_DAYS * SECONDS_PER_DAY;

export const SECONDS_PER_WEEK = 7 * SECONDS_PER_DAY;

// Fixed 7-day windows since the epoch, not calendar weeks, matching the day
// bucketing the rest of the stats use.
export function getWeekIndex(timestamp: number): number {
  return Math.floor(timestamp / SECONDS_PER_WEEK);
}

type GlobalStatsSnapshot =
  | {
      cumulativeDeployers: number;
      totalEvmContracts: number;
      repeatStylusDeployers: number;
      retainedStylusDeployers: number;
    }
  | undefined;

// Both handlers write the singleton for their own reason, so each one has to
// carry the other's counters through untouched.
export function carryGlobalStats(globalStats: GlobalStatsSnapshot) {
  return {
    id: 'global',
    cumulativeDeployers: globalStats?.cumulativeDeployers ?? 0,
    totalEvmContracts: globalStats?.totalEvmContracts ?? 0,
    repeatStylusDeployers: globalStats?.repeatStylusDeployers ?? 0,
    retainedStylusDeployers: globalStats?.retainedStylusDeployers ?? 0,
  };
}

// A deployer with no Stylus activation yet: the counters start at zero and the
// timestamps stay unset until the first one lands.
export function newDeployerRegistry(id: string, deployerType: string) {
  return {
    id: id,
    deployerType: deployerType,
    stylusContractCount: 0,
    firstStylusAt: undefined,
    lastStylusAt: undefined,
    stylusWeeks: 0,
    lastStylusWeek: undefined,
  };
}

// A fresh day row starts zeroed but carries the running totals forward.
export function newDailyStats(dayId: string, timestamp: number, globalStats: GlobalStatsSnapshot) {
  return {
    id: dayId,
    date: getDayStartTimestamp(timestamp),
    stylusActivations: 0,
    stylusReactivations: 0,
    uniqueDeployers: 0,
    uniqueStylusDeployers: 0,
    uniqueEvmDeployers: 0,
    cumulativeDeployers: globalStats?.cumulativeDeployers ?? 0,
    totalStylusContracts: 0,
    evmDeployments: 0,
    totalEvmContracts: globalStats?.totalEvmContracts ?? 0,
    cacheEvents: 0,
    dailyActiveContracts: 0,
    totalTransactions: 0,
  };
}