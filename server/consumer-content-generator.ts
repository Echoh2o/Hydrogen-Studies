/**
 * Consumer-Friendly Content Generator
 * 
 * Creates plain language explanations of study methods, results, and conclusions
 * that are accessible to general consumers at a 6th grade reading level
 */

import { db } from "./db";
import { sql } from "drizzle-orm";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface ConsumerContentResult {
  studyId: number;
  title: string;
  success: boolean;
  fieldsGenerated: string[];
  error?: string;
}

interface ConsumerContentStats {
  totalProcessed: number;
  successful: number;
  failed: number;
  startTime: Date;
  endTime?: Date;
  methodsGenerated: number;
  resultsGenerated: number;
  conclusionsGenerated: number;
  results: ConsumerContentResult[];
}

let currentStats: ConsumerContentStats = {
  totalProcessed: 0,
  successful: 0,
  failed: 0,
  startTime: new Date(),
  methodsGenerated: 0,
  resultsGenerated: 0,
  conclusionsGenerated: 0,
  results: []
};

/**
 * Generate consumer-friendly method explanation
 */
async function generateConsumerMethods(study: any): Promise<string> {
  const prompt = `Create a simple, consumer-friendly explanation of how this hydrogen study was conducted.

Guidelines:
- Use 6th grade reading level
- Explain in 2-3 sentences
- Focus on what researchers did and who participated
- Avoid technical jargon
- Make it relatable to everyday people

Study Title: ${study.title}
Original Methods: ${study.methods?.substring(0, 500) || study.abstract?.substring(0, 300)}
Category: ${study.category}

Example output: "Researchers gave 30 adults hydrogen-rich water to drink for 8 weeks. Half the group drank regular water as a comparison. The scientists measured inflammation levels in their blood before and after."

Write a clear explanation:`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [{ role: "user", content: prompt }],
    max_tokens: 150,
    temperature: 0.3,
  });

  return response.choices[0].message.content?.trim() || "";
}

/**
 * Generate consumer-friendly results explanation
 */
async function generateConsumerResults(study: any): Promise<string> {
  const prompt = `Create a simple, consumer-friendly explanation of what this hydrogen study found.

Guidelines:
- Use 6th grade reading level
- Explain in 2-3 sentences
- Focus on the main findings that matter to consumers
- Avoid statistics and technical terms
- Make it clear and actionable

Study Title: ${study.title}
Original Results: ${study.results?.substring(0, 500) || study.abstract?.substring(0, 300)}
Category: ${study.category}

Example output: "People who drank hydrogen water had less inflammation in their bodies. Their energy levels improved and they felt less tired during the day. The benefits were noticeable after just 4 weeks."

Write a clear explanation:`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [{ role: "user", content: prompt }],
    max_tokens: 150,
    temperature: 0.3,
  });

  return response.choices[0].message.content?.trim() || "";
}

/**
 * Generate consumer-friendly conclusion
 */
async function generateConsumerConclusion(study: any): Promise<string> {
  const prompt = `Create a simple, consumer-friendly conclusion about what this hydrogen study means for everyday people.

Guidelines:
- Use 6th grade reading level
- Explain in 1-2 sentences
- Focus on practical implications
- Avoid medical advice claims
- Be balanced and accurate

Study Title: ${study.title}
Study Category: ${study.category}
Health Conditions: ${study.health_conditions || 'General health'}
Abstract: ${study.abstract?.substring(0, 400)}

Example output: "This study suggests hydrogen water may help reduce inflammation, but more research is needed to confirm these benefits for long-term health."

Write a clear conclusion:`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [{ role: "user", content: prompt }],
    max_tokens: 100,
    temperature: 0.3,
  });

  return response.choices[0].message.content?.trim() || "";
}

/**
 * Process a single study to generate consumer-friendly content
 */
async function processStudyConsumerContent(study: any): Promise<ConsumerContentResult> {
  const fieldsGenerated: string[] = [];
  
  try {
    // Check which fields need generation
    const needsMethods = !study.methods_short || study.methods_short.trim() === '';
    const needsResults = !study.results_short || study.results_short.trim() === '';
    const needsConclusion = !study.conclusion_short || study.conclusion_short.trim() === '';

    const updates: any = {};

    // Generate missing content
    if (needsMethods) {
      updates.methods_short = await generateConsumerMethods(study);
      fieldsGenerated.push('methods');
      currentStats.methodsGenerated++;
    }

    if (needsResults) {
      updates.results_short = await generateConsumerResults(study);
      fieldsGenerated.push('results');
      currentStats.resultsGenerated++;
    }

    if (needsConclusion) {
      updates.conclusion_short = await generateConsumerConclusion(study);
      fieldsGenerated.push('conclusion');
      currentStats.conclusionsGenerated++;
    }

    // Update database if any content was generated
    if (Object.keys(updates).length > 0) {
      const updateParts = [];
      const values = [study.id];
      let paramIndex = 2;

      for (const [key, value] of Object.entries(updates)) {
        updateParts.push(`${key} = $${paramIndex}`);
        values.push(value);
        paramIndex++;
      }

      const query = `UPDATE studies SET ${updateParts.join(', ')} WHERE id = $1`;
      await db.execute(sql.raw(query, values));
    }

    console.log(`✓ Study ${study.id}: Generated ${fieldsGenerated.join(', ')}`);

    return {
      studyId: study.id,
      title: study.title,
      success: true,
      fieldsGenerated
    };

  } catch (error) {
    console.error(`✗ Study ${study.id}: ${error}`);
    return {
      studyId: study.id,
      title: study.title,
      success: false,
      fieldsGenerated: [],
      error: error instanceof Error ? error.message : "Unknown error"
    };
  }
}

