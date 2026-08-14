import { describe, it, expect } from 'vitest';
import { formatNumber, formatPercent, getExpiryStatus } from '../lib/utils';

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
