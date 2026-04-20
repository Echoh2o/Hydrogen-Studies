/**
 * Migration: Apply explicit ON DELETE policies to foreign keys that were
 * previously created without one (default: NO ACTION / RESTRICT).
 *
 * Each FK below was reviewed individually:
 *   - cascade  → child is owned by parent (delete child when parent goes)
 *   - set null → attribution/reference; preserve the row when parent goes
 *   - restrict → reference data we explicitly don't want auto-deleted
 *
 * The DDL below is idempotent: it looks up the actual constraint name in
 * pg_catalog (since drizzle-kit push may generate slightly different names
 * across versions), drops it if present, and recreates with the desired
 * policy. Safe to re-run; only acts when the existing policy doesn't match.
 */
import { db } from "../db";
import { sql } from "drizzle-orm";
import { logger } from "../utils/logger";

type OnDeletePolicy = "CASCADE" | "SET NULL" | "RESTRICT";

interface FkPolicy {
  table: string;
  column: string;
  refTable: string;
  refColumn: string;
  onDelete: OnDeletePolicy;
}

const FK_POLICIES: FkPolicy[] = [
  // Sessions + audit trail
  { table: "user_sessions", column: "user_id", refTable: "users", refColumn: "id", onDelete: "CASCADE" },
  { table: "audit_logs", column: "user_id", refTable: "users", refColumn: "id", onDelete: "SET NULL" },

  // User-owned chat content
  { table: "conversations", column: "user_id", refTable: "users", refColumn: "id", onDelete: "CASCADE" },
  { table: "chat_messages", column: "conversation_id", refTable: "conversations", refColumn: "id", onDelete: "CASCADE" },
  { table: "chat_feedback", column: "message_id", refTable: "chat_messages", refColumn: "id", onDelete: "CASCADE" },
  { table: "chat_feedback", column: "user_id", refTable: "users", refColumn: "id", onDelete: "SET NULL" },

  // Blog interactions (junction)
  { table: "user_blog_interactions", column: "user_id", refTable: "users", refColumn: "id", onDelete: "CASCADE" },
  { table: "user_blog_interactions", column: "blog_id", refTable: "blog_articles", refColumn: "id", onDelete: "CASCADE" },

  // Reference data
  { table: "health_conditions", column: "body_system_id", refTable: "body_systems", refColumn: "id", onDelete: "RESTRICT" },
  { table: "study_health_conditions", column: "health_condition_id", refTable: "health_conditions", refColumn: "id", onDelete: "CASCADE" },
  { table: "collection_studies", column: "collection_id", refTable: "study_collections", refColumn: "id", onDelete: "CASCADE" },

  // Review queue attribution
  { table: "study_review_queue", column: "saved_by_user_id", refTable: "users", refColumn: "id", onDelete: "SET NULL" },
  { table: "study_review_queue", column: "reviewed_by_user_id", refTable: "users", refColumn: "id", onDelete: "SET NULL" },
  { table: "study_review_queue", column: "duplicate_of_study_id", refTable: "studies", refColumn: "id", onDelete: "SET NULL" },

  // Analytics — preserve rows, drop attribution
  { table: "search_queries", column: "user_id", refTable: "users", refColumn: "id", onDelete: "SET NULL" },
  { table: "user_engagement", column: "user_id", refTable: "users", refColumn: "id", onDelete: "SET NULL" },

  // Trends
  { table: "trend_alerts", column: "trend_analysis_id", refTable: "trend_analysis", refColumn: "id", onDelete: "CASCADE" },
  { table: "trend_alerts", column: "acknowledged_by", refTable: "users", refColumn: "id", onDelete: "SET NULL" },

  // Update history
  { table: "update_history", column: "notification_id", refTable: "update_notifications", refColumn: "id", onDelete: "SET NULL" },
];

/**
 * Map a human-readable policy to its pg_constraint confdeltype code.
 * pg_constraint.confdeltype values:
 *   'a' = NO ACTION (default)
 *   'r' = RESTRICT
 *   'c' = CASCADE
 *   'n' = SET NULL
 *   'd' = SET DEFAULT
 */
function policyToPgCode(policy: OnDeletePolicy): string {
  switch (policy) {
    case "CASCADE": return "c";
    case "SET NULL": return "n";
    case "RESTRICT": return "r";
  }
}

export async function applyFkOnDeletePolicies(): Promise<void> {
  let updated = 0;
  let skippedExisting = 0;
  let skippedMissing = 0;

  for (const fk of FK_POLICIES) {
    const desiredCode = policyToPgCode(fk.onDelete);

    // Look up the existing constraint by (child table, child column).
    // Returns constraint name AND current delete action code.
    const existing = await db.execute(sql`
      SELECT
        con.conname AS constraint_name,
        con.confdeltype AS delete_code
      FROM pg_constraint con
      JOIN pg_class child_t ON child_t.oid = con.conrelid
      JOIN pg_namespace n ON n.oid = child_t.relnamespace
      JOIN pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = ANY(con.conkey)
      WHERE con.contype = 'f'
        AND n.nspname = 'public'
        AND child_t.relname = ${fk.table}
        AND att.attname = ${fk.column}
      LIMIT 1
    `);

    const row = (existing.rows ?? [])[0] as { constraint_name?: string; delete_code?: string } | undefined;

    if (!row?.constraint_name) {
      // FK doesn't exist in this DB — harmless (e.g., table missing in dev).
      skippedMissing++;
      continue;
    }

    if (row.delete_code === desiredCode) {
      // Already correct — nothing to do.
      skippedExisting++;
      continue;
    }

    // Drop + recreate. Constraint names need to be quoted because they may
    // contain chars that need escaping (underscores are fine, but be safe).
    const constraintName = row.constraint_name;
    const newConstraintName = `${fk.table}_${fk.column}_${fk.refTable}_${fk.refColumn}_fk`;

    await db.execute(
      sql.raw(`ALTER TABLE "${fk.table}" DROP CONSTRAINT "${constraintName}"`),
    );
    await db.execute(
      sql.raw(
        `ALTER TABLE "${fk.table}" ADD CONSTRAINT "${newConstraintName}" ` +
          `FOREIGN KEY ("${fk.column}") REFERENCES "${fk.refTable}"("${fk.refColumn}") ` +
          `ON DELETE ${fk.onDelete}`,
      ),
    );

    logger.info(
      `FK policy updated: ${fk.table}.${fk.column} → ON DELETE ${fk.onDelete}`,
      "Migration",
    );
    updated++;
  }

  logger.info(
    `FK policies applied: ${updated} updated, ${skippedExisting} already correct, ${skippedMissing} not present`,
    "Migration",
  );
}
