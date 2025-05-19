import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import * as fs from "fs";
import * as path from "path";
import { storage } from "./storage";
import { 
  insertNewsletterSchema, 
  insertStudySchema, 
  insertCategorySchema, 
  insertContactSchema, 
  blogArticles, 
  insertBlogArticleSchema,
  studies 
} from "@shared/schema";
import { ZodError } from "zod";
import { fromZodError } from "zod-validation-error";
import { upload, getFileType } from "./upload";
import { generateScientificImage, generateBlogImage } from "./image-generator";
import { generateBlogArticlesForStudy, saveBlogArticles, getBlogArticlesForStudy } from "./blog-generator";
import { generateContentSuggestion, generateTitleSuggestions, SuggestionType } from "./blog-content-helper";
import { 
  generateChatResponse, 
  validateQuery, 
  getConversationHistory, 
  getUserConversations, 
  saveFeedback, 
  getPopularQuestions 
} from "./chat-bot";
import { setupVectorExtension, processStudyForVectorDB, processAllStudiesForVectorDB, semanticSearch } from "./vector-database";
import { sendContactEmail } from "./sendgrid";
import { getSuggestionOptions, generateResearchSuggestions } from "./research-suggestions";
import { db } from "./db";
import { eq, desc, or, asc, ilike, sql } from "drizzle-orm";
import educationalRoutes from "./routes/educational";
import scraperRoutes from "./routes/scraper-routes";
import importRoutes from "./routes/import-routes";
import hydrogenImportRoutes from "./routes/hydrogen-import";
import excelAnalysisRoutes from "./routes/excel-analysis";
import minimalImportRoutes from "./routes/minimal-import";
import researchRoutes from "./routes/research-routes";
import unifiedResearchRoutes from "./routes/research-unified-routes";
import studyDetailsRoutes from "./routes/study-details";
import europePmcRoutes from "./routes/europepmc-routes";
import semanticScholarRoutes from "./routes/semantic-scholar-routes";
import crossrefRoutes from "./routes/crossref-routes";
import journalDateRoutes from "./routes/journal-date-routes";
import researchUnifiedRoutes from "./routes/research-unified-routes";
import doiEnhancementRoutes from "./routes/doi-enhancement-routes";
import contentEnrichmentRoutes from "./routes/content-enrichment-routes";
import batchEnrichmentRoutes from "./routes/batch-enrichment-routes";
import hydrogenRoutes from "./routes/hydrogen-routes";
import insightCardRoutes from "./routes/insight-card-routes";
import enhancedEnrichmentRoutes from "./routes/enhanced-enrichment-routes";
import keywordMonitorRoutes from "./routes/keyword-monitor-routes";
import keywordMonitorScheduleRoutes from "./routes/keyword-monitor-schedule-routes";

import { generateStandardizedSummary, updateStudyWithStandardizedSummary } from "../shared/schema-updates";
import { generateImageForStudy, batchGenerateImagesForStudies, findStudiesNeedingImages } from "./image-generator";

