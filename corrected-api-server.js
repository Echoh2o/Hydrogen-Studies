/**
 * Corrected API Server - Fixes Frontend-Backend Response Format Mismatch
 * Returns proper format: {data, total, page, pageSize, pageCount}
 */

import express from 'express';
import { neon } from '@neondatabase/serverless';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

// Database connection
const sql = neon(process.env.DATABASE_URL);

// Middleware
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  next();
});
app.use(express.json());
app.use(express.static(path.join(__dirname, 'dist')));

// CORRECTED: Main studies endpoint with proper response format
app.get('/api/studies', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    const search = req.query.search || '';

    let whereClause = 'WHERE title IS NOT NULL AND abstract IS NOT NULL';
    let queryParams = [];

    if (search) {
      whereClause += ` AND (title ILIKE $${queryParams.length + 1} OR abstract ILIKE $${queryParams.length + 1} OR keywords ILIKE $${queryParams.length + 1})`;
      queryParams.push(`%${search}%`);
    }

    // Get studies
    const studiesQuery = `
      SELECT id, title, abstract, authors, journal, publish_date, 
             category, image_url, view_count, slug, doi, study_type,
             consumer_categories
      FROM studies 
      ${whereClause}
      ORDER BY id DESC 
      LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}
    `;
    
    queryParams.push(limit, offset);
    const studiesResult = await sql(studiesQuery, queryParams);

    // Get total count
    const countQuery = `SELECT COUNT(*) as total FROM studies ${whereClause}`;
    const countParams = queryParams.slice(0, -2); // Remove limit and offset
    const countResult = await sql(countQuery, countParams);
    const total = parseInt(countResult[0]?.total || 0);

    const pageCount = Math.ceil(total / limit);

    // FIXED: Return format expected by frontend
    res.json({
      data: studiesResult.map(study => ({
        id: study.id,
        title: study.title,
        abstract: study.abstract,
        authors: study.authors,
        journal: study.journal,
        publishDate: study.publish_date,
        category: study.category,
        imageUrl: study.image_url,
        viewCount: study.view_count || 0,
        slug: study.slug,
        doi: study.doi,
        studyType: study.study_type,
        consumerCategories: study.consumer_categories
      })),
      total,
      page,
      pageSize: limit,
      pageCount
    });
  } catch (error) {
    console.error('Studies API error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch studies',
      data: [],
      total: 0,
      page: 1,
      pageSize: limit || 20,
      pageCount: 0
    });
  }
});

// CORRECTED: Studies by category endpoint
app.get('/api/categories/:id/studies', async (req, res) => {
  try {
    const categoryId = parseInt(req.params.id);
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    // Get studies for category
    const studiesQuery = `
      SELECT id, title, abstract, authors, journal, publish_date,
             category, image_url, view_count, slug, doi, study_type
      FROM studies 
      WHERE category_id = $1
      ORDER BY id DESC 
      LIMIT $2 OFFSET $3
    `;
    
    const studiesResult = await sql(studiesQuery, [categoryId, limit, offset]);

    // Get total count for category
    const countQuery = `SELECT COUNT(*) as total FROM studies WHERE category_id = $1`;
    const countResult = await sql(countQuery, [categoryId]);
    const total = parseInt(countResult[0]?.total || 0);

    const pageCount = Math.ceil(total / limit);

    // FIXED: Return format expected by frontend
    res.json({
      data: studiesResult.map(study => ({
        id: study.id,
        title: study.title,
        abstract: study.abstract,
        authors: study.authors,
        journal: study.journal,
        publishDate: study.publish_date,
        category: study.category,
        imageUrl: study.image_url,
        viewCount: study.view_count || 0,
        slug: study.slug,
        doi: study.doi,
        studyType: study.study_type
      })),
      total,
      page,
      pageSize: limit,
      pageCount
    });
  } catch (error) {
    console.error('Category studies API error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch category studies',
      data: [],
      total: 0,
      page: 1,
      pageSize: limit || 20,
      pageCount: 0
    });
  }
});

// CORRECTED: Studies by condition endpoint
app.get('/api/studies/condition/:condition', async (req, res) => {
  try {
    const condition = req.params.condition;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    // Get studies for condition
    const studiesQuery = `
      SELECT id, title, abstract, authors, journal, publish_date,
             category, image_url, view_count, slug, doi, study_type,
             consumer_categories
      FROM studies 
      WHERE consumer_categories ILIKE $1
      ORDER BY id DESC 
      LIMIT $2 OFFSET $3
    `;
    
    const studiesResult = await sql(studiesQuery, [`%${condition}%`, limit, offset]);

    // Get total count for condition
    const countQuery = `SELECT COUNT(*) as total FROM studies WHERE consumer_categories ILIKE $1`;
    const countResult = await sql(countQuery, [`%${condition}%`]);
    const total = parseInt(countResult[0]?.total || 0);

    const pageCount = Math.ceil(total / limit);

    // FIXED: Return format expected by frontend
    res.json({
      data: studiesResult.map(study => ({
        id: study.id,
        title: study.title,
        abstract: study.abstract,
        authors: study.authors,
        journal: study.journal,
        publishDate: study.publish_date,
        category: study.category,
        imageUrl: study.image_url,
        viewCount: study.view_count || 0,
        slug: study.slug,
        doi: study.doi,
        studyType: study.study_type,
        consumerCategories: study.consumer_categories
      })),
      total,
      page,
      pageSize: limit,
      pageCount
    });
  } catch (error) {
    console.error('Condition studies API error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch condition studies',
      data: [],
      total: 0,
      page: 1,
      pageSize: limit || 20,
      pageCount: 0
    });
  }
});

// Single study endpoint
app.get('/api/studies/:id', async (req, res) => {
  try {
    const studyId = parseInt(req.params.id);
    const result = await sql(`
      SELECT * FROM studies WHERE id = $1
    `, [studyId]);

    if (result.length === 0) {
      return res.status(404).json({ error: 'Study not found' });
    }

    res.json(result[0]);
  } catch (error) {
    console.error('Study fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch study' });
  }
});

// Categories endpoint
app.get('/api/categories', async (req, res) => {
  try {
    const result = await sql(`
      SELECT id, name, description, study_count, slug, icon
      FROM categories 
      WHERE study_count > 0 
      ORDER BY study_count DESC
    `);
    
    res.json(result);
  } catch (error) {
    console.error('Categories API error:', error);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

// Database overview endpoint
app.get('/api/database-overview', async (req, res) => {
  try {
    const [totalResult, categoriesResult] = await Promise.all([
      sql(`SELECT COUNT(*) as total FROM studies`),
      sql(`SELECT id, name, description, study_count FROM categories WHERE study_count > 0 ORDER BY study_count DESC`)
    ]);

    const totalStudies = parseInt(totalResult[0]?.total || 0);

    res.json({
      totalStudies,
      categories: categoriesResult,
      lastUpdated: new Date().toISOString()
    });
  } catch (error) {
    console.error('Database overview error:', error);
    res.status(500).json({ error: 'Failed to fetch database overview' });
  }
});

// Serve React app for all other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Corrected API server running on port ${PORT} with FIXED response formats`);
  console.log(`🔧 API now returns {data, total, page, pageSize, pageCount} format`);
});