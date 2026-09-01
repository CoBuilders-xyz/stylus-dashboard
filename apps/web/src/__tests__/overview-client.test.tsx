import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { OverviewClient } from '@/app/overview-client';
import { graphqlClient } from '@/lib/graphql/client';
import { getRecentWindowStart } from '@/lib/utils';
import type { OverviewData } from '@/types';

vi.mock('@/lib/graphql/client', () => ({
  graphqlClient: { request: vi.fn(() => new Promise(() => {})) },
}));

const CONTRACT_A = '0x525c2aBA45F66102bC4F45cA629C93F0f0dcC9e8';
const CONTRACT_B = '0x1CBd3b2770909D4e10f157cABC84C7264073C9Ec';
const DEPLOYER = '0xF39FD6e51aad88F6F4ce6aB8827279cffFb92266';

const initialData: OverviewData = {
  // Deliberately larger than the two rows below, so a KPI reading the list
  // instead of the aggregate fails loudly.
  StylusContract_aggregate: { aggregate: { count: 1234 } },
  GlobalStats: [{ cumulativeDeployers: 99 }],
  StylusContract: [
    { id: CONTRACT_A, deployer: DEPLOYER, activatedAt: 1705318200, isCached: true },
    { id: CONTRACT_B, deployer: DEPLOYER, activatedAt: 1705318300, isCached: false },
  ],
  DailyStats: [
    {
      id: '2024-01-15',
      date: 1705276800,
      stylusActivations: 2,
      stylusReactivations: 1,
      uniqueDeployers: 1,
      totalStylusContracts: 2,
      cacheEvents: 0,
    },
  ],
};

// request() is overloaded, so its recorded calls infer as the single-argument
// form; this reads them back as the (document, variables) pair we call it with.
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

describe('OverviewClient', () => {
  beforeEach(() => {
    vi.mocked(graphqlClient.request).mockReset();
    vi.mocked(graphqlClient.request).mockImplementation(() => new Promise(() => {}));
  });

  it('renders data immediately from initialData, with no loading placeholders', () => {
    renderWithQueryClient(<OverviewClient initialData={initialData} />);

    expect(screen.getByText('Stylus Adoption Overview')).toBeDefined();
    expect(screen.queryAllByTestId('kpi-skeleton')).toHaveLength(0);
    expect(screen.queryByText(/No Stylus contracts indexed yet/)).toBeNull();
    expect(screen.getByText('2024-01-15')).toBeDefined();
  });

  it('falls back to loading placeholders when initialData is missing', () => {
    renderWithQueryClient(<OverviewClient />);

    expect(screen.getByText('Stylus Adoption Overview')).toBeDefined();
    expect(screen.getAllByTestId('kpi-skeleton')).toHaveLength(4);
    expect(screen.getByText(/No Stylus contracts indexed yet/)).toBeDefined();
  });

  it('shows the activations chart as loading while the query is in flight', () => {
    renderWithQueryClient(<OverviewClient />);

    expect(screen.getByText('Daily Activations')).toBeDefined();
    expect(screen.getByText('Loading...')).toBeDefined();
    expect(screen.queryByText(/No activations indexed for this period/)).toBeNull();
  });

  it('shows the empty activations message once a day-less response arrives', () => {
    renderWithQueryClient(
      <OverviewClient initialData={{ ...initialData, DailyStats: [] }} />,
    );

    expect(screen.getByText(/No activations indexed for this period/)).toBeDefined();
    expect(screen.queryByText('Loading...')).toBeNull();
  });

  it('defaults the activations period to 30d and switches on click', () => {
    renderWithQueryClient(<OverviewClient initialData={initialData} />);

    const toggle = screen.getByRole('group', { name: 'Daily activations period' });
    const button = (name: string) => within(toggle).getByRole('button', { name });

    expect(button('30d').getAttribute('aria-pressed')).toBe('true');
    expect(button('7d').getAttribute('aria-pressed')).toBe('false');

    fireEvent.click(button('7d'));

    expect(button('7d').getAttribute('aria-pressed')).toBe('true');
    expect(button('30d').getAttribute('aria-pressed')).toBe('false');
  });

  it('takes the count KPIs from the aggregate, not from the rendered rows', () => {
    renderWithQueryClient(<OverviewClient initialData={initialData} />);

    expect(kpiValue('Stylus Contracts')).toBe('1234');
    expect(kpiValue('Unique Deployers')).toBe('99');
  });

  it('falls back to zero deployers before the first activation lands', () => {
    renderWithQueryClient(
      <OverviewClient initialData={{ ...initialData, GlobalStats: [] }} />,
    );

    expect(kpiValue('Unique Deployers')).toBe('0');
  });

  it('queries the 30-day window ending today', () => {
    renderWithQueryClient(<OverviewClient />);

    const [call] = requestsMatching('GetOverviewStats');
    expect(call?.[1]).toEqual({ since: getRecentWindowStart(Math.floor(Date.now() / 1000)) });
  });

  // The table renders whatever the query returned, so the bound lives only in
  // the document: without this, dropping the limit would go unnoticed.
  it('asks for only the contract rows the table renders', () => {
    renderWithQueryClient(<OverviewClient />);

    const [call] = requestsMatching('GetOverviewStats');
    expect(call?.[0]).toContain('limit: 10');
  });

  it('keeps showing the 30d chart after the history query failed', async () => {
    vi.mocked(graphqlClient.request).mockImplementation((document) =>
      String(document).includes('GetActivationHistory')
        ? Promise.reject(new Error('boom'))
        : new Promise(() => {}),
    );
    renderWithQueryClient(<OverviewClient initialData={initialData} />);
    const toggle = screen.getByRole('group', { name: 'Daily activations period' });
    const button = (name: string) => within(toggle).getByRole('button', { name });

    fireEvent.click(button('All'));
    await waitFor(() =>
      expect(screen.getByText(/Could not load the full activation history/)).toBeDefined(),
    );

    fireEvent.click(button('30d'));

    expect(screen.queryByText(/Could not load the full activation history/)).toBeNull();
  });

  it('leaves the full history unfetched until the period is all', async () => {
    renderWithQueryClient(<OverviewClient initialData={initialData} />);

    const toggle = screen.getByRole('group', { name: 'Daily activations period' });
    expect(requestsMatching('GetActivationHistory')).toHaveLength(0);

    fireEvent.click(within(toggle).getByRole('button', { name: 'All' }));

    await waitFor(() => expect(requestsMatching('GetActivationHistory')).toHaveLength(1));
  });
});
