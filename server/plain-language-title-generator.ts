/**
 * Plain Language Title Generator
 * 
 * Generates SEO-optimized consumer-friendly titles for hydrogen research studies
 */

import { db } from "./db";
import { sql } from "drizzle-orm";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface TitleGenerationResult {
  studyId: number;
  originalTitle: string;
  plainLanguageTitle: string;
  success: boolean;
  error?: string;
}

interface TitleGenerationStats {
  totalProcessed: number;
  successful: number;
  failed: number;
  startTime: Date;
  endTime?: Date;
  results: TitleGenerationResult[];
}

let currentStats: TitleGenerationStats = {
  totalProcessed: 0,
  successful: 0,
  failed: 0,
  startTime: new Date(),
  results: []
};

/**
 * Generate a consumer-friendly title for a single study
 */
async function generateConsumerTitle(study: any): Promise<string> {
  try {
    const prompt = `Create a plain language, SEO-optimized title for this hydrogen research study. 

Guidelines:
- 40-70 characters for optimal SEO
- 6th grade reading level
- Focus on health benefit/outcome
- Include "hydrogen" when relevant
- Structure: [Health Benefit] + [Method/Context] + "Study"
- Make it compelling and clickable
- No jargon or abbreviations

Study Details:
Title: ${study.title}
Abstract: ${study.abstract?.substring(0, 400)}...
Category: ${study.category}
Health Conditions: ${study.health_conditions || 'General health'}

Examples:
- "Hydrogen Water Reduces Heart Disease Risk - Clinical Trial"
- "Drinking Hydrogen Water Improves Athletic Recovery"
- "Hydrogen Gas Therapy Helps Brain Injury Recovery"

Return only the plain language title:`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 100,
      temperature: 0.3,
    });

    const title = response.choices[0].message.content?.trim();
    
    if (!title) {
      throw new Error("No title generated");
    }

    // Ensure title is within SEO limits
    if (title.length > 70) {
      return title.substring(0, 67) + "...";
    }

    return title;

  } catch (error) {
    console.error("Error generating title:", error);
    
    // Create fallback title based on category and health conditions
    const category = study.category || "Health";
    const condition = study.health_conditions?.split(',')[0]?.trim() || category;
    return `Hydrogen Study on ${condition} - Research Findings`;
  }
}

/**
 * Process a single study to generate plain language title
 */
async function processStudyTitle(study: any): Promise<TitleGenerationResult> {
  try {
    const plainLanguageTitle = await generateConsumerTitle(study);

    // Update the database
    await db.execute(sql`
      UPDATE studies 
      SET plain_language_title = ${plainLanguageTitle}
      WHERE id = ${study.id}
    `);

    console.log(`✓ Study ${study.id}: "${plainLanguageTitle}"`);

    return {
      studyId: study.id,
      originalTitle: study.title,
      plainLanguageTitle,
      success: true
    };

  } catch (error) {
    console.error(`✗ Study ${study.id}: ${error}`);
    return {
      studyId: study.id,
      originalTitle: study.title,
      plainLanguageTitle: "",
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    };
  }
}

/**
 * Generate plain language titles for all studies in batches
 */
export async function generateAllPlainLanguageTitles(): Promise<TitleGenerationStats> {
  console.log("🎯 Starting plain language title generation for all studies...");

  // Reset stats
  currentStats = {
    totalProcessed: 0,
    successful: 0,
    failed: 0,
    startTime: new Date(),
    results: []
  };

  try {
    // Get all studies without plain language titles
    const studiesResult = await db.execute(sql`
      SELECT id, title, abstract, category, health_conditions, body_systems
      FROM studies 
      WHERE plain_language_title IS NULL 
      OR plain_language_title = ''
      ORDER BY id
    `);

    const studies = studiesResult.rows;
    console.log(`📚 Found ${studies.length} studies needing plain language titles`);

    if (studies.length === 0) {
      console.log("✅ All studies already have plain language titles!");
      return currentStats;
    }

    // Process in batches of 5 to respect API rate limits
    const batchSize = 5;
    const totalBatches = Math.ceil(studies.length / batchSize);

    for (let i = 0; i < studies.length; i += batchSize) {
      const batchNumber = Math.floor(i / batchSize) + 1;
      const batch = studies.slice(i, i + batchSize);
      
      console.log(`📦 Processing batch ${batchNumber}/${totalBatches}: ${batch.length} studies`);

      // Process batch concurrently
      const batchPromises = batch.map(study => processStudyTitle(study));
      const batchResults = await Promise.all(batchPromises);
      
      // Update stats
      batchResults.forEach(result => {
        currentStats.results.push(result);
        currentStats.totalProcessed++;
        if (result.success) {
          currentStats.successful++;
        } else {
          currentStats.failed++;
        }
      });

      console.log(`✓ Batch ${batchNumber} completed: ${batchResults.filter(r => r.success).length}/${batchResults.length} successful`);

      // Rate limiting: wait between batches
      if (i + batchSize < studies.length) {
        console.log("⏳ Waiting 2 seconds before next batch...");
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    currentStats.endTime = new Date();
    const duration = Math.round((currentStats.endTime.getTime() - currentStats.startTime.getTime()) / 1000);

    console.log("\n🎉 Plain language title generation completed!");
    console.log(`📊 Results:`);
    console.log(`   - Total processed: ${currentStats.totalProcessed}`);
    console.log(`   - Successful: ${currentStats.successful}`);
    console.log(`   - Failed: ${currentStats.failed}`);
    console.log(`   - Duration: ${duration} seconds`);
    console.log(`   - Success rate: ${Math.round((currentStats.successful / currentStats.totalProcessed) * 100)}%`);

    return currentStats;

  } catch (error) {
    console.error("❌ Error in title generation process:", error);
    currentStats.endTime = new Date();
    throw error;
  }
}

/**
 * Get current generation statistics
 */
export function getTitleGenerationStats(): TitleGenerationStats {
  return currentStats;
}

/**
 * Get statistics on plain language title coverage
 */
export async function getPlainLanguageTitleStats() {
  const result = await db.execute(sql`
    SELECT 
      COUNT(*) as total_studies,
      COUNT(CASE WHEN plain_language_title IS NOT NULL AND plain_language_title != '' THEN 1 END) as with_plain_titles,
      COUNT(CASE WHEN plain_language_title IS NULL OR plain_language_title = '' THEN 1 END) as without_plain_titles
    FROM studies
  `);

  const stats = result.rows[0];
  const completionPercentage = Math.round((Number(stats.with_plain_titles) / Number(stats.total_studies)) * 100);

  return {
    totalStudies: Number(stats.total_studies),
    withPlainTitles: Number(stats.with_plain_titles),
    withoutPlainTitles: Number(stats.without_plain_titles),
    completionPercentage
  };
}

/**
 * Generate titles for a specific batch of studies
 */
export async function generateTitlesForBatch(startId: number, endId: number): Promise<TitleGenerationResult[]> {
  const studiesResult = await db.execute(sql`
    SELECT id, title, abstract, category, health_conditions, body_systems
    FROM studies 
    WHERE id BETWEEN ${startId} AND ${endId}
    AND (plain_language_title IS NULL OR plain_language_title = '')
    ORDER BY id
  `);

  const studies = studiesResult.rows;
  console.log(`Processing batch: studies ${startId}-${endId} (${studies.length} studies)`);

  const results = await Promise.all(
    studies.map(study => processStudyTitle(study))
  );

  return results;
}