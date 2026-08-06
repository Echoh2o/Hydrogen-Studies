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
import axios, {
  type AxiosError,
  type InternalAxiosRequestConfig,
} from "axios";

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

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Per-host minimum spacing between outbound requests (audit 2026-08). Multiple
 * jobs (enrichment, retraction-monitor, discovery, keyword-monitor) share one
 * Railway egress IP against NCBI E-utilities; unthrottled bursts earn 429s or an
 * IP block. NCBI allows 3 req/s without an api_key, 10 req/s with one.
 */
const HOST_MIN_INTERVAL_MS: Record<string, number> = {
  "eutils.ncbi.nlm.nih.gov": process.env.PUBMED_API_KEY ? 100 : 334,
};

/** Next timestamp (ms) at which a request to a given host may be dispatched. */
const hostNextAvailable = new Map<string, number>();

function hostOf(url: string | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).host;
  } catch {
    return null;
  }
}

/**
 * Request interceptor: serialize/space requests to rate-limited hosts so we stay
 * under the upstream's per-second budget instead of relying on ad-hoc sleeps at
 * each call site.
 */
externalApi.interceptors.request.use(async (config) => {
  const host = hostOf(config.url);
  const interval = host ? HOST_MIN_INTERVAL_MS[host] : undefined;
  if (host && interval) {
    const now = Date.now();
    const earliest = Math.max(now, hostNextAvailable.get(host) ?? 0);
    hostNextAvailable.set(host, earliest + interval);
    const wait = earliest - now;
    if (wait > 0) await sleep(wait);
  }
  return config;
});

/** Max automatic retries on HTTP 429 before surfacing the error. */
const MAX_429_RETRIES = 3;

/**
 * Parse a `Retry-After` header (either delta-seconds or an HTTP date) into a
 * millisecond delay. Returns null when absent/unparseable.
 */
function parseRetryAfterMs(value: unknown): number | null {
  if (typeof value !== "string" || value.trim() === "") return null;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
  const when = Date.parse(value);
  if (!Number.isNaN(when)) return Math.max(0, when - Date.now());
  return null;
}

/**
 * Response interceptor: on HTTP 429, honor `Retry-After` (falling back to
 * capped exponential backoff) and retry a bounded number of times so sustained
 * rate limiting degrades gracefully instead of silently failing a job.
 */
externalApi.interceptors.response.use(undefined, async (error: AxiosError) => {
  const config = error.config as
    | (InternalAxiosRequestConfig & { __retry429Count?: number })
    | undefined;
  if (!config || error.response?.status !== 429) {
    return Promise.reject(error);
  }

  config.__retry429Count = config.__retry429Count ?? 0;
  if (config.__retry429Count >= MAX_429_RETRIES) {
    return Promise.reject(error);
  }
  config.__retry429Count += 1;

  const retryAfter = parseRetryAfterMs(error.response.headers?.["retry-after"]);
  const backoff =
    retryAfter ?? Math.min(1000 * 2 ** (config.__retry429Count - 1), 30_000);
  await sleep(backoff);
  return externalApi(config);
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
