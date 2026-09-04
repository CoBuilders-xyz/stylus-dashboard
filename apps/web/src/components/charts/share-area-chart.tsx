'use client';

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import type { DeployPoint } from '@/lib/comparison';
import { formatShare } from '@/lib/utils';

interface ShareAreaChartProps {
  /** Percentages that add up to 100 per day, from getSharePoints. */
  data: DeployPoint[];
  height?: number;
}

export function ShareAreaChart({ data, height = 300 }: ShareAreaChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
        <XAxis dataKey="date" stroke="var(--color-muted-foreground)" fontSize={12} />
        <YAxis
          domain={[0, 100]}
          tickFormatter={(value: number) => `${value}%`}
          stroke="var(--color-muted-foreground)"
          fontSize={12}
        />
        <Tooltip
          formatter={(value: number) => formatShare(value / 100)}
          contentStyle={{
            backgroundColor: 'var(--color-card)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
          }}
        />
        <Legend />
        {/* An area over a single point has no segment to draw, so show the
            point itself when that is all there is. The animation is off for the
            same reason as the volume chart: the 5-second poll restarts it, and
            the band spends that time growing back from zero. */}
        <Area
          type="monotone"
          name="Stylus"
          dataKey="stylus"
          stackId="share"
          stroke="var(--color-stylus)"
          fill="var(--color-stylus)"
          fillOpacity={0.8}
          strokeWidth={2}
          dot={data.length === 1}
          isAnimationActive={false}
        />
        <Area
          type="monotone"
          name="EVM"
          dataKey="evm"
          stackId="share"
          stroke="var(--color-solidity)"
          fill="var(--color-solidity)"
          fillOpacity={0.2}
          strokeWidth={2}
          dot={data.length === 1}
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
