import { describe, it, expect } from 'vitest';
import { formatNumber, formatPercent, getExpiryStatus, getExpiryBucket } from '../lib/utils';

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
