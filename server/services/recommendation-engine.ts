/**
 * Advanced Study Recommendation Engine
 *
 * Provides personalized study recommendations based on:
 * - User reading history and preferences
 * - Content similarity analysis
 * - Health condition matching
 * - AI-enhanced content quality scoring
 * - Collaborative filtering
 */

import { db } from "../db";
import { studies, userPreferences, categories, userReadingHistory } from "@shared/schema";
import { eq, and, or, desc, asc, sql, inArray, ne, gt, gte } from "drizzle-orm";

interface UserProfile {
  userId?: number;
  preferredHealthBenefits?: string[];
  preferredHealthConditions?: string[];
  preferredBodySystems?: string[];
  preferredLifeStages?: string[];
  preferredStudyTypes?: string[];
  preferredReadingLevel?: string;
  excludedTopics?: string[];
  viewedStudies?: number[];
}

interface RecommendationParams {
  userId?: number;
  userProfile?: UserProfile;
  targetStudyId?: number; // For "similar studies" recommendations
  maxResults?: number;
  includeViewed?: boolean;
  recommendationType?:
    | "personalized"
    | "similar"
    | "trending"
    | "recent"
    | "comprehensive";
  healthFocus?: string; // Specific health condition or benefit
}

interface StudyRecommendation {
  id: number;
  title: string;
  abstract: string;
  authors: string;
  journal: string;
  publishDate: string;
  category: string;
  imageUrl?: string;
  simplifiedExplanation?: string;
  healthBenefits?: string[];
  healthConditions?: string[];
  bodySystems?: string[];
  lifeStages?: string[];
  studyTypes?: string[];
  mechanisms?: string[];
  enhancedWithAI?: boolean;
  readingLevel?: string;
  estimatedReadTime?: number;
  popularityScore?: number;
  relevanceScore: number;
  recommendationReason: string;
  tags?: string[];
}

interface RecommendationResponse {
  recommendations: StudyRecommendation[];
  totalFound: number;
  recommendationType: string;
  userProfile?: UserProfile;
  recommendationReasons: string[];
}

/**
 * Get personalized study recommendations for a user
 */
export async function getPersonalizedRecommendations(
  params: RecommendationParams,
): Promise<RecommendationResponse> {
  const {
    userId,
    userProfile,
    maxResults = 10,
    includeViewed = false,
    recommendationType = "personalized",
  } = params;

  try {
    // Get user profile (either provided or fetch from database)
    const profile =
      userProfile || (userId ? await getUserProfile(userId) : null);

    // Get user's reading history to avoid recommending viewed studies
    const viewedStudies = includeViewed
      ? []
      : await getUserViewedStudies(userId);

    let recommendations: StudyRecommendation[] = [];

    switch (recommendationType) {
      case "personalized":
        recommendations = await getPersonalizedStudies(
          profile,
          viewedStudies,
          maxResults,
        );
        break;
      case "similar":
        recommendations = await getSimilarStudies(
          params.targetStudyId!,
          viewedStudies,
          maxResults,
        );
        break;
      case "trending":
        recommendations = await getTrendingStudies(viewedStudies, maxResults);
        break;
      case "recent":
        recommendations = await getRecentStudies(
          profile,
          viewedStudies,
          maxResults,
        );
        break;
      case "comprehensive":
        recommendations = await getComprehensiveRecommendations(
          profile,
          viewedStudies,
          maxResults,
        );
        break;
      default:
        recommendations = await getPersonalizedStudies(
          profile,
          viewedStudies,
          maxResults,
        );
    }

    return {
      recommendations,
      totalFound: recommendations.length,
      recommendationType,
      userProfile: profile || undefined,
      recommendationReasons: extractRecommendationReasons(recommendations),
    };
  } catch (error) {
    console.error("Error generating recommendations:", error);
    throw new Error("Failed to generate study recommendations");
  }
}

/**
 * Get user profile from database or create default profile
 */
