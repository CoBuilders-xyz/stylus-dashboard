import { Card, CardTitle } from '@/components/ui/card';

interface KpiCardProps {
  title: string;
  value: string | number;
  change?: string;
  changeType?: 'positive' | 'negative' | 'neutral';
}

export function KpiGrid({
  kpis,
  isLoading,
}: {
  kpis: KpiCardProps[];
  isLoading: boolean;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {kpis.map((kpi, i) =>
        isLoading ? <KpiCardSkeleton key={i} /> : <KpiCard key={kpi.title} {...kpi} />,
      )}
    </div>
  );
}

export function KpiCard({ title, value, change, changeType = 'neutral' }: KpiCardProps) {
  const changeColor = {
    positive: 'text-green-400',
    negative: 'text-red-400',
    neutral: 'text-muted-foreground',
  }[changeType];

  return (
    <Card>
      <CardTitle>{title}</CardTitle>
      <p className="mt-2 text-3xl font-bold">{value}</p>
      {change && <p className={`mt-1 text-xs ${changeColor}`}>{change}</p>}
    </Card>
  );
}

export function KpiCardSkeleton() {
  return (
    <Card>
      <div className="h-4 w-1/2 animate-pulse rounded bg-muted" />
      <div className="mt-2 h-8 w-2/3 animate-pulse rounded bg-muted" />
      <div className="mt-1 h-3 w-1/3 animate-pulse rounded bg-muted" />
    </Card>
  );
}
