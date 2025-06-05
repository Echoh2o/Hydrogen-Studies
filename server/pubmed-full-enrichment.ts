/**
 * PubMed Full Data Enrichment System
 * 
 * Fetches complete research data from multiple APIs to populate study pages with authentic content
 */

import { db } from './db';
import { studies } from '../shared/schema.js';
import { eq, isNull } from 'drizzle-orm';

interface PubMedFullData {
  fullText?: string;
  fullTextHtml?: string;
  authorAffiliations?: string;
  fundingSources?: string;
  ethicalApproval?: string;
  trialRegistration?: string;
  statisticalMethods?: string;
  supplementaryMaterials?: string;
  keywords?: string[];
  citationCount?: number;
}

/**
 * Enrich a single study with full PubMed data
 */
export async function enrichStudyWithFullData(studyId: number): Promise<boolean> {
  try {
    // Get study details
    const [study] = await db.select().from(studies).where(eq(studies.id, studyId));
    if (!study) {
      console.log(`Study ${studyId} not found`);
      return false;
    }

    console.log(`Enriching study ${studyId}: ${study.title}`);

    // Fetch data from multiple sources
    const pubmedData = await fetchPubMedData(study.doi || undefined);
    const crossrefData = await fetchCrossRefData(study.doi || undefined);
    const semanticData = await fetchSemanticScholarData(study.title, study.authors);

    // Combine data sources
    const enrichedData: PubMedFullData = {
      fullText: pubmedData.fullText || crossrefData.fullText,
      fullTextHtml: pubmedData.fullTextHtml,
      authorAffiliations: pubmedData.authorAffiliations || semanticData.authorAffiliations,
      fundingSources: pubmedData.fundingSources || crossrefData.fundingSources,
      ethicalApproval: pubmedData.ethicalApproval,
      trialRegistration: pubmedData.trialRegistration,
      statisticalMethods: pubmedData.statisticalMethods,
      supplementaryMaterials: pubmedData.supplementaryMaterials,
      keywords: [...(pubmedData.keywords || []), ...(semanticData.keywords || [])],
      citationCount: semanticData.citationCount || crossrefData.citationCount
    };

    // Update database with enriched data
    await db.update(studies)
      .set({
        full_text: enrichedData.fullText,
        full_text_html: enrichedData.fullTextHtml,
        author_affiliations: enrichedData.authorAffiliations,
        funding_sources: enrichedData.fundingSources,
        ethical_approval: enrichedData.ethicalApproval,
        trial_registration: enrichedData.trialRegistration,
        statistical_methods: enrichedData.statisticalMethods,
        supplementary_materials: enrichedData.supplementaryMaterials,
        keywords: enrichedData.keywords,
        citation_count: enrichedData.citationCount
      })
      .where(eq(studies.id, studyId));

    console.log(`Successfully enriched study ${studyId}`);
    return true;

  } catch (error) {
    console.error(`Error enriching study ${studyId}:`, error);
    return false;
  }
}

/**
 * Fetch data from PubMed/Europe PMC (no API key required for basic usage)
 */
async function fetchPubMedData(doi?: string): Promise<Partial<PubMedFullData>> {
  if (!doi) return {};

  try {
    // Europe PMC search (free access)
    const searchUrl = `https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=DOI:${doi}&format=json&resultType=core`;
    const searchResponse = await fetch(searchUrl);
    const searchData = await searchResponse.json();

    if (!searchData.resultList?.result?.[0]) {
      return {};
    }

    const article = searchData.resultList.result[0];
    const pmcId = article.pmcid;

    let fullTextData = {};

    // If PMC ID available, fetch full text
    if (pmcId) {
      try {
        const fullTextUrl = `https://www.ebi.ac.uk/europepmc/webservices/rest/${pmcId}/fullTextXML`;
        const fullTextResponse = await fetch(fullTextUrl);
        if (fullTextResponse.ok) {
          const fullTextXml = await fullTextResponse.text();
          fullTextData = {
            fullText: extractTextFromXml(fullTextXml),
            fullTextHtml: convertXmlToHtml(fullTextXml)
          };
        }
      } catch (error) {
        console.log(`Could not fetch full text for ${pmcId}:`, error);
      }
    }

    return {
      ...fullTextData,
      authorAffiliations: article.authorList?.author?.map((a: any) => 
        `${a.fullName} (${a.affiliation || 'No affiliation listed'})`
      ).join('; '),
      fundingSources: article.grantsList?.grant?.map((g: any) => 
        `${g.agency} (${g.grantId})`
      ).join('; '),
      keywords: article.keywordList?.keyword || []
    };

  } catch (error) {
    console.error('Error fetching PubMed data:', error);
    return {};
  }
}

