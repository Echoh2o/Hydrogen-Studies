#!/usr/bin/env node

/**
 * Deployment Fix - Robust server startup for Replit deployment
 */

import express from 'express';
import { createServer } from 'http';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { neon } from '@neondatabase/serverless';

const app = express();
const startTime = Date.now();

console.log('DEPLOYMENT: Starting server...');

// Environment validation
if (!process.env.DATABASE_URL) {
  console.error('DEPLOYMENT ERROR: DATABASE_URL environment variable required');
  process.exit(1);
}

console.log('DEPLOYMENT: Database URL configured');

const sql = neon(process.env.DATABASE_URL);

// Test database connection immediately
try {
  await sql('SELECT 1 as test');
  console.log('DEPLOYMENT: Database connection successful');
} catch (error) {
  console.error('DEPLOYMENT ERROR: Database connection failed:', error.message);
  process.exit(1);
}

// Basic middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// CORS headers
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// Static files
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));
app.use(express.static(path.join(process.cwd(), 'public')));

console.log('DEPLOYMENT: Static file serving configured');

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    const dbStart = Date.now();
    await sql('SELECT COUNT(*) as count FROM studies');
    const dbLatency = Date.now() - dbStart;
    
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      database: { status: 'connected', latency: `${dbLatency}ms` },
      uptime: Math.floor((Date.now() - startTime) / 1000)
    });
  } catch (error) {
    console.error('DEPLOYMENT: Health check failed:', error);
    res.status(500).json({
      status: 'unhealthy',
      error: 'Database connection failed',
      timestamp: new Date().toISOString()
    });
  }
});

// API endpoints
app.get('/api/studies', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 12, 50);
    const offset = (page - 1) * limit;
    
    const [studies, countResult] = await Promise.all([
      sql(`SELECT id, title, abstract, category, image_url, publication_date, 
           authors, journal, doi, health_conditions, delivery_method
           FROM studies ORDER BY id LIMIT $1 OFFSET $2`, [limit, offset]),
      sql('SELECT COUNT(*) as count FROM studies')
    ]);
    
    res.json({
      studies: studies || [],
      total: countResult?.[0]?.count || 0,
      page,
      limit
    });
  } catch (error) {
    console.error('DEPLOYMENT: Studies API error:', error);
    res.status(500).json({ error: 'Failed to fetch studies' });
  }
});

app.get('/api/studies/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const result = await sql('SELECT * FROM studies WHERE id = $1', [id]);
    
    if (!result || result.length === 0) {
      return res.status(404).json({ error: 'Study not found' });
    }
    
    res.json(result[0]);
  } catch (error) {
    console.error('DEPLOYMENT: Study API error:', error);
    res.status(500).json({ error: 'Failed to fetch study' });
  }
});

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
    console.error('DEPLOYMENT: Categories API error:', error);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

app.get('/api/search', async (req, res) => {
  try {
    const query = req.query.q || '';
    const category = req.query.category;
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 12, 50);
    const offset = (page - 1) * limit;
    
    let studies, countResult;
    
    if (query && category) {
      const searchPattern = `%${query}%`;
      [studies, countResult] = await Promise.all([
        sql(`SELECT id, title, abstract, category, image_url, publication_date,
             authors, journal, doi, health_conditions, delivery_method
             FROM studies 
             WHERE (title ILIKE $1 OR abstract ILIKE $1) AND category = $2
             ORDER BY id LIMIT $3 OFFSET $4`, [searchPattern, category, limit, offset]),
        sql(`SELECT COUNT(*) as count FROM studies 
             WHERE (title ILIKE $1 OR abstract ILIKE $1) AND category = $2`, [searchPattern, category])
      ]);
    } else if (query) {
      const searchPattern = `%${query}%`;
      [studies, countResult] = await Promise.all([
        sql(`SELECT id, title, abstract, category, image_url, publication_date,
             authors, journal, doi, health_conditions, delivery_method
             FROM studies 
             WHERE title ILIKE $1 OR abstract ILIKE $1
             ORDER BY id LIMIT $2 OFFSET $3`, [searchPattern, limit, offset]),
        sql(`SELECT COUNT(*) as count FROM studies 
             WHERE title ILIKE $1 OR abstract ILIKE $1`, [searchPattern])
      ]);
    } else if (category) {
      [studies, countResult] = await Promise.all([
        sql(`SELECT id, title, abstract, category, image_url, publication_date,
             authors, journal, doi, health_conditions, delivery_method
             FROM studies WHERE category = $1
             ORDER BY id LIMIT $2 OFFSET $3`, [category, limit, offset]),
        sql('SELECT COUNT(*) as count FROM studies WHERE category = $1', [category])
      ]);
    } else {
      [studies, countResult] = await Promise.all([
        sql(`SELECT id, title, abstract, category, image_url, publication_date,
             authors, journal, doi, health_conditions, delivery_method
             FROM studies ORDER BY id LIMIT $1 OFFSET $2`, [limit, offset]),
        sql('SELECT COUNT(*) as count FROM studies')
      ]);
    }
    
    res.json({
      studies: studies || [],
      total: countResult?.[0]?.count || 0,
      page,
      limit,
      query,
      category
    });
  } catch (error) {
    console.error('DEPLOYMENT: Search API error:', error);
    res.status(500).json({ error: 'Search failed' });
  }
});

