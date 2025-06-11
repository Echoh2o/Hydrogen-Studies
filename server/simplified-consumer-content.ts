/**
 * Simplified Consumer Content Generation
 * 
 * Direct approach to complete Phase 2 faster without SQL parameter issues
 */

import { db } from "./db";
import { sql } from "drizzle-orm";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface SimplifiedStats {
  totalProcessed: number;
  methodsGenerated: number;
  resultsGenerated: number;
  conclusionsGenerated: number;
  startTime: Date;
  endTime?: Date;
}

let stats: SimplifiedStats = {
  totalProcessed: 0,
  methodsGenerated: 0,
  resultsGenerated: 0,
  conclusionsGenerated: 0,
  startTime: new Date()
};

/**
 * Generate consumer content for a single study
 */
async function generateSingleStudyContent(study: any): Promise<void> {
  try {
    // Check what's missing
    const needsMethods = !study.methods_short || study.methods_short.trim() === '';
    const needsResults = !study.results_short || study.results_short.trim() === '';
    const needsConclusion = !study.conclusion_short || study.conclusion_short.trim() === '';

    if (!needsMethods && !needsResults && !needsConclusion) {
      return; // Nothing to generate
    }

    // Create prompt for missing content
    let prompt = `
    Create a comprehensive consumer-friendly summary for this hydrogen therapy research study.

    Study Title: ${study.title}
    Abstract: ${study.abstract}
    Authors: ${study.authors}
    Journal: ${study.journal}
    Category: ${study.category || 'General Health'}

    Please provide a structured response with:

    ## What This Study Found
    A clear, jargon-free summary in 2-3 sentences explaining the main discovery.

    ## Key Results
    • 3-4 bullet points of the most important findings
    • Use percentages, numbers, or comparisons when available
    • Explain complex terms in parentheses

    ## What This Means for You
    • Practical implications for everyday health
    • Who might benefit most from these findings
    • How this relates to current hydrogen therapy practices

    ## Study Context
    • Type of study (human trial, animal study, lab research)
    • Number of participants (if applicable)
    • Study duration and methodology in simple terms

    ## Important Notes
    • Any limitations or caveats
    • Whether more research is needed
    • Safety considerations if relevant

    Keep language at an 8th-grade reading level while maintaining scientific accuracy. Use active voice and avoid medical jargon.
    `;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 300,
      temperature: 0.3,
      response_format: { type: "json_object" }
    });

    const content = response.choices[0].message.content;
    if (!content) return;

    const generated = JSON.parse(content);

    // Update database with individual queries to avoid parameter issues
    if (generated.methods && needsMethods) {
      await db.execute(sql`
        UPDATE studies 
        SET methods_short = ${generated.methods}
        WHERE id = ${study.id}
      `);
      stats.methodsGenerated++;
    }

    if (generated.results && needsResults) {
      await db.execute(sql`
        UPDATE studies 
        SET results_short = ${generated.results}
        WHERE id = ${study.id}
      `);
      stats.resultsGenerated++;
    }

    if (generated.conclusion && needsConclusion) {
      await db.execute(sql`
        UPDATE studies 
        SET conclusion_short = ${generated.conclusion}
        WHERE id = ${study.id}
      `);
      stats.conclusionsGenerated++;
    }

    console.log(`✓ Study ${study.id}: Generated content`);
    stats.totalProcessed++;

  } catch (error) {
    console.error(`✗ Study ${study.id}:`, error);
    stats.totalProcessed++;
  }
}

/**
 * Fast completion of Phase 2 consumer content
 */
export async function completePhase2Fast(): Promise<SimplifiedStats> {
  console.log("🚀 Starting Phase 2 completion...");

  stats = {
    totalProcessed: 0,
    methodsGenerated: 0,
    resultsGenerated: 0,
    conclusionsGenerated: 0,
    startTime: new Date()
  };

  try {
    // Get studies needing consumer content, prioritizing conclusions
    const studiesResult = await db.execute(sql`
      SELECT id, title, category, abstract, methods_short, results_short, conclusion_short
      FROM studies 
      WHERE (methods_short IS NULL OR methods_short = '')
         OR (results_short IS NULL OR results_short = '')
         OR (conclusion_short IS NULL OR conclusion_short = '')
      ORDER BY 
        CASE WHEN conclusion_short IS NULL OR conclusion_short = '' THEN 0 ELSE 1 END,
        id
      LIMIT 100
    `);

    const studies = studiesResult.rows;
    console.log(`📚 Found ${studies.length} studies needing consumer content`);

    if (studies.length === 0) {
      console.log("✅ Phase 2 already complete!");
      return stats;
    }

    // Process sequentially to avoid rate limits and parameter issues
    for (let i = 0; i < studies.length; i++) {
      const study = studies[i];
      console.log(`📝 Processing study ${i + 1}/${studies.length}: ${study.title?.substring(0, 50)}...`);

      await generateSingleStudyContent(study);

      // Small delay to avoid rate limits
      if (i < studies.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1500));
      }
    }

    stats.endTime = new Date();
    const duration = Math.round((stats.endTime.getTime() - stats.startTime.getTime()) / 1000);

    console.log("\n🎉 Phase 2 completion finished!");
    console.log(`📊 Results:`);
    console.log(`   - Total processed: ${stats.totalProcessed}`);
    console.log(`   - Methods generated: ${stats.methodsGenerated}`);
    console.log(`   - Results generated: ${stats.resultsGenerated}`);
    console.log(`   - Conclusions generated: ${stats.conclusionsGenerated}`);
    console.log(`   - Duration: ${duration} seconds`);

    return stats;

  } catch (error) {
    console.error("❌ Error in Phase 2 completion:", error);
    stats.endTime = new Date();
    throw error;
  }
}

/**
 * Get current stats
 */
export function getPhase2Stats(): SimplifiedStats {
  return stats;
}