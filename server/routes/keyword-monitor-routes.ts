import express from "express";
import { db } from "../db";
import { keywords, excludedKeywords, keywordGroups, keywordGroupMappings, monitorResults } from "@shared/schema";
import { eq, like, and, desc, asc, or, sql } from "drizzle-orm";
import { z } from "zod";

const router = express.Router();

// Schema for adding a new keyword
const addKeywordSchema = z.object({
  term: z.string().min(1, "Keyword term is required"),
  category: z.string().default("general")
});

// Schema for adding an excluded keyword
const addExcludedKeywordSchema = z.object({
  term: z.string().min(1, "Excluded term is required"),
  reason: z.string().optional()
});

// Schema for updating keyword status
const updateKeywordStatusSchema = z.object({
  isActive: z.boolean()
});

// Schema for adding a keyword group
const addKeywordGroupSchema = z.object({
  name: z.string().min(1, "Group name is required"),
  description: z.string().optional(),
  isActive: z.boolean().default(true)
});

// Schema for updating monitor result status
const updateResultStatusSchema = z.object({
  status: z.enum(["pending", "approved", "rejected", "archived"])
});

// Get all keywords
router.get("/", async (req, res) => {
  try {
    const allKeywords = await db.select().from(keywords).orderBy(desc(keywords.createdAt));
    res.json(allKeywords);
  } catch (error) {
    console.error("Error fetching keywords:", error);
    res.status(500).json({ message: "Failed to fetch keywords" });
  }
});

// Add a new keyword
router.post("/", async (req, res) => {
  try {
    // Validate request body
    const validatedData = addKeywordSchema.parse(req.body);
    
    // Check if keyword already exists
    const existingKeyword = await db
      .select()
      .from(keywords)
      .where(eq(keywords.term, validatedData.term))
      .limit(1);
    
    if (existingKeyword.length > 0) {
      return res.status(409).json({ message: "Keyword already exists" });
    }
    
    // Insert new keyword
    const [newKeyword] = await db
      .insert(keywords)
      .values({
        term: validatedData.term,
        category: validatedData.category,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      })
      .returning();
    
    res.status(201).json(newKeyword);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: error.errors[0].message });
    }
    console.error("Error adding keyword:", error);
    res.status(500).json({ message: "Failed to add keyword" });
  }
});

// Update keyword status
router.patch("/:id/status", async (req, res) => {
  try {
    const { id } = req.params;
    
    // Validate request body
    const validatedData = updateKeywordStatusSchema.parse(req.body);
    
    // Check if keyword exists
    const existingKeyword = await db
      .select()
      .from(keywords)
      .where(eq(keywords.id, Number(id)))
      .limit(1);
    
    if (existingKeyword.length === 0) {
      return res.status(404).json({ message: "Keyword not found" });
    }
    
    // Update keyword status
    const [updatedKeyword] = await db
      .update(keywords)
      .set({
        isActive: validatedData.isActive,
        updatedAt: new Date()
      })
      .where(eq(keywords.id, Number(id)))
      .returning();
    
    res.json(updatedKeyword);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: error.errors[0].message });
    }
    console.error("Error updating keyword status:", error);
    res.status(500).json({ message: "Failed to update keyword status" });
  }
});

// Delete a keyword
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if keyword exists
    const existingKeyword = await db
      .select()
      .from(keywords)
      .where(eq(keywords.id, Number(id)))
      .limit(1);
    
    if (existingKeyword.length === 0) {
      return res.status(404).json({ message: "Keyword not found" });
    }
    
    // Delete keyword
    await db
      .delete(keywords)
      .where(eq(keywords.id, Number(id)));
    
    res.json({ message: "Keyword deleted successfully" });
  } catch (error) {
    console.error("Error deleting keyword:", error);
    res.status(500).json({ message: "Failed to delete keyword" });
  }
});

// Get all excluded keywords
router.get("/excluded", async (req, res) => {
  try {
    const allExcludedKeywords = await db.select().from(excludedKeywords).orderBy(desc(excludedKeywords.createdAt));
    res.json(allExcludedKeywords);
  } catch (error) {
    console.error("Error fetching excluded keywords:", error);
    res.status(500).json({ message: "Failed to fetch excluded keywords" });
  }
});

