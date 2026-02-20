/**
 * User Dashboard Routes — Personal dashboard for registered customers
 *
 * Provides data for:
 * - Saved studies
 * - Reading history
 * - Health interests / preferences
 * - Account settings
 */

import { Router, Request, Response } from "express";
import { isAuthenticated } from "../auth";
import { db } from "../db";
import {
  users,
  userPreferences,
  userStudyInteractions,
  userReadingHistory,
  searchHistory,
  studies,
} from "../../shared/schema";
import { eq, desc, sql, and } from "drizzle-orm";

const router = Router();

// All routes require authentication
router.use(isAuthenticated);

/**
 * GET /api/me/dashboard
 * Get the full user dashboard data in one call
 */
router.get("/dashboard", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).session?.passport?.user || (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: "Not authenticated" });

    // Fetch all dashboard data in parallel
    const [
      savedStudiesResult,
      recentViewsResult,
      preferencesResult,
      searchHistoryResult,
      statsResult,
    ] = await Promise.all([
      // Saved studies (bookmarks)
      db.select({
        studyId: userStudyInteractions.studyId,
        savedAt: userStudyInteractions.createdAt,
        studyTitle: studies.title,
        studySlug: studies.slug,
        studyCategory: studies.category,
        plainLanguageTitle: studies.plainLanguageTitle,
        imageUrl: studies.imageUrl,
      })
        .from(userStudyInteractions)
        .innerJoin(studies, eq(studies.id, userStudyInteractions.studyId))
        .where(and(
          eq(userStudyInteractions.userId, userId),
          eq(userStudyInteractions.isSaved, true),
        ))
        .orderBy(desc(userStudyInteractions.createdAt))
        .limit(20),

      // Recent views
      db.select({
        studyId: userReadingHistory.studyId,
        viewedAt: userReadingHistory.viewedAt,
        studyTitle: studies.title,
        studySlug: studies.slug,
        studyCategory: studies.category,
        plainLanguageTitle: studies.plainLanguageTitle,
      })
        .from(userReadingHistory)
        .innerJoin(studies, eq(studies.id, userReadingHistory.studyId))
        .where(eq(userReadingHistory.userId, userId))
        .orderBy(desc(userReadingHistory.viewedAt))
        .limit(20),

      // Preferences
      db.select().from(userPreferences).where(eq(userPreferences.userId, userId)).limit(1),

      // Recent searches
      db.select().from(searchHistory)
        .where(eq(searchHistory.userId, userId))
        .orderBy(desc(searchHistory.searchDate))
        .limit(10),

      // Stats
      Promise.all([
        db.select({ count: sql<number>`count(*)` })
          .from(userStudyInteractions)
          .where(and(eq(userStudyInteractions.userId, userId), eq(userStudyInteractions.isSaved, true))),
        db.select({ count: sql<number>`count(*)` })
          .from(userReadingHistory)
          .where(eq(userReadingHistory.userId, userId)),
        db.select({ count: sql<number>`count(*)` })
          .from(searchHistory)
          .where(eq(searchHistory.userId, userId)),
      ]),
    ]);

    const preferences = preferencesResult[0] || null;

    res.json({
      savedStudies: savedStudiesResult,
      recentViews: recentViewsResult,
      preferences: preferences ? {
        healthConditions: preferences.preferredHealthConditions || [],
        bodySystems: preferences.preferredBodySystems || [],
        lifeStages: preferences.preferredLifeStages || [],
        readingLevel: preferences.preferredReadingLevel || "general",
        emailNotifications: preferences.emailNotifications,
        notificationFrequency: preferences.notificationFrequency,
      } : null,
      recentSearches: searchHistoryResult.map(s => s.searchQuery),
      stats: {
        savedCount: Number(statsResult[0][0]?.count || 0),
        viewedCount: Number(statsResult[1][0]?.count || 0),
        searchCount: Number(statsResult[2][0]?.count || 0),
      },
    });
  } catch (error) {
    console.error("[Dashboard] Error:", error);
    res.status(500).json({ error: "Failed to load dashboard" });
  }
});

/**
 * POST /api/me/preferences
 * Update user preferences (health interests, notification settings)
 */
router.post("/preferences", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).session?.passport?.user || (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: "Not authenticated" });

    const {
      healthConditions,
      bodySystems,
      lifeStages,
      readingLevel,
      emailNotifications,
      notificationFrequency,
    } = req.body;

    // Check if preferences exist
    const [existing] = await db.select({ id: userPreferences.id })
      .from(userPreferences)
      .where(eq(userPreferences.userId, userId))
      .limit(1);

    const data: any = {
      preferredHealthConditions: healthConditions,
      preferredBodySystems: bodySystems,
      preferredLifeStages: lifeStages,
      preferredReadingLevel: readingLevel,
      emailNotifications,
      notificationFrequency,
      updatedAt: new Date(),
    };

    if (existing) {
      await db.update(userPreferences).set(data).where(eq(userPreferences.userId, userId));
    } else {
      await db.insert(userPreferences).values({ userId, ...data });
    }

    res.json({ success: true });
  } catch (error) {
    console.error("[Dashboard] Preferences error:", error);
    res.status(500).json({ error: "Failed to update preferences" });
  }
});

/**
 * POST /api/me/save-study/:id
 * Save/unsave a study (bookmark toggle)
 */
router.post("/save-study/:id", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).session?.passport?.user || (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: "Not authenticated" });

    const studyId = parseInt(req.params.id);
    if (isNaN(studyId)) return res.status(400).json({ error: "Invalid study ID" });

    // Check if interaction exists
    const [existing] = await db.select()
      .from(userStudyInteractions)
      .where(and(
        eq(userStudyInteractions.userId, userId),
        eq(userStudyInteractions.studyId, studyId),
      ))
      .limit(1);

    if (existing) {
      // Toggle saved status
      await db.update(userStudyInteractions)
        .set({ isSaved: !existing.isSaved })
        .where(and(
          eq(userStudyInteractions.userId, userId),
          eq(userStudyInteractions.studyId, studyId),
        ));
      res.json({ saved: !existing.isSaved });
    } else {
      // Create new interaction
      await db.insert(userStudyInteractions).values({
        userId,
        studyId,
        isSaved: true,
        viewCount: 0,
      });
      res.json({ saved: true });
    }
  } catch (error) {
    console.error("[Dashboard] Save study error:", error);
    res.status(500).json({ error: "Failed to save study" });
  }
});

/**
 * GET /api/me/saved-studies
 * Check if specific studies are saved (for rendering save buttons on study pages)
 */
router.get("/saved-studies", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).session?.passport?.user || (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: "Not authenticated" });

    const saved = await db.select({ studyId: userStudyInteractions.studyId })
      .from(userStudyInteractions)
      .where(and(
        eq(userStudyInteractions.userId, userId),
        eq(userStudyInteractions.isSaved, true),
      ));

    res.json({ savedStudyIds: saved.map(s => s.studyId) });
  } catch (error) {
    res.status(500).json({ error: "Failed to get saved studies" });
  }
});

export default router;
