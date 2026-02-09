/**
 * Direct PubMed Enrichment - Working Implementation
 * Populates studies with authentic research data from free APIs
 */

import { db } from "../db";
import { studies } from "../../shared/schema";
import { eq, sql } from "drizzle-orm";

export async function enrichStudyDirect(studyId: number): Promise<boolean> {
  try {
    console.log(`Direct enrichment for study ${studyId}`);

    // Get study details
    const [study] = await db
      .select()
      .from(studies)
      .where(eq(studies.id, studyId));
    if (!study) {
      console.log(`Study ${studyId} not found`);
      return false;
    }

    console.log(`Enriching: ${study.title}`);
    console.log(`DOI: ${study.doi}`);

    let enrichmentData: any = {};

    // Fetch from Europe PMC if DOI available
    if (study.doi) {
      try {
        const pmcData = await fetchFromEuropePMC(study.doi);
        enrichmentData = { ...enrichmentData, ...pmcData };
      } catch (error) {
        console.log("Europe PMC error:", error);
      }
    }

    // Fetch from CrossRef if DOI available
    if (study.doi) {
      try {
        const crossrefData = await fetchFromCrossRef(study.doi);
        enrichmentData = { ...enrichmentData, ...crossrefData };
      } catch (error) {
        console.log("CrossRef error:", error);
      }
    }

    // Fetch from Semantic Scholar
    try {
      const semanticData = await fetchFromSemanticScholar(study.title);
      enrichmentData = { ...enrichmentData, ...semanticData };
    } catch (error) {
      console.log("Semantic Scholar error:", error);
    }

    // Update database with SQL to ensure data persists
    if (Object.keys(enrichmentData).length > 0) {
      console.log("Updating database with:", Object.keys(enrichmentData));

      // Use raw SQL to ensure the update works
      const updateFields = [];
      const values = [];

      if (enrichmentData.authorAffiliations) {
        updateFields.push("author_affiliations = $" + (values.length + 1));
        values.push(enrichmentData.authorAffiliations);
      }

      if (enrichmentData.fundingSources) {
        updateFields.push("funding_sources = $" + (values.length + 1));
        values.push(enrichmentData.fundingSources);
      }

      if (enrichmentData.citationCount) {
        updateFields.push("citation_count = $" + (values.length + 1));
        values.push(enrichmentData.citationCount);
      }

      if (enrichmentData.keywords) {
        updateFields.push("keywords = $" + (values.length + 1));
        values.push(enrichmentData.keywords);
      }

      if (enrichmentData.fullText) {
        updateFields.push("full_text = $" + (values.length + 1));
        values.push(enrichmentData.fullText);
      }

      if (enrichmentData.statisticalMethods) {
        updateFields.push("statistical_methods = $" + (values.length + 1));
        values.push(enrichmentData.statisticalMethods);
      }

      if (enrichmentData.ethicalApproval) {
        updateFields.push("ethical_approval = $" + (values.length + 1));
        values.push(enrichmentData.ethicalApproval);
      }

      if (updateFields.length > 0) {
        values.push(studyId);
        const query = `UPDATE studies SET ${updateFields.join(", ")} WHERE id = $${values.length}`;

        console.log("Executing SQL:", query);
        console.log("With values:", values);

        await db.execute(sql.raw(query, values));

        console.log(`Successfully updated study ${studyId}`);
        return true;
      }
    }

    console.log(`No data to update for study ${studyId}`);
    return false;
  } catch (error) {
    console.error(`Error enriching study ${studyId}:`, error);
    return false;
  }
}

