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

  // A CONCURRENTLY build that hits a live uniqueness violation leaves the index
  // behind marked INVALID (pg_index.indisvalid = false). IF NOT EXISTS then sees
  // that invalid index and skips rebuilding it, so the constraint is silently
  // unenforced. Returns true (valid), false (present but INVALID), or null (absent).
  const indexValidity = async (name: string): Promise<boolean | null> => {
    const r = await pool.query(
      `SELECT i.indisvalid
         FROM pg_class c
         JOIN pg_index i ON i.indexrelid = c.oid
        WHERE c.relname = $1`,
      [name],
    );
    return r.rows.length ? r.rows[0].indisvalid === true : null;
  };

  // Create a unique index CONCURRENTLY and verify it ended up VALID. If a prior
  // (or the just-attempted) build left an INVALID index, drop it, re-run the
  // dedupe step, and retry once. Throws if it still can't be built valid.
  const createValidIndex = async (
    label: string,
    indexName: string,
    createSql: string,
    rededupe?: () => Promise<void>,
  ): Promise<void> => {
    for (let attempt = 1; attempt <= 2; attempt++) {
      if ((await indexValidity(indexName)) === false) {
        console.log(`[${label}] found INVALID ${indexName} from a prior failed build — dropping to rebuild`);
        await q(`DROP INDEX CONCURRENTLY IF EXISTS ${indexName}`);
        if (rededupe) await rededupe();
      }
      await q(createSql);
      if ((await indexValidity(indexName)) === true) {
        console.log(`[${label}] ${indexName} ready`);
        return;
      }
      console.error(
        `[${label}] ${indexName} left INVALID after CREATE UNIQUE INDEX CONCURRENTLY ` +
          `(attempt ${attempt}/2) — likely a live duplicate raced the build; dropping`,
      );
      await q(`DROP INDEX CONCURRENTLY IF EXISTS ${indexName}`);
      if (rededupe) await rededupe();
    }
    throw new Error(`${indexName} could not be built as a VALID unique index; constraint NOT enforced`);
  };

  try {
    // 1. content_generation_queue — dedupe active rows, then partial unique index.
    const dedupeActiveQueue = async () => {
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
    };
    await dedupeActiveQueue();

    await createValidIndex(
      "content_generation_queue",
      "uq_cgq_active_study",
      `CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS uq_cgq_active_study
         ON content_generation_queue (study_id)
         WHERE status IN ('pending','processing')`,
      dedupeActiveQueue,
    );

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
      // No dedupe callback: this index is only attempted when there are zero
      // duplicate DOIs, so an INVALID leftover is dropped and simply rebuilt.
      await createValidIndex(
        "studies.doi",
        "uq_studies_doi_lower",
        `CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS uq_studies_doi_lower
           ON studies (lower(doi))
           WHERE doi IS NOT NULL AND doi <> ''`,
      );
      console.log("[studies.doi] uq_studies_doi_lower ready (no duplicates found)");
    }

    // Confirm what exists now — and that each index is actually VALID, not an
    // unenforced INVALID leftover from a failed CONCURRENTLY build.
    for (const name of ["uq_cgq_active_study", "uq_studies_doi_lower"]) {
      const state = await indexValidity(name);
      const label = state === true ? "VALID" : state === false ? "INVALID (NOT enforced)" : "absent";
      console.log(`Index ${name}: ${label}`);
      if (state === false) process.exitCode = 1;
    }
  } catch (e) {
    console.error("Migration error:", (e as Error).message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();
