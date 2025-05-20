import { Router } from "express";
import { storage } from "../storage";
import { studies } from "@shared/schema";
import { eq } from "drizzle-orm";
import { db } from "../db";

const router = Router();

// Get all studies with filtering and search
router.get("/", async (req, res) => {
  try {
    const { 
      query, 
      keyword, 
      author, 
      yearFrom, 
      yearTo, 
      category,
      isPeerReviewed,
      hasHealthImplications,
      hasMedia,
      dateFrom,
      dateTo,
      page = "1",
      pageSize = "10",
      sortField,
      sortOrder,
      sortBy
    } = req.query;
    
    console.log("Search query parameters:", { 
      query, 
      keyword, 
      author, 
      yearFrom, 
      yearTo, 
      category, 
      sortBy
    });
    
    // Use the storage interface to get studies with filtering
    const result = await storage.getStudies({
      query: query as string,
      keyword: keyword as string,
      author: author as string,
      yearFrom: yearFrom as string,
      yearTo: yearTo as string,
      category: category as string,
      isPeerReviewed: isPeerReviewed === "true" ? true : isPeerReviewed === "false" ? false : undefined,
      hasHealthImplications: hasHealthImplications === "true" ? true : hasHealthImplications === "false" ? false : undefined,
      hasMedia: hasMedia === "true" ? true : hasMedia === "false" ? false : undefined,
      dateFrom: dateFrom as string,
      dateTo: dateTo as string,
      page: Number(page),
      pageSize: Number(pageSize),
      sortField: sortField as string,
      sortOrder: sortOrder as 'asc' | 'desc',
      sortBy: sortBy as string
    });
    
    // If storage returns paginated results (likely from database implementation)
    if (result && 'data' in result) {
      res.json(result);
    } else {
      // Otherwise, it's returning an array directly (likely from in-memory implementation)
      // So we need to paginate manually
      const studies = result as any[];
      const pageNum = Number(page);
      const pageSizeNum = Number(pageSize);
      const startIndex = (pageNum - 1) * pageSizeNum;
      const endIndex = startIndex + pageSizeNum;
      const paginatedData = studies.slice(startIndex, endIndex);
      
      res.json({
        data: paginatedData,
        total: studies.length,
        page: pageNum,
        pageSize: pageSizeNum,
        pageCount: Math.ceil(studies.length / pageSizeNum)
      });
    }
  } catch (error) {
    console.error("Error fetching studies:", error);
    res.status(500).json({ message: "Failed to fetch studies" });
  }
});

// Get latest studies
router.get("/latest", async (req, res) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 3;
    
    // Direct database access if needed
    if (process.env.DATABASE_URL) {
      try {
        // Try to get latest studies directly from the database
        const latestStudies = await db.select().from(studies).orderBy(studies.createdAt).limit(limit);
        
        if (latestStudies && latestStudies.length > 0) {
          return res.json(latestStudies);
        }
      } catch (err) {
        console.log("Error fetching latest studies from database, falling back to storage:", err);
      }
    }
    
    // Otherwise use the storage interface
    const latestStudies = await storage.getLatestStudies(limit);
    res.json(latestStudies);
  } catch (error) {
    console.error("Error fetching latest studies:", error);
    res.status(500).json({ message: "Failed to fetch latest studies" });
  }
});

// Get study by ID
router.get("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    
    if (isNaN(id)) {
      return res.status(400).json({ message: "Invalid study ID format" });
    }
    
    const study = await storage.getStudyById(id);
    
    if (!study) {
      return res.status(404).json({ message: "Study not found" });
    }
    
    res.json(study);
  } catch (error) {
    console.error("Error fetching study:", error);
    res.status(500).json({ message: "Failed to fetch study" });
  }
});

export default router;