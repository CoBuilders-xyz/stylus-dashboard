import { describe, it, expect } from 'vitest';
import {
  formatNumber,
  formatPercent,
  getExpiryStatus,
  getReactivationRateTrend,
  getContractStatus,
  getActivationSeries,
  getExpiryBoundaries,
  getExpiryBreakdown,
  getRatio,
  getRecentWindowStart,
} from '../lib/utils';

describe('formatNumber', () => {
  it('formats millions', () => {
    expect(formatNumber(1_500_000)).toBe('1.5M');
  });

  it('formats thousands', () => {
    expect(formatNumber(2_500)).toBe('2.5K');
  });

  it('returns raw number below 1000', () => {
    expect(formatNumber(42)).toBe('42');
  });
});

describe('formatPercent', () => {
  it('formats decimal as percentage', () => {
    expect(formatPercent(0.156)).toBe('15.6%');
  });

  it('handles zero', () => {
    expect(formatPercent(0)).toBe('0.0%');
  });
});

describe('getExpiryStatus', () => {
  const now = 1_000_000;
  const window = 7 * 24 * 60 * 60;

  it('treats a null expiresAt as active', () => {
    expect(getExpiryStatus(null, now, window)).toBe('active');
  });

  it('flags a past expiresAt as expired', () => {
    expect(getExpiryStatus(now - 1, now, window)).toBe('expired');
  });

  it('flags an expiresAt inside the window as expiring soon', () => {
    expect(getExpiryStatus(now + window - 1, now, window)).toBe('expiring-soon');
  });

  it('flags an expiresAt right at the window edge as expiring soon', () => {
    expect(getExpiryStatus(now + window, now, window)).toBe('expiring-soon');
  });

  it('flags an expiresAt past the window as active', () => {
    expect(getExpiryStatus(now + window + 1, now, window)).toBe('active');
  });
});

describe('getContractStatus', () => {
  const now = 1_000_000;
  const window = 7 * 24 * 60 * 60;

  it('flags a past expiresAt as Expired regardless of isCached', () => {
    expect(getContractStatus(true, now - 1, now, window)).toBe('Expired');
    expect(getContractStatus(false, now - 1, now, window)).toBe('Expired');
  });

  it('flags an expiresAt inside the window as Expiring regardless of isCached', () => {
    expect(getContractStatus(true, now + window - 1, now, window)).toBe('Expiring');
    expect(getContractStatus(false, now + window - 1, now, window)).toBe('Expiring');
  });

  it('flags a cached contract outside the expiry window as Cached', () => {
    expect(getContractStatus(true, now + window + 1, now, window)).toBe('Cached');
  });

  it('flags a non-cached contract outside the expiry window as Active', () => {
    expect(getContractStatus(false, now + window + 1, now, window)).toBe('Active');
  });

  it('treats a null expiresAt as not expiring, so isCached decides', () => {
    expect(getContractStatus(true, null, now, window)).toBe('Cached');
    expect(getContractStatus(false, null, now, window)).toBe('Active');
  });
});

