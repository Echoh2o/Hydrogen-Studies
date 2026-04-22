/**
 * Study review-queue deduplication.
 *
 * Runs before AI scoring on every new queue item. If we can confidently
 * say "this paper already exists on the site", we mark the item as a
 * duplicate, skip the AI scoring entirely (cost saver), and surface the
 * existing study in the admin UI so the curator can reject with one click.
 *
 * Two-tier match strategy:
 *   1. DOI exact match. DOIs are globally unique; a match is decisive.
 *      Normalized by lowercasing and stripping the doi.org URL prefix
 *      so `https://doi.org/10.1/abc` matches `10.1/abc` matches `10.1/ABC`.
 *   2. Title trigram similarity > 0.75. Backstop for items without a DOI
 *      or with cosmetic DOI differences (publisher-specific prefixes,
 *      typos). The threshold is high enough to avoid collapsing
 *      similar-topic-but-distinct papers.
 *
 * The `studies_title_trgm_idx` GIN index (created by redirect-service's
 * ensureRedirectIndexes) accelerates the trigram query. DOI matching gets
 * its own idempotent index via `ensureDedupIndexes`.
 */

import { db } from "../db";
import { studies, studyReviewQueue } from "@shared/schema";
import { and, eq, ne, sql } from "drizzle-orm";
import { logger } from "../utils/logger";

const TAG = "DedupService";

/**
 * Minimum trigram similarity to count as a duplicate. Tuned empirically:
 *   0.60 — too permissive, collapses "Hydrogen Water in Diabetic Rats"
 *          with "Hydrogen Water in Healthy Rats"
 *   0.75 — sweet spot, catches minor wording differences / subtitles
 *   0.85 — too strict, misses titles with rearranged clauses
 */
const TITLE_SIMILARITY_THRESHOLD = 0.75;

/**
 * Minimum title length for the trigram check. Titles shorter than this
 * produce unreliable similarity scores — "Long COVID" (10 chars) will
 * match itself at 1.0 against any other 10-char "Long COVID" paper,
 * collapsing distinct studies. 20 chars pushes us into territory where
 * trigram signal is meaningful.
 */
const MIN_TITLE_LEN_FOR_TRIGRAM = 20;

/**
 * Maximum title length the trigram query will consider. Titles longer
 * than this short-circuit to "not a duplicate" — trigram similarity on
 * multi-KB strings is a DB DoS vector (Postgres computes trigrams over
 * every row using the input pattern). 500 chars is generous: the longest
 * real paper title in PubMed is under 400 chars.
 */
const MAX_TITLE_LEN_FOR_TRIGRAM = 500;

export interface DuplicateMatch {
  isDuplicate: boolean;
  /** Existing published study id. */
  duplicateOfStudyId?: number;
  /** Existing pending-queue item id (intra-queue duplicate). */
  duplicateOfQueueId?: number;
  matchType?: "doi" | "title";
  /** 0–1 similarity. 1 for DOI matches. */
  similarity?: number;
  /** Title of the existing study/queue item, for admin context. */
  existingTitle?: string;
  /**
   * True if one or more dedup queries failed. Fail-open semantics mean the
   * caller still proceeds as if no duplicate was found, but this flag lets
   * monitoring surface the silent degradation. When `degraded: true` and
   * `isDuplicate: false`, the negative answer is unreliable.
   */
  degraded?: boolean;
}

/** One-time index setup. Idempotent; reset on failure so a later boot can retry. */
let ensurePromise: Promise<void> | null = null;
export function ensureDedupIndexes(): Promise<void> {
  if (ensurePromise) return ensurePromise;
  ensurePromise = (async () => {
    try {
      // DOI lookup index — without this, every dedup check becomes a seq scan
      // on the studies table. studies.doi has no existing index.
      await db.execute(
        sql`CREATE INDEX IF NOT EXISTS studies_doi_idx ON studies (LOWER(doi))`,
      );

      // Partial unique index that enforces: no two *pending* queue rows
      // can share the same normalized DOI. This is the race-safety net —
      // two concurrent `addToQueue` calls with the same DOI will race
      // to INSERT; the loser gets a 23505 unique-violation, which the
      // caller catches and treats as "detected as concurrent duplicate".
      // Normalization (lowercase + strip doi.org prefix) mirrors
      // normalizeDoi() exactly so the app-layer and index-layer agree.
      await db.execute(sql`
        CREATE UNIQUE INDEX IF NOT EXISTS study_review_queue_pending_doi_unique
          ON study_review_queue (
            LOWER(REGEXP_REPLACE(doi, '^https?://(dx\.)?doi\.org/', '', 'i'))
          )
          WHERE status = 'pending' AND doi IS NOT NULL
      `);
      logger.info("Dedup indexes ensured", TAG);
    } catch (err) {
      // Reset the cache so a subsequent boot / retry can re-attempt
      // index creation instead of short-circuiting on the stale promise.
      ensurePromise = null;
      logger.warn("Failed to create dedup index (non-fatal)", TAG, {
        err: (err as Error).message,
      });
    }
  })();
  return ensurePromise;
}

