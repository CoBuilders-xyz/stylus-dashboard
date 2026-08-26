import {
  REQUEST_TIMEOUT_MS,
  TRANSIENT_RETRY_ATTEMPTS,
  TRANSIENT_RETRY_DELAY_MS,
} from '../config.js';

export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function hexToNumber(hex: string): number {
  return Number.parseInt(hex, 16);
}

export type PostJsonResult = {
  ok: boolean;
  status: number;
  body: string;
};

// POST with retries on network errors and 429/5xx, backing off a bit more
// each attempt. Anything else comes back for the caller to judge. Without
// this, one flaky upstream response would kill the whole indexer process.
// Each attempt downloads the whole body under one REQUEST_TIMEOUT_MS
// deadline, so a hung connection throws here and gets retried instead of
// stalling the sync forever.
export async function postJson(
  url: string,
  headers: Record<string, string>,
  body: string,
): Promise<PostJsonResult> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= TRANSIENT_RETRY_ATTEMPTS; attempt++) {
    try {
      const res = await fetch(url, {
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
    }
    if (attempt < TRANSIENT_RETRY_ATTEMPTS) {
      await sleep(TRANSIENT_RETRY_DELAY_MS * attempt);
    }
  }
  throw lastError;
}
