/**
 * SEO Content Factory Routes — Admin API for generating SEO content at scale
 *
 * Provides endpoints for:
 * - Study enrichment (batch + single)
 * - Pillar page generation
 * - Cluster blog post generation
 * - Internal link building
 * - Content factory status dashboard
 */

import { Router, Request, Response } from "express";
import { logger } from "../utils/logger";
import { requireAdmin } from "../auth";
import { aiGenerationRateLimiter } from "../utils/rate-limiting";
import {
  enrichAndSaveStudy,
  batchEnrichStudies,
  getEnrichmentCandidateCount,
  getEnrichmentCandidates,
} from "../services/study-seo-enrichment";
import {
  generateTopicClusters,
  generatePillarPage,
  generateClusterPost,
  saveGeneratedArticle,
  runContentFactory,
  getContentFactoryStatus,
} from "../services/seo-content-factory";
import {
  buildAllStudyLinks,
  buildAllBlogLinks,
  getLinksFor,
} from "../services/internal-linking-engine";
import {
  batchRetractionCheck,
  checkStudyRetraction,
  getRetractionStatus,
} from "../services/retraction-monitor";

const router = Router();

// All routes require admin authentication
router.use(requireAdmin);

// ============================================================
// Study Enrichment Endpoints
// ============================================================

/**
 * GET /api/seo/enrichment/status
 * Get enrichment status — how many studies need enrichment
 */
router.get("/enrichment/status", async (req: Request, res: Response) => {
  try {
    const candidateCount = await getEnrichmentCandidateCount();
    const candidates = await getEnrichmentCandidates(5);
    res.json({
      needsEnrichment: candidateCount,
      sampleCandidates: candidates,
    });
  } catch (error) {
    logger.error("Enrichment status error", error, "SEO API");
    res.status(500).json({ error: "Failed to get enrichment status" });
  }
});

/**
 * POST /api/seo/enrichment/study/:id
 * Enrich a single study with AI-generated SEO data
 */
router.post("/enrichment/study/:id", aiGenerationRateLimiter, async (req: Request, res: Response) => {
  try {
    const studyId = parseInt(req.params.id);
    if (isNaN(studyId)) {
      return res.status(400).json({ error: "Invalid study ID" });
    }

    const success = await enrichAndSaveStudy(studyId);
    res.json({ success, studyId });
  } catch (error) {
    logger.error("Study enrichment error", error, "SEO API");
    res.status(500).json({ error: "Failed to enrich study" });
  }
});

/**
 * POST /api/seo/enrichment/batch
 * Batch enrich multiple studies
 * Body: { batchSize?: number, delayMs?: number }
 */
router.post("/enrichment/batch", aiGenerationRateLimiter, async (req: Request, res: Response) => {
  try {
    const { batchSize = 10, delayMs = 1500 } = req.body;

    logger.info("Starting batch enrichment", "SEO API", { batchSize, delayMs });

    const result = await batchEnrichStudies({
      batchSize: Math.min(batchSize, 100), // Cap at 100
      delayMs,
      onProgress: (done, total, studyId) => {
        logger.info("Enrichment progress", "SEO API", { done, total, studyId });
      },
    });

    res.json(result);
  } catch (error) {
    logger.error("Batch enrichment error", error, "SEO API");
    res.status(500).json({ error: "Failed to run batch enrichment" });
  }
});

// ============================================================
// Content Factory Endpoints
// ============================================================

/**
 * GET /api/seo/content-factory/status
 * Get content factory status — topics, pillar pages, cluster posts
 */
router.get("/content-factory/status", async (req: Request, res: Response) => {
  try {
    const status = await getContentFactoryStatus();
    res.json(status);
  } catch (error) {
    logger.error("Content factory status error", error, "SEO API");
    res.status(500).json({ error: "Failed to get content factory status" });
  }
});

/**
 * GET /api/seo/content-factory/topics
 * Get all available topic clusters
 */
router.get("/content-factory/topics", async (req: Request, res: Response) => {
  try {
    const clusters = await generateTopicClusters();
    res.json({
      totalTopics: clusters.length,
      topics: clusters.map(c => ({
        slug: c.slug,
        condition: c.condition,
        pillarTitle: c.pillarTitle,
        pillarKeyword: c.pillarKeyword,
        clusterCount: c.clusterKeywords.length,
        clusterKeywords: c.clusterKeywords.map(ck => ({
          slug: ck.slug,
          title: ck.title,
          targetKeyword: ck.targetKeyword,
          articleType: ck.articleType,
        })),
      })),
    });
  } catch (error) {
    logger.error("Topics error", error, "SEO API");
    res.status(500).json({ error: "Failed to get topics" });
  }
});

