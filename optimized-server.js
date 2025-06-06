/**
 * Optimized Production Server
 * Streamlined architecture for maximum performance and stability
 * 
 * Key optimizations:
 * - Minimal startup time (< 3 seconds)
 * - Reduced memory footprint
 * - Cached database queries
 * - Simplified route structure
 * - No heavy background processes during startup
 */

import express from 'express';
import { neon } from '@neondatabase/serverless';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

// Optimized database connection with pooling
const sql = neon(process.env.DATABASE_URL, {
  fetchConnectionCache: true,
  fullResults: true
});

// Simple in-memory cache for frequently accessed data
const cache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function getCacheKey(endpoint, params) {
  return `${endpoint}_${JSON.stringify(params)}`;
}

function getCached(key) {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }
  cache.delete(key);
  return null;
}

function setCache(key, data) {
  cache.set(key, { data, timestamp: Date.now() });
}

// Lightweight middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'dist')));

// CORS headers
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// Optimized main studies endpoint with caching
app.get('/api/studies', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 20, 100); // Cap at 100
    const offset = (page - 1) * limit;
    const search = req.query.search?.trim() || '';

    const cacheKey = getCacheKey('studies', { page, limit, search });
    const cached = getCached(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    let whereClause = 'WHERE title IS NOT NULL AND abstract IS NOT NULL';
    let queryParams = [];

    if (search) {
      whereClause += ` AND (title ILIKE $${queryParams.length + 1} OR abstract ILIKE $${queryParams.length + 1})`;
      queryParams.push(`%${search}%`);
    }

    // Optimized query - select only essential fields
    const studiesQuery = `
      SELECT id, title, abstract, authors, journal, publish_date, 
             category, image_url, view_count, slug, doi
      FROM studies 
      ${whereClause}
      ORDER BY view_count DESC, id DESC 
      LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}
    `;
    
    queryParams.push(limit, offset);

    const [studiesResult, countResult] = await Promise.all([
      sql(studiesQuery, queryParams),
      sql(`SELECT COUNT(*) as total FROM studies ${whereClause}`, queryParams.slice(0, -2))
    ]);

    const total = parseInt(countResult.rows[0]?.total || 0);
    const pageCount = Math.ceil(total / limit);

    const response = {
      data: studiesResult.rows.map(study => ({
        id: study.id,
        title: study.title,
        abstract: study.abstract?.substring(0, 300) + '...', // Truncate for performance
        authors: study.authors,
        journal: study.journal,
        publishDate: study.publish_date,
        category: study.category,
        imageUrl: study.image_url,
        viewCount: study.view_count || 0,
        slug: study.slug,
        doi: study.doi
      })),
      total,
      page,
      pageSize: limit,
      pageCount
    };

    setCache(cacheKey, response);
    res.json(response);
  } catch (error) {
    console.error('Studies API error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch studies',
      data: [], total: 0, page: 1, pageSize: limit || 20, pageCount: 0
    });
  }
});

