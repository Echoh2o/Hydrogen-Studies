/**
 * Natural Language Search API Routes
 * Provides intelligent search endpoints with OpenAI-powered understanding
 */

import { Router } from "express";
import { db } from "../db";
import { studies } from "@shared/schema";
import { sql } from "drizzle-orm";
import {
  parseNaturalLanguageQuery,
  generateSearchSuggestions,
  correctAndExpandQuery,
} from "../services/natural-language-parser";
import {
  performSemanticSearch,
  SemanticSearchResponse,
} from "../services/semantic-search-engine";
import {
  enhanceQueryUnderstanding,
  analyzeQueryComplexity,
  extractKeyPhrases,
} from "../services/query-understanding";
import {
  validateQueryInput,
  validateBatchQueries,
  sanitizeContext,
} from "../utils/nl-search-validation";

const router = Router();

/**
 * Main natural language search endpoint
 * POST /api/search/natural-language
 */
router.post("/api/search/natural-language", async (req, res) => {
  try {
    // Context strings flow into Claude prompts (query-understanding.ts) —
    // sanitize/cap them so a large request body can't bypass the per-query
    // length cap. Non-conforming context is dropped, not rejected.
    const context = sanitizeContext(req.body.context);

    const validated = validateQueryInput(req.body.query);
    if (!validated.ok) {
      return res.status(400).json({
        error: validated.error,
        message: "Please provide a valid search query",
      });
    }
    const query = validated.query;

    // Clamp pagination to sane bounds (these values drive DB work)
    const page = Math.max(1, parseInt(String(req.body.page ?? 1), 10) || 1);
    const pageSize = Math.min(
      100,
      Math.max(1, parseInt(String(req.body.pageSize ?? 20), 10) || 20),
    );
    const offset = (page - 1) * pageSize;

    console.log(`Natural language search: "${query}"`);

    // Step 1: Parse and understand the query
    const parsedQuery = await parseNaturalLanguageQuery(query);
    console.log("Parsed query:", parsedQuery);

    // Step 2: Enhance query understanding with context
    const enhancedQuery = await enhanceQueryUnderstanding(query, context);
    console.log("Enhanced query:", enhancedQuery);

    // Step 3: Perform semantic search
    const searchResults = await performSemanticSearch(
      parsedQuery,
      pageSize,
      offset,
    );

    // Step 4: Log search analytics
    logSearchAnalytics({
      query,
      parsedIntent: parsedQuery.intent,
      confidence: parsedQuery.confidence,
      resultsCount: searchResults.totalCount,
      timestamp: new Date(),
    });

    // Return comprehensive response
    res.json({
      success: true,
      query: {
        original: query,
        corrected: enhancedQuery.corrected,
        intent: parsedQuery.intent,
        confidence: parsedQuery.confidence,
        complexity: analyzeQueryComplexity(query),
      },
      interpretation: {
        understood: parsedQuery.explanation,
        entities: parsedQuery.entities,
        filters: parsedQuery.filters,
        expandedQueries: parsedQuery.expandedQueries,
      },
      results: searchResults.results,
      pagination: {
        page,
        pageSize,
        totalCount: searchResults.totalCount,
        totalPages: Math.ceil(searchResults.totalCount / pageSize),
      },
      facets: searchResults.facets,
      suggestions: {
        corrections: enhancedQuery.suggestions.filter(
          (s) => s.type === "correction",
        ),
        refinements: enhancedQuery.suggestions.filter(
          (s) => s.type === "refinement",
        ),
        alternatives: enhancedQuery.suggestions.filter(
          (s) => s.type === "alternative",
        ),
        related: enhancedQuery.relatedQueries,
      },
      debug: {
        keyPhrases: extractKeyPhrases(query),
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Natural language search error:", error);
    res.status(500).json({
      error: "Search failed",
      message:
        "An error occurred while processing your search. Please try again.",
    });
  }
});

/**
 * Query parsing endpoint
 * POST /api/search/parse-query
 */
router.post("/api/search/parse-query", async (req, res) => {
  try {
    const validated = validateQueryInput(req.body.query);
    if (!validated.ok) {
      return res.status(400).json({ error: validated.error });
    }
    const query = validated.query;

    const parsed = await parseNaturalLanguageQuery(query);

    res.json({
      success: true,
      parsed,
    });
  } catch (error) {
    console.error("Query parsing error:", error);
    res.status(500).json({
      error: "Failed to parse query",
      message: "Could not understand your search query",
    });
  }
});

/**
 * Search suggestions endpoint
 * GET /api/search/nl-suggestions
 */
router.get("/api/search/nl-suggestions", async (req, res) => {
  try {
    const { q } = req.query;

    // Typeahead input: skip AI for too-short or absurdly long values
    if (!q || typeof q !== "string" || q.length < 2 || q.length > 200) {
      return res.json({ suggestions: [] });
    }

    const suggestions = await generateSearchSuggestions(q);

    res.json({
      suggestions,
      query: q,
    });
  } catch (error) {
    console.error("Suggestions error:", error);
    res.json({ suggestions: [] });
  }
});

/**
 * Query correction endpoint
 * POST /api/search/correct-query
 */
router.post("/api/search/correct-query", async (req, res) => {
  try {
    const validated = validateQueryInput(req.body.query);
    if (!validated.ok) {
      return res.status(400).json({ error: validated.error });
    }
    const query = validated.query;

    const corrected = await correctAndExpandQuery(query);

    res.json({
      original: query,
      corrected,
      changed: query !== corrected,
    });
  } catch (error) {
    console.error("Query correction error:", error);
    res.status(500).json({
      error: "Failed to correct query",
      original: req.body.query,
      corrected: req.body.query,
    });
  }
});

/**
 * Popular queries endpoint
 * GET /api/search/popular-queries
 */
router.get("/api/search/popular-queries", async (req, res) => {
  try {
    const { category } = req.query;

    // Get popular queries from database or cache
    const popularQueries = await getPopularQueries(category as string);

    res.json({
      queries: popularQueries,
      category: category || "all",
    });
  } catch (error) {
    console.error("Popular queries error:", error);
    res.json({ queries: getDefaultPopularQueries() });
  }
});

/**
 * Query examples endpoint
 * GET /api/search/query-examples
 */
router.get("/api/search/query-examples", async (req, res) => {
  const examples = [
    {
      category: "Conditions",
      queries: [
        "Studies for arthritis in elderly patients",
        "Hydrogen therapy for diabetes management",
        "Heart disease treatment with molecular hydrogen",
        "Cancer research using hydrogen therapy",
      ],
    },
    {
      category: "Comparisons",
      queries: [
        "Compare hydrogen water vs inhalation for heart health",
        "Which is better: H2 tablets or hydrogen water?",
        "Hydrogen therapy vs traditional antioxidants",
        "Effectiveness of different hydrogen delivery methods",
      ],
    },
    {
      category: "Demographics",
      queries: [
        "Hydrogen therapy for athletes over 40",
        "Studies on children with autism and hydrogen",
        "Elderly patients with cognitive decline",
        "Pregnant women and hydrogen safety",
      ],
    },
    {
      category: "Effectiveness",
      queries: [
        "Most effective hydrogen therapy for inflammation",
        "Success rates of hydrogen for post-surgery recovery",
        "Best hydrogen treatment for oxidative stress",
        "Clinical evidence for hydrogen benefits",
      ],
    },
    {
      category: "Recent Research",
      queries: [
        "Latest hydrogen therapy breakthroughs 2024",
        "Recent studies on hydrogen and longevity",
        "New discoveries in hydrogen medicine",
        "Cutting-edge hydrogen research this year",
      ],
    },
    {
      category: "Side Effects & Safety",
      queries: [
        "Side effects of hydrogen inhalation",
        "Is hydrogen water safe for daily use?",
        "Contraindications for hydrogen therapy",
        "Long-term effects of molecular hydrogen",
      ],
    },
  ];

  res.json({ examples });
});

/**
 * Search intent detection endpoint
 * POST /api/search/detect-intent
 */
router.post("/api/search/detect-intent", async (req, res) => {
  try {
    const validated = validateQueryInput(req.body.query);
    if (!validated.ok) {
      return res.status(400).json({ error: validated.error });
    }
    const query = validated.query;

    const parsed = await parseNaturalLanguageQuery(query);
    const complexity = analyzeQueryComplexity(query);

    res.json({
      query,
      intent: parsed.intent,
      confidence: parsed.confidence,
      complexity,
      entities: parsed.entities,
      keyPhrases: extractKeyPhrases(query),
    });
  } catch (error) {
    console.error("Intent detection error:", error);
    res.status(500).json({
      error: "Failed to detect intent",
      query: req.body.query,
    });
  }
});

/**
 * Batch search endpoint for multiple queries
 * POST /api/search/batch
 */
router.post("/api/search/batch", async (req, res) => {
  try {
    const validated = validateBatchQueries(req.body.queries);
    if (!validated.ok) {
      return res.status(400).json({ error: validated.error });
    }
    const queries = validated.queries;

    // Clamp pageSize — it drives DB work per query
    const pageSize = Math.min(
      50,
      Math.max(1, parseInt(String(req.body.pageSize ?? 10), 10) || 10),
    );

    const results = await Promise.all(
      queries.map(async (query) => {
        try {
          const parsed = await parseNaturalLanguageQuery(query);
          const searchResults = await performSemanticSearch(
            parsed,
            pageSize,
            0,
          );

          return {
            query,
            success: true,
            totalCount: searchResults.totalCount,
            topResults: searchResults.results.slice(0, 3),
            intent: parsed.intent,
          };
        } catch (error) {
          return {
            query,
            success: false,
            error: "Failed to search",
          };
        }
      }),
    );

    res.json({
      success: true,
      results,
    });
  } catch (error) {
    console.error("Batch search error:", error);
    res.status(500).json({
      error: "Batch search failed",
      message: "Could not process multiple queries",
    });
  }
});

/**
 * Save search endpoint
 * POST /api/search/save
 */
router.post("/api/search/save", async (req, res) => {
  try {
    const { query, name, filters, userId } = req.body;

    if (!query || !name) {
      return res.status(400).json({ error: "Query and name are required" });
    }

    // Save to database (simplified for now)
    const saved = {
      id: Date.now(),
      query,
      name,
      filters: filters || {},
      userId: userId || "anonymous",
      createdAt: new Date(),
    };

    res.json({
      success: true,
      saved,
    });
  } catch (error) {
    console.error("Save search error:", error);
    res.status(500).json({
      error: "Failed to save search",
    });
  }
});

// Helper functions

async function getPopularQueries(category?: string): Promise<string[]> {
  // In production, this would query from database
  const allQueries = [
    "hydrogen water benefits",
    "hydrogen therapy for inflammation",
    "molecular hydrogen clinical trials",
    "hydrogen inhalation side effects",
    "hydrogen for athletes",
    "elderly hydrogen therapy",
    "hydrogen vs antioxidants",
    "recent hydrogen research",
    "hydrogen water dosage",
    "hydrogen therapy safety",
  ];

  if (category === "recent") {
    return allQueries.filter(
      (q) => q.includes("recent") || q.includes("clinical"),
    );
  } else if (category === "conditions") {
    return allQueries.filter(
      (q) => q.includes("inflammation") || q.includes("therapy"),
    );
  }

  return allQueries.slice(0, 5);
}

function getDefaultPopularQueries(): string[] {
  return [
    "hydrogen therapy benefits",
    "hydrogen water research",
    "molecular hydrogen studies",
    "hydrogen clinical trials",
    "hydrogen safety studies",
  ];
}

function logSearchAnalytics(data: any): void {
  // In production, this would log to analytics service
  console.log("Search analytics:", {
    ...data,
    timestamp: new Date().toISOString(),
  });
}

export default router;
