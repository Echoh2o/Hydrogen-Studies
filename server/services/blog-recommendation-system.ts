/**
 * Blog Article Recommendation System
 * Automatically recommends studies for blog creation and handles bulk generation
 */

import { eq, desc, sql } from "drizzle-orm";
import { db } from "../db";
import { studies, blogArticles, studyQualityScores } from "@shared/schema";
import { ai } from "./ai-provider";
import { logger } from "../utils/logger";

export interface BlogRecommendation {
  studyId: number;
  studyTitle: string;
  studyAbstract: string;
  studyAuthors: string;
  studyJournal: string;
  studyCategory: string;
  studyPublishDate: string;
  priority: "high" | "medium" | "low";
  reasonForRecommendation: string;
  suggestedBlogTypes: string[];
  estimatedReadership: string;
  seoKeywords: string[];
  potentialTitle: string;
  hasExistingBlogs: boolean;
  existingBlogCount: number;
  /** Overall quality score from study_quality_scores (0–100). Null if unscored. */
  qualityScore: number | null;
  /** How underserved this study's category is (0–1). Higher = more content-gap opportunity. */
  categoryGapScore: number;
  /** Normalized 30-day GSC impressions for this study's category (0–1). 0 when GSC isn't connected. */
  gscOpportunityScore: number;
  /** Raw category-level GSC impressions over the past 30 days. Surfaced for the UI tooltip. */
  categoryGscImpressions30d: number;
  /** Composite rank score — what the sort actually uses. Higher = better candidate. */
  rankScore: number;
}

export interface BulkGenerationRequest {
  selectedStudyIds: number[];
  articleTypes: string[];
  readingLevel: string;
  includeImages: boolean;
  includeSEO: boolean;
}

export interface GeneratedBlogContent {
  title: string;
  slug: string;
  summary: string;
  content: string;
  articleType: string;
  readingLevel: string;
  imagePrompt?: string;
  imageUrl?: string;
  imageAlt?: string;
  seoTitle?: string;
  seoDescription?: string;
  tags?: string[];
  keywords?: string[];
}

export interface BulkGenerationResult {
  studyId: number;
  studyTitle: string;
  generatedBlogs: GeneratedBlogContent[];
  success: boolean;
  error?: string;
}

/**
 * Get blog article recommendations, ranked by a composite score that combines:
 *   • Quality of the study (study_quality_scores.overallScore)
 *   • Content-gap signal — how underserved this study's category is
 *   • Existing blog coverage (fewer existing articles → higher priority)
 *   • Study recency
 *
 * The old implementation hardcoded blogCount to 0 and ranked by recency alone,
 * which meant high-interest determinations were essentially keyword-matching
 * against the abstract. The new ranker gives real signal and surfaces studies
 * that are both *high-quality* and *underserved*.
 */
