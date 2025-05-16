import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertContactSchema, insertSubscriptionSchema } from "@shared/schema";
import { z } from "zod";

export async function registerRoutes(app: Express): Promise<Server> {
  // Prefix all routes with /api - commented out for now as it's causing an issue
  // const apiRouter = app.use('/api');

  // Get all studies
  app.get('/api/studies', async (req: Request, res: Response) => {
    try {
      const studies = await storage.getStudies();
      res.json(studies);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch studies' });
    }
  });

  // Get a specific study by ID
  app.get('/api/studies/:id', async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: 'Invalid study ID' });
      }

      const study = await storage.getStudyById(id);
      if (!study) {
        return res.status(404).json({ message: 'Study not found' });
      }

      res.json(study);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch study' });
    }
  });

  // Search studies
  app.get('/api/search', async (req: Request, res: Response) => {
    try {
      const query = req.query.query as string || '';
      const category = req.query.category as string;
      const year = req.query.year ? parseInt(req.query.year as string) : undefined;
      const sort = req.query.sort as 'relevance' | 'date-desc' | 'date-asc' | 'citations';
      const studyType = req.query.studyType as string;
      const fullTextOnly = req.query.fullTextOnly === 'true';
      const author = req.query.author as string;
      const journal = req.query.journal as string;

      const filters = {
        category,
        year,
        sort,
        studyType,
        fullTextOnly,
        author,
        journal
      };

      const studies = await storage.searchStudies(query, filters);
      res.json(studies);
    } catch (error) {
      res.status(500).json({ message: 'Failed to search studies' });
    }
  });

  // Get recent studies
  app.get('/api/recent-studies', async (req: Request, res: Response) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 3;
      const recentStudies = await storage.getRecentStudies(limit);
      res.json(recentStudies);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch recent studies' });
    }
  });

  // Get studies by category
  app.get('/api/categories/:name/studies', async (req: Request, res: Response) => {
    try {
      const categoryName = req.params.name;
      const studies = await storage.getStudiesByCategory(categoryName);
      res.json(studies);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch studies by category' });
    }
  });

  // Get all categories
  app.get('/api/categories', async (req: Request, res: Response) => {
    try {
      const categories = await storage.getCategories();
      res.json(categories);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch categories' });
    }
  });

  // Get a specific category by name
  app.get('/api/categories/:name', async (req: Request, res: Response) => {
    try {
      const categoryName = req.params.name;
      const category = await storage.getCategoryByName(categoryName);
      
      if (!category) {
        return res.status(404).json({ message: 'Category not found' });
      }
      
      res.json(category);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch category' });
    }
  });

  // Get all resources
  app.get('/api/resources', async (req: Request, res: Response) => {
    try {
      const resources = await storage.getResources();
      res.json(resources);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch resources' });
    }
  });

  // Get a specific resource by slug
  app.get('/api/resources/:slug', async (req: Request, res: Response) => {
    try {
      const slug = req.params.slug;
      const resource = await storage.getResourceBySlug(slug);
      
      if (!resource) {
        return res.status(404).json({ message: 'Resource not found' });
      }
      
      res.json(resource);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch resource' });
    }
  });

  // Subscribe to newsletter
  app.post('/api/subscribe', async (req: Request, res: Response) => {
    try {
      const validatedData = insertSubscriptionSchema.parse(req.body);
      const subscription = await storage.createSubscription(validatedData);
      res.status(201).json({ message: 'Successfully subscribed to the newsletter', subscription });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Invalid subscription data', errors: error.errors });
      }
      res.status(500).json({ message: 'Failed to subscribe to the newsletter' });
    }
  });

  // Submit contact form
  app.post('/api/contact', async (req: Request, res: Response) => {
    try {
      const validatedData = insertContactSchema.parse(req.body);
      const contact = await storage.createContact(validatedData);
      res.status(201).json({ message: 'Message sent successfully', contact });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Invalid contact data', errors: error.errors });
      }
      res.status(500).json({ message: 'Failed to send message' });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
