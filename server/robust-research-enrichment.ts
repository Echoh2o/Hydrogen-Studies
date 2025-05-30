/**
 * Robust Research Enrichment System
 * 
 * Improved version with better error handling and persistent progress tracking
 */

import { db } from './db';
import { sql } from 'drizzle-orm';

interface EnrichmentProgress {
  totalStudies: number;
  processed: number;
  enriched: number;
  currentBatch: number;
  errors: number;
  startTime: Date;
  lastProcessedId?: number;
}

let currentProgress: EnrichmentProgress = {
  totalStudies: 0,
  processed: 0,
  enriched: 0,
  currentBatch: 0,
  errors: 0,
  startTime: new Date()
};

async function startRobustEnrichment() {
  console.log('🔄 Starting robust research enrichment process...');
  
  // Get total count first
  const countResult = await db.execute(sql`
    SELECT COUNT(*) as total 
    FROM studies 
    WHERE doi IS NOT NULL AND doi != ''
  `);
  
  currentProgress.totalStudies = Number(countResult.rows[0].total);
  currentProgress.startTime = new Date();
  
  console.log(`📊 Total studies to process: ${currentProgress.totalStudies}`);
  
  const batchSize = 50; // Smaller batches for better reliability
  let offset = 0;
  let consecutiveErrors = 0;
  
  while (offset < currentProgress.totalStudies) {
    currentProgress.currentBatch = Math.floor(offset / batchSize) + 1;
    
    console.log(`\n📦 Processing batch ${currentProgress.currentBatch} (studies ${offset + 1}-${Math.min(offset + batchSize, currentProgress.totalStudies)})`);
    
    try {
      const studies = await db.execute(sql`
        SELECT id, title, doi, abstract, citation_url, source_url, pdf_url
        FROM studies 
        WHERE doi IS NOT NULL AND doi != ''
        ORDER BY id
        LIMIT ${batchSize} OFFSET ${offset}
      `);

      let batchEnriched = 0;
      
      for (const study of studies.rows) {
        try {
          const enriched = await enrichSingleStudyRobust(study);
          if (enriched) {
            batchEnriched++;
            currentProgress.enriched++;
          }
          currentProgress.processed++;
          currentProgress.lastProcessedId = study.id as number;
          
          // Small delay to respect API limits
          await new Promise(resolve => setTimeout(resolve, 200));
          
        } catch (error) {
          currentProgress.errors++;
          console.log(`⚠️  Error processing study ${study.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }
      
      console.log(`✅ Batch completed: ${batchEnriched} studies enriched`);
      consecutiveErrors = 0;
      
    } catch (error) {
      consecutiveErrors++;
      console.log(`❌ Batch ${currentProgress.currentBatch} failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      
      if (consecutiveErrors >= 3) {
        console.log('⛔ Too many consecutive errors, stopping process');
        break;
      }
    }
    
    offset += batchSize;
    
    // Progress report every 5 batches
    if (currentProgress.currentBatch % 5 === 0) {
      const percentage = ((currentProgress.processed / currentProgress.totalStudies) * 100).toFixed(1);
      console.log(`\n📈 Progress: ${currentProgress.processed}/${currentProgress.totalStudies} (${percentage}%) | Enriched: ${currentProgress.enriched} | Errors: ${currentProgress.errors}`);
    }
  }
  
  console.log('\n🎉 Robust enrichment process completed');
  console.log(`📊 Final results: ${currentProgress.enriched} studies enriched out of ${currentProgress.processed} processed`);
  
  return currentProgress;
}

async function enrichSingleStudyRobust(study: any): Promise<boolean> {
  const doi = study.doi as string;
  let hasUpdates = false;
  const updates: any = {};
  
  // Skip if already has all key data
  if (study.citation_url && study.source_url && study.pdf_url) {
    return false;
  }
  
  // Try CrossRef first
  try {
    const crossrefData = await fetchFromCrossRefRobust(doi);
    if (crossrefData) {
      if (!study.citation_url && crossrefData.citationUrl) {
        updates.citation_url = crossrefData.citationUrl;
        hasUpdates = true;
      }
      if (!study.source_url && crossrefData.sourceUrl) {
        updates.source_url = crossrefData.sourceUrl;
        hasUpdates = true;
      }
      if (!study.pdf_url && crossrefData.pdfUrl) {
        updates.pdf_url = crossrefData.pdfUrl;
        hasUpdates = true;
      }
    }
  } catch (error) {
    // Silent fail for individual API calls
  }
  
  // Try PubMed if still missing data
  if (!updates.citation_url || !updates.source_url) {
    try {
      const pubmedData = await fetchFromPubMedRobust(doi);
      if (pubmedData) {
        if (!updates.citation_url && pubmedData.citationUrl) {
          updates.citation_url = pubmedData.citationUrl;
          hasUpdates = true;
        }
        if (!updates.source_url && pubmedData.sourceUrl) {
          updates.source_url = pubmedData.sourceUrl;
          hasUpdates = true;
        }
      }
    } catch (error) {
      // Silent fail for individual API calls
    }
  }
  
  // Update database if we have new data
  if (hasUpdates) {
    await updateStudyInDatabaseRobust(study.id as number, updates);
    return true;
  }
  
  return false;
}

async function fetchFromCrossRefRobust(doi: string) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
  
  try {
    const response = await fetch(`https://api.crossref.org/works/${doi}`, {
      headers: {
        'User-Agent': 'HydrogenStudies/1.0 (mailto:contact@hydrogenstudies.com)'
      },
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) return null;
    
    const data = await response.json();
    const work = data.message;
    
    return {
      citationUrl: `https://doi.org/${doi}`,
      sourceUrl: work.URL || `https://doi.org/${doi}`,
      pdfUrl: work.link?.find((l: any) => l['content-type']?.includes('pdf'))?.URL
    };
  } catch (error) {
    clearTimeout(timeoutId);
    return null;
  }
}

async function fetchFromPubMedRobust(doi: string) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);
  
  try {
    const searchResponse = await fetch(
      `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=${encodeURIComponent(doi)}&retmode=json`,
      { signal: controller.signal }
    );
    
    if (!searchResponse.ok) return null;
    
    const searchData = await searchResponse.json();
    const pmid = searchData.esearchresult?.idlist?.[0];
    
    if (!pmid) return null;
    
    return {
      citationUrl: `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`,
      sourceUrl: `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`
    };
  } catch (error) {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function updateStudyInDatabaseRobust(studyId: number, updates: any) {
  const updateEntries = Object.entries(updates);
  if (updateEntries.length === 0) return;
  
  const setClause = updateEntries
    .map(([key], index) => `${key} = $${index + 2}`)
    .join(', ');
  
  const queryText = `UPDATE studies SET ${setClause} WHERE id = $1`;
  const values = [studyId, ...updateEntries.map(([, value]) => value)];
  
  await db.execute(sql.raw(queryText, values));
}

export function getEnrichmentProgress(): EnrichmentProgress {
  return currentProgress;
}

// Start enrichment immediately
startRobustEnrichment()
  .then(() => {
    console.log('✅ Enrichment completed successfully');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Enrichment failed:', error);
    process.exit(1);
  });

export { startRobustEnrichment };