/**
 * Targeted Research Enrichment
 *
 * Enriches studies with authentic data from research APIs:
 * - CrossRef for DOI metadata and links
 * - PubMed for medical research data
 * - Europe PMC for open access content
 */

import { db } from "./db";
import { studies } from "@shared/schema";
import { eq, and, isNull, or } from "drizzle-orm";

interface EnrichmentStats {
  totalProcessed: number;
  successfulEnrichments: number;
  errors: string[];
  enrichmentSources: {
    crossref: number;
    pubmed: number;
    europepmc: number;
  };
}

/**
 * Run targeted enrichment for studies missing research data
 */
export async function runTargetedEnrichment(): Promise<EnrichmentStats> {
  const stats: EnrichmentStats = {
    totalProcessed: 0,
    successfulEnrichments: 0,
    errors: [],
    enrichmentSources: {
      crossref: 0,
      pubmed: 0,
      europepmc: 0,
    },
  };

  console.log("Starting targeted research enrichment...");

  try {
    // Get studies that need enrichment
    const studiesNeedingEnrichment = await db
      .select({
        id: studies.id,
        title: studies.title,
        doi: studies.doi,
        pdfUrl: studies.pdfUrl,
        citationUrl: studies.citationUrl,
        sourceUrl: studies.sourceUrl,
      })
      .from(studies)
      .where(
        and(
          isNull(studies.doi) === false,
          or(
            isNull(studies.pdfUrl),
            eq(studies.pdfUrl, ""),
            isNull(studies.citationUrl),
            eq(studies.citationUrl, ""),
            isNull(studies.sourceUrl),
            eq(studies.sourceUrl, ""),
          ),
        ),
      )
      .limit(50); // Process in manageable batches

    console.log(
      `Found ${studiesNeedingEnrichment.length} studies needing enrichment`,
    );

    for (const study of studiesNeedingEnrichment) {
      stats.totalProcessed++;

      try {
        const enrichmentData = await enrichStudyFromResearchAPIs(study);

        if (enrichmentData && Object.keys(enrichmentData).length > 0) {
          await db
            .update(studies)
            .set(enrichmentData)
            .where(eq(studies.id, study.id));

          stats.successfulEnrichments++;
          console.log(`✓ Enriched study ${study.id}: ${study.title}`);

          // Track which sources provided data
          if (enrichmentData.crossrefEnriched)
            stats.enrichmentSources.crossref++;
          if (enrichmentData.pubmedEnriched) stats.enrichmentSources.pubmed++;
          if (enrichmentData.europePmcEnriched)
            stats.enrichmentSources.europepmc++;
        }
      } catch (error) {
        const errorMsg = `Study ${study.id}: ${error instanceof Error ? error.message : "Unknown error"}`;
        stats.errors.push(errorMsg);
        console.warn(`! ${errorMsg}`);
      }

      // Rate limiting to respect API limits
      await new Promise((resolve) => setTimeout(resolve, 200));
    }

    console.log(
      `Enrichment completed: ${stats.successfulEnrichments}/${stats.totalProcessed} studies enriched`,
    );
    return stats;
  } catch (error) {
    console.error("Targeted enrichment failed:", error);
    throw error;
  }
}

/**
 * Enrich a single study using research APIs
 */
async function enrichStudyFromResearchAPIs(study: any): Promise<any> {
  const enrichmentData: any = {};
  let hasEnrichment = false;

  // 1. Try CrossRef API
  try {
    const crossrefData = await fetchFromCrossRef(study.doi);
    if (crossrefData) {
      Object.assign(enrichmentData, crossrefData);
      enrichmentData.crossrefEnriched = true;
      hasEnrichment = true;
    }
  } catch (error) {
    console.log(`CrossRef failed for DOI ${study.doi}:`, error);
  }

  // 2. Try Europe PMC API
  try {
    const europePmcData = await fetchFromEuropePMC(study.doi);
    if (europePmcData) {
      // Only add data that wasn't already found
      for (const [key, value] of Object.entries(europePmcData)) {
        if (!enrichmentData[key] && value) {
          enrichmentData[key] = value;
        }
      }
      enrichmentData.europePmcEnriched = true;
      hasEnrichment = true;
    }
  } catch (error) {
    console.log(`Europe PMC failed for DOI ${study.doi}:`, error);
  }

  // 3. Try PubMed API
  try {
    const pubmedData = await fetchFromPubMed(study.doi);
    if (pubmedData) {
      // Only add data that wasn't already found
      for (const [key, value] of Object.entries(pubmedData)) {
        if (!enrichmentData[key] && value) {
          enrichmentData[key] = value;
        }
      }
      enrichmentData.pubmedEnriched = true;
      hasEnrichment = true;
    }
  } catch (error) {
    console.log(`PubMed failed for DOI ${study.doi}:`, error);
  }

  return hasEnrichment ? enrichmentData : null;
}

