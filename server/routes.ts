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
import { fromZodError } from "zod-validation-error";
import { db } from "./db";
import { eq, desc, or, asc, ilike, sql } from "drizzle-orm";
import { getDuplicateStatus, testTitleFix, fixTitlesForGroup, processAllDuplicates } from "./simple-title-fix";
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
import keywordMonitorRoutes from "./routes/keyword-monitor-routes";
import keywordMonitorScheduleRoutes from "./routes/keyword-monitor-schedule-routes";
import exportRoutes from "./routes/export-routes";
import recommendationRoutes from "./routes/recommendation-routes";

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

      res.json({ studies: categoryStudies, limit, offset });
    } catch (error) {
      console.error('Error fetching category studies:', error);
      res.status(500).json({ message: 'Failed to fetch category studies' });
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

      res.json({ studies: allStudies, limit, offset });
    } catch (error) {
      console.error('Error fetching studies:', error);
      res.status(500).json({ message: 'Failed to fetch studies' });
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
  app.use('/api', studyDetailsRoutes);

  // Title deduplication routes
  app.get('/api/admin/duplicate-status', async (req, res) => {
    try {
      const status = await getDuplicateStatus();
      res.json(status);
    } catch (error) {
      console.error('Error checking duplicate status:', error);
      res.status(500).json({ message: 'Failed to check duplicate status' });
    }
  });

  app.post('/api/admin/test-title-fix', async (req, res) => {
    try {
      console.log('Testing title deduplication system...');
      
      // Run test in background
      testTitleFix()
        .then(() => console.log('Title fix test completed'))
        .catch(error => console.error('Title fix test failed:', error));
      
      res.json({ 
        success: true, 
        message: 'Title fix test started in background' 
      });
    } catch (error) {
      console.error('Error starting title fix test:', error);
      res.status(500).json({ message: 'Failed to start title fix test' });
    }
  });

  app.post('/api/admin/process-all-duplicates', async (req, res) => {
    try {
      console.log('Starting full deduplication process for all duplicate groups...');
      
      // Run full deduplication in background
      processAllDuplicates()
        .then((result) => {
          console.log('Full deduplication process completed');
          console.log(`Final results: ${result.totalTitlesFixed} titles fixed across ${result.totalGroups} groups`);
        })
        .catch(error => console.error('Full deduplication process failed:', error));
      
      res.json({ 
        success: true, 
        message: 'Full deduplication process started in background' 
      });
    } catch (error) {
      console.error('Error starting full deduplication process:', error);
      res.status(500).json({ message: 'Failed to start full deduplication process' });
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

  // Get duplicate status
  app.get('/api/admin/duplicate-status', async (req, res) => {
    try {
      const status = await getDuplicateStatus();
      res.json(status);
    } catch (error) {
      console.error('Error getting duplicate status:', error);
      res.status(500).json({ message: 'Failed to get duplicate status' });
    }
  });

  // Process all duplicates
  app.post('/api/admin/process-all-duplicates', async (req, res) => {
    try {
      // Start background processing
      processAllDuplicates().catch(error => {
        console.error('Background duplicate processing failed:', error);
      });

      res.json({ 
        success: true, 
        message: 'Duplicate processing started in background' 
      });
    } catch (error) {
      console.error('Error starting duplicate processing:', error);
      res.status(500).json({ message: 'Failed to start duplicate processing' });
    }
  });

  // Enhanced study details with recommendations
  app.get('/api/studies/:id/detailed', async (req, res) => {
    try {
      const studyId = parseInt(req.params.id);
      
      const study = await db.execute(sql`
        SELECT s.*, 
               json_agg(DISTINCT 
                 json_build_object(
                   'id', t.id,
                   'name', t.name,
                   'category', t.category,
                   'confidence', st.confidence,
                   'source', st.source
                 )
               ) FILTER (WHERE t.id IS NOT NULL) as tags
        FROM studies s
        LEFT JOIN study_tags st ON s.id = st.study_id
        LEFT JOIN tags t ON st.tag_id = t.id
        WHERE s.id = ${studyId}
        GROUP BY s.id
      `);

      if (study.rows.length === 0) {
        return res.status(404).json({ error: 'Study not found' });
      }

      const studyData = study.rows[0];
      
      // Format the response with proper field mapping
      const response = {
        id: studyData.id,
        title: studyData.title,
        abstract: studyData.abstract,
        authors: studyData.authors,
        journal: studyData.journal,
        publishDate: studyData.publish_date || studyData.journal_publish_date,
        doi: studyData.doi,
        category: studyData.category,
        methods: studyData.methods,
        results: studyData.results,
        conclusion: studyData.conclusion,
        keywords: studyData.keywords && typeof studyData.keywords === 'string' ? studyData.keywords.split(',').map((k: string) => k.trim()) : [],
        imageUrl: studyData.image_url,
        viewCount: studyData.view_count || 0,
        tags: studyData.tags || [],
        citationInfo: {
          apa: `${studyData.authors} (${studyData.publish_date || studyData.journal_publish_date ? new Date(studyData.publish_date || studyData.journal_publish_date).getFullYear() : 'n.d.'}). ${studyData.title}. ${studyData.journal}.`,
          mla: `${studyData.authors}. "${studyData.title}." ${studyData.journal}, ${studyData.publish_date || studyData.journal_publish_date ? new Date(studyData.publish_date || studyData.journal_publish_date).getFullYear() : 'n.d.'}.`,
          chicago: `${studyData.authors}. "${studyData.title}." ${studyData.journal} (${studyData.publish_date || studyData.journal_publish_date ? new Date(studyData.publish_date || studyData.journal_publish_date).getFullYear() : 'n.d.'}).`
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

  // Enhanced search with suggestions and trending
  app.get('/api/search/enhanced', async (req, res) => {
    try {
      const { query, tags, category, dateRange, studyType, sortBy = 'relevance', limit = 20, offset = 0 } = req.query;
      
      // First get basic studies without JSON aggregation
      let searchQuery = sql`
        SELECT DISTINCT s.id, s.title, s.abstract, s.authors, s.journal, 
               s.publish_date, s.journal_publish_date, s.category, s.view_count
        FROM studies s
        WHERE 1=1
      `;

      // Add text search if query provided
      if (query && typeof query === 'string') {
        searchQuery = sql`${searchQuery} 
          AND (
            s.title ILIKE ${'%' + query + '%'} OR 
            s.abstract ILIKE ${'%' + query + '%'} OR
            s.authors ILIKE ${'%' + query + '%'}
          )
        `;
      }

      // Add category filter
      if (category) {
        searchQuery = sql`${searchQuery} AND s.category = ${category}`;
      }

      // Add date range filter
      if (dateRange && dateRange !== 'all') {
        const years: { [key: string]: number } = {
          '1year': 1,
          '3years': 3,
          '5years': 5
        };
        const yearBack = years[dateRange as string];
        if (yearBack) {
          searchQuery = sql`${searchQuery} 
            AND (s.publish_date >= CURRENT_DATE - INTERVAL '${yearBack} years' OR 
                 s.journal_publish_date >= CURRENT_DATE - INTERVAL '${yearBack} years')
          `;
        }
      }

      // Order and limit
      const orderClause = sortBy === 'date' ? sql`COALESCE(s.publish_date, s.journal_publish_date) DESC NULLS LAST` :
                         sortBy === 'views' ? sql`COALESCE(s.view_count, 0) DESC` :
                         sortBy === 'title' ? sql`s.title ASC` :
                         sql`COALESCE(s.view_count, 0) DESC, s.id DESC`;

      searchQuery = sql`${searchQuery}
        ORDER BY ${orderClause}
        LIMIT ${parseInt(limit as string) || 20} OFFSET ${parseInt(offset as string) || 0}
      `;

      const results = await db.execute(searchQuery);

      // Get tags for each study separately
      const studiesWithTags = await Promise.all(results.rows.map(async (study) => {
        const tagResult = await db.execute(sql`
          SELECT t.id, t.name, t.category, st.confidence
          FROM study_tags st
          JOIN tags t ON st.tag_id = t.id
          WHERE st.study_id = ${study.id}
        `);

        return {
          id: study.id,
          title: study.title,
          abstract: study.abstract,
          authors: study.authors,
          journal: study.journal,
          publishDate: study.publish_date || study.journal_publish_date,
          category: study.category,
          viewCount: study.view_count || 0,
          relevanceScore: 1.0,
          tags: tagResult.rows,
          relatedStudies: []
        };
      }));

      res.json({
        studies: studiesWithTags,
        total: studiesWithTags.length,
        facets: { tags: [], journals: [], years: [] },
        suggestions: [],
        trending: []
      });
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

  const httpServer = createServer(app);
  return httpServer;
}