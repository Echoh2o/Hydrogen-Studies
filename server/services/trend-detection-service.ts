/**
 * AI-Powered Trend Detection Service
 * Analyzes hydrogen research data to identify emerging topics, breakthrough findings, and research momentum
 */

import { db } from "../db";
import {
  studies,
  studyMetrics,
  searchQueries,
  trendAnalysis,
  trendAlerts,
  tags,
  studyTags,
  InsertTrendAnalysis,
  InsertTrendAlert,
  InsertStudyMetrics,
} from "@shared/schema";
import { eq, and, gte, lte, desc, asc, sql, count, avg } from "drizzle-orm";
import { ai } from "./ai-provider";
import { subDays, subMonths, subQuarters, format } from "date-fns";

/**
 * SQL expression for effective publication date.
 * Uses journalPublishDate (original pub date) if available,
 * falls back to publishDate, then createdAt.
 * This ensures bulk-imported studies are filtered by their actual
 * publication date rather than the date they were imported.
 */
const effectiveDate = sql`COALESCE(${studies.journalPublishDate}, ${studies.publishDate}, ${studies.createdAt}::text)`;

// Types for analysis results
interface EmergingTopic {
  topic: string;
  count: number;
  growthRate: number;
  previousCount: number;
  studyIds: number[];
  keywords: string[];
  significance: "high" | "medium" | "low";
}

interface BreakthroughStudy {
  studyId: number;
  title: string;
  impactScore: number;
  citationCount: number;
  viewCount: number;
  reasonForBreakthrough: string;
  publicationDate: string;
}

interface MomentumData {
  accelerating: {
    area: string;
    currentActivity: number;
    previousActivity: number;
    percentageChange: number;
    studyIds: number[];
  }[];
  declining: {
    area: string;
    currentActivity: number;
    previousActivity: number;
    percentageChange: number;
    studyIds: number[];
  }[];
  stable: {
    area: string;
    activity: number;
    studyIds: number[];
  }[];
}

interface KeywordTrend {
  keyword: string;
  currentFrequency: number;
  previousFrequency: number;
  trend: "rising" | "falling" | "stable";
  percentageChange: number;
  relatedStudies: number[];
}

export class TrendDetectionService {
  /**
   * Get date range based on period type
   */
  private getDateRange(
    periodType: "weekly" | "monthly" | "quarterly" | "yearly",
  ) {
    const now = new Date();
    let periodStart: Date;

    switch (periodType) {
      case "weekly":
        periodStart = subDays(now, 7);
        break;
      case "monthly":
        periodStart = subMonths(now, 1);
        break;
      case "quarterly":
        periodStart = subQuarters(now, 1);
        break;
      case "yearly":
        periodStart = subMonths(now, 12);
        break;
    }

    return { periodStart, periodEnd: now };
  }

