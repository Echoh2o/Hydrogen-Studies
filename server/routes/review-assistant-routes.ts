import { Router } from "express";
import { db } from "../db";
import {
  studies,
  studyQualityScores,
  reviewRecommendations,
  studyReviewQueue,
} from "../../shared/schema";
import { eq, desc, gt, and, or, inArray, sql, isNull } from "drizzle-orm";
import { studyScoringService } from "../services/study-scoring-service";
import { reviewRecommendationsService } from "../services/review-recommendations-service";
import { requireAdmin } from "../auth";

const router = Router();

// Every endpoint on this router (scoring, queue listing, recommendations,
// red-flag details, auto-categorize, similar-studies, refresh) triggers
// paid AI work on admin-chosen ids OR exposes unpublished editorial data.
// Router-level requireAdmin is the right default.
router.use(requireAdmin);

/**
 * Score a review-queue item (pre-publish). Used by admins to retry a failed
 * scoring, or re-score an item after the rubric has been updated.
 * POST /api/review-assistant/score-queue/:queueId
 */
router.post("/score-queue/:queueId", async (req, res) => {
  try {
    const queueId = parseInt(req.params.queueId);
    if (isNaN(queueId)) {
      return res.status(400).json({ error: "Invalid queue ID" });
    }
    const result = await studyScoringService.scoreQueueItem(queueId);
    if (!result) {
      return res.status(404).json({ error: "Queue item not found" });
    }
    res.json({ success: true, scores: result });
  } catch (error) {
    console.error("Error scoring queue item:", error);
    res.status(500).json({ error: "Failed to score queue item" });
  }
});

/**
 * Generate quality scores for a single study
 * POST /api/review-assistant/score/:studyId
 */
router.post("/score/:studyId", async (req, res) => {
  try {
    const studyId = parseInt(req.params.studyId);

    if (isNaN(studyId)) {
      return res.status(400).json({ error: "Invalid study ID" });
    }

    // Generate scores
    const scores = await studyScoringService.scoreStudy(studyId);

    // Also generate recommendations
    const recommendations =
      await reviewRecommendationsService.generateRecommendations(studyId);

    res.json({
      success: true,
      scores,
      recommendations,
    });
  } catch (error) {
    console.error("Error scoring study:", error);
    res.status(500).json({ error: "Failed to score study" });
  }
});

/**
 * Batch score multiple studies
 * POST /api/review-assistant/batch-score
 * Body: { studyIds: number[] }
 */
router.post("/batch-score", async (req, res) => {
  try {
    const { studyIds } = req.body;

    if (!Array.isArray(studyIds) || studyIds.length === 0) {
      return res.status(400).json({ error: "Invalid study IDs" });
    }

    // Validate all IDs are numbers
    const validIds = studyIds
      .filter((id) => !isNaN(parseInt(id)))
      .map((id) => parseInt(id));

    if (validIds.length === 0) {
      return res.status(400).json({ error: "No valid study IDs provided" });
    }

    // Score studies in batch
    const scoreResults = await studyScoringService.batchScoreStudies(validIds);

    // Generate recommendations for each
    const recommendationPromises = validIds.map((id) =>
      reviewRecommendationsService
        .generateRecommendations(id)
        .catch((error) => {
          console.error(
            `Failed to generate recommendations for study ${id}:`,
            error,
          );
          return null;
        }),
    );

    const recommendationResults = await Promise.all(recommendationPromises);

    // Combine results
    const results = validIds.map((id, index) => ({
      studyId: id,
      scores: scoreResults.get(id),
      recommendations: recommendationResults[index],
    }));

    res.json({
      success: true,
      results,
      processed: results.filter((r) => r.scores && r.recommendations).length,
      total: validIds.length,
    });
  } catch (error) {
    console.error("Error batch scoring studies:", error);
    res.status(500).json({ error: "Failed to batch score studies" });
  }
});

/**
 * Get prioritized review queue
 * GET /api/review-assistant/queue
 * Query params:
 *   - status: 'all' | 'pending' | 'scored' (default: 'pending')
 *   - priority: 'all' | 'high' | 'medium' | 'low' (default: 'all')
 *   - limit: number (default: 20)
 *   - offset: number (default: 0)
 */
