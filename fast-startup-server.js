/**
 * Fast Startup Server with API Response Format Fixes
 * Minimal initialization for immediate deployment
 */

import express from 'express';
import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import { studies, categories } from './shared/schema.js';
import { eq, ilike, and, or, desc, asc, count, sql } from 'drizzle-orm';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

// Database setup
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is required');
}

const sql_client = neon(connectionString);
const db = drizzle(sql_client);

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'dist')));

// FIXED API ROUTES - Using correct response format: {data, total, page, pageSize, pageCount}

// Get all studies with fixed response format
app.get('/api/studies', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    const search = req.query.search || '';

    let whereConditions = [];
    if (search) {
      whereConditions.push(
        or(
          ilike(studies.title, `%${search}%`),
          ilike(studies.abstract, `%${search}%`),
          ilike(studies.keywords, `%${search}%`)
        )
      );
    }

    const whereClause = whereConditions.length > 0 ? and(...whereConditions) : undefined;

    const [studiesResult, totalResult] = await Promise.all([
      db.select()
        .from(studies)
        .where(whereClause)
        .limit(limit)
        .offset(offset)
        .orderBy(desc(studies.id)),
      db.select({ count: count() })
        .from(studies)
        .where(whereClause)
    ]);

    const total = totalResult[0]?.count || 0;
    const pageCount = Math.ceil(total / limit);

    // FIXED: Return format expected by frontend
    res.json({
      data: studiesResult,
      total,
      page,
      pageSize: limit,
      pageCount
    });
  } catch (error) {
    console.error('Error fetching studies:', error);
    res.status(500).json({ error: 'Failed to fetch studies' });
  }
});

// Get studies by category with fixed response format
app.get('/api/categories/:id/studies', async (req, res) => {
  try {
    const categoryId = parseInt(req.params.id);
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    const [studiesResult, totalResult] = await Promise.all([
      db.select()
        .from(studies)
        .where(eq(studies.categoryId, categoryId))
        .limit(limit)
        .offset(offset)
        .orderBy(desc(studies.id)),
      db.select({ count: count() })
        .from(studies)
        .where(eq(studies.categoryId, categoryId))
    ]);

    const total = totalResult[0]?.count || 0;
    const pageCount = Math.ceil(total / limit);

    // FIXED: Return format expected by frontend
    res.json({
      data: studiesResult,
      total,
      page,
      pageSize: limit,
      pageCount
    });
  } catch (error) {
    console.error('Error fetching category studies:', error);
    res.status(500).json({ error: 'Failed to fetch category studies' });
  }
});

// Get studies by condition with fixed response format
app.get('/api/studies/condition/:condition', async (req, res) => {
  try {
    const condition = req.params.condition;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    const [studiesResult, totalResult] = await Promise.all([
      db.select()
        .from(studies)
        .where(ilike(studies.consumer_categories, `%${condition}%`))
        .limit(limit)
        .offset(offset)
        .orderBy(desc(studies.id)),
      db.select({ count: count() })
        .from(studies)
        .where(ilike(studies.consumer_categories, `%${condition}%`))
    ]);

    const total = totalResult[0]?.count || 0;
    const pageCount = Math.ceil(total / limit);

    // FIXED: Return format expected by frontend
    res.json({
      data: studiesResult,
      total,
      page,
      pageSize: limit,
      pageCount
    });
  } catch (error) {
    console.error('Error fetching condition studies:', error);
    res.status(500).json({ error: 'Failed to fetch condition studies' });
  }
});

// Get single study by ID
app.get('/api/studies/:id', async (req, res) => {
  try {
    const studyId = parseInt(req.params.id);
    const study = await db.select()
      .from(studies)
      .where(eq(studies.id, studyId))
      .limit(1);

    if (study.length === 0) {
      return res.status(404).json({ error: 'Study not found' });
    }

    res.json(study[0]);
  } catch (error) {
    console.error('Error fetching study:', error);
    res.status(500).json({ error: 'Failed to fetch study' });
  }
});

// Get all categories
app.get('/api/categories', async (req, res) => {
  try {
    const categoriesResult = await db.select().from(categories).orderBy(asc(categories.name));
    res.json(categoriesResult);
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

// Database overview endpoint
app.get('/api/database-overview', async (req, res) => {
  try {
    const [totalStudiesResult, categoriesResult] = await Promise.all([
      db.select({ count: count() }).from(studies),
      db.select().from(categories).orderBy(asc(categories.name))
    ]);

    const totalStudies = totalStudiesResult[0]?.count || 0;

    res.json({
      totalStudies,
      categories: categoriesResult,
      lastUpdated: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching database overview:', error);
    res.status(500).json({ error: 'Failed to fetch database overview' });
  }
});

// Serve React app for all other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Fast startup server running on port ${PORT} with FIXED API responses`);
});