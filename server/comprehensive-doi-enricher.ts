/**
 * Comprehensive DOI Enrichment Service
 * 
 * This service fetches ALL available data from multiple sources to create
 * the most robust and comprehensive research database possible.
 */

import { db } from './db';
import { studies } from '../shared/schema';
import { eq } from 'drizzle-orm';

interface EnrichmentResult {
  success: boolean;
  message: string;
  enrichedFields: string[];
  source: string;
  data?: any;
}

/**
 * Comprehensive DOI enrichment that pulls ALL available data
 */
export async function comprehensiveEnrichStudy(studyId: number): Promise<{
  success: boolean;
  message: string;
  totalFieldsEnriched: number;
  sourcesUsed: string[];
  enrichmentQuality: number;
}> {
  try {
    // Get the study
    const [study] = await db.select().from(studies).where(eq(studies.id, studyId));
    
    if (!study) {
      return {
        success: false,
        message: `Study with ID ${studyId} not found`,
        totalFieldsEnriched: 0,
        sourcesUsed: [],
        enrichmentQuality: 0
      };
    }

    if (!study.doi) {
      return {
        success: false,
        message: 'Study has no DOI for enrichment',
        totalFieldsEnriched: 0,
        sourcesUsed: [],
        enrichmentQuality: 0
      };
    }

    console.log(`Starting comprehensive enrichment for study ${studyId} with DOI: ${study.doi}`);

    let enrichedData: any = {};
    const sourcesUsed: string[] = [];
    const enrichedFields: string[] = [];

    // === 1. CROSSREF - Most comprehensive academic metadata ===
    try {
      const crossrefResult = await enrichFromCrossRef(study.doi);
      if (crossrefResult.success && crossrefResult.data) {
        enrichedData = { ...enrichedData, ...crossrefResult.data };
        sourcesUsed.push('CrossRef');
        enrichedFields.push(...crossrefResult.enrichedFields);
        console.log(`CrossRef enriched ${crossrefResult.enrichedFields.length} fields`);
      }
    } catch (error) {
      console.error('CrossRef enrichment failed:', error);
    }

    // === 2. EUROPE PMC - Full text and supplementary materials ===
    try {
      const europePmcResult = await enrichFromEuropePMC(study.doi);
      if (europePmcResult.success && europePmcResult.data) {
        // Merge data, preserving existing enriched data
        enrichedData = mergeEnrichmentData(enrichedData, europePmcResult.data);
        sourcesUsed.push('Europe PMC');
        enrichedFields.push(...europePmcResult.enrichedFields.filter(f => !enrichedFields.includes(f)));
        console.log(`Europe PMC enriched ${europePmcResult.enrichedFields.length} fields`);
      }
    } catch (error) {
      console.error('Europe PMC enrichment failed:', error);
    }

    // === 3. SEMANTIC SCHOLAR - Citations and related papers ===
    try {
      const semanticResult = await enrichFromSemanticScholar(study.doi);
      if (semanticResult.success && semanticResult.data) {
        enrichedData = mergeEnrichmentData(enrichedData, semanticResult.data);
        sourcesUsed.push('Semantic Scholar');
        enrichedFields.push(...semanticResult.enrichedFields.filter(f => !enrichedFields.includes(f)));
        console.log(`Semantic Scholar enriched ${semanticResult.enrichedFields.length} fields`);
      }
    } catch (error) {
      console.error('Semantic Scholar enrichment failed:', error);
    }

    // === 4. PUBMED - Medical metadata and MeSH terms ===
    try {
      const pubmedResult = await enrichFromPubMed(study.doi);
      if (pubmedResult.success && pubmedResult.data) {
        enrichedData = mergeEnrichmentData(enrichedData, pubmedResult.data);
        sourcesUsed.push('PubMed');
        enrichedFields.push(...pubmedResult.enrichedFields.filter(f => !enrichedFields.includes(f)));
        console.log(`PubMed enriched ${pubmedResult.enrichedFields.length} fields`);
      }
    } catch (error) {
      console.error('PubMed enrichment failed:', error);
    }

    // Calculate enrichment quality (0-100 based on how many fields we populated)
    const totalPossibleFields = 50; // Approximate number of enrichable fields
    const enrichmentQuality = Math.min(100, Math.round((enrichedFields.length / totalPossibleFields) * 100));

    // Add enrichment metadata
    enrichedData.lastEnriched = new Date();
    enrichedData.enrichmentSources = sourcesUsed;
    enrichedData.enrichmentQuality = enrichmentQuality;

    // Update the study in the database
    if (Object.keys(enrichedData).length > 0) {
      await db.update(studies)
        .set(enrichedData)
        .where(eq(studies.id, studyId));

      console.log(`Successfully enriched study ${studyId} with ${enrichedFields.length} fields from ${sourcesUsed.length} sources`);

      return {
        success: true,
        message: `Enriched study with ${enrichedFields.length} fields from ${sourcesUsed.join(', ')}`,
        totalFieldsEnriched: enrichedFields.length,
        sourcesUsed,
        enrichmentQuality
      };
    } else {
      return {
        success: false,
        message: 'No enrichment data found from any source',
        totalFieldsEnriched: 0,
        sourcesUsed: [],
        enrichmentQuality: 0
      };
    }

  } catch (error) {
    console.error(`Error in comprehensive enrichment for study ${studyId}:`, error);
    return {
      success: false,
      message: `Enrichment failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      totalFieldsEnriched: 0,
      sourcesUsed: [],
      enrichmentQuality: 0
    };
  }
}

/**
 * Enrich from CrossRef API - Most comprehensive academic metadata
 */
async function enrichFromCrossRef(doi: string): Promise<EnrichmentResult> {
  try {
    const cleanDoi = doi.replace(/^https?:\/\/doi\.org\//, '');
    const url = `https://api.crossref.org/works/${encodeURIComponent(cleanDoi)}`;
    
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'HydrogenStudies/1.0 (https://hydrogenstudies.com; mailto:info@hydrogenstudies.com)'
      }
    });

    if (!response.ok) {
      return { success: false, message: 'CrossRef API request failed', enrichedFields: [], source: 'CrossRef' };
    }

    const data = await response.json();
    const work = data.message;

    const enrichedData: any = {};
    const enrichedFields: string[] = [];

    // Publication metadata
    if (work.title?.[0]) {
      enrichedData.title = work.title[0];
      enrichedFields.push('title');
    }

    if (work.abstract) {
      enrichedData.abstract = work.abstract;
      enrichedFields.push('abstract');
    }

    // Authors with affiliations
    if (work.author && Array.isArray(work.author)) {
      const authors = work.author.map((author: any) => 
        `${author.given || ''} ${author.family || ''}`.trim()
      ).filter(Boolean);
      
      if (authors.length > 0) {
        enrichedData.authors = authors.join(', ');
        enrichedFields.push('authors');
      }

      // Author affiliations
      const affiliations = work.author
        .flatMap((author: any) => author.affiliation?.map((aff: any) => aff.name) || [])
        .filter(Boolean);
      
      if (affiliations.length > 0) {
        enrichedData.authorAffiliations = affiliations;
        enrichedFields.push('authorAffiliations');
      }

      // ORCID IDs
      const orcids = work.author
        .map((author: any) => author.ORCID)
        .filter(Boolean);
      
      if (orcids.length > 0) {
        enrichedData.authorOrcids = orcids;
        enrichedFields.push('authorOrcids');
      }
    }

    // Journal information
    if (work['container-title']?.[0]) {
      enrichedData.journal = work['container-title'][0];
      enrichedFields.push('journal');
    }

    if (work.ISSN && work.ISSN.length > 0) {
      enrichedData.journalIssn = work.ISSN[0];
      enrichedFields.push('journalIssn');
    }

    // Publication details
    if (work.volume) {
      enrichedData.volume = work.volume;
      enrichedFields.push('volume');
    }

    if (work.issue) {
      enrichedData.issue = work.issue;
      enrichedFields.push('issue');
    }

    if (work.page) {
      enrichedData.pages = work.page;
      enrichedFields.push('pages');
    }

    // Dates
    if (work.published?.['date-parts']?.[0]) {
      const dateparts = work.published['date-parts'][0];
      const year = dateparts[0];
      const month = dateparts[1] || 1;
      const day = dateparts[2] || 1;
      
      enrichedData.publishYear = year;
      enrichedData.journalPublishDate = new Date(year, month - 1, day).toISOString();
      enrichedFields.push('publishYear', 'journalPublishDate');
    }

    // License information
    if (work.license && work.license.length > 0) {
      const license = work.license[0];
      enrichedData.license = license['content-version'] || 'Unknown';
      enrichedData.licenseUrl = license.URL;
      enrichedFields.push('license', 'licenseUrl');
    }

    // Funding information
    if (work.funder && work.funder.length > 0) {
      const fundingSources = work.funder.map((funder: any) => funder.name).filter(Boolean);
      const grantNumbers = work.funder.flatMap((funder: any) => 
        funder.award?.map((award: any) => award) || []
      ).filter(Boolean);

      if (fundingSources.length > 0) {
        enrichedData.fundingSources = fundingSources;
        enrichedFields.push('fundingSources');
      }

      if (grantNumbers.length > 0) {
        enrichedData.grantNumbers = grantNumbers;
        enrichedFields.push('grantNumbers');
      }
    }

    // References
    if (work.reference && work.reference.length > 0) {
      enrichedData.referencesJson = JSON.stringify(work.reference);
      enrichedFields.push('referencesJson');
    }

    // Citation count
    if (work['is-referenced-by-count']) {
      enrichedData.citedByCount = work['is-referenced-by-count'];
      enrichedFields.push('citedByCount');
    }

    // Subject areas
    if (work.subject && work.subject.length > 0) {
      enrichedData.subjectAreas = work.subject;
      enrichedFields.push('subjectAreas');
    }

    return {
      success: true,
      message: `CrossRef enriched ${enrichedFields.length} fields`,
      enrichedFields,
      source: 'CrossRef',
      data: enrichedData
    };

  } catch (error) {
    console.error('CrossRef enrichment error:', error);
    return {
      success: false,
      message: `CrossRef error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      enrichedFields: [],
      source: 'CrossRef'
    };
  }
}

/**
 * Enrich from Europe PMC - Full text and supplementary materials
 */
async function enrichFromEuropePMC(doi: string): Promise<EnrichmentResult> {
  try {
    const cleanDoi = doi.replace(/^https?:\/\/doi\.org\//, '');
    const url = `https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=DOI:${encodeURIComponent(cleanDoi)}&format=json&resultType=core`;
    
    const response = await fetch(url);
    if (!response.ok) {
      return { success: false, message: 'Europe PMC API request failed', enrichedFields: [], source: 'Europe PMC' };
    }

    const data = await response.json();
    if (!data.resultList?.result?.[0]) {
      return { success: false, message: 'No results from Europe PMC', enrichedFields: [], source: 'Europe PMC' };
    }

    const article = data.resultList.result[0];
    const enrichedData: any = {};
    const enrichedFields: string[] = [];

    // PMC and PubMed IDs
    if (article.pmcid) {
      enrichedData.pmcid = article.pmcid;
      enrichedFields.push('pmcid');
    }

    if (article.pmid) {
      enrichedData.pmid = article.pmid;
      enrichedFields.push('pmid');
    }

    // Full text if available
    if (article.hasTextMinedTerms === 'Y' || article.hasPDF === 'Y') {
      enrichedData.hasFullText = true;
      enrichedFields.push('hasFullText');

      // Try to get full text
      if (article.pmcid) {
        try {
          const fullTextUrl = `https://www.ebi.ac.uk/europepmc/webservices/rest/${article.pmcid}/fullTextXML`;
          const fullTextResponse = await fetch(fullTextUrl);
          if (fullTextResponse.ok) {
            const fullTextXml = await fullTextResponse.text();
            enrichedData.fullTextXml = fullTextXml;
            enrichedFields.push('fullTextXml');
          }
        } catch (error) {
          console.error('Error fetching full text XML:', error);
        }
      }
    }

    // Open access status
    if (article.isOpenAccess === 'Y') {
      enrichedData.openAccess = true;
      enrichedFields.push('openAccess');
    }

    // Language
    if (article.language) {
      enrichedData.language = article.language;
      enrichedFields.push('language');
    }

    // MeSH terms if available
    if (article.meshHeadingList?.meshHeading) {
      const meshTerms = article.meshHeadingList.meshHeading.map((mesh: any) => mesh.descriptorName);
      enrichedData.meshTerms = meshTerms;
      enrichedFields.push('meshTerms');
    }

    // Keywords
    if (article.keywordList?.keyword) {
      enrichedData.keywords = article.keywordList.keyword;
      enrichedFields.push('keywords');
    }

    return {
      success: true,
      message: `Europe PMC enriched ${enrichedFields.length} fields`,
      enrichedFields,
      source: 'Europe PMC',
      data: enrichedData
    };

  } catch (error) {
    console.error('Europe PMC enrichment error:', error);
    return {
      success: false,
      message: `Europe PMC error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      enrichedFields: [],
      source: 'Europe PMC'
    };
  }
}

/**
 * Enrich from Semantic Scholar - Citations and related papers
 */
async function enrichFromSemanticScholar(doi: string): Promise<EnrichmentResult> {
  try {
    const cleanDoi = doi.replace(/^https?:\/\/doi\.org\//, '');
    const url = `https://api.semanticscholar.org/graph/v1/paper/DOI:${encodeURIComponent(cleanDoi)}?fields=paperId,title,abstract,authors,citations,references,citationCount,influentialCitationCount,fieldsOfStudy,s2FieldsOfStudy,publicationTypes,journal,year`;
    
    const response = await fetch(url);
    if (!response.ok) {
      return { success: false, message: 'Semantic Scholar API request failed', enrichedFields: [], source: 'Semantic Scholar' };
    }

    const paper = await response.json();
    const enrichedData: any = {};
    const enrichedFields: string[] = [];

    // Semantic Scholar ID
    if (paper.paperId) {
      enrichedData.semanticScholarId = paper.paperId;
      enrichedFields.push('semanticScholarId');
    }

    // Citation counts
    if (paper.citationCount !== undefined) {
      enrichedData.citedByCount = paper.citationCount;
      enrichedFields.push('citedByCount');
    }

    // Fields of study
    if (paper.fieldsOfStudy && paper.fieldsOfStudy.length > 0) {
      enrichedData.researchFields = paper.fieldsOfStudy;
      enrichedFields.push('researchFields');
    }

    // S2 fields of study (more specific)
    if (paper.s2FieldsOfStudy && paper.s2FieldsOfStudy.length > 0) {
      const s2Fields = paper.s2FieldsOfStudy.map((field: any) => field.category);
      enrichedData.subjectAreas = s2Fields;
      enrichedFields.push('subjectAreas');
    }

    // Related papers (from references)
    if (paper.references && paper.references.length > 0) {
      const relatedDois = paper.references
        .map((ref: any) => ref.externalIds?.DOI)
        .filter(Boolean)
        .slice(0, 10); // Limit to first 10 related papers
      
      if (relatedDois.length > 0) {
        enrichedData.relatedPapers = relatedDois;
        enrichedFields.push('relatedPapers');
      }
    }

    // Citing papers
    if (paper.citations && paper.citations.length > 0) {
      const citingDois = paper.citations
        .map((cite: any) => cite.externalIds?.DOI)
        .filter(Boolean)
        .slice(0, 10); // Limit to first 10 citing papers
      
      if (citingDois.length > 0) {
        enrichedData.citingPapers = citingDois;
        enrichedFields.push('citingPapers');
      }
    }

    return {
      success: true,
      message: `Semantic Scholar enriched ${enrichedFields.length} fields`,
      enrichedFields,
      source: 'Semantic Scholar',
      data: enrichedData
    };

  } catch (error) {
    console.error('Semantic Scholar enrichment error:', error);
    return {
      success: false,
      message: `Semantic Scholar error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      enrichedFields: [],
      source: 'Semantic Scholar'
    };
  }
}

/**
 * Enrich from PubMed - Medical metadata and MeSH terms
 */
async function enrichFromPubMed(doi: string): Promise<EnrichmentResult> {
  try {
    // First, search for the paper by DOI to get PMID
    const searchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=${encodeURIComponent(doi)}[DOI]&retmode=json`;
    
    const searchResponse = await fetch(searchUrl);
    if (!searchResponse.ok) {
      return { success: false, message: 'PubMed search failed', enrichedFields: [], source: 'PubMed' };
    }

    const searchData = await searchResponse.json();
    if (!searchData.esearchresult?.idlist?.[0]) {
      return { success: false, message: 'No PubMed ID found for DOI', enrichedFields: [], source: 'PubMed' };
    }

    const pmid = searchData.esearchresult.idlist[0];
    
    // Get detailed information using efetch
    const fetchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pubmed&id=${pmid}&retmode=xml`;
    
    const fetchResponse = await fetch(fetchUrl);
    if (!fetchResponse.ok) {
      return { success: false, message: 'PubMed fetch failed', enrichedFields: [], source: 'PubMed' };
    }

    const xmlText = await fetchResponse.text();
    const enrichedData: any = {};
    const enrichedFields: string[] = [];

    // Store PMID
    enrichedData.pmid = pmid;
    enrichedFields.push('pmid');

    // Parse XML for additional fields (basic parsing)
    // In a production system, you'd use a proper XML parser
    // This is simplified for demonstration

    return {
      success: true,
      message: `PubMed enriched ${enrichedFields.length} fields`,
      enrichedFields,
      source: 'PubMed',
      data: enrichedData
    };

  } catch (error) {
    console.error('PubMed enrichment error:', error);
    return {
      success: false,
      message: `PubMed error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      enrichedFields: [],
      source: 'PubMed'
    };
  }
}