router.get("/queue", async (req, res) => {
  try {
    const {
      status = "pending",
      priority = "all",
      limit = "20",
      offset = "0",
    } = req.query;

    const limitNum = parseInt(limit as string);
    const offsetNum = parseInt(offset as string);

    // Build query based on filters
    let query = db
      .select({
        study: studies,
        scores: studyQualityScores,
        recommendations: reviewRecommendations,
      })
      .from(studies)
      .leftJoin(studyQualityScores, eq(studies.id, studyQualityScores.studyId))
      .leftJoin(
        reviewRecommendations,
        eq(studies.id, reviewRecommendations.studyId),
      )
      .$dynamic();

    // Apply status filter
    if (status === "pending") {
      query = query.where(isNull(studyQualityScores.id));
    } else if (status === "scored") {
      query = query.where(sql`${studyQualityScores.id} IS NOT NULL`);
    }

    // Apply priority filter
    if (priority !== "all" && ["high", "medium", "low"].includes(priority as string)) {
      query = query.where(eq(reviewRecommendations.priority, priority as string));
    }

    // Order by priority and overall score
    const results = await query
      .orderBy(
        sql`CASE 
          WHEN ${reviewRecommendations.priority} = 'high' THEN 1
          WHEN ${reviewRecommendations.priority} = 'medium' THEN 2
          WHEN ${reviewRecommendations.priority} = 'low' THEN 3
          ELSE 4
        END`,
        desc(studyQualityScores.overallScore),
      )
      .limit(limitNum)
      .offset(offsetNum);

    // Format response
    const queue = results.map((row) => ({
      id: row.study.id,
      title: row.study.title,
      authors: row.study.authors,
      journal: row.study.journal,
      publishDate: row.study.publishDate,
      category: row.study.category,
      scores: row.scores
        ? {
            overall: row.scores.overallScore,
            methodology: row.scores.methodologyScore,
            impact: row.scores.impactScore,
            relevance: row.scores.relevanceScore,
            redFlags: row.scores.redFlags || [],
            redFlagCount: row.scores.redFlagCount,
            confidence: row.scores.scoreConfidence ?? null,
            rubricVersion: row.scores.rubricVersion ?? null,
            /**
             * Full per-component breakdown (JSON-stringified).
             * Parsed on the client to power the "Why this score?" expandable.
             */
            breakdown: row.scores.scoreBreakdown ?? null,
            componentScores: {
              sampleSize: row.scores.sampleSizeScore ?? null,
              studyDesign: row.scores.studyDesignScore ?? null,
              blinding: row.scores.blindingScore ?? null,
              controlGroup: row.scores.controlGroupScore ?? null,
              statisticalRigor: row.scores.statisticalRigorScore ?? null,
              journalImpact: row.scores.journalImpactScore ?? null,
              citations: row.scores.citationScore ?? null,
              authorReputation: row.scores.authorReputationScore ?? null,
              institution: row.scores.institutionScore ?? null,
              fundingQuality: row.scores.fundingQualityScore ?? null,
              hydrogenFocus: row.scores.hydrogenFocusScore ?? null,
              humanStudy: row.scores.humanStudyScore ?? null,
              clinicalApplicability: row.scores.clinicalApplicabilityScore ?? null,
              recency: row.scores.recencyScore ?? null,
              practicalImplications: row.scores.practicalImplicationsScore ?? null,
            },
          }
        : null,
      recommendations: row.recommendations
        ? {
            priority: row.recommendations.priority,
            suggestedActions: row.recommendations.suggestedActions || [],
            keyFindings: row.recommendations.keyFindings || [],
            suggestedCategories: row.recommendations.suggestedCategories || [],
          }
        : null,
    }));

    // Get total count for pagination
    const [{ count }] = await db.select({ count: sql`COUNT(*)` }).from(studies);

    res.json({
      success: true,
      queue,
      pagination: {
        total: Number(count),
        limit: limitNum,
        offset: offsetNum,
        hasMore: offsetNum + limitNum < Number(count),
      },
    });
  } catch (error) {
    console.error("Error getting review queue:", error);
    res.status(500).json({ error: "Failed to get review queue" });
  }
});

/**
 * Get studies with red flags
 * GET /api/review-assistant/red-flags
 * Query params:
 *   - minRedFlags: number (default: 1)
 *   - limit: number (default: 20)
 */
