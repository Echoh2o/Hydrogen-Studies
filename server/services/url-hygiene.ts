/**
 * URL hygiene — canonical-path normalization and legacy search-link mapping.
 *
 * Runs inside redirectMiddleware() (redirect-service.ts), AFTER the redirects
 * table lookup, so a legacy `/Study/Old-Slug/` resolves straight to its final
 * URL in one hop (the table is keyed on the lowercase, no-trailing-slash
 * path), and only paths with no table row fall through to the plain
 * case/trailing-slash 301 here. Same response for bots and browsers.
 *
 * Measured 2026-09-23: `/about/`, `/About`, `/STUDIES`, `/search/` and every
 * `/study/<slug>/` served Googlebot a hard 404 (browsers got a 200 SPA shell)
 * because nothing normalized case or trailing slashes.
 */
import { db } from "../db";
import { healthConditions } from "@shared/schema";
import { BODY_SYSTEM_HUBS, MECHANISM_HUB_SLUGS } from "../utils/explore-hubs";
import { logger } from "../utils/logger";

const TAG = "UrlHygiene";

/**
 * Never normalized: API, build assets, dev-server internals, admin (SPA
 * tooling, not public), the Shopify app proxy, uploaded files (keys are
 * case-sensitive), health probes, and tag-category pages (enum values).
 */
const NORMALIZE_EXCLUDE_RE =
  /^\/(api|assets|src|@[a-z-]+|node_modules|admin|proxy|uploads|images|health|healthz|\.well-known|studies\/tags)(\/|$)/i;

/** Last path segment looks like a file (robots.txt, sitemap.xml, logo.png…). */
const FILE_EXT_RE = /\.[a-z0-9]{1,8}$/i;

/**
 * Canonical form of a path: letters lowercased, percent-escapes uppercased
 * (RFC 3986 canonical hex — so `%2F` in `/study/id%2F123` is left alone and
 * `%e2%80%91` becomes `%E2%80%91`), trailing slashes removed (root stays "/").
 */
export function canonicalizePath(path: string): string {
  const cased = path.replace(/%[0-9a-fA-F]{2}|[^%]+|%/g, (m) =>
    m.length === 3 && m[0] === "%" ? m.toUpperCase() : m.toLowerCase(),
  );
  return cased.replace(/\/+$/, "") || "/";
}

/**
 * The canonical path this request path should 301 to, or null when the path
 * is already canonical or is excluded from normalization.
 */
export function normalizationTarget(path: string): string | null {
  if (!path.startsWith("/")) return null;
  // Protocol-relative (`//evil.com/`) or backslash paths would turn a
  // same-origin Location into an open redirect — never touch them.
  if (path.startsWith("//") || path.includes("\\")) return null;
  if (NORMALIZE_EXCLUDE_RE.test(path)) return null;
  const lastSegment = path.replace(/\/+$/, "").split("/").pop() || "";
  if (FILE_EXT_RE.test(lastSegment)) return null;
  const canonical = canonicalizePath(path);
  return canonical !== path ? canonical : null;
}

/** Raw query string (including the leading "?") from req.originalUrl, or "". */
export function rawQueryOf(originalUrl: string): string {
  const i = originalUrl.indexOf("?");
  return i >= 0 ? originalUrl.slice(i) : "";
}

/** Append a raw query string to a redirect target unless it already has one. */
export function withQuery(target: string, rawQuery: string): string {
  if (!rawQuery || rawQuery === "?" || target.includes("?")) return target;
  return target + rawQuery;
}

// ── Legacy search links (/search/?search=<term>) ─────────────────────

/**
 * Comparison key for a search term or hub name: diacritics stripped,
 * lowercase, non-alphanumerics collapsed to single spaces, "and" dropped —
 * so "Anxiety & Stress", "anxiety and stress" and "anxiety-stress" all key
 * to "anxiety stress".
 */
export function searchTermKey(term: string): string {
  return term
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(" ")
    .filter((w) => w && w !== "and")
    .join(" ");
}

export type HubIndex = Map<string, string>;

/**
 * Build term-key → hub-path. First writer wins, so pass condition hubs first
 * (the DB-backed taxonomy with real editorial pages), then body systems, then
 * delivery mechanisms.
 */
export function buildHubIndex(hubs: Array<{ names: string[]; path: string }>): HubIndex {
  const index: HubIndex = new Map();
  for (const hub of hubs) {
    for (const name of hub.names) {
      const key = searchTermKey(name);
      if (key && !index.has(key)) index.set(key, hub.path);
    }
  }
  return index;
}

/**
 * Where a request to the search page should go, or null to serve it as-is.
 *  - `?search=<term>` whose term exactly names a hub → that hub (query dropped:
 *    the hub is the whole answer; sortBy/perPage were legacy WP params)
 *  - otherwise a non-canonical spelling (`/search/`, `/Search`) → `/search`
 *    with the query string preserved
 * `/search` itself is a live (noindex) page and is never redirected unless the
 * term maps to a hub.
 */
export function resolveSearchRedirect(
  path: string,
  searchParam: unknown,
  rawQuery: string,
  hubIndex: HubIndex,
): string | null {
  if (canonicalizePath(path) !== "/search") return null;
  const term = typeof searchParam === "string" ? searchParam : "";
  const key = term ? searchTermKey(term) : "";
  const hub = key ? hubIndex.get(key) : undefined;
  if (hub) return hub;
  if (path !== "/search") return withQuery("/search", rawQuery);
  return null;
}

// ── Hub index (DB-backed, cached) ────────────────────────────────────

const HUB_INDEX_TTL_MS = 10 * 60 * 1000;
let hubIndexCache: { index: HubIndex; loadedAt: number } | null = null;
let hubIndexLoading: Promise<HubIndex> | null = null;

function staticHubs(): Array<{ names: string[]; path: string }> {
  return [
    ...BODY_SYSTEM_HUBS.map((h) => ({ names: [h.label, h.slug], path: `/explore-by-body-system/${h.slug}` })),
    ...MECHANISM_HUB_SLUGS.map((slug) => ({ names: [slug], path: `/explore-by-mechanism/${slug}` })),
  ];
}

export async function getSearchHubIndex(): Promise<HubIndex> {
  if (hubIndexCache && Date.now() - hubIndexCache.loadedAt < HUB_INDEX_TTL_MS) {
    return hubIndexCache.index;
  }
  if (hubIndexLoading) return hubIndexLoading;
  hubIndexLoading = (async () => {
    try {
      const rows = await db
        .select({ slug: healthConditions.slug, name: healthConditions.name })
        .from(healthConditions);
      const conditionHubs = rows
        .filter((r) => r.slug)
        .map((r) => ({ names: [r.name, r.slug], path: `/explore-by-condition/${r.slug}` }));
      const index = buildHubIndex([...conditionHubs, ...staticHubs()]);
      hubIndexCache = { index, loadedAt: Date.now() };
      return index;
    } catch (err) {
      // Degrade to the static hubs; retry on the next request after TTL.
      logger.error("Failed to load search hub index", err, TAG);
      const index = buildHubIndex(staticHubs());
      hubIndexCache = { index, loadedAt: Date.now() - HUB_INDEX_TTL_MS + 60_000 };
      return index;
    } finally {
      hubIndexLoading = null;
    }
  })();
  return hubIndexLoading;
}

/** Test hook. */
export function resetSearchHubIndexCache(): void {
  hubIndexCache = null;
  hubIndexLoading = null;
}
