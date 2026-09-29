/**
 * Migration 024: the /explore-by-condition/sleep-quality hub (keyword plan
 * wave 4, owner approved 2026-09-29: "set up the sleep hub"). A condition hub
 * exists when it has a health_conditions row and ≥1 study on the shared hub
 * query (seo-body-renderer exploreHubExists / getConditionHubStudies); the
 * study match terms live in server/utils/condition-hub-terms.ts and the
 * evidence-graded intro in shared/condition-hub-intros.ts.
 *
 * primary_product is NULL: no product content on this hub (PLAN.md
 * Appendix E — sleep quality in healthy adults is an allowed bridge context,
 * but sponsor cards need counsel sign-off first). Counts are the 2026-09-29
 * census (13 matching studies, 7 human); the live page counts its own list.
 *
 * Idempotent: inserts only when the slug is absent; failures rethrow
 * (migration errors are fatal at boot).
 */
import { migrationDb as db } from "../db";
import { sql } from "drizzle-orm";

export async function addSleepQualityHub(): Promise<void> {
  console.log("Starting migration: sleep-quality condition hub");
  try {
    await db.execute(sql`
      INSERT INTO health_conditions
        (name, slug, description, body_system_id, display_order, study_count, human_trial_count, confidence_level, primary_product)
      SELECT
        'Sleep Quality',
        'sleep-quality',
        'Research on molecular hydrogen and sleep in adults, from small drinking, jelly and inhalation trials to animal studies.',
        (SELECT id FROM body_systems WHERE slug = 'neurological'),
        COALESCE((SELECT MAX(display_order) + 1 FROM health_conditions), 0),
        13,
        7,
        'preliminary',
        NULL
      WHERE NOT EXISTS (SELECT 1 FROM health_conditions WHERE slug = 'sleep-quality')
    `);
    console.log("Sleep-quality hub migration completed");
  } catch (error) {
    console.error("Error adding sleep-quality hub:", error);
    throw error;
  }
}
