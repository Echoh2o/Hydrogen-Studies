/**
 * PubMed Enricher
 *
 * This module enriches study data by fetching additional details from PubMed
 * using identifiers like PMID, DOI, or other search criteria.
 */

import { externalApi } from "../utils/http";
import { db } from "../db";
import { studies } from "../../shared/schema";
import { eq, or, isNull } from "drizzle-orm";

// PubMed API endpoints
const PUBMED_API_BASE = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils";
const PUBMED_SEARCH = `${PUBMED_API_BASE}/esearch.fcgi`;
const PUBMED_FETCH = `${PUBMED_API_BASE}/efetch.fcgi`;
const PUBMED_SUMMARY = `${PUBMED_API_BASE}/esummary.fcgi`;

// NCBI E-utilities etiquette: identify the caller via tool/email and include
// the api_key only when configured (an empty api_key= param is rejected/ignored
// and drops us to the lower anonymous rate limit). See:
// https://www.ncbi.nlm.nih.gov/books/NBK25497/
const NCBI_TOOL = "hydrogen-studies";
const NCBI_EMAIL = process.env.NCBI_EMAIL || "contact@hydrogenstudies.com";

/**
 * Build E-utilities query params with the NCBI-recommended tool/email
 * identifiers, adding api_key only when PUBMED_API_KEY is set.
 */
function eutilsParams<T extends Record<string, unknown>>(
  extra: T,
): T & { tool: string; email: string; api_key?: string } {
  const apiKey = process.env.PUBMED_API_KEY;
  return {
    ...extra,
    tool: NCBI_TOOL,
    email: NCBI_EMAIL,
    ...(apiKey ? { api_key: apiKey } : {}),
  };
}

/**
 * Enriches a study with data from PubMed
 * @param studyId The database ID of the study to enrich
 * @returns Object with success status and message
 */
