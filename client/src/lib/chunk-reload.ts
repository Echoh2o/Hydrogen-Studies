/**
 * Detect and recover from stale-chunk errors after a deploy.
 *
 * Vite emits content-hashed JS filenames (e.g. `router-l208XODO.js`). After
 * a new deploy, the user's current HTML shell references OLD filenames that
 * no longer exist on the server. When a lazy import tries to fetch one,
 * the CDN / origin serves `index.html` (text/html) as a fallback and the
 * browser reports "is not a valid JavaScript MIME type" — which then
 * crashes the lazy boundary.
 *
 * Fix: when we see one of these errors, reload once to pick up the new
 * HTML shell (and with it, the new filenames). Guard against infinite
 * loops with a sessionStorage flag that clears after a fresh page load.
 */

const RELOAD_FLAG_KEY = "hs.chunk-reload-attempted";
const RELOAD_FLAG_TTL_MS = 30_000;

const CHUNK_ERROR_PATTERNS = [
  "Failed to fetch dynamically imported module",
  "is not a valid JavaScript MIME type",
  "Loading chunk",
  "Loading CSS chunk",
  "error loading dynamically imported module",
  "Importing a module script failed",
];

export function isChunkLoadError(err: unknown): boolean {
  if (!err) return false;
  const msg =
    err instanceof Error
      ? `${err.name} ${err.message}`
      : typeof err === "string"
        ? err
        : "";
  return CHUNK_ERROR_PATTERNS.some((p) => msg.includes(p));
}

/**
 * If `err` looks like a stale-chunk error and we haven't already tried to
 * reload in the last 30s, reload the page and return true. Otherwise
 * return false so the caller can handle the error normally.
 */
export function reloadOnceForStaleChunk(err: unknown): boolean {
  if (!isChunkLoadError(err)) return false;
  if (typeof window === "undefined") return false;

  try {
    const prev = sessionStorage.getItem(RELOAD_FLAG_KEY);
    if (prev) {
      const age = Date.now() - Number(prev);
      if (age < RELOAD_FLAG_TTL_MS) {
        // Already reloaded recently — don't loop. Let the error surface.
        return false;
      }
    }
    sessionStorage.setItem(RELOAD_FLAG_KEY, String(Date.now()));
  } catch {
    // sessionStorage blocked — skip the reload rather than risk a loop.
    return false;
  }

  // Small delay so any in-flight logging/telemetry flushes.
  setTimeout(() => window.location.reload(), 100);
  return true;
}
