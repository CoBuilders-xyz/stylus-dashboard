export const CONTRACT_STATUSES = ['active', 'cached', 'expiring', 'expired'] as const;
export type ContractStatusFilter = (typeof CONTRACT_STATUSES)[number];

export const SORT_COLUMNS = ['id', 'deployer', 'version', 'activatedAt'] as const;
export type SortColumn = (typeof SORT_COLUMNS)[number];
export type SortDirection = 'asc' | 'desc';

export const CONTRACTS_PAGE_SIZE = 20;

/** A contract is Expiring this many seconds before its expiry. */
export const EXPIRING_SOON_WINDOW_SECONDS = 7 * 24 * 60 * 60;

const DEFAULT_SORT: SortColumn = 'activatedAt';
const DEFAULT_DIR: SortDirection = 'desc';

const ADDRESS_PATTERN = /^0x[0-9a-fA-F]{40}$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const DAY_SECONDS = 24 * 60 * 60;

export interface ContractFilters {
  status: ContractStatusFilter[];
  deployer: string | null;
  /** Calendar days, as the date inputs and the URL carry them. */
  from: string | null;
  to: string | null;
  page: number;
  sort: SortColumn;
  dir: SortDirection;
}

export const EMPTY_FILTERS: ContractFilters = {
  status: [],
  deployer: null,
  from: null,
  to: null,
  page: 1,
  sort: DEFAULT_SORT,
  dir: DEFAULT_DIR,
};

interface Comparison {
  _eq?: string | boolean;
  _lt?: number;
  _lte?: number;
  _gt?: number;
  _gte?: number;
  _is_null?: boolean;
}

export interface ContractsWhere {
  _and?: ContractsWhere[];
  _or?: ContractsWhere[];
  deployer?: Comparison;
  activatedAt?: Comparison;
  expiresAt?: Comparison;
  isCached?: Comparison;
}

/** Next hands searchParams over as a plain object, with repeated keys as arrays. */
export function toSearchParams(
  input: Record<string, string | string[] | undefined>,
): URLSearchParams {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(input)) {
    if (typeof value === 'string') params.set(key, value);
    else if (Array.isArray(value) && value.length > 0) params.set(key, value[0]);
  }
  return params;
}

// Every param falls back to its default when it is missing or malformed, so a
// hand-edited URL degrades into a wider search instead of an error page.
export function parseContractFilters(params: URLSearchParams): ContractFilters {
  return {
    status: parseStatus(params.get('status')),
    deployer: parseDeployer(params.get('deployer')),
    from: parseDay(params.get('from')),
    to: parseDay(params.get('to')),
    page: parsePage(params.get('page')),
    sort: pick(SORT_COLUMNS, params.get('sort'), DEFAULT_SORT),
    dir: pick(['asc', 'desc'] as const, params.get('dir'), DEFAULT_DIR),
  };
}

/** Defaults are left out so a shared link only carries what was actually set. */
export function serializeContractFilters(filters: ContractFilters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.status.length > 0) params.set('status', filters.status.join(','));
  if (filters.deployer) params.set('deployer', filters.deployer);
  if (filters.from) params.set('from', filters.from);
  if (filters.to) params.set('to', filters.to);
  if (filters.page > 1) params.set('page', String(filters.page));
  if (filters.sort !== DEFAULT_SORT) params.set('sort', filters.sort);
  if (filters.dir !== DEFAULT_DIR) params.set('dir', filters.dir);
  return params;
}

export function filtersOffset(filters: ContractFilters): number {
  return (filters.page - 1) * CONTRACTS_PAGE_SIZE;
}

export function filtersOrderBy(filters: ContractFilters): Record<string, SortDirection>[] {
  return [{ [filters.sort]: filters.dir }];
}

// Status is a function of the clock rather than a column, so each one becomes a
// predicate over expiresAt and isCached. The four partition the table: asking
// for all of them is the same as not filtering by status at all.
export function buildContractsWhere(filters: ContractFilters, now: number): ContractsWhere {
  const clauses: ContractsWhere[] = [];

  if (filters.deployer) clauses.push({ deployer: { _eq: filters.deployer } });

  const from = dayStart(filters.from);
  if (from !== null) clauses.push({ activatedAt: { _gte: from } });

  const to = dayStart(filters.to);
  if (to !== null) clauses.push({ activatedAt: { _lt: to + DAY_SECONDS } });

  if (filters.status.length > 0) {
    clauses.push({ _or: filters.status.map((status) => statusPredicate(status, now)) });
  }

  return clauses.length > 0 ? { _and: clauses } : {};
}

function statusPredicate(status: ContractStatusFilter, now: number): ContractsWhere {
  const soon = now + EXPIRING_SOON_WINDOW_SECONDS;
  // A null expiresAt has no expiry set yet, so it is neither expired nor
  // expiring and has to be claimed explicitly by the two live states.
  const live: ContractsWhere[] = [{ expiresAt: { _is_null: true } }, { expiresAt: { _gt: soon } }];

  switch (status) {
    case 'expired':
      return { expiresAt: { _lt: now } };
    case 'expiring':
      return { expiresAt: { _gte: now, _lte: soon } };
    case 'cached':
      return { isCached: { _eq: true }, _or: live };
    case 'active':
      return { isCached: { _eq: false }, _or: live };
  }
}

function parseStatus(raw: string | null): ContractStatusFilter[] {
  if (!raw) return [];
  const wanted = new Set(raw.split(','));
  return CONTRACT_STATUSES.filter((status) => wanted.has(status));
}

function parseDeployer(raw: string | null): string | null {
  const trimmed = raw?.trim() ?? '';
  return ADDRESS_PATTERN.test(trimmed) ? trimmed.toLowerCase() : null;
}

function parseDay(raw: string | null): string | null {
  if (!raw || !DATE_PATTERN.test(raw)) return null;
  // Rejects days that match the shape but do not exist, like 2026-02-31.
  return new Date(`${raw}T00:00:00Z`).toISOString().startsWith(raw) ? raw : null;
}

function parsePage(raw: string | null): number {
  const page = Number(raw);
  return Number.isInteger(page) && page > 0 ? page : 1;
}

function pick<T extends string>(allowed: readonly T[], raw: string | null, fallback: T): T {
  return allowed.find((value) => value === raw) ?? fallback;
}

/** Days are read as UTC on both sides so SSR and the client agree on the window. */
function dayStart(day: string | null): number | null {
  return day === null ? null : Date.parse(`${day}T00:00:00Z`) / 1000;
}
