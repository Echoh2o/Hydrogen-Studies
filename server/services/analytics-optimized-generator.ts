/**
 * Analytics-Optimized Content Generator
 * Uses performance data to inform and optimize content generation
 */

import OpenAI from "openai";
import {
  contentAnalyticsService,
  ContentType,
} from "./content-analytics-service";
import { db } from "../db";
import {
  studies,
  blogArticles,
  scientificArticles,
  contentInsights,
  Study,
  InsertBlogArticle,
} from "@shared/schema";
import { eq, desc, sql, and, gte } from "drizzle-orm";
import { withRetry } from "../utils/database-wrapper";
import { AppError, ErrorCode } from "../utils/app-errors";
import slugify from "slugify";

interface OptimizationData {
  headlinePatterns: string[];
  optimalLength: number;
  bestKeywords: string[];
  bestTags: string[];
  topPerformingTopics: string[];
  optimalPublishTime?: string;
  engagementTriggers: string[];
  readingLevel: number;
}

interface GenerationOptions {
  useAnalytics: boolean;
  abTestVariant?: string;
  targetAudience?: string;
  optimizeFor?: "engagement" | "shares" | "conversion";
}

class AnalyticsOptimizedGenerator {
  private openai: OpenAI | null;

  constructor() {
    this.openai = this.initializeOpenAI();
  }

