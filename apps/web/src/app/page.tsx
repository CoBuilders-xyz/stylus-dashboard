import { fetchOverviewStats } from '@/lib/graphql/server';
import { getRecentWindowStart } from '@/lib/utils';
import { OverviewClient } from './overview-client';

export const dynamic = 'force-dynamic';

export default async function OverviewPage() {
  const since = getRecentWindowStart(Math.floor(Date.now() / 1000));
  const initialData = await fetchOverviewStats(since);
  return <OverviewClient initialData={initialData} />;
}
