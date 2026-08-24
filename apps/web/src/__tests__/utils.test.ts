import { describe, it, expect } from 'vitest';
import {
  formatNumber,
  formatPercent,
  getExpiryStatus,
  getExpiryBucket,
  getReactivationRateTrend,
  getBuilderRetentionRate,
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

describe('getBuilderRetentionRate', () => {
  const week = 7 * 24 * 60 * 60;

  it('returns null when there are no deployers', () => {
    expect(getBuilderRetentionRate([])).toBeNull();
  });

  it('does not count a deployer with a single activation as retained', () => {
    const contracts = [{ deployer: '0xA', activatedAt: 0 }];
    expect(getBuilderRetentionRate(contracts)).toBe(0);
  });

  it('does not count multiple activations in the same week as retained', () => {
    const contracts = [
      { deployer: '0xA', activatedAt: 0 },
      { deployer: '0xA', activatedAt: week - 1 },
    ];
    expect(getBuilderRetentionRate(contracts)).toBe(0);
  });

  it('counts a deployer active in two distinct weeks as retained', () => {
    const contracts = [
      { deployer: '0xA', activatedAt: 0 },
      { deployer: '0xA', activatedAt: week },
    ];
    expect(getBuilderRetentionRate(contracts)).toBe(1);
  });

  it('computes the fraction across a mix of one-off and retained deployers', () => {
    const contracts = [
      { deployer: '0xA', activatedAt: 0 },
      { deployer: '0xA', activatedAt: week }, // retained
      { deployer: '0xB', activatedAt: 0 }, // one-off
      { deployer: '0xC', activatedAt: 0 },
      { deployer: '0xC', activatedAt: 5 * week }, // retained
      { deployer: '0xD', activatedAt: 0 }, // one-off
    ];
    expect(getBuilderRetentionRate(contracts)).toBeCloseTo(0.5);
  });
});
