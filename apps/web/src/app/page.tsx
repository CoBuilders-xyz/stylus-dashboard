import { KpiCard } from '@/components/kpi-card';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { DeploymentsChart } from './deployments-chart';

export default function OverviewPage() {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold">Adoption Overview</h2>
        <p className="text-sm text-muted-foreground">
          Key metrics for Stylus ecosystem health on Arbitrum
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <KpiCard title="Total Stylus Contracts" value="-" />
        <KpiCard title="Active Contracts" value="-" />
        <KpiCard title="Total Deployers" value="-" />
        <KpiCard title="Activations" value="-" />
        <KpiCard title="Reactivations" value="-" />
        <KpiCard title="WASM Share" value="-" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Deployments Over Time</CardTitle>
        </CardHeader>
        <CardContent>
          <DeploymentsChart />
        </CardContent>
      </Card>
    </div>
  );
}
