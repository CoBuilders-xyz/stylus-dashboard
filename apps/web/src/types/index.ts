export interface StylusContract {
  id: string;
  deployer: string;
  codehash: string;
  moduleHash: string;
  version: number;
  dataFee: string;
  activatedAt: number;
  activatedBlock: number;
  chainId: number;
  isCached: boolean;
  lastKeepalive: number | null;
  expiresAt: number | null;
}

export interface DailyStats {
  id: string;
  date: number;
  stylusActivations: number;
  stylusReactivations: number;
  uniqueDeployers: number;
  totalStylusContracts: number;
  cacheEvents: number;
}

export interface LifetimeExtension {
  id: string;
  codehash: string;
  dataFee: string;
  timestamp: number;
  blockNumber: number;
}

export interface CacheEvent {
  id: string;
  manager: string;
  codehash: string;
  cached: boolean;
  timestamp: number;
  blockNumber: number;
}

export type OverviewContract = Pick<
  StylusContract,
  'id' | 'deployer' | 'activatedAt' | 'isCached'
>;

export interface OverviewData {
  StylusContract_aggregate: { aggregate: { count: number } };
  /** Hasura returns the singleton as a list; the row is absent until the first activation. */
  GlobalStats: { cumulativeDeployers: number }[];
  StylusContract: OverviewContract[];
  DailyStats: DailyStats[];
}

export type ActivationHistoryPoint = Pick<DailyStats, 'date' | 'stylusActivations'>;

export interface ActivationHistoryData {
  DailyStats: ActivationHistoryPoint[];
}

export interface AggregateCount {
  aggregate: { count: number };
}

export type ReactivationDailyStats = Pick<
  DailyStats,
  'date' | 'stylusActivations' | 'stylusReactivations'
>;

export interface HealthMetricsData {
  expired: AggregateCount;
  under7d: AggregateCount;
  from7to30d: AggregateCount;
  from30to90d: AggregateCount;
  from90to180d: AggregateCount;
  over180d: AggregateCount;
  DailyStats: ReactivationDailyStats[];
}