/**
 * Generate consumer-friendly content for all studies that need it
 */
export async function generateAllConsumerContent(): Promise<ConsumerContentStats> {
  console.log("🎯 Starting consumer-friendly content generation...");

  // Reset stats
  currentStats = {
    totalProcessed: 0,
    successful: 0,
    failed: 0,
    startTime: new Date(),
    methodsGenerated: 0,
    resultsGenerated: 0,
    conclusionsGenerated: 0,
    results: []
  };

  try {
    // Get studies that need consumer-friendly content
    const studiesResult = await db.execute(sql`
      SELECT id, title, abstract, category, methods, results, conclusion,
             methods_short, results_short, conclusion_short, health_conditions
      FROM studies 
      WHERE (methods_short IS NULL OR methods_short = '')
         OR (results_short IS NULL OR results_short = '')
         OR (conclusion_short IS NULL OR conclusion_short = '')
      ORDER BY id
      LIMIT 100
    `);

    const studies = studiesResult.rows;
    console.log(`📚 Found ${studies.length} studies needing consumer-friendly content`);

    if (studies.length === 0) {
      console.log("✅ All studies already have consumer-friendly content!");
      return currentStats;
    }

    // Process in batches of 3 to manage API rate limits
    const batchSize = 3;
    const totalBatches = Math.ceil(studies.length / batchSize);

    for (let i = 0; i < studies.length; i += batchSize) {
      const batchNumber = Math.floor(i / batchSize) + 1;
      const batch = studies.slice(i, i + batchSize);
      
      console.log(`📦 Processing batch ${batchNumber}/${totalBatches}: ${batch.length} studies`);

      // Process batch sequentially to avoid overwhelming the API
      for (const study of batch) {
        const result = await processStudyConsumerContent(study);
        
        currentStats.results.push(result);
        currentStats.totalProcessed++;
        if (result.success) {
          currentStats.successful++;
        } else {
          currentStats.failed++;
        }

        // Small delay between studies
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      console.log(`✓ Batch ${batchNumber} completed`);

      // Longer delay between batches
      if (i + batchSize < studies.length) {
        console.log("⏳ Waiting 3 seconds before next batch...");
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }

    currentStats.endTime = new Date();
    const duration = Math.round((currentStats.endTime.getTime() - currentStats.startTime.getTime()) / 1000);

    console.log("\n🎉 Consumer content generation completed!");
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
    console.error("❌ Error in consumer content generation:", error);
    currentStats.endTime = new Date();
    throw error;
  }
}

/**
 * Get current consumer content generation statistics
 */
export function getConsumerContentStats(): ConsumerContentStats {
  return currentStats;
}

/**
 * Get statistics on consumer content coverage
 */
export async function getConsumerContentCoverage() {
  const result = await db.execute(sql`
    SELECT 
      COUNT(*) as total_studies,
      COUNT(CASE WHEN methods_short IS NOT NULL AND methods_short != '' THEN 1 END) as with_methods,
      COUNT(CASE WHEN results_short IS NOT NULL AND results_short != '' THEN 1 END) as with_results,
      COUNT(CASE WHEN conclusion_short IS NOT NULL AND conclusion_short != '' THEN 1 END) as with_conclusions
    FROM studies
  `);

  const stats = result.rows[0];
  
  return {
    totalStudies: Number(stats.total_studies),
    withMethods: Number(stats.with_methods),
    withResults: Number(stats.with_results),
    withConclusions: Number(stats.with_conclusions),
    methodsPercentage: Math.round((Number(stats.with_methods) / Number(stats.total_studies)) * 100),
    resultsPercentage: Math.round((Number(stats.with_results) / Number(stats.total_studies)) * 100),
    conclusionsPercentage: Math.round((Number(stats.with_conclusions) / Number(stats.total_studies)) * 100)
  };
}