  /**
   * Identify emerging research topics
   */
  async identifyEmergingTopics(
    periodType: "weekly" | "monthly" | "quarterly" = "monthly",
  ): Promise<EmergingTopic[]> {
    const { periodStart, periodEnd } = this.getDateRange(periodType);
    const previousPeriod = this.getDateRange(periodType);
    previousPeriod.periodEnd = periodStart;
    previousPeriod.periodStart = new Date(
      periodStart.getTime() - (periodEnd.getTime() - periodStart.getTime()),
    );

    // Get keyword frequencies for current period
    const currentKeywords = await this.getKeywordFrequencies(
      periodStart,
      periodEnd,
    );
    const previousKeywords = await this.getKeywordFrequencies(
      previousPeriod.periodStart,
      previousPeriod.periodEnd,
    );

    // Analyze emerging topics
    const emergingTopics: EmergingTopic[] = [];

    for (const [keyword, currentData] of Object.entries(currentKeywords)) {
      const previousData = previousKeywords[keyword] || {
        count: 0,
        studyIds: [],
      };
      const growthRate =
        previousData.count === 0
          ? 100
          : ((currentData.count - previousData.count) / previousData.count) *
            100;

      // Consider a topic emerging if it has significant growth or is new
      if (
        growthRate >= 50 ||
        (previousData.count === 0 && currentData.count >= 3)
      ) {
        // Get related keywords using tag associations
        const relatedKeywords = await this.getRelatedKeywords(keyword);

        emergingTopics.push({
          topic: keyword,
          count: currentData.count,
          growthRate,
          previousCount: previousData.count,
          studyIds: currentData.studyIds,
          keywords: relatedKeywords,
          significance: this.calculateSignificance(
            currentData.count,
            growthRate,
          ),
        });
      }
    }

    // Sort by significance and growth rate
    return emergingTopics
      .sort((a, b) => {
        if (a.significance !== b.significance) {
          const sigOrder = { high: 3, medium: 2, low: 1 };
          return sigOrder[b.significance] - sigOrder[a.significance];
        }
        return b.growthRate - a.growthRate;
      })
      .slice(0, 20); // Return top 20 emerging topics
  }

  /**
   * Detect breakthrough studies based on impact metrics
   */
  async detectBreakthroughStudies(
    periodType: "weekly" | "monthly" | "quarterly" = "monthly",
  ): Promise<BreakthroughStudy[]> {
    const { periodStart, periodEnd } = this.getDateRange(periodType);

    // Get recent high-impact studies
    const recentStudies = await db
      .select({
        id: studies.id,
        title: studies.title,
        citationCount: studies.citationCount,
        viewCount: studies.viewCount,
        publishDate: studies.journalPublishDate,
        abstract: studies.abstract,
        plainLanguageTitle: studies.plainLanguageTitle,
      })
      .from(studies)
      .where(
        and(
          sql`${effectiveDate} >= ${periodStart.toISOString()}`,
          sql`${effectiveDate} <= ${periodEnd.toISOString()}`,
        ),
      )
      .orderBy(desc(studies.citationCount), desc(studies.viewCount));

    const breakthroughStudies: BreakthroughStudy[] = [];

    // Calculate impact scores and identify breakthroughs
    for (const study of recentStudies) {
      // Calculate impact score based on multiple factors
      const impactScore = this.calculateImpactScore({
        citationCount: study.citationCount || 0,
        viewCount: study.viewCount || 0,
        recency: this.getRecencyScore(study.publishDate || ""),
      });

      // Consider it a breakthrough if impact score is high
      if (impactScore >= 70) {
        // Use AI to determine why this is a breakthrough
        const breakthroughReason = await this.analyzeBreakthroughReason(study);

        breakthroughStudies.push({
          studyId: study.id,
          title: study.plainLanguageTitle || study.title,
          impactScore,
          citationCount: study.citationCount || 0,
          viewCount: study.viewCount || 0,
          reasonForBreakthrough: breakthroughReason,
          publicationDate: study.publishDate || "",
        });
      }
    }

    return breakthroughStudies
      .sort((a, b) => b.impactScore - a.impactScore)
      .slice(0, 10); // Return top 10 breakthrough studies
  }

