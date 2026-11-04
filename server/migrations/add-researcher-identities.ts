import { db } from "../db";
import { sql } from "drizzle-orm";

/**
 * Migration 030 (PLAN.md 4.7 follow-up): researcher identities from OpenAlex
 * authorships — ORCID and most frequent institution per author-name key, kept
 * only when the name resolves to ONE OpenAlex author across our studies.
 * Read by the researcher profile pages. Idempotent.
 */
export async function addResearcherIdentities(): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS researcher_identities (
      author_key TEXT PRIMARY KEY,
      openalex_author_id TEXT NOT NULL,
      display_name TEXT NOT NULL,
      orcid TEXT,
      institution TEXT,
      institution_country TEXT,
      institution_ror TEXT,
      occurrences INTEGER NOT NULL,
      share NUMERIC(4,3) NOT NULL,
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);
}
