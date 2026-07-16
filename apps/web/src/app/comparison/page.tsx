import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

export default function ComparisonPage() {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold">Stylus vs Solidity</h2>
        <p className="text-sm text-muted-foreground">
          Compare Stylus (WASM) adoption against EVM (Solidity) activity on Arbitrum
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>🚧 Pending Implementation</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <p>
            This section requires a <strong>backend EVM deployment tracker</strong> that indexes
            all contract creations and classifies them by bytecode prefix.
          </p>
          <p>See the following issues to contribute:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>EVM deployment indexer service</li>
            <li>Comparison API endpoint</li>
            <li>Deployment share visualization</li>
            <li>Time-series comparison charts</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