  /**
   * Track research momentum - identify accelerating and declining areas
   */
  async trackResearchMomentum(
    periodType: "weekly" | "monthly" | "quarterly" = "monthly",
  ): Promise<MomentumData> {
    const { periodStart, periodEnd } = this.getDateRange(periodType);
    const previousPeriod = this.getDateRange(periodType);
    previousPeriod.periodEnd = periodStart;
    previousPeriod.periodStart = new Date(
      periodStart.getTime() - (periodEnd.getTime() - periodStart.getTime()),
    );

    // Get category activity for both periods
    const currentActivity = await this.getCategoryActivity(
      periodStart,
      periodEnd,
    );
    const previousActivity = await this.getCategoryActivity(
      previousPeriod.periodStart,
      previousPeriod.periodEnd,
    );

    const accelerating = [];
    const declining = [];
    const stable = [];

    // Analyze momentum for each category
    for (const [category, currentData] of Object.entries(currentActivity)) {
      const previousData = previousActivity[category] || {
        count: 0,
        studyIds: [],
      };
      const percentageChange =
        previousData.count === 0
          ? 100
          : ((currentData.count - previousData.count) / previousData.count) *
            100;

      const momentumItem = {
        area: category,
        currentActivity: currentData.count,
        previousActivity: previousData.count,
        percentageChange,
        studyIds: currentData.studyIds,
      };

      // Categorize based on momentum
      if (percentageChange >= 20) {
        accelerating.push(momentumItem);
      } else if (percentageChange <= -20) {
        declining.push(momentumItem);
      } else {
        stable.push({
          area: category,
          activity: currentData.count,
          studyIds: currentData.studyIds,
        });
      }
    }

    return {
      accelerating: accelerating.sort(
        (a, b) => b.percentageChange - a.percentageChange,
      ),
      declining: declining.sort(
        (a, b) => a.percentageChange - b.percentageChange,
      ),
      stable: stable.sort((a, b) => b.activity - a.activity),
    };
  }

  /**
   * Analyze keyword trends over time
   */
  async analyzeKeywordTrends(
    periodType: "weekly" | "monthly" | "quarterly" = "monthly",
  ): Promise<KeywordTrend[]> {
    const { periodStart, periodEnd } = this.getDateRange(periodType);
    const previousPeriod = this.getDateRange(periodType);
    previousPeriod.periodEnd = periodStart;
    previousPeriod.periodStart = new Date(
      periodStart.getTime() - (periodEnd.getTime() - periodStart.getTime()),
    );

    const currentKeywords = await this.getKeywordFrequencies(
      periodStart,
      periodEnd,
    );
    const previousKeywords = await this.getKeywordFrequencies(
      previousPeriod.periodStart,
      previousPeriod.periodEnd,
    );

    const trends: KeywordTrend[] = [];

    // Analyze all keywords
    const allKeywords = new Set([
      ...Object.keys(currentKeywords),
      ...Object.keys(previousKeywords),
    ]);

    for (const keyword of Array.from(allKeywords)) {
      const current = currentKeywords[keyword] || { count: 0, studyIds: [] };
      const previous = previousKeywords[keyword] || { count: 0, studyIds: [] };

      const percentageChange =
        previous.count === 0
          ? current.count > 0
            ? 100
            : 0
          : ((current.count - previous.count) / previous.count) * 100;

      let trend: "rising" | "falling" | "stable";
      if (percentageChange > 10) trend = "rising";
      else if (percentageChange < -10) trend = "falling";
      else trend = "stable";

      trends.push({
        keyword,
        currentFrequency: current.count,
        previousFrequency: previous.count,
        trend,
        percentageChange,
        relatedStudies: current.studyIds,
      });
    }

    return trends
      .filter((t) => t.currentFrequency > 0 || t.previousFrequency > 0)
      .sort(
        (a, b) => Math.abs(b.percentageChange) - Math.abs(a.percentageChange),
      )
      .slice(0, 50); // Return top 50 keyword trends
  }

