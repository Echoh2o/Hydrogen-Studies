/**
 * Recommendation system for personalized study and blog recommendations
 */
import { storage } from "../storage";
import { Study, BlogArticle, UserPreferences } from "@shared/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { db } from "../db";
import {
  studies,
  userStudyInteractions,
  userPreferences,
  blogArticles,
  userBlogInteractions,
} from "@shared/schema";

/**
 * Get recommended studies for a user based on their preferences and interaction history
 *
 * @param userId User ID
 * @param limit Number of recommendations to return (default: 10)
 * @returns Array of recommended studies
 */
export async function getRecommendedStudies(
  userId: number,
  limit: number = 10,
): Promise<Study[]> {
  try {
    // Get user preferences
    const preferences = await storage.getUserPreferences(userId);
    if (!preferences) {
      // If no preferences, return latest studies
      return await storage.getLatestStudies(limit);
    }

    // Get user's viewed studies to exclude them from recommendations
    const viewedStudies = await storage.getRecentlyViewedStudies(userId);
    const viewedStudyIds = viewedStudies.map((study) => study.id);

    // Use a scoring system to rank potential studies
    let recommendedStudies: Study[] = [];

    // 1. Get studies matching user's preferred categories
    if (preferences.categories && preferences.categories.length > 0) {
      const categoryStudies = await db
        .select()
        .from(studies)
        .where(
          sql`${studies.category} IN (${preferences.categories.join(",")})`,
        )
        .limit(limit * 2);

      recommendedStudies = [...recommendedStudies, ...categoryStudies];
    }

    // 2. Get studies matching user's preferred keywords
    if (preferences.keywords && preferences.keywords.length > 0) {
      const keywordConditions = preferences.keywords.map(
        (keyword) =>
          sql`${studies.title} LIKE ${`%${keyword}%`} OR ${studies.abstract} LIKE ${`%${keyword}%`}`,
      );

      const keywordStudies = await db
        .select()
        .from(studies)
        .where(sql.join(keywordConditions, sql` OR `))
        .limit(limit * 2);

      recommendedStudies = [...recommendedStudies, ...keywordStudies];
    }

    // 3. Get studies by preferred authors
    if (preferences.authors && preferences.authors.length > 0) {
      const authorConditions = preferences.authors.map(
        (author) => sql`${studies.authors} LIKE ${`%${author}%`}`,
      );

      const authorStudies = await db
        .select()
        .from(studies)
        .where(sql.join(authorConditions, sql` OR `))
        .limit(limit * 2);

      recommendedStudies = [...recommendedStudies, ...authorStudies];
    }

    // Deduplicate studies
    const uniqueStudies = Array.from(
      new Map(recommendedStudies.map((study) => [study.id, study])).values(),
    );

    // Filter out already viewed studies
    const filteredStudies = uniqueStudies.filter(
      (study) => !viewedStudyIds.includes(study.id),
    );

    // If we don't have enough recommendations, add some recent studies
    if (filteredStudies.length < limit) {
      const recentStudies = await storage.getLatestStudies(
        limit - filteredStudies.length,
      );
      const recentStudiesToAdd = recentStudies.filter(
        (study) =>
          !viewedStudyIds.includes(study.id) &&
          !filteredStudies.some((s) => s.id === study.id),
      );

      filteredStudies.push(...recentStudiesToAdd);
    }

    // Return the top recommendations
    return filteredStudies.slice(0, limit);
  } catch (error) {
    console.error("Error getting recommended studies:", error);
    // Fallback to latest studies if recommendation system fails
    return await storage.getLatestStudies(limit);
  }
}

/**
 * Get recommended blog articles for a user based on their preferences and interaction history
 *
 * @param userId User ID
 * @param limit Number of recommendations to return (default: 10)
 * @returns Array of recommended blog articles
 */
