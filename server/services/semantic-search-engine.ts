/**
 * Semantic Search Engine with OpenAI Embeddings
 * Creates vector representations of studies and performs semantic similarity matching
 */

import { OpenAI } from "openai";
import { db } from "../db";
import { studies } from "@shared/schema";
import { sql, desc, or, and, gte, lte, eq, ilike } from "drizzle-orm";
import { ParsedQuery } from "./natural-language-parser";

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Cache for embeddings to reduce API calls
const embeddingCache = new Map<string, number[]>();

export interface SemanticSearchResult {
  id: number;
  title: string;
  plainLanguageTitle?: string;
  abstract: string;
  authors: string;
  journal: string;
  publishDate?: string;
  journalPublishDate?: string;
  category: string;
  relevanceScore: number;
  semanticScore: number;
  matchReasons: string[];
  highlights: {
    title?: string;
    abstract?: string;
    methods?: string;
    results?: string;
    conclusion?: string;
  };
  doi?: string;
  slug?: string;
  imageUrl?: string;
  consumerCategories?: any;
  keywords?: string[];
  tags?: any[];
}

export interface SemanticSearchResponse {
  results: SemanticSearchResult[];
  totalCount: number;
  facets: {
    conditions: { name: string; count: number }[];
    bodySystems: { name: string; count: number }[];
    deliveryMethods: { name: string; count: number }[];
    years: { year: number; count: number }[];
    studyTypes: { type: string; count: number }[];
  };
  queryInterpretation: {
    original: string;
    understood: string;
    filters: any;
    confidence: number;
  };
  suggestions: string[];
  relatedSearches: string[];
}

/**
 * Generate embedding for text using OpenAI
 */
async function generateEmbedding(text: string): Promise<number[]> {
  // Check cache first
  const cacheKey = text.slice(0, 100); // Use first 100 chars as key
  if (embeddingCache.has(cacheKey)) {
    return embeddingCache.get(cacheKey)!;
  }

  try {
    const response = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: text,
      encoding_format: "float",
    });

    const embedding = response.data[0].embedding;

    // Cache the result
    embeddingCache.set(cacheKey, embedding);

    // Limit cache size
    if (embeddingCache.size > 1000) {
      const firstKey = embeddingCache.keys().next().value;
      if (firstKey !== undefined) embeddingCache.delete(firstKey);
    }

    return embedding;
  } catch (error) {
    console.error("Error generating embedding:", error);
    throw error;
  }
}

/**
 * Calculate cosine similarity between two vectors
 */
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  if (normA === 0 || normB === 0) return 0;

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Create searchable text from study
 */
function createStudySearchText(study: any): string {
  const parts = [
    study.title || "",
    study.plainLanguageTitle || "",
    study.abstract || "",
    study.objective || "",
    study.methods || "",
    study.results || "",
    study.conclusion || "",
    study.keywords?.join(" ") || "",
    study.consumerCategories ? JSON.stringify(study.consumerCategories) : "",
  ];

  return parts
    .filter((p) => p)
    .join(" ")
    .slice(0, 3000); // Limit text length
}

/**
 * Perform semantic search with OpenAI embeddings
 */
