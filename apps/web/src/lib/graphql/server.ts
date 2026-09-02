import { graphqlClient } from './client';
import { GET_CONTRACTS, GET_OVERVIEW_STATS } from './queries';
import { contractsVariables, type ContractFilters } from '@/lib/contract-filters';
import type { ContractsData, OverviewData } from '@/types';

export async function fetchOverviewStats(since: number): Promise<OverviewData | undefined> {
  try {
    return await graphqlClient.request<OverviewData>(GET_OVERVIEW_STATS, { since });
  } catch (error) {
    console.error('[SSR] fetchOverviewStats failed:', error);
    return undefined;
  }
}

export async function fetchContracts(
  filters: ContractFilters,
  now: number,
): Promise<ContractsData | undefined> {
  try {
    return await graphqlClient.request<ContractsData>(
      GET_CONTRACTS,
      contractsVariables(filters, now),
    );
  } catch (error) {
    console.error('[SSR] fetchContracts failed:', error);
    return undefined;
  }
}
