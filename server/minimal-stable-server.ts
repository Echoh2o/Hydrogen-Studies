/**
 * Minimal Stable Server - Maximum performance with minimal complexity
 */

import express from "express";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { Pool } from "@neondatabase/serverless";
import { fastSearch, fastCategoryCounts, fastTrendingSearches, initializeMinimalPerformance, getSimpleStats } from "./minimal-performance-core";
import { db } from "./db";
import { sql } from "drizzle-orm";
import { performanceCache, memoizedQueries, optimizedSearch, connectionMonitor } from "./database-performance-optimizer";
import { qualityMonitor } from "./database-quality-monitor";
import { globalRateLimit, authRateLimit, searchRateLimit, securityHeaders, validateInput, preventSQLInjection, validateEnvironment, securityMonitor } from "./security-hardening";
import { reliabilityMonitor, performanceTracker } from "./reliability-stability-monitor";
import { setupVite } from "./vite";
import { createServer } from "http";
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function createMinimalServer() {
  const app = express();
  
  // Configure trust proxy for rate limiting
  app.set('trust proxy', 1);
  
  // Validate environment before starting
  const envErrors = validateEnvironment();
  if (envErrors.length > 0) {
    console.warn('Environment validation warnings:', envErrors);
  }

  // Security middleware
  app.use(securityHeaders);
  app.use(globalRateLimit);
  app.use(securityMonitor.middleware());
  app.use(validateInput);
  app.use(preventSQLInjection);
  
  // Performance tracking
  app.use(performanceTracker(reliabilityMonitor));
  
  // Essential middleware
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: false }));

  // Session with minimal configuration
  if (process.env.DATABASE_URL) {
    const pgStore = connectPg(session);
    app.use(session({
      store: new pgStore({
        conString: process.env.DATABASE_URL,
        createTableIfMissing: true,
      }),
      secret: process.env.SESSION_SECRET || 'hydrogen-minimal-secret',
      resave: false,
      saveUninitialized: false,
      cookie: { maxAge: 24 * 60 * 60 * 1000 } // 24 hours
    }));
  }

  // Static files
  const uploadsDir = path.join(__dirname, '..', 'uploads');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
  app.use('/uploads', express.static(uploadsDir));

  // Performance tracking middleware
  app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
      const duration = Date.now() - start;
      if (req.path.startsWith('/api') && duration > 300) {
        console.log(`${req.method} ${req.path} ${res.statusCode} in ${duration}ms (SLOW)`);
      }
    });
    next();
  });

  // Core API endpoints with minimal implementation
  app.get('/api/search/enhanced', async (req, res) => {
    try {
      const query = req.query.q as string || '';
      const page = parseInt(req.query.page as string) || 1;
      const pageSize = Math.min(parseInt(req.query.pageSize as string) || 20, 50);
      const filters = { condition: req.query.condition as string };
      
      const result = await fastSearch(query, filters, page, pageSize);
      res.json(result);
    } catch (error) {
      console.error('Search endpoint error:', error);
      res.status(500).json({ error: 'Search failed' });
    }
  });

  app.get('/api/consumer-categories/counts', async (req, res) => {
    try {
      const result = await fastCategoryCounts();
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: 'Category counts failed' });
    }
  });

  app.get('/api/categories', async (req, res) => {
    try {
      const result = await db.execute(sql`
        SELECT DISTINCT consumer_categories as name, COUNT(*) as count 
        FROM studies 
        WHERE consumer_categories IS NOT NULL AND consumer_categories != '' 
        GROUP BY consumer_categories 
        ORDER BY count DESC
      `);
      
      const categories = (result as any).rows || [];
      res.json(categories);
    } catch (error) {
      res.status(500).json({ error: 'Categories retrieval failed' });
    }
  });

  app.get('/api/consumer-categories/studies', async (req, res) => {
    try {
      const { model, category } = req.query;
      
      if (!model || !category) {
        return res.status(400).json({
          success: false,
          error: 'Missing required parameters'
        });
      }

      const categoryName = category as string;
      
      const result = await db.execute(sql`
        SELECT id, title, abstract, authors, journal, journal_publish_date as "publishDate",
               doi, consumer_categories, array_to_string(keywords, ', ') as keywords
        FROM studies 
        WHERE consumer_categories = ${categoryName}
        ORDER BY journal_publish_date DESC NULLS LAST
        LIMIT 50
      `);

      const studies = (result as any).rows || [];
      
      res.json({
        success: true,
        data: studies
      });
    } catch (error) {
      console.error('Error fetching studies by category:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch studies'
      });
    }
  });

  app.get('/api/search/enhanced', async (req, res) => {
    try {
      const { query, limit = 20, offset = 0 } = req.query;
      const limitInt = Math.min(parseInt(limit as string) || 20, 100);
      const offsetInt = parseInt(offset as string) || 0;
      
      if (!query || typeof query !== 'string' || query.trim().length === 0) {
        // Return recent studies when no query
        const result = await db.execute(sql`
          SELECT id, title, abstract, authors, journal, journal_publish_date as "publishDate",
                 doi, consumer_categories, array_to_string(keywords, ', ') as keywords
          FROM studies 
          ORDER BY id DESC 
          LIMIT ${limitInt} OFFSET ${offsetInt}
        `);
        
        const countResult = await db.execute(sql`SELECT COUNT(*) as total FROM studies`);
        
        return res.json({
          data: (result as any).rows.map((study: any) => ({
            id: study.id,
            title: study.title,
            abstract: study.abstract,
            authors: study.authors,
            journal: study.journal,
            publishDate: study.publishDate,
            category: study.consumer_categories,
            viewCount: 0,
            relevanceScore: 0.5,
            tags: [],
            relatedStudies: []
          })),
          total: parseInt((countResult as any).rows[0]?.total) || 0,
          facets: { tags: [], journals: [], years: [] },
          suggestions: [],
          trending: []
        });
      }

      const searchTerm = query.trim().toLowerCase();
      
      // Execute search with proper filtering
      const searchResult = await db.execute(sql`
        SELECT id, title, abstract, authors, journal, journal_publish_date as "publishDate",
               doi, consumer_categories, array_to_string(keywords, ', ') as keywords
        FROM studies 
        WHERE LOWER(title) LIKE ${`%${searchTerm}%`} 
           OR LOWER(abstract) LIKE ${`%${searchTerm}%`}
           OR LOWER(authors) LIKE ${`%${searchTerm}%`}
           OR LOWER(consumer_categories) LIKE ${`%${searchTerm}%`}
           OR array_to_string(keywords, ' ') ILIKE ${`%${searchTerm}%`}
        ORDER BY 
          CASE 
            WHEN LOWER(title) LIKE ${`%${searchTerm}%`} THEN 1
            WHEN LOWER(abstract) LIKE ${`%${searchTerm}%`} THEN 2
            ELSE 3
          END,
          journal_publish_date DESC NULLS LAST
        LIMIT ${limitInt} OFFSET ${offsetInt}
      `);

      const countResult = await db.execute(sql`
        SELECT COUNT(*) as total FROM studies 
        WHERE LOWER(title) LIKE ${`%${searchTerm}%`} 
           OR LOWER(abstract) LIKE ${`%${searchTerm}%`}
           OR LOWER(authors) LIKE ${`%${searchTerm}%`}
           OR LOWER(consumer_categories) LIKE ${`%${searchTerm}%`}
           OR array_to_string(keywords, ' ') ILIKE ${`%${searchTerm}%`}
      `);

      const mappedResults = (searchResult as any).rows.map((study: any) => ({
        id: study.id,
        title: study.title,
        abstract: study.abstract,
        authors: study.authors,
        journal: study.journal,
        publishDate: study.publishDate,
        category: study.consumer_categories,
        viewCount: 0,
        relevanceScore: 0.9,
        tags: [],
        relatedStudies: []
      }));

      res.json({
        data: mappedResults,
        total: parseInt((countResult as any).rows[0]?.total) || 0,
        facets: { tags: [], journals: [], years: [] },
        suggestions: [],
        trending: []
      });

    } catch (error) {
      console.error('Search error:', error);
      res.status(500).json({ error: 'Search failed' });
    }
  });

  app.get('/api/search/trending', async (req, res) => {
    try {
      const trending = await fastTrendingSearches();
      res.json(trending);
    } catch (error) {
      res.status(500).json({ error: 'Trending searches failed' });
    }
  });

  app.get('/api/studies', async (req, res) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const pageSize = Math.min(parseInt(req.query.pageSize as string) || 20, 50);
      const query = req.query.query as string || '';
      const category = req.query.category as string || '';
      const keyword = req.query.keyword as string || '';
      const author = req.query.author as string || '';
      
      // Use the existing search functionality
      const filters = { condition: category };
      const result = await fastSearch(query, filters, page, pageSize);

      res.json(result);
    } catch (error) {
      console.error('Studies endpoint error:', error);
      res.status(500).json({ error: 'Studies retrieval failed' });
    }
  });

  app.get('/api/studies/latest', async (req, res) => {
    try {
      const result = await db.execute(sql`
        SELECT id, title, abstract, authors, journal, journal_publish_date as "publishDate",
               doi, consumer_categories, array_to_string(keywords, ', ') as keywords
        FROM studies 
        ORDER BY journal_publish_date DESC NULLS LAST
        LIMIT 10
      `);

      const studies = (result as any).rows || [];
      res.json(studies);
    } catch (error) {
      res.status(500).json({ error: 'Latest studies retrieval failed' });
    }
  });

  app.get('/api/study-by-slug/:slug', async (req, res) => {
    try {
      const slug = req.params.slug;
      const result = await db.execute(sql`
        SELECT * FROM studies WHERE slug = ${slug}
      `);

      const study = (result as any).rows[0];
      if (!study) {
        return res.status(404).json({ error: 'Study not found' });
      }

      res.json(study);
    } catch (error) {
      res.status(500).json({ error: 'Study retrieval failed' });
    }
  });

  app.get('/api/studies/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: 'Invalid study ID' });
      }

      const result = await db.execute(sql`
        SELECT * FROM studies WHERE id = ${id}
      `);

      const study = (result as any).rows[0];
      if (!study) {
        return res.status(404).json({ error: 'Study not found' });
      }

      res.json(study);
    } catch (error) {
      res.status(500).json({ error: 'Study retrieval failed' });
    }
  });

  // Chat API endpoint with OpenAI integration
  app.post('/api/chat', async (req, res) => {
    try {
      const { query } = req.body;
      
      if (!query) {
        return res.status(400).json({
          success: false,
          error: 'Query is required'
        });
      }

      // Search for relevant studies using direct database query
      const searchTerms = query.toLowerCase().split(/\s+/).filter((term: string) => term.length > 2);
      
      let studies: any[] = [];
      if (searchTerms.length > 0) {
        const searchTerm = searchTerms[0]; // Use first significant term
        const result = await db.execute(sql`
          SELECT id, title, abstract, authors, journal, doi, consumer_categories, 
                 array_to_string(keywords, ', ') as keywords
          FROM studies 
          WHERE LOWER(title) LIKE ${`%${searchTerm}%`} 
             OR LOWER(abstract) LIKE ${`%${searchTerm}%`}
             OR LOWER(consumer_categories) LIKE ${`%${searchTerm}%`}
             OR array_to_string(keywords, ' ') ILIKE ${`%${searchTerm}%`}
          ORDER BY 
            CASE WHEN LOWER(title) LIKE ${`%${searchTerm}%`} THEN 1 ELSE 2 END,
            journal_publish_date DESC NULLS LAST
          LIMIT 10
        `);
        
        studies = (result as any).rows || [];
      }

      let aiResponse = '';
      
      // Generate AI response using OpenAI if API key is available
      if (process.env.OPENAI_API_KEY) {
        try {
          const OpenAI = (await import('openai')).default;
          const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

          const studyContext = studies.slice(0, 5).map(study => 
            `Title: ${study.title}\nAbstract: ${study.abstract || 'No abstract available'}\nJournal: ${study.journal || 'Unknown journal'}`
          ).join('\n\n');

          const response = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [
              {
                role: "system",
                content: "You are an expert hydrogen research assistant. Answer questions based on the provided research studies. Be scientific but accessible. Keep responses under 200 words."
              },
              {
                role: "user",
                content: `Question: ${query}\n\nRelevant Studies:\n${studyContext}\n\nPlease provide a helpful answer based on these hydrogen research studies.`
              }
            ],
            max_tokens: 300,
            temperature: 0.7
          });

          aiResponse = response.choices[0]?.message?.content || 'Unable to generate AI response';
        } catch (openaiError) {
          console.error('OpenAI API error:', openaiError);
          aiResponse = `Based on our database of hydrogen research studies, I found ${studies.length} relevant studies related to "${query}". ${studies.length > 0 ? 'These studies explore various aspects of hydrogen therapy and its health benefits.' : 'Try searching for more specific terms like "hydrogen water", "antioxidant effects", or "cardiovascular benefits".'}`;
        }
      } else {
        aiResponse = `Based on our database of hydrogen research studies, I found ${studies.length} relevant studies related to "${query}". ${studies.length > 0 ? 'These studies explore various aspects of hydrogen therapy and its health benefits.' : 'Try searching for more specific terms like "hydrogen water", "antioxidant effects", or "cardiovascular benefits".'}`;
      }

      const response = {
        answer: aiResponse,
        sources: studies.slice(0, 5),
        relatedQuestions: [
          "What are the antioxidant effects of hydrogen water?",
          "How does hydrogen help reduce inflammation?",
          "What cardiovascular benefits does hydrogen provide?",
          "Are there studies on hydrogen for athletic performance?",
          "What are the different ways to use hydrogen therapy?"
        ],
        conversationId: Math.floor(Math.random() * 1000000)
      };

      res.json({
        success: true,
        data: response
      });

    } catch (error) {
      console.error('Chat API error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to process chat request'
      });
    }
  });

  // Blog API endpoints
  app.get('/api/blogs', async (req, res) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const pageSize = Math.min(parseInt(req.query.pageSize as string) || 20, 50);
      const offset = (page - 1) * pageSize;

      const result = await db.execute(sql`
        SELECT b.*, s.title as study_title 
        FROM blog_articles b
        LEFT JOIN studies s ON b.study_id = s.id
        ORDER BY b.created_at DESC
        LIMIT ${pageSize} OFFSET ${offset}
      `);

      const countResult = await db.execute(sql`SELECT COUNT(*) as total FROM blog_articles`);
      const total = (countResult as any).rows[0]?.total || 0;

      res.json({
        data: (result as any).rows || [],
        total: parseInt(total),
        page,
        pageSize
      });
    } catch (error) {
      console.error('Blog API error:', error);
      res.status(500).json({ error: 'Failed to fetch blogs' });
    }
  });

  app.get('/api/studies/:id/blogs', async (req, res) => {
    try {
      const studyId = parseInt(req.params.id);
      if (isNaN(studyId)) {
        return res.status(400).json({ error: 'Invalid study ID' });
      }

      const result = await db.execute(sql`
        SELECT * FROM blog_articles 
        WHERE study_id = ${studyId}
        ORDER BY created_at DESC
      `);

      res.json((result as any).rows || []);
    } catch (error) {
      console.error('Study blogs API error:', error);
      res.status(500).json({ error: 'Failed to fetch study blogs' });
    }
  });

  // Study enhancement endpoints
  app.post('/api/content-enrichment/study/:id', async (req, res) => {
    try {
      const studyId = parseInt(req.params.id);
      if (isNaN(studyId)) {
        return res.status(400).json({ error: 'Invalid study ID' });
      }

      // Simplified enhancement response
      res.json({
        success: true,
        studyId,
        message: 'Study enhancement feature requires API keys configuration',
        updates: {}
      });
    } catch (error) {
      console.error('Enhancement API error:', error);
      res.status(500).json({ error: 'Failed to enhance study' });
    }
  });

  // Admin API endpoints
  app.get('/api/admin/tagging/stats', async (req, res) => {
    try {
      const studyCount = await db.execute(sql`SELECT COUNT(*) as total FROM studies`);
      const total = (studyCount as any).rows[0]?.total || 0;

      res.json({
        totalStudies: parseInt(total),
        totalStudyTags: 0,
        totalUniqueTags: 0,
        averageTagsPerStudy: 0,
        tagCompletionRate: 0,
        lastProcessed: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch tagging stats' });
    }
  });

  app.get('/api/admin/duplicate-status', async (req, res) => {
    try {
      const studyCount = await db.execute(sql`SELECT COUNT(*) as total FROM studies`);
      const total = (studyCount as any).rows[0]?.total || 0;

      res.json({
        totalStudies: parseInt(total),
        duplicateGroups: 0,
        totalDuplicates: 0,
        sampleDuplicates: []
      });
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch duplicate status' });
    }
  });

  app.get('/api/stats/dashboard', async (req, res) => {
    try {
      const studyCount = await db.execute(sql`SELECT COUNT(*) as total FROM studies`);
      const blogCount = await db.execute(sql`SELECT COUNT(*) as total FROM blog_articles`);
      
      res.json({
        totalStudies: parseInt((studyCount as any).rows[0]?.total || 0),
        totalBlogs: parseInt((blogCount as any).rows[0]?.total || 0),
        draftBlogs: 0,
        publishedBlogs: parseInt((blogCount as any).rows[0]?.total || 0)
      });
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch dashboard stats' });
    }
  });

  // Health check endpoint
  app.get('/health', async (req, res) => {
    try {
      const start = Date.now();
      await db.execute(sql`SELECT 1`);
      const dbLatency = Date.now() - start;
      
      const stats = getSimpleStats();
      
      res.json({
        status: 'healthy',
        database: { latency: `${dbLatency}ms` },
        ...stats
      });
    } catch (error) {
      res.status(500).json({ status: 'unhealthy' });
    }
  });

  // Database quality monitoring endpoint
  app.get('/api/admin/database/quality', async (req, res) => {
    try {
      const metrics = await qualityMonitor.runQualityChecks();
      const report = await qualityMonitor.generateQualityReport();
      
      res.json({
        success: true,
        metrics,
        report,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Database quality check failed:', error);
      res.status(500).json({ error: 'Quality check failed' });
    }
  });

  // Database auto-repair endpoint
  app.post('/api/admin/database/repair', async (req, res) => {
    try {
      const result = await qualityMonitor.autoRepairIssues();
      res.json({
        success: true,
        ...result,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Database repair failed:', error);
      res.status(500).json({ error: 'Database repair failed' });
    }
  });

  // System reliability monitoring
  app.get('/api/admin/system/health', async (req, res) => {
    try {
      const healthCheck = await reliabilityMonitor.performHealthCheck();
      res.json({
        success: true,
        ...healthCheck
      });
    } catch (error) {
      console.error('Health check failed:', error);
      res.status(500).json({ error: 'Health check failed' });
    }
  });

  // System auto-recovery endpoint
  app.post('/api/admin/system/recover', async (req, res) => {
    try {
      const recovery = await reliabilityMonitor.autoRecovery();
      res.json({
        success: true,
        ...recovery,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Auto-recovery failed:', error);
      res.status(500).json({ error: 'Auto-recovery failed' });
    }
  });

  // System stability report
  app.get('/api/admin/system/stability', async (req, res) => {
    try {
      const report = reliabilityMonitor.generateStabilityReport();
      const metrics = reliabilityMonitor.getMetrics();
      res.json({
        success: true,
        report,
        metrics,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Stability report failed:', error);
      res.status(500).json({ error: 'Stability report failed' });
    }
  });

  // Error handling
  app.use((error: any, req: any, res: any, next: any) => {
    console.error('Server error:', error.message);
    res.status(500).json({ error: 'Internal server error' });
  });

  return app;
}

// Minimal startup with essential optimizations only
export async function startMinimalServer() {
  console.log('Starting minimal stable server...');
  const startTime = Date.now();

  try {
    // Only run essential database optimizations
    await initializeMinimalPerformance();
    
    // Create and start server
    const app = await createMinimalServer();
    const port = parseInt(process.env.PORT || '5000');

    // Create HTTP server for Vite integration
    const server = createServer(app);
    
    // Setup Vite for frontend serving (after all API routes are defined)
    await setupVite(app, server);

    server.listen(port, '0.0.0.0', () => {
      const duration = Date.now() - startTime;
      console.log(`✓ Minimal server running on port ${port} (${duration}ms startup)`);
    });

    return { app, server };
  } catch (error) {
    console.error('Minimal server startup failed:', error);
    throw error;
  }
}