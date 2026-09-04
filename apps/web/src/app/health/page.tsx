'use client';

import { useQuery } from '@tanstack/react-query';
import { graphqlClient } from '@/lib/graphql/client';
import { GET_HEALTH_METRICS } from '@/lib/graphql/queries';
import { KpiCard } from '@/components/kpi-card';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { StatusPieChart, type StatusSlice } from '@/components/charts/status-pie-chart';
import { ExpiryHistogram } from '@/components/charts/expiry-histogram';
import {
  getExpiryBoundaries,
  getExpiryBreakdown,
  getRecentWindowStart,
  getReactivationRateTrend,
  formatPercent,
  REACTIVATION_DAYS,
} from '@/lib/utils';
import type { AggregateCount, HealthMetricsData } from '@/types';

export default function HealthPage() {
  // One clock for the whole render: the expiry edges round to the hour so the
  // poll keeps its cache key, the daily window rounds to the UTC day because
  // that is where DailyStats rows sit.
  const now = Math.floor(Date.now() / 1000);
  const boundaries = getExpiryBoundaries(now);
  const since = getRecentWindowStart(now, REACTIVATION_DAYS);

  const { data, isLoading, error } = useQuery<HealthMetricsData>({
    queryKey: ['health-metrics', boundaries.now, since],
    queryFn: () => graphqlClient.request(GET_HEALTH_METRICS, { ...boundaries, since }),
    refetchInterval: 5000,
  });

  const dailyStats = data?.DailyStats ?? [];
  const count = (bucket?: AggregateCount) => bucket?.aggregate.count ?? 0;
  const { active, expiringSoon, expired, total, buckets } = getExpiryBreakdown({
    expired: count(data?.expired),
    under7d: count(data?.under7d),
    from7to30d: count(data?.from7to30d),
    from30to90d: count(data?.from30to90d),
    from90to180d: count(data?.from90to180d),
    over180d: count(data?.over180d),
  });

  const { currentRate, changePoints } = getReactivationRateTrend(dailyStats, now);
  const reactivationValue = currentRate !== null ? formatPercent(currentRate) : '-';
  const reactivationChange =
    changePoints !== null
      ? `${changePoints >= 0 ? '+' : ''}${(changePoints * 100).toFixed(1)}pp vs prior 7d`
      : undefined;
  const reactivationChangeType =
    changePoints === null || changePoints === 0
      ? 'neutral'
      : changePoints > 0
        ? 'positive'
        : 'negative';

  const statusData: StatusSlice[] = [
    { status: 'Active', count: active, color: 'var(--color-status-active)' },
    { status: 'Expiring Soon', count: expiringSoon, color: 'var(--color-status-expiring)' },
    { status: 'Expired', count: expired, color: 'var(--color-status-expired)' },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold">Stylus Health</h2>
        <p className="text-sm text-muted-foreground">
          Activation status, cache occupancy, and contract expiration metrics
        </p>
      </div>

      {error && (
        <div className="rounded border border-red-500/50 bg-red-500/10 p-4 text-red-400">
          Failed to fetch data. Is the indexer running? ({String(error)})
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          title="Reactivation Rate"
          value={isLoading ? '...' : reactivationValue}
          change={reactivationChange}
          changeType={reactivationChangeType}
        />
        <KpiCard title="Avg Lifetime" value="-" />
        <KpiCard title="Cached Contracts" value="-" />
        <KpiCard title="Expiring Soon (7d)" value={isLoading ? '...' : expiringSoon} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Activation Status</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-sm text-muted-foreground">Loading...</p>
            ) : total === 0 ? (
              <p className="text-sm text-muted-foreground">
                No Stylus contracts indexed yet. Run the seed script to generate activity.
              </p>
            ) : (
              <>
                <StatusPieChart data={statusData} />
                <div className="mt-4 grid grid-cols-3 gap-2 text-center text-sm">
                  <div>
                    <p className="text-muted-foreground">Active</p>
                    <p className="font-semibold">{active}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Expiring Soon</p>
                    <p className="font-semibold">{expiringSoon}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Expired</p>
                    <p className="font-semibold">{expired}</p>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Time Until Expiry</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-sm text-muted-foreground">Loading...</p>
            ) : total === 0 ? (
              <p className="text-sm text-muted-foreground">
                No Stylus contracts indexed yet. Run the seed script to generate activity.
              </p>
            ) : (
              <ExpiryHistogram data={buckets} />
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Cache Events</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Connect indexer to see cache activity
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
