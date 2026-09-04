import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import BuildersPage from '@/app/builders/page';
import { graphqlClient } from '@/lib/graphql/client';
import { NEW_BUILDER_DAYS } from '@/lib/utils';
import type { BuilderStatsData } from '@/types';

vi.mock('@/lib/graphql/client', () => ({
  graphqlClient: { request: vi.fn() },
}));

const DEPLOYER_A = '0xF39FD6e51aad88F6F4ce6aB8827279cffFb92266';
const DEPLOYER_B = '0x90F79bf6EB2c4f870365E785982E1f101E93b906';
const ACTIVATED_AT = 1705318200; // 2024-01-15 12:30:00 UTC
const DAY_SECONDS = 24 * 60 * 60;
/** The bound the page asks for, kept here so the test fails if the page changes it. */
const LEADERBOARD_LIMIT = 10;

const stats: BuilderStatsData = {
  StylusContract_aggregate: { aggregate: { count: 30 } },
  GlobalStats: [
    { cumulativeDeployers: 12, repeatStylusDeployers: 5, retainedStylusDeployers: 3 },
  ],
  DeployerRegistry: [
    {
      id: DEPLOYER_A.toLowerCase(),
      stylusContractCount: 4,
      firstStylusAt: ACTIVATED_AT,
      lastStylusAt: ACTIVATED_AT + 86400,
    },
    {
      id: DEPLOYER_B.toLowerCase(),
      stylusContractCount: 1,
      firstStylusAt: ACTIVATED_AT,
      lastStylusAt: ACTIVATED_AT,
    },
  ],
  DailyStats: [{ uniqueStylusDeployers: 2 }, { uniqueStylusDeployers: 4 }],
};

function respond(overrides: Partial<BuilderStatsData> = {}) {
  vi.mocked(graphqlClient.request).mockImplementation((document) =>
    String(document).includes('GetBuilderGrowth')
      ? Promise.resolve({ DailyStats: [] })
      : Promise.resolve({ ...stats, ...overrides }),
  );
}

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <BuildersPage />
    </QueryClientProvider>,
  );
}

function kpiValue(title: string) {
  return screen.getByText(title).nextElementSibling?.textContent;
}

function requestsMatching(operation: string) {
  const calls = vi.mocked(graphqlClient.request).mock.calls as unknown as [
    string,
    Record<string, unknown>?,
  ][];
  return calls.filter((call) => String(call[0]).includes(operation));
}

describe('BuildersPage', () => {
  beforeEach(() => {
    vi.mocked(graphqlClient.request).mockReset();
    respond();
  });

  it('takes the KPIs from the counters, not from the leaderboard rows', async () => {
    renderPage();

    // The two rows below would give 5 deployers and 2.5 contracts each
    await waitFor(() => expect(kpiValue('Unique Deployers')).toBe('12'));
    expect(kpiValue('Avg Contracts/Deployer')).toBe('2.5');
    expect(kpiValue('Repeat Builders')).toBe('5');
    expect(kpiValue('Retention (>1 week)')).toBe('25.0%');
  });

  it('sums new builders over the days in the window', async () => {
    renderPage();

    await waitFor(() => expect(kpiValue('New This Week')).toBe('6'));
  });

  it('shows a dash for retention before the first deployer lands', async () => {
    respond({ GlobalStats: [] });
    renderPage();

    await waitFor(() => expect(kpiValue('Retention (>1 week)')).toBe('-'));
  });

  it('renders the leaderboard rows the query returned, in order', async () => {
    renderPage();

    const table = await screen.findByRole('table');
    const rows = within(table).getAllByRole('row').slice(1);
    expect(rows).toHaveLength(2);
    // The indexer stores addresses lowercased, so the table shows them that way
    expect(within(rows[0]).getByText('0xf39f...2266')).toBeDefined();
    expect(within(rows[0]).getByText('4')).toBeDefined();
  });

  it('sends the contract count of a row to that deployer contracts', async () => {
    renderPage();

    const table = await screen.findByRole('table');
    const rows = within(table).getAllByRole('row').slice(1);
    expect(within(rows[0]).getByText('4').getAttribute('href')).toBe(
      `/contracts?deployer=${DEPLOYER_A.toLowerCase()}`,
    );
  });

  // The table renders whatever came back, so the bound lives in the request.
  it('asks for only the rows the leaderboard shows', async () => {
    renderPage();

    await waitFor(() => expect(requestsMatching('GetBuilderStats')).toHaveLength(1));
    const variables = requestsMatching('GetBuilderStats')[0][1] as {
      limit: number;
      since: number;
    };
    expect(variables.limit).toBe(LEADERBOARD_LIMIT);
    // A UTC day start, one week back. Checked as a span rather than against a
    // second reading of the clock, which a day rolling over mid-test would fail.
    const elapsed = Math.floor(Date.now() / 1000) - variables.since;
    expect(variables.since % DAY_SECONDS).toBe(0);
    expect(elapsed).toBeGreaterThanOrEqual((NEW_BUILDER_DAYS - 1) * DAY_SECONDS);
    expect(elapsed).toBeLessThanOrEqual(NEW_BUILDER_DAYS * DAY_SECONDS);
  });

  it('keeps the day-by-day history off the five-second query', async () => {
    renderPage();

    await waitFor(() => expect(requestsMatching('GetBuilderGrowth')).toHaveLength(1));
    // The polled query reads DailyStats too, but only the days in the window
    expect(String(requestsMatching('GetBuilderStats')[0][0])).toContain(
      'DailyStats(where: { date: { _gte: $since } })',
    );
  });
});
