import { DAY_SECONDS, getWindowedDays, type ChartPeriod } from '@/lib/utils';
import type { DailyDeployRow } from '@/types';

/** Shape both comparison charts read. */
export type DeployPoint = {
  date: string;
  stylus: number;
  evm: number;
};

export function getDeploySeries(
  stats: DailyDeployRow[],
  period: ChartPeriod,
  now: number,
): DeployPoint[] {
  return getWindowedDays(stats, period, now).map(({ date, row }) => ({
    date,
    stylus: row?.stylusActivations ?? 0,
    evm: row?.evmDeployments ?? 0,
  }));
}

// Each day as a share of its own total, so the stacked area reads at 100%. A
// day with no deploys on either side stays at 0 and leaves a gap in the band,
// which is honest: there is no split to draw.
export function getSharePoints(points: DeployPoint[]): DeployPoint[] {
  return points.map((point) => {
    const total = point.stylus + point.evm;
    if (total === 0) return { date: point.date, stylus: 0, evm: 0 };
    return {
      date: point.date,
      stylus: (point.stylus / total) * 100,
      evm: (point.evm / total) * 100,
    };
  });
}

/** Null when there is nothing to divide, which the KPI row renders as "-". */
export function getShare(stylus: number, evm: number): number | null {
  const total = stylus + evm;
  return total === 0 ? null : stylus / total;
}

export interface DeployTotals {
  stylus: number;
  evm: number;
}

// The window is applied here rather than trusted from the caller: the page's
// query is bounded to 30 days but the chart's history query is not, and both
// end up in front of these.
function getWindowTotals(stats: DailyDeployRow[], days: number, now: number): DeployTotals {
  const today = Math.floor(now / DAY_SECONDS) * DAY_SECONDS;
  const windowStart = today - (days - 1) * DAY_SECONDS;

  let stylus = 0;
  let evm = 0;
  for (const stat of stats) {
    if (stat.date < windowStart) continue;
    stylus += stat.stylusActivations;
    evm += stat.evmDeployments;
  }
  return { stylus, evm };
}

export function getWindowShare(stats: DailyDeployRow[], days: number, now: number): number | null {
  const { stylus, evm } = getWindowTotals(stats, days, now);
  return getShare(stylus, evm);
}

// Averaged over the whole window rather than over the days that have rows: a
// quiet day has no row, and dividing by rows would report a higher daily rate
// than what actually happened.
export function getDailyAverages(stats: DailyDeployRow[], days: number, now: number): DeployTotals {
  const { stylus, evm } = getWindowTotals(stats, days, now);
  return { stylus: stylus / days, evm: evm / days };
}
