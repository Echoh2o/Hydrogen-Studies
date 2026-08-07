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
  auditLogs,
  studies,
  userEngagement,
  searchQueries,
  chatFeedback,
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
    const userId = req.session?.userId;
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
    const userId = req.session?.userId;
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
    const userId = req.session?.userId;
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
    const userId = req.session?.userId;
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

/**
 * GET /api/me/data-export
 * GDPR: Export all user data as JSON
 */
router.get("/data-export", async (req: Request, res: Response) => {
  try {
    const userId = req.session?.userId;
    if (!userId) return res.status(401).json({ error: "Not authenticated" });

    // Gather all user data
    const [userData] = await db
      .select({
        id: users.id,
        username: users.username,
        email: users.email,
        role: users.role,
        createdAt: users.createdAt,
        lastLogin: users.lastLogin,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    const preferences = await db
      .select()
      .from(userPreferences)
      .where(eq(userPreferences.userId, userId));

    const interactions = await db
      .select()
      .from(userStudyInteractions)
      .where(eq(userStudyInteractions.userId, userId));

    const history = await db
      .select()
      .from(userReadingHistory)
      .where(eq(userReadingHistory.userId, userId));

    const searches = await db
      .select()
      .from(searchHistory)
      .where(eq(searchHistory.userId, userId));

    const logs = await db
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.userId, userId))
      .orderBy(desc(auditLogs.createdAt));

    const engagement = await db
      .select()
      .from(userEngagement)
      .where(eq(userEngagement.userId, userId));

    const queries = await db
      .select()
      .from(searchQueries)
      .where(eq(searchQueries.userId, userId));

    const feedback = await db
      .select()
      .from(chatFeedback)
      .where(eq(chatFeedback.userId, userId));

    const exportData = {
      exportedAt: new Date().toISOString(),
      user: userData,
      preferences,
      studyInteractions: interactions,
      readingHistory: history,
      searchHistory: searches,
      auditLogs: logs,
      userEngagement: engagement,
      searchQueries: queries,
      chatFeedback: feedback,
    };

    res.setHeader("Content-Disposition", "attachment; filename=my-data-export.json");
    res.setHeader("Content-Type", "application/json");
    res.json(exportData);
  } catch (error) {
    console.error("[Dashboard] Data export error:", error);
    res.status(500).json({ error: "Failed to export data" });
  }
});

/**
 * DELETE /api/me/account
 * GDPR: Delete user account and all associated data
 */
router.delete("/account", async (req: Request, res: Response) => {
  try {
    const userId = req.session?.userId;
    if (!userId) return res.status(401).json({ error: "Not authenticated" });

    // Delete user data in order (respecting foreign key constraints)
    await db.delete(userReadingHistory).where(eq(userReadingHistory.userId, userId));
    await db.delete(userStudyInteractions).where(eq(userStudyInteractions.userId, userId));
    await db.delete(searchHistory).where(eq(searchHistory.userId, userId));
    await db.delete(userPreferences).where(eq(userPreferences.userId, userId));
    await db.delete(auditLogs).where(eq(auditLogs.userId, userId));

    // Delete user account
    await db.delete(users).where(eq(users.id, userId));

    // Destroy session
    req.session.destroy((err) => {
      if (err) console.error("Session destroy error during account deletion:", err);
    });

    res.clearCookie("hydrogen.sid", { path: "/" });
    res.json({ message: "Account and all associated data deleted successfully" });
  } catch (error) {
    console.error("[Dashboard] Account deletion error:", error);
    res.status(500).json({ error: "Failed to delete account" });
  }
});

export default router;
