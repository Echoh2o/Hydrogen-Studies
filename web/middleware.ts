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
  const headers = new Headers(req.headers);
  headers.set("x-from-web", "1");
  return NextResponse.next({ request: { headers } });
}

// Page paths only — not Next internals, API, uploads or static files.
export const config = {
  matcher: ["/((?!_next/|api/|uploads/|assets/|proxy/|web_health|.*\\.[a-zA-Z0-9]+$).*)"],
};
