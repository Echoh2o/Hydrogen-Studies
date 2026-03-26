/**
 * Redirect Service
 *
 * Handles 301/302 redirects with an in-memory cache, 404 logging,
 * and suggestion generation for unresolved 404 paths.
 */

import { db } from "../db";
import { redirects, notFoundLog, studies, blogArticles, healthConditions } from "@shared/schema";
import { eq, sql, desc, and } from "drizzle-orm";
import { logger } from "../utils/logger";
import type { Request, Response, NextFunction } from "express";

const TAG = "RedirectService";

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

/**
 * For a given 404 path, find the most likely intended destination
 * by fuzzy-matching against study slugs, condition slugs, and blog slugs.
 */
export async function suggestRedirectTarget(path: string): Promise<string | null> {
  const normalizedPath = path.toLowerCase().replace(/\/+$/, "") || "/";

  // Extract the last meaningful segment (e.g., "/study/some-slug" → "some-slug")
  const segments = normalizedPath.split("/").filter(Boolean);
  const lastSegment = segments[segments.length - 1] || "";
  if (!lastSegment || lastSegment.length < 3) return null;

  // Try exact slug match first (fastest)
  const exactStudy = await db
    .select({ slug: studies.slug })
    .from(studies)
    .where(eq(studies.slug, lastSegment))
    .limit(1);

  if (exactStudy.length > 0 && exactStudy[0].slug) {
    return `/studies/${exactStudy[0].slug}`;
  }

  const exactCondition = await db
    .select({ slug: healthConditions.slug })
    .from(healthConditions)
    .where(eq(healthConditions.slug, lastSegment))
    .limit(1);

  if (exactCondition.length > 0 && exactCondition[0].slug) {
    return `/tools/hydrogen-research/condition/${exactCondition[0].slug}`;
  }

  const exactBlog = await db
    .select({ slug: blogArticles.slug })
    .from(blogArticles)
    .where(eq(blogArticles.slug, lastSegment))
    .limit(1);

  if (exactBlog.length > 0 && exactBlog[0].slug) {
    return `/blog/${exactBlog[0].slug}`;
  }

  // Fuzzy match: use trigram similarity via pg_trgm if available,
  // otherwise fall back to LIKE with the key words from the slug
  const keywords = lastSegment.split(/[-_]/).filter((w) => w.length > 2);
  if (keywords.length === 0) return null;

  // Build a LIKE pattern from the longest keyword
  const longestKeyword = keywords.sort((a, b) => b.length - a.length)[0];

  const fuzzyStudy = await db
    .select({ slug: studies.slug })
    .from(studies)
    .where(sql`${studies.slug} ILIKE ${"%" + longestKeyword + "%"}`)
    .limit(1);

  if (fuzzyStudy.length > 0 && fuzzyStudy[0].slug) {
    return `/studies/${fuzzyStudy[0].slug}`;
  }

  const fuzzyBlog = await db
    .select({ slug: blogArticles.slug })
    .from(blogArticles)
    .where(sql`${blogArticles.slug} ILIKE ${"%" + longestKeyword + "%"}`)
    .limit(1);

  if (fuzzyBlog.length > 0 && fuzzyBlog[0].slug) {
    return `/blog/${fuzzyBlog[0].slug}`;
  }

  return null;
}

/**
 * Backfill suggestions for all unresolved 404 entries that don't have one yet.
 * Call periodically or on-demand from admin.
 */
export async function backfillSuggestions(limit: number = 50): Promise<{ processed: number; suggested: number }> {
  const entries = await db
    .select({ id: notFoundLog.id, path: notFoundLog.path })
    .from(notFoundLog)
    .where(
      and(
        eq(notFoundLog.resolved, false),
        sql`${notFoundLog.suggestedTarget} IS NULL`,
      ),
    )
    .orderBy(desc(notFoundLog.hitCount))
    .limit(limit);

  let suggested = 0;
  for (const entry of entries) {
    const target = await suggestRedirectTarget(entry.path);
    if (target) {
      await db
        .update(notFoundLog)
        .set({ suggestedTarget: target })
        .where(eq(notFoundLog.id, entry.id));
      suggested++;
    }
  }

  return { processed: entries.length, suggested };
}

// ── CRUD helpers (used by admin routes) ──────────────────────

export async function listRedirects() {
  return db
    .select()
    .from(redirects)
    .orderBy(desc(redirects.hitCount));
}

export async function createRedirect(fromPath: string, toPath: string, statusCode = 301, note?: string) {
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

  // Validate toPath is a relative path (prevent open redirects)
  if (!toPath.startsWith("/")) {
    throw new Error("Redirect target must be a relative path starting with /");
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
