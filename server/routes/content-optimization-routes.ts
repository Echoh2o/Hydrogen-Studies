/**
 * Content Optimization API Routes
 * Endpoints for content relationship tracking, update detection, and optimization
 */

import { Router, Request, Response } from "express";
import { contentOptimizationService } from "../services/content-optimization-service";
import { autoUpdateDetector } from "../services/auto-update-detector";
import { db } from "../db";
import {
  contentRelationships,
  contentVersions,
  updateNotifications,
  contentDependencies,
  updateHistory,
  smartLinks,
} from "@shared/schema";
import { eq, and, or, desc, asc, sql } from "drizzle-orm";
import { asyncHandler } from "../utils/error-handler";
import { AppError, ErrorCode } from "../utils/app-errors";
import { z } from "zod";

const router = Router();

// Input validation schemas
const detectRelationshipsSchema = z.object({
  sourceType: z.enum(["blog", "study"]),
  sourceId: z.number().positive(),
});

const createVersionSchema = z.object({
  contentType: z.enum(["blog", "study"]),
  contentId: z.number().positive(),
  title: z.string().optional(),
  content: z.string().optional(),
  summary: z.string().optional(),
  changeNotes: z.string(),
  changeReason: z.string(),
  changedBy: z.string().optional(),
});

const generateLinksSchema = z.object({
  contentType: z.enum(["blog", "study"]),
  contentId: z.number().positive(),
});

const applyNotificationSchema = z.object({
  notificationId: z.number().positive(),
  reviewedBy: z.string(),
});

/**
 * Detect and track content relationships
 */
router.post(
  "/relationships/detect",
  asyncHandler(async (req: Request, res: Response) => {
    const validated = detectRelationshipsSchema.parse(req.body);

    const result = await contentOptimizationService.detectContentRelationships(
      validated.sourceType,
      validated.sourceId,
    );

    res.json({
      success: true,
      data: result,
    });
  }),
);

/**
 * Get relationships for a content piece
 */
router.get(
  "/relationships/:contentType/:contentId",
  asyncHandler(async (req: Request, res: Response) => {
    const { contentType, contentId } = req.params;

    // Validate params
    if (!["blog", "study"].includes(contentType)) {
      throw new AppError(
        "Invalid content type",
        400,
        ErrorCode.VALIDATION_ERROR,
      );
    }

    const relationships = await db
      .select()
      .from(contentRelationships)
      .where(
        or(
          and(
            eq(contentRelationships.sourceType, contentType),
            eq(contentRelationships.sourceId, parseInt(contentId)),
          ),
          and(
            eq(contentRelationships.targetType, contentType),
            eq(contentRelationships.targetId, parseInt(contentId)),
          ),
        ),
      )
      .orderBy(desc(contentRelationships.confidence));

    res.json({
      success: true,
      data: relationships,
    });
  }),
);

/**
 * Manually trigger update detection for a study
 */
router.post(
  "/updates/detect/:studyId",
  asyncHandler(async (req: Request, res: Response) => {
    const studyId = parseInt(req.params.studyId);

    const result = await autoUpdateDetector.detectUpdatesForStudy(studyId);

    res.json({
      success: true,
      data: {
        updateChecks: result,
        message: `Detected ${result.length} content pieces that may need updates`,
      },
    });
  }),
);

/**
 * Get pending update notifications
 */
router.get(
  "/notifications/pending",
  asyncHandler(async (req: Request, res: Response) => {
    const { priority, contentType, limit } = req.query;

    const notifications =
      await contentOptimizationService.getPendingNotifications({
        priority: priority as string,
        contentType: contentType as string,
        limit: limit ? parseInt(limit as string) || 50 : 50,
      });

    res.json({
      success: true,
      data: notifications,
    });
  }),
);

/**
 * Get all update notifications with filtering
 */
