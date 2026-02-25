import express from "express";
import { db } from "../db";
import {
  keywords,
  excludedKeywords,
  keywordGroups,
  keywordGroupMappings,
  monitorResults,
} from "@shared/schema";
import { eq, like, and, desc, asc, or, sql, inArray } from "drizzle-orm";
import { z } from "zod";
import { requireAdmin } from "../auth";

const router = express.Router();

// All keyword management routes require admin authentication
router.use(requireAdmin);

// Schema for adding a new keyword
const addKeywordSchema = z.object({
  term: z.string().min(1, "Keyword term is required"),
  category: z.string().default("general"),
});

// Schema for adding an excluded keyword
const addExcludedKeywordSchema = z.object({
  term: z.string().min(1, "Excluded term is required"),
  reason: z.string().optional(),
});

// Schema for updating keyword status
const updateKeywordStatusSchema = z.object({
  isActive: z.boolean(),
});

// Schema for adding a keyword group
const addKeywordGroupSchema = z.object({
  name: z.string().min(1, "Group name is required"),
  description: z.string().optional(),
  isActive: z.boolean().default(true),
});

// Schema for updating monitor result status
const updateResultStatusSchema = z.object({
  status: z.enum(["pending", "approved", "rejected", "archived"]),
});

// Get all keywords
router.get("/", async (req, res) => {
  try {
    const allKeywords = await db
      .select()
      .from(keywords)
      .orderBy(desc(keywords.createdAt));
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
        updatedAt: new Date(),
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
        updatedAt: new Date(),
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
    await db.delete(keywords).where(eq(keywords.id, Number(id)));

    res.json({ message: "Keyword deleted successfully" });
  } catch (error) {
    console.error("Error deleting keyword:", error);
    res.status(500).json({ message: "Failed to delete keyword" });
  }
});

// Get all excluded keywords
router.get("/excluded", async (req, res) => {
  try {
    const allExcludedKeywords = await db
      .select()
      .from(excludedKeywords)
      .orderBy(desc(excludedKeywords.createdAt));
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
      return res
        .status(409)
        .json({ message: "Excluded keyword already exists" });
    }

    // Insert new excluded keyword
    const [newExcludedKeyword] = await db
      .insert(excludedKeywords)
      .values({
        term: validatedData.term,
        reason: validatedData.reason,
        createdAt: new Date(),
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
    const allGroups = await db
      .select()
      .from(keywordGroups)
      .orderBy(asc(keywordGroups.name));

    // For each group, find associated keywords
    const groupsWithKeywords = await Promise.all(
      allGroups.map(async (group) => {
        const mappings = await db
          .select()
          .from(keywordGroupMappings)
          .where(eq(keywordGroupMappings.groupId, group.id));

        const keywordIds = mappings.map((mapping) => mapping.keywordId);

        // Get keywords if there are any mappings
        let groupKeywords: any[] = [];
        if (keywordIds.length > 0) {
          // Handle each ID separately to avoid formatting issues
          groupKeywords = await db
            .select()
            .from(keywords)
            .where(inArray(keywords.id, keywordIds));
        }

        return {
          ...group,
          keywords: groupKeywords,
        };
      }),
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
        createdAt: new Date(),
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
      return res
        .status(400)
        .json({ message: "keywordIds must be a non-empty array" });
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
    const mappingsToInsert = keywordIds.map((keywordId) => ({
      keywordId: Number(keywordId),
      groupId: Number(groupId),
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

    let query = db.select().from(monitorResults).$dynamic();

    // Filter by status if provided
    if (status && status !== "all") {
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
        reviewedBy: existingResult[0].reviewedBy || "admin",
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

// Run the keyword monitor with real API searches
router.post("/monitor/run", async (req, res) => {
  try {
    const { runKeywordMonitorNow } = await import("../services/keyword-monitor-service");
    const result = await runKeywordMonitorNow();

    if (!result.success) {
      return res.status(400).json({
        message: result.message || "Failed to run monitor",
        error: result.error,
      });
    }

    // Update last searched timestamp for active keywords
    const activeKeywords = await db
      .select()
      .from(keywords)
      .where(eq(keywords.isActive, true));

    for (const keyword of activeKeywords) {
      await db
        .update(keywords)
        .set({
          lastSearched: new Date(),
          matchCount: (keyword.matchCount || 0) + 1,
        })
        .where(eq(keywords.id, keyword.id));
    }

    res.json({
      message: "Keyword monitor ran successfully",
      found: result.results?.total || 0,
      results: result.results,
    });
  } catch (error) {
    console.error("Error running keyword monitor:", error);
    res.status(500).json({ message: "Failed to run keyword monitor" });
  }
});

export default router;
