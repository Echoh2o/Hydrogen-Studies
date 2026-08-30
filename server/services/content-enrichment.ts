/**
 * Content Enrichment Service
 *
 * Enhances study data by fetching full abstracts, text, and images from DOI sources,
 * then comparing them with existing database content to provide the most complete information.
 */
import { db } from "../db";
import { studies } from "@shared/schema";
import { getCrossRefArticleByDOI } from "./crossref-api";
import { getEuropePmcArticleByDOI } from "./europepmc-api";
import { getSemanticScholarArticleByDOI } from "./semantic-scholar-api";
import { eq, and, or, isNull, lt, sql } from "drizzle-orm";
import axios from "axios";
import fs from "fs";
import path from "path";
import { load } from "cheerio";
import { logger } from "../utils/logger";

interface EnhancementResult {
  success: boolean;
  message: string;
  updates?: {
    abstract?: boolean;
    fullText?: boolean;
    images?: boolean;
    methods?: boolean;
    results?: boolean;
    conclusion?: boolean;
  };
  studyId?: number;
}

/**
 * Fetch full content for a study by DOI
 * Attempts to gather complete abstract, text, and images from multiple sources
 */
export async function enhanceStudyContent(
  studyId: number,
): Promise<EnhancementResult> {
  try {
    // Get the current study
    const study = await db.query.studies.findFirst({
      where: eq(studies.id, studyId),
    });

    if (!study) {
      return {
        success: false,
        message: `Study with ID ${studyId} not found`,
      };
    }

    if (!study.doi) {
      return {
        success: false,
        message: `Study #${studyId} doesn't have a DOI for enrichment`,
      };
    }

    // Initialize updates tracker
    const updates: EnhancementResult["updates"] = {
      abstract: false,
      fullText: false,
      images: false,
      methods: false,
      results: false,
      conclusion: false,
    };

    // Store initial lengths to check if content was enhanced
    const initialAbstractLength = study.abstract?.length || 0;
    const initialMethodsLength = study.methods?.length || 0;
    const initialResultsLength = study.results?.length || 0;
    const initialConclusionLength = study.conclusion?.length || 0;

    // Try to get content from multiple sources
    let fullTextContent = "";
    let imageSrc = "";
    let improvedAbstract = study.abstract || "";
    let improvedMethods = study.methods || "";
    let improvedResults = study.results || "";
    let improvedConclusion = study.conclusion || "";

    // Try CrossRef first
    try {
      logger.info("Fetching CrossRef data", "ContentEnrichment", { doi: study.doi });
      // CrossRef returns an envelope {status, "message-type", message: {...}};
      // the article fields (abstract, URL, title, ...) live under .message.
      // Reading them off the envelope directly (the old code) yielded undefined
      // on every call, so CrossRef contributed zero data to enrichment.
      const crossRefData = (await getCrossRefArticleByDOI(study.doi))?.message;

      if (crossRefData && crossRefData.abstract) {
        if (
          !improvedAbstract ||
          crossRefData.abstract.length > improvedAbstract.length
        ) {
          improvedAbstract = crossRefData.abstract;
          updates.abstract = true;
        }
      }

      // Extract URL to try for full text or image
      if (crossRefData && crossRefData.URL) {
        // Try to download the content from the publisher URL
        try {
          const htmlContent = await fetchHtmlContent(crossRefData.URL);
          if (htmlContent && htmlContent.length > 500) {
            fullTextContent = htmlContent;
            updates.fullText = true;

            // Extract potential methods, results, conclusions
            const sections = extractSectionsFromFullText(htmlContent);
            if (
              sections.methods &&
              sections.methods.length > initialMethodsLength
            ) {
              improvedMethods = sections.methods;
              updates.methods = true;
            }

            if (
              sections.results &&
              sections.results.length > initialResultsLength
            ) {
              improvedResults = sections.results;
              updates.results = true;
            }

            if (
              sections.conclusion &&
              sections.conclusion.length > initialConclusionLength
            ) {
              improvedConclusion = sections.conclusion;
              updates.conclusion = true;
            }
          }
        } catch (error) {
          logger.error("Error fetching HTML content", error, "ContentEnrichment", { url: crossRefData.URL });
        }
      }
    } catch (error) {
      logger.error("Error fetching CrossRef data", error, "ContentEnrichment", { doi: study.doi });
    }

    // Try Europe PMC next
    try {
      logger.info("Fetching Europe PMC data", "ContentEnrichment", { doi: study.doi });
      const europePmcData = await getEuropePmcArticleByDOI(study.doi);

      if (europePmcData) {
        // Check for better abstract
        if (
          europePmcData.abstractText &&
          (!improvedAbstract ||
            europePmcData.abstractText.length > improvedAbstract.length)
        ) {
          improvedAbstract = europePmcData.abstractText;
          updates.abstract = true;
        }

        // Check for better methods, results, conclusions
        if (europePmcData.fullTextXML) {
          const sections = extractSectionsFromXml(europePmcData.fullTextXML);

          if (
            sections.methods &&
            sections.methods.length > improvedMethods.length
          ) {
            improvedMethods = sections.methods;
            updates.methods = true;
          }

          if (
            sections.results &&
            sections.results.length > improvedResults.length
          ) {
            improvedResults = sections.results;
            updates.results = true;
          }

          if (
            sections.conclusion &&
            sections.conclusion.length > improvedConclusion.length
          ) {
            improvedConclusion = sections.conclusion;
            updates.conclusion = true;
          }
        }

        // Check for images
        if (!imageSrc && europePmcData.firstFigureUrl) {
          imageSrc = europePmcData.firstFigureUrl;
        }
      }
    } catch (error) {
      logger.error("Error fetching Europe PMC data", error, "ContentEnrichment", { doi: study.doi });
    }

    // Try Semantic Scholar last
    try {
      logger.info("Fetching Semantic Scholar data", "ContentEnrichment", { doi: study.doi });
      const semanticScholarData = await getSemanticScholarArticleByDOI(
        study.doi,
      );

      if (semanticScholarData) {
        // Check for better abstract
        if (
          semanticScholarData.abstract &&
          (!improvedAbstract ||
            semanticScholarData.abstract.length > improvedAbstract.length)
        ) {
          improvedAbstract = semanticScholarData.abstract;
          updates.abstract = true;
        }

        // Look for image in Semantic Scholar
        if (!imageSrc && semanticScholarData.imageUrl) {
          imageSrc = semanticScholarData.imageUrl;
        }
      }
    } catch (error) {
      logger.error("Error fetching Semantic Scholar data", error, "ContentEnrichment", { doi: study.doi });
    }

    // Process image if one was found.
    //
    // Article/journal figures are copyrighted artwork; even OA CC-ND/NC
    // licenses prohibit reuse out of context or for commercial purposes, and
    // none of these upstream sources expose a per-figure license we can check.
    // So figure ingestion is DISABLED by default and only runs when a
    // maintainer explicitly opts in via ENRICHMENT_INGEST_FIGURES=true. Study
    // imagery should come from the existing AI image generator instead.
    // Existing images are never touched (guarded by !study.imageUrl below).
    let imageUrl = study.imageUrl;
    if (imageSrc && !study.imageUrl && FIGURE_INGESTION_ENABLED) {
      try {
        imageUrl = await downloadImage(imageSrc, studyId);
        updates.images = !!imageUrl;
      } catch (error) {
        logger.error("Error downloading image", error, "ContentEnrichment", { url: imageSrc });
      }
    }

    // Update the study in the database with enhanced content
    await db
      .update(studies)
      .set({
        abstract: improvedAbstract,
        methods: improvedMethods,
        results: improvedResults,
        conclusion: improvedConclusion,
        imageUrl: imageUrl,
      })
      .where(eq(studies.id, studyId));

    // Determine how many sections were enhanced
    const totalUpdates = Object.values(updates).filter(Boolean).length;
    const successMessage =
      totalUpdates > 0
        ? `Enhanced ${totalUpdates} sections of study #${studyId}`
        : `No new content found for study #${studyId}`;

    return {
      success: true,
      message: successMessage,
      updates,
      studyId,
    };
  } catch (error: any) {
    logger.error("Error enhancing study", error, "ContentEnrichment", { studyId });
    return {
      success: false,
      message: `Error: ${error.message || "Unknown error"}`,
      studyId,
    };
  }
}

