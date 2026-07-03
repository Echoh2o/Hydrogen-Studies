/**
 * Cross-process advisory locks (Postgres session-level).
 *
 * Audit finding (2026-07): every background-sync mutual-exclusion guard in
 * this app is in-process (`isJobRunning`/`isFastJobRunning` booleans in the
 * JobScheduler, `gscSyncInFlight` in gsc-service). A second Railway replica —
 * or the old+new instance overlap during a rolling deploy — double-runs every
 * sync and doubles AI spend. `withAdvisoryLock` adds cross-process exclusion
 * on top of those in-process fast-path guards. (The DB-backed queues —
 * content_generation_queue, pipeline_queue — already use atomic claims and
 * do NOT need this; the lock serializes scheduling/sync runs, not item claims.)
 *
 * Key derivation: `pg_try_advisory_lock(hashtext($1), 0)`. `hashtext()` maps
 * the lock name to a 32-bit key server-side; the constant second int (0)
 * namespaces this app's locks in the two-int keyspace. With only a handful of
 * named locks, a 32-bit collision is vanishingly unlikely, and the worst case
 * is two unrelated jobs serializing — safe, just slower.
 *
 * Session semantics: an advisory lock is owned by the CONNECTION that
 * acquired it, so we check out a dedicated pool client, hold that same client
 * for the whole duration of `fn`, and unlock on it. If the unlock fails (the
 * connection died mid-job), we destroy the client (`release(true)`) so the
 * lock dies with the connection instead of leaking a poisoned pool slot.
 *
 * Availability tradeoff (deliberate): if we cannot even talk to Postgres to
 * TRY the lock (pool.connect or the lock query itself throws), we log a
 * warning and run `fn` anyway WITHOUT the lock. Solo-instance is the common
 * case, the syncs are idempotent-ish (ON CONFLICT upserts, throttle stamps),
 * and skipping every sync whenever the DB hiccups would trade a rare,
 * tolerable double-run for a common silent outage. A lock that is HELD by
 * another instance is different: then we skip (`null`) — that is the lock
 * doing its job.
 */
import type { PoolClient } from "pg";
import { pool } from "../db";
import { logger } from "./logger";

const TAG = "AdvisoryLock";

const TRY_LOCK_SQL = "SELECT pg_try_advisory_lock(hashtext($1), 0) AS locked";
const UNLOCK_SQL = "SELECT pg_advisory_unlock(hashtext($1), 0)";

/**
 * Run `fn` while holding the Postgres advisory lock named `lockName`.
 *
 * - Lock acquired → runs `fn`, returns its value, always unlocks in finally.
 * - Lock held by another session → does NOT run `fn`, returns `null`.
 * - Postgres unreachable → runs `fn` WITHOUT the lock (see module comment).
 */
export async function withAdvisoryLock<T>(
  lockName: string,
  fn: () => Promise<T>,
): Promise<T | null> {
  let client: PoolClient;
  try {
    client = await pool.connect();
  } catch (err) {
    logger.warn(
      `Could not acquire a DB client for advisory lock "${lockName}" — running WITHOUT cross-process lock`,
      TAG,
      { lockName, error: err instanceof Error ? err.message : String(err) },
    );
    return fn();
  }

  let acquired = false;
  try {
    const result = await client.query(TRY_LOCK_SQL, [lockName]);
    acquired = result.rows?.[0]?.locked === true;
  } catch (err) {
    // The lock query itself failed (connection died, etc.). Destroy the
    // client — its state is suspect — and fall back to running unlocked.
    client.release(true);
    logger.warn(
      `Advisory lock query failed for "${lockName}" — running WITHOUT cross-process lock`,
      TAG,
      { lockName, error: err instanceof Error ? err.message : String(err) },
    );
    return fn();
  }

  if (!acquired) {
    client.release();
    logger.info(`Another instance holds advisory lock "${lockName}" — skipping`, TAG, {
      lockName,
    });
    return null;
  }

  try {
    return await fn();
  } finally {
    try {
      // MUST unlock on the same client that locked — session-level semantics.
      await client.query(UNLOCK_SQL, [lockName]);
      client.release();
    } catch (unlockErr) {
      // Connection is broken; destroy it so the advisory lock dies with the
      // connection rather than a zombie client leaking a pool slot AND the lock.
      logger.warn(
        `Failed to release advisory lock "${lockName}" — destroying client so the lock dies with the connection`,
        TAG,
        {
          lockName,
          error: unlockErr instanceof Error ? unlockErr.message : String(unlockErr),
        },
      );
      client.release(true);
    }
  }
}
