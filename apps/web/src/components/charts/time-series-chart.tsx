'use client';

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';

interface DataPoint {
  date: string;
  value: number;
  [key: string]: string | number;
}

interface TimeSeriesChartProps {
  data: DataPoint[];
  dataKey?: string;
  color?: string;
  height?: number;
}

export function TimeSeriesChart({
  data,
  dataKey = 'value',
  color = 'var(--color-stylus)',
  height = 300,
}: TimeSeriesChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
        <XAxis dataKey="date" stroke="var(--color-muted-foreground)" fontSize={12} />
        <YAxis stroke="var(--color-muted-foreground)" fontSize={12} />
        <Tooltip
          contentStyle={{
            backgroundColor: 'var(--color-card)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
          }}
        />
        {/* A line through a single point has no segment to draw, so show the
            point itself when that is all there is. */}
        <Line
          type="monotone"
          dataKey={dataKey}
          stroke={color}
          strokeWidth={2}
          dot={data.length === 1}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
