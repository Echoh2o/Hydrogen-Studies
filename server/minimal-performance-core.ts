/**
 * Minimal Performance Core - Essential optimizations for maximum speed and stability
 */

import { db } from "./db";
import { sql } from "drizzle-orm";

// Simple, reliable cache with automatic cleanup
class SimpleCache {
  private cache = new Map<string, { data: any; expires: number }>();
  private readonly ttl = 10 * 60 * 1000; // 10 minutes

  constructor() {
    // Cleanup every 5 minutes
    setInterval(() => {
      const now = Date.now();
      const entries = Array.from(this.cache.entries());
      for (const [key, entry] of entries) {
        if (now > entry.expires) {
          this.cache.delete(key);
        }
      }
    }, 5 * 60 * 1000);
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

  size(): number {
    return this.cache.size;
  }
}

export const cache = new SimpleCache();

// Essential database optimizations
export async function createEssentialIndexes(): Promise<void> {
  const indexes = [
    sql`CREATE INDEX IF NOT EXISTS idx_studies_search_title ON studies USING gin(to_tsvector('english', title))`,
    sql`CREATE INDEX IF NOT EXISTS idx_studies_search_abstract ON studies USING gin(to_tsvector('english', abstract))`,
    sql`CREATE INDEX IF NOT EXISTS idx_studies_categories ON studies USING gin(consumer_categories)`,
    sql`CREATE INDEX IF NOT EXISTS idx_studies_date ON studies (journal_publish_date DESC NULLS LAST)`,
    sql`CREATE INDEX IF NOT EXISTS idx_studies_journal ON studies (journal)`
  ];

  try {
    await Promise.all(indexes.map(index => db.execute(index)));
    console.log('✓ Essential indexes created');
  } catch (error) {
    console.log('→ Indexes already exist or creation failed');
  }
}

// Optimized search function
export async function fastSearch(query: string, filters: any = {}, page = 1, pageSize = 20): Promise<any> {
  const cacheKey = `search_${JSON.stringify({query, filters, page, pageSize})}`;
  
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const offset = (page - 1) * pageSize;
  
  try {
    let whereConditions = sql`1=1`;

    if (query?.trim()) {
      const searchTerm = `%${query.trim()}%`;
      whereConditions = sql`${whereConditions} AND (
        title ILIKE ${searchTerm} OR 
        abstract ILIKE ${searchTerm} OR
        keywords ILIKE ${searchTerm}
      )`;
    }

    if (filters.condition) {
      const conditionTerm = `%${filters.condition}%`;
      whereConditions = sql`${whereConditions} AND consumer_categories::text LIKE ${conditionTerm}`;
    }

    const [countResult, studiesResult] = await Promise.all([
      db.execute(sql`SELECT COUNT(*) as total FROM studies WHERE ${whereConditions}`),
      db.execute(sql`
        SELECT id, title, abstract, authors, journal, journal_publish_date, 
               doi, keywords, consumer_categories, images
        FROM studies 
        WHERE ${whereConditions}
        ORDER BY journal_publish_date DESC NULLS LAST
        LIMIT ${pageSize} OFFSET ${offset}
      `)
    ]);

    const total = parseInt((countResult as any).rows[0]?.total || '0');
    const studies = (studiesResult as any).rows || [];

    const result = {
      data: studies,
      total,
      page,
      pageSize,
      pageCount: Math.ceil(total / pageSize)
    };

    cache.set(cacheKey, result);
    return result;

  } catch (error) {
    console.error('Search error:', error);
    return { data: [], total: 0, page, pageSize, pageCount: 0 };
  }
}

// Optimized category counts
export async function fastCategoryCounts(): Promise<any> {
  const cached = cache.get('category_counts');
  if (cached) return cached;

  try {
    // Get condition categories
    const conditionResult = await db.execute(sql`
      SELECT 
        CASE 
          WHEN consumer_categories::text LIKE '%Heart%' OR consumer_categories::text LIKE '%Cardiovascular%' THEN 'Heart Disease & Hypertension'
          WHEN consumer_categories::text LIKE '%Brain%' OR consumer_categories::text LIKE '%Neuro%' THEN 'Brain & Neurological Disorders'
          WHEN consumer_categories::text LIKE '%Diabetes%' OR consumer_categories::text LIKE '%Metabolic%' THEN 'Diabetes & Metabolic Health'
          WHEN consumer_categories::text LIKE '%Arthritis%' OR consumer_categories::text LIKE '%Inflammation%' THEN 'Arthritis & Inflammation'
          WHEN consumer_categories::text LIKE '%Lung%' OR consumer_categories::text LIKE '%Respiratory%' THEN 'Lung & Respiratory Conditions'
          WHEN consumer_categories::text LIKE '%Digestive%' OR consumer_categories::text LIKE '%Gut%' THEN 'Digestive Health (Gut/Liver)'
          WHEN consumer_categories::text LIKE '%Cancer%' THEN 'Cancer Supportive Care'
        END as name,
        COUNT(*) as count
      FROM studies 
      WHERE consumer_categories IS NOT NULL
        AND (
          consumer_categories::text LIKE '%Heart%' OR consumer_categories::text LIKE '%Cardiovascular%' OR
          consumer_categories::text LIKE '%Brain%' OR consumer_categories::text LIKE '%Neuro%' OR
          consumer_categories::text LIKE '%Diabetes%' OR consumer_categories::text LIKE '%Metabolic%' OR
          consumer_categories::text LIKE '%Arthritis%' OR consumer_categories::text LIKE '%Inflammation%' OR
          consumer_categories::text LIKE '%Lung%' OR consumer_categories::text LIKE '%Respiratory%' OR
          consumer_categories::text LIKE '%Digestive%' OR consumer_categories::text LIKE '%Gut%' OR
          consumer_categories::text LIKE '%Cancer%'
        )
      GROUP BY 
        CASE 
          WHEN consumer_categories::text LIKE '%Heart%' OR consumer_categories::text LIKE '%Cardiovascular%' THEN 'Heart Disease & Hypertension'
          WHEN consumer_categories::text LIKE '%Brain%' OR consumer_categories::text LIKE '%Neuro%' THEN 'Brain & Neurological Disorders'
          WHEN consumer_categories::text LIKE '%Diabetes%' OR consumer_categories::text LIKE '%Metabolic%' THEN 'Diabetes & Metabolic Health'
          WHEN consumer_categories::text LIKE '%Arthritis%' OR consumer_categories::text LIKE '%Inflammation%' THEN 'Arthritis & Inflammation'
          WHEN consumer_categories::text LIKE '%Lung%' OR consumer_categories::text LIKE '%Respiratory%' THEN 'Lung & Respiratory Conditions'
          WHEN consumer_categories::text LIKE '%Digestive%' OR consumer_categories::text LIKE '%Gut%' THEN 'Digestive Health (Gut/Liver)'
          WHEN consumer_categories::text LIKE '%Cancer%' THEN 'Cancer Supportive Care'
        END
      HAVING COUNT(*) > 0
      ORDER BY count DESC
    `);

    // Get body system categories
    const bodySystemResult = await db.execute(sql`
      SELECT 
        CASE 
          WHEN consumer_categories::text LIKE '%Heart%' OR consumer_categories::text LIKE '%Cardiovascular%' THEN 'Cardiovascular System'
          WHEN consumer_categories::text LIKE '%Brain%' OR consumer_categories::text LIKE '%Neuro%' THEN 'Nervous System'
          WHEN consumer_categories::text LIKE '%Lung%' OR consumer_categories::text LIKE '%Respiratory%' THEN 'Respiratory System'
          WHEN consumer_categories::text LIKE '%Digestive%' OR consumer_categories::text LIKE '%Gut%' THEN 'Digestive System'
          WHEN consumer_categories::text LIKE '%Immune%' OR consumer_categories::text LIKE '%Inflammation%' THEN 'Immune System'
          WHEN consumer_categories::text LIKE '%Muscle%' OR consumer_categories::text LIKE '%Bone%' THEN 'Musculoskeletal System'
          WHEN consumer_categories::text LIKE '%Kidney%' OR consumer_categories::text LIKE '%Renal%' THEN 'Renal System'
          WHEN consumer_categories::text LIKE '%Skin%' THEN 'Integumentary System'
        END as name,
        COUNT(*) as count
      FROM studies 
      WHERE consumer_categories IS NOT NULL
        AND (
          consumer_categories::text LIKE '%Heart%' OR consumer_categories::text LIKE '%Cardiovascular%' OR
          consumer_categories::text LIKE '%Brain%' OR consumer_categories::text LIKE '%Neuro%' OR
          consumer_categories::text LIKE '%Lung%' OR consumer_categories::text LIKE '%Respiratory%' OR
          consumer_categories::text LIKE '%Digestive%' OR consumer_categories::text LIKE '%Gut%' OR
          consumer_categories::text LIKE '%Immune%' OR consumer_categories::text LIKE '%Inflammation%' OR
          consumer_categories::text LIKE '%Muscle%' OR consumer_categories::text LIKE '%Bone%' OR
          consumer_categories::text LIKE '%Kidney%' OR consumer_categories::text LIKE '%Renal%' OR
          consumer_categories::text LIKE '%Skin%'
        )
      GROUP BY 
        CASE 
          WHEN consumer_categories::text LIKE '%Heart%' OR consumer_categories::text LIKE '%Cardiovascular%' THEN 'Cardiovascular System'
          WHEN consumer_categories::text LIKE '%Brain%' OR consumer_categories::text LIKE '%Neuro%' THEN 'Nervous System'
          WHEN consumer_categories::text LIKE '%Lung%' OR consumer_categories::text LIKE '%Respiratory%' THEN 'Respiratory System'
          WHEN consumer_categories::text LIKE '%Digestive%' OR consumer_categories::text LIKE '%Gut%' THEN 'Digestive System'
          WHEN consumer_categories::text LIKE '%Immune%' OR consumer_categories::text LIKE '%Inflammation%' THEN 'Immune System'
          WHEN consumer_categories::text LIKE '%Muscle%' OR consumer_categories::text LIKE '%Bone%' THEN 'Musculoskeletal System'
          WHEN consumer_categories::text LIKE '%Kidney%' OR consumer_categories::text LIKE '%Renal%' THEN 'Renal System'
          WHEN consumer_categories::text LIKE '%Skin%' THEN 'Integumentary System'
        END
      HAVING COUNT(*) > 0
      ORDER BY count DESC
    `);

    // Get life stage categories
    const lifeStageResult = await db.execute(sql`
      SELECT 
        CASE 
          WHEN consumer_categories::text LIKE '%Adult%' AND NOT consumer_categories::text LIKE '%Older%' THEN 'Adults'
          WHEN consumer_categories::text LIKE '%Older%' OR consumer_categories::text LIKE '%Senior%' THEN 'Older Adults'
          WHEN consumer_categories::text LIKE '%Athletic%' OR consumer_categories::text LIKE '%Fitness%' THEN 'Athletes & Fitness'
        END as name,
        COUNT(*) as count
      FROM studies 
      WHERE consumer_categories IS NOT NULL
        AND (
          (consumer_categories::text LIKE '%Adult%' AND NOT consumer_categories::text LIKE '%Older%') OR
          consumer_categories::text LIKE '%Older%' OR consumer_categories::text LIKE '%Senior%' OR
          consumer_categories::text LIKE '%Athletic%' OR consumer_categories::text LIKE '%Fitness%'
        )
      GROUP BY 
        CASE 
          WHEN consumer_categories::text LIKE '%Adult%' AND NOT consumer_categories::text LIKE '%Older%' THEN 'Adults'
          WHEN consumer_categories::text LIKE '%Older%' OR consumer_categories::text LIKE '%Senior%' THEN 'Older Adults'
          WHEN consumer_categories::text LIKE '%Athletic%' OR consumer_categories::text LIKE '%Fitness%' THEN 'Athletes & Fitness'
        END
      HAVING COUNT(*) > 0
      ORDER BY count DESC
    `);

    const response = {
      success: true,
      data: {
        condition: (conditionResult as any).rows || [],
        body_system: (bodySystemResult as any).rows || [],
        life_stage: (lifeStageResult as any).rows || []
      }
    };

    cache.set('category_counts', response);
    return response;

  } catch (error) {
    console.error('Category counts error:', error);
    return { success: false, data: { condition: [], body_system: [], life_stage: [] } };
  }
}

// Fast trending searches
export async function fastTrendingSearches(): Promise<string[]> {
  const cached = cache.get('trending_searches');
  if (cached) return cached;

  const trending = [
    'hydrogen water benefits',
    'cardiovascular health',
    'brain function',
    'athletic performance',
    'anti-aging research',
    'inflammation reduction'
  ];

  cache.set('trending_searches', trending);
  return trending;
}

// Memory monitoring
export function getSimpleStats(): any {
  const usage = process.memoryUsage();
  return {
    memory: Math.round(usage.heapUsed / 1024 / 1024),
    cache: cache.size(),
    uptime: Math.round(process.uptime())
  };
}

// Initialize essential optimizations
export async function initializeMinimalPerformance(): Promise<void> {
  console.log('Initializing minimal performance optimizations...');
  
  try {
    await createEssentialIndexes();
    console.log('✓ Minimal performance core initialized');
  } catch (error) {
    console.error('Performance initialization error:', error);
  }
}