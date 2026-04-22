/**
 * Redirect Service
 *
 * Handles 301/302 redirects with an in-memory cache, 404 logging,
 * and suggestion generation for unresolved 404 paths.
 */

import { db } from "../db";
import { redirects, notFoundLog, studies, blogArticles, healthConditions } from "@shared/schema";
import type { RedirectSuggestion } from "@shared/schema";
import { eq, sql, desc, and } from "drizzle-orm";
import { logger } from "../utils/logger";
import type { Request, Response, NextFunction } from "express";

const TAG = "RedirectService";

// ── One-time schema / index setup (idempotent, runs on boot) ─────
//
// Enables pg_trgm for similarity scoring, adds GIN trigram indexes to
// the columns we search, and adds the `suggestions` JSONB column
// that backs the ranked-candidate UI.
let ensureTrgmPromise: Promise<void> | null = null;
export function ensureRedirectIndexes(): Promise<void> {
  if (ensureTrgmPromise) return ensureTrgmPromise;
  ensureTrgmPromise = (async () => {
    let hadRequiredFailure = false;
    // suggestions column is required — must not be swallowed
    try {
      await db.execute(sql`ALTER TABLE not_found_log ADD COLUMN IF NOT EXISTS suggestions jsonb`);
    } catch (err) {
      hadRequiredFailure = true;
      logger.error("Failed to add not_found_log.suggestions column", err, TAG);
    }
    // pg_trgm + GIN indexes are a perf optimization; tolerate failure
    // (some hosted Postgres roles can't CREATE EXTENSION).
    try {
      await db.execute(sql`CREATE EXTENSION IF NOT EXISTS pg_trgm`);
      await db.execute(sql`CREATE INDEX IF NOT EXISTS studies_slug_trgm_idx ON studies USING GIN (slug gin_trgm_ops)`);
      await db.execute(sql`CREATE INDEX IF NOT EXISTS studies_title_trgm_idx ON studies USING GIN (LOWER(title) gin_trgm_ops)`);
      await db.execute(sql`CREATE INDEX IF NOT EXISTS studies_plt_trgm_idx ON studies USING GIN (LOWER(plain_language_title) gin_trgm_ops)`);
      await db.execute(sql`CREATE INDEX IF NOT EXISTS blog_articles_slug_trgm_idx ON blog_articles USING GIN (slug gin_trgm_ops)`);
      await db.execute(sql`CREATE INDEX IF NOT EXISTS blog_articles_title_trgm_idx ON blog_articles USING GIN (LOWER(title) gin_trgm_ops)`);
      await db.execute(sql`CREATE INDEX IF NOT EXISTS health_conditions_slug_trgm_idx ON health_conditions USING GIN (slug gin_trgm_ops)`);
      await db.execute(sql`CREATE INDEX IF NOT EXISTS health_conditions_name_trgm_idx ON health_conditions USING GIN (LOWER(name) gin_trgm_ops)`);
      logger.info("Redirect trigram indexes ensured", TAG);
    } catch (err) {
      logger.warn("pg_trgm setup failed; falling back to sequential scans", TAG, { err: (err as Error).message });
    }

    // If the required ALTER failed, reset the cached promise so a later
    // boot can retry. A transient DB issue on first boot shouldn't
    // permanently disable the suggestions feature.
    if (hadRequiredFailure) {
      ensureTrgmPromise = null;
    }
  })();
  return ensureTrgmPromise;
}

// ── In-memory redirect cache ─────────────────────────────────

interface CachedRedirect {
  toPath: string;
  statusCode: number;
  id: number;
}

let redirectCache: Map<string, CachedRedirect> = new Map();
let cacheLoadedAt = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

async function loadCache(): Promise<void> {
  try {
    const rows = await db
      .select({
        id: redirects.id,
        fromPath: redirects.fromPath,
        toPath: redirects.toPath,
        statusCode: redirects.statusCode,
      })
      .from(redirects)
      .where(eq(redirects.isActive, true));

    const newCache = new Map<string, CachedRedirect>();
    for (const row of rows) {
      newCache.set(row.fromPath.toLowerCase(), {
        toPath: row.toPath,
        statusCode: row.statusCode,
        id: row.id,
      });
    }
    redirectCache = newCache;
    cacheLoadedAt = Date.now();
    logger.info("Redirect cache loaded", TAG, { entries: newCache.size });
  } catch (error) {
    logger.error("Failed to load redirect cache", error, TAG);
  }
}

