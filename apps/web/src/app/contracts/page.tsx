import { fetchContracts } from '@/lib/graphql/server';
import { parseContractFilters, toSearchParams } from '@/lib/contract-filters';
import { ContractsClient } from './contracts-client';

export const dynamic = 'force-dynamic';

export default async function ContractsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const filters = parseContractFilters(toSearchParams(await searchParams));
  const now = Math.floor(Date.now() / 1000);
  const initialData = await fetchContracts(filters, now);

  return <ContractsClient filters={filters} initialData={initialData} />;
}