/** Strip doi.org URL prefix and normalize for matching. */
function normalizeDoi(doi: string): string {
  return doi
    .toLowerCase()
    .trim()
    .replace(/^https?:\/\/(dx\.)?doi\.org\//, "");
}

/**
 * Check whether an incoming study candidate duplicates an existing one.
 * Pass `excludeQueueId` when re-running on an existing queue row so we
 * don't match the row against itself.
 */
export async function detectDuplicate(params: {
  doi?: string | null;
  title: string;
  excludeQueueId?: number;
}): Promise<DuplicateMatch> {
  await ensureDedupIndexes().catch(() => {});
  const { doi, title, excludeQueueId } = params;
  let degraded = false;

  // ── 1. DOI exact match ────────────────────────────────────────
  if (doi && doi.trim()) {
    const normalized = normalizeDoi(doi);

    try {
      const rows = await db.execute<{ id: number; title: string }>(sql`
        SELECT id, title FROM ${studies}
        WHERE doi IS NOT NULL
          AND LOWER(REGEXP_REPLACE(doi, '^https?://(dx\.)?doi\.org/', '', 'i')) = ${normalized}
        LIMIT 1
      `);
      const match = ((rows as any).rows ?? rows)[0] as any;
      if (match) {
        return {
          isDuplicate: true,
          duplicateOfStudyId: Number(match.id),
          matchType: "doi",
          similarity: 1,
          existingTitle: match.title,
        };
      }
    } catch (err) {
      degraded = true;
      logger.error("DOI dedup query (studies) failed", err, TAG);
    }

    // Also check within the review queue — catches the "bot imports same
    // paper twice" case before the curator ever sees it duplicated.
    try {
      const queueConditions = [
        sql`${studyReviewQueue.doi} IS NOT NULL`,
        sql`LOWER(REGEXP_REPLACE(${studyReviewQueue.doi}, '^https?://(dx\.)?doi\.org/', '', 'i')) = ${normalized}`,
        eq(studyReviewQueue.status, "pending"),
      ];
      if (excludeQueueId) {
        queueConditions.push(ne(studyReviewQueue.id, excludeQueueId));
      }
      const [match] = await db
        .select({ id: studyReviewQueue.id, title: studyReviewQueue.title })
        .from(studyReviewQueue)
        .where(and(...queueConditions))
        .limit(1);
      if (match) {
        return {
          isDuplicate: true,
          duplicateOfQueueId: match.id,
          matchType: "doi",
          similarity: 1,
          existingTitle: match.title,
        };
      }
    } catch (err) {
      degraded = true;
      logger.error("DOI dedup query (queue) failed", err, TAG);
    }
  }

  // ── 2. Title trigram match ────────────────────────────────────
  // Skip very short titles (unreliable signal) and excessively long ones
  // (DB DoS risk; see MAX_TITLE_LEN_FOR_TRIGRAM).
  if (
    title &&
    title.trim().length >= MIN_TITLE_LEN_FOR_TRIGRAM &&
    title.trim().length <= MAX_TITLE_LEN_FOR_TRIGRAM
  ) {
    const normalizedTitle = title.trim().toLowerCase();

    try {
      const rows = await db.execute<{
        id: number;
        title: string;
        sim: number;
      }>(sql`
        SELECT id, title, similarity(LOWER(title), ${normalizedTitle}) AS sim
        FROM ${studies}
        WHERE similarity(LOWER(title), ${normalizedTitle}) > ${TITLE_SIMILARITY_THRESHOLD}
        ORDER BY sim DESC
        LIMIT 1
      `);
      const match = ((rows as any).rows ?? rows)[0] as any;
      if (match) {
        return {
          isDuplicate: true,
          duplicateOfStudyId: Number(match.id),
          matchType: "title",
          similarity: Number(match.sim),
          existingTitle: match.title,
        };
      }
    } catch (err) {
      degraded = true;
      logger.error("Title trigram dedup query failed", err, TAG);
    }
  }

  return { isDuplicate: false, ...(degraded ? { degraded: true } : {}) };
}
