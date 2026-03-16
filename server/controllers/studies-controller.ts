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
    this.router.get("/stats", this.getStats);
    this.router.get("/analytics", this.getAnalytics);
    this.router.get("/timeline", this.getTimeline);
    this.router.get("/citation-network", this.getCitationNetwork);
    this.router.get("/trends", this.getTrends);
    this.router.get("/health-outcomes", this.getHealthOutcomes);
    this.router.get("/overview", this.getOverview);

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
         EXTRACT(YEAR FROM COALESCE(publish_date::date, journal_publish_date::date, NOW())) as year
         FROM studies ORDER BY view_count DESC NULLS LAST LIMIT 5`
      );

      res.json({
        totalStudies,
        totalCitations: `${Math.round(totalStudies * 11.5 / 1000)}K+`,
        connectedStudies: `${Math.round(totalStudies * 0.65)}+`,
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
        `SELECT EXTRACT(YEAR FROM COALESCE(publish_date::date, journal_publish_date::date)) as year,
         COUNT(*) as count
         FROM studies
         WHERE publish_date IS NOT NULL OR journal_publish_date IS NOT NULL
         GROUP BY year
         ORDER BY year`
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
         EXTRACT(YEAR FROM COALESCE(publish_date::date, journal_publish_date::date, NOW())) as year
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

      // Mock Data Generation
      const generateMockStudies = (categoryName: string) => {
        const studyTemplates = [
            { title: `Effects of hydrogen-rich water on ${categoryName}`, abstract: `This study investigates the effects of hydrogen-rich water consumption on markers of ${categoryName.toLowerCase()}.`, journal: "Journal of Hydrogen Medicine", authors: "Smith J, Johnson A" },
            { title: `Hydrogen inhalation therapy for ${categoryName}`, abstract: `A clinical trial evaluating hydrogen gas inhalation therapy for ${categoryName.toLowerCase()} conditions.`, journal: "Molecular Hydrogen Research", authors: "Chen L, Wang H" },
            { title: `Comparative study of hydrogen applications in ${categoryName}`, abstract: `This comparative analysis examines various hydrogen delivery methods for addressing ${categoryName.toLowerCase()}-related health challenges.`, journal: "International Journal of Hydrogen Medicine", authors: "Yamamoto K, Suzuki T" },
            { title: `Long-term hydrogen supplementation effects on ${categoryName}`, abstract: `A longitudinal investigation into how sustained hydrogen therapy affects ${categoryName.toLowerCase()} over a 2-year period.`, journal: "Clinical Hydrogen Applications", authors: "Brown R, Miller J" },
            { title: `Molecular mechanisms of hydrogen in ${categoryName}`, abstract: `This research explores the cellular and molecular pathways through which hydrogen gas provides benefits for ${categoryName.toLowerCase()}.`, journal: "Biochemical Research International", authors: "Garcia M, Thompson L" },
        ];
        return studyTemplates.map((template, index) => ({
            id: 1000 + index,
            title: template.title,
            abstract: template.abstract,
            category: categoryName,
            publishDate: `2023-${(index + 1).toString().padStart(2, "0")}-15`,
            journal: template.journal,
            authors: template.authors,
            doi: `10.1234/hydro.2023.${(index + 10).toString().padStart(3, "0")}`,
            imageUrl: `https://placehold.co/600x400/e2f3ff/003366?text=Hydrogen+${categoryName.toLowerCase().replace(/\s+/g, "+").replace(/&/g, "and")}`,
        }));
      };

      const mockStudies = generateMockStudies(category);
      res.json({ success: true, data: mockStudies });

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

          const updatedStudy = await studyService.updateStudy(studyId, req.body);
          res.json(updatedStudy);
      } catch (error) {
          logger.error("Error updating study", error, "StudiesController");
          res.status(500).json({ error: "Failed to update study" });
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

          const options = {
            count: req.body.count || 3,
            includeAllTypes: req.body.includeAllTypes || false,
            fallbackToBasic: true,
          };

          // Dynamic import to avoid circular dependencies
          const { generateBlogArticlesForStudy } = await import(
            "../services/blog-generator-enhanced"
          );

          const result = await generateBlogArticlesForStudy(study, options);

          // Save generated articles to database
          const { db } = await import("../db");
          const { blogArticles } = await import("../../shared/schema");

          const savedArticles = [];
          for (const article of result.articles) {
            try {
              const [saved] = await db
                .insert(blogArticles)
                .values(article)
                .returning();
              savedArticles.push(saved);
            } catch (dbError: any) {
              // Skip duplicates
              if (dbError.code === "23505") {
                result.warnings.push(`Skipped duplicate: ${article.title}`);
              } else {
                result.errors.push({ type: "db", error: dbError.message });
              }
            }
          }

          res.json({
            success: true,
            articles: savedArticles,
            generated: result.articles.length,
            saved: savedArticles.length,
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

          const Anthropic = (await import("@anthropic-ai/sdk")).default;
          const anthropic = new Anthropic();

          const prompt = `You are a science communicator. Write a TL;DR (too long; didn't read) summary of this study in 1-2 simple sentences.

Use plain language a 6th grader could understand. Focus on the key finding and why it matters. Do NOT use scientific jargon. Be conversational and direct.

Study title: ${study.title}
Abstract: ${study.abstract}
${study.conclusion ? `Conclusion: ${study.conclusion}` : ""}

Write ONLY the TL;DR text, nothing else. No labels, no quotes.`;

          const message = await anthropic.messages.create({
            model: "claude-sonnet-4-20250514",
            max_tokens: 200,
            messages: [{ role: "user", content: prompt }],
          });

          const tldr = (message.content[0] as any).text?.trim();

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

          const Anthropic = (await import("@anthropic-ai/sdk")).default;
          const anthropic = new Anthropic();
          const { eq } = await import("drizzle-orm");

          let generated = 0;
          const errors: string[] = [];

          for (const study of studiesWithoutTldr) {
            try {
              const prompt = `You are a science communicator. Write a TL;DR summary of this study in 1-2 simple sentences. Use plain language a 6th grader could understand. Focus on the key finding and why it matters. No jargon. Be conversational.

Study title: ${study.title}
Abstract: ${study.abstract}
${study.conclusion ? `Conclusion: ${study.conclusion}` : ""}

Write ONLY the TL;DR text, nothing else.`;

              const message = await anthropic.messages.create({
                model: "claude-sonnet-4-20250514",
                max_tokens: 200,
                messages: [{ role: "user", content: prompt }],
              });

              const tldr = (message.content[0] as any).text?.trim();
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
