import { Request, Response, Router } from "express";
import { studyService } from "../services/study-service";
import { searchRateLimiter } from "../utils/rate-limiting";
import { asyncHandler } from "../utils/error-handler";

export class SearchController {
  public router: Router;

  constructor() {
    this.router = Router();
    this.initializeRoutes();
  }

  private initializeRoutes() {
    // Advanced search with multiple filters
    this.router.get(
      "/advanced-search",
      searchRateLimiter,
      asyncHandler(this.advancedSearch.bind(this))
    );

    // Enhanced search with suggestions/trending (consolidated)
    this.router.get(
        "/search/enhanced",
        searchRateLimiter,
        asyncHandler(this.enhancedSearch.bind(this))
    );

    // Search suggestions
    this.router.get(
      "/search/suggestions",
      asyncHandler(this.getSuggestions.bind(this))
    );

    // Trending topics
    this.router.get(
      "/search/trending",
      asyncHandler(this.getTrending.bind(this))
    );

    // Classic search (simple)
    this.router.get(
        "/search",
        searchRateLimiter,
        asyncHandler(this.simpleSearch.bind(this))
    );
     
    // Natural language search endpoint
    // Note: ensure this doesn't conflict with existing natural-language-search-routes
    // if we migrate that later.
  }

  // Corresponds to /api/advanced-search from index.ts
  private async advancedSearch(req: Request, res: Response) {
    // Clamp pagination to sane bounds (these values drive DB work)
    const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit ?? "20"), 10) || 20));
    const offset = Math.max(0, parseInt(String(req.query.offset ?? "0"), 10) || 0);
    const filters = {
       search: String(req.query.search || "").trim(),
       category: String(req.query.category || "").trim(),
       country: String(req.query.country || "").trim(),
       sortBy: String(req.query.sort_by || "id"),
       limit,
       page: Math.max(1, Math.floor(offset / limit) + 1)
    };

    const result = await studyService.getStudies(filters);

    res.json({
        studies: result.data,
        total: result.total,
        hasMore: (result.page * result.pageSize) < result.total,
        filters: filters
    });
  }

  // Corresponds to /api/search/enhanced from routes.ts
  private async enhancedSearch(req: Request, res: Response) {
      const query = String(req.query.query || "").trim();
      // Clamp pagination to sane bounds (these values drive DB work)
      const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? "20"), 10) || 20));
      const offset = Math.max(0, parseInt(String(req.query.offset ?? "0"), 10) || 0);
      const page = Math.floor(offset / limit) + 1;

      // Same logic as before: if no query, return recent studies
      if (!query) {
          const recent = await studyService.getLatestStudies(limit);
           // We need total count for pagination, getStudies can do this efficiently
           const allResults = await studyService.getStudies({ limit, page });
           
           return res.json({
               data: allResults.data.map(study => ({
                   ...study,
                   relevanceScore: 0.5,
                   tags: [],
                   relatedStudies: []
               })),
               total: allResults.total,
               facets: { tags: [], journals: [], years: [] },
               suggestions: [],
               trending: []
           });
      }

      // Perform search
      const results = await studyService.getStudies({ query, limit, page });
      
      res.json({
          data: results.data.map(study => ({
              ...study,
              relevanceScore: 0.9,
              tags: [],
              relatedStudies: []
          })),
          total: results.total,
          facets: { tags: [], journals: [], years: [] },
          suggestions: [],
          trending: []
      });
  }

  private async getSuggestions(req: Request, res: Response) {
      const query = String(req.query.query || "");
      const suggestions = await studyService.getSearchSuggestions(query);
      res.json(suggestions);
  }

  private async getTrending(req: Request, res: Response) {
      const trending = await studyService.getTrendingTopics();
      res.json({ trending });
  }

  // Corresponds to /api/search from index.ts
  private async simpleSearch(req: Request, res: Response) {
      const query = String(req.query.q || "").trim();
      // Clamp pagination to sane bounds (these values drive DB work)
      const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit ?? "20"), 10) || 20));
      const offset = Math.max(0, parseInt(String(req.query.offset ?? "0"), 10) || 0);
      const page = Math.floor(offset / limit) + 1;

      if (!query) {
          return res.status(400).json({ error: "Search query required" });
      }

      const results = await studyService.getStudies({ query, limit, page });

      res.json({
          success: true,
          studies: results.data,
          total: results.total,
          hasMore: (results.page * results.pageSize) < results.total 
      });
  }
}

export const searchController = new SearchController();