function isCacheStale(): boolean {
  return Date.now() - cacheLoadedAt > CACHE_TTL_MS;
}

/** Force-refresh the cache (call after CRUD operations) */
export async function invalidateRedirectCache(): Promise<void> {
  await loadCache();
}

// ── Express middleware ────────────────────────────────────────

/**
 * Middleware that intercepts requests and issues redirects if a match exists.
 * Mount early in the middleware chain (before routes).
 */
export function redirectMiddleware() {
  // Load cache on first request
  let initialLoadDone = false;

  return async (req: Request, res: Response, next: NextFunction) => {
    // Only check GET/HEAD requests
    if (req.method !== "GET" && req.method !== "HEAD") {
      return next();
    }

    // Skip API routes, assets, and health checks
    const path = req.path;
    if (
      path.startsWith("/api/") ||
      path.startsWith("/assets/") ||
      path.startsWith("/src/") ||
      path === "/health" ||
      path === "/favicon.ico"
    ) {
      return next();
    }

    // Lazy-load cache
    if (!initialLoadDone || isCacheStale()) {
      await loadCache();
      initialLoadDone = true;
    }

    const normalizedPath = path.toLowerCase().replace(/\/+$/, "") || "/";
    const match = redirectCache.get(normalizedPath);

    if (match) {
      // Bump hit count asynchronously (don't block the redirect)
      db.update(redirects)
        .set({
          hitCount: sql`${redirects.hitCount} + 1`,
          lastHitAt: new Date(),
        })
        .where(eq(redirects.id, match.id))
        .catch((err) => logger.error("Failed to update redirect hit count", err, TAG));

      res.redirect(match.statusCode, match.toPath);
      return;
    }

    next();
  };
}

// ── 404 logging ──────────────────────────────────────────────

/**
 * Log a 404 occurrence. Call this from your 404 handler.
 * Uses upsert to increment hit_count for repeat paths.
 */
export async function log404(path: string, referrer?: string): Promise<void> {
  const normalizedPath = path.toLowerCase().replace(/\/+$/, "") || "/";

  // Skip paths that are too long (prevent storage abuse) or the homepage
  if (normalizedPath.length > 500 || normalizedPath === "/") return;

  // Skip noise: assets, source maps, bots probing common paths
  if (
    normalizedPath.match(/\.(js|css|map|png|jpg|jpeg|gif|svg|ico|woff2?|ttf|eot)$/) ||
    normalizedPath.startsWith("/api/") ||
    normalizedPath.startsWith("/.env") ||
    normalizedPath.startsWith("/wp-") ||
    normalizedPath.startsWith("/phpmy") ||
    (normalizedPath.startsWith("/admin") && !normalizedPath.startsWith("/admin-"))
  ) {
    return;
  }

  try {
    await db.execute(sql`
      INSERT INTO not_found_log (path, referrer, hit_count, first_seen_at, last_seen_at)
      VALUES (${normalizedPath}, ${referrer || null}, 1, NOW(), NOW())
      ON CONFLICT (path)
      DO UPDATE SET
        hit_count = not_found_log.hit_count + 1,
        last_seen_at = NOW(),
        referrer = COALESCE(${referrer || null}, not_found_log.referrer)
    `);
  } catch (error) {
    // Non-critical — don't crash the request
    logger.error("Failed to log 404", error, TAG);
  }
}

// ── Suggestion engine ────────────────────────────────────────
//
// Given a 404 path, return a ranked list of likely-intended targets
// across studies, blog articles, and health conditions.
//
// Signals:
//   • Exact slug match (score 1.0) — skip all other work
//   • Trigram similarity on slug / title / plainLanguageTitle (weighted)
//   • Token overlap with tags[], keywords[], health_conditions[],
//     body_systems[], semantic_keywords[]
//   • Path-prefix bias — /blog/* → boost blog candidates, etc.
//   • Popularity bias — rows with higher view_count break ties
//
// Returns up to TOP_N candidates with per-signal reasons so the admin
// UI can display *why* something matched instead of a black-box guess.

