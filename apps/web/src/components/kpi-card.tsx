import { Card, CardTitle } from '@/components/ui/card';

interface KpiCardProps {
  title: string;
  value: string | number;
  change?: string;
  changeType?: 'positive' | 'negative' | 'neutral';
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
