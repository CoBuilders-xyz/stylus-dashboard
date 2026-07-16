import { describe, it, expect } from 'vitest';
import { getDayId, getDayStartTimestamp, EXPIRY_SECONDS } from '../src/helpers/stats';

describe('stats helpers', () => {
  it('getDayId returns YYYY-MM-DD format', () => {
    // 2024-01-15 12:30:00 UTC
    const timestamp = 1705318200;
    expect(getDayId(timestamp)).toBe('2024-01-15');
  });

  it('getDayStartTimestamp returns midnight UTC', () => {
    // 2024-01-15 12:30:00 UTC
    const timestamp = 1705318200;
    const dayStart = getDayStartTimestamp(timestamp);
    // 2024-01-15 00:00:00 UTC = 1705276800
    expect(dayStart).toBe(1705276800);
  });

  it('EXPIRY_SECONDS is 365 days', () => {
    expect(EXPIRY_SECONDS).toBe(365 * 24 * 60 * 60);
  });
});
