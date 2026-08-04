import { Router, Request, Response } from "express";
import { studyService } from "../services/study-service";
import { getPersonalizedRecommendations } from "../services/recommendation-engine";
import { searchRateLimiter, aiGenerationRateLimiter } from "../utils/rate-limiting";
import { requireAdmin } from "../auth";
import analyticsRoutes from "../routes/content-analytics-routes";
import { logger } from "../utils/logger";

export class StudiesController {
  public router: Router;

  constructor() {
    this.router = Router();
    this.initializeRoutes();
  }

  private initializeRoutes() {
    // Mount analytics routes (legacy support from studies-router)
    this.router.use("/", analyticsRoutes);

    // Named routes MUST come before /:id to avoid being caught by the param route
    this.router.get("/content-queue/status", requireAdmin, this.getContentQueueStatus);
    this.router.get("/stats", this.getStats);
    this.router.get("/analytics", this.getAnalytics);
    this.router.get("/timeline", this.getTimeline);
    this.router.get("/citation-network", this.getCitationNetwork);
    this.router.get("/trends", this.getTrends);
    this.router.get("/health-outcomes", this.getHealthOutcomes);
    this.router.get("/overview", this.getOverview);

    // Study deletion routes (must come before /:id param routes)
    this.router.get("/deleted-ledger", requireAdmin, this.getDeletedLedger);
    this.router.delete("/deleted-ledger/:ledgerId", requireAdmin, this.removeFromLedger);
    this.router.post("/deleted-ledger/bulk-remove", requireAdmin, this.bulkRemoveFromLedger);
    this.router.post("/check-deleted", requireAdmin, this.checkPreviouslyDeleted);
    this.router.delete("/bulk", requireAdmin, this.bulkDeleteStudies);
    this.router.get("/:id/deletion-preview", requireAdmin, this.getDeletionPreview);
    this.router.delete("/:id", requireAdmin, this.deleteStudy);

    this.router.get("/by-consumer-category", this.getStudiesByConsumerCategoryRoot);
    this.router.get("/by-consumer-category/:model/:category", this.getStudiesByConsumerCategory);
    this.router.get("/latest", this.getLatestStudies);
    this.router.get("/slug/:slug", this.getStudyBySlug);
    this.router.get("/metadata/related/:studyId", this.getRelatedStudies);
    this.router.get("/:id/detailed", this.getDetailedStudy);
    this.router.get("/:id/recommendations", this.getStudyRecommendations);
    this.router.get("/:id/insights", this.getStudyInsights);
    this.router.get("/:id/blogs", this.getStudyBlogs);
    this.router.post("/:id/generate-blogs", requireAdmin, aiGenerationRateLimiter, this.generateBlogs);
    this.router.post("/:id/generate-tldr", requireAdmin, aiGenerationRateLimiter, this.generateTldr);
    this.router.post("/batch-generate-tldrs", requireAdmin, this.batchGenerateTldrs);
    this.router.put("/:id", requireAdmin, this.updateStudy);
    this.router.post("/:id/view", this.recordView);
    this.router.get("/:id", this.getStudyById);
    this.router.get("/", searchRateLimiter, this.getAllStudies);
  }

  // Public getters for filters
  public getYears = async (req: Request, res: Response) => {
      try {
          const stats = await studyService.getFilterStats();
          res.json(stats.years);
      } catch (error) {
          logger.error("Error fetching years", error, "StudiesController");
          res.status(500).json({ error: "Failed to fetch years" });
      }
  }

  public getCountries = async (req: Request, res: Response) => {
      try {
          const stats = await studyService.getFilterStats();
          res.json(stats.countries);
      } catch (error) {
          logger.error("Error fetching countries", error, "StudiesController");
          res.status(500).json({ error: "Failed to fetch countries" });
      }
  }

  public getStudyTypes = async (req: Request, res: Response) => {
      try {
          const stats = await studyService.getFilterStats();
          res.json(stats.studyTypes);
      } catch (error) {
          logger.error("Error fetching study types", error, "StudiesController");
          res.status(500).json({ error: "Failed to fetch study types" });
      }
  }

