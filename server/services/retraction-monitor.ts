/**
 * Retraction & Correction Monitor
 *
 * Periodically checks if any studies in our database have been:
 * - Retracted by the publisher
 * - Corrected/updated (erratum, corrigendum)
 * - Withdrawn
 * - Expression of concern issued
 *
 * Uses three data sources:
 * 1. CrossRef API — event endpoint for DOI status changes
 * 2. PubMed retraction database — via eutils retraction search
 * 3. Retraction Watch database (via CrossRef) — comprehensive retraction tracking
 *
 * When a retraction/correction is found:
 * - Updates the study record with retraction status
 * - Creates high-priority update notifications for impacted blog content
 * - Flags the study in admin dashboard
 */

import { db } from "../db";
import { studies, blogArticles, updateNotifications } from "../../shared/schema";
import { eq, isNotNull, sql, and, or, inArray } from "drizzle-orm";
import { fetchWithTimeout } from "../utils/http";

const USER_AGENT = "HydrogenStudies.com Research Database/1.0 (https://hydrogenstudies.com; mailto:info@hydrogenstudies.com)";

export type RetractionStatus = "retracted" | "corrected" | "withdrawn" | "expression_of_concern" | "updated" | "none";

interface RetractionCheckResult {
  studyId: number;
  doi: string;
  status: RetractionStatus;
  details: string;
  sourceUrl?: string;
  detectedAt: Date;
}

// ============================================================
// CrossRef DOI Status Check
// ============================================================

/**
 * Check a DOI for retraction/correction via CrossRef API
 * The CrossRef API includes a "update-to" field for corrections and retractions
 */
async function checkCrossRefStatus(doi: string): Promise<{
  status: RetractionStatus;
  details: string;
  url?: string;
} | null> {
  try {
    const url = `https://api.crossref.org/works/${encodeURIComponent(doi)}`;
    const response = await fetchWithTimeout(url, {
      headers: { "User-Agent": USER_AGENT },
    });

    if (!response.ok) {
      if (response.status === 404) return null; // DOI not found
      return null;
    }

    const data = await response.json();
    const work = data.message;

    if (!work) return null;

    // Check for updates (retractions, corrections, etc.)
    if (work["update-to"] && work["update-to"].length > 0) {
      for (const update of work["update-to"]) {
        const updateType = (update.type || update.label || "").toLowerCase();

        if (updateType.includes("retraction") || updateType.includes("withdrawal")) {
          return {
            status: "retracted",
            details: `Retraction notice: ${update.label || updateType}. Updated DOI: ${update.DOI || "N/A"}`,
            url: update.DOI ? `https://doi.org/${update.DOI}` : undefined,
          };
        }
        if (updateType.includes("correction") || updateType.includes("erratum") || updateType.includes("corrigendum")) {
          return {
            status: "corrected",
            details: `Correction issued: ${update.label || updateType}. Correction DOI: ${update.DOI || "N/A"}`,
            url: update.DOI ? `https://doi.org/${update.DOI}` : undefined,
          };
        }
        if (updateType.includes("expression") && updateType.includes("concern")) {
          return {
            status: "expression_of_concern",
            details: `Expression of concern: ${update.label || updateType}`,
            url: update.DOI ? `https://doi.org/${update.DOI}` : undefined,
          };
        }
      }
    }

    // Also check the "relation" field for linked retractions
    if (work.relation) {
      const isRetractedBy = work.relation["is-retracted-by"];
      if (isRetractedBy && isRetractedBy.length > 0) {
        return {
          status: "retracted",
          details: `Retracted. Retraction notice DOI: ${isRetractedBy[0].id || "Unknown"}`,
          url: isRetractedBy[0].id ? `https://doi.org/${isRetractedBy[0].id}` : undefined,
        };
      }

      const isCorrectedBy = work.relation["is-corrected-by"];
      if (isCorrectedBy && isCorrectedBy.length > 0) {
        return {
          status: "corrected",
          details: `Correction available. Correction DOI: ${isCorrectedBy[0].id || "Unknown"}`,
          url: isCorrectedBy[0].id ? `https://doi.org/${isCorrectedBy[0].id}` : undefined,
        };
      }
    }

    return { status: "none", details: "" };
  } catch (error) {
    console.error(`[RetractionMonitor] CrossRef check error for ${doi}:`, error);
    return null;
  }
}