async function getUserProfile(userId: number): Promise<UserProfile | null> {
  if (!userId) return null;

  try {
    // Get user preferences from database
    const prefs = await db
      .select()
      .from(userPreferences)
      .where(eq(userPreferences.userId, userId))
      .limit(1);

    if (prefs.length === 0) {
      return null;
    }

    const pref = prefs[0];
    return {
      userId,
      preferredHealthBenefits: pref.preferredHealthBenefits || [],
      preferredHealthConditions: pref.preferredHealthConditions || [],
      preferredBodySystems: pref.preferredBodySystems || [],
      preferredLifeStages: pref.preferredLifeStages || [],
      preferredStudyTypes: pref.preferredStudyTypes || [],
      preferredReadingLevel: pref.preferredReadingLevel || undefined,
      excludedTopics: pref.excludedTopics || [],
    };
  } catch (error) {
    console.error("Error fetching user profile:", error);
    return null;
  }
}

/**
 * Get list of studies the user has already viewed
 */
async function getUserViewedStudies(userId?: number): Promise<number[]> {
  if (!userId) return [];

  try {
    const history = await db
      .select({ studyId: userReadingHistory.studyId })
      .from(userReadingHistory)
      .where(eq(userReadingHistory.userId, userId));

    return history.map((h) => h.studyId);
  } catch (error) {
    console.error("Error fetching user reading history:", error);
    return [];
  }
}

/**
 * Generate personalized study recommendations based on user preferences
 */
async function getPersonalizedStudies(
  profile: UserProfile | null,
  viewedStudies: number[],
  maxResults: number,
): Promise<StudyRecommendation[]> {
  const baseQuery = db.select().from(studies);
  let whereConditions: any[] = [];

  // Exclude already viewed studies
  if (viewedStudies.length > 0) {
    whereConditions.push(
      sql`${studies.id} NOT IN (${viewedStudies.join(",")})`,
    );
  }

  // Apply user preferences if available
  if (profile) {
    // Prefer studies matching health benefits
    if (profile.preferredHealthBenefits?.length) {
      whereConditions.push(
        sql`${studies.healthBenefits} && ARRAY[${profile.preferredHealthBenefits.map((b) => `'${b}'`).join(",")}]`,
      );
    }

    // Prefer studies matching health conditions
    if (profile.preferredHealthConditions?.length) {
      whereConditions.push(
        sql`${studies.healthConditions} && ARRAY[${profile.preferredHealthConditions.map((c) => `'${c}'`).join(",")}]`,
      );
    }

    // Prefer studies matching body systems
    if (profile.preferredBodySystems?.length) {
      whereConditions.push(
        sql`${studies.bodySystems} && ARRAY[${profile.preferredBodySystems.map((s) => `'${s}'`).join(",")}]`,
      );
    }

    // Filter by reading level
    if (profile.preferredReadingLevel) {
      whereConditions.push(
        eq(studies.readingLevel, profile.preferredReadingLevel),
      );
    }

    // Exclude unwanted topics
    if (profile.excludedTopics?.length) {
      whereConditions.push(
        sql`NOT (${studies.tags} && ARRAY[${profile.excludedTopics.map((t) => `'${t}'`).join(",")}])`,
      );
    }
  }

  // Prefer AI-enhanced studies
  whereConditions.push(eq(studies.enhancedWithAI, true));

  const query =
    whereConditions.length > 0
      ? baseQuery.where(and(...whereConditions))
      : baseQuery;

  const results = await query
    .orderBy(desc(studies.popularityScore), desc(studies.publishDate))
    .limit(maxResults);

  return results
    .map((study) => ({
      ...study,
      relevanceScore: calculateRelevanceScore(study, profile),
      recommendationReason: generateRecommendationReason(study, profile),
      healthBenefits: study.healthBenefits || [],
      healthConditions: study.healthConditions || [],
      bodySystems: study.bodySystems || [],
      lifeStages: study.lifeStages || [],
      studyTypes: study.studyTypes || [],
      mechanisms: study.mechanisms || [],
      tags: study.tags || [],
    }))
    .sort((a, b) => b.relevanceScore - a.relevanceScore);
}

/**
 * Get studies similar to a specific study
 */
async function getSimilarStudies(
  targetStudyId: number,
  viewedStudies: number[],
  maxResults: number,
): Promise<StudyRecommendation[]> {
  // Get the target study
  const targetStudy = await db
    .select()
    .from(studies)
    .where(eq(studies.id, targetStudyId))
    .limit(1);

  if (targetStudy.length === 0) {
    throw new Error("Target study not found");
  }

  const target = targetStudy[0];

  // Find similar studies based on overlapping attributes
  let whereConditions: any[] = [
    ne(studies.id, targetStudyId), // Exclude the target study itself
  ];

  // Exclude viewed studies
  if (viewedStudies.length > 0) {
    whereConditions.push(
      sql`${studies.id} NOT IN (${viewedStudies.join(",")})`,
    );
  }

  // Find studies with similar health benefits, conditions, or body systems
  const similarityConditions: any[] = [];

  if (target.healthBenefits?.length) {
    similarityConditions.push(
      sql`${studies.healthBenefits} && ARRAY[${target.healthBenefits.map((b) => `'${b}'`).join(",")}]`,
    );
  }

  if (target.healthConditions?.length) {
    similarityConditions.push(
      sql`${studies.healthConditions} && ARRAY[${target.healthConditions.map((c) => `'${c}'`).join(",")}]`,
    );
  }

  if (target.bodySystems?.length) {
    similarityConditions.push(
      sql`${studies.bodySystems} && ARRAY[${target.bodySystems.map((s) => `'${s}'`).join(",")}]`,
    );
  }

  if (target.category) {
    similarityConditions.push(eq(studies.category, target.category));
  }

  if (similarityConditions.length > 0) {
    whereConditions.push(or(...similarityConditions));
  }

  const results = await db
    .select()
    .from(studies)
    .where(and(...whereConditions))
    .orderBy(desc(studies.enhancedWithAI), desc(studies.popularityScore))
    .limit(maxResults * 2); // Get more results to filter and rank

  return results
    .map((study) => ({
      ...study,
      relevanceScore: calculateSimilarityScore(study, target),
      recommendationReason: `Similar to "${target.title}" - shares ${getSharedAttributes(study, target)}`,
      healthBenefits: study.healthBenefits || [],
      healthConditions: study.healthConditions || [],
      bodySystems: study.bodySystems || [],
      lifeStages: study.lifeStages || [],
      studyTypes: study.studyTypes || [],
      mechanisms: study.mechanisms || [],
      tags: study.tags || [],
    }))
    .sort((a, b) => b.relevanceScore - a.relevanceScore)
    .slice(0, maxResults);
}

/**
 * Get trending studies based on popularity and recent engagement
 */
async function getTrendingStudies(
  viewedStudies: number[],
  maxResults: number,
): Promise<StudyRecommendation[]> {
  let whereConditions: any[] = [];

  // Exclude viewed studies
  if (viewedStudies.length > 0) {
    whereConditions.push(
      sql`${studies.id} NOT IN (${viewedStudies.join(",")})`,
    );
  }

  // Prefer AI-enhanced studies with high popularity
  whereConditions.push(eq(studies.enhancedWithAI, true));
  whereConditions.push(gt(studies.popularityScore, 0));

  const results = await db
    .select()
    .from(studies)
    .where(and(...whereConditions))
    .orderBy(desc(studies.popularityScore), desc(studies.publishDate))
    .limit(maxResults);

  return results.map((study) => ({
    ...study,
    relevanceScore: study.popularityScore || 0,
    recommendationReason:
      "Trending - Popular among hydrogen research enthusiasts",
    healthBenefits: study.healthBenefits || [],
    healthConditions: study.healthConditions || [],
    bodySystems: study.bodySystems || [],
    lifeStages: study.lifeStages || [],
    studyTypes: study.studyTypes || [],
    mechanisms: study.mechanisms || [],
    tags: study.tags || [],
  }));
}

/**
 * Get recent studies with user preference filtering
 */
async function getRecentStudies(
  profile: UserProfile | null,
  viewedStudies: number[],
  maxResults: number,
): Promise<StudyRecommendation[]> {
  let whereConditions: any[] = [];

  // Exclude viewed studies
  if (viewedStudies.length > 0) {
    whereConditions.push(
      sql`${studies.id} NOT IN (${viewedStudies.join(",")})`,
    );
  }

  // Get studies from the last 3 years
  const threeYearsAgo = new Date();
  threeYearsAgo.setFullYear(threeYearsAgo.getFullYear() - 3);
  whereConditions.push(gte(studies.publishDate, threeYearsAgo.toISOString()));

  const results = await db
    .select()
    .from(studies)
    .where(and(...whereConditions))
    .orderBy(desc(studies.publishDate), desc(studies.enhancedWithAI))
    .limit(maxResults);

  return results.map((study) => ({
    ...study,
    relevanceScore: calculateRecentStudyScore(study),
    recommendationReason:
      "Recent research - Latest developments in hydrogen therapy",
    healthBenefits: study.healthBenefits || [],
    healthConditions: study.healthConditions || [],
    bodySystems: study.bodySystems || [],
    lifeStages: study.lifeStages || [],
    studyTypes: study.studyTypes || [],
    mechanisms: study.mechanisms || [],
    tags: study.tags || [],
  }));
}

/**
 * Get comprehensive recommendations combining multiple strategies
 */
async function getComprehensiveRecommendations(
  profile: UserProfile | null,
  viewedStudies: number[],
  maxResults: number,
): Promise<StudyRecommendation[]> {
  const personalizedCount = Math.ceil(maxResults * 0.5);
  const trendingCount = Math.ceil(maxResults * 0.3);
  const recentCount = maxResults - personalizedCount - trendingCount;

  const [personalized, trending, recent] = await Promise.all([
    getPersonalizedStudies(profile, viewedStudies, personalizedCount),
    getTrendingStudies(viewedStudies, trendingCount),
    getRecentStudies(profile, viewedStudies, recentCount),
  ]);

  // Combine and deduplicate
  const allRecommendations = [...personalized, ...trending, ...recent];
  const seen = new Set<number>();
  const uniqueRecommendations = allRecommendations.filter((rec) => {
    if (seen.has(rec.id)) return false;
    seen.add(rec.id);
    return true;
  });

  return uniqueRecommendations
    .sort((a, b) => b.relevanceScore - a.relevanceScore)
    .slice(0, maxResults);
}

/**
 * Calculate relevance score based on user profile matching
 */
function calculateRelevanceScore(
  study: any,
  profile: UserProfile | null,
): number {
  if (!profile) return 50; // Base score

  let score = 0;

  // Health benefits matching (25 points max)
  if (profile.preferredHealthBenefits?.length && study.healthBenefits?.length) {
    const matches = study.healthBenefits.filter((benefit: string) =>
      profile.preferredHealthBenefits!.includes(benefit),
    ).length;
    score += (matches / profile.preferredHealthBenefits.length) * 25;
  }

  // Health conditions matching (25 points max)
  if (
    profile.preferredHealthConditions?.length &&
    study.healthConditions?.length
  ) {
    const matches = study.healthConditions.filter((condition: string) =>
      profile.preferredHealthConditions!.includes(condition),
    ).length;
    score += (matches / profile.preferredHealthConditions.length) * 25;
  }

  // Body systems matching (15 points max)
  if (profile.preferredBodySystems?.length && study.bodySystems?.length) {
    const matches = study.bodySystems.filter((system: string) =>
      profile.preferredBodySystems!.includes(system),
    ).length;
    score += (matches / profile.preferredBodySystems.length) * 15;
  }

  // Reading level matching (10 points max)
  if (
    profile.preferredReadingLevel &&
    study.readingLevel === profile.preferredReadingLevel
  ) {
    score += 10;
  }

  // AI enhancement bonus (15 points max)
  if (study.enhancedWithAI) {
    score += 15;
  }

  // Popularity bonus (10 points max)
  if (study.popularityScore > 0) {
    score += Math.min(study.popularityScore / 10, 10);
  }

  return Math.round(score);
}

/**
 * Calculate similarity score between two studies
 */
function calculateSimilarityScore(study: any, target: any): number {
  let score = 0;

  // Health benefits overlap
  if (target.healthBenefits?.length && study.healthBenefits?.length) {
    const overlap = target.healthBenefits.filter((benefit: string) =>
      study.healthBenefits.includes(benefit),
    ).length;
    score +=
      (overlap /
        Math.max(target.healthBenefits.length, study.healthBenefits.length)) *
      30;
  }

  // Health conditions overlap
  if (target.healthConditions?.length && study.healthConditions?.length) {
    const overlap = target.healthConditions.filter((condition: string) =>
      study.healthConditions.includes(condition),
    ).length;
    score +=
      (overlap /
        Math.max(
          target.healthConditions.length,
          study.healthConditions.length,
        )) *
      30;
  }

  // Body systems overlap
  if (target.bodySystems?.length && study.bodySystems?.length) {
    const overlap = target.bodySystems.filter((system: string) =>
      study.bodySystems.includes(system),
    ).length;
    score +=
      (overlap /
        Math.max(target.bodySystems.length, study.bodySystems.length)) *
      20;
  }

  // Category matching
  if (target.category === study.category) {
    score += 10;
  }

  // AI enhancement bonus
  if (study.enhancedWithAI) {
    score += 10;
  }

  return Math.round(score);
}

/**
 * Calculate score for recent studies
 */
function calculateRecentStudyScore(study: any): number {
  const now = new Date();
  const publishDate = new Date(study.publishDate);
  const daysSincePublish =
    (now.getTime() - publishDate.getTime()) / (1000 * 60 * 60 * 24);

  // More recent = higher score
  let score = Math.max(0, 100 - (daysSincePublish / 365) * 50); // Decrease score over time

  // AI enhancement bonus
  if (study.enhancedWithAI) {
    score += 20;
  }

  // Popularity bonus
  if (study.popularityScore > 0) {
    score += Math.min(study.popularityScore, 30);
  }

  return Math.round(score);
}

/**
 * Generate recommendation reason text
 */
function generateRecommendationReason(
  study: any,
  profile: UserProfile | null,
): string {
  if (!profile) return "Recommended based on study quality and relevance";

  const reasons: string[] = [];

  if (profile.preferredHealthBenefits?.length && study.healthBenefits?.length) {
    const matches = study.healthBenefits.filter((benefit: string) =>
      profile.preferredHealthBenefits!.includes(benefit),
    );
    if (matches.length > 0) {
      reasons.push(
        `matches your interest in ${matches.slice(0, 2).join(" and ")}`,
      );
    }
  }

  if (
    profile.preferredHealthConditions?.length &&
    study.healthConditions?.length
  ) {
    const matches = study.healthConditions.filter((condition: string) =>
      profile.preferredHealthConditions!.includes(condition),
    );
    if (matches.length > 0) {
      reasons.push(`relevant to ${matches.slice(0, 2).join(" and ")}`);
    }
  }

  if (study.enhancedWithAI) {
    reasons.push("enhanced with AI-generated insights");
  }

  if (reasons.length === 0) {
    return "Recommended based on your preferences and study quality";
  }

  return `Recommended because it ${reasons.join(", ")}`;
}

/**
 * Get shared attributes between two studies for similarity explanation
 */
function getSharedAttributes(study: any, target: any): string {
  const shared: string[] = [];

  if (study.category === target.category) {
    shared.push("category");
  }

  if (
    study.healthBenefits?.some((b: string) =>
      target.healthBenefits?.includes(b),
    )
  ) {
    shared.push("health benefits");
  }

  if (
    study.healthConditions?.some((c: string) =>
      target.healthConditions?.includes(c),
    )
  ) {
    shared.push("health conditions");
  }

  if (study.bodySystems?.some((s: string) => target.bodySystems?.includes(s))) {
    shared.push("body systems");
  }

  return shared.length > 0 ? shared.join(", ") : "research focus";
}

/**
 * Extract unique recommendation reasons for summary
 */
function extractRecommendationReasons(
  recommendations: StudyRecommendation[],
): string[] {
  const reasons = new Set<string>();

  recommendations.forEach((rec) => {
    if (rec.recommendationReason) {
      reasons.add(rec.recommendationReason);
    }
  });

  return Array.from(reasons);
}

/**
 * Save user study interaction for future recommendations
 */
export async function recordStudyInteraction(
  userId: number,
  studyId: number,
  interactionType: "view" | "like" | "share" | "download",
): Promise<void> {
  try {
    // Record in reading history
    await db
      .insert(userReadingHistory)
      .values({
        userId,
        studyId,
        viewedAt: new Date(),
        interactionType,
      })
      .onConflictDoNothing();

    // Update study popularity score
    await db
      .update(studies)
      .set({
        popularityScore: sql`COALESCE(${studies.popularityScore}, 0) + 1`,
      })
      .where(eq(studies.id, studyId));
  } catch (error) {
    console.error("Error recording study interaction:", error);
  }
}

/**
 * Update user preferences based on their behavior
 */
export async function updateUserPreferencesFromBehavior(
  userId: number,
): Promise<void> {
  try {
    // Get user's recent reading history
    const recentViews = await db
      .select({
        studyId: userReadingHistory.studyId,
        study: studies,
      })
      .from(userReadingHistory)
      .innerJoin(studies, eq(userReadingHistory.studyId, studies.id))
      .where(eq(userReadingHistory.userId, userId))
      .orderBy(desc(userReadingHistory.viewedAt))
      .limit(20);

    if (recentViews.length === 0) return;

    // Analyze patterns in user's reading behavior
    const healthBenefits = new Set<string>();
    const healthConditions = new Set<string>();
    const bodySystems = new Set<string>();
    const readingLevels = new Map<string, number>();

    recentViews.forEach(({ study }) => {
      study.healthBenefits?.forEach((benefit) => healthBenefits.add(benefit));
      study.healthConditions?.forEach((condition) =>
        healthConditions.add(condition),
      );
      study.bodySystems?.forEach((system) => bodySystems.add(system));

      if (study.readingLevel) {
        readingLevels.set(
          study.readingLevel,
          (readingLevels.get(study.readingLevel) || 0) + 1,
        );
      }
    });

    // Determine most common reading level
    let preferredReadingLevel = "";
    let maxCount = 0;
    for (const [level, count] of readingLevels.entries()) {
      if (count > maxCount) {
        maxCount = count;
        preferredReadingLevel = level;
      }
    }

    // Update user preferences
    await db
      .insert(userPreferences)
      .values({
        userId,
        preferredHealthBenefits: Array.from(healthBenefits).slice(0, 10),
        preferredHealthConditions: Array.from(healthConditions).slice(0, 10),
        preferredBodySystems: Array.from(bodySystems).slice(0, 8),
        preferredReadingLevel: preferredReadingLevel || null,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: userPreferences.userId,
        set: {
          preferredHealthBenefits: Array.from(healthBenefits).slice(0, 10),
          preferredHealthConditions: Array.from(healthConditions).slice(0, 10),
          preferredBodySystems: Array.from(bodySystems).slice(0, 8),
          preferredReadingLevel: preferredReadingLevel || null,
          updatedAt: new Date(),
        },
      });
  } catch (error) {
    console.error("Error updating user preferences from behavior:", error);
  }
}