const TOP_N = 5;
const MIN_TRGM_THRESHOLD = 0.12; // candidate floor; anything below this is noise
const MIN_OVERALL_SCORE = 0.18; // top candidate must clear this or we return []

/** Boilerplate path segments we strip before tokenizing. */
const PATH_NOISE_SEGMENTS = new Set([
  "studies", "study", "blog", "blogs", "article", "articles", "post", "posts",
  "category", "categories", "tag", "tags", "condition", "conditions",
  "tools", "hydrogen-research", "research", "page", "pages", "index",
]);

/** Extremely common English words we don't want dominating similarity. */
const STOPWORDS = new Set([
  "a", "an", "the", "of", "and", "or", "for", "to", "in", "on", "at",
  "with", "without", "by", "from", "is", "are", "was", "were", "be",
]);

function reconstructQuery(path: string): {
  query: string;
  tokens: string[];
  pathHint: "study" | "blog" | "condition" | null;
  lastSegment: string;
} {
  const normalized = path.toLowerCase().replace(/\/+$/, "") || "/";
  const segments = normalized.split("/").filter(Boolean);

  // Detect intent from URL prefix before we strip noise segments
  let pathHint: "study" | "blog" | "condition" | null = null;
  const joined = "/" + segments.join("/");
  if (/^\/(studies|study)(\/|$)/.test(joined)) pathHint = "study";
  else if (/^\/(blog|blogs|article|articles|post|posts)(\/|$)/.test(joined)) pathHint = "blog";
  else if (/(^|\/)(condition|conditions)(\/|$)/.test(joined)) pathHint = "condition";

  const lastSegment = segments[segments.length - 1] || "";

  // Keep only segments that carry meaning; drop noise + numeric IDs + dates
  const meaningful = segments.filter((s) => {
    if (PATH_NOISE_SEGMENTS.has(s)) return false;
    if (/^\d+$/.test(s)) return false; // pure numeric (IDs, years)
    if (/^\d{4}-\d{2}(-\d{2})?$/.test(s)) return false; // dates
    return true;
  });

  // Tokenize: split on - _ . and whitespace, strip file extensions, drop stopwords
  const raw = meaningful.join(" ").replace(/\.(html|htm|php|aspx?)$/g, "");
  const tokens = raw
    .split(/[-_\s./]+/)
    .map((t) => t.trim().toLowerCase())
    .filter((t) => t.length >= 3 && !STOPWORDS.has(t) && !/^\d+$/.test(t));

  const query = tokens.join(" ");
  return { query, tokens, pathHint, lastSegment };
}

/** Count how many query tokens appear anywhere in a set of array-ish fields. */
function tokenOverlap(tokens: string[], fields: Array<string[] | null | undefined>): number {
  if (tokens.length === 0) return 0;
  const haystack = new Set<string>();
  for (const field of fields) {
    if (!field) continue;
    for (const val of field) {
      if (!val) continue;
      for (const w of String(val).toLowerCase().split(/[-_\s./]+/)) {
        if (w.length >= 3) haystack.add(w);
      }
    }
  }
  let hits = 0;
  for (const t of tokens) if (haystack.has(t)) hits++;
  return hits;
}

function popularityBonus(viewCount: number | null | undefined): number {
  const v = viewCount ?? 0;
  if (v <= 0) return 0;
  return Math.min(0.05, Math.log10(v + 1) / 60); // ~0.02 at 10 views, capped at 0.05
}

