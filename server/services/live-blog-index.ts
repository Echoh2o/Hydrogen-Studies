/**
 * Cached set of LIVE blog posts (is_published = true AND is_archived = false),
 * used to unwrap in-body links to retired (410) / unpublished posts at render
 * time — both in the bot renderer and in the public blog API that feeds the
 * SPA (shared/content-links.ts does the rewriting).
 *
 * ~53 rows after the Phase 2 consolidation, so one small query per TTL.
 * Fail-open: if the index can't be loaded, every ref counts as live — we
 * never strip links we couldn't verify.
 */

import { db } from "../db";
import { sql } from "drizzle-orm";
import type { IsLiveBlogRef } from "../../shared/content-links";

const TTL_MS = 10 * 60 * 1000;

let cache: { refs: Set<string>; at: number } | null = null;
let inflight: Promise<Set<string> | null> | null = null;

async function loadLiveRefs(): Promise<Set<string> | null> {
  try {
    const r = await db.execute(sql`
      SELECT id, slug FROM blog_articles
      WHERE is_published = true AND is_archived = false
    `);
    const refs = new Set<string>();
    for (const row of (r.rows || []) as any[]) {
      if (row.id != null) refs.add(String(row.id));
      if (row.slug) refs.add(String(row.slug).toLowerCase());
    }
    return refs;
  } catch (err) {
    console.error("[live-blog-index] failed to load live blog refs:", err);
    return null;
  }
}

/** Predicate: is this blog slug/id a live, published post? */
export async function getLiveBlogPredicate(): Promise<IsLiveBlogRef> {
  if (cache && Date.now() - cache.at < TTL_MS) {
    const refs = cache.refs;
    return (ref) => refs.has(ref.toLowerCase());
  }
  inflight ??= loadLiveRefs().finally(() => {
    inflight = null;
  });
  const refs = await inflight;
  if (!refs) return () => true; // fail-open
  cache = { refs, at: Date.now() };
  return (ref) => refs.has(ref.toLowerCase());
}

/** Drop the cache (call after publish/unpublish/archive if needed). */
export function invalidateLiveBlogIndex(): void {
  cache = null;
}
