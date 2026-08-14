import { fetchOverviewStats } from '@/lib/graphql/server';
import { OverviewClient } from './overview-client';

export const dynamic = 'force-dynamic';

export default async function OverviewPage() {
  const initialData = await fetchOverviewStats();
  return <OverviewClient initialData={initialData} />;
}
