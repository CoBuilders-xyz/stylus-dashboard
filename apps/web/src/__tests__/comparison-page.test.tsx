import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ComparisonClient } from '@/app/comparison/comparison-client';
import { graphqlClient } from '@/lib/graphql/client';
import { getRecentWindowStart } from '@/lib/utils';
import type { ComparisonData } from '@/types';

vi.mock('@/lib/graphql/client', () => ({
  graphqlClient: { request: vi.fn(() => new Promise(() => {})) },
}));

const DAY = 24 * 60 * 60;
const today = () => Math.floor(Date.now() / 1000 / DAY) * DAY;

const initialData = (): ComparisonData => ({
  // Deliberately unrelated to the daily rows below, so a KPI reading the
  // series instead of the aggregate fails loudly.
  StylusContract_aggregate: { aggregate: { count: 120 } },
  GlobalStats: [{ totalEvmContracts: 29_880 }],
  stylusOnly: { aggregate: { count: 4 } },
  both: { aggregate: { count: 6 } },
  evmOnly: { aggregate: { count: 90 } },
  DailyStats: [
    { date: today(), stylusActivations: 3, evmDeployments: 297 },
    { date: today() - 6 * DAY, stylusActivations: 0, evmDeployments: 300 },
  ],
});

function requestsMatching(operation: string) {
  const calls = vi.mocked(graphqlClient.request).mock.calls as unknown as [
    string,
    Record<string, unknown>?,
  ][];
  return calls.filter((call) => String(call[0]).includes(operation));
}

function kpiValue(title: string) {
  return screen.getByText(title).nextElementSibling?.textContent;
}

function renderWithQueryClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe('ComparisonClient', () => {
  beforeEach(() => {
    vi.mocked(graphqlClient.request).mockReset();
    vi.mocked(graphqlClient.request).mockImplementation(() => new Promise(() => {}));
  });

  it('renders data immediately from initialData, with no loading placeholders', () => {
    renderWithQueryClient(<ComparisonClient initialData={initialData()} />);

    expect(screen.getByText('Stylus vs Solidity')).toBeDefined();
    expect(screen.queryAllByTestId('kpi-skeleton')).toHaveLength(0);
  });

  it('falls back to loading placeholders when initialData is missing', () => {
    renderWithQueryClient(<ComparisonClient />);

    expect(screen.getAllByTestId('kpi-skeleton')).toHaveLength(4);
  });

  it('names the window the denominator starts in', () => {
    renderWithQueryClient(<ComparisonClient initialData={initialData()} />);

    expect(screen.getByText(/since Stylus launched in September 2024/)).toBeDefined();
  });

  it('takes the share from the aggregates, at a precision a small share survives', () => {
    renderWithQueryClient(<ComparisonClient initialData={initialData()} />);

    // 120 / (120 + 29880) = 0.4%
    expect(kpiValue('WASM Share')).toBe('0.40%');
  });

  it('shows the trailing share as the share KPI change line', () => {
    renderWithQueryClient(<ComparisonClient initialData={initialData()} />);

    // 3 / (3 + 597) over the last 7 days, which both rows fall inside
    expect(screen.getByText('7d: 0.50%')).toBeDefined();
  });

  it('pairs the totals and averages Stylus against EVM', () => {
    renderWithQueryClient(<ComparisonClient initialData={initialData()} />);

    expect(kpiValue('Total Contracts')).toBe('120/29.9K');
    // Both rows land in the 30-day window: 3 and 597 spread over 30 days.
    expect(kpiValue('Deploys / day (30d avg)')).toBe('0.1/19.9');
    expect(kpiValue('Deployers')).toBe('10/96');
  });

  it('reports the deployer overlap against the EVM side', () => {
    renderWithQueryClient(<ComparisonClient initialData={initialData()} />);

    const card = screen.getByText('Deployer Overlap').closest('div')?.parentElement;
    expect(card).toBeDefined();
    expect(within(card as HTMLElement).getByText(/EVM deployers/).textContent).toContain(
      '6 of 96 EVM deployers have also shipped a Stylus contract (6.3%).',
    );
  });

  it('falls back to zeros before the first deployment lands', () => {
    renderWithQueryClient(
      <ComparisonClient
        initialData={{
          ...initialData(),
          StylusContract_aggregate: { aggregate: { count: 0 } },
          GlobalStats: [],
          stylusOnly: { aggregate: { count: 0 } },
          both: { aggregate: { count: 0 } },
          evmOnly: { aggregate: { count: 0 } },
          DailyStats: [],
        }}
      />,
    );

    expect(kpiValue('WASM Share')).toBe('-');
    expect(screen.getByText('No deployers indexed yet.')).toBeDefined();
    expect(screen.getAllByText(/No deployments indexed for this period/)).toHaveLength(2);
  });

  it('keeps both charts up when only one side deployed that day', () => {
    renderWithQueryClient(
      <ComparisonClient
        initialData={{
          ...initialData(),
          DailyStats: [{ date: today(), stylusActivations: 0, evmDeployments: 12 }],
        }}
      />,
    );

    expect(screen.queryAllByText(/No deployments indexed for this period/)).toHaveLength(0);
    expect(screen.getByText('Share of Daily Deploys')).toBeDefined();
  });

  it('queries the 30-day window ending today', () => {
    renderWithQueryClient(<ComparisonClient />);

    const [call] = requestsMatching('GetComparisonStats');
    expect(call?.[1]).toEqual({ since: getRecentWindowStart(Math.floor(Date.now() / 1000)) });
  });

  // Both charts read the same query, so a failed history fetch has to read as
  // a failure on both, not as "no data" on one of them.
  it('tells both charts apart from empty when the history query fails', async () => {
    vi.mocked(graphqlClient.request).mockImplementation((document: unknown) =>
      String(document).includes('GetComparisonHistory')
        ? Promise.reject(new Error('boom'))
        : new Promise(() => {}),
    );
    renderWithQueryClient(<ComparisonClient initialData={initialData()} />);

    const toggle = screen.getByRole('group', { name: 'Daily deploys period' });
    fireEvent.click(within(toggle).getByRole('button', { name: 'All' }));

    await waitFor(() =>
      expect(screen.getAllByText('Could not load the full deployment history.')).toHaveLength(2),
    );
    expect(screen.queryByText(/No deployments indexed for this period/)).toBeNull();
  });

  it('only reaches for the full history once the all period is selected', async () => {
    renderWithQueryClient(<ComparisonClient initialData={initialData()} />);

    expect(requestsMatching('GetComparisonHistory')).toHaveLength(0);

    const toggle = screen.getByRole('group', { name: 'Daily deploys period' });
    fireEvent.click(within(toggle).getByRole('button', { name: 'All' }));

    await waitFor(() => expect(requestsMatching('GetComparisonHistory')).toHaveLength(1));
  });
});
