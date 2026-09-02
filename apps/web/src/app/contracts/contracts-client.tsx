'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { graphqlClient } from '@/lib/graphql/client';
import { GET_CONTRACTS } from '@/lib/graphql/queries';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { QueryErrorBoundary } from '@/components/query-error-boundary';
import {
  contractsVariables,
  CONTRACT_STATUSES,
  CONTRACTS_PAGE_SIZE,
  EMPTY_FILTERS,
  EXPIRING_SOON_WINDOW_SECONDS,
  filtersOffset,
  normalizeDeployer,
  filtersQuery,
  SORT_COLUMNS,
  type ContractFilters,
  type ContractStatusFilter,
  type SortColumn,
} from '@/lib/contract-filters';
import { cn, formatDay, getContractStatus, type ContractStatus } from '@/lib/utils';
import type { ContractsData } from '@/types';

/** Long enough that typing an address writes the URL once, not forty times. */
const DEPLOYER_DEBOUNCE_MS = 400;

// Every filter change already goes through the server, which renders the page
// with the rows for the new URL. Without this the client would immediately ask
// for them a second time.
const SERVER_RENDER_STALE_MS = 30_000;

const STATUS_COLORS: Record<ContractStatus, string> = {
  Active: 'var(--color-status-active)',
  Cached: 'var(--color-status-cached)',
  Expiring: 'var(--color-status-expiring)',
  Expired: 'var(--color-status-expired)',
};

const STATUS_LABELS: Record<ContractStatusFilter, string> = {
  active: 'Active',
  cached: 'Cached',
  expiring: 'Expiring',
  expired: 'Expired',
};

const COLUMN_LABELS: Record<SortColumn, string> = {
  id: 'Address',
  deployer: 'Deployer',
  version: 'Version',
  activatedAt: 'Date',
};

const truncateAddress = (address: string) => `${address.slice(0, 6)}...${address.slice(-4)}`;

interface ContractsClientProps {
  filters: ContractFilters;
  initialData?: ContractsData;
}

