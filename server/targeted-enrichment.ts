/**
 * Targeted Studies Enrichment System
 * 
 * Focuses on enriching critical missing fields:
 * - Keywords/tags for search and categorization
 * - Health conditions for navigation
 * - Body systems for browsing structure
 * - Conclusions for study summaries
 */

import { db } from './db';
import { sql } from 'drizzle-orm';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

interface EnrichmentStats {
  totalProcessed: number;
  keywordsAdded: number;
  healthConditionsAdded: number;
  bodySystemsAdded: number;
  conclusionsAdded: number;
  errors: number;
  startTime: Date;
  isRunning: boolean;
}

let enrichmentStats: EnrichmentStats = {
  totalProcessed: 0,
  keywordsAdded: 0,
  healthConditionsAdded: 0,
  bodySystemsAdded: 0,
  conclusionsAdded: 0,
  errors: 0,
  startTime: new Date(),
  isRunning: false
};

/**
 * Start targeted enrichment of critical missing fields
 */
export async function startTargetedEnrichment(batchSize: number = 10): Promise<EnrichmentStats> {
  if (enrichmentStats.isRunning) {
    throw new Error('Enrichment is already running');
  }

  console.log('Starting targeted enrichment process...');
  enrichmentStats.isRunning = true;
  enrichmentStats.startTime = new Date();
  enrichmentStats.totalProcessed = 0;
  enrichmentStats.keywordsAdded = 0;
  enrichmentStats.healthConditionsAdded = 0;
  enrichmentStats.bodySystemsAdded = 0;
  enrichmentStats.conclusionsAdded = 0;
  enrichmentStats.errors = 0;

  // Run enrichment in background
  processEnrichmentBatches(batchSize).catch(error => {
    console.error('Enrichment process failed:', error);
    enrichmentStats.isRunning = false;
  });

  return enrichmentStats;
}

/**
 * Get current enrichment status
 */
export function getEnrichmentStatus(): EnrichmentStats {
  return { ...enrichmentStats };
}

/**
 * Process studies in batches for enrichment
 */
async function processEnrichmentBatches(batchSize: number): Promise<void> {
  try {
    // Get studies that need enrichment (prioritize those missing critical fields)
    const { pool } = await import('./db');
    
    const query = `
      SELECT id, title, abstract, methods, results
      FROM studies 
      WHERE (keywords IS NULL OR array_length(keywords, 1) = 0)
         OR health_conditions IS NULL OR health_conditions = ''
         OR body_systems IS NULL OR body_systems = ''
         OR conclusion IS NULL OR conclusion = ''
      ORDER BY id
      LIMIT 500
    `;
    
    const result = await pool.query(query);
    const studiesNeedingEnrichment = result.rows;
    
    console.log(`Found ${studiesNeedingEnrichment.length} studies needing enrichment`);
    
    // Process in batches
    for (let i = 0; i < studiesNeedingEnrichment.length; i += batchSize) {
      const batch = studiesNeedingEnrichment.slice(i, i + batchSize);
      await processBatch(batch);
      
      // Small delay between batches to avoid overwhelming the API
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    enrichmentStats.isRunning = false;
    console.log('Targeted enrichment completed successfully');
    
  } catch (error) {
    console.error('Error in enrichment process:', error);
    enrichmentStats.isRunning = false;
    throw error;
  }
}

/**
 * Process a single batch of studies
 */
async function processBatch(studies: any[]): Promise<void> {
  for (const study of studies) {
    try {
      await enrichSingleStudy(study);
      enrichmentStats.totalProcessed++;
    } catch (error) {
      console.error(`Error enriching study ${study.id}:`, error);
      enrichmentStats.errors++;
    }
  }
}

/**
 * Enrich a single study with AI-generated content
 */
async function enrichSingleStudy(study: any): Promise<void> {
  const studyContent = `
    Title: ${study.title}
    Abstract: ${study.abstract}
    Methods: ${study.methods || 'Not provided'}
    Results: ${study.results || 'Not provided'}
  `;

  // Generate comprehensive enrichment data
  const enrichmentPrompt = `
    Analyze this hydrogen health research study and provide the following information in JSON format:

    {
      "keywords": ["keyword1", "keyword2", ...], // 5-10 relevant keywords
      "health_conditions": "primary health condition or disease studied",
      "body_systems": "primary body system affected (e.g., cardiovascular, neurological, respiratory)",
      "conclusion": "concise 2-3 sentence conclusion based on the study results"
    }

    Study to analyze:
    ${studyContent}

    Focus on:
    - Keywords should include medical terms, health conditions, and research methods
    - Health conditions should be specific (e.g., "Type 2 Diabetes" not just "diabetes")
    - Body systems should use standard medical categories
    - Conclusion should summarize the key findings and clinical significance
  `;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
      messages: [
        {
          role: "system",
          content: "You are a medical research expert specializing in hydrogen therapy studies. Provide accurate, scientific analysis in the requested JSON format."
        },
        {
          role: "user",
          content: enrichmentPrompt
        }
      ],
      response_format: { type: "json_object" },
      max_tokens: 1000,
      temperature: 0.3
    });

    const enrichmentData = JSON.parse(response.choices[0].message.content || '{}');
    
    // Update the study with enriched data
    await updateStudyWithEnrichment(study.id, enrichmentData);
    
    // Update stats
    if (enrichmentData.keywords?.length > 0) enrichmentStats.keywordsAdded++;
    if (enrichmentData.health_conditions) enrichmentStats.healthConditionsAdded++;
    if (enrichmentData.body_systems) enrichmentStats.bodySystemsAdded++;
    if (enrichmentData.conclusion) enrichmentStats.conclusionsAdded++;
    
    console.log(`Enriched study ${study.id}: ${study.title.substring(0, 50)}...`);
    
  } catch (error) {
    console.error(`Failed to generate enrichment for study ${study.id}:`, error);
    throw error;
  }
}

/**
 * Update study with enrichment data
 */
async function updateStudyWithEnrichment(studyId: number, enrichmentData: any): Promise<void> {
  const { pool } = await import('./db');
  
  const updateQuery = `
    UPDATE studies 
    SET 
      keywords = COALESCE($2, keywords),
      health_conditions = COALESCE($3, health_conditions),
      body_systems = COALESCE($4, body_systems),
      conclusion = COALESCE($5, conclusion)
    WHERE id = $1
  `;
  
  await pool.query(updateQuery, [
    studyId,
    enrichmentData.keywords || null,
    enrichmentData.health_conditions || null,
    enrichmentData.body_systems || null,
    enrichmentData.conclusion || null
  ]);
}

/**
 * Get enrichment progress summary
 */
export async function getEnrichmentSummary(): Promise<any> {
  const { pool } = await import('./db');
  
  const query = `
    SELECT 
      COUNT(*) as total_studies,
      COUNT(CASE WHEN keywords IS NOT NULL AND array_length(keywords, 1) > 0 THEN 1 END) as with_keywords,
      COUNT(CASE WHEN health_conditions IS NOT NULL AND health_conditions != '' THEN 1 END) as with_health_conditions,
      COUNT(CASE WHEN body_systems IS NOT NULL AND body_systems != '' THEN 1 END) as with_body_systems,
      COUNT(CASE WHEN conclusion IS NOT NULL AND conclusion != '' THEN 1 END) as with_conclusions
    FROM studies
  `;
  
  const result = await pool.query(query);
  return result.rows[0];
}