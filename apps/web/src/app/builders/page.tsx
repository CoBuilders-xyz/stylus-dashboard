'use client';

import { useQuery } from '@tanstack/react-query';
import { graphqlClient } from '@/lib/graphql/client';
import { GET_BUILDER_STATS } from '@/lib/graphql/queries';
import { KpiCard } from '@/components/kpi-card';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

interface BuilderContract {
  deployer: string;
  activatedAt: number;
}

interface BuilderStatsData {
  StylusContract: BuilderContract[];
}

interface DeployerRow {
  deployer: string;
  contractCount: number;
  firstDeploy: number;
  lastDeploy: number;
}

export default function BuildersPage() {
  const { data, isLoading, error } = useQuery<BuilderStatsData>({
    queryKey: ['builder-stats'],
    queryFn: () => graphqlClient.request(GET_BUILDER_STATS),
    refetchInterval: 5000,
  });

  const contracts = data?.StylusContract ?? [];

  const deployerMap = new Map<string, { contractCount: number; firstDeploy: number; lastDeploy: number }>();
  for (const c of contracts) {
    const existing = deployerMap.get(c.deployer);
    if (existing) {
      existing.contractCount += 1;
      if (c.activatedAt < existing.firstDeploy) existing.firstDeploy = c.activatedAt;
      if (c.activatedAt > existing.lastDeploy) existing.lastDeploy = c.activatedAt;
    } else {
      deployerMap.set(c.deployer, { contractCount: 1, firstDeploy: c.activatedAt, lastDeploy: c.activatedAt });
    }
  }

  const leaderboard: DeployerRow[] = Array.from(deployerMap.entries())
    .map(([deployer, stats]) => ({ deployer, ...stats }))
    .sort((a, b) => b.contractCount - a.contractCount);

  const uniqueDeployers = deployerMap.size;
  const totalContracts = contracts.length;
  const avgContractsPerDeployer = uniqueDeployers > 0 ? (totalContracts / uniqueDeployers).toFixed(1) : '0.0';
  const repeatBuilders = leaderboard.filter((d) => d.contractCount > 1).length;
  const sevenDaysAgo = Math.floor(Date.now() / 1000) - 7 * 24 * 60 * 60;
  const newThisWeek = leaderboard.filter((d) => d.firstDeploy >= sevenDaysAgo).length;

  const truncateAddress = (address: string) => `${address.slice(0, 6)}...${address.slice(-4)}`;

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold">Builder Metrics</h2>
        <p className="text-sm text-muted-foreground">
          Developer activity and growth in the Stylus ecosystem
        </p>
      </div>

      {error && (
        <div className="rounded border border-red-500/50 bg-red-500/10 p-4 text-red-400">
          Failed to fetch data. Is the indexer running? ({String(error)})
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard title="Unique Deployers" value={isLoading ? '...' : uniqueDeployers} />
        <KpiCard title="Avg Contracts/Deployer" value={isLoading ? '...' : avgContractsPerDeployer} />
        <KpiCard title="Repeat Builders" value={isLoading ? '...' : repeatBuilders} />
        <KpiCard title="New This Week" value={isLoading ? '...' : newThisWeek} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Unique Deployers Over Time</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Connect indexer to see builder growth chart
          </p>
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
                    <tr key={row.deployer} className="border-b border-border/50">
                      <td className="py-2 pr-4 text-muted-foreground">{index + 1}</td>
                      <td className="py-2 pr-4 font-mono text-xs">
                        <a
                          href={`https://arbiscan.io/address/${row.deployer}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-400 hover:underline"
                        >
                          {truncateAddress(row.deployer)}
                        </a>
                      </td>
                      <td className="py-2 pr-4">{row.contractCount}</td>
                      <td className="py-2 pr-4 text-xs">
                        {new Date(row.firstDeploy * 1000).toLocaleDateString()}
                      </td>
                      <td className="py-2 text-xs">
                        {new Date(row.lastDeploy * 1000).toLocaleDateString()}
                      </td>
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
