import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { KpiCard } from '@/components/kpi-card';

export default function BuildersPage() {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold">Builder Metrics</h2>
        <p className="text-sm text-muted-foreground">
          Developer activity and growth in the Stylus ecosystem
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard title="Unique Deployers" value="-" />
        <KpiCard title="Avg Contracts/Deployer" value="-" />
        <KpiCard title="Repeat Builders" value="-" />
        <KpiCard title="New This Week" value="-" />
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
          <p className="text-sm text-muted-foreground">
            Connect indexer to see top deployers
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