export function ContractsClient({ filters, initialData }: ContractsClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const query = filtersQuery(filters);

  const { data, isLoading, error, refetch } = useQuery<ContractsData>({
    queryKey: ['contracts', query],
    // The clock lives here and not in the key: in the key it would change on
    // every render and the query would refetch itself forever.
    queryFn: () => graphqlClient.request(GET_CONTRACTS, contractsVariables(filters, nowSeconds())),
    initialData,
    staleTime: SERVER_RENDER_STALE_MS,
  });

  const rows = data?.StylusContract ?? [];
  const total = data?.StylusContract_aggregate.aggregate.count ?? 0;
  const offset = filtersOffset(filters);
  const now = nowSeconds();

  const apply = (changes: Partial<ContractFilters>) => {
    const next = filtersQuery({ ...filters, ...changes });
    router.replace(next ? `${pathname}?${next}` : pathname, { scroll: false });
  };

  // Any narrowing of the result set starts over at the first page, otherwise
  // page 4 of the old search lands on an empty page of the new one.
  const filterBy = (changes: Partial<ContractFilters>) => apply({ ...changes, page: 1 });

  const sortBy = (column: SortColumn) => {
    const dir = column === filters.sort && filters.dir === 'desc' ? 'asc' : 'desc';
    filterBy({ sort: column, dir });
  };

  const toggleStatus = (status: ContractStatusFilter) => {
    const selected = filters.status.includes(status)
      ? filters.status.filter((current) => current !== status)
      : [...filters.status, status];
    filterBy({ status: selected });
  };

  const hasFilters = Boolean(
    filters.status.length > 0 || filters.deployer || filters.from || filters.to,
  );

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold">Contract Activity</h2>
        <p className="text-sm text-muted-foreground">
          All Stylus contracts deployed on Arbitrum with activity metrics
        </p>
      </div>

      <QueryErrorBoundary error={error} onRetry={() => refetch()}>
        <Card>
          <CardHeader>
            <CardTitle>Active Contracts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-6 flex flex-wrap items-end gap-4">
              <div className="flex flex-col gap-1.5">
                <span className="text-xs text-muted-foreground">Status</span>
                <div
                  role="group"
                  aria-label="Status"
                  className="flex gap-0.5 rounded-md border border-border p-0.5"
                >
                  {CONTRACT_STATUSES.map((status) => (
                    <button
                      key={status}
                      type="button"
                      aria-pressed={filters.status.includes(status)}
                      onClick={() => toggleStatus(status)}
                      className={cn(
                        'rounded px-2.5 py-1 text-xs font-medium transition-colors',
                        filters.status.includes(status)
                          ? 'bg-primary text-primary-foreground'
                          : 'text-muted-foreground hover:text-foreground',
                      )}
                    >
                      {STATUS_LABELS[status]}
                    </button>
                  ))}
                </div>
              </div>

              <DeployerInput
                value={filters.deployer ?? ''}
                onCommit={(deployer) => filterBy({ deployer })}
              />

              <DayInput label="From" value={filters.from} onChange={(from) => filterBy({ from })} />
              <DayInput label="To" value={filters.to} onChange={(to) => filterBy({ to })} />

              {hasFilters && (
                <button
                  type="button"
                  onClick={() => apply(EMPTY_FILTERS)}
                  className="py-1.5 text-xs text-muted-foreground hover:text-foreground"
                >
                  Clear filters
                </button>
              )}
            </div>

            {rows.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {isLoading
                  ? 'Loading...'
                  : hasFilters
                    ? 'No contracts match these filters.'
                    : 'No Stylus contracts indexed yet. Run the seed script to generate activity.'}
              </p>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-border text-muted-foreground">
                        {SORT_COLUMNS.map((column) => (
                          <th key={column} className="pb-3 pr-4 font-medium">
                            <button
                              type="button"
                              onClick={() => sortBy(column)}
                              className="inline-flex items-center gap-1 hover:text-foreground"
                            >
                              {COLUMN_LABELS[column]}
                              {filters.sort === column && (
                                <span>{filters.dir === 'asc' ? '▲' : '▼'}</span>
                              )}
                            </button>
                          </th>
                        ))}
                        <th className="pb-3 pr-4 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((contract) => {
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
                            <td className="py-2 pr-4 text-xs">{formatDay(contract.activatedAt)}</td>
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
                    Showing {offset + 1}–{offset + rows.length} of {total}
                  </span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => apply({ page: filters.page - 1 })}
                      disabled={filters.page === 1}
                      className="rounded-md border border-border px-3 py-1.5 hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Previous
                    </button>
                    <button
                      type="button"
                      onClick={() => apply({ page: filters.page + 1 })}
                      disabled={offset + CONTRACTS_PAGE_SIZE >= total}
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
      </QueryErrorBoundary>
    </div>
  );
}

const FIELD_CLASS =
  'rounded-md border border-border bg-transparent px-2.5 py-1 text-xs text-foreground';

// Keeps what was typed while it is still half an address, and only touches the
// URL once the text is a whole one or the box is emptied again.
function DeployerInput({
  value,
  onCommit,
}: {
  value: string;
  onCommit: (deployer: string | null) => void;
}) {
  const [text, setText] = useState(value);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => setText(value), [value]);
  useEffect(() => () => clearTimeout(timer.current), []);

  const change = (next: string) => {
    setText(next);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const deployer = normalizeDeployer(next);
      if (deployer) onCommit(deployer);
      else if (next.trim() === '') onCommit(null);
    }, DEPLOYER_DEBOUNCE_MS);
  };

  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs text-muted-foreground">Deployer</span>
      <input
        type="text"
        value={text}
        onChange={(event) => change(event.target.value)}
        placeholder="0x..."
        spellCheck={false}
        className={cn(FIELD_CLASS, 'w-64 font-mono')}
      />
    </label>
  );
}

function DayInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string | null;
  onChange: (day: string | null) => void;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <input
        type="date"
        value={value ?? ''}
        onChange={(event) => onChange(event.target.value || null)}
        className={FIELD_CLASS}
      />
    </label>
  );
}

function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}