/** Public entry point — returns ranked candidates for a 404 path. */
export async function getRankedSuggestions(path: string): Promise<RedirectSuggestion[]> {
  const { query, tokens, pathHint, lastSegment } = reconstructQuery(path);

  // ── 1. Exact slug match short-circuit ───────────────────────
  if (lastSegment.length >= 3) {
    const [s] = await db.select({ slug: studies.slug, title: studies.title, plt: studies.plainLanguageTitle })
      .from(studies).where(eq(studies.slug, lastSegment)).limit(1);
    if (s?.slug) {
      return [{
        target: `/studies/${s.slug}`,
        contentType: "study",
        title: s.plt ?? s.title ?? null,
        score: 1,
        reasons: ["exact slug match"],
      }];
    }
    const [c] = await db.select({ slug: healthConditions.slug, name: healthConditions.name })
      .from(healthConditions).where(eq(healthConditions.slug, lastSegment)).limit(1);
    if (c?.slug) {
      return [{
        target: `/tools/hydrogen-research/condition/${c.slug}`,
        contentType: "condition",
        title: c.name ?? null,
        score: 1,
        reasons: ["exact slug match"],
      }];
    }
    const [b] = await db.select({ slug: blogArticles.slug, title: blogArticles.title })
      .from(blogArticles).where(eq(blogArticles.slug, lastSegment)).limit(1);
    if (b?.slug) {
      return [{
        target: `/blog/${b.slug}`,
        contentType: "blog",
        title: b.title ?? null,
        score: 1,
        reasons: ["exact slug match"],
      }];
    }
  }

  if (!query || tokens.length === 0) return [];

  // ── 2. Trigram candidate pools ──────────────────────────────
  //
  // We deliberately score multiple fields and keep the max — a bad slug
  // shouldn't blacklist a row whose title is a near-perfect match.
  await ensureRedirectIndexes().catch(() => {});

  const candidates: RedirectSuggestion[] = [];

  // -- Studies
  try {
    const studyRows = await db.execute<{
      slug: string | null;
      title: string | null;
      plt: string | null;
      tags: string[] | null;
      keywords: string[] | null;
      health_conditions: string[] | null;
      body_systems: string[] | null;
      semantic_keywords: string[] | null;
      view_count: number | null;
      slug_sim: number;
      title_sim: number;
      plt_sim: number;
    }>(sql`
      SELECT slug, title, plain_language_title AS plt,
             tags, keywords, health_conditions, body_systems, semantic_keywords, view_count,
             similarity(COALESCE(slug, ''), ${query}) AS slug_sim,
             similarity(LOWER(COALESCE(title, '')), ${query}) AS title_sim,
             similarity(LOWER(COALESCE(plain_language_title, '')), ${query}) AS plt_sim
      FROM studies
      WHERE slug IS NOT NULL
        AND (
          similarity(COALESCE(slug, ''), ${query}) > ${MIN_TRGM_THRESHOLD}
          OR similarity(LOWER(COALESCE(title, '')), ${query}) > ${MIN_TRGM_THRESHOLD}
          OR similarity(LOWER(COALESCE(plain_language_title, '')), ${query}) > ${MIN_TRGM_THRESHOLD}
        )
      ORDER BY GREATEST(
        similarity(COALESCE(slug, ''), ${query}),
        similarity(LOWER(COALESCE(title, '')), ${query}),
        similarity(LOWER(COALESCE(plain_language_title, '')), ${query})
      ) DESC
      LIMIT 15
    `);

    const rows = (studyRows as any).rows ?? studyRows;
    for (const r of rows as any[]) {
      const slugSim = Number(r.slug_sim) || 0;
      const titleSim = Number(r.title_sim) || 0;
      const pltSim = Number(r.plt_sim) || 0;
      const overlap = tokenOverlap(tokens, [r.tags, r.keywords, r.health_conditions, r.body_systems, r.semantic_keywords]);
      const overlapBonus = Math.min(0.20, overlap * 0.05);
      const prefixBonus = pathHint === "study" ? 0.12 : 0;
      const popBonus = popularityBonus(r.view_count);

      // Weighted trigram: slug > plain-language-title > academic title
      const trgm = Math.max(slugSim * 0.45, pltSim * 0.42, titleSim * 0.35);
      const score = Math.min(1, trgm + overlapBonus + prefixBonus + popBonus);

      const reasons: string[] = [];
      const bestSim = Math.max(slugSim, titleSim, pltSim);
      if (slugSim === bestSim && slugSim > 0.15) reasons.push(`${Math.round(slugSim * 100)}% slug match`);
      else if (pltSim === bestSim && pltSim > 0.15) reasons.push(`${Math.round(pltSim * 100)}% plain-title match`);
      else if (titleSim > 0.15) reasons.push(`${Math.round(titleSim * 100)}% title match`);
      if (overlap > 0) reasons.push(`${overlap} tag/keyword hit${overlap === 1 ? "" : "s"}`);
      if (prefixBonus > 0) reasons.push("URL path hint: /studies");

      candidates.push({
        target: `/studies/${r.slug}`,
        contentType: "study",
        title: r.plt || r.title || null,
        score,
        reasons,
      });
    }
  } catch (err) {
    logger.error("Study trigram query failed", err, TAG);
  }

  // -- Blog articles
  try {
    const blogRows = await db.execute<{
      slug: string;
      title: string;
      summary: string | null;
      semantic_keywords: string[] | null;
      view_count: number | null;
      slug_sim: number;
      title_sim: number;
      summary_sim: number;
    }>(sql`
      SELECT slug, title, summary, semantic_keywords, view_count,
             similarity(slug, ${query}) AS slug_sim,
             similarity(LOWER(title), ${query}) AS title_sim,
             similarity(LOWER(COALESCE(summary, '')), ${query}) AS summary_sim
      FROM blog_articles
      WHERE is_published = true
        AND (
          similarity(slug, ${query}) > ${MIN_TRGM_THRESHOLD}
          OR similarity(LOWER(title), ${query}) > ${MIN_TRGM_THRESHOLD}
          OR similarity(LOWER(COALESCE(summary, '')), ${query}) > ${MIN_TRGM_THRESHOLD}
        )
      ORDER BY GREATEST(
        similarity(slug, ${query}),
        similarity(LOWER(title), ${query})
      ) DESC
      LIMIT 10
    `);

    const rows = (blogRows as any).rows ?? blogRows;
    for (const r of rows as any[]) {
      const slugSim = Number(r.slug_sim) || 0;
      const titleSim = Number(r.title_sim) || 0;
      const summarySim = Number(r.summary_sim) || 0;
      const overlap = tokenOverlap(tokens, [r.semantic_keywords]);
      const overlapBonus = Math.min(0.15, overlap * 0.05);
      const prefixBonus = pathHint === "blog" ? 0.12 : 0;
      const popBonus = popularityBonus(r.view_count);

      const trgm = Math.max(slugSim * 0.45, titleSim * 0.42, summarySim * 0.25);
      const score = Math.min(1, trgm + overlapBonus + prefixBonus + popBonus);

      const reasons: string[] = [];
      if (slugSim > 0.15) reasons.push(`${Math.round(slugSim * 100)}% slug match`);
      else if (titleSim > 0.15) reasons.push(`${Math.round(titleSim * 100)}% title match`);
      if (overlap > 0) reasons.push(`${overlap} keyword hit${overlap === 1 ? "" : "s"}`);
      if (prefixBonus > 0) reasons.push("URL path hint: /blog");

      candidates.push({
        target: `/blog/${r.slug}`,
        contentType: "blog",
        title: r.title ?? null,
        score,
        reasons,
      });
    }
  } catch (err) {
    logger.error("Blog trigram query failed", err, TAG);
  }

  // -- Health conditions
  try {
    const condRows = await db.execute<{
      slug: string;
      name: string;
      description: string | null;
      slug_sim: number;
      name_sim: number;
      desc_sim: number;
    }>(sql`
      SELECT slug, name, description,
             similarity(slug, ${query}) AS slug_sim,
             similarity(LOWER(name), ${query}) AS name_sim,
             similarity(LOWER(COALESCE(description, '')), ${query}) AS desc_sim
      FROM health_conditions
      WHERE similarity(slug, ${query}) > ${MIN_TRGM_THRESHOLD}
         OR similarity(LOWER(name), ${query}) > ${MIN_TRGM_THRESHOLD}
         OR similarity(LOWER(COALESCE(description, '')), ${query}) > ${MIN_TRGM_THRESHOLD}
      ORDER BY GREATEST(
        similarity(slug, ${query}),
        similarity(LOWER(name), ${query})
      ) DESC
      LIMIT 10
    `);

    const rows = (condRows as any).rows ?? condRows;
    for (const r of rows as any[]) {
      const slugSim = Number(r.slug_sim) || 0;
      const nameSim = Number(r.name_sim) || 0;
      const descSim = Number(r.desc_sim) || 0;
      const prefixBonus = pathHint === "condition" ? 0.15 : 0;

      const trgm = Math.max(slugSim * 0.45, nameSim * 0.45, descSim * 0.20);
      const score = Math.min(1, trgm + prefixBonus);

      const reasons: string[] = [];
      if (nameSim > 0.15) reasons.push(`${Math.round(nameSim * 100)}% condition-name match`);
      else if (slugSim > 0.15) reasons.push(`${Math.round(slugSim * 100)}% slug match`);
      if (prefixBonus > 0) reasons.push("URL path hint: /condition");

      candidates.push({
        target: `/tools/hydrogen-research/condition/${r.slug}`,
        contentType: "condition",
        title: r.name ?? null,
        score,
        reasons,
      });
    }
  } catch (err) {
    logger.error("Condition trigram query failed", err, TAG);
  }

  // ── 3. Rank, de-dup, trim ───────────────────────────────────
  candidates.sort((a, b) => b.score - a.score);

  const seen = new Set<string>();
  const ranked: RedirectSuggestion[] = [];
  for (const c of candidates) {
    if (seen.has(c.target)) continue;
    seen.add(c.target);
    ranked.push(c);
    if (ranked.length >= TOP_N) break;
  }

  // If even the best candidate is weak, return nothing — surfacing a low-
  // confidence suggestion encourages admins to accept garbage. Soft-404 to
  // homepage is also not the answer.
  if (ranked.length === 0 || ranked[0].score < MIN_OVERALL_SCORE) return [];

  return ranked;
}