export async function enrichStudyFromPubMed(
  studyId: number,
): Promise<{ success: boolean; message: string }> {
  try {
    // Get the study from database
    const [study] = await db
      .select()
      .from(studies)
      .where(eq(studies.id, studyId));

    if (!study) {
      return { success: false, message: `Study with ID ${studyId} not found` };
    }

    // Check for PMID in URL field
    let pmid = study.url ? extractPMID(study.url) : null;

    // If no PMID found, try to search by title
    if (!pmid) {
      pmid = await searchPubMedByTitle(study.title);
    }

    // If we have a PMID, fetch the full article data
    if (pmid) {
      const articleData = await fetchPubMedArticle(pmid);
      if (articleData) {
        // Update the study with the fetched data
        const enrichedData = mapPubMedDataToStudy(articleData, study);

        // Save the enriched data back to the database
        await db
          .update(studies)
          .set(enrichedData)
          .where(eq(studies.id, studyId));

        return {
          success: true,
          message: `Successfully enriched study "${study.title}" with data from PubMed (PMID: ${pmid})`,
        };
      }
    }

    return {
      success: false,
      message: `Could not find matching article in PubMed for study "${study.title}"`,
    };
  } catch (error) {
    console.error("Error enriching study from PubMed:", error);
    return {
      success: false,
      message: `Error enriching study: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Extract PMID from a URL or string
 */
export function extractPMID(url: string): string | null {
  // Check if the URL is a direct PMID
  if (/^\d+$/.test(url.trim())) {
    return url.trim();
  }

  // Extract PMID from a PubMed URL
  const pmidRegex = /pubmed\.ncbi\.nlm\.nih\.gov\/(\d+)/;
  const match = url.match(pmidRegex);

  if (match && match[1]) {
    return match[1];
  }

  // Check for PMID in URL
  const pmidMatch =
    url.match(/PMID[=:]\s*(\d+)/i) ||
    url.match(/pubmed\/(\d+)/i) ||
    url.match(/ncbi\.nlm\.nih\.gov\/pubmed\/(\d+)/i);

  return pmidMatch ? pmidMatch[1] : null;
}

/**
 * Extract PMID from any identifier (DOI, URL, or PMID)
 * This helper function is exported for use in the study details route
 */
export function extractPMIDFromIdentifier(identifier: string): string | null {
  if (!identifier) return null;

  // Direct PMID (just digits)
  if (/^\d+$/.test(identifier)) {
    return identifier;
  }

  // Extract from PubMed URL
  const pmidRegex = /pubmed\.ncbi\.nlm\.nih\.gov\/(\d+)/;
  const pmidMatch = identifier.match(pmidRegex);
  if (pmidMatch && pmidMatch[1]) {
    return pmidMatch[1];
  }

  // Check for PMID in URL
  const otherPmidMatch =
    identifier.match(/PMID[=:]\s*(\d+)/i) ||
    identifier.match(/pubmed\/(\d+)/i) ||
    identifier.match(/ncbi\.nlm\.nih\.gov\/pubmed\/(\d+)/i);

  if (otherPmidMatch && otherPmidMatch[1]) {
    return otherPmidMatch[1];
  }

  // If it's a DOI, we'll use it directly
  const doiRegex = /10\.\d{4,}\/[^\s]+/;
  if (doiRegex.test(identifier)) {
    return identifier; // Just pass the DOI through
  }

  return null;
}

/**
 * Search PubMed by article title
 */
async function searchPubMedByTitle(title: string): Promise<string | null> {
  try {
    const params = eutilsParams({
      db: "pubmed",
      term: `"${title.replace(/[^\w\s]/g, " ")}"[Title]`,
      retmode: "json",
      retmax: 1,
    });

    const response = await externalApi.get(PUBMED_SEARCH, { params });
    const data = response.data;

    if (data.esearchresult.count > 0 && data.esearchresult.idlist.length > 0) {
      return data.esearchresult.idlist[0];
    }

    return null;
  } catch (error) {
    console.error("Error searching PubMed by title:", error);
    return null;
  }
}

/**
 * Fetch article data from PubMed by PMID
 */
async function fetchPubMedArticle(pmid: string): Promise<any> {
  try {
    const params = eutilsParams({
      db: "pubmed",
      id: pmid,
      retmode: "xml",
      rettype: "abstract",
    });

    const response = await externalApi.get(PUBMED_FETCH, { params });

    // Get summary data in JSON format
    const summaryParams = eutilsParams({
      db: "pubmed",
      id: pmid,
      retmode: "json",
    });

    const summaryResponse = await externalApi.get(PUBMED_SUMMARY, { params: summaryParams });
    const summaryData = summaryResponse.data;

    // Combine XML and JSON data
    return {
      xml: response.data,
      summary: summaryData,
      pmid,
    };
  } catch (error) {
    console.error("Error fetching PubMed article:", error);
    return null;
  }
}

/**
 * Map PubMed data to study fields
 */
function mapPubMedDataToStudy(pubmedData: any, study: any): any {
  const enrichedData: Record<string, any> = {};

  // Extract data from PubMed XML response
  const xml = pubmedData.xml;

  // This is a simplified version - in a real implementation, we would use
  // an XML parser to properly extract data from the PubMed response

  // Parse the XML to extract relevant information
  // This is a placeholder - you would need to implement proper XML parsing

  // Extract article title if missing
  if (!study.title || study.title === "Untitled Study") {
    // Parse title from XML
    const titleMatch = xml.match(/<ArticleTitle>(.*?)<\/ArticleTitle>/);
    if (titleMatch && titleMatch[1]) {
      enrichedData.title = titleMatch[1];
    }
  }

  // Extract abstract if missing
  if (!study.abstract || study.abstract === "") {
    const abstractMatch = xml.match(/<AbstractText>([\s\S]*?)<\/AbstractText>/);
    if (abstractMatch && abstractMatch[1]) {
      enrichedData.abstract = abstractMatch[1];
    }
  }

  // Extract journal if missing
  if (!study.journal || study.journal === "") {
    const journalMatch = xml.match(/<Journal>[\s\S]*?<Title>([\s\S]*?)<\/Title>/);
    if (journalMatch && journalMatch[1]) {
      enrichedData.journal = journalMatch[1];
    }
  }

  // Extract publication year if missing
  if (!study.year) {
    const yearMatch = xml.match(/<PubDate>[\s\S]*?<Year>([\s\S]*?)<\/Year>/);
    if (yearMatch && yearMatch[1]) {
      enrichedData.year = parseInt(yearMatch[1]);
    }
  }

  // Extract authors if missing
  if (!study.authors || study.authors === "") {
    const authorsMatches = xml.match(
      /<Author>[\s\S]*?<LastName>([\s\S]*?)<\/LastName>[\s\S]*?<ForeName>([\s\S]*?)<\/ForeName>[\s\S]*?<\/Author>/g,
    );
    if (authorsMatches && authorsMatches.length > 0) {
      const authorNames = authorsMatches
        .map((match: string) => {
          const lastNameMatch = match.match(/<LastName>(.*?)<\/LastName>/);
          const foreNameMatch = match.match(/<ForeName>(.*?)<\/ForeName>/);

          if (lastNameMatch && foreNameMatch) {
            return `${foreNameMatch[1]} ${lastNameMatch[1]}`;
          }
          return null;
        })
        .filter(Boolean);

      if (authorNames.length > 0) {
        enrichedData.authors = authorNames.join(", ");

        // Additionally set first_author and last_author
        if (authorNames.length > 0) {
          enrichedData.first_author = authorNames[0];
        }

        if (authorNames.length > 1) {
          enrichedData.last_author = authorNames[authorNames.length - 1];
        }
      }
    }
  }

  // Extract DOI if missing or if we only have PMID
  if (
    !study.doi &&
    (!study.url || study.url.includes("PMID") || study.url.includes("pubmed"))
  ) {
    const doiMatch = xml.match(/<ArticleId IdType="doi">(.*?)<\/ArticleId>/);
    if (doiMatch && doiMatch[1]) {
      enrichedData.doi = doiMatch[1];

      // Also update URL to point to DOI if we don't have a URL
      if (!study.url || study.url === "") {
        enrichedData.url = `https://doi.org/${doiMatch[1]}`;
      }
    }
  }

  // Set PMID in the URL field if we don't have a URL
  if ((!study.url || study.url === "") && pubmedData.pmid) {
    enrichedData.url = `https://pubmed.ncbi.nlm.nih.gov/${pubmedData.pmid}/`;
  }

  // Set peer-reviewed status based on journal (most PubMed journals are peer-reviewed)
  if (study.peerReviewed === null || study.peerReviewed === undefined) {
    enrichedData.peerReviewed = true;
  }

  // Add PMID to the record
  enrichedData.pmid = pubmedData.pmid;

  // Update last-modified timestamp
  enrichedData.updatedAt = new Date();

  return enrichedData;
}

/**
 * Batch process studies that need enrichment
 * @param limit Maximum number of studies to process
 * @returns Number of studies enriched
 */
export async function batchEnrichStudies(limit: number = 10): Promise<number> {
  try {
    // Find studies that need enrichment (missing abstract, authors, etc.)
    const candidateStudies = await db
      .select()
      .from(studies)
      .where(
        // Studies that have a URL or title but are missing other details
        or(eq(studies.abstract, ""), isNull(studies.abstract)),
      )
      .limit(limit);

    console.log(`Found ${candidateStudies.length} studies to enrich`);

    let enrichedCount = 0;

    for (const study of candidateStudies) {
      const result = await enrichStudyFromPubMed(study.id);

      if (result.success) {
        enrichedCount++;
        console.log(`Enriched study ID ${study.id}: ${result.message}`);
      } else {
        console.log(`Failed to enrich study ID ${study.id}: ${result.message}`);
      }

      // Add a delay to avoid overloading the PubMed API
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    return enrichedCount;
  } catch (error) {
    console.error("Error in batch enrichment:", error);
    return 0;
  }
}
