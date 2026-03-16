import { db } from "../db";
import { studies } from "@shared/schema";
import { eq, or, isNull, sql } from "drizzle-orm";
import { logger } from "../utils/logger";

/**
 * Migration 004: Fix studies with "Untitled" titles by enriching from DOI/PubMed.
 * Runs DOI enhancement + SEO enrichment on any study with title "Untitled" or null.
 */
export async function fixUntitledStudies() {
  const untitled = await db
    .select({ id: studies.id, title: studies.title, doi: studies.doi })
    .from(studies)
    .where(
      or(
        eq(studies.title, "Untitled"),
        eq(studies.title, "Untitled Study"),
        isNull(studies.title),
      )
    );

  if (untitled.length === 0) {
    logger.info("No untitled studies found", undefined, "Migration");
    return;
  }

  logger.info(`Found ${untitled.length} untitled studies, scheduling enrichment`, undefined, "Migration");

  // Import enrichment services lazily
  const { enhanceStudyWithDoi } = await import("../services/doi-enhancer");
  const { enrichAndSaveStudy } = await import("../services/study-seo-enrichment");

  let fixed = 0;
  for (const study of untitled) {
    try {
      // Step 1: Try DOI enhancement to get the real title
      if (study.doi) {
        await enhanceStudyWithDoi(study.id);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      // Step 2: Run SEO enrichment for slug, plainLanguageTitle, etc.
      await enrichAndSaveStudy(study.id);
      await new Promise(resolve => setTimeout(resolve, 1000));

      fixed++;
      logger.info(`Fixed study ${study.id}`, undefined, "Migration");
    } catch (err) {
      logger.error(`Failed to fix study ${study.id}`, err, "Migration");
    }
  }

  logger.info(`Fixed ${fixed}/${untitled.length} untitled studies`, undefined, "Migration");
}
