import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatNumber(num: number): string {
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return num.toString();
}

export function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

export type ExpiryStatus = 'active' | 'expiring-soon' | 'expired';

export function getExpiryStatus(
  expiresAt: number | null,
  now: number,
  windowSeconds: number,
): ExpiryStatus {
  if (expiresAt === null) return 'active';
  if (expiresAt < now) return 'expired';
  if (expiresAt <= now + windowSeconds) return 'expiring-soon';
  return 'active';
}

export type ContractStatus = 'Active' | 'Cached' | 'Expiring' | 'Expired';

// Layers isCached on top of getExpiryStatus: expiry always wins over caching
// (an expired contract shows as Expired even if it's still in the WASM cache).
export function getContractStatus(
  isCached: boolean,
  expiresAt: number | null,
  now: number,
  windowSeconds: number,
): ContractStatus {
  const expiry = getExpiryStatus(expiresAt, now, windowSeconds);
  if (expiry === 'expired') return 'Expired';
  if (expiry === 'expiring-soon') return 'Expiring';
  return isCached ? 'Cached' : 'Active';
}

export type ExpiryBucket = 'Expired' | '<7d' | '7-30d' | '30-90d' | '90-180d' | '180d+';

export const EXPIRY_BUCKET_ORDER: ExpiryBucket[] = [
  'Expired',
  '<7d',
  '7-30d',
  '30-90d',
  '90-180d',
  '180d+',
];

const DAY_SECONDS = 24 * 60 * 60;

export function getExpiryBucket(expiresAt: number | null, now: number): ExpiryBucket {
  // A null expiresAt means no expiry has been set yet; bucket it with the
  // farthest-out contracts, matching getExpiryStatus treating it as active.
  if (expiresAt === null) return '180d+';

  const secondsRemaining = expiresAt - now;
  if (secondsRemaining < 0) return 'Expired';
  if (secondsRemaining < 7 * DAY_SECONDS) return '<7d';
  if (secondsRemaining < 30 * DAY_SECONDS) return '7-30d';
  if (secondsRemaining < 90 * DAY_SECONDS) return '30-90d';
  if (secondsRemaining < 180 * DAY_SECONDS) return '90-180d';
  return '180d+';
}

const HOUR_SECONDS = 60 * 60;

/** The counts the health query returns, one per bucket in EXPIRY_BUCKET_ORDER. */
export interface ExpiryBucketCounts {
  expired: number;
  under7d: number;
  from7to30d: number;
  from30to90d: number;
  from90to180d: number;
  over180d: number;
}

/** One bar of the expiry histogram, and the shape the chart takes. */
export interface ExpiryBucketCount {
  bucket: ExpiryBucket;
  count: number;
}

export interface ExpiryBreakdown {
  buckets: ExpiryBucketCount[];
  active: number;
  expiringSoon: number;
  expired: number;
  total: number;
}

// The six buckets already partition the table, so the status pie is three sums
// over them rather than a second pass with its own thresholds. Deriving it this
// way is what keeps the two charts from disagreeing.
export function getExpiryBreakdown(counts: ExpiryBucketCounts): ExpiryBreakdown {
  const byBucket: Record<ExpiryBucket, number> = {
    Expired: counts.expired,
    '<7d': counts.under7d,
    '7-30d': counts.from7to30d,
    '30-90d': counts.from30to90d,
    '90-180d': counts.from90to180d,
    '180d+': counts.over180d,
  };
  const active =
    counts.from7to30d + counts.from30to90d + counts.from90to180d + counts.over180d;

  return {
    buckets: EXPIRY_BUCKET_ORDER.map((bucket) => ({ bucket, count: byBucket[bucket] })),
    active,
    expiringSoon: counts.under7d,
    expired: counts.expired,
    total: active + counts.under7d + counts.expired,
  };
}

/** The bucket edges as absolute timestamps, which is what the query filters on. */
export interface ExpiryBoundaries {
  now: number;
  d7: number;
  d30: number;
  d90: number;
  d180: number;
}

// Every predicate is parameterised on now, so an unrounded value makes a new
// query key on each 5-second poll and nothing is ever served from cache. The
// buckets are day-scale, so an hour of drift at the edges moves no number.
export function getExpiryBoundaries(now: number): ExpiryBoundaries {
  const hour = Math.floor(now / HOUR_SECONDS) * HOUR_SECONDS;
  return {
    now: hour,
    d7: hour + 7 * DAY_SECONDS,
    d30: hour + 30 * DAY_SECONDS,
    d90: hour + 90 * DAY_SECONDS,
    d180: hour + 180 * DAY_SECONDS,
  };
}

/** How far back getReactivationRateTrend reaches, and so how far the query has to. */
export const REACTIVATION_DAYS = 14;

export interface DailyReactivationStats {
  date: number;
  stylusActivations: number;
  stylusReactivations: number;
}

