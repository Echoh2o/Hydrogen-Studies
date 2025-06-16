/**
 * Development Server with React Integration
 * Serves API endpoints and React development build
 */

import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { neon } from '@neondatabase/serverless';
import { createServer as createViteServer } from 'vite';
import studiesRouter from "./routes/studies-router"; // Import the studies router
import { initializeHealthMonitoring, performHealthCheck } from './health-monitoring';
import { handleError } from './utils/error-handler';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();

// CORS and middleware
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Database connection
const sql = neon(process.env.DATABASE_URL!);

// Working API endpoints
app.use('/api/studies', studiesRouter); // Mount the studies router

app.get('/api/categories', async (req, res) => {
  try {
    const categories = await sql`
      SELECT category, COUNT(*) as count
      FROM studies
      WHERE category IS NOT NULL AND category != ''
      GROUP BY category
      ORDER BY count DESC
      LIMIT 20
    `;
    res.json(categories);
  } catch (error) {
    console.error('Categories API error:', error);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

app.get('/api/search', async (req, res) => {
  try {
    const query = String(req.query.q || '');
    const limit = Math.min(50, parseInt(String(req.query.limit || '20')));
    const offset = Math.max(0, parseInt(String(req.query.offset || '0')));

    if (!query.trim()) {
      return res.status(400).json({ error: 'Search query required' });
    }

    const studies = await sql`
      SELECT id, title, abstract, authors, journal, publish_date, category, doi, image_url, slug
      FROM studies 
      WHERE LOWER(title) LIKE ${'%' + query.toLowerCase() + '%'} 
      OR LOWER(abstract) LIKE ${'%' + query.toLowerCase() + '%'} 
      ORDER BY 
        CASE 
          WHEN LOWER(title) LIKE ${'%' + query.toLowerCase() + '%'} THEN 1
          ELSE 2
        END,
        id DESC
      LIMIT ${limit} OFFSET ${offset}
    `;

    const totalResult = await sql`
      SELECT COUNT(*) as total
      FROM studies 
      WHERE LOWER(title) LIKE ${'%' + query.toLowerCase() + '%'} 
      OR LOWER(abstract) LIKE ${'%' + query.toLowerCase() + '%'} 
    `;

    const total = parseInt(totalResult[0]?.total || '0');

    res.json({
      success: true,
      studies,
      total,
      hasMore: (offset + studies.length) < total
    });
  } catch (error) {
    console.error('Search API error:', error);
    res.status(500).json({ error: 'Search failed' });
  }
});

app.get('/api/studies/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const study = await sql`SELECT * FROM studies WHERE id = ${id}`;

    if (study.length === 0) {
      return res.status(404).json({ error: 'Study not found' });
    }

    res.json(study[0]);
  } catch (error) {
    console.error('Study by ID error:', error);
    res.status(500).json({ error: 'Failed to fetch study' });
  }
});

// Advanced filtering endpoints
app.get('/api/filters/years', async (req, res) => {
  try {
    const years = await sql`
      SELECT publish_year, COUNT(*) as count
      FROM studies
      WHERE publish_year IS NOT NULL
      GROUP BY publish_year
      ORDER BY publish_year DESC
    `;
    res.json(years);
  } catch (error) {
    console.error('Years filter error:', error);
    res.status(500).json({ error: 'Failed to fetch years' });
  }
});

app.get('/api/filters/countries', async (req, res) => {
  try {
    const countries = await sql`
      SELECT country, COUNT(*) as count
      FROM studies
      WHERE country IS NOT NULL AND country != ''
      GROUP BY country
      ORDER BY count DESC
      LIMIT 20
    `;
    res.json(countries);
  } catch (error) {
    console.error('Countries filter error:', error);
    res.status(500).json({ error: 'Failed to fetch countries' });
  }
});

app.get('/api/filters/study-types', async (req, res) => {
  try {
    const studyTypes = await sql`
      SELECT study_type, COUNT(*) as count
      FROM studies
      WHERE study_type IS NOT NULL AND study_type != ''
      GROUP BY study_type
      ORDER BY count DESC
    `;
    res.json(studyTypes);
  } catch (error) {
    console.error('Study types filter error:', error);
    res.status(500).json({ error: 'Failed to fetch study types' });
  }
});

app.get('/api/filters/journals', async (req, res) => {
  try {
    const journals = await sql`
      SELECT journal, COUNT(*) as count
      FROM studies
      WHERE journal IS NOT NULL AND journal != ''
      GROUP BY journal
      ORDER BY count DESC
      LIMIT 30
    `;
    res.json(journals);
  } catch (error) {
    console.error('Journals filter error:', error);
    res.status(500).json({ error: 'Failed to fetch journals' });
  }
});

// Advanced search with multiple filters
app.get('/api/advanced-search', async (req, res) => {
  try {
    const search = String(req.query.search || '');
    const category = String(req.query.category || '');
    const country = String(req.query.country || '');
    const sort_by = String(req.query.sort_by || 'id');
    const limit = Math.min(50, parseInt(String(req.query.limit || '20')));
    const offset = Math.max(0, parseInt(String(req.query.offset || '0')));

    let studies;
    let countResult;

    // Simple filtering approach that works with Neon
    if (search && category) {
      studies = await sql`
        SELECT id, title, abstract, authors, journal, publish_year, category, 
               country, study_type, sample_size, citation_count, peer_reviewed,
               has_full_text, image_url, doi, plain_language_title
        FROM studies 
        WHERE (title ILIKE ${'%' + search + '%'} OR abstract ILIKE ${'%' + search + '%'}) 
        AND category = ${category}
        ORDER BY id DESC
        LIMIT ${limit} OFFSET ${offset}
      `;

      countResult = await sql`
        SELECT COUNT(*) as total FROM studies 
        WHERE (title ILIKE ${'%' + search + '%'} OR abstract ILIKE ${'%' + search + '%'}) 
        AND category = ${category}
      `;
    } else if (search) {
      studies = await sql`
        SELECT id, title, abstract, authors, journal, publish_year, category, 
               country, study_type, sample_size, citation_count, peer_reviewed,
               has_full_text, image_url, doi, plain_language_title
        FROM studies 
        WHERE title ILIKE ${'%' + search + '%'} OR abstract ILIKE ${'%' + search + '%'} 
        ORDER BY id DESC
        LIMIT ${limit} OFFSET ${offset}
      `;

      countResult = await sql`
        SELECT COUNT(*) as total FROM studies 
        WHERE title ILIKE ${'%' + search + '%'} OR abstract ILIKE ${'%' + search + '%'} 
      `;
    } else if (category) {
      studies = await sql`
        SELECT id, title, abstract, authors, journal, publish_year, category, 
               country, study_type, sample_size, citation_count, peer_reviewed,
               has_full_text, image_url, doi, plain_language_title
        FROM studies 
        WHERE category = ${category}
        ORDER BY id DESC
        LIMIT ${limit} OFFSET ${offset}
      `;

      countResult = await sql`SELECT COUNT(*) as total FROM studies WHERE category = ${category}`;
    } else if (country) {
      studies = await sql`
        SELECT id, title, abstract, authors, journal, publish_year, category, 
               country, study_type, sample_size, citation_count, peer_reviewed,
               has_full_text, image_url, doi, plain_language_title
        FROM studies 
        WHERE country = ${country}
        ORDER BY id DESC
        LIMIT ${limit} OFFSET ${offset}
      `;

      countResult = await sql`SELECT COUNT(*) as total FROM studies WHERE country = ${country}`;
    } else {
      studies = await sql`
        SELECT id, title, abstract, authors, journal, publish_year, category, 
               country, study_type, sample_size, citation_count, peer_reviewed,
               has_full_text, image_url, doi, plain_language_title
        FROM studies 
        ORDER BY id DESC
        LIMIT ${limit} OFFSET ${offset}
      `;

      countResult = await sql`SELECT COUNT(*) as total FROM studies`;
    }

    const total = parseInt(countResult[0]?.total || '0');

    res.json({
      studies,
      total,
      hasMore: (offset + studies.length) < total,
      filters: { search, category, country, sort_by } 
    });

  } catch (error) {
    console.error('Advanced search error:', error);
    res.status(500).json({ error: 'Advanced search failed' });
  }
});

// Initialize health monitoring
initializeHealthMonitoring();

// Enhanced error handling
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Don't exit the process in production, just log the error
  if (process.env.NODE_ENV !== 'production') {
    process.exit(1);
  }
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  // Graceful shutdown in production
  if (process.env.NODE_ENV === 'production') {
    setTimeout(() => process.exit(1), 1000);
  } else {
    process.exit(1);
  }
});

// Add global error handlers
process.on('uncaughtException', (error) => {
  handleError(error, 'uncaughtException');
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  handleError(new Error(`Unhandled Rejection: ${reason}`), 'unhandledRejection');
  console.error('Unhandled Rejection at:', promise);
});

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    const healthStatus = await performHealthCheck();
    res.status(healthStatus.status === 'healthy' ? 200 : 503).json(healthStatus);
  } catch (error) {
    handleError(error, 'health check');
    res.status(503).json({ status: 'unhealthy', error: 'Health check failed' });
  }
});

// Serve static files from client dist directory
app.use(express.static(path.join(__dirname, '..', 'client', 'dist')));

// Serve public assets
app.use('/images', express.static(path.join(__dirname, '..', 'public', 'images')));
app.use('/uploads', express.static(path.join(__dirname, '..', 'public', 'uploads')));

// Serve the React app for all non-API routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'client', 'dist', 'index.html'));
});

const PORT = parseInt(process.env.PORT || '5000');

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Marketing homepage: http://localhost:${PORT}/`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});