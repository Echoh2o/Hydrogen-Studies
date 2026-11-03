import { db } from "../db";
import { sql } from "drizzle-orm";

/**
 * Migration 029 (PLAN.md 4.4): provenance for studies.citation_count.
 * - citation_source: where the count came from ("openalex"); NULL = legacy
 *   value of unknown origin (seed/import), which the study page does not show.
 * - citation_count_updated_at: when it was last refreshed (shown as "as of").
 * - openalex_id: the OpenAlex work id ("W2401015570") the count links to.
 * Idempotent: ADD COLUMN IF NOT EXISTS.
 */
export async function addCitationSourceFields(): Promise<void> {
  await db.execute(sql`ALTER TABLE studies ADD COLUMN IF NOT EXISTS citation_source TEXT`);
  await db.execute(sql`ALTER TABLE studies ADD COLUMN IF NOT EXISTS citation_count_updated_at TIMESTAMP`);
  await db.execute(sql`ALTER TABLE studies ADD COLUMN IF NOT EXISTS openalex_id TEXT`);
}
