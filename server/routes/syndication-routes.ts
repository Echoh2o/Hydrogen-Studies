/**
 * Admin routes for Shopify blog syndication (all-in-on-echowater).
 *
 * POST /push/:articleId { force? }  — push one published article to the store blog
 * GET  /status                      — { enabled, syndicatedCount, lastSyndicatedAt, targetBlogHandle }
 *
 * Mounted at /api/admin/syndication (before the /api/admin catch-all).
 */

import { Router } from "express";
import { requireAdmin } from "../auth";
import {
  syndicateArticle,
  getSyndicationStatus,
} from "../services/shopify-blog-syndication";
import { logger } from "../utils/logger";

const router = Router();
router.use(requireAdmin);

router.post("/push/:articleId", async (req, res) => {
  const articleId = parseInt(req.params.articleId, 10);
  if (!Number.isInteger(articleId) || articleId <= 0) {
    return res.status(400).json({ error: "Invalid article id" });
  }
  const force = req.body?.force === true;
  try {
    const result = await syndicateArticle(articleId, { force });
    return res.status(result.status === "pushed" ? 200 : 409).json(result);
  } catch (err) {
    logger.error("Syndication push failed", err, "SyndicationRoutes", { articleId });
    return res.status(502).json({ error: "Syndication failed — see server logs" });
  }
});

router.get("/status", async (_req, res) => {
  try {
    return res.json(await getSyndicationStatus());
  } catch (err) {
    logger.error("Syndication status failed", err, "SyndicationRoutes");
    return res.status(500).json({ error: "Failed to load syndication status" });
  }
});

export default router;