  public getJournals = async (req: Request, res: Response) => {
      try {
          const stats = await studyService.getFilterStats();
          res.json(stats.journals);
      } catch (error) {
          logger.error("Error fetching journals", error, "StudiesController");
          res.status(500).json({ error: "Failed to fetch journals" });
      }
  }
  
  public getFilters = async (req: Request, res: Response) => {
      try {
          const stats = await studyService.getFilterStats();
          res.json(stats);
      } catch (error) {
          logger.error("Error fetching filters", error, "StudiesController");
          res.status(500).json({ error: "Failed to fetch filters" });
      }
  }

  private getContentQueueStatus = async (req: Request, res: Response) => {
    try {
      const { getQueueStatus } = await import("../services/content-generation-worker");
      const status = await getQueueStatus();
      res.json({ success: true, ...status });
    } catch (error) {
      logger.error("Error fetching content queue status", error, "StudiesController");
      res.status(500).json({ error: "Failed to fetch content queue status" });
    }
  };

  private getStats = async (req: Request, res: Response) => {
    try {
      const { pool } = await import("../db");
      const totalResult = await pool.query("SELECT COUNT(*) as count FROM studies");
      const totalStudies = parseInt(totalResult.rows[0]?.count || "0");
      res.json({ totalStudies });
    } catch (error) {
      logger.error("Error fetching stats", error, "StudiesController");
      res.status(500).json({ error: "Failed to fetch stats" });
    }
  };

  private getAnalytics = async (req: Request, res: Response) => {
    try {
      const { pool } = await import("../db");
      const totalResult = await pool.query("SELECT COUNT(*) as count FROM studies");
      const totalStudies = parseInt(totalResult.rows[0]?.count || "0");

      // Get top viewed studies as "high impact"
      const topStudies = await pool.query(
        `SELECT id, title, COALESCE(view_count, 0) as citations,
         COALESCE(publish_year, EXTRACT(YEAR FROM NOW())::int) as year
         FROM studies ORDER BY view_count DESC NULLS LAST LIMIT 5`
      );

      // Real stats from database
      const [countryResult, journalResult, humanResult, categoryResult, peakYearResult, recentAvgResult, oldestResult, countryBreakdown, categoryBreakdown, count2015, count2023] = await Promise.all([
        pool.query("SELECT COUNT(DISTINCT country) as count FROM studies WHERE country IS NOT NULL"),
        pool.query("SELECT COUNT(DISTINCT journal) as count FROM studies WHERE journal IS NOT NULL"),
        pool.query("SELECT COUNT(*) as count FROM studies WHERE LOWER(study_type) LIKE '%human%' OR LOWER(study_type) LIKE '%clinical%'"),
        pool.query("SELECT COUNT(DISTINCT category) as count FROM studies WHERE category IS NOT NULL"),
        pool.query("SELECT publish_year, COUNT(*) as cnt FROM studies WHERE publish_year IS NOT NULL GROUP BY publish_year ORDER BY cnt DESC LIMIT 1"),
        pool.query("SELECT ROUND(AVG(cnt)) as avg FROM (SELECT COUNT(*) as cnt FROM studies WHERE publish_year >= 2019 AND publish_year IS NOT NULL GROUP BY publish_year) t"),
        pool.query("SELECT MIN(publish_year) as min_year FROM studies WHERE publish_year IS NOT NULL AND publish_year > 1900"),
        pool.query("SELECT country, COUNT(*) as count FROM studies WHERE country IS NOT NULL GROUP BY country ORDER BY count DESC"),
        pool.query("SELECT category, COUNT(*) as count FROM studies WHERE category IS NOT NULL GROUP BY category ORDER BY count DESC"),
        pool.query("SELECT COUNT(*) as count FROM studies WHERE publish_year = 2015"),
        pool.query("SELECT COUNT(*) as count FROM studies WHERE publish_year = 2023"),
      ]);

      const totalCountries = parseInt(countryResult.rows[0]?.count || "0");
      const totalJournals = parseInt(journalResult.rows[0]?.count || "0");
      const humanTrials = parseInt(humanResult.rows[0]?.count || "0");
      const categories = parseInt(categoryResult.rows[0]?.count || "0");
      const peakYear = peakYearResult.rows[0]?.publish_year || 2020;
      const peakYearCount = parseInt(peakYearResult.rows[0]?.cnt || "0");
      const avgPerYear = parseInt(recentAvgResult.rows[0]?.avg || "0");
      const oldestYear = parseInt(oldestResult.rows[0]?.min_year || "2000");
      const yearsOfResearch = new Date().getFullYear() - oldestYear;
      const studies2015 = parseInt(count2015.rows[0]?.count || "1");
      const studies2023 = parseInt(count2023.rows[0]?.count || "1");
      const growthPct = studies2015 > 0 ? `${Math.round(((studies2023 - studies2015) / studies2015) * 100)}%` : "N/A";

      res.json({
        totalStudies,
        totalCountries,
        totalJournals,
        humanTrials,
        categories,
        peakYear,
        peakYearCount,
        avgPerYear,
        yearsOfResearch,
        growthPct,
        countryBreakdown: countryBreakdown.rows,
        categoryBreakdown: categoryBreakdown.rows,
        highImpactStudies: topStudies.rows.map((s: any) => ({
          title: s.title,
          citations: parseInt(s.citations) || 0,
          year: parseInt(s.year) || new Date().getFullYear(),
        })),
      });
    } catch (error) {
      logger.error("Error fetching analytics", error, "StudiesController");
      res.status(500).json({ error: "Failed to fetch analytics" });
    }
  };

