/**
 * Deployment Server - Minimal production server for Replit deployment
 */

import express from 'express';
import { createServer } from 'http';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { neon } from '@neondatabase/serverless';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

// Validate environment
if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL required');
  process.exit(1);
}

const sql = neon(process.env.DATABASE_URL);

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// CORS for deployment
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

// API Routes
app.get('/health', async (req, res) => {
  try {
    await sql('SELECT 1');
    res.json({ status: 'healthy', timestamp: new Date().toISOString() });
  } catch (error) {
    res.status(500).json({ status: 'unhealthy', error: 'Database connection failed' });
  }
});

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
    console.error('Studies API error:', error);
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
    console.error('Study API error:', error);
    res.status(500).json({ error: 'Failed to fetch study' });
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
    console.error('Search API error:', error);
    res.status(500).json({ error: 'Search failed' });
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
    console.error('Categories API error:', error);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

app.get('/api', (req, res) => {
  res.json({
    name: 'Hydrogen Research Platform API',
    version: '1.0.0',
    status: 'running',
    endpoints: ['/api/studies', '/api/search', '/api/categories', '/health']
  });
});

// Serve React app for all other routes
app.get('*', (req, res) => {
  const indexPath = path.join(process.cwd(), 'public', 'index.html');
  
  if (fs.existsSync(indexPath)) {
    // Read and modify the HTML to work with production
    let html = fs.readFileSync(indexPath, 'utf8');
    
    // Replace development script with a simple message for now
    html = html.replace(
      '<script type="module" src="/src/main.tsx"></script>',
      `<script>
        document.getElementById('root').innerHTML = \`
          <div style="padding: 40px; text-align: center; font-family: Arial, sans-serif;">
            <h1>Hydrogen Research Platform</h1>
            <p>Loading comprehensive research database...</p>
            <p><a href="/api/studies">Browse Studies API</a> | <a href="/api/categories">Categories API</a></p>
          </div>
        \`;
      </script>`
    );
    
    res.send(html);
  } else {
    res.status(404).send('Application not found');
  }
});

// Error handling
app.use((error, req, res, next) => {
  console.error('Deployment server error:', error);
  if (res.headersSent) return next(error);
  res.status(500).json({
    error: 'Internal server error',
    timestamp: new Date().toISOString()
  });
});

const port = parseInt(process.env.PORT || '5000');
const server = createServer(app);

server.listen(port, '0.0.0.0', () => {
  console.log(`✓ Deployment server running on port ${port}`);
  console.log(`✓ API endpoints: /api/studies, /api/search, /api/categories`);
  console.log(`✓ Health check: /health`);
});

server.on('error', (error) => {
  console.error('Server error:', error);
  process.exit(1);
});

process.on('SIGTERM', () => server.close(() => process.exit(0)));
process.on('SIGINT', () => server.close(() => process.exit(0)));