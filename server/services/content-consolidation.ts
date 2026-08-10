/**
 * Content Consolidation Service
 *
 * The blog corpus was generated per-study, which produced thousands of
 * near-duplicate articles (8,777 published articles, ~3,261 distinct
 * titles — one title exists 253×). Google treats those as competing
 * pages for the same query, so they cannibalize each other instead of
 * ranking.
 *
 * This engine:
 *   1. Clusters ALL blog_articles by a deterministic topic key
 *      (`topicKeyFor`) so duplicates of the same topic collide.
 *   2. Picks ONE winner per cluster using real 90-day GSC impressions
 *      (`analyzeConsolidation` — strictly read-only).
 *   3. Unpublishes the losers and 301-redirects their URLs to the
 *      winner (`executeConsolidation` — dry-run by default, batched,
 *      fully reversible: content is never deleted, only unpublished,
 *      and every action is stamped into editorNotes).
 */

import { db } from "../db";
import { blogArticles } from "@shared/schema";
import { eq, sql } from "drizzle-orm";
import { createRedirect } from "./redirect-service";
import { invalidateBotCache } from "../middleware/seo-bot-middleware";
import { logger } from "../utils/logger";

const TAG = "ContentConsolidation";

/** Canonical public origin GSC reports pages under. */
const SITE_ORIGIN = "https://hydrogenstudies.com";
const BLOG_URL_PREFIX = `${SITE_ORIGIN}/blog/`;

/** Note prefix on redirects we create, so /status can count them. */
const REDIRECT_NOTE_PREFIX = "consolidation:";

/** Marker appended to editorNotes; also used by /status to count losers. */
const EDITOR_NOTE_MARKER_PREFIX = "[consolidated into ";

/** Trailing per-study suffix the generator appended to slugs (e.g. "-482913"). */
const SLUG_NUMERIC_SUFFIX = /-[0-9]{6}$/;

/**
 * Words that carry no topical meaning in a title. Removing them makes
 * "The Ultimate Guide to Hydrogen Water (2024)" collide with
 * "Hydrogen Water Guide" — which is exactly the collision we want.
 */
const FILLER_WORDS = new Set([
  // articles / prepositions / linking verbs
  "a", "an", "the", "of", "and", "or", "for", "to", "in", "on", "at",
  "with", "without", "by", "from", "is", "are", "was", "were", "be",
  "it", "its", "your", "you",
  // question scaffolding
  "what", "why", "how", "when", "does", "do", "can", "should",
  // generated-title boilerplate
  "guide", "complete", "ultimate", "definitive", "comprehensive",
  "updated", "latest", "new", "overview", "explained", "edition",
  "vs", "versus",
]);

/**
 * Deterministic topic key for an article. Articles about the same topic
 * MUST collide:
 *   - title lowercased (falls back to slug with the trailing -NNNNNN
 *     per-study suffix stripped when the title is empty)
 *   - punctuation collapsed to spaces
 *   - standalone years (1900–2099) removed
 *   - filler/boilerplate words removed
 */
