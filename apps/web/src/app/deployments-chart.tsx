'use client';

import { TimeSeriesChart } from '@/components/charts/time-series-chart';

export function DeploymentsChart() {
  // TODO: Replace with real data from GraphQL query
  const placeholderData = [
    { date: 'Jan', value: 0 },
    { date: 'Feb', value: 0 },
    { date: 'Mar', value: 0 },
  ];

  return <TimeSeriesChart data={placeholderData} />;
}
