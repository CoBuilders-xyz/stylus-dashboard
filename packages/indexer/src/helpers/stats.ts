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

type GlobalStatsSnapshot = { cumulativeDeployers: number; totalEvmContracts: number } | undefined;

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