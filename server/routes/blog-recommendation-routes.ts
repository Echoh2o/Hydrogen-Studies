import { Router } from "express";
import { z } from "zod";
import {
  getBlogRecommendations,
  generateBulkBlogs,
  type BulkGenerationRequest,
} from "../services/blog-recommendation-system";
import { db } from "../db";
import { blogArticles } from "@shared/schema";
import { requireAdmin } from "../auth";

const router = Router();

/**
 * Get blog article recommendations
 */
router.get("/recommendations", requireAdmin, async (req, res) => {
  try {
    console.log("Blog recommendations endpoint called");
    const limit = parseInt(req.query.limit as string) || 10; // Reduced default limit
    const recommendations = await getBlogRecommendations(limit);

    console.log(`Returning ${recommendations.length} recommendations`);
    res.json({
      success: true,
      data: recommendations,
      count: recommendations.length,
    });
  } catch (error) {
    console.error("Error fetching blog recommendations:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch blog recommendations",
    });
  }
});

/**
 * Generate bulk blog articles
 */
router.post("/bulk-generate", requireAdmin, async (req, res) => {
  try {
    const requestSchema = z.object({
      selectedStudyIds: z
        .array(z.number())
        .min(1, "At least one study must be selected"),
      articleTypes: z
        .array(z.string())
        .min(1, "At least one article type must be selected"),
      readingLevel: z.string().default("general"),
      includeImages: z.boolean().default(true),
      includeSEO: z.boolean().default(true),
      saveToDatabase: z.boolean().default(false),
    });

    const validatedRequest = requestSchema.parse(req.body);

    // Generate the blogs
    const results = await generateBulkBlogs(validatedRequest);

    // Save to database if requested
    let savedCount = 0;
    let failedSaves = 0;

    if (validatedRequest.saveToDatabase) {
      // Collect all rows up front and do a single batch INSERT instead
      // of one INSERT per blog. With 50 studies × 3 articles = ~150
      // round-trips that's a real bottleneck on a "bulk generate"
      // request — collapsing to 1 round-trip removes seconds of latency.
      // Each slug appends a per-row counter (in addition to Date.now())
      // so the unique-constraint can't be tripped by two rows in the
      // same millisecond.
      const baseTimestamp = Date.now();
      const rowsToInsert: Array<typeof blogArticles.$inferInsert> = [];
      let counter = 0;
      for (const studyResult of results) {
        if (!studyResult.success) continue;
        for (const blog of studyResult.generatedBlogs) {
          const slug = (blog.title || "untitled")
            .toLowerCase()
            .replace(/[^\w\s-]/g, "")
            .replace(/\s+/g, "-")
            .replace(/-+/g, "-")
            .replace(/^-+|-+$/g, "")
            .substring(0, 100) || "untitled-blog";
          rowsToInsert.push({
            title: blog.title,
            slug: `${slug}-${baseTimestamp}-${counter++}`,
            summary: blog.summary || blog.title,
            content: blog.content,
            studyId: studyResult.studyId,
            articleType: blog.articleType || "summary",
            readingLevel: validatedRequest.readingLevel || "general",
            isPublished: false,
          });
        }
      }
      if (rowsToInsert.length > 0) {
        try {
          // Single INSERT ... VALUES (...), (...), (...) — Postgres handles
          // hundreds of rows without issue.
          await db.insert(blogArticles).values(rowsToInsert);
          savedCount = rowsToInsert.length;
        } catch (saveError) {
          console.error("Error saving bulk blogs:", saveError);
          // The batch is all-or-nothing on a failure; report the full
          // intended count as failed so the response stays accurate.
          failedSaves = rowsToInsert.length;
          savedCount = 0;
        }
      }
    }

    res.json({
      success: true,
      data: {
        generationResults: results,
        summary: {
          totalStudies: results.length,
          successfulStudies: results.filter((r) => r.success).length,
          failedStudies: results.filter((r) => !r.success).length,
          totalBlogs: results.reduce(
            (sum, r) => sum + r.generatedBlogs.length,
            0,
          ),
          savedBlogs: savedCount,
          failedSaves,
        },
      },
    });
  } catch (error) {
    console.error("Error generating bulk blogs:", error);

    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: error.errors[0].message,
      });
    }

    res.status(500).json({
      success: false,
      error: "Failed to generate bulk blogs",
    });
  }
});

/**
 * Preview blog generation for selected studies
 */
