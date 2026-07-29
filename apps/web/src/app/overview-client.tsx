'use client';

import { useQuery } from '@tanstack/react-query';
import { graphqlClient } from '@/lib/graphql/client';
import { GET_OVERVIEW_STATS } from '@/lib/graphql/queries';
import { KpiCard } from '@/components/kpi-card';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import type { OverviewData } from '@/types';

export function OverviewClient({ initialData }: { initialData?: OverviewData }) {
  const { data, isLoading, error } = useQuery<OverviewData>({
    queryKey: ['overview'],
    queryFn: () => graphqlClient.request(GET_OVERVIEW_STATS),
    initialData: initialData,
    refetchInterval: 5000,
  });

  const contracts = data?.StylusContract ?? [];
  const dailyStats = data?.DailyStats ?? [];

  const totalContracts = contracts.length;
  const uniqueDeployers = new Set(contracts.map((c) => c.deployer)).size;
  const totalActivations = dailyStats.reduce((sum, d) => sum + d.stylusActivations, 0);
  const totalReactivations = dailyStats.reduce((sum, d) => sum + d.stylusReactivations, 0);

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold">Stylus Adoption Overview</h2>
        <p className="text-sm text-muted-foreground">
          Real-time Stylus ecosystem metrics from the indexer
        </p>
      </div>

      {error && (
        <div className="rounded border border-red-500/50 bg-red-500/10 p-4 text-red-400">
          Failed to fetch data. Is the indexer running? ({String(error)})
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard title="Stylus Contracts" value={isLoading ? '...' : totalContracts} />
        <KpiCard title="Unique Deployers" value={isLoading ? '...' : uniqueDeployers} />
        <KpiCard title="Activations" value={isLoading ? '...' : totalActivations} />
        <KpiCard title="Reactivations" value={isLoading ? '...' : totalReactivations} />
      </div>

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
      {dailyStats.length > 0 && (
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
                  {dailyStats.map((d) => (
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
    </div>
  );
}