describe('getReactivationRateTrend', () => {
  const now = 1_000_000;
  const day = 24 * 60 * 60;

  it('returns nulls when there are no daily stats', () => {
    expect(getReactivationRateTrend([], now)).toEqual({
      currentRate: null,
      previousRate: null,
      changePoints: null,
    });
  });

  it('computes the current window rate from reactivations / activations', () => {
    const stats = [
      { date: now - 1 * day, stylusActivations: 10, stylusReactivations: 5 },
      { date: now - 2 * day, stylusActivations: 10, stylusReactivations: 5 },
    ];
    const result = getReactivationRateTrend(stats, now);
    expect(result.currentRate).toBeCloseTo(0.5);
  });

  it('leaves previousRate null when the prior window has no activations', () => {
    const stats = [{ date: now - 1 * day, stylusActivations: 10, stylusReactivations: 5 }];
    const result = getReactivationRateTrend(stats, now);
    expect(result.previousRate).toBeNull();
    expect(result.changePoints).toBeNull();
  });

  it('computes changePoints as current minus previous rate', () => {
    const stats = [
      { date: now - 1 * day, stylusActivations: 10, stylusReactivations: 6 }, // current: 0.6
      { date: now - 10 * day, stylusActivations: 10, stylusReactivations: 2 }, // previous: 0.2
    ];
    const result = getReactivationRateTrend(stats, now);
    expect(result.currentRate).toBeCloseTo(0.6);
    expect(result.previousRate).toBeCloseTo(0.2);
    expect(result.changePoints).toBeCloseTo(0.4);
  });

  it('treats a stat exactly 7 days old as inside the current window', () => {
    const stats = [{ date: now - 7 * day, stylusActivations: 4, stylusReactivations: 1 }];
    const result = getReactivationRateTrend(stats, now);
    expect(result.currentRate).toBeCloseTo(0.25);
    expect(result.previousRate).toBeNull();
  });

  it('treats a stat exactly 14 days old as inside the previous window', () => {
    const stats = [
      { date: now - 1 * day, stylusActivations: 1, stylusReactivations: 0 },
      { date: now - 14 * day, stylusActivations: 4, stylusReactivations: 1 },
    ];
    const result = getReactivationRateTrend(stats, now);
    expect(result.previousRate).toBeCloseTo(0.25);
  });

  it('excludes stats older than 14 days from both windows', () => {
    const stats = [
      { date: now - 1 * day, stylusActivations: 10, stylusReactivations: 5 },
      { date: now - 20 * day, stylusActivations: 100, stylusReactivations: 100 },
    ];
    const result = getReactivationRateTrend(stats, now);
    expect(result.previousRate).toBeNull();
  });

  it('treats zero activations with zero reactivations as null, not 0/0', () => {
    const stats = [{ date: now - 1 * day, stylusActivations: 0, stylusReactivations: 0 }];
    const result = getReactivationRateTrend(stats, now);
    expect(result.currentRate).toBeNull();
  });
});

describe('getActivationSeries', () => {
  const DAY = 24 * 60 * 60;
  const TODAY = 1768003200; // 2026-01-10T00:00:00Z
  const stat = (offsetDays: number, stylusActivations: number) => ({
    date: TODAY + offsetDays * DAY,
    stylusActivations,
  });

  // The query returns newest first; the chart needs oldest first.
  const DESC_STATS = [stat(0, 5), stat(-6, 1), stat(-40, 99)];

  it('returns nothing when there are no stats', () => {
    expect(getActivationSeries([], '7d', TODAY)).toEqual([]);
  });

  it('returns nothing when no row falls inside the window', () => {
    expect(getActivationSeries([stat(-40, 99)], '7d', TODAY)).toEqual([]);
  });

  it('covers the 7d window day by day, oldest first', () => {
    expect(getActivationSeries(DESC_STATS, '7d', TODAY)).toEqual([
      { date: '2026-01-04', value: 1 },
      { date: '2026-01-05', value: 0 },
      { date: '2026-01-06', value: 0 },
      { date: '2026-01-07', value: 0 },
      { date: '2026-01-08', value: 0 },
      { date: '2026-01-09', value: 0 },
      { date: '2026-01-10', value: 5 },
    ]);
  });

  it('drops rows older than the requested window', () => {
    const series = getActivationSeries(DESC_STATS, '30d', TODAY);

    expect(series).toHaveLength(30);
    expect(series.some((p) => p.value === 99)).toBe(false);
  });

  it('runs the all period from the oldest row to today', () => {
    const series = getActivationSeries(DESC_STATS, 'all', TODAY);

    expect(series).toHaveLength(41);
    expect(series[0]).toEqual({ date: '2025-12-01', value: 99 });
    expect(series.at(-1)).toEqual({ date: '2026-01-10', value: 5 });
    expect(series.filter((p) => p.value > 0)).toHaveLength(3);
  });

  it('normalises a mid-day now to the day start', () => {
    // Without normalising, the 7d edge lands mid-afternoon and drops 2026-01-04.
    const series = getActivationSeries(DESC_STATS, '7d', TODAY + 13 * 3600);

    expect(series[0].date).toBe('2026-01-04');
    expect(series.at(-1)).toEqual({ date: '2026-01-10', value: 5 });
  });

  it('leaves the caller array untouched', () => {
    const input = [...DESC_STATS];

    getActivationSeries(input, 'all', TODAY);

    expect(input).toEqual(DESC_STATS);
  });
});

