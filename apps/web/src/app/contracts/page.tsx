import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

export default function ContractsPage() {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold">Contract Activity</h2>
        <p className="text-sm text-muted-foreground">
          All Stylus contracts deployed on Arbitrum with activity metrics
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Active Contracts</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="pb-3 pr-4 font-medium">Contract</th>
                  <th className="pb-3 pr-4 font-medium">Chain</th>
                  <th className="pb-3 pr-4 font-medium">Deployer</th>
                  <th className="pb-3 pr-4 font-medium">Deploy Date</th>
                  <th className="pb-3 pr-4 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="py-4 text-muted-foreground" colSpan={5}>
                    Connect indexer to see contract data
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
