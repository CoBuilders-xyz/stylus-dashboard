// jsdom has no ResizeObserver, and Recharts' ResponsiveContainer constructs one
// on mount, so any test that renders a chart needs this stub.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

globalThis.ResizeObserver ??= ResizeObserverStub as unknown as typeof ResizeObserver;
