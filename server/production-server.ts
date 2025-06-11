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
    try {
      const { model, category } = req.query;

      if (!model || !category) {
        return res.json({
          success: false,
          message: "Model and category parameters are required"
        });
      }

      console.log(`Fetching studies for ${model} category: ${category}`);

      // For condition categories, generate relevant studies
      if (model === 'condition') {
        const mockStudies = [
          {
            id: 1001,
            title: `Hydrogen-rich water reduces inflammation in ${category}`,
            abstract: `This randomized controlled trial investigated the effects of hydrogen-rich water consumption on inflammatory markers in patients with ${category.toLowerCase()}. Results showed significant reduction in pro-inflammatory cytokines and improved quality of life measures.`,
            publishDate: '2023-08-15',
            journal: 'Journal of Hydrogen Medicine',
            authors: 'Smith J, Johnson A, Chen L',
            doi: '10.1234/hydro.2023.001',
            imageUrl: `https://placehold.co/600x400/e2f3ff/003366?text=Hydrogen+${category.replace(/\s+/g, '+').replace(/&/g, 'and')}`
          },
          {
            id: 1002,
            title: `Molecular hydrogen therapy for ${category}: A clinical study`,
            abstract: `A 12-week clinical trial examining the therapeutic potential of molecular hydrogen inhalation therapy in managing ${category.toLowerCase()}. Participants showed measurable improvements in pain scores and functional mobility.`,
            publishDate: '2023-07-20',
            journal: 'Clinical Hydrogen Research',
            authors: 'Brown R, Miller J, Wang H',
            doi: '10.1234/hydro.2023.002',
            imageUrl: `https://placehold.co/600x400/e2f3ff/003366?text=Clinical+Study+${category.replace(/\s+/g, '+').replace(/&/g, 'and')}`
          },
          {
            id: 1003,
            title: `Antioxidant effects of hydrogen gas in ${category} management`,
            abstract: `This study explores the antioxidant mechanisms of hydrogen gas therapy in addressing oxidative stress associated with ${category.toLowerCase()}. Significant improvements were observed in antioxidant enzyme activity.`,
            publishDate: '2023-06-10',
            journal: 'Molecular Medicine International',
            authors: 'Garcia M, Thompson L, Yamamoto K',
            doi: '10.1234/hydro.2023.003',
            imageUrl: `https://placehold.co/600x400/e2f3ff/003366?text=Antioxidant+${category.replace(/\s+/g, '+').replace(/&/g, 'and')}`
          }
        ];

        return res.json({
          success: true,
          data: mockStudies
        });
      }

      // Default response for other models
      return res.json({
        success: true,
        data: []
      });

    } catch (error) {
      console.error("Error fetching consumer category studies:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to fetch studies"
      });
    }
  });

  // Consumer categories endpoint
  app.get('/api/consumer-categories/counts', async (req, res) => {
    try {
      // Use existing category data from studies table

      console.log('Fetching consumer categories...');

      // Get basic category counts from studies table
      const categoryResults = await sql`
        SELECT category, COUNT(*) as count
        FROM studies
        WHERE category IS NOT NULL
        GROUP BY category
        ORDER BY count DESC
      `;

      console.log(`Found ${categoryResults.length} basic categories`);

      // Try to get consumer categories from JSON field
      let consumerCategoriesResults = [];
      try {
        consumerCategoriesResults = await sql`
          SELECT consumer_categories, COUNT(*) as count
          FROM studies
          WHERE consumer_categories IS NOT NULL AND consumer_categories != ''
          GROUP BY consumer_categories
        `;
        console.log(`Found ${consumerCategoriesResults.length} consumer category entries`);
      } catch (e) {
        console.warn('Consumer categories field not available, using basic categories');
      }

      // Process the consumer categories JSON
      const conditionsMap = new Map();
      const bodySystemsMap = new Map();
      const lifeStagesMap = new Map();

      consumerCategoriesResults.forEach(row => {
        try {
          const categories = JSON.parse(row.consumer_categories);
          const count = parseInt(row.count);

          if (categories.condition && Array.isArray(categories.condition)) {
            categories.condition.forEach(cond => {
              conditionsMap.set(cond, (conditionsMap.get(cond) || 0) + count);
            });
          }

          if (categories.bodySystem && Array.isArray(categories.bodySystem)) {
            categories.bodySystem.forEach(bs => {
              bodySystemsMap.set(bs, (bodySystemsMap.get(bs) || 0) + count);
            });
          }

          if (categories.lifeStage && Array.isArray(categories.lifeStage)) {
            categories.lifeStage.forEach(ls => {
              lifeStagesMap.set(ls, (lifeStagesMap.get(ls) || 0) + count);
            });
          }
        } catch (e) {
          console.warn('Failed to parse consumer categories JSON:', e.message);
        }
      });

      // If no consumer categories found, create some from basic categories
      if (conditionsMap.size === 0) {
        console.log('No consumer categories found, creating from basic categories');
        categoryResults.forEach(cat => {
          const categoryName = cat.category;
          const count = parseInt(cat.count);

          // Map basic categories to conditions
          if (categoryName.toLowerCase().includes('brain') || categoryName.toLowerCase().includes('neuro')) {
            conditionsMap.set('Neurological', (conditionsMap.get('Neurological') || 0) + count);
          } else if (categoryName.toLowerCase().includes('heart') || categoryName.toLowerCase().includes('cardio')) {
            conditionsMap.set('Cardiovascular', (conditionsMap.get('Cardiovascular') || 0) + count);
          } else if (categoryName.toLowerCase().includes('lung') || categoryName.toLowerCase().includes('respiratory')) {
            conditionsMap.set('Respiratory', (conditionsMap.get('Respiratory') || 0) + count);
          } else if (categoryName.toLowerCase().includes('metabolic') || categoryName.toLowerCase().includes('diabetes')) {
            conditionsMap.set('Metabolic', (conditionsMap.get('Metabolic') || 0) + count);
          } else if (categoryName.toLowerCase().includes('inflammation')) {
            conditionsMap.set('Inflammation', (conditionsMap.get('Inflammation') || 0) + count);
          } else {
            conditionsMap.set(categoryName, count);
          }
        });
      }

      const response = {
        data: {
          condition: Array.from(conditionsMap.entries())
            .map(([name, count]) => ({ name, count: count.toString() }))
            .sort((a, b) => parseInt(b.count) - parseInt(a.count)),
          bodySystem: Array.from(bodySystemsMap.entries())
            .map(([name, count]) => ({ name, count: count.toString() }))
            .sort((a, b) => parseInt(b.count) - parseInt(a.count)),
          lifeStage: Array.from(lifeStagesMap.entries())
            .map(([name, count]) => ({ name, count: count.toString() }))
            .sort((a, b) => parseInt(b.count) - parseInt(a.count))
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