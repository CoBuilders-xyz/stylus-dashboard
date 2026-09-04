import { describe, it, expect } from 'vitest';
import {
  getDailyAverages,
  getDeploySeries,
  getShare,
  getSharePoints,
  getWindowShare,
} from '../lib/comparison';
import { formatShare } from '../lib/utils';

const DAY = 24 * 60 * 60;
const TODAY = 1768003200; // 2026-01-10T00:00:00Z

const stat = (offsetDays: number, stylusActivations: number, evmDeployments: number) => ({
  date: TODAY + offsetDays * DAY,
  stylusActivations,
  evmDeployments,
});

describe('formatShare', () => {
  it('keeps two decimals below one percent', () => {
    expect(formatShare(0.0004)).toBe('0.04%');
  });

  it('keeps one decimal at or above one percent', () => {
    expect(formatShare(0.156)).toBe('15.6%');
  });

  it('does not round a small share away to zero', () => {
    expect(formatShare(0.00042)).not.toBe('0.0%');
  });
});

describe('getShare', () => {
  it('divides Stylus by the combined total', () => {
    expect(getShare(1, 3)).toBe(0.25);
  });

  it('returns null when both sides are zero', () => {
    expect(getShare(0, 0)).toBeNull();
  });

  it('returns 1 when there is no EVM side', () => {
    expect(getShare(5, 0)).toBe(1);
  });
});

describe('getDeploySeries', () => {
  // The query returns newest first; the charts need oldest first.
  const DESC_STATS = [stat(0, 5, 50), stat(-6, 1, 10), stat(-40, 99, 990)];

  it('returns nothing when there are no stats', () => {
    expect(getDeploySeries([], '7d', TODAY)).toEqual([]);
  });

  it('returns nothing when no row falls inside the window', () => {
    expect(getDeploySeries([stat(-40, 99, 990)], '7d', TODAY)).toEqual([]);
  });

  it('covers every day of the window oldest first', () => {
    const series = getDeploySeries(DESC_STATS, '7d', TODAY);
    expect(series).toHaveLength(7);
    expect(series[0]).toEqual({ date: '2026-01-04', stylus: 1, evm: 10 });
    expect(series[6]).toEqual({ date: '2026-01-10', stylus: 5, evm: 50 });
  });

  it('fills a day with no row on both sides', () => {
    const series = getDeploySeries(DESC_STATS, '7d', TODAY);
    expect(series[3]).toEqual({ date: '2026-01-07', stylus: 0, evm: 0 });
  });

  it('reaches back to the oldest row for the all period', () => {
    const series = getDeploySeries(DESC_STATS, 'all', TODAY);
    expect(series).toHaveLength(41);
    expect(series[0]).toEqual({ date: '2025-12-01', stylus: 99, evm: 990 });
  });

  it('puts a row on the right UTC day regardless of the clock inside it', () => {
    const lateInTheDay = TODAY + 23 * 60 * 60;
    const series = getDeploySeries([stat(0, 5, 50)], '7d', lateInTheDay);
    expect(series[series.length - 1]).toEqual({ date: '2026-01-10', stylus: 5, evm: 50 });
  });
});

describe('getSharePoints', () => {
  it('turns each day into percentages that add up to 100', () => {
    const points = getSharePoints([{ date: '2026-01-10', stylus: 1, evm: 3 }]);
    expect(points[0]).toEqual({ date: '2026-01-10', stylus: 25, evm: 75 });
  });

  it('leaves a day with no deploys at zero instead of splitting it', () => {
    const points = getSharePoints([{ date: '2026-01-10', stylus: 0, evm: 0 }]);
    expect(points[0]).toEqual({ date: '2026-01-10', stylus: 0, evm: 0 });
  });
});

describe('getWindowShare', () => {
  it('sums both sides over the trailing days', () => {
    const stats = [stat(0, 1, 9), stat(-6, 1, 9)];
    expect(getWindowShare(stats, 7, TODAY)).toBeCloseTo(0.1);
  });

  it('ignores rows older than the window', () => {
    const stats = [stat(0, 1, 1), stat(-30, 0, 998)];
    expect(getWindowShare(stats, 7, TODAY)).toBe(0.5);
  });

  it('returns null when the window has no deploys', () => {
    expect(getWindowShare([stat(-30, 5, 5)], 7, TODAY)).toBeNull();
  });
});

describe('getDailyAverages', () => {
  it('divides by the window length, not by the rows returned', () => {
    const averages = getDailyAverages([stat(0, 30, 300)], 30, TODAY);
    expect(averages).toEqual({ stylus: 1, evm: 10 });
  });

  // The chart's "all" query is unbounded, so rows older than the window do
  // reach this and must not raise the average.
  it('ignores rows older than the window', () => {
    const stats = [stat(0, 30, 300), stat(-40, 9000, 9000)];
    expect(getDailyAverages(stats, 30, TODAY)).toEqual({ stylus: 1, evm: 10 });
  });

  it('returns zero for an empty window', () => {
    expect(getDailyAverages([], 30, TODAY)).toEqual({ stylus: 0, evm: 0 });
  });
});