// ============================================================
// PubMed Retraction Check
// ============================================================

/**
 * Check PubMed for retraction notices referencing a DOI or PMID
 * Uses PubMed's retraction publication type search
 */
async function checkPubMedRetraction(doi: string, title: string): Promise<{
  status: RetractionStatus;
  details: string;
  url?: string;
} | null> {
  try {
    const apiKey = process.env.PUBMED_API_KEY || "";
    const apiKeyParam = apiKey ? `&api_key=${apiKey}` : "";

    // Search for retraction notices mentioning this DOI or exact title
    const searchQuery = doi
      ? `"${doi}"[DOI] AND "retracted publication"[PT]`
      : `"${title.substring(0, 100)}"[Title] AND "retracted publication"[PT]`;

    const searchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=${encodeURIComponent(searchQuery)}&retmode=json${apiKeyParam}`;

    const searchResponse = await fetchWithTimeout(searchUrl, {
      headers: { "User-Agent": USER_AGENT },
    });

    if (!searchResponse.ok) return null;

    const searchData = await searchResponse.json();
    const count = parseInt(searchData.esearchresult?.count || "0");

    if (count > 0) {
      return {
        status: "retracted",
        details: `PubMed retraction notice found. ${count} retraction record(s) for this study.`,
        url: `https://pubmed.ncbi.nlm.nih.gov/?term=${encodeURIComponent(searchQuery)}`,
      };
    }

    // Also check for errata/corrections
    const correctionQuery = doi
      ? `"${doi}"[DOI] AND ("published erratum"[PT] OR "correction"[PT])`
      : `"${title.substring(0, 100)}"[Title] AND ("published erratum"[PT] OR "correction"[PT])`;

    const correctionUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=${encodeURIComponent(correctionQuery)}&retmode=json${apiKeyParam}`;

    const correctionResponse = await fetchWithTimeout(correctionUrl, {
      headers: { "User-Agent": USER_AGENT },
    });

    if (!correctionResponse.ok) return null;

    const correctionData = await correctionResponse.json();
    const correctionCount = parseInt(correctionData.esearchresult?.count || "0");

    if (correctionCount > 0) {
      return {
        status: "corrected",
        details: `PubMed correction/erratum found. ${correctionCount} correction(s) for this study.`,
        url: `https://pubmed.ncbi.nlm.nih.gov/?term=${encodeURIComponent(correctionQuery)}`,
      };
    }

    return { status: "none", details: "" };
  } catch (error) {
    console.error(`[RetractionMonitor] PubMed check error for ${doi}:`, error);
    return null;
  }
}

// ============================================================
// Main Retraction Check Logic
// ============================================================

/**
 * Check a single study for retraction/correction status
 */
export async function checkStudyRetraction(study: {
  id: number;
  doi: string | null;
  title: string;
}): Promise<RetractionCheckResult | null> {
  if (!study.doi && !study.title) return null;

  // Check CrossRef first (most reliable for DOI-based lookups)
  if (study.doi) {
    const crossRefResult = await checkCrossRefStatus(study.doi);
    if (crossRefResult && crossRefResult.status !== "none") {
      return {
        studyId: study.id,
        doi: study.doi,
        status: crossRefResult.status,
        details: crossRefResult.details,
        sourceUrl: crossRefResult.url,
        detectedAt: new Date(),
      };
    }
  }

  // Check PubMed (catches things CrossRef might miss)
  const pubMedResult = await checkPubMedRetraction(study.doi || "", study.title);
  if (pubMedResult && pubMedResult.status !== "none") {
    return {
      studyId: study.id,
      doi: study.doi || "",
      status: pubMedResult.status,
      details: pubMedResult.details,
      sourceUrl: pubMedResult.url,
      detectedAt: new Date(),
    };
  }

  return null;
}

// ============================================================
// Batch Retraction Check
// ============================================================