/**
 * Back-compat shim — returns only the top candidate's path as a string.
 * New code should prefer `getRankedSuggestions`.
 */
export async function suggestRedirectTarget(path: string): Promise<string | null> {
  const ranked = await getRankedSuggestions(path);
  return ranked[0]?.target ?? null;
}

/**
 * Backfill ranked suggestions for unresolved 404 entries. Prioritizes
 * entries that have the most hits, since those cost the most SEO value.
 *
 * Re-runs for any entry whose `suggestions` column is null, so calling this
 * after deploying a new algorithm will refresh the sparse ones without
 * touching already-curated entries. Pass `force: true` to re-score all
 * unresolved 404s (e.g. after a content import).
 */
export async function backfillSuggestions(
  limit: number = 50,
  opts: { force?: boolean } = {},
): Promise<{ processed: number; suggested: number }> {
  await ensureRedirectIndexes().catch(() => {});

  const conditions = [eq(notFoundLog.resolved, false)];
  if (!opts.force) {
    conditions.push(sql`${notFoundLog.suggestions} IS NULL`);
  }

  const entries = await db
    .select({ id: notFoundLog.id, path: notFoundLog.path })
    .from(notFoundLog)
    .where(and(...conditions))
    .orderBy(desc(notFoundLog.hitCount))
    .limit(limit);

  let suggested = 0;
  for (const entry of entries) {
    const ranked = await getRankedSuggestions(entry.path);
    await db
      .update(notFoundLog)
      .set({
        suggestions: ranked,
        // keep suggestedTarget in sync with the top pick for back-compat
        suggestedTarget: ranked[0]?.target ?? null,
      })
      .where(eq(notFoundLog.id, entry.id));
    if (ranked.length > 0) suggested++;
  }

  return { processed: entries.length, suggested };
}

