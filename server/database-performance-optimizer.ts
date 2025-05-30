/**
 * Database Performance Optimizer
 * 
 * Implements advanced indexes and query optimizations for improved search performance
 */

import { db } from './db';
import { sql } from 'drizzle-orm';

interface OptimizationResult {
  indexName: string;
  created: boolean;
  executionTime: number;
  error?: string;
}

async function optimizeQueryPerformance(): Promise<OptimizationResult[]> {
  console.log('Starting database query performance optimization...');
  
  const optimizations: OptimizationResult[] = [];
  
  // 1. Composite index for category + citation filtering
  try {
    const startTime = Date.now();
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_studies_category_citations 
      ON studies (category, citation_url) 
      WHERE citation_url IS NOT NULL AND citation_url != ''
    `);
    optimizations.push({
      indexName: 'idx_studies_category_citations',
      created: true,
      executionTime: Date.now() - startTime
    });
    console.log('✓ Created category + citation composite index');
  } catch (error) {
    optimizations.push({
      indexName: 'idx_studies_category_citations',
      created: false,
      executionTime: 0,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }

  // 2. Year-based search optimization
  try {
    const startTime = Date.now();
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_studies_year_category_optimized 
      ON studies (publish_year DESC, category, peer_reviewed) 
      WHERE publish_year IS NOT NULL
    `);
    optimizations.push({
      indexName: 'idx_studies_year_category_optimized',
      created: true,
      executionTime: Date.now() - startTime
    });
    console.log('✓ Created year-based search optimization index');
  } catch (error) {
    optimizations.push({
      indexName: 'idx_studies_year_category_optimized',
      created: false,
      executionTime: 0,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }

  // 3. Enhanced full-text search with ranking
  try {
    const startTime = Date.now();
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_studies_weighted_search 
      ON studies USING gin (
        (setweight(to_tsvector('english', title), 'A') ||
         setweight(to_tsvector('english', abstract), 'B') ||
         setweight(to_tsvector('english', COALESCE(methods, '')), 'C'))
      )
    `);
    optimizations.push({
      indexName: 'idx_studies_weighted_search',
      created: true,
      executionTime: Date.now() - startTime
    });
    console.log('✓ Created weighted full-text search index');
  } catch (error) {
    optimizations.push({
      indexName: 'idx_studies_weighted_search',
      created: false,
      executionTime: 0,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }

  // 4. Health conditions and body systems filtering
  try {
    const startTime = Date.now();
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_studies_health_filtering 
      ON studies (health_conditions, body_systems, category) 
      WHERE health_conditions IS NOT NULL OR body_systems IS NOT NULL
    `);
    optimizations.push({
      indexName: 'idx_studies_health_filtering',
      created: true,
      executionTime: Date.now() - startTime
    });
    console.log('✓ Created health conditions filtering index');
  } catch (error) {
    optimizations.push({
      indexName: 'idx_studies_health_filtering',
      created: false,
      executionTime: 0,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }

  // 5. Research quality metrics index
  try {
    const startTime = Date.now();
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_studies_quality_metrics 
      ON studies (peer_reviewed, sample_size DESC, citation_count DESC) 
      WHERE peer_reviewed = true AND sample_size IS NOT NULL
    `);
    optimizations.push({
      indexName: 'idx_studies_quality_metrics',
      created: true,
      executionTime: Date.now() - startTime
    });
    console.log('✓ Created research quality metrics index');
  } catch (error) {
    optimizations.push({
      indexName: 'idx_studies_quality_metrics',
      created: false,
      executionTime: 0,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }

  // 6. Data completeness filtering
  try {
    const startTime = Date.now();
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_studies_completeness 
      ON studies (
        CASE 
          WHEN citation_url IS NOT NULL AND citation_url != '' THEN 3
          WHEN source_url IS NOT NULL AND source_url != '' THEN 2  
          ELSE 1
        END DESC,
        publish_year DESC
      )
    `);
    optimizations.push({
      indexName: 'idx_studies_completeness',
      created: true,
      executionTime: Date.now() - startTime
    });
    console.log('✓ Created data completeness index');
  } catch (error) {
    optimizations.push({
      indexName: 'idx_studies_completeness',
      created: false,
      executionTime: 0,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }

  // 7. Recent studies with citations (hot data)
  try {
    const startTime = Date.now();
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_studies_recent_cited 
      ON studies (created_at DESC, view_count DESC) 
      WHERE citation_url IS NOT NULL 
      AND citation_url != '' 
      AND publish_year >= 2020
    `);
    optimizations.push({
      indexName: 'idx_studies_recent_cited',
      created: true,
      executionTime: Date.now() - startTime
    });
    console.log('✓ Created recent cited studies index');
  } catch (error) {
    optimizations.push({
      indexName: 'idx_studies_recent_cited',
      created: false,
      executionTime: 0,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }

  return optimizations;
}

async function analyzeQueryPerformance(): Promise<void> {
  console.log('\nAnalyzing query performance improvements...');
  
  // Test search query performance
  try {
    const startTime = Date.now();
    await db.execute(sql`
      SELECT s.id, s.title, s.category, s.publish_year, s.citation_url
      FROM studies s 
      WHERE s.category = 'Cardiovascular' 
      AND s.citation_url IS NOT NULL 
      AND s.publish_year >= 2020
      ORDER BY s.publish_year DESC
      LIMIT 10
    `);
    const executionTime = Date.now() - startTime;
    console.log(`✓ Category + citation filter query: ${executionTime}ms`);
  } catch (error) {
    console.log(`✗ Category filter test failed: ${error}`);
  }

  // Test full-text search performance
  try {
    const startTime = Date.now();
    await db.execute(sql`
      SELECT s.id, s.title, 
        ts_rank(to_tsvector('english', s.title || ' ' || s.abstract), plainto_tsquery('english', 'hydrogen water')) as rank
      FROM studies s 
      WHERE to_tsvector('english', s.title || ' ' || s.abstract) @@ plainto_tsquery('english', 'hydrogen water')
      ORDER BY rank DESC
      LIMIT 20
    `);
    const executionTime = Date.now() - startTime;
    console.log(`✓ Full-text search query: ${executionTime}ms`);
  } catch (error) {
    console.log(`✗ Full-text search test failed: ${error}`);
  }

  // Test health conditions filtering
  try {
    const startTime = Date.now();
    await db.execute(sql`
      SELECT s.id, s.title, s.health_conditions, s.body_systems
      FROM studies s 
      WHERE (s.health_conditions ILIKE '%diabetes%' OR s.body_systems ILIKE '%metabolic%')
      AND s.citation_url IS NOT NULL
      LIMIT 15
    `);
    const executionTime = Date.now() - startTime;
    console.log(`✓ Health conditions filter query: ${executionTime}ms`);
  } catch (error) {
    console.log(`✗ Health conditions test failed: ${error}`);
  }
}

async function createAggregationViews(): Promise<void> {
  console.log('\nCreating performance-optimized aggregation views...');
  
  // Category statistics view
  try {
    await db.execute(sql`
      CREATE OR REPLACE VIEW category_stats AS
      SELECT 
        category,
        COUNT(*) as total_studies,
        COUNT(CASE WHEN citation_url IS NOT NULL AND citation_url != '' THEN 1 END) as studies_with_citations,
        COUNT(CASE WHEN publish_year >= 2020 THEN 1 END) as recent_studies,
        AVG(CASE WHEN sample_size IS NOT NULL THEN sample_size END) as avg_sample_size,
        MAX(publish_year) as latest_year
      FROM studies 
      WHERE category IS NOT NULL
      GROUP BY category
      ORDER BY total_studies DESC
    `);
    console.log('✓ Created category statistics view');
  } catch (error) {
    console.log(`✗ Category stats view failed: ${error}`);
  }

  // Research trends view
  try {
    await db.execute(sql`
      CREATE OR REPLACE VIEW research_trends AS
      SELECT 
        publish_year,
        COUNT(*) as studies_count,
        COUNT(CASE WHEN citation_url IS NOT NULL AND citation_url != '' THEN 1 END) as cited_studies,
        COUNT(DISTINCT journal) as unique_journals,
        AVG(LENGTH(abstract)) as avg_abstract_length
      FROM studies 
      WHERE publish_year IS NOT NULL AND publish_year >= 2000
      GROUP BY publish_year
      ORDER BY publish_year DESC
    `);
    console.log('✓ Created research trends view');
  } catch (error) {
    console.log(`✗ Research trends view failed: ${error}`);
  }
}

// Run optimizations
async function runCompleteOptimization() {
  const results = await optimizeQueryPerformance();
  await analyzeQueryPerformance();
  await createAggregationViews();
  
  console.log('\nOptimization Summary:');
  results.forEach(result => {
    if (result.created) {
      console.log(`✓ ${result.indexName}: ${result.executionTime}ms`);
    } else {
      console.log(`✗ ${result.indexName}: ${result.error}`);
    }
  });
  
  const successfulOptimizations = results.filter(r => r.created).length;
  console.log(`\nCompleted ${successfulOptimizations}/${results.length} optimizations successfully`);
  
  return results;
}

// Run optimizations immediately
runCompleteOptimization()
  .then(() => {
    console.log('Database performance optimization completed successfully');
    process.exit(0);
  })
  .catch(error => {
    console.error('Optimization failed:', error);
    process.exit(1);
  });

export { runCompleteOptimization, optimizeQueryPerformance, analyzeQueryPerformance };