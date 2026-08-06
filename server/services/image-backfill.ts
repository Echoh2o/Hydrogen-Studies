/**
 * Auto image backfill.
 *
 * Finds blogs and studies that need a real AI-generated image — either
 * because they were never generated, or because an earlier generation
 * persisted the placeholder SVG path into the DB — and regenerates them
 * in small batches. Designed to run hourly under the job scheduler so the
 * backlog drains without admin intervention.
 *
 * Two cleanup steps run on first boot (idempotent):
 *   1. Convert any blog_articles.image_url containing the placeholder SVG
 *      back to NULL so the backfill query can pick them up.
 *   2. Same for studies.image_url (legacy rows where /images/fallback*.svg
 *      may have been hard-coded years ago).
 *
 * Each cycle processes a small batch (5 blogs + 5 studies by default) to
 * stay under AI provider rate limits and per-image cost. The job is
 * cron-throttled at the scheduler level.
 */

import { sql, eq, isNull, or, and, notInArray } from "drizzle-orm";
import { db } from "../db";
import { blogArticles, studies } from "@shared/schema";
import { logger } from "../utils/logger";

const TAG = "ImageBackfill";

/**
 * In-memory record of rows that failed generation in this process. Without a
 * persistent attempt/cooldown column (handled in a separate schema wave), a
 * row that permanently fails (content-policy rejection, malformed title,
 * provider 400) keeps its NULL imageUrl and would otherwise be re-selected at
 * the head of every batch, starving the rest of the backlog and burning paid
 * provider attempts each cycle. Excluding these ids lets the backlog drain
 * across cycles; the sets reset on process restart, which retries them once.
 */
const failedStudyIds = new Set<number>();
const failedBlogIds = new Set<number>();

/** URLs that indicate a row "has the placeholder, not a real image". */
const PLACEHOLDER_URLS = [
  "/images/fallback-study-image.svg",
  "/images/default-study-image.svg",
  "/images/default-blog-image.svg",
];

let cleanupPromise: Promise<void> | null = null;

/**
 * One-time idempotent cleanup: rows that have a placeholder SVG persisted
 * as their imageUrl get NULL'd so the backfill query finds them. Without
 * this, every old row would be skipped because it "already has an image".
 */
export function cleanupPlaceholderImageRows(): Promise<void> {
  if (cleanupPromise) return cleanupPromise;
  cleanupPromise = (async () => {
    try {
      // PostgreSQL ANY() with a typed array. Updates rows whose imageUrl
      // matches any of the known placeholder paths.
      const blogResult = await db.execute(sql`
        UPDATE blog_articles
        SET image_url = NULL,
            image_alt = NULL,
            og_image = NULL
        WHERE image_url = ANY(${PLACEHOLDER_URLS})
        RETURNING id
      `);
      const studyResult = await db.execute(sql`
        UPDATE studies
        SET image_url = NULL,
            image_alt = NULL
        WHERE image_url = ANY(${PLACEHOLDER_URLS})
        RETURNING id
      `);
      const blogCount = ((blogResult as any).rows ?? blogResult).length;
      const studyCount = ((studyResult as any).rows ?? studyResult).length;
      if (blogCount + studyCount > 0) {
        logger.info("Placeholder image URLs cleared", TAG, {
          blogs: blogCount,
          studies: studyCount,
        });
      }
    } catch (err) {
      cleanupPromise = null;
      logger.error("Failed to clear placeholder image URLs", err, TAG);
    }
  })();
  return cleanupPromise;
}

export interface ImageBackfillStats {
  blogs: { total: number; missing: number; complete: number; pct: number };
  studies: { total: number; missing: number; complete: number; pct: number };
}

/** Counts for the admin dashboard. Cheap aggregate query. */
export async function getImageBackfillStats(): Promise<ImageBackfillStats> {
  const [blogRow] = await db.execute<{
    total: number;
    missing: number;
  }>(sql`
    SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (
        WHERE image_url IS NULL
        OR image_url = ANY(${PLACEHOLDER_URLS})
      )::int AS missing
    FROM blog_articles
  `).then((r: any) => r.rows ?? r);

  const [studyRow] = await db.execute<{
    total: number;
    missing: number;
  }>(sql`
    SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (
        WHERE image_url IS NULL
        OR image_url = ANY(${PLACEHOLDER_URLS})
      )::int AS missing
    FROM studies
  `).then((r: any) => r.rows ?? r);

  const blogTotal = Number(blogRow?.total ?? 0);
  const blogMissing = Number(blogRow?.missing ?? 0);
  const studyTotal = Number(studyRow?.total ?? 0);
  const studyMissing = Number(studyRow?.missing ?? 0);

  return {
    blogs: {
      total: blogTotal,
      missing: blogMissing,
      complete: blogTotal - blogMissing,
      pct: blogTotal > 0 ? Math.round(((blogTotal - blogMissing) / blogTotal) * 100) : 100,
    },
    studies: {
      total: studyTotal,
      missing: studyMissing,
      complete: studyTotal - studyMissing,
      pct: studyTotal > 0 ? Math.round(((studyTotal - studyMissing) / studyTotal) * 100) : 100,
    },
  };
}