export async function performSemanticSearch(
  parsedQuery: ParsedQuery,
  limit: number = 20,
  offset: number = 0,
): Promise<SemanticSearchResponse> {
  try {
    // Generate embedding for the query
    const queryText = parsedQuery.expandedQueries.join(" ");
    const queryEmbedding = await generateEmbedding(queryText);

    // Build database filters based on parsed query
    const conditions = [];

    // Apply filters from parsed query
    if (parsedQuery.filters.healthConditions?.length > 0) {
      conditions.push(
        or(
          ...parsedQuery.filters.healthConditions.map((cond) =>
            ilike(studies.abstract, `%${cond}%`),
          ),
        ),
      );
    }

    if (parsedQuery.filters.bodySystems?.length > 0) {
      conditions.push(
        or(
          ...parsedQuery.filters.bodySystems.map((sys) =>
            ilike(studies.abstract, `%${sys}%`),
          ),
        ),
      );
    }

    if (parsedQuery.filters.deliveryMethods?.length > 0) {
      conditions.push(
        or(
          ...parsedQuery.filters.deliveryMethods.map((method) =>
            or(
              ilike(studies.abstract, `%${method}%`),
              ilike(studies.methods, `%${method}%`),
            ),
          ),
        ),
      );
    }

    if (parsedQuery.filters.yearFrom) {
      conditions.push(gte(studies.publishYear, parsedQuery.filters.yearFrom));
    }

    if (parsedQuery.filters.yearTo) {
      conditions.push(lte(studies.publishYear, parsedQuery.filters.yearTo));
    }

    // Get studies from database
    let query = db.select().from(studies);

    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    // Get all matching studies (we'll sort by semantic similarity)
    const allStudies = await query.limit(200); // Get more for semantic ranking

    // Calculate semantic similarity for each study
    const scoredStudies = await Promise.all(
      allStudies.map(async (study) => {
        const studyText = createStudySearchText(study);
        let semanticScore = 0;

        try {
          // Generate embedding for study (this could be pre-computed and stored)
          const studyEmbedding = await generateEmbedding(studyText);
          semanticScore = cosineSimilarity(queryEmbedding, studyEmbedding);
        } catch (error) {
          console.error("Error calculating semantic similarity:", error);
          semanticScore = 0;
        }

        // Calculate keyword-based relevance score
        const keywordScore = calculateKeywordRelevance(study, parsedQuery);

        // Combined relevance score
        const relevanceScore = semanticScore * 0.7 + keywordScore * 0.3;

        // Generate match reasons
        const matchReasons = generateMatchReasons(
          study,
          parsedQuery,
          semanticScore,
        );

        // Generate highlights
        const highlights = generateHighlights(study, parsedQuery);

        return {
          id: study.id,
          title: study.title,
          plainLanguageTitle: study.plainLanguageTitle,
          abstract: study.abstract,
          authors: study.authors,
          journal: study.journal,
          publishDate: study.publishDate,
          journalPublishDate: study.journalPublishDate,
          category: study.category,
          relevanceScore,
          semanticScore,
          matchReasons,
          highlights,
          doi: study.doi,
          slug: study.slug,
          imageUrl: study.imageUrl,
          consumerCategories: study.consumerCategories,
          keywords: study.keywords,
          tags: study.tags,
        } as SemanticSearchResult;
      }),
    );

    // Sort by relevance score
    scoredStudies.sort((a, b) => b.relevanceScore - a.relevanceScore);

    // Apply pagination
    const paginatedResults = scoredStudies.slice(offset, offset + limit);

    // Generate facets
    const facets = generateFacets(scoredStudies);

    // Generate suggestions and related searches
    const suggestions = await generateSearchSuggestions(parsedQuery);
    const relatedSearches = generateRelatedSearches(parsedQuery);

    return {
      results: paginatedResults,
      totalCount: scoredStudies.length,
      facets,
      queryInterpretation: {
        original: parsedQuery.originalQuery,
        understood: parsedQuery.explanation,
        filters: parsedQuery.filters,
        confidence: parsedQuery.confidence,
      },
      suggestions,
      relatedSearches,
    };
  } catch (error) {
    console.error("Error performing semantic search:", error);
    throw error;
  }
}

/**
 * Calculate keyword-based relevance
 */
function calculateKeywordRelevance(
  study: any,
  parsedQuery: ParsedQuery,
): number {
  let score = 0;
  const searchText = createStudySearchText(study).toLowerCase();

  // Check original query
  if (searchText.includes(parsedQuery.originalQuery.toLowerCase())) {
    score += 0.5;
  }

  // Check expanded queries
  for (const expanded of parsedQuery.expandedQueries) {
    if (searchText.includes(expanded.toLowerCase())) {
      score += 0.3;
    }
  }

  // Check entities
  for (const condition of parsedQuery.entities.conditions || []) {
    if (searchText.includes(condition.toLowerCase())) {
      score += 0.2;
    }
  }

  return Math.min(score, 1); // Cap at 1
}

/**
 * Generate match reasons
 */
function generateMatchReasons(
  study: any,
  parsedQuery: ParsedQuery,
  semanticScore: number,
): string[] {
  const reasons = [];

  if (semanticScore > 0.8) {
    reasons.push("Highly relevant to your search");
  } else if (semanticScore > 0.6) {
    reasons.push("Good semantic match");
  }

  // Check specific matches
  const studyLower = createStudySearchText(study).toLowerCase();

  for (const condition of parsedQuery.entities.conditions || []) {
    if (studyLower.includes(condition.toLowerCase())) {
      reasons.push(`Studies ${condition}`);
    }
  }

  for (const method of parsedQuery.entities.deliveryMethods || []) {
    if (studyLower.includes(method.toLowerCase())) {
      reasons.push(`Uses ${method} delivery method`);
    }
  }

  for (const ageGroup of parsedQuery.entities.demographics?.ageGroups || []) {
    if (studyLower.includes(ageGroup.toLowerCase())) {
      reasons.push(`Includes ${ageGroup} participants`);
    }
  }

  if (
    parsedQuery.filters.yearFrom &&
    study.publishYear >= parsedQuery.filters.yearFrom
  ) {
    reasons.push("Recent research");
  }

  return reasons;
}

