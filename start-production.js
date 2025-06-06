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

// Graceful error handling
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error.message);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason);
});

// Essential middleware only
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: false, limit: '5mb' }));

// Static file serving with caching
const distPath = join(__dirname, 'dist');
if (existsSync(distPath)) {
  app.use(express.static(distPath, { 
    maxAge: '1d',
    etag: true,
    lastModified: true
  }));
  console.log('Static files available from:', distPath);
}

// Database connection - lazy initialization
let db = null;
const getDatabase = () => {
  if (!db && process.env.DATABASE_URL) {
    try {
      const client = neon(process.env.DATABASE_URL);
      db = drizzle(client);
      console.log('Database connected');
    } catch (error) {
      console.error('Database connection error:', error.message);
    }
  }
  return db;
};

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
    memory: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + 'MB'
  });
});

// Consumer categories endpoint - optimized for stability
app.get('/api/consumer-categories/counts', async (req, res) => {
  try {
    const database = getDatabase();
    if (!database) {
      return res.json({ 
        success: true, 
        data: {
          condition: [],
          body_system: [],
          life_stage: []
        }
      });
    }

    const results = await database.execute(sql`
      SELECT name, study_count as count, description
      FROM categories 
      WHERE study_count > 0 
      ORDER BY study_count DESC
      LIMIT 15
    `);

    const categories = results.rows.map(row => ({
      name: row.name,
      count: row.count,
      description: row.description || ''
    }));

    // Organize categories into logical groups
    const conditions = categories.filter(cat => 
      ['Respiratory', 'Inflammation', 'Neurological', 'Metabolic', 'Cardiovascular'].includes(cat.name)
    ).slice(0, 5);

    const bodySystems = categories.filter(cat => 
      ['Liver', 'Gastrointestinal', 'Kidney', 'Cancer Research'].includes(cat.name)
    ).slice(0, 4);

    const lifeStages = categories.filter(cat => 
      ['Aging', 'Fitness', 'Dermatology'].includes(cat.name)
    ).slice(0, 3);

    res.json({ 
      success: true,
      data: {
        condition: conditions,
        body_system: bodySystems,
        life_stage: lifeStages
      }
    });
  } catch (error) {
    console.error('Categories endpoint error:', error.message);
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

// Enhanced search endpoint - optimized with proper pagination
app.get('/api/search/enhanced', async (req, res) => {
  try {
    const database = getDatabase();
    if (!database) {
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
    let orderClause = 'ORDER BY COALESCE(view_count, 0) DESC, id DESC';

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
      whereClause += whereClause ? 
        ` AND category ILIKE '%${categoryFilter}%'` : 
        `WHERE category ILIKE '%${categoryFilter}%'`;
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

    const results = await database.execute(sql.raw(queryText));

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
    
    const totalResult = await database.execute(sql.raw(countQuery));
    const total = parseInt(totalResult.rows[0]?.total || 0);

    res.json({
      studies,
      total,
      facets: { tags: [], journals: [], years: [] },
      suggestions: [],
      trending: ["hydrogen water", "antioxidant", "inflammation", "brain health"]
    });
  } catch (error) {
    console.error('Search endpoint error:', error.message);
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

// Individual study endpoint - non-blocking view count update
app.get('/api/studies/:id', async (req, res) => {
  try {
    const database = getDatabase();
    if (!database) {
      return res.status(500).json({ error: 'Database not available' });
    }

    const studyId = parseInt(req.params.id);
    if (!studyId || isNaN(studyId)) {
      return res.status(400).json({ error: 'Invalid study ID' });
    }

    const results = await database.execute(sql`
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

    // Non-blocking view count update
    setImmediate(() => {
      database.execute(sql`
        UPDATE studies 
        SET view_count = COALESCE(view_count, 0) + 1 
        WHERE id = ${studyId}
      `).catch(error => {
        console.error('View count update failed:', error.message);
      });
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
    console.error('Study detail error:', error.message);
    res.status(500).json({ error: 'Failed to load study details' });
  }
});

// Study by slug endpoint
app.get('/api/studies/slug/:slug', async (req, res) => {
  try {
    const database = getDatabase();
    if (!database) {
      return res.status(500).json({ error: 'Database not available' });
    }

    const slug = req.params.slug;
    if (!slug || typeof slug !== 'string') {
      return res.status(400).json({ error: 'Invalid slug' });
    }

    const results = await database.execute(sql`
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

    // Non-blocking view count update
    setImmediate(() => {
      database.execute(sql`
        UPDATE studies 
        SET view_count = COALESCE(view_count, 0) + 1 
        WHERE id = ${study.id}
      `).catch(error => {
        console.error('View count update failed:', error.message);
      });
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
    console.error('Study by slug error:', error.message);
    res.status(500).json({ error: 'Failed to load study details' });
  }
});

// Core studies API endpoint - MISSING from deployment
app.get('/api/studies', async (req, res) => {
  try {
    const database = getDatabase();
    if (!database) {
      return res.json({ studies: [], total: 0 });
    }

    const { 
      limit = 20, 
      offset = 0, 
      category = '',
      searchInMethods = false,
      searchInResults = false,
      searchInConclusion = false,
      searchInSimplified = false,
      tags = '',
      q = ''
    } = req.query;

    const limitInt = Math.min(parseInt(limit) || 20, 100);
    const offsetInt = Math.max(parseInt(offset) || 0, 0);

    let whereClause = '';
    const searchFields = [];
    
    if (q && typeof q === 'string' && q.trim()) {
      const searchTerm = q.replace(/'/g, "''");
      searchFields.push(`title ILIKE '%${searchTerm}%'`);
      searchFields.push(`abstract ILIKE '%${searchTerm}%'`);
      searchFields.push(`authors ILIKE '%${searchTerm}%'`);
      
      if (searchInMethods === 'true') {
        searchFields.push(`methods ILIKE '%${searchTerm}%'`);
      }
      if (searchInResults === 'true') {
        searchFields.push(`results ILIKE '%${searchTerm}%'`);
      }
      if (searchInConclusion === 'true') {
        searchFields.push(`conclusion ILIKE '%${searchTerm}%'`);
      }
      
      whereClause = `WHERE (${searchFields.join(' OR ')})`;
    }

    if (category && typeof category === 'string') {
      const categoryFilter = category.replace(/'/g, "''");
      whereClause += whereClause ? 
        ` AND category ILIKE '%${categoryFilter}%'` : 
        `WHERE category ILIKE '%${categoryFilter}%'`;
    }

    if (tags && typeof tags === 'string') {
      const tagFilter = tags.replace(/'/g, "''");
      whereClause += whereClause ? 
        ` AND keywords ILIKE '%${tagFilter}%'` : 
        `WHERE keywords ILIKE '%${tagFilter}%'`;
    }

    const queryText = `
      SELECT 
        id, title, abstract, authors, journal, 
        publish_date, journal_publish_date, category,
        consumer_categories, image_url, image_alt,
        view_count, slug, doi, study_type,
        methods, results, conclusion
      FROM studies
      ${whereClause}
      ORDER BY COALESCE(view_count, 0) DESC, id DESC
      LIMIT ${limitInt} OFFSET ${offsetInt}
    `;

    const results = await database.execute(sql.raw(queryText));

    const studies = results.rows.map((row) => ({
      id: row.id,
      title: row.title || 'Untitled Study',
      abstract: row.abstract ? row.abstract.substring(0, 300) + '...' : '',
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
      studyType: row.study_type,
      methods: row.methods,
      results: row.results,
      conclusion: row.conclusion
    }));

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total
      FROM studies
      ${whereClause}
    `;
    
    const totalResult = await database.execute(sql.raw(countQuery));
    const total = parseInt(totalResult.rows[0]?.total || 0);

    res.json({ 
      data: studies, 
      total,
      page: Math.floor(offsetInt / limitInt) + 1,
      pageSize: limitInt,
      pageCount: Math.ceil(total / limitInt)
    });
  } catch (error) {
    console.error('Studies API error:', error.message);
    res.status(500).json({ error: 'Failed to load studies', data: [], total: 0 });
  }
});

// Categories API endpoint - MISSING from deployment
app.get('/api/categories', async (req, res) => {
  try {
    const database = getDatabase();
    if (!database) {
      return res.json([]);
    }

    const results = await database.execute(sql`
      SELECT id, name, description, study_count
      FROM categories 
      WHERE study_count > 0 
      ORDER BY study_count DESC
    `);

    const categories = results.rows.map(row => ({
      id: row.id,
      name: row.name,
      description: row.description || '',
      count: row.study_count || 0
    }));

    res.json(categories);
  } catch (error) {
    console.error('Categories API error:', error.message);
    res.status(500).json([]);
  }
});

// Studies by condition endpoint - MISSING from deployment
app.get('/api/studies/condition/:condition', async (req, res) => {
  try {
    const database = getDatabase();
    if (!database) {
      return res.json({ studies: [], total: 0 });
    }

    const condition = req.params.condition;
    const { limit = 20, offset = 0 } = req.query;
    
    const limitInt = Math.min(parseInt(limit) || 20, 100);
    const offsetInt = Math.max(parseInt(offset) || 0, 0);

    const conditionFilter = condition.replace(/'/g, "''");
    
    const queryText = `
      SELECT 
        id, title, abstract, authors, journal, 
        publish_date, journal_publish_date, category,
        consumer_categories, image_url, image_alt,
        view_count, slug, doi, study_type
      FROM studies
      WHERE category ILIKE '%${conditionFilter}%' 
         OR consumer_categories ILIKE '%${conditionFilter}%'
      ORDER BY COALESCE(view_count, 0) DESC, id DESC
      LIMIT ${limitInt} OFFSET ${offsetInt}
    `;

    const results = await database.execute(sql.raw(queryText));

    const studies = results.rows.map((row) => ({
      id: row.id,
      title: row.title || 'Untitled Study',
      abstract: row.abstract ? row.abstract.substring(0, 300) + '...' : '',
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
      studyType: row.study_type
    }));

    const countQuery = `
      SELECT COUNT(*) as total
      FROM studies
      WHERE category ILIKE '%${conditionFilter}%' 
         OR consumer_categories ILIKE '%${conditionFilter}%'
    `;
    
    const totalResult = await database.execute(sql.raw(countQuery));
    const total = parseInt(totalResult.rows[0]?.total || 0);

    res.json({ 
      data: studies, 
      total,
      page: Math.floor(offsetInt / limitInt) + 1,
      pageSize: limitInt,
      pageCount: Math.ceil(total / limitInt)
    });
  } catch (error) {
    console.error('Condition studies error:', error.message);
    res.status(500).json({ error: 'Failed to load studies for condition', data: [], total: 0 });
  }
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Express error:', error.message);
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

// Server startup with proper error handling
const server = app.listen(port, '0.0.0.0', () => {
  console.log(`Stable server running on port ${port}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Memory usage: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`);
});

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`Port ${port} is already in use`);
    console.log('Trying alternative port...');
    const altPort = port + 1;
    setTimeout(() => {
      server.listen(altPort, '0.0.0.0', () => {
        console.log(`Server started on alternative port ${altPort}`);
      });
    }, 1000);
  } else {
    console.error('Server error:', error.message);
    process.exit(1);
  }
});

// Graceful shutdown handling
const gracefulShutdown = (signal) => {
  console.log(`Received ${signal}, shutting down gracefully...`);
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Schedule background operations to run after server is stable
setTimeout(() => {
  console.log('Server stable, initializing background services...');
  // Background tasks will be handled separately to avoid blocking main server
}, 30000);