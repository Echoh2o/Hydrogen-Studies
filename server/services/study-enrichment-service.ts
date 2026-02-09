/**
 * Study Enrichment Service
 * Enriches studies with data from external research APIs (CrossRef, PubMed, EuropePMC)
 */
import { db } from "../db";
import { studies } from "../../shared/schema";
import { eq, sql } from "drizzle-orm";

interface EnrichmentResult {
  success: boolean;
  error?: string;
  enrichmentData?: any;
  sources?: string[];
}

interface EnrichmentData {
  methods?: string;
  results?: string;
  conclusion?: string;
  pdfUrl?: string;
  citationUrl?: string;
  sourceUrl?: string;
  abstract?: string;
  authorAffiliations?: string[];
  fundingSources?: string[];
  statisticalMethods?: string;
  ethicalApproval?: string;
  fullText?: string;
}

const processedStudies = new Set<number>(); // Track processed studies to prevent loops

/**
 * Enrich a study using multiple external research APIs
 */
export async function enrichStudyFromAPIs(
  studyId: number,
  doi: string,
): Promise<EnrichmentResult> {
  try {
    // Check if we've already processed this study in this session
    if (processedStudies.has(studyId)) {
      return {
        success: false,
        error: "Study already processed in this session",
      };
    }

    // Mark as processed to prevent loops
    processedStudies.add(studyId);

    const cleanDoi = doi.replace(/^https?:\/\/(dx\.)?doi\.org\//, "").trim();

    if (!cleanDoi) {
      return {
        success: false,
        error: "Invalid or empty DOI",
      };
    }

    console.log(`Enriching study ${studyId} with DOI: ${cleanDoi}`);

    let enrichmentData: EnrichmentData = {};
    const sources: string[] = [];

    // Try CrossRef API first
    try {
      const crossRefData = await fetchFromCrossRef(cleanDoi);
      if (crossRefData) {
        enrichmentData = {
          ...enrichmentData,
          ...extractCrossRefData(crossRefData),
        };
        sources.push("CrossRef");
        console.log(`✓ CrossRef data retrieved for study ${studyId}`);
      }
    } catch (error) {
      console.warn(`CrossRef failed for study ${studyId}:`, error);
    }

    // Try EuropePMC API if CrossRef didn't provide sufficient data
    if (!enrichmentData.abstract || !enrichmentData.pdfUrl) {
      try {
        const europePmcData = await fetchFromEuropePMC(cleanDoi);
        if (europePmcData) {
          const pmcData = extractEuropePMCData(europePmcData);
          enrichmentData = { ...enrichmentData, ...pmcData };
          sources.push("EuropePMC");
          console.log(`✓ EuropePMC data retrieved for study ${studyId}`);
        }
      } catch (error) {
        console.warn(`EuropePMC failed for study ${studyId}:`, error);
      }
    }

    // If we have enrichment data, update the study
    if (Object.keys(enrichmentData).length > 0) {
      await updateStudyWithEnrichmentData(studyId, enrichmentData);

      return {
        success: true,
        enrichmentData,
        sources,
      };
    } else {
      return {
        success: false,
        error: "No enrichment data found from any source",
      };
    }
  } catch (error) {
    console.error(`Error enriching study ${studyId}:`, error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Unknown enrichment error",
    };
  }
}

/**
 * Fetch data from CrossRef API
 */
async function fetchFromCrossRef(doi: string): Promise<any> {
  const url = `https://api.crossref.org/works/${doi}`;

  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "HydrogenStudies/1.0 (mailto:research@hydrogenstudies.com)",
    },
  });

  if (!response.ok) {
    throw new Error(`CrossRef API error: ${response.status}`);
  }

  const data = await response.json();
  return data.message;
}

/**
 * Fetch data from EuropePMC API
 */
async function fetchFromEuropePMC(doi: string): Promise<any> {
  const url = `https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=DOI:${encodeURIComponent(doi)}&format=json&resultType=core`;

  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`EuropePMC API error: ${response.status}`);
  }

  const data = await response.json();

  if (
    data.resultList &&
    data.resultList.result &&
    data.resultList.result.length > 0
  ) {
    return data.resultList.result[0];
  }

  return null;
}

/**
 * Extract useful data from CrossRef response
 */
