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
    console.error("[SEO API] Enrichment status error:", error);
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
    console.error("[SEO API] Study enrichment error:", error);
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

    console.log(`[SEO API] Starting batch enrichment: ${batchSize} studies, ${delayMs}ms delay`);

    const result = await batchEnrichStudies({
      batchSize: Math.min(batchSize, 100), // Cap at 100
      delayMs,
      onProgress: (done, total, studyId) => {
        console.log(`[SEO API] Enrichment progress: ${done}/${total} (study ${studyId})`);
      },
    });

    res.json(result);
  } catch (error) {
    console.error("[SEO API] Batch enrichment error:", error);
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
    console.error("[SEO API] Content factory status error:", error);
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
    console.error("[SEO API] Topics error:", error);
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

    console.log(`[SEO API] Generating pillar page for: ${cluster.condition}`);

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
    console.error("[SEO API] Pillar generation error:", error);
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

    console.log(`[SEO API] Generating ${maxPosts} cluster posts for: ${cluster.condition}`);

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
    console.error("[SEO API] Cluster generation error:", error);
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

    console.log(`[SEO API] Running content factory: ${maxTopics} topics, ${maxClustersPerTopic} clusters each`);

    const result = await runContentFactory({
      maxTopics: Math.min(maxTopics, 50),
      maxClustersPerTopic: Math.min(maxClustersPerTopic, 10),
      delayMs,
      pillarOnly,
      clusterOnly,
      specificTopic,
      onProgress: (progress) => {
        console.log(
          `[SEO API] Factory progress: ${progress.phase} | ` +
          `Topic ${progress.topicIndex + 1}/${progress.topicTotal} (${progress.currentTopic}) | ` +
          `Articles: ${progress.articlesGenerated} generated, ${progress.articlesFailed} failed`
        );
      },
    });

    res.json(result);
  } catch (error) {
    console.error("[SEO API] Content factory run error:", error);
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
    console.log(`[SEO API] Building study links for ${batchSize} studies`);

    const result = await buildAllStudyLinks({
      batchSize,
      onProgress: (done, total) => {
        if (done % 50 === 0) console.log(`[SEO API] Study links: ${done}/${total}`);
      },
    });

    res.json(result);
  } catch (error) {
    console.error("[SEO API] Build study links error:", error);
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
    console.log(`[SEO API] Building blog links for ${batchSize} blogs`);

    const result = await buildAllBlogLinks({
      batchSize,
      onProgress: (done, total) => {
        if (done % 50 === 0) console.log(`[SEO API] Blog links: ${done}/${total}`);
      },
    });

    res.json(result);
  } catch (error) {
    console.error("[SEO API] Build blog links error:", error);
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
    console.error("[SEO API] Get links error:", error);
    res.status(500).json({ error: "Failed to get links" });
  }
});

export default router;