/**
 * Generate text highlights
 */
function generateHighlights(study: any, parsedQuery: ParsedQuery): any {
  const highlights: any = {};
  const terms = [
    parsedQuery.originalQuery,
    ...parsedQuery.expandedQueries,
    ...(parsedQuery.entities.conditions || []),
    ...(parsedQuery.entities.deliveryMethods || []),
  ].map((t) => t.toLowerCase());

  // Helper function to highlight text
  const highlightText = (text: string, maxLength: number = 200) => {
    if (!text) return undefined;

    for (const term of terms) {
      const index = text.toLowerCase().indexOf(term);
      if (index !== -1) {
        const start = Math.max(0, index - 50);
        const end = Math.min(text.length, index + term.length + 150);
        const highlighted = text.substring(start, end);
        return (
          (start > 0 ? "..." : "") +
          highlighted +
          (end < text.length ? "..." : "")
        );
      }
    }

    return (
      text.substring(0, maxLength) + (text.length > maxLength ? "..." : "")
    );
  };

  if (study.title) highlights.title = highlightText(study.title, 100);
  if (study.abstract) highlights.abstract = highlightText(study.abstract, 300);
  if (study.methods) highlights.methods = highlightText(study.methods, 200);
  if (study.results) highlights.results = highlightText(study.results, 200);
  if (study.conclusion)
    highlights.conclusion = highlightText(study.conclusion, 200);

  return highlights;
}

/**
 * Generate facets from results
 */
function generateFacets(results: SemanticSearchResult[]): any {
  const conditionCounts = new Map<string, number>();
  const bodySystemCounts = new Map<string, number>();
  const methodCounts = new Map<string, number>();
  const yearCounts = new Map<number, number>();
  const typeCounts = new Map<string, number>();

  // Count occurrences
  for (const result of results) {
    // Extract conditions from text
    const text = (result.abstract + " " + result.title).toLowerCase();

    // Common conditions
    const conditions = [
      "arthritis",
      "diabetes",
      "heart disease",
      "cancer",
      "alzheimer",
      "parkinson",
      "inflammation",
      "oxidative stress",
      "hypertension",
    ];

    for (const condition of conditions) {
      if (text.includes(condition)) {
        conditionCounts.set(
          condition,
          (conditionCounts.get(condition) || 0) + 1,
        );
      }
    }

    // Extract year
    const year = new Date(result.publishDate || "").getFullYear();
    if (year > 2000) {
      yearCounts.set(year, (yearCounts.get(year) || 0) + 1);
    }
  }

  return {
    conditions: Array.from(conditionCounts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10),
    bodySystems: Array.from(bodySystemCounts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10),
    deliveryMethods: Array.from(methodCounts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5),
    years: Array.from(yearCounts.entries())
      .map(([year, count]) => ({ year, count }))
      .sort((a, b) => b.year - a.year)
      .slice(0, 10),
    studyTypes: Array.from(typeCounts.entries())
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5),
  };
}

/**
 * Generate search suggestions
 */
async function generateSearchSuggestions(
  parsedQuery: ParsedQuery,
): Promise<string[]> {
  const suggestions = [];

  // Add variations based on intent
  if (parsedQuery.intent === "comparison") {
    suggestions.push("Which is better: " + parsedQuery.originalQuery);
    suggestions.push("Pros and cons of " + parsedQuery.originalQuery);
  }

  if (parsedQuery.intent === "effectiveness") {
    suggestions.push("Clinical trials for " + parsedQuery.originalQuery);
    suggestions.push("Success rates of " + parsedQuery.originalQuery);
  }

  // Add entity-based suggestions
  for (const condition of parsedQuery.entities.conditions || []) {
    suggestions.push(`Latest ${condition} research`);
    suggestions.push(`${condition} treatment options`);
  }

  return suggestions.slice(0, 5);
}

/**
 * Generate related searches
 */
function generateRelatedSearches(parsedQuery: ParsedQuery): string[] {
  const related = [];

  // Add related searches based on entities
  if (parsedQuery.entities.conditions?.length > 0) {
    related.push(`Other treatments for ${parsedQuery.entities.conditions[0]}`);
  }

  if (parsedQuery.entities.deliveryMethods?.length > 0) {
    related.push(`Benefits of ${parsedQuery.entities.deliveryMethods[0]}`);
  }

  if (parsedQuery.entities.demographics?.ageGroups?.length > 0) {
    related.push(
      `Hydrogen therapy for ${parsedQuery.entities.demographics.ageGroups[0]}`,
    );
  }

  // Add general related searches
  related.push("Hydrogen therapy side effects");
  related.push("Latest hydrogen research breakthroughs");

  return related.slice(0, 5);
}
