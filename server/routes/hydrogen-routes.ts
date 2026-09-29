import { Router, Request, Response } from "express";
import { logger } from "../utils/logger";
import { db } from "../db";
import { studies } from "@shared/schema";
import {
  benefits,
  demographics,
  mechanisms,
  deliveryMethods,
  durationCategories,
  studyBenefits,
  studyDemographics,
  studyMechanisms,
  studyDeliveryMethods,
  studyDurations,
  studyOutcomes,
} from "@shared/schema-hydrogen-fields";
import { and, eq, sql } from "drizzle-orm";
import {
  exploreHubExists,
  getConditionHubStudies,
  getConditionHubSummaries,
  getExploreDetailStudies,
  getLiveExploreHubs,
} from "../middleware/seo-body-renderer";
import { exploreHubPath, isExploreHubType, isListedExploreHubType } from "@shared/explore-hubs";

const router = Router();

/**
 * Get all benefits
 */
router.get("/api/benefits", async (_req: Request, res: Response) => {
  try {
    const allBenefits = await db
      .select()
      .from(benefits)
      .orderBy(benefits.displayOrder);
    res.json(allBenefits);
  } catch (error) {
    logger.error("Error fetching benefits", error, "HydrogenRoutes");
    res.status(500).json({ error: "Failed to fetch benefits" });
  }
});

/**
 * Get benefit by slug
 */
router.get("/api/benefits/:slug", async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;

    const [benefit] = await db
      .select()
      .from(benefits)
      .where(eq(benefits.slug, slug));

    if (!benefit) {
      return res.status(404).json({ error: "Benefit not found" });
    }

    res.json(benefit);
  } catch (error) {
    logger.error("Error fetching benefit by slug", error, "HydrogenRoutes", { slug: req.params.slug });
    res.status(500).json({ error: "Failed to fetch benefit" });
  }
});

/**
 * Get studies by benefit
 */
router.get(
  "/api/benefits/:slug/studies",
  async (req: Request, res: Response) => {
    try {
      const { slug } = req.params;

      const [benefit] = await db
        .select()
        .from(benefits)
        .where(eq(benefits.slug, slug));

      if (!benefit) {
        return res.status(404).json({ error: "Benefit not found" });
      }

      const studiesWithBenefit = await db
        .select({
          study: studies,
          benefitId: studyBenefits.benefitId,
        })
        .from(studies)
        .innerJoin(studyBenefits, eq(studies.id, studyBenefits.studyId))
        .where(and(eq(studyBenefits.benefitId, benefit.id), eq(studies.isExcluded, false)));

      // Extract just the study data
      const result = studiesWithBenefit.map((item) => item.study);

      res.json({
        benefit,
        studies: result,
      });
    } catch (error) {
      logger.error("Error fetching studies for benefit", error, "HydrogenRoutes", { slug: req.params.slug });
      res.status(500).json({ error: "Failed to fetch studies" });
    }
  },
);

/**
 * Get all demographics
 */
router.get("/api/demographics", async (_req: Request, res: Response) => {
  try {
    const allDemographics = await db
      .select()
      .from(demographics)
      .orderBy(demographics.displayOrder);
    res.json(allDemographics);
  } catch (error) {
    logger.error("Error fetching demographics", error, "HydrogenRoutes");
    res.status(500).json({ error: "Failed to fetch demographics" });
  }
});

/**
 * Get demographic by slug
 */
router.get("/api/demographics/:slug", async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;

    const [demographic] = await db
      .select()
      .from(demographics)
      .where(eq(demographics.slug, slug));

    if (!demographic) {
      return res.status(404).json({ error: "Demographic not found" });
    }

    res.json(demographic);
  } catch (error) {
    logger.error("Error fetching demographic by slug", error, "HydrogenRoutes", { slug: req.params.slug });
    res.status(500).json({ error: "Failed to fetch demographic" });
  }
});

/**
 * Get studies by demographic
 */
