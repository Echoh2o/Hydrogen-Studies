/**
 * Routes for DOI-based study enhancement
 */
import { Router, Request, Response } from "express";
import { z } from "zod";
import { ZodError } from "zod";
import { handleValidationError } from "../simple-error-handler";
import {
  enhanceStudyWithDoi,
  batchEnhanceStudiesWithDoi,
  findStudiesNeedingEnhancement,
  calculateDataQualityScore,
  ENHANCEABLE_FIELDS,
} from "../services/doi-enhancer";
import { db } from "../db";
import { studies } from "@shared/schema";
import { eq, ne, isNull, or, and, like, asc } from "drizzle-orm";
import { studyService } from "../services/study-service";
import { getCrossRefArticleByDOI } from "../services/crossref-api";
import { getSemanticScholarPaper } from "../services/semantic-scholar-api";

const router = Router();

// Validation schemas
const enhanceStudySchema = z.object({
  studyId: z.number().int().positive(),
  fields: z.array(z.string()).optional(),
});

const batchEnhanceSchema = z.object({
  limit: z.number().int().min(1).max(500).default(50),
  requireDoi: z.boolean().default(true),
  fieldsToEnhance: z.array(z.string()).optional(),
});

const findStudiesSchema = z.object({
  limit: z.number().int().min(1).max(500).default(50),
  requireDoi: z.boolean().default(true),
  minQualityScore: z.number().int().min(0).max(100).default(0),
  missingFields: z.array(z.string()).optional(),
});

/**
 * Enhance a single study using its DOI
 * POST /api/doi/enhance
 */
router.post("/enhance", async (req: Request, res: Response) => {
  try {
    // Initial validation of request body
    if (!req.body || typeof req.body !== "object") {
      return res.status(400).json({
        success: false,
        message: "Invalid request format. Please provide a valid request.",
      });
    }

    // Schema validation
    try {
      const { studyId, fields } = enhanceStudySchema.parse(req.body);

      // Get the study directly from storage
      const study = await studyService.getStudyById(studyId);

      if (!study) {
        return res.status(404).json({
          success: false,
          message: `Study with ID ${studyId} not found.`,
        });
      }

      // Check for DOI
      if (!study.doi || study.doi.trim() === "") {
        return res.status(400).json({
          success: false,
          message: `Study with ID ${studyId} does not have a DOI. Cannot enhance without DOI.`,
        });
      }

      // Track enhanced fields
      const enhancedFields: string[] = [];
      const updates: Record<string, any> = {};

      try {
        // Try to get data from CrossRef
        const crossrefData = await getCrossRefArticleByDOI(study.doi);

        // Update abstract if needed
        if (
          (!study.abstract ||
            study.abstract.trim() === "" ||
            study.abstract.includes("No abstract available")) &&
          crossrefData?.abstract
        ) {
          updates.abstract = crossrefData.abstract;
          enhancedFields.push("abstract");
        }

        // Update journal if needed
        if (
          (!study.journal ||
            study.journal.trim() === "" ||
            study.journal === "Scientific Journal") &&
          crossrefData?.["container-title"]?.[0]
        ) {
          updates.journal = crossrefData["container-title"][0];
          enhancedFields.push("journal");
        }

        // Update authors if needed
        if (
          (!study.authors || study.authors.trim() === "") &&
          crossrefData?.author &&
          Array.isArray(crossrefData.author) &&
          crossrefData.author.length > 0
        ) {
          const authorNames = crossrefData.author
            .map((author: any) =>
              `${author.given || ""} ${author.family || ""}`.trim(),
            )
            .join(", ");

          updates.authors = authorNames;
          enhancedFields.push("authors");
        }

        // Update publish date if needed
        if (
          (!study.publishDate || study.publishDate.trim() === "") &&
          crossrefData?.published?.["date-parts"]?.[0]
        ) {
          const dateParts = crossrefData.published["date-parts"][0];
          if (dateParts.length >= 3) {
            updates.publishDate = `${dateParts[0]}-${String(dateParts[1]).padStart(2, "0")}-${String(dateParts[2]).padStart(2, "0")}`;
            enhancedFields.push("publishDate");
          } else if (dateParts.length >= 2) {
            updates.publishDate = `${dateParts[0]}-${String(dateParts[1]).padStart(2, "0")}-01`;
            enhancedFields.push("publishDate");
          } else if (dateParts.length >= 1) {
            updates.publishDate = `${dateParts[0]}-01-01`;
            enhancedFields.push("publishDate");
          }
        }
      } catch (crossRefError) {
        console.warn(
          `CrossRef API error for DOI ${study.doi}: ${crossRefError instanceof Error ? crossRefError.message : String(crossRefError)}`,
        );
      }

      try {
        // Try to get data from Semantic Scholar
        const semanticScholarData = await getSemanticScholarPaper(study.doi);

        // Update abstract if still needed
        if (
          (!study.abstract ||
            study.abstract.trim() === "" ||
            study.abstract.includes("No abstract available")) &&
          !updates.abstract &&
          semanticScholarData?.abstract
        ) {
          updates.abstract = semanticScholarData.abstract;
          enhancedFields.push("abstract");
        }

        // Update journal if still needed
        if (
          (!study.journal ||
            study.journal.trim() === "" ||
            study.journal === "Scientific Journal") &&
          !updates.journal &&
          semanticScholarData?.journal?.name
        ) {
          updates.journal = semanticScholarData.journal.name;
          enhancedFields.push("journal");
        }

        // Update authors if still needed
        if (
          (!study.authors || study.authors.trim() === "") &&
          !updates.authors &&
          semanticScholarData?.authors?.length > 0
        ) {
          const authorNames = semanticScholarData.authors
            .map((author: any) => author.name)
            .join(", ");

          updates.authors = authorNames;
          enhancedFields.push("authors");
        }

        // Add keywords if missing
        if (
          (!study.keywords || study.keywords.length === 0) &&
          semanticScholarData?.topics?.length > 0
        ) {
          updates.keywords = semanticScholarData.topics.map(
            (topic: any) => topic.topic,
          );
          enhancedFields.push("keywords");
        }
      } catch (semanticError) {
        console.warn(
          `Semantic Scholar API error for DOI ${study.doi}: ${semanticError instanceof Error ? semanticError.message : String(semanticError)}`,
        );
      }

      // Check if we have any updates to apply
      if (Object.keys(updates).length === 0) {
        return res.status(200).json({
          success: true,
          message: `No fields could be enhanced for study with ID ${studyId}.`,
          studyId,
          enhancedFields: [],
        });
      }

      // Apply the updates
      await studyService.updateStudy(studyId, updates);

      return res.status(200).json({
        success: true,
        message: `Successfully enhanced study with ID ${studyId}.`,
        studyId,
        enhancedFields,
      });
    } catch (zodError) {
      if (zodError instanceof ZodError) {
        // Validation error handling
        return res.status(400).json({
          success: false,
          message: zodError.message,
        });
      }
      throw zodError;
    }
  } catch (error) {
    console.error("Error enhancing study with DOI:", error);
    return res.status(500).json({
      success: false,
      message: `Error enhancing study: ${error instanceof Error ? error.message : String(error)}`,
    });
  }
});

/**
 * Batch enhance multiple studies
 * POST /api/doi/enhance/batch
 */
router.post("/enhance/batch", async (req: Request, res: Response) => {
  try {
    // Initial validation of request body
    if (!req.body || typeof req.body !== "object") {
      return res.status(400).json({
        success: false,
        message: "Invalid request format. Please provide a valid request.",
      });
    }

    // Schema validation
    try {
      const { limit, requireDoi } = batchEnhanceSchema.parse(req.body);

      // First find studies needing enhancement
      try {
        // Get studies that need enhancement
        const allStudies = await studyService.getStudies({ limit: limit });

        // Filter studies with quality issues manually
        const studiesNeedingEnhancement = allStudies.data.filter((study) => {
          // Check DOI exists and is not empty
          if (!study.doi || study.doi.trim() === "") {
            return false; // Skip studies without DOI
          }

          // Check for common quality issues
          return (
            !study.abstract ||
            study.abstract.trim() === "" ||
            study.abstract.includes("No abstract available") ||
            !study.authors ||
            study.authors.trim() === "" ||
            !study.journal ||
            study.journal.trim() === "" ||
            study.journal === "Scientific Journal"
          );
        });

        if (studiesNeedingEnhancement.length === 0) {
          return res.status(200).json({
            success: true,
            message: "No studies found that need enhancement.",
            result: {
              total: 0,
              enhanced: 0,
              failed: 0,
              details: [],
            },
          });
        }

        console.log(
          `Found ${studiesNeedingEnhancement.length} studies that need DOI-based enhancement`,
        );

        // Process each study
        const details = [];
        let enhancedCount = 0;
        let failedCount = 0;

        // Enhance each study
        for (const study of studiesNeedingEnhancement) {
          try {
            // Add a delay to avoid rate limiting
            await new Promise((resolve) => setTimeout(resolve, 500));

            // Directly call the enhance function instead of making an HTTP request
            const enhanceResult = await enhanceStudyWithDoi(study.id);

            details.push({
              studyId: study.id,
              success: enhanceResult.success,
              message: enhanceResult.message,
              enhancedFields: enhanceResult.enhancedFields || [],
            });

            if (
              enhanceResult.success &&
              (enhanceResult.enhancedFields?.length ?? 0) > 0
            ) {
              enhancedCount++;
              console.log(
                `Enhanced study ID ${study.id}: ${enhanceResult.message}`,
              );
            } else {
              failedCount++;
              console.log(
                `Failed to enhance study ID ${study.id}: ${enhanceResult.message}`,
              );
            }
          } catch (error) {
            failedCount++;
            console.error(`Error enhancing study ID ${study.id}:`, error);
            details.push({
              studyId: study.id,
              success: false,
              message: `Error: ${error instanceof Error ? error.message : String(error)}`,
            });
          }
        }

        return res.status(200).json({
          success: true,
          message: `Enhanced ${enhancedCount} out of ${studiesNeedingEnhancement.length} studies`,
          result: {
            total: studiesNeedingEnhancement.length,
            enhanced: enhancedCount,
            failed: failedCount,
            details,
          },
        });
      } catch (dbError) {
        console.error(
          "Database error retrieving studies for batch enhancement:",
          dbError,
        );
        return res.status(500).json({
          success: false,
          message:
            "Error accessing database to retrieve studies for batch enhancement",
        });
      }
    } catch (zodError) {
      if (zodError instanceof ZodError) {
        // Validation error handling
        return res.status(400).json({
          success: false,
          message: zodError.message,
        });
      }
      throw zodError;
    }
  } catch (error) {
    console.error("Error batch enhancing studies with DOI:", error);
    return res.status(500).json({
      success: false,
      message: `Error enhancing studies: ${error instanceof Error ? error.message : String(error)}`,
    });
  }
});

/**
 * Find studies that need enhancement
 * POST /api/doi/find-needing-enhancement
 */
router.post(
  "/find-needing-enhancement",
  async (req: Request, res: Response) => {
    try {
      // Initial validation of request body
      if (!req.body || typeof req.body !== "object") {
        return res.status(400).json({
          success: false,
          message: "Invalid request format. Please provide a valid request.",
        });
      }

      // Schema validation
      try {
        // Parse the request with schema validation
        const { limit = 50 } = findStudiesSchema.parse(req.body);

        try {
          // Direct approach using storage interface to get studies
          const allStudies = await studyService.getStudies({ limit: limit });

          // Filter studies with quality issues manually
          const studiesNeedingEnhancement = allStudies.data.filter((study) => {
            // Check DOI exists and is not empty
            if (!study.doi || study.doi.trim() === "") {
              return false; // Skip studies without DOI
            }

            // Check for common quality issues
            return (
              !study.abstract ||
              study.abstract.trim() === "" ||
              study.abstract.includes("No abstract available") ||
              !study.authors ||
              study.authors.trim() === "" ||
              !study.journal ||
              study.journal.trim() === "" ||
              study.journal === "Scientific Journal"
            );
          });

          // Calculate quality scores for each study
          const studiesWithScores = studiesNeedingEnhancement.map((study) => ({
            ...study,
            qualityScore: calculateDataQualityScore(study),
          }));

          return res.status(200).json({
            success: true,
            count: studiesWithScores.length,
            studies: studiesWithScores,
          });
        } catch (dbError) {
          console.error("Database error retrieving studies:", dbError);
          return res.status(500).json({
            success: false,
            message: "Error accessing database to retrieve studies",
          });
        }
      } catch (zodError) {
        if (zodError instanceof ZodError) {
          // Validation error handling
          return res.status(400).json({
            success: false,
            message: zodError.message,
          });
        }
        throw zodError;
      }
    } catch (error) {
      console.error("Error finding studies needing enhancement:", error);
      return res.status(500).json({
        success: false,
        message: `Error finding studies: ${error instanceof Error ? error.message : String(error)}`,
      });
    }
  },
);

/**
 * Get supported fields for enhancement
 * GET /api/doi/enhanceable-fields
 */
router.get("/enhanceable-fields", (_req: Request, res: Response) => {
  return res.status(200).json({
    success: true,
    fields: ENHANCEABLE_FIELDS,
  });
});

export default router;
