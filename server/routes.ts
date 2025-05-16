import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertNewsletterSchema, insertStudySchema, insertCategorySchema } from "@shared/schema";
import { ZodError } from "zod";
import { fromZodError } from "zod-validation-error";

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