export async function registerRoutes(app: Express): Promise<Server> {
  // We've moved table initialization to the main server startup process
  // This avoids redundant operations on each startup and improves performance
  
  // Register the educational routes
  app.use('/api', educationalRoutes);
  
  // Register the scraper routes for multi-platform research monitoring
  app.use('/api', scraperRoutes);
  
  // Register import routes for Excel and other data sources
  app.use('/api', importRoutes);
  
  // Register hydrogen database import route
  app.use('/api', hydrogenImportRoutes);
  
  // Register Excel analysis routes for field mapping
  app.use('/api', excelAnalysisRoutes);
  
  // Register minimal import routes with PubMed enrichment
  app.use('/api', minimalImportRoutes);
  
  // Register research article search and discovery routes
  app.use('/api', researchRoutes);
  
  // Register unified search routes for multi-source searches
  app.use('/api', unifiedResearchRoutes);
  
  // External API routes for journal date functionality
  app.use('', europePmcRoutes);
  app.use('', semanticScholarRoutes);
  app.use('/api/crossref', crossrefRoutes);
  app.use('/api/admin', journalDateRoutes);
  
  // Register DOI enhancement routes for improving study data quality
  app.use('/api/doi', doiEnhancementRoutes);
  
  // Register content enrichment routes to fix truncated abstracts
  app.use('/api/content-enrichment', contentEnrichmentRoutes);
  
  // Register batch enrichment routes for processing multiple studies
  app.use('/api/enrichment/batch', batchEnrichmentRoutes);
  
  // Register enhanced batch enrichment routes
  app.use('/api/enhanced-enrichment', contentEnrichmentRoutes);
  
  // Register hydrogen organization routes for the new structure
  app.use('', hydrogenRoutes);
  
  // Register insight card routes for sharing research findings
  app.use('/api', insightCardRoutes);
  
  // Register keyword monitoring routes for automated study searching
  app.use('/api/keywords', keywordMonitorRoutes);
  
  // Register keyword monitor schedule routes for automated search scheduling
  app.use('/api/keywords/monitor/schedule', keywordMonitorScheduleRoutes);
  
  // Research suggestions routes are implemented directly in this file
  
  // API routes
  
  // Studies routes
  app.get("/api/studies", async (req, res) => {
    try {
      const { 
        // Basic filters
        query, 
        keyword, 
        author, 
        yearFrom, 
        yearTo, 
        category,
        
        // Enhanced UI filters
        isPeerReviewed,
        hasHealthImplications,
        hasMedia,
        dateFrom,
        dateTo,
        
        // Pagination and sorting
        page,
        pageSize,
        sortField,
        sortOrder,
        sortBy, // Legacy support
        
        // Advanced filters
        healthConditions,
        bodySystems,
        studyType,
        country,
        region,
        journal,
        hasFullText,
        
        // New enhanced search parameters
        useFuzzyMatch,
        searchInMethods,
        searchInResults,
        searchInConclusion, 
        searchInSimplified,
        enrichmentStatus,
        tags,
        excludeTerms,
        
        // Legacy support
        peerReviewed
      } = req.query;
      
      console.log("Search query parameters:", { 
        query, 
        keyword, 
        author, 
        yearFrom, 
        yearTo, 
        category, 
        sortBy,
        // Log advanced options
        useFuzzyMatch,
        enrichmentStatus,
        tags: tags ? typeof tags === 'string' ? tags.split(',') : tags : undefined
      });
      
      // Process query parameter for text search
      let processedQuery: string | undefined;
      if (query) {
        processedQuery = query as string;
        console.log("Using search query:", processedQuery);
      }
      
      // Process array fields that come as strings
      let processedHealthConditions: string[] | undefined;
      let processedBodySystems: string[] | undefined;
      let processedStudyType: string[] | undefined;
      let processedCountry: string[] | undefined;
      let processedRegion: string[] | undefined;
      
      if (healthConditions) {
        try {
          if (typeof healthConditions === 'string') {
            processedHealthConditions = JSON.parse(healthConditions);
          }
        } catch (e) {
          console.error("Error parsing healthConditions:", e);
        }
      }
      
      if (bodySystems) {
        try {
          if (typeof bodySystems === 'string') {
            processedBodySystems = JSON.parse(bodySystems);
          }
        } catch (e) {
          console.error("Error parsing bodySystems:", e);
        }
      }
      
      if (studyType) {
        try {
          if (typeof studyType === 'string') {
            processedStudyType = JSON.parse(studyType);
          }
        } catch (e) {
          console.error("Error parsing studyType:", e);
        }
      }
      
      if (country) {
        try {
          if (typeof country === 'string') {
            processedCountry = JSON.parse(country);
          }
        } catch (e) {
          console.error("Error parsing country:", e);
        }
      }
      
      if (region) {
        try {
          if (typeof region === 'string') {
            processedRegion = JSON.parse(region);
          }
        } catch (e) {
          console.error("Error parsing region:", e);
        }
      }
      
      // Process boolean values that come as strings
      const processedIsPeerReviewed = isPeerReviewed === undefined 
        ? undefined 
        : isPeerReviewed === "true" 
          ? true 
          : isPeerReviewed === "false" 
            ? false 
            : null;
            
      const processedHasHealthImplications = hasHealthImplications === undefined 
        ? undefined 
        : hasHealthImplications === "true" 
          ? true 
          : hasHealthImplications === "false" 
            ? false 
            : null;
            
      const processedHasMedia = hasMedia === undefined 
        ? undefined 
        : hasMedia === "true" 
          ? true 
          : hasMedia === "false" 
            ? false 
            : null;
            
      const processedHasFullText = hasFullText === "true";
      
      // For backward compatibility
      const processedPeerReviewed = peerReviewed === "true";
      
      // Process the new search parameters
      const processedUseFuzzyMatch = useFuzzyMatch === "true";
      const processedSearchInMethods = searchInMethods !== "false";
      const processedSearchInResults = searchInResults !== "false";
      const processedSearchInConclusion = searchInConclusion !== "false";
      const processedSearchInSimplified = searchInSimplified !== "false";
      const processedEnrichmentStatus = enrichmentStatus as "basic" | "partial" | "complete" | undefined;
      
      // Process tags array
      let processedTags: string[] | undefined;
      if (tags) {
        if (typeof tags === 'string') {
          processedTags = tags.split(',').map(tag => tag.trim());
        }
      }
      
      // Process exclude terms array
      let processedExcludeTerms: string[] | undefined;
      if (excludeTerms) {
        if (typeof excludeTerms === 'string') {
          processedExcludeTerms = excludeTerms.split(',').map(term => term.trim());
        }
      }
      
      const studies = await storage.getStudies({
        // Basic filters
        query: processedQuery,
        keyword: keyword as string,
        author: author as string,
        yearFrom: yearFrom as string,
        yearTo: yearTo as string,
        category: category as string,
        
        // Enhanced UI filters
        isPeerReviewed: processedIsPeerReviewed,
        hasHealthImplications: processedHasHealthImplications,
        hasMedia: processedHasMedia,
        dateFrom: dateFrom as string,
        dateTo: dateTo as string,
        
        // Pagination and sorting
        page: page as string,
        pageSize: pageSize as string,
        sortField: sortField as string,
        sortOrder: sortOrder as 'asc' | 'desc',
        sortBy: sortBy as string, // Legacy support
        
        // Advanced filters
        healthConditions: processedHealthConditions,
        bodySystems: processedBodySystems,
        studyType: processedStudyType,
        country: processedCountry,
        region: processedRegion,
        journal: journal ? [journal as string] : undefined,
        hasFullText: processedHasFullText,
        
        // New enhanced search features
        useFuzzyMatch: processedUseFuzzyMatch,
        searchInMethods: processedSearchInMethods,
        searchInResults: processedSearchInResults,
        searchInConclusion: processedSearchInConclusion,
        searchInSimplified: processedSearchInSimplified,
        enrichmentStatus: processedEnrichmentStatus,
        tags: processedTags,
        excludeTerms: processedExcludeTerms,
        
        // Legacy support
        peerReviewed: processedPeerReviewed
      });
      
      res.json(studies);
    } catch (error) {
      console.error("Error fetching studies:", error);
      res.status(500).json({ message: "Failed to fetch studies" });
    }
  });
  
  app.get("/api/studies/latest", async (req, res) => {
    try {
      const studies = await storage.getLatestStudies();
      res.json(studies);
    } catch (error) {
      console.error("Error fetching latest studies:", error);
      res.status(500).json({ message: "Failed to fetch latest studies" });
    }
  });
  
  app.get("/api/studies/:id", async (req, res) => {
    try {
      const { id } = req.params;
      
      // Validate ID format with regex before parsing
      if (!id || !/^\d+$/.test(id)) {
        return res.status(400).json({ 
          success: false, 
          message: "Invalid study ID format. Please provide a numeric ID." 
        });
      }
      
      const studyId = parseInt(id);
      
      // Additional validation after parsing
      if (isNaN(studyId) || studyId <= 0) {
        return res.status(400).json({ 
          success: false, 
          message: "Invalid study ID value. Please provide a positive integer." 
        });
      }
      
      const study = await storage.getStudyById(studyId);
      
      if (!study) {
        return res.status(404).json({ 
          success: false, 
          message: "Study not found" 
        });
      }
      
      res.json(study);
    } catch (error) {
      console.error("Error fetching study:", error);
      res.status(500).json({ 
        success: false, 
        message: "Failed to fetch study" 
      });
    }
  });
  
  // Get related studies
  app.get("/api/studies/:id/related", async (req, res) => {
    try {
      const { id } = req.params;
      
      // Validate ID format with regex before parsing
      if (!id || !/^\d+$/.test(id)) {
        return res.status(400).json({ 
          success: false, 
          message: "Invalid study ID format. Please provide a numeric ID." 
        });
      }
      
      const studyId = parseInt(id);
      
      // Additional validation after parsing
      if (isNaN(studyId) || studyId <= 0) {
        return res.status(400).json({ 
          success: false, 
          message: "Invalid study ID value. Please provide a positive integer." 
        });
      }
      
      const study = await storage.getStudyById(studyId);
      
      if (!study) {
        return res.status(404).json({ 
          success: false, 
          message: "Study not found" 
        });
      }
      
      // Get studies in the same category with validation
      const relatedStudies = await storage.getStudies({
        category: study.category || 'general' // Provide fallback if category is missing
      });
      
      // Ensure relatedStudies.data exists and is an array before filtering
      const studiesData = relatedStudies.data || [];
      
      // Remove the current study from the results
      const filteredStudies = Array.isArray(studiesData) 
        ? studiesData.filter((s: any) => s && s.id !== studyId)
        : [];
      
      // Sort based on relevance to the current study (using title and abstract similarity)
      const scoredStudies = filteredStudies.map((relatedStudy: any) => {
        let score = 0;
        
        // Safely access properties with validation
        const studyTitle = (study.title || '').toLowerCase();
        const relatedTitle = (relatedStudy.title || '').toLowerCase();
        const relatedAbstract = (relatedStudy.abstract || '').toLowerCase();
        
        // Give points for matching keywords in title
        const titleWords = studyTitle.split(/\s+/).filter(word => word.length > 3);
        for (const word of titleWords) {
          if (relatedTitle.includes(word)) {
            score += 2;
          }
          if (relatedAbstract.includes(word)) {
            score += 1;
          }
        }
        
        // Give points for matching authors
        if (study.authors && relatedStudy.authors && study.authors === relatedStudy.authors) {
          score += 3;
        }
        
        // Give points for similar publication date (same year)
        try {
          const studyYear = new Date(study.publishDate).getFullYear();
          const relatedYear = new Date(relatedStudy.publishDate).getFullYear();
          
          if (!isNaN(studyYear) && !isNaN(relatedYear) && studyYear === relatedYear) {
            score += 1;
          }
        } catch (dateError) {
          // Silently ignore date parsing errors
        }
        
        return { ...relatedStudy, relevanceScore: score };
      });
      
      // Sort by relevance score (highest first) and return top 5
      const sortedRelated = scoredStudies
        .sort((a: any, b: any) => b.relevanceScore - a.relevanceScore)
        .slice(0, 5);
      
      res.json(sortedRelated);
    } catch (error) {
      console.error("Error fetching related studies:", error);
      res.status(500).json({ 
        success: false, 
        message: "Failed to fetch related studies" 
      });
    }
  });
  
  app.post("/api/studies", async (req, res) => {
    try {
      const validatedData = insertStudySchema.parse(req.body);
      const study = await storage.createStudy(validatedData);
      res.status(201).json(study);
    } catch (error) {
      if (error instanceof ZodError) {
        const validationError = fromZodError(error);
        return res.status(400).json({ message: validationError.message });
      }
      console.error("Error creating study:", error);
      res.status(500).json({ message: "Failed to create study" });
    }
  });
  
  // Categories routes
  app.get("/api/categories", async (req, res) => {
    try {
      const categories = await storage.getCategories();
      res.json(categories);
    } catch (error) {
      console.error("Error fetching categories:", error);
      res.status(500).json({ message: "Failed to fetch categories" });
    }
  });
  
  app.get("/api/categories/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const categoryId = parseInt(id);
      
      // Validate that id is a valid number
      if (isNaN(categoryId)) {
        return res.status(400).json({ message: "Invalid category ID" });
      }
      
      const category = await storage.getCategoryById(categoryId);
      
      if (!category) {
        return res.status(404).json({ message: "Category not found" });
      }
      
      res.json(category);
    } catch (error) {
      console.error("Error fetching category:", error);
      res.status(500).json({ message: "Failed to fetch category" });
    }
  });
  
  app.post("/api/categories", async (req, res) => {
    try {
      const validatedData = insertCategorySchema.parse(req.body);
      const category = await storage.createCategory(validatedData);
      res.status(201).json(category);
    } catch (error) {
      if (error instanceof ZodError) {
        const validationError = fromZodError(error);
        return res.status(400).json({ message: validationError.message });
      }
      console.error("Error creating category:", error);
      res.status(500).json({ message: "Failed to create category" });
    }
  });
  
  // Newsletter subscription route
  app.post("/api/newsletter/subscribe", async (req, res) => {
    try {
      // Initial validation of request body
      if (!req.body || typeof req.body !== 'object') {
        return res.status(400).json({
          success: false,
          message: "Invalid request format. Please provide a valid subscription request."
        });
      }
      
      // Validate email format first for clearer errors
      if (!req.body.email || typeof req.body.email !== 'string') {
        return res.status(400).json({
          success: false,
          message: "Email is required for newsletter subscription"
        });
      }
      
      // Email format validation
      const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
      if (!emailRegex.test(req.body.email)) {
        return res.status(400).json({
          success: false,
          message: "Please provide a valid email address"
        });
      }
      
      // Full schema validation
      try {
        const validatedData = insertNewsletterSchema.parse(req.body);
        const subscription = await storage.subscribeNewsletter(validatedData);
        
        res.status(201).json({
          success: true,
          data: subscription,
          message: "Successfully subscribed to newsletter"
        });
      } catch (zodError) {
        if (zodError instanceof ZodError) {
          const validationError = fromZodError(zodError);
          return res.status(400).json({
            success: false,
            message: validationError.message
          });
        }
        throw zodError; // Re-throw if it's not a ZodError
      }
    } catch (error) {
      console.error("Error subscribing to newsletter:", error);
      res.status(500).json({
        success: false,
        message: "Failed to subscribe to newsletter"
      });
    }
  });
  
  // Contact form submission route
  app.post("/api/contact", async (req, res) => {
    try {
      // Initial validation of request body
      if (!req.body || typeof req.body !== 'object') {
        return res.status(400).json({
          success: false,
          message: "Invalid request format. Please provide a valid contact form."
        });
      }

      // Schema validation with detailed error handling
      try {
        const validatedData = insertContactSchema.parse(req.body);
        
        // Additional email format validation
        const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
        if (!emailRegex.test(validatedData.email)) {
          return res.status(400).json({
            success: false,
            message: "Please provide a valid email address"
          });
        }
        
        // Send email using SendGrid
        const emailSent = await sendContactEmail({
          name: validatedData.name,
          email: validatedData.email,
          subject: req.body.subject || "Contact Form Submission", // Handle missing subject
          message: validatedData.message
        });
        
        if (!emailSent) {
          return res.status(500).json({
            success: false,
            message: "Failed to send email. Please try again later."
          });
        }
        
        // Store in database if that function exists
        if (typeof storage.submitContactMessage === 'function') {
          try {
            await storage.submitContactMessage({
              name: validatedData.name,
              email: validatedData.email,
              message: validatedData.message,
              subject: req.body.subject || "Contact Form Submission"
            });
          } catch (dbError) {
            console.warn("Failed to store contact message in database, but email was sent:", dbError);
            // Continue execution since the email was sent successfully
          }
        }
        
        res.status(201).json({
          success: true,
          message: "Your message has been sent successfully!"
        });
      } catch (zodError) {
        if (zodError instanceof ZodError) {
          const validationError = fromZodError(zodError);
          return res.status(400).json({
            success: false,
            message: validationError.message
          });
        }
        throw zodError; // Re-throw if it's not a ZodError
      }
    } catch (error) {
      console.error("Error submitting contact form:", error);
      res.status(500).json({
        success: false,
        message: "Failed to submit contact form"
      });
    }
  });
  
  // Admin routes for importing and managing studies
  app.post("/api/admin/scrape", async (req, res) => {
    try {
      const { scrapeHydrogenStudies } = await import('./scraper');
      const result = await scrapeHydrogenStudies();
      res.status(200).json(result);
    } catch (error) {
      console.error("Error scraping hydrogen studies:", error);
      res.status(500).json({ message: "Failed to scrape studies", error: error.message });
    }
  });
  
  app.post("/api/admin/import", async (req, res) => {
    try {
      // Extract file data and type
      const fileData = req.body.file;
      const fileType = req.body.fileType;
      const googleSheetUrl = req.body.googleSheetUrl;
      
      // Import from Google Sheets
      if (googleSheetUrl) {
        const { importStudiesFromGoogleSheets } = await import('./import');
        const result = await importStudiesFromGoogleSheets(googleSheetUrl);
        return res.status(200).json(result);
      }
      
      // Import from file upload
      if (!fileData || !fileType) {
        return res.status(400).json({ message: "Missing file data or file type" });
      }
      
      // Process based on file type
      const { 
        importStudiesFromJson, 
        importStudiesFromCsv, 
        importStudiesFromExcel 
      } = await import('./import');
      
      let result;
      
      // Create a temporary file path
      const tempFilePath = path.join(__dirname, `temp_import.${fileType}`);
      
      // Write the file data to a temporary file
      fs.writeFileSync(tempFilePath, fileData);
      
      if (fileType === 'json') {
        result = await importStudiesFromJson(tempFilePath);
      } else if (fileType === 'csv') {
        result = await importStudiesFromCsv(tempFilePath);
      } else if (fileType === 'xlsx' || fileType === 'xls') {
        result = await importStudiesFromExcel(tempFilePath);
      } else {
        // Clean up temp file
        fs.unlinkSync(tempFilePath);
        return res.status(400).json({ message: "Invalid file type" });
      }
      
      // Clean up temp file
      fs.unlinkSync(tempFilePath);
      
      res.status(200).json(result);
    } catch (error) {
      console.error("Error importing studies:", error);
      res.status(500).json({ message: "Failed to import studies", error: error.message });
    }
  });
  
  // Media upload endpoint for studies
  app.post("/api/studies/:id/media", upload.single('file'), async (req, res) => {
    try {
      const { id } = req.params;
      const studyId = parseInt(id);
      
      // Validate that id is a valid number
      if (isNaN(studyId)) {
        return res.status(400).json({ message: "Invalid study ID" });
      }
      
      const study = await storage.getStudyById(studyId);
      
      if (!study) {
        return res.status(404).json({ message: "Study not found" });
      }
      
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }
      
      // Determine file type
      const fileType = getFileType(req.file.mimetype);
      
      if (!fileType) {
        return res.status(400).json({ message: "Unsupported file type" });
      }
      
      // Generate the URL for the uploaded file
      const publicUrl = `/uploads/${req.file.filename}`;
      
      // Update study with the new media URL
      let updateData: any = {};
      
      if (fileType === 'image') {
        updateData = { 
          imageUrl: publicUrl, 
          imageAlt: req.body.imageAlt || `Image for ${study.title}`,
          autoGeneratedImage: false
        };
      } else if (fileType === 'video') {
        updateData = { videoUrl: publicUrl };
      } else if (fileType === 'audio') {
        updateData = { audioUrl: publicUrl };
      }
      
      const updatedStudy = await storage.updateStudy(studyId, updateData);
      res.status(200).json({ 
        message: "Media uploaded successfully", 
        study: updatedStudy,
        mediaUrl: publicUrl,
        fileType
      });
    } catch (error) {
      console.error("Error uploading media for study:", error);
      res.status(500).json({ message: "Failed to upload media", error: error.message });
    }
  });
  
  // CRUD operations for studies
  app.put("/api/studies/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const studyId = parseInt(id);
      
      // Validate that id is a valid number
      if (isNaN(studyId)) {
        return res.status(400).json({ message: "Invalid study ID" });
      }
      
      const study = await storage.getStudyById(studyId);
      
      if (!study) {
        return res.status(404).json({ message: "Study not found" });
      }
      
      const validatedData = req.body; // We could add validation here
      const updatedStudy = await storage.updateStudy(studyId, validatedData);
      res.status(200).json(updatedStudy);
    } catch (error) {
      console.error("Error updating study:", error);
      res.status(500).json({ message: "Failed to update study", error: error.message });
    }
  });
  
  app.delete("/api/studies/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const studyId = parseInt(id);
      
      // Validate that id is a valid number
      if (isNaN(studyId)) {
        return res.status(400).json({ message: "Invalid study ID" });
      }
      
      const study = await storage.getStudyById(studyId);
      
      if (!study) {
        return res.status(404).json({ message: "Study not found" });
      }
      
      await storage.deleteStudy(studyId);
      res.status(200).json({ message: "Study deleted successfully" });
    } catch (error) {
      console.error("Error deleting study:", error);
      res.status(500).json({ message: "Failed to delete study", error: error.message });
    }
  });
  
  // Blog article routes
  
  // Create new blog article
  app.post("/api/blogs", async (req, res) => {
    try {
      const validatedData = insertBlogArticleSchema.parse(req.body);
      
      // Create the blog article
      const [newBlog] = await db.insert(blogArticles)
        .values({
          ...validatedData,
          updatedAt: new Date(),
          viewCount: 0
        })
        .returning();
      
      res.status(201).json(newBlog);
    } catch (error) {
      if (error instanceof ZodError) {
        const validationError = fromZodError(error);
        return res.status(400).json({ message: validationError.message });
      }
      console.error("Error creating blog article:", error);
      res.status(500).json({ message: "Failed to create blog article", error: error.message });
    }
  });
  
  // Update existing blog article
  app.put("/api/blogs/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const [blog] = await db.select().from(blogArticles).where(eq(blogArticles.id, parseInt(id)));
      
      if (!blog) {
        return res.status(404).json({ message: "Blog article not found" });
      }
      
      // Validate the request data
      const validatedData = req.body;
      
      // Update the blog article
      const [updatedBlog] = await db.update(blogArticles)
        .set({
          ...validatedData,
          updatedAt: new Date()
        })
        .where(eq(blogArticles.id, parseInt(id)))
        .returning();
      
      res.status(200).json(updatedBlog);
    } catch (error) {
      console.error("Error updating blog article:", error);
      res.status(500).json({ message: "Failed to update blog article", error: error.message });
    }
  });
  
  // Delete blog article
  app.delete("/api/blogs/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const blogId = parseInt(id);
      
      // Validate that id is a valid number
      if (isNaN(blogId)) {
        return res.status(400).json({ message: "Invalid blog ID" });
      }
      
      const [blog] = await db.select().from(blogArticles).where(eq(blogArticles.id, blogId));
      
      if (!blog) {
        return res.status(404).json({ message: "Blog article not found" });
      }
      
      // Delete the blog article
      await db.delete(blogArticles).where(eq(blogArticles.id, blogId));
      
      res.status(200).json({ message: "Blog article deleted successfully" });
    } catch (error) {
      console.error("Error deleting blog article:", error);
      res.status(500).json({ message: "Failed to delete blog article", error: error.message });
    }
  });
  
  // Media upload endpoint for blog articles
  app.post("/api/blogs/:id/media", upload.single('file'), async (req, res) => {
    try {
      const { id } = req.params;
      const blogId = parseInt(id);
      
      // Validate that id is a valid number
      if (isNaN(blogId)) {
        return res.status(400).json({ message: "Invalid blog ID" });
      }
      
      const [blog] = await db.select().from(blogArticles).where(eq(blogArticles.id, blogId));
      
      if (!blog) {
        return res.status(404).json({ message: "Blog article not found" });
      }
      
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }
      
      // Determine file type
      const fileType = getFileType(req.file.mimetype);
      
      if (!fileType || fileType !== 'image') {
        return res.status(400).json({ message: "Only image files are supported for blog articles" });
      }
      
      // Generate the URL for the uploaded file
      const publicUrl = `/uploads/${req.file.filename}`;
      
      // Update blog with the new image URL
      await db.update(blogArticles)
        .set({ 
          imageUrl: publicUrl,
          imageAlt: req.body.imageAlt || `Image for ${blog.title}`
        })
        .where(eq(blogArticles.id, blogId));
      
      // Get the updated blog
      const [updatedBlog] = await db.select().from(blogArticles).where(eq(blogArticles.id, blogId));
      
      res.status(200).json({ 
        message: "Media uploaded successfully", 
        blog: updatedBlog,
        mediaUrl: publicUrl
      });
    } catch (error) {
      console.error("Error uploading media for blog:", error);
      res.status(500).json({ message: "Failed to upload media", error: error.message });
    }
  });
  
  // Get all blog articles
  app.get("/api/blogs", async (req, res) => {
    try {
      // Extract query parameters with defaults
      const page = parseInt(req.query.page as string) || 1;
      const pageSize = parseInt(req.query.pageSize as string) || 10;
      const searchQuery = (req.query.searchQuery as string) || '';
      const articleType = (req.query.articleTypeFilter as string) || '';
      const publishedFilter = (req.query.publishedFilter as string) || '';
      const status = (req.query.status as string) || 'all';
      const sortField = (req.query.sortField as string) || 'createdAt';
      const sortOrder = (req.query.sortOrder as string) || 'desc';

      // Calculate offset based on pagination
      const offset = (page - 1) * pageSize;
      
      // Start building the base query
      let query = db.select({
        id: blogArticles.id,
        title: blogArticles.title,
        summary: blogArticles.summary,
        studyId: blogArticles.studyId,
        imageUrl: blogArticles.imageUrl,
        imageAlt: blogArticles.imageAlt,
        isPublished: blogArticles.isPublished,
        readingLevel: blogArticles.readingLevel,
        articleType: blogArticles.articleType,
        viewCount: blogArticles.viewCount,
        createdAt: blogArticles.createdAt,
        updatedAt: blogArticles.updatedAt,
        content: blogArticles.content,
        slug: blogArticles.slug
      }).from(blogArticles);
      
      // Add search filter if provided
      if (searchQuery) {
        query = query.where(
          or(
            ilike(blogArticles.title, `%${searchQuery}%`),
            ilike(blogArticles.summary, `%${searchQuery}%`),
            ilike(blogArticles.content, `%${searchQuery}%`)
          )
        );
      }
      
      // Filter by article type if provided
      if (articleType && articleType !== 'all') {
        query = query.where(
          ilike(blogArticles.articleType, `%${articleType}%`)
        );
      }
      
      // Filter by published status
      if (publishedFilter === 'published') {
        query = query.where(eq(blogArticles.isPublished, true));
      } else if (publishedFilter === 'unpublished') {
        query = query.where(eq(blogArticles.isPublished, false));
      }
      
      // Filter by status tab
      if (status === 'published') {
        query = query.where(eq(blogArticles.isPublished, true));
      } else if (status === 'unpublished') {
        query = query.where(eq(blogArticles.isPublished, false));
      } else if (status === 'draft') {
        // For drafts, we could have a specific field in the future
        // For now, just show unpublished
        query = query.where(eq(blogArticles.isPublished, false));
      }
      
      // Count total matching rows for pagination
      const countQuery = db.select({ count: sql<number>`count(*)` }).from(blogArticles);
      
      // Apply the same filters to the count query
      if (searchQuery) {
        countQuery.where(
          or(
            ilike(blogArticles.title, `%${searchQuery}%`),
            ilike(blogArticles.summary, `%${searchQuery}%`),
            ilike(blogArticles.content, `%${searchQuery}%`)
          )
        );
      }
      
      if (articleType && articleType !== 'all') {
        countQuery.where(
          ilike(blogArticles.articleType, `%${articleType}%`)
        );
      }
      
      if (publishedFilter === 'published') {
        countQuery.where(eq(blogArticles.isPublished, true));
      } else if (publishedFilter === 'unpublished') {
        countQuery.where(eq(blogArticles.isPublished, false));
      }
      
      if (status === 'published') {
        countQuery.where(eq(blogArticles.isPublished, true));
      } else if (status === 'unpublished') {
        countQuery.where(eq(blogArticles.isPublished, false));
      } else if (status === 'draft') {
        countQuery.where(eq(blogArticles.isPublished, false));
      }
      
      const [{ count }] = await countQuery;
      
      // Apply sorting
      if (sortField === 'createdAt') {
        query = query.orderBy(sortOrder === 'asc' ? asc(blogArticles.createdAt) : desc(blogArticles.createdAt));
      } else if (sortField === 'updatedAt') {
        query = query.orderBy(sortOrder === 'asc' ? asc(blogArticles.updatedAt) : desc(blogArticles.updatedAt));
      } else if (sortField === 'title') {
        query = query.orderBy(sortOrder === 'asc' ? asc(blogArticles.title) : desc(blogArticles.title));
      } else if (sortField === 'viewCount') {
        query = query.orderBy(sortOrder === 'asc' ? asc(blogArticles.viewCount) : desc(blogArticles.viewCount));
      } else {
        // Default sort by createdAt desc
        query = query.orderBy(desc(blogArticles.createdAt));
      }
      
      // Apply pagination
      query = query.limit(pageSize).offset(offset);
      
      // Execute the query
      const blogs = await query;
      
      // Return paginated results with metadata
      res.json({
        data: blogs,
        totalCount: count,
        currentPage: page,
        pageSize: pageSize,
        totalPages: Math.ceil(count / pageSize)
      });
    } catch (error) {
      console.error("Error fetching blogs:", error);
      res.status(500).json({ message: "Failed to fetch blogs" });
    }
  });
  
  // Get blog article by ID
  app.get("/api/blogs/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const blogId = parseInt(id);
      
      // Validate that id is a valid number
      if (isNaN(blogId)) {
        return res.status(400).json({ message: "Invalid blog ID" });
      }
      
      const [blog] = await db.select().from(blogArticles).where(eq(blogArticles.id, blogId));
      
      if (!blog) {
        return res.status(404).json({ message: "Blog article not found" });
      }
      
      // Increment view count
      await db.update(blogArticles)
        .set({ viewCount: blog.viewCount + 1 })
        .where(eq(blogArticles.id, blogId));
      
      res.json(blog);
    } catch (error) {
      console.error("Error fetching blog:", error);
      res.status(500).json({ message: "Failed to fetch blog article" });
    }
  });
  
  // Generate image for blog article
  app.post("/api/blogs/:id/generate-image", async (req, res) => {
    try {
      const { id } = req.params;
      const blogId = parseInt(id);
      
      // Validate that id is a valid number
      if (isNaN(blogId)) {
        return res.status(400).json({ message: "Invalid blog ID" });
      }
      
      const [blog] = await db.select().from(blogArticles).where(eq(blogArticles.id, blogId));
      
      if (!blog) {
        return res.status(404).json({ message: "Blog article not found" });
      }
      
      // Generate image using AI
      const imageResult = await generateBlogImage(blog);
      
      // Update blog with image data
      const updatedBlog = await db.update(blogArticles)
        .set({
          imageUrl: imageResult.imageUrl,
          imageAlt: imageResult.imageAlt,
          updatedAt: new Date()
        })
        .where(eq(blogArticles.id, blogId))
        .returning();
      
      res.json({
        message: "Blog image generated successfully",
        imageUrl: imageResult.imageUrl,
        imageAlt: imageResult.imageAlt,
        blog: updatedBlog[0]
      });
    } catch (error) {
      console.error("Error generating blog image:", error);
      res.status(500).json({ message: "Failed to generate blog image", error: error.message });
    }
  });
  
  // Get blog articles for a specific study
  app.get("/api/studies/:id/blogs", async (req, res) => {
    try {
      const { id } = req.params;
      const studyId = parseInt(id);
      
      // Validate that id is a valid number
      if (isNaN(studyId)) {
        return res.status(400).json({ message: "Invalid study ID" });
      }
      
      const studyBlogs = await getBlogArticlesForStudy(studyId);
      res.json(studyBlogs);
    } catch (error) {
      console.error("Error fetching study blogs:", error);
      res.status(500).json({ message: "Failed to fetch study blog articles" });
    }
  });
  
  // Generate content suggestions for a blog article
  app.post("/api/blogs/:id/generate-suggestion", async (req, res) => {
    try {
      const { id } = req.params;
      const blogId = parseInt(id);
      
      // Validate that id is a valid number
      if (isNaN(blogId)) {
        return res.status(400).json({ message: "Invalid blog ID" });
      }
      
      const { suggestionType, selectedContent } = req.body;
      
      const validSuggestionTypes = ['improve', 'expand', 'simplify', 'add_examples', 'add_research_context', 'elon_style', 'add_conclusion'];
      if (!suggestionType || !validSuggestionTypes.includes(suggestionType)) {
        return res.status(400).json({ message: "Invalid suggestion type" });
      }
      
      // Get the blog article
      const [blog] = await db.select().from(blogArticles).where(eq(blogArticles.id, blogId));
      
      if (!blog) {
        return res.status(404).json({ message: "Blog article not found" });
      }
      
      // Get related study if available
      let relatedStudy = null;
      if (blog.studyId) {
        relatedStudy = await storage.getStudyById(blog.studyId);
      }
      
      // Generate content suggestion
      const suggestion = await generateContentSuggestion(
        blog,
        suggestionType as SuggestionType,
        selectedContent,
        relatedStudy || undefined
      );
      
      res.json({
        message: "Content suggestion generated successfully",
        suggestion
      });
    } catch (error) {
      console.error("Error generating content suggestion:", error);
      res.status(500).json({ 
        message: "Failed to generate content suggestion", 
        error: error.message 
      });
    }
  });
  
  // Generate title suggestions for a blog article
  app.post("/api/blogs/:id/generate-titles", async (req, res) => {
    try {
      const { id } = req.params;
      const blogId = parseInt(id);
      
      // Validate that id is a valid number
      if (isNaN(blogId)) {
        return res.status(400).json({ message: "Invalid blog ID" });
      }
      
      // Get the blog article
      const [blog] = await db.select().from(blogArticles).where(eq(blogArticles.id, blogId));
      
      if (!blog) {
        return res.status(404).json({ message: "Blog article not found" });
      }
      
      // Generate title suggestions
      const suggestions = await generateTitleSuggestions(blog);
      
      res.json({
        message: "Title suggestions generated successfully",
        suggestions
      });
    } catch (error) {
      console.error("Error generating title suggestions:", error);
      res.status(500).json({ 
        message: "Failed to generate title suggestions", 
        error: error.message 
      });
    }
  });

  // Generate blog articles for a study
  app.post("/api/studies/:id/generate-blogs", async (req, res) => {
    try {
      const { id } = req.params;
      const studyId = parseInt(id);
      
      // Validate that id is a valid number
      if (isNaN(studyId)) {
        return res.status(400).json({ message: "Invalid study ID" });
      }
      
      const study = await storage.getStudyById(studyId);
      
      if (!study) {
        return res.status(404).json({ message: "Study not found" });
      }
      
      // Check if blog articles already exist for this study
      const existingBlogs = await getBlogArticlesForStudy(studyId);
      
      // If blogs exist and force regeneration is not requested, return existing blogs
      if (existingBlogs.length > 0 && !req.body.force) {
        return res.status(409).json({ 
          message: "Blog articles already exist for this study",
          blogs: existingBlogs
        });
      }
      
      // Extract generation options from request
      const options = {
        count: req.body.count || 5,
        includeElonStyle: req.body.includeElonStyle !== undefined ? req.body.includeElonStyle : true,
        standardCount: req.body.standardCount || 2,
        elonCount: req.body.elonCount || 3
      };
      
      // Generate blog articles with specified options
      const articles = await generateBlogArticlesForStudy(study, options);
      
      // Blog articles are already set as unpublished drafts in the blog-generator
      
      // Save blog articles to database
      const savedArticleIds = await saveBlogArticles(articles);
      
      // Fetch the saved articles
      const savedArticles = await Promise.all(
        savedArticleIds.map(async (id) => {
          const [article] = await db.select().from(blogArticles).where(eq(blogArticles.id, id));
          return article;
        })
      );
      
      res.status(201).json({
        message: "Blog articles generated successfully. Please review and publish when ready.",
        articles: savedArticles,
        count: savedArticles.length,
        status: "draft"
      });
    } catch (error) {
      console.error("Error generating blog articles:", error);
      res.status(500).json({ message: "Failed to generate blog articles" });
    }
  });
  
  // Media upload for a study
  app.post("/api/studies/:id/media", upload.single('file'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }
      
      const { id } = req.params;
      const study = await storage.getStudyById(parseInt(id));
      
      if (!study) {
        return res.status(404).json({ message: "Study not found" });
      }
      
      // Get file information
      const fileType = getFileType(req.file.mimetype);
      const relativeFilePath = `/uploads/${req.file.filename}`;
      
      // Update the study with the new media information
      let updateData: any = { autoGeneratedImage: false };
      
      if (fileType === 'image') {
        updateData.imageUrl = relativeFilePath;
        updateData.imageAlt = req.body.imageAlt || `Image for study: ${study.title}`;
      } else if (fileType === 'video') {
        updateData.videoUrl = relativeFilePath;
      } else if (fileType === 'audio') {
        updateData.audioUrl = relativeFilePath;
      }
      
      // Update the study record
      const updatedStudy = await storage.updateStudy(parseInt(id), updateData);
      
      res.status(200).json({
        message: "Media uploaded successfully",
        study: updatedStudy,
        file: {
          path: relativeFilePath,
          type: fileType
        }
      });
    } catch (error) {
      console.error("Error uploading media:", error);
      res.status(500).json({ message: "Failed to upload media" });
    }
  });
  
  // Auto-generate scientific image for a study
  app.post("/api/studies/:id/generate-image", async (req, res) => {
    try {
      const { id } = req.params;
      const studyId = parseInt(id);
      
      // Validate that id is a valid number
      if (isNaN(studyId)) {
        return res.status(400).json({ message: "Invalid study ID" });
      }
      
      const study = await storage.getStudyById(studyId);
      
      if (!study) {
        return res.status(404).json({ message: "Study not found" });
      }
      
      // Generate image using OpenAI
      const { imageUrl, imageAlt } = await generateScientificImage(study);
      
      // Update the study with the generated image
      const updatedStudy = await storage.updateStudy(studyId, {
        imageUrl,
        imageAlt,
        autoGeneratedImage: true
      });
      
      res.status(200).json({
        message: "Scientific image generated successfully",
        study: updatedStudy,
        image: {
          url: imageUrl,
          alt: imageAlt
        }
      });
    } catch (error) {
      console.error("Error generating scientific image:", error);
      res.status(500).json({ message: "Failed to generate scientific image" });
    }
  });
  
  // Generate standardized summary for a specific study
  app.post("/api/studies/:id/standardize-summary", async (req, res) => {
    try {
      const { id } = req.params;
      const studyId = parseInt(id, 10);
      
      if (isNaN(studyId)) {
        return res.status(400).json({ message: "Invalid study ID" });
      }
      
      const study = await storage.getStudyById(studyId);
      
      if (!study) {
        return res.status(404).json({ message: "Study not found" });
      }
      
      // Generate standardized summary from the study abstract
      const summaryObj = await generateStandardizedSummary(study);
      
      // Update the study with the standardized summary
      const updatedStudy = await updateStudyWithStandardizedSummary(studyId, summaryObj);
      
      res.json({ 
        success: true,
        message: "Successfully generated standardized summary", 
        study: updatedStudy 
      });
    } catch (error) {
      console.error("Error generating standardized summary:", error);
      res.status(500).json({ 
        success: false, 
        message: "Failed to generate standardized summary"
      });
    }
  });
  
  // Generate standardized summaries for all studies
  app.post("/api/studies/standardize-all-summaries", async (req, res) => {
    try {
      // Get all studies
      const studies = await storage.getStudies();
      const results: {
        total: number;
        success: number;
        failed: number;
        errors: Array<{studyId: number; error: string}>;
      } = {
        total: studies.length,
        success: 0,
        failed: 0,
        errors: []
      };
      
      // Process studies in batches to avoid overwhelming the server
      const batchSize = 10;
      for (let i = 0; i < studies.length; i += batchSize) {
        const batch = studies.slice(i, i + batchSize);
        
        // Process each study in the batch
        await Promise.all(batch.map(async (study) => {
          try {
            // Skip studies that already have standardized summaries
            if (study.objective && study.methodsShort && study.resultsShort && study.conclusionShort) {
              results.success++;
              return;
            }
            
            // Generate standardized summary object
            const summaryObj = await generateStandardizedSummary(study);
            
            // Update the study with the standardized summary
            await updateStudyWithStandardizedSummary(study.id, summaryObj);
            
            results.success++;
          } catch (error) {
            results.failed++;
            results.errors.push({
              studyId: study.id,
              error: String(error)
            });
          }
        }));
      }
      
      res.json({
        success: true,
        message: "Standardized summary generation completed",
        results
      });
    } catch (error) {
      console.error("Error generating standardized summaries for all studies:", error);
      res.status(500).json({
        success: false,
        message: "Failed to generate standardized summaries"
      });
    }
  });

  // Process studies for vector database (Admin only)
  app.post('/api/chat/process-studies', async (req, res) => {
    try {
      const { batchSize = 10 } = req.body;
      
      // Validate batch size
      if (isNaN(batchSize) || batchSize < 1 || batchSize > 50) {
        return res.status(400).json({
          success: false,
          message: 'Invalid batch size. Must be between 1 and 50.'
        });
      }
      
      // Process studies in batches
      const result = await processAllStudiesForVectorDB(batchSize);
      
      res.json({
        success: true,
        message: `Processed ${result.processed} of ${result.total} studies`,
        data: result
      });
    } catch (error) {
      console.error('Error processing studies for vector database:', error);
      res.status(500).json({
        success: false,
        message: 'An error occurred while processing studies for vector database'
      });
    }
  });
  
  // Test semantic search functionality (Admin only)
  app.post('/api/chat/test-search', async (req, res) => {
    try {
      const { query, limit = 5 } = req.body;
      
      // Validate input
      if (!query || typeof query !== 'string') {
        return res.status(400).json({
          success: false,
          message: 'Query is required and must be a string'
        });
      }
      
      // Perform semantic search
      const searchResults = await semanticSearch(query, limit);
      
      res.json({
        success: true,
        message: `Found ${searchResults.length} results for query "${query}"`,
        data: searchResults
      });
    } catch (error) {
      console.error('Error testing semantic search:', error);
      res.status(500).json({
        success: false,
        message: 'An error occurred while testing semantic search'
      });
    }
  });
  
  // Process a single study for vector database (Admin only)
  app.post('/api/chat/process-study/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const studyId = parseInt(id);
      
      // Validate study ID
      if (isNaN(studyId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid study ID'
        });
      }
      
      // Check if study exists
      const study = await storage.getStudyById(studyId);
      if (!study) {
        return res.status(404).json({
          success: false,
          message: `Study with ID ${studyId} not found`
        });
      }
      
      // Process the study
      const result = await processStudyForVectorDB(studyId);
      
      if (result) {
        res.json({
          success: true,
          message: `Successfully processed study ID ${studyId} for vector database`
        });
      } else {
        res.status(500).json({
          success: false,
          message: `Failed to process study ID ${studyId} for vector database`
        });
      }
    } catch (error) {
      console.error(`Error processing study for vector database:`, error);
      res.status(500).json({
        success: false,
        message: 'An error occurred while processing the study for vector database'
      });
    }
  });

  // Chat API endpoint with validation
  app.post('/api/chat', async (req, res) => {
    try {
      // Get user ID from session if authenticated
      const userId = req.session?.user?.id; 
      
      // Validate input
      const { query, conversationId } = req.body;
      
      // Check if query is provided and is a string
      if (!query || typeof query !== 'string' || query.trim() === '') {
        return res.status(400).json({
          success: false,
          message: 'Please provide a valid query string'
        });
      }
      
      try {
        // Validate that the query is about hydrogen health research
        const validation = await validateQuery(query);
        if (!validation.isValid) {
          return res.status(400).json({
            success: false,
            message: 'Your question does not appear to be related to hydrogen health and wellness. Please ask a question about health applications of hydrogen like hydrogen water, inhalation therapy, or hydrogen baths. We don\'t provide information about hydrogen energy, fuel cells, or industrial applications.',
            reason: validation.reason
          });
        }
        
        // Get conversation history if conversation ID is provided
        let conversationHistory = [];
        if (conversationId) {
          conversationHistory = await getConversationHistory(conversationId);
        }
        
        // Generate and return chat response with conversation context
        const response = await generateChatResponse(
          query,
          conversationId,
          userId
        );
        
        res.json({
          success: true,
          data: response
        });
      } catch (apiError) {
        console.error('API Error in chat processing:', apiError);
        
        // Fallback response with Echo Water product recommendations for health-related queries
        const lowerQuery = query.toLowerCase();
        
        // Simple keyword detection to provide relevant products when AI service is unavailable
        let productRecommendations = [];
        
        if (lowerQuery.includes('skin') || lowerQuery.includes('derma') || lowerQuery.includes('psoriasis') || 
            lowerQuery.includes('eczema') || lowerQuery.includes('acne')) {
          // Recommend bath system for skin conditions
          productRecommendations = [{
            name: "Echo H2 Bath System",
            description: "Advanced hydrogen bath system for full-body hydrogen therapy and skin health",
            url: "https://echowater.com/products/echo-h2-bath",
            imageUrl: "https://echowater.com/cdn/shop/products/echo-h2-bath.jpg"
          }];
        } else if (lowerQuery.includes('breath') || lowerQuery.includes('lung') || lowerQuery.includes('inhal') || 
                  lowerQuery.includes('respiratory') || lowerQuery.includes('asthma')) {
          // Recommend inhaler for respiratory conditions
          productRecommendations = [{
            name: "Echo H2 Inhaler",
            description: "Premium molecular hydrogen inhalation device for respiratory and systemic benefits",
            url: "https://echowater.com/products/echo-h2-inhaler",
            imageUrl: "https://echowater.com/cdn/shop/products/echo-h2-inhaler.jpg"
          }];
        } else if (lowerQuery.includes('travel') || lowerQuery.includes('portable') || lowerQuery.includes('tablet')) {
          // Recommend tablet maker for portable use
          productRecommendations = [{
            name: "Echo H2 Tablet Maker",
            description: "Convenient and portable hydrogen tablet maker for creating hydrogen-rich water on the go",
            url: "https://echowater.com/products/echo-h2-tablets-1",
            imageUrl: "https://echowater.com/cdn/shop/products/echo-h2-tablets.jpg"
          }];
        } else {
          // Default to water machine for general queries
          productRecommendations = [{
            name: "Echo H2 Machine",
            description: "Premium hydrogen water generator with advanced PEM technology for maximum hydrogen concentration",
            url: "https://echowater.com/products/echo-h2-machine",
            imageUrl: "https://echowater.com/cdn/shop/files/echo-h2-server-compressed-2_1024x1024.jpg"
          }];
        }
        
        res.json({
          success: true,
          data: {
            answer: "I'm sorry, but I'm having trouble accessing my knowledge base at the moment. Your question about hydrogen health appears to be related to " + 
                   (lowerQuery.includes('skin') ? "skin health and topical applications." : 
                    lowerQuery.includes('breath') ? "respiratory health and breathing applications." : 
                    lowerQuery.includes('travel') ? "portable hydrogen therapy solutions." : 
                    "general hydrogen health applications.") + 
                   " While I work to resolve this issue, I've included some product recommendations that might be helpful for your specific needs.",
            sources: [],
            relatedQuestions: [
              "What are the benefits of hydrogen water for inflammation?",
              "How does molecular hydrogen help with oxidative stress?",
              "What conditions can hydrogen therapy help with?",
              "How often should I use hydrogen therapy for best results?"
            ],
            conversationId,
            productRecommendations
          }
        });
      }
    } catch (error) {
      console.error('Error in chat endpoint:', error);
      res.status(500).json({
        success: false,
        message: 'An error occurred while processing your query'
      });
    }
  });
  
  // Get conversation history
  app.get('/api/chat/conversation/:conversationId', async (req, res) => {
    try {
      const conversationId = parseInt(req.params.conversationId);
      const userId = req.session?.user?.id;
      
      if (!conversationId || isNaN(conversationId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid conversation ID'
        });
      }
      
      // Check if user is authenticated and owns this conversation (if user is logged in)
      if (userId) {
        const conversation = await db
          .select()
          .from(conversations)
          .where(eq(conversations.id, conversationId))
          .limit(1);
          
        if (conversation.length > 0 && conversation[0].userId !== userId) {
          return res.status(403).json({
            success: false,
            message: 'You do not have permission to access this conversation'
          });
        }
      }
      
      const history = await getConversationHistory(conversationId);
      
      res.json({
        success: true,
        data: history
      });
    } catch (error) {
      console.error('Error retrieving conversation history:', error);
      res.status(500).json({
        success: false,
        message: 'An error occurred while retrieving conversation history'
      });
    }
  });
  
  // Get all user conversations
  app.get('/api/chat/conversations', async (req, res) => {
    try {
      const userId = req.session?.user?.id;
      
      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required to access conversations'
        });
      }
      
      const userConversations = await getUserConversations(userId);
      
      res.json({
        success: true,
        data: userConversations
      });
    } catch (error) {
      console.error('Error retrieving user conversations:', error);
      res.status(500).json({
        success: false,
        message: 'An error occurred while retrieving your conversations'
      });
    }
  });
  
  // Submit feedback for a chat response
  app.post('/api/chat/feedback', async (req, res) => {
    try {
      const { messageId, rating, comment } = req.body;
      const userId = req.session?.user?.id;
      
      if (!messageId || isNaN(messageId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid message ID'
        });
      }
      
      if (typeof rating !== 'number' || rating < 1 || rating > 5) {
        return res.status(400).json({
          success: false, 
          message: 'Rating must be a number between 1 and 5'
        });
      }
      
      // Save feedback (userId can be null for anonymous feedback)
      const success = await saveFeedback(
        messageId,
        rating,
        comment,
        userId
      );
      
      if (success) {
        res.json({
          success: true,
          message: 'Feedback submitted successfully'
        });
      } else {
        throw new Error('Failed to save feedback');
      }
    } catch (error) {
      console.error('Error submitting feedback:', error);
      res.status(500).json({
        success: false,
        message: 'An error occurred while submitting feedback'
      });
    }
  });
  
  // Get suggested/popular questions
  app.get('/api/chat/popular-questions', async (req, res) => {
    try {
      const { category } = req.query;
      const limit = parseInt(req.query.limit as string) || 5;
      
      const questions = await getPopularQuestions(
        category as string, 
        Math.min(limit, 10) // Cap at 10 questions max
      );
      
      res.json({
        success: true,
        data: questions
      });
    } catch (error) {
      console.error('Error retrieving popular questions:', error);
      res.status(500).json({
        success: false,
        message: 'An error occurred while retrieving popular questions'
      });
    }
  });

  // Image Generation API routes
  app.post("/api/studies/:id/generate-image", async (req, res) => {
    try {
      const studyId = parseInt(req.params.id);
      if (isNaN(studyId)) {
        return res.status(400).json({ success: false, message: "Invalid study ID" });
      }

      const updatedStudy = await generateImageForStudy(studyId);
      res.json({ 
        success: true, 
        data: {
          studyId: updatedStudy.id,
          images: updatedStudy.images,
          imageCaptions: updatedStudy.imageCaptions,
          autoGeneratedImage: updatedStudy.autoGeneratedImage
        } 
      });
    } catch (error) {
      console.error("Error generating image for study:", error);
      res.status(500).json({ success: false, message: "Failed to generate image for study" });
    }
  });
  
  // API endpoint to start batch image generation
  app.post("/api/images/batch-generate", async (req, res) => {
    try {
      const batchSize = req.body.batchSize || 5;
      
      // Start batch processing
      const results = await batchGenerateImagesForStudies(batchSize);
      
      res.json({
        success: true,
        data: results
      });
    } catch (error) {
      console.error("Error starting batch image generation:", error);
      res.status(500).json({
        success: false,
        message: "Failed to start batch image generation"
      });
    }
  });
  
  // API endpoint to get studies needing images
  app.get("/api/studies/needing-images", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 10;
      
      const studiesNeedingImages = await findStudiesNeedingImages(limit);
      
      res.json({
        success: true,
        data: studiesNeedingImages.map(study => ({
          id: study.id,
          title: study.title,
          abstract: study.abstract ? study.abstract.substring(0, 100) + "..." : null,
          category: study.category,
          publishDate: study.publishDate
        }))
      });
    } catch (error) {
      console.error("Error finding studies needing images:", error);
      res.status(500).json({
        success: false,
        message: "Failed to find studies needing images"
      });
    }
  });

  // Research Suggestions API routes
  app.get("/api/research-suggestions/options", async (req, res) => {
    try {
      const options = await getSuggestionOptions();
      res.json({
        success: true,
        data: options
      });
    } catch (error) {
      console.error("Error fetching research suggestion options:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch suggestion options"
      });
    }
  });
  
  app.post("/api/research-suggestions/generate", async (req, res) => {
    try {
      const selections = req.body;
      
      // Validate the selections
      if (!selections) {
        return res.status(400).json({
          success: false,
          message: "Missing selection data"
        });
      }
      
      console.log("Generating research suggestions with selections:", JSON.stringify(selections));
      
      // Generate research suggestions
      const suggestions = await generateResearchSuggestions(selections);
      
      res.json({
        success: true,
        data: suggestions
      });
    } catch (error) {
      console.error("Error generating research suggestions:", error);
      res.status(500).json({
        success: false,
        message: "Failed to generate research suggestions"
      });
    }
  });

  // Initialize sample data (only in development)
  if (process.env.NODE_ENV === 'development') {
    try {
      await storage.initializeSampleData();
    } catch (error) {
      console.error("Error initializing sample data:", error);
    }
  }

  const httpServer = createServer(app);
  return httpServer;
}
