import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { OverviewClient } from '@/app/overview-client';
import type { OverviewData } from '@/types';

vi.mock('@/lib/graphql/client', () => ({
  graphqlClient: { request: vi.fn(() => new Promise(() => {})) },
}));

const CONTRACT_A = '0x525c2aBA45F66102bC4F45cA629C93F0f0dcC9e8';
const CONTRACT_B = '0x1CBd3b2770909D4e10f157cABC84C7264073C9Ec';
const DEPLOYER = '0xF39FD6e51aad88F6F4ce6aB8827279cffFb92266';

const initialData: OverviewData = {
  StylusContract: [
    { id: CONTRACT_A, deployer: DEPLOYER, activatedAt: 1705318200, isCached: true, expiresAt: null },
    { id: CONTRACT_B, deployer: DEPLOYER, activatedAt: 1705318300, isCached: false, expiresAt: null },
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

function renderWithQueryClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe('OverviewClient', () => {
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
});
