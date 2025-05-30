/**
 * Accelerated Research Enrichment
 * 
 * High-speed parallel processing to enrich all studies rapidly
 */

import { db } from './db';
import { studies } from '../shared/schema';
import { eq } from 'drizzle-orm';

interface AcceleratedStats {
  totalStudies: number;
  processed: number;
  enriched: number;
  errors: number;
  startTime: Date;
  estimatedCompletion?: Date;
}

let acceleratedStats: AcceleratedStats = {
  totalStudies: 0,
  processed: 0,
  enriched: 0,
  errors: 0,
  startTime: new Date()
};

async function acceleratedEnrichment() {
  console.log('🚀 Starting accelerated research enrichment...');
  
  acceleratedStats.startTime = new Date();
  
  // Get all studies needing enrichment
  const allStudies = await db
    .select({
      id: studies.id,
      doi: studies.doi,
      citationUrl: studies.citationUrl
    })
    .from(studies);

  const studiesToProcess = allStudies.filter(study => 
    study.doi && 
    study.doi.trim() !== '' && 
    (!study.citationUrl || study.citationUrl.trim() === '')
  );

  acceleratedStats.totalStudies = studiesToProcess.length;
  console.log(`📊 Processing ${acceleratedStats.totalStudies} studies with parallel processing`);

  // Process in large parallel batches
  const batchSize = 50;
  const concurrentBatches = 3; // Process 3 batches simultaneously
  
  for (let i = 0; i < studiesToProcess.length; i += batchSize * concurrentBatches) {
    const batchPromises = [];
    
    // Create concurrent batch promises
    for (let j = 0; j < concurrentBatches; j++) {
      const batchStart = i + (j * batchSize);
      const batchEnd = Math.min(batchStart + batchSize, studiesToProcess.length);
      
      if (batchStart < studiesToProcess.length) {
        const batch = studiesToProcess.slice(batchStart, batchEnd);
        batchPromises.push(processParallelBatch(batch, j + 1));
      }
    }
    
    // Wait for all concurrent batches to complete
    await Promise.all(batchPromises);
    
    // Progress update
    const processed = Math.min(i + (batchSize * concurrentBatches), studiesToProcess.length);
    const percentage = ((processed / acceleratedStats.totalStudies) * 100).toFixed(1);
    
    console.log(`⚡ Progress: ${processed}/${acceleratedStats.totalStudies} (${percentage}%) | Enriched: ${acceleratedStats.enriched}`);
    
    // Estimate completion time
    const elapsed = Date.now() - acceleratedStats.startTime.getTime();
    const rate = processed / elapsed;
    const remaining = acceleratedStats.totalStudies - processed;
    const estimatedMs = remaining / rate;
    acceleratedStats.estimatedCompletion = new Date(Date.now() + estimatedMs);
    
    console.log(`⏱️  Estimated completion: ${acceleratedStats.estimatedCompletion.toLocaleTimeString()}`);
  }

  console.log(`\n🎉 Accelerated enrichment completed!`);
  console.log(`📈 Results: ${acceleratedStats.enriched}/${acceleratedStats.processed} studies enriched`);
  console.log(`⏱️  Total time: ${((Date.now() - acceleratedStats.startTime.getTime()) / 1000 / 60).toFixed(1)} minutes`);
  
  return acceleratedStats;
}

async function processParallelBatch(batch: any[], batchNumber: number): Promise<void> {
  console.log(`📦 Batch ${batchNumber}: Processing ${batch.length} studies in parallel`);
  
  // Process all studies in batch simultaneously
  const promises = batch.map(study => enrichSingleStudyFast(study));
  const results = await Promise.allSettled(promises);
  
  let batchEnriched = 0;
  
  results.forEach((result, index) => {
    acceleratedStats.processed++;
    
    if (result.status === 'fulfilled' && result.value) {
      acceleratedStats.enriched++;
      batchEnriched++;
    } else {
      acceleratedStats.errors++;
    }
  });
  
  console.log(`✅ Batch ${batchNumber} completed: ${batchEnriched}/${batch.length} enriched`);
}

async function enrichSingleStudyFast(study: any): Promise<boolean> {
  const doi = study.doi;
  
  try {
    // Parallel API calls with fast timeouts
    const [crossrefData, pubmedData] = await Promise.allSettled([
      fetchCrossRefFast(doi),
      fetchPubMedFast(doi)
    ]);
    
    const links = {
      citationUrl: '',
      sourceUrl: '',
      pdfUrl: ''
    };
    
    // Process CrossRef result
    if (crossrefData.status === 'fulfilled' && crossrefData.value) {
      const data = crossrefData.value;
      links.citationUrl = `https://doi.org/${doi}`;
      links.sourceUrl = data.sourceUrl || `https://doi.org/${doi}`;
      links.pdfUrl = data.pdfUrl || '';
    }
    
    // Process PubMed result as fallback
    if (!links.citationUrl && pubmedData.status === 'fulfilled' && pubmedData.value) {
      const data = pubmedData.value;
      links.citationUrl = data.citationUrl;
      links.sourceUrl = data.sourceUrl;
    }
    
    // Update database if we have data
    if (links.citationUrl || links.sourceUrl) {
      await updateStudyFast(study.id, links);
      return true;
    }
    
    return false;
    
  } catch (error) {
    return false;
  }
}

async function fetchCrossRefFast(doi: string): Promise<any> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 3000); // Fast 3-second timeout
  
  try {
    const response = await fetch(`https://api.crossref.org/works/${doi}`, {
      headers: {
        'User-Agent': 'HydrogenStudies/1.0 (mailto:contact@hydrogenstudies.com)',
        'Accept': 'application/json'
      },
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) return null;
    
    const data = await response.json();
    const work = data.message;
    
    return {
      sourceUrl: work.URL,
      pdfUrl: work.link?.find((l: any) => l['content-type']?.includes('pdf'))?.URL
    };
  } catch (error) {
    clearTimeout(timeoutId);
    return null;
  }
}

async function fetchPubMedFast(doi: string): Promise<any> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 3000);
  
  try {
    const searchResponse = await fetch(
      `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=${encodeURIComponent(doi)}&retmode=json`,
      { signal: controller.signal }
    );
    
    clearTimeout(timeoutId);
    
    if (!searchResponse.ok) return null;
    
    const searchData = await searchResponse.json();
    const pmid = searchData.esearchresult?.idlist?.[0];
    
    if (!pmid) return null;
    
    return {
      citationUrl: `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`,
      sourceUrl: `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`
    };
  } catch (error) {
    clearTimeout(timeoutId);
    return null;
  }
}

async function updateStudyFast(studyId: number, links: any): Promise<void> {
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

export function getAcceleratedStats(): AcceleratedStats {
  return acceleratedStats;
}

// Start accelerated enrichment
acceleratedEnrichment()
  .then(() => {
    console.log('✅ Accelerated research enrichment completed successfully');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Accelerated enrichment failed:', error);
    process.exit(1);
  });

export { acceleratedEnrichment };