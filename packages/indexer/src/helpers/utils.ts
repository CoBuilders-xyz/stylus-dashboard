import {
  RATE_LIMIT_JITTER_MS,
  REQUEST_TIMEOUT_MS,
  TRANSIENT_RETRY_ATTEMPTS,
  TRANSIENT_RETRY_DELAY_MS,
} from '../config.js';

export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function hexToNumber(hex: string): number {
  return Number.parseInt(hex, 16);
}

// Shared rolling-window limiter. Callers reuse one instance so retries and
// pagination consume the same request budget as initial attempts.
export class RateLimiter {
  private timestamps: number[] = [];

  constructor(
    private readonly calls: number,
    private readonly windowMs: number,
  ) {
    if (!Number.isInteger(calls) || calls <= 0 || !Number.isFinite(windowMs) || windowMs <= 0) {
      throw new Error('RateLimiter requires positive calls and windowMs values');
    }
  }

  async acquire(): Promise<void> {
    while (true) {
      const now = Date.now();
      this.timestamps = this.timestamps.filter((timestamp) => now - timestamp < this.windowMs);

      if (this.timestamps.length < this.calls) {
        this.timestamps.push(now);
        return;
      }

      await sleep(this.windowMs - (now - this.timestamps[0]));
    }
  }
}

// A 429 from HyperSync has no Retry-After, but it does carry
// x-ratelimit-reset: the seconds left in the window. The fixed backoff never
// adds up to that, so a throttled call would always give up too early.
function retryDelayMs(res: Response | null, attempt: number): number {
  if (res?.status === 429) {
    const reset = Number(res.headers.get('x-ratelimit-reset'));
    if (Number.isFinite(reset) && reset > 0) {
      return reset * 1000 + Math.random() * RATE_LIMIT_JITTER_MS;
    }
  }
  return TRANSIENT_RETRY_DELAY_MS * attempt;
}

export type PostJsonResult = {
  ok: boolean;
  status: number;
  body: string;
};

// POST with retries on network errors and 429/5xx. Anything else comes back
// for the caller to judge. Without this, one flaky upstream response would
// kill the whole indexer process.
// Each attempt downloads the whole body under one REQUEST_TIMEOUT_MS
// deadline, so a hung connection throws here and gets retried instead of
// stalling the sync forever.
export async function postJson(
  url: string,
  headers: Record<string, string>,
  body: string,
  rateLimiter?: RateLimiter,
): Promise<PostJsonResult> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= TRANSIENT_RETRY_ATTEMPTS; attempt++) {
    let res: Response | null = null;
    try {
      await rateLimiter?.acquire();
      res = await fetch(url, {
        method: 'POST',
        headers,
        body,
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      const resBody = await res.text();
      if (res.status === 429 || res.status >= 500) {
        lastError = new Error(`Request to ${url} failed: ${res.status} ${resBody}`);
      } else {
        return { ok: res.ok, status: res.status, body: resBody };
      }
    } catch (err) {
      lastError =
        err instanceof DOMException && err.name === 'TimeoutError'
          ? new Error(`Request to ${url} timed out after ${REQUEST_TIMEOUT_MS}ms`, { cause: err })
          : err;
      res = null;
    }
    if (attempt < TRANSIENT_RETRY_ATTEMPTS) {
      await sleep(retryDelayMs(res, attempt));
    }
  }
  throw lastError;
}
