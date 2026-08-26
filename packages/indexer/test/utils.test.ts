import { describe, it, expect, vi, afterEach } from 'vitest';
import { postJson, RateLimiter } from '../src/helpers/utils';
import { REQUEST_TIMEOUT_MS, TRANSIENT_RETRY_ATTEMPTS } from '../src/config';

// AbortSignal.timeout uses an internal timer that vitest's fake timers
// cannot drive, so tests replace it with a setTimeout-based equivalent.
const stubAbortTimeout = () =>
  vi.spyOn(AbortSignal, 'timeout').mockImplementation((ms) => {
    const controller = new AbortController();
    setTimeout(
      () => controller.abort(new DOMException('The operation timed out', 'TimeoutError')),
      ms,
    );
    return controller.signal;
  });

// A fetch that never settles on its own: it only rejects when the signal
// postJson passed actually fires, which is the behavior under test.
const hangingFetch = () =>
  vi.fn().mockImplementation(
    (_url: string, { signal }: { signal: AbortSignal }) =>
      new Promise((_resolve, reject) => {
        signal.addEventListener('abort', () => reject(signal.reason));
      }),
  );

describe('postJson', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('returns the status and downloaded body on success', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('{"a":1}', { status: 200 })),
    );

    const res = await postJson('https://example.test', {}, '{}');

    expect(res).toEqual({ ok: true, status: 200, body: '{"a":1}' });
  });

  it('aborts a hung request after the timeout, with a fresh signal per attempt', async () => {
    vi.useFakeTimers();
    const timeoutSpy = stubAbortTimeout();
    const fetchMock = hangingFetch();
    vi.stubGlobal('fetch', fetchMock);

    const promise = postJson('https://example.test', {}, '{}');
    const expectation = expect(promise).rejects.toThrow(
      `timed out after ${REQUEST_TIMEOUT_MS}ms`,
    );
    await vi.runAllTimersAsync();
    await expectation;

    expect(fetchMock).toHaveBeenCalledTimes(TRANSIENT_RETRY_ATTEMPTS);
    expect(timeoutSpy).toHaveBeenCalledTimes(TRANSIENT_RETRY_ATTEMPTS);
    expect(timeoutSpy).toHaveBeenCalledWith(REQUEST_TIMEOUT_MS);
  });

  it('retries a body read that times out mid-stream', async () => {
    vi.useFakeTimers();
    stubAbortTimeout();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () =>
          Promise.reject(new DOMException('The operation timed out', 'TimeoutError')),
      })
      .mockResolvedValueOnce(new Response('late body', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const promise = postJson('https://example.test', {}, '{}');
    await vi.runAllTimersAsync();

    expect(await promise).toEqual({ ok: true, status: 200, body: 'late body' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('acquires a rate-limit slot for every retry attempt', async () => {
    vi.useFakeTimers();
    const limiter = new RateLimiter(10, 1_000);
    const acquireSpy = vi.spyOn(limiter, 'acquire');
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(new Response('upstream error', { status: 502 }))
        .mockResolvedValueOnce(new Response('ok', { status: 200 })),
    );

    const promise = postJson('https://example.test', {}, '{}', limiter);
    await vi.runAllTimersAsync();

    expect(await promise).toEqual({ ok: true, status: 200, body: 'ok' });
    expect(acquireSpy).toHaveBeenCalledTimes(2);
  });

  it('waits for the rolling window when the request budget is exhausted', async () => {
    vi.useFakeTimers();
    const limiter = new RateLimiter(2, 1_000);

    await limiter.acquire();
    await limiter.acquire();
    let acquired = false;
    const pending = limiter.acquire().then(() => {
      acquired = true;
    });

    await vi.advanceTimersByTimeAsync(999);
    expect(acquired).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await pending;
    expect(acquired).toBe(true);
  });
});
