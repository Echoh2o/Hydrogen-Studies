/**
 * Content Analytics Routes
 * API endpoints for content performance analytics and tracking
 */

import { Router } from "express";
import { z } from "zod";
import {
  contentAnalyticsService,
  ContentType,
  EngagementAction,
} from "../services/content-analytics-service";
import { asyncHandler } from "../utils/error-handler";
import { AppError, ErrorCode } from "../utils/app-errors";
import { v4 as uuidv4 } from "uuid";

const router = Router();

// Validation schemas
const trackViewSchema = z.object({
  contentType: z.enum(["study", "blog", "article"]),
  contentId: z.number().positive(),
  userId: z.string().optional(),
  sessionId: z.string().optional(),
  referrerType: z.string().optional(),
  referrerValue: z.string().optional(),
  deviceType: z.enum(["desktop", "mobile", "tablet"]).optional(),
  browserType: z.string().optional(),
  contentPosition: z.number().optional(),
});

const trackEngagementSchema = z.object({
  contentType: z.enum(["study", "blog", "article"]),
  contentId: z.number().positive(),
  userId: z.string().optional(),
  sessionId: z.string().optional(),
  action: z.enum([
    "view",
    "like",
    "share",
    "download",
    "comment",
    "click",
    "scroll",
    "time_spent",
  ]),
  actionValue: z.string().optional(),
  timeSpent: z.number().optional(),
  scrollDepth: z.number().min(0).max(100).optional(),
});

