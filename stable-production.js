#!/usr/bin/env node

import express from 'express';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';
import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import { sql } from 'drizzle-orm';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const port = process.env.PORT || 5000;

// Graceful shutdown handling
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  process.exit(0);
});

// Error handling
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: false, limit: '10mb' }));

// Serve static files
const distPath = join(__dirname, 'dist');
if (existsSync(distPath)) {
  app.use(express.static(distPath, {
    maxAge: '1d',
    etag: true
  }));
  console.log('Static files served from:', distPath);
}

// Database connection with connection pooling
const connectionString = process.env.DATABASE_URL;
let db;

if (connectionString) {
  try {
    const dbClient = neon(connectionString);
    db = drizzle(dbClient);
    console.log('Database connected successfully');
  } catch (error) {
    console.error('Database connection failed:', error);
  }
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Consumer categories endpoint - optimized
app.get('/api/consumer-categories/counts', async (req, res) => {
  try {
    if (!db) {
      return res.json({ 
        success: true, 
        data: {
          condition: [],
          body_system: [],
          life_stage: []
        }
      });
    }
    
    const results = await db.execute(sql`
      SELECT name, study_count as count, description
      FROM categories 
      WHERE study_count > 0 
      ORDER BY study_count DESC
      LIMIT 20
    `);
    
    const categories = results.rows.map(row => ({
      name: row.name,
      count: row.count,
      description: row.description
    }));
    
    // Organize categories by type
    const conditions = categories.slice(0, 8);
    const bodySystems = categories.slice(8, 16);
    const lifeStages = categories.slice(16, 20);
    
    res.json({ 
      success: true, 
      data: {
        condition: conditions,
        body_system: bodySystems,
        life_stage: lifeStages
      }
    });
  } catch (error) {
    console.error('Categories error:', error);
    res.json({ 
      success: false, 
      data: {
        condition: [],
        body_system: [],
        life_stage: []
      }
    });
  }
});

// Search trending endpoint
app.get('/api/search/trending', (req, res) => {
  res.json({ 
    trending: ["hydrogen water", "antioxidant", "inflammation", "brain health", "oxidative stress", "neuroprotection"] 
  });
});

// Enhanced search endpoint - optimized with pagination
app.get('/api/search/enhanced', async (req, res) => {
  try {
    if (!db) {
      return res.json({ 
        studies: [], 
        total: 0,
        facets: { tags: [], journals: [], years: [] },
        suggestions: [],
        trending: []
      });
    }
    
    const { 
      q = '', 
      limit = 20, 
      offset = 0, 
      category = '',
      sortBy = 'relevance'
    } = req.query;
    
    const limitInt = Math.min(parseInt(limit) || 20, 100);
    const offsetInt = Math.max(parseInt(offset) || 0, 0);

    let whereClause = '';
    let orderClause = 'ORDER BY view_count DESC, id DESC';
    
    if (q && typeof q === 'string' && q.trim()) {
      const searchTerm = q.replace(/'/g, "''");
      whereClause = `WHERE (
        title ILIKE '%${searchTerm}%' OR 
        abstract ILIKE '%${searchTerm}%' OR 
        authors ILIKE '%${searchTerm}%'
      )`;
    }
    
    if (category && typeof category === 'string') {
      const categoryFilter = category.replace(/'/g, "''");
      whereClause += whereClause ? ` AND category ILIKE '%${categoryFilter}%'` : `WHERE category ILIKE '%${categoryFilter}%'`;
    }
    
    if (sortBy === 'date') {
      orderClause = 'ORDER BY publish_date DESC NULLS LAST, id DESC';
    }

    const queryText = `
      SELECT 
        id, title, abstract, authors, journal, 
        publish_date, journal_publish_date, category,
        consumer_categories, image_url, image_alt,
        view_count, slug, doi
      FROM studies
      ${whereClause}
      ${orderClause}
      LIMIT ${limitInt} OFFSET ${offsetInt}
    `;

    const results = await db.execute(sql.raw(queryText));

    const studies = results.rows.map((row) => ({
      id: row.id,
      title: row.title || 'Untitled Study',
      abstract: row.abstract ? row.abstract.substring(0, 500) + '...' : '',
      authors: row.authors || '',
      journal: row.journal || '',
      publishDate: row.publish_date || row.journal_publish_date,
      category: row.category || 'General',
      consumerCategories: row.consumer_categories,
      imageUrl: row.image_url,
      imageAlt: row.image_alt,
      viewCount: row.view_count || 0,
      slug: row.slug,
      doi: row.doi,
      relevanceScore: 1.0
    }));

    // Get total count for pagination
    const countQuery = `
      SELECT COUNT(*) as total
      FROM studies
      ${whereClause}
    `;
    
    const totalResult = await db.execute(sql.raw(countQuery));
    const total = parseInt(totalResult.rows[0]?.total || 0);

    res.json({
      studies,
      total,
      facets: { tags: [], journals: [], years: [] },
      suggestions: [],
      trending: ["hydrogen water", "antioxidant", "inflammation", "brain health"]
    });
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ 
      error: 'Search failed',
      studies: [],
      total: 0,
      facets: { tags: [], journals: [], years: [] },
      suggestions: [],
      trending: []
    });
  }
});

// Individual study endpoint
app.get('/api/studies/:id', async (req, res) => {
  try {
    if (!db) {
      return res.status(500).json({ error: 'Database not available' });
    }
    
    const studyId = parseInt(req.params.id);
    if (!studyId || isNaN(studyId)) {
      return res.status(400).json({ error: 'Invalid study ID' });
    }

    const results = await db.execute(sql`
      SELECT 
        id, title, abstract, authors, journal, 
        publish_date, journal_publish_date, category,
        consumer_categories, image_url, image_alt,
        view_count, slug, doi, keywords,
        author_affiliations, funding_sources,
        statistical_methods, ethical_approval,
        methods, results, conclusion, objective,
        sample_size, study_type, url, pdf_url
      FROM studies
      WHERE id = ${studyId}
      LIMIT 1
    `);

    if (results.rows.length === 0) {
      return res.status(404).json({ error: 'Study not found' });
    }

    const study = results.rows[0];
    
    // Async view count update (non-blocking)
    setImmediate(async () => {
      try {
        await db.execute(sql`
          UPDATE studies 
          SET view_count = COALESCE(view_count, 0) + 1 
          WHERE id = ${studyId}
        `);
      } catch (error) {
        console.error('View count update failed:', error);
      }
    });

    res.json({
      id: study.id,
      title: study.title || 'Untitled Study',
      abstract: study.abstract || '',
      authors: study.authors || '',
      journal: study.journal || '',
      publishDate: study.publish_date || study.journal_publish_date,
      category: study.category || 'General',
      consumerCategories: study.consumer_categories,
      imageUrl: study.image_url,
      imageAlt: study.image_alt,
      viewCount: (study.view_count || 0) + 1,
      slug: study.slug,
      doi: study.doi,
      keywords: study.keywords,
      authorAffiliations: study.author_affiliations,
      fundingSources: study.funding_sources,
      statisticalMethods: study.statistical_methods,
      ethicalApproval: study.ethical_approval,
      methods: study.methods,
      results: study.results,
      conclusion: study.conclusion,
      objective: study.objective,
      sampleSize: study.sample_size,
      studyType: study.study_type,
      url: study.url,
      pdfUrl: study.pdf_url
    });
  } catch (error) {
    console.error('Study detail error:', error);
    res.status(500).json({ error: 'Failed to load study details' });
  }
});

// Study by slug endpoint
app.get('/api/studies/slug/:slug', async (req, res) => {
  try {
    if (!db) {
      return res.status(500).json({ error: 'Database not available' });
    }
    
    const slug = req.params.slug;
    if (!slug || typeof slug !== 'string') {
      return res.status(400).json({ error: 'Invalid slug' });
    }

    const results = await db.execute(sql`
      SELECT 
        id, title, abstract, authors, journal, 
        publish_date, journal_publish_date, category,
        consumer_categories, image_url, image_alt,
        view_count, slug, doi, keywords,
        author_affiliations, funding_sources,
        statistical_methods, ethical_approval,
        methods, results, conclusion, objective,
        sample_size, study_type, url, pdf_url
      FROM studies
      WHERE slug = ${slug}
      LIMIT 1
    `);

    if (results.rows.length === 0) {
      return res.status(404).json({ error: 'Study not found' });
    }

    const study = results.rows[0];
    
    // Async view count update
    setImmediate(async () => {
      try {
        await db.execute(sql`
          UPDATE studies 
          SET view_count = COALESCE(view_count, 0) + 1 
          WHERE id = ${study.id}
        `);
      } catch (error) {
        console.error('View count update failed:', error);
      }
    });

    res.json({
      id: study.id,
      title: study.title || 'Untitled Study',
      abstract: study.abstract || '',
      authors: study.authors || '',
      journal: study.journal || '',
      publishDate: study.publish_date || study.journal_publish_date,
      category: study.category || 'General',
      consumerCategories: study.consumer_categories,
      imageUrl: study.image_url,
      imageAlt: study.image_alt,
      viewCount: (study.view_count || 0) + 1,
      slug: study.slug,
      doi: study.doi,
      keywords: study.keywords,
      authorAffiliations: study.author_affiliations,
      fundingSources: study.funding_sources,
      statisticalMethods: study.statistical_methods,
      ethicalApproval: study.ethical_approval,
      methods: study.methods,
      results: study.results,
      conclusion: study.conclusion,
      objective: study.objective,
      sampleSize: study.sample_size,
      studyType: study.study_type,
      url: study.url,
      pdfUrl: study.pdf_url
    });
  } catch (error) {
    console.error('Study by slug error:', error);
    res.status(500).json({ error: 'Failed to load study details' });
  }
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Server error:', error);
  res.status(500).json({ error: 'Internal server error' });
});

// SPA fallback - serve index.html for all non-API routes
app.get('*', (req, res) => {
  const indexPath = join(distPath, 'index.html');
  if (existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).json({ 
      error: 'Application not built',
      hint: 'Run npm run build first'
    });
  }
});

// Start server with proper error handling
const server = app.listen(port, '0.0.0.0', () => {
  console.log(`Production server running on port ${port}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Memory usage: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`);
});

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`Port ${port} is already in use`);
    process.exit(1);
  } else {
    console.error('Server error:', error);
    process.exit(1);
  }
});

// Graceful shutdown
const gracefulShutdown = () => {
  console.log('Shutting down gracefully...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);