/**
 * Check all studies with DOIs for retraction/correction
 * Runs in batches to avoid rate limiting
 */
export async function batchRetractionCheck(options: {
  batchSize?: number;
  delayMs?: number;
  onProgress?: (checked: number, total: number, found: RetractionCheckResult[]) => void;
} = {}): Promise<{
  checked: number;
  retracted: number;
  corrected: number;
  expressionOfConcern: number;
  results: RetractionCheckResult[];
}> {
  const { batchSize = 50, delayMs = 500, onProgress } = options;

  // Get all studies with DOIs (only studies not already marked)
  const studiesWithDois = await db.select({
    id: studies.id,
    doi: studies.doi,
    title: studies.title,
    peerReviewStatus: studies.peerReviewStatus,
  })
    .from(studies)
    .where(
      and(
        isNotNull(studies.doi),
        or(
          // Don't re-check studies already marked as retracted
          sql`${studies.peerReviewStatus} IS NULL`,
          sql`${studies.peerReviewStatus} NOT IN ('retracted', 'withdrawn')`,
        )
      )
    )
    .limit(batchSize);

  const allResults: RetractionCheckResult[] = [];
  let retracted = 0;
  let corrected = 0;
  let expressionOfConcern = 0;

  for (let i = 0; i < studiesWithDois.length; i++) {
    const study = studiesWithDois[i];

    const result = await checkStudyRetraction({
      id: study.id,
      doi: study.doi,
      title: study.title,
    });

    if (result) {
      allResults.push(result);

      if (result.status === "retracted" || result.status === "withdrawn") {
        retracted++;
        await handleRetraction(result);
      } else if (result.status === "corrected") {
        corrected++;
        await handleCorrection(result);
      } else if (result.status === "expression_of_concern") {
        expressionOfConcern++;
        await handleExpressionOfConcern(result);
      }
    }

    onProgress?.(i + 1, studiesWithDois.length, allResults);

    // Rate limiting
    if (delayMs > 0 && i < studiesWithDois.length - 1) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }

  return {
    checked: studiesWithDois.length,
    retracted,
    corrected,
    expressionOfConcern,
    results: allResults,
  };
}

// ============================================================
// Handlers — What happens when we detect an issue
// ============================================================

/**
 * Handle a retracted study:
 * 1. Mark the study as retracted
 * 2. Find all blog posts referencing this study
 * 3. Create critical-priority update notifications
 */
async function handleRetraction(result: RetractionCheckResult): Promise<void> {
  console.warn(`[RetractionMonitor] RETRACTION DETECTED: Study ${result.studyId} (DOI: ${result.doi})`);

  // 1. Update the study record
  await db.update(studies).set({
    peerReviewStatus: "retracted",
    conflictOfInterest: `RETRACTED: ${result.details}`,
    lastModified: new Date(),
  }).where(eq(studies.id, result.studyId));

  // 2. Find impacted blog posts
  const impactedBlogs = await db.select({
    id: blogArticles.id,
    title: blogArticles.title,
  })
    .from(blogArticles)
    .where(eq(blogArticles.studyId, result.studyId));

  // 3. Create critical notifications for each impacted blog
  for (const blog of impactedBlogs) {
    await db.insert(updateNotifications).values({
      contentType: "blog",
      contentId: blog.id,
      triggerType: "contradicting_evidence",
      triggerContentId: result.studyId,
      priority: "critical",
      priorityScore: 100,
      status: "pending",
      updateSummary: `URGENT: Source study has been RETRACTED. Blog "${blog.title}" references retracted research and must be updated or unpublished.`,
      suggestedChanges: `1. Unpublish this blog post immediately\n2. Add retraction notice to the study page\n3. Review other content that cites this study\n\nRetraction details: ${result.details}`,
      impactedSections: ["all"],
    });
  }

  // Also create a notification for the study itself
  await db.insert(updateNotifications).values({
    contentType: "study",
    contentId: result.studyId,
    triggerType: "contradicting_evidence",
    priority: "critical",
    priorityScore: 100,
    status: "pending",
    updateSummary: `Study has been RETRACTED by the publisher. ${result.details}`,
    suggestedChanges: `1. Add prominent retraction banner to study page\n2. Remove from featured/recommended content\n3. Update any blog posts that cite this study\n4. Consider removing from category counts`,
    impactedSections: ["all"],
  });

  console.warn(`[RetractionMonitor] Created ${impactedBlogs.length + 1} critical notifications for retraction`);
}