function extractCrossRefData(crossRefData: any): EnrichmentData {
  const enrichmentData: EnrichmentData = {};

  // Extract abstract
  if (crossRefData.abstract) {
    enrichmentData.abstract = crossRefData.abstract;
  }

  // Extract PDF URL from links
  if (crossRefData.link) {
    const pdfLink = crossRefData.link.find(
      (link: any) =>
        link["content-type"] === "application/pdf" ||
        link["content-type"] === "unspecified" ||
        link.URL?.includes(".pdf"),
    );
    if (pdfLink) {
      enrichmentData.pdfUrl = pdfLink.URL;
    }
  }

  // Extract citation URL
  if (crossRefData.URL) {
    enrichmentData.citationUrl = crossRefData.URL;
  }

  // Extract source URL
  if (crossRefData.resource?.primary?.URL) {
    enrichmentData.sourceUrl = crossRefData.resource.primary.URL;
  }

  // Extract author affiliations
  if (crossRefData.author) {
    const affiliations: string[] = [];
    crossRefData.author.forEach((author: any) => {
      if (author.affiliation) {
        author.affiliation.forEach((aff: any) => {
          if (aff.name && !affiliations.includes(aff.name)) {
            affiliations.push(aff.name);
          }
        });
      }
    });
    if (affiliations.length > 0) {
      enrichmentData.authorAffiliations = affiliations;
    }
  }

  // Extract funding information
  if (crossRefData.funder) {
    const funders = crossRefData.funder
      .map((funder: any) => funder.name)
      .filter(Boolean);
    if (funders.length > 0) {
      enrichmentData.fundingSources = funders;
    }
  }

  return enrichmentData;
}

/**
 * Extract useful data from EuropePMC response
 */
function extractEuropePMCData(pmcData: any): EnrichmentData {
  const enrichmentData: EnrichmentData = {};

  // Extract abstract
  if (pmcData.abstractText) {
    enrichmentData.abstract = pmcData.abstractText;
  }

  // Extract full text URL
  if (pmcData.fullTextUrlList?.fullTextUrl) {
    const pdfUrl = pmcData.fullTextUrlList.fullTextUrl.find(
      (url: any) => url.documentStyle === "pdf" || url.site === "PubMedCentral",
    );
    if (pdfUrl) {
      enrichmentData.pdfUrl = pdfUrl.url;
    }
  }

  // Extract DOI URL as citation
  if (pmcData.doi) {
    enrichmentData.citationUrl = `https://doi.org/${pmcData.doi}`;
  }

  // Extract journal information
  if (pmcData.journalInfo?.journal?.title) {
    enrichmentData.sourceUrl = `https://europepmc.org/article/MED/${pmcData.pmid}`;
  }

  return enrichmentData;
}

/**
 * Update study with enrichment data
 */
async function updateStudyWithEnrichmentData(
  studyId: number,
  enrichmentData: EnrichmentData,
): Promise<void> {
  const updateData: any = {};

  // Only update fields that have new data and aren't already populated
  const existingStudy = await db
    .select()
    .from(studies)
    .where(eq(studies.id, studyId))
    .limit(1);

  if (existingStudy.length === 0) {
    throw new Error(`Study ${studyId} not found`);
  }

  const study = existingStudy[0];

  // Update fields only if they're empty and we have new data
  if (
    enrichmentData.abstract &&
    (!study.abstract || study.abstract.trim() === "")
  ) {
    updateData.abstract = enrichmentData.abstract;
  }

  if (
    enrichmentData.methods &&
    (!study.methods || study.methods.trim() === "")
  ) {
    updateData.methods = enrichmentData.methods;
  }

  if (
    enrichmentData.results &&
    (!study.results || study.results.trim() === "")
  ) {
    updateData.results = enrichmentData.results;
  }

  if (
    enrichmentData.conclusion &&
    (!study.conclusion || study.conclusion.trim() === "")
  ) {
    updateData.conclusion = enrichmentData.conclusion;
  }

  if (enrichmentData.pdfUrl && (!study.pdfUrl || study.pdfUrl.trim() === "")) {
    updateData.pdfUrl = enrichmentData.pdfUrl;
  }

  if (
    enrichmentData.citationUrl &&
    (!study.citationUrl || study.citationUrl.trim() === "")
  ) {
    updateData.citationUrl = enrichmentData.citationUrl;
  }

  if (
    enrichmentData.sourceUrl &&
    (!study.sourceUrl || study.sourceUrl.trim() === "")
  ) {
    updateData.sourceUrl = enrichmentData.sourceUrl;
  }

  if (enrichmentData.authorAffiliations) {
    updateData.authorAffiliations = JSON.stringify(
      enrichmentData.authorAffiliations,
    );
  }

  if (enrichmentData.fundingSources) {
    updateData.fundingSources = JSON.stringify(enrichmentData.fundingSources);
  }

  if (enrichmentData.statisticalMethods) {
    updateData.statisticalMethods = enrichmentData.statisticalMethods;
  }

  if (enrichmentData.ethicalApproval) {
    updateData.ethicalApproval = enrichmentData.ethicalApproval;
  }

  if (enrichmentData.fullText) {
    updateData.fullText = enrichmentData.fullText;
  }

  // Only update if we have data to update
  if (Object.keys(updateData).length > 0) {
    await db.update(studies).set(updateData).where(eq(studies.id, studyId));

    console.log(
      `✓ Updated study ${studyId} with ${Object.keys(updateData).length} enriched fields`,
    );
  }
}

/**
 * Clear the processed studies cache (for admin use)
 */
export function clearProcessedStudiesCache(): void {
  processedStudies.clear();
  console.log("Cleared processed studies cache");
}

/**
 * Get processed studies count (for monitoring)
 */
export function getProcessedStudiesCount(): number {
  return processedStudies.size;
}