export async function getBlogRecommendations(
  limit: number = 20,
): Promise<BlogRecommendation[]> {
  try {
    // Candidate pool: pull more than we'll return so scoring has room to pick.
    // Cap at 150 to stay fast — re-ranking N>>limit adds almost no value once
    // we've filtered on blog-count and quality.
    const POOL_SIZE = Math.max(limit * 5, 80);

    // 1. Fetch candidate studies + their blog count + their quality score in
    //    a single round-trip. Prefers studies with < 3 existing blogs; within
    //    that set, orders by quality so we don't waste candidates.
    const rows = await db.execute<{
      id: number;
      title: string;
      abstract: string;
      authors: string;
      journal: string;
      category: string;
      publish_date: string | null;
      journal_publish_date: string | null;
      view_count: number | null;
      citation_count: number | null;
      blog_count: number;
      overall_score: number | null;
      red_flag_count: number | null;
    }>(sql`
      SELECT
        s.id, s.title, s.abstract, s.authors, s.journal, s.category,
        s.publish_date, s.journal_publish_date, s.view_count, s.citation_count,
        COALESCE(b.cnt, 0)::int AS blog_count,
        q.overall_score,
        q.red_flag_count
      FROM ${studies} s
      LEFT JOIN (
        SELECT study_id, COUNT(*)::int AS cnt
        FROM ${blogArticles}
        GROUP BY study_id
      ) b ON b.study_id = s.id
      LEFT JOIN ${studyQualityScores} q ON q.study_id = s.id
      WHERE COALESCE(b.cnt, 0) < 3
      ORDER BY
        -- studies with no blogs yet first, then by quality, then recency
        CASE WHEN COALESCE(b.cnt, 0) = 0 THEN 0 ELSE 1 END,
        q.overall_score DESC NULLS LAST,
        s.id DESC
      LIMIT ${POOL_SIZE}
    `);

    const candidates = ((rows as any).rows ?? rows) as any[];
    if (candidates.length === 0) return [];

    // 2. Content-gap analysis — for every category represented in the pool,
    //    compute a `gap` = 1 - (blog_articles / studies). A category with
    //    lots of studies but few articles scores high.
    const categoryStats = await db.execute<{
      category: string;
      study_count: number;
      blog_count: number;
    }>(sql`
      SELECT
        COALESCE(s.category, 'General') AS category,
        COUNT(DISTINCT s.id)::int AS study_count,
        COUNT(DISTINCT b.id)::int AS blog_count
      FROM ${studies} s
      LEFT JOIN ${blogArticles} b ON b.study_id = s.id
      GROUP BY COALESCE(s.category, 'General')
      HAVING COUNT(DISTINCT s.id) >= 2
    `);

    const gapByCategory = new Map<string, number>();
    const statsRows = ((categoryStats as any).rows ?? categoryStats) as any[];
    for (const r of statsRows) {
      const studyCount = Number(r.study_count) || 0;
      const blogCount = Number(r.blog_count) || 0;
      // Gap: 1 means 0 blogs for N studies (max opportunity). 0 means saturated.
      const gap = studyCount > 0 ? Math.max(0, 1 - blogCount / (studyCount * 1.5)) : 0;
      gapByCategory.set(String(r.category), gap);
    }

    // 2.5 GSC opportunity per category — sum 30-day impressions across all
    //     existing blogs whose study lives in that category. High impressions
    //     mean the topic is pulling search traffic; combined with categoryGap
    //     this surfaces "topic Google likes that you haven't fully covered."
    //     Wrapped in try/catch so a missing gsc_query_metrics table (fresh
    //     deploy / GSC not connected) just zeroes the component out, leaving
    //     the rest of the algorithm intact.
    const gscImpressionsByCategory = new Map<string, number>();
    let maxCategoryGscImpressions = 0;
    try {
      const gscRows: any = await db.execute(sql`
        SELECT
          COALESCE(s.category, 'General') AS category,
          COALESCE(SUM(g.impressions), 0)::int AS impressions
        FROM gsc_query_metrics g
        INNER JOIN ${blogArticles} b
          ON REGEXP_REPLACE(g.page, '^https?://[^/]+', '') = '/blog/' || b.slug
        INNER JOIN ${studies} s ON s.id = b.study_id
        WHERE g.date >= TO_CHAR(CURRENT_DATE - INTERVAL '30 days', 'YYYY-MM-DD')
        GROUP BY COALESCE(s.category, 'General')
      `);
      for (const r of (gscRows.rows ?? gscRows) as any[]) {
        const impressions = Number(r.impressions) || 0;
        gscImpressionsByCategory.set(String(r.category), impressions);
        if (impressions > maxCategoryGscImpressions) maxCategoryGscImpressions = impressions;
      }
    } catch (gscErr) {
      logger.warn(
        "Recommendation: GSC enrichment unavailable, falling back to no GSC component",
        "BlogRecommendationSystem",
        { error: gscErr instanceof Error ? gscErr.message : String(gscErr) },
      );
    }

    // 3. Score every candidate with a composite rank
    const recommendations: BlogRecommendation[] = candidates.map((c) => {
      const blogCount = Number(c.blog_count) || 0;
      const qualityScore = c.overall_score != null ? Number(c.overall_score) : null;
      const categoryKey = c.category || "General";
      const categoryGap = gapByCategory.get(categoryKey) ?? 0.5;

      // Composite rank — tuneable weights. Each component is 0–1 and summed;
      // then we reuse the result as both the rank number and the ordered tier.
      //
      //   • Quality (35%): good science deserves coverage. Treated as 0.5 if
      //     the study hasn't been scored yet (neutral prior, not penalised).
      //   • Category gap (25%): fill editorial blind spots first.
      //   • Coverage (20%): 1.0 if no existing blogs, 0 if ≥3.
      //   • Recency (10%): linear decay over 3 years from publish date.
      //   • GSC opportunity (10%): how much 30-day search demand exists in
      //     this category. Normalized to [0,1] across the candidate pool —
      //     the noisiest category in the pool gets 1.0, others scale down.
      //     Falls back to 0 (no influence) when GSC isn't connected, so
      //     pre-GSC behavior is preserved on the rest of the formula.
      //
      // Red flags are a deliberate quality discount — a 90-score study with 2
      // red flags is no longer a slam-dunk blog candidate.
      const qNormalized = qualityScore != null ? qualityScore / 100 : 0.5;
      const redFlags = Number(c.red_flag_count) || 0;
      const qComponent = Math.max(0, qNormalized - redFlags * 0.05);

      const coverageComponent = blogCount === 0 ? 1 : blogCount === 1 ? 0.5 : 0;

      const publishYear = (() => {
        const d = c.journal_publish_date || c.publish_date;
        if (!d) return null;
        const parsed = new Date(d);
        return isNaN(parsed.getTime()) ? null : parsed.getFullYear();
      })();
      const currentYear = new Date().getFullYear();
      const recencyComponent = publishYear
        ? Math.max(0, 1 - (currentYear - publishYear) / 3)
        : 0;

      const categoryGscImpressions = gscImpressionsByCategory.get(categoryKey) ?? 0;
      const gscComponent =
        maxCategoryGscImpressions > 0
          ? categoryGscImpressions / maxCategoryGscImpressions
          : 0;

      const rankScore =
        qComponent * 0.35 +
        categoryGap * 0.25 +
        coverageComponent * 0.2 +
        recencyComponent * 0.1 +
        gscComponent * 0.1;

      // Priority tier — derived from rankScore so "high" actually means
      // something the algorithm thinks is a strong candidate, not a keyword hit.
      const priority: "high" | "medium" | "low" =
        rankScore >= 0.65 ? "high" : rankScore >= 0.4 ? "medium" : "low";

      // Human-readable "why this is a good candidate" blurb — points at the
      // dominant component so admins trust the recommendation.
      const reasons: string[] = [];
      if (qualityScore != null && qualityScore >= 75) {
        reasons.push(`high quality score (${qualityScore})`);
      } else if (qualityScore == null) {
        reasons.push("not yet scored — will score before generating");
      }
      if (categoryGap >= 0.6) {
        reasons.push(`underserved category (${categoryKey})`);
      }
      if (blogCount === 0) {
        reasons.push("no existing blog coverage");
      } else if (blogCount === 1) {
        reasons.push("only 1 existing blog");
      }
      if (categoryGscImpressions >= 500) {
        const k = categoryGscImpressions >= 1000
          ? `${(categoryGscImpressions / 1000).toFixed(1)}k`
          : categoryGscImpressions.toLocaleString();
        reasons.push(`category pulls ${k} impressions/30d`);
      }
      if (redFlags > 0) {
        reasons.push(`⚠ ${redFlags} red flag${redFlags > 1 ? "s" : ""}`);
      }
      const reason =
        reasons.length > 0
          ? reasons.join(" · ")
          : "General candidate for additional coverage";

      // Article-type suggestions — still rule-of-thumb, will be replaced by
      // the shared type registry from the blog-generate redesign.
      const title = String(c.title || "").toLowerCase();
      const abstract = String(c.abstract || "").toLowerCase();
      const suggestedTypes: string[] = ["science_explainer"];
      if (title.includes("clinical") || abstract.includes("patient")) {
        suggestedTypes.push("practical_guide");
      }
      if (abstract.includes("question") || abstract.includes("commonly")) {
        suggestedTypes.push("faq");
      }

      return {
        studyId: c.id,
        studyTitle: c.title || "Untitled Study",
        studyAbstract: c.abstract || "No abstract available",
        studyAuthors: c.authors || "Unknown authors",
        studyJournal: c.journal || "Unknown journal",
        studyCategory: categoryKey,
        studyPublishDate:
          c.publish_date || c.journal_publish_date || "Unknown date",
        priority,
        reasonForRecommendation: reason,
        suggestedBlogTypes: suggestedTypes,
        estimatedReadership: priority === "high" ? "High" : "Medium",
        seoKeywords: [
          "hydrogen therapy",
          categoryKey,
          "research study",
        ].filter(Boolean),
        potentialTitle: `${String(c.title || "").split(" ").slice(0, 8).join(" ")}`,
        hasExistingBlogs: blogCount > 0,
        existingBlogCount: blogCount,
        qualityScore,
        categoryGapScore: Math.round(categoryGap * 100) / 100,
        gscOpportunityScore: Math.round(gscComponent * 100) / 100,
        categoryGscImpressions30d: categoryGscImpressions,
        rankScore: Math.round(rankScore * 100) / 100,
      };
    });

    // 4. Sort by rankScore desc and return top `limit`
    recommendations.sort((a, b) => b.rankScore - a.rankScore);
    return recommendations.slice(0, limit);
  } catch (error) {
    // Use structured logging (goes to Sentry / log aggregator via logger)
    // so silent "empty recommendation list" states are actually diagnosable.
    logger.error(
      "Error getting blog recommendations",
      error,
      "BlogRecommendationSystem",
    );
    return [];
  }
}

