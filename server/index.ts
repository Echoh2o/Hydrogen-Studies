/**
 * Main Server Entry Point
 * Updated to use stable production configuration with proper error handling
 */

import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { eq, count } from 'drizzle-orm';
import { blogArticles } from '../shared/schema';
import studiesRouter from "./routes/studies-router";
import researchUnifiedRoutes from "./routes/research-unified-routes";
import keywordMonitorRoutes from "./routes/keyword-monitor-routes";
import keywordMonitorScheduleRoutes from "./routes/keyword-monitor-schedule-routes";
import contentEnrichmentRoutes from "./routes/content-enrichment-routes";
import enrichmentRoutes from "./routes/enrichment-routes";
import blogRoutes from "./routes/blog-routes";
import blogRecommendationRoutes from "./routes/blog-recommendation-routes";
import { initializeHealthMonitoring, performHealthCheck } from './health-monitoring';
import { handleError } from './utils/error-handler';
import { qualityAudit } from './comprehensive-quality-audit';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();

// CORS and middleware
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Comprehensive environment validation
function validateEnvironment() {
  const requiredEnvVars = ['DATABASE_URL'];
  const optionalEnvVars = ['OPENAI_API_KEY', 'SENDGRID_API_KEY', 'VITE_GA_MEASUREMENT_ID'];
  const missingRequired = [];
  const missingOptional = [];

  // Check required environment variables
  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      missingRequired.push(envVar);
    }
  }

  // Check optional environment variables
  for (const envVar of optionalEnvVars) {
    if (!process.env[envVar]) {
      missingOptional.push(envVar);
    }
  }

  // Exit if required variables are missing
  if (missingRequired.length > 0) {
    console.error('Missing required environment variables:', missingRequired.join(', '));
    console.error('Please ensure all required environment variables are set before starting the server.');
    process.exit(1);
  }

  // Warn about missing optional variables
  if (missingOptional.length > 0) {
    console.warn('Missing optional environment variables:', missingOptional.join(', '));
    console.warn('Some features may not work properly without these variables.');
  }

  // Validate DATABASE_URL format
  try {
    new URL(process.env.DATABASE_URL!);
  } catch (error) {
    console.error('Invalid DATABASE_URL format. Please provide a valid database connection string.');
    process.exit(1);
  }

  console.log('Environment validation completed successfully');
}

validateEnvironment();

// Database connection with retry logic
const sql = neon(process.env.DATABASE_URL!, {
  arrayMode: false,
});
const db = drizzle(sql);

// Working API endpoints
app.use('/api/keywords/monitor', keywordMonitorScheduleRoutes); // Keyword monitor schedule routes (more specific first)
app.use('/api/keywords', keywordMonitorRoutes); // Keyword monitor routes
app.use('/api/content-enrichment', contentEnrichmentRoutes); // Content enrichment routes
app.use('/api/enrichment', enrichmentRoutes); // Enrichment routes
app.use('/api/blogs', blogRoutes); // Blog routes
app.use('/api/blog-recommendations', blogRecommendationRoutes); // Blog recommendation routes
app.use('/api/studies', studiesRouter); // Mount the studies router
app.use(researchUnifiedRoutes); // Research unified routes

// Dashboard stats endpoint with comprehensive statistics
app.get('/api/stats/dashboard', async (req, res) => {
  try {
    // Get total blog count
    const [totalResult] = await db
      .select({ count: count() })
      .from(blogArticles);

    // Get published blog count
    const [publishedResult] = await db
      .select({ count: count() })
      .from(blogArticles)
      .where(eq(blogArticles.isPublished, true));

    // Get draft blog count
    const [draftResult] = await db
      .select({ count: count() })
      .from(blogArticles)
      .where(eq(blogArticles.isPublished, false));

    // Get total studies count using SQL query
    let studiesCount = 0;
    try {
      const result = await sql`SELECT COUNT(*) as count FROM studies`;
      studiesCount = Number(result[0]?.count) || 0;
    } catch (error) {
      console.log('Direct SQL query failed, trying table query');
      try {
        const [studiesResult] = await db
          .select({ count: count() })
          .from(studies);
        studiesCount = studiesResult?.count || 0;
      } catch (tableError) {
        console.log('Table query also failed, using 0');
        studiesCount = 0;
      }
    }

    const stats = {
      totalBlogs: Number(totalResult.count),
      publishedBlogs: Number(publishedResult.count),
      draftBlogs: Number(draftResult.count),
      totalStudies: Number(studiesCount),
      categoriesCount: 8,
      recentImports: 0
    };

    res.json(stats);
  } catch (error) {
    console.error('Error fetching blog stats:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch blog statistics',
      totalBlogs: 0,
      publishedBlogs: 0,
      draftBlogs: 0,
      totalStudies: 0,
      categoriesCount: 0,
      recentImports: 0
    });
  }
});

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
      totalStudies: totalStudies[0]?.count || 0,
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