// ── CRUD helpers (used by admin routes) ──────────────────────

/**
 * Assert that a redirect target is a strict same-site absolute path.
 *
 * A naïve `startsWith("/")` check accepts protocol-relative URLs like
 * `//evil.com/phish` — browsers treat those as external, so an admin
 * mistake (or compromised admin account) could turn the redirect
 * middleware into an open redirector. Reject those explicitly.
 */
function assertSameSitePath(toPath: string): void {
  if (typeof toPath !== "string" || toPath.length === 0) {
    throw new Error("Redirect target is required");
  }
  if (!toPath.startsWith("/")) {
    throw new Error("Redirect target must be a same-site absolute path starting with /");
  }
  // Protocol-relative (//evil.com) and backslash tricks (/\\evil.com) both
  // resolve externally in browsers. Block both.
  if (toPath.startsWith("//") || toPath.startsWith("/\\") || toPath.startsWith("/ ")) {
    throw new Error("Redirect target must be a same-site absolute path (no //external or /\\ prefixes)");
  }
  // Reject anything containing a raw scheme — defense in depth against
  // values like "/https://evil.com" that some downstream handlers could
  // mis-parse. Pure paths never contain "://".
  if (/:\/\//.test(toPath)) {
    throw new Error("Redirect target must not contain a URL scheme");
  }
}

