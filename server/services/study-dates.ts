/**
 * Truthful "Last updated" dates for listing pages (shared/page-byline.ts):
 * the newest COALESCE(last_modified, created_at) — the column pair
 * sitemap-studies uses for <lastmod> — among the studies a page lists, or
 * across all live studies for site-wide indexes. Failures return null (the
 * byline then doesn't render rather than showing a made-up date).
 */
import { sql } from "drizzle-orm";
import { db } from "../db";

export async function latestModifiedForSlugs(slugs: readonly (string | null | undefined)[]): Promise<Date | null> {
  const list = [...new Set(slugs.filter((s): s is string => typeof s === "string" && s.length > 0))];
  if (list.length === 0) return null;
  try {
    const r = await db.execute(sql`
      SELECT MAX(COALESCE(last_modified, created_at)) AS latest
      FROM studies WHERE is_excluded = false AND slug IN (${sql.join(list.map((s) => sql`${s}`), sql`, `)})
    `);
    const v = (r.rows?.[0] as any)?.latest;
    const d = v ? new Date(v) : null;
    return d && !isNaN(d.getTime()) ? d : null;
  } catch {
    return null;
  }
}

let _latest: { at: number; value: Date | null } | null = null;

/** Newest change across every live study (cached 10 minutes). */
export async function getLatestStudyModified(): Promise<Date | null> {
  if (_latest && Date.now() - _latest.at < 10 * 60 * 1000) return _latest.value;
  try {
    const r = await db.execute(sql`SELECT MAX(COALESCE(last_modified, created_at)) AS latest FROM studies WHERE is_excluded = false`);
    const v = (r.rows?.[0] as any)?.latest;
    const d = v ? new Date(v) : null;
    const value = d && !isNaN(d.getTime()) ? d : null;
    if (value) _latest = { at: Date.now(), value };
    return value;
  } catch {
    return null;
  }
}

/** Test-only. */
export function __resetStudyDatesForTests(): void {
  _latest = null;
}
