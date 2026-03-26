/**
 * Migration to add consumer-facing summary fields to studies table:
 * plain_summary, key_finding, practical_takeaway
 */

import { db } from "../db";
import { sql } from "drizzle-orm";

export async function addStudySummaryFields() {
  console.log(
    "Starting migration: Adding plain_summary, key_finding, practical_takeaway to studies",
  );

  try {
    const check = await db.execute(sql`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'studies'
      AND column_name IN ('plain_summary', 'key_finding', 'practical_takeaway')
    `);

    const existing =
      check.rows?.map((row: any) => row.column_name) || [];

    if (!existing.includes("plain_summary")) {
      await db.execute(sql`ALTER TABLE studies ADD COLUMN plain_summary TEXT`);
      console.log("Added plain_summary column to studies");
    } else {
      console.log("plain_summary column already exists, skipping");
    }

    if (!existing.includes("key_finding")) {
      await db.execute(sql`ALTER TABLE studies ADD COLUMN key_finding TEXT`);
      console.log("Added key_finding column to studies");
    } else {
      console.log("key_finding column already exists, skipping");
    }

    if (!existing.includes("practical_takeaway")) {
      await db.execute(sql`ALTER TABLE studies ADD COLUMN practical_takeaway TEXT`);
      console.log("Added practical_takeaway column to studies");
    } else {
      console.log("practical_takeaway column already exists, skipping");
    }

    console.log("Study summary fields migration completed successfully");
  } catch (error) {
    console.error("Error adding study summary fields:", error);
    throw error;
  }
}
