import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import * as fs from "fs";
import * as path from "path";
import { storage } from "./storage";
import { insertNewsletterSchema, insertStudySchema, insertCategorySchema, insertContactSchema, blogArticles } from "@shared/schema";
import { ZodError } from "zod";
import { fromZodError } from "zod-validation-error";
import { upload, getFileType } from "./upload";
import { generateScientificImage } from "./image-generator";
import { generateBlogArticlesForStudy, saveBlogArticles, getBlogArticlesForStudy } from "./blog-generator";
import { sendContactEmail } from "./sendgrid";
import { db } from "./db";
import { eq, desc } from "drizzle-orm";

export async function registerRoutes(app: Express): Promise<Server> {
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
  
  // Get all blog articles
  app.get("/api/blogs", async (req, res) => {
    try {
      const blogs = await db.select().from(blogArticles).orderBy(desc(blogArticles.createdAt));
      res.json(blogs);
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
      
      if (existingBlogs.length > 0) {
        return res.status(409).json({ 
          message: "Blog articles already exist for this study",
          blogs: existingBlogs
        });
      }
      
      // Generate blog articles
      const articles = await generateBlogArticlesForStudy(study);
      
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
        message: "Blog articles generated successfully",
        articles: savedArticles
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
