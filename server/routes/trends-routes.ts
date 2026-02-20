/**
 * API Routes for Trend Detection and Analysis
 */

import express from "express";
import { trendDetectionService } from "../services/trend-detection-service";
import { db } from "../db";
import {
  trendAnalysis,
  trendAlerts,
  searchQueries,
  studyMetrics,
} from "@shared/schema";
import { desc, eq, and, gte, lte, sql, count, isNull } from "drizzle-orm";
import { subDays, subMonths, startOfDay, endOfDay } from "date-fns";

const router = express.Router();

/**
 * GET /api/trends/emerging-topics
 * Returns top emerging research topics
 */
router.get("/emerging-topics", async (req, res) => {
  try {
    const { period = "monthly" } = req.query;

    if (!["weekly", "monthly", "quarterly"].includes(period as string)) {
      return res.status(400).json({
        error: "Invalid period. Use weekly, monthly, or quarterly.",
      });
    }

    const topics = await trendDetectionService.identifyEmergingTopics(
      period as "weekly" | "monthly" | "quarterly",
    );

    res.json({
      success: true,
      period,
      count: topics.length,
      topics: topics.map((topic) => ({
        name: topic.topic,
        growth: `${topic.growthRate.toFixed(1)}%`,
        studyCount: topic.count,
        previousCount: topic.previousCount,
        significance: topic.significance,
        relatedKeywords: topic.keywords,
        studyIds: topic.studyIds,
      })),
    });
  } catch (error) {
    console.error("Error fetching emerging topics:", error);
    res.status(500).json({
      error: "Failed to fetch emerging topics",
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * GET /api/trends/breakthrough-studies
 * Identifies high-impact recent studies
 */
router.get("/breakthrough-studies", async (req, res) => {
  try {
    const { period = "monthly" } = req.query;

    if (!["weekly", "monthly", "quarterly"].includes(period as string)) {
      return res.status(400).json({
        error: "Invalid period. Use weekly, monthly, or quarterly.",
      });
    }

    const studies = await trendDetectionService.detectBreakthroughStudies(
      period as "weekly" | "monthly" | "quarterly",
    );

    res.json({
      success: true,
      period,
      count: studies.length,
      studies: studies.map((study) => ({
        id: study.studyId,
        title: study.title,
        impactScore: study.impactScore,
        citations: study.citationCount,
        views: study.viewCount,
        reason: study.reasonForBreakthrough,
        publishedDate: study.publicationDate,
      })),
    });
  } catch (error) {
    console.error("Error fetching breakthrough studies:", error);
    res.status(500).json({
      error: "Failed to fetch breakthrough studies",
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * GET /api/trends/momentum
 * Shows research areas gaining or losing momentum
 */
router.get("/momentum", async (req, res) => {
  try {
    const { period = "monthly" } = req.query;

    if (!["weekly", "monthly", "quarterly"].includes(period as string)) {
      return res.status(400).json({
        error: "Invalid period. Use weekly, monthly, or quarterly.",
      });
    }

    const momentum = await trendDetectionService.trackResearchMomentum(
      period as "weekly" | "monthly" | "quarterly",
    );

    res.json({
      success: true,
      period,
      accelerating: momentum.accelerating.map((area) => ({
        name: area.area,
        change: `+${area.percentageChange.toFixed(1)}%`,
        currentActivity: area.currentActivity,
        previousActivity: area.previousActivity,
        studyIds: area.studyIds,
      })),
      declining: momentum.declining.map((area) => ({
        name: area.area,
        change: `${area.percentageChange.toFixed(1)}%`,
        currentActivity: area.currentActivity,
        previousActivity: area.previousActivity,
        studyIds: area.studyIds,
      })),
      stable: momentum.stable.map((area) => ({
        name: area.area,
        activity: area.activity,
        studyIds: area.studyIds,
      })),
    });
  } catch (error) {
    console.error("Error fetching research momentum:", error);
    res.status(500).json({
      error: "Failed to fetch research momentum",
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * GET /api/trends/keyword-trends
 * Returns keyword trend analysis
 */
router.get("/keyword-trends", async (req, res) => {
  try {
    const { period = "monthly", limit = 20 } = req.query;

    if (!["weekly", "monthly", "quarterly"].includes(period as string)) {
      return res.status(400).json({
        error: "Invalid period. Use weekly, monthly, or quarterly.",
      });
    }

    const trends = await trendDetectionService.analyzeKeywordTrends(
      period as "weekly" | "monthly" | "quarterly",
    );

    const limitNum = Math.min(parseInt(limit as string) || 20, 100);

    res.json({
      success: true,
      period,
      count: trends.length,
      trends: trends.slice(0, limitNum).map((trend) => ({
        keyword: trend.keyword,
        trend: trend.trend,
        change: `${trend.percentageChange > 0 ? "+" : ""}${trend.percentageChange.toFixed(1)}%`,
        currentFrequency: trend.currentFrequency,
        previousFrequency: trend.previousFrequency,
        relatedStudies: trend.relatedStudies,
      })),
    });
  } catch (error) {
    console.error("Error fetching keyword trends:", error);
    res.status(500).json({
      error: "Failed to fetch keyword trends",
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * GET /api/trends/report
 * Generates comprehensive trend report
 */
router.get("/report", async (req, res) => {
  try {
    const { period = "monthly" } = req.query;

    if (
      !["weekly", "monthly", "quarterly", "yearly"].includes(period as string)
    ) {
      return res.status(400).json({
        error: "Invalid period. Use weekly, monthly, quarterly, or yearly.",
      });
    }

    // Check if we have a recent report
    const recentReport = await db
      .select()
      .from(trendAnalysis)
      .where(
        and(
          eq(trendAnalysis.analysisType, "comprehensive"),
          eq(trendAnalysis.periodType, period as string),
          eq(trendAnalysis.status, "completed"),
          gte(trendAnalysis.createdAt, subDays(new Date(), 1)),
        ),
      )
      .orderBy(desc(trendAnalysis.createdAt))
      .limit(1);

    if (recentReport.length > 0) {
      // Return cached report
      const report = recentReport[0];
      res.json({
        success: true,
        cached: true,
        report: {
          id: report.id,
          period: report.periodType,
          periodStart: report.periodStart,
          periodEnd: report.periodEnd,
          emergingTopics: JSON.parse(report.emergingTopics || "[]"),
          breakthroughStudies: JSON.parse(report.breakthroughStudies || "[]"),
          momentum: JSON.parse(report.momentumData || "{}"),
          keywordTrends: JSON.parse(report.keywordTrends || "[]"),
          summary: report.summary,
          insights: report.insights,
          recommendations: report.recommendations,
          metrics: {
            totalStudiesAnalyzed: report.totalStudiesAnalyzed,
            newStudiesCount: report.newStudiesCount,
            avgCitationCount: report.avgCitationCount,
            topResearchAreas: report.topResearchAreas,
          },
          generatedAt: report.createdAt,
        },
      });
    } else {
      // Generate new report
      const report = await trendDetectionService.generateTrendReport(
        period as "weekly" | "monthly" | "quarterly",
      );

      // Save to database
      const [savedReport] = await db
        .insert(trendAnalysis)
        .values(report)
        .returning();

      // Create alerts
      const alerts = await trendDetectionService.createTrendAlerts(
        savedReport.id,
        savedReport,
      );
      if (alerts.length > 0) {
        await db.insert(trendAlerts).values(alerts);
      }

      res.json({
        success: true,
        cached: false,
        report: {
          id: savedReport.id,
          period: savedReport.periodType,
          periodStart: savedReport.periodStart,
          periodEnd: savedReport.periodEnd,
          emergingTopics: JSON.parse(savedReport.emergingTopics || "[]"),
          breakthroughStudies: JSON.parse(
            savedReport.breakthroughStudies || "[]",
          ),
          momentum: JSON.parse(savedReport.momentumData || "{}"),
          keywordTrends: JSON.parse(savedReport.keywordTrends || "[]"),
          summary: savedReport.summary,
          insights: savedReport.insights,
          recommendations: savedReport.recommendations,
          metrics: {
            totalStudiesAnalyzed: savedReport.totalStudiesAnalyzed,
            newStudiesCount: savedReport.newStudiesCount,
            avgCitationCount: savedReport.avgCitationCount,
            topResearchAreas: savedReport.topResearchAreas,
          },
          generatedAt: savedReport.createdAt,
          alertsCreated: alerts.length,
        },
      });
    }
  } catch (error) {
    console.error("Error generating trend report:", error);
    res.status(500).json({
      error: "Failed to generate trend report",
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * POST /api/trends/analyze
 * Triggers trend analysis
 */
router.post("/analyze", async (req, res) => {
  try {
    const { period = "weekly", type = "comprehensive" } = req.body;

    if (!["weekly", "monthly", "quarterly", "yearly"].includes(period)) {
      return res.status(400).json({
        error: "Invalid period. Use weekly, monthly, quarterly, or yearly.",
      });
    }

    if (
      ![
        "emerging_topics",
        "breakthrough",
        "momentum",
        "comprehensive",
      ].includes(type)
    ) {
      return res.status(400).json({
        error: "Invalid analysis type.",
      });
    }

    // Run analysis asynchronously
    const analysisPromise = trendDetectionService.runScheduledAnalysis(
      period as "weekly" | "monthly" | "quarterly",
    );

    // Return immediately with analysis ID
    res.json({
      success: true,
      message: `${type} analysis started for ${period} period`,
      status: "processing",
      checkStatusUrl: `/api/trends/status`,
    });

    // Continue processing in background
    analysisPromise
      .then((result) => {
        console.log(`Analysis completed: ${result.id}`);
      })
      .catch((error) => {
        console.error("Background analysis failed:", error);
      });
  } catch (error) {
    console.error("Error triggering analysis:", error);
    res.status(500).json({
      error: "Failed to trigger analysis",
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * GET /api/trends/status
 * Check analysis status
 */
router.get("/status", async (req, res) => {
  try {
    const latestAnalyses = await db
      .select({
        id: trendAnalysis.id,
        type: trendAnalysis.analysisType,
        period: trendAnalysis.periodType,
        status: trendAnalysis.status,
        createdAt: trendAnalysis.createdAt,
        completedAt: trendAnalysis.completedAt,
        errorMessage: trendAnalysis.errorMessage,
      })
      .from(trendAnalysis)
      .orderBy(desc(trendAnalysis.createdAt))
      .limit(5);

    res.json({
      success: true,
      analyses: latestAnalyses,
    });
  } catch (error) {
    console.error("Error fetching analysis status:", error);
    res.status(500).json({
      error: "Failed to fetch analysis status",
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * GET /api/trends/alerts
 * Get trend alerts
 */
router.get("/alerts", async (req, res) => {
  try {
    const { unacknowledged = "false", limit = "20" } = req.query;

    let query = db
      .select()
      .from(trendAlerts)
      .orderBy(desc(trendAlerts.createdAt))
      .limit(parseInt(limit as string));

    if (unacknowledged === "true") {
      query = query.where(isNull(trendAlerts.acknowledgedAt));
    }

    const alerts = await query;

    res.json({
      success: true,
      count: alerts.length,
      alerts: alerts.map((alert) => ({
        id: alert.id,
        type: alert.alertType,
        level: alert.alertLevel,
        title: alert.title,
        message: alert.message,
        relatedStudies: alert.relatedStudies,
        actionRequired: alert.actionRequired,
        acknowledged: !!alert.acknowledgedAt,
        createdAt: alert.createdAt,
      })),
    });
  } catch (error) {
    console.error("Error fetching alerts:", error);
    res.status(500).json({
      error: "Failed to fetch alerts",
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * PUT /api/trends/alerts/:id/acknowledge
 * Acknowledge an alert
 */
router.put("/alerts/:id/acknowledge", async (req, res) => {
  try {
    const alertId = parseInt(req.params.id);
    const { userId } = req.body;

    const [updated] = await db
      .update(trendAlerts)
      .set({
        acknowledgedBy: userId,
        acknowledgedAt: new Date(),
      })
      .where(eq(trendAlerts.id, alertId))
      .returning();

    if (!updated) {
      return res.status(404).json({
        error: "Alert not found",
      });
    }

    res.json({
      success: true,
      alert: updated,
    });
  } catch (error) {
    console.error("Error acknowledging alert:", error);
    res.status(500).json({
      error: "Failed to acknowledge alert",
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * GET /api/trends/search-queries
 * Get popular search queries
 */
router.get("/search-queries", async (req, res) => {
  try {
    const { limit = "10" } = req.query;

    const queries = await trendDetectionService.getPopularSearchQueries(
      parseInt(limit as string),
    );

    res.json({
      success: true,
      count: queries.length,
      queries,
    });
  } catch (error) {
    console.error("Error fetching search queries:", error);
    res.status(500).json({
      error: "Failed to fetch search queries",
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * POST /api/trends/track-search
 * Track a search query
 */
router.post("/track-search", async (req, res) => {
  try {
    const { query, userId, results, clickedIds } = req.body;

    if (!query) {
      return res.status(400).json({
        error: "Query is required",
      });
    }

    await trendDetectionService.trackSearchQuery(
      query,
      userId,
      results,
      clickedIds,
    );

    res.json({
      success: true,
      message: "Search query tracked",
    });
  } catch (error) {
    console.error("Error tracking search query:", error);
    res.status(500).json({
      error: "Failed to track search query",
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * POST /api/trends/track-metrics
 * Track study engagement metrics
 */
router.post("/track-metrics", async (req, res) => {
  try {
    const { studyId, metrics } = req.body;

    if (!studyId) {
      return res.status(400).json({
        error: "Study ID is required",
      });
    }

    await trendDetectionService.trackStudyMetrics(studyId, metrics);

    res.json({
      success: true,
      message: "Metrics tracked",
    });
  } catch (error) {
    console.error("Error tracking metrics:", error);
    res.status(500).json({
      error: "Failed to track metrics",
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * GET /api/trends/study-metrics/:id
 * Get metrics for a specific study
 */
router.get("/study-metrics/:id", async (req, res) => {
  try {
    const studyId = parseInt(req.params.id);
    const { days = "30" } = req.query;

    const startDate = subDays(new Date(), parseInt(days as string));

    const metrics = await db
      .select()
      .from(studyMetrics)
      .where(
        and(
          eq(studyMetrics.studyId, studyId),
          gte(studyMetrics.date, startDate),
        ),
      )
      .orderBy(desc(studyMetrics.date));

    // Aggregate metrics
    const totalViews = metrics.reduce((sum, m) => sum + (m.viewCount || 0), 0);
    const totalDownloads = metrics.reduce(
      (sum, m) => sum + (m.downloadCount || 0),
      0,
    );
    const avgTimeOnPage = metrics.reduce(
      (sum, m, i, arr) => sum + (m.avgTimeOnPage || 0) / arr.length,
      0,
    );

    res.json({
      success: true,
      studyId,
      period: `${days} days`,
      metrics: {
        totalViews,
        totalDownloads,
        avgTimeOnPage: Math.round(avgTimeOnPage),
        dailyMetrics: metrics,
      },
    });
  } catch (error) {
    console.error("Error fetching study metrics:", error);
    res.status(500).json({
      error: "Failed to fetch study metrics",
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * GET /api/trends/dashboard
 * Get dashboard summary data
 */
router.get("/dashboard", async (req, res) => {
  try {
    // Get latest analysis
    const [latestAnalysis] = await db
      .select()
      .from(trendAnalysis)
      .where(eq(trendAnalysis.status, "completed"))
      .orderBy(desc(trendAnalysis.createdAt))
      .limit(1);

    // Get unacknowledged alerts count
    const [alertCount] = await db
      .select({ count: count() })
      .from(trendAlerts)
      .where(isNull(trendAlerts.acknowledgedAt));

    // Get popular searches
    const popularSearches =
      await trendDetectionService.getPopularSearchQueries(5);

    // Parse latest analysis data
    let dashboardData = {
      hasAnalysis: false,
      topEmergingTopic: null,
      topBreakthroughStudy: null,
      topAcceleratingArea: null,
      summary: null,
      insights: [],
      recommendations: [],
      unacknowledgedAlerts: alertCount?.count || 0,
      popularSearches,
    };

    if (latestAnalysis) {
      const emergingTopics = JSON.parse(latestAnalysis.emergingTopics || "[]");
      const breakthroughStudies = JSON.parse(
        latestAnalysis.breakthroughStudies || "[]",
      );
      const momentum = JSON.parse(latestAnalysis.momentumData || "{}");

      dashboardData = {
        hasAnalysis: true,
        topEmergingTopic: emergingTopics[0] || null,
        topBreakthroughStudy: breakthroughStudies[0] || null,
        topAcceleratingArea: momentum.accelerating?.[0] || null,
        summary: latestAnalysis.summary,
        insights: latestAnalysis.insights || [],
        recommendations: latestAnalysis.recommendations || [],
        unacknowledgedAlerts: alertCount?.count || 0,
        popularSearches,
      };
    }

    res.json({
      success: true,
      dashboard: dashboardData,
    });
  } catch (error) {
    console.error("Error fetching dashboard data:", error);
    res.status(500).json({
      error: "Failed to fetch dashboard data",
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

export default router;
