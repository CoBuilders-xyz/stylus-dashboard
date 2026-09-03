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

// Days render in UTC so the server and the browser print the same one. With the
// local timezone they disagree for anything in the first hours of a UTC day,
// which both breaks hydration and shows a day the date filters do not mean.
export function formatDay(timestamp: number | null): string {
  return timestamp === null ? '-' : new Date(timestamp * 1000).toISOString().slice(0, 10);
}

// Shares below 1% round away to "0.0%" under formatPercent, and the Stylus
// share of Arbitrum deployments lives down there.
export function formatShare(value: number): string {
  const percent = value * 100;
  return `${percent < 1 ? percent.toFixed(2) : percent.toFixed(1)}%`;
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

export const DAY_SECONDS = 24 * 60 * 60;
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

/** How far back "New This Week" counts, and so how far the query has to. */
export const NEW_BUILDER_DAYS = 7;

// Both builder ratios divide by the deployer count, which is zero until the
// first activation lands. Null rather than zero, so the KPI can show a dash
// instead of claiming a rate nobody has earned yet.
export function getRatio(numerator: number, denominator: number): number | null {
  return denominator > 0 ? numerator / denominator : null;
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

export interface DailyRow {
  date: number;
}

/** A calendar day of the window, with the row for it when there is one. */
export type WindowedDay<T> = {
  /** YYYY-MM-DD, used directly as the chart's x-axis label. */
  date: string;
  row?: T;
};

// A quiet day has no row at all, so every chart walks the calendar rather than
// the rows. Recharts spaces categories evenly, so plotting only the days that
// exist draws sparse activity as if it were continuous. DailyStats rows sit on
// 00:00 UTC, so the window edge has to as well, and "all" starts at the oldest
// row there is.
export function getWindowedDays<T extends DailyRow>(
  rows: T[],
  period: ChartPeriod,
  now: number,
): WindowedDay<T>[] {
  const today = Math.floor(now / DAY_SECONDS) * DAY_SECONDS;
  const windowStart =
    period === 'all' ? -Infinity : today - (PERIOD_DAYS[period] - 1) * DAY_SECONDS;

  const inWindow = rows.filter((row) => row.date >= windowStart);
  if (inWindow.length === 0) return [];

  const byDay = new Map(inWindow.map((row) => [row.date, row]));
  const start = period === 'all' ? Math.min(...byDay.keys()) : windowStart;

  const days: WindowedDay<T>[] = [];
  for (let day = start; day <= today; day += DAY_SECONDS) {
    days.push({ date: new Date(day * 1000).toISOString().slice(0, 10), row: byDay.get(day) });
  }
  return days;
}

export function getActivationSeries(
  dailyStats: DailyActivationStats[],
  period: ChartPeriod,
  now: number,
): ActivationPoint[] {
  return getWindowedDays(dailyStats, period, now).map(({ date, row }) => ({
    date,
    value: row?.stylusActivations ?? 0,
  }));
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
