'use client';

import { cn, CHART_PERIODS, type ChartPeriod } from '@/lib/utils';

interface PeriodToggleProps {
  value: ChartPeriod;
  onChange: (period: ChartPeriod) => void;
  label: string;
}

export function PeriodToggle({ value, onChange, label }: PeriodToggleProps) {
  return (
    <div
      role="group"
      aria-label={label}
      className="flex shrink-0 gap-0.5 rounded-md border border-border p-0.5"
    >
      {CHART_PERIODS.map((period) => (
        <button
          key={period}
          type="button"
          aria-pressed={value === period}
          onClick={() => onChange(period)}
          className={cn(
            'rounded px-2.5 py-1 text-xs font-medium transition-colors',
            value === period
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {period === 'all' ? 'All' : period}
        </button>
      ))}
    </div>
  );
}
