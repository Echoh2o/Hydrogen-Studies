import { Router } from "express";
import { storage } from "../storage";
import { studies } from "@shared/schema";
import { eq } from "drizzle-orm";
import { db } from "../db";

const router = Router();

// Get studies by consumer category type (condition, body_system, life_stage)
router.get("/by-consumer-category/:model/:category", async (req, res) => {
  try {
    const { model, category } = req.params;
    
    if (!model || !category) {
      return res.status(400).json({
        success: false,
        message: "Model and category parameters are required"
      });
    }
    
    console.log(`Fetching studies for ${model} category: ${category}`);
    
    // Mock data for demonstration - this should be replaced with actual database query
    const mockStudies = [
      {
        id: 1,
        title: "Effects of hydrogen-rich water on metabolic syndrome",
        abstract: "This study investigates the effects of hydrogen-rich water consumption on markers of metabolic syndrome.",
        category: "Metabolic",
        publishDate: "2023-05-15",
        journal: "Journal of Hydrogen Medicine",
        authors: "Smith J, Johnson A",
        doi: "10.1234/hydro.2023.001",
        imageUrl: "/uploads/metabolic-syndrome-study.jpg"
      },
      {
        id: 2,
        title: "Hydrogen inhalation for respiratory conditions",
        abstract: "A clinical trial evaluating hydrogen gas inhalation therapy for respiratory disorders.",
        category: "Respiratory",
        publishDate: "2023-06-20",
        journal: "Respiratory Research International",
        authors: "Chen L, Wang H",
        doi: "10.1234/resp.2023.015",
        imageUrl: "/uploads/respiratory-hydrogen-study.jpg"
      },
      {
        id: 3,
        title: "Hydrogen baths for psoriasis treatment",
        abstract: "Evaluation of hydrogen-enriched water baths for treating psoriasis symptoms.",
        category: "Dermatology",
        publishDate: "2023-04-10",
        journal: "Dermatology Science Journal",
        authors: "Tanaka Y, Suzuki K",
        doi: "10.1234/derm.2023.008",
        imageUrl: "/uploads/psoriasis-hydrogen-study.jpg"
      }
    ];
    
    return res.json({
      success: true,
      data: mockStudies
    });
    
  } catch (error) {
    console.error("Error fetching studies by consumer category:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch studies by consumer category"
    });
  }
});

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
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;
    
    // Direct database access if needed
    if (process.env.DATABASE_URL && db) {
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
    
    // First try to get the study directly from the database
    if (db) {
      try {
        const [studyFromDb] = await db.select().from(studies).where(eq(studies.id, id));
        
        if (studyFromDb) {
          return res.json(studyFromDb);
        }
      } catch (dbError) {
        console.log("Database error fetching study, falling back to storage:", dbError);
      }
    }
    
    // If no result from database, try with the storage interface
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