import { Router } from "express";
import { storage } from "../storage";

const router = Router();

// Get all studies with filtering
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
      page,
      pageSize,
      sortField,
      sortOrder,
      sortBy,
      peerReviewed,
      useFuzzyMatch,
      enrichmentStatus,
      tags,
    } = req.query;
    
    console.log("Search query parameters:", { 
      query, 
      keyword, 
      author, 
      yearFrom, 
      yearTo, 
      category, 
      sortBy,
      useFuzzyMatch,
      enrichmentStatus,
      tags: tags ? typeof tags === 'string' ? tags.split(',') : tags : undefined
    });
    
    // Process query parameter for text search
    if (query) {
      console.log("Using search query:", query);
    }
    
    // Process arrays
    let processedTags: string[] | undefined;
    if (tags && typeof tags === 'string') {
      processedTags = tags.split(',').map(tag => tag.trim());
    }
    
    // Get studies from in-memory storage for now while we fix the database implementation
    const studies = await storage.getStudies({
      // Basic filters
      query: query as string,
      keyword: keyword as string,
      author: author as string,
      yearFrom: yearFrom as string,
      yearTo: yearTo as string,
      category: category as string,
      
      // Enhanced UI filters
      isPeerReviewed: isPeerReviewed === undefined 
        ? undefined 
        : isPeerReviewed === "true" 
          ? true 
          : isPeerReviewed === "false" 
            ? false 
            : null,
            
      hasHealthImplications: hasHealthImplications === undefined 
        ? undefined 
        : hasHealthImplications === "true" 
          ? true 
          : hasHealthImplications === "false" 
            ? false 
            : null,
            
      hasMedia: hasMedia === undefined 
        ? undefined 
        : hasMedia === "true" 
          ? true 
          : hasMedia === "false" 
            ? false 
            : null,
            
      dateFrom: dateFrom as string,
      dateTo: dateTo as string,
      
      // Pagination and sorting
      page: page ? parseInt(page as string) : undefined,
      pageSize: pageSize ? parseInt(pageSize as string) : undefined,
      sortField: sortField as string,
      sortOrder: sortOrder as 'asc' | 'desc',
      sortBy: sortBy as string,
      
      // Legacy support
      peerReviewed: peerReviewed === "true",
      
      // Enhanced search features
      tags: processedTags,
      enrichmentStatus: enrichmentStatus as 'basic' | 'partial' | 'complete' | undefined,
      useFuzzyMatch: useFuzzyMatch === "true",
    });
    
    // Return studies directly, no need to wrap again
    res.json(studies);
  } catch (error) {
    console.error("Error fetching studies:", error);
    res.status(500).json({ message: "Failed to fetch studies" });
  }
});

// Get latest studies
router.get("/latest", async (req, res) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 3;
    const studies = await storage.getLatestStudies(limit);
    res.json(studies);
  } catch (error) {
    console.error("Error fetching latest studies:", error);
    res.status(500).json({ message: "Failed to fetch latest studies" });
  }
});

// Get a single study by ID
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    
    // Validate ID format with regex before parsing
    if (!id || !/^\d+$/.test(id)) {
      return res.status(400).json({ message: "Invalid study ID format" });
    }
    
    const studyId = parseInt(id);
    const study = await storage.getStudyById(studyId);
    
    if (!study) {
      return res.status(404).json({ message: "Study not found" });
    }
    
    res.json(study);
  } catch (error) {
    console.error(`Error fetching study:`, error);
    res.status(500).json({ message: "Failed to fetch study" });
  }
});

export default router;