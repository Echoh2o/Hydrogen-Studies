/**
 * Client-side CSRF token plumbing.
 *
 * The server uses a double-submit scheme: it emits the plaintext token in the
 * `X-CSRF-Token` response header on GET /api/* responses (the matching hashed
 * value lives in an httpOnly cookie the browser sends automatically). For a
 * mutating request to pass, the client must echo that plaintext token back in
 * the `x-csrf-token` request header.
 *
 * Rather than thread this through ~117 separate `fetch()` call sites, we patch
 * `window.fetch` once: every response refreshes the cached token, and every
 * same-origin mutating request gets the header attached. This is what makes
 * server-side CSRF enforcement actually work for the whole app.
 */

const CSRF_HEADER = "x-csrf-token";
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

let csrfToken: string | null = null;

function isSameOrigin(input: RequestInfo | URL): boolean {
  try {
    const url =
      typeof input === "string"
        ? new URL(input, window.location.href)
        : input instanceof URL
        ? input
        : new URL((input as Request).url, window.location.href);
    return url.origin === window.location.origin;
  } catch {
    // Relative string that failed to parse — treat as same-origin.
    return true;
  }
}

export function installCsrfInterceptor(): void {
  if (typeof window === "undefined" || (window as any).__csrfInstalled) return;
  (window as any).__csrfInstalled = true;

  const nativeFetch = window.fetch.bind(window);

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const method = (init?.method || (input instanceof Request ? input.method : "GET")).toUpperCase();

    if (csrfToken && !SAFE_METHODS.has(method) && isSameOrigin(input)) {
      const headers = new Headers(
        init?.headers || (input instanceof Request ? input.headers : undefined),
      );
      if (!headers.has(CSRF_HEADER)) headers.set(CSRF_HEADER, csrfToken);
      init = { ...init, headers };
    }

    const res = await nativeFetch(input, init);

    // Refresh the cached token from any response that carries it.
    const fresh = res.headers.get("X-CSRF-Token");
    if (fresh) csrfToken = fresh;

    return res;
  };

  // Prime the token with a lightweight GET so the first mutation isn't sent
  // before any GET response has populated it. Must hit a REAL /api/* GET route
  // (the CSRF token is attached to GET /api/* responses); the old target
  // /api/stats does not exist and 404'd on every page load.
  void nativeFetch("/api/auth/check-session", { credentials: "include" })
    .then((res) => {
      const fresh = res.headers.get("X-CSRF-Token");
      if (fresh) csrfToken = fresh;
    })
    .catch(() => {
      /* priming is best-effort; subsequent GETs will populate the token */
    });
}
