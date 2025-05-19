import { Router } from "express";
import { db } from "../db";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { monitorSchedule, keywords } from "@shared/schema";
import { checkScheduledSearches, runKeywordMonitorNow } from "../keyword-monitor-service";

const router = Router();

// Schema for schedule updates
const scheduleSchema = z.object({
  enabled: z.boolean(),
  frequency: z.string(),
  time: z.string(),
  days: z.array(z.string()),
  sources: z.array(z.string())
});

/**
 * Check scheduled search status
 */
router.get("/status", async (req, res) => {
  try {
    const status = await checkScheduledSearches();
    return res.json(status);
  } catch (error) {
    console.error("Error checking scheduled search status:", error);
    return res.status(500).json({ message: "Failed to check schedule status" });
  }
});

/**
 * Get current schedule
 */
router.get("/", async (req, res) => {
  try {
    const [schedule] = await db.select().from(monitorSchedule);
    
    if (!schedule) {
      // Create default schedule if none exists
      const [newSchedule] = await db.insert(monitorSchedule).values({
        enabled: false,
        frequency: "daily",
        time: "00:00",
        days: ["monday", "wednesday", "friday"],
        sources: ["pubmed", "crossref", "europepmc"],
        createdAt: new Date(),
        updatedAt: new Date()
      }).returning();
      
      return res.json(newSchedule);
    }
    
    return res.json(schedule);
  } catch (error) {
    console.error("Error fetching schedule:", error);
    return res.status(500).json({ message: "Failed to fetch schedule" });
  }
});

/**
 * Update schedule
 */
router.post("/", async (req, res) => {
  try {
    const data = scheduleSchema.parse(req.body);
    
    const [existingSchedule] = await db.select().from(monitorSchedule);
    
    if (existingSchedule) {
      // Update existing schedule
      const [updatedSchedule] = await db
        .update(monitorSchedule)
        .set({
          ...data,
          updatedAt: new Date()
        })
        .where(eq(monitorSchedule.id, existingSchedule.id))
        .returning();
      
      return res.json(updatedSchedule);
    } else {
      // Create new schedule
      const [newSchedule] = await db
        .insert(monitorSchedule)
        .values({
          ...data,
          createdAt: new Date(),
          updatedAt: new Date()
        })
        .returning();
      
      return res.json(newSchedule);
    }
  } catch (error) {
    console.error("Error updating schedule:", error);
    return res.status(500).json({ message: "Failed to update schedule" });
  }
});

/**
 * Run scheduled monitor now (manual trigger)
 */
router.post("/run-now", async (req, res) => {
  try {
    // Get the schedule configuration to verify it exists
    const [schedule] = await db.select().from(monitorSchedule);
    
    if (!schedule) {
      return res.status(404).json({ message: "Schedule not found" });
    }
    
    // Run the keyword monitor immediately
    const result = await runKeywordMonitorNow();
    
    if (!result.success) {
      return res.status(400).json({ 
        message: result.message || "Failed to run monitor", 
        error: result.error 
      });
    }
    
    return res.json({ 
      message: "Monitor completed successfully", 
      results: result.results
    });
  } catch (error) {
    console.error("Error running monitor:", error);
    return res.status(500).json({ message: "Failed to run monitor" });
  }
});

/**
 * Helper function to get all active keywords
 */
async function getActiveKeywords() {
  try {
    const activeKeywords = await db
      .select()
      .from(keywords)
      .where(eq(keywords.isActive, true));
    
    return activeKeywords;
  } catch (error) {
    console.error("Error fetching active keywords:", error);
    return [];
  }
}

export default router;