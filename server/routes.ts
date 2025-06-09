import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import express from "express";
import { storage } from "./storage";
import { 
  insertNewsletterSchema, 
  insertStudySchema, 
  insertCategorySchema, 
  insertContactSchema, 
  blogArticles, 
  insertBlogArticleSchema,
  studies,
  categories,
  studyCategories
} from "@shared/schema";
import { ZodError } from "zod";
// import { fromZodError } from "zod-validation-error";
import { db } from "./db";
import { eq, desc, or, asc, ilike, sql } from "drizzle-orm";
// Removed redundant deduplication imports
import { 
  initializeTaggingSystem, 
  tagSingleStudy, 
  processAllStudiesForTagging, 
  getTaggingStats 
} from "./automated-tagging-system";

// Import only the working routes
import educationalRoutes from "./routes/educational";
import scraperRoutes from "./routes/scraper-routes";
import importRoutes from "./routes/import-routes";
import hydrogenImportRoutes from "./routes/hydrogen-import";
import excelAnalysisRoutes from "./routes/excel-analysis";
import minimalImportRoutes from "./routes/minimal-import";
import researchRoutes from "./routes/research-routes";
import excelImportRoutes from "./routes/excel-import";
import unifiedResearchRoutes from "./routes/research-unified-routes";
import studyDetailsRoutes from "./routes/study-details";
import europePmcRoutes from "./routes/europepmc-routes";
import imageFixRoutes from "./routes/image-fix-routes";
import semanticScholarRoutes from "./routes/semantic-scholar-routes";
import crossrefRoutes from "./routes/crossref-routes";
import journalDateRoutes from "./routes/journal-date-routes";
import doiEnhancementRoutes from "./routes/doi-enhancement-routes";
import contentEnrichmentRoutes from "./routes/content-enrichment-routes";
import consumerCategoriesRoutes from "./routes/consumer-categories-routes";
import enrichmentRoutes from "./routes/enrichment-routes";
import studiesRouter from "./routes/studies-router";
import hydrogenRoutes from "./routes/hydrogen-routes";
import insightCardRoutes from "./routes/insight-card-routes";
import seoRoutes from "./routes/seo-routes";
import performanceRoutes from "./routes/performance-routes";
import advancedSearchRoutes from "./routes/advanced-search-routes";
import fullTextSearchRoutes from "./routes/full-text-search-routes";
import { testEnrichStudy, populateStudyWithRealData } from "./test-pubmed-enrichment";
import { enrichStudyDirect } from "./direct-pubmed-enrichment";
import { enrichStudySimple } from "./simple-pubmed-enrichment";
import keywordMonitorRoutes from "./routes/keyword-monitor-routes";
import keywordMonitorScheduleRoutes from "./routes/keyword-monitor-schedule-routes";
import exportRoutes from "./routes/export-routes";
import recommendationRoutes from "./routes/recommendation-routes";
import chatRoutes from "./routes/chat-routes";
import adminImageRoutes from "./routes/admin-image-routes";
import adminEnrichmentRoutes from "./routes/admin-enrichment-routes";

