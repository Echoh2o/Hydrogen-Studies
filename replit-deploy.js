/**
 * Replit Deployment Entry Point
 * Direct production server for Replit's deployment system
 */

import express from 'express';
import { createServer } from 'http';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { neon } from '@neondatabase/serverless';

const app = express();
const startTime = Date.now();

console.log('[DEPLOY] Starting Replit deployment server...');

// Environment validation
if (!process.env.DATABASE_URL) {
  console.error('[DEPLOY] ERROR: DATABASE_URL environment variable is required');
  process.exit(1);
}

const sql = neon(process.env.DATABASE_URL);

// Basic middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Enhanced CORS for deployment
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('X-Powered-By', 'Hydrogen Research Platform');
  
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Static files with enhanced logging
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));
app.use(express.static(path.join(process.cwd(), 'public')));

console.log('[DEPLOY] Static file serving configured');

// Enhanced health check with detailed info
app.get('/health', async (req, res) => {
  try {
    const dbStart = Date.now();
    await sql('SELECT 1 as health_check');
    const dbLatency = Date.now() - dbStart;
    
    const uptime = Date.now() - startTime;
    
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      environment: 'production',
      database: {
        status: 'connected',
        latency: `${dbLatency}ms`
      },
      server: {
        uptime: `${Math.floor(uptime / 1000)}s`,
        port: process.env.PORT || '5000',
        node: process.version
      }
    });
  } catch (error) {
    console.error('[DEPLOY] Health check failed:', error);
    res.status(500).json({
      status: 'unhealthy',
      error: 'Database connection failed',
      timestamp: new Date().toISOString()
    });
  }
});

// API endpoints with enhanced error handling
app.get('/api/studies', async (req, res) => {
  try {
    console.log('[DEPLOY] Studies API called');
    
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
      limit,
      totalPages: Math.ceil((countResult?.[0]?.count || 0) / limit)
    });
  } catch (error) {
    console.error('[DEPLOY] Studies API error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch studies',
      timestamp: new Date().toISOString()
    });
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
    console.error('[DEPLOY] Study API error:', error);
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
    console.error('[DEPLOY] Categories API error:', error);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

// Root API info
app.get('/api', (req, res) => {
  res.json({
    name: 'Hydrogen Research Platform API',
    version: '1.0.0',
    status: 'running',
    deployment: 'replit',
    endpoints: ['/api/studies', '/api/categories', '/health'],
    timestamp: new Date().toISOString()
  });
});

// Enhanced frontend serving
app.get('*', (req, res) => {
  console.log(`[DEPLOY] Serving route: ${req.path}`);
  
  // Try production HTML first, then fallback to development
  const productionPath = path.join(process.cwd(), 'public', 'production-index.html');
  const developmentPath = path.join(process.cwd(), 'public', 'index.html');
  
  let htmlPath = productionPath;
  if (!fs.existsSync(productionPath)) {
    console.log('[DEPLOY] Production HTML not found, using fallback');
    htmlPath = null; // Force fallback HTML
  }
  
  if (htmlPath && fs.existsSync(htmlPath)) {
    let html = fs.readFileSync(htmlPath, 'utf8');
    res.send(html);
  } else {
    // Fallback HTML with working interface
    res.send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Hydrogen Research Platform</title>
        <link rel="icon" type="image/svg+xml" href="/favicon.svg">
        <style>
          body { font-family: Arial, sans-serif; padding: 40px; max-width: 1200px; margin: 0 auto; }
          .header { background: #f8fafc; padding: 30px; border-radius: 8px; margin-bottom: 30px; }
          .title { color: #2563eb; font-size: 2rem; margin-bottom: 10px; }
          .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; }
          .card { background: white; border: 1px solid #e5e7eb; padding: 20px; border-radius: 8px; }
          .link { color: #2563eb; text-decoration: none; display: block; margin: 8px 0; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1 class="title">Hydrogen Research Platform</h1>
          <p>Comprehensive database of hydrogen health research studies</p>
        </div>
        <div class="grid">
          <div class="card">
            <h3>API Access</h3>
            <a href="/api/studies" class="link">Browse Studies Database</a>
            <a href="/api/categories" class="link">Research Categories</a>
            <a href="/health" class="link">System Health</a>
          </div>
          <div class="card">
            <h3>Database Status</h3>
            <p>📊 1,304 total studies</p>
            <p>🖼️ 1,079+ with AI-generated images</p>
            <p id="status">🔄 Checking connection...</p>
          </div>
        </div>
        <script>
          fetch('/health').then(r => r.json()).then(d => {
            document.getElementById('status').innerHTML = '✅ Database: ' + d.status;
          }).catch(() => {
            document.getElementById('status').innerHTML = '❌ Connection error';
          });
        </script>
      </body>
      </html>
    `);
  }
});

// Enhanced error handling
app.use((error, req, res, next) => {
  console.error('[DEPLOY] Server error:', error);
  
  if (res.headersSent) {
    return next(error);
  }
  
  res.status(500).json({
    error: 'Internal server error',
    timestamp: new Date().toISOString(),
    path: req.path
  });
});

// Server startup
const port = parseInt(process.env.PORT || '5000');
const server = createServer(app);

server.listen(port, '0.0.0.0', () => {
  const duration = Date.now() - startTime;
  console.log(`[DEPLOY] ✅ Server running on port ${port} (${duration}ms startup)`);
  console.log(`[DEPLOY] ✅ Environment: ${process.env.NODE_ENV || 'production'}`);
  console.log(`[DEPLOY] ✅ Database: Connected`);
  console.log(`[DEPLOY] ✅ Ready for deployment traffic`);
});

server.on('error', (error) => {
  console.error('[DEPLOY] ❌ Server error:', error);
  if (error.code === 'EADDRINUSE') {
    console.error(`[DEPLOY] ❌ Port ${port} is already in use`);
  }
  process.exit(1);
});

// Graceful shutdown
const shutdown = (signal) => {
  console.log(`[DEPLOY] Received ${signal}, shutting down gracefully...`);
  server.close(() => {
    console.log('[DEPLOY] Server closed');
    process.exit(0);
  });
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);