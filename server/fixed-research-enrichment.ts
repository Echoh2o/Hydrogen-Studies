/**
 * Fixed Research Enrichment
 * 
 * Corrected database operations to properly save authentic research data
 */

import { db } from './db';
import { studies } from '../shared/schema';
import { eq } from 'drizzle-orm';

interface EnrichmentStats {
  processed: number;
  enriched: number;
  errors: number;
}

async function enrichResearchData() {
  console.log('Starting fixed research data enrichment...');
  
  const stats: EnrichmentStats = {
    processed: 0,
    enriched: 0,
    errors: 0
  };

  // Get studies that need enrichment using Drizzle ORM
  const studiesNeedingEnrichment = await db
    .select({
      id: studies.id,
      title: studies.title,
      doi: studies.doi,
      citationUrl: studies.citationUrl,
      sourceUrl: studies.sourceUrl
    })
    .from(studies)
    .where(eq(studies.doi, studies.doi))
    .limit(100);

  const studiesToProcess = studiesNeedingEnrichment.filter(study => 
    study.doi && 
    study.doi.trim() !== '' && 
    (!study.citationUrl || study.citationUrl.trim() === '')
  );

  console.log(`Found ${studiesToProcess.length} studies needing enrichment`);

  for (const study of studiesToProcess) {
    stats.processed++;
    
    try {
      const enrichmentData = await getResearchLinks(study.doi!);
      
      if (enrichmentData.citationUrl || enrichmentData.sourceUrl || enrichmentData.pdfUrl) {
        await updateStudyWithDrizzle(study.id, enrichmentData);
        stats.enriched++;
        console.log(`✓ Enriched study ${study.id}: ${study.title?.substring(0, 50)}...`);
      }
      
    } catch (error) {
      stats.errors++;
      console.log(`✗ Error with study ${study.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
    
    // Rate limiting to respect API guidelines
    await new Promise(resolve => setTimeout(resolve, 250));
    
    if (stats.processed % 10 === 0) {
      console.log(`Progress: ${stats.processed} processed, ${stats.enriched} enriched`);
    }
  }

  console.log('\nEnrichment completed:');
  console.log(`Processed: ${stats.processed}`);
  console.log(`Enriched: ${stats.enriched}`);
  console.log(`Errors: ${stats.errors}`);
  
  return stats;
}

async function getResearchLinks(doi: string) {
  const links = {
    citationUrl: '',
    sourceUrl: '',
    pdfUrl: ''
  };

  // Try CrossRef API for authentic academic data
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const response = await fetch(`https://api.crossref.org/works/${doi}`, {
      headers: {
        'User-Agent': 'HydrogenStudies/1.0 (mailto:contact@hydrogenstudies.com)',
        'Accept': 'application/json'
      },
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      const work = data.message;
      
      // Get authentic DOI link
      links.citationUrl = `https://doi.org/${doi}`;
      
      // Get publisher's official URL
      if (work.URL) {
        links.sourceUrl = work.URL;
      } else {
        links.sourceUrl = `https://doi.org/${doi}`;
      }
      
      // Check for PDF availability
      if (work.link && Array.isArray(work.link)) {
        const pdfLink = work.link.find((l: any) => 
          l['content-type']?.includes('pdf') || 
          l['content-type']?.includes('application/pdf')
        );
        
        if (pdfLink && pdfLink.URL) {
          links.pdfUrl = pdfLink.URL;
        }
      }
      
      console.log(`CrossRef success for DOI: ${doi}`);
    }
  } catch (error) {
    console.log(`CrossRef timeout for DOI: ${doi}`);
  }

  // Try PubMed API if CrossRef didn't provide adequate data
  if (!links.citationUrl) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      const searchResponse = await fetch(
        `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=${encodeURIComponent(doi)}&retmode=json`,
        { signal: controller.signal }
      );

      clearTimeout(timeoutId);

      if (searchResponse.ok) {
        const searchData = await searchResponse.json();
        const pmid = searchData.esearchresult?.idlist?.[0];

        if (pmid) {
          links.citationUrl = `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`;
          if (!links.sourceUrl) {
            links.sourceUrl = `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`;
          }
          console.log(`PubMed success for DOI: ${doi}, PMID: ${pmid}`);
        }
      }
    } catch (error) {
      console.log(`PubMed timeout for DOI: ${doi}`);
    }
  }

  return links;
}

async function updateStudyWithDrizzle(studyId: number, links: any) {
  const updateData: any = {};
  
  if (links.citationUrl && links.citationUrl.trim() !== '') {
    updateData.citationUrl = links.citationUrl;
  }
  
  if (links.sourceUrl && links.sourceUrl.trim() !== '') {
    updateData.sourceUrl = links.sourceUrl;
  }
  
  if (links.pdfUrl && links.pdfUrl.trim() !== '') {
    updateData.pdfUrl = links.pdfUrl;
  }
  
  if (Object.keys(updateData).length > 0) {
    await db
      .update(studies)
      .set(updateData)
      .where(eq(studies.id, studyId));
  }
}

// Run enrichment
enrichResearchData()
  .then(stats => {
    console.log(`Research enrichment completed: ${stats.enriched} studies enhanced with authentic data`);
    process.exit(0);
  })
  .catch(error => {
    console.error('Research enrichment failed:', error);
    process.exit(1);
  });