export function topicKeyFor(article: { title?: string | null; slug?: string | null }): string {
  const title = (article.title ?? "").trim().toLowerCase();
  const slugBase = (article.slug ?? "")
    .trim()
    .toLowerCase()
    .replace(SLUG_NUMERIC_SUFFIX, "")
    .replace(/-/g, " ");
  const base = title || slugBase;

  const tokens = base
    .replace(/[’'`]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .filter((t) => !/^(19|20)\d{2}$/.test(t)) // standalone years
    .filter((t) => !FILLER_WORDS.has(t));

  // Everything got filtered (e.g. title was "The 2024 Guide") — fall back
  // to the raw base so the key is still deterministic and non-empty.
  if (tokens.length === 0) {
    return base.replace(/\s+/g, "-") || "untitled";
  }
  return tokens.join("-");
}

// ── Report types ─────────────────────────────────────────────

export interface ClusterMember {
  id: number;
  slug: string;
  title: string;
  isPublished: boolean;
  contentLength: number;
  impressions90d: number;
  clicks90d: number;
}

export interface ConsolidationCluster {
  topicKey: string;
  size: number;
  winner: ClusterMember;
  loserCount: number;
  totalImpressions90d: number;
  totalClicks90d: number;
  members: ClusterMember[];
}

export interface ConsolidationReport {
  generatedAt: string;
  totalArticles: number;
  totalPublished: number;
  distinctTopics: number;
  singletonTopics: number;
  multiArticleClusters: number;
  loserCount: number;
  /** Published losers — the pages that would actually be unpublished. */
  publishedLoserCount: number;
  /** Published pages that would remain published after execution. */
  projectedPublishedAfter: number;
  clusters: ConsolidationCluster[];
}

/** True when the slug looks human-authored (no trailing -NNNNNN suffix). */
function isHumanSlug(slug: string): boolean {
  return !SLUG_NUMERIC_SUFFIX.test(slug);
}

/**
 * Winner comparator. Returns the better of two members:
 *   1. most 90d GSC impressions
 *   2. human slug (no numeric suffix) beats generated slug
 *   3. more 90d clicks
 *   4. longer content
 *   5. lowest id (final deterministic tie-break)
 */
function pickBetter(a: ClusterMember, b: ClusterMember): ClusterMember {
  if (a.impressions90d !== b.impressions90d) {
    return a.impressions90d > b.impressions90d ? a : b;
  }
  const aHuman = isHumanSlug(a.slug);
  const bHuman = isHumanSlug(b.slug);
  if (aHuman !== bHuman) return aHuman ? a : b;
  if (a.clicks90d !== b.clicks90d) return a.clicks90d > b.clicks90d ? a : b;
  if (a.contentLength !== b.contentLength) {
    return a.contentLength > b.contentLength ? a : b;
  }
  return a.id <= b.id ? a : b;
}

/**
 * Aggregate last-90-day GSC metrics per blog URL. One grouped query —
 * joining per-article would run 8k+ similarity-free lookups instead.
 */
async function loadGscTotals(): Promise<Map<string, { impressions: number; clicks: number }>> {
  const totals = new Map<string, { impressions: number; clicks: number }>();
  try {
    const result: any = await db.execute(sql`
      SELECT page,
             SUM(impressions)::int AS impressions,
             SUM(clicks)::int AS clicks
      FROM gsc_query_metrics
      WHERE date::date > current_date - 90
        AND page LIKE ${BLOG_URL_PREFIX + "%"}
      GROUP BY page
    `);
    const rows = result?.rows ?? result;
    for (const r of rows as any[]) {
      totals.set(String(r.page), {
        impressions: Number(r.impressions) || 0,
        clicks: Number(r.clicks) || 0,
      });
    }
  } catch (err) {
    // GSC data is a ranking signal, not a hard dependency — an empty map
    // degrades winner selection to the deterministic tie-breaks.
    logger.error("Failed to load 90d GSC totals; proceeding without", err, TAG);
  }
  return totals;
}

/**
 * Cluster the entire blog corpus by topic key and pick a winner per
 * multi-article cluster. Strictly READ-ONLY — never mutates anything.
 */
export async function analyzeConsolidation(): Promise<ConsolidationReport> {
  const [articles, gscTotals] = await Promise.all([
    db
      .select({
        id: blogArticles.id,
        title: blogArticles.title,
        slug: blogArticles.slug,
        isPublished: blogArticles.isPublished,
        contentLength: sql<number>`length(${blogArticles.content})`,
      })
      .from(blogArticles),
    loadGscTotals(),
  ]);

  const byTopic = new Map<string, ClusterMember[]>();
  let totalPublished = 0;
  for (const a of articles) {
    const gsc = gscTotals.get(BLOG_URL_PREFIX + a.slug);
    const member: ClusterMember = {
      id: a.id,
      slug: a.slug,
      title: a.title,
      isPublished: a.isPublished === true,
      contentLength: Number(a.contentLength) || 0,
      impressions90d: gsc?.impressions ?? 0,
      clicks90d: gsc?.clicks ?? 0,
    };
    if (member.isPublished) totalPublished++;
    const key = topicKeyFor(a);
    const bucket = byTopic.get(key);
    if (bucket) bucket.push(member);
    else byTopic.set(key, [member]);
  }

  const clusters: ConsolidationCluster[] = [];
  let singletonTopics = 0;
  let loserCount = 0;
  let publishedLoserCount = 0;

  for (const [topicKey, members] of byTopic) {
    if (members.length < 2) {
      singletonTopics++;
      continue;
    }
    let winner = members[0];
    let totalImpressions90d = 0;
    let totalClicks90d = 0;
    for (const m of members) {
      totalImpressions90d += m.impressions90d;
      totalClicks90d += m.clicks90d;
      if (m !== winner) winner = pickBetter(winner, m);
    }
    for (const m of members) {
      if (m.id === winner.id) continue;
      loserCount++;
      if (m.isPublished) publishedLoserCount++;
    }
    clusters.push({
      topicKey,
      size: members.length,
      winner,
      loserCount: members.length - 1,
      totalImpressions90d,
      totalClicks90d,
      // Deterministic member ordering: winner first, then by id.
      members: [...members].sort((a, b) =>
        a.id === winner.id ? -1 : b.id === winner.id ? 1 : a.id - b.id,
      ),
    });
  }

  // Biggest cannibalization problems first; stable id tie-break.
  clusters.sort(
    (a, b) =>
      b.size - a.size ||
      b.totalImpressions90d - a.totalImpressions90d ||
      a.winner.id - b.winner.id,
  );

  return {
    generatedAt: new Date().toISOString(),
    totalArticles: articles.length,
    totalPublished,
    distinctTopics: byTopic.size,
    singletonTopics,
    multiArticleClusters: clusters.length,
    loserCount,
    publishedLoserCount,
    projectedPublishedAfter: totalPublished - publishedLoserCount,
    clusters,
  };
}

// ── Execution ────────────────────────────────────────────────

export interface ConsolidationChange {
  articleId: number;
  loserSlug: string;
  winnerSlug: string;
  topicKey: string;
  action: "unpublish+redirect" | "would-unpublish+redirect";
  redirectExisted?: boolean;
}

export interface ExecuteConsolidationResult {
  dryRun: boolean;
  /** Losers considered in this batch (bounded by `limit`). */
  processed: number;
  unpublished: number;
  redirectsCreated: number;
  redirectsExisting: number;
  /** Losers skipped because their winner is not currently published. */
  skippedWinnerUnpublished: number;
  errors: number;
  firstError: string | null;
  /** Published losers still pending after this batch. */
  remainingLosers: number;
  changes: ConsolidationChange[];
}

/**
 * Unpublish loser articles and 301-redirect their URLs to the cluster
 * winner. NEVER deletes content — every change is reversible:
 *   - isPublished flips back on republish
 *   - editorNotes records exactly where and when it was consolidated
 *   - the redirect row can be deleted from the admin redirects UI
 *
 * Batched (default 50) and deterministic (losers ordered by id asc), so
 * repeated calls drain the backlog without ever double-processing.
 * dryRun defaults to TRUE — callers must explicitly pass false to mutate.
 */
export async function executeConsolidation(opts: {
  limit?: number;
  dryRun?: boolean;
} = {}): Promise<ExecuteConsolidationResult> {
  const limit = Math.min(500, Math.max(1, Math.floor(opts.limit ?? 50)));
  const dryRun = opts.dryRun !== false;

  const report = await analyzeConsolidation();

  // Pending work = published losers. Already-unpublished losers were
  // handled by a previous batch (or by an editor) and are skipped, which
  // is what makes repeated batched calls converge.
  const pending: Array<{ loser: ClusterMember; winner: ClusterMember; topicKey: string }> = [];
  let skippedWinnerUnpublished = 0;
  for (const cluster of report.clusters) {
    for (const m of cluster.members) {
      if (m.id === cluster.winner.id || !m.isPublished) continue;
      if (!cluster.winner.isPublished) {
        // Redirecting a live URL to an unpublished (404) winner would be
        // worse than the duplicate. Leave the cluster for manual review.
        skippedWinnerUnpublished++;
        continue;
      }
      pending.push({ loser: m, winner: cluster.winner, topicKey: cluster.topicKey });
    }
  }
  pending.sort((a, b) => a.loser.id - b.loser.id);

  const batch = pending.slice(0, limit);
  const isoDate = new Date().toISOString().slice(0, 10);

  const changes: ConsolidationChange[] = [];
  let unpublished = 0;
  let redirectsCreated = 0;
  let redirectsExisting = 0;
  let errors = 0;
  let firstError: string | null = null;

  for (const { loser, winner, topicKey } of batch) {
    if (dryRun) {
      changes.push({
        articleId: loser.id,
        loserSlug: loser.slug,
        winnerSlug: winner.slug,
        topicKey,
        action: "would-unpublish+redirect",
      });
      continue;
    }

    try {
      // 1. 301 redirect /blog/<loser> -> /blog/<winner> via the existing
      //    redirect-service insert path (validation, loop detection,
      //    audit log, cache invalidation). Upsert-safe: a 23505 unique
      //    violation means the redirect already exists — fine.
      let redirectExisted = false;
      try {
        await createRedirect(
          `/blog/${loser.slug}`,
          `/blog/${winner.slug}`,
          301,
          `${REDIRECT_NOTE_PREFIX} duplicate of /blog/${winner.slug} (topic: ${topicKey.slice(0, 120)})`,
          { actor: "consolidation", action: "consolidation" },
        );
        redirectsCreated++;
      } catch (err: any) {
        if (err?.code === "23505") {
          redirectExisted = true;
          redirectsExisting++;
        } else {
          throw err;
        }
      }

      // 2. Unpublish + stamp editorNotes (append, never overwrite).
      const marker = `${EDITOR_NOTE_MARKER_PREFIX}/blog/${winner.slug} on ${isoDate}]`;
      await db
        .update(blogArticles)
        .set({
          isPublished: false,
          editorNotes: sql`CASE
            WHEN ${blogArticles.editorNotes} IS NULL OR ${blogArticles.editorNotes} = ''
            THEN ${marker}
            ELSE ${blogArticles.editorNotes} || E'\n' || ${marker}
          END`,
          updatedAt: new Date(),
        })
        .where(eq(blogArticles.id, loser.id));
      unpublished++;

      // 3. Drop stale prerendered HTML for the changed path so crawlers
      //    see the 301 immediately instead of a cached 200.
      invalidateBotCache(`/blog/${loser.slug}`);

      changes.push({
        articleId: loser.id,
        loserSlug: loser.slug,
        winnerSlug: winner.slug,
        topicKey,
        action: "unpublish+redirect",
        redirectExisted,
      });
    } catch (err) {
      // Per-loser isolation: one bad row must not poison the batch.
      errors++;
      const msg = err instanceof Error ? err.message : String(err);
      if (!firstError) firstError = `id=${loser.id} slug=${loser.slug.slice(0, 80)}: ${msg.slice(0, 200)}`;
      logger.error("Consolidation of article failed", err, TAG);
    }
  }

  if (!dryRun) {
    logger.info("Consolidation batch complete", TAG, {
      processed: batch.length,
      unpublished,
      redirectsCreated,
      redirectsExisting,
      errors,
    });
  }

  return {
    dryRun,
    processed: batch.length,
    unpublished,
    redirectsCreated,
    redirectsExisting,
    skippedWinnerUnpublished,
    errors,
    firstError,
    // Errored entries stay pending — only successful unpublishes shrink the backlog.
    remainingLosers: Math.max(0, pending.length - (dryRun ? 0 : unpublished)),
    changes,
  };
}

// ── Status ───────────────────────────────────────────────────

export interface ConsolidationStatus {
  publishedArticles: number;
  unpublishedArticles: number;
  consolidatedArticles: number;
  consolidationRedirects: number;
}

/** Cheap corpus counts for the admin dashboard. Read-only. */
export async function getConsolidationStatus(): Promise<ConsolidationStatus> {
  const result: any = await db.execute(sql`
    SELECT
      (SELECT COUNT(*)::int FROM blog_articles WHERE is_published = true) AS published,
      (SELECT COUNT(*)::int FROM blog_articles WHERE is_published = false OR is_published IS NULL) AS unpublished,
      (SELECT COUNT(*)::int FROM blog_articles
        WHERE editor_notes LIKE ${"%" + EDITOR_NOTE_MARKER_PREFIX + "%"}) AS consolidated,
      (SELECT COUNT(*)::int FROM redirects
        WHERE note LIKE ${REDIRECT_NOTE_PREFIX + "%"}) AS consolidation_redirects
  `);
  const rows = result?.rows ?? result;
  const row = rows?.[0] ?? {};
  return {
    publishedArticles: Number(row.published) || 0,
    unpublishedArticles: Number(row.unpublished) || 0,
    consolidatedArticles: Number(row.consolidated) || 0,
    consolidationRedirects: Number(row.consolidation_redirects) || 0,
  };
}
