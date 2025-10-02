/**
 * Admin Enrichment Routes
 * Manual control for study enrichment instead of automatic background processing
 */
import { Router } from "express";
import { db } from "../db";
import { studies } from "../../shared/schema";
import { isNull, sql, eq, or, and } from "drizzle-orm";

const router = Router();

/**
 * Get enrichment statistics and progress
 */
router.get("/enrichment-stats", async (req, res) => {
  try {
    // Get overall enrichment statistics
    const overallStats = await db.execute(
      sql`SELECT 
        count(*) as total,
        count(case when doi is not null and doi != '' then 1 end) as withDoi,
        count(case when methods is not null and methods != '' then 1 end) as withMethods,
        count(case when results is not null and results != '' then 1 end) as withResults,
        count(case when conclusion is not null and conclusion != '' then 1 end) as withConclusions,
        count(case when pdf_url is not null and pdf_url != '' then 1 end) as withPdfUrl,
        count(case when citation_url is not null and citation_url != '' then 1 end) as withCitationUrl
      FROM studies`,
    );

    const stats = overallStats.rows[0] as any;
    const total = Number(stats.total || 0);

    // Calculate enrichment opportunities
    const enrichmentOpportunities = await db.execute(
      sql`SELECT 
        count(*) as studiesWithDoi,
        count(case when methods is null or methods = '' then 1 end) as missingMethods,
        count(case when results is null or results = '' then 1 end) as missingResults,
        count(case when conclusion is null or conclusion = '' then 1 end) as missingConclusions,
        count(case when pdf_url is null or pdf_url = '' then 1 end) as missingPdfUrl
      FROM studies 
      WHERE doi is not null and doi != ''`,
    );

    const opportunities = enrichmentOpportunities.rows[0] as any;

    res.json({
      success: true,
      data: {
        total: total,
        withDoi: Number(stats.withdoi || 0),
        enrichmentProgress: {
          methods: {
            enriched: Number(stats.withmethods || 0),
            total: total,
            percentage: Math.round(
              (Number(stats.withmethods || 0) / total) * 100,
            ),
          },
          results: {
            enriched: Number(stats.withresults || 0),
            total: total,
            percentage: Math.round(
              (Number(stats.withresults || 0) / total) * 100,
            ),
          },
          conclusions: {
            enriched: Number(stats.withconclusions || 0),
            total: total,
            percentage: Math.round(
              (Number(stats.withconclusions || 0) / total) * 100,
            ),
          },
          pdfLinks: {
            enriched: Number(stats.withpdfurl || 0),
            total: total,
            percentage: Math.round(
              (Number(stats.withpdfurl || 0) / total) * 100,
            ),
          },
        },
        enrichmentOpportunities: {
          studiesWithDoi: Number(opportunities.studieswithdoi || 0),
          missingMethods: Number(opportunities.missingmethods || 0),
          missingResults: Number(opportunities.missingresults || 0),
          missingConclusions: Number(opportunities.missingconclusions || 0),
          missingPdfUrl: Number(opportunities.missingpdfurl || 0),
        },
      },
    });
  } catch (error) {
    console.error("Error getting enrichment stats:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get enrichment statistics",
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * Get studies that can benefit from enrichment (admin preview)
 */
router.get("/studies-needing-enrichment", async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const enrichmentType = (req.query.type as string) || "all";

    let whereClause;

    switch (enrichmentType) {
      case "methods":
        whereClause = and(
          sql`doi is not null and doi != ''`,
          or(isNull(studies.methods), eq(studies.methods, "")),
        );
        break;
      case "results":
        whereClause = and(
          sql`doi is not null and doi != ''`,
          or(isNull(studies.results), eq(studies.results, "")),
        );
        break;
      case "conclusions":
        whereClause = and(
          sql`doi is not null and doi != ''`,
          or(isNull(studies.conclusion), eq(studies.conclusion, "")),
        );
        break;
      case "pdf":
        whereClause = and(
          sql`doi is not null and doi != ''`,
          or(isNull(studies.pdfUrl), eq(studies.pdfUrl, "")),
        );
        break;
      default:
        // Studies with DOI but missing any enrichable content
        whereClause = and(
          sql`doi is not null and doi != ''`,
          or(
            isNull(studies.methods),
            eq(studies.methods, ""),
            isNull(studies.results),
            eq(studies.results, ""),
            isNull(studies.conclusion),
            eq(studies.conclusion, ""),
            isNull(studies.pdfUrl),
            eq(studies.pdfUrl, ""),
          ),
        );
    }

    const studiesNeedingEnrichment = await db
      .select({
        id: studies.id,
        title: studies.title,
        doi: studies.doi,
        journal: studies.journal,
        publishDate: studies.publishDate,
        methods: studies.methods,
        results: studies.results,
        conclusion: studies.conclusion,
        pdfUrl: studies.pdfUrl,
        citationUrl: studies.citationUrl,
      })
      .from(studies)
      .where(whereClause)
      .orderBy(studies.id)
      .limit(limit);

    res.json({
      success: true,
      data: studiesNeedingEnrichment.map((study) => ({
        ...study,
        enrichmentNeeds: {
          methods: !study.methods || study.methods === "",
          results: !study.results || study.results === "",
          conclusions: !study.conclusion || study.conclusion === "",
          pdfUrl: !study.pdfUrl || study.pdfUrl === "",
        },
      })),
      count: studiesNeedingEnrichment.length,
      type: enrichmentType,
    });
  } catch (error) {
    console.error("Error getting studies needing enrichment:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get studies needing enrichment",
      error: String(error),
    });
  }
});

/**
 * Enrich a specific study (admin action)
 */
router.post("/enrich-single/:studyId", async (req, res) => {
  try {
    const studyId = parseInt(req.params.studyId);
    if (isNaN(studyId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid study ID",
      });
    }

    // Check if study exists and has DOI
    const study = await db
      .select()
      .from(studies)
      .where(eq(studies.id, studyId))
      .limit(1);

    if (study.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Study not found",
      });
    }

    if (!study[0].doi) {
      return res.status(400).json({
        success: false,
        message: "Study has no DOI - cannot enrich from external sources",
      });
    }

    // Import enrichment function
    const { enrichStudyFromAPIs } = await import("../study-enrichment-service");
    const result = await enrichStudyFromAPIs(studyId, study[0].doi);

    res.json({
      success: result.success,
      message: result.success ? "Study enriched successfully" : result.error,
      studyId: studyId,
      enrichmentData: result.success ? result.enrichmentData : null,
      sources: result.sources || [],
    });
  } catch (error) {
    console.error("Error enriching single study:", error);
    res.status(500).json({
      success: false,
      message: "Failed to enrich study",
      error: String(error),
    });
  }
});

