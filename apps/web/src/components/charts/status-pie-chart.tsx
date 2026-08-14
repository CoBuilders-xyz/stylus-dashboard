'use client';

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';

export interface StatusSlice {
  status: 'Active' | 'Expiring Soon' | 'Expired';
  count: number;
  color: string;
}

interface StatusPieChartProps {
  data: StatusSlice[];
  height?: number;
}

export function StatusPieChart({ data, height = 260 }: StatusPieChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie
          data={data}
          dataKey="count"
          nameKey="status"
          innerRadius="55%"
          outerRadius="80%"
          paddingAngle={2}
        >
          {data.map((slice) => (
            <Cell key={slice.status} fill={slice.color} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{
            backgroundColor: 'var(--color-card)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
          }}
        />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  );
}
