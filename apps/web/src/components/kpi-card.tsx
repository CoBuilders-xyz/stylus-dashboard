import { Card, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface KpiCardProps {
  title: string;
  value: string | number;
  change?: string;
  changeType?: 'positive' | 'negative' | 'neutral';
}

// Below `sm` the cards scroll horizontally instead of stacking, so four KPIs
// don't push the chart below them off the first screen on a phone.
export function KpiRow({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        '-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2',
        'sm:mx-0 sm:grid sm:overflow-visible sm:px-0 sm:pb-0',
        className,
      )}
    >
      {children}
    </div>
  );
}

export function KpiRowItem({ children }: { children: React.ReactNode }) {
  return <div className="w-56 shrink-0 snap-start sm:w-auto sm:shrink">{children}</div>;
}

export function KpiGrid({
  kpis,
  isLoading,
}: {
  kpis: KpiCardProps[];
  isLoading: boolean;
}) {
  return (
    <KpiRow className="sm:grid-cols-2 lg:grid-cols-4">
      {kpis.map((kpi, i) => (
        <KpiRowItem key={kpi.title ?? i}>
          {isLoading ? <KpiCardSkeleton /> : <KpiCard {...kpi} />}
        </KpiRowItem>
      ))}
    </KpiRow>
  );
}

export function KpiCard({ title, value, change, changeType = 'neutral' }: KpiCardProps) {
  const changeColor = {
    positive: 'text-green-600 dark:text-green-400',
    negative: 'text-red-600 dark:text-red-400',
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
    <Card data-testid="kpi-skeleton">
      <div className="h-4 w-1/2 animate-pulse rounded bg-muted" />
      <div className="mt-2 h-8 w-2/3 animate-pulse rounded bg-muted" />
      <div className="mt-1 h-3 w-1/3 animate-pulse rounded bg-muted" />
    </Card>
  );
}
