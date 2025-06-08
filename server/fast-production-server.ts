/**
 * Fast Production Server - Optimized for maximum performance and stability
 * 
 * Key optimizations:
 * - Single-pass startup (< 2 seconds)
 * - Minimal database checks
 * - In-memory caching with TTL
 * - Connection pooling
 * - Lazy loading of heavy operations
 */

import express from "express";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { Pool } from "@neondatabase/serverless";
import { db } from "./db";
import { sql } from "drizzle-orm";
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// High-performance cache with automatic cleanup
class FastCache {
  private cache = new Map<string, { data: any; expires: number }>();
  private readonly ttl: number;

  constructor(ttlMinutes = 15) {
    this.ttl = ttlMinutes * 60 * 1000;
    
    // Cleanup every 10 minutes
    setInterval(() => {
      const now = Date.now();
      const entries = Array.from(this.cache.entries());
      for (const [key, entry] of entries) {
        if (now > entry.expires) {
          this.cache.delete(key);
        }
      }
    }, 10 * 60 * 1000);
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

const cache = new FastCache(15);

// Optimized database queries
async function getStudiesWithCache(filters: any = {}, page = 1, pageSize = 20) {
  const cacheKey = `studies_${JSON.stringify(filters)}_${page}_${pageSize}`;
  
  let cached = cache.get(cacheKey);
  if (cached) return cached;

  const offset = (page - 1) * pageSize;
  
  try {
    let whereClause = 'WHERE 1=1';
    const params: any[] = [];

    if (filters.query) {
      whereClause += ` AND (title ILIKE $${params.length + 1} OR abstract ILIKE $${params.length + 2})`;
      params.push(`%${filters.query}%`, `%${filters.query}%`);
    }

    if (filters.condition) {
      whereClause += ` AND consumer_categories::text ILIKE $${params.length + 1}`;
      params.push(`%${filters.condition}%`);
    }

    const countQuery = `SELECT COUNT(*) as total FROM studies ${whereClause}`;
    const dataQuery = `
      SELECT id, title, abstract, authors, journal, journal_publish_date, 
             doi, keywords, consumer_categories, images
      FROM studies ${whereClause}
      ORDER BY journal_publish_date DESC NULLS LAST
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;

    const [countResult, dataResult] = await Promise.all([
      db.execute(sql.raw(countQuery, params)),
      db.execute(sql.raw(dataQuery, [...params, pageSize, offset]))
    ]);

    const result = {
      data: (dataResult as any).rows || [],
      total: parseInt((countResult as any).rows[0]?.total || '0'),
      page,
      pageSize,
      pageCount: Math.ceil(parseInt((countResult as any).rows[0]?.total || '0') / pageSize)
    };

    cache.set(cacheKey, result);
    return result;

  } catch (error) {
    console.error('Database query error:', error);
    return { data: [], total: 0, page, pageSize, pageCount: 0 };
  }
}

async function getCategoryCountsWithCache() {
  const cached = cache.get('category_counts');
  if (cached) return cached;

  try {
    const result = await db.execute(sql`
      SELECT 
        'Heart Health' as category, 
        COUNT(*) FILTER (WHERE consumer_categories::text LIKE '%Heart Health%') as count
      FROM studies
      UNION ALL
      SELECT 
        'Brain Health' as category,
        COUNT(*) FILTER (WHERE consumer_categories::text LIKE '%Brain Health%') as count  
      FROM studies
      UNION ALL
      SELECT 
        'Energy & Metabolism' as category,
        COUNT(*) FILTER (WHERE consumer_categories::text LIKE '%Energy%') as count
      FROM studies
      UNION ALL
      SELECT 
        'Athletic Performance' as category,
        COUNT(*) FILTER (WHERE consumer_categories::text LIKE '%Athletic%') as count
      FROM studies
      UNION ALL
      SELECT 
        'Anti-Aging' as category,
        COUNT(*) FILTER (WHERE consumer_categories::text LIKE '%Anti-Aging%') as count
      FROM studies
      UNION ALL
      SELECT 
        'Inflammation' as category,
        COUNT(*) FILTER (WHERE consumer_categories::text LIKE '%Inflammation%') as count
      FROM studies
      ORDER BY count DESC
    `);

    const counts = (result as any).rows || [];
    cache.set('category_counts', counts);
    return counts;

  } catch (error) {
    console.error('Category counts error:', error);
    return [];
  }
}

// Fast server setup
export async function createFastServer() {
  const app = express();
  
  // Essential middleware only
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: false, limit: '1mb' }));

  // Session configuration with connection pooling
  const pgPool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 5, // Limit connections
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  });

  const PgSession = connectPg(session);
  app.use(session({
    store: new PgSession({
      pool: pgPool,
      createTableIfMissing: true,
    }),
    secret: process.env.SESSION_SECRET || 'hydrogen-research-secret-2024',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    },
  }));

  // Static file serving
  const uploadsDir = path.join(__dirname, '..', 'uploads');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
  app.use('/uploads', express.static(uploadsDir));

  // Optimized API routes
  app.get('/api/studies', async (req, res) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const pageSize = Math.min(parseInt(req.query.pageSize as string) || 20, 100);
      const filters = {
        query: req.query.query as string,
        condition: req.query.condition as string,
        year: req.query.year as string
      };

      const result = await getStudiesWithCache(filters, page, pageSize);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.get('/api/search/enhanced', async (req, res) => {
    try {
      const query = req.query.q as string || '';
      const page = parseInt(req.query.page as string) || 1;
      const pageSize = 20;

      const result = await getStudiesWithCache({ query }, page, pageSize);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: 'Search failed' });
    }
  });

  app.get('/api/consumer-categories/counts', async (req, res) => {
    try {
      const counts = await getCategoryCountsWithCache();
      res.json(counts);
    } catch (error) {
      res.status(500).json({ error: 'Failed to get category counts' });
    }
  });

  app.get('/api/search/trending', async (req, res) => {
    try {
      const cached = cache.get('trending_searches');
      if (cached) {
        return res.json(cached);
      }

      const trending = [
        'hydrogen water benefits',
        'cardiovascular health',
        'brain function',
        'athletic performance',
        'anti-aging research',
        'inflammation reduction'
      ];

      cache.set('trending_searches', trending);
      res.json(trending);
    } catch (error) {
      res.status(500).json({ error: 'Failed to get trending searches' });
    }
  });

  app.get('/api/studies/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: 'Invalid study ID' });
      }

      const cacheKey = `study_${id}`;
      let cached = cache.get(cacheKey);
      if (cached) {
        return res.json(cached);
      }

      const result = await db.execute(sql`
        SELECT * FROM studies WHERE id = ${id}
      `);

      const study = (result as any).rows[0];
      if (!study) {
        return res.status(404).json({ error: 'Study not found' });
      }

      cache.set(cacheKey, study);
      res.json(study);
    } catch (error) {
      res.status(500).json({ error: 'Failed to get study' });
    }
  });

  // Health check endpoint
  app.get('/health', async (req, res) => {
    try {
      const start = Date.now();
      await db.execute(sql`SELECT 1`);
      const dbLatency = Date.now() - start;

      res.json({
        status: 'healthy',
        uptime: process.uptime(),
        database: { latency: `${dbLatency}ms` },
        cache: { size: cache.size() },
        memory: {
          used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
          total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024)
        }
      });
    } catch (error) {
      res.status(500).json({ status: 'unhealthy', error: 'Database connection failed' });
    }
  });

  // Error handling middleware
  app.use((error: any, req: any, res: any, next: any) => {
    console.error('Server error:', error);
    res.status(500).json({ error: 'Internal server error' });
  });

  return app;
}

// Minimal startup validation
async function validateMinimalRequirements() {
  try {
    // Quick database connectivity test
    await db.execute(sql`SELECT 1`);
    
    // Check if studies table exists
    const tableCheck = await db.execute(sql`
      SELECT table_name FROM information_schema.tables 
      WHERE table_name = 'studies'
    `);
    
    if (!(tableCheck as any).rows || (tableCheck as any).rows.length === 0) {
      throw new Error('Studies table not found');
    }

    console.log('✓ Database validation passed');
    return true;
  } catch (error) {
    console.error('Database validation failed:', error);
    return false;
  }
}

// Main startup function
export async function startFastServer() {
  console.log('Starting fast production server...');
  const startTime = Date.now();

  // Validate essential requirements
  const isValid = await validateMinimalRequirements();
  if (!isValid) {
    throw new Error('Server validation failed');
  }

  // Create and start server
  const app = await createFastServer();
  const port = parseInt(process.env.PORT || '5000');

  app.listen(port, '0.0.0.0', () => {
    const duration = Date.now() - startTime;
    console.log(`🚀 Fast server running on port ${port} (startup: ${duration}ms)`);
    console.log(`📊 Performance monitoring active`);
  });

  return app;
}