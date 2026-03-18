/**
 * Backfill migration:
 * 1. Generate slugs for studies that have NULL/empty slugs
 * 2. Set is_human_trial = true for studies with human/clinical/RCT study types
 */

import { db } from "../db";
import { sql } from "drizzle-orm";
import { logger } from "../utils/logger";

export async function backfillSlugsAndHumanTrials() {
  logger.info("Starting backfill: slugs and is_human_trial...", "BackfillMigration");

  try {
    // --- Part 1: Backfill slugs ---
    // Generate URL-friendly slugs from title for studies missing them
    // Uses PostgreSQL string functions: lowercase, replace spaces/special chars with hyphens,
    // strip non-alphanumeric-hyphen chars, trim trailing hyphens, truncate to 80 chars
    const slugResult = await db.execute(sql`
      UPDATE studies
      SET slug = LEFT(
        TRIM(BOTH '-' FROM
          REGEXP_REPLACE(
            REGEXP_REPLACE(
              REGEXP_REPLACE(
                LOWER(COALESCE(plain_language_title, title)),
                '[^a-z0-9\\s-]', '', 'g'
              ),
              '\\s+', '-', 'g'
            ),
            '-+', '-', 'g'
          )
        ),
        80
      )
      WHERE slug IS NULL OR slug = ''
    `);
    const slugCount = (slugResult as any).rowCount || 0;
    logger.info(`Generated slugs for ${slugCount} studies`, "BackfillMigration");

    // Handle any duplicate slugs by appending the study ID
    await db.execute(sql`
      UPDATE studies s1
      SET slug = s1.slug || '-' || s1.id
      WHERE EXISTS (
        SELECT 1 FROM studies s2
        WHERE s2.slug = s1.slug AND s2.id < s1.id
      )
      AND s1.slug IS NOT NULL AND s1.slug != ''
    `);

    // --- Part 2: Backfill is_human_trial ---
    const humanResult = await db.execute(sql`
      UPDATE studies
      SET is_human_trial = true
      WHERE is_human_trial = false
        AND (
          LOWER(study_type) LIKE '%human%'
          OR LOWER(study_type) LIKE '%clinical%'
          OR LOWER(study_type) LIKE '%rct%'
          OR LOWER(study_type) LIKE '%randomized%'
          OR LOWER(study_type) LIKE '%crossover%'
          OR LOWER(study_type) LIKE '%cohort%'
          OR LOWER(study_type) LIKE '%trial%'
          OR LOWER(study_type) LIKE '%pilot%'
          OR LOWER(study_type) LIKE '%placebo%'
          OR LOWER(study_type) LIKE '%double-blind%'
          OR LOWER(study_type) LIKE '%open-label%'
        )
    `);
    const humanCount = (humanResult as any).rowCount || 0;
    logger.info(`Set is_human_trial=true for ${humanCount} studies`, "BackfillMigration");

    logger.info("Backfill complete", "BackfillMigration");
  } catch (error) {
    logger.error("Backfill migration failed", error, "BackfillMigration");
    throw error;
  }
}