describe('getRecentWindowStart', () => {
  const DAY = 24 * 60 * 60;
  const TODAY = 1768003200; // 2026-01-10T00:00:00Z

  it('covers 30 UTC days ending today', () => {
    expect(getRecentWindowStart(TODAY)).toBe(TODAY - 29 * DAY);
  });

  it('normalises a mid-day now to the day start', () => {
    expect(getRecentWindowStart(TODAY + 13 * 3600)).toBe(TODAY - 29 * DAY);
  });

  // The health page asks for 14 days and the builders page for 7.
  it('takes a shorter window when the caller needs fewer days', () => {
    expect(getRecentWindowStart(TODAY, 14)).toBe(TODAY - 13 * DAY);
    expect(getRecentWindowStart(TODAY, 7)).toBe(TODAY - 6 * DAY);
  });
});

describe('getExpiryBreakdown', () => {
  const counts = {
    expired: 3,
    under7d: 2,
    from7to30d: 5,
    from30to90d: 7,
    from90to180d: 11,
    over180d: 13,
  };

  it('keeps the buckets in chart order', () => {
    expect(getExpiryBreakdown(counts).buckets).toEqual([
      { bucket: 'Expired', count: 3 },
      { bucket: '<7d', count: 2 },
      { bucket: '7-30d', count: 5 },
      { bucket: '30-90d', count: 7 },
      { bucket: '90-180d', count: 11 },
      { bucket: '180d+', count: 13 },
    ]);
  });

  // The pie is three sums over the same six numbers, which is what stops it
  // from disagreeing with the histogram.
  it('derives the status slices from the buckets', () => {
    const { active, expiringSoon, expired, total } = getExpiryBreakdown(counts);

    expect(active).toBe(5 + 7 + 11 + 13);
    expect(expiringSoon).toBe(2);
    expect(expired).toBe(3);
    expect(active + expiringSoon + expired).toBe(total);
  });

  it('counts a contract with no expiry as active, in the farthest bucket', () => {
    // The query puts a contract with no expiry in over180d, so it has to reach
    // the active slice from there.
    const { active, buckets } = getExpiryBreakdown({
      expired: 0,
      under7d: 0,
      from7to30d: 0,
      from30to90d: 0,
      from90to180d: 0,
      over180d: 1,
    });

    expect(active).toBe(1);
    expect(buckets.at(-1)).toEqual({ bucket: '180d+', count: 1 });
  });

  it('reports nothing indexed as a zero total', () => {
    const zeroes = {
      expired: 0,
      under7d: 0,
      from7to30d: 0,
      from30to90d: 0,
      from90to180d: 0,
      over180d: 0,
    };

    expect(getExpiryBreakdown(zeroes).total).toBe(0);
  });
});

describe('getExpiryBoundaries', () => {
  const DAY = 24 * 60 * 60;
  const HOUR = 60 * 60;
  const NOON = 1768046400; // 2026-01-10T12:00:00Z

  it('spaces the edges 7, 30, 90 and 180 days out', () => {
    expect(getExpiryBoundaries(NOON)).toEqual({
      now: NOON,
      d7: NOON + 7 * DAY,
      d30: NOON + 30 * DAY,
      d90: NOON + 90 * DAY,
      d180: NOON + 180 * DAY,
    });
  });

  // Without this the 5-second poll makes a new query key every time and the
  // cache never serves anything.
  it('gives every second of the hour the same boundaries', () => {
    expect(getExpiryBoundaries(NOON + 59 * 60 + 59)).toEqual(getExpiryBoundaries(NOON));
    expect(getExpiryBoundaries(NOON + HOUR)).not.toEqual(getExpiryBoundaries(NOON));
  });
});

describe('getRatio', () => {
  it('divides', () => {
    expect(getRatio(3, 12)).toBe(0.25);
  });

  it('returns null rather than a rate nobody has earned', () => {
    expect(getRatio(0, 0)).toBeNull();
  });
});