export async function listRedirects() {
  return db
    .select()
    .from(redirects)
    .orderBy(desc(redirects.hitCount));
}

export async function createRedirect(fromPath: string, toPath: string, statusCode = 301, note?: string) {
  // Validate *before* doing any loop/self-redirect work so we never even
  // consider an external URL as a valid target.
  assertSameSitePath(toPath);

  const normalized = fromPath.toLowerCase().replace(/\/+$/, "") || "/";
  const normalizedTo = toPath.replace(/\/+$/, "") || "/";

  // Prevent self-redirects
  if (normalized === normalizedTo.toLowerCase()) {
    throw new Error("Cannot redirect a path to itself");
  }

  // Prevent redirect loops (check up to 10 hops)
  let current = normalizedTo.toLowerCase();
  for (let i = 0; i < 10; i++) {
    const match = redirectCache.get(current);
    if (!match) break;
    if (match.toPath.toLowerCase().replace(/\/+$/, "") === normalized) {
      throw new Error("This redirect would create a loop");
    }
    current = match.toPath.toLowerCase().replace(/\/+$/, "");
  }

  const [row] = await db
    .insert(redirects)
    .values({ fromPath: normalized, toPath, statusCode, note })
    .returning();

  // Mark matching 404 entry as resolved
  await db
    .update(notFoundLog)
    .set({ resolved: true })
    .where(eq(notFoundLog.path, normalized));

  await invalidateRedirectCache();
  return row;
}

export async function updateRedirect(id: number, data: { toPath?: string; statusCode?: number; isActive?: boolean; note?: string }) {
  // If the caller is changing the target, re-validate. The old code path
  // skipped this entirely — an admin could PUT a redirect with toPath
  // "//evil.com" and bypass the create-time check.
  if (data.toPath !== undefined) {
    assertSameSitePath(data.toPath);
  }

  const [row] = await db
    .update(redirects)
    .set(data)
    .where(eq(redirects.id, id))
    .returning();
  await invalidateRedirectCache();
  return row;
}

export async function deleteRedirect(id: number) {
  await db.delete(redirects).where(eq(redirects.id, id));
  await invalidateRedirectCache();
}

export async function list404s(options: { resolved?: boolean; limit?: number; offset?: number } = {}) {
  const { resolved, limit = 50, offset = 0 } = options;
  const conditions = [];
  if (resolved !== undefined) {
    conditions.push(eq(notFoundLog.resolved, resolved));
  }

  const query = db
    .select()
    .from(notFoundLog)
    .orderBy(desc(notFoundLog.hitCount))
    .limit(limit)
    .offset(offset);

  if (conditions.length > 0) {
    return query.where(and(...conditions));
  }
  return query;
}

export async function resolve404(notFoundId: number, toPath: string, statusCode = 301) {
  // Get the 404 entry
  const [entry] = await db
    .select()
    .from(notFoundLog)
    .where(eq(notFoundLog.id, notFoundId));

  if (!entry) throw new Error("404 entry not found");

  // Create the redirect
  const redirect = await createRedirect(entry.path, toPath, statusCode);

  return { redirect, notFoundEntry: entry };
}
