import {
  RATE_LIMIT_JITTER_MS,
  TRANSIENT_RETRY_ATTEMPTS,
  TRANSIENT_RETRY_DELAY_MS,
} from '../config.js';

export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function hexToNumber(hex: string): number {
  return Number.parseInt(hex, 16);
}

// Token-bucket rate limiter: allows up to `tokens` calls per rolling `windowMs`.
// When no tokens are available, acquires slot by sleeping until one frees up.
export class RateLimiter {
  private timestamps: number[] = [];

  constructor(
    private readonly tokens: number,
    private readonly windowMs: number,
  ) {}

  async acquire(): Promise<void> {
    const now = Date.now();
    // Remove timestamps outside the current window
    this.timestamps = this.timestamps.filter((ts) => now - ts < this.windowMs);

    if (this.timestamps.length < this.tokens) {
      this.timestamps.push(now);
      return;
    }

    // Window is full: wait until the oldest token expires
    const oldestTs = this.timestamps[0];
    const waitMs = this.windowMs - (now - oldestTs) + 1;
    await sleep(waitMs);
    return this.acquire();
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

// POST with retries on network errors and 429/5xx. Anything else comes back
// for the caller to judge. Without this, one flaky upstream response would
// kill the whole indexer process.
// Optional rateLimiter: if provided, acquires a token before each fetch attempt.
export async function postJson(
  url: string,
  headers: Record<string, string>,
  body: string,
  rateLimiter?: RateLimiter,
): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= TRANSIENT_RETRY_ATTEMPTS; attempt++) {
    let res: Response | null = null;
    try {
      if (rateLimiter) {
        await rateLimiter.acquire();
      }
      res = await fetch(url, { method: 'POST', headers, body });
      if (res.status !== 429 && res.status < 500) {
        return res;
      }
      lastError = new Error(`Request to ${url} failed: ${res.status} ${await res.text()}`);
    } catch (err) {
      lastError = err;
      res = null;
    }
    if (attempt < TRANSIENT_RETRY_ATTEMPTS) {
      await sleep(retryDelayMs(res, attempt));
    }
  }
  throw lastError;
}