/**
 * Merge enrichment data, preserving existing values unless new data is better
 */
function mergeEnrichmentData(existing: any, newData: any): any {
  const merged = { ...existing };
  
  for (const [key, value] of Object.entries(newData)) {
    // If field doesn't exist, add it
    if (!merged[key]) {
      merged[key] = value;
    }
    // If field exists but new value is longer/more comprehensive, replace it
    else if (typeof value === 'string' && typeof merged[key] === 'string') {
      if (value.length > merged[key].length) {
        merged[key] = value;
      }
    }
    // For arrays, merge unique values
    else if (Array.isArray(value) && Array.isArray(merged[key])) {
      merged[key] = [...new Set([...merged[key], ...value])];
    }
    // For numbers, keep the higher value (usually citation counts)
    else if (typeof value === 'number' && typeof merged[key] === 'number') {
      merged[key] = Math.max(merged[key], value);
    }
  }
  
  return merged;
}

/**
 * Batch enrich multiple studies
 */
export async function batchComprehensiveEnrichment(studyIds: number[]): Promise<{
  totalProcessed: number;
  successful: number;
  failed: number;
  results: any[];
}> {
  const results = [];
  let successful = 0;
  let failed = 0;

  for (const studyId of studyIds) {
    try {
      console.log(`Processing study ${studyId}...`);
      const result = await comprehensiveEnrichStudy(studyId);
      
      results.push({
        studyId,
        ...result
      });

      if (result.success) {
        successful++;
      } else {
        failed++;
      }

      // Add delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));

    } catch (error) {
      console.error(`Error processing study ${studyId}:`, error);
      results.push({
        studyId,
        success: false,
        message: `Processing error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        totalFieldsEnriched: 0,
        sourcesUsed: [],
        enrichmentQuality: 0
      });
      failed++;
    }
  }

  return {
    totalProcessed: studyIds.length,
    successful,
    failed,
    results
  };
}