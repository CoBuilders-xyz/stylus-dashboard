'use client';

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import type { DeployPoint } from '@/lib/comparison';

interface DeployVolumeChartProps {
  data: DeployPoint[];
  height?: number;
}

// EVM deployments outnumber Stylus activations by orders of magnitude, so a
// linear axis draws Stylus flat against the bottom. log(0) has no point to
// draw, so a day with no deploys becomes a break in that line.
const plotted = (value: number) => (value === 0 ? null : value);

export function DeployVolumeChart({ data, height = 300 }: DeployVolumeChartProps) {
  const points = data.map((point) => ({
    date: point.date,
    stylus: plotted(point.stylus),
    evm: plotted(point.evm),
  }));

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={points} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
        <XAxis dataKey="date" stroke="var(--color-muted-foreground)" fontSize={12} />
        <YAxis
          scale="log"
          domain={[1, 'auto']}
          allowDataOverflow
          stroke="var(--color-muted-foreground)"
          fontSize={12}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: 'var(--color-card)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
          }}
        />
        <Legend />
        {/* Quiet days drop out of a log axis, so a day between two of them has
            no segment to draw. The dots are what make those days visible, and
            Recharts only paints them once the entry animation ends, which the
            5-second poll keeps restarting. */}
        <Line
          type="monotone"
          name="Stylus"
          dataKey="stylus"
          stroke="var(--color-stylus)"
          strokeWidth={2}
          dot={{ r: 2 }}
          isAnimationActive={false}
          connectNulls={false}
        />
        <Line
          type="monotone"
          name="EVM"
          dataKey="evm"
          stroke="var(--color-solidity)"
          strokeWidth={2}
          dot={{ r: 2 }}
          isAnimationActive={false}
          connectNulls={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
