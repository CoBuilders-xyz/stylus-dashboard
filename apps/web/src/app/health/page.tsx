'use client';

import { useQuery } from '@tanstack/react-query';
import { graphqlClient } from '@/lib/graphql/client';
import { GET_HEALTH_METRICS } from '@/lib/graphql/queries';
import { KpiCard } from '@/components/kpi-card';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { StatusPieChart, type StatusSlice } from '@/components/charts/status-pie-chart';
import { ExpiryHistogram, type ExpiryBucketCount } from '@/components/charts/expiry-histogram';
import { getExpiryStatus, getExpiryBucket, EXPIRY_BUCKET_ORDER, type ExpiryBucket } from '@/lib/utils';

const EXPIRING_SOON_WINDOW_SECONDS = 7 * 24 * 60 * 60;

interface StylusContract {
  id: string;
  isCached: boolean;
  activatedAt: number;
  expiresAt: number | null;
  lastKeepalive: number | null;
}

interface HealthMetricsData {
  StylusContract: StylusContract[];
}

export default function HealthPage() {
  const { data, isLoading, error } = useQuery<HealthMetricsData>({
    queryKey: ['health-metrics'],
    queryFn: () => graphqlClient.request(GET_HEALTH_METRICS),
    refetchInterval: 5000,
  });

  const contracts = data?.StylusContract ?? [];
  const now = Math.floor(Date.now() / 1000);

  let active = 0;
  let expiringSoon = 0;
  let expired = 0;

  const bucketCounts: Record<ExpiryBucket, number> = {
    Expired: 0,
    '<7d': 0,
    '7-30d': 0,
    '30-90d': 0,
    '90-180d': 0,
    '180d+': 0,
  };

  for (const c of contracts) {
    const status = getExpiryStatus(c.expiresAt, now, EXPIRING_SOON_WINDOW_SECONDS);
    if (status === 'expired') expired += 1;
    else if (status === 'expiring-soon') expiringSoon += 1;
    else active += 1;

    bucketCounts[getExpiryBucket(c.expiresAt, now)] += 1;
  }

  const statusData: StatusSlice[] = [
    { status: 'Active', count: active, color: 'var(--color-status-active)' },
    { status: 'Expiring Soon', count: expiringSoon, color: 'var(--color-status-expiring)' },
    { status: 'Expired', count: expired, color: 'var(--color-status-expired)' },
  ];

  const expiryHistogramData: ExpiryBucketCount[] = EXPIRY_BUCKET_ORDER.map((bucket) => ({
    bucket,
    count: bucketCounts[bucket],
  }));

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
        <KpiCard title="Reactivation Rate" value="-" />
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
            ) : contracts.length === 0 ? (
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
            ) : contracts.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No Stylus contracts indexed yet. Run the seed script to generate activity.
              </p>
            ) : (
              <ExpiryHistogram data={expiryHistogramData} />
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