  /**
   * Generate comprehensive trend report
   */
  async generateTrendReport(
    periodType: "weekly" | "monthly" | "quarterly" = "monthly",
  ): Promise<InsertTrendAnalysis> {
    const { periodStart, periodEnd } = this.getDateRange(periodType);
    const startTime = Date.now();

    try {
      // Run all analyses in parallel for efficiency
      const [
        emergingTopics,
        breakthroughStudies,
        momentumData,
        keywordTrends,
        stats,
      ] = await Promise.all([
        this.identifyEmergingTopics(periodType),
        this.detectBreakthroughStudies(periodType),
        this.trackResearchMomentum(periodType),
        this.analyzeKeywordTrends(periodType),
        this.getAnalysisStats(periodStart, periodEnd),
      ]);

      // Generate AI-powered summary and insights
      const { summary, insights, recommendations } =
        await this.generateAIInsights({
          emergingTopics,
          breakthroughStudies,
          momentumData,
          keywordTrends,
          stats,
        });

      const processingTime = Date.now() - startTime;

      return {
        analysisType: "comprehensive",
        periodType,
        periodStart,
        periodEnd,
        emergingTopics: JSON.stringify(emergingTopics),
        breakthroughStudies: JSON.stringify(breakthroughStudies),
        momentumData: JSON.stringify(momentumData),
        keywordTrends: JSON.stringify(keywordTrends),
        citationPatterns: JSON.stringify({}), // Placeholder for future citation network analysis
        summary,
        insights,
        recommendations,
        totalStudiesAnalyzed: stats.totalStudies,
        newStudiesCount: stats.newStudies,
        avgCitationCount: stats.avgCitations,
        topResearchAreas: stats.topAreas,
        status: "completed",
      } as any;
    } catch (error) {
      console.error("Error generating trend report:", error);
      return {
        analysisType: "comprehensive",
        periodType,
        periodStart,
        periodEnd,
        status: "failed",
        errorMessage: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Create trend alerts based on analysis
   */
  async createTrendAlerts(
    analysisId: number,
    analysis: any,
  ): Promise<InsertTrendAlert[]> {
    const alerts: InsertTrendAlert[] = [];

    // Parse analysis data
    const emergingTopics = JSON.parse(analysis.emergingTopics || "[]");
    const breakthroughStudies = JSON.parse(
      analysis.breakthroughStudies || "[]",
    );
    const momentumData = JSON.parse(analysis.momentumData || "{}");

    // Alert for high-significance emerging topics
    for (const topic of emergingTopics.filter(
      (t: any) => t.significance === "high",
    )) {
      alerts.push({
        trendAnalysisId: analysisId,
        alertType: "emerging_topic",
        alertLevel: "warning",
        title: `Emerging Research Topic: ${topic.topic}`,
        message: `${topic.topic} has shown ${topic.growthRate.toFixed(1)}% growth with ${topic.count} new studies. This represents a significant emerging trend in hydrogen research.`,
        relatedStudies: topic.studyIds.map(String),
        actionRequired: true,
      });
    }

    // Alert for breakthrough studies
    for (const study of breakthroughStudies.slice(0, 3)) {
      alerts.push({
        trendAnalysisId: analysisId,
        alertType: "breakthrough",
        alertLevel: "critical",
        title: `Breakthrough Study Detected`,
        message: `"${study.title}" has achieved an impact score of ${study.impactScore}. ${study.reasonForBreakthrough}`,
        relatedStudies: [String(study.studyId)],
        actionRequired: true,
      });
    }

    // Alert for significant momentum shifts
    for (const area of momentumData.accelerating?.slice(0, 3) || []) {
      if (area.percentageChange >= 50) {
        alerts.push({
          trendAnalysisId: analysisId,
          alertType: "momentum_shift",
          alertLevel: "info",
          title: `Rapid Growth in ${area.area}`,
          message: `Research in ${area.area} has accelerated by ${area.percentageChange.toFixed(1)}% with ${area.currentActivity} new studies.`,
          relatedStudies: area.studyIds.map(String),
          actionRequired: false,
        });
      }
    }

    return alerts;
  }

  // Helper methods

  private async getKeywordFrequencies(
    startDate: Date,
    endDate: Date,
  ): Promise<Record<string, { count: number; studyIds: number[] }>> {
    // Get studies with their tags from the period
    const studiesWithTags = await db
      .select({
        studyId: studyTags.studyId,
        tagName: tags.name,
      })
      .from(studyTags)
      .innerJoin(tags, eq(studyTags.tagId, tags.id))
      .innerJoin(studies, eq(studyTags.studyId, studies.id))
      .where(
        and(sql`${effectiveDate} >= ${startDate.toISOString()}`, sql`${effectiveDate} <= ${endDate.toISOString()}`),
      );

    // Count keyword frequencies
    const frequencies: Record<string, { count: number; studyIds: number[] }> =
      {};

    for (const { tagName, studyId } of studiesWithTags) {
      if (!frequencies[tagName]) {
        frequencies[tagName] = { count: 0, studyIds: [] };
      }
      frequencies[tagName].count++;
      if (!frequencies[tagName].studyIds.includes(studyId)) {
        frequencies[tagName].studyIds.push(studyId);
      }
    }

    return frequencies;
  }

  private async getRelatedKeywords(keyword: string): Promise<string[]> {
    // Get studies that have this keyword
    const relatedTags = await db
      .select({
        tagName: tags.name,
      })
      .from(tags)
      .innerJoin(studyTags, eq(tags.id, studyTags.tagId))
      .innerJoin(
        db
          .select({ studyId: studyTags.studyId })
          .from(studyTags)
          .innerJoin(tags, eq(studyTags.tagId, tags.id))
          .where(eq(tags.name, keyword))
          .as("related_studies"),
        eq(studyTags.studyId, sql`related_studies.study_id`),
      )
      .where(sql`${tags.name} != ${keyword}`)
      .limit(5);

    return relatedTags.map((t) => t.tagName);
  }

  private calculateSignificance(
    count: number,
    growthRate: number,
  ): "high" | "medium" | "low" {
    if (count >= 10 && growthRate >= 100) return "high";
    if (count >= 5 && growthRate >= 50) return "medium";
    return "low";
  }

  private calculateImpactScore(metrics: {
    citationCount: number;
    viewCount: number;
    recency: number;
  }): number {
    // Weighted impact score calculation
    const citationWeight = 0.4;
    const viewWeight = 0.3;
    const recencyWeight = 0.3;

    // Normalize values (0-100 scale)
    const normalizedCitations = Math.min(metrics.citationCount * 2, 100);
    const normalizedViews = Math.min(metrics.viewCount / 10, 100);

    return Math.round(
      normalizedCitations * citationWeight +
        normalizedViews * viewWeight +
        metrics.recency * recencyWeight,
    );
  }

  private getRecencyScore(publishDate: string): number {
    if (!publishDate) return 50;

    const date = new Date(publishDate);
    const now = new Date();
    const daysDiff = (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24);

    if (daysDiff <= 7) return 100;
    if (daysDiff <= 30) return 80;
    if (daysDiff <= 90) return 60;
    if (daysDiff <= 180) return 40;
    return 20;
  }

  private async analyzeBreakthroughReason(study: any): Promise<string> {
    if (ai.getProviderStatus().primary === "none") {
      return "High impact study based on citation and view metrics.";
    }

    try {
      const systemPrompt = "You are an expert in hydrogen research analysis. Analyze why a study is considered a breakthrough in 1-2 sentences.";

      const userPrompt = `Based on this study's metrics and abstract, explain why it's a breakthrough:
            Title: ${study.title}
            Citations: ${study.citationCount}
            Views: ${study.viewCount}
            Abstract: ${study.abstract?.substring(0, 500)}`;

      const response = await ai.generateText(systemPrompt, userPrompt, {
        maxTokens: 100,
        temperature: 0.7,
        model: "claude-haiku-4-5-20251001",
      });

      return (
        response ||
        "High impact study with significant research implications."
      );
    } catch (error) {
      console.error("Error analyzing breakthrough reason:", error);
      return "High impact study based on citation and view metrics.";
    }
  }

  private async getCategoryActivity(
    startDate: Date,
    endDate: Date,
  ): Promise<Record<string, { count: number; studyIds: number[] }>> {
    const categoryStudies = await db
      .select({
        category: studies.category,
        studyId: studies.id,
      })
      .from(studies)
      .where(
        and(sql`${effectiveDate} >= ${startDate.toISOString()}`, sql`${effectiveDate} <= ${endDate.toISOString()}`),
      );

    const activity: Record<string, { count: number; studyIds: number[] }> = {};

    for (const { category, studyId } of categoryStudies) {
      if (!activity[category]) {
        activity[category] = { count: 0, studyIds: [] };
      }
      activity[category].count++;
      activity[category].studyIds.push(studyId);
    }

    return activity;
  }

  private async getAnalysisStats(startDate: Date, endDate: Date) {
    const [totalResult, avgCitResult, topCategories] = await Promise.all([
      db
        .select({ count: count() })
        .from(studies)
        .where(
          and(
            gte(studies.createdAt, startDate),
            lte(studies.createdAt, endDate),
          ),
        ),
      db
        .select({ avg: avg(studies.citationCount) })
        .from(studies)
        .where(
          and(
            gte(studies.createdAt, startDate),
            lte(studies.createdAt, endDate),
          ),
        ),
      db
        .select({
          category: studies.category,
          count: count(),
        })
        .from(studies)
        .where(
          and(
            gte(studies.createdAt, startDate),
            lte(studies.createdAt, endDate),
          ),
        )
        .groupBy(studies.category)
        .orderBy(desc(count()))
        .limit(5),
    ]);

    return {
      totalStudies: totalResult[0]?.count || 0,
      newStudies: totalResult[0]?.count || 0,
      avgCitations: Math.round(Number(avgCitResult[0]?.avg) || 0),
      topAreas: topCategories.map((c) => c.category),
    };
  }

  private async generateAIInsights(data: any): Promise<{
    summary: string;
    insights: string[];
    recommendations: string[];
  }> {
    if (ai.getProviderStatus().primary === "none") {
      return {
        summary: `Analysis of ${data.stats.totalStudies} studies revealed ${data.emergingTopics.length} emerging topics and ${data.breakthroughStudies.length} breakthrough studies.`,
        insights: [
          `Top emerging topic: ${data.emergingTopics[0]?.topic || "N/A"}`,
          `Most accelerating area: ${data.momentumData.accelerating[0]?.area || "N/A"}`,
          `Highest impact study detected with score: ${data.breakthroughStudies[0]?.impactScore || 0}`,
        ],
        recommendations: [
          "Focus content creation on emerging topics",
          "Highlight breakthrough studies in featured sections",
          "Monitor declining areas for potential opportunities",
        ],
      };
    }

    try {
      const systemPrompt = "You are an expert analyst for hydrogen research trends. Provide concise, actionable insights.";

      const userPrompt = `Analyze this trend data and provide a summary, 3 key insights, and 3 recommendations:

            Emerging Topics (top 3): ${data.emergingTopics
              .slice(0, 3)
              .map((t: any) => `${t.topic} (+${t.growthRate.toFixed(0)}%)`)
              .join(", ")}
            Breakthrough Studies: ${data.breakthroughStudies.length} identified
            Accelerating Areas: ${data.momentumData.accelerating
              .slice(0, 3)
              .map((a: any) => a.area)
              .join(", ")}
            Declining Areas: ${data.momentumData.declining
              .slice(0, 3)
              .map((a: any) => a.area)
              .join(", ")}
            Total Studies Analyzed: ${data.stats.totalStudies}
            Average Citations: ${data.stats.avgCitations}`;

      const aiResponse = await ai.generateText(systemPrompt, userPrompt, {
        maxTokens: 500,
        temperature: 0.7,
        model: "claude-haiku-4-5-20251001",
      });

      const responseText = aiResponse || "";
      const lines = responseText.split("\n").filter((line) => line.trim());

      // Parse AI response into structured format
      const summaryIndex = lines.findIndex((line) =>
        line.toLowerCase().includes("summary"),
      );
      const insightsIndex = lines.findIndex((line) =>
        line.toLowerCase().includes("insight"),
      );
      const recommendationsIndex = lines.findIndex((line) =>
        line.toLowerCase().includes("recommendation"),
      );

      return {
        summary:
          lines[summaryIndex + 1] ||
          lines[0] ||
          "Trend analysis completed successfully.",
        insights: lines
          .slice(insightsIndex + 1, recommendationsIndex)
          .filter((line) => line.trim()) || [
          "Significant growth detected in emerging research areas",
          "High-impact studies showing breakthrough potential",
          "Research momentum shifting towards practical applications",
        ],
        recommendations: lines
          .slice(recommendationsIndex + 1)
          .filter((line) => line.trim()) || [
          "Increase coverage of emerging topics",
          "Feature breakthrough studies prominently",
          "Create targeted content for accelerating areas",
        ],
      };
    } catch (error) {
      console.error("Error generating AI insights:", error);
      return {
        summary: `Analysis completed for ${data.stats.totalStudies} studies with ${data.emergingTopics.length} emerging topics identified.`,
        insights: [
          `Leading emerging topic: ${data.emergingTopics[0]?.topic || "N/A"} with ${data.emergingTopics[0]?.growthRate.toFixed(0)}% growth`,
          `${data.breakthroughStudies.length} breakthrough studies detected with high impact scores`,
          `Research momentum strongest in: ${data.momentumData.accelerating[0]?.area || "N/A"}`,
        ],
        recommendations: [
          "Prioritize content creation around emerging topics",
          "Showcase breakthrough studies to highlight innovation",
          "Monitor and report on accelerating research areas",
        ],
      };
    }
  }

  /**
   * Track user search queries
   */
  async trackSearchQuery(
    query: string,
    userId?: string,
    results?: any[],
    clickedIds?: number[],
  ) {
    try {
      await db.insert(searchQueries).values({
        query,
        userId,
        resultsCount: results?.length || 0,
        clickedResults: clickedIds?.map(String) || [],
        searchType: "basic",
        sessionId: `session_${Date.now()}`,
      });
    } catch (error) {
      console.error("Error tracking search query:", error);
    }
  }

  /**
   * Track study metrics
   */
  async trackStudyMetrics(
    studyId: number,
    metrics: Partial<InsertStudyMetrics>,
  ) {
    try {
      await db.insert(studyMetrics).values({
        studyId,
        date: new Date(),
        ...metrics,
      });
    } catch (error) {
      console.error("Error tracking study metrics:", error);
    }
  }

  /**
   * Get popular search queries
   */
  async getPopularSearchQueries(
    limit: number = 10,
  ): Promise<{ query: string; count: number }[]> {
    const queries = await db
      .select({
        query: searchQueries.query,
        count: count(),
      })
      .from(searchQueries)
      .groupBy(searchQueries.query)
      .orderBy(desc(count()))
      .limit(limit);

    return queries;
  }

  /**
   * Run scheduled trend analysis
   */
  async runScheduledAnalysis(
    periodType: "weekly" | "monthly" | "quarterly" = "weekly",
  ) {
    console.log(`Starting scheduled ${periodType} trend analysis...`);

    // Generate the trend report
    const report = await this.generateTrendReport(periodType);

    // Save to database
    const [savedAnalysis] = await db
      .insert(trendAnalysis)
      .values(report)
      .returning();

    // Create alerts
    const alerts = await this.createTrendAlerts(
      savedAnalysis.id,
      savedAnalysis,
    );
    if (alerts.length > 0) {
      await db.insert(trendAlerts).values(alerts);
    }

    console.log(`Trend analysis completed. ${alerts.length} alerts created.`);

    return savedAnalysis;
  }
}

// Export singleton instance
export const trendDetectionService = new TrendDetectionService();
