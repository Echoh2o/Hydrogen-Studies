/**
 * Materialized Views Optimizer - Pre-computed query results for instant responses
 */

import { db } from "./db";
import { sql } from "drizzle-orm";

export async function createMaterializedViews(): Promise<void> {
  console.log('Creating materialized views for ultra-fast queries...');
  
  try {
    // Study search index view - Pre-computed searchable content
    await db.execute(sql`
      CREATE MATERIALIZED VIEW IF NOT EXISTS study_search_index AS
      SELECT 
        id,
        title,
        abstract,
        authors,
        journal,
        journal_publish_date,
        keywords,
        consumer_categories,
        doi,
        images,
        setweight(to_tsvector('english', COALESCE(title, '')), 'A') ||
        setweight(to_tsvector('english', COALESCE(abstract, '')), 'B') ||
        setweight(to_tsvector('english', COALESCE(keywords, '')), 'C') ||
        setweight(to_tsvector('english', COALESCE(authors, '')), 'D') as search_vector
      FROM studies
      WHERE title IS NOT NULL
    `);

    // Category statistics view - Pre-computed category counts
    await db.execute(sql`
      CREATE MATERIALIZED VIEW IF NOT EXISTS category_statistics AS
      WITH category_extraction AS (
        SELECT 
          id,
          CASE 
            WHEN consumer_categories::text LIKE '%Heart%' OR consumer_categories::text LIKE '%Cardiovascular%' THEN 'Heart Disease & Hypertension'
            WHEN consumer_categories::text LIKE '%Brain%' OR consumer_categories::text LIKE '%Neuro%' THEN 'Brain & Neurological Disorders'
            WHEN consumer_categories::text LIKE '%Diabetes%' OR consumer_categories::text LIKE '%Metabolic%' THEN 'Diabetes & Metabolic Health'
            WHEN consumer_categories::text LIKE '%Arthritis%' OR consumer_categories::text LIKE '%Inflammation%' THEN 'Arthritis & Inflammation'
            WHEN consumer_categories::text LIKE '%Lung%' OR consumer_categories::text LIKE '%Respiratory%' THEN 'Lung & Respiratory Conditions'
            WHEN consumer_categories::text LIKE '%Digestive%' OR consumer_categories::text LIKE '%Gut%' THEN 'Digestive Health (Gut/Liver)'
            WHEN consumer_categories::text LIKE '%Cancer%' THEN 'Cancer Supportive Care'
            ELSE 'General Wellness'
          END as condition_category,
          CASE 
            WHEN consumer_categories::text LIKE '%Heart%' OR consumer_categories::text LIKE '%Cardiovascular%' THEN 'Cardiovascular System'
            WHEN consumer_categories::text LIKE '%Brain%' OR consumer_categories::text LIKE '%Neuro%' THEN 'Nervous System'
            WHEN consumer_categories::text LIKE '%Lung%' OR consumer_categories::text LIKE '%Respiratory%' THEN 'Respiratory System'
            WHEN consumer_categories::text LIKE '%Digestive%' OR consumer_categories::text LIKE '%Gut%' THEN 'Digestive System'
            WHEN consumer_categories::text LIKE '%Immune%' OR consumer_categories::text LIKE '%Inflammation%' THEN 'Immune System'
            WHEN consumer_categories::text LIKE '%Muscle%' OR consumer_categories::text LIKE '%Bone%' THEN 'Musculoskeletal System'
            WHEN consumer_categories::text LIKE '%Kidney%' OR consumer_categories::text LIKE '%Renal%' THEN 'Renal System'
            WHEN consumer_categories::text LIKE '%Skin%' THEN 'Integumentary System'
            ELSE 'General System'
          END as body_system,
          CASE 
            WHEN consumer_categories::text LIKE '%Adult%' AND NOT consumer_categories::text LIKE '%Older%' THEN 'Adults'
            WHEN consumer_categories::text LIKE '%Older%' OR consumer_categories::text LIKE '%Senior%' THEN 'Older Adults'
            WHEN consumer_categories::text LIKE '%Athletic%' OR consumer_categories::text LIKE '%Fitness%' THEN 'Athletes & Fitness'
            ELSE 'General Population'
          END as life_stage
        FROM studies 
        WHERE consumer_categories IS NOT NULL
      )
      SELECT 
        'condition' as category_type,
        condition_category as category_name,
        COUNT(*) as study_count,
        ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 1) as percentage
      FROM category_extraction
      GROUP BY condition_category
      UNION ALL
      SELECT 
        'body_system' as category_type,
        body_system as category_name,
        COUNT(*) as study_count,
        ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 1) as percentage
      FROM category_extraction
      GROUP BY body_system
      UNION ALL
      SELECT 
        'life_stage' as category_type,
        life_stage as category_name,
        COUNT(*) as study_count,
        ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 1) as percentage
      FROM category_extraction
      GROUP BY life_stage
    `);

    // Journal analytics view - Pre-computed journal statistics
    await db.execute(sql`
      CREATE MATERIALIZED VIEW IF NOT EXISTS journal_analytics AS
      SELECT 
        journal,
        COUNT(*) as study_count,
        MIN(journal_publish_date) as earliest_publication,
        MAX(journal_publish_date) as latest_publication,
        COUNT(DISTINCT EXTRACT(YEAR FROM journal_publish_date)) as years_active,
        ROUND(AVG(EXTRACT(YEAR FROM journal_publish_date)), 0) as avg_publication_year
      FROM studies 
      WHERE journal IS NOT NULL AND journal != ''
      GROUP BY journal
      HAVING COUNT(*) >= 3
      ORDER BY study_count DESC
    `);

    // Trending keywords view - Pre-computed keyword popularity
    await db.execute(sql`
      CREATE MATERIALIZED VIEW IF NOT EXISTS trending_keywords AS
      SELECT 
        keyword,
        frequency,
        RANK() OVER (ORDER BY frequency DESC) as popularity_rank
      FROM (
        SELECT 
          TRIM(unnest(string_to_array(keywords, ','))) as keyword,
          COUNT(*) as frequency
        FROM studies 
        WHERE keywords IS NOT NULL AND keywords != ''
        GROUP BY TRIM(unnest(string_to_array(keywords, ',')))
        HAVING COUNT(*) >= 5
      ) keyword_stats
      ORDER BY frequency DESC
      LIMIT 50
    `);

    // Create indexes on materialized views for maximum performance
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_study_search_vector ON study_search_index USING gin(search_vector)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_study_search_date ON study_search_index (journal_publish_date DESC NULLS LAST)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_category_stats_type ON category_statistics (category_type, study_count DESC)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_journal_analytics_count ON journal_analytics (study_count DESC)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_trending_keywords_rank ON trending_keywords (popularity_rank)`);

    console.log('✓ Materialized views created successfully');

    // Refresh materialized views to populate with current data
    await refreshMaterializedViews();

  } catch (error) {
    console.error('Error creating materialized views:', error);
  }
}

export async function refreshMaterializedViews(): Promise<void> {
  try {
    console.log('Refreshing materialized views...');
    
    await Promise.all([
      db.execute(sql`REFRESH MATERIALIZED VIEW CONCURRENTLY study_search_index`),
      db.execute(sql`REFRESH MATERIALIZED VIEW CONCURRENTLY category_statistics`),
      db.execute(sql`REFRESH MATERIALIZED VIEW CONCURRENTLY journal_analytics`),
      db.execute(sql`REFRESH MATERIALIZED VIEW CONCURRENTLY trending_keywords`)
    ]);

    console.log('✓ Materialized views refreshed');
  } catch (error) {
    // If concurrent refresh fails, try regular refresh
    try {
      await Promise.all([
        db.execute(sql`REFRESH MATERIALIZED VIEW study_search_index`),
        db.execute(sql`REFRESH MATERIALIZED VIEW category_statistics`),
        db.execute(sql`REFRESH MATERIALIZED VIEW journal_analytics`),
        db.execute(sql`REFRESH MATERIALIZED VIEW trending_keywords`)
      ]);
      console.log('✓ Materialized views refreshed (non-concurrent)');
    } catch (refreshError) {
      console.error('Error refreshing materialized views:', refreshError);
    }
  }
}

// Ultra-fast search using materialized view
export async function ultraFastSearch(query: string, page = 1, pageSize = 20): Promise<any> {
  const offset = (page - 1) * pageSize;
  
  try {
    const searchQuery = query.trim();
    let whereClause = '';
    const params: any[] = [];
    
    if (searchQuery) {
      whereClause = 'WHERE search_vector @@ plainto_tsquery($1)';
      params.push(searchQuery);
    }

    const countQuery = `SELECT COUNT(*) as total FROM study_search_index ${whereClause}`;
    const dataQuery = `
      SELECT id, title, abstract, authors, journal, journal_publish_date, 
             doi, keywords, consumer_categories, images,
             ${searchQuery ? 'ts_rank(search_vector, plainto_tsquery($1)) as relevance_score' : '0 as relevance_score'}
      FROM study_search_index 
      ${whereClause}
      ORDER BY ${searchQuery ? 'relevance_score DESC,' : ''} journal_publish_date DESC NULLS LAST
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;

    const [countResult, dataResult] = await Promise.all([
      db.execute(sql.raw(countQuery, params)),
      db.execute(sql.raw(dataQuery, [...params, pageSize, offset]))
    ]);

    const total = parseInt((countResult as any).rows[0]?.total || '0');
    const studies = (dataResult as any).rows || [];

    return {
      data: studies,
      total,
      page,
      pageSize,
      pageCount: Math.ceil(total / pageSize),
      performance: {
        source: 'materialized_view',
        cached: false
      }
    };

  } catch (error) {
    console.error('Ultra-fast search error:', error);
    throw error;
  }
}

