import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

export default function ComparisonPage() {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold">Stylus vs Solidity</h2>
        <p className="text-sm text-muted-foreground">
          Compare Stylus adoption against Solidity activity on Arbitrum
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Comparison Metrics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="pb-3 pr-4 font-medium">Metric</th>
                  <th className="pb-3 pr-4 font-medium text-stylus">Stylus</th>
                  <th className="pb-3 pr-4 font-medium text-solidity">Solidity</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                <tr>
                  <td className="py-3 pr-4">Deployments/day</td>
                  <td className="py-3 pr-4">-</td>
                  <td className="py-3 pr-4">-</td>
                </tr>
                <tr>
                  <td className="py-3 pr-4">Active contracts</td>
                  <td className="py-3 pr-4">-</td>
                  <td className="py-3 pr-4">-</td>
                </tr>
                <tr>
                  <td className="py-3 pr-4">Daily transactions</td>
                  <td className="py-3 pr-4">-</td>
                  <td className="py-3 pr-4">-</td>
                </tr>
                <tr>
                  <td className="py-3 pr-4">Unique deployers</td>
                  <td className="py-3 pr-4">-</td>
                  <td className="py-3 pr-4">-</td>
                </tr>
                <tr>
                  <td className="py-3 pr-4">New deployers/day</td>
                  <td className="py-3 pr-4">-</td>
                  <td className="py-3 pr-4">-</td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Deployments Over Time (Comparison)</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Connect indexer and HyperSync API to see comparison charts
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