router.get(
  "/api/demographics/:slug/studies",
  async (req: Request, res: Response) => {
    try {
      const { slug } = req.params;

      const [demographic] = await db
        .select()
        .from(demographics)
        .where(eq(demographics.slug, slug));

      if (!demographic) {
        return res.status(404).json({ error: "Demographic not found" });
      }

      const studiesWithDemographic = await db
        .select({
          study: studies,
          demographicId: studyDemographics.demographicId,
        })
        .from(studies)
        .innerJoin(studyDemographics, eq(studies.id, studyDemographics.studyId))
        .where(and(eq(studyDemographics.demographicId, demographic.id), eq(studies.isExcluded, false)));

      // Extract just the study data
      const result = studiesWithDemographic.map((item) => item.study);

      res.json({
        demographic,
        studies: result,
      });
    } catch (error) {
      logger.error("Error fetching studies for demographic", error, "HydrogenRoutes", { slug: req.params.slug });
      res.status(500).json({ error: "Failed to fetch studies" });
    }
  },
);

/**
 * Get all mechanisms
 */
router.get("/api/mechanisms", async (_req: Request, res: Response) => {
  try {
    const allMechanisms = await db
      .select()
      .from(mechanisms)
      .orderBy(mechanisms.displayOrder);
    res.json(allMechanisms);
  } catch (error) {
    logger.error("Error fetching mechanisms", error, "HydrogenRoutes");
    res.status(500).json({ error: "Failed to fetch mechanisms" });
  }
});

/**
 * Get mechanism by slug
 */
router.get("/api/mechanisms/:slug", async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;

    const [mechanism] = await db
      .select()
      .from(mechanisms)
      .where(eq(mechanisms.slug, slug));

    if (!mechanism) {
      return res.status(404).json({ error: "Mechanism not found" });
    }

    res.json(mechanism);
  } catch (error) {
    logger.error("Error fetching mechanism by slug", error, "HydrogenRoutes", { slug: req.params.slug });
    res.status(500).json({ error: "Failed to fetch mechanism" });
  }
});

/**
 * Get studies by mechanism
 */
router.get(
  "/api/mechanisms/:slug/studies",
  async (req: Request, res: Response) => {
    try {
      const { slug } = req.params;

      const [mechanism] = await db
        .select()
        .from(mechanisms)
        .where(eq(mechanisms.slug, slug));

      if (!mechanism) {
        return res.status(404).json({ error: "Mechanism not found" });
      }

      const studiesWithMechanism = await db
        .select({
          study: studies,
          mechanismId: studyMechanisms.mechanismId,
        })
        .from(studies)
        .innerJoin(studyMechanisms, eq(studies.id, studyMechanisms.studyId))
        .where(and(eq(studyMechanisms.mechanismId, mechanism.id), eq(studies.isExcluded, false)));

      // Extract just the study data
      const result = studiesWithMechanism.map((item) => item.study);

      res.json({
        mechanism,
        studies: result,
      });
    } catch (error) {
      logger.error("Error fetching studies for mechanism", error, "HydrogenRoutes", { slug: req.params.slug });
      res.status(500).json({ error: "Failed to fetch studies" });
    }
  },
);

/**
 * Explore-hub APIs. Every "does this hub exist" answer comes from
 * seo-body-renderer exploreHubExists — the same predicate that makes the
 * crawler renderer 404 an unknown hub and the SPA shell fallback answer
 * HTTP 404 — so an unknown slug is a 404 for bots, browsers and the SPA alike.
 *
 * Route order matters: /hubs is registered before /:slug.
 */

/**
 * Hubs linked from an /explore-by-<type> index — the crawler index renders
 * the same list (seo-body-renderer getLiveExploreHubs / getConditionHubSummaries),
 * so the SPA and bot indexes link the same hubs with the same counts.
 * Listed types: the curated slugs whose page lists ≥1 study. condition: the
 * health_conditions hubs with studies, most-studied first.
 */
router.get("/api/explore/:type/hubs", async (req: Request, res: Response) => {
  const { type } = req.params;
  if (type !== "condition" && !isListedExploreHubType(type)) {
    return res.status(404).json({ error: "Not found" });
  }
  try {
    const hubs = type === "condition" ? await getConditionHubSummaries() : await getLiveExploreHubs(type);
    res.set("Cache-Control", "public, max-age=300");
    res.json({ hubs });
  } catch (error) {
    logger.error("Error fetching explore hubs", error, "HydrogenRoutes", { type });
    res.status(500).json({ error: "Failed to fetch hubs" });
  }
});

