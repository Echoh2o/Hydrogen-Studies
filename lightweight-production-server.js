/**
 * Lightweight Production Server
 * Optimized for maximum performance and minimal resource usage
 */

import express from 'express';
import { neon } from '@neondatabase/serverless';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 5002;

// Optimized database connection
const sql = neon(process.env.DATABASE_URL);

// Performance cache
const cache = new Map();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

function getFromCache(key) {
  const item = cache.get(key);
  if (item && Date.now() - item.timestamp < CACHE_DURATION) {
    return item.data;
  }
  cache.delete(key);
  return null;
}

function setCache(key, data) {
  cache.set(key, { data, timestamp: Date.now() });
}

// Minimal middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'dist')));
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// Core API endpoints only
app.get('/api/studies', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 20, 50);
    const offset = (page - 1) * limit;
    const search = req.query.search?.trim() || '';

    const cacheKey = `studies:${page}:${limit}:${search}`;
    const cached = getFromCache(cacheKey);
    if (cached) return res.json(cached);

    let whereClause = 'WHERE title IS NOT NULL';
    let params = [];

    if (search) {
      whereClause += ' AND (title ILIKE $1 OR abstract ILIKE $1)';
      params.push(`%${search}%`);
    }

    const [studies, total] = await Promise.all([
      sql(`
        SELECT id, title, SUBSTRING(abstract, 1, 200) as abstract,
               authors, journal, publish_date, category, image_url, 
               COALESCE(view_count, 0) as view_count, slug, doi
        FROM studies ${whereClause}
        ORDER BY COALESCE(view_count, 0) DESC, id DESC
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}
      `, [...params, limit, offset]),
      sql(`SELECT COUNT(*) as count FROM studies ${whereClause}`, params)
    ]);

    const response = {
      data: studies.map(s => ({
        ...s,
        abstract: s.abstract + (s.abstract?.length >= 200 ? '...' : ''),
        publishDate: s.publish_date
      })),
      total: parseInt(total[0]?.count || 0),
      page,
      pageSize: limit,
      pageCount: Math.ceil(parseInt(total[0]?.count || 0) / limit)
    };

    setCache(cacheKey, response);
    res.json(response);
  } catch (error) {
    console.error('Studies error:', error);
    res.status(500).json({ error: 'Failed to fetch studies', data: [], total: 0 });
  }
});

app.get('/api/studies/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const cacheKey = `study:${id}`;
    const cached = getFromCache(cacheKey);
    if (cached) return res.json(cached);

    const result = await sql('SELECT * FROM studies WHERE id = $1', [id]);
    if (result.length === 0) {
      return res.status(404).json({ error: 'Study not found' });
    }

    const study = result[0];
    setCache(cacheKey, study);
    
    // Update view count asynchronously
    sql('UPDATE studies SET view_count = COALESCE(view_count, 0) + 1 WHERE id = $1', [id])
      .catch(() => {});

    res.json(study);
  } catch (error) {
    console.error('Study error:', error);
    res.status(500).json({ error: 'Failed to fetch study' });
  }
});

app.get('/api/categories', async (req, res) => {
  try {
    const cacheKey = 'categories';
    const cached = getFromCache(cacheKey);
    if (cached) return res.json(cached);

    const result = await sql(`
      SELECT id, name, description, study_count, slug, icon
      FROM categories WHERE study_count > 0 
      ORDER BY study_count DESC LIMIT 15
    `);

    setCache(cacheKey, result);
    res.json(result);
  } catch (error) {
    console.error('Categories error:', error);
    res.status(500).json([]);
  }
});

app.get('/api/database-overview', async (req, res) => {
  try {
    const cacheKey = 'overview';
    const cached = getFromCache(cacheKey);
    if (cached) return res.json(cached);

    const [totalResult, categoriesResult] = await Promise.all([
      sql('SELECT COUNT(*) as total FROM studies'),
      sql('SELECT name, study_count FROM categories WHERE study_count > 0 ORDER BY study_count DESC LIMIT 8')
    ]);

    const response = {
      totalStudies: parseInt(totalResult[0]?.total || 0),
      categories: categoriesResult,
      lastUpdated: new Date().toISOString()
    };

    setCache(cacheKey, response);
    res.json(response);
  } catch (error) {
    console.error('Overview error:', error);
    res.status(500).json({ totalStudies: 0, categories: [] });
  }
});

// Health endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    cache_entries: cache.size,
    timestamp: new Date().toISOString()
  });
});

// Serve React app
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// Cache cleanup every 3 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of cache.entries()) {
    if (now - value.timestamp > CACHE_DURATION) {
      cache.delete(key);
    }
  }
}, 3 * 60 * 1000);

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Lightweight server running on port ${PORT}`);
  console.log(`Cache duration: ${CACHE_DURATION/1000/60} minutes`);
});