const getTopContentSchema = z.object({
  limit: z.string().transform(Number).default("10"),
  contentType: z.enum(["study", "blog", "article"]).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

const contentInsightsSchema = z.object({
  type: z.enum(["study", "blog", "article"]),
  id: z.string().transform(Number),
});

const abTestSchema = z.object({
  testId: z.string(),
});

/**
 * POST /api/analytics/track-view
 * Record a content view
 */
router.post(
  "/track-view",
  asyncHandler(async (req, res) => {
    try {
      const validatedData = trackViewSchema.parse(req.body);

      // Get or create session ID
      const sessionId = validatedData.sessionId || req.session?.id || uuidv4();

      // Get user ID from session if available
      const userId = validatedData.userId || req.session?.userId;

      // Detect device and browser from user agent
      const userAgent = req.headers["user-agent"] || "";
      const deviceType = detectDeviceType(userAgent);
      const browserType = detectBrowserType(userAgent);

      // Get referrer information
      const referrer = req.headers.referer || req.headers.referrer;
      const referrerInfo = analyzeReferrer(referrer as string);

      await contentAnalyticsService.trackView({
        contentType: validatedData.contentType as ContentType,
        contentId: validatedData.contentId,
        userId: userId,
        sessionId: sessionId,
        referrerType: validatedData.referrerType || referrerInfo.type,
        referrerValue: validatedData.referrerValue || referrerInfo.value,
        deviceType: validatedData.deviceType || deviceType,
        browserType: validatedData.browserType || browserType,
        contentPosition: validatedData.contentPosition,
      });

      res.json({
        success: true,
        sessionId: sessionId,
      });
    } catch (error) {
      console.error("Error tracking view:", error);
      if (error instanceof z.ZodError) {
        throw new AppError(
          "Invalid tracking data",
          400,
          ErrorCode.VALIDATION_ERROR,
          false,
          { errors: error.errors },
        );
      }
      throw error;
    }
  }),
);

/**
 * POST /api/analytics/track-engagement
 * Record an engagement action
 */
router.post(
  "/track-engagement",
  asyncHandler(async (req, res) => {
    try {
      const validatedData = trackEngagementSchema.parse(req.body);

      // Get or create session ID
      const sessionId = validatedData.sessionId || req.session?.id || uuidv4();

      // Get user ID from session if available
      const userId = validatedData.userId || req.session?.userId;

      await contentAnalyticsService.trackEngagement({
        contentType: validatedData.contentType as ContentType,
        contentId: validatedData.contentId,
        userId: userId,
        sessionId: sessionId,
        action: validatedData.action as EngagementAction,
        actionValue: validatedData.actionValue,
        timeSpent: validatedData.timeSpent,
        scrollDepth: validatedData.scrollDepth,
      });

      res.json({
        success: true,
        sessionId: sessionId,
      });
    } catch (error) {
      console.error("Error tracking engagement:", error);
      if (error instanceof z.ZodError) {
        throw new AppError(
          "Invalid engagement data",
          400,
          ErrorCode.VALIDATION_ERROR,
          false,
          { errors: error.errors },
        );
      }
      throw error;
    }
  }),
);

/**
 * GET /api/analytics/top-content
 * Get top performing content
 */
router.get(
  "/top-content",
  asyncHandler(async (req, res) => {
    try {
      const validatedQuery = getTopContentSchema.parse(req.query);

      let period;
      if (validatedQuery.startDate && validatedQuery.endDate) {
        period = {
          start: new Date(validatedQuery.startDate),
          end: new Date(validatedQuery.endDate),
        };
      }

      const topContent = await contentAnalyticsService.getTopContent(
        validatedQuery.limit,
        validatedQuery.contentType as ContentType | undefined,
        period,
      );

      res.json({
        success: true,
        content: topContent,
        count: topContent.length,
      });
    } catch (error) {
      console.error("Error getting top content:", error);
      if (error instanceof z.ZodError) {
        throw new AppError(
          "Invalid query parameters",
          400,
          ErrorCode.VALIDATION_ERROR,
          false,
          { errors: error.errors },
        );
      }
      throw error;
    }
  }),
);

/**
 * GET /api/analytics/content-insights/:type/:id
 * Get insights for specific content
 */
router.get(
  "/content-insights/:type/:id",
  asyncHandler(async (req, res) => {
    try {
      const validatedParams = contentInsightsSchema.parse(req.params);

      const insights = await contentAnalyticsService.getContentInsights(
        validatedParams.type as ContentType,
        validatedParams.id,
      );

      if (!insights) {
        throw new AppError("Content not found", 404, ErrorCode.NOT_FOUND);
      }

      // Get optimization suggestions
      const suggestions =
        await contentAnalyticsService.generateOptimizationSuggestions(
          validatedParams.type as ContentType,
          validatedParams.id,
        );

      res.json({
        success: true,
        insights: insights,
        suggestions: suggestions,
      });
    } catch (error) {
      console.error("Error getting content insights:", error);
      if (error instanceof z.ZodError) {
        throw new AppError(
          "Invalid parameters",
          400,
          ErrorCode.VALIDATION_ERROR,
          false,
          { errors: error.errors },
        );
      }
      throw error;
    }
  }),
);

/**
 * GET /api/analytics/recommendations
 * Get personalized content recommendations
 */
router.get(
  "/recommendations",
  asyncHandler(async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 5;
      const sessionId = req.session?.id || (req.query.sessionId as string);
      const userId = req.session?.userId || (req.query.userId as string);

      if (!sessionId && !userId) {
        throw new AppError(
          "Session or user ID required",
          400,
          ErrorCode.VALIDATION_ERROR,
        );
      }

      const recommendations = await contentAnalyticsService.getRecommendations(
        userId,
        sessionId,
        limit,
      );

      res.json({
        success: true,
        recommendations: recommendations,
        count: recommendations.length,
      });
    } catch (error) {
      console.error("Error getting recommendations:", error);
      throw error;
    }
  }),
);

/**
 * GET /api/analytics/a-b-test
 * Get A/B test results
 */
router.get(
  "/a-b-test",
  asyncHandler(async (req, res) => {
    try {
      const validatedQuery = abTestSchema.parse(req.query);

      const results = await contentAnalyticsService.getABTestResults(
        validatedQuery.testId,
      );

      res.json({
        success: true,
        testId: validatedQuery.testId,
        results: results,
      });
    } catch (error) {
      console.error("Error getting A/B test results:", error);
      if (error instanceof z.ZodError) {
        throw new AppError(
          "Invalid test ID",
          400,
          ErrorCode.VALIDATION_ERROR,
          false,
          { errors: error.errors },
        );
      }
      throw error;
    }
  }),
);

/**
 * POST /api/analytics/batch-track
 * Track multiple events at once (for efficiency)
 */