// Optimized single study endpoint
app.get('/api/studies/:id', async (req, res) => {
  try {
    const studyId = parseInt(req.params.id);
    if (isNaN(studyId)) {
      return res.status(400).json({ error: 'Invalid study ID' });
    }

    const cacheKey = getCacheKey('study', { id: studyId });
    const cached = getCached(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    const result = await sql(`
      SELECT * FROM studies WHERE id = $1
    `, [studyId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Study not found' });
    }

    const study = result.rows[0];
    setCache(cacheKey, study);
    res.json(study);
  } catch (error) {
    console.error('Study fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch study' });
  }
});

// Optimized categories endpoint with caching
app.get('/api/categories', async (req, res) => {
  try {
    const cacheKey = getCacheKey('categories', {});
    const cached = getCached(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    const result = await sql(`
      SELECT id, name, description, study_count, slug, icon
      FROM categories 
      WHERE study_count > 0 
      ORDER BY study_count DESC
      LIMIT 20
    `);
    
    setCache(cacheKey, result.rows);
    res.json(result.rows);
  } catch (error) {
    console.error('Categories API error:', error);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

// Optimized category studies endpoint
app.get('/api/categories/:id/studies', async (req, res) => {
  try {
    const categoryId = parseInt(req.params.id);
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const offset = (page - 1) * limit;

    const cacheKey = getCacheKey('category_studies', { categoryId, page, limit });
    const cached = getCached(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    const [studiesResult, countResult] = await Promise.all([
      sql(`
        SELECT id, title, abstract, authors, journal, publish_date,
               category, image_url, view_count, slug, doi
        FROM studies 
        WHERE category_id = $1
        ORDER BY view_count DESC, id DESC 
        LIMIT $2 OFFSET $3
      `, [categoryId, limit, offset]),
      sql(`SELECT COUNT(*) as total FROM studies WHERE category_id = $1`, [categoryId])
    ]);

    const total = parseInt(countResult.rows[0]?.total || 0);
    const pageCount = Math.ceil(total / limit);

    const response = {
      data: studiesResult.rows.map(study => ({
        id: study.id,
        title: study.title,
        abstract: study.abstract?.substring(0, 300) + '...',
        authors: study.authors,
        journal: study.journal,
        publishDate: study.publish_date,
        category: study.category,
        imageUrl: study.image_url,
        viewCount: study.view_count || 0,
        slug: study.slug,
        doi: study.doi
      })),
      total,
      page,
      pageSize: limit,
      pageCount
    };

    setCache(cacheKey, response);
    res.json(response);
  } catch (error) {
    console.error('Category studies API error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch category studies',
      data: [], total: 0, page: 1, pageSize: limit || 20, pageCount: 0
    });
  }
});

// Optimized search endpoint
app.get('/api/search', async (req, res) => {
  try {
    const query = req.query.q?.trim() || '';
    const limit = Math.min(parseInt(req.query.limit) || 10, 50);

    if (!query) {
      return res.json([]);
    }

    const cacheKey = getCacheKey('search', { query, limit });
    const cached = getCached(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    const result = await sql(`
      SELECT id, title, abstract, authors, journal, category, image_url
      FROM studies 
      WHERE title ILIKE $1 OR abstract ILIKE $1 OR authors ILIKE $1
      ORDER BY 
        CASE 
          WHEN title ILIKE $1 THEN 1
          WHEN abstract ILIKE $1 THEN 2
          ELSE 3
        END,
        view_count DESC
      LIMIT $2
    `, [`%${query}%`, limit]);

    const results = result.rows.map(study => ({
      id: study.id,
      title: study.title,
      abstract: study.abstract?.substring(0, 200) + '...',
      authors: study.authors,
      journal: study.journal,
      category: study.category,
      imageUrl: study.image_url
    }));

    setCache(cacheKey, results);
    res.json(results);
  } catch (error) {
    console.error('Search API error:', error);
    res.status(500).json([]);
  }
});

// Database overview endpoint
app.get('/api/database-overview', async (req, res) => {
  try {
    const cacheKey = getCacheKey('overview', {});
    const cached = getCached(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    const [totalResult, categoriesResult] = await Promise.all([
      sql(`SELECT COUNT(*) as total FROM studies`),
      sql(`SELECT id, name, study_count FROM categories WHERE study_count > 0 ORDER BY study_count DESC LIMIT 10`)
    ]);

    const response = {
      totalStudies: parseInt(totalResult.rows[0]?.total || 0),
      categories: categoriesResult.rows,
      lastUpdated: new Date().toISOString()
    };

    setCache(cacheKey, response);
    res.json(response);
  } catch (error) {
    console.error('Database overview error:', error);
    res.status(500).json({ error: 'Failed to fetch database overview' });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    cache_size: cache.size
  });
});

// Serve React app for all other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// Cache cleanup every 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of cache.entries()) {
    if (now - value.timestamp > CACHE_TTL) {
      cache.delete(key);
    }
  }
}, 10 * 60 * 1000);

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('Received SIGTERM, shutting down gracefully');
  cache.clear();
  process.exit(0);
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Optimized server running on port ${PORT}`);
  console.log(`📊 Performance features: caching, query optimization, minimal startup`);
  console.log(`💾 Memory usage optimized with ${CACHE_TTL/1000/60}min cache TTL`);
});