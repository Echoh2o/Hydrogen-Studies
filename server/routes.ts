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

  const httpServer = createServer(app);
  return httpServer;
}