router.post(
  "/batch-track",
  asyncHandler(async (req, res) => {
    try {
      const events = req.body.events;

      if (!Array.isArray(events)) {
        throw new AppError(
          "Events must be an array",
          400,
          ErrorCode.VALIDATION_ERROR,
        );
      }

      const results = {
        processed: 0,
        failed: 0,
        errors: [] as any[],
      };

      for (const event of events) {
        try {
          if (event.type === "view") {
            const validatedData = trackViewSchema.parse(event.data);
            await contentAnalyticsService.trackView({
              ...validatedData,
              contentType: validatedData.contentType as ContentType,
              sessionId: event.data.sessionId || req.session?.id || uuidv4(),
              userId: event.data.userId || req.session?.userId,
            });
          } else if (event.type === "engagement") {
            const validatedData = trackEngagementSchema.parse(event.data);
            await contentAnalyticsService.trackEngagement({
              ...validatedData,
              contentType: validatedData.contentType as ContentType,
              action: validatedData.action as EngagementAction,
              sessionId: event.data.sessionId || req.session?.id || uuidv4(),
              userId: event.data.userId || req.session?.userId,
            });
          }
          results.processed++;
        } catch (error) {
          results.failed++;
          results.errors.push({
            event: event,
            error: error instanceof Error ? error.message : "Unknown error",
          });
        }
      }

      res.json({
        success: true,
        results: results,
      });
    } catch (error) {
      console.error("Error batch tracking:", error);
      throw error;
    }
  }),
);

/**
 * GET /api/analytics/performance/:type/:id
 * Get detailed performance metrics for content
 */
router.get(
  "/performance/:type/:id",
  asyncHandler(async (req, res) => {
    try {
      const validatedParams = contentInsightsSchema.parse(req.params);

      // This would fetch detailed metrics from the service
      // For now, returning a structured response
      const performance = {
        contentType: validatedParams.type,
        contentId: validatedParams.id,
        metrics: {
          views: {
            total: 0,
            unique: 0,
            trend: "stable",
          },
          engagement: {
            avgTimeSpent: 0,
            bounceRate: 0,
            scrollDepth: 0,
          },
          interactions: {
            likes: 0,
            shares: 0,
            comments: 0,
            downloads: 0,
          },
          conversion: {
            rate: 0,
            relatedContentClicks: 0,
          },
        },
        period: {
          start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
          end: new Date(),
        },
      };

      res.json({
        success: true,
        performance: performance,
      });
    } catch (error) {
      console.error("Error getting performance metrics:", error);
      if (error instanceof z.ZodError) {
        throw new AppError(
          "Invalid parameters",
          400,
          ErrorCode.VALIDATION_ERROR,
          false,
          { errors: error.errors },
        );
      }
      throw error;
    }
  }),
);

// Helper functions

function detectDeviceType(userAgent: string): string {
  const ua = userAgent.toLowerCase();
  if (ua.includes("mobile")) return "mobile";
  if (ua.includes("tablet") || ua.includes("ipad")) return "tablet";
  return "desktop";
}

function detectBrowserType(userAgent: string): string {
  const ua = userAgent.toLowerCase();
  if (ua.includes("chrome")) return "chrome";
  if (ua.includes("firefox")) return "firefox";
  if (ua.includes("safari")) return "safari";
  if (ua.includes("edge")) return "edge";
  return "other";
}

function analyzeReferrer(referrer: string): { type: string; value: string } {
  if (!referrer) {
    return { type: "direct", value: "" };
  }

  try {
    const url = new URL(referrer);
    const hostname = url.hostname;

    // Social media detection
    const socialDomains = [
      "facebook.com",
      "twitter.com",
      "linkedin.com",
      "instagram.com",
    ];
    for (const domain of socialDomains) {
      if (hostname.includes(domain)) {
        return { type: "social", value: domain };
      }
    }

    // Search engine detection
    const searchDomains = [
      "google.com",
      "bing.com",
      "yahoo.com",
      "duckduckgo.com",
    ];
    for (const domain of searchDomains) {
      if (hostname.includes(domain)) {
        return { type: "search", value: domain };
      }
    }

    // Check if internal
    if (hostname === process.env.DOMAIN || hostname === "localhost") {
      return { type: "internal", value: url.pathname };
    }

    return { type: "external", value: hostname };
  } catch (error) {
    return { type: "unknown", value: referrer };
  }
}

export default router;
