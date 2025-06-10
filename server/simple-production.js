/**
 * Simple Production Server - JavaScript version for reliable deployment
 */

import express from 'express';
import { createServer } from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { neon } from '@neondatabase/serverless';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const startTime = Date.now();

console.log('Starting production server...');

// Validate environment
if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is required');
  process.exit(1);
}

const sql = neon(process.env.DATABASE_URL);

// Basic middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

// Static files
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));
app.use(express.static(path.join(process.cwd(), 'public')));

// Health check
app.get('/health', async (req, res) => {
  try {
    const start = Date.now();
    await sql('SELECT 1');
    const dbLatency = Date.now() - start;
    
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      database: { latency: `${dbLatency}ms` },
      environment: 'production'
    });
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      error: 'Database connection failed'
    });
  }
});

// Studies API
app.get('/api/studies', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 12, 50);
    const offset = (page - 1) * limit;
    
    const result = await sql(`
      SELECT id, title, abstract, category, image_url, publication_date, 
             authors, journal, doi, health_conditions, delivery_method
      FROM studies 
      ORDER BY id 
      LIMIT $1 OFFSET $2
    `, [limit, offset]);
    
    const countResult = await sql('SELECT COUNT(*) as count FROM studies');
    
    res.json({
      studies: result || [],
      total: countResult?.[0]?.count || 0,
      page,
      limit,
      totalPages: Math.ceil((countResult?.[0]?.count || 0) / limit)
    });
  } catch (error) {
    console.error('Studies API error:', error);
    res.status(500).json({ error: 'Failed to fetch studies' });
  }
});

// Single study API
app.get('/api/studies/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const result = await sql('SELECT * FROM studies WHERE id = $1', [id]);
    
    if (!result || result.length === 0) {
      return res.status(404).json({ error: 'Study not found' });
    }
    
    res.json(result[0]);
  } catch (error) {
    console.error('Study API error:', error);
    res.status(500).json({ error: 'Failed to fetch study' });
  }
});

// Search API
app.get('/api/search', async (req, res) => {
  try {
    const query = req.query.q || '';
    const category = req.query.category;
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 12, 50);
    const offset = (page - 1) * limit;
    
    let result, countResult;
    
    if (query && category) {
      result = await sql(`
        SELECT id, title, abstract, category, image_url, publication_date,
               authors, journal, doi, health_conditions, delivery_method
        FROM studies 
        WHERE (title ILIKE $1 OR abstract ILIKE $1) AND category = $2
        ORDER BY id 
        LIMIT $3 OFFSET $4
      `, [`%${query}%`, category, limit, offset]);
      
      countResult = await sql(`
        SELECT COUNT(*) as count FROM studies 
        WHERE (title ILIKE $1 OR abstract ILIKE $1) AND category = $2
      `, [`%${query}%`, category]);
    } else if (query) {
      result = await sql(`
        SELECT id, title, abstract, category, image_url, publication_date,
               authors, journal, doi, health_conditions, delivery_method
        FROM studies 
        WHERE title ILIKE $1 OR abstract ILIKE $1
        ORDER BY id 
        LIMIT $2 OFFSET $3
      `, [`%${query}%`, limit, offset]);
      
      countResult = await sql(`
        SELECT COUNT(*) as count FROM studies 
        WHERE title ILIKE $1 OR abstract ILIKE $1
      `, [`%${query}%`]);
    } else if (category) {
      result = await sql(`
        SELECT id, title, abstract, category, image_url, publication_date,
               authors, journal, doi, health_conditions, delivery_method
        FROM studies 
        WHERE category = $1
        ORDER BY id 
        LIMIT $2 OFFSET $3
      `, [category, limit, offset]);
      
      countResult = await sql('SELECT COUNT(*) as count FROM studies WHERE category = $1', [category]);
    } else {
      result = await sql(`
        SELECT id, title, abstract, category, image_url, publication_date,
               authors, journal, doi, health_conditions, delivery_method
        FROM studies 
        ORDER BY id 
        LIMIT $1 OFFSET $2
      `, [limit, offset]);
      
      countResult = await sql('SELECT COUNT(*) as count FROM studies');
    }
    
    res.json({
      studies: result || [],
      total: countResult?.[0]?.count || 0,
      page,
      limit,
      query,
      category
    });
  } catch (error) {
    console.error('Search API error:', error);
    res.status(500).json({ error: 'Search failed' });
  }
});

// Categories API
app.get('/api/categories', async (req, res) => {
  try {
    const result = await sql(`
      SELECT category, COUNT(*) as count 
      FROM studies 
      WHERE category IS NOT NULL 
      GROUP BY category 
      ORDER BY count DESC
    `);
    
    res.json(result || []);
  } catch (error) {
    console.error('Categories API error:', error);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

// Root API info
app.get('/api', (req, res) => {
  res.json({
    name: 'Hydrogen Research Platform API',
    version: '1.0.0',
    status: 'running',
    endpoints: ['/api/studies', '/api/search', '/api/categories', '/health']
  });
});

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(process.cwd(), 'public', 'index.html'));
});

// Error handling
app.use((error, req, res, next) => {
  console.error('Production server error:', error);
  
  if (res.headersSent) {
    return next(error);
  }
  
  res.status(500).json({
    error: 'Internal server error',
    timestamp: new Date().toISOString()
  });
});

const port = parseInt(process.env.PORT || '5000');
const server = createServer(app);

server.listen(port, '0.0.0.0', () => {
  const duration = Date.now() - startTime;
  console.log(`✓ Production server running on port ${port} (${duration}ms startup)`);
});

server.on('error', (error) => {
  console.error('Server error:', error);
  process.exit(1);
});

// Graceful shutdown
const shutdown = (signal) => {
  console.log(`Received ${signal}, shutting down...`);
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);