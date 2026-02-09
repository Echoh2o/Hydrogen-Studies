/**
 * API Routes for Study Recommendation Engine
 */

import { Router } from "express";
import {
  getPersonalizedRecommendations,
  recordStudyInteraction,
  updateUserPreferencesFromBehavior,
} from "../services/recommendation-engine";
import { z } from "zod";

const router = Router();

// Validation schemas
const recommendationParamsSchema = z.object({
  userId: z.number().optional(),
  targetStudyId: z.number().optional(),
  maxResults: z.number().min(1).max(50).default(10),
  includeViewed: z.boolean().default(false),
  recommendationType: z
    .enum(["personalized", "similar", "trending", "recent", "comprehensive"])
    .default("personalized"),
  healthFocus: z.string().optional(),
  userProfile: z
    .object({
      preferredHealthBenefits: z.array(z.string()).optional(),
      preferredHealthConditions: z.array(z.string()).optional(),
      preferredBodySystems: z.array(z.string()).optional(),
      preferredLifeStages: z.array(z.string()).optional(),
      preferredStudyTypes: z.array(z.string()).optional(),
      preferredReadingLevel: z.string().optional(),
      excludedTopics: z.array(z.string()).optional(),
      viewedStudies: z.array(z.number()).optional(),
    })
    .optional(),
});

const interactionSchema = z.object({
  userId: z.number(),
  studyId: z.number(),
  interactionType: z.enum(["view", "like", "share", "download"]),
});

/**
 * GET /api/recommendations
 * Get personalized study recommendations
 */