/**
 * POST /api/seo/content-factory/generate-pillar
 * Generate a pillar page for a specific topic
 * Body: { topic: string }
 */
router.post("/content-factory/generate-pillar", aiGenerationRateLimiter, async (req: Request, res: Response) => {
  try {
    const { topic } = req.body;
    if (!topic) {
      return res.status(400).json({ error: "Topic is required" });
    }

    const clusters = await generateTopicClusters();
    const cluster = clusters.find(c =>
      c.condition.toLowerCase() === topic.toLowerCase() ||
      c.slug === topic.toLowerCase()
    );

    if (!cluster) {
      return res.status(404).json({ error: `Topic "${topic}" not found` });
    }

    logger.info("Generating pillar page", "SEO API", { condition: cluster.condition });

    const article = await generatePillarPage(cluster);
    if (!article) {
      return res.status(500).json({ error: "Failed to generate pillar page" });
    }

    const savedId = await saveGeneratedArticle(article);
    res.json({
      success: true,
      articleId: savedId,
      title: article.title,
      slug: article.slug,
      wordCount: article.content.split(/\s+/).length,
    });
  } catch (error) {
    logger.error("Pillar generation error", error, "SEO API");
    res.status(500).json({ error: "Failed to generate pillar page" });
  }
});

/**
 * POST /api/seo/content-factory/generate-cluster
 * Generate cluster posts for a specific topic
 * Body: { topic: string, maxPosts?: number }
 */
router.post("/content-factory/generate-cluster", aiGenerationRateLimiter, async (req: Request, res: Response) => {
  try {
    const { topic, maxPosts = 5 } = req.body;
    if (!topic) {
      return res.status(400).json({ error: "Topic is required" });
    }

    const clusters = await generateTopicClusters();
    const cluster = clusters.find(c =>
      c.condition.toLowerCase() === topic.toLowerCase() ||
      c.slug === topic.toLowerCase()
    );

    if (!cluster) {
      return res.status(404).json({ error: `Topic "${topic}" not found` });
    }

    logger.info("Generating cluster posts", "SEO API", { maxPosts, condition: cluster.condition });

    const results: Array<{ title: string; slug: string; success: boolean; articleId?: number | null }> = [];

    for (const ckw of cluster.clusterKeywords.slice(0, maxPosts)) {
      const article = await generateClusterPost(cluster, ckw);
      if (article) {
        const savedId = await saveGeneratedArticle(article);
        results.push({
          title: article.title,
          slug: article.slug,
          success: !!savedId,
          articleId: savedId,
        });
      } else {
        results.push({
          title: ckw.title,
          slug: ckw.slug,
          success: false,
        });
      }

      // Delay between generations
      await new Promise(r => setTimeout(r, 2000));
    }

    res.json({
      topic: cluster.condition,
      results,
      generated: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
    });
  } catch (error) {
    logger.error("Cluster generation error", error, "SEO API");
    res.status(500).json({ error: "Failed to generate cluster posts" });
  }
});

/**
 * POST /api/seo/content-factory/run
 * Run the full content factory — generates pillar pages + cluster posts
 * Body: { maxTopics?, maxClustersPerTopic?, delayMs?, pillarOnly?, clusterOnly?, topic? }
 */
router.post("/content-factory/run", aiGenerationRateLimiter, async (req: Request, res: Response) => {
  try {
    const {
      maxTopics = 5,
      maxClustersPerTopic = 3,
      delayMs = 3000,
      pillarOnly = false,
      clusterOnly = false,
      topic: specificTopic,
    } = req.body;

    logger.info("Running content factory", "SEO API", { maxTopics, maxClustersPerTopic });

    const result = await runContentFactory({
      maxTopics: Math.min(maxTopics, 50),
      maxClustersPerTopic: Math.min(maxClustersPerTopic, 10),
      delayMs,
      pillarOnly,
      clusterOnly,
      specificTopic,
      onProgress: (progress) => {
        logger.info("Factory progress", "SEO API", {
          phase: progress.phase,
          topicIndex: progress.topicIndex + 1,
          topicTotal: progress.topicTotal,
          currentTopic: progress.currentTopic,
          articlesGenerated: progress.articlesGenerated,
          articlesFailed: progress.articlesFailed,
        });
      },
    });

    res.json(result);
  } catch (error) {
    logger.error("Content factory run error", error, "SEO API");
    res.status(500).json({ error: "Failed to run content factory" });
  }
});

