import { db } from "./db";
import { studies } from "@shared/schema";
import { sql, desc, asc } from "drizzle-orm";

interface ContentFreshnessReport {
  studyId: number;
  title: string;
  freshnessScore: number;
  recommendations: string[];
  priority: "high" | "medium" | "low";
  lastUpdated: Date | null;
  viewCount: number;
  keywordDensity: number;
}

export async function analyzeContentFreshness(): Promise<
  ContentFreshnessReport[]
> {
  const studiesData = await db.execute(sql`
    SELECT 
      id,
      title,
      abstract,
      keywords,
      view_count,
      created_at,
      updated_at,
      plain_language_summary,
      consumer_friendly_summary,
      LENGTH(plain_language_summary) as summary_length,
      array_length(keywords, 1) as keyword_count
    FROM studies
    ORDER BY view_count DESC NULLS LAST
    LIMIT 100
  `);

  return studiesData.rows
    .map((study) => {
      let score = 100;
      const recommendations: string[] = [];

      // Age penalty
      const daysSinceUpdate = study.updated_at
        ? Math.floor(
            (Date.now() - new Date(study.updated_at).getTime()) /
              (1000 * 60 * 60 * 24),
          )
        : 365;
      if (daysSinceUpdate > 180) {
        score -= 20;
        recommendations.push(
          "Content is over 6 months old - consider refreshing",
        );
      }

      // Content completeness
      if (!study.plain_language_summary) {
        score -= 25;
        recommendations.push("Missing plain language summary");
      }
      if (!study.consumer_friendly_summary) {
        score -= 20;
        recommendations.push("Missing consumer-friendly content");
      }

      // Keyword optimization
      const keywordCount = study.keyword_count || 0;
      if (keywordCount < 5) {
        score -= 15;
        recommendations.push("Needs more targeted keywords");
      }

      // Summary length optimization
      const summaryLength = study.summary_length || 0;
      if (summaryLength < 200) {
        score -= 10;
        recommendations.push("Summary too short for SEO");
      } else if (summaryLength > 500) {
        score -= 5;
        recommendations.push("Summary might be too long");
      }

      // Performance-based priority
      const viewCount = study.view_count || 0;
      let priority: "high" | "medium" | "low" = "low";

      if (viewCount > 100 && score < 70) priority = "high";
      else if (viewCount > 50 && score < 80) priority = "medium";
      else if (score < 60) priority = "medium";

      return {
        studyId: study.id,
        title: study.title,
        freshnessScore: Math.max(0, score),
        recommendations,
        priority,
        lastUpdated: study.updated_at,
        viewCount,
        keywordDensity:
          keywordCount / Math.max(1, study.title.split(" ").length),
      };
    })
    .sort((a, b) => {
      // Sort by priority first, then by freshness score
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      const priorityDiff =
        priorityOrder[b.priority] - priorityOrder[a.priority];
      return priorityDiff !== 0
        ? priorityDiff
        : a.freshnessScore - b.freshnessScore;
    });
}
