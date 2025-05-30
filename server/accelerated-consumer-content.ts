/**
 * Accelerated Consumer Content Generation
 * 
 * Optimized for speed with larger batches and parallel processing
 */

import { db } from "./db";
import { sql, eq } from "drizzle-orm";
import { studies } from "../shared/schema";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface AcceleratedStats {
  totalProcessed: number;
  successful: number;
  failed: number;
  methodsGenerated: number;
  resultsGenerated: number;
  conclusionsGenerated: number;
  startTime: Date;
  endTime?: Date;
}

let currentStats: AcceleratedStats = {
  totalProcessed: 0,
  successful: 0,
  failed: 0,
  methodsGenerated: 0,
  resultsGenerated: 0,
  conclusionsGenerated: 0,
  startTime: new Date()
};

/**
 * Fast consumer content generation for multiple fields at once
 */
async function generateAllFieldsFast(study: any): Promise<{ methods?: string; results?: string; conclusion?: string }> {
  const prompt = `Generate consumer-friendly explanations for this hydrogen study. Use 6th grade reading level, 2-3 sentences each.

Study: ${study.title}
Category: ${study.category}
Abstract: ${study.abstract?.substring(0, 400) || 'No abstract available'}

Generate JSON with these fields (only include fields that are missing):
${!study.methods_short || study.methods_short.trim() === '' ? '- "methods": Simple explanation of how the study was conducted' : ''}
${!study.results_short || study.results_short.trim() === '' ? '- "results": Simple explanation of what the study found' : ''}
${!study.conclusion_short || study.conclusion_short.trim() === '' ? '- "conclusion": Simple explanation of what this means for people' : ''}

Example JSON:
{
  "methods": "Researchers gave 30 adults hydrogen water to drink for 8 weeks while 30 others drank regular water.",
  "results": "People who drank hydrogen water had less inflammation and felt more energetic.",
  "conclusion": "This study suggests hydrogen water may help reduce inflammation, but more research is needed."
}`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 300,
      temperature: 0.3,
      response_format: { type: "json_object" }
    });

    const content = response.choices[0].message.content;
    if (!content) return {};
    
    return JSON.parse(content);
  } catch (error) {
    console.error(`Error generating content for study ${study.id}:`, error);
    return {};
  }
}

/**
 * Process multiple studies in parallel
 */
async function processBatchParallel(studies: any[]): Promise<void> {
  const promises = studies.map(async (study) => {
    try {
      const generated = await generateAllFieldsFast(study);
      
      if (Object.keys(generated).length === 0) {
        currentStats.failed++;
        return;
      }

      // Build update query
      const updates: string[] = [];
      const values: any[] = [study.id];
      let paramIndex = 2;

      if (generated.methods && (!study.methods_short || study.methods_short.trim() === '')) {
        updates.push(`methods_short = $${paramIndex}`);
        values.push(generated.methods);
        paramIndex++;
        currentStats.methodsGenerated++;
      }

      if (generated.results && (!study.results_short || study.results_short.trim() === '')) {
        updates.push(`results_short = $${paramIndex}`);
        values.push(generated.results);
        paramIndex++;
        currentStats.resultsGenerated++;
      }

      if (generated.conclusion && (!study.conclusion_short || study.conclusion_short.trim() === '')) {
        updates.push(`conclusion_short = $${paramIndex}`);
        values.push(generated.conclusion);
        paramIndex++;
        currentStats.conclusionsGenerated++;
      }

      if (updates.length > 0) {
        const updateData: any = {};
        let index = 1;
        
        if (generated.methods && (!study.methods_short || study.methods_short.trim() === '')) {
          updateData.methodsShort = generated.methods;
        }
        
        if (generated.results && (!study.results_short || study.results_short.trim() === '')) {
          updateData.resultsShort = generated.results;
        }
        
        if (generated.conclusion && (!study.conclusion_short || study.conclusion_short.trim() === '')) {
          updateData.conclusionShort = generated.conclusion;
        }

        await db.update(studies).set(updateData).where(eq(studies.id, study.id));
        console.log(`✓ Study ${study.id}: Generated ${Object.keys(updateData).length} fields`);
      }

      currentStats.successful++;
      currentStats.totalProcessed++;

    } catch (error) {
      console.error(`✗ Study ${study.id}:`, error);
      currentStats.failed++;
      currentStats.totalProcessed++;
    }
  });

  await Promise.all(promises);
}

/**
 * Accelerated consumer content generation
 */
export async function generateConsumerContentFast(): Promise<AcceleratedStats> {
  console.log("🚀 Starting accelerated consumer content generation...");

  currentStats = {
    totalProcessed: 0,
    successful: 0,
    failed: 0,
    methodsGenerated: 0,
    resultsGenerated: 0,
    conclusionsGenerated: 0,
    startTime: new Date()
  };

  try {
    // Get studies needing consumer content - prioritize conclusions
    const studiesResult = await db.execute(sql`
      SELECT id, title, category, abstract, methods_short, results_short, conclusion_short
      FROM studies 
      WHERE (methods_short IS NULL OR methods_short = '')
         OR (results_short IS NULL OR results_short = '')
         OR (conclusion_short IS NULL OR conclusion_short = '')
      ORDER BY 
        CASE WHEN conclusion_short IS NULL OR conclusion_short = '' THEN 0 ELSE 1 END,
        id
      LIMIT 200
    `);

    const studies = studiesResult.rows;
    console.log(`📚 Found ${studies.length} studies needing consumer content`);

    if (studies.length === 0) {
      console.log("✅ All studies have consumer content!");
      return currentStats;
    }

    // Process in larger batches with parallel execution
    const batchSize = 10;
    const totalBatches = Math.ceil(studies.length / batchSize);

    for (let i = 0; i < studies.length; i += batchSize) {
      const batchNumber = Math.floor(i / batchSize) + 1;
      const batch = studies.slice(i, i + batchSize);
      
      console.log(`📦 Processing batch ${batchNumber}/${totalBatches}: ${batch.length} studies`);

      await processBatchParallel(batch);

      console.log(`✓ Batch ${batchNumber} completed: ${currentStats.successful}/${currentStats.totalProcessed} successful`);

      // Shorter delay between batches for speed
      if (i + batchSize < studies.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    currentStats.endTime = new Date();
    const duration = Math.round((currentStats.endTime.getTime() - currentStats.startTime.getTime()) / 1000);

    console.log("\n🎉 Accelerated consumer content generation completed!");
    console.log(`📊 Results:`);
    console.log(`   - Total processed: ${currentStats.totalProcessed}`);
    console.log(`   - Successful: ${currentStats.successful}`);
    console.log(`   - Failed: ${currentStats.failed}`);
    console.log(`   - Methods generated: ${currentStats.methodsGenerated}`);
    console.log(`   - Results generated: ${currentStats.resultsGenerated}`);
    console.log(`   - Conclusions generated: ${currentStats.conclusionsGenerated}`);
    console.log(`   - Duration: ${duration} seconds`);

    return currentStats;

  } catch (error) {
    console.error("❌ Error in accelerated consumer content generation:", error);
    currentStats.endTime = new Date();
    throw error;
  }
}

/**
 * Get current accelerated stats
 */
export function getAcceleratedConsumerStats(): AcceleratedStats {
  return currentStats;
}