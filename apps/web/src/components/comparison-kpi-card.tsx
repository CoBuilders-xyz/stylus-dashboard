import { Card, CardTitle } from '@/components/ui/card';

interface ComparisonKpiCardProps {
  title: string;
  stylus: string;
  evm: string;
}

export function ComparisonKpiCard({ title, stylus, evm }: ComparisonKpiCardProps) {
  return (
    <Card>
      <CardTitle>{title}</CardTitle>
      <div className="mt-2 flex items-baseline gap-2">
        <p className="text-3xl font-bold text-[var(--color-stylus)]">{stylus}</p>
        <span className="text-muted-foreground">/</span>
        <p className="text-xl font-semibold text-[var(--color-solidity)]">{evm}</p>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">Stylus / EVM</p>
    </Card>
  );
}