router.get(
  "/notifications",
  asyncHandler(async (req: Request, res: Response) => {
    const {
      status,
      priority,
      contentType,
      page = "1",
      limit = "20",
    } = req.query;

    let query = db.select().from(updateNotifications).$dynamic();

    // Apply filters
    const conditions = [];
    if (status) {
      conditions.push(eq(updateNotifications.status, status as string));
    }
    if (priority) {
      conditions.push(eq(updateNotifications.priority, priority as string));
    }
    if (contentType) {
      conditions.push(
        eq(updateNotifications.contentType, contentType as string),
      );
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    // Apply pagination
    const pageNum = parseInt(page as string) || 1;
    const limitNum = parseInt(limit as string) || 20;
    query = query
      .orderBy(
        desc(updateNotifications.priorityScore),
        desc(updateNotifications.createdAt),
      )
      .limit(limitNum)
      .offset((pageNum - 1) * limitNum);

    const notifications = await query;

    res.json({
      success: true,
      data: notifications,
      pagination: {
        page: pageNum,
        limit: limitNum,
      },
    });
  }),
);

/**
 * Apply an update notification
 */
router.post(
  "/notifications/apply",
  asyncHandler(async (req: Request, res: Response) => {
    const validated = applyNotificationSchema.parse(req.body);

    await contentOptimizationService.applyUpdateNotification(
      validated.notificationId,
      validated.reviewedBy,
    );

    res.json({
      success: true,
      message: "Update notification applied successfully",
    });
  }),
);

/**
 * Reject an update notification
 */
router.post(
  "/notifications/:id/reject",
  asyncHandler(async (req: Request, res: Response) => {
    const notificationId = parseInt(req.params.id);
    const { notes, reviewedBy } = req.body;

    await db
      .update(updateNotifications)
      .set({
        status: "rejected",
        reviewedBy,
        reviewedAt: new Date(),
        notes,
      })
      .where(eq(updateNotifications.id, notificationId));

    res.json({
      success: true,
      message: "Update notification rejected",
    });
  }),
);

/**
 * Create a new content version
 */
router.post(
  "/versions/create",
  asyncHandler(async (req: Request, res: Response) => {
    const validated = createVersionSchema.parse(req.body);

    const version = await contentOptimizationService.createContentVersion(
      validated.contentType,
      validated.contentId,
      validated,
    );

    res.json({
      success: true,
      data: version,
    });
  }),
);

/**
 * Get version history for content
 */
router.get(
  "/versions/:contentType/:contentId",
  asyncHandler(async (req: Request, res: Response) => {
    const { contentType, contentId } = req.params;

    const versions = await db
      .select()
      .from(contentVersions)
      .where(
        and(
          eq(contentVersions.contentType, contentType),
          eq(contentVersions.contentId, parseInt(contentId)),
        ),
      )
      .orderBy(desc(contentVersions.versionNumber));

    res.json({
      success: true,
      data: versions,
    });
  }),
);

/**
 * Generate smart links for content
 */
router.post(
  "/links/generate",
  asyncHandler(async (req: Request, res: Response) => {
    const validated = generateLinksSchema.parse(req.body);

    const links = await contentOptimizationService.generateSmartLinks(
      validated.contentType,
      validated.contentId,
    );

    res.json({
      success: true,
      data: links,
    });
  }),
);

/**
 * Get smart links for content
 */
router.get(
  "/links/:contentType/:contentId",
  asyncHandler(async (req: Request, res: Response) => {
    const { contentType, contentId } = req.params;

    const links = await db
      .select()
      .from(smartLinks)
      .where(
        and(
          eq(smartLinks.fromType, contentType),
          eq(smartLinks.fromId, parseInt(contentId)),
          eq(smartLinks.isActive, true),
        ),
      )
      .orderBy(desc(smartLinks.relevanceScore));

    res.json({
      success: true,
      data: links,
    });
  }),
);

/**
 * Get content dependencies
 */
router.get(
  "/dependencies/:contentType/:contentId",
  asyncHandler(async (req: Request, res: Response) => {
    const { contentType, contentId } = req.params;

    const dependencies = await db
      .select()
      .from(contentDependencies)
      .where(
        and(
          eq(contentDependencies.contentType, contentType),
          eq(contentDependencies.contentId, parseInt(contentId)),
        ),
      )
      .orderBy(desc(contentDependencies.importance));

    res.json({
      success: true,
      data: dependencies,
    });
  }),
);

/**
 * Get update history
 */
router.get(
  "/history/:contentType/:contentId",
  asyncHandler(async (req: Request, res: Response) => {
    const { contentType, contentId } = req.params;

    const history = await db
      .select()
      .from(updateHistory)
      .where(
        and(
          eq(updateHistory.contentType, contentType),
          eq(updateHistory.contentId, parseInt(contentId)),
        ),
      )
      .orderBy(desc(updateHistory.createdAt));

    res.json({
      success: true,
      data: history,
    });
  }),
);

/**
 * Get content optimization dashboard stats
 */
router.get(
  "/dashboard/stats",
  asyncHandler(async (req: Request, res: Response) => {
    // Get pending notifications count by priority
    const pendingByPriority = await db
      .select({
        priority: updateNotifications.priority,
        count: sql<number>`count(*)::int`,
      })
      .from(updateNotifications)
      .where(eq(updateNotifications.status, "pending"))
      .groupBy(updateNotifications.priority);

    // Get recent updates count
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const recentUpdates = await db
      .select({
        count: sql<number>`count(*)::int`,
      })
      .from(updateHistory)
      .where(sql`${updateHistory.createdAt} >= ${sevenDaysAgo}`);

    // Get total relationships
    const totalRelationships = await db
      .select({
        count: sql<number>`count(*)::int`,
      })
      .from(contentRelationships);

    // Get total smart links
    const totalSmartLinks = await db
      .select({
        active: sql<number>`count(*) filter (where ${smartLinks.isActive})::int`,
        total: sql<number>`count(*)::int`,
      })
      .from(smartLinks);

    res.json({
      success: true,
      data: {
        pendingNotifications: pendingByPriority,
        recentUpdates: recentUpdates[0]?.count || 0,
        totalRelationships: totalRelationships[0]?.count || 0,
        smartLinks: {
          active: totalSmartLinks[0]?.active || 0,
          total: totalSmartLinks[0]?.total || 0,
        },
      },
    });
  }),
);

/**
 * Start auto-update detector
 */
router.post(
  "/auto-update/start",
  asyncHandler(async (req: Request, res: Response) => {
    const { intervalMinutes = 60 } = req.body;

    autoUpdateDetector.start(intervalMinutes);

    res.json({
      success: true,
      message: `Auto-update detector started with ${intervalMinutes} minute interval`,
    });
  }),
);

/**
 * Stop auto-update detector
 */
router.post(
  "/auto-update/stop",
  asyncHandler(async (req: Request, res: Response) => {
    autoUpdateDetector.stop();

    res.json({
      success: true,
      message: "Auto-update detector stopped",
    });
  }),
);

export default router;
