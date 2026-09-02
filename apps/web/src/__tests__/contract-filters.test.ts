import { describe, it, expect } from 'vitest';
import {
  buildContractsWhere,
  CONTRACT_STATUSES,
  CONTRACTS_PAGE_SIZE,
  EMPTY_FILTERS,
  EXPIRING_SOON_WINDOW_SECONDS,
  contractsVariables,
  filtersOffset,
  parseContractFilters,
  serializeContractFilters,
  toSearchParams,
  type ContractFilters,
  type ContractsWhere,
} from '@/lib/contract-filters';

const NOW = 1788367188; // 2026-08-02 12:39:48 UTC
const SOON = NOW + EXPIRING_SOON_WINDOW_SECONDS;
const DEPLOYER = '0x5611de6e27c7eb92ef7d6be8a664969d290edb83';
const DAY_SECONDS = 24 * 60 * 60;

function parse(query: string): ContractFilters {
  return parseContractFilters(new URLSearchParams(query));
}

function filters(overrides: Partial<ContractFilters> = {}): ContractFilters {
  return { ...EMPTY_FILTERS, ...overrides };
}

describe('parseContractFilters', () => {
  it('falls back to defaults when nothing is set', () => {
    expect(parse('')).toEqual(EMPTY_FILTERS);
  });

  it('keeps known statuses and drops the rest', () => {
    expect(parse('status=expiring,nonsense,expired').status).toEqual(['expiring', 'expired']);
    expect(parse('status=').status).toEqual([]);
    expect(parse('status=nonsense').status).toEqual([]);
  });

  it('does not repeat a status listed twice', () => {
    expect(parse('status=expired,expired').status).toEqual(['expired']);
  });

  it('normalizes a valid deployer and ignores anything else', () => {
    expect(parse(`deployer=${DEPLOYER.toUpperCase().replace('0X', '0x')}`).deployer).toBe(DEPLOYER);
    expect(parse('deployer=0x123').deployer).toBeNull();
    expect(parse('deployer=not-an-address').deployer).toBeNull();
  });

  it('keeps well-formed days and rejects the ones that do not exist', () => {
    expect(parse('from=2026-03-01&to=2026-03-31').from).toBe('2026-03-01');
    expect(parse('from=2026-02-31').from).toBeNull();
    expect(parse('from=01-03-2026').from).toBeNull();
  });

  it('falls back to page 1 on anything that is not a positive integer', () => {
    expect(parse('page=3').page).toBe(3);
    expect(parse('page=0').page).toBe(1);
    expect(parse('page=-2').page).toBe(1);
    expect(parse('page=1.5').page).toBe(1);
    expect(parse('page=last').page).toBe(1);
  });

  it('falls back to the default sort on an unknown column or direction', () => {
    expect(parse('sort=version&dir=asc')).toMatchObject({ sort: 'version', dir: 'asc' });
    expect(parse('sort=dataFee&dir=sideways')).toMatchObject({ sort: 'activatedAt', dir: 'desc' });
  });
});

describe('toSearchParams', () => {
  it('takes the first value of a repeated param and skips the missing ones', () => {
    const params = toSearchParams({ status: ['expired', 'active'], page: '2', sort: undefined });
    expect(params.get('status')).toBe('expired');
    expect(params.get('page')).toBe('2');
    expect(params.has('sort')).toBe(false);
  });
});

describe('serializeContractFilters', () => {
  it('leaves the defaults out of the query string', () => {
    expect(serializeContractFilters(EMPTY_FILTERS).toString()).toBe('');
  });

  it('round-trips everything that was set', () => {
    const original = filters({
      status: ['expiring', 'expired'],
      deployer: DEPLOYER,
      from: '2026-03-01',
      to: '2026-03-31',
      page: 4,
      sort: 'version',
      dir: 'asc',
    });
    expect(parseContractFilters(serializeContractFilters(original))).toEqual(original);
  });
});

describe('contractsVariables', () => {
  it('turns the page into an offset', () => {
    expect(filtersOffset(filters())).toBe(0);
    expect(contractsVariables(filters({ page: 3 }), NOW)).toMatchObject({
      limit: CONTRACTS_PAGE_SIZE,
      offset: 2 * CONTRACTS_PAGE_SIZE,
    });
  });

  it('orders by the sorted column', () => {
    expect(contractsVariables(filters({ sort: 'deployer', dir: 'asc' }), NOW).orderBy).toEqual([
      { deployer: 'asc' },
    ]);
  });
});