/**
 * Enrich multiple studies (batch admin action)
 */
router.post("/enrich-batch", async (req, res) => {
  try {
    const { studyIds, maxCount = 10 } = req.body;

    if (!Array.isArray(studyIds)) {
      return res.status(400).json({
        success: false,
        message: "studyIds must be an array",
      });
    }

    // Limit batch size to prevent overwhelming external APIs
    const limitedStudyIds = studyIds.slice(0, Math.min(maxCount, 20));

    const { enrichStudyFromAPIs } = await import("../study-enrichment-service");
    const results = [];

    for (const studyId of limitedStudyIds) {
      try {
        // Get study DOI
        const study = await db
          .select({ doi: studies.doi })
          .from(studies)
          .where(eq(studies.id, studyId))
          .limit(1);

        if (study.length === 0 || !study[0].doi) {
          results.push({
            studyId,
            success: false,
            message: "Study not found or has no DOI",
            enrichmentData: null,
          });
          continue;
        }

        const result = await enrichStudyFromAPIs(studyId, study[0].doi);
        results.push({
          studyId,
          success: result.success,
          message: result.success ? "Enriched" : result.error,
          enrichmentData: result.success ? result.enrichmentData : null,
          sources: result.sources || [],
        });

        // Rate limiting: wait 2 seconds between enrichments
        if (limitedStudyIds.indexOf(studyId) < limitedStudyIds.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 2000));
        }
      } catch (error) {
        results.push({
          studyId,
          success: false,
          message: String(error),
          enrichmentData: null,
        });
      }
    }

    const successful = results.filter((r) => r.success).length;

    res.json({
      success: true,
      message: `Batch complete: ${successful}/${results.length} studies enriched`,
      results: results,
      summary: {
        total: results.length,
        successful: successful,
        failed: results.length - successful,
      },
    });
  } catch (error) {
    console.error("Error in batch enrichment:", error);
    res.status(500).json({
      success: false,
      message: "Failed to enrich batch studies",
      error: String(error),
    });
  }
});

/**
 * Auto-enrich all studies that can benefit from enrichment (admin action)
 */
router.post("/enrich-all-missing", async (req, res) => {
  try {
    const { maxStudies = 50, enrichmentType = "all" } = req.body;

    // Get studies that need enrichment based on type
    let whereClause;
    switch (enrichmentType) {
      case "methods":
        whereClause = and(
          sql`doi is not null and doi != ''`,
          or(isNull(studies.methods), eq(studies.methods, "")),
        );
        break;
      case "results":
        whereClause = and(
          sql`doi is not null and doi != ''`,
          or(isNull(studies.results), eq(studies.results, "")),
        );
        break;
      default:
        whereClause = and(
          sql`doi is not null and doi != ''`,
          or(
            isNull(studies.methods),
            eq(studies.methods, ""),
            isNull(studies.results),
            eq(studies.results, ""),
            isNull(studies.conclusion),
            eq(studies.conclusion, ""),
            isNull(studies.pdfUrl),
            eq(studies.pdfUrl, ""),
          ),
        );
    }

    const studiesNeedingEnrichment = await db
      .select({
        id: studies.id,
        doi: studies.doi,
      })
      .from(studies)
      .where(whereClause)
      .orderBy(studies.id)
      .limit(Math.min(maxStudies, 100));

    if (studiesNeedingEnrichment.length === 0) {
      return res.json({
        success: true,
        message: "All eligible studies are already enriched",
        processed: 0,
      });
    }

    const { enrichStudyFromAPIs } = await import("../study-enrichment-service");
    const results = [];

    for (const study of studiesNeedingEnrichment) {
      try {
        const result = await enrichStudyFromAPIs(study.id, study.doi);
        results.push({
          studyId: study.id,
          success: result.success,
          message: result.success ? "Enriched" : result.error,
          sources: result.sources || [],
        });

        // Rate limiting: wait 2 seconds between enrichments
        if (
          studiesNeedingEnrichment.indexOf(study) <
          studiesNeedingEnrichment.length - 1
        ) {
          await new Promise((resolve) => setTimeout(resolve, 2000));
        }
      } catch (error) {
        results.push({
          studyId: study.id,
          success: false,
          message: String(error),
        });
      }
    }

    const successful = results.filter((r) => r.success).length;

    res.json({
      success: true,
      message: `Enriched ${successful}/${results.length} studies`,
      processed: results.length,
      successful: successful,
      failed: results.length - successful,
      enrichmentType: enrichmentType,
      results: results,
    });
  } catch (error) {
    console.error("Error in enrich all missing:", error);
    res.status(500).json({
      success: false,
      message: "Failed to enrich all missing studies",
      error: String(error),
    });
  }
});

export default router;
