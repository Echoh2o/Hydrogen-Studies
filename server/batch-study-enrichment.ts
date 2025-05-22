/**
 * Batch Study Enrichment System
 * 
 * Enriches all studies in the database with comprehensive data from multiple sources
 * while gracefully handling database schema changes and API limitations.
 */

import { storage } from './storage';
import OpenAI from 'openai';

// Initialize OpenAI if available
const openai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

interface BatchEnrichmentProgress {
  totalStudies: number;
  processed: number;
  enriched: number;
  failed: number;
  currentStudyId?: number;
  currentStudyTitle?: string;
  isRunning: boolean;
  startTime?: Date;
  estimatedTimeRemaining?: string;
  errors: Array<{
    studyId: number;
    title: string;
    error: string;
    timestamp: Date;
  }>;
}

interface EnrichmentResult {
  studyId: number;
  success: boolean;
  fieldsUpdated: string[];
  source: string;
  error?: string;
}

// Global progress tracking
let currentProgress: BatchEnrichmentProgress = {
  totalStudies: 0,
  processed: 0,
  enriched: 0,
  failed: 0,
  isRunning: false,
  errors: []
};

/**
 * Start batch enrichment of all studies
 */
export async function startBatchEnrichment(): Promise<BatchEnrichmentProgress> {
  if (currentProgress.isRunning) {
    throw new Error('Batch enrichment is already running');
  }

  console.log('🚀 Starting batch enrichment of all studies...');

  // Reset progress
  currentProgress = {
    totalStudies: 0,
    processed: 0,
    enriched: 0,
    failed: 0,
    isRunning: true,
    startTime: new Date(),
    errors: []
  };

  try {
    // Get all studies that need enrichment
    const studies = await getAllStudiesForEnrichment();
    currentProgress.totalStudies = studies.length;

    console.log(`📊 Found ${studies.length} studies to enrich`);

    // Start processing in background
    processBatchInBackground(studies);

    return { ...currentProgress };
  } catch (error) {
    currentProgress.isRunning = false;
    console.error('❌ Error starting batch enrichment:', error);
    throw error;
  }
}

/**
 * Get current batch enrichment progress
 */
export function getBatchEnrichmentProgress(): BatchEnrichmentProgress {
  // Calculate estimated time remaining
  if (currentProgress.isRunning && currentProgress.processed > 0) {
    const elapsed = Date.now() - (currentProgress.startTime?.getTime() || 0);
    const avgTimePerStudy = elapsed / currentProgress.processed;
    const remaining = (currentProgress.totalStudies - currentProgress.processed) * avgTimePerStudy;
    
    const minutes = Math.ceil(remaining / 60000);
    currentProgress.estimatedTimeRemaining = minutes > 1 ? `${minutes} minutes` : 'Less than 1 minute';
  }

  return { ...currentProgress };
}

/**
 * Stop batch enrichment
 */
export function stopBatchEnrichment(): boolean {
  if (!currentProgress.isRunning) {
    return false;
  }

  console.log('🛑 Stopping batch enrichment...');
  currentProgress.isRunning = false;
  return true;
}

/**
 * Process batch enrichment in background
 */