/**
 * Batch process multiple studies for content enhancement
 */
export async function batchEnhanceStudies(studyIds: number[]): Promise<{
  processed: number;
  success: number;
  failed: number;
  message: string;
}> {
  const results = {
    processed: 0,
    success: 0,
    failed: 0,
    message: "",
  };

  logger.info("Starting batch enhancement", "ContentEnrichment", { count: studyIds.length });

  for (const studyId of studyIds) {
    try {
      results.processed++;
      const enhancementResult = await enhanceStudyContent(studyId);

      if (enhancementResult.success) {
        results.success++;
      } else {
        results.failed++;
      }

      // Small delay to avoid hammering external APIs
      await new Promise((resolve) => setTimeout(resolve, 1000));
    } catch (error) {
      results.failed++;
      logger.error("Error processing study", error, "ContentEnrichment", { studyId });
    }
  }

  results.message = `Processed ${results.processed} studies. Successfully enhanced: ${results.success}, Failed: ${results.failed}`;
  logger.info(results.message, "ContentEnrichment");

  return results;
}

// Opt-in gate for downloading/storing publisher article figures. Off by
// default because journal figures are copyrighted and no per-figure license is
// available from these sources. Set ENRICHMENT_INGEST_FIGURES=true only if the
// operator has confirmed reuse rights.
const FIGURE_INGESTION_ENABLED =
  process.env.ENRICHMENT_INGEST_FIGURES === "true";