router.post("/preview", requireAdmin, async (req, res) => {
  try {
    const previewSchema = z.object({
      selectedStudyIds: z
        .array(z.number())
        .min(1, "At least one study must be selected"),
      articleTypes: z
        .array(z.string())
        .min(1, "At least one article type must be selected"),
    });

    const { selectedStudyIds, articleTypes } = previewSchema.parse(req.body);

    // Calculate estimated generation stats
    const totalBlogs = selectedStudyIds.length * articleTypes.length;
    const estimatedTimeMinutes = Math.ceil(totalBlogs * 1.5); // Estimate 1.5 minutes per blog

    res.json({
      success: true,
      data: {
        selectedStudiesCount: selectedStudyIds.length,
        articleTypesCount: articleTypes.length,
        totalBlogsToGenerate: totalBlogs,
        estimatedTimeMinutes: estimatedTimeMinutes,
        estimatedTimeDisplay:
          estimatedTimeMinutes < 60
            ? `${estimatedTimeMinutes} minutes`
            : `${Math.floor(estimatedTimeMinutes / 60)}h ${estimatedTimeMinutes % 60}m`,
        articleTypes: articleTypes,
      },
    });
  } catch (error) {
    console.error("Error creating generation preview:", error);

    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: error.errors[0].message,
      });
    }

    res.status(500).json({
      success: false,
      error: "Failed to create generation preview",
    });
  }
});

// ============================
// Background Job Queue Endpoints
// ============================

import {
  createJob,
  startJob,
  pauseJob,
  cancelJob,
  getJobStatus,
  listJobs,
  getWorkerState,
} from "../services/blog-generation-worker";

/**
 * Create a new background generation job
 * POST /api/blog-recommendations/jobs
 */
router.post("/jobs", requireAdmin, async (req, res) => {
  try {
    const jobSchema = z.object({
      studyIds: z.array(z.number()).min(1, "At least one study required"),
      articleTypes: z.array(z.string()).min(1, "At least one article type required"),
      readingLevel: z.string().default("general"),
      includeImages: z.boolean().default(true),
      includeSEO: z.boolean().default(true),
      autoStart: z.boolean().default(true),
    });

    const config = jobSchema.parse(req.body);
    const result = await createJob(config);

    if (!result.success) {
      return res.status(400).json(result);
    }

    // Auto-start if requested
    if (config.autoStart && result.jobId) {
      const startResult = await startJob(result.jobId);
      return res.json({ ...result, started: startResult.success, startMessage: startResult.message });
    }

    res.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: error.errors[0].message });
    }
    console.error("Error creating job:", error);
    res.status(500).json({ success: false, error: "Failed to create job" });
  }
});

/**
 * List all jobs
 * GET /api/blog-recommendations/jobs
 */
router.get("/jobs", requireAdmin, async (req, res) => {
  try {
    const jobs = await listJobs();
    const worker = getWorkerState();
    res.json({ success: true, jobs, worker });
  } catch (error) {
    console.error("Error listing jobs:", error);
    res.status(500).json({ success: false, error: "Failed to list jobs" });
  }
});

/**
 * Get job status
 * GET /api/blog-recommendations/jobs/:id
 */
router.get("/jobs/:id", requireAdmin, async (req, res) => {
  try {
    const jobId = parseInt(req.params.id);
    if (isNaN(jobId)) return res.status(400).json({ error: "Invalid job ID" });

    const status = await getJobStatus(jobId);
    if (!status) return res.status(404).json({ error: "Job not found" });

    res.json({ success: true, job: status });
  } catch (error) {
    console.error("Error getting job status:", error);
    res.status(500).json({ success: false, error: "Failed to get job status" });
  }
});

/**
 * Start/resume a job
 * POST /api/blog-recommendations/jobs/:id/start
 */
router.post("/jobs/:id/start", requireAdmin, async (req, res) => {
  try {
    const jobId = parseInt(req.params.id);
    if (isNaN(jobId)) return res.status(400).json({ error: "Invalid job ID" });

    const result = await startJob(jobId);
    res.json(result);
  } catch (error) {
    console.error("Error starting job:", error);
    res.status(500).json({ success: false, error: "Failed to start job" });
  }
});

/**
 * Pause a running job
 * POST /api/blog-recommendations/jobs/:id/pause
 */
router.post("/jobs/:id/pause", requireAdmin, async (req, res) => {
  try {
    const jobId = parseInt(req.params.id);
    if (isNaN(jobId)) return res.status(400).json({ error: "Invalid job ID" });

    const result = await pauseJob(jobId);
    res.json(result);
  } catch (error) {
    console.error("Error pausing job:", error);
    res.status(500).json({ success: false, error: "Failed to pause job" });
  }
});

/**
 * Cancel a job
 * POST /api/blog-recommendations/jobs/:id/cancel
 */
router.post("/jobs/:id/cancel", requireAdmin, async (req, res) => {
  try {
    const jobId = parseInt(req.params.id);
    if (isNaN(jobId)) return res.status(400).json({ error: "Invalid job ID" });

    const result = await cancelJob(jobId);
    res.json(result);
  } catch (error) {
    console.error("Error cancelling job:", error);
    res.status(500).json({ success: false, error: "Failed to cancel job" });
  }
});

export default router;