/**
 * Generate multiple blog articles for selected studies
 */
export async function generateBulkBlogs(
  request: BulkGenerationRequest,
): Promise<BulkGenerationResult[]> {
  const results: BulkGenerationResult[] = [];

  for (const studyId of request.selectedStudyIds) {
    try {
      // Get study details - select only existing columns to avoid video_url error
      const [study] = await db
        .select({
          id: studies.id,
          title: studies.title,
          abstract: studies.abstract,
          authors: studies.authors,
          journal: studies.journal,
          category: studies.category,
          publishDate: studies.publishDate,
          journalPublishDate: studies.journalPublishDate,
        })
        .from(studies)
        .where(eq(studies.id, studyId))
        .limit(1);

      if (!study) {
        results.push({
          studyId,
          studyTitle: "Unknown Study",
          generatedBlogs: [],
          success: false,
          error: "Study not found",
        });
        continue;
      }

      const generatedBlogs: GeneratedBlogContent[] = [];

      // Generate blogs for each requested article type
      for (const articleType of request.articleTypes) {
        try {
          const blogContent = await generateSingleBlogContent(
            study,
            articleType,
            request.readingLevel,
            request.includeImages,
            request.includeSEO,
          );

          generatedBlogs.push(blogContent);
        } catch (error) {
          console.error(
            `Error generating ${articleType} blog for study ${studyId}:`,
            error,
          );
        }
      }

      results.push({
        studyId,
        studyTitle: study.title,
        generatedBlogs,
        success: generatedBlogs.length > 0,
        error:
          generatedBlogs.length === 0
            ? "Failed to generate any blog content"
            : undefined,
      });
    } catch (error) {
      console.error(`Error processing study ${studyId}:`, error);
      results.push({
        studyId,
        studyTitle: "Error",
        generatedBlogs: [],
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  return results;
}

/**
 * Generate a single blog article with full content and SEO optimization
 */
async function generateSingleBlogContent(
  study: any,
  articleType: string,
  readingLevel: string,
  includeImages: boolean,
  includeSEO: boolean,
): Promise<GeneratedBlogContent> {
  try {
    // Generate main content with timeout
    const contentPrompt = createContentPrompt(study, articleType, readingLevel);

    const systemPrompt = `You are an expert medical content writer. Write concise, engaging content about hydrogen therapy research.`;

    // Sonnet (wrapper default), not Haiku: this writes a full 600-1,200-word
    // user-facing article — Haiku is for extraction/parsing per the tier
    // policy, and its output here read as noticeably "dumb". 4096 tokens so
    // an 800-1,200-word piece isn't truncated mid-sentence (2048 was too
    // small for the prompt's own spec); 150s race accommodates the provider
    // wrapper's 120s long-form budget.
    const contentResponse = await Promise.race([
      ai.generateText(systemPrompt, contentPrompt, {
        temperature: 0.7,
        maxTokens: 4096,
        caller: "BlogRecommendation.article",
      }),
      new Promise<string>((_, reject) =>
        setTimeout(() => reject(new Error("AI provider timeout")), 150000),
      ),
    ]);

    // No canned fallback: persisting "This is a ${articleType} article about…"
    // boilerplate as if it were the article is exactly the "dumb content" bug.
    // Throw instead — the caller's per-type catch records the failure honestly.
    if (!contentResponse || !contentResponse.trim()) {
      throw new Error("AI returned empty article content");
    }
    const content = contentResponse;

    // Generate optimized metadata quickly
    const baseTitle = `${study.title.split(" ").slice(0, 8).join(" ")}`;
    const slug = baseTitle
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .substring(0, 60);

    const summary = study.abstract
      ? `${study.abstract.substring(0, 150)}...`
      : `New research explores hydrogen therapy applications in ${(study.category || "health").toLowerCase()}.`;

    const result: GeneratedBlogContent = {
      title:
        baseTitle.length > 60 ? baseTitle.substring(0, 60) + "..." : baseTitle,
      slug: slug,
      summary: summary,
      content: content,
      articleType: articleType,
      readingLevel: readingLevel,
    };

    return result;
  } catch (error) {
    console.error("Error generating blog content:", error);
    // Propagate — the caller records the failure per article type. Returning
    // two-sentence template text here used to ship boilerplate as a real
    // "generated" article, which is worse than an honest failure.
    throw error;
  }
}

/**
 * Create content generation prompt based on article type
 */
function createContentPrompt(
  study: any,
  articleType: string,
  readingLevel: string,
): string {
  const baseInfo = `
Study Title: ${study.title}
Abstract: ${study.abstract}
Authors: ${study.authors}
Journal: ${study.journal}
Category: ${study.category}
`;

  const readingLevelInstruction =
    readingLevel === "6th"
      ? "Write at a 6th grade reading level (ages 11-12) using simple words and short sentences."
      : readingLevel === "high-school"
        ? "Write at a high school level (ages 14-18) with moderate complexity."
        : "Write for a general adult audience with accessible but comprehensive language.";

  switch (articleType) {
    case "explainer":
      return `${baseInfo}

Write a comprehensive explainer article (800-1200 words) that breaks down this hydrogen therapy research study. ${readingLevelInstruction}

Structure:
1. Engaging introduction explaining why this research matters
2. What the researchers did (methodology in simple terms)
3. What they discovered (key findings)
4. Why it matters for health and medicine
5. What comes next in research
6. Conclusion with key takeaways

Focus on making complex science accessible while maintaining accuracy.`;

    case "implications":
      return `${baseInfo}

Write an implications article (600-800 words) exploring what this research means for the future. ${readingLevelInstruction}

Focus on:
- Real-world applications
- Impact on current treatments
- Future research directions
- Potential benefits for patients
- Timeline for practical applications`;

    case "benefits":
      return `${baseInfo}

Write a benefits-focused article (500-700 words) highlighting the potential health advantages discovered in this study. ${readingLevelInstruction}

Emphasize:
- Specific health benefits identified
- How these benefits could help people
- Safety considerations
- Comparison to existing treatments
- Who might benefit most`;

    default:
      return `${baseInfo}

Write an informative article about this hydrogen therapy research. ${readingLevelInstruction}

Make it engaging and accessible while maintaining scientific accuracy.`;
  }
}
