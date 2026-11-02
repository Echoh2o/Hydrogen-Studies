import { NextResponse, type NextRequest } from "next/server";

/**
 * Redirects (redirects table, URL hygiene) and 410s, decided by Express
 * (/api/page-data/route-status) so the web service and Express agree. In
 * production Express runs the same checks before proxying here; this keeps
 * direct hits (staging domain) correct too.
 *
 * Also tags every request so Express never proxies Next's own fallback
 * rewrites back to Next (server/middleware/web-frontdoor.ts).
 */
const EXPRESS_ORIGIN = process.env.EXPRESS_ORIGIN || "http://localhost:5000";
const TTL_MS = 60_000;
const cache = new Map<string, { at: number; decision: Decision }>();

type Decision = { kind: "ok" | "gone" | "redirect"; status?: number; location?: string };

const GONE_HTML =
  '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="robots" content="noindex">' +
  "<title>Gone | Hydrogen Studies</title></head><body><h1>This page has been removed</h1>" +
  '<p><a href="/studies">Browse all studies</a></p></body></html>';

/**
 * Same policy as Express's helmet CSP (server/app.ts) — no 'unsafe-inline'
 * scripts — plus a per-request nonce that Next stamps on its own inline
 * bootstrap scripts. Express passes this header through for proxied pages.
 */
function contentSecurityPolicy(nonce: string): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' https://*.googletagmanager.com https://www.google-analytics.com https://analytics.ahrefs.com https://static.cloudflareinsights.com`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: https: blob:",
    "connect-src 'self' https://*.google-analytics.com https://*.analytics.google.com https://*.googletagmanager.com https://api.anthropic.com https://analytics.ahrefs.com https://*.ingest.us.sentry.io https://*.ingest.sentry.io https://cloudflareinsights.com",
    "frame-src 'self' https://www.youtube-nocookie.com https://www.youtube.com",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'self'",
    "script-src-attr 'none'",
    "upgrade-insecure-requests",
  ].join("; ");
}

async function decide(req: NextRequest): Promise<Decision> {
  const key = req.nextUrl.pathname + req.nextUrl.search;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.decision;
  const url = new URL(`${EXPRESS_ORIGIN}/api/page-data/route-status`);
  url.searchParams.set("path", req.nextUrl.pathname);
  if (req.nextUrl.search) url.searchParams.set("search", req.nextUrl.search.slice(1));
  const res = await fetch(url, { headers: { "x-page-data-key": process.env.PAGE_DATA_KEY ?? "" } });
  const decision = (await res.json()) as Decision;
  if (cache.size > 5000) cache.clear();
  cache.set(key, { at: Date.now(), decision });
  return decision;
}

export async function middleware(req: NextRequest) {
  // Requests Express already vetted (it proxied them here) skip the check.
  if (!req.headers.get("x-from-express")) {
    try {
      const decision = await decide(req);
      if (decision.kind === "redirect" && decision.location) {
        return NextResponse.redirect(new URL(decision.location, req.nextUrl), decision.status ?? 301);
      }
      if (decision.kind === "gone") {
        return new NextResponse(GONE_HTML, { status: 410, headers: { "content-type": "text/html; charset=utf-8" } });
      }
    } catch {
      // Express unreachable: render normally rather than fail every page.
    }
  }
  const nonce = btoa(crypto.randomUUID());
  const csp = contentSecurityPolicy(nonce);
  const headers = new Headers(req.headers);
  headers.set("x-from-web", "1");
  headers.set("x-nonce", nonce);
  headers.set("content-security-policy", csp); // Next reads the nonce from here
  const res = NextResponse.next({ request: { headers } });
  res.headers.set("content-security-policy", csp);
  return res;
}

// Page paths only — not Next internals, API, uploads or static files.
export const config = {
  matcher: ["/((?!_next/|api/|uploads/|assets/|proxy/|web_health|web_revalidate|.*\\.[a-zA-Z0-9]+$).*)"],
};
