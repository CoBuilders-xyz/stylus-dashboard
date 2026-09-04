import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import HealthPage from '@/app/health/page';
import { graphqlClient } from '@/lib/graphql/client';
import { getExpiryBoundaries, getRecentWindowStart, REACTIVATION_DAYS } from '@/lib/utils';
import type { HealthMetricsData } from '@/types';

vi.mock('@/lib/graphql/client', () => ({
  graphqlClient: { request: vi.fn() },
}));

const count = (n: number) => ({ aggregate: { count: n } });

const metrics: HealthMetricsData = {
  expired: count(3),
  under7d: count(2),
  from7to30d: count(5),
  from30to90d: count(7),
  from90to180d: count(11),
  over180d: count(13),
  DailyStats: [],
};

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <HealthPage />
    </QueryClientProvider>,
  );
}

function kpiValue(title: string) {
  return screen.getByText(title).nextElementSibling?.textContent;
}

function lastRequest() {
  const calls = vi.mocked(graphqlClient.request).mock.calls as unknown as [
    string,
    Record<string, unknown>?,
  ][];
  return calls.at(-1);
}

describe('HealthPage', () => {
  beforeEach(() => {
    vi.mocked(graphqlClient.request).mockReset();
    vi.mocked(graphqlClient.request).mockResolvedValue(metrics);
  });

  // The pie used to be a second pass over the rows with its own thresholds.
  // Deriving it from the buckets is what keeps the two charts in agreement.
  it('sums the status slices out of the expiry buckets', async () => {
    renderPage();

    // Active is everything from 7 days out: 5 + 7 + 11 + 13
    expect(await screen.findByText('36')).toBeDefined();
    expect(kpiValue('Expiring Soon (7d)')).toBe('2');
  });

  it('shows the empty state when every bucket is zero', async () => {
    vi.mocked(graphqlClient.request).mockResolvedValue({
      ...metrics,
      expired: count(0),
      under7d: count(0),
      from7to30d: count(0),
      from30to90d: count(0),
      from90to180d: count(0),
      over180d: count(0),
    });
    renderPage();

    await waitFor(() =>
      expect(screen.getAllByText(/No Stylus contracts indexed yet/)).toHaveLength(2),
    );
  });

  it('asks for counts, never for contract rows', async () => {
    renderPage();

    await waitFor(() => expect(lastRequest()).toBeDefined());
    const document = String(lastRequest()?.[0]);
    expect(document).toContain('StylusContract_aggregate');
    // A bare selection would be `StylusContract(` or `StylusContract {`
    expect(document).not.toMatch(/StylusContract[\s(){]/);
  });

  // Read the clock the page sent rather than taking a second reading here: an
  // hour rolling over between the render and the assertion would fail a test
  // that re-derived the boundaries.
  it('sends the hour-rounded boundaries the cache key depends on', async () => {
    renderPage();

    await waitFor(() => expect(lastRequest()).toBeDefined());
    const variables = lastRequest()?.[1] as { now: number };
    expect(variables.now % 3600).toBe(0);
    expect(Math.floor(Date.now() / 1000) - variables.now).toBeLessThan(3600);
    expect(variables).toEqual({
      ...getExpiryBoundaries(variables.now),
      since: getRecentWindowStart(variables.now, REACTIVATION_DAYS),
    });
  });
});