  private getTimeline = async (req: Request, res: Response) => {
    try {
      const { pool } = await import("../db");
      const result = await pool.query(
        `SELECT publish_year as year,
         COUNT(*) as count
         FROM studies
         WHERE publish_year IS NOT NULL
         GROUP BY publish_year
         ORDER BY publish_year`
      );

      let cumulative = 0;
      let prevCount = 0;
      const yearlyData = result.rows
        .filter((r: any) => r.year && parseInt(r.year) >= 2000)
        .map((r: any) => {
          const annual = parseInt(r.count);
          cumulative += annual;
          const growthRate = prevCount > 0 ? Math.round(((annual - prevCount) / prevCount) * 100) : 0;
          prevCount = annual;
          return {
            year: parseInt(r.year),
            annual,
            cumulative,
            growthRate,
          };
        });

      res.json({ yearlyData });
    } catch (error) {
      logger.error("Error fetching timeline", error, "StudiesController");
      res.status(500).json({ error: "Failed to fetch timeline" });
    }
  };

  private getCitationNetwork = async (req: Request, res: Response) => {
    try {
      const { pool } = await import("../db");
      // Get top studies by view count for the network
      const result = await pool.query(
        `SELECT id, title, COALESCE(view_count, 0) as citations, category,
         COALESCE(publish_year, EXTRACT(YEAR FROM NOW())::int) as year
         FROM studies
         WHERE title IS NOT NULL
         ORDER BY view_count DESC NULLS LAST
         LIMIT 20`
      );

      const nodes = result.rows.map((s: any) => ({
        id: String(s.id),
        title: s.title,
        citations: parseInt(s.citations) || 0,
        category: s.category || "General",
        year: parseInt(s.year) || new Date().getFullYear(),
      }));

      // Generate links between studies that share categories
      const links: { source: string; target: string; strength: number }[] = [];
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          if (nodes[i].category === nodes[j].category) {
            links.push({
              source: nodes[i].id,
              target: nodes[j].id,
              strength: 0.5 + Math.random() * 0.4,
            });
          }
        }
      }

      const uniqueCategories = new Set(nodes.map((n: any) => n.category));
      const avgCitations = nodes.length > 0
        ? nodes.reduce((sum: number, n: any) => sum + n.citations, 0) / nodes.length
        : 0;

      res.json({
        nodes,
        links,
        stats: {
          totalNodes: nodes.length,
          totalConnections: links.length,
          clusters: uniqueCategories.size,
          averageCitations: Math.round(avgCitations * 10) / 10,
        },
      });
    } catch (error) {
      logger.error("Error fetching citation network", error, "StudiesController");
      res.status(500).json({ error: "Failed to fetch citation network" });
    }
  };

  public getOverview = async (req: Request, res: Response) => {
      try {
          const overview = await studyService.getOverview();
          res.json(overview);
      } catch (error) {
          logger.error("Error fetching overview", error, "StudiesController");
          res.status(500).json({ error: "Failed to fetch overview" });
      }
  }

  private getTrends = async (req: Request, res: Response) => {
    try {
      const data = await studyService.getResearchTrends();
      res.json(data);
    } catch (error) {
      logger.error("Error fetching research trends", error, "StudiesController");
      res.status(500).json({ message: "Failed to fetch research trends" });
    }
  };

  private getHealthOutcomes = async (req: Request, res: Response) => {
    try {
      const data = await studyService.getHealthOutcomes();
      res.json(data);
    } catch (error) {
      logger.error("Error fetching health outcomes", error, "StudiesController");
      res.status(500).json({ message: "Failed to fetch health outcomes" });
    }
  };

  private getStudiesByConsumerCategoryRoot = async (req: Request, res: Response) => {
    res.json({
      success: true,
      data: [],
      message: "Please specify a model and category to get studies",
    });
  };

  private getStudiesByConsumerCategory = async (req: Request, res: Response) => {
    try {
      const { model, category } = req.params;
      if (!model || !category) {
        return res.status(400).json({ success: false, message: "Model and category parameters are required" });
      }

      // Query REAL studies for this category. This endpoint previously
      // returned hardcoded fabricated studies with invented DOIs
      // (10.1234/hydro.2023.*) — unacceptable on an evidence database.
      const { db } = await import("../db");
      const { studies } = await import("../../shared/schema");
      const { sql, desc } = await import("drizzle-orm");

      const cat = category.trim();
      const contains = `%${cat}%`;

      let matchCondition;
      if (model === "body_system") {
        matchCondition = sql`(
          ${studies.category} ILIKE ${contains}
          OR EXISTS (SELECT 1 FROM unnest(coalesce(${studies.bodySystems}, ARRAY[]::text[])) v WHERE v ILIKE ${cat})
        )`;
      } else if (model === "condition") {
        matchCondition = sql`(
          ${studies.category} ILIKE ${contains}
          OR EXISTS (SELECT 1 FROM unnest(coalesce(${studies.healthConditions}, ARRAY[]::text[])) v WHERE v ILIKE ${cat})
          OR coalesce(${studies.consumerCategories}, '') ILIKE ${contains}
        )`;
      } else {
        // life_stage (and any unknown model) has no backing column on studies.
        // Return an honest empty result rather than fabricating studies.
        return res.json({ success: true, data: [] });
      }

      const rows = await db
        .select()
        .from(studies)
        .where(matchCondition)
        .orderBy(desc(studies.id))
        .limit(50);

      res.json({ success: true, data: rows });
    } catch (error) {
      logger.error("Error fetching studies by consumer category", error, "StudiesController");
      res.status(500).json({ success: false, message: "Failed to fetch studies by consumer category" });
    }
  };

  private getAllStudies = async (req: Request, res: Response) => {
    try {
      const result = await studyService.getStudies(req.query);
      res.json(result);
    } catch (error) {
       logger.error("Error fetching studies", error, "StudiesController");
       res.status(500).json({ message: "Failed to fetch studies" });
    }
  };

  private getLatestStudies = async (req: Request, res: Response) => {
    try {
        const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;
        const result = await studyService.getLatestStudies(limit);
        res.json(result);
    } catch (error) {
        logger.error("Error fetching latest studies", error, "StudiesController");
        res.status(500).json({ message: "Failed to fetch latest studies" });
    }
  };

  private getStudyById = async (req: Request, res: Response) => {
    try {
        const id = parseInt(req.params.id);
        if (isNaN(id)) return res.status(400).json({ message: "Invalid study ID format" });

        const study = await studyService.getStudyById(id);
        if (!study) return res.status(404).json({ message: "Study not found" });

        res.json(study);
    } catch (error) {
        logger.error("Error fetching study", error, "StudiesController");
        res.status(500).json({ message: "Failed to fetch study" });
    }
  };

  private getStudyBySlug = async (req: Request, res: Response) => {
      try {
          const { slug } = req.params;
          if (!slug) return res.status(400).json({ error: "Slug is required" });

          const study = await studyService.getStudyBySlug(slug);
          if (!study) return res.status(404).json({ error: "Study not found" });

          res.json(study);
      } catch (error) {
          logger.error("Error fetching study by slug", error, "StudiesController");
          res.status(500).json({ error: "Failed to fetch study" });
      }
  };

  private getRelatedStudies = async (req: Request, res: Response) => {
      try {
          const studyId = parseInt(req.params.studyId);
          if (isNaN(studyId)) return res.status(400).json({ error: "Invalid study ID" });

          const study = await studyService.getStudyById(studyId);
          if (!study) return res.status(404).json({ error: "Study not found" });

          const relatedStudies = await studyService.getRelatedStudies(studyId, study.category || "");
          res.json(relatedStudies);
      } catch (error) {
          logger.error("Error fetching related studies", error, "StudiesController");
          res.status(500).json({ error: "Failed to fetch related studies" });
      }
  }

  private getDetailedStudy = async (req: Request, res: Response) => {
      try {
          const studyId = parseInt(req.params.id);
          if (isNaN(studyId)) return res.status(400).json({ error: "Invalid study ID" });

          const study = await studyService.getStudyById(studyId);
          if (!study) return res.status(404).json({ error: "Study not found" });

          // Format response
          const response = {
            id: study.id,
            title: study.title,
            abstract: study.abstract,
            authors: study.authors,
            journal: study.journal,
            publishDate: study.publishDate || study.journalPublishDate,
            doi: study.doi,
            category: study.category,
            methods: study.methods,
            results: study.results,
            conclusion: study.conclusion,
            keywords: study.keywords && Array.isArray(study.keywords) ? study.keywords : [],
            imageUrl: study.imageUrl,
            viewCount: study.viewCount || 0,
            tags: [], 
            relatedStudies: [],
            citationInfo: {
              apa: `${study.authors} (${study.publishDate || study.journalPublishDate ? new Date(String(study.publishDate || study.journalPublishDate)).getFullYear() : "n.d."}). ${study.title}. ${study.journal}.`,
              mla: `${study.authors}. "${study.title}." ${study.journal}, ${study.publishDate || study.journalPublishDate ? new Date(String(study.publishDate || study.journalPublishDate)).getFullYear() : "n.d."}.`,
              chicago: `${study.authors}. "${study.title}." ${study.journal} (${study.publishDate || study.journalPublishDate ? new Date(String(study.publishDate || study.journalPublishDate)).getFullYear() : "n.d."}).`,
            },
          };

          res.json(response);
      } catch (error) {
          logger.error("Error fetching detailed study", error, "StudiesController");
          res.status(500).json({ error: "Failed to fetch detailed study" });
      }
  }

  private getStudyRecommendations = async (req: Request, res: Response) => {
      try {
          const studyId = parseInt(req.params.id);
          if (isNaN(studyId)) return res.status(400).json({ error: "Invalid study ID" });

          // Use the advanced recommendation engine
          const result = await getPersonalizedRecommendations({
            targetStudyId: studyId,
            recommendationType: "similar",
            maxResults: 4
          });
          
          res.json(result.recommendations);
      } catch (error) {
          logger.error("Error fetching recommendations", error, "StudiesController");
          res.status(500).json({ error: "Failed to fetch recommendations" });
      }
  }

  private recordView = async (req: Request, res: Response) => {
      try {
          const studyId = parseInt(req.params.id);
          if (isNaN(studyId)) return res.status(400).json({ error: "Invalid study ID" });

          await studyService.recordView(studyId);
          res.json({ success: true });
      } catch (error) {
          logger.error("Error recording view", error, "StudiesController");
          res.status(500).json({ error: "Failed to record view" });
      }
  }
  private getStudyInsights = async (req: Request, res: Response) => {
      try {
          const studyId = parseInt(req.params.id);
          if (isNaN(studyId)) return res.status(400).json({ error: "Invalid study ID" });

          const insights = await studyService.getStudyInsights(studyId);
          res.json(insights || {});
      } catch (error) {
          logger.error("Error fetching study insights", error, "StudiesController");
          res.status(500).json({ error: "Failed to fetch study insights" });
      }
  }

  private updateStudy = async (req: Request, res: Response) => {
      try {
          const studyId = parseInt(req.params.id);
          if (isNaN(studyId)) return res.status(400).json({ error: "Invalid study ID" });

          // Validate + whitelist the body instead of passing raw req.body into
          // db.update().set(). This strips unknown keys, blocks mass-assignment
          // of protected columns (id/createdAt/lastModified are already omitted
          // by insertStudySchema; slug/viewCount omitted here to protect
          // canonical URLs, the redirect system, and the view counter), and
          // rejects an empty update (which otherwise threw "No values to set").
          const { insertStudySchema } = await import("../../shared/schema");
          const updateSchema = insertStudySchema.partial().omit({ slug: true, viewCount: true });
          const parsed = updateSchema.safeParse(req.body);
          if (!parsed.success) {
              return res.status(400).json({ error: "Invalid study data", details: parsed.error.flatten() });
          }
          if (Object.keys(parsed.data).length === 0) {
              return res.status(400).json({ error: "No valid fields to update" });
          }

          const updatedStudy = await studyService.updateStudy(studyId, parsed.data);
          if (!updatedStudy) return res.status(404).json({ error: "Study not found" });
          res.json(updatedStudy);
      } catch (error) {
          logger.error("Error updating study", error, "StudiesController");
          res.status(500).json({ error: "Failed to update study" });
      }
  }

  private checkPreviouslyDeleted = async (req: Request, res: Response) => {
      try {
          const { title, doi } = req.body;
          if (!title && !doi) return res.status(400).json({ error: "title or doi is required" });

          const deletion = await studyService.checkPreviouslyDeleted(title || "", doi);
          if (!deletion) return res.json({ previouslyDeleted: false });

          res.json({
            previouslyDeleted: true,
            deletion: {
              title: deletion.title,
              doi: deletion.doi,
              deletedBy: deletion.deletedBy,
              deletedAt: deletion.deletedAt,
              reason: deletion.reason,
            },
          });
      } catch (error) {
          logger.error("Error checking deleted studies", error, "StudiesController");
          res.status(500).json({ error: "Failed to check deleted studies" });
      }
  }

  private getDeletedLedger = async (req: Request, res: Response) => {
      try {
          const page = parseInt(req.query.page as string) || 1;
          const pageSize = parseInt(req.query.pageSize as string) || 20;
          const result = await studyService.getDeletedStudies(page, pageSize);
          res.json(result);
      } catch (error) {
          logger.error("Error fetching deletion ledger", error, "StudiesController");
          res.status(500).json({ error: "Failed to fetch deletion ledger" });
      }
  }

  private removeFromLedger = async (req: Request, res: Response) => {
      try {
          const id = parseInt(req.params.ledgerId);
          if (isNaN(id)) return res.status(400).json({ error: "Invalid ledger entry ID" });
          const removed = await studyService.removeFromDeletionLedger(id);
          if (!removed) return res.status(404).json({ error: "Ledger entry not found" });
          res.json({ success: true });
      } catch (error) {
          logger.error("Error removing from deletion ledger", error, "StudiesController");
          res.status(500).json({ error: "Failed to remove from deletion ledger" });
      }
  }

  private bulkRemoveFromLedger = async (req: Request, res: Response) => {
      try {
          const { ids } = req.body;
          if (!Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ error: "ids must be a non-empty array" });
          }
          const parsedIds = ids.map((id: any) => parseInt(id)).filter((id: number) => !isNaN(id));
          const result = await studyService.bulkRemoveFromDeletionLedger(parsedIds);
          res.json(result);
      } catch (error) {
          logger.error("Error bulk removing from deletion ledger", error, "StudiesController");
          res.status(500).json({ error: "Failed to bulk remove from deletion ledger" });
      }
  }

  private getDeletionPreview = async (req: Request, res: Response) => {
      try {
          const id = parseInt(req.params.id);
          if (isNaN(id)) return res.status(400).json({ error: "Invalid study ID" });

          const preview = await studyService.getDeletionPreview(id);
          if (!preview) return res.status(404).json({ error: "Study not found" });

          res.json(preview);
      } catch (error) {
          logger.error("Error fetching deletion preview", error, "StudiesController");
          res.status(500).json({ error: "Failed to fetch deletion preview" });
      }
  }

  private deleteStudy = async (req: Request, res: Response) => {
      try {
          const id = parseInt(req.params.id);
          if (isNaN(id)) return res.status(400).json({ error: "Invalid study ID" });

          const deletedBy = (req as any).user?.username || (req as any).user?.id || "admin";
          const reason = req.body?.reason || null;
          const result = await studyService.deleteStudy(id, deletedBy, reason);
          if (!result) return res.status(404).json({ error: "Study not found" });

          res.json(result);
      } catch (error) {
          logger.error("Error deleting study", error, "StudiesController");
          res.status(500).json({ error: "Failed to delete study" });
      }
  }

  private bulkDeleteStudies = async (req: Request, res: Response) => {
      try {
          const { studyIds } = req.body;
          if (!Array.isArray(studyIds) || studyIds.length === 0) {
            return res.status(400).json({ error: "studyIds must be a non-empty array" });
          }
          if (studyIds.length > 100) {
            return res.status(400).json({ error: "Cannot delete more than 100 studies at once" });
          }

          const ids = studyIds.map((id: any) => parseInt(id)).filter((id: number) => !isNaN(id));
          if (ids.length === 0) {
            return res.status(400).json({ error: "No valid study IDs provided" });
          }

          const deletedBy = (req as any).user?.username || (req as any).user?.id || "admin";
          const reason = req.body?.reason || null;
          const result = await studyService.bulkDeleteStudies(ids, deletedBy, reason);
          res.json(result);
      } catch (error: any) {
          logger.error("Error bulk deleting studies", error, "StudiesController");
          if (error.message?.includes("more than 100")) {
            return res.status(400).json({ error: error.message });
          }
          res.status(500).json({ error: "Failed to bulk delete studies" });
      }
  }

  private getStudyBlogs = async (req: Request, res: Response) => {
      try {
          const studyId = parseInt(req.params.id);
          if (isNaN(studyId)) return res.status(400).json({ error: "Invalid study ID" });

          const { db } = await import("../db");
          const { blogArticles } = await import("../../shared/schema");
          const { eq, desc } = await import("drizzle-orm");

          const blogs = await db
            .select()
            .from(blogArticles)
            .where(eq(blogArticles.studyId, studyId))
            .orderBy(desc(blogArticles.createdAt));

          res.json(blogs);
      } catch (error) {
          logger.error("Error fetching study blogs", error, "StudiesController");
          res.status(500).json({ error: "Failed to fetch study blogs" });
      }
  }

  private generateBlogs = async (req: Request, res: Response) => {
      try {
          const studyId = parseInt(req.params.id);
          if (isNaN(studyId)) return res.status(400).json({ error: "Invalid study ID" });

          const study = await studyService.getStudyById(studyId);
          if (!study) return res.status(404).json({ error: "Study not found" });

          // Pass through article-type selections and reading-level override.
          // If `articleTypes` is provided, the generator uses exactly that list;
          // otherwise it falls back to the default set from the shared registry.
          const options = {
            count: req.body.count,
            includeAllTypes: req.body.includeAllTypes || false,
            fallbackToBasic: true,
            articleTypes: Array.isArray(req.body.articleTypes) ? req.body.articleTypes : undefined,
            readingLevel: req.body.readingLevel || undefined,
          };

          // Dynamic import to avoid circular dependencies
          const { generateBlogArticlesForStudy } = await import(
            "../services/blog-generator-enhanced"
          );

          const result = await generateBlogArticlesForStudy(study, options);

          // generateBlogArticlesForStudy already persists every returned
          // article (see its contract) — re-inserting here collided on the
          // unique slug and made the endpoint always report saved: 0. The
          // returned rows are the saved rows.
          res.json({
            success: true,
            articles: result.articles,
            generated: result.articles.length,
            saved: result.articles.length,
            errors: result.errors,
            warnings: result.warnings,
          });
      } catch (error: any) {
          logger.error("Blog generation error", error, "StudiesController");

          if (error.message?.includes("already exist")) {
            return res.status(409).json({
              error: "Blog articles already exist for this study",
              message: error.message,
            });
          }

          res.status(500).json({ error: "Failed to generate blog articles" });
      }
  }

  private generateTldr = async (req: Request, res: Response) => {
      try {
          const studyId = parseInt(req.params.id);
          if (isNaN(studyId)) return res.status(400).json({ error: "Invalid study ID" });

          const study = await studyService.getStudyById(studyId);
          if (!study) return res.status(404).json({ error: "Study not found" });

          const { ai, MODELS } = await import("../services/ai-provider");

          const prompt = `You are a science communicator. Write a TL;DR (too long; didn't read) summary of this study in 1-2 simple sentences.

Use plain language a 6th grader could understand. Focus on the key finding and why it matters. Do NOT use scientific jargon. Be conversational and direct.

Study title: ${study.title}
Abstract: ${study.abstract}
${study.conclusion ? `Conclusion: ${study.conclusion}` : ""}

Write ONLY the TL;DR text, nothing else. No labels, no quotes.`;

          const tldr = (
            await ai.generateText("", prompt, {
              model: MODELS.SONNET,
              maxTokens: 200,
              temperature: null,
              effort: "low", // 1-2 sentence TLDR — no deep reasoning needed
              caller: "StudiesController.generateTldr",
            })
          ).trim();

          if (!tldr) {
            return res.status(500).json({ error: "Failed to generate TLDR" });
          }

          // Save to database
          const { db } = await import("../db");
          const { studies } = await import("../../shared/schema");
          const { eq } = await import("drizzle-orm");

          await db.update(studies).set({ tldr }).where(eq(studies.id, studyId));

          res.json({ success: true, tldr });
      } catch (error) {
          logger.error("TLDR generation error", error, "StudiesController");
          res.status(500).json({ error: "Failed to generate TLDR" });
      }
  }

  private batchGenerateTldrs = async (req: Request, res: Response) => {
      try {
          const limit = Math.min(parseInt(req.body.limit) || 10, 50);

          const { db } = await import("../db");
          const { studies } = await import("../../shared/schema");
          const { isNull, sql } = await import("drizzle-orm");

          // Get studies without TLDRs
          const studiesWithoutTldr = await db
            .select({ id: studies.id, title: studies.title, abstract: studies.abstract, conclusion: studies.conclusion })
            .from(studies)
            .where(isNull(studies.tldr))
            .limit(limit);

          if (studiesWithoutTldr.length === 0) {
            return res.json({ success: true, message: "All studies already have TLDRs", generated: 0 });
          }

          const { generateStudyTldr } = await import("../services/tldr-generator");
          const { MODELS } = await import("../services/ai-provider");
          const { eq } = await import("drizzle-orm");

          let generated = 0;
          const errors: string[] = [];

          for (const study of studiesWithoutTldr) {
            try {
              const tldr = await generateStudyTldr(study, {
                model: MODELS.SONNET,
                effort: "low", // 1-2 sentence TLDR — no deep reasoning needed
                caller: "StudiesController.batchTldr",
              });
              if (tldr) {
                await db.update(studies).set({ tldr }).where(eq(studies.id, study.id));
                generated++;
              }
            } catch (err: any) {
              errors.push(`Study ${study.id}: ${err.message}`);
            }
          }

          res.json({
            success: true,
            generated,
            remaining: studiesWithoutTldr.length - generated,
            errors: errors.length > 0 ? errors : undefined,
          });
      } catch (error) {
          logger.error("Batch TLDR generation error", error, "StudiesController");
          res.status(500).json({ error: "Failed to batch generate TLDRs" });
      }
  }
}

export const studiesController = new StudiesController();
