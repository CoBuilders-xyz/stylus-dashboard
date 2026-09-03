import { fetchComparisonStats } from '@/lib/graphql/server';
import { getRecentWindowStart } from '@/lib/utils';
import { ComparisonClient } from './comparison-client';

export const dynamic = 'force-dynamic';

export default async function ComparisonPage() {
  const initialData = await fetchComparisonStats(
    getRecentWindowStart(Math.floor(Date.now() / 1000)),
  );
  return <ComparisonClient initialData={initialData} />;
}
