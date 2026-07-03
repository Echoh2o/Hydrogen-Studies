/**
 * Migration: partial index on studies.doi.
 *
 * DOI is the dedupe key the research-discovery job probes once per candidate
 * item (`eq(studies.doi, ...)`) every 6 hours. Without an index each probe is
 * a sequential scan over the studies table.
 *
 * Deliberately NON-unique: production data contains duplicate DOIs from
 * historical imports, so `CREATE UNIQUE INDEX` would fail at migration time
 * and block the deploy (migration failures are fatal — see app.ts). Partial
 * (`WHERE doi IS NOT NULL`) so the many DOI-less rows don't bloat it.
 *
 * IF EXISTS-safe and idempotent; mirrored in shared/schema.ts (`doiIdx`).
 */
import { db } from "../db";
import { sql } from "drizzle-orm";
import { logger } from "../utils/logger";

export async function addStudiesDoiIndex(): Promise<void> {
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_studies_doi ON studies (doi) WHERE doi IS NOT NULL
  `);
  logger.info("Ensured partial index idx_studies_doi on studies(doi)", "Migration");
}