// Add a new excluded keyword
router.post("/excluded", async (req, res) => {
  try {
    // Validate request body
    const validatedData = addExcludedKeywordSchema.parse(req.body);
    
    // Check if excluded keyword already exists
    const existingExcludedKeyword = await db
      .select()
      .from(excludedKeywords)
      .where(eq(excludedKeywords.term, validatedData.term))
      .limit(1);
    
    if (existingExcludedKeyword.length > 0) {
      return res.status(409).json({ message: "Excluded keyword already exists" });
    }
    
    // Insert new excluded keyword
    const [newExcludedKeyword] = await db
      .insert(excludedKeywords)
      .values({
        term: validatedData.term,
        reason: validatedData.reason,
        createdAt: new Date()
      })
      .returning();
    
    res.status(201).json(newExcludedKeyword);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: error.errors[0].message });
    }
    console.error("Error adding excluded keyword:", error);
    res.status(500).json({ message: "Failed to add excluded keyword" });
  }
});

// Delete an excluded keyword
router.delete("/excluded/:id", async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if excluded keyword exists
    const existingExcludedKeyword = await db
      .select()
      .from(excludedKeywords)
      .where(eq(excludedKeywords.id, Number(id)))
      .limit(1);
    
    if (existingExcludedKeyword.length === 0) {
      return res.status(404).json({ message: "Excluded keyword not found" });
    }
    
    // Delete excluded keyword
    await db
      .delete(excludedKeywords)
      .where(eq(excludedKeywords.id, Number(id)));
    
    res.json({ message: "Excluded keyword deleted successfully" });
  } catch (error) {
    console.error("Error deleting excluded keyword:", error);
    res.status(500).json({ message: "Failed to delete excluded keyword" });
  }
});

// Get all keyword groups
router.get("/groups", async (req, res) => {
  try {
    // Get all groups with related keywords
    const allGroups = await db.select().from(keywordGroups).orderBy(asc(keywordGroups.name));
    
    // For each group, find associated keywords
    const groupsWithKeywords = await Promise.all(
      allGroups.map(async (group) => {
        const mappings = await db
          .select()
          .from(keywordGroupMappings)
          .where(eq(keywordGroupMappings.groupId, group.id));
        
        const keywordIds = mappings.map(mapping => mapping.keywordId);
        
        const groupKeywords = keywordIds.length > 0
          ? await db
              .select()
              .from(keywords)
              .where(sql`${keywords.id} IN (${keywordIds.join(',')})`)
          : [];
        
        return {
          ...group,
          keywords: groupKeywords
        };
      })
    );
    
    res.json(groupsWithKeywords);
  } catch (error) {
    console.error("Error fetching keyword groups:", error);
    res.status(500).json({ message: "Failed to fetch keyword groups" });
  }
});

// Add a new keyword group
router.post("/groups", async (req, res) => {
  try {
    // Validate request body
    const validatedData = addKeywordGroupSchema.parse(req.body);
    
    // Check if group name already exists
    const existingGroup = await db
      .select()
      .from(keywordGroups)
      .where(eq(keywordGroups.name, validatedData.name))
      .limit(1);
    
    if (existingGroup.length > 0) {
      return res.status(409).json({ message: "Group name already exists" });
    }
    
    // Insert new group
    const [newGroup] = await db
      .insert(keywordGroups)
      .values({
        name: validatedData.name,
        description: validatedData.description,
        isActive: validatedData.isActive,
        createdAt: new Date()
      })
      .returning();
    
    res.status(201).json(newGroup);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: error.errors[0].message });
    }
    console.error("Error adding keyword group:", error);
    res.status(500).json({ message: "Failed to add keyword group" });
  }
});

// Add keywords to a group
router.post("/groups/:groupId/keywords", async (req, res) => {
  try {
    const { groupId } = req.params;
    const { keywordIds } = req.body;
    
    if (!Array.isArray(keywordIds) || keywordIds.length === 0) {
      return res.status(400).json({ message: "keywordIds must be a non-empty array" });
    }
    
    // Check if group exists
    const existingGroup = await db
      .select()
      .from(keywordGroups)
      .where(eq(keywordGroups.id, Number(groupId)))
      .limit(1);
    
    if (existingGroup.length === 0) {
      return res.status(404).json({ message: "Group not found" });
    }
    
    // Add all keywords to the group
    const mappingsToInsert = keywordIds.map(keywordId => ({
      keywordId: Number(keywordId),
      groupId: Number(groupId)
    }));
    
    const insertedMappings = await db
      .insert(keywordGroupMappings)
      .values(mappingsToInsert)
      .onConflictDoNothing()
      .returning();
    
    res.status(201).json(insertedMappings);
  } catch (error) {
    console.error("Error adding keywords to group:", error);
    res.status(500).json({ message: "Failed to add keywords to group" });
  }
});

// Get monitor results
router.get("/results", async (req, res) => {
  try {
    const { status } = req.query;
    
    let query = db.select().from(monitorResults);
    
    // Filter by status if provided
    if (status && status !== 'all') {
      query = query.where(eq(monitorResults.status, status as string));
    }
    
    const results = await query.orderBy(desc(monitorResults.foundAt));
    
    res.json(results);
  } catch (error) {
    console.error("Error fetching monitor results:", error);
    res.status(500).json({ message: "Failed to fetch monitor results" });
  }
});

