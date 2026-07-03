/**
 * Shared HTTP helpers enforcing timeouts on outbound calls.
 *
 * Audit finding (2026-07): most external HTTP calls had no timeout. Axios has
 * NO default timeout (a hung upstream hangs the request forever), and bare
 * `fetch` only has undici's ~300s defaults. In route handlers a hung upstream
 * leaves the client with a 504 while the handler keeps running; in background
 * jobs, hung calls wedge in-process sync guards (isRunning flags) indefinitely.
 *
 * All outbound HTTP should go through `externalApi` (axios) or
 * `fetchWithTimeout` (fetch). Call sites that fetch known-large/slow payloads
 * (article HTML, file downloads, paginated bulk APIs) may pass a longer
 * explicit timeout.
 */
import axios from "axios";

/** Cap response/request bodies at 25MB — some routes fetch article HTML/files. */
const MAX_BODY_BYTES = 25 * 1024 * 1024;

export const DEFAULT_TIMEOUT_MS = 10_000;

/**
 * Shared axios instance for external APIs. 10s timeout by default;
 * per-call options (including a longer `timeout`) can override.
 */
export const externalApi = axios.create({
  timeout: DEFAULT_TIMEOUT_MS,
  maxContentLength: MAX_BODY_BYTES,
  maxBodyLength: MAX_BODY_BYTES,
});

/**
 * `fetch` with an enforced timeout (default 10s).
 *
 * If the caller already passes `init.signal`, both signals are honored via
 * `AbortSignal.any` — whichever aborts first wins. On timeout the promise
 * rejects with a `TimeoutError` DOMException (from `AbortSignal.timeout`),
 * which existing catch-all error handling treats like any other fetch failure.
 */
export function fetchWithTimeout(
  url: string | URL,
  init?: RequestInit,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<Response> {
  const timeoutSignal = AbortSignal.timeout(timeoutMs);
  const signal = init?.signal
    ? AbortSignal.any([init.signal, timeoutSignal])
    : timeoutSignal;
  return fetch(url, { ...init, signal });
}
