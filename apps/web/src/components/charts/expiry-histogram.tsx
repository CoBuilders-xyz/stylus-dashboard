'use client';

import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { ExpiryBucket } from '@/lib/utils';

export interface ExpiryBucketCount {
  bucket: ExpiryBucket;
  count: number;
}

const AT_RISK_COLORS: Partial<Record<ExpiryBucket, string>> = {
  Expired: 'var(--color-status-expired)',
  '<7d': 'var(--color-status-expiring)',
};

const DEFAULT_BAR_COLOR = 'var(--color-primary)';

interface ExpiryHistogramProps {
  data: ExpiryBucketCount[];
  height?: number;
}

export function ExpiryHistogram({ data, height = 260 }: ExpiryHistogramProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
        <XAxis
          dataKey="bucket"
          tick={{ fill: 'var(--color-muted-foreground)', fontSize: 12 }}
          axisLine={{ stroke: 'var(--color-border)' }}
          tickLine={false}
        />
        <YAxis
          allowDecimals={false}
          tick={{ fill: 'var(--color-muted-foreground)', fontSize: 12 }}
          axisLine={{ stroke: 'var(--color-border)' }}
          tickLine={false}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: 'var(--color-card)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
          }}
        />
        <Bar dataKey="count" radius={[4, 4, 0, 0]}>
          {data.map((entry) => (
            <Cell key={entry.bucket} fill={AT_RISK_COLORS[entry.bucket] ?? DEFAULT_BAR_COLOR} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