// Update monitor result status
router.patch("/results/:id/status", async (req, res) => {
  try {
    const { id } = req.params;
    
    // Validate request body
    const validatedData = updateResultStatusSchema.parse(req.body);
    
    // Check if result exists
    const existingResult = await db
      .select()
      .from(monitorResults)
      .where(eq(monitorResults.id, Number(id)))
      .limit(1);
    
    if (existingResult.length === 0) {
      return res.status(404).json({ message: "Monitor result not found" });
    }
    
    // Update status and set reviewedAt if not already set
    const [updatedResult] = await db
      .update(monitorResults)
      .set({
        status: validatedData.status,
        reviewedAt: existingResult[0].reviewedAt || new Date(),
        // In a real system, you'd get the user ID from the authenticated session
        reviewedBy: existingResult[0].reviewedBy || "admin"
      })
      .where(eq(monitorResults.id, Number(id)))
      .returning();
    
    res.json(updatedResult);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: error.errors[0].message });
    }
    console.error("Error updating monitor result status:", error);
    res.status(500).json({ message: "Failed to update result status" });
  }
});

// Run the keyword monitor
router.post("/monitor/run", async (req, res) => {
  try {
    // This would be a more complex operation in production, involving:
    // 1. Fetching active keywords from the database
    // 2. Searching scientific databases (PubMed, EuropePMC, etc.) using those keywords
    // 3. Applying exclusion filters to remove results with excluded keywords
    // 4. Checking for duplicates (against existing studies and monitor results)
    // 5. Storing new results in the monitor_results table
    
    // For demo purposes, we'll create a few sample results
    const sampleResults = [
      {
        title: "Molecular hydrogen attenuates hypoxia/reoxygenation injury in neuronal SH-SY5Y cells",
        abstract: "Molecular hydrogen (H2) has been reported to have a therapeutic effect against various diseases. Here, we investigated the efficacy of H2 on hypoxia/reoxygenation (H/R) injury in human neuroblastoma SH-SY5Y cells.",
        authors: "Tanaka M, Kurihara K, Sugimoto N, et al.",
        journal: "Journal of Neuroscience Research",
        publishDate: "2023-03-15",
        doi: "10.1002/jnr.25023",
        url: "https://example.com/study1",
        matchedKeywords: ["molecular hydrogen", "neuroprotection"],
        source: "PubMed",
      },
      {
        title: "Hydrogen-rich water improves cognitive function in elderly patients: a randomized controlled trial",
        abstract: "This randomized controlled trial investigated whether hydrogen-rich water consumption could improve cognitive function in elderly patients with mild cognitive impairment.",
        authors: "Yamada S, Takahashi R, Watanabe K, et al.",
        journal: "Journal of Gerontology and Geriatrics",
        publishDate: "2023-04-22",
        doi: "10.1093/geriat/gbc056",
        url: "https://example.com/study2",
        matchedKeywords: ["hydrogen-rich water", "cognitive function"],
        source: "CrossRef",
      },
      {
        title: "Effects of hydrogen inhalation on exercise-induced oxidative stress in healthy athletes",
        abstract: "This study aimed to investigate whether hydrogen gas inhalation could reduce exercise-induced oxidative stress and improve recovery in healthy athletes.",
        authors: "Chen J, Liu D, Wang T, et al.",
        journal: "Sports Medicine and Exercise Science",
        publishDate: "2023-05-10",
        doi: "10.1007/s40279-023-01234-1",
        url: "https://example.com/study3",
        matchedKeywords: ["hydrogen inhalation", "oxidative stress"],
        source: "EuropePMC",
      }
    ];
    
    // Insert sample results
    const insertedResults = await db
      .insert(monitorResults)
      .values(sampleResults.map(result => ({
        ...result,
        status: "pending",
        foundAt: new Date()
      })))
      .returning();
    
    // Update last searched timestamp for keywords
    const activeKeywords = await db
      .select()
      .from(keywords)
      .where(eq(keywords.isActive, true));
    
    for (const keyword of activeKeywords) {
      await db
        .update(keywords)
        .set({
          lastSearched: new Date(),
          matchCount: (keyword.matchCount || 0) + 1
        })
        .where(eq(keywords.id, keyword.id));
    }
    
    res.json({
      message: "Keyword monitor ran successfully",
      found: insertedResults.length,
      results: insertedResults
    });
  } catch (error) {
    console.error("Error running keyword monitor:", error);
    res.status(500).json({ message: "Failed to run keyword monitor" });
  }
});

export default router;