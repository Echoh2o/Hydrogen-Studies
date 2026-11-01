import { NextResponse, type NextRequest } from "next/server";

/**
 * Redirects (redirects table, URL hygiene) and 410s for routes Next renders.
 * Express makes the decision (/api/page-data/route-status) so both front
 * doors behave identically. Unmigrated routes fall through to Express, which
 * applies its own middleware.
 */
const EXPRESS_ORIGIN = process.env.EXPRESS_ORIGIN || "http://localhost:5000";

const GONE_HTML =
  '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="robots" content="noindex">' +
  "<title>Gone | Hydrogen Studies</title></head><body><h1>This page has been removed</h1>" +
  '<p><a href="/studies">Browse all studies</a></p></body></html>';

export async function middleware(req: NextRequest) {
  const url = new URL(`${EXPRESS_ORIGIN}/api/page-data/route-status`);
  url.searchParams.set("path", req.nextUrl.pathname);
  if (req.nextUrl.search) url.searchParams.set("search", req.nextUrl.search.slice(1));
  try {
    const res = await fetch(url, { headers: { "x-page-data-key": process.env.PAGE_DATA_KEY ?? "" } });
    const decision = (await res.json()) as { kind: string; status?: number; location?: string };
    if (decision.kind === "redirect" && decision.location) {
      return NextResponse.redirect(new URL(decision.location, req.nextUrl), decision.status ?? 301);
    }
    if (decision.kind === "gone") {
      return new NextResponse(GONE_HTML, { status: 410, headers: { "content-type": "text/html; charset=utf-8" } });
    }
  } catch {
    // Express unreachable: render normally rather than fail every page.
  }
  return NextResponse.next();
}

// Migrated route families only.
export const config = { matcher: ["/study/:path*"] };
