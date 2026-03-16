import { db } from "../db";
import { sql } from "drizzle-orm";

/**
 * Migration 005: Add tldr and how_to_apply columns to the studies table.
 * - tldr: AI-generated super-simplified summary
 * - how_to_apply: JSON string with study-specific practical application guidance
 */
export async function addTldrAndHowToApply(): Promise<void> {
  // Add tldr column if it doesn't exist
  const tldrCheck = await db.execute(sql`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'studies' AND column_name = 'tldr'
  `);

  if (tldrCheck.rows.length === 0) {
    await db.execute(sql`ALTER TABLE studies ADD COLUMN tldr TEXT`);
  }

  // Add how_to_apply column if it doesn't exist
  const htaCheck = await db.execute(sql`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'studies' AND column_name = 'how_to_apply'
  `);

  if (htaCheck.rows.length === 0) {
    await db.execute(sql`ALTER TABLE studies ADD COLUMN how_to_apply TEXT`);
  }
}