// ============================================================
// Internal Linking Endpoints
// ============================================================

/**
 * POST /api/seo/links/build-study-links
 * Build internal links for all studies
 */
router.post("/links/build-study-links", async (req: Request, res: Response) => {
  try {
    const { batchSize = 200 } = req.body;
    logger.info("Building study links", "SEO API", { batchSize });

    const result = await buildAllStudyLinks({
      batchSize,
      onProgress: (done, total) => {
        if (done % 50 === 0) logger.info("Study links progress", "SEO API", { done, total });
      },
    });

    res.json(result);
  } catch (error) {
    logger.error("Build study links error", error, "SEO API");
    res.status(500).json({ error: "Failed to build study links" });
  }
});

/**
 * POST /api/seo/links/build-blog-links
 * Build internal links for all blog posts
 */
router.post("/links/build-blog-links", async (req: Request, res: Response) => {
  try {
    const { batchSize = 200 } = req.body;
    logger.info("Building blog links", "SEO API", { batchSize });

    const result = await buildAllBlogLinks({
      batchSize,
      onProgress: (done, total) => {
        if (done % 50 === 0) logger.info("Blog links progress", "SEO API", { done, total });
      },
    });

    res.json(result);
  } catch (error) {
    logger.error("Build blog links error", error, "SEO API");
    res.status(500).json({ error: "Failed to build blog links" });
  }
});

/**
 * GET /api/seo/links/:type/:id
 * Get internal links for a specific piece of content
 */
router.get("/links/:type/:id", async (req: Request, res: Response) => {
  try {
    const { type, id } = req.params;
    const contentId = parseInt(id);
    if (isNaN(contentId)) {
      return res.status(400).json({ error: "Invalid content ID" });
    }

    const links = await getLinksFor(type, contentId);
    res.json({ links });
  } catch (error) {
    logger.error("Get links error", error, "SEO API");
    res.status(500).json({ error: "Failed to get links" });
  }
});

// ============================================================
// Retraction & Correction Monitoring Endpoints
// ============================================================

/**
 * GET /api/seo/retractions/status
 * Get retraction monitoring status — how many flagged studies
 */
router.get("/retractions/status", async (req: Request, res: Response) => {
  try {
    const status = await getRetractionStatus();
    res.json(status);
  } catch (error) {
    logger.error("Retraction status error", error, "SEO API");
    res.status(500).json({ error: "Failed to get retraction status" });
  }
});

/**
 * POST /api/seo/retractions/check
 * Run retraction check on a batch of studies
 * Body: { batchSize?: number, delayMs?: number }
 */
router.post("/retractions/check", async (req: Request, res: Response) => {
  try {
    const { batchSize = 50, delayMs = 500 } = req.body;

    logger.info("Running retraction check", "SEO API", { batchSize });

    const result = await batchRetractionCheck({
      batchSize: Math.min(batchSize, 200),
      delayMs,
      onProgress: (checked, total) => {
        if (checked % 20 === 0) logger.info("Retraction check progress", "SEO API", { checked, total });
      },
    });

    res.json(result);
  } catch (error) {
    logger.error("Retraction check error", error, "SEO API");
    res.status(500).json({ error: "Failed to run retraction check" });
  }
});

/**
 * POST /api/seo/retractions/check-study/:id
 * Check a single study for retraction/correction
 */
router.post("/retractions/check-study/:id", async (req: Request, res: Response) => {
  try {
    const studyId = parseInt(req.params.id);
    if (isNaN(studyId)) {
      return res.status(400).json({ error: "Invalid study ID" });
    }

    // Fetch the study
    const { db } = await import("../db");
    const { studies } = await import("../../shared/schema");
    const { eq } = await import("drizzle-orm");

    const [study] = await db.select({ id: studies.id, doi: studies.doi, title: studies.title })
      .from(studies)
      .where(eq(studies.id, studyId))
      .limit(1);

    if (!study) {
      return res.status(404).json({ error: "Study not found" });
    }

    const result = await checkStudyRetraction(study);
    res.json({
      studyId,
      doi: study.doi,
      result: result || { status: "none", details: "No retraction or correction detected" },
    });
  } catch (error) {
    logger.error("Single retraction check error", error, "SEO API");
    res.status(500).json({ error: "Failed to check study retraction" });
  }
});