// Advanced search with multiple filters
app.get('/api/advanced-search', async (req, res) => {
  try {
    const search = String(req.query.search || '').trim();
    const category = String(req.query.category || '').trim();
    const country = String(req.query.country || '').trim();
    const sort_by = String(req.query.sort_by || 'id');
    const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit || '20'))));
    const offset = Math.max(0, parseInt(String(req.query.offset || '0')));

    let studies = [];
    let countResult: any[] = [];

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

// Global error handling - single set only
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  handleError(new Error(`Unhandled Rejection: ${reason}`), 'unhandledRejection');

  // Don't exit the process in production, just log the error
  if (process.env.NODE_ENV !== 'production') {
    process.exit(1);
  }
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  handleError(error, 'uncaughtException');

  // Graceful shutdown in production
  if (process.env.NODE_ENV === 'production') {
    setTimeout(() => process.exit(1), 1000);
  } else {
    process.exit(1);
  }
});

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    // Test database connection
    await sql`SELECT 1`;

    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      database: 'connected'
    };

    res.json(health);
  } catch (error) {
    console.error('Health check failed:', error);
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Database connection failed'
    });
  }
});

// Quality monitoring endpoints
app.get('/api/admin/quality/monitor', async (req, res) => {
  try {
    const { qualityMonitor } = await import('./quality-assurance-monitor.js');
    const report = qualityMonitor.getQualityReport();
    res.json(report);
  } catch (error) {
    console.error('Quality monitoring failed:', error);
    res.status(500).json({ error: 'Quality monitoring unavailable' });
  }
});

app.get('/api/admin/quality/integrity', async (req, res) => {
  try {
    const { dataIntegrityValidator } = await import('./data-integrity-validator.js');
    const validation = await dataIntegrityValidator.validateDataIntegrity();
    res.json(validation);
  } catch (error) {
    console.error('Data integrity validation failed:', error);
    res.status(500).json({ error: 'Data integrity validation failed' });
  }
});

app.post('/api/admin/quality/fix-issues', async (req, res) => {
  try {
    const { dataIntegrityValidator } = await import('./data-integrity-validator.js');
    const result = await dataIntegrityValidator.fixCommonIssues();
    res.json(result);
  } catch (error) {
    console.error('Issue fixing failed:', error);
    res.status(500).json({ error: 'Failed to fix issues' });
  }
});

app.get('/api/admin/quality/tests', async (req, res) => {
  try {
    const { qualityTests } = await import('./automated-quality-tests.js');
    const results = await qualityTests.runAllTests();
    res.json(results);
  } catch (error) {
    console.error('Quality tests failed:', error);
    res.status(500).json({ error: 'Quality tests failed' });
  }
});

// Serve public assets
app.use('/images', express.static(path.join(__dirname, '..', 'public', 'images')));
app.use('/uploads', express.static(path.join(__dirname, '..', 'public', 'uploads')));

// Setup server and Vite
async function setupServer() {
  const PORT = parseInt(process.env.PORT || '5000');

  if (process.env.NODE_ENV === 'development') {
    // Development mode - use Vite dev server
    const { setupVite } = await import('./vite.js');
    const { createServer } = await import('http');
    const server = createServer(app);
    await setupVite(app, server);

    server.listen(PORT, '0.0.0.0', () => {
      console.log('Health monitoring initialized');

      console.log(`Server running on port ${PORT}`);
      console.log(`Marketing homepage: http://localhost:${PORT}/`);
      console.log(`Health check: http://localhost:${PORT}/health`);
    });
  } else {
    // Production mode - serve static files
    app.use(express.static(path.join(__dirname, '..', 'client', 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.join(__dirname, '..', 'client', 'dist', 'index.html'));
    });

    app.listen(PORT, '0.0.0.0', () => {
      console.log('Health monitoring initialized');

      console.log(`Server running on port ${PORT}`);
      console.log(`Marketing homepage: http://localhost:${PORT}/`);
      console.log(`Health check: http://localhost:${PORT}/health`);
    });
  }
}

setupServer().catch(console.error);