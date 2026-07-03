/**
 * Race-safety tests for the content-generation queue, run against a REAL
 * Postgres engine (PGlite, Postgres-in-WASM) instead of a mocked db.
 *
 * These exercise the actual exported functions:
 *  - enqueueStudy            (content-generation-worker.ts) — dedup invariant
 *  - claimQueueItem          (content-generation-worker.ts) — atomic claim
 *  - resetStaleProcessingJobs (stale-job-recovery.ts)       — orphan recovery
 *
 * The PGlite-backed drizzle instance is injected through the same
 * vi.mock("../db") seam the other worker tests use, so the production SQL
 * (conditional UPDATE ... RETURNING, INSERT ... ON CONFLICT DO NOTHING
 * against the partial unique index, interval-based stale sweep) runs
 * unmodified.
 *
 * KNOWN LIMITATION: PGlite is single-connection, so these are deterministic
 * SEQUENTIAL interleavings that prove the atomic-statement invariants
 * ("second claim of the same row returns 0 rows", "insert racing past the
 * SELECT pre-check hits the partial unique index"). They cannot reproduce
 * true MVCC concurrency (two sessions blocking on the same row mid-statement)
 * — that would need a real multi-connection Postgres harness.
 *
 * Schema: content_generation_queue (table + indexes) is created by running
 * the REAL migration, server/migrations/add-content-generation-queue.ts,
 * through the same mocked db seam. Only two pieces are hand-written DDL:
 * the uq_cgq_active_study partial unique index from
 * scripts/apply-unique-constraints.ts (minus CONCURRENTLY, which requires a
 * real multi-session server), and a minimal pipeline_queue with just the
 * columns the stale sweep touches.
 */
import { describe, it, expect, vi, beforeAll, beforeEach, afterAll } from "vitest";
import { sql } from "drizzle-orm";

vi.mock("../db", async () => {
  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");
  const client = new PGlite(); // in-memory
  const db = drizzle(client);
  return {
    db,
    pool: {
      query: (text: string, params?: unknown[]) => client.query(text, params),
      on: () => {},
      end: () => client.close(),
    },
    sqlQuery: async () => [],
    __pglite: client,
  };
});

// Import AFTER the mock so the worker modules bind to the PGlite-backed db.
const { db } = (await import("../db")) as unknown as {
  db: import("drizzle-orm/pglite").PgliteDatabase;
};
const { enqueueStudy, claimQueueItem } = await import(
  "../services/content-generation-worker"
);
const { resetStaleProcessingJobs } = await import("../services/stale-job-recovery");
const { addContentGenerationQueue } = await import(
  "../migrations/add-content-generation-queue"
);

async function rows(query: string): Promise<any[]> {
  const res: any = await db.execute(sql.raw(query));
  return res.rows ?? res;
}

beforeAll(async () => {
  // Silence the migration's console.log chatter and the worker's logger
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "info").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});

  // Run the REAL production migration against PGlite (via the mocked db
  // seam) so the table/indexes under test can't drift from what deploys.
  await addContentGenerationQueue();
  // Mirrors scripts/apply-unique-constraints.ts (without CONCURRENTLY)
  await db.execute(sql.raw(`
    CREATE UNIQUE INDEX IF NOT EXISTS uq_cgq_active_study
      ON content_generation_queue (study_id)
      WHERE status IN ('pending','processing')
  `));
  // Minimal pipeline_queue — only the columns resetStaleProcessingJobs touches
  await db.execute(sql.raw(`
    CREATE TABLE IF NOT EXISTS pipeline_queue (
      id SERIAL PRIMARY KEY,
      status TEXT NOT NULL DEFAULT 'pending',
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `));
});

beforeEach(async () => {
  await db.execute(sql.raw("TRUNCATE content_generation_queue, pipeline_queue RESTART IDENTITY"));
});

afterAll(async () => {
  vi.restoreAllMocks();
  // Shut the in-memory Postgres down cleanly (frees the WASM instance).
  const { __pglite } = (await import("../db")) as any;
  await __pglite.close();
});

