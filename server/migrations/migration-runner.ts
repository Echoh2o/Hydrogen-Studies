/**
 * Migration Runner — tracks which migrations have been applied.
 *
 * Creates a `_migrations` table on first run to record applied migrations.
 * Each migration is run at most once, identified by its name.
 * Supports rollback via an optional `down` function (not auto-executed).
 */
import { db } from "../db";
import { sql } from "drizzle-orm";
import { logger } from "../utils/logger";

interface Migration {
  name: string;
  up: () => Promise<void>;
  down?: () => Promise<void>;
}

/**
 * Ensure the migrations tracking table exists.
 */
async function ensureMigrationTable(): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS _migrations (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      applied_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);
}

/**
 * Check if a migration has already been applied.
 */
async function isApplied(name: string): Promise<boolean> {
  const result = await db.execute(
    sql`SELECT 1 FROM _migrations WHERE name = ${name} LIMIT 1`
  );
  return (result.rows?.length ?? 0) > 0;
}

/**
 * Record a migration as applied.
 */
async function recordMigration(name: string): Promise<void> {
  await db.execute(
    sql`INSERT INTO _migrations (name) VALUES (${name}) ON CONFLICT (name) DO NOTHING`
  );
}

/**
 * Run all pending migrations in order.
 * Skips migrations that have already been applied.
 */
export async function runMigrations(migrations: Migration[]): Promise<void> {
  await ensureMigrationTable();

  for (const migration of migrations) {
    if (await isApplied(migration.name)) {
      continue;
    }

    logger.info(`Running migration: ${migration.name}`, "MigrationRunner");
    try {
      await migration.up();
      await recordMigration(migration.name);
      logger.info(`Migration complete: ${migration.name}`, "MigrationRunner");
    } catch (error) {
      logger.error(`Migration failed: ${migration.name}`, error, "MigrationRunner");
      throw error; // Stop running further migrations
    }
  }
}

/**
 * List all applied migrations.
 */
export async function listAppliedMigrations(): Promise<string[]> {
  await ensureMigrationTable();
  const result = await db.execute(
    sql`SELECT name FROM _migrations ORDER BY applied_at`
  );
  return (result.rows ?? []).map((r: any) => r.name);
}