// ============================================================
// SEO Keyword Strategy Endpoints
// ============================================================

import {
  seedKeywordClusters,
  getKeywordClusters,
  generateKeywordPillarPage,
  generateKeywordClusterPost,
  generateFullCluster,
  getStrategyOverview,
} from "../services/seo-keyword-strategy";

/**
 * GET /api/seo/keyword-strategy/overview
 * Get full keyword strategy overview with all clusters and progress
 */
router.get("/keyword-strategy/overview", async (req: Request, res: Response) => {
  try {
    const overview = await getStrategyOverview();
    res.json(overview);
  } catch (error) {
    logger.error("Strategy overview error", error, "SEO API");
    res.status(500).json({ error: "Failed to get strategy overview" });
  }
});

/**
 * POST /api/seo/keyword-strategy/seed
 * Seed default keyword clusters into the database
 */
router.post("/keyword-strategy/seed", async (req: Request, res: Response) => {
  try {
    const result = await seedKeywordClusters();
    res.json({ success: true, ...result });
  } catch (error) {
    logger.error("Seed clusters error", error, "SEO API");
    res.status(500).json({ error: "Failed to seed keyword clusters" });
  }
});

/**
 * GET /api/seo/keyword-strategy/clusters
 * Get all keyword clusters
 */
router.get("/keyword-strategy/clusters", async (req: Request, res: Response) => {
  try {
    const clusters = await getKeywordClusters();
    res.json({ clusters });
  } catch (error) {
    logger.error("Get clusters error", error, "SEO API");
    res.status(500).json({ error: "Failed to get clusters" });
  }
});

/**
 * POST /api/seo/keyword-strategy/generate-pillar/:id
 * Generate a pillar page for a specific cluster
 */
router.post("/keyword-strategy/generate-pillar/:id", aiGenerationRateLimiter, async (req: Request, res: Response) => {
  try {
    const clusterId = parseInt(req.params.id);
    if (isNaN(clusterId)) return res.status(400).json({ error: "Invalid cluster ID" });

    const result = await generateKeywordPillarPage(clusterId);
    res.json(result);
  } catch (error) {
    logger.error("Generate pillar error", error, "SEO API");
    res.status(500).json({ error: "Failed to generate pillar page" });
  }
});

/**
 * POST /api/seo/keyword-strategy/generate-cluster-post/:id
 * Generate a single cluster post
 * Body: { keywordIndex: number }
 */
router.post("/keyword-strategy/generate-cluster-post/:id", aiGenerationRateLimiter, async (req: Request, res: Response) => {
  try {
    const clusterId = parseInt(req.params.id);
    const { keywordIndex } = req.body;
    if (isNaN(clusterId)) return res.status(400).json({ error: "Invalid cluster ID" });
    if (typeof keywordIndex !== "number") return res.status(400).json({ error: "keywordIndex required" });

    const result = await generateKeywordClusterPost(clusterId, keywordIndex);
    res.json(result);
  } catch (error) {
    logger.error("Generate cluster post error", error, "SEO API");
    res.status(500).json({ error: "Failed to generate cluster post" });
  }
});

/**
 * POST /api/seo/keyword-strategy/generate-full-cluster/:id
 * Generate pillar + all cluster posts for a cluster
 * Body: { delayMs?: number }
 */
router.post("/keyword-strategy/generate-full-cluster/:id", aiGenerationRateLimiter, async (req: Request, res: Response) => {
  try {
    const clusterId = parseInt(req.params.id);
    if (isNaN(clusterId)) return res.status(400).json({ error: "Invalid cluster ID" });

    const { delayMs = 3000 } = req.body;
    const result = await generateFullCluster(clusterId, delayMs);
    res.json(result);
  } catch (error) {
    logger.error("Generate full cluster error", error, "SEO API");
    res.status(500).json({ error: "Failed to generate full cluster" });
  }
});

export default router;
