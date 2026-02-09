/**
 * Targeted Studies Enrichment System
 *
 * Focuses on enriching critical missing fields:
 * - Keywords/tags for search and categorization
 * - Health conditions for navigation
 * - Body systems for browsing structure
 * - Conclusions for study summaries
 */

import { db } from "../db";
import { studies } from "@shared/schema";
import { sql, isNull, or, eq, and } from "drizzle-orm";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export interface EnrichmentStats {
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
  isRunning: false,
};

/**
 * Start targeted enrichment of critical missing fields
 * Can be called manually or by the scheduler
 */
export async function startTargetedEnrichment(
  batchSize: number = 10,
): Promise<EnrichmentStats> {
  if (enrichmentStats.isRunning) {
    console.log("⚠️ Enrichment is already running, skipping this cycle.");
    return enrichmentStats;
  }

  console.log("🚀 Starting targeted enrichment process...");
  enrichmentStats.isRunning = true;
  enrichmentStats.startTime = new Date();
  enrichmentStats.totalProcessed = 0;
  enrichmentStats.keywordsAdded = 0;
  enrichmentStats.healthConditionsAdded = 0;
  enrichmentStats.bodySystemsAdded = 0;
  enrichmentStats.conclusionsAdded = 0;
  enrichmentStats.errors = 0;

  // Run enrichment (not in background, so we can await it if needed for scheduler)
  try {
     await processEnrichmentBatches(batchSize);
  } catch(error) {
     console.error("Enrichment process failed:", error);
  } finally {
     enrichmentStats.isRunning = false;
  }

  return enrichmentStats;
}

/**
 * Scheduler-friendly alias
 */
export async function checkAndEnrichStudies() {
    return startTargetedEnrichment(5); // Process small batches periodically
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
    // Using Drizzle ORM
    const studiesNeedingEnrichment = await db
      .select({
          id: studies.id,
          title: studies.title,
          abstract: studies.abstract,
          methods: studies.methods,
          results: studies.results
      })
      .from(studies)
      .where(
        or(
            isNull(studies.keywords),
            sql`array_length(${studies.keywords}, 1) = 0`,
            isNull(studies.healthConditions),
            eq(studies.healthConditions, ''),
            isNull(studies.bodySystems),
            eq(studies.bodySystems, ''),
            isNull(studies.conclusion),
            eq(studies.conclusion, '')
        )
      )
      .limit(50); // Hard limit to avoid long running processes

    console.log(
      `Found ${studiesNeedingEnrichment.length} studies needing enrichment`,
    );

    if (studiesNeedingEnrichment.length === 0) {
        return;
    }

    // Process in batches
    for (let i = 0; i < studiesNeedingEnrichment.length; i += batchSize) {
      const batch = studiesNeedingEnrichment.slice(i, i + batchSize);
      await processBatch(batch);

      // Small delay between batches to avoid overwhelming the API
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    console.log("Targeted enrichment completed successfully");
  } catch (error) {
    console.error("Error in enrichment process:", error);
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
    Methods: ${study.methods || "Not provided"}
    Results: ${study.results || "Not provided"}
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
          content:
            "You are a medical research expert specializing in hydrogen therapy studies. Provide accurate, scientific analysis in the requested JSON format.",
        },
        {
          role: "user",
          content: enrichmentPrompt,
        },
      ],
      response_format: { type: "json_object" },
      max_tokens: 1000,
      temperature: 0.3,
    });

    const enrichmentData = JSON.parse(
      response.choices[0].message.content || "{}",
    );

    // Update the study with enriched data
    await updateStudyWithEnrichment(study.id, enrichmentData);

    // Update stats
    if (enrichmentData.keywords?.length > 0) enrichmentStats.keywordsAdded++;
    if (enrichmentData.health_conditions)
      enrichmentStats.healthConditionsAdded++;
    if (enrichmentData.body_systems) enrichmentStats.bodySystemsAdded++;
    if (enrichmentData.conclusion) enrichmentStats.conclusionsAdded++;

    console.log(
      `Enriched study ${study.id}: ${study.title ? study.title.substring(0, 50) : "Untitled"}...`,
    );
  } catch (error) {
    console.error(
      `Failed to generate enrichment for study ${study.id}:`,
      error,
    );
    throw error;
  }
}

/**
 * Update study with enrichment data
 */
async function updateStudyWithEnrichment(
  studyId: number,
  enrichmentData: any,
): Promise<void> {

  // Prepare update object using Drizzle
  const updates: any = {};
  
  if (enrichmentData.keywords && Array.isArray(enrichmentData.keywords)) {
      updates.keywords = enrichmentData.keywords;
  }
  
  if (enrichmentData.health_conditions) {
      updates.healthConditions = enrichmentData.health_conditions;
  }
  
  if (enrichmentData.body_systems) {
      updates.bodySystems = enrichmentData.body_systems;
  }
  
  if (enrichmentData.conclusion) {
      updates.conclusion = enrichmentData.conclusion;
  }

  // Only update if we have data
  if (Object.keys(updates).length > 0) {
      await db
        .update(studies)
        .set(updates)
        .where(eq(studies.id, studyId));
  }
}

/**
 * Get enrichment progress summary
 */
export async function getEnrichmentSummary(): Promise<any> {
  const result = await db.select({
      total: sql<number>`count(*)`,
      withKeywords: sql<number>`count(case when ${studies.keywords} is not null and array_length(${studies.keywords}, 1) > 0 then 1 end)`,
      withHealthConditions: sql<number>`count(case when ${studies.healthConditions} is not null and ${studies.healthConditions} != '' then 1 end)`,
      withBodySystems: sql<number>`count(case when ${studies.bodySystems} is not null and ${studies.bodySystems} != '' then 1 end)`,
      withConclusion: sql<number>`count(case when ${studies.conclusion} is not null and ${studies.conclusion} != '' then 1 end)`
  }).from(studies);
  
  return {
      total_studies: result[0].total,
      with_keywords: result[0].withKeywords,
      with_health_conditions: result[0].withHealthConditions,
      with_body_systems: result[0].withBodySystems,
      with_conclusions: result[0].withConclusion
  };
}

