import { Request, Response, Router } from "express";
import { db } from "../db";
import { sql, eq, count } from "drizzle-orm";
import { studies, categories, blogArticles } from "@shared/schema";
import { asyncHandler } from "../utils/error-handler";
import { withRetry } from "../utils/database-wrapper";
import { DatabaseError } from "../utils/app-errors";
import {
  initializeTaggingSystem,
  tagSingleStudy,
  processAllStudiesForTagging,
  getTaggingStats,
} from "../automated-tagging-system";
import { requireAdmin } from "../auth";

export class AdminController {
  public router: Router;

  constructor() {
    this.router = Router();
    this.initializeRoutes();
  }

  private initializeRoutes() {
    // All admin controller routes require admin auth
    this.router.use(requireAdmin);

    // System status
    this.router.get("/status", asyncHandler(this.getSystemStatus));
    this.router.get("/database-stats", asyncHandler(this.getDatabaseStats));

    // Dashboard stats (migrated from index.ts)
    // Note: The original route was /api/stats/dashboard.
    // If we mount this controller at /api/admin, it becomes /api/admin/dashboard-stats
    // We might need to handle the route mounting carefully.
    this.router.get("/dashboard-stats", asyncHandler(this.getDashboardStats));

    // Tagging routes
    this.router.post("/tagging/initialize", asyncHandler(this.initializeTagging));
    this.router.post("/tagging/process-all", asyncHandler(this.processAllTagging));
    this.router.post("/tagging/tag-study/:id", asyncHandler(this.tagStudy));
    this.router.get("/tagging/stats", asyncHandler(this.getTaggingStats));
  }

  private getSystemStatus = async (req: Request, res: Response) => {
      const totalStudies = await db
        .select({ count: count() })
        .from(studies);
      const totalCategories = await db
        .select({ count: count() })
        .from(categories);

      res.json({
        success: true,
        totalStudies: totalStudies[0]?.count || 0,
        totalCategories: totalCategories[0]?.count || 0,
        message: "System status retrieved successfully",
      });
  }

  private getDatabaseStats = async (req: Request, res: Response) => {
      const studyCount = await db
        .select({ count: count() })
        .from(studies);
      const categoryCount = await db
        .select({ count: count() })
        .from(categories);

      res.json({
        success: true,
        studies: studyCount[0]?.count || 0,
        categories: categoryCount[0]?.count || 0,
        message: "Database statistics retrieved successfully",
      });
  }

  private getDashboardStats = async (req: Request, res: Response) => {
      try {
      // Use circuit breaker for database operations (via withRetry as in index.ts)
      const stats = await withRetry(
        async () => {
          // Get total blog count
          const [totalResult] = await db
            .select({ count: count() })
            .from(blogArticles);

          // Get published blog count
          const [publishedResult] = await db
            .select({ count: count() })
            .from(blogArticles)
            .where(eq(blogArticles.isPublished, true));

          // Get draft blog count
          const [draftResult] = await db
            .select({ count: count() })
            .from(blogArticles)
            .where(eq(blogArticles.isPublished, false));

          // Get total studies count using SQL query with fallback
          let studiesCount = 0;
          try {
            const result = await db.execute(sql`SELECT COUNT(*) as count FROM studies`);
            studiesCount = Number(result.rows[0]?.count) || 0;
          } catch (error) {
            console.log("Direct SQL query failed, trying table query");
            try {
              const [studiesResult] = await db
                .select({ count: count() })
                .from(studies);
              studiesCount = studiesResult?.count || 0;
            } catch (tableError) {
              console.log("Table query also failed, using 0");
              studiesCount = 0;
            }
          }

          return {
            totalBlogs: Number(totalResult.count),
            publishedBlogs: Number(publishedResult.count),
            draftBlogs: Number(draftResult.count),
            totalStudies: Number(studiesCount),
            categoriesCount: 8,
            recentImports: 0,
          };
        },
        { maxRetries: 2, retryDelay: 500 },
      );

      res.json(stats);
    } catch (error) {
      // Error is handled by global error handler
      throw new DatabaseError(
        "Failed to fetch dashboard statistics",
        true,
        { endpoint: req.originalUrl },
        error as Error,
      );
    }
  }

  private initializeTagging = async (req: Request, res: Response) => {
      console.log("Initializing automated tagging system...");
      await initializeTaggingSystem();
      res.json({
        success: true,
        message: "Tagging system initialized successfully",
      });
  }

  private processAllTagging = async (req: Request, res: Response) => {
      console.log("Starting automated tagging for all studies...");

      // Run tagging process in background
      processAllStudiesForTagging()
        .then((result) => {
          console.log("Automated tagging process completed");
          console.log(
            `Final results: ${result.totalTagsAdded} tags added to ${result.successfullyTagged} studies`,
          );
        })
        .catch((error) =>
          console.error("Automated tagging process failed:", error),
        );

      res.json({
        success: true,
        message: "Automated tagging process started in background",
      });
  }

  private tagStudy = async (req: Request, res: Response) => {
      const studyId = parseInt(req.params.id);
      if (isNaN(studyId)) {
        return res.status(400).json({ message: "Invalid study ID" });
      }

      const result = await tagSingleStudy(studyId);
      res.json({
        success: true,
        result,
      });
  }

  private getTaggingStats = async (req: Request, res: Response) => {
      const stats = await getTaggingStats();
      res.json(stats);
  }
}

export const adminController = new AdminController();