app.get('/api', (req, res) => {
  res.json({
    name: 'Hydrogen Research Platform API',
    version: '1.0.0',
    status: 'running',
    endpoints: ['/api/studies', '/api/categories', '/api/search', '/health']
  });
});

// Frontend serving
app.get('*', (req, res) => {
  const productionPath = path.join(process.cwd(), 'public', 'production-index.html');
  
  if (fs.existsSync(productionPath)) {
    const html = fs.readFileSync(productionPath, 'utf8');
    res.send(html);
  } else {
    res.send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Hydrogen Research Platform</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 40px; max-width: 800px; margin: 0 auto; }
          .header { background: #f8fafc; padding: 30px; border-radius: 8px; margin-bottom: 30px; text-align: center; }
          .title { color: #2563eb; font-size: 2rem; margin-bottom: 10px; }
          .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; }
          .card { background: white; border: 1px solid #e5e7eb; padding: 20px; border-radius: 8px; }
          .link { color: #2563eb; text-decoration: none; display: block; margin: 8px 0; }
          .status { padding: 10px; border-radius: 4px; margin: 10px 0; }
          .healthy { background: #dcfce7; color: #166534; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1 class="title">Hydrogen Research Platform</h1>
          <p>Comprehensive database of hydrogen health research studies</p>
          <div id="status" class="status">Checking database connection...</div>
        </div>
        <div class="grid">
          <div class="card">
            <h3>Database Access</h3>
            <a href="/api/studies" class="link">Browse 1,304 Studies</a>
            <a href="/api/categories" class="link">Research Categories</a>
            <a href="/api/search?q=cardiovascular" class="link">Search Example</a>
          </div>
          <div class="card">
            <h3>System Status</h3>
            <a href="/health" class="link">Health Check</a>
            <a href="/api" class="link">API Documentation</a>
            <p>Database: PostgreSQL</p>
            <p>Studies: 1,304 total</p>
          </div>
        </div>
        <script>
          fetch('/health')
            .then(r => r.json())
            .then(d => {
              document.getElementById('status').innerHTML = 'Database Status: ' + d.status.toUpperCase();
              document.getElementById('status').className = 'status healthy';
            })
            .catch(() => {
              document.getElementById('status').innerHTML = 'Database Status: ERROR';
              document.getElementById('status').style.background = '#fecaca';
              document.getElementById('status').style.color = '#991b1b';
            });
        </script>
      </body>
      </html>
    `);
  }
});

// Error handling
app.use((error, req, res, next) => {
  console.error('DEPLOYMENT ERROR:', error);
  if (res.headersSent) return next(error);
  res.status(500).json({
    error: 'Internal server error',
    timestamp: new Date().toISOString()
  });
});

// Server startup with enhanced error handling
const port = parseInt(process.env.PORT || '5000');
const server = createServer(app);

server.listen(port, '0.0.0.0', () => {
  const duration = Date.now() - startTime;
  console.log(`DEPLOYMENT SUCCESS: Server running on port ${port} (${duration}ms startup)`);
  console.log(`DEPLOYMENT: API endpoints available at /api/studies, /api/categories, /health`);
  console.log(`DEPLOYMENT: Frontend available at /`);
});

server.on('error', (error) => {
  console.error('DEPLOYMENT CRITICAL ERROR:', error);
  if (error.code === 'EADDRINUSE') {
    console.error(`DEPLOYMENT: Port ${port} is already in use`);
    process.exit(1);
  } else if (error.code === 'EACCES') {
    console.error(`DEPLOYMENT: Permission denied for port ${port}`);
    process.exit(1);
  } else {
    console.error('DEPLOYMENT: Unknown server error');
    process.exit(1);
  }
});

// Graceful shutdown
const shutdown = (signal) => {
  console.log(`DEPLOYMENT: Received ${signal}, shutting down...`);
  server.close(() => {
    console.log('DEPLOYMENT: Server closed');
    process.exit(0);
  });
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
process.on('uncaughtException', (error) => {
  console.error('DEPLOYMENT UNCAUGHT EXCEPTION:', error);
  process.exit(1);
});
process.on('unhandledRejection', (reason, promise) => {
  console.error('DEPLOYMENT UNHANDLED REJECTION:', reason);
  process.exit(1);
});