router.get("/red-flags", async (req, res) => {
  try {
    const { minRedFlags = "1", limit = "20" } = req.query;
    const minRedFlagsNum = parseInt(minRedFlags as string);
    const limitNum = parseInt(limit as string);

    const results = await db
      .select({
        study: studies,
        scores: studyQualityScores,
      })
      .from(studies)
      .innerJoin(studyQualityScores, eq(studies.id, studyQualityScores.studyId))
      .where(gt(studyQualityScores.redFlagCount, minRedFlagsNum - 1))
      .orderBy(desc(studyQualityScores.redFlagCount))
      .limit(limitNum);

    const flaggedStudies = results.map((row) => ({
      id: row.study.id,
      title: row.study.title,
      authors: row.study.authors,
      journal: row.study.journal,
      redFlags: row.scores.redFlags || [],
      redFlagCount: row.scores.redFlagCount,
      overallScore: row.scores.overallScore,
      methodologyScore: row.scores.methodologyScore,
      impactScore: row.scores.impactScore,
      relevanceScore: row.scores.relevanceScore,
    }));

    res.json({
      success: true,
      studies: flaggedStudies,
      total: flaggedStudies.length,
    });
  } catch (error) {
    console.error("Error getting red-flagged studies:", error);
    res.status(500).json({ error: "Failed to get red-flagged studies" });
  }
});

/**
 * Get review recommendations for a study
 * GET /api/review-assistant/recommendations/:studyId
 */
router.get("/recommendations/:studyId", async (req, res) => {
  try {
    const studyId = parseInt(req.params.studyId);

    if (isNaN(studyId)) {
      return res.status(400).json({ error: "Invalid study ID" });
    }

    // Check if recommendations exist
    const [existing] = await db
      .select()
      .from(reviewRecommendations)
      .where(eq(reviewRecommendations.studyId, studyId))
      .limit(1);

    if (existing) {
      // Return existing recommendations
      res.json({
        success: true,
        recommendations: existing,
      });
    } else {
      // Generate new recommendations
      const recommendations =
        await reviewRecommendationsService.generateRecommendations(studyId);
      res.json({
        success: true,
        recommendations,
      });
    }
  } catch (error) {
    console.error("Error getting recommendations:", error);
    res.status(500).json({ error: "Failed to get recommendations" });
  }
});

/**
 * Auto-categorize a study
 * POST /api/review-assistant/auto-categorize
 * Body: { studyId: number } or { studyIds: number[] }
 */
router.post("/auto-categorize", async (req, res) => {
  try {
    const { studyId, studyIds } = req.body;

    let idsToProcess: number[] = [];

    if (studyId) {
      idsToProcess = [parseInt(studyId)];
    } else if (studyIds && Array.isArray(studyIds)) {
      idsToProcess = studyIds
        .map((id) => parseInt(id))
        .filter((id) => !isNaN(id));
    }

    if (idsToProcess.length === 0) {
      return res.status(400).json({ error: "No valid study IDs provided" });
    }

    const results = [];

    for (const id of idsToProcess) {
      try {
        // Get or generate recommendations which include categorization
        let [recommendations] = await db
          .select()
          .from(reviewRecommendations)
          .where(eq(reviewRecommendations.studyId, id))
          .limit(1);

        if (!recommendations) {
          const newRecs =
            await reviewRecommendationsService.generateRecommendations(id);
          recommendations = await db
            .select()
            .from(reviewRecommendations)
            .where(eq(reviewRecommendations.studyId, id))
            .limit(1)
            .then((r) => r[0]);
        }

        if (recommendations) {
          results.push({
            studyId: id,
            categories: recommendations.suggestedCategories || [],
            tags: recommendations.suggestedTags || [],
            healthConditions: recommendations.healthConditions || [],
            bodySystems: recommendations.bodySystems || [],
            deliveryMethods: recommendations.deliveryMethods || [],
            studyType: recommendations.studyTypeClassification,
          });
        }
      } catch (error) {
        console.error(`Error categorizing study ${id}:`, error);
        results.push({
          studyId: id,
          error: "Failed to categorize",
        });
      }
    }

    res.json({
      success: true,
      results,
    });
  } catch (error) {
    console.error("Error auto-categorizing:", error);
    res.status(500).json({ error: "Failed to auto-categorize studies" });
  }
});

/**
 * Find similar/related studies
 * GET /api/review-assistant/similar-studies/:studyId
 * Query params:
 *   - limit: number (default: 10)
 */
