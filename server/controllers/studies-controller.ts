import { Router, Request, Response } from "express";
import { studyService } from "../services/study-service";
import { getPersonalizedRecommendations } from "../services/recommendation-engine";
import { searchRateLimiter, aiGenerationRateLimiter } from "../utils/rate-limiting";
import { requireAdmin } from "../auth";
import analyticsRoutes from "../routes/content-analytics-routes";

export class StudiesController {
  public router: Router;

  constructor() {
    this.router = Router();
    this.initializeRoutes();
  }

  private initializeRoutes() {
    // Mount analytics routes (legacy support from studies-router)
    this.router.use("/", analyticsRoutes);

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
    this.router.post("/:id/generate-blogs", requireAdmin, aiGenerationRateLimiter, this.generateBlogs);
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
          console.error("Error fetching years:", error);
          res.status(500).json({ error: "Failed to fetch years" });
      }
  }

  public getCountries = async (req: Request, res: Response) => {
      try {
          const stats = await studyService.getFilterStats();
          res.json(stats.countries);
      } catch (error) {
          console.error("Error fetching countries:", error);
          res.status(500).json({ error: "Failed to fetch countries" });
      }
  }

  public getStudyTypes = async (req: Request, res: Response) => {
      try {
          const stats = await studyService.getFilterStats();
          res.json(stats.studyTypes);
      } catch (error) {
          console.error("Error fetching study types:", error);
          res.status(500).json({ error: "Failed to fetch study types" });
      }
  }

  public getJournals = async (req: Request, res: Response) => {
      try {
          const stats = await studyService.getFilterStats();
          res.json(stats.journals);
      } catch (error) {
          console.error("Error fetching journals:", error);
          res.status(500).json({ error: "Failed to fetch journals" });
      }
  }
  
  public getFilters = async (req: Request, res: Response) => {
      try {
          const stats = await studyService.getFilterStats();
          res.json(stats);
      } catch (error) {
          console.error("Error fetching filters:", error);
          res.status(500).json({ error: "Failed to fetch filters" });
      }
  }

  public getOverview = async (req: Request, res: Response) => {
      try {
          const overview = await studyService.getOverview();
          res.json(overview);
      } catch (error) {
          console.error("Error fetching overview:", error);
          res.status(500).json({ error: "Failed to fetch overview" });
      }
  }

  private getTrends = async (req: Request, res: Response) => {
    try {
      const data = await studyService.getResearchTrends();
      res.json(data);
    } catch (error) {
      console.error("Error fetching research trends:", error);
      res.status(500).json({ message: "Failed to fetch research trends" });
    }
  };

  private getHealthOutcomes = async (req: Request, res: Response) => {
    try {
      const data = await studyService.getHealthOutcomes();
      res.json(data);
    } catch (error) {
      console.error("Error fetching health outcomes:", error);
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
      console.error("Error fetching studies by consumer category:", error);
      res.status(500).json({ success: false, message: "Failed to fetch studies by consumer category" });
    }
  };

  private getAllStudies = async (req: Request, res: Response) => {
    try {
      const result = await studyService.getStudies(req.query);
      res.json(result);
    } catch (error) {
       console.error("Error fetching studies:", error);
       res.status(500).json({ message: "Failed to fetch studies" });
    }
  };

  private getLatestStudies = async (req: Request, res: Response) => {
    try {
        const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;
        const result = await studyService.getLatestStudies(limit);
        res.json(result);
    } catch (error) {
        console.error("Error fetching latest studies:", error);
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
        console.error("Error fetching study:", error);
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
          console.error("Error fetching study by slug:", error);
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
          console.error("Error fetching related studies:", error);
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
          console.error("Error fetching detailed study:", error);
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
          console.error("Error fetching recommendations:", error);
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
          console.error("Error recording view:", error);
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
          console.error("Error fetching study insights:", error);
          res.status(500).json({ error: "Failed to fetch study insights" });
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
          console.error("Blog generation error:", error);

          if (error.message?.includes("already exist")) {
            return res.status(409).json({
              error: "Blog articles already exist for this study",
              message: error.message,
            });
          }

          res.status(500).json({ error: "Failed to generate blog articles" });
      }
  }
}

export const studiesController = new StudiesController();
