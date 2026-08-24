import { describe, it, expect } from 'vitest';
import {
  formatNumber,
  formatPercent,
  getExpiryStatus,
  getExpiryBucket,
  getReactivationRateTrend,
  getContractStatus,
  getActivationSeries,
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

describe('getExpiryBucket', () => {
  const now = 1_000_000;
  const day = 24 * 60 * 60;

  it('treats a null expiresAt as the farthest-out bucket', () => {
    expect(getExpiryBucket(null, now)).toBe('180d+');
  });

  it('buckets a past expiresAt as Expired', () => {
    expect(getExpiryBucket(now - 1, now)).toBe('Expired');
  });

  it('buckets an expiresAt right at now as <7d, not yet Expired', () => {
    expect(getExpiryBucket(now, now)).toBe('<7d');
  });

  it('buckets under 7 days as <7d', () => {
    expect(getExpiryBucket(now + 7 * day - 1, now)).toBe('<7d');
  });

  it('buckets exactly 7 days as 7-30d', () => {
    expect(getExpiryBucket(now + 7 * day, now)).toBe('7-30d');
  });

  it('buckets under 30 days as 7-30d', () => {
    expect(getExpiryBucket(now + 30 * day - 1, now)).toBe('7-30d');
  });

  it('buckets exactly 30 days as 30-90d', () => {
    expect(getExpiryBucket(now + 30 * day, now)).toBe('30-90d');
  });

  it('buckets under 90 days as 30-90d', () => {
    expect(getExpiryBucket(now + 90 * day - 1, now)).toBe('30-90d');
  });

  it('buckets exactly 90 days as 90-180d', () => {
    expect(getExpiryBucket(now + 90 * day, now)).toBe('90-180d');
  });

  it('buckets under 180 days as 90-180d', () => {
    expect(getExpiryBucket(now + 180 * day - 1, now)).toBe('90-180d');
  });

  it('buckets exactly 180 days and beyond as 180d+', () => {
    expect(getExpiryBucket(now + 180 * day, now)).toBe('180d+');
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
  const stat = (id: string, offsetDays: number, stylusActivations: number) => ({
    id,
    date: TODAY + offsetDays * DAY,
    stylusActivations,
  });

  // The query returns newest first; the chart needs oldest first.
  const DESC_STATS = [
    stat('2026-01-10', 0, 5),
    stat('2026-01-04', -6, 1),
    stat('2025-12-01', -40, 99),
  ];

  it('returns nothing when there are no stats', () => {
    expect(getActivationSeries([], '7d', TODAY)).toEqual([]);
  });

  it('keeps the 7d window, oldest first', () => {
    expect(getActivationSeries(DESC_STATS, '7d', TODAY)).toEqual([
      { date: '2026-01-04', value: 1 },
      { date: '2026-01-10', value: 5 },
    ]);
  });

  it('drops rows older than the requested window', () => {
    const series = getActivationSeries(DESC_STATS, '30d', TODAY);

    expect(series).toHaveLength(2);
    expect(series.some((p) => p.value === 99)).toBe(false);
  });

  it('keeps every row for the all period', () => {
    expect(getActivationSeries(DESC_STATS, 'all', TODAY)).toEqual([
      { date: '2025-12-01', value: 99 },
      { date: '2026-01-04', value: 1 },
      { date: '2026-01-10', value: 5 },
    ]);
  });

  it('normalises a mid-day now to the day start', () => {
    // Without normalising, the 7d edge lands mid-afternoon and drops 2026-01-04.
    const series = getActivationSeries(DESC_STATS, '7d', TODAY + 13 * 3600);

    expect(series.map((p) => p.date)).toEqual(['2026-01-04', '2026-01-10']);
  });

  it('leaves the caller array untouched', () => {
    const input = [...DESC_STATS];

    getActivationSeries(input, 'all', TODAY);

    expect(input).toEqual(DESC_STATS);
  });
});
