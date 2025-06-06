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

// Set production environment
process.env.NODE_ENV = 'production';

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Serve static files from dist directory
const distPath = join(__dirname, 'dist');
if (existsSync(distPath)) {
  app.use(express.static(distPath));
  console.log(`✅ Serving static files from: ${distPath}`);
} else {
  console.error(`❌ Build directory not found: ${distPath}`);
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    buildExists: existsSync(distPath)
  });
});

// Database-connected API routes for production
import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import { sql } from 'drizzle-orm';

const connectionString = process.env.DATABASE_URL;
let db;

if (connectionString) {
  const dbClient = neon(connectionString);
  db = drizzle(dbClient);
  console.log('✅ Database connection established');
} else {
  console.warn('⚠️ No DATABASE_URL found, using fallback routes');
}

// Consumer categories endpoint
app.get('/api/consumer-categories/counts', async (req, res) => {
  try {
    if (!db) {
      return res.json([]);
    }
    
    const results = await db.execute(sql`
      SELECT 
        c.id,
        c.name,
        c.description,
        c.icon,
        c.color,
        c.count
      FROM consumer_categories c
      WHERE c.count > 0
      ORDER BY c.count DESC
    `);
    
    res.json(results.rows);
  } catch (error) {
    console.error('Consumer categories error:', error);
    res.json([]);
  }
});

// Search trending endpoint
app.get('/api/search/trending', (req, res) => {
  res.json({ trending: ["hydrogen water", "antioxidant", "inflammation", "brain health"] });
});

// Legacy categories endpoint
app.get('/api/tags/categories', async (req, res) => {
  try {
    if (!db) {
      return res.json({ categories: [] });
    }
    
    const results = await db.execute(sql`
      SELECT 
        c.name,
        c.count
      FROM consumer_categories c
      WHERE c.count > 0
      ORDER BY c.count DESC
      LIMIT 10
    `);
    
    const categories = results.rows.map((row) => ({
      name: row.name,
      count: row.count
    }));
    
    res.json({ categories });
  } catch (error) {
    console.error('Categories error:', error);
    res.json({ categories: [] });
  }
});

// Enhanced search endpoint
app.get('/api/search/enhanced', async (req, res) => {
  try {
    if (!db) {
      return res.json({ studies: [], total: 0 });
    }
    
    const { 
      q = '', 
      limit = 20, 
      offset = 0, 
      category = '',
      condition = '',
      bodySystem = '',
      lifeStage = ''
    } = req.query;
    
    const limitInt = Math.min(parseInt(limit) || 20, 100);
    const offsetInt = parseInt(offset) || 0;

    let whereClause = '';
    const conditions = [];
    
    if (q && typeof q === 'string' && q.trim()) {
      conditions.push(`(
        title ILIKE '%${q.replace(/'/g, "''")}%' OR 
        abstract ILIKE '%${q.replace(/'/g, "''")}%' OR 
        authors ILIKE '%${q.replace(/'/g, "''")}%'
      )`);
    }
    
    if (category && typeof category === 'string') {
      conditions.push(`category ILIKE '%${category.replace(/'/g, "''")}%'`);
    }

    if (condition && typeof condition === 'string') {
      conditions.push(`consumer_categories->>'condition' ILIKE '%${condition.replace(/'/g, "''")}%'`);
    }

    if (bodySystem && typeof bodySystem === 'string') {
      conditions.push(`consumer_categories->>'bodySystem' ILIKE '%${bodySystem.replace(/'/g, "''")}%'`);
    }

    if (lifeStage && typeof lifeStage === 'string') {
      conditions.push(`consumer_categories->>'lifeStage' ILIKE '%${lifeStage.replace(/'/g, "''")}%'`);
    }
    
    if (conditions.length > 0) {
      whereClause = `WHERE ${conditions.join(' AND ')}`;
    }

    const results = await db.execute(sql.raw(`
      SELECT 
        id, title, abstract, authors, journal, 
        publish_date, journal_publish_date, category,
        consumer_categories, image_url, image_alt,
        view_count, slug
      FROM studies
      ${whereClause}
      ORDER BY 
        CASE WHEN title IS NOT NULL AND title != '' THEN 0 ELSE 1 END,
        view_count DESC,
        id DESC
      LIMIT ${limitInt} OFFSET ${offsetInt}
    `));

    const totalResult = await db.execute(sql.raw(`
      SELECT COUNT(*) as total
      FROM studies
      ${whereClause}
    `));

    const studies = results.rows.map((row) => ({
      id: row.id,
      title: row.title || 'Untitled Study',
      abstract: row.abstract || '',
      authors: row.authors || '',
      journal: row.journal || '',
      publishDate: row.publish_date || row.journal_publish_date,
      category: row.category || 'General',
      consumerCategories: row.consumer_categories,
      imageUrl: row.image_url,
      imageAlt: row.image_alt,
      viewCount: row.view_count || 0,
      slug: row.slug,
      relevanceScore: 1.0,
      tags: [],
      relatedStudies: []
    }));

    res.json({
      studies,
      total: parseInt(totalResult.rows[0]?.total || 0),
      facets: { tags: [], journals: [], years: [] },
      suggestions: [],
      trending: ["hydrogen water", "antioxidant", "inflammation", "brain health"]
    });
  } catch (error) {
    console.error('Enhanced search error:', error);
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

// SPA fallback - serve index.html for all non-API routes
app.get('*', (req, res) => {
  const indexPath = join(distPath, 'index.html');
  if (existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).json({ 
      error: 'Application not built. Run npm run build first.',
      path: indexPath,
      exists: existsSync(indexPath)
    });
  }
});

app.listen(port, '0.0.0.0', () => {
  console.log(`🚀 Production server running on port ${port}`);
  console.log(`📁 Static files: ${distPath}`);
  console.log(`🌐 Environment: ${process.env.NODE_ENV}`);
});