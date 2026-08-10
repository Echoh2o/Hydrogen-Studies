/**
 * Consensus API Routes
 * Endpoints for searching, summarizing, and synthesizing hydrogen research
 */

import { Router, Request, Response } from "express";
import { requireAdmin } from "../auth";
import { aiGenerationRateLimiter, searchRateLimiter } from "../utils/rate-limiting";
import {
  searchHydrogenPapers,
  summarizeSingleStudy,
  synthesizeTopicEvidence,
  generateBlogOutline,
  clearConsensusCache,
  getCacheStats,
  type ConsensusPaper,
} from "../services/consensus-api";
import {
  hydrogenTopics,
  getTopicBySlug,
  getTopicsByCategory,
  type TopicConfig,
} from "../config/hydrogen-topics";

const router = Router();

// These endpoints hit the paid Consensus API and, for /topics/:slug, fire an
// Opus synthesis on every cache miss. They were mounted with no limiter, so an
// anonymous caller could drive unbounded external-API/AI spend. searchRateLimiter
// skips admins, so the admin import UI is unaffected.
router.use(searchRateLimiter);

/**
 * GET /api/consensus/search
 * Search Consensus for hydrogen-related papers
 */
router.get("/search", async (req: Request, res: Response) => {
  try {
    const query = String(req.query.query || req.query.q || "").trim();
    if (!query) {
      return res.status(400).json({ success: false, error: "Query is required" });
    }

    const parsedYearFrom = req.query.yearFrom ? parseInt(String(req.query.yearFrom)) : NaN;
    const parsedYearTo = req.query.yearTo ? parseInt(String(req.query.yearTo)) : NaN;
    const yearFrom = !isNaN(parsedYearFrom) && parsedYearFrom > 1900 && parsedYearFrom < 2100 ? parsedYearFrom : undefined;
    const yearTo = !isNaN(parsedYearTo) && parsedYearTo > 1900 && parsedYearTo < 2100 ? parsedYearTo : undefined;

    const result = await searchHydrogenPapers(query, { yearFrom, yearTo });

    res.json({
      success: true,
      data: result.papers,
      total: result.total,
      fromCache: result.fromCache,
      query,
    });
  } catch (error: unknown) {
    console.error("Consensus search error:", error);
    const message = error instanceof Error ? error.message : "Consensus search failed";
    res.status(message.includes("Rate limit") ? 429 : 500).json({
      success: false,
      error: message,
    });
  }
});

/**
 * POST /api/consensus/summarize
 * Generate a structured summary of a single paper
 */
router.post(
  "/summarize",
  requireAdmin,
  aiGenerationRateLimiter,
  async (req: Request, res: Response) => {
    try {
      const paper = req.body.paper as ConsensusPaper;
      if (!paper || !paper.paper_title) {
        return res.status(400).json({
          success: false,
          error: "Paper data is required (paper_title, abstract, etc.)",
        });
      }

      const summary = await summarizeSingleStudy(paper);

      res.json({
        success: true,
        data: summary,
      });
    } catch (error: unknown) {
      console.error("Consensus summarize error:", error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Summarization failed",
      });
    }
  },
);

/**
 * GET /api/consensus/topics
 * List all available topic configurations
 */
router.get("/topics", (req: Request, res: Response) => {
  const category = req.query.category as string | undefined;

  const topics = category
    ? getTopicsByCategory(category as TopicConfig["category"])
    : hydrogenTopics;

  res.json({
    success: true,
    data: topics.map((t) => ({
      slug: t.slug,
      title: t.title,
      description: t.description,
      category: t.category,
      keywords: t.keywords,
    })),
    total: topics.length,
  });
});

/**
 * GET /api/consensus/topics/:slug
 * Get evidence synthesis for a specific topic
 */
router.get("/topics/:slug", async (req: Request, res: Response) => {
  try {
    const topic = getTopicBySlug(req.params.slug);
    if (!topic) {
      return res.status(404).json({
        success: false,
        error: "Topic not found",
        availableTopics: hydrogenTopics.map((t) => t.slug),
      });
    }

    const synthesis = await synthesizeTopicEvidence(
      topic.slug,
      topic.searchQuery,
      topic.title,
    );

    res.json({
      success: true,
      topic: {
        slug: topic.slug,
        title: topic.title,
        description: topic.description,
        category: topic.category,
      },
      data: synthesis,
    });
  } catch (error: unknown) {
    console.error("Topic synthesis error:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Topic synthesis failed",
    });
  }
});

/**
 * POST /api/consensus/blog-outline
 * Generate a blog outline from Consensus research
 */
router.post(
  "/blog-outline",
  requireAdmin,
  aiGenerationRateLimiter,
  async (req: Request, res: Response) => {
    try {
      const { topic, searchQuery, topicSlug } = req.body;

      // Allow using a predefined topic config
      if (topicSlug) {
        const topicConfig = getTopicBySlug(topicSlug);
        if (!topicConfig) {
          return res.status(404).json({ success: false, error: "Topic not found" });
        }
        const outline = await generateBlogOutline(
          topicConfig.title,
          topicConfig.searchQuery,
        );
        return res.json({ success: true, data: outline, topic: topicConfig.title });
      }

      if (!topic || !searchQuery) {
        return res.status(400).json({
          success: false,
          error: "topic and searchQuery are required (or provide topicSlug)",
        });
      }

      const outline = await generateBlogOutline(topic, searchQuery);

      res.json({
        success: true,
        data: outline,
        topic,
      });
    } catch (error: unknown) {
      console.error("Blog outline error:", error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Blog outline generation failed",
      });
    }
  },
);

/**
 * POST /api/consensus/cache/clear
 * Clear the Consensus API cache (admin only)
 */
router.post(
  "/cache/clear",
  requireAdmin,
  (req: Request, res: Response) => {
    const prefix = req.body.prefix as string | undefined;
    const cleared = clearConsensusCache(prefix);
    res.json({
      success: true,
      message: `Cleared ${cleared} cache entries`,
      cleared,
    });
  },
);

/**
 * GET /api/consensus/cache/stats
 * Get cache statistics (admin only)
 */
router.get(
  "/cache/stats",
  requireAdmin,
  (req: Request, res: Response) => {
    const stats = getCacheStats();
    res.json({ success: true, data: stats });
  },
);

export default router;
