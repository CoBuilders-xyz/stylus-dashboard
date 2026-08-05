import { TRANSIENT_RETRY_ATTEMPTS, TRANSIENT_RETRY_DELAY_MS } from '../config.js';

export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function hexToNumber(hex: string): number {
  return Number.parseInt(hex, 16);
}

// POST with retries on network errors and 429/5xx, backing off a bit more
// each attempt. Anything else comes back for the caller to judge. Without
// this, one flaky upstream response would kill the whole indexer process.
export async function postJson(
  url: string,
  headers: Record<string, string>,
  body: string,
): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= TRANSIENT_RETRY_ATTEMPTS; attempt++) {
    try {
      const res = await fetch(url, { method: 'POST', headers, body });
      if (res.status === 429 || res.status >= 500) {
        lastError = new Error(`Request to ${url} failed: ${res.status} ${await res.text()}`);
      } else {
        return res;
      }
    } catch (err) {
      lastError = err;
    }
    if (attempt < TRANSIENT_RETRY_ATTEMPTS) {
      await sleep(TRANSIENT_RETRY_DELAY_MS * attempt);
    }
  }
  throw lastError;
}
