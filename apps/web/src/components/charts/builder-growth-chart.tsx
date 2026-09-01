'use client';

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';

export interface BuilderGrowthPoint {
  date: string;
  cumulativeDeployers: number;
}

interface BuilderGrowthChartProps {
  data: BuilderGrowthPoint[];
  height?: number;
}

export function BuilderGrowthChart({ data, height = 300 }: BuilderGrowthChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
        <XAxis dataKey="date" stroke="var(--color-muted-foreground)" fontSize={12} />
        <YAxis allowDecimals={false} stroke="var(--color-muted-foreground)" fontSize={12} />
        <Tooltip
          contentStyle={{
            backgroundColor: 'var(--color-card)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
          }}
        />
        {/* An area over a single point has no segment to draw, so show the
            point itself when that is all there is. */}
        <Area
          type="monotone"
          dataKey="cumulativeDeployers"
          name="Unique Deployers"
          stroke="var(--color-stylus)"
          fill="var(--color-stylus)"
          fillOpacity={0.15}
          strokeWidth={2}
          dot={data.length === 1}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