// NOTE: doi.org / dx.doi.org are intentionally NOT allowlisted. A doi.org URL
// redirects to an arbitrary publisher site whose full text is copyrighted;
// following those redirects and republishing Methods/Results/Conclusion is not
// permitted. Only clearly OA/permitted first-party sources are kept here.
const ALLOWED_ENRICHMENT_HOSTS = new Set([
  "api.crossref.org",
  "www.crossref.org",
  "crossref.org",
  "europepmc.org",
  "www.europepmc.org",
  "api.semanticscholar.org",
  "www.semanticscholar.org",
  "pubmed.ncbi.nlm.nih.gov",
  "eutils.ncbi.nlm.nih.gov",
  "www.ncbi.nlm.nih.gov",
  "pmc.ncbi.nlm.nih.gov",
]);

function isPrivateHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (h === "localhost" || h === "0.0.0.0" || h === "::1" || h === "[::1]") return true;
  // IPv4 private ranges + link-local (cloud metadata)
  if (/^(10\.|127\.|169\.254\.|192\.168\.)/.test(h)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(h)) return true;
  // Basic IPv6 loopback/link-local
  if (/^(fc|fd)/.test(h) || /^fe8/.test(h)) return true;
  return false;
}

function assertSafeEnrichmentUrl(url: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("Invalid URL");
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error(`Disallowed protocol: ${parsed.protocol}`);
  }
  if (isPrivateHost(parsed.hostname)) {
    throw new Error(`Disallowed host: ${parsed.hostname}`);
  }
  if (!ALLOWED_ENRICHMENT_HOSTS.has(parsed.hostname.toLowerCase())) {
    throw new Error(`Host not in enrichment allowlist: ${parsed.hostname}`);
  }
  return parsed;
}

/**
 * Fetch HTML content from URL and extract meaningful text
 */
async function fetchHtmlContent(url: string): Promise<string> {
  try {
    assertSafeEnrichmentUrl(url);
    const response = await axios.get(url, {
      timeout: 15000,
      maxRedirects: 3,
      maxContentLength: 5 * 1024 * 1024,
    });
    const html = response.data;
    const $ = load(html);

    // Remove unnecessary elements
    $(
      "script, style, nav, header, footer, .header, .footer, .nav, .sidebar, .menu, .ad, .advertisement",
    ).remove();

    // Extract main content
    const mainContent = $(
      ".main, .content, .article, article, main, #content, #main",
    )
      .map((_, el) => $(el).text().trim())
      .get()
      .join("\n\n");

    return mainContent || $("body").text().trim();
  } catch (error) {
    logger.error("Error fetching URL", error, "ContentEnrichment", { url });
    return "";
  }
}

/**
 * Extract sections from HTML full text
 */
function extractSectionsFromFullText(htmlText: string): {
  methods?: string;
  results?: string;
  conclusion?: string;
} {
  const $ = load(htmlText);
  const sections: any = {};

  // Common section header selectors
  const methodsSelectors = [
    "#methods",
    ".methods",
    'h2:contains("Methods")',
    'h3:contains("Methods")',
    'h2:contains("Materials and Methods")',
    'h3:contains("Materials and Methods")',
    'section:contains("Methods")',
  ];

  const resultsSelectors = [
    "#results",
    ".results",
    'h2:contains("Results")',
    'h3:contains("Results")',
    'section:contains("Results")',
  ];

  const conclusionSelectors = [
    "#conclusion",
    ".conclusion",
    'h2:contains("Conclusion")',
    'h3:contains("Conclusions")',
    'h2:contains("Discussion")',
    'h3:contains("Discussion")',
    'section:contains("Conclusion")',
    'section:contains("Discussion")',
  ];

  // Extract methods
  for (const selector of methodsSelectors) {
    const methodsText = extractSectionText($, selector);
    if (methodsText && methodsText.length > 100) {
      sections.methods = methodsText;
      break;
    }
  }

  // Extract results
  for (const selector of resultsSelectors) {
    const resultsText = extractSectionText($, selector);
    if (resultsText && resultsText.length > 100) {
      sections.results = resultsText;
      break;
    }
  }

  // Extract conclusion/discussion
  for (const selector of conclusionSelectors) {
    const conclusionText = extractSectionText($, selector);
    if (conclusionText && conclusionText.length > 100) {
      sections.conclusion = conclusionText;
      break;
    }
  }

  return sections;
}

/**
 * Helper to extract text from section
 */
function extractSectionText($: any, selector: string): string {
  const element = $(selector).first();
  if (!element.length) return "";

  // If it's a heading, get all text until the next heading
  if (selector.includes("h2:") || selector.includes("h3:")) {
    let text = "";
    let next = element.next();
    while (next.length && !next.is("h2, h3")) {
      text += next.text().trim() + "\n\n";
      next = next.next();
    }
    return text.trim();
  }

  // Otherwise get text from the actual element
  return element.text().trim();
}

/**
 * Extract sections from XML (for PMC)
 */
function extractSectionsFromXml(xml: string): {
  methods?: string;
  results?: string;
  conclusion?: string;
} {
  try {
    const $ = load(xml, { xmlMode: true });
    const sections: any = {};

    // Methods section
    $(
      'sec[sec-type="methods"], sec:contains("Methods"), sec:contains("METHODS")',
    ).each(function () {
      if (!sections.methods) {
        sections.methods = $(this).text().trim();
      }
    });

    // Results section
    $(
      'sec[sec-type="results"], sec:contains("Results"), sec:contains("RESULTS")',
    ).each(function () {
      if (!sections.results) {
        sections.results = $(this).text().trim();
      }
    });

    // Conclusion section
    $(
      'sec[sec-type="conclusions"], sec:contains("Conclusion"), sec:contains("CONCLUSION"), sec:contains("Discussion"), sec:contains("DISCUSSION")',
    ).each(function () {
      if (!sections.conclusion) {
        sections.conclusion = $(this).text().trim();
      }
    });

    return sections;
  } catch (error) {
    logger.error("Error extracting sections from XML", error, "ContentEnrichment");
    return {};
  }
}

/**
 * Download an image from URL and save it to the uploads directory
 */
async function downloadImage(
  url: string,
  studyId: number,
): Promise<string | null> {
  try {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return null;
    }
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
    if (isPrivateHost(parsed.hostname)) return null;
    const response = await axios.get(url, {
      responseType: "arraybuffer",
      timeout: 15000,
      maxRedirects: 3,
      maxContentLength: 10 * 1024 * 1024,
    });
    const contentType = String(response.headers["content-type"] || "");

    // Ensure it's an image
    if (!contentType || !contentType.startsWith("image/")) {
      return null;
    }

    // Create uploads directory if it doesn't exist
    const uploadsDir = path.join(process.cwd(), "uploads");
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    // Determine file extension
    const extension = contentType.split("/")[1] || "jpg";
    const fileName = `study_${studyId}_${Date.now()}.${extension}`;
    const filePath = path.join(uploadsDir, fileName);

    // Write the file
    fs.writeFileSync(filePath, Buffer.from(response.data));

    // Return the relative path for storage in the database
    return `/uploads/${fileName}`;
  } catch (error) {
    logger.error("Error downloading image", error, "ContentEnrichment", { url });
    return null;
  }
}

/**
 * Find studies with incomplete content for enhancement
 */
export async function findStudiesForEnhancement(
  limit: number = 50,
): Promise<number[]> {
  try {
    // Use raw SQL for more complex conditions
    const result = await db.execute(sql`
      SELECT id FROM studies 
      WHERE doi IS NOT NULL 
      AND (
        abstract IS NULL 
        OR LENGTH(abstract) < 200
        OR methods IS NULL 
        OR results IS NULL 
        OR conclusion IS NULL 
        OR image_url IS NULL
      )
      ORDER BY created_at DESC
      LIMIT ${limit}
    `);

    if (!result.rows || result.rows.length === 0) {
      return [];
    }

    return result.rows.map((row) => Number(row.id));
  } catch (error) {
    logger.error("Error finding studies for enhancement", error, "ContentEnrichment");
    return [];
  }
}