async function fetchFromEuropePMC(doi: string) {
  const searchUrl = `https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=DOI:${doi}&format=json&resultType=core`;
  const response = await fetch(searchUrl);
  const data = await response.json();

  const enrichment: any = {};

  if (data.resultList?.result?.[0]) {
    const article = data.resultList.result[0];

    // Author affiliations
    if (article.authorList?.author) {
      const affiliations = article.authorList.author
        .map(
          (a: any) =>
            `${a.fullName}${a.affiliation ? ` (${a.affiliation})` : ""}`,
        )
        .join("; ");
      enrichment.authorAffiliations = affiliations;
      console.log("Found author affiliations:", affiliations);
    }

    // Funding sources
    if (article.grantsList?.grant) {
      const funding = article.grantsList.grant
        .map((g: any) => `${g.agency}${g.grantId ? ` (${g.grantId})` : ""}`)
        .join("; ");
      enrichment.fundingSources = funding;
      console.log("Found funding sources:", funding);
    }

    // Keywords
    if (article.keywordList?.keyword) {
      enrichment.keywords = article.keywordList.keyword;
    }

    // Try to get full text if PMC ID available
    if (article.pmcid) {
      try {
        const fullTextUrl = `https://www.ebi.ac.uk/europepmc/webservices/rest/${article.pmcid}/fullTextXML`;
        const fullTextResponse = await fetch(fullTextUrl);
        if (fullTextResponse.ok) {
          const fullTextXml = await fullTextResponse.text();

          // Extract methods and statistical information
          const methodsMatch = fullTextXml.match(
            /<sec[^>]*>[\s\S]*?<title[^>]*>.*?methods?.*?<\/title>[\s\S]*?<\/sec>/i,
          );
          if (methodsMatch) {
            const methodsText = methodsMatch[0]
              .replace(/<[^>]*>/g, " ")
              .replace(/\s+/g, " ")
              .trim();
            enrichment.statisticalMethods = methodsText.substring(0, 1000);
          }

          // Extract ethics information
          const ethicsMatch = fullTextXml.match(
            /<sec[^>]*>[\s\S]*?<title[^>]*>.*?ethics?.*?<\/title>[\s\S]*?<\/sec>/i,
          );
          if (ethicsMatch) {
            const ethicsText = ethicsMatch[0]
              .replace(/<[^>]*>/g, " ")
              .replace(/\s+/g, " ")
              .trim();
            enrichment.ethicalApproval = ethicsText.substring(0, 500);
          }

          // Store first 5000 characters of full text
          const cleanText = fullTextXml
            .replace(/<[^>]*>/g, " ")
            .replace(/\s+/g, " ")
            .trim();
          enrichment.fullText = cleanText.substring(0, 5000);
        }
      } catch (error) {
        console.log(`Could not fetch full text for ${article.pmcid}`);
      }
    }
  }

  return enrichment;
}

async function fetchFromCrossRef(doi: string) {
  const url = `https://api.crossref.org/works/${doi}`;
  const response = await fetch(url);
  const data = await response.json();

  const enrichment: any = {};

  if (data.message) {
    const work = data.message;

    // Citation count
    if (work["is-referenced-by-count"]) {
      enrichment.citationCount = work["is-referenced-by-count"];
      console.log("Found citation count:", enrichment.citationCount);
    }

    // Additional funding sources if not already populated
    if (work.funder && !enrichment.fundingSources) {
      const funding = work.funder.map((f: any) => f.name).join("; ");
      enrichment.fundingSources = funding;
      console.log("Found CrossRef funding:", funding);
    }
  }

  return enrichment;
}

async function fetchFromSemanticScholar(title: string) {
  const searchUrl = `https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(title)}&fields=title,authors,citationCount,fieldsOfStudy&limit=1`;
  const response = await fetch(searchUrl);
  const data = await response.json();

  const enrichment: any = {};

  if (data.data?.[0]) {
    const paper = data.data[0];

    // Citation count if not already set
    if (paper.citationCount && !enrichment.citationCount) {
      enrichment.citationCount = paper.citationCount;
      console.log(
        "Found Semantic Scholar citations:",
        enrichment.citationCount,
      );
    }

    // Keywords/fields of study
    if (paper.fieldsOfStudy && !enrichment.keywords) {
      enrichment.keywords = paper.fieldsOfStudy;
    }

    // Author affiliations if not already populated
    if (paper.authors && !enrichment.authorAffiliations) {
      const affiliations = paper.authors
        .map(
          (a: any) =>
            `${a.name}${a.affiliations?.length ? ` (${a.affiliations.join(", ")})` : ""}`,
        )
        .join("; ");
      enrichment.authorAffiliations = affiliations;
      console.log("Found Semantic Scholar affiliations:", affiliations);
    }
  }

  return enrichment;
}