  private initializeOpenAI(): OpenAI | null {
    if (!process.env.OPENAI_API_KEY) {
      console.warn("OpenAI API key not configured");
      return null;
    }

    try {
      return new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
        timeout: 30000,
        maxRetries: 2,
      });
    } catch (error) {
      console.error("Failed to initialize OpenAI client:", error);
      return null;
    }
  }

  /**
   * Get optimization data from analytics
   */
  async getOptimizationData(
    contentType: ContentType,
  ): Promise<OptimizationData> {
    try {
      // Get top performing content
      const topContent = await contentAnalyticsService.getTopContent(
        20,
        contentType,
      );

      // Analyze patterns
      const patterns = await this.analyzeContentPatterns(topContent);

      // Get insights from content insights table
      const [latestInsights] = await db
        .select()
        .from(contentInsights)
        .where(eq(contentInsights.contentType, contentType))
        .orderBy(desc(contentInsights.createdAt))
        .limit(5);

      return {
        headlinePatterns: patterns.headlines,
        optimalLength: patterns.avgLength || 800,
        bestKeywords: latestInsights?.bestKeywords || [],
        bestTags: latestInsights?.bestTags || [],
        topPerformingTopics: patterns.topics,
        optimalPublishTime: latestInsights?.optimalPublishTime,
        engagementTriggers: patterns.triggers,
        readingLevel: latestInsights?.readingLevel || 8,
      };
    } catch (error) {
      console.error("Error getting optimization data:", error);
      // Return defaults if analytics fail
      return {
        headlinePatterns: [],
        optimalLength: 800,
        bestKeywords: [],
        bestTags: [],
        topPerformingTopics: [],
        engagementTriggers: [],
        readingLevel: 8,
      };
    }
  }

  /**
   * Generate optimized blog article
   */
  async generateOptimizedBlogArticle(
    study: Study,
    articleType: string,
    options: GenerationOptions = { useAnalytics: true },
  ): Promise<InsertBlogArticle> {
    let optimizationData: OptimizationData | null = null;

    if (options.useAnalytics) {
      optimizationData = await this.getOptimizationData(ContentType.BLOG);
    }

    // Generate content with optimization hints
    const content = await this.generateOptimizedContent(
      study,
      articleType,
      optimizationData,
      options,
    );

    // Generate optimized title
    const title = await this.generateOptimizedTitle(
      study,
      articleType,
      optimizationData,
    );

    // Create A/B test variant if requested
    const abTestData = options.abTestVariant
      ? {
          abTestVersion: options.abTestVariant,
          abTestMetrics: JSON.stringify({
            testId: `blog_${study.id}_${Date.now()}`,
            variant: options.abTestVariant,
            optimizationApplied: !!optimizationData,
          }),
        }
      : {};

    const slug =
      slugify(title, { lower: true, strict: true }) + "-" + Date.now();

    return {
      title,
      slug,
      studyId: study.id,
      content: content.fullContent,
      summary: content.summary,
      category: study.category || "General Health",
      tags: optimizationData?.bestTags || [],
      keywords: optimizationData?.bestKeywords || [],
      articleType,
      metaDescription: content.summary.substring(0, 160),
      readingTime: Math.ceil(content.fullContent.split(" ").length / 200),
      isPublished: false,
      ...abTestData,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  /**
   * Generate content optimized based on analytics
   */
  private async generateOptimizedContent(
    study: Study,
    articleType: string,
    optimizationData: OptimizationData | null,
    options: GenerationOptions,
  ): Promise<{ fullContent: string; summary: string }> {
    if (!this.openai) {
      return this.generateFallbackContent(study, articleType);
    }

    const systemPrompt = this.buildOptimizedSystemPrompt(
      optimizationData,
      options,
    );
    const userPrompt = this.buildOptimizedUserPrompt(
      study,
      articleType,
      optimizationData,
    );

    try {
      const response = await this.openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        max_tokens: 2500,
        temperature: 0.7,
      });

      const content = response.choices[0]?.message?.content || "";

      // Parse summary from content
      const summaryMatch = content.match(/SUMMARY:(.*?)(?=\n\n|\z)/s);
      const summary = summaryMatch
        ? summaryMatch[1].trim()
        : content.substring(0, 200);

      const fullContent = content.replace(/SUMMARY:.*?(?=\n\n|\z)/s, "").trim();

      return { fullContent, summary };
    } catch (error) {
      console.error("Error generating optimized content:", error);
      return this.generateFallbackContent(study, articleType);
    }
  }

  /**
   * Build optimized system prompt based on analytics
   */
  private buildOptimizedSystemPrompt(
    optimizationData: OptimizationData | null,
    options: GenerationOptions,
  ): string {
    let prompt = `You are an expert content writer specializing in hydrogen therapy research. `;

    if (optimizationData) {
      prompt += `Based on performance analytics, follow these optimization guidelines:\n`;

      if (optimizationData.readingLevel) {
        prompt += `- Write at a ${this.getReadingLevelDescription(optimizationData.readingLevel)} reading level\n`;
      }

      if (optimizationData.optimalLength) {
        prompt += `- Target content length: ${optimizationData.optimalLength} words (±10%)\n`;
      }

      if (optimizationData.engagementTriggers.length > 0) {
        prompt += `- Include these engagement triggers: ${optimizationData.engagementTriggers.join(", ")}\n`;
      }

      if (options.optimizeFor) {
        const optimizationGoals = {
          engagement: "maximize time spent reading and scroll depth",
          shares: "include shareable insights and quotable statements",
          conversion:
            "include clear calls-to-action and related content suggestions",
        };
        prompt += `- Optimize for: ${optimizationGoals[options.optimizeFor]}\n`;
      }
    }

    prompt += `\nAlways start your response with "SUMMARY:" followed by a 2-3 sentence summary, then provide the full article content.`;

    return prompt;
  }

  /**
   * Build optimized user prompt
   */
  private buildOptimizedUserPrompt(
    study: Study,
    articleType: string,
    optimizationData: OptimizationData | null,
  ): string {
    let prompt = `Write a ${articleType} article about this hydrogen therapy study:\n\n`;
    prompt += `Title: ${study.title}\n`;
    prompt += `Abstract: ${study.abstract}\n`;

    if (optimizationData) {
      if (optimizationData.bestKeywords.length > 0) {
        prompt += `\nInclude these high-performing keywords naturally: ${optimizationData.bestKeywords.slice(0, 5).join(", ")}\n`;
      }

      if (optimizationData.topPerformingTopics.length > 0) {
        prompt += `Focus on these engaging topics: ${optimizationData.topPerformingTopics.slice(0, 3).join(", ")}\n`;
      }
    }

    return prompt;
  }

  /**
   * Generate optimized title based on analytics
   */
  private async generateOptimizedTitle(
    study: Study,
    articleType: string,
    optimizationData: OptimizationData | null,
  ): Promise<string> {
    if (!this.openai) {
      return this.generateBasicTitle(study, articleType);
    }

    let prompt = `Generate an engaging title for a ${articleType} article about: ${study.title}\n`;

    if (optimizationData && optimizationData.headlinePatterns.length > 0) {
      prompt += `\nUse these successful headline patterns:\n`;
      optimizationData.headlinePatterns.slice(0, 3).forEach((pattern) => {
        prompt += `- ${pattern}\n`;
      });
    }

    try {
      const response = await this.openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content:
              "Generate engaging, SEO-friendly titles. Keep titles between 50-60 characters when possible.",
          },
          { role: "user", content: prompt },
        ],
        max_tokens: 50,
        temperature: 0.8,
      });

      return (
        response.choices[0]?.message?.content?.trim() ||
        this.generateBasicTitle(study, articleType)
      );
    } catch (error) {
      return this.generateBasicTitle(study, articleType);
    }
  }

  /**
   * Analyze content patterns from top performing content
   */
  private async analyzeContentPatterns(topContent: any[]): Promise<any> {
    const patterns = {
      headlines: [] as string[],
      avgLength: 0,
      topics: [] as string[],
      triggers: [] as string[],
    };

    if (topContent.length === 0) return patterns;

    // Analyze headline patterns
    const headlines = topContent
      .filter((c) => c.content?.title)
      .map((c) => c.content.title);

    // Identify common patterns
    if (headlines.some((h) => h.includes("How"))) {
      patterns.headlines.push("How to [benefit/action]");
    }
    if (headlines.some((h) => /\d+/.test(h))) {
      patterns.headlines.push("[Number] Ways/Tips/Benefits");
    }
    if (headlines.some((h) => h.includes("?"))) {
      patterns.headlines.push("Question-based headlines");
    }

    // Calculate average content length
    const lengths = topContent
      .filter((c) => c.content?.content)
      .map((c) => c.content.content.split(" ").length);

    if (lengths.length > 0) {
      patterns.avgLength = Math.round(
        lengths.reduce((a, b) => a + b, 0) / lengths.length,
      );
    }

    // Identify engagement triggers
    if (topContent.some((c) => c.shareCount > c.viewCount * 0.05)) {
      patterns.triggers.push("shareable insights");
    }
    if (topContent.some((c) => c.avgTimeSpent > 180)) {
      patterns.triggers.push("compelling storytelling");
    }
    if (topContent.some((c) => c.conversionRate > 30)) {
      patterns.triggers.push("clear next steps");
    }

    return patterns;
  }

  /**
   * Get reading level description
   */
  private getReadingLevelDescription(level: number): string {
    if (level <= 6) return "elementary (simple words, short sentences)";
    if (level <= 8)
      return "middle school (clear explanations, accessible language)";
    if (level <= 10)
      return "high school (some technical terms with explanations)";
    return "college (professional tone, technical accuracy)";
  }

  /**
   * Generate basic title fallback
   */
  private generateBasicTitle(study: Study, articleType: string): string {
    const typeLabels: Record<string, string> = {
      overview: "Understanding",
      practical_application: "Practical Guide:",
      comparison: "Comparing",
      simplified: "Simple Explanation:",
      benefits_focused: "Benefits of",
      how_to_guide: "How to Apply",
      tips: "Tips from",
    };

    const prefix = typeLabels[articleType] || "Exploring";
    const shortTitle = study.title.substring(0, 60);
    return `${prefix} ${shortTitle}`;
  }

  /**
   * Generate fallback content
   */
  private generateFallbackContent(
    study: Study,
    articleType: string,
  ): { fullContent: string; summary: string } {
    const summary = `This article explores the findings of a hydrogen therapy study: "${study.title}". 
                     The research investigates ${study.abstract.substring(0, 100)}...`;

    const fullContent = `
# ${study.title}

## Overview
${study.abstract}

## Key Findings
${study.results || "Results pending detailed analysis."}

## Conclusions
${study.conclusion || "This research contributes to our understanding of hydrogen therapy applications."}

## Practical Applications
Based on this research, hydrogen therapy shows promise for various health applications. 
Consult with healthcare providers before starting any new therapy.

## Further Reading
For more information on hydrogen therapy research, explore related studies in our database.
    `.trim();

    return { fullContent, summary };
  }

  /**
   * Track content performance after generation
   */
  async trackGeneratedContent(
    contentType: ContentType,
    contentId: number,
    generationMetadata: any,
  ): Promise<void> {
    try {
      // Store generation metadata for later analysis
      await db.insert(contentInsights).values({
        contentType,
        contentId,
        headlinePattern: generationMetadata.headlinePattern,
        optimalLength: generationMetadata.targetLength,
        bestKeywords: generationMetadata.keywords,
        bestTags: generationMetadata.tags,
        predictedEngagement: generationMetadata.predictedScore || 50,
        confidenceScore: generationMetadata.confidence || 70,
      });
    } catch (error) {
      console.error("Error tracking generated content:", error);
    }
  }

  /**
   * Run A/B test for content variations
   */
  async createABTestVariations(
    study: Study,
    articleType: string,
  ): Promise<InsertBlogArticle[]> {
    const variations: InsertBlogArticle[] = [];

    // Variant A: Standard generation
    const variantA = await this.generateOptimizedBlogArticle(
      study,
      articleType,
      {
        useAnalytics: false,
        abTestVariant: "control",
      },
    );
    variations.push(variantA);

    // Variant B: Analytics-optimized
    const variantB = await this.generateOptimizedBlogArticle(
      study,
      articleType,
      {
        useAnalytics: true,
        abTestVariant: "optimized",
        optimizeFor: "engagement",
      },
    );
    variations.push(variantB);

    // Variant C: Share-optimized
    const variantC = await this.generateOptimizedBlogArticle(
      study,
      articleType,
      {
        useAnalytics: true,
        abTestVariant: "share_optimized",
        optimizeFor: "shares",
      },
    );
    variations.push(variantC);

    return variations;
  }

  /**
   * Get content recommendations based on gaps
   */
  async getContentGapRecommendations(limit: number = 5): Promise<any[]> {
    try {
      // Analyze what content types and topics are underrepresented
      const contentGaps = await db.execute(sql`
        SELECT 
          s.category,
          COUNT(DISTINCT s.id) as study_count,
          COUNT(DISTINCT b.id) as blog_count,
          AVG(ca.view_count) as avg_views
        FROM studies s
        LEFT JOIN blog_articles b ON b.study_id = s.id
        LEFT JOIN content_analytics ca ON ca.content_type = 'study' AND ca.content_id = s.id
        GROUP BY s.category
        HAVING COUNT(DISTINCT b.id) < COUNT(DISTINCT s.id) * 0.5
        ORDER BY avg_views DESC
        LIMIT ${limit}
      `);

      return contentGaps.rows.map((gap: any) => ({
        category: gap.category,
        opportunity: `Create more blog content for ${gap.category}`,
        potentialViews: gap.avg_views || 100,
        priority: gap.study_count > 10 ? "high" : "medium",
      }));
    } catch (error) {
      console.error("Error getting content gap recommendations:", error);
      return [];
    }
  }
}

// Export singleton instance
export const analyticsOptimizedGenerator = new AnalyticsOptimizedGenerator();
