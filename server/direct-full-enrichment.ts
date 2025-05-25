/**
 * Direct Full Database Enrichment
 * 
 * This script directly enriches all studies in the main database
 * with keywords, health conditions, and simplified explanations.
 */

import { db } from './db';
import { studies } from '@shared/schema';
import { eq } from 'drizzle-orm';
import OpenAI from 'openai';

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

interface EnrichmentProgress {
  totalStudies: number;
  processed: number;
  enriched: number;
  failed: number;
  currentStudy?: string;
  errors: Array<{ id: number; error: string }>;
  startTime: Date;
  isRunning: boolean;
}

let currentProgress: EnrichmentProgress = {
  totalStudies: 0,
  processed: 0,
  enriched: 0,
  failed: 0,
  errors: [],
  startTime: new Date(),
  isRunning: false
};

/**
 * Start enriching all studies in the database
 */
export async function startFullDatabaseEnrichment(): Promise<EnrichmentProgress> {
  if (currentProgress.isRunning) {
    throw new Error('Enrichment is already running');
  }

  console.log('🚀 Starting full database enrichment...');
  
  // Get all studies from the database
  const allStudies = await db.select().from(studies);
  
  currentProgress = {
    totalStudies: allStudies.length,
    processed: 0,
    enriched: 0,
    failed: 0,
    errors: [],
    startTime: new Date(),
    isRunning: true
  };

  console.log(`📊 Found ${allStudies.length} studies to enrich`);

  // Process studies in background
  processStudiesInBackground(allStudies);

  return currentProgress;
}

/**
 * Get current enrichment progress
 */
export function getFullEnrichmentProgress(): EnrichmentProgress {
  return currentProgress;
}

/**
 * Process studies in background
 */
async function processStudiesInBackground(studies: any[]): Promise<void> {
  const batchSize = 25; // Process 25 studies at a time

  for (let i = 0; i < studies.length; i += batchSize) {
    const batch = studies.slice(i, i + batchSize);
    
    console.log(`🔄 Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(studies.length / batchSize)}`);
    
    // Process batch sequentially to avoid rate limits
    for (const study of batch) {
      try {
        currentProgress.currentStudy = study.title;
        await enrichSingleStudy(study);
        currentProgress.enriched++;
        console.log(`✅ Enriched study ${study.id}: ${study.title}`);
      } catch (error) {
        currentProgress.failed++;
        currentProgress.errors.push({
          id: study.id,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        console.error(`❌ Failed to enrich study ${study.id}:`, error);
      }
      
      currentProgress.processed++;
    }

    // Small delay between batches to be respectful of API limits
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  console.log('🎉 Full database enrichment completed!');
  console.log(`📊 Final stats: ${currentProgress.enriched} enriched, ${currentProgress.failed} failed`);
  
  currentProgress.isRunning = false;
}

/**
 * Enrich a single study with AI-generated content
 */
async function enrichSingleStudy(study: any): Promise<void> {
  const updates: any = {};
  let hasUpdates = false;

  try {
    // Generate keywords if missing or empty
    if (!study.keywords || study.keywords.length === 0) {
      const keywords = await generateKeywords(study);
      if (keywords && keywords.length > 0) {
        updates.keywords = keywords;
        hasUpdates = true;
      }
    }

    // Generate health conditions if missing
    if (!study.health_conditions || study.health_conditions.trim() === '') {
      const healthConditions = await generateHealthConditions(study);
      if (healthConditions) {
        updates.health_conditions = healthConditions;
        hasUpdates = true;
      }
    }

    // Generate body systems if missing
    if (!study.body_systems || study.body_systems.trim() === '') {
      const bodySystems = await generateBodySystems(study);
      if (bodySystems) {
        updates.body_systems = bodySystems;
        hasUpdates = true;
      }
    }

    // Generate consumer categories if missing
    if (!study.consumer_categories || study.consumer_categories.trim() === '') {
      const consumerCategories = await generateConsumerCategories(study);
      if (consumerCategories) {
        updates.consumer_categories = consumerCategories;
        hasUpdates = true;
      }
    }

    // Update the study if we have improvements
    if (hasUpdates) {
      await db.update(studies)
        .set(updates)
        .where(eq(studies.id, study.id));
    }

  } catch (error) {
    console.error(`Error enriching study ${study.id}:`, error);
    throw error;
  }
}

/**
 * Generate keywords for a study using AI
 */
async function generateKeywords(study: any): Promise<string[] | null> {
  try {
    const prompt = `Based on this hydrogen research study, generate 5-8 relevant keywords that would help people find this research. Focus on medical conditions, treatment methods, and key findings.

Study Title: ${study.title}
Abstract: ${study.abstract || 'No abstract available'}
Category: ${study.category || 'Not specified'}

Return only a JSON array of keywords, like: ["keyword1", "keyword2", "keyword3"]`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      max_tokens: 200
    });

    const result = JSON.parse(response.choices[0].message.content || '{}');
    return result.keywords || null;
  } catch (error) {
    console.error('Error generating keywords:', error);
    return null;
  }
}

/**
 * Generate health conditions for a study
 */
async function generateHealthConditions(study: any): Promise<string | null> {
  try {
    const prompt = `Based on this hydrogen research study, identify the main health condition(s) being studied. Be specific and use medical terminology.

Study Title: ${study.title}
Abstract: ${study.abstract || 'No abstract available'}

Return only the health condition name(s), separated by commas if multiple. Examples: "Cardiovascular disease", "Type 2 diabetes", "Exercise-induced oxidative stress"`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 100
    });

    return response.choices[0].message.content?.trim() || null;
  } catch (error) {
    console.error('Error generating health conditions:', error);
    return null;
  }
}

/**
 * Generate body systems for a study
 */
async function generateBodySystems(study: any): Promise<string | null> {
  try {
    const prompt = `Based on this hydrogen research study, identify which body system(s) are being studied. Choose from: Cardiovascular, Respiratory, Nervous, Digestive, Musculoskeletal, Immune, Endocrine, Reproductive, Urinary, Integumentary.

Study Title: ${study.title}
Abstract: ${study.abstract || 'No abstract available'}

Return only the body system name(s), separated by commas if multiple.`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 50
    });

    return response.choices[0].message.content?.trim() || null;
  } catch (error) {
    console.error('Error generating body systems:', error);
    return null;
  }
}

/**
 * Generate consumer-friendly categories
 */
async function generateConsumerCategories(study: any): Promise<string | null> {
  try {
    const prompt = `Based on this hydrogen research study, choose the most appropriate consumer-friendly category from: Sports & Fitness, Heart Health, Brain Health, Skin Health, Anti-Aging, Energy & Metabolism, Pain Relief, General Wellness.

Study Title: ${study.title}
Abstract: ${study.abstract || 'No abstract available'}

Return only one category name that best fits this research.`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 20
    });

    return response.choices[0].message.content?.trim() || null;
  } catch (error) {
    console.error('Error generating consumer categories:', error);
    return null;
  }
}