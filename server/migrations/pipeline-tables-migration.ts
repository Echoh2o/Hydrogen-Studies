import { db } from "../db";
import { sql } from "drizzle-orm";
import { logger } from "../utils/logger";

/**
 * Migration: Create Research Intelligence Pipeline tables.
 * Uses CREATE TABLE IF NOT EXISTS — safe to run multiple times.
 */
export async function createPipelineTables() {
  try {
    logger.info("Starting pipeline tables migration", "Migration");

    // 1. pipeline_queue
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS pipeline_queue (
        id SERIAL PRIMARY KEY,
        doi TEXT,
        title TEXT NOT NULL,
        authors TEXT,
        journal TEXT,
        publish_date TEXT,
        abstract TEXT,
        source_url TEXT,
        source_platform TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        current_step INTEGER NOT NULL DEFAULT 0,
        step_results TEXT NOT NULL DEFAULT '{}',
        created_study_id INTEGER REFERENCES studies(id),
        error_message TEXT,
        retry_count INTEGER NOT NULL DEFAULT 0,
        max_retries INTEGER NOT NULL DEFAULT 3,
        discovery_run_id INTEGER,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
        processed_at TIMESTAMP
      );
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS pipeline_queue_status_idx ON pipeline_queue(status);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS pipeline_queue_doi_idx ON pipeline_queue(doi);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS pipeline_queue_created_at_idx ON pipeline_queue(created_at);`);
    logger.info("Created pipeline_queue table", "Migration");

    // 2. discovery_runs
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS discovery_runs (
        id SERIAL PRIMARY KEY,
        source TEXT NOT NULL,
        queries TEXT NOT NULL DEFAULT '[]',
        found_count INTEGER NOT NULL DEFAULT 0,
        new_count INTEGER NOT NULL DEFAULT 0,
        duplicate_count INTEGER NOT NULL DEFAULT 0,
        queued_count INTEGER NOT NULL DEFAULT 0,
        duration_ms INTEGER,
        status TEXT NOT NULL DEFAULT 'running',
        error_message TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS discovery_runs_created_at_idx ON discovery_runs(created_at);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS discovery_runs_status_idx ON discovery_runs(status);`);
    logger.info("Created discovery_runs table", "Migration");

    // 3. study_citations
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS study_citations (
        id SERIAL PRIMARY KEY,
        from_study_id INTEGER NOT NULL REFERENCES studies(id) ON DELETE CASCADE,
        to_study_id INTEGER REFERENCES studies(id) ON DELETE CASCADE,
        to_doi TEXT,
        to_title TEXT,
        direction TEXT NOT NULL,
        source TEXT NOT NULL DEFAULT 'crossref',
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS study_citations_from_idx ON study_citations(from_study_id);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS study_citations_to_idx ON study_citations(to_study_id);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS study_citations_to_doi_idx ON study_citations(to_doi);`);
    logger.info("Created study_citations table", "Migration");

    // 4. research_digests
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS research_digests (
        id SERIAL PRIMARY KEY,
        week_start TEXT NOT NULL,
        week_end TEXT NOT NULL,
        title TEXT NOT NULL,
        slug TEXT NOT NULL UNIQUE,
        narrative TEXT NOT NULL,
        narrative_markdown TEXT,
        trending_topics TEXT NOT NULL DEFAULT '[]',
        notable_findings TEXT NOT NULL DEFAULT '[]',
        study_count INTEGER NOT NULL DEFAULT 0,
        study_ids TEXT NOT NULL DEFAULT '[]',
        meta_title TEXT,
        meta_description TEXT,
        is_published BOOLEAN NOT NULL DEFAULT FALSE,
        published_at TIMESTAMP,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS research_digests_slug_idx ON research_digests(slug);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS research_digests_week_start_idx ON research_digests(week_start);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS research_digests_published_idx ON research_digests(is_published);`);
    logger.info("Created research_digests table", "Migration");

    // 5. seo_content_clusters
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS seo_content_clusters (
        id SERIAL PRIMARY KEY,
        pillar_keyword TEXT NOT NULL,
        pillar_title TEXT NOT NULL,
        slug TEXT NOT NULL UNIQUE,
        category TEXT NOT NULL DEFAULT 'research',
        target_audience TEXT NOT NULL DEFAULT 'consumer',
        search_intent TEXT NOT NULL DEFAULT 'informational',
        cluster_keywords TEXT NOT NULL DEFAULT '[]',
        pillar_article_id INTEGER,
        total_cluster_posts INTEGER NOT NULL DEFAULT 0,
        generated_cluster_posts INTEGER NOT NULL DEFAULT 0,
        echo_product_references TEXT NOT NULL DEFAULT '[]',
        include_product_cta BOOLEAN NOT NULL DEFAULT TRUE,
        estimated_search_volume INTEGER,
        keyword_difficulty INTEGER,
        priority INTEGER NOT NULL DEFAULT 50,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS seo_content_clusters_slug_idx ON seo_content_clusters(slug);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS seo_content_clusters_category_idx ON seo_content_clusters(category);`);
    logger.info("Created seo_content_clusters table", "Migration");

    logger.info("Pipeline tables migration complete", "Migration");
  } catch (err: any) {
    logger.error("Pipeline tables migration failed", err, "Migration");
    throw err;
  }
}
