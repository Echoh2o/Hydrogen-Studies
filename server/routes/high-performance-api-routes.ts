/**
 * High-Performance API Routes - Optimized endpoints with aggressive caching
 */

import { Router } from 'express';
import { db } from '../db';
import { sql } from 'drizzle-orm';
import { optimizedSearchEndpoint, getTrendingSearches, getStudyOptimized } from '../route-optimization';
import { comprehensiveHealthCheck } from '../comprehensive-performance-monitor';

const router = Router();

// Ultra-fast cache for high-frequency endpoints
class UltraFastCache {
  private cache = new Map<string, { data: any; expires: number }>();
  private readonly ttl: number;

  constructor(ttlMinutes = 5) {
    this.ttl = ttlMinutes * 60 * 1000;
  }

  get(key: string): any | null {
    const entry = this.cache.get(key);
    if (!entry || Date.now() > entry.expires) {
      this.cache.delete(key);
      return null;
    }
    return entry.data;
  }

  set(key: string, data: any): void {
    this.cache.set(key, {
      data,
      expires: Date.now() + this.ttl
    });
  }
}

const ultraCache = new UltraFastCache(10); // 10-minute cache for critical endpoints

// Optimized consumer categories with aggressive caching
router.get('/consumer-categories/counts', async (req, res) => {
  try {
    const cached = ultraCache.get('category_counts_optimized');
    if (cached) {
      return res.json(cached);
    }

    // Single optimized query for all category counts
    const result = await db.execute(sql`
      WITH study_categories AS (
        SELECT 
          id,
          consumer_categories,
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
      ),
      condition_counts AS (
        SELECT condition_category as name, COUNT(*) as count
        FROM study_categories
        GROUP BY condition_category
        ORDER BY count DESC
      ),
      body_system_counts AS (
        SELECT body_system as name, COUNT(*) as count
        FROM study_categories
        GROUP BY body_system
        ORDER BY count DESC
      ),
      life_stage_counts AS (
        SELECT life_stage as name, COUNT(*) as count
        FROM study_categories
        GROUP BY life_stage
        ORDER BY count DESC
      )
      SELECT 
        'condition' as category_type,
        json_agg(json_build_object('name', name, 'count', count) ORDER BY count DESC) as data
      FROM condition_counts
      UNION ALL
      SELECT 
        'body_system' as category_type,
        json_agg(json_build_object('name', name, 'count', count) ORDER BY count DESC) as data
      FROM body_system_counts
      UNION ALL
      SELECT 
        'life_stage' as category_type,
        json_agg(json_build_object('name', name, 'count', count) ORDER BY count DESC) as data
      FROM life_stage_counts
    `);

    // Transform result into expected format
    const categoryData: any = { condition: [], body_system: [], life_stage: [] };
    
    for (const row of (result as any).rows || []) {
      const categoryType = row.category_type;
      categoryData[categoryType] = row.data || [];
    }

    const response = {
      success: true,
      data: categoryData
    };

    // Cache for 10 minutes since categories change infrequently
    ultraCache.set('category_counts_optimized', response);
    res.json(response);

  } catch (error) {
    console.error('Category counts error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Unable to load category counts' 
    });
  }
});

// Enhanced search with performance tracking
router.get('/search/enhanced', async (req, res) => {
  const startTime = Date.now();
  
  try {
    const query = req.query.q as string || '';
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = Math.min(parseInt(req.query.pageSize as string) || 20, 100);
    
    const filters = {
      condition: req.query.condition as string,
      year: req.query.year as string,
      journal: req.query.journal as string
    };

    const result = await optimizedSearchEndpoint(query, filters, page, pageSize);
    
    // Add performance metadata
    result.performance = {
      queryTime: Date.now() - startTime,
      cached: result.performance?.cached || false
    };

    res.json(result);
  } catch (error) {
    console.error('Enhanced search error:', error);
    res.status(500).json({ error: 'Search temporarily unavailable' });
  }
});

// Lightning-fast trending searches
router.get('/search/trending', async (req, res) => {
  try {
    const cached = ultraCache.get('trending_searches');
    if (cached) {
      return res.json(cached);
    }

    const trending = await getTrendingSearches();
    ultraCache.set('trending_searches', trending);
    res.json(trending);
  } catch (error) {
    console.error('Trending searches error:', error);
    res.status(500).json({ error: 'Unable to load trending searches' });
  }
});

// Optimized studies endpoint with enhanced filtering
router.get('/studies', async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = Math.min(parseInt(req.query.pageSize as string) || 20, 100);
    
    const cacheKey = `studies_${page}_${pageSize}`;
    const cached = ultraCache.get(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    const offset = (page - 1) * pageSize;

    const result = await db.execute(sql`
      SELECT 
        id, title, abstract, authors, journal, journal_publish_date,
        doi, keywords, consumer_categories, images
      FROM studies 
      ORDER BY 
        CASE WHEN journal_publish_date IS NOT NULL THEN journal_publish_date END DESC NULLS LAST,
        id DESC
      LIMIT ${pageSize} OFFSET ${offset}
    `);

    const countResult = await db.execute(sql`SELECT COUNT(*) as total FROM studies`);
    const total = parseInt((countResult as any).rows[0]?.total || '0');

    const response = {
      data: (result as any).rows || [],
      total,
      page,
      pageSize,
      pageCount: Math.ceil(total / pageSize)
    };

    ultraCache.set(cacheKey, response);
    res.json(response);

  } catch (error) {
    console.error('Studies endpoint error:', error);
    res.status(500).json({ error: 'Unable to load studies' });
  }
});

// Single study with enhanced performance
router.get('/studies/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid study ID' });
    }

    const study = await getStudyOptimized(id);
    if (!study) {
      return res.status(404).json({ error: 'Study not found' });
    }

    res.json(study);
  } catch (error) {
    console.error('Study retrieval error:', error);
    res.status(500).json({ error: 'Unable to load study' });
  }
});

// Database overview with caching
router.get('/database/overview', async (req, res) => {
  try {
    const cached = ultraCache.get('database_overview');
    if (cached) {
      return res.json(cached);
    }

    const [studyCount, journalCount, yearRange] = await Promise.all([
      db.execute(sql`SELECT COUNT(*) as count FROM studies`),
      db.execute(sql`SELECT COUNT(DISTINCT journal) as count FROM studies WHERE journal IS NOT NULL`),
      db.execute(sql`
        SELECT 
          MIN(EXTRACT(YEAR FROM journal_publish_date)) as min_year,
          MAX(EXTRACT(YEAR FROM journal_publish_date)) as max_year
        FROM studies 
        WHERE journal_publish_date IS NOT NULL
      `)
    ]);

    const overview = {
      totalStudies: parseInt((studyCount as any).rows[0]?.count || '0'),
      uniqueJournals: parseInt((journalCount as any).rows[0]?.count || '0'),
      yearRange: {
        from: (yearRange as any).rows[0]?.min_year || null,
        to: (yearRange as any).rows[0]?.max_year || null
      },
      lastUpdated: new Date().toISOString()
    };

    ultraCache.set('database_overview', overview);
    res.json(overview);

  } catch (error) {
    console.error('Database overview error:', error);
    res.status(500).json({ error: 'Unable to load database overview' });
  }
});

// Performance monitoring endpoint
router.get('/performance/health', async (req, res) => {
  try {
    const health = await comprehensiveHealthCheck();
    res.json(health);
  } catch (error) {
    console.error('Health check error:', error);
    res.status(500).json({ error: 'Health check failed' });
  }
});

export default router;