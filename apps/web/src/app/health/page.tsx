import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { KpiCard } from '@/components/kpi-card';

export default function HealthPage() {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold">Stylus Health</h2>
        <p className="text-sm text-muted-foreground">
          Activation status, cache occupancy, and contract expiration metrics
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard title="Reactivation Rate" value="-" />
        <KpiCard title="Avg Lifetime" value="-" />
        <KpiCard title="Cached Contracts" value="-" />
        <KpiCard title="Expiring Soon (7d)" value="-" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Activation Status</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Pie chart: Activated / Expired / Pending / Inactive
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Time Until Expiry</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Histogram: 0-1d / 1-3d / 3-7d / 7-30d / 30d+
            </p>
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
