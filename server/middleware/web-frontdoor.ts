/**
 * Serve migrated route families from the Next.js `web` service (PLAN Phase 3).
 *
 * Express keeps the public domain (no DNS change) and runs its redirect,
 * excluded-study 410 and rate-limit middleware first; then, for an enabled
 * family, it proxies the GET to Next over Railway's private network and
 * returns Next's server-rendered HTML to EVERY visitor — browsers and
 * crawlers alike (CLAUDE.md: same HTML for all).
 *
 *   WEB_ORIGIN    http://web.railway.internal:8080
 *   SSR_FAMILIES  comma list of keys below; empty = off (instant rollback)
 *
 * Any Next failure (5xx, timeout, unreachable) falls through to the existing
 * SPA / bot-SSR path, so a bad web deploy can't take pages down.
 */
import type { NextFunction, Request, Response } from "express";
import { logger } from "../utils/logger";

export const SSR_FAMILIES: Record<string, RegExp> = {
  study: /^\/study\/[^/]+$/,
  blog: /^\/blog(?:\/[^/]+)?$/,
  hubs: /^\/(?:explore-by-(?:condition|body-system|mechanism|delivery-method|life-stage|benefit|demographic)(?:\/[^/]+)?|hydrogen-for\/[^/]+)$/,
  policy: /^\/(?:editorial-policy|methodology)$/,
  // Shared-component pages (client/src/pages/content/*).
  pages: /^\/(?:about|contact|privacy|terms|disclaimer)$/,
  home: /^\/$/,
};

// content-security-policy: Next sets a per-request nonce CSP (web/middleware.ts)
// that must replace helmet's, or Next's inline bootstrap scripts are blocked.
const PASS_HEADERS = [
  "content-type",
  "cache-control",
  "etag",
  "last-modified",
  "link",
  "x-nextjs-cache",
  "content-security-policy",
];
/** Next's JS/CSS chunks — needed by every migrated page. */
const NEXT_ASSETS = /^\/_next\//;
const TIMEOUT_MS = 15_000;

export function enabledFamilies(env: string | undefined = process.env.SSR_FAMILIES): string[] {
  return (env ?? "")
    .split(",")
    .map((f) => f.trim())
    .filter((f) => f in SSR_FAMILIES);
}

/** The enabled family a path belongs to, or null. */
export function ssrFamilyFor(path: string, families: readonly string[]): string | null {
  return families.find((f) => SSR_FAMILIES[f].test(path)) ?? null;
}

/** Keep redirects on our own host: Next only knows its internal hostname. */
export function localLocation(location: string, origin: string): string {
  try {
    const url = new URL(location, origin);
    const internal = new URL(origin);
    if (url.host === internal.host || /\.railway\.(internal|app)$/.test(url.hostname)) {
      return `${url.pathname}${url.search}`;
    }
    return location;
  } catch {
    return location;
  }
}

export function webFrontDoor() {
  return async (req: Request, res: Response, next: NextFunction) => {
    const origin = process.env.WEB_ORIGIN;
    if (!origin || (req.method !== "GET" && req.method !== "HEAD")) return next();
    // Next's own fallback rewrite proxies unmigrated paths back here; never
    // bounce those to Next again.
    if (req.get("x-from-web")) return next();
    const families = enabledFamilies();
    const family = NEXT_ASSETS.test(req.path) && families.length ? "assets" : ssrFamilyFor(req.path, families);
    if (!family) return next();

    try {
      const upstream = await fetch(`${origin}${req.originalUrl}`, {
        method: req.method,
        redirect: "manual",
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: {
          accept: req.get("accept") ?? "text/html",
          "accept-language": req.get("accept-language") ?? "",
          "user-agent": req.get("user-agent") ?? "",
          "x-forwarded-host": req.get("host") ?? "hydrogenstudies.com",
          "x-forwarded-proto": "https",
          "x-from-express": "1",
        },
      });
      if (upstream.status >= 500) {
        logger.warn("web front door upstream error — serving SPA path", "WebFrontDoor", {
          path: req.path,
          status: upstream.status,
        });
        return next();
      }
      res.status(upstream.status);
      for (const h of PASS_HEADERS) {
        const v = upstream.headers.get(h);
        if (v) res.set(h, v);
      }
      const location = upstream.headers.get("location");
      if (location) res.set("location", localLocation(location, origin));
      res.set("x-served-by", `web:${family}`);
      if (req.method === "HEAD") return res.end();
      res.send(Buffer.from(await upstream.arrayBuffer()));
    } catch (err) {
      logger.warn("web front door unreachable — serving SPA path", "WebFrontDoor", {
        path: req.path,
        error: err instanceof Error ? err.message : String(err),
      });
      next();
    }
  };
}
