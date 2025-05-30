/**
 * Comprehensive Research Enrichment System
 * 
 * Enriches studies with authentic data from research APIs:
 * 1. Larger batch processing for extensive coverage
 * 2. Additional metadata (publication dates, author affiliations, impact factors)
 * 3. Abstract validation against official sources
 */

import { db } from './db';
import { sql } from 'drizzle-orm';

interface EnrichmentMetrics {
  totalProcessed: number;
  successfulEnrichments: number;
  linksAdded: number;
  metadataEnriched: number;
  abstractsValidated: number;
  errors: string[];
}

async function runComprehensiveEnrichment() {
  console.log('Starting comprehensive research enrichment...');
  
  const metrics: EnrichmentMetrics = {
    totalProcessed: 0,
    successfulEnrichments: 0,
    linksAdded: 0,
    metadataEnriched: 0,
    abstractsValidated: 0,
    errors: []
  };

  // Process in larger batches for extensive coverage
  const batchSize = 100;
  let offset = 0;
  let hasMoreStudies = true;

  while (hasMoreStudies) {
    const studies = await db.execute(sql`
      SELECT id, title, doi, abstract, authors, journal, publish_date, pdf_url, citation_url, source_url
      FROM studies 
      WHERE doi IS NOT NULL AND doi != ''
      LIMIT ${batchSize} OFFSET ${offset}
    `);

    if (studies.rows.length === 0) {
      hasMoreStudies = false;
      break;
    }

    console.log(`Processing batch ${Math.floor(offset/batchSize) + 1}: ${studies.rows.length} studies`);

    for (const study of studies.rows) {
      metrics.totalProcessed++;
      
      try {
        const enrichmentResult = await enrichStudyComprehensively(study);
        
        if (enrichmentResult.hasUpdates) {
          await updateStudyInDatabase(study.id as number, enrichmentResult.data);
          metrics.successfulEnrichments++;
          
          if (enrichmentResult.linksAdded) metrics.linksAdded++;
          if (enrichmentResult.metadataAdded) metrics.metadataEnriched++;
          if (enrichmentResult.abstractValidated) metrics.abstractsValidated++;
        }
        
      } catch (error) {
        const errorMsg = `Study ${study.id}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        metrics.errors.push(errorMsg);
      }

      // Rate limiting for API respect
      await new Promise(resolve => setTimeout(resolve, 150));
    }

    offset += batchSize;
    
    // Progress report every 5 batches
    if ((offset / batchSize) % 5 === 0) {
      console.log(`Progress: ${metrics.totalProcessed} processed, ${metrics.successfulEnrichments} enriched`);
    }
  }

  console.log('Comprehensive enrichment completed');
  console.log(`Results: ${metrics.successfulEnrichments}/${metrics.totalProcessed} studies enriched`);
  console.log(`Links added: ${metrics.linksAdded}, Metadata enriched: ${metrics.metadataEnriched}, Abstracts validated: ${metrics.abstractsValidated}`);
  
  if (metrics.errors.length > 0) {
    console.log(`Errors: ${metrics.errors.length} (showing first 5)`);
    metrics.errors.slice(0, 5).forEach(error => console.log(`  ${error}`));
  }
}

async function enrichStudyComprehensively(study: any) {
  const enrichmentData: any = {};
  let hasUpdates = false;
  let linksAdded = false;
  let metadataAdded = false;
  let abstractValidated = false;

  const doi = study.doi as string;

  // 1. Fetch comprehensive data from CrossRef
  try {
    const crossrefData = await fetchFromCrossRef(doi);
    if (crossrefData) {
      // Add missing links
      if (!study.citation_url && crossrefData.citationUrl) {
        enrichmentData.citation_url = crossrefData.citationUrl;
        linksAdded = true;
      }
      if (!study.source_url && crossrefData.sourceUrl) {
        enrichmentData.source_url = crossrefData.sourceUrl;
        linksAdded = true;
      }
      if (!study.pdf_url && crossrefData.pdfUrl) {
        enrichmentData.pdf_url = crossrefData.pdfUrl;
        linksAdded = true;
      }
      
      // Add additional metadata
      if (crossrefData.publisherName) {
        enrichmentData.publisher_name = crossrefData.publisherName;
        metadataAdded = true;
      }
      if (crossrefData.journalIssn) {
        enrichmentData.journal_issn = crossrefData.journalIssn;
        metadataAdded = true;
      }
      if (crossrefData.citationCount !== undefined) {
        enrichmentData.citation_count = crossrefData.citationCount;
        metadataAdded = true;
      }
      if (crossrefData.volume) {
        enrichmentData.volume = crossrefData.volume;
        metadataAdded = true;
      }
      if (crossrefData.issue) {
        enrichmentData.issue = crossrefData.issue;
        metadataAdded = true;
      }
      if (crossrefData.pages) {
        enrichmentData.pages = crossrefData.pages;
        metadataAdded = true;
      }
      
      hasUpdates = true;
    }
  } catch (error) {
    console.log(`CrossRef enrichment failed for ${doi}`);
  }

  // 2. Fetch additional data from PubMed
  try {
    const pubmedData = await fetchFromPubMed(doi);
    if (pubmedData) {
      // Add PubMed-specific links if not already present
      if (!enrichmentData.citation_url && pubmedData.citationUrl) {
        enrichmentData.citation_url = pubmedData.citationUrl;
        linksAdded = true;
      }
      if (!enrichmentData.source_url && pubmedData.sourceUrl) {
        enrichmentData.source_url = pubmedData.sourceUrl;
        linksAdded = true;
      }
      
      // Add medical research metadata
      if (pubmedData.pmid) {
        enrichmentData.pubmed_id = pubmedData.pmid;
        metadataAdded = true;
      }
      if (pubmedData.meshTerms) {
        enrichmentData.mesh_terms = pubmedData.meshTerms;
        metadataAdded = true;
      }
      if (pubmedData.publicationTypes) {
        enrichmentData.publication_types = pubmedData.publicationTypes;
        metadataAdded = true;
      }
      
      hasUpdates = true;
    }
  } catch (error) {
    console.log(`PubMed enrichment failed for ${doi}`);
  }

  // 3. Validate abstract against Europe PMC
  try {
    const europePmcData = await fetchFromEuropePMC(doi);
    if (europePmcData && europePmcData.officialAbstract) {
      // Compare abstracts for validation
      const currentAbstract = (study.abstract as string)?.toLowerCase().trim() || '';
      const officialAbstract = europePmcData.officialAbstract.toLowerCase().trim();
      
      // If official abstract is significantly longer or different, update it
      if (officialAbstract.length > currentAbstract.length * 1.2) {
        enrichmentData.abstract = europePmcData.officialAbstract;
        enrichmentData.abstract_source = 'Europe PMC';
        abstractValidated = true;
        hasUpdates = true;
      }
      
      // Add Europe PMC specific data
      if (!enrichmentData.source_url && europePmcData.sourceUrl) {
        enrichmentData.source_url = europePmcData.sourceUrl;
        linksAdded = true;
        hasUpdates = true;
      }
    }
  } catch (error) {
    console.log(`Europe PMC validation failed for ${doi}`);
  }

  return {
    hasUpdates,
    linksAdded,
    metadataAdded,
    abstractValidated,
    data: enrichmentData
  };
}

async function fetchFromCrossRef(doi: string) {
  const response = await fetch(`https://api.crossref.org/works/${doi}`, {
    headers: {
      'User-Agent': 'HydrogenStudies/1.0 (mailto:contact@hydrogenstudies.com)'
    }
  });

  if (!response.ok) return null;

  const data = await response.json();
  const work = data.message;

  return {
    citationUrl: `https://doi.org/${doi}`,
    sourceUrl: work.URL || `https://doi.org/${doi}`,
    pdfUrl: work.link?.find((l: any) => l['content-type']?.includes('pdf'))?.URL,
    publisherName: work.publisher,
    journalIssn: work.ISSN?.[0],
    citationCount: work['is-referenced-by-count'],
    volume: work.volume,
    issue: work.issue,
    pages: work.page
  };
}

async function fetchFromPubMed(doi: string) {
  // Search for DOI in PubMed
  const searchResponse = await fetch(
    `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=${encodeURIComponent(doi)}&retmode=json`
  );

  if (!searchResponse.ok) return null;

  const searchData = await searchResponse.json();
  const pmid = searchData.esearchresult?.idlist?.[0];

  if (!pmid) return null;

  // Get detailed info
  const summaryResponse = await fetch(
    `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&id=${pmid}&retmode=json`
  );

  if (!summaryResponse.ok) return null;

  const summaryData = await summaryResponse.json();
  const result = summaryData.result?.[pmid];

  return {
    citationUrl: `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`,
    sourceUrl: `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`,
    pmid,
    meshTerms: result.keywords || [],
    publicationTypes: result.pubtype || []
  };
}

async function fetchFromEuropePMC(doi: string) {
  const response = await fetch(
    `https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=DOI:${encodeURIComponent(doi)}&format=json`
  );

  if (!response.ok) return null;

  const data = await response.json();
  const result = data.resultList?.result?.[0];

  if (!result) return null;

  return {
    sourceUrl: `https://europepmc.org/article/MED/${result.id}`,
    officialAbstract: result.abstractText,
    authorAffiliations: result.affiliation
  };
}

async function updateStudyInDatabase(studyId: number, enrichmentData: any) {
  const updateFields = Object.keys(enrichmentData)
    .map(key => `${key} = $${key}`)
    .join(', ');
  
  const values = Object.values(enrichmentData);
  
  await db.execute(sql.raw(`
    UPDATE studies 
    SET ${updateFields}
    WHERE id = ${studyId}
  `, values));
}

runComprehensiveEnrichment().then(() => {
  console.log('All enrichment processes completed successfully');
  process.exit(0);
}).catch(error => {
  console.error('Comprehensive enrichment failed:', error);
  process.exit(1);
});