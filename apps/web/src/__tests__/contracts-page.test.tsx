import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ContractsClient } from '@/app/contracts/contracts-client';
import { graphqlClient } from '@/lib/graphql/client';
import { EMPTY_FILTERS, type ContractFilters, type ContractsWhere } from '@/lib/contract-filters';
import type { ContractsData } from '@/types';

const { replace } = vi.hoisted(() => ({ replace: vi.fn() }));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace }),
  usePathname: () => '/contracts',
}));

vi.mock('@/lib/graphql/client', () => ({
  graphqlClient: { request: vi.fn() },
}));

const DEPLOYER = '0x5611de6e27c7eb92ef7d6be8a664969d290edb83';
const OTHER_DEPLOYER = '0x1ee1f7e491e1c57b44f31bb063e10e022444b909';
const ACTIVATED_AT = 1788367188; // 2026-08-02 12:39:48 UTC

const data: ContractsData = {
  StylusContract: [
    {
      id: '0xaaaa000000000000000000000000000000000001',
      deployer: DEPLOYER,
      version: 1,
      activatedAt: ACTIVATED_AT,
      isCached: false,
      expiresAt: ACTIVATED_AT + 365 * 24 * 60 * 60,
    },
  ],
  StylusContract_aggregate: { aggregate: { count: 35 } },
};

function renderWith(filters: Partial<ContractFilters>, initialData: ContractsData | undefined) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <ContractsClient filters={{ ...EMPTY_FILTERS, ...filters }} initialData={initialData} />
    </QueryClientProvider>,
  );
}

const renderClient = (filters: Partial<ContractFilters> = {}) => renderWith(filters, data);

const EMPTY_PAGE: ContractsData = {
  StylusContract: [],
  StylusContract_aggregate: { aggregate: { count: 0 } },
};

beforeEach(() => {
  replace.mockClear();
  vi.mocked(graphqlClient.request).mockReset().mockResolvedValue(data);
});

/** The variables the page sent on its first request. */
function sentVariables() {
  const calls = vi.mocked(graphqlClient.request).mock.calls as unknown as [
    unknown,
    { where: ContractsWhere; limit: number; offset: number; orderBy: unknown },
  ][];
  return calls[0][1];
}

describe('ContractsClient', () => {
  it('paints the rows the server already fetched', () => {
    renderClient();
    expect(screen.getByText('0xaaaa...0001')).toBeDefined();
  });

  it('counts every match, not the rows on this page', () => {
    renderClient();
    expect(screen.getByText(/Showing/).textContent).toBe('Showing 1–1 of 35');
  });

  it('sends the filters to the database instead of trimming rows here', async () => {
    renderWith({ status: ['expired'], deployer: DEPLOYER, page: 2 }, undefined);

    await waitFor(() => expect(graphqlClient.request).toHaveBeenCalled());
    const variables = sentVariables();
    expect(variables).toMatchObject({ offset: 20, limit: 20, orderBy: [{ activatedAt: 'desc' }] });
    expect(variables.where._and).toEqual([
      { deployer: { _eq: DEPLOYER } },
      { _or: [{ expiresAt: { _lt: expect.any(Number) } }] },
    ]);
  });

  // Every filter change re-renders on the server, so asking again from here
  // would be the same query twice for one click.
  it('does not ask again for what the server already sent', async () => {
    renderClient({ status: ['expired'] });

    await waitFor(() => expect(screen.getByText('0xaaaa...0001')).toBeDefined());
    expect(graphqlClient.request).not.toHaveBeenCalled();
  });

  it('adds a status to the URL without dropping the ones already on', () => {
    renderClient({ status: ['expiring'] });

    fireEvent.click(screen.getByRole('button', { name: 'Expired' }));

    expect(replace).toHaveBeenCalledWith('/contracts?status=expiring,expired', { scroll: false });
  });

  it('removes a status that was already on', () => {
    renderClient({ status: ['expiring', 'expired'] });

    fireEvent.click(screen.getByRole('button', { name: 'Expiring' }));

    expect(replace).toHaveBeenCalledWith('/contracts?status=expired', { scroll: false });
  });

  it('goes back to the first page whenever the filters change', () => {
    renderClient({ status: ['expiring'], page: 4 });

    fireEvent.click(screen.getByRole('button', { name: 'Expired' }));

    expect(replace).toHaveBeenCalledWith(expect.not.stringContaining('page='), expect.anything());
  });

  it('keeps every other filter when only paging', () => {
    renderClient({ status: ['expiring'] });

    fireEvent.click(screen.getByRole('button', { name: 'Next' }));

    expect(replace).toHaveBeenCalledWith('/contracts?status=expiring&page=2', { scroll: false });
  });

  it('clears the filters without changing how the table is ordered', () => {
    renderClient({ status: ['expired'], deployer: DEPLOYER, sort: 'version', dir: 'asc' });

    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));

    expect(replace).toHaveBeenCalledWith('/contracts?sort=version&dir=asc', { scroll: false });
  });

  it('puts a day range in the URL', () => {
    renderClient();

    fireEvent.change(screen.getByLabelText('From'), { target: { value: '2026-03-01' } });

    expect(replace).toHaveBeenCalledWith('/contracts?from=2026-03-01', { scroll: false });
  });

  it('sorts through the URL', () => {
    renderClient();

    fireEvent.click(screen.getByRole('button', { name: /Version/ }));

    expect(replace).toHaveBeenCalledWith('/contracts?sort=version', { scroll: false });
  });

  it('says so when the filters match nothing', () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={queryClient}>
        <ContractsClient
          filters={{ ...EMPTY_FILTERS, status: ['expired'] }}
          initialData={{
            StylusContract: [],
            StylusContract_aggregate: { aggregate: { count: 0 } },
          }}
        />
      </QueryClientProvider>,
    );

    expect(screen.getByText('No contracts match these filters.')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Expired' }).getAttribute('aria-pressed')).toBe(
      'true',
    );
  });

  it('separates a page past the end from a table with nothing in it', () => {
    renderWith(
      { page: 9 },
      { ...EMPTY_PAGE, StylusContract_aggregate: { aggregate: { count: 35 } } },
    );

    expect(screen.getByText('This page is past the last result.')).toBeDefined();
  });
});

describe('the deployer box', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('waits for a whole address before touching the URL', () => {
    renderClient();
    const input = screen.getByLabelText('Deployer');

    fireEvent.change(input, { target: { value: '0x5611de' } });
    act(() => void vi.advanceTimersByTime(1000));
    expect(replace).not.toHaveBeenCalled();

    fireEvent.change(input, { target: { value: DEPLOYER } });
    act(() => void vi.advanceTimersByTime(1000));
    expect(replace).toHaveBeenCalledWith(`/contracts?deployer=${DEPLOYER}`, { scroll: false });
  });

  it('writes the URL once for a burst of typing', () => {
    renderClient();
    const input = screen.getByLabelText('Deployer');

    for (const value of [DEPLOYER, OTHER_DEPLOYER, DEPLOYER]) {
      fireEvent.change(input, { target: { value } });
      act(() => void vi.advanceTimersByTime(100));
    }
    act(() => void vi.advanceTimersByTime(1000));

    expect(replace).toHaveBeenCalledTimes(1);
  });

  it('clears the filter when the box is emptied', () => {
    renderClient({ deployer: DEPLOYER });

    fireEvent.change(screen.getByLabelText('Deployer'), { target: { value: '' } });
    act(() => void vi.advanceTimersByTime(1000));

    expect(replace).toHaveBeenCalledWith('/contracts', { scroll: false });
  });
});
