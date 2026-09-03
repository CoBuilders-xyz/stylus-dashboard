'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { graphqlClient } from '@/lib/graphql/client';
import { GET_COMPARISON_HISTORY, GET_COMPARISON_STATS } from '@/lib/graphql/queries';
import { KpiCard, KpiCardSkeleton } from '@/components/kpi-card';
import { ComparisonKpiCard } from '@/components/comparison-kpi-card';
import { PeriodToggle } from '@/components/period-toggle';
import { QueryErrorBoundary } from '@/components/query-error-boundary';
import { DeployVolumeChart } from '@/components/charts/deploy-volume-chart';
import { ShareAreaChart } from '@/components/charts/share-area-chart';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import {
  getDailyAverages,
  getDeploySeries,
  getShare,
  getSharePoints,
  getWindowShare,
} from '@/lib/comparison';
import {
  formatNumber,
  formatShare,
  getRecentWindowStart,
  RECENT_DAYS,
  type ChartPeriod,
} from '@/lib/utils';
import type { ComparisonData, ComparisonHistoryData } from '@/types';

/** Full history changes once a day at most, so it doesn't need the 5s cadence. */
const HISTORY_REFETCH_MS = 60_000;

const SHARE_TREND_DAYS = 7;

const CHART_MESSAGES = {
  loading: 'Loading...',
  'history-error': 'Could not load the full deployment history.',
  empty: 'No deployments indexed for this period.',
} as const;

type ChartState = keyof typeof CHART_MESSAGES | 'ready';

// Both charts draw the same days from the same query, so they are in the same
// state at all times. Deciding it once keeps them from drifting apart, which
// is how the share chart came to report a failed history fetch as no data.
function ChartSlot({ state, children }: { state: ChartState; children: React.ReactNode }) {
  if (state === 'ready') return <>{children}</>;
  return <p className="text-muted-foreground text-sm">{CHART_MESSAGES[state]}</p>;
}

export function ComparisonClient({ initialData }: { initialData?: ComparisonData }) {
  const [period, setPeriod] = useState<ChartPeriod>('30d');

  // One clock per render, shared with the chart's window, so a tab left open
  // past 00:00 UTC moves both onto the new day together.
  const now = Math.floor(Date.now() / 1000);
  const since = getRecentWindowStart(now);

  const { data, isLoading, error, refetch } = useQuery<ComparisonData>({
    queryKey: ['comparison', since],
    queryFn: () => graphqlClient.request(GET_COMPARISON_STATS, { since }),
    initialData: initialData,
    refetchInterval: 5000,
  });

  const isAllPeriod = period === 'all';
  const {
    data: history,
    isLoading: isHistoryLoading,
    error: historyError,
  } = useQuery<ComparisonHistoryData>({
    queryKey: ['comparison-history'],
    queryFn: () => graphqlClient.request(GET_COMPARISON_HISTORY),
    enabled: isAllPeriod,
    refetchInterval: HISTORY_REFETCH_MS,
  });

  const recentStats = data?.DailyStats ?? [];
  const stylusContracts = data?.StylusContract_aggregate.aggregate.count ?? 0;
  const evmContracts = data?.GlobalStats[0]?.totalEvmContracts ?? 0;
  const stylusOnly = data?.stylusOnly.aggregate.count ?? 0;
  const both = data?.both.aggregate.count ?? 0;
  const evmOnly = data?.evmOnly.aggregate.count ?? 0;

  const share = getShare(stylusContracts, evmContracts);
  const trendShare = getWindowShare(recentStats, SHARE_TREND_DAYS, now);
  const averages = getDailyAverages(recentStats, RECENT_DAYS, now);

  const seriesSource = isAllPeriod ? (history?.DailyStats ?? []) : recentStats;
  const series = getDeploySeries(seriesSource, period, now);
  const hasDeploys = series.some((point) => point.stylus > 0 || point.evm > 0);

  const chartState: ChartState = (isAllPeriod ? isHistoryLoading : isLoading)
    ? 'loading'
    : isAllPeriod && historyError
      ? 'history-error'
      : !hasDeploys
        ? 'empty'
        : 'ready';

  const evmDeployers = evmOnly + both;
  const crossover = getShare(both, evmOnly);

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold">Stylus vs Solidity</h2>
        <p className="text-sm text-muted-foreground">
          Contract deployments on Arbitrum since Stylus launched in September 2024
        </p>
      </div>

      <QueryErrorBoundary error={error ?? null} onRetry={() => refetch()}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {isLoading ? (
            <>
              <KpiCardSkeleton />
              <KpiCardSkeleton />
              <KpiCardSkeleton />
              <KpiCardSkeleton />
            </>
          ) : (
            <>
              <KpiCard
                title="WASM Share"
                value={share === null ? '-' : formatShare(share)}
                change={
                  trendShare === null
                    ? undefined
                    : `${SHARE_TREND_DAYS}d: ${formatShare(trendShare)}`
                }
              />
              <ComparisonKpiCard
                title="Total Contracts"
                stylus={formatNumber(stylusContracts)}
                evm={formatNumber(evmContracts)}
              />
              <ComparisonKpiCard
                title={`Deploys / day (${RECENT_DAYS}d avg)`}
                stylus={averages.stylus.toFixed(1)}
                evm={averages.evm.toFixed(1)}
              />
              <ComparisonKpiCard
                title="Deployers"
                stylus={formatNumber(stylusOnly + both)}
                evm={formatNumber(evmDeployers)}
              />
            </>
          )}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Deployer Overlap</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-lg">
              {crossover === null ? (
                'No deployers indexed yet.'
              ) : (
                <>
                  <span className="font-bold">{formatNumber(both)}</span> of{' '}
                  <span className="font-bold">{formatNumber(evmDeployers)}</span> EVM deployers have
                  also shipped a Stylus contract ({formatShare(crossover)}).
                </>
              )}
            </p>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Stylus only</p>
                <p className="text-xl font-semibold">{formatNumber(stylusOnly)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Both</p>
                <p className="text-xl font-semibold">{formatNumber(both)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">EVM only</p>
                <p className="text-xl font-semibold">{formatNumber(evmOnly)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex items-center justify-between gap-4">
            <CardTitle>Daily Deploys (logarithmic)</CardTitle>
            <PeriodToggle value={period} onChange={setPeriod} label="Daily deploys period" />
          </CardHeader>
          <CardContent>
            <ChartSlot state={chartState}>
              <DeployVolumeChart data={series} />
            </ChartSlot>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Share of Daily Deploys</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartSlot state={chartState}>
              <ShareAreaChart data={getSharePoints(series)} />
            </ChartSlot>
          </CardContent>
        </Card>
      </QueryErrorBoundary>
    </div>
  );
}
