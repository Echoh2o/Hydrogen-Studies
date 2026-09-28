/**
 * Excluded studies — the 410 guard for studies with `is_excluded = true`
 * (off-topic hydrogen-ENERGY research; see shared/study-topic-filter.ts and
 * migration 023).
 *
 * Every public URL of an excluded study answers 410 Gone — to bots and
 * browsers alike (CLAUDE.md: same HTML for every client):
 *   /study/<slug>   /studies/<slug>   /study/<id>   /study/id/<id>
 *   /proxy/study/<slug-or-id>  (Shopify App Proxy page)
 *
 * The retirement script also writes status_code=410 rows to the `redirects`
 * table for the same paths (served by redirectMiddleware, which runs first);
 * this guard is the belt-and-braces layer that makes the flag alone
 * sufficient, e.g. for a path variant the table doesn't carry.
 *
 * The excluded set is tiny (tens of rows) and cached in memory with a short
 * TTL, so the guard costs one indexed query per 5 minutes, not per request.
 * Fails open: if the query errors (e.g. the column doesn't exist yet during
 * the first boot, before migration 023 has run) the last known set is kept.
 */
import type { Request, Response, NextFunction } from "express";
import { sql } from "drizzle-orm";
import { db } from "../db";
import { logger } from "../utils/logger";
import { sendGone } from "./redirect-service";

const TAG = "ExcludedStudies";
const CACHE_TTL_MS = 5 * 60 * 1000;

export interface ExcludedStudyKeys {
  ids: Set<number>;
  slugs: Set<string>;
}

let cache: ExcludedStudyKeys = { ids: new Set(), slugs: new Set() };
let loadedAt = 0;
let inflight: Promise<ExcludedStudyKeys> | null = null;

/** Same dash normalization studyService.getStudyBySlug applies. */
function normalizeSlug(slug: string): string {
  let s = slug;
  try {
    s = decodeURIComponent(slug);
  } catch {
    // malformed escape — match on the raw text
  }
  return s.replace(/[‐‑‒–—―﹘﹣－]/g, "-").toLowerCase();
}

async function load(): Promise<ExcludedStudyKeys> {
  try {
    const r = await db.execute(sql`SELECT id, slug FROM studies WHERE is_excluded = true`);
    const next: ExcludedStudyKeys = { ids: new Set(), slugs: new Set() };
    for (const row of (r.rows || []) as Array<{ id: number | string; slug: string | null }>) {
      next.ids.add(Number(row.id));
      if (row.slug) next.slugs.add(normalizeSlug(row.slug));
    }
    cache = next;
    loadedAt = Date.now();
  } catch (err) {
    // Keep serving the last known set; retry on the next request after a
    // short back-off rather than hammering a failing query.
    loadedAt = Date.now() - CACHE_TTL_MS + 30_000;
    logger.warn(`Excluded-study set load failed: ${(err as Error)?.message ?? err}`, TAG);
  }
  return cache;
}

/** Current excluded ids/slugs (cached, refreshed every 5 minutes). */
export async function getExcludedStudyKeys(): Promise<ExcludedStudyKeys> {
  if (Date.now() - loadedAt < CACHE_TTL_MS) return cache;
  if (!inflight) inflight = load().finally(() => (inflight = null));
  return inflight;
}

/** Force a reload on next access (call after flagging/unflagging studies). */
export function invalidateExcludedStudies(): void {
  loadedAt = 0;
}

export type StudyPathKey = { kind: "slug"; slug: string } | { kind: "id"; id: number };

/**
 * Parse a request path into the study it addresses, or null if it isn't a
 * public study URL. Numeric segments are ids (the legacy /study/<id> form).
 */
export function parseStudyPath(path: string): StudyPathKey | null {
  const p = path.replace(/\/+$/, "");
  const m =
    p.match(/^\/study\/id(?:\/|%2f)(\d+)$/i) ||
    p.match(/^\/(?:proxy\/)?study\/([^/]+)$/i) ||
    p.match(/^\/studies\/([^/]+)$/i);
  if (!m) return null;
  const seg = m[1];
  if (/^\d+$/.test(seg)) return { kind: "id", id: parseInt(seg, 10) };
  // /studies/tags is the SPA tag index, not a study
  if (/^\/studies\//i.test(p) && seg.toLowerCase() === "tags") return null;
  return { kind: "slug", slug: normalizeSlug(seg) };
}

/** True when the path is a public URL of an excluded study. */
export async function isExcludedStudyPath(path: string): Promise<boolean> {
  const key = parseStudyPath(path);
  if (!key) return false;
  const { ids, slugs } = await getExcludedStudyKeys();
  if (ids.size === 0 && slugs.size === 0) return false;
  return key.kind === "id" ? ids.has(key.id) : slugs.has(key.slug);
}

/**
 * Express middleware: 410 Gone for any GET/HEAD of an excluded study's page.
 * Mount right after redirectMiddleware() and before the /study/id/:id
 * slug-resolver, the proxy router, the bot middleware and the SPA fallback.
 */
export function excludedStudyGoneMiddleware() {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (req.method !== "GET" && req.method !== "HEAD") return next();
    try {
      if (await isExcludedStudyPath(req.path)) {
        sendGone(res);
        return;
      }
    } catch (err) {
      logger.error("Excluded-study guard failed", err, TAG);
    }
    next();
  };
}