export async function getRecommendedBlogs(
  userId: number,
  limit: number = 10,
): Promise<BlogArticle[]> {
  try {
    // Get user preferences
    const preferences = await storage.getUserPreferences(userId);
    if (!preferences) {
      // If no preferences, return most popular blogs
      return await getMostPopularBlogs(limit);
    }

    // Get user's recently viewed blogs
    const viewedBlogs = await storage.getRecentlyViewedBlogs(userId);
    const viewedBlogIds = viewedBlogs.map((blog) => blog.id);

    // Get user's viewed studies to find related blogs
    const viewedStudies = await storage.getRecentlyViewedStudies(userId, 10);
    const viewedStudyIds = viewedStudies.map((study) => study.id);

    let recommendedBlogs: BlogArticle[] = [];

    // 1. Find blogs related to viewed studies
    if (viewedStudyIds.length > 0) {
      const relatedBlogs = await db
        .select()
        .from(blogArticles)
        .where(sql`${blogArticles.studyId} IN (${viewedStudyIds.join(",")})`)
        .limit(limit * 2);

      recommendedBlogs = [...recommendedBlogs, ...relatedBlogs];
    }

    // 2. Find blogs that match user's preferred categories through their linked studies
    if (preferences.categories && preferences.categories.length > 0) {
      const categoryBlogs = await db
        .select({
          blogArticle: blogArticles,
        })
        .from(blogArticles)
        .innerJoin(studies, eq(blogArticles.studyId, studies.id))
        .where(
          sql`${studies.category} IN (${preferences.categories.join(",")})`,
        )
        .limit(limit * 2);

      recommendedBlogs = [
        ...recommendedBlogs,
        ...categoryBlogs.map((row) => row.blogArticle),
      ];
    }

    // 3. Find blogs that match user's keywords
    if (preferences.keywords && preferences.keywords.length > 0) {
      const keywordConditions = preferences.keywords.map(
        (keyword) =>
          sql`${blogArticles.title} LIKE ${`%${keyword}%`} OR ${blogArticles.content} LIKE ${`%${keyword}%`}`,
      );

      const keywordBlogs = await db
        .select()
        .from(blogArticles)
        .where(sql.join(keywordConditions, sql` OR `))
        .limit(limit * 2);

      recommendedBlogs = [...recommendedBlogs, ...keywordBlogs];
    }

    // Deduplicate blogs
    const uniqueBlogs = Array.from(
      new Map(recommendedBlogs.map((blog) => [blog.id, blog])).values(),
    );

    // Filter out already viewed blogs
    const filteredBlogs = uniqueBlogs.filter(
      (blog) => !viewedBlogIds.includes(blog.id),
    );

    // If we don't have enough recommendations, add some popular blogs
    if (filteredBlogs.length < limit) {
      const popularBlogs = await getMostPopularBlogs(
        limit - filteredBlogs.length,
      );
      const popularBlogsToAdd = popularBlogs.filter(
        (blog) =>
          !viewedBlogIds.includes(blog.id) &&
          !filteredBlogs.some((b) => b.id === blog.id),
      );

      filteredBlogs.push(...popularBlogsToAdd);
    }

    // Return the top recommendations
    return filteredBlogs.slice(0, limit);
  } catch (error) {
    console.error("Error getting recommended blogs:", error);
    // Fallback to popular blogs if recommendation system fails
    return await getMostPopularBlogs(limit);
  }
}

/**
 * Get the most popular blog articles based on view count
 *
 * @param limit Number of blogs to return
 * @returns Array of popular blog articles
 */
async function getMostPopularBlogs(limit: number = 10): Promise<BlogArticle[]> {
  return await db
    .select()
    .from(blogArticles)
    .orderBy(desc(blogArticles.viewCount))
    .limit(limit);
}

/**
 * Update recommendations when user preferences change
 *
 * @param userId User ID
 */
export async function refreshUserRecommendations(
  userId: number,
): Promise<void> {
  try {
    // This function can be used to precompute recommendations or
    // trigger notification generation when preferences change

    // Get the user's preferences
    const preferences = await storage.getUserPreferences(userId);
    if (!preferences) return;

    // Get recommended studies based on new preferences
    const recommendedStudies = await getRecommendedStudies(userId, 5);

    // Create notifications for the top recommendations if notifications are enabled
    if (preferences.emailNotifications) {
      for (const study of recommendedStudies.slice(0, 3)) {
        // Create a notification
        await storage.createNotification({
          userId,
          title: "New Study Recommendation",
          message: `We found a study you might be interested in: "${study.title}"`,
          type: "study",
          referenceId: study.id,
          isRead: false,
        });
      }
    }
  } catch (error) {
    console.error("Error refreshing user recommendations:", error);
  }
}