router.get("/similar-studies/:studyId", async (req, res) => {
  try {
    const studyId = parseInt(req.params.studyId);
    const { limit = "10" } = req.query;
    const limitNum = parseInt(limit as string);

    if (isNaN(studyId)) {
      return res.status(400).json({ error: "Invalid study ID" });
    }

    // Get recommendations which include related studies
    const [recommendations] = await db
      .select()
      .from(reviewRecommendations)
      .where(eq(reviewRecommendations.studyId, studyId))
      .limit(1);

    if (
      !recommendations ||
      !recommendations.relatedStudyIds ||
      recommendations.relatedStudyIds.length === 0
    ) {
      // Generate recommendations if not exists
      const newRecs =
        await reviewRecommendationsService.generateRecommendations(studyId);

      if (!newRecs.relatedStudyIds || newRecs.relatedStudyIds.length === 0) {
        return res.json({
          success: true,
          similarStudies: [],
        });
      }

      recommendations.relatedStudyIds = newRecs.relatedStudyIds;
    }

    // Fetch the related studies
    const relatedStudyIds = recommendations.relatedStudyIds.slice(0, limitNum);

    const relatedStudies = await db
      .select({
        study: studies,
        scores: studyQualityScores,
      })
      .from(studies)
      .leftJoin(studyQualityScores, eq(studies.id, studyQualityScores.studyId))
      .where(inArray(studies.id, relatedStudyIds));

    const similarStudies = relatedStudies.map((row) => ({
      id: row.study.id,
      title: row.study.title,
      authors: row.study.authors,
      journal: row.study.journal,
      publishDate: row.study.publishDate,
      category: row.study.category,
      overallScore: row.scores?.overallScore || null,
      similarity: "content", // Could be enhanced with actual similarity scoring
    }));

    res.json({
      success: true,
      similarStudies,
    });
  } catch (error) {
    console.error("Error finding similar studies:", error);
    res.status(500).json({ error: "Failed to find similar studies" });
  }
});

/**
 * Get grouped studies for batch review
 * GET /api/review-assistant/grouped-studies
 * Query params:
 *   - groupBy: 'team' | 'condition' | 'type' (default: 'condition')
 *   - limit: number (default: 10)
 */
router.get("/grouped-studies", async (req, res) => {
  try {
    const { groupBy = "condition", limit = "10" } = req.query;
    const limitNum = parseInt(limit as string);

    // Get all recommendations with grouping info
    const recommendationsData = await db
      .select()
      .from(reviewRecommendations)
      .limit(100); // Get a reasonable sample

    // Group studies based on criteria
    const groups = new Map<string, any[]>();

    for (const rec of recommendationsData) {
      let groupKey: string;

      switch (groupBy) {
        case "team":
          groupKey = rec.researchTeamId || "unknown";
          break;
        case "type":
          groupKey = rec.studyTypeClassification || "unknown";
          break;
        case "condition":
        default:
          groupKey = rec.healthConditions?.[0] || "unknown";
          break;
      }

      if (!groups.has(groupKey)) {
        groups.set(groupKey, []);
      }
      groups.get(groupKey)!.push(rec);
    }

    // Convert to array and limit
    const groupedResults = Array.from(groups.entries())
      .slice(0, limitNum)
      .map(([key, studies]) => ({
        groupKey: key,
        groupType: groupBy,
        studyCount: studies.length,
        studyIds: studies.map((s) => s.studyId),
        characteristics: {
          isFollowUp: studies.some((s) => s.isFollowUp),
          isReplication: studies.some((s) => s.isReplication),
          avgConfidence: Math.round(
            studies.reduce((sum, s) => sum + (s.confidenceScore || 0), 0) /
              studies.length,
          ),
        },
      }));

    res.json({
      success: true,
      groups: groupedResults,
      totalGroups: groups.size,
    });
  } catch (error) {
    console.error("Error getting grouped studies:", error);
    res.status(500).json({ error: "Failed to get grouped studies" });
  }
});

/**
 * Update study scores and recommendations (for manual refresh)
 * PUT /api/review-assistant/refresh/:studyId
 */
router.put("/refresh/:studyId", async (req, res) => {
  try {
    const studyId = parseInt(req.params.studyId);

    if (isNaN(studyId)) {
      return res.status(400).json({ error: "Invalid study ID" });
    }

    // Re-generate scores and recommendations
    const scores = await studyScoringService.scoreStudy(studyId);
    const recommendations =
      await reviewRecommendationsService.generateRecommendations(studyId);

    res.json({
      success: true,
      message: "Study scores and recommendations refreshed",
      scores,
      recommendations,
    });
  } catch (error) {
    console.error("Error refreshing study:", error);
    res.status(500).json({ error: "Failed to refresh study" });
  }
});

export default router;