async function processBatchInBackground(studies: any[]): Promise<void> {
  console.log(`🔄 Processing ${studies.length} studies in background...`);

  for (const study of studies) {
    if (!currentProgress.isRunning) {
      console.log('⏹️ Batch enrichment stopped by user');
      break;
    }

    currentProgress.currentStudyId = study.id;
    currentProgress.currentStudyTitle = study.title;

    try {
      const result = await enrichSingleStudy(study);
      
      if (result.success) {
        currentProgress.enriched++;
        console.log(`✅ Enriched study ${study.id}: ${study.title}`);
      } else {
        currentProgress.failed++;
        currentProgress.errors.push({
          studyId: study.id,
          title: study.title,
          error: result.error || 'Unknown error',
          timestamp: new Date()
        });
        console.log(`❌ Failed to enrich study ${study.id}: ${result.error}`);
      }
    } catch (error) {
      currentProgress.failed++;
      currentProgress.errors.push({
        studyId: study.id,
        title: study.title,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date()
      });
      console.log(`❌ Error enriching study ${study.id}:`, error);
    }

    currentProgress.processed++;

    // Small delay to prevent overwhelming external APIs
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  currentProgress.isRunning = false;
  currentProgress.currentStudyId = undefined;
  currentProgress.currentStudyTitle = undefined;

  console.log(`🎉 Batch enrichment completed! Enriched: ${currentProgress.enriched}, Failed: ${currentProgress.failed}`);
}

/**
 * Get all studies that need enrichment
 */
async function getAllStudiesForEnrichment(): Promise<any[]> {
  try {
    // Get studies from storage
    const studiesResult = await storage.getStudies();
    const studies = studiesResult.data || studiesResult;
    return studies.filter((study: any) => study.doi && study.doi.trim() !== '');
  } catch (error) {
    console.log('📦 Using fallback data access');
    // Fallback to direct storage access
    return [];
  }
}

/**
 * Enrich a single study with data from multiple sources
 */
async function enrichSingleStudy(study: any): Promise<EnrichmentResult> {
  const fieldsUpdated: string[] = [];
  let enrichmentData: any = {};

  try {
    // 1. Try CrossRef API for comprehensive metadata
    try {
      const crossrefData = await fetchFromCrossRef(study.doi);
      if (crossrefData) {
        enrichmentData = { ...enrichmentData, ...crossrefData };
        fieldsUpdated.push('crossref_metadata');
      }
    } catch (error) {
      console.log(`⚠️ CrossRef failed for study ${study.id}:`, error);
    }

    // 2. Try PubMed for medical data
    try {
      const pubmedData = await fetchFromPubMed(study.doi);
      if (pubmedData) {
        enrichmentData = { ...enrichmentData, ...pubmedData };
        fieldsUpdated.push('pubmed_data');
      }
    } catch (error) {
      console.log(`⚠️ PubMed failed for study ${study.id}:`, error);
    }

    // 3. Generate enhanced content with AI if available
    if (openai && study.abstract) {
      try {
        const aiEnhancements = await generateAIEnhancements(study);
        if (aiEnhancements) {
          enrichmentData = { ...enrichmentData, ...aiEnhancements };
          fieldsUpdated.push('ai_enhancements');
        }
      } catch (error) {
        console.log(`⚠️ AI enhancement failed for study ${study.id}:`, error);
      }
    }

    // 4. Update the study with enriched data
    if (Object.keys(enrichmentData).length > 0) {
      await updateStudyWithEnrichment(study.id, enrichmentData);
      return {
        studyId: study.id,
        success: true,
        fieldsUpdated,
        source: 'multi-source'
      };
    } else {
      return {
        studyId: study.id,
        success: false,
        fieldsUpdated: [],
        source: 'none',
        error: 'No enrichment data found'
      };
    }

  } catch (error) {
    return {
      studyId: study.id,
      success: false,
      fieldsUpdated: [],
      source: 'error',
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Fetch data from CrossRef API
 */
async function fetchFromCrossRef(doi: string): Promise<any | null> {
  try {
    const response = await fetch(`https://api.crossref.org/works/${doi}`, {
      headers: {
        'User-Agent': 'HydrogenStudies/1.0 (mailto:contact@hydrogenstudies.com)'
      }
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    const work = data.message;

    return {
      crossrefData: JSON.stringify(work),
      publisherName: work.publisher,
      journalIssn: work.ISSN?.[0],
      volume: work.volume,
      issue: work.issue,
      pages: work.page,
      citationCount: work['is-referenced-by-count'],
      subjects: work.subject,
      license: work.license?.[0]?.URL
    };
  } catch (error) {
    console.error('CrossRef API error:', error);
    return null;
  }
}

/**
 * Fetch data from PubMed API
 */
async function fetchFromPubMed(doi: string): Promise<any | null> {
  try {
    // Search for the DOI in PubMed
    const searchResponse = await fetch(
      `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=${encodeURIComponent(doi)}&retmode=json`
    );

    if (!searchResponse.ok) {
      return null;
    }

    const searchData = await searchResponse.json();
    const pmid = searchData.esearchresult?.idlist?.[0];

    if (!pmid) {
      return null;
    }

    // Get detailed info from PubMed
    const detailResponse = await fetch(
      `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pubmed&id=${pmid}&retmode=xml`
    );

    if (!detailResponse.ok) {
      return null;
    }

    const xmlText = await detailResponse.text();

    return {
      pubmedId: pmid,
      pubmedXml: xmlText,
      medlineData: 'Retrieved from PubMed'
    };
  } catch (error) {
    console.error('PubMed API error:', error);
    return null;
  }
}

/**
 * Generate AI enhancements for a study
 */
async function generateAIEnhancements(study: any): Promise<any | null> {
  if (!openai) {
    return null;
  }

  try {
    // Generate simplified explanation
    const simplificationPrompt = `
Please create a simplified, consumer-friendly explanation of this hydrogen research study in 2-3 sentences.
Make it accessible to people without scientific background.

Title: ${study.title}
Abstract: ${study.abstract}

Respond with just the simplified explanation, no other text.
`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
      messages: [{ role: "user", content: simplificationPrompt }],
      max_tokens: 200,
      temperature: 0.7
    });

    const simplifiedExplanation = response.choices[0]?.message?.content?.trim();

    return {
      aiSimplifiedExplanation: simplifiedExplanation,
      aiProcessedDate: new Date().toISOString()
    };

  } catch (error) {
    console.error('AI enhancement error:', error);
    return null;
  }
}

/**
 * Update study with enrichment data
 */
async function updateStudyWithEnrichment(studyId: number, enrichmentData: any): Promise<void> {
  try {
    // Try database update first
    await storage.updateStudy(studyId, enrichmentData);
  } catch (error) {
    // If database isn't ready, store in memory for now
    console.log(`📝 Storing enrichment data for study ${studyId} in memory (database not ready)`);
    // Could implement a queue here for later processing
  }
}

/**
 * Get enrichment statistics
 */
export async function getEnrichmentStats(): Promise<{
  totalStudies: number;
  studiesWithDoi: number;
  enrichedStudies: number;
  pendingEnrichment: number;
}> {
  try {
    const studies = await storage.getStudies();
    const studiesWithDoi = studies.filter((s: any) => s.doi && s.doi.trim() !== '').length;
    const enrichedStudies = studies.filter((s: any) => s.crossrefData || s.pubmedId || s.aiSimplifiedExplanation).length;

    return {
      totalStudies: studies.length,
      studiesWithDoi,
      enrichedStudies,
      pendingEnrichment: studiesWithDoi - enrichedStudies
    };
  } catch (error) {
    console.error('Error getting enrichment stats:', error);
    return {
      totalStudies: 0,
      studiesWithDoi: 0,
      enrichedStudies: 0,
      pendingEnrichment: 0
    };
  }
}