import { db } from "../db";
import { sql } from "drizzle-orm";

/**
 * Migration 033 — ask_log for "Ask the research" (TRUST-BADGE-PLAN 3.5).
 * Questions are stored with emails/phones/long digit runs scrubbed; the IP is
 * never stored, only a salted per-day hash for rate analysis. Rows older than
 * 180 days are deleted by the route's housekeeping. Idempotent.
 */
export async function addAskLog(): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS ask_log (
      id SERIAL PRIMARY KEY,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      site TEXT NOT NULL,
      product TEXT,
      page TEXT,
      question TEXT NOT NULL,
      intent TEXT NOT NULL,
      status TEXT NOT NULL,
      cited_ids INTEGER[] NOT NULL DEFAULT '{}',
      retrieved_ids INTEGER[] NOT NULL DEFAULT '{}',
      ip_day_hash TEXT
    )
  `);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS ask_log_created_idx ON ask_log (created_at DESC)`);
}