describe('buildContractsWhere', () => {
  it('asks for everything when no filter is set', () => {
    expect(buildContractsWhere(EMPTY_FILTERS, NOW)).toEqual({});
  });

  it('matches the deployer exactly', () => {
    expect(buildContractsWhere(filters({ deployer: DEPLOYER }), NOW)).toEqual({
      _and: [{ deployer: { _eq: DEPLOYER } }],
    });
  });

  it('reads the day range in UTC and includes the whole closing day', () => {
    const where = buildContractsWhere(filters({ from: '2026-03-01', to: '2026-03-31' }), NOW);
    expect(where).toEqual({
      _and: [
        { activatedAt: { _gte: Date.UTC(2026, 2, 1) / 1000 } },
        { activatedAt: { _lt: Date.UTC(2026, 2, 31) / 1000 + DAY_SECONDS } },
      ],
    });
  });

  it('turns a single status into its predicate', () => {
    expect(buildContractsWhere(filters({ status: ['expired'] }), NOW)).toEqual({
      _and: [{ _or: [{ expiresAt: { _lt: NOW } }] }],
    });
    expect(buildContractsWhere(filters({ status: ['expiring'] }), NOW)).toEqual({
      _and: [{ _or: [{ expiresAt: { _gte: NOW, _lte: SOON } }] }],
    });
  });

  it('joins several statuses with _or', () => {
    const where = buildContractsWhere(filters({ status: ['expiring', 'expired'] }), NOW);
    expect(where._and?.[0]._or).toHaveLength(2);
  });

  it('claims a contract without expiry for the live states only', () => {
    const live = { _or: [{ expiresAt: { _is_null: true } }, { expiresAt: { _gt: SOON } }] };

    expect(buildContractsWhere(filters({ status: ['active'] }), NOW)).toEqual({
      _and: [{ _or: [{ isCached: { _eq: false }, ...live }] }],
    });
    expect(buildContractsWhere(filters({ status: ['cached'] }), NOW)).toEqual({
      _and: [{ _or: [{ isCached: { _eq: true }, ...live }] }],
    });
    expect(
      JSON.stringify(buildContractsWhere(filters({ status: ['expired'] }), NOW)),
    ).not.toContain('_is_null');
  });

  it('combines every filter under a single _and', () => {
    const where = buildContractsWhere(
      filters({ status: ['expired'], deployer: DEPLOYER, from: '2026-03-01', to: '2026-03-31' }),
      NOW,
    );
    expect(where._and).toHaveLength(4);
  });

  it('asking for all four statuses covers the same rows as no status filter', () => {
    const where = buildContractsWhere(filters({ status: [...CONTRACT_STATUSES] }), NOW);
    const predicates = where._and?.[0]._or ?? [];
    // Boundaries where the four could overlap or leave a gap: just expired,
    // exactly now, the edge of the expiring window, and past it.
    const samples = [NOW - 1, NOW, SOON, SOON + 1, null];

    for (const expiresAt of samples) {
      for (const isCached of [true, false]) {
        const matches = predicates.filter((predicate) =>
          matchesRow(predicate, expiresAt, isCached),
        );
        expect(matches).toHaveLength(1);
      }
    }
  });
});

type Comparison = NonNullable<ContractsWhere['expiresAt']>;

/** Evaluates one status predicate against a row, the way Hasura would. */
function matchesRow(
  predicate: ContractsWhere,
  expiresAt: number | null,
  isCached: boolean,
): boolean {
  if (predicate.isCached && predicate.isCached._eq !== isCached) return false;

  const comparisons: Comparison[] = predicate._or
    ? predicate._or.flatMap((clause) => (clause.expiresAt ? [clause.expiresAt] : []))
    : predicate.expiresAt
      ? [predicate.expiresAt]
      : [];

  return comparisons.some((comparison) => {
    if (comparison._is_null === true) return expiresAt === null;
    if (expiresAt === null) return false;
    if (comparison._lt !== undefined && !(expiresAt < comparison._lt)) return false;
    if (comparison._lte !== undefined && !(expiresAt <= comparison._lte)) return false;
    if (comparison._gt !== undefined && !(expiresAt > comparison._gt)) return false;
    if (comparison._gte !== undefined && !(expiresAt >= comparison._gte)) return false;
    return true;
  });
}
