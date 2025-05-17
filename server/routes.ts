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
import { sendContactEmail } from "./sendgrid";
import { db } from "./db";
import { eq, desc, or, asc, ilike, sql } from "drizzle-orm";
import educationalRoutes from "./routes/educational";
import scraperRoutes from "./routes/scraper-routes";
import importRoutes from "./routes/import-routes";
import hydrogenImportRoutes from "./routes/hydrogen-import";
import excelAnalysisRoutes from "./routes/excel-analysis";
import minimalImportRoutes from "./routes/minimal-import";
import researchRoutes from "./routes/research-routes";
import studyDetailsRoutes from "./routes/study-details";
import europePmcRoutes from "./routes/europepmc-routes";
import semanticScholarRoutes from "./routes/semantic-scholar-routes";
import crossrefRoutes from "./routes/crossref-routes";
import researchUnifiedRoutes from "./routes/research-unified-routes";
import { generateStandardizedSummary, updateStudyWithStandardizedSummary } from "../shared/schema-updates";

export async function registerRoutes(app: Express): Promise<Server> {
  // Initialize database tables for new features
  try {
    // Add standardized summary fields to studies table
    await db.execute(`
      ALTER TABLE studies 
      ADD COLUMN IF NOT EXISTS objective TEXT, 
      ADD COLUMN IF NOT EXISTS methods_short TEXT,
      ADD COLUMN IF NOT EXISTS results_short TEXT,
      ADD COLUMN IF NOT EXISTS conclusion_short TEXT,
      ADD COLUMN IF NOT EXISTS summary_markdown TEXT
    `);
    
    // Add fields to blog articles table for publication workflow
    await db.execute(`
      ALTER TABLE blog_articles
      ADD COLUMN IF NOT EXISTS is_published BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS editor_notes TEXT,
      ADD COLUMN IF NOT EXISTS article_type TEXT
    `);
    
    // Create tables for educational resources if they don't exist
    await db.execute(`
      CREATE TABLE IF NOT EXISTS educational_resources (
        id SERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        slug TEXT NOT NULL UNIQUE,
        content TEXT NOT NULL,
        content_markdown TEXT NOT NULL,
        resource_type TEXT NOT NULL,
        featured_order INTEGER DEFAULT 0,
        view_count INTEGER DEFAULT 0,
        is_published BOOLEAN DEFAULT true,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
      
      CREATE TABLE IF NOT EXISTS glossary_terms (
        id SERIAL PRIMARY KEY,
        term TEXT NOT NULL UNIQUE,
        definition TEXT NOT NULL,
        long_definition TEXT,
        citation_sources TEXT,
        related_terms TEXT[],
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
      
      CREATE TABLE IF NOT EXISTS faq_items (
        id SERIAL PRIMARY KEY,
        question TEXT NOT NULL,
        answer TEXT NOT NULL,
        answer_markdown TEXT NOT NULL,
        category TEXT NOT NULL,
        display_order INTEGER DEFAULT 0,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
      
      CREATE TABLE IF NOT EXISTS study_collections (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        description TEXT NOT NULL,
        slug TEXT NOT NULL UNIQUE,
        image_url TEXT,
        image_alt TEXT,
        featured_order INTEGER DEFAULT 0,
        is_published BOOLEAN DEFAULT true,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
      
      CREATE TABLE IF NOT EXISTS collection_studies (
        collection_id INTEGER NOT NULL REFERENCES study_collections(id),
        study_id INTEGER NOT NULL REFERENCES studies(id),
        display_order INTEGER DEFAULT 0,
        added_at TIMESTAMP NOT NULL DEFAULT NOW(),
        PRIMARY KEY (collection_id, study_id)
      );
    `);
    
    console.log("Successfully initialized database tables for new features");
  } catch (error) {
    console.error("Error initializing database tables:", error);
  }
  
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
  
  // Register Europe PMC API routes
  app.use('', europePmcRoutes);
  
  // Register Semantic Scholar API routes
  app.use('', semanticScholarRoutes);
  
  // Register CrossRef API routes
  app.use('/api/crossref', crossrefRoutes);
  
  // API routes
  
  // Studies routes
  app.get("/api/studies", async (req, res) => {
    try {
      const { 
        query, 
        keyword, 
        author, 
        yearFrom, 
        yearTo, 
        category,
        peerReviewed,
        sortBy 
      } = req.query;
      
      const studies = await storage.getStudies({
        query: query as string,
        keyword: keyword as string,
        author: author as string,
        yearFrom: yearFrom as string,
        yearTo: yearTo as string,
        category: category as string,
        peerReviewed: peerReviewed === "true",
        sortBy: sortBy as string
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
      const study = await storage.getStudyById(parseInt(id));
      
      if (!study) {
        return res.status(404).json({ message: "Study not found" });
      }
      
      res.json(study);
    } catch (error) {
      console.error("Error fetching study:", error);
      res.status(500).json({ message: "Failed to fetch study" });
    }
  });
  
  // Get related studies
  app.get("/api/studies/:id/related", async (req, res) => {
    try {
      const { id } = req.params;
      const study = await storage.getStudyById(parseInt(id));
      
      if (!study) {
        return res.status(404).json({ message: "Study not found" });
      }
      
      // Get studies in the same category
      const relatedStudies = await storage.getStudies({
        category: study.category
      });
      
      // Remove the current study from the results
      const filteredStudies = relatedStudies.filter(s => s.id !== parseInt(id));
      
      // Sort based on relevance to the current study (using title and abstract similarity)
      const scoredStudies = filteredStudies.map(relatedStudy => {
        let score = 0;
        
        // Give points for matching keywords in title
        const titleWords = study.title.toLowerCase().split(/\s+/).filter(word => word.length > 3);
        for (const word of titleWords) {
          if (relatedStudy.title.toLowerCase().includes(word)) {
            score += 2;
          }
          if (relatedStudy.abstract.toLowerCase().includes(word)) {
            score += 1;
          }
        }
        
        // Give points for matching authors
        if (study.authors === relatedStudy.authors) {
          score += 3;
        }
        
        // Give points for similar publication date (same year)
        const studyYear = new Date(study.publishDate).getFullYear();
        const relatedYear = new Date(relatedStudy.publishDate).getFullYear();
        if (studyYear === relatedYear) {
          score += 1;
        }
        
        return { ...relatedStudy, relevanceScore: score };
      });
      
      // Sort by relevance score (highest first) and return top 5
      const sortedRelated = scoredStudies
        .sort((a, b) => b.relevanceScore - a.relevanceScore)
        .slice(0, 5);
      
      res.json(sortedRelated);
    } catch (error) {
      console.error("Error fetching related studies:", error);
      res.status(500).json({ message: "Failed to fetch related studies" });
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
      const category = await storage.getCategoryById(parseInt(id));
      
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
      const validatedData = insertNewsletterSchema.parse(req.body);
      const subscription = await storage.subscribeNewsletter(validatedData);
      res.status(201).json(subscription);
    } catch (error) {
      if (error instanceof ZodError) {
        const validationError = fromZodError(error);
        return res.status(400).json({ message: validationError.message });
      }
      console.error("Error subscribing to newsletter:", error);
      res.status(500).json({ message: "Failed to subscribe to newsletter" });
    }
  });
  
  // Contact form submission route
  app.post("/api/contact", async (req, res) => {
    try {
      const validatedData = insertContactSchema.parse(req.body);
      
      // Send email using SendGrid
      const emailSuccess = await sendContactEmail({
        name: validatedData.name,
        email: validatedData.email,
        subject: validatedData.subject,
        message: validatedData.message
      });
      
      if (!emailSuccess) {
        return res.status(500).json({ message: "Failed to send email. Please try again later." });
      }
      
      // Store contact message in database if available
      try {
        await storage.submitContactMessage(validatedData);
      } catch (dbError) {
        console.warn("Failed to store contact message in database, but email was sent:", dbError);
        // Continue execution since the email was sent successfully
      }
      
      res.status(201).json({ message: "Your message has been sent successfully!" });
    } catch (error) {
      if (error instanceof ZodError) {
        const validationError = fromZodError(error);
        return res.status(400).json({ message: validationError.message });
      }
      console.error("Error submitting contact form:", error);
      res.status(500).json({ message: "Failed to submit contact form" });
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
      const study = await storage.getStudyById(parseInt(id));
      
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
      
      const updatedStudy = await storage.updateStudy(parseInt(id), updateData);
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
      const study = await storage.getStudyById(parseInt(id));
      
      if (!study) {
        return res.status(404).json({ message: "Study not found" });
      }
      
      const validatedData = req.body; // We could add validation here
      const updatedStudy = await storage.updateStudy(parseInt(id), validatedData);
      res.status(200).json(updatedStudy);
    } catch (error) {
      console.error("Error updating study:", error);
      res.status(500).json({ message: "Failed to update study", error: error.message });
    }
  });
  
  app.delete("/api/studies/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const study = await storage.getStudyById(parseInt(id));
      
      if (!study) {
        return res.status(404).json({ message: "Study not found" });
      }
      
      await storage.deleteStudy(parseInt(id));
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
      const [blog] = await db.select().from(blogArticles).where(eq(blogArticles.id, parseInt(id)));
      
      if (!blog) {
        return res.status(404).json({ message: "Blog article not found" });
      }
      
      // Delete the blog article
      await db.delete(blogArticles).where(eq(blogArticles.id, parseInt(id)));
      
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
      const [blog] = await db.select().from(blogArticles).where(eq(blogArticles.id, parseInt(id)));
      
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
        .where(eq(blogArticles.id, parseInt(id)));
      
      // Get the updated blog
      const [updatedBlog] = await db.select().from(blogArticles).where(eq(blogArticles.id, parseInt(id)));
      
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
      const [blog] = await db.select().from(blogArticles).where(eq(blogArticles.id, parseInt(id)));
      
      if (!blog) {
        return res.status(404).json({ message: "Blog article not found" });
      }
      
      // Increment view count
      await db.update(blogArticles)
        .set({ viewCount: blog.viewCount + 1 })
        .where(eq(blogArticles.id, parseInt(id)));
      
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
      const [blog] = await db.select().from(blogArticles).where(eq(blogArticles.id, parseInt(id)));
      
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
        .where(eq(blogArticles.id, parseInt(id)))
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
      const studyBlogs = await getBlogArticlesForStudy(parseInt(id));
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
      const { suggestionType, selectedContent } = req.body;
      
      const validSuggestionTypes = ['improve', 'expand', 'simplify', 'add_examples', 'add_research_context', 'elon_style', 'add_conclusion'];
      if (!suggestionType || !validSuggestionTypes.includes(suggestionType)) {
        return res.status(400).json({ message: "Invalid suggestion type" });
      }
      
      // Get the blog article
      const [blog] = await db.select().from(blogArticles).where(eq(blogArticles.id, parseInt(id)));
      
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
      
      // Get the blog article
      const [blog] = await db.select().from(blogArticles).where(eq(blogArticles.id, parseInt(id)));
      
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
      const study = await storage.getStudyById(parseInt(id));
      
      if (!study) {
        return res.status(404).json({ message: "Study not found" });
      }
      
      // Check if blog articles already exist for this study
      const existingBlogs = await getBlogArticlesForStudy(parseInt(id));
      
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
      const study = await storage.getStudyById(parseInt(id));
      
      if (!study) {
        return res.status(404).json({ message: "Study not found" });
      }
      
      // Generate image using OpenAI
      const { imageUrl, imageAlt } = await generateScientificImage(study);
      
      // Update the study with the generated image
      const updatedStudy = await storage.updateStudy(parseInt(id), {
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