export async function registerRoutes(app: Express): Promise<Server> {
  const router = express.Router();

  // Multi-category API endpoints
  app.get('/api/categories', async (req, res) => {
    try {
      const allCategories = await db.select().from(categories).orderBy(asc(categories.name));
      res.json(allCategories);
    } catch (error) {
      console.error('Error fetching categories:', error);
      res.status(500).json({ message: 'Failed to fetch categories' });
    }
  });

  app.get('/api/studies/:id/categories', async (req, res) => {
    try {
      const studyId = parseInt(req.params.id);
      const studyWithCategories = await db
        .select({
          categoryId: studyCategories.categoryId,
          categoryName: categories.name,
          isPrimary: studyCategories.isPrimary
        })
        .from(studyCategories)
        .innerJoin(categories, eq(studyCategories.categoryId, categories.id))
        .where(eq(studyCategories.studyId, studyId))
        .orderBy(desc(studyCategories.isPrimary), asc(categories.name));
      
      res.json(studyWithCategories);
    } catch (error) {
      console.error('Error fetching study categories:', error);
      res.status(500).json({ message: 'Failed to fetch study categories' });
    }
  });

  app.get('/api/categories/:id/studies', async (req, res) => {
    try {
      const categoryId = parseInt(req.params.id);
      const limit = parseInt(req.query.limit as string) || 20;
      const offset = parseInt(req.query.offset as string) || 0;

      const categoryStudies = await db
        .select({
          id: studies.id,
          title: studies.title,
          abstract: studies.abstract,
          authors: studies.authors,
          journal: studies.journal,
          publishDate: studies.publishDate,
          imageUrl: studies.imageUrl,
          isPrimary: studyCategories.isPrimary
        })
        .from(studies)
        .innerJoin(studyCategories, eq(studies.id, studyCategories.studyId))
        .where(eq(studyCategories.categoryId, categoryId))
        .orderBy(desc(studyCategories.isPrimary), desc(studies.id))
        .limit(limit)
        .offset(offset);

      // Get total count for this category
      const [{ count: total }] = await db
        .select({ count: sql`count(*)` })
        .from(studies)
        .innerJoin(studyCategories, eq(studies.id, studyCategories.studyId))
        .where(eq(studyCategories.categoryId, categoryId));

      res.json({ 
        data: categoryStudies, 
        total: parseInt(String(total)),
        page: Math.floor(offset / limit) + 1,
        pageSize: limit,
        pageCount: Math.ceil(parseInt(String(total)) / limit)
      });
    } catch (error) {
      console.error('Error fetching category studies:', error);
      res.status(500).json({ message: 'Failed to fetch category studies' });
    }
  });

  // Recent studies endpoint for homepage
  app.get('/api/recent-studies', async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 6;
      
      const recentStudies = await db.select({
        id: studies.id,
        title: studies.title,
        abstract: studies.abstract,
        authors: studies.authors,
        journal: studies.journal,
        publishDate: studies.publishDate,
        category: studies.category,
        imageUrl: studies.imageUrl,
        slug: studies.slug,
        year: sql<number>`EXTRACT(YEAR FROM ${studies.publishDate}::date)::int`
      })
      .from(studies)
      .where(sql`${studies.title} IS NOT NULL AND ${studies.abstract} IS NOT NULL`)
      .orderBy(desc(studies.id))
      .limit(limit);

      res.json(recentStudies);
    } catch (error) {
      console.error('Error fetching recent studies:', error);
      res.status(500).json({ message: 'Failed to fetch recent studies' });
    }
  });

  // Basic study endpoints
  app.get('/api/studies', async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 20;
      const offset = parseInt(req.query.offset as string) || 0;
      const category = req.query.category as string;

      let query = db.select().from(studies);
      
      if (category) {
        const categoryResults = await db
          .select()
          .from(studies)
          .innerJoin(studyCategories, eq(studies.id, studyCategories.studyId))
          .innerJoin(categories, eq(studyCategories.categoryId, categories.id))
          .where(eq(categories.name, category));
        
        return res.json(categoryResults.map(result => result.studies));
      }

      const allStudies = await db.select().from(studies)
        .orderBy(desc(studies.id))
        .limit(limit)
        .offset(offset);

      // Get total count for pagination
      const [{ count: total }] = await db.select({ count: sql`count(*)` }).from(studies);

      res.json({ 
        data: allStudies, 
        total: parseInt(String(total)),
        page: Math.floor(offset / limit) + 1,
        pageSize: limit,
        pageCount: Math.ceil(parseInt(String(total)) / limit)
      });
    } catch (error) {
      console.error('Error fetching studies:', error);
      res.status(500).json({ message: 'Failed to fetch studies' });
    }
  });

  // Study by slug endpoint for SEO URLs - moved to bypass Vite catch-all
  app.get('/api/study-by-slug/:slug', async (req, res) => {
    try {
      const slug = req.params.slug;
      console.log(`Looking up study by slug: ${slug}`);
      
      // First try to find by slug
      let [study] = await db.select().from(studies).where(eq(studies.slug, slug));
      
      // If not found by slug and the slug looks like a number, try finding by ID
      if (!study && /^\d+$/.test(slug)) {
        const id = parseInt(slug);
        console.log(`Slug appears to be an ID (${id}), trying ID lookup...`);
        [study] = await db.select().from(studies).where(eq(studies.id, id));
        
        // If found by ID, redirect to proper slug URL if slug exists
        if (study && study.slug) {
          console.log(`Found study by ID, redirecting to slug: ${study.slug}`);
          return res.redirect(301, `/api/study-by-slug/${study.slug}`);
        }
      }
      
      if (!study) {
        console.log(`Study not found for slug: ${slug}`);
        return res.status(404).json({ message: 'Study not found' });
      }

      // Ensure study has an image URL if found
      if (study && !study.imageUrl) {
        // Generate a dynamic image related to the study topic
        const topic = study.title?.split(' ').slice(0, 3).join('+') || 'hydrogen+research';
        // Make sure we properly encode the text to avoid URL issues
        const encodedTopic = encodeURIComponent(topic);
        study.imageUrl = `https://placehold.co/800x400/e2f3ff/003366?text=${encodedTopic}`;
        console.log(`Generated image URL for study ${study.id}: ${study.imageUrl}`);
      }

      console.log(`Successfully found study: ${study.title}`);
      res.json(study);
    } catch (error) {
      console.error('Error fetching study by slug:', error);
      res.status(500).json({ message: 'Failed to fetch study' });
    }
  });

  app.get('/api/studies/:id', async (req, res) => {
    try {
      const studyId = parseInt(req.params.id);
      const [study] = await db.select().from(studies).where(eq(studies.id, studyId));
      
      if (!study) {
        return res.status(404).json({ message: 'Study not found' });
      }

      res.json(study);
    } catch (error) {
      console.error('Error fetching study:', error);
      res.status(500).json({ message: 'Failed to fetch study' });
    }
  });

  // Register working route modules
  app.use('/api', educationalRoutes);
  app.use('/api', scraperRoutes);
  app.use('/api', importRoutes);
  app.use('/api/import', excelImportRoutes);
  app.use('/api', hydrogenImportRoutes);
  app.use('/api', excelAnalysisRoutes);
  app.use('/api', minimalImportRoutes);
  app.use('/api/images/fix', imageFixRoutes);
  app.use('/api', researchRoutes);
  app.use('/api/consumer-categories', consumerCategoriesRoutes);
  app.use('/api', unifiedResearchRoutes);
  app.use('', europePmcRoutes);
  app.use('', semanticScholarRoutes);
  app.use('/api/crossref', crossrefRoutes);
  app.use('/api/admin', journalDateRoutes);
  app.use('/api/doi', doiEnhancementRoutes);
  app.use('/api/content-enrichment', contentEnrichmentRoutes);
  app.use('/api/enrichment', enrichmentRoutes);
  app.use('/api/studies', studiesRouter);
  app.use('', hydrogenRoutes);
  app.use('/api', insightCardRoutes);
  app.use('/api/keywords', keywordMonitorRoutes);
  app.use('/api/keywords/monitor/schedule', keywordMonitorScheduleRoutes);
  app.use('/api/export', exportRoutes);
  app.use('/api/recommendations', recommendationRoutes);
  app.use('/api', chatRoutes);
  app.use('/api', studyDetailsRoutes);

  // Admin status routes
  app.get('/api/admin/status', async (req, res) => {
    try {
      const totalStudies = await db.select({ count: sql<number>`count(*)` }).from(studies);
      const totalCategories = await db.select({ count: sql<number>`count(*)` }).from(categories);
      
      res.json({
        success: true,
        totalStudies: totalStudies[0]?.count || 0,
        totalCategories: totalCategories[0]?.count || 0,
        message: 'System status retrieved successfully'
      });
    } catch (error) {
      console.error('Error checking system status:', error);
      res.status(500).json({ message: 'Failed to check system status' });
    }
  });

  // ===== AUTOMATED TAGGING SYSTEM ROUTES =====
  
  // Initialize tagging system
  app.post('/api/admin/tagging/initialize', async (req, res) => {
    try {
      console.log('Initializing automated tagging system...');
      await initializeTaggingSystem();
      res.json({ 
        success: true, 
        message: 'Tagging system initialized successfully' 
      });
    } catch (error) {
      console.error('Error initializing tagging system:', error);
      res.status(500).json({ message: 'Failed to initialize tagging system' });
    }
  });

  // Process all studies for tagging
  app.post('/api/admin/tagging/process-all', async (req, res) => {
    try {
      console.log('Starting automated tagging for all studies...');
      
      // Run tagging process in background
      processAllStudiesForTagging()
        .then((result) => {
          console.log('Automated tagging process completed');
          console.log(`Final results: ${result.totalTagsAdded} tags added to ${result.successfullyTagged} studies`);
        })
        .catch(error => console.error('Automated tagging process failed:', error));
      
      res.json({ 
        success: true, 
        message: 'Automated tagging process started in background' 
      });
    } catch (error) {
      console.error('Error starting automated tagging process:', error);
      res.status(500).json({ message: 'Failed to start automated tagging process' });
    }
  });

  // Tag a single study
  app.post('/api/admin/tagging/tag-study/:id', async (req, res) => {
    try {
      const studyId = parseInt(req.params.id);
      if (isNaN(studyId)) {
        return res.status(400).json({ message: 'Invalid study ID' });
      }

      const result = await tagSingleStudy(studyId);
      res.json({
        success: true,
        result
      });
    } catch (error) {
      console.error('Error tagging single study:', error);
      res.status(500).json({ message: 'Failed to tag study' });
    }
  });

  // Get tagging statistics
  app.get('/api/admin/tagging/stats', async (req, res) => {
    try {
      const stats = await getTaggingStats();
      res.json(stats);
    } catch (error) {
      console.error('Error getting tagging stats:', error);
      res.status(500).json({ message: 'Failed to get tagging stats' });
    }
  });

  // Initialize tagging system
  app.post('/api/admin/tagging/initialize', async (req, res) => {
    try {
      await initializeTaggingSystem();
      res.json({ success: true, message: 'Tagging system initialized successfully' });
    } catch (error) {
      console.error('Error initializing tagging system:', error);
      res.status(500).json({ message: 'Failed to initialize tagging system' });
    }
  });

  // Process all studies for tagging
  app.post('/api/admin/tagging/process-all', async (req, res) => {
    try {
      // Start background processing
      processAllStudiesForTagging().catch(error => {
        console.error('Background tagging process failed:', error);
      });

      res.json({ 
        success: true, 
        message: 'Automated tagging process started in background' 
      });
    } catch (error) {
      console.error('Error starting tagging process:', error);
      res.status(500).json({ message: 'Failed to start tagging process' });
    }
  });

  // Database statistics
  app.get('/api/admin/database-stats', async (req, res) => {
    try {
      const studyCount = await db.select({ count: sql<number>`count(*)` }).from(studies);
      const categoryCount = await db.select({ count: sql<number>`count(*)` }).from(categories);
      
      res.json({
        success: true,
        studies: studyCount[0]?.count || 0,
        categories: categoryCount[0]?.count || 0,
        message: 'Database statistics retrieved successfully'
      });
    } catch (error: any) {
      console.error('Error getting database statistics:', error);
      res.status(500).json({ message: 'Failed to get database statistics' });
    }
  });

  // SEO-optimized study route by slug
  app.get('/api/studies/by-slug/:slug', async (req, res) => {
    try {
      const slug = req.params.slug;
      
      // Get study by slug
      const studyResult = await db.select().from(studies).where(eq(studies.slug, slug));
      
      if (studyResult.length === 0) {
        return res.status(404).json({ error: 'Study not found' });
      }
      
      const study = studyResult[0];
      res.json(study);
    } catch (error) {
      console.error('Error fetching study by slug:', error);
      res.status(500).json({ error: 'Failed to fetch study' });
    }
  });

  // Alternative route for frontend compatibility
  app.get('/api/study-by-slug/:slug', async (req, res) => {
    try {
      const slug = req.params.slug;
      
      // Get study by slug
      const studyResult = await db.select().from(studies).where(eq(studies.slug, slug));
      
      if (studyResult.length === 0) {
        return res.status(404).json({ error: 'Study not found' });
      }
      
      const study = studyResult[0];
      res.json(study);
    } catch (error) {
      console.error('Error fetching study by slug:', error);
      res.status(500).json({ error: 'Failed to fetch study' });
    }
  });

  // Related studies endpoint
  app.get('/api/metadata/related/:studyId', async (req, res) => {
    try {
      const studyId = parseInt(req.params.studyId);
      
      // Get the current study to find related ones
      const currentStudy = await db.select().from(studies).where(eq(studies.id, studyId)).limit(1);
      
      if (currentStudy.length === 0) {
        return res.status(404).json({ error: 'Study not found' });
      }
      
      const study = currentStudy[0];
      
      // Find related studies based on categories and similar content
      const relatedStudies = await db.select({
        id: studies.id,
        title: studies.title,
        plainLanguageTitle: studies.plainLanguageTitle,
        journal: studies.journal,
        publishDate: studies.publishDate,
        journalPublishDate: studies.journalPublishDate,
        slug: studies.slug,
        category: studies.category
      })
      .from(studies)
      .where(
        sql`${studies.id} != ${studyId} AND (
          ${studies.category} = ${study.category} OR 
          ${studies.title} ILIKE '%acne%' OR 
          ${studies.title} ILIKE '%skin%' OR 
          ${studies.abstract} ILIKE '%dermatological%'
        )`
      )
      .limit(8);
      
      res.json(relatedStudies);
    } catch (error) {
      console.error('Error fetching related studies:', error);
      res.status(500).json({ error: 'Failed to fetch related studies' });
    }
  });

  // Image generation routes
  app.post('/api/admin/generate-image/:studyId', async (req, res) => {
    try {
      const studyId = parseInt(req.params.studyId);
      const { generateStudyImage } = await import('./enhanced-image-generator');
      
      const result = await generateStudyImage(studyId);
      
      if (result.success) {
        res.json({
          success: true,
          imageUrl: result.imageUrl,
          imageDescription: result.imageDescription,
          prompt: result.prompt,
          message: `Image generated successfully for study ${studyId}`
        });
      } else {
        res.status(400).json({
          success: false,
          error: result.error,
          message: `Failed to generate image for study ${studyId}`
        });
      }
    } catch (error) {
      console.error('Error generating image:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Internal server error',
        message: 'Failed to generate image' 
      });
    }
  });

  app.post('/api/admin/generate-images-batch', async (req, res) => {
    try {
      const { studyIds, batchSize = 3 } = req.body;
      const { generateImagesForStudies } = await import('./enhanced-image-generator');
      
      if (!Array.isArray(studyIds) || studyIds.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Invalid studyIds array provided'
        });
      }
      
      // Start batch generation (this will run in background)
      generateImagesForStudies(studyIds, batchSize).catch(console.error);
      
      res.json({
        success: true,
        message: `Started batch image generation for ${studyIds.length} studies`,
        batchSize
      });
    } catch (error) {
      console.error('Error starting batch image generation:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Failed to start batch generation' 
      });
    }
  });

  app.post('/api/admin/generate-all-images', async (req, res) => {
    try {
      const { generateImagesForAllStudies } = await import('./enhanced-image-generator');
      
      // Start generation for all studies (runs in background)
      generateImagesForAllStudies().catch(console.error);
      
      res.json({
        success: true,
        message: 'Started image generation for all studies without images'
      });
    } catch (error) {
      console.error('Error starting full image generation:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Failed to start image generation' 
      });
    }
  });

  app.get('/api/admin/test-image-generation/:studyId?', async (req, res) => {
    try {
      const studyId = req.params.studyId ? parseInt(req.params.studyId) : undefined;
      const { testImageGeneration } = await import('./enhanced-image-generator');
      
      const result = await testImageGeneration(studyId);
      
      res.json({
        success: result.success,
        imageUrl: result.imageUrl,
        prompt: result.prompt,
        error: result.error,
        studyId: result.studyId
      });
    } catch (error) {
      console.error('Error testing image generation:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Failed to test image generation' 
      });
    }
  });

  // Enhanced study details with recommendations
  app.get('/api/studies/:id/detailed', async (req, res) => {
    try {
      const studyId = parseInt(req.params.id);
      
      // Get study data using correct schema field names
      const studyResult = await db.select().from(studies).where(eq(studies.id, studyId));
      
      if (studyResult.length === 0) {
        return res.status(404).json({ error: 'Study not found' });
      }
      
      const study = studyResult[0];
      
      // Format response to match frontend expectations
      const response = {
        id: study.id,
        title: study.title,
        abstract: study.abstract,
        authors: study.authors,
        journal: study.journal,
        publishDate: study.publishDate || study.journalPublishDate,
        doi: study.doi,
        category: study.category,
        methods: study.methods,
        results: study.results,
        conclusion: study.conclusion,
        keywords: study.keywords && Array.isArray(study.keywords) ? study.keywords : [],
        imageUrl: study.imageUrl,
        viewCount: study.viewCount || 0,
        tags: [],
        relatedStudies: [],
        citationInfo: {
          apa: `${study.authors} (${study.publishDate || study.journalPublishDate ? new Date(String(study.publishDate || study.journalPublishDate)).getFullYear() : 'n.d.'}). ${study.title}. ${study.journal}.`,
          mla: `${study.authors}. "${study.title}." ${study.journal}, ${study.publishDate || study.journalPublishDate ? new Date(String(study.publishDate || study.journalPublishDate)).getFullYear() : 'n.d.'}.`,
          chicago: `${study.authors}. "${study.title}." ${study.journal} (${study.publishDate || study.journalPublishDate ? new Date(String(study.publishDate || study.journalPublishDate)).getFullYear() : 'n.d.'}).`
        }
      };

      res.json(response);
    } catch (error) {
      console.error('Error fetching study details:', error);
      res.status(500).json({ error: 'Failed to fetch study details' });
    }
  });

  // Study recommendations based on tags
  app.get('/api/studies/:id/recommendations', async (req, res) => {
    try {
      const studyId = parseInt(req.params.id);
      
      // Get similar studies based on shared tags
      const similarStudies = await db.execute(sql`
        WITH study_tags_cte AS (
          SELECT tag_id
          FROM study_tags 
          WHERE study_id = ${studyId}
        ),
        similar_studies AS (
          SELECT s.id, s.title, s.authors,
                 COUNT(st.tag_id) as shared_tags,
                 COUNT(st.tag_id)::float / (
                   SELECT COUNT(*) FROM study_tags_cte
                 ) as relevance_score
          FROM studies s
          INNER JOIN study_tags st ON s.id = st.study_id
          INNER JOIN study_tags_cte stc ON st.tag_id = stc.tag_id
          WHERE s.id != ${studyId}
          GROUP BY s.id, s.title, s.authors
          HAVING COUNT(st.tag_id) >= 1
          ORDER BY shared_tags DESC, relevance_score DESC
          LIMIT 8
        )
        SELECT *, 
               CASE 
                 WHEN shared_tags >= 3 THEN 'Similar tags'
                 WHEN shared_tags >= 2 THEN 'Related topics'
                 ELSE 'Shared category'
               END as reason
        FROM similar_studies
      `);

      // Get trending studies in the same category
      const trendingInCategory = await db.execute(sql`
        SELECT s.id, s.title, s.view_count
        FROM studies s
        WHERE s.category = (SELECT category FROM studies WHERE id = ${studyId})
          AND s.id != ${studyId}
        ORDER BY s.view_count DESC NULLS LAST
        LIMIT 5
      `);

      res.json({
        similarStudies: similarStudies.rows.map(row => ({
          id: row.id,
          title: row.title,
          authors: row.authors,
          relevanceScore: row.relevance_score || 0,
          reason: row.reason
        })),
        trendingInCategory: trendingInCategory.rows.map(row => ({
          id: row.id,
          title: row.title,
          viewCount: row.view_count || 0
        })),
        relatedTopics: []
      });
    } catch (error) {
      console.error('Error fetching recommendations:', error);
      res.status(500).json({ error: 'Failed to fetch recommendations' });
    }
  });

  // Track study views
  app.post('/api/studies/:id/view', async (req, res) => {
    try {
      const studyId = parseInt(req.params.id);
      
      await db.execute(sql`
        UPDATE studies 
        SET view_count = COALESCE(view_count, 0) + 1
        WHERE id = ${studyId}
      `);

      res.json({ success: true });
    } catch (error) {
      console.error('Error recording view:', error);
      res.status(500).json({ error: 'Failed to record view' });
    }
  });

  // Enhanced search with suggestions and trending - optimized for deployment
  // High-performance search cache
  let searchCache = new Map();
  let searchCacheTimestamp = 0;
  const SEARCH_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  app.get('/api/search/enhanced', async (req, res) => {
    try {
      const { query, tags, category, dateRange, studyType, sortBy = 'relevance', limit = 20, offset = 0 } = req.query;
      
      // Create cache key
      const cacheKey = JSON.stringify({ query, tags, category, dateRange, studyType, sortBy, limit, offset });
      const now = Date.now();
      
      // Check cache first for immediate response
      if (searchCache.has(cacheKey) && (now - searchCacheTimestamp) < SEARCH_CACHE_TTL) {
        return res.json(searchCache.get(cacheKey));
      }
      
      const limitInt = parseInt(limit as string) || 20;
      const offsetInt = parseInt(offset as string) || 0;

      // Optimized query with reduced complexity
      let searchSql;
      
      if (query && typeof query === 'string' && query.trim().length > 0) {
        const searchTerm = query.trim().toLowerCase();
        // Use more efficient text search
        searchSql = sql`
          SELECT s.id, s.title, s.abstract, s.authors, s.journal, 
                 s.publish_date, s.journal_publish_date, s.category, 
                 COALESCE(s.view_count, 0) as view_count,
                 CASE 
                   WHEN LOWER(s.title) LIKE ${`%${searchTerm}%`} THEN 1
                   WHEN LOWER(s.abstract) LIKE ${`%${searchTerm}%`} THEN 2
                   ELSE 3
                 END as relevance_rank
          FROM studies s
          WHERE (LOWER(s.title) LIKE ${`%${searchTerm}%`} 
                 OR LOWER(s.abstract) LIKE ${`%${searchTerm}%`}
                 OR LOWER(s.authors) LIKE ${`%${searchTerm}%`})
          ${category && category !== '' ? sql`AND s.category = ${category}` : sql``}
          ORDER BY relevance_rank, s.view_count DESC NULLS LAST
          LIMIT ${limitInt} OFFSET ${offsetInt}
        `;
      } else {
        // No search query - simple category/all results
        searchSql = sql`
          SELECT s.id, s.title, s.abstract, s.authors, s.journal, 
                 s.publish_date, s.journal_publish_date, s.category, 
                 COALESCE(s.view_count, 0) as view_count
          FROM studies s
          ${category && category !== '' ? sql`WHERE s.category = ${category}` : sql`WHERE 1=1`}
          ORDER BY s.view_count DESC NULLS LAST, s.id DESC
          LIMIT ${limitInt} OFFSET ${offsetInt}
        `;
      }

      const results = await db.execute(searchSql);

      // Simplified response for maximum speed
      const studies = results.rows.map((study: any) => ({
        id: study.id,
        title: study.title,
        abstract: study.abstract,
        authors: study.authors,
        journal: study.journal,
        publishDate: study.publish_date || study.journal_publish_date,
        category: study.category,
        viewCount: study.view_count || 0,
        relevanceScore: study.relevance_rank || 1.0,
        tags: [],
        relatedStudies: []
      }));

      const result = {
        studies,
        total: studies.length,
        facets: { tags: [], journals: [], years: [] },
        suggestions: [],
        trending: []
      };

      // Cache the result
      searchCache.set(cacheKey, result);
      searchCacheTimestamp = now;

      // Clean cache if it gets too large
      if (searchCache.size > 100) {
        searchCache.clear();
      }

      res.json(result);
    } catch (error) {
      console.error('Error in enhanced search:', error);
      res.status(500).json({ error: 'Search failed' });
    }
  });

  // Search suggestions
  app.get('/api/search/suggestions', async (req, res) => {
    try {
      const { query } = req.query;
      
      if (!query || typeof query !== 'string' || query.length < 2) {
        return res.json([]);
      }

      const suggestions = await db.execute(sql`
        SELECT DISTINCT name 
        FROM tags 
        WHERE name ILIKE ${'%' + query + '%'}
        ORDER BY name
        LIMIT 10
      `);

      res.json(suggestions.rows.map(row => row.name));
    } catch (error) {
      console.error('Error fetching suggestions:', error);
      res.status(500).json({ error: 'Failed to fetch suggestions' });
    }
  });

  // Trending topics
  app.get('/api/search/trending', async (req, res) => {
    try {
      const trending = await db.execute(sql`
        SELECT t.name, COUNT(st.study_id) as usage_count
        FROM tags t
        INNER JOIN study_tags st ON t.id = st.tag_id
        GROUP BY t.id, t.name
        ORDER BY usage_count DESC
        LIMIT 10
      `);

      res.json({
        trending: trending.rows.map(row => row.name)
      });
    } catch (error) {
      console.error('Error fetching trending topics:', error);
      res.status(500).json({ error: 'Failed to fetch trending topics' });
    }
  });

  // Import tag search routes
  const tagSearchRoutes = await import('./tag-search-routes.js');
  const {
    getAllTags,
    getTagCategories,
    searchStudiesByTags,
    getRelatedTags,
    getPopularTagsByCategory
  } = tagSearchRoutes;

  // Tag-based search and filtering routes
  app.get('/api/tags', getAllTags);
  app.get('/api/tags/categories', getTagCategories);
  app.get('/api/search/by-tags', searchStudiesByTags);
  app.get('/api/tags/related', getRelatedTags);
  app.get('/api/tags/popular-by-category', getPopularTagsByCategory);

  // PubMed Data Enrichment Routes
  app.post('/api/test-enrich/:id', async (req, res) => {
    try {
      const studyId = parseInt(req.params.id);
      console.log(`Testing PubMed APIs for study ${studyId}`);
      
      await testEnrichStudy(studyId);
      
      res.json({ 
        success: true, 
        message: `API test completed for study ${studyId} - check console logs`
      });
    } catch (error) {
      console.error('Error testing enrichment:', error);
      res.status(500).json({ 
        success: false, 
        message: 'API test failed'
      });
    }
  });

  app.post('/api/populate-study/:id', async (req, res) => {
    try {
      const studyId = parseInt(req.params.id);
      console.log(`Populating study ${studyId} with authentic PubMed data`);
      
      const success = await populateStudyWithRealData(studyId);
      
      if (success) {
        res.json({ 
          success: true, 
          message: `Study ${studyId} populated with authentic research data`
        });
      } else {
        res.json({ 
          success: false, 
          message: `No additional data found for study ${studyId}`
        });
      }
    } catch (error) {
      console.error('Error populating study:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Data population failed'
      });
    }
  });

  app.post('/api/enrich-direct/:id', async (req, res) => {
    try {
      const studyId = parseInt(req.params.id);
      console.log(`Direct enrichment for study ${studyId}`);
      
      const success = await enrichStudyDirect(studyId);
      
      if (success) {
        res.json({ 
          success: true, 
          message: `Study ${studyId} enriched with authentic PubMed data`
        });
      } else {
        res.json({ 
          success: false, 
          message: `No data found for study ${studyId}`
        });
      }
    } catch (error) {
      console.error('Error in direct enrichment:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Direct enrichment failed'
      });
    }
  });

  app.post('/api/enrich-simple/:id', async (req, res) => {
    try {
      const studyId = parseInt(req.params.id);
      console.log(`Simple enrichment for study ${studyId}`);
      
      const success = await enrichStudySimple(studyId);
      
      if (success) {
        res.json({ 
          success: true, 
          message: `Study ${studyId} enriched with authentic research data`
        });
      } else {
        res.json({ 
          success: false, 
          message: `No authentic data found for study ${studyId}`
        });
      }
    } catch (error) {
      console.error('Error in simple enrichment:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Simple enrichment failed'
      });
    }
  });

  // Batch enrichment routes
  app.post('/api/batch-enrichment/start', async (req, res) => {
    try {
      const { startBatchEnrichment, isBatchRunning } = await import('./batch-enrichment-system');
      
      if (isBatchRunning()) {
        return res.status(409).json({
          success: false,
          message: 'Batch enrichment is already running'
        });
      }

      // Start batch enrichment in background
      startBatchEnrichment().catch(error => {
        console.error('Batch enrichment error:', error);
      });

      res.json({
        success: true,
        message: 'Batch enrichment started successfully'
      });
    } catch (error) {
      console.error('Error starting batch enrichment:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to start batch enrichment'
      });
    }
  });

  app.get('/api/batch-enrichment/progress', async (req, res) => {
    try {
      const { getBatchProgress, isBatchRunning } = await import('./batch-enrichment-system');
      
      const progress = getBatchProgress();
      const isRunning = isBatchRunning();

      res.json({
        isRunning,
        progress
      });
    } catch (error) {
      console.error('Error getting batch progress:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get batch progress'
      });
    }
  });

  app.post('/api/batch-enrichment/stop', async (req, res) => {
    try {
      const { stopBatchEnrichment, isBatchRunning } = await import('./batch-enrichment-system');
      
      if (!isBatchRunning()) {
        return res.status(409).json({
          success: false,
          message: 'No batch enrichment is currently running'
        });
      }

      await stopBatchEnrichment();

      res.json({
        success: true,
        message: 'Batch enrichment stopped successfully'
      });
    } catch (error) {
      console.error('Error stopping batch enrichment:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to stop batch enrichment'
      });
    }
  });

  app.get('/api/enrichment-stats', async (req, res) => {
    try {
      const { getEnrichmentStats } = await import('./auto-enrichment-manager');
      const stats = await getEnrichmentStats();
      res.json(stats);
    } catch (error) {
      console.error('Error getting enrichment stats:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get enrichment stats'
      });
    }
  });

  // Add SEO routes for sitemap and robots.txt
  app.use('/', seoRoutes);
  
  // Add performance monitoring routes
  app.use('/', performanceRoutes);
  
  // Add advanced search routes
  app.use('/', advancedSearchRoutes);
  
  // Add full-text search routes
  app.use('/', fullTextSearchRoutes);
  
  // Add admin image generation routes
  app.use('/api/admin/images', adminImageRoutes);
  
  // Add admin enrichment routes
  app.use('/api/admin/enrichment', adminEnrichmentRoutes);

  const httpServer = createServer(app);
  return httpServer;
}