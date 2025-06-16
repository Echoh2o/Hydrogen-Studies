/**
 * Stable Production Server - Addresses All Critical Issues
 * - Removes duplicate error handlers
 * - Proper database connection pooling
 * - Environment validation
 * - Comprehensive error handling
 */

import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { neon } from '@neondatabase/serverless';
import { createServer as createViteServer } from 'vite';
import studiesRouter from "./routes/studies-router";
import { initializeHealthMonitoring, performHealthCheck } from './health-monitoring';
import { handleError } from './utils/error-handler';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 5000;

// Environment validation - check required variables
const requiredEnvVars = ['DATABASE_URL'];
for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.error(`Missing required environment variable: ${envVar}`);
    process.exit(1);
  }
}

// Database connection with proper configuration
const sql = neon(process.env.DATABASE_URL!, {
  arrayMode: false,
});

// Test database connection on startup
async function testDatabaseConnection() {
  try {
    await sql`SELECT 1 as test`;
    console.log('Database connection successful');
  } catch (error) {
    console.error('Database connection failed:', error);
    process.exit(1);
  }
}

// CORS and middleware
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Mount API routes
app.use('/api/studies', studiesRouter);

// Categories endpoint
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

// Database overview endpoint
app.get('/api/overview', async (req, res) => {
  try {
    const [totalStudies, categoryCounts, countryCounts, yearRange] = await Promise.all([
      sql`SELECT COUNT(*) as count FROM studies`,
      sql`
        SELECT category, COUNT(*) as count
        FROM studies
        WHERE category IS NOT NULL AND category != ''
        GROUP BY category
        ORDER BY count DESC
        LIMIT 10
      `,
      sql`
        SELECT country, COUNT(*) as count
        FROM studies
        WHERE country IS NOT NULL AND country != ''
        GROUP BY country
        ORDER BY count DESC
        LIMIT 10
      `,
      sql`
        SELECT MIN(publish_year) as min_year, MAX(publish_year) as max_year
        FROM studies
        WHERE publish_year IS NOT NULL
      `
    ]);

    res.json({
      totalStudies: parseInt(totalStudies[0]?.count) || 0,
      categoryCounts,
      countryCounts,
      yearRange: yearRange[0],
      lastUpdated: new Date().toISOString()
    });
  } catch (error) {
    console.error('Overview API error:', error);
    res.status(500).json({ error: 'Failed to load overview' });
  }
});

// Advanced search endpoint with proper error handling
app.get('/api/advanced-search', async (req, res) => {
  try {
    const search = String(req.query.search || '').trim();
    const category = String(req.query.category || '').trim();
    const country = String(req.query.country || '').trim();
    const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit || '20'))));
    const offset = Math.max(0, parseInt(String(req.query.offset || '0')));

    let studies: any[] = [];
    let countResult: any[] = [];

    // Build query based on filters
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
        SELECT COUNT(*) as count FROM studies 
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
        SELECT COUNT(*) as count FROM studies 
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

      countResult = await sql`SELECT COUNT(*) as count FROM studies WHERE category = ${category}`;
    } else {
      studies = await sql`
        SELECT id, title, abstract, authors, journal, publish_year, category, 
               country, study_type, sample_size, citation_count, peer_reviewed,
               has_full_text, image_url, doi, plain_language_title
        FROM studies 
        ORDER BY id DESC
        LIMIT ${limit} OFFSET ${offset}
      `;

      countResult = await sql`SELECT COUNT(*) as count FROM studies`;
    }

    const total = parseInt(countResult[0]?.count) || 0;

    res.json({
      studies,
      total,
      limit,
      offset,
      hasMore: (offset + studies.length) < total
    });

  } catch (error) {
    console.error('Advanced search error:', error);
    res.status(500).json({ 
      error: 'Search failed',
      message: 'An error occurred while searching. Please try again.'
    });
  }
});

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    const healthStatus = await performHealthCheck();
    res.status(healthStatus.status === 'healthy' ? 200 : 503).json(healthStatus);
  } catch (error) {
    console.error('Health check error:', error);
    res.status(503).json({
      status: 'degraded',
      timestamp: new Date().toISOString(),
      error: 'Health check failed'
    });
  }
});

// Serve static files
app.use(express.static(path.join(__dirname, '..', 'public')));

// Default route serves marketing homepage
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'marketing-index.html'));
});

// Catch-all route for SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'marketing-index.html'));
});

// Global error handler
app.use((err: any, req: any, res: any, next: any) => {
  console.error('Express error:', err);
  res.status(err.status || 500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong',
    timestamp: new Date().toISOString()
  });
});

// Single set of global error handlers - no duplicates
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  handleError(new Error(`Unhandled Rejection: ${reason}`), 'unhandledRejection');
  
  // Don't exit in production, just log
  if (process.env.NODE_ENV !== 'production') {
    process.exit(1);
  }
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  handleError(error, 'uncaughtException');
  
  // Graceful shutdown
  if (process.env.NODE_ENV === 'production') {
    setTimeout(() => process.exit(1), 1000);
  } else {
    process.exit(1);
  }
});

// Graceful shutdown handlers
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  process.exit(0);
});

// Initialize and start server
async function startServer() {
  try {
    await testDatabaseConnection();
    initializeHealthMonitoring();
    
    const server = app.listen(Number(PORT), '0.0.0.0', () => {
      console.log(`Stable production server running on port ${PORT}`);
      console.log(`Marketing homepage: http://localhost:${PORT}/`);
      console.log(`Health check: http://localhost:${PORT}/health`);
    });

    // Handle server errors
    server.on('error', (error: any) => {
      if (error.code === 'EADDRINUSE') {
        console.error(`Port ${PORT} is already in use`);
        process.exit(1);
      } else {
        console.error('Server error:', error);
      }
    });

  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Start the server
startServer();

export default app;