/**
 * Studies on an /explore-by-<type>/<slug> detail hub — exactly the list the
 * crawler renderer shows for that URL (seo-body-renderer
 * getExploreDetailStudies), so the SPA page and the bot HTML match. The six
 * sitemap mechanism hubs (hydrogen-water, …) are delivery modes, not rows of
 * the `mechanisms` table, so /api/mechanisms/:slug can't serve them.
 * 404 when the hub doesn't exist → the SPA page renders NotFound.
 */
router.get("/api/explore/:type/:slug/studies", async (req: Request, res: Response) => {
  const { type, slug } = req.params;
  if (type !== "condition" && !isListedExploreHubType(type)) {
    return res.status(404).json({ error: "Not found" });
  }
  try {
    if (!(await exploreHubExists(type, slug))) {
      return res.status(404).json({ error: "Not found" });
    }
    if (type === "condition") {
      // Condition hubs: the ONE query the crawler page lists
      // (seo-body-renderer getConditionHubStudies) — hub name + studies.
      const hubStudies = await getConditionHubStudies(slug);
      if (!hubStudies) return res.status(404).json({ error: "Not found" });
      res.set("Cache-Control", "public, max-age=300");
      return res.json(hubStudies);
    }
    const studies = await getExploreDetailStudies(slug);
    res.set("Cache-Control", "public, max-age=300");
    res.json({ studies });
  } catch (error) {
    logger.error("Error fetching explore hub studies", error, "HydrogenRoutes", { type, slug });
    res.status(500).json({ error: "Failed to fetch studies" });
  }
});

/**
 * Does /explore-by-<type>/<slug> exist? 200 { type, slug, path } or 404.
 * The condition / body-system / life-stage SPA pages (which read their study
 * lists elsewhere) render NotFound on a 404 (ExploreHubGate).
 */
router.get("/api/explore/:type/:slug", async (req: Request, res: Response) => {
  const { type, slug } = req.params;
  if (!isExploreHubType(type)) {
    return res.status(404).json({ error: "Not found" });
  }
  try {
    if (!(await exploreHubExists(type, slug))) {
      return res.status(404).json({ error: "Not found" });
    }
    res.set("Cache-Control", "public, max-age=300");
    res.json({ type, slug, path: exploreHubPath(type, slug) });
  } catch (error) {
    logger.error("Error checking explore hub", error, "HydrogenRoutes", { type, slug });
    res.status(500).json({ error: "Failed to check hub" });
  }
});

/**
 * Get all delivery methods
 */
router.get("/api/delivery-methods", async (_req: Request, res: Response) => {
  try {
    const allDeliveryMethods = await db
      .select()
      .from(deliveryMethods)
      .orderBy(deliveryMethods.displayOrder);
    res.json(allDeliveryMethods);
  } catch (error: unknown) {
    // Table may not exist yet — return empty array gracefully
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("delivery_methods") || message.includes("does not exist")) {
      return res.json([]);
    }
    logger.error("Error fetching delivery methods", error, "HydrogenRoutes");
    res.status(500).json({ error: "Failed to fetch delivery methods" });
  }
});

/**
 * Get delivery method by slug
 */
router.get(
  "/api/delivery-methods/:slug",
  async (req: Request, res: Response) => {
    try {
      const { slug } = req.params;

      const [deliveryMethod] = await db
        .select()
        .from(deliveryMethods)
        .where(eq(deliveryMethods.slug, slug));

      if (!deliveryMethod) {
        return res.status(404).json({ error: "Delivery method not found" });
      }

      res.json(deliveryMethod);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes("does not exist")) {
        return res.status(404).json({ error: "Delivery method not found" });
      }
      logger.error("Error fetching delivery method by slug", error, "HydrogenRoutes", { slug: req.params.slug });
      res.status(500).json({ error: "Failed to fetch delivery method" });
    }
  },
);

/**
 * Get studies by delivery method
 */
