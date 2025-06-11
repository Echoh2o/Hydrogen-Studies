/**
 * Simplified Production Server
 * Handles static files, essential API routes, and SPA routing for deployment
 */

import express from 'express';
import { createServer } from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';
import { neon } from '@neondatabase/serverless';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function createProductionServer() {
  const app = express();
  const startTime = Date.now();

  console.log('Initializing production server...');

  // Validate environment
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required for production');
  }

  const sql = neon(process.env.DATABASE_URL);

  // Basic middleware
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  // CORS for production
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    if (req.method === 'OPTIONS') {
      res.sendStatus(200);
    } else {
      next();
    }
  });

  // Static file serving with correct precedence
  app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

  // Serve built assets from dist (production assets)
  app.use('/assets', express.static(path.join(process.cwd(), 'dist', 'assets')));

  // Serve built files from dist first (production)
  app.use(express.static(path.join(process.cwd(), 'dist')));

  // Fallback to public directory (development assets)
  app.use(express.static(path.join(process.cwd(), 'public')));

  // Create essential API routes directly
  console.log('Setting up essential API routes...');

  // Studies API
  app.get('/api/studies', async (req, res) => {
    try {
      const {
        search = '',
        category = '',
        limit = '50',
        offset = '0'
      } = req.query;

      let baseQuery = sql`SELECT * FROM studies`;
      let conditions = [];

      if (search) {
        conditions.push(sql`(title ILIKE ${'%' + search + '%'} OR abstract ILIKE ${'%' + search + '%'})`);
      }

      if (category) {
        conditions.push(sql`category = ${category}`);
      }

      let studies;
      if (conditions.length > 0) {
        const whereClause = conditions.reduce((acc, condition) => sql`${acc} AND ${condition}`);
        studies = await sql`
          SELECT * FROM studies
          WHERE ${whereClause}
          ORDER BY created_at DESC
          LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}
        `;
      } else {
        studies = await sql`
          SELECT * FROM studies
          ORDER BY created_at DESC
          LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}
        `;
      }

      res.json(studies);
    } catch (error) {
      console.error('Error fetching studies:', error);
      res.status(500).json({ error: 'Failed to fetch studies' });
    }
  });

  // Categories API
  app.get('/api/categories', async (req, res) => {
    try {
      const categories = await sql`
        SELECT category, COUNT(*) as count
        FROM studies
        WHERE category IS NOT NULL
        GROUP BY category
        ORDER BY count DESC
      `;
      res.json(categories);
    } catch (error) {
      console.error('Error fetching categories:', error);
      res.status(500).json({ error: 'Failed to fetch categories' });
    }
  });

  // Consumer categories studies endpoint
  app.get('/api/consumer-categories/studies', async (req, res) => {
    const { model, category } = req.query;

    if (!model || !category) {
      return res.status(400).json({ error: 'Model and category are required' });
    }

    console.log(`Fetching studies for ${model}:${category}`);

    try {
      let studies = [];

      // Map category to search terms based on actual study content
      const categorySearchMap = {
        // Health conditions
        'Arthritis & Inflammation': ['arthritis', 'inflammation', 'inflammatory'],
        'Heart Disease & Hypertension': ['heart', 'cardiovascular', 'hypertension', 'cardiac'],
        'Brain & Neurological Disorders': ['brain', 'neuro', 'alzheimer', 'parkinson', 'cognitive'],
        'Diabetes & Metabolic Health': ['diabetes', 'metabolic', 'glucose', 'insulin'],
        'Lung & Respiratory Conditions': ['lung', 'respiratory', 'pulmonary', 'asthma'],
        'Digestive Health (Gut/Liver)': ['digestive', 'gut', 'liver', 'gastrointestinal'],
        'Cancer Supportive Care': ['cancer', 'tumor', 'oncology'],

        // Body systems
        'Cardiovascular System': ['heart', 'cardiovascular', 'cardiac', 'vascular'],
        'Nervous System': ['brain', 'neuro', 'nerve', 'neural'],
        'Respiratory System': ['lung', 'respiratory', 'pulmonary', 'breathing'],
        'Immune System': ['immune', 'inflammation', 'inflammatory', 'antioxidant'],
        'Musculoskeletal System': ['muscle', 'bone', 'joint', 'arthritis', 'skeletal'],
        'Digestive System': ['digestive', 'gut', 'intestinal', 'stomach'],
        'Renal System': ['kidney', 'renal', 'nephro'],

        // Life stages
        'Adults': ['adult', 'human', 'patient', 'clinical'],
        'Older Adults': ['elderly', 'senior', 'aging', 'older'],
        'Athletes & Fitness': ['athlete', 'exercise', 'fitness', 'performance', 'training']
      };

      const searchTerms = categorySearchMap[category as string];

      if (searchTerms && searchTerms.length > 0) {
        // Build dynamic search query
        const searchConditions = searchTerms.map(term => 
          `title ILIKE '%${term}%' OR abstract ILIKE '%${term}%'`
        ).join(' OR ');

        studies = await sql`
          SELECT * FROM studies 
          WHERE ${sql.raw(searchConditions)}
          ORDER BY publish_date DESC 
          LIMIT 20
        `;
      } else {
        // Fallback for unknown categories
        studies = await sql`
          SELECT * FROM studies 
          WHERE title ILIKE ${`%${category}%`} OR abstract ILIKE ${`%${category}%`}
          ORDER BY publish_date DESC 
          LIMIT 20
        `;
      }

      console.log(`Found ${studies.length} studies for category: ${category}`);

      res.json({
        data: studies,
        total: studies.length,
        page: 1,
        pageSize: 20
      });
    } catch (error) {
      console.error('Error fetching consumer category studies:', error);
      res.status(500).json({ error: 'Failed to fetch studies for category' });
    }
  });

  // Consumer categories endpoint
  app.get('/api/consumer-categories/counts', async (req, res) => {
    // Get all consumer categories with counts from actual studies
    console.log('Fetching consumer categories with counts from real studies...');

    try {
      // Get actual study counts by searching title and abstract content
      const [conditionsResult, bodySystemsResult, lifeStagesResult] = await Promise.all([
        // Health conditions - search actual study content
        sql`
          SELECT 
            'Arthritis & Inflammation' as name,
            COUNT(*)::text as count
          FROM studies 
          WHERE 
            title ILIKE '%arthritis%' OR title ILIKE '%inflammation%' OR title ILIKE '%inflammatory%' OR
            abstract ILIKE '%arthritis%' OR abstract ILIKE '%inflammation%' OR abstract ILIKE '%inflammatory%'
          UNION ALL
          SELECT 
            'Heart Disease & Hypertension' as name,
            COUNT(*)::text as count
          FROM studies 
          WHERE 
            title ILIKE '%heart%' OR title ILIKE '%cardiovascular%' OR title ILIKE '%hypertension%' OR title ILIKE '%cardiac%' OR
            abstract ILIKE '%heart%' OR abstract ILIKE '%cardiovascular%' OR abstract ILIKE '%hypertension%' OR abstract ILIKE '%cardiac%'
          UNION ALL
          SELECT 
            'Brain & Neurological Disorders' as name,
            COUNT(*)::text as count
          FROM studies 
          WHERE 
            title ILIKE '%brain%' OR title ILIKE '%neuro%' OR title ILIKE '%alzheimer%' OR title ILIKE '%parkinson%' OR title ILIKE '%cognitive%' OR
            abstract ILIKE '%brain%' OR abstract ILIKE '%neuro%' OR abstract ILIKE '%alzheimer%' OR abstract ILIKE '%parkinson%' OR abstract ILIKE '%cognitive%'
          UNION ALL
          SELECT 
            'Diabetes & Metabolic Health' as name,
            COUNT(*)::text as count
          FROM studies 
          WHERE 
            title ILIKE '%diabetes%' OR title ILIKE '%metabolic%' OR title ILIKE '%glucose%' OR title ILIKE '%insulin%' OR
            abstract ILIKE '%diabetes%' OR abstract ILIKE '%metabolic%' OR abstract ILIKE '%glucose%' OR abstract ILIKE '%insulin%'
          UNION ALL
          SELECT 
            'Lung & Respiratory Conditions' as name,
            COUNT(*)::text as count
          FROM studies 
          WHERE 
            title ILIKE '%lung%' OR title ILIKE '%respiratory%' OR title ILIKE '%pulmonary%' OR title ILIKE '%asthma%' OR
            abstract ILIKE '%lung%' OR abstract ILIKE '%respiratory%' OR abstract ILIKE '%pulmonary%' OR abstract ILIKE '%asthma%'
          UNION ALL
          SELECT 
            'Digestive Health (Gut/Liver)' as name,
            COUNT(*)::text as count
          FROM studies 
          WHERE 
            title ILIKE '%digestive%' OR title ILIKE '%gut%' OR title ILIKE '%liver%' OR title ILIKE '%gastrointestinal%' OR
            abstract ILIKE '%digestive%' OR abstract ILIKE '%gut%' OR abstract ILIKE '%liver%' OR abstract ILIKE '%gastrointestinal%'
          UNION ALL
          SELECT 
            'Cancer Supportive Care' as name,
            COUNT(*)::text as count
          FROM studies 
          WHERE 
            title ILIKE '%cancer%' OR title ILIKE '%tumor%' OR title ILIKE '%oncology%' OR
            abstract ILIKE '%cancer%' OR abstract ILIKE '%tumor%' OR abstract ILIKE '%oncology%'
        `,

        // Body systems - search actual study content
        sql`
          SELECT 
            'Cardiovascular System' as name,
            COUNT(*)::text as count
          FROM studies 
          WHERE 
            title ILIKE '%heart%' OR title ILIKE '%cardiovascular%' OR title ILIKE '%cardiac%' OR title ILIKE '%vascular%' OR
            abstract ILIKE '%heart%' OR abstract ILIKE '%cardiovascular%' OR abstract ILIKE '%cardiac%' OR abstract ILIKE '%vascular%'
          UNION ALL
          SELECT 
            'Nervous System' as name,
            COUNT(*)::text as count
          FROM studies 
          WHERE 
            title ILIKE '%brain%' OR title ILIKE '%neuro%' OR title ILIKE '%nerve%' OR title ILIKE '%neural%' OR
            abstract ILIKE '%brain%' OR abstract ILIKE '%neuro%' OR abstract ILIKE '%nerve%' OR abstract ILIKE '%neural%'
          UNION ALL
          SELECT 
            'Respiratory System' as name,
            COUNT(*)::text as count
          FROM studies 
          WHERE 
            title ILIKE '%lung%' OR title ILIKE '%respiratory%' OR title ILIKE '%pulmonary%' OR title ILIKE '%breathing%' OR
            abstract ILIKE '%lung%' OR abstract ILIKE '%respiratory%' OR abstract ILIKE '%pulmonary%' OR abstract ILIKE '%breathing%'
          UNION ALL
          SELECT 
            'Immune System' as name,
            COUNT(*)::text as count
          FROM studies 
          WHERE 
            title ILIKE '%immune%' OR title ILIKE '%inflammation%' OR title ILIKE '%inflammatory%' OR title ILIKE '%antioxidant%' OR
            abstract ILIKE '%immune%' OR abstract ILIKE '%inflammation%' OR abstract ILIKE '%inflammatory%' OR abstract ILIKE '%antioxidant%'
          UNION ALL
          SELECT 
            'Musculoskeletal System' as name,
            COUNT(*)::text as count
          FROM studies 
          WHERE 
            title ILIKE '%muscle%' OR title ILIKE '%bone%' OR title ILIKE '%joint%' OR title ILIKE '%arthritis%' OR title ILIKE '%skeletal%' OR
            abstract ILIKE '%muscle%' OR abstract ILIKE '%bone%' OR abstract ILIKE '%joint%' OR abstract ILIKE '%arthritis%' OR abstract ILIKE '%skeletal%'
          UNION ALL
          SELECT 
            'Digestive System' as name,
            COUNT(*)::text as count
          FROM studies 
          WHERE 
            title ILIKE '%digestive%' OR title ILIKE '%gut%' OR title ILIKE '%intestinal%' OR title ILIKE '%stomach%' OR
            abstract ILIKE '%digestive%' OR abstract ILIKE '%gut%' OR abstract ILIKE '%intestinal%' OR abstract ILIKE '%stomach%'
          UNION ALL
          SELECT 
            'Renal System' as name,
            COUNT(*)::text as count
          FROM studies 
          WHERE 
            title ILIKE '%kidney%' OR title ILIKE '%renal%' OR title ILIKE '%nephro%' OR
            abstract ILIKE '%kidney%' OR abstract ILIKE '%renal%' OR abstract ILIKE '%nephro%'
        `,

        // Life stages - search actual study content
        sql`
          SELECT 
            'Adults' as name,
            COUNT(*)::text as count
          FROM studies 
          WHERE 
            title ILIKE '%adult%' OR title ILIKE '%human%' OR title ILIKE '%patient%' OR title ILIKE '%clinical%' OR
            abstract ILIKE '%adult%' OR abstract ILIKE '%human%' OR abstract ILIKE '%patient%' OR abstract ILIKE '%clinical%'
          UNION ALL
          SELECT 
            'Older Adults' as name,
            COUNT(*)::text as count
          FROM studies 
          WHERE 
            title ILIKE '%elderly%' OR title ILIKE '%senior%' OR title ILIKE '%aging%' OR title ILIKE '%older%' OR
            abstract ILIKE '%elderly%' OR abstract ILIKE '%senior%' OR abstract ILIKE '%aging%' OR abstract ILIKE '%older%'
          UNION ALL
          SELECT 
            'Athletes & Fitness' as name,
            COUNT(*)::text as count
          FROM studies 
          WHERE 
            title ILIKE '%athlete%' OR title ILIKE '%exercise%' OR title ILIKE '%fitness%' OR title ILIKE '%performance%' OR title ILIKE '%training%' OR
            abstract ILIKE '%athlete%' OR abstract ILIKE '%exercise%' OR abstract ILIKE '%fitness%' OR abstract ILIKE '%performance%' OR abstract ILIKE '%training%'
        `
      ]);

      const conditionCategories = conditionsResult.filter(row => parseInt(row.count) > 0);
      const bodySystemCategories = bodySystemsResult.filter(row => parseInt(row.count) > 0);
      const lifeStageCategories = lifeStagesResult.filter(row => parseInt(row.count) > 0);

      console.log(`Found ${conditionCategories.length} condition categories with real data`);
      console.log(`Found ${bodySystemCategories.length} body system categories with real data`);
      console.log(`Found ${lifeStageCategories.length} life stage categories with real data`);

      const response = {
        data: {
          condition: conditionCategories.map(cat => ({ name: cat.name, count: cat.count })),
          bodySystem: bodySystemCategories.map(cat => ({ name: cat.name, count: cat.count })),
          lifeStage: lifeStageCategories.map(cat => ({ name: cat.name, count: cat.count }))
        }
      };

      console.log(`Returning ${response.data.condition.length} conditions, ${response.data.bodySystem.length} body systems, ${response.data.lifeStage.length} life stages`);

      res.json(response);
    } catch (error) {
      console.error('Error fetching consumer categories:', error);
      res.status(500).json({ error: 'Failed to fetch consumer categories', details: error.message });
    }
  });

  // Search endpoint
  app.get('/api/search', async (req, res) => {
    try {
      const { q: query = '', page = 1, pageSize = 20 } = req.query;

      console.log(`Search request: query="${query}", page=${page}, pageSize=${pageSize}`);

      if (!query || query.trim() === '') {
        return res.json({
          data: [],
          total: 0,
          page: parseInt(page as string),
          pageSize: parseInt(pageSize as string)
        });
      }

      const searchTerm = `%${query.trim()}%`;
      const offset = (parseInt(page as string) - 1) * parseInt(pageSize as string);

      // Search in title, abstract, and other relevant fields
      const searchQuery = sql`
        SELECT * FROM studies 
        WHERE 
          title ILIKE ${searchTerm} OR 
          abstract ILIKE ${searchTerm} OR 
          authors ILIKE ${searchTerm} OR 
          journal ILIKE ${searchTerm} OR 
          category ILIKE ${searchTerm} OR
          methods ILIKE ${searchTerm} OR
          results ILIKE ${searchTerm} OR
          conclusion ILIKE ${searchTerm}
        ORDER BY 
          CASE 
            WHEN title ILIKE ${searchTerm} THEN 1
            WHEN abstract ILIKE ${searchTerm} THEN 2
            ELSE 3
          END,
          created_at DESC
        LIMIT ${parseInt(pageSize as string)} 
        OFFSET ${offset}
      `;

      const results = await sql(searchQuery);

      // Get total count for pagination
      const countQuery = sql`
        SELECT COUNT(*) as total FROM studies 
        WHERE 
          title ILIKE ${searchTerm} OR 
          abstract ILIKE ${searchTerm} OR 
          authors ILIKE ${searchTerm} OR 
          journal ILIKE ${searchTerm} OR 
          category ILIKE ${searchTerm} OR
          methods ILIKE ${searchTerm} OR
          results ILIKE ${searchTerm} OR
          conclusion ILIKE ${searchTerm}
      `;

      const countResult = await sql(countQuery);
      const total = parseInt(countResult[0]?.total || '0');

      console.log(`Search results: found ${results.length} of ${total} total matches for "${query}"`);

      res.json({
        data: results,
        total: total,
        page: parseInt(page as string),
        pageSize: parseInt(pageSize as string)
      });
    } catch (error) {
      console.error("Search error:", error);
      res.status(500).json({ error: "Search failed" });
    }
  });

  // Categories endpoints
  app.get('/api/categories', async (req, res) => {
    try {
      console.log('Fetching all categories...');

      const [conditionsResult, bodySystemsResult, lifeStagesResult] = await Promise.all([
        // Health conditions
        sql`
          SELECT 
            'Arthritis & Inflammation' as name,
            COUNT(*) as count
          FROM studies 
          WHERE 
            title ILIKE '%arthritis%' OR title ILIKE '%inflammation%' OR
            abstract ILIKE '%arthritis%' OR abstract ILIKE '%inflammation%'
          UNION ALL
          SELECT 
            'Heart Disease & Hypertension' as name,
            COUNT(*) as count
          FROM studies 
          WHERE 
            title ILIKE '%heart%' OR title ILIKE '%cardiovascular%' OR title ILIKE '%hypertension%' OR
            abstract ILIKE '%heart%' OR abstract ILIKE '%cardiovascular%' OR abstract ILIKE '%hypertension%'
          UNION ALL
          SELECT 
            'Brain & Neurological Disorders' as name,
            COUNT(*) as count
          FROM studies 
          WHERE 
            title ILIKE '%brain%' OR title ILIKE '%neuro%' OR title ILIKE '%alzheimer%' OR title ILIKE '%parkinson%' OR
            abstract ILIKE '%brain%' OR abstract ILIKE '%neuro%' OR abstract ILIKE '%alzheimer%' OR abstract ILIKE '%parkinson%'
          UNION ALL
          SELECT 
            'Diabetes & Metabolic Health' as name,
            COUNT(*) as count
          FROM studies 
          WHERE 
            title ILIKE '%diabetes%' OR title ILIKE '%metabolic%' OR title ILIKE '%glucose%' OR
            abstract ILIKE '%diabetes%' OR abstract ILIKE '%metabolic%' OR abstract ILIKE '%glucose%'
        `,

        // Body systems
        sql`
          SELECT 
            'Cardiovascular System' as name,
            COUNT(*) as count
          FROM studies 
          WHERE 
            title ILIKE '%cardiovascular%' OR title ILIKE '%heart%' OR title ILIKE '%blood%' OR
            abstract ILIKE '%cardiovascular%' OR abstract ILIKE '%heart%' OR abstract ILIKE '%blood%'
          UNION ALL
          SELECT 
            'Nervous System' as name,
            COUNT(*) as count
          FROM studies 
          WHERE 
            title ILIKE '%nervous%' OR title ILIKE '%brain%' OR title ILIKE '%neural%' OR
            abstract ILIKE '%nervous%' OR abstract ILIKE '%brain%' OR abstract ILIKE '%neural%'
          UNION ALL
          SELECT 
            'Digestive System' as name,
            COUNT(*) as count
          FROM studies 
          WHERE 
            title ILIKE '%digestive%' OR title ILIKE '%gut%' OR title ILIKE '%liver%' OR title ILIKE '%intestin%' OR
            abstract ILIKE '%digestive%' OR abstract ILIKE '%gut%' OR abstract ILIKE '%liver%' OR abstract ILIKE '%intestin%'
        `,

        // Life stages
        sql`
          SELECT 
            'Adults' as name,
            COUNT(*) as count
          FROM studies 
          WHERE 
            title ILIKE '%adult%' OR abstract ILIKE '%adult%'
          UNION ALL
          SELECT 
            'Athletes' as name,
            COUNT(*) as count
          FROM studies 
          WHERE 
            title ILIKE '%athlete%' OR title ILIKE '%sport%' OR title ILIKE '%exercise%' OR
            abstract ILIKE '%athlete%' OR abstract ILIKE '%sport%' OR abstract ILIKE '%exercise%'
          UNION ALL
          SELECT 
            'Older Adults' as name,
            COUNT(*) as count
          FROM studies 
          WHERE 
            title ILIKE '%elderly%' OR title ILIKE '%aging%' OR title ILIKE '%older%' OR
            abstract ILIKE '%elderly%' OR abstract ILIKE '%aging%' OR abstract ILIKE '%older%'
        `
      ]);

      console.log('Categories fetched successfully');

      res.json({
        conditions: conditionsResult.filter(r => r.count > 0),
        bodySystems: bodySystemsResult.filter(r => r.count > 0),
        lifeStages: lifeStagesResult.filter(r => r.count > 0)
      });
    } catch (error) {
      console.error('Error fetching categories:', error);
      res.status(500).json({ error: 'Failed to fetch categories' });
    }
  });

  // Specific category endpoints
  app.get('/api/categories/condition', async (req, res) => {
    try {
      const result = await sql`
        SELECT 
          'Arthritis & Inflammation' as name,
          COUNT(*) as count
        FROM studies 
        WHERE 
          title ILIKE '%arthritis%' OR title ILIKE '%inflammation%' OR
          abstract ILIKE '%arthritis%' OR abstract ILIKE '%inflammation%'
        UNION ALL
        SELECT 
          'Heart Disease & Hypertension' as name,
          COUNT(*) as count
        FROM studies 
        WHERE 
          title ILIKE '%heart%' OR title ILIKE '%cardiovascular%' OR title ILIKE '%hypertension%' OR
          abstract ILIKE '%heart%' OR abstract ILIKE '%cardiovascular%' OR abstract ILIKE '%hypertension%'
        UNION ALL
        SELECT 
          'Brain & Neurological Disorders' as name,
          COUNT(*) as count
        FROM studies 
        WHERE 
          title ILIKE '%brain%' OR title ILIKE '%neuro%' OR title ILIKE '%alzheimer%' OR title ILIKE '%parkinson%' OR
          abstract ILIKE '%brain%' OR abstract ILIKE '%neuro%' OR abstract ILIKE '%alzheimer%' OR abstract ILIKE '%parkinson%'
        UNION ALL
        SELECT 
          'Diabetes & Metabolic Health' as name,
          COUNT(*) as count
        FROM studies 
        WHERE 
          title ILIKE '%diabetes%' OR title ILIKE '%metabolic%' OR title ILIKE '%glucose%' OR
          abstract ILIKE '%diabetes%' OR abstract ILIKE '%metabolic%' OR abstract ILIKE '%glucose%'
      `;

      res.json(result.filter(r => r.count > 0));
    } catch (error) {
      console.error('Error fetching condition categories:', error);
      res.status(500).json({ error: 'Failed to fetch condition categories' });
    }
  });

  app.get('/api/categories/body-system', async (req, res) => {
    try {
      const result = await sql`
        SELECT 
          'Cardiovascular System' as name,
          COUNT(*) as count
        FROM studies 
        WHERE 
          title ILIKE '%cardiovascular%' OR title ILIKE '%heart%' OR title ILIKE '%blood%' OR
          abstract ILIKE '%cardiovascular%' OR abstract ILIKE '%heart%' OR abstract ILIKE '%blood%'
        UNION ALL
        SELECT 
          'Nervous System' as name,
          COUNT(*) as count
        FROM studies 
        WHERE 
          title ILIKE '%nervous%' OR title ILIKE '%brain%' OR title ILIKE '%neural%' OR
          abstract ILIKE '%nervous%' OR abstract ILIKE '%brain%' OR abstract ILIKE '%neural%'
        UNION ALL
        SELECT 
          'Digestive System' as name,
          COUNT(*) as count
        FROM studies 
        WHERE 
          title ILIKE '%digestive%' OR title ILIKE '%gut%' OR title ILIKE '%liver%' OR title ILIKE '%intestin%' OR
          abstract ILIKE '%digestive%' OR abstract ILIKE '%gut%' OR abstract ILIKE '%liver%' OR abstract ILIKE '%intestin%'
      `;

      res.json(result.filter(r => r.count > 0));
    } catch (error) {
      console.error('Error fetching body system categories:', error);
      res.status(500).json({ error: 'Failed to fetch body system categories' });
    }
  });

  app.get('/api/categories/life-stage', async (req, res) => {
    try {
      const result = await sql`
        SELECT 
          'Adults' as name,
          COUNT(*) as count
        FROM studies 
        WHERE 
          title ILIKE '%adult%' OR abstract ILIKE '%adult%'
        UNION ALL
        SELECT 
          'Athletes' as name,
          COUNT(*) as count
        FROM studies 
        WHERE 
          title ILIKE '%athlete%' OR title ILIKE '%sport%' OR title ILIKE '%exercise%' OR
          abstract ILIKE '%athlete%' OR abstract ILIKE '%sport%' OR abstract ILIKE '%exercise%'
        UNION ALL
        SELECT 
          'Older Adults' as name,
          COUNT(*) as count
        FROM studies 
        WHERE 
          title ILIKE '%elderly%' OR title ILIKE '%aging%' OR title ILIKE '%older%' OR
          abstract ILIKE '%elderly%' OR abstract ILIKE '%aging%' OR abstract ILIKE '%older%'
      `;

      res.json(result.filter(r => r.count > 0));
    } catch (error) {
      console.error('Error fetching life stage categories:', error);
      res.status(500).json({ error: 'Failed to fetch life stage categories' });
    }
  });

  // Search endpoint (POST version for compatibility)
  app.post('/api/search', async (req, res) => {
    try {
      const { query = '', page = 1, pageSize = 20 } = req.body;

      console.log(`POST Search request: query="${query}", page=${page}, pageSize=${pageSize}`);

      if (!query || query.trim() === '') {
        return res.json({
          data: [],
          total: 0,
          page: parseInt(page),
          pageSize: parseInt(pageSize)
        });
      }

      const searchTerm = `%${query.trim()}%`;
      const offset = (parseInt(page) - 1) * parseInt(pageSize);

      // Search in title, abstract, and other relevant fields
      const searchQuery = sql`
        SELECT * FROM studies 
        WHERE 
          title ILIKE ${searchTerm} OR 
          abstract ILIKE ${searchTerm} OR 
          authors ILIKE ${searchTerm} OR 
          journal ILIKE ${searchTerm} OR 
          category ILIKE ${searchTerm} OR
          methods ILIKE ${searchTerm} OR
          results ILIKE ${searchTerm} OR
          conclusion ILIKE ${searchTerm}
        ORDER BY 
          CASE 
            WHEN title ILIKE ${searchTerm} THEN 1
            WHEN abstract ILIKE ${searchTerm} THEN 2
            ELSE 3
          END,
          created_at DESC
        LIMIT ${parseInt(pageSize)} 
        OFFSET ${offset}
      `;

      const results = await sql(searchQuery);

      // Get total count for pagination
      const countQuery = sql`
        SELECT COUNT(*) as total FROM studies 
        WHERE 
          title ILIKE ${searchTerm} OR 
          abstract ILIKE ${searchTerm} OR 
          authors ILIKE ${searchTerm} OR 
          journal ILIKE ${searchTerm} OR 
          category ILIKE ${searchTerm} OR
          methods ILIKE ${searchTerm} OR
          results ILIKE ${searchTerm} OR
          conclusion ILIKE ${searchTerm}
      `;

      const countResult = await sql(countQuery);
      const total = parseInt(countResult[0]?.total || '0');

      console.log(`POST Search results: found ${results.length} of ${total} total matches for "${query}"`);

      res.json({
        data: results,
        total: total,
        page: parseInt(page),
        pageSize: parseInt(pageSize)
      });
    } catch (error) {
      console.error("POST Search error:", error);
      res.status(500).json({ error: "Search failed" });
    }
  });

  console.log('✓ Essential API routes configured');

  // Health check
  app.get('/health', (req, res) => {
    res.json({ status: 'healthy', timestamp: new Date().toISOString() });
  });

  // Root API info
  app.get('/api', (req, res) => {
    res.json({
      name: 'Hydrogen Research Platform API',
      version: '1.0.0',
      status: 'running',
      endpoints: ['/api/studies', '/api/search', '/api/categories', '/health']
    });
  });

  // SPA fallback - serve index.html for all non-API routes
  app.get('*', (req, res) => {
    const distIndexPath = path.join(process.cwd(), 'dist', 'index.html');
    const publicIndexPath = path.join(process.cwd(), 'public', 'index.html');

    // Try dist/index.html first (built version), then fallback to public
    if (existsSync(distIndexPath)) {
      res.sendFile(distIndexPath);
    } else {
      res.sendFile(publicIndexPath);
    }
  });

  // Error handling
  app.use((error: any, req: any, res: any, next: any) => {
    console.error('Production server error:', error);

    if (res.headersSent) {
      return next(error);
    }

    res.status(500).json({
      error: 'Internal server error',
      timestamp: new Date().toISOString()
    });
  });

  const port = parseInt(process.env.PORT || '5000');
  const server = createServer(app);

  return new Promise((resolve, reject) => {
    server.listen(port, '0.0.0.0', () => {
      const duration = Date.now() - startTime;
      console.log(`✓ Production server running on port ${port} (${duration}ms startup)`);
      resolve({ app, server });
    });

    server.on('error', reject);
  });
}

// Start production server if this file is run directly
if (process.argv[1] === __filename) {
  createProductionServer().catch(console.error);
}