// Ultra-fast category counts using materialized view
export async function ultraFastCategoryCounts(): Promise<any> {
  try {
    const result = await db.execute(sql`
      SELECT 
        category_type,
        json_agg(
          json_build_object('name', category_name, 'count', study_count, 'percentage', percentage)
          ORDER BY study_count DESC
        ) as categories
      FROM category_statistics
      GROUP BY category_type
    `);

    const categoryData: any = { condition: [], body_system: [], life_stage: [] };
    
    for (const row of (result as any).rows || []) {
      const categoryType = row.category_type;
      categoryData[categoryType] = row.categories || [];
    }

    return {
      success: true,
      data: categoryData,
      performance: {
        source: 'materialized_view',
        cached: false
      }
    };

  } catch (error) {
    console.error('Ultra-fast category counts error:', error);
    throw error;
  }
}

// Ultra-fast trending keywords using materialized view
export async function ultraFastTrendingKeywords(): Promise<string[]> {
  try {
    const result = await db.execute(sql`
      SELECT keyword 
      FROM trending_keywords 
      ORDER BY popularity_rank 
      LIMIT 8
    `);

    return (result as any).rows?.map((row: any) => row.keyword) || [];

  } catch (error) {
    console.error('Ultra-fast trending keywords error:', error);
    return [
      'hydrogen water benefits',
      'cardiovascular health',
      'brain function',
      'athletic performance',
      'anti-aging research',
      'inflammation reduction'
    ];
  }
}

// Schedule automatic refresh of materialized views
export function scheduleMaterializedViewRefresh(): void {
  // Refresh materialized views every 6 hours
  setInterval(async () => {
    console.log('Scheduled materialized view refresh...');
    await refreshMaterializedViews();
  }, 6 * 60 * 60 * 1000);

  console.log('Materialized view refresh scheduler started (every 6 hours)');
}