router.get(
  "/api/delivery-methods/:slug/studies",
  async (req: Request, res: Response) => {
    try {
      const { slug } = req.params;

      const [deliveryMethod] = await db
        .select()
        .from(deliveryMethods)
        .where(eq(deliveryMethods.slug, slug));

      if (!deliveryMethod) {
        return res.status(404).json({ error: "Delivery method not found" });
      }

      const studiesWithDeliveryMethod = await db
        .select({
          study: studies,
          deliveryMethodId: studyDeliveryMethods.deliveryMethodId,
        })
        .from(studies)
        .innerJoin(
          studyDeliveryMethods,
          eq(studies.id, studyDeliveryMethods.studyId),
        )
        .where(and(eq(studyDeliveryMethods.deliveryMethodId, deliveryMethod.id), eq(studies.isExcluded, false)));

      // Extract just the study data
      const result = studiesWithDeliveryMethod.map((item) => item.study);

      res.json({
        deliveryMethod,
        studies: result,
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes("does not exist")) {
        return res.json({ deliveryMethod: null, studies: [] });
      }
      logger.error("Error fetching studies for delivery method", error, "HydrogenRoutes", { slug: req.params.slug });
      res.status(500).json({ error: "Failed to fetch studies" });
    }
  },
);

/**
 * Get all duration categories
 */
router.get("/api/duration-categories", async (_req: Request, res: Response) => {
  try {
    const allDurationCategories = await db
      .select()
      .from(durationCategories)
      .orderBy(durationCategories.displayOrder);
    res.json(allDurationCategories);
  } catch (error) {
    logger.error("Error fetching duration categories", error, "HydrogenRoutes");
    res.status(500).json({ error: "Failed to fetch duration categories" });
  }
});

/**
 * Get study outcome (consumer-friendly summary)
 */
router.get("/api/studies/:id/outcome", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const studyId = parseInt(id);

    if (isNaN(studyId)) {
      return res.status(400).json({ error: "Invalid study ID" });
    }

    const [outcome] = await db
      .select()
      .from(studyOutcomes)
      .where(eq(studyOutcomes.studyId, studyId));

    if (!outcome) {
      return res.status(404).json({ error: "Study outcome not found" });
    }

    res.json(outcome);
  } catch (error) {
    logger.error("Error fetching outcome for study", error, "HydrogenRoutes", { studyId: req.params.id });
    res.status(500).json({ error: "Failed to fetch study outcome" });
  }
});

/**
 * Get study tags (all associated categories)
 */
router.get("/api/studies/:id/tags", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const studyId = parseInt(id);

    if (isNaN(studyId)) {
      return res.status(400).json({ error: "Invalid study ID" });
    }

    // Get all associated tags — each query wrapped individually since tables may not exist yet
    const safeQuery = async <T>(fn: () => Promise<T[]>): Promise<T[]> => {
      try { return await fn(); } catch { return []; }
    };

    const [studyBenefitData, studyDemographicData, studyMechanismData, studyDeliveryMethodData, studyDurationData] =
      await Promise.all([
        safeQuery(() => db.select({ benefit: benefits }).from(studyBenefits).innerJoin(benefits, eq(studyBenefits.benefitId, benefits.id)).where(eq(studyBenefits.studyId, studyId))),
        safeQuery(() => db.select({ demographic: demographics }).from(studyDemographics).innerJoin(demographics, eq(studyDemographics.demographicId, demographics.id)).where(eq(studyDemographics.studyId, studyId))),
        safeQuery(() => db.select({ mechanism: mechanisms }).from(studyMechanisms).innerJoin(mechanisms, eq(studyMechanisms.mechanismId, mechanisms.id)).where(eq(studyMechanisms.studyId, studyId))),
        safeQuery(() => db.select({ deliveryMethod: deliveryMethods }).from(studyDeliveryMethods).innerJoin(deliveryMethods, eq(studyDeliveryMethods.deliveryMethodId, deliveryMethods.id)).where(eq(studyDeliveryMethods.studyId, studyId))),
        safeQuery(() => db.select({ durationCategory: durationCategories }).from(studyDurations).innerJoin(durationCategories, eq(studyDurations.durationCategoryId, durationCategories.id)).where(eq(studyDurations.studyId, studyId))),
      ]);

    res.json({
      benefits: studyBenefitData.map((item: Record<string, unknown>) => item.benefit),
      demographics: studyDemographicData.map((item: Record<string, unknown>) => item.demographic),
      mechanisms: studyMechanismData.map((item: Record<string, unknown>) => item.mechanism),
      deliveryMethods: studyDeliveryMethodData.map((item: Record<string, unknown>) => item.deliveryMethod),
      durationCategories: studyDurationData.map((item: Record<string, unknown>) => item.durationCategory),
    });
  } catch (error) {
    logger.error("Error fetching tags for study", error, "HydrogenRoutes", { studyId: req.params.id });
    res.status(500).json({ error: "Failed to fetch study tags" });
  }
});

export default router;