/**
 * Fetch data from CrossRef API
 */
async function fetchFromCrossRef(doi: string): Promise<any | null> {
  try {
    const response = await fetch(`https://api.crossref.org/works/${doi}`, {
      headers: {
        "User-Agent":
          "HydrogenStudies/1.0 (mailto:contact@hydrogenstudies.com)",
      },
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    const work = data.message;

    const enrichment: any = {};

    // Extract PDF and citation URLs
    if (work.link) {
      const pdfLink = work.link.find(
        (link: any) =>
          link["content-type"] === "application/pdf" ||
          link["content-type"] === "unspecified",
      );
      if (pdfLink?.URL) {
        enrichment.pdfUrl = pdfLink.URL;
      }
    }

    // Citation URL from DOI
    if (work.DOI) {
      enrichment.citationUrl = `https://doi.org/${work.DOI}`;
    }

    // Source URL from publisher
    if (work.URL) {
      enrichment.sourceUrl = work.URL;
    }

    return Object.keys(enrichment).length > 0 ? enrichment : null;
  } catch (error) {
    throw new Error(`CrossRef API error: ${error}`);
  }
}

/**
 * Fetch data from Europe PMC API
 */
async function fetchFromEuropePMC(doi: string): Promise<any | null> {
  try {
    const response = await fetch(
      `https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=DOI:${encodeURIComponent(doi)}&format=json`,
    );

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    const result = data.resultList?.result?.[0];

    if (!result) {
      return null;
    }

    const enrichment: any = {};

    // PDF from full text links
    if (result.fullTextUrlList?.fullTextUrl) {
      const pdfUrl = result.fullTextUrlList.fullTextUrl.find(
        (url: any) =>
          url.documentStyle === "pdf" && url.availabilityCode === "OA",
      );
      if (pdfUrl?.url) {
        enrichment.pdfUrl = pdfUrl.url;
      }
    }

    // Citation URL
    if (result.doi) {
      enrichment.citationUrl = `https://doi.org/${result.doi}`;
    }

    // Source URL
    if (result.id) {
      enrichment.sourceUrl = `https://europepmc.org/article/MED/${result.id}`;
    }

    return Object.keys(enrichment).length > 0 ? enrichment : null;
  } catch (error) {
    throw new Error(`Europe PMC API error: ${error}`);
  }
}

/**
 * Fetch data from PubMed API
 */
async function fetchFromPubMed(doi: string): Promise<any | null> {
  try {
    // First, search for the DOI in PubMed
    const searchResponse = await fetch(
      `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=${encodeURIComponent(doi)}&retmode=json`,
    );

    if (!searchResponse.ok) {
      return null;
    }

    const searchData = await searchResponse.json();
    const pmid = searchData.esearchresult?.idlist?.[0];

    if (!pmid) {
      return null;
    }

    // Get summary data
    const summaryResponse = await fetch(
      `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&id=${pmid}&retmode=json`,
    );

    if (!summaryResponse.ok) {
      return null;
    }

    const summaryData = await summaryResponse.json();
    const result = summaryData.result?.[pmid];

    if (!result) {
      return null;
    }

    const enrichment: any = {};

    // Citation URL to PubMed
    enrichment.citationUrl = `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`;

    // Source URL (same as citation for PubMed)
    enrichment.sourceUrl = `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`;

    return enrichment;
  } catch (error) {
    throw new Error(`PubMed API error: ${error}`);
  }
}
