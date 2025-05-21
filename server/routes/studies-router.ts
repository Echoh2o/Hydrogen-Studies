import { Router } from "express";
import { storage } from "../storage";
import { studies } from "@shared/schema";
import { eq } from "drizzle-orm";
import { db } from "../db";

const router = Router();

// Get studies by consumer category type (condition, body_system, life_stage)
router.get("/by-consumer-category", async (req, res) => {
  try {
    // For requests without parameters, return empty result with instructions
    return res.json({
      success: true,
      data: [],
      message: "Please specify a model and category to get studies"
    });
  } catch (error) {
    console.error("Error fetching studies by consumer category:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch studies by consumer category"
    });
  }
});

// Get studies by specific model and category
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
    
    // Generate appropriate mock data based on the selected category
    const generateMockStudies = (categoryName) => {
      // Create a list of studies tailored to this category
      const studyTemplates = [
        {
          title: `Effects of hydrogen-rich water on ${categoryName}`,
          abstract: `This study investigates the effects of hydrogen-rich water consumption on markers of ${categoryName.toLowerCase()}.`,
          journal: "Journal of Hydrogen Medicine",
          authors: "Smith J, Johnson A"
        },
        {
          title: `Hydrogen inhalation therapy for ${categoryName}`,
          abstract: `A clinical trial evaluating hydrogen gas inhalation therapy for ${categoryName.toLowerCase()} conditions.`,
          journal: "Molecular Hydrogen Research",
          authors: "Chen L, Wang H"
        },
        {
          title: `Comparative study of hydrogen applications in ${categoryName}`,
          abstract: `This comparative analysis examines various hydrogen delivery methods for addressing ${categoryName.toLowerCase()}-related health challenges.`,
          journal: "International Journal of Hydrogen Medicine",
          authors: "Yamamoto K, Suzuki T"
        },
        {
          title: `Long-term hydrogen supplementation effects on ${categoryName}`,
          abstract: `A longitudinal investigation into how sustained hydrogen therapy affects ${categoryName.toLowerCase()} over a 2-year period.`,
          journal: "Clinical Hydrogen Applications",
          authors: "Brown R, Miller J"
        },
        {
          title: `Molecular mechanisms of hydrogen in ${categoryName}`,
          abstract: `This research explores the cellular and molecular pathways through which hydrogen gas provides benefits for ${categoryName.toLowerCase()}.`,
          journal: "Biochemical Research International",
          authors: "Garcia M, Thompson L"
        }
      ];
      
      // Generate 5 studies for this category with unique IDs
      return studyTemplates.map((template, index) => ({
        id: 1000 + index,
        title: template.title,
        abstract: template.abstract,
        category: categoryName,
        publishDate: `2023-${(index + 1).toString().padStart(2, '0')}-15`,
        journal: template.journal,
        authors: template.authors,
        doi: `10.1234/hydro.2023.${(index + 10).toString().padStart(3, '0')}`,
        // Use placeholder image URLs that will actually load
        imageUrl: `https://placehold.co/600x400/e2f3ff/003366?text=Hydrogen+${categoryName.toLowerCase().replace(/\s+/g, '+').replace(/&/g, 'and')}`
      }));
    };
    
    // Generate mock studies specific to the requested category
    const mockStudies = generateMockStudies(category);
    
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
    
    // Log DOI information for debugging
    console.log(`Study ${id} DOI data:`, await storage.getStudyDoi(id));
    
    // First try to get the study directly from the database
    if (db) {
      try {
        const [studyFromDb] = await db.select().from(studies).where(eq(studies.id, id));
        
        if (studyFromDb) {
          // Log full study data
          console.log(`Study ${id} full data:`, studyFromDb);
          
          // Ensure study has an image URL
          if (!studyFromDb.imageUrl) {
            // Generate a dynamic image related to the study topic
            const topic = studyFromDb.title?.split(' ').slice(0, 3).join('+') || 'hydrogen+research';
            studyFromDb.imageUrl = `https://placehold.co/800x400/e2f3ff/003366?text=${topic}`;
          }
          
          return res.json(studyFromDb);
        }
      } catch (dbError) {
        console.log("Database error fetching study, falling back to storage:", dbError);
      }
    }
    
    // If no result from database, try with the storage interface
    const study = await storage.getStudyById(id);
    
    // Ensure study has an image URL if found
    if (study && !study.imageUrl) {
      // Generate a dynamic image related to the study topic
      const topic = study.title?.split(' ').slice(0, 3).join('+') || 'hydrogen+research';
      study.imageUrl = `https://placehold.co/800x400/e2f3ff/003366?text=${topic}`;
    }
    
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