/**
 * Handle a corrected study:
 * 1. Note the correction in the study record
 * 2. Create high-priority notifications for review
 */
async function handleCorrection(result: RetractionCheckResult): Promise<void> {
  console.log(`[RetractionMonitor] CORRECTION detected: Study ${result.studyId} (DOI: ${result.doi})`);

  await db.update(studies).set({
    peerReviewStatus: "corrected",
    conflictOfInterest: `CORRECTED: ${result.details}` + (result.sourceUrl ? ` See: ${result.sourceUrl}` : ""),
    lastModified: new Date(),
  }).where(eq(studies.id, result.studyId));

  // Find impacted blogs
  const impactedBlogs = await db.select({ id: blogArticles.id, title: blogArticles.title })
    .from(blogArticles)
    .where(eq(blogArticles.studyId, result.studyId));

  for (const blog of impactedBlogs) {
    await db.insert(updateNotifications).values({
      contentType: "blog",
      contentId: blog.id,
      triggerType: "contradicting_evidence",
      triggerContentId: result.studyId,
      priority: "high",
      priorityScore: 75,
      status: "pending",
      updateSummary: `Source study has been CORRECTED. Blog "${blog.title}" may need updating to reflect the correction.`,
      suggestedChanges: `Review the correction notice and update blog content if the correction affects claims made in the article.\n\n${result.details}`,
      impactedSections: ["results", "conclusion"],
    });
  }
}

/**
 * Handle expression of concern
 */
async function handleExpressionOfConcern(result: RetractionCheckResult): Promise<void> {
  console.log(`[RetractionMonitor] EXPRESSION OF CONCERN: Study ${result.studyId}`);

  await db.update(studies).set({
    peerReviewStatus: "expression_of_concern",
    conflictOfInterest: `EXPRESSION OF CONCERN: ${result.details}`,
    lastModified: new Date(),
  }).where(eq(studies.id, result.studyId));

  await db.insert(updateNotifications).values({
    contentType: "study",
    contentId: result.studyId,
    triggerType: "contradicting_evidence",
    priority: "high",
    priorityScore: 70,
    status: "pending",
    updateSummary: `Expression of concern issued for this study. ${result.details}`,
    suggestedChanges: `1. Add caution notice to study page\n2. Review blog posts citing this study\n3. Monitor for potential retraction`,
    impactedSections: ["credibility", "conclusions"],
  });
}

/**
 * Get retraction check status — how many studies have been flagged
 */
export async function getRetractionStatus(): Promise<{
  totalWithDoi: number;
  retracted: number;
  corrected: number;
  expressionOfConcern: number;
  unchecked: number;
}> {
  const [totalWithDoi] = await db.select({ count: sql<number>`count(*)` })
    .from(studies)
    .where(isNotNull(studies.doi));

  const [retracted] = await db.select({ count: sql<number>`count(*)` })
    .from(studies)
    .where(eq(studies.peerReviewStatus, "retracted"));

  const [corrected] = await db.select({ count: sql<number>`count(*)` })
    .from(studies)
    .where(eq(studies.peerReviewStatus, "corrected"));

  const [eoc] = await db.select({ count: sql<number>`count(*)` })
    .from(studies)
    .where(eq(studies.peerReviewStatus, "expression_of_concern"));

  return {
    totalWithDoi: Number(totalWithDoi?.count || 0),
    retracted: Number(retracted?.count || 0),
    corrected: Number(corrected?.count || 0),
    expressionOfConcern: Number(eoc?.count || 0),
    unchecked: Number(totalWithDoi?.count || 0) - Number(retracted?.count || 0) - Number(corrected?.count || 0) - Number(eoc?.count || 0),
  };
}