export interface ReactivationRateTrend {
  /** Fraction (0-1), same scale formatPercent expects. Null when the window had no activations. */
  currentRate: number | null;
  previousRate: number | null;
  /** currentRate - previousRate, in the same fraction scale. Null unless both rates exist. */
  changePoints: number | null;
}

export function getReactivationRateTrend(
  dailyStats: DailyReactivationStats[],
  now: number,
): ReactivationRateTrend {
  const day = 24 * 60 * 60;
  const currentWindowStart = now - 7 * day;
  const previousWindowStart = now - 14 * day;

  let currentActivations = 0;
  let currentReactivations = 0;
  let previousActivations = 0;
  let previousReactivations = 0;

  for (const stat of dailyStats) {
    if (stat.date >= currentWindowStart) {
      currentActivations += stat.stylusActivations;
      currentReactivations += stat.stylusReactivations;
    } else if (stat.date >= previousWindowStart) {
      previousActivations += stat.stylusActivations;
      previousReactivations += stat.stylusReactivations;
    }
  }

  const currentRate = currentActivations > 0 ? currentReactivations / currentActivations : null;
  const previousRate =
    previousActivations > 0 ? previousReactivations / previousActivations : null;
  const changePoints =
    currentRate !== null && previousRate !== null ? currentRate - previousRate : null;

  return { currentRate, previousRate, changePoints };
}

export interface DeployerActivation {
  deployer: string;
  activatedAt: number;
}

const WEEK_SECONDS = 7 * DAY_SECONDS;

// Fraction (0-1) of deployers active in more than one distinct week. Null
// when there are no deployers to measure, same convention as
// getReactivationRateTrend.
export function getBuilderRetentionRate(contracts: DeployerActivation[]): number | null {
  const weeksByDeployer = new Map<string, Set<number>>();

  for (const { deployer, activatedAt } of contracts) {
    // Fixed 7-day windows since the Unix epoch, not calendar/ISO weeks —
    // matches the day-bucketing the indexer already uses for DailyStats.
    const week = Math.floor(activatedAt / WEEK_SECONDS);
    const weeks = weeksByDeployer.get(deployer);
    if (weeks) weeks.add(week);
    else weeksByDeployer.set(deployer, new Set([week]));
  }

  if (weeksByDeployer.size === 0) return null;

  let retained = 0;
  for (const weeks of weeksByDeployer.values()) {
    if (weeks.size > 1) retained += 1;
  }

  return retained / weeksByDeployer.size;
}

export type ChartPeriod = '7d' | '30d' | 'all';

export const CHART_PERIODS: ChartPeriod[] = ['7d', '30d', 'all'];

const PERIOD_DAYS = { '7d': 7, '30d': 30 } as const;

export interface DailyActivationStats {
  date: number;
  stylusActivations: number;
}

/** Shape the Recharts time-series component expects. */
export type ActivationPoint = {
  date: string;
  value: number;
};

export function getActivationSeries(
  dailyStats: DailyActivationStats[],
  period: ChartPeriod,
  now: number,
): ActivationPoint[] {
  // DailyStats rows sit on 00:00 UTC, so the window edge has to as well.
  const today = Math.floor(now / DAY_SECONDS) * DAY_SECONDS;
  const windowStart = period === 'all' ? -Infinity : today - (PERIOD_DAYS[period] - 1) * DAY_SECONDS;

  const inWindow = dailyStats.filter((stat) => stat.date >= windowStart);
  if (inWindow.length === 0) return [];

  const activationsByDay = new Map(inWindow.map((stat) => [stat.date, stat.stylusActivations]));
  // A quiet day has no row at all, so the series walks the calendar rather than
  // the rows. Recharts spaces categories evenly, so plotting only the days that
  // exist draws sparse activity as if it were continuous.
  const start = period === 'all' ? Math.min(...activationsByDay.keys()) : windowStart;

  const series: ActivationPoint[] = [];
  for (let day = start; day <= today; day += DAY_SECONDS) {
    series.push({
      date: new Date(day * 1000).toISOString().slice(0, 10),
      value: activationsByDay.get(day) ?? 0,
    });
  }
  return series;
}

// The KPI row and the daily table have always summarised the last 30 days, and
// the chart's 30d period is drawn from those same rows, so the two windows have
// to stay the same length.
export const RECENT_DAYS = PERIOD_DAYS['30d'];

// Start of the oldest UTC day the window covers. Queries bound DailyStats by
// this instead of taking the N most recent rows, so a stretch of days with no
// activity can't widen the window past N days.
export function getRecentWindowStart(now: number, days: number = RECENT_DAYS): number {
  const today = Math.floor(now / DAY_SECONDS) * DAY_SECONDS;
  return today - (days - 1) * DAY_SECONDS;
}
