/**
 * Migration to add fields needed for the Shopify App Proxy research database
 * Adds columns to both studies and health_conditions tables
 */

import { db } from "../db";
import { sql } from "drizzle-orm";

export async function addProxyResearchFields() {
  console.log(
    "Starting migration: Adding proxy research fields to studies and health_conditions tables",
  );

  try {
    // ── Studies table columns ──────────────────────────────────────────

    const checkStudiesColumns = await db.execute(sql`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'studies'
      AND column_name IN ('h2_delivery_method', 'h2_concentration', 'dosage_protocol', 'methodology_summary', 'limitations', 'is_human_trial')
    `);

    const existingStudiesColumns =
      checkStudiesColumns.rows?.map((row: any) => row.column_name) || [];

    // Add h2_delivery_method column if it doesn't exist
    if (!existingStudiesColumns.includes("h2_delivery_method")) {
      await db.execute(sql`
        ALTER TABLE studies
        ADD COLUMN h2_delivery_method TEXT
      `);
      console.log("Added h2_delivery_method column to studies");
    } else {
      console.log("h2_delivery_method column already exists, skipping");
    }

    // Add h2_concentration column if it doesn't exist
    if (!existingStudiesColumns.includes("h2_concentration")) {
      await db.execute(sql`
        ALTER TABLE studies
        ADD COLUMN h2_concentration VARCHAR(100)
      `);
      console.log("Added h2_concentration column to studies");
    } else {
      console.log("h2_concentration column already exists, skipping");
    }

    // Add dosage_protocol column if it doesn't exist
    if (!existingStudiesColumns.includes("dosage_protocol")) {
      await db.execute(sql`
        ALTER TABLE studies
        ADD COLUMN dosage_protocol TEXT
      `);
      console.log("Added dosage_protocol column to studies");
    } else {
      console.log("dosage_protocol column already exists, skipping");
    }

    // Add methodology_summary column if it doesn't exist
    if (!existingStudiesColumns.includes("methodology_summary")) {
      await db.execute(sql`
        ALTER TABLE studies
        ADD COLUMN methodology_summary TEXT
      `);
      console.log("Added methodology_summary column to studies");
    } else {
      console.log("methodology_summary column already exists, skipping");
    }

    // Add limitations column if it doesn't exist
    if (!existingStudiesColumns.includes("limitations")) {
      await db.execute(sql`
        ALTER TABLE studies
        ADD COLUMN limitations TEXT
      `);
      console.log("Added limitations column to studies");
    } else {
      console.log("limitations column already exists, skipping");
    }

    // Add is_human_trial column if it doesn't exist
    if (!existingStudiesColumns.includes("is_human_trial")) {
      await db.execute(sql`
        ALTER TABLE studies
        ADD COLUMN is_human_trial BOOLEAN DEFAULT false
      `);
      console.log("Added is_human_trial column to studies");
    } else {
      console.log("is_human_trial column already exists, skipping");
    }

    // ── Health conditions table columns ────────────────────────────────

    const checkHealthColumns = await db.execute(sql`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'health_conditions'
      AND column_name IN ('mechanism_summary', 'primary_product', 'confidence_level', 'human_trial_count', 'search_volume_estimate')
    `);

    const existingHealthColumns =
      checkHealthColumns.rows?.map((row: any) => row.column_name) || [];

    // Add mechanism_summary column if it doesn't exist
    if (!existingHealthColumns.includes("mechanism_summary")) {
      await db.execute(sql`
        ALTER TABLE health_conditions
        ADD COLUMN mechanism_summary TEXT
      `);
      console.log("Added mechanism_summary column to health_conditions");
    } else {
      console.log("mechanism_summary column already exists, skipping");
    }

    // Add primary_product column if it doesn't exist
    if (!existingHealthColumns.includes("primary_product")) {
      await db.execute(sql`
        ALTER TABLE health_conditions
        ADD COLUMN primary_product VARCHAR(50)
      `);
      console.log("Added primary_product column to health_conditions");
    } else {
      console.log("primary_product column already exists, skipping");
    }

    // Add confidence_level column if it doesn't exist
    if (!existingHealthColumns.includes("confidence_level")) {
      await db.execute(sql`
        ALTER TABLE health_conditions
        ADD COLUMN confidence_level VARCHAR(20)
      `);
      console.log("Added confidence_level column to health_conditions");
    } else {
      console.log("confidence_level column already exists, skipping");
    }

    // Add human_trial_count column if it doesn't exist
    if (!existingHealthColumns.includes("human_trial_count")) {
      await db.execute(sql`
        ALTER TABLE health_conditions
        ADD COLUMN human_trial_count INTEGER DEFAULT 0
      `);
      console.log("Added human_trial_count column to health_conditions");
    } else {
      console.log("human_trial_count column already exists, skipping");
    }

    // Add search_volume_estimate column if it doesn't exist
    if (!existingHealthColumns.includes("search_volume_estimate")) {
      await db.execute(sql`
        ALTER TABLE health_conditions
        ADD COLUMN search_volume_estimate INTEGER
      `);
      console.log("Added search_volume_estimate column to health_conditions");
    } else {
      console.log("search_volume_estimate column already exists, skipping");
    }

    console.log(
      "Proxy research fields migration completed successfully",
    );
  } catch (error) {
    console.error("Error adding proxy research fields:", error);
    throw error;
  }
}