/**
 * Fetch data from CrossRef (free access)
 */
async function fetchCrossRefData(doi?: string): Promise<Partial<PubMedFullData>> {
  if (!doi) return {};

  try {
    const url = `https://api.crossref.org/works/${doi}`;
    const response = await fetch(url);
    const data = await response.json();

    const work = data.message;

    return {
      fundingSources: work.funder?.map((f: any) => f.name).join('; '),
      citationCount: work['is-referenced-by-count'] || 0
    };

  } catch (error) {
    console.error('Error fetching CrossRef data:', error);
    return {};
  }
}

/**
 * Fetch data from Semantic Scholar (free access)
 */
async function fetchSemanticScholarData(title: string, authors: string): Promise<Partial<PubMedFullData>> {
  try {
    // Search by title
    const searchUrl = `https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(title)}&fields=title,authors,citationCount,fieldsOfStudy`;
    const response = await fetch(searchUrl);
    const data = await response.json();

    const paper = data.data?.[0];
    if (!paper) return {};

    return {
      authorAffiliations: paper.authors?.map((a: any) => 
        `${a.name} (${a.affiliations?.join(', ') || 'No affiliation'})`
      ).join('; '),
      citationCount: paper.citationCount,
      keywords: paper.fieldsOfStudy || []
    };

  } catch (error) {
    console.error('Error fetching Semantic Scholar data:', error);
    return {};
  }
}

/**
 * Extract plain text from XML
 */
function extractTextFromXml(xml: string): string {
  // Remove XML tags and extract readable text
  return xml
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Convert XML to basic HTML
 */
function convertXmlToHtml(xml: string): string {
  return xml
    .replace(/<title>/g, '<h2>')
    .replace(/<\/title>/g, '</h2>')
    .replace(/<sec>/g, '<section>')
    .replace(/<\/sec>/g, '</section>')
    .replace(/<p>/g, '<p>')
    .replace(/<\/p>/g, '</p>');
}

/**
 * Enrich multiple studies in batch
 */
export async function enrichStudiesBatch(studyIds: number[]): Promise<void> {
  console.log(`Starting batch enrichment for ${studyIds.length} studies`);
  
  for (let i = 0; i < studyIds.length; i++) {
    const studyId = studyIds[i];
    console.log(`Processing study ${i + 1}/${studyIds.length}: ${studyId}`);
    
    await enrichStudyWithFullData(studyId);
    
    // Rate limiting - wait 1 second between requests
    if (i < studyIds.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  console.log('Batch enrichment completed');
}

/**
 * Enrich all studies that lack full data
 */
export async function enrichAllIncompleteStudies(): Promise<void> {
  try {
    // Find studies missing full data
    const incompleteStudies = await db.select({ id: studies.id })
      .from(studies)
      .where(isNull(studies.full_text))
      .limit(50); // Process 50 at a time

    const studyIds = incompleteStudies.map((s: any) => s.id);
    console.log(`Found ${studyIds.length} studies to enrich`);

    await enrichStudiesBatch(studyIds);

  } catch (error) {
    console.error('Error in enrichAllIncompleteStudies:', error);
  }
}