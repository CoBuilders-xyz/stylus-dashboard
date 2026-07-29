import { graphqlClient } from './client';
import { GET_OVERVIEW_STATS } from './queries';
import type { OverviewData } from '@/types';

export async function fetchOverviewStats(): Promise<OverviewData | undefined> {
  try {
    return await graphqlClient.request<OverviewData>(GET_OVERVIEW_STATS);
  } catch (error) {
    console.error('[SSR] fetchOverviewStats failed:', error);
    return undefined;
  }
}