router.get("/", async (req, res) => {
  try {
    const params = recommendationParamsSchema.parse({
      userId: req.query.userId
        ? parseInt(req.query.userId as string)
        : undefined,
      targetStudyId: req.query.targetStudyId
        ? parseInt(req.query.targetStudyId as string)
        : undefined,
      maxResults: req.query.maxResults
        ? parseInt(req.query.maxResults as string)
        : 10,
      includeViewed: req.query.includeViewed === "true",
      recommendationType:
        (req.query.recommendationType as any) || "personalized",
      healthFocus: (req.query.healthFocus as string) || undefined,
      userProfile: req.query.userProfile
        ? JSON.parse(req.query.userProfile as string)
        : undefined,
    });

    const recommendations = await getPersonalizedRecommendations(params);

    res.json({
      success: true,
      data: recommendations,
      message: `Found ${recommendations.totalFound} recommendations`,
    });
  } catch (error) {
    console.error("Error fetching recommendations:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch recommendations",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/**
 * POST /api/recommendations/similar/:studyId
 * Get studies similar to a specific study
 */
router.get("/similar/:studyId", async (req, res) => {
  try {
    const studyId = parseInt(req.params.studyId);
    const maxResults = req.query.maxResults
      ? parseInt(req.query.maxResults as string)
      : 8;
    const userId = req.query.userId
      ? parseInt(req.query.userId as string)
      : undefined;

    if (isNaN(studyId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid study ID",
      });
    }

    const recommendations = await getPersonalizedRecommendations({
      targetStudyId: studyId,
      userId,
      maxResults,
      recommendationType: "similar",
    });

    res.json({
      success: true,
      data: recommendations,
      message: `Found ${recommendations.totalFound} similar studies`,
    });
  } catch (error) {
    console.error("Error fetching similar studies:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch similar studies",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/**
 * GET /api/recommendations/trending
 * Get trending studies
 */
router.get("/trending", async (req, res) => {
  try {
    const maxResults = req.query.maxResults
      ? parseInt(req.query.maxResults as string)
      : 10;
    const userId = req.query.userId
      ? parseInt(req.query.userId as string)
      : undefined;

    const recommendations = await getPersonalizedRecommendations({
      userId,
      maxResults,
      recommendationType: "trending",
    });

    res.json({
      success: true,
      data: recommendations,
      message: `Found ${recommendations.totalFound} trending studies`,
    });
  } catch (error) {
    console.error("Error fetching trending studies:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch trending studies",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/**
 * GET /api/recommendations/recent
 * Get recent studies with personalization
 */
router.get("/recent", async (req, res) => {
  try {
    const maxResults = req.query.maxResults
      ? parseInt(req.query.maxResults as string)
      : 10;
    const userId = req.query.userId
      ? parseInt(req.query.userId as string)
      : undefined;

    const recommendations = await getPersonalizedRecommendations({
      userId,
      maxResults,
      recommendationType: "recent",
    });

    res.json({
      success: true,
      data: recommendations,
      message: `Found ${recommendations.totalFound} recent studies`,
    });
  } catch (error) {
    console.error("Error fetching recent studies:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch recent studies",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/**
 * GET /api/recommendations/for-condition/:condition
 * Get recommendations for a specific health condition
 */
router.get("/for-condition/:condition", async (req, res) => {
  try {
    const condition = decodeURIComponent(req.params.condition);
    const maxResults = req.query.maxResults
      ? parseInt(req.query.maxResults as string)
      : 10;
    const userId = req.query.userId
      ? parseInt(req.query.userId as string)
      : undefined;

    const userProfile = {
      preferredHealthConditions: [condition],
    };

    const recommendations = await getPersonalizedRecommendations({
      userId,
      userProfile,
      maxResults,
      recommendationType: "personalized",
      healthFocus: condition,
    });

    res.json({
      success: true,
      data: recommendations,
      message: `Found ${recommendations.totalFound} studies for ${condition}`,
    });
  } catch (error) {
    console.error("Error fetching condition-specific recommendations:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch condition-specific recommendations",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/**
 * GET /api/recommendations/for-benefit/:benefit
 * Get recommendations for a specific health benefit
 */
router.get("/for-benefit/:benefit", async (req, res) => {
  try {
    const benefit = decodeURIComponent(req.params.benefit);
    const maxResults = req.query.maxResults
      ? parseInt(req.query.maxResults as string)
      : 10;
    const userId = req.query.userId
      ? parseInt(req.query.userId as string)
      : undefined;

    const userProfile = {
      preferredHealthBenefits: [benefit],
    };

    const recommendations = await getPersonalizedRecommendations({
      userId,
      userProfile,
      maxResults,
      recommendationType: "personalized",
      healthFocus: benefit,
    });

    res.json({
      success: true,
      data: recommendations,
      message: `Found ${recommendations.totalFound} studies for ${benefit}`,
    });
  } catch (error) {
    console.error("Error fetching benefit-specific recommendations:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch benefit-specific recommendations",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/**
 * POST /api/recommendations/interaction
 * Record user interaction with a study for future recommendations
 */
router.post("/interaction", async (req, res) => {
  try {
    const { userId, studyId, interactionType } = interactionSchema.parse(
      req.body,
    );

    await recordStudyInteraction(userId, studyId, interactionType);

    // Update user preferences based on this interaction
    if (interactionType === "view" || interactionType === "like") {
      await updateUserPreferencesFromBehavior(userId);
    }

    res.json({
      success: true,
      message: "Interaction recorded successfully",
    });
  } catch (error) {
    console.error("Error recording interaction:", error);
    res.status(500).json({
      success: false,
      message: "Failed to record interaction",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/**
 * PUT /api/recommendations/preferences/:userId
 * Update user preferences from their reading behavior
 */
router.put("/preferences/:userId", async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);

    if (isNaN(userId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID",
      });
    }

    await updateUserPreferencesFromBehavior(userId);

    res.json({
      success: true,
      message: "User preferences updated based on reading behavior",
    });
  } catch (error) {
    console.error("Error updating user preferences:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update user preferences",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/**
 * GET /api/recommendations/health-discovery
 * Get diverse recommendations across different health areas for discovery
 */
router.get("/health-discovery", async (req, res) => {
  try {
    const userId = req.query.userId
      ? parseInt(req.query.userId as string)
      : undefined;
    const maxResults = req.query.maxResults
      ? parseInt(req.query.maxResults as string)
      : 15;

    // Get comprehensive recommendations that show variety
    const recommendations = await getPersonalizedRecommendations({
      userId,
      maxResults,
      recommendationType: "comprehensive",
    });

    res.json({
      success: true,
      data: recommendations,
      message: `Found ${recommendations.totalFound} diverse health recommendations`,
    });
  } catch (error) {
    console.error("Error fetching health discovery recommendations:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch health discovery recommendations",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

export default router;
