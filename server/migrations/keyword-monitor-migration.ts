import { db } from "../db";
import { sql } from "drizzle-orm";

/**
 * Run migrations for keyword monitoring tables
 */
export async function runKeywordMonitorMigrations() {
  console.log("Running keyword monitoring migrations...");

  try {
    // Create keywords table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS keywords (
        id SERIAL PRIMARY KEY,
        term TEXT NOT NULL,
        category TEXT NOT NULL DEFAULT 'general',
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        last_searched TIMESTAMP,
        match_count INTEGER DEFAULT 0,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    console.log("Keywords table created successfully");

    // Create excluded_keywords table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS excluded_keywords (
        id SERIAL PRIMARY KEY,
        term TEXT NOT NULL,
        reason TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    console.log("Excluded keywords table created successfully");

    // Create keyword_groups table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS keyword_groups (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    console.log("Keyword groups table created successfully");

    // Create keyword_group_mappings table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS keyword_group_mappings (
        id SERIAL PRIMARY KEY,
        keyword_id INTEGER NOT NULL REFERENCES keywords(id) ON DELETE CASCADE,
        group_id INTEGER NOT NULL REFERENCES keyword_groups(id) ON DELETE CASCADE
      )
    `);
    console.log("Keyword group mappings table created successfully");

    // Create monitor_results table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS monitor_results (
        id SERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        abstract TEXT,
        authors TEXT,
        journal TEXT,
        publish_date TEXT,
        doi TEXT,
        url TEXT,
        matched_keywords TEXT[],
        status TEXT NOT NULL DEFAULT 'pending',
        source TEXT NOT NULL,
        found_at TIMESTAMP NOT NULL DEFAULT NOW(),
        reviewed_by TEXT,
        reviewed_at TIMESTAMP,
        notes TEXT
      )
    `);
    console.log("Monitor results table created successfully");

    // Create monitor_schedule table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS monitor_schedule (
        id SERIAL PRIMARY KEY,
        enabled BOOLEAN NOT NULL DEFAULT FALSE,
        frequency TEXT NOT NULL DEFAULT 'daily',
        time TEXT NOT NULL DEFAULT '00:00',
        days TEXT[],
        sources TEXT[],
        last_run TIMESTAMP,
        next_run TIMESTAMP,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    console.log("Monitor schedule table created successfully");

    // Insert some initial sample keyword data
    await insertSampleKeywordData();

    console.log("Keyword monitoring migrations completed successfully");
  } catch (error) {
    console.error("Error running keyword monitoring migrations:", error);
    throw error;
  }
}

/**
 * Insert sample keyword data for demonstration
 */
async function insertSampleKeywordData() {
  // Check if there are already keywords in the table
  try {
    const result = await db.execute(sql`SELECT COUNT(*) FROM keywords`);
    const count = parseInt((result.rows[0] as any).count);

    if (count > 0) {
      console.log("Sample keywords already exist, skipping initialization");
      return;
    }
  } catch (error) {
    // Table might not exist yet or other error
    console.error("Error checking existing keywords:", error);
  }

  // Sample hydrogen health keywords
  const sampleKeywords = [
    { term: "molecular hydrogen", category: "general" },
    { term: "hydrogen-rich water", category: "delivery" },
    { term: "hydrogen gas inhalation", category: "delivery" },
    { term: "hydrogen bath", category: "delivery" },
    { term: "oxidative stress", category: "mechanism" },
    { term: "inflammation", category: "mechanism" },
    { term: "antioxidant", category: "mechanism" },
    { term: "neuroprotection", category: "benefit" },
    { term: "cardioprotection", category: "benefit" },
    { term: "metabolic syndrome", category: "disease" },
    { term: "diabetes", category: "disease" },
    { term: "elderly", category: "demographic" },
    { term: "athletes", category: "demographic" },
    { term: "hydrogen therapy", category: "general" },
  ];

  // Insert the sample keywords
  for (const keyword of sampleKeywords) {
    await db.execute(sql`
      INSERT INTO keywords (term, category, is_active, created_at, updated_at)
      VALUES (${keyword.term}, ${keyword.category}, true, NOW(), NOW())
    `);
  }
  console.log(`Inserted ${sampleKeywords.length} sample keywords`);

  // Sample excluded keywords
  const sampleExcludedKeywords = [
    { term: "hydrogen fuel cell", reason: "Related to energy, not health" },
    { term: "hydrogen production", reason: "Related to energy, not health" },
    { term: "electrolysis", reason: "Industrial process" },
    { term: "hydrogen storage", reason: "Related to energy, not health" },
    { term: "combustion", reason: "Not relevant to health benefits" },
    { term: "green hydrogen", reason: "Related to energy, not health" },
  ];

  // Insert the sample excluded keywords
  for (const excluded of sampleExcludedKeywords) {
    await db.execute(sql`
      INSERT INTO excluded_keywords (term, reason, created_at)
      VALUES (${excluded.term}, ${excluded.reason}, NOW())
    `);
  }
  console.log(
    `Inserted ${sampleExcludedKeywords.length} sample excluded keywords`,
  );

  // Sample keyword groups
  const sampleGroups = [
    {
      name: "Delivery Methods",
      description: "Keywords related to how hydrogen is administered",
    },
    {
      name: "Mechanisms",
      description: "Keywords related to how hydrogen works in the body",
    },
    {
      name: "Health Benefits",
      description: "Keywords related to specific health benefits",
    },
    {
      name: "Target Populations",
      description: "Keywords related to specific demographics",
    },
  ];

  // Insert the sample groups
  const insertedGroups = [];
  for (const group of sampleGroups) {
    const result = await db.execute(sql`
      INSERT INTO keyword_groups (name, description, is_active, created_at)
      VALUES (${group.name}, ${group.description}, true, NOW())
      RETURNING id, name
    `);

    if (result.rows && result.rows.length > 0) {
      insertedGroups.push(result.rows[0]);
    }
  }
  console.log(`Inserted ${insertedGroups.length} sample keyword groups`);

  // Get all keywords for mapping
  const keywordsResult = await db.execute(
    sql`SELECT id, term, category FROM keywords`,
  );
  const keywordsList = keywordsResult.rows || [];

  // Create sample mappings based on categories
  let mappingCount = 0;

  for (const group of insertedGroups) {
    let categoryToMatch = "";

    if (group.name === "Delivery Methods") categoryToMatch = "delivery";
    else if (group.name === "Mechanisms") categoryToMatch = "mechanism";
    else if (group.name === "Health Benefits") categoryToMatch = "benefit";
    else if (group.name === "Target Populations")
      categoryToMatch = "demographic";

    const matchingKeywords = keywordsList.filter(
      (k) => k.category === categoryToMatch,
    );

    for (const keyword of matchingKeywords) {
      await db.execute(sql`
        INSERT INTO keyword_group_mappings (keyword_id, group_id)
        VALUES (${keyword.id}, ${group.id})
      `);
      mappingCount++;
    }
  }

  if (mappingCount > 0) {
    console.log(`Inserted ${mappingCount} sample keyword-group mappings`);
  }
}
