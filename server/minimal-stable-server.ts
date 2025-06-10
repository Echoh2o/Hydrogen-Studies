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

// Global image generation function
async function generateStudyImageWithOpenAI(study: any): Promise<void> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OpenAI API key not available');
  }

  const prompt = `Professional medical illustration showing hydrogen therapy mechanisms for ${study.title}. Show molecular hydrogen (H2) interacting with cells, reducing oxidative stress, and providing therapeutic benefits. Medical research style, clean background, professional appearance, scientific accuracy.`;

  try {
    const response = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'dall-e-3',
        prompt: prompt.substring(0, 1000),
        n: 1,
        size: '1024x1024',
        quality: 'standard',
        style: 'natural'
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const imageUrl = data.data[0]?.url;
    
    if (!imageUrl) {
      throw new Error('No image URL in response');
    }

    const imageResponse = await fetch(imageUrl);
    const buffer = await imageResponse.arrayBuffer();
    
    const uploadsDir = path.join(process.cwd(), 'uploads', 'study-images');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    
    const filename = `study-${study.id}-${Date.now()}.png`;
    const localPath = path.join(uploadsDir, filename);
    const webPath = `/uploads/study-images/${filename}`;
    
    fs.writeFileSync(localPath, Buffer.from(buffer));
    
    const { db } = await import('./db');
    const { sql } = await import('drizzle-orm');
    
    await db.execute(sql`
      UPDATE studies 
      SET image_url = ${webPath},
          auto_generated_image = true
      WHERE id = ${study.id}
    `);

    console.log(`✓ Generated image for study ${study.id}: ${study.title}`);
  } catch (error) {
    console.error(`✗ Failed to generate image for study ${study.id}:`, error);
    throw error;
  }
}



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

  // Image generation function
  async function generateStudyImageWithOpenAI(study: any): Promise<void> {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OpenAI API key not available');
    }

    const prompt = `Professional medical illustration showing hydrogen therapy mechanisms for ${study.title}. Show molecular hydrogen (H2) interacting with cells, reducing oxidative stress, and providing therapeutic benefits. Medical research style, clean background, professional appearance, scientific accuracy.`;

    try {
      const response = await fetch('https://api.openai.com/v1/images/generations', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'dall-e-3',
          prompt: prompt.substring(0, 1000),
          n: 1,
          size: '1024x1024',
          quality: 'standard',
          style: 'natural'
        }),
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status}`);
      }

      const data = await response.json();
      const imageUrl = data.data[0]?.url;
      
      if (!imageUrl) {
        throw new Error('No image URL in response');
      }

      const imageResponse = await fetch(imageUrl);
      const buffer = await imageResponse.arrayBuffer();
      
      const uploadsDir = path.join(process.cwd(), 'uploads', 'study-images');
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }
      
      const filename = `study-${study.id}-${Date.now()}.png`;
      const localPath = path.join(uploadsDir, filename);
      const webPath = `/uploads/study-images/${filename}`;
      
      fs.writeFileSync(localPath, Buffer.from(buffer));
      
      await db.execute(sql`
        UPDATE studies 
        SET image_url = ${webPath},
            auto_generated_image = true,
            updated_at = NOW()
        WHERE id = ${study.id}
      `);

      console.log(`✓ Generated image for study ${study.id}: ${study.title}`);
    } catch (error) {
      console.error(`✗ Failed to generate image for study ${study.id}:`, error);
      throw error;
    }
  }

  // Core API endpoints with minimal implementation
  app.get('/api/search/enhanced', async (req, res) => {
    try {
      // Accept both 'query' and 'q' parameters for compatibility
      const query = (req.query.query as string) || (req.query.q as string) || '';
      const limit = parseInt(req.query.limit as string) || 20;
      const page = parseInt(req.query.page as string) || 1;
      const pageSize = Math.min(limit, 50);
      const filters = { condition: req.query.condition as string };
      
      // Debug logging (can be disabled in production)
      if (process.env.NODE_ENV === 'development') {
        console.log('Search query:', query, 'Results limit:', pageSize);
      }
      
      const result = await fastSearch(query, filters, page, pageSize);
      
      // Format response to match expected structure with relevance scores
      const formattedResult = {
        data: (result.data || []).map((study: any) => {
          // Calculate relevance score based on search term matches
          let relevanceScore = 50; // Default score
          
          if (query && query.trim()) {
            const searchTerm = query.toLowerCase();
            const title = (study.title || '').toLowerCase();
            const abstract = (study.abstract || '').toLowerCase();
            const keywords = (study.keywords || '').toLowerCase();
            
            // Use database score if available, otherwise calculate
            if (study.relevance_score) {
              relevanceScore = study.relevance_score;
            } else {
              // Calculate based on matches
              const titleMatch = title.includes(searchTerm);
              const abstractMatch = abstract.includes(searchTerm);
              const keywordMatch = keywords.includes(searchTerm);
              
              if (titleMatch && abstractMatch) relevanceScore = 95;
              else if (titleMatch) relevanceScore = 90;
              else if (abstractMatch && keywordMatch) relevanceScore = 80;
              else if (abstractMatch) relevanceScore = 75;
              else if (keywordMatch) relevanceScore = 60;
            }
          }
          
          return {
            id: study.id,
            title: study.title,
            abstract: study.abstract,
            authors: study.authors,
            journal: study.journal,
            publishDate: study.journal_publish_date,
            category: study.consumer_categories,
            slug: study.slug,
            viewCount: 0,
            relevanceScore: relevanceScore / 100, // Convert to 0-1 scale
            tags: [],
            relatedStudies: []
          };
        }),
        total: result.total || 0,
        page: page,
        pageSize: pageSize,
        facets: { tags: [], journals: [], years: [] },
        suggestions: [],
        trending: []
      };
      
      res.json(formattedResult);
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
               doi, consumer_categories, array_to_string(keywords, ', ') as keywords, slug,
               image_url, imageUrl
        FROM studies 
        WHERE consumer_categories ILIKE ${`%${categoryName}%`}
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

  // Local image storage endpoints
  app.post('/api/download-images', async (req, res) => {
    try {
      const { downloadAllOpenAIImages } = await import('./local-image-storage');
      const results = await downloadAllOpenAIImages();
      
      res.json({
        success: true,
        downloaded: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length,
        results
      });
    } catch (error) {
      console.error('Error downloading images:', error);
      res.status(500).json({ success: false, error: 'Image download failed' });
    }
  });

  app.get('/api/image-stats', async (req, res) => {
    try {
      const { getLocalImageStats } = await import('./local-image-storage');
      const stats = await getLocalImageStats();
      res.json(stats);
    } catch (error) {
      console.error('Error getting image stats:', error);
      res.status(500).json({ error: 'Failed to get image stats' });
    }
  });

  app.post('/api/cleanup-expired-images', async (req, res) => {
    try {
      // Clear all expired OpenAI DALL-E image URLs from database
      const result = await db.execute(sql`
        UPDATE studies 
        SET image_url = NULL
        WHERE image_url LIKE '%oaidalleapiprodscus.blob.core.windows.net%'
        AND image_url LIKE '%se=2025-06-06%'
      `);
      
      res.json({
        success: true,
        cleared: (result as any).rowCount || 0
      });
    } catch (error) {
      console.error('Error cleaning up expired images:', error);
      res.status(500).json({ error: 'Cleanup failed' });
    }
  });

  // Image generation endpoints
  app.post('/api/image-generation/auto-generate-all', async (req, res) => {
    try {
      // Get all studies without images
      const result = await db.execute(sql`
        SELECT id, title, abstract
        FROM studies 
        WHERE image_url IS NULL
        ORDER BY id
        LIMIT 100
      `);
      
      const studies = (result as any).rows || [];
      console.log(`Found ${studies.length} studies without images to process`);
      
      if (studies.length === 0) {
        return res.json({
          success: true,
          message: 'All studies already have images'
        });
      }
      
      // Start background image generation
      setTimeout(async () => {
        for (const study of studies) {
          try {
            await generateStudyImageWithOpenAI(study);
            // Rate limiting between requests
            await new Promise(resolve => setTimeout(resolve, 2000));
          } catch (error) {
            console.error(`Error generating image for study ${study.id}:`, error);
          }
        }
      }, 100);
      
      res.json({
        success: true,
        message: `Started generating images for ${studies.length} studies`,
        count: studies.length
      });
    } catch (error) {
      console.error('Error in auto-generate-all:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to start image generation'
      });
    }
  });

  app.get('/api/image-generation/status', async (req, res) => {
    try {
      const result = await db.execute(sql`
        SELECT 
          COUNT(*) as total_studies,
          COUNT(image_url) as studies_with_images,
          COUNT(*) - COUNT(image_url) as studies_without_images
        FROM studies
      `);
      
      const stats = (result as any).rows[0];
      res.json({
        total: parseInt(stats.total_studies),
        withImages: parseInt(stats.studies_with_images),
        withoutImages: parseInt(stats.studies_without_images)
      });
    } catch (error) {
      res.status(500).json({ error: 'Failed to get status' });
    }
  });

  app.post('/api/image-generation/start-complete-generation', async (req, res) => {
    try {
      const { startBulkGeneration, getGenerationStats } = await import('./bulk-image-generator');
      
      // Check if already running
      const currentStats = getGenerationStats();
      if (currentStats.inProgress) {
        return res.json({
          success: false,
          message: 'Bulk generation already in progress',
          stats: currentStats
        });
      }
      
      // Start the comprehensive generation process
      startBulkGeneration();
      
      res.json({
        success: true,
        message: 'Started comprehensive bulk image generation for all 771 studies',
        stats: getGenerationStats()
      });
    } catch (error) {
      console.error('Error starting complete generation:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to start complete generation'
      });
    }
  });

  app.get('/api/image-generation/generation-stats', async (req, res) => {
    try {
      const { getGenerationStats } = await import('./bulk-image-generator');
      const stats = getGenerationStats();
      res.json(stats);
    } catch (error) {
      res.status(500).json({ error: 'Failed to get generation stats' });
    }
  });

  app.post('/api/image-generation/start-bulk', async (req, res) => {
    try {
      const { startCompleteImageGeneration } = await import('./complete-image-generator');
      const result = await startCompleteImageGeneration(db);
      res.json(result);
    } catch (error) {
      console.error('Error starting bulk generation:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to start bulk generation'
      });
    }
  });

  app.get('/api/image-generation/bulk-status', async (req, res) => {
    try {
      const { getGenerationStatus } = await import('./complete-image-generator');
      const status = getGenerationStatus();
      res.json(status);
    } catch (error) {
      res.status(500).json({ error: 'Failed to get bulk status' });
    }
  });

  app.post('/api/image-generation/accelerated', async (req, res) => {
    try {
      const { startAcceleratedGeneration } = await import('./accelerated-image-generator');
      const result = await startAcceleratedGeneration(db);
      res.json(result);
    } catch (error) {
      console.error('Error starting accelerated generation:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to start accelerated generation'
      });
    }
  });

  app.get('/api/image-generation/accelerated-status', async (req, res) => {
    try {
      const { getAcceleratedStatus } = await import('./accelerated-image-generator');
      const status = getAcceleratedStatus();
      res.json(status);
    } catch (error) {
      res.status(500).json({ error: 'Failed to get accelerated status' });
    }
  });

  app.post('/api/image-generation/optimal', async (req, res) => {
    try {
      const { startOptimalGeneration } = await import('./optimal-image-generator');
      const result = await startOptimalGeneration(db);
      res.json(result);
    } catch (error) {
      console.error('Error starting optimal generation:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to start optimal generation'
      });
    }
  });

  app.get('/api/image-generation/optimal-status', async (req, res) => {
    try {
      const { getOptimalStatus } = await import('./optimal-image-generator');
      const status = getOptimalStatus();
      res.json(status);
    } catch (error) {
      res.status(500).json({ error: 'Failed to get optimal status' });
    }
  });

  app.post('/api/image-generation/final', async (req, res) => {
    try {
      const { startFinalGeneration } = await import('./final-image-generator');
      const result = await startFinalGeneration(db);
      res.json(result);
    } catch (error) {
      console.error('Error starting final generation:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to start final generation'
      });
    }
  });

  app.get('/api/image-generation/final-progress', async (req, res) => {
    try {
      const { getFinalProgress } = await import('./final-image-generator');
      const progress = getFinalProgress();
      res.json(progress);
    } catch (error) {
      res.status(500).json({ error: 'Failed to get final progress' });
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