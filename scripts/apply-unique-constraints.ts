/**
 * Executable runner for scripts/add-unique-constraints.sql.
 *
 * Run against prod with the real DB URL injected by Railway:
 *   railway run -- npx tsx scripts/apply-unique-constraints.ts
 *
 * Each CONCURRENTLY index is issued as its own statement (they cannot run
 * inside a transaction). The studies.doi index is only created if there are
 * NO duplicate DOIs — otherwise it would fail, so we report the dupes for
 * manual resolution and skip it. Idempotent: IF NOT EXISTS throughout.
 */
import pg from "pg";

const cs = process.env.DATABASE_PUBLIC_URL || process.env.DATABASE_URL;
if (!cs || cs.includes("${{")) {
  console.error("No real DATABASE_*_URL in env. Run via: railway run -- npx tsx scripts/apply-unique-constraints.ts");
  process.exit(1);
}

(async () => {
  const pool = new pg.Pool({ connectionString: cs, ssl: { rejectUnauthorized: false } });
  const q = (sql: string) => pool.query(sql);

  try {
    // 1. content_generation_queue — dedupe active rows, then partial unique index.
    const del = await q(`
      DELETE FROM content_generation_queue qd
      USING (
        SELECT id, row_number() OVER (PARTITION BY study_id ORDER BY created_at DESC, id DESC) AS rn
          FROM content_generation_queue
         WHERE status IN ('pending','processing')
      ) d
      WHERE qd.id = d.id AND d.rn > 1
    `);
    console.log(`[content_generation_queue] removed ${del.rowCount} duplicate active row(s)`);

    await q(`
      CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS uq_cgq_active_study
        ON content_generation_queue (study_id)
        WHERE status IN ('pending','processing')
    `);
    console.log("[content_generation_queue] uq_cgq_active_study ready");

    // 2. studies.doi — only index if there are no duplicates.
    const dupes = await q(`
      SELECT lower(doi) AS doi_key, count(*)::int AS n, array_agg(id) AS study_ids
        FROM studies
       WHERE doi IS NOT NULL AND doi <> ''
       GROUP BY lower(doi) HAVING count(*) > 1
       ORDER BY n DESC LIMIT 50
    `);
    if (dupes.rows.length > 0) {
      console.log(`\n[studies.doi] SKIPPED — ${dupes.rows.length} duplicate DOI group(s) need manual resolution first:`);
      for (const r of dupes.rows) console.log(`  ${r.doi_key} -> studies ${JSON.stringify(r.study_ids)} (${r.n})`);
      console.log("  Resolve the duplicates, then re-run to create uq_studies_doi_lower.");
    } else {
      await q(`
        CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS uq_studies_doi_lower
          ON studies (lower(doi))
          WHERE doi IS NOT NULL AND doi <> ''
      `);
      console.log("[studies.doi] uq_studies_doi_lower ready (no duplicates found)");
    }

    // Confirm what exists now.
    const idx = await q(`
      SELECT indexname FROM pg_indexes
       WHERE indexname IN ('uq_cgq_active_study','uq_studies_doi_lower')
       ORDER BY indexname
    `);
    console.log(`\nIndexes present: ${idx.rows.map((r) => r.indexname).join(", ") || "(none)"}`);
  } catch (e) {
    console.error("Migration error:", (e as Error).message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();
