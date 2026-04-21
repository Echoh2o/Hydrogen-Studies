/**
 * Migration: Drop the legacy `password` column from the `users` table.
 *
 * The `users` table historically had two columns: `password` (plaintext-
 * leftover from a very early migration) and `passwordHash` (bcrypt hash,
 * the real credential). All authentication code reads/writes only
 * `passwordHash`. At migration time, `password` was NULL for every row in
 * production — verified before shipping — so dropping it is non-destructive.
 *
 * Safeguards:
 *   - IF EXISTS so dev DBs without the column don't fail.
 *   - Aborts if any row actually has data in the column (paranoia — even
 *     though we verified 0 populated rows at audit time, something could
 *     have written to it between audit and deploy).
 */
import { db } from "../db";
import { sql } from "drizzle-orm";
import { logger } from "../utils/logger";

export async function dropLegacyPasswordColumn(): Promise<void> {
  // Check column exists
  const colCheck = await db.execute(sql`
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'users'
      AND column_name = 'password'
    LIMIT 1
  `);
  if ((colCheck.rows ?? []).length === 0) {
    logger.info("Legacy password column already absent — nothing to do", "Migration");
    return;
  }

  // Paranoia: refuse to drop if anyone actually has a non-null value
  const populated = await db.execute(sql`
    SELECT COUNT(*)::int AS n FROM users WHERE password IS NOT NULL
  `);
  const n = Number((populated.rows?.[0] as any)?.n ?? 0);
  if (n > 0) {
    throw new Error(
      `Refusing to drop users.password: ${n} rows have non-null values. ` +
        `Investigate before continuing.`,
    );
  }

  await db.execute(sql`ALTER TABLE users DROP COLUMN IF EXISTS password`);
  logger.info("Dropped legacy users.password column", "Migration");
}
