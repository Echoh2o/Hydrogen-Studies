/**
 * Unified Search Routes
 * Combines keyword search, natural language search, and Consensus API
 * into a single powerful search endpoint
 */

import { Router, Request, Response } from "express";
import { studyService } from "../services/study-service";
import { searchRateLimiter } from "../utils/rate-limiting";

const router = Router();

/**
 * GET /api/unified-search
 * Universal search that searches across local database, NL understanding,
 * and optionally Consensus API for external papers
 */
router.get("/", searchRateLimiter, async (req: Request, res: Response) => {
  try {
    const query = String(req.query.q || req.query.query || req.query.search || "").trim();
    const page = Math.max(1, parseInt(String(req.query.page || "1")));
    const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit || "20"))));
    const category = String(req.query.category || "").trim();
    const country = String(req.query.country || "").trim();
    const includeExternal = req.query.includeExternal === "true";
    const offset = (page - 1) * limit;

    // Search local database
    const filters: Record<string, any> = {
      page,
      limit,
    };
    if (query) filters.search = query;
    if (category && category !== "all") filters.category = category;
    if (country && country !== "all") filters.country = country;

    const localResults = await studyService.getStudies(filters);

    // Build response
    const response: any = {
      success: true,
      query,
      studies: localResults.data,
      total: localResults.total,
      page: localResults.page,
      pageSize: localResults.pageSize,
      totalPages: Math.ceil(localResults.total / localResults.pageSize),
      hasMore: localResults.page * localResults.pageSize < localResults.total,
      filters: { category, country },
    };

    // Optionally search Consensus for external papers
    if (includeExternal && query) {
      try {
        const { searchHydrogenPapers } = await import("../services/consensus-api");
        const consensusResult = await searchHydrogenPapers(query);
        response.externalPapers = consensusResult.papers.map((p) => ({
          title: p.paper_title,
          authors: p.paper_authors.join(", "),
          journal: p.publication_journal_name,
          year: p.paper_publish_year,
          doi: p.doi,
          abstract: p.abstract,
          detailsUrl: p.consensus_paper_details_url,
          source: "consensus",
        }));
        response.externalTotal = consensusResult.total;
      } catch (err) {
        // Consensus is optional - don't fail the whole search
        console.warn("Consensus search failed (non-critical):", err);
        response.externalPapers = [];
        response.externalTotal = 0;
        response.externalError = "External search temporarily unavailable";
      }
    }

    res.json(response);
  } catch (error: any) {
    console.error("Unified search error:", error);
    res.status(500).json({
      success: false,
      error: "Search failed. Please try again.",
    });
  }
});

export default router;
