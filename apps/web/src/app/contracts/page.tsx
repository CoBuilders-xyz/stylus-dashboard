'use client';

import { useState } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { graphqlClient } from '@/lib/graphql/client';
import { GET_CONTRACTS } from '@/lib/graphql/queries';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { getContractStatus, type ContractStatus } from '@/lib/utils';

const PAGE_SIZE = 20;
const EXPIRING_SOON_WINDOW_SECONDS = 7 * 24 * 60 * 60;

const STATUS_COLORS: Record<ContractStatus, string> = {
  Active: 'var(--color-status-active)',
  Cached: 'var(--color-status-cached)',
  Expiring: 'var(--color-status-expiring)',
  Expired: 'var(--color-status-expired)',
};

type SortColumn = 'id' | 'deployer' | 'version' | 'activatedAt';
type SortDirection = 'asc' | 'desc';

const COLUMNS: { key: SortColumn; label: string }[] = [
  { key: 'id', label: 'Address' },
  { key: 'deployer', label: 'Deployer' },
  { key: 'version', label: 'Version' },
  { key: 'activatedAt', label: 'Date' },
];

interface ContractRow {
  id: string;
  deployer: string;
  version: number;
  activatedAt: number;
  isCached: boolean;
  expiresAt: number | null;
}

interface ContractsData {
  StylusContract: ContractRow[];
}

const truncateAddress = (address: string) => `${address.slice(0, 6)}...${address.slice(-4)}`;

export default function ContractsPage() {
  const [sortBy, setSortBy] = useState<SortColumn>('activatedAt');
  const [sortDir, setSortDir] = useState<SortDirection>('desc');
  const [offset, setOffset] = useState(0);

  const { data, isLoading, error } = useQuery<ContractsData>({
    queryKey: ['contracts', sortBy, sortDir, offset],
    queryFn: () =>
      graphqlClient.request(GET_CONTRACTS, {
        limit: PAGE_SIZE + 1,
        offset,
        orderBy: [{ [sortBy]: sortDir }],
      }),
    placeholderData: keepPreviousData,
  });

  const rows = data?.StylusContract ?? [];
  const hasNextPage = rows.length > PAGE_SIZE;
  const pageRows = rows.slice(0, PAGE_SIZE);
  const now = Math.floor(Date.now() / 1000);

  const handleSort = (column: SortColumn) => {
    setOffset(0);
    if (column === sortBy) {
      setSortDir((dir) => (dir === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(column);
      setSortDir('desc');
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold">Contract Activity</h2>
        <p className="text-sm text-muted-foreground">
          All Stylus contracts deployed on Arbitrum with activity metrics
        </p>
      </div>

      {error && (
        <div className="rounded border border-red-500/50 bg-red-500/10 p-4 text-red-600 dark:text-red-400">
          Failed to fetch data. Is the indexer running? ({String(error)})
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Active Contracts</CardTitle>
        </CardHeader>
        <CardContent>
          {pageRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {isLoading
                ? 'Loading...'
                : 'No Stylus contracts indexed yet. Run the seed script to generate activity.'}
            </p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-border text-muted-foreground">
                      {COLUMNS.map((col) => (
                        <th key={col.key} className="pb-3 pr-4 font-medium">
                          <button
                            type="button"
                            onClick={() => handleSort(col.key)}
                            className="inline-flex items-center gap-1 hover:text-foreground"
                          >
                            {col.label}
                            {sortBy === col.key && <span>{sortDir === 'asc' ? '▲' : '▼'}</span>}
                          </button>
                        </th>
                      ))}
                      <th className="pb-3 pr-4 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageRows.map((contract) => {
                      const status = getContractStatus(
                        contract.isCached,
                        contract.expiresAt,
                        now,
                        EXPIRING_SOON_WINDOW_SECONDS,
                      );
                      return (
                        <tr key={contract.id} className="border-b border-border/50">
                          <td className="py-2 pr-4 font-mono text-xs">
                            <a
                              href={`https://arbiscan.io/address/${contract.id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:underline dark:text-blue-400"
                            >
                              {truncateAddress(contract.id)}
                            </a>
                          </td>
                          <td className="py-2 pr-4 font-mono text-xs">
                            <a
                              href={`https://arbiscan.io/address/${contract.deployer}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:underline dark:text-blue-400"
                            >
                              {truncateAddress(contract.deployer)}
                            </a>
                          </td>
                          <td className="py-2 pr-4">{contract.version}</td>
                          <td className="py-2 pr-4 text-xs">
                            {new Date(contract.activatedAt * 1000).toLocaleDateString()}
                          </td>
                          <td className="py-2 pr-4">
                            <span className="inline-flex items-center gap-1.5">
                              <span
                                className="h-2 w-2 rounded-full"
                                style={{ backgroundColor: STATUS_COLORS[status] }}
                              />
                              {status}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="mt-4 flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  Showing {offset + 1}–{offset + pageRows.length}
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setOffset((o) => Math.max(0, o - PAGE_SIZE))}
                    disabled={offset === 0}
                    className="rounded-md border border-border px-3 py-1.5 hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    onClick={() => setOffset((o) => o + PAGE_SIZE)}
                    disabled={!hasNextPage}
                    className="rounded-md border border-border px-3 py-1.5 hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
