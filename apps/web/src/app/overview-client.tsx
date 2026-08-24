'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { graphqlClient } from '@/lib/graphql/client';
import { GET_OVERVIEW_STATS } from '@/lib/graphql/queries';
import { KpiGrid } from '@/components/kpi-card';
import { PeriodToggle } from '@/components/period-toggle';
import { QueryErrorBoundary } from '@/components/query-error-boundary';
import { TimeSeriesChart } from '@/components/charts/time-series-chart';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { getActivationSeries, type ChartPeriod } from '@/lib/utils';
import type { OverviewData } from '@/types';

/** The KPI row and the daily table have always summarised the last 30 days. */
const RECENT_DAYS = 30;

export function OverviewClient({ initialData }: { initialData?: OverviewData }) {
  const [period, setPeriod] = useState<ChartPeriod>('30d');

  const { data, isLoading, error, refetch } = useQuery<OverviewData>({
    queryKey: ['overview'],
    queryFn: () => graphqlClient.request(GET_OVERVIEW_STATS),
    initialData: initialData,
    refetchInterval: 5000,
  });

  const contracts = data?.StylusContract ?? [];
  const dailyStats = data?.DailyStats ?? [];
  const recentStats = dailyStats.slice(0, RECENT_DAYS);

  const activationSeries = getActivationSeries(dailyStats, period, Math.floor(Date.now() / 1000));

  const kpis = [
    { title: 'Stylus Contracts', value: contracts.length },
    { title: 'Unique Deployers', value: new Set(contracts.map((c) => c.deployer)).size },
    { title: 'Activations', value: recentStats.reduce((sum, d) => sum + d.stylusActivations, 0) },
    {
      title: 'Reactivations',
      value: recentStats.reduce((sum, d) => sum + d.stylusReactivations, 0),
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold">Stylus Adoption Overview</h2>
        <p className="text-sm text-muted-foreground">
          Real-time Stylus ecosystem metrics from the indexer
        </p>
      </div>

      <QueryErrorBoundary error={error ?? null} onRetry={() => refetch()}>
      <KpiGrid kpis={kpis} isLoading={isLoading} />

      {/* Daily Activations */}
      <Card>
        <CardHeader className="flex items-center justify-between gap-4">
          <CardTitle>Daily Activations</CardTitle>
          <PeriodToggle value={period} onChange={setPeriod} label="Daily activations period" />
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground text-sm">Loading...</p>
          ) : activationSeries.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No activations indexed for this period.
            </p>
          ) : (
            <TimeSeriesChart data={activationSeries} />
          )}
        </CardContent>
      </Card>

      {/* Recent Stylus Contracts */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Stylus Contracts</CardTitle>
        </CardHeader>
        <CardContent>
          {contracts.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No Stylus contracts indexed yet. Run the seed script to generate activity.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-muted-foreground">
                    <th className="pb-2 pr-4">Contract</th>
                    <th className="pb-2 pr-4">Deployer</th>
                    <th className="pb-2 pr-4">Activated</th>
                    <th className="pb-2">Cached</th>
                  </tr>
                </thead>
                <tbody>
                  {contracts.slice(0, 10).map((c) => (
                    <tr key={c.id} className="border-b border-border/50">
                      <td className="py-2 pr-4 font-mono text-xs">
                        {c.id.slice(0, 10)}...{c.id.slice(-6)}
                      </td>
                      <td className="py-2 pr-4 font-mono text-xs">
                        {c.deployer.slice(0, 10)}...{c.deployer.slice(-4)}
                      </td>
                      <td className="py-2 pr-4 text-xs" suppressHydrationWarning>
                        {new Date(c.activatedAt * 1000).toLocaleString()}
                      </td>
                      <td className="py-2">
                        <span
                          role="img"
                          aria-label={c.isCached ? 'Cached' : 'Not cached'}
                          className={`inline-block h-2 w-2 rounded-full ${c.isCached ? 'bg-green-400' : 'bg-yellow-400'}`}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Daily Stats */}
      {recentStats.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Daily Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-muted-foreground">
                    <th className="pb-2 pr-4">Date</th>
                    <th className="pb-2 pr-4">Activations</th>
                    <th className="pb-2 pr-4">Reactivations</th>
                    <th className="pb-2 pr-4">Deployers</th>
                    <th className="pb-2">Total Contracts</th>
                  </tr>
                </thead>
                <tbody>
                  {recentStats.map((d) => (
                    <tr key={d.id} className="border-b border-border/50">
                      <td className="py-2 pr-4 font-medium">{d.id}</td>
                      <td className="py-2 pr-4">{d.stylusActivations}</td>
                      <td className="py-2 pr-4">{d.stylusReactivations}</td>
                      <td className="py-2 pr-4">{d.uniqueDeployers}</td>
                      <td className="py-2">{d.totalStylusContracts}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
      </QueryErrorBoundary>
    </div>
  );
}