/**
 * Run a single backfill batch. Generates images for a small number of
 * studies + blogs that currently have NULL imageUrl. Returns a summary
 * the caller can log or surface to the admin UI.
 */
export async function runImageBackfillBatch(opts: {
  blogLimit?: number;
  studyLimit?: number;
} = {}): Promise<{
  blogsProcessed: number;
  blogsSucceeded: number;
  studiesProcessed: number;
  studiesSucceeded: number;
  errors: Array<{ kind: "blog" | "study"; id: number; error: string }>;
}> {
  const blogLimit = opts.blogLimit ?? 5;
  const studyLimit = opts.studyLimit ?? 5;
  const errors: Array<{ kind: "blog" | "study"; id: number; error: string }> = [];

  await cleanupPlaceholderImageRows().catch(() => {});

  // Studies first — they're the source of truth for blog content, so
  // a study with an image makes its blogs more likely to inherit it
  // contextually in future generation passes.
  let studiesProcessed = 0;
  let studiesSucceeded = 0;
  try {
    const excludedStudyIds = Array.from(failedStudyIds);
    if (excludedStudyIds.length > 0) {
      logger.info("Skipping studies that failed image generation earlier in this process", TAG, {
        count: excludedStudyIds.length,
      });
    }
    const candidateStudies = await db
      .select({ id: studies.id })
      .from(studies)
      .where(
        excludedStudyIds.length > 0
          ? and(isNull(studies.imageUrl), notInArray(studies.id, excludedStudyIds))
          : isNull(studies.imageUrl),
      )
      .orderBy(sql`${studies.viewCount} DESC NULLS LAST, ${studies.id} ASC`)
      .limit(studyLimit);

    if (candidateStudies.length > 0) {
      const { generateImageForStudy } = await import("./image-generator");
      for (const c of candidateStudies) {
        studiesProcessed++;
        try {
          const result = await generateImageForStudy(c.id);
          if (result?.success) studiesSucceeded++;
          else {
            failedStudyIds.add(c.id);
            errors.push({
              kind: "study",
              id: c.id,
              error: result?.message ?? "unknown failure",
            });
          }
        } catch (err) {
          failedStudyIds.add(c.id);
          errors.push({
            kind: "study",
            id: c.id,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }
    }
  } catch (err) {
    logger.error("Study image backfill batch failed at query stage", err, TAG);
  }

  // Blogs — same idea, prioritized by view count so the most-trafficked
  // get a real image first.
  let blogsProcessed = 0;
  let blogsSucceeded = 0;
  try {
    const excludedBlogIds = Array.from(failedBlogIds);
    if (excludedBlogIds.length > 0) {
      logger.info("Skipping blogs that failed image generation earlier in this process", TAG, {
        count: excludedBlogIds.length,
      });
    }
    const candidateBlogs = await db
      .select({ id: blogArticles.id })
      .from(blogArticles)
      .where(
        excludedBlogIds.length > 0
          ? and(isNull(blogArticles.imageUrl), notInArray(blogArticles.id, excludedBlogIds))
          : isNull(blogArticles.imageUrl),
      )
      .orderBy(sql`${blogArticles.viewCount} DESC NULLS LAST, ${blogArticles.id} ASC`)
      .limit(blogLimit);

    if (candidateBlogs.length > 0) {
      const { generateBlogImage } = await import("./image-generator");
      for (const c of candidateBlogs) {
        blogsProcessed++;
        try {
          const result = await generateBlogImage(c.id);
          if (result?.success) blogsSucceeded++;
          else {
            failedBlogIds.add(c.id);
            errors.push({
              kind: "blog",
              id: c.id,
              error: result?.message ?? "unknown failure",
            });
          }
        } catch (err) {
          failedBlogIds.add(c.id);
          errors.push({
            kind: "blog",
            id: c.id,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }
    }
  } catch (err) {
    logger.error("Blog image backfill batch failed at query stage", err, TAG);
  }

  if (blogsProcessed + studiesProcessed > 0) {
    logger.info("Image backfill batch complete", TAG, {
      blogsProcessed,
      blogsSucceeded,
      studiesProcessed,
      studiesSucceeded,
      errorCount: errors.length,
    });
  }

  return {
    blogsProcessed,
    blogsSucceeded,
    studiesProcessed,
    studiesSucceeded,
    errors,
  };
}
