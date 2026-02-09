/**
 * DOI Enhancer
 *
 * This module provides functions to enhance study data quality
 * by normalizing and updating fields based on DOI information
 * from multiple data sources.
 */

import { db } from "../db";
import { getCrossRefArticleByDOI } from "./services/crossref-api";
import { getSemanticScholarPaper } from "./services/semantic-scholar-api";
import { storage } from "../storage";
import { studies, type Study } from "@shared/schema";
import { eq, and, or, isNull, like, asc, desc } from "drizzle-orm";

/**
 * Fields that can be enhanced using DOI-based data normalization
 */
export const ENHANCEABLE_FIELDS = [
  "title",
  "abstract",
  "authors",
  "journal",
  "publishDate",
  "doi",
  "pdfUrl",
  "citationUrl",
  "keywords",
  "peerReviewed",
  "firstAuthor",
  "lastAuthor",
  "otherAuthors",
  "pmid",
];

/**
 * Find studies that need data enhancement
 * @param options Configuration for finding studies to enhance
 * @returns Array of studies that need enhancement
 */
export async function findStudiesNeedingEnhancement(options: {
  limit?: number;
  requireDoi?: boolean;
  minQualityScore?: number;
  missingFields?: string[];
}): Promise<Study[]> {
  const {
    limit = 50,
    requireDoi = true,
    minQualityScore = 0,
    missingFields = ["abstract", "authors", "journal"],
  } = options;

  try {
    // Simplified approach - use raw SQL to get data quality issues
    // This removes dependency on problematic Drizzle ORM syntax that isn't working
    let query = db.select().from(studies);

    // Build basic filters
    const whereConditions = [];

    // Only include studies with DOI (simpler condition)
    if (requireDoi) {
      whereConditions.push(studies.doi.notLike(""));
    }

    // Look for common data quality issues using specific conditions
    // rather than trying to dynamically build them
    const qualityIssueConditions = [];

    if (missingFields.includes("abstract")) {
      qualityIssueConditions.push(
        or(
          isNull(studies.abstract),
          eq(studies.abstract, ""),
          like(studies.abstract, "%No abstract available%"),
        ),
      );
    }

    if (missingFields.includes("authors")) {
      qualityIssueConditions.push(
        or(isNull(studies.authors), eq(studies.authors, "")),
      );
    }

    if (missingFields.includes("journal")) {
      qualityIssueConditions.push(
        or(
          isNull(studies.journal),
          eq(studies.journal, ""),
          eq(studies.journal, "Scientific Journal"),
        ),
      );
    }

    if (qualityIssueConditions.length > 0) {
      whereConditions.push(or(...qualityIssueConditions));
    }

    // Apply all where conditions
    if (whereConditions.length > 0) {
      query = query.where(and(...whereConditions));
    }

    // Get the studies that need enhancement with appropriate limits
    const studiesNeedingEnhancement = await query
      .orderBy(asc(studies.id))
      .limit(limit);

    return studiesNeedingEnhancement;
  } catch (error) {
    console.error("Error finding studies needing enhancement:", error);
    return [];
  }
}

/**
 * Enhance a study using its DOI to fetch normalized data
 * @param studyId ID of the study to enhance
 * @returns Success status and message
 */
export async function enhanceStudyWithDoi(studyId: number): Promise<{
  success: boolean;
  message: string;
  enhancedFields?: string[];
}> {
  try {
    // Get the study
    const study = await storage.getStudyById(studyId);

    if (!study) {
      return {
        success: false,
        message: `Study with ID ${studyId} not found`,
      };
    }

    // Make sure study has a DOI
    const doi = study.doi?.trim();
    if (!doi) {
      return {
        success: false,
        message: "Study has no DOI for enhancement",
      };
    }

    // Determine which fields need enhancement
    const fieldsToEnhance = determineFieldsToEnhance(study);
    if (fieldsToEnhance.length === 0) {
      return {
        success: true,
        message: "Study already has complete data",
        enhancedFields: [],
      };
    }

    // Track enhanced fields
    const enhancedFields: string[] = [];

    // First, try CrossRef (most academic sources use this)
    let enhancedData = {};
    try {
      const crossrefData = await getCrossRefArticleByDOI(doi);
      if (crossrefData) {
        enhancedData = extractCrossRefData(
          crossrefData,
          study,
          fieldsToEnhance,
        );

        // Check which fields were enhanced
        Object.keys(enhancedData).forEach((field) => {
          if (!enhancedFields.includes(field)) {
            enhancedFields.push(field);
          }
        });
      }
    } catch (error) {
      console.warn(`CrossRef enhancement failed for DOI ${doi}:`, error);
      // Continue to next source
    }

    // Next, try Semantic Scholar if fields are still missing
    const remainingFields = fieldsToEnhance.filter(
      (field) => !enhancedFields.includes(field),
    );

    if (remainingFields.length > 0) {
      try {
        const semanticScholarData = await getSemanticScholarPaper(doi);
        if (semanticScholarData) {
          const semanticData = extractSemanticScholarData(
            semanticScholarData,
            study,
            remainingFields,
          );

          // Merge with enhanced data
          enhancedData = { ...enhancedData, ...semanticData };

          // Update enhanced fields list
          Object.keys(semanticData).forEach((field) => {
            if (!enhancedFields.includes(field)) {
              enhancedFields.push(field);
            }
          });
        }
      } catch (error) {
        console.warn(
          `Semantic Scholar enhancement failed for DOI ${doi}:`,
          error,
        );
      }
    }

    // If we've enhanced any fields, update the study
    if (Object.keys(enhancedData).length > 0) {
      // Add updatedAt timestamp
      enhancedData = {
        ...enhancedData,
        updatedAt: new Date().toISOString(),
      };

      // Update the study
      await storage.updateStudy(studyId, enhancedData);

      return {
        success: true,
        message: `Successfully enhanced study data using DOI: ${doi}`,
        enhancedFields,
      };
    } else {
      return {
        success: false,
        message: `No additional data found for DOI: ${doi}`,
        enhancedFields: [],
      };
    }
  } catch (error) {
    console.error("Error enhancing study with DOI:", error);
    return {
      success: false,
      message: `Error enhancing study: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Batch enhance multiple studies using their DOIs
 * @param limit Maximum number of studies to process
 * @returns Statistics on enhancement process
 */
export async function batchEnhanceStudiesWithDoi(limit: number = 50): Promise<{
  total: number;
  enhanced: number;
  failed: number;
  details: Array<{
    studyId: number;
    success: boolean;
    message: string;
    enhancedFields?: string[];
  }>;
}> {
  try {
    // Find studies that need enhancement
    const studies = await findStudiesNeedingEnhancement({
      limit,
      requireDoi: true,
      missingFields: ["abstract", "authors", "journal", "publishDate"],
    });

    if (studies.length === 0) {
      return {
        total: 0,
        enhanced: 0,
        failed: 0,
        details: [],
      };
    }

    console.log(
      `Found ${studies.length} studies that need DOI-based enhancement`,
    );

    // Process each study
    const details: Array<{
      studyId: number;
      success: boolean;
      message: string;
      enhancedFields?: string[];
    }> = [];

    let enhancedCount = 0;
    let failedCount = 0;

    for (const study of studies) {
      // Add a delay to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 500));

      const result = await enhanceStudyWithDoi(study.id);

      details.push({
        studyId: study.id,
        success: result.success,
        message: result.message,
        enhancedFields: result.enhancedFields,
      });

      if (result.success && (result.enhancedFields?.length ?? 0) > 0) {
        enhancedCount++;
        console.log(`Enhanced study ID ${study.id}: ${result.message}`);
      } else {
        failedCount++;
        console.log(
          `Failed to enhance study ID ${study.id}: ${result.message}`,
        );
      }
    }

    return {
      total: studies.length,
      enhanced: enhancedCount,
      failed: failedCount,
      details,
    };
  } catch (error) {
    console.error("Error in batch DOI enhancement:", error);
    return {
      total: 0,
      enhanced: 0,
      failed: 0,
      details: [
        {
          studyId: 0,
          success: false,
          message: `Error in batch enhancement: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
    };
  }
}

/**
 * Determine which fields need enhancement for a study
 * @param study Study to analyze
 * @returns Array of field names that need enhancement
 */
function determineFieldsToEnhance(study: Study): string[] {
  const fieldsToEnhance: string[] = [];

  // Check for missing or incomplete fields
  if (
    !study.abstract ||
    study.abstract.trim() === "" ||
    study.abstract.includes("No abstract available")
  ) {
    fieldsToEnhance.push("abstract");
  }

  if (!study.authors || study.authors.trim() === "") {
    fieldsToEnhance.push("authors");
    fieldsToEnhance.push("firstAuthor");
    fieldsToEnhance.push("lastAuthor");
    fieldsToEnhance.push("otherAuthors");
  }

  if (
    !study.journal ||
    study.journal.trim() === "" ||
    study.journal === "Scientific Journal"
  ) {
    fieldsToEnhance.push("journal");
  }

  if (!study.publishDate || study.publishDate.trim() === "") {
    fieldsToEnhance.push("publishDate");
  }

  if (!study.pdfUrl || study.pdfUrl.trim() === "") {
    fieldsToEnhance.push("pdfUrl");
  }

  if (!study.citationUrl || study.citationUrl.trim() === "") {
    fieldsToEnhance.push("citationUrl");
  }

  if (!study.keywords || study.keywords.length === 0) {
    fieldsToEnhance.push("keywords");
  }

  if (study.peerReviewed === null || study.peerReviewed === undefined) {
    fieldsToEnhance.push("peerReviewed");
  }

  return fieldsToEnhance;
}

/**
 * Extract relevant data from CrossRef API response
 * @param crossrefData CrossRef API data
 * @param study Existing study data
 * @param fieldsToEnhance Fields that need enhancement
 * @returns Object with enhanced fields
 */
function extractCrossRefData(
  crossrefData: any,
  study: Study,
  fieldsToEnhance: string[],
): Record<string, any> {
  const enhancedData: Record<string, any> = {};

  // Title (only enhance if current title is very short or generic)
  if (
    fieldsToEnhance.includes("title") &&
    crossrefData.title &&
    Array.isArray(crossrefData.title) &&
    crossrefData.title.length > 0 &&
    (study.title.length < 20 || study.title.includes("Untitled"))
  ) {
    enhancedData.title = crossrefData.title[0];
  }

  // Abstract
  if (
    fieldsToEnhance.includes("abstract") &&
    crossrefData.abstract &&
    crossrefData.abstract.trim() !== ""
  ) {
    // Clean up HTML tags if present
    let abstract = crossrefData.abstract;
    abstract = abstract.replace(/<\/?[^>]+(>|$)/g, "");
    enhancedData.abstract = abstract;
  }

  // Authors
  if (
    fieldsToEnhance.includes("authors") &&
    crossrefData.author &&
    Array.isArray(crossrefData.author) &&
    crossrefData.author.length > 0
  ) {
    const authors = crossrefData.author
      .map((author: any) => {
        return `${author.given || ""} ${author.family || ""}`.trim();
      })
      .join(", ");

    enhancedData.authors = authors;

    // Also extract first, other, and last authors
    if (crossrefData.author.length > 0) {
      const firstAuthor =
        `${crossrefData.author[0].given || ""} ${crossrefData.author[0].family || ""}`.trim();
      enhancedData.firstAuthor = firstAuthor;

      if (crossrefData.author.length > 1) {
        const lastAuthor =
          `${crossrefData.author[crossrefData.author.length - 1].given || ""} ${crossrefData.author[crossrefData.author.length - 1].family || ""}`.trim();
        enhancedData.lastAuthor = lastAuthor;

        if (crossrefData.author.length > 2) {
          const otherAuthors = crossrefData.author
            .slice(1, -1)
            .map((author: any) => {
              return `${author.given || ""} ${author.family || ""}`.trim();
            })
            .join(", ");
          enhancedData.otherAuthors = otherAuthors;
        } else {
          enhancedData.otherAuthors = "";
        }
      }
    }
  }

  // Journal
  if (
    fieldsToEnhance.includes("journal") &&
    crossrefData["container-title"] &&
    Array.isArray(crossrefData["container-title"]) &&
    crossrefData["container-title"].length > 0
  ) {
    enhancedData.journal = crossrefData["container-title"][0];
  }

  // Publication date
  if (
    fieldsToEnhance.includes("publishDate") &&
    crossrefData.published &&
    crossrefData.published["date-parts"] &&
    Array.isArray(crossrefData.published["date-parts"]) &&
    crossrefData.published["date-parts"].length > 0
  ) {
    const dateParts = crossrefData.published["date-parts"][0];
    if (dateParts && dateParts.length >= 1) {
      const year = dateParts[0];
      const month =
        dateParts.length >= 2 ? String(dateParts[1]).padStart(2, "0") : "01";
      const day =
        dateParts.length >= 3 ? String(dateParts[2]).padStart(2, "0") : "01";
      enhancedData.publishDate = `${year}-${month}-${day}`;
    }
  }

  // PDF URL
  if (
    fieldsToEnhance.includes("pdfUrl") &&
    crossrefData.link &&
    Array.isArray(crossrefData.link)
  ) {
    const pdfLink = crossrefData.link.find(
      (link: any) =>
        link["content-type"] && link["content-type"].includes("pdf"),
    );

    if (pdfLink && pdfLink.URL) {
      enhancedData.pdfUrl = pdfLink.URL;
    }
  }

  // Citation URL
  if (fieldsToEnhance.includes("citationUrl") && crossrefData.URL) {
    enhancedData.citationUrl = crossrefData.URL;
  } else if (fieldsToEnhance.includes("citationUrl") && crossrefData.DOI) {
    enhancedData.citationUrl = `https://doi.org/${crossrefData.DOI}`;
  }

  // Keywords
  if (
    fieldsToEnhance.includes("keywords") &&
    crossrefData.subject &&
    Array.isArray(crossrefData.subject) &&
    crossrefData.subject.length > 0
  ) {
    enhancedData.keywords = crossrefData.subject;
  }

  // Peer-reviewed status
  if (fieldsToEnhance.includes("peerReviewed")) {
    // Most CrossRef articles with these types are peer-reviewed
    const type = crossrefData.type?.toLowerCase();
    if (["journal-article", "journal_article"].includes(type)) {
      enhancedData.peerReviewed = true;
    }
  }

  return enhancedData;
}

/**
 * Extract relevant data from Semantic Scholar API response
 * @param semanticData Semantic Scholar API data
 * @param study Existing study data
 * @param fieldsToEnhance Fields that need enhancement
 * @returns Object with enhanced fields
 */
function extractSemanticScholarData(
  semanticData: any,
  study: Study,
  fieldsToEnhance: string[],
): Record<string, any> {
  const enhancedData: Record<string, any> = {};

  // Abstract
  if (
    fieldsToEnhance.includes("abstract") &&
    semanticData.abstract &&
    semanticData.abstract.trim() !== ""
  ) {
    enhancedData.abstract = semanticData.abstract;
  }

  // Authors
  if (
    fieldsToEnhance.includes("authors") &&
    semanticData.authors &&
    Array.isArray(semanticData.authors) &&
    semanticData.authors.length > 0
  ) {
    const authors = semanticData.authors
      .map((author: any) => author.name)
      .join(", ");
    enhancedData.authors = authors;

    // Also extract first, other, and last authors
    if (semanticData.authors.length > 0) {
      enhancedData.firstAuthor = semanticData.authors[0].name;

      if (semanticData.authors.length > 1) {
        enhancedData.lastAuthor =
          semanticData.authors[semanticData.authors.length - 1].name;

        if (semanticData.authors.length > 2) {
          enhancedData.otherAuthors = semanticData.authors
            .slice(1, -1)
            .map((author: any) => author.name)
            .join(", ");
        } else {
          enhancedData.otherAuthors = "";
        }
      }
    }
  }

  // Journal
  if (
    fieldsToEnhance.includes("journal") &&
    semanticData.journal &&
    semanticData.journal.name
  ) {
    enhancedData.journal = semanticData.journal.name;
  }

  // Publication date
  if (fieldsToEnhance.includes("publishDate") && semanticData.year) {
    enhancedData.publishDate = `${semanticData.year}-01-01`;
  }

  // PDF URL
  if (
    fieldsToEnhance.includes("pdfUrl") &&
    semanticData.openAccessPdf &&
    semanticData.openAccessPdf.url
  ) {
    enhancedData.pdfUrl = semanticData.openAccessPdf.url;
  }

  // Citation URL
  if (fieldsToEnhance.includes("citationUrl") && semanticData.url) {
    enhancedData.citationUrl = semanticData.url;
  }

  // Keywords/Topics
  if (
    fieldsToEnhance.includes("keywords") &&
    semanticData.topics &&
    Array.isArray(semanticData.topics) &&
    semanticData.topics.length > 0
  ) {
    enhancedData.keywords = semanticData.topics.map(
      (topic: any) => topic.topic,
    );
  }

  return enhancedData;
}

/**
 * Calculate data quality score for a study
 * @param study Study to analyze
 * @returns Quality score between 0-100
 */
export function calculateDataQualityScore(study: Study): number {
  let score = 0;
  const totalChecks = 10;

  // Check required fields
  if (study.title && study.title.trim() !== "") score += 10;
  if (study.abstract && study.abstract.trim() !== "") score += 10;
  if (study.authors && study.authors.trim() !== "") score += 10;
  if (study.journal && study.journal.trim() !== "") score += 10;
  if (study.publishDate && study.publishDate.trim() !== "") score += 10;

  // Check optional but useful fields
  if (study.doi && study.doi.trim() !== "") score += 10;
  if (study.pdfUrl && study.pdfUrl.trim() !== "") score += 10;
  if (study.citationUrl && study.citationUrl.trim() !== "") score += 10;
  if (study.keywords && study.keywords.length > 0) score += 10;
  if (study.peerReviewed !== null && study.peerReviewed !== undefined)
    score += 10;

  return score;
}
