/**
 * Routes for educational resources including glossary, FAQs, and tutorials
 */
import { Router } from "express";
import { db } from "../db";
import {
  glossaryTerms,
  faqItems,
  educationalResources,
  insertGlossaryTermSchema,
  insertFaqItemSchema,
  insertEducationalResourceSchema,
} from "@shared/schema";
import { eq, asc, desc, sql } from "drizzle-orm";
import { z } from "zod";

const router = Router();

// GET /api/educational/resources - Get all educational resources
router.get("/resources", async (req, res) => {
  try {
    const resources = await db
      .select()
      .from(educationalResources)
      .orderBy(asc(educationalResources.title));
    res.json(resources);
  } catch (error) {
    console.error("Error fetching educational resources:", error);
    res.status(500).json({ message: "Failed to fetch educational resources" });
  }
});

// GET /api/educational/resources/:id - Get specific resource by ID
router.get("/resources/:id", async (req, res) => {
  try {
    const resourceId = Number(req.params.id);
    if (isNaN(resourceId)) {
      return res.status(400).json({ message: "Invalid resource ID" });
    }

    const [resource] = await db
      .select()
      .from(educationalResources)
      .where(eq(educationalResources.id, resourceId));

    if (!resource) {
      return res.status(404).json({ message: "Resource not found" });
    }

    // Increment view count
    await db
      .update(educationalResources)
      .set({ viewCount: (resource.viewCount || 0) + 1 })
      .where(eq(educationalResources.id, resourceId));

    res.json(resource);
  } catch (error) {
    console.error("Error fetching educational resource:", error);
    res.status(500).json({ message: "Failed to fetch educational resource" });
  }
});

// GET /api/educational/glossary - Get all glossary terms
router.get("/glossary", async (req, res) => {
  try {
    const terms = await db
      .select()
      .from(glossaryTerms)
      .orderBy(asc(glossaryTerms.term));
    res.json(terms);
  } catch (error) {
    console.error("Error fetching glossary terms:", error);
    res.status(500).json({ message: "Failed to fetch glossary terms" });
  }
});

// GET /api/educational/glossary/search - Search glossary terms
router.get("/glossary/search", async (req, res) => {
  try {
    const { query } = req.query;
    if (!query || typeof query !== "string") {
      return res.status(400).json({ message: "Search query is required" });
    }

    const terms = await db
      .select()
      .from(glossaryTerms)
      .where(
        sql`LOWER(${glossaryTerms.term}) LIKE LOWER(${"%" + query + "%"}) OR LOWER(${glossaryTerms.definition}) LIKE LOWER(${"%" + query + "%"})`,
      )
      .orderBy(asc(glossaryTerms.term));

    res.json(terms);
  } catch (error) {
    console.error("Error searching glossary terms:", error);
    res.status(500).json({ message: "Failed to search glossary terms" });
  }
});

// GET /api/educational/faq - Get all FAQ items
router.get("/faq", async (req, res) => {
  try {
    const faqs = await db
      .select()
      .from(faqItems)
      .orderBy(asc(faqItems.category), asc(faqItems.order));
    res.json(faqs);
  } catch (error) {
    console.error("Error fetching FAQ items:", error);
    res.status(500).json({ message: "Failed to fetch FAQ items" });
  }
});

// GET /api/educational/faq/category/:category - Get FAQ items by category
router.get("/faq/category/:category", async (req, res) => {
  try {
    const { category } = req.params;
    if (!category) {
      return res.status(400).json({ message: "Category is required" });
    }

    const faqs = await db
      .select()
      .from(faqItems)
      .where(eq(faqItems.category, category))
      .orderBy(asc(faqItems.order));

    res.json(faqs);
  } catch (error) {
    console.error("Error fetching FAQ items by category:", error);
    res.status(500).json({ message: "Failed to fetch FAQ items" });
  }
});

// Admin routes for managing educational content
// POST /api/educational/resources - Create a new educational resource
router.post("/resources", async (req, res) => {
  try {
    const resourceData = insertEducationalResourceSchema.parse(req.body);

    const [resource] = await db
      .insert(educationalResources)
      .values({
        ...resourceData,
        createdAt: new Date(),
        updatedAt: new Date(),
        viewCount: 0,
      })
      .returning();

    res.status(201).json(resource);
  } catch (error) {
    console.error("Error creating educational resource:", error);
    res.status(500).json({ message: "Failed to create educational resource" });
  }
});

// POST /api/educational/glossary - Create a new glossary term
router.post("/glossary", async (req, res) => {
  try {
    const termData = insertGlossaryTermSchema.parse(req.body);

    const [term] = await db
      .insert(glossaryTerms)
      .values({
        ...termData,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    res.status(201).json(term);
  } catch (error) {
    console.error("Error creating glossary term:", error);
    res.status(500).json({ message: "Failed to create glossary term" });
  }
});

// POST /api/educational/faq - Create a new FAQ item
router.post("/faq", async (req, res) => {
  try {
    const faqData = insertFaqItemSchema.parse(req.body);

    const [faq] = await db
      .insert(faqItems)
      .values({
        ...faqData,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    res.status(201).json(faq);
  } catch (error) {
    console.error("Error creating FAQ item:", error);
    res.status(500).json({ message: "Failed to create FAQ item" });
  }
});

// PUT routes for updating resources
router.put("/resources/:id", async (req, res) => {
  try {
    const resourceId = Number(req.params.id);
    if (isNaN(resourceId)) {
      return res.status(400).json({ message: "Invalid resource ID" });
    }

    const resourceData = insertEducationalResourceSchema.parse(req.body);

    const [updatedResource] = await db
      .update(educationalResources)
      .set({
        ...resourceData,
        updatedAt: new Date(),
      })
      .where(eq(educationalResources.id, resourceId))
      .returning();

    if (!updatedResource) {
      return res.status(404).json({ message: "Resource not found" });
    }

    res.json(updatedResource);
  } catch (error) {
    console.error("Error updating educational resource:", error);
    res.status(500).json({ message: "Failed to update educational resource" });
  }
});

// DELETE routes for removing resources
router.delete("/resources/:id", async (req, res) => {
  try {
    const resourceId = Number(req.params.id);
    if (isNaN(resourceId)) {
      return res.status(400).json({ message: "Invalid resource ID" });
    }

    await db
      .delete(educationalResources)
      .where(eq(educationalResources.id, resourceId));

    res.json({ success: true, message: "Resource deleted successfully" });
  } catch (error) {
    console.error("Error deleting educational resource:", error);
    res.status(500).json({ message: "Failed to delete educational resource" });
  }
});

export default router;
