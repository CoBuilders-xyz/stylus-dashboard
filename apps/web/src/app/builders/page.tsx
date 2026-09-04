'use client';

import { useQuery } from '@tanstack/react-query';
import { graphqlClient } from '@/lib/graphql/client';
import { GET_BUILDER_GROWTH, GET_BUILDER_STATS } from '@/lib/graphql/queries';
import { KpiCard } from '@/components/kpi-card';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { formatPercent, getRatio, getRecentWindowStart, NEW_BUILDER_DAYS } from '@/lib/utils';
import { BuilderGrowthChart } from '@/components/charts/builder-growth-chart';
import type { BuilderGrowthData, BuilderStatsData } from '@/types';

/** Rows the leaderboard renders, and so rows the query asks for. */
const LEADERBOARD_LIMIT = 10;

/** Cumulative history moves once a day at most, so it doesn't need the 5s cadence. */
const GROWTH_REFETCH_MS = 60_000;

export default function BuildersPage() {
  const since = getRecentWindowStart(Math.floor(Date.now() / 1000), NEW_BUILDER_DAYS);

  const { data, isLoading, error } = useQuery<BuilderStatsData>({
    queryKey: ['builder-stats', since],
    queryFn: () => graphqlClient.request(GET_BUILDER_STATS, { since, limit: LEADERBOARD_LIMIT }),
    refetchInterval: 5000,
  });

  const { data: growth, isLoading: isGrowthLoading } = useQuery<BuilderGrowthData>({
    queryKey: ['builder-growth'],
    queryFn: () => graphqlClient.request(GET_BUILDER_GROWTH),
    refetchInterval: GROWTH_REFETCH_MS,
  });

  const leaderboard = data?.DeployerRegistry ?? [];
  const global = data?.GlobalStats[0];
  const uniqueDeployers = global?.cumulativeDeployers ?? 0;
  const totalContracts = data?.StylusContract_aggregate.aggregate.count ?? 0;
  const repeatBuilders = global?.repeatStylusDeployers ?? 0;
  const newThisWeek = (data?.DailyStats ?? []).reduce((sum, d) => sum + d.uniqueStylusDeployers, 0);

  const avgContracts = getRatio(totalContracts, uniqueDeployers);
  const avgContractsValue = avgContracts !== null ? avgContracts.toFixed(1) : '0.0';
  const retentionRate = getRatio(global?.retainedStylusDeployers ?? 0, uniqueDeployers);
  const retentionValue = retentionRate !== null ? formatPercent(retentionRate) : '-';

  const growthData = (growth?.DailyStats ?? []).map((d) => ({
    date: d.id,
    cumulativeDeployers: d.cumulativeDeployers,
  }));

  const truncateAddress = (address: string) => `${address.slice(0, 6)}...${address.slice(-4)}`;
  const formatDay = (timestamp: number | null) =>
    timestamp !== null ? new Date(timestamp * 1000).toLocaleDateString() : '-';

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold">Builder Metrics</h2>
        <p className="text-sm text-muted-foreground">
          Developer activity and growth in the Stylus ecosystem
        </p>
      </div>

      {error && (
        <div className="rounded border border-red-500/50 bg-red-500/10 p-4 text-red-600 dark:text-red-400">
          Failed to fetch data. Is the indexer running? ({String(error)})
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <KpiCard title="Unique Deployers" value={isLoading ? '...' : uniqueDeployers} />
        <KpiCard title="Avg Contracts/Deployer" value={isLoading ? '...' : avgContractsValue} />
        <KpiCard title="Repeat Builders" value={isLoading ? '...' : repeatBuilders} />
        <KpiCard title="New This Week" value={isLoading ? '...' : newThisWeek} />
        <KpiCard title="Retention (>1 week)" value={isLoading ? '...' : retentionValue} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Unique Deployers Over Time</CardTitle>
        </CardHeader>
        <CardContent>
          {growthData.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {isGrowthLoading ? 'Loading...' : 'No deployers indexed yet.'}
            </p>
          ) : (
            <BuilderGrowthChart data={growthData} />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Top Deployers</CardTitle>
        </CardHeader>
        <CardContent>
          {leaderboard.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {isLoading ? 'Loading...' : 'No deployers indexed yet.'}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-muted-foreground">
                    <th className="pb-2 pr-4">#</th>
                    <th className="pb-2 pr-4">Deployer</th>
                    <th className="pb-2 pr-4">Contracts</th>
                    <th className="pb-2 pr-4">First Deploy</th>
                    <th className="pb-2">Last Deploy</th>
                  </tr>
                </thead>
                <tbody>
                  {leaderboard.map((row, index) => (
                    <tr key={row.id} className="border-b border-border/50">
                      <td className="py-2 pr-4 text-muted-foreground">{index + 1}</td>
                      <td className="py-2 pr-4 font-mono text-xs">
                        <a
                          href={`https://arbiscan.io/address/${row.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline dark:text-blue-400"
                        >
                          {truncateAddress(row.id)}
                        </a>
                      </td>
                      <td className="py-2 pr-4">{row.stylusContractCount}</td>
                      <td className="py-2 pr-4 text-xs">{formatDay(row.firstStylusAt)}</td>
                      <td className="py-2 text-xs">{formatDay(row.lastStylusAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
