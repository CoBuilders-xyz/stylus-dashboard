import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { isValidElement, cloneElement, type ReactElement } from 'react';
import { DeployVolumeChart } from '@/components/charts/deploy-volume-chart';
import { ShareAreaChart } from '@/components/charts/share-area-chart';
import { getSharePoints, type DeployPoint } from '@/lib/comparison';

// ResponsiveContainer measures its parent, which is always 0 in jsdom, so
// without a size the charts mount and draw nothing. These tests are about what
// gets drawn, so the container hands its child a fixed box instead.
vi.mock('recharts', async () => {
  const actual = await vi.importActual<typeof import('recharts')>('recharts');
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) =>
      isValidElement(children)
        ? cloneElement(children as ReactElement<{ width: number; height: number }>, {
            width: 600,
            height: 300,
          })
        : null,
  };
});

const paths = (container: HTMLElement) =>
  Array.from(container.querySelectorAll('path.recharts-curve')).map(
    (path) => path.getAttribute('d') ?? '',
  );

const SERIES: DeployPoint[] = [
  { date: '2026-01-08', stylus: 2, evm: 200 },
  // A quiet day on both sides: log(0) has no point to draw.
  { date: '2026-01-09', stylus: 0, evm: 0 },
  { date: '2026-01-10', stylus: 4, evm: 400 },
];

describe('DeployVolumeChart', () => {
  it('draws both series on the log axis without a broken coordinate', () => {
    const { container } = render(<DeployVolumeChart data={SERIES} />);

    const drawn = paths(container);
    expect(drawn.length).toBeGreaterThanOrEqual(2);
    expect(drawn.every((d) => d.length > 0 && !d.includes('NaN'))).toBe(true);
  });

  it('breaks the line at a day with no deploys instead of plotting zero', () => {
    const { container } = render(<DeployVolumeChart data={SERIES} />);

    // Recharts encodes a gap as a second move command inside the same path.
    for (const d of paths(container)) {
      expect(d.match(/M/g)).toHaveLength(2);
    }
  });

  it('marks the days a log axis leaves without a segment to draw', () => {
    const { container } = render(<DeployVolumeChart data={SERIES} />);

    // Two plotted days per series, each one isolated by the quiet day between.
    expect(container.querySelectorAll('circle.recharts-dot')).toHaveLength(4);
  });
});

/** Every y coordinate in an SVG path, which is every second number in it. */
const heights = (d: string) =>
  (d.match(/-?\d+\.?\d*/g) ?? []).map(Number).filter((_, i) => i % 2 === 1);

describe('ShareAreaChart', () => {
  it('stacks both areas without a broken coordinate', () => {
    const { container } = render(<ShareAreaChart data={getSharePoints(SERIES)} />);

    const drawn = paths(container);
    expect(drawn.length).toBeGreaterThanOrEqual(2);
    expect(drawn.every((d) => d.length > 0 && !d.includes('NaN'))).toBe(true);
  });

  // Guards the shares reaching the chart at all: a band flat on its baseline
  // is what a broken getSharePoints draws, and it looks identical to an empty
  // chart. jsdom cannot see the animation that had the same effect in a real
  // browser, which is why the chart turns it off rather than relying on this.
  it('draws the band away from the baseline', () => {
    const { container } = render(<ShareAreaChart data={getSharePoints(SERIES)} />);

    for (const d of paths(container)) {
      expect(new Set(heights(d)).size).toBeGreaterThan(1);
    }
  });
});
