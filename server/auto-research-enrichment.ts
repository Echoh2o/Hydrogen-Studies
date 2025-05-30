/**
 * Auto Research Enrichment
 * 
 * Automatically starts research data enrichment on application startup
 * and provides status monitoring
 */

import { db } from './db';
import { studies } from '../shared/schema';
import { eq } from 'drizzle-orm';

interface EnrichmentStatus {
  isRunning: boolean;
  totalProcessed: number;
  totalEnriched: number;
  lastRunTime?: Date;
  estimatedTimeRemaining?: string;
}

let enrichmentStatus: EnrichmentStatus = {
  isRunning: false,
  totalProcessed: 0,
  totalEnriched: 0
};

/**
 * Check if research enrichment is needed and start automatically
 */
export async function autoStartResearchEnrichment() {
  try {
    // Check current enrichment coverage
    const studiesData = await db
      .select({
        id: studies.id,
        doi: studies.doi,
        citationUrl: studies.citationUrl
      })
      .from(studies)
      .limit(1000);

    const studiesNeedingEnrichment = studiesData.filter(study => 
      study.doi && 
      study.doi.trim() !== '' && 
      (!study.citationUrl || study.citationUrl.trim() === '')
    );

    if (studiesNeedingEnrichment.length > 0) {
      console.log(`🔍 Found ${studiesNeedingEnrichment.length} studies needing research enrichment`);
      console.log('🚀 Auto-starting research enrichment process...');
      
      // Start enrichment in background
      startBackgroundEnrichment();
    } else {
      console.log('✅ All studies have research citations - no enrichment needed');
    }
  } catch (error) {
    console.log('⚠️ Could not check enrichment status:', error);
  }
}

/**
 * Start research enrichment in background
 */
async function startBackgroundEnrichment() {
  if (enrichmentStatus.isRunning) {
    console.log('📊 Research enrichment already running');
    return;
  }

  enrichmentStatus.isRunning = true;
  enrichmentStatus.lastRunTime = new Date();
  
  try {
    await enrichResearchDataBackground();
  } catch (error) {
    console.log('❌ Background enrichment error:', error);
  } finally {
    enrichmentStatus.isRunning = false;
  }
}

/**
 * Background research enrichment process
 */
async function enrichResearchDataBackground() {
  console.log('🔬 Starting background research enrichment...');
  
  let batchNumber = 1;
  const batchSize = 25; // Smaller batches for background processing
  
  while (true) {
    // Get next batch of studies needing enrichment
    const studiesNeedingEnrichment = await db
      .select({
        id: studies.id,
        title: studies.title,
        doi: studies.doi,
        citationUrl: studies.citationUrl
      })
      .from(studies)
      .where(eq(studies.doi, studies.doi))
      .limit(batchSize * 2); // Get extra to filter

    const studiesToProcess = studiesNeedingEnrichment.filter(study => 
      study.doi && 
      study.doi.trim() !== '' && 
      (!study.citationUrl || study.citationUrl.trim() === '')
    ).slice(0, batchSize);

    if (studiesToProcess.length === 0) {
      console.log('✅ Background enrichment completed - all studies processed');
      break;
    }

    console.log(`📦 Processing batch ${batchNumber}: ${studiesToProcess.length} studies`);
    
    let batchEnriched = 0;
    
    for (const study of studiesToProcess) {
      try {
        const enrichmentData = await getResearchLinksBackground(study.doi!);
        
        if (enrichmentData.citationUrl || enrichmentData.sourceUrl) {
          await updateStudyWithResearchData(study.id, enrichmentData);
          batchEnriched++;
          enrichmentStatus.totalEnriched++;
        }
        
        enrichmentStatus.totalProcessed++;
        
      } catch (error) {
        console.log(`⚠️ Error enriching study ${study.id}`);
      }
      
      // Rate limiting for background processing
      await new Promise(resolve => setTimeout(resolve, 400));
    }
    
    console.log(`✓ Batch ${batchNumber} completed: ${batchEnriched} studies enriched`);
    batchNumber++;
    
    // Pause between batches for background processing
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
}

/**
 * Get research links from academic APIs
 */
async function getResearchLinksBackground(doi: string) {
  const links = {
    citationUrl: '',
    sourceUrl: '',
    pdfUrl: ''
  };

  // Try CrossRef API
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

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
      
      links.citationUrl = `https://doi.org/${doi}`;
      links.sourceUrl = work.URL || `https://doi.org/${doi}`;
      
      const pdfLink = work.link?.find((l: any) => 
        l['content-type']?.includes('pdf')
      );
      
      if (pdfLink?.URL) {
        links.pdfUrl = pdfLink.URL;
      }
    }
  } catch (error) {
    // Try PubMed as fallback
    try {
      const searchResponse = await fetch(
        `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=${encodeURIComponent(doi)}&retmode=json`
      );

      if (searchResponse.ok) {
        const searchData = await searchResponse.json();
        const pmid = searchData.esearchresult?.idlist?.[0];

        if (pmid) {
          links.citationUrl = `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`;
          if (!links.sourceUrl) {
            links.sourceUrl = `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`;
          }
        }
      }
    } catch (pubmedError) {
      // Silent fail for background processing
    }
  }

  return links;
}

/**
 * Update study with research data
 */
async function updateStudyWithResearchData(studyId: number, links: any) {
  const updateData: any = {};
  
  if (links.citationUrl?.trim()) {
    updateData.citationUrl = links.citationUrl;
  }
  
  if (links.sourceUrl?.trim()) {
    updateData.sourceUrl = links.sourceUrl;
  }
  
  if (links.pdfUrl?.trim()) {
    updateData.pdfUrl = links.pdfUrl;
  }
  
  if (Object.keys(updateData).length > 0) {
    await db
      .update(studies)
      .set(updateData)
      .where(eq(studies.id, studyId));
  }
}

/**
 * Get current enrichment status
 */
export function getEnrichmentStatus(): EnrichmentStatus {
  return enrichmentStatus;
}