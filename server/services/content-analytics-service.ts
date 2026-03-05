/**
 * Content Analytics Service
 * Handles tracking, analysis, and insights for content performance
 */

import { db } from "../db";
import {
  contentAnalytics,
  userEngagement,
  contentInsights,
  studies,
  blogArticles,
  scientificArticles,
  users,
  InsertContentAnalytics,
  InsertUserEngagement,
  InsertContentInsights,
  ContentAnalytics,
  UserEngagement,
  ContentInsights,
} from "@shared/schema";
import {
  eq,
  and,
  gte,
  lte,
  desc,
  asc,
  sql,
  gt,
  lt,
  inArray,
} from "drizzle-orm";
import { withRetry } from "../utils/database-wrapper";
import { AppError, ErrorCode } from "../utils/app-errors";

// Content types supported
export enum ContentType {
  STUDY = "study",
  BLOG = "blog",
  ARTICLE = "article",
}

// Engagement actions
export enum EngagementAction {
  VIEW = "view",
  LIKE = "like",
  SHARE = "share",
  DOWNLOAD = "download",
  COMMENT = "comment",
  CLICK = "click",
  SCROLL = "scroll",
  TIME_SPENT = "time_spent",
}

// Period types for analytics aggregation
export enum PeriodType {
  HOURLY = "hourly",
  DAILY = "daily",
  WEEKLY = "weekly",
  MONTHLY = "monthly",
}

interface TrackViewParams {
  contentType: ContentType;
  contentId: number;
  userId?: string;
  sessionId: string;
  referrerType?: string;
  referrerValue?: string;
  deviceType?: string;
  browserType?: string;
  contentPosition?: number;
}

interface TrackEngagementParams {
  contentType: ContentType;
  contentId: number;
  userId?: string;
  sessionId: string;
  action: EngagementAction;
  actionValue?: string;
  timeSpent?: number;
  scrollDepth?: number;
}

interface ContentPerformanceMetrics {
  viewCount: number;
  uniqueViewers: number;
  avgTimeSpent: number;
  bounceRate: number;
  shareCount: number;
  conversionRate: number;
  engagementScore: number;
}

interface ContentRecommendation {
  contentType: ContentType;
  contentId: number;
  title: string;
  score: number;
  reason: string;
}

/** Estimate syllable count for a word (English approximation). */
function countSyllables(word: string): number {
  word = word.toLowerCase().replace(/[^a-z]/g, "");
  if (word.length <= 3) return 1;
  let count = 0;
  const vowels = "aeiouy";
  let prevVowel = false;
  for (const char of word) {
    const isVowel = vowels.includes(char);
    if (isVowel && !prevVowel) count++;
    prevVowel = isVowel;
  }
  // Adjust for silent e
  if (word.endsWith("e") && count > 1) count--;
  // Adjust for -le ending
  if (word.endsWith("le") && word.length > 2 && !vowels.includes(word[word.length - 3])) count++;
  return Math.max(1, count);
}

class ContentAnalyticsService {
  /**
   * Track a content view
   */
  async trackView(params: TrackViewParams): Promise<void> {
    try {
      // Record individual engagement
      await withRetry(async () => {
        await db.insert(userEngagement).values({
          userId: params.userId || null,
          sessionId: params.sessionId,
          contentType: params.contentType,
          contentId: params.contentId,
          action: EngagementAction.VIEW,
          referrerType: params.referrerType,
          referrerValue: params.referrerValue,
          deviceType: params.deviceType,
          browserType: params.browserType,
          contentPosition: params.contentPosition,
          timeSpent: 0,
          scrollDepth: 0,
          engagementScore: 1,
        });
      });

      // Update or create daily analytics
      await this.updateContentAnalytics(params.contentType, params.contentId, {
        viewCount: 1,
        uniqueViewers: 1,
      });
    } catch (error) {
      console.error("Error tracking view:", error);
      throw new AppError(
        "Failed to track content view",
        500,
        ErrorCode.INTERNAL_SERVER_ERROR,
        false,
        { params },
        error as Error,
      );
    }
  }

  /**
   * Track engagement action
   */
  async trackEngagement(params: TrackEngagementParams): Promise<void> {
    try {
      // Calculate engagement score based on action
      const engagementScore = this.calculateEngagementScore(
        params.action,
        params.timeSpent,
        params.scrollDepth,
      );

      // Record engagement
      await withRetry(async () => {
        await db.insert(userEngagement).values({
          userId: params.userId || null,
          sessionId: params.sessionId,
          contentType: params.contentType,
          contentId: params.contentId,
          action: params.action,
          actionValue: params.actionValue,
          timeSpent: params.timeSpent || 0,
          scrollDepth: params.scrollDepth || 0,
          engagementScore,
        });
      });

      // Update analytics based on action
      const updates: Partial<InsertContentAnalytics> = {};

      switch (params.action) {
        case EngagementAction.SHARE:
          updates.shareCount = 1;
          break;
        case EngagementAction.LIKE:
          updates.likeCount = 1;
          break;
        case EngagementAction.DOWNLOAD:
          updates.downloadCount = 1;
          break;
        case EngagementAction.COMMENT:
          updates.commentCount = 1;
          break;
        case EngagementAction.TIME_SPENT:
          if (params.timeSpent) {
            updates.totalTimeSpent = params.timeSpent;
          }
          break;
        case EngagementAction.SCROLL:
          if (params.scrollDepth) {
            updates.scrollDepth = params.scrollDepth;
          }
          break;
      }

      if (Object.keys(updates).length > 0) {
        await this.updateContentAnalytics(
          params.contentType,
          params.contentId,
          updates,
        );
      }
    } catch (error) {
      console.error("Error tracking engagement:", error);
      throw new AppError(
        "Failed to track engagement",
        500,
        ErrorCode.INTERNAL_SERVER_ERROR,
        false,
        { params },
        error as Error,
      );
    }
  }

  /**
   * Get top performing content
   */
  async getTopContent(
    limit: number = 10,
    contentType?: ContentType,
    period?: { start: Date; end: Date },
  ): Promise<any[]> {
    try {
      const conditions = [];

      if (contentType) {
        conditions.push(eq(contentAnalytics.contentType, contentType));
      }

      if (period) {
        conditions.push(
          gte(contentAnalytics.periodStart, period.start),
          lte(contentAnalytics.periodEnd, period.end),
        );
      }

      const analytics = await db
        .select()
        .from(contentAnalytics)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(contentAnalytics.viewCount))
        .limit(limit);

      // Enrich with content details
      const enriched = await Promise.all(
        analytics.map(async (item) => {
          const content = await this.getContentDetails(
            item.contentType as ContentType,
            item.contentId,
          );
          return {
            ...item,
            content,
            performanceScore: this.calculatePerformanceScore(item),
          };
        }),
      );

      return enriched;
    } catch (error) {
      console.error("Error getting top content:", error);
      throw error;
    }
  }

  /**
   * Get content insights and recommendations
   */
  async getContentInsights(
    contentType: ContentType,
    contentId: number,
  ): Promise<ContentInsights | null> {
    try {
      const [insight] = await db
        .select()
        .from(contentInsights)
        .where(
          and(
            eq(contentInsights.contentType, contentType),
            eq(contentInsights.contentId, contentId),
          ),
        )
        .limit(1);

      if (!insight) {
        // Generate insights if not cached
        return await this.generateContentInsights(contentType, contentId);
      }

      return insight;
    } catch (error) {
      console.error("Error getting content insights:", error);
      throw error;
    }
  }

  /**
   * Get content recommendations
   */
  async getRecommendations(
    userId?: string,
    sessionId?: string,
    limit: number = 5,
  ): Promise<ContentRecommendation[]> {
    try {
      // Get user's engagement history
      const userHistory = await this.getUserEngagementHistory(
        userId,
        sessionId,
      );

      // Analyze patterns
      const preferences = this.analyzeUserPreferences(userHistory);

      // Get high-performing content matching preferences
      const recommendations = await this.findMatchingContent(
        preferences,
        limit,
      );

      return recommendations;
    } catch (error) {
      console.error("Error getting recommendations:", error);
      throw error;
    }
  }

  /**
   * Perform A/B test analysis
   */
  async getABTestResults(testId: string): Promise<any> {
    try {
      const results = await db
        .select({
          version: contentAnalytics.abTestVersion,
          viewCount: sql<number>`sum(${contentAnalytics.viewCount})`,
          avgTimeSpent: sql<number>`avg(${contentAnalytics.avgTimeSpent})`,
          bounceRate: sql<number>`avg(${contentAnalytics.bounceRate})`,
          conversionRate: sql<number>`avg(${contentAnalytics.conversionRate})`,
        })
        .from(contentAnalytics)
        .where(
          sql`${contentAnalytics.abTestMetrics}::jsonb->>'testId' = ${testId}`,
        )
        .groupBy(contentAnalytics.abTestVersion);

      // Calculate statistical significance
      const analysis = this.analyzeABTestResults(results);

      return analysis;
    } catch (error) {
      console.error("Error getting A/B test results:", error);
      throw error;
    }
  }

  /**
   * Generate optimization suggestions
   */
  async generateOptimizationSuggestions(
    contentType: ContentType,
    contentId: number,
  ): Promise<string[]> {
    try {
      // Get current performance
      const performance = await this.getContentPerformance(
        contentType,
        contentId,
      );

      // Get top performers in same category
      const topPerformers = await this.getTopContent(5, contentType);

      // Generate suggestions
      const suggestions = [];

      // Compare metrics
      if (performance.avgTimeSpent < topPerformers[0]?.avgTimeSpent * 0.7) {
        suggestions.push(
          "Consider improving content engagement - average time spent is below category leaders",
        );
      }

      if (performance.bounceRate > 50) {
        suggestions.push(
          "High bounce rate detected - improve introduction and hook readers early",
        );
      }

      if (performance.shareCount < performance.viewCount * 0.01) {
        suggestions.push(
          "Low share rate - add social sharing prompts and shareable quotes",
        );
      }

      if (performance.conversionRate < 20) {
        suggestions.push(
          "Improve related content recommendations to increase conversion",
        );
      }

      return suggestions;
    } catch (error) {
      console.error("Error generating suggestions:", error);
      throw error;
    }
  }

  // Private helper methods

  private async updateContentAnalytics(
    contentType: ContentType,
    contentId: number,
    updates: Partial<InsertContentAnalytics>,
  ): Promise<void> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Check if record exists for today
    const [existing] = await db
      .select()
      .from(contentAnalytics)
      .where(
        and(
          eq(contentAnalytics.contentType, contentType),
          eq(contentAnalytics.contentId, contentId),
          eq(contentAnalytics.periodType, PeriodType.DAILY),
          gte(contentAnalytics.periodStart, today),
          lt(contentAnalytics.periodStart, tomorrow),
        ),
      )
      .limit(1);

    if (existing) {
      // Update existing record
      const updatedValues: any = {};

      for (const [key, value] of Object.entries(updates)) {
        if (typeof value === "number") {
          updatedValues[key] =
            sql`${contentAnalytics[key as keyof typeof contentAnalytics]} + ${value}`;
        } else {
          updatedValues[key] = value;
        }
      }

      await db
        .update(contentAnalytics)
        .set(updatedValues)
        .where(eq(contentAnalytics.id, existing.id));
    } else {
      // Create new record
      await db.insert(contentAnalytics).values({
        contentType,
        contentId,
        periodType: PeriodType.DAILY,
        periodStart: today,
        periodEnd: tomorrow,
        ...updates,
      });
    }
  }

  private calculateEngagementScore(
    action: EngagementAction,
    timeSpent?: number,
    scrollDepth?: number,
  ): number {
    let score = 0;

    // Action scores
    const actionScores = {
      [EngagementAction.VIEW]: 1,
      [EngagementAction.LIKE]: 3,
      [EngagementAction.SHARE]: 5,
      [EngagementAction.DOWNLOAD]: 4,
      [EngagementAction.COMMENT]: 4,
      [EngagementAction.CLICK]: 2,
      [EngagementAction.SCROLL]: 1,
      [EngagementAction.TIME_SPENT]: 2,
    };

    score += actionScores[action] || 0;

    // Time bonus
    if (timeSpent) {
      if (timeSpent > 300)
        score += 3; // 5+ minutes
      else if (timeSpent > 120)
        score += 2; // 2+ minutes
      else if (timeSpent > 60) score += 1; // 1+ minute
    }

    // Scroll depth bonus
    if (scrollDepth) {
      if (scrollDepth > 80) score += 2;
      else if (scrollDepth > 50) score += 1;
    }

    return score;
  }

  private calculatePerformanceScore(analytics: ContentAnalytics): number {
    let score = 0;

    // Weighted scoring
    score += (analytics.viewCount ?? 0) * 0.2;
    score += (analytics.uniqueViewers ?? 0) * 0.3;
    score += ((analytics.avgTimeSpent ?? 0) / 60) * 10; // Convert to minutes
    score += (100 - (analytics.bounceRate ?? 0)) * 0.5;
    score += (analytics.shareCount ?? 0) * 5;
    score += (analytics.conversionRate ?? 0) * 2;

    return Math.round(score);
  }

  private async getContentDetails(
    contentType: ContentType,
    contentId: number,
  ): Promise<any> {
    try {
      switch (contentType) {
        case ContentType.STUDY:
          const [study] = await db
            .select()
            .from(studies)
            .where(eq(studies.id, contentId))
            .limit(1);
          return study;

        case ContentType.BLOG:
          const [blog] = await db
            .select()
            .from(blogArticles)
            .where(eq(blogArticles.id, contentId))
            .limit(1);
          return blog;

        case ContentType.ARTICLE:
          const [article] = await db
            .select()
            .from(scientificArticles)
            .where(eq(scientificArticles.id, contentId))
            .limit(1);
          return article;

        default:
          return null;
      }
    } catch (error) {
      console.error("Error getting content details:", error);
      return null;
    }
  }

  private async generateContentInsights(
    contentType: ContentType,
    contentId: number,
  ): Promise<ContentInsights | null> {
    try {
      // Get performance metrics
      const performance = await this.getContentPerformance(
        contentType,
        contentId,
      );

      // Get similar high performers
      const similarContent = await this.findSimilarHighPerformers(
        contentType,
        contentId,
      );

      // Analyze patterns
      const patterns = await this.analyzeSuccessPatterns(contentType);

      // Generate insights
      const insights: InsertContentInsights = {
        contentType,
        contentId,
        headlinePattern: patterns.headlinePattern,
        optimalLength: patterns.optimalLength,
        bestKeywords: patterns.keywords,
        bestTags: patterns.tags,
        improvementSuggestions: await this.generateOptimizationSuggestions(
          contentType,
          contentId,
        ),
        similarHighPerformers: similarContent.map((c) => String(c.contentId)),
        optimalPublishTime: patterns.optimalPublishTime,
        primaryAudience: await this.inferAudience(contentType, contentId),
        audiencePreferences: JSON.stringify({}),
        readingLevel: await this.calculateReadingLevel(contentType, contentId),
        missingTopics: [],
        suggestedFollowUps: [],
        predictedEngagement: Math.round(performance.engagementScore * 1.2),
        confidenceScore: 75,
      };

      // Save insights
      await db.insert(contentInsights).values(insights);

      return insights as ContentInsights;
    } catch (error) {
      console.error("Error generating insights:", error);
      return null;
    }
  }

  private async getContentPerformance(
    contentType: ContentType,
    contentId: number,
  ): Promise<ContentPerformanceMetrics> {
    const [metrics] = await db
      .select({
        viewCount: sql<number>`sum(${contentAnalytics.viewCount})`,
        uniqueViewers: sql<number>`sum(${contentAnalytics.uniqueViewers})`,
        avgTimeSpent: sql<number>`avg(${contentAnalytics.avgTimeSpent})`,
        bounceRate: sql<number>`avg(${contentAnalytics.bounceRate})`,
        shareCount: sql<number>`sum(${contentAnalytics.shareCount})`,
        conversionRate: sql<number>`avg(${contentAnalytics.conversionRate})`,
      })
      .from(contentAnalytics)
      .where(
        and(
          eq(contentAnalytics.contentType, contentType),
          eq(contentAnalytics.contentId, contentId),
        ),
      );

    return {
      viewCount: metrics?.viewCount || 0,
      uniqueViewers: metrics?.uniqueViewers || 0,
      avgTimeSpent: metrics?.avgTimeSpent || 0,
      bounceRate: metrics?.bounceRate || 0,
      shareCount: metrics?.shareCount || 0,
      conversionRate: metrics?.conversionRate || 0,
      engagementScore: 0, // Will be calculated
    };
  }

  private async getUserEngagementHistory(
    userId?: string,
    sessionId?: string,
  ): Promise<UserEngagement[]> {
    const conditions = [];

    if (userId) {
      conditions.push(eq(userEngagement.userId, userId));
    } else if (sessionId) {
      conditions.push(eq(userEngagement.sessionId, sessionId));
    }

    if (conditions.length === 0) return [];

    return await db
      .select()
      .from(userEngagement)
      .where(and(...conditions))
      .orderBy(desc(userEngagement.createdAt))
      .limit(100);
  }

  private analyzeUserPreferences(history: UserEngagement[]): any {
    const preferences = {
      contentTypes: {} as Record<string, number>,
      categories: {} as Record<string, number>,
      avgTimeSpent: 0,
      preferredLength: 0,
      engagementPattern: "",
    };

    // Analyze engagement history
    history.forEach((engagement) => {
      preferences.contentTypes[engagement.contentType] =
        (preferences.contentTypes[engagement.contentType] || 0) +
        (engagement.engagementScore ?? 0);

      preferences.avgTimeSpent += (engagement.timeSpent ?? 0);
    });

    if (history.length > 0) {
      preferences.avgTimeSpent /= history.length;
    }

    return preferences;
  }

  private async findMatchingContent(
    preferences: any,
    limit: number,
  ): Promise<ContentRecommendation[]> {
    // Get high-performing content matching preferences
    const topContent = await this.getTopContent(limit * 2);

    // Score and rank based on preferences
    const scored = topContent.map((content) => ({
      contentType: content.contentType as ContentType,
      contentId: content.contentId,
      title: content.content?.title || "",
      score: this.scoreContentMatch(content, preferences),
      reason: this.generateRecommendationReason(content, preferences),
    }));

    // Sort by score and return top N
    return scored.sort((a, b) => b.score - a.score).slice(0, limit);
  }

  private scoreContentMatch(content: any, preferences: any): number {
    let score = content.performanceScore || 0;

    // Boost score if content type matches preference
    if (preferences.contentTypes[content.contentType]) {
      score *= 1 + preferences.contentTypes[content.contentType] / 100;
    }

    return score;
  }

  private generateRecommendationReason(content: any, preferences: any): string {
    if (content.viewCount > 1000) {
      return "Trending content with high engagement";
    }

    if (preferences.contentTypes[content.contentType] > 10) {
      return "Based on your reading history";
    }

    return "Recommended for you";
  }

  private async findSimilarHighPerformers(
    contentType: ContentType,
    contentId: number,
    limit: number = 5,
  ): Promise<ContentAnalytics[]> {
    // Get content details for comparison
    const content = await this.getContentDetails(contentType, contentId);

    if (!content) return [];

    // Find similar content with high performance
    const similar = await db
      .select()
      .from(contentAnalytics)
      .where(
        and(
          eq(contentAnalytics.contentType, contentType),
          gt(contentAnalytics.viewCount, 100), // High performers
          sql`${contentAnalytics.contentId} != ${contentId}`,
        ),
      )
      .orderBy(desc(contentAnalytics.viewCount))
      .limit(limit);

    return similar;
  }

  private async analyzeSuccessPatterns(contentType: ContentType): Promise<any> {
    // Get top performing content
    const topContent = await this.getTopContent(20, contentType);

    const patterns = {
      headlinePattern: "",
      optimalLength: 0,
      keywords: [] as string[],
      tags: [] as string[],
      optimalPublishTime: "",
    };

    // Analyze patterns (simplified version)
    if (topContent.length > 0) {
      // Calculate average content length
      let totalLength = 0;
      topContent.forEach((item) => {
        if (item.content?.content) {
          totalLength += item.content.content.split(" ").length;
        }
      });
      patterns.optimalLength = Math.round(totalLength / topContent.length);

      // Determine optimal publish time (placeholder)
      patterns.optimalPublishTime = "10:00 AM";
    }

    return patterns;
  }

  private analyzeABTestResults(results: any[]): any {
    if (results.length < 2) {
      return {
        status: "insufficient_data",
        message: "Need at least 2 versions for comparison",
      };
    }

    // Sort by conversion rate
    const sorted = results.sort((a, b) => b.conversionRate - a.conversionRate);

    const winner = sorted[0];
    const control = sorted[1];

    // Calculate improvement
    const improvement =
      ((winner.conversionRate - control.conversionRate) /
        control.conversionRate) *
      100;

    // Simple significance check (would use proper statistics in production)
    const isSignificant =
      winner.viewCount > 100 && control.viewCount > 100 && improvement > 10;

    return {
      status: "complete",
      winner: winner.version,
      control: control.version,
      improvement: `${improvement.toFixed(1)}%`,
      isSignificant,
      metrics: {
        winner,
        control,
      },
    };
  }

  /**
   * Infer primary audience from content category and type.
   */
  private async inferAudience(
    contentType: ContentType,
    contentId: number,
  ): Promise<string> {
    try {
      if (contentType === ContentType.STUDY) {
        const [study] = await db
          .select({ category: studies.category, studyType: studies.studyType })
          .from(studies)
          .where(eq(studies.id, contentId))
          .limit(1);
        if (!study) return "general";
        const cat = (study.category || "").toLowerCase();
        const type = (study.studyType || "").toLowerCase();
        if (type === "human" || cat.includes("clinical")) return "healthcare_professional";
        if (cat.includes("athlet") || cat.includes("exercise") || cat.includes("sport")) return "athlete";
        if (cat.includes("aging") || cat.includes("elder")) return "older_adult";
        return "general";
      }
      if (contentType === ContentType.BLOG) {
        const [blog] = await db
          .select({ articleType: blogArticles.articleType })
          .from(blogArticles)
          .where(eq(blogArticles.id, contentId))
          .limit(1);
        if (!blog) return "general";
        const type = (blog.articleType || "").toLowerCase();
        if (["how_to_guide", "daily_routine", "tips"].includes(type)) return "consumer";
        if (["patient_story", "side_effects"].includes(type)) return "patient";
        if (["overview", "comparison", "future_implications"].includes(type)) return "researcher";
        return "general";
      }
      return "general";
    } catch {
      return "general";
    }
  }

  /**
   * Calculate Flesch-Kincaid reading grade level from content text.
   */
  private async calculateReadingLevel(
    contentType: ContentType,
    contentId: number,
  ): Promise<number> {
    try {
      let text = "";
      if (contentType === ContentType.STUDY) {
        const [study] = await db
          .select({ abstract: studies.abstract })
          .from(studies)
          .where(eq(studies.id, contentId))
          .limit(1);
        text = study?.abstract || "";
      } else if (contentType === ContentType.BLOG) {
        const [blog] = await db
          .select({ content: blogArticles.content })
          .from(blogArticles)
          .where(eq(blogArticles.id, contentId))
          .limit(1);
        text = blog?.content || "";
      }

      if (text.length < 50) return 8; // Default for very short content

      const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0).length || 1;
      const words = text.split(/\s+/).filter((w) => w.length > 0);
      const wordCount = words.length || 1;
      const syllableCount = words.reduce((sum, word) => sum + countSyllables(word), 0);

      // Flesch-Kincaid Grade Level formula
      const grade = 0.39 * (wordCount / sentences) + 11.8 * (syllableCount / wordCount) - 15.59;
      return Math.max(1, Math.min(20, Math.round(grade)));
    } catch {
      return 8;
    }
  }
}

// Export singleton instance
export const contentAnalyticsService = new ContentAnalyticsService();