describe("enqueueStudy — dedup invariant (partial unique index + onConflictDoNothing)", () => {
  it("double-enqueue of the same study leaves exactly one queue row", async () => {
    await enqueueStudy(101);
    await enqueueStudy(101); // second call: pre-check SELECT finds the row → no-op

    const found = await rows(
      "SELECT id, status FROM content_generation_queue WHERE study_id = 101",
    );
    expect(found).toHaveLength(1);
    expect(found[0].status).toBe("pending");
  });

  it("an insert racing past the SELECT pre-check is absorbed by the index (silent no-op, no error)", async () => {
    await enqueueStudy(102);

    // Simulate the race enqueueStudy's comment describes: a concurrent
    // enqueue that already passed its pre-check SELECT issues the same
    // INSERT ... ON CONFLICT DO NOTHING. The partial unique index must turn
    // it into a 0-row no-op rather than a duplicate or a thrown error.
    const raced: any = await db.execute(sql.raw(`
      INSERT INTO content_generation_queue (study_id, priority, status)
      VALUES (102, 0, 'pending')
      ON CONFLICT DO NOTHING
      RETURNING id
    `));
    expect((raced.rows ?? raced)).toHaveLength(0);

    const found = await rows(
      "SELECT id FROM content_generation_queue WHERE study_id = 102",
    );
    expect(found).toHaveLength(1);
  });

  it("index is scoped to ACTIVE rows: a completed run does not block re-enqueueing", async () => {
    await enqueueStudy(103);
    await db.execute(sql.raw(
      "UPDATE content_generation_queue SET status = 'completed' WHERE study_id = 103",
    ));

    await enqueueStudy(103);

    const found = await rows(
      "SELECT status FROM content_generation_queue WHERE study_id = 103 ORDER BY id",
    );
    expect(found.map((r) => r.status)).toEqual(["completed", "pending"]);
  });
});

describe("claimQueueItem — atomic pending→processing claim", () => {
  it("first claim wins (RETURNING row); second claim of the same row loses the race (0 rows)", async () => {
    await enqueueStudy(201);
    const [item] = await rows(
      "SELECT id FROM content_generation_queue WHERE study_id = 201",
    );

    const first = await claimQueueItem(item.id);
    expect(first).toEqual([{ id: item.id }]);

    // Same interleaving as a second worker that SELECTed the row while it
    // was still pending, then tried to claim after the first worker won.
    const second = await claimQueueItem(item.id);
    expect(second).toEqual([]);

    const [after] = await rows(
      `SELECT status, started_at FROM content_generation_queue WHERE id = ${item.id}`,
    );
    expect(after.status).toBe("processing");
    expect(after.started_at).not.toBeNull();
  });

  it("claiming a non-pending (already processing/completed) row returns nothing", async () => {
    await enqueueStudy(202);
    const [item] = await rows(
      "SELECT id FROM content_generation_queue WHERE study_id = 202",
    );
    await db.execute(sql.raw(
      `UPDATE content_generation_queue SET status = 'completed' WHERE id = ${item.id}`,
    ));

    expect(await claimQueueItem(item.id)).toEqual([]);
  });
});

describe("resetStaleProcessingJobs — orphaned 'processing' recovery", () => {
  it("resets a processing row older than the 90-min threshold to pending, leaves a fresh one alone", async () => {
    await db.execute(sql.raw(`
      INSERT INTO content_generation_queue (study_id, status, started_at) VALUES
        (301, 'processing', NOW() - INTERVAL '2 hours'),
        (302, 'processing', NOW() - INTERVAL '5 minutes')
    `));

    await resetStaleProcessingJobs();

    const found = await rows(
      "SELECT study_id, status FROM content_generation_queue ORDER BY study_id",
    );
    expect(found).toEqual([
      { study_id: 301, status: "pending" }, // stale → recovered
      { study_id: 302, status: "processing" }, // live waterfall → untouched
    ]);
  });

  it("also sweeps pipeline_queue on its 30-min threshold (and only that)", async () => {
    await db.execute(sql.raw(`
      INSERT INTO pipeline_queue (status, updated_at) VALUES
        ('processing', NOW() - INTERVAL '45 minutes'),
        ('processing', NOW() - INTERVAL '5 minutes'),
        ('completed',  NOW() - INTERVAL '45 minutes')
    `));

    await resetStaleProcessingJobs();

    const found = await rows("SELECT id, status FROM pipeline_queue ORDER BY id");
    expect(found.map((r) => r.status)).toEqual(["pending", "processing", "completed"]);
  });

  it("does not touch pending/completed/failed content rows regardless of age", async () => {
    await db.execute(sql.raw(`
      INSERT INTO content_generation_queue (study_id, status, started_at) VALUES
        (401, 'pending',   NOW() - INTERVAL '3 hours'),
        (402, 'completed', NOW() - INTERVAL '3 hours'),
        (403, 'failed',    NOW() - INTERVAL '3 hours')
    `));

    await resetStaleProcessingJobs();

    const found = await rows(
      "SELECT study_id, status FROM content_generation_queue ORDER BY study_id",
    );
    expect(found.map((r) => r.status)).toEqual(["pending", "completed", "failed"]);
  });
});
