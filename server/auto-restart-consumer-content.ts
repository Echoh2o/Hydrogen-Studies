/**
 * Auto-Restart Consumer Content Generation System
 * 
 * Automatically starts and monitors Phase 2 consumer content generation
 * with performance optimizations and restart capabilities
 */

import { db } from "./db";
import { sql } from "drizzle-orm";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface AutoRestartStats {
  isRunning: boolean;
  totalProcessed: number;
  methodsGenerated: number;
  resultsGenerated: number;
  conclusionsGenerated: number;
  startTime: Date;
  lastActivity: Date;
  batchSize: number;
  processedBatches: number;
  estimatedTimeRemaining?: string;
}

let globalStats: AutoRestartStats = {
  isRunning: false,
  totalProcessed: 0,
  methodsGenerated: 0,
  resultsGenerated: 0,
  conclusionsGenerated: 0,
  startTime: new Date(),
  lastActivity: new Date(),
  batchSize: 5,
  processedBatches: 0
};

/**
 * Optimized content generation with batch processing
 */
async function generateContentBatch(studies: any[]): Promise<void> {
  const promises = studies.map(async (study) => {
    try {
      const needsMethods = !study.methods_short || study.methods_short.trim() === '';
      const needsResults = !study.results_short || study.results_short.trim() === '';
      const needsConclusion = !study.conclusion_short || study.conclusion_short.trim() === '';

      if (!needsMethods && !needsResults && !needsConclusion) {
        return;
      }

      // Optimized prompt with minimal token usage
      const fieldsNeeded = [];
      if (needsMethods) fieldsNeeded.push('methods');
      if (needsResults) fieldsNeeded.push('results');
      if (needsConclusion) fieldsNeeded.push('conclusion');

      const prompt = `Generate simple explanations (2 sentences each) for hydrogen study. Return JSON with fields: ${fieldsNeeded.join(', ')}.

Title: ${study.title}
Abstract: ${study.abstract?.substring(0, 200) || 'No abstract'}

Format: {"methods":"How study was done","results":"What was found","conclusion":"What it means"}`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini", // Faster, cheaper model
        messages: [{ role: "user", content: prompt }],
        max_tokens: 200, // Reduced tokens for speed
        temperature: 0.1,
        response_format: { type: "json_object" }
      });

      const content = response.choices[0].message.content;
      if (!content) return;
      
      const generated = JSON.parse(content);

      // Parallel database updates
      const updatePromises = [];

      if (generated.methods && needsMethods) {
        updatePromises.push(
          db.execute(sql`UPDATE studies SET methods_short = ${generated.methods} WHERE id = ${study.id}`)
        );
        globalStats.methodsGenerated++;
      }

      if (generated.results && needsResults) {
        updatePromises.push(
          db.execute(sql`UPDATE studies SET results_short = ${generated.results} WHERE id = ${study.id}`)
        );
        globalStats.resultsGenerated++;
      }

      if (generated.conclusion && needsConclusion) {
        updatePromises.push(
          db.execute(sql`UPDATE studies SET conclusion_short = ${generated.conclusion} WHERE id = ${study.id}`)
        );
        globalStats.conclusionsGenerated++;
      }

      await Promise.all(updatePromises);
      globalStats.totalProcessed++;
      globalStats.lastActivity = new Date();

    } catch (error) {
      console.error(`Error processing study ${study.id}:`, error);
      globalStats.totalProcessed++;
    }
  });

  await Promise.all(promises);
}

/**
 * Main auto-restart consumer content generation
 */
async function runAutoRestartGeneration(): Promise<void> {
  if (globalStats.isRunning) {
    console.log("⚠️ Consumer content generation already running");
    return;
  }

  globalStats.isRunning = true;
  globalStats.startTime = new Date();
  globalStats.lastActivity = new Date();
  
  console.log("🚀 Starting auto-restart consumer content generation...");

  try {
    while (true) {
      // Get next batch of studies needing consumer content
      const studiesResult = await db.execute(sql`
        SELECT id, title, abstract, methods_short, results_short, conclusion_short
        FROM studies 
        WHERE (methods_short IS NULL OR methods_short = '')
           OR (results_short IS NULL OR results_short = '')
           OR (conclusion_short IS NULL OR conclusion_short = '')
        ORDER BY 
          CASE WHEN conclusion_short IS NULL OR conclusion_short = '' THEN 0 ELSE 1 END,
          id
        LIMIT ${globalStats.batchSize}
      `);

      const studies = studiesResult.rows;

      if (studies.length === 0) {
        console.log("✅ All consumer content completed!");
        break;
      }

      console.log(`📦 Processing batch ${globalStats.processedBatches + 1}: ${studies.length} studies`);

      await generateContentBatch(studies);

      globalStats.processedBatches++;

      // Calculate estimated time remaining
      const elapsed = (new Date().getTime() - globalStats.startTime.getTime()) / 1000;
      const avgTimePerBatch = elapsed / globalStats.processedBatches;
      const remainingStudiesResult = await db.execute(sql`
        SELECT COUNT(*) as count FROM studies 
        WHERE (methods_short IS NULL OR methods_short = '')
           OR (results_short IS NULL OR results_short = '')
           OR (conclusion_short IS NULL OR conclusion_short = '')
      `);
      const remainingStudies = remainingStudiesResult.rows[0]?.count || 0;
      const remainingBatches = Math.ceil(remainingStudies / globalStats.batchSize);
      const estimatedSeconds = remainingBatches * avgTimePerBatch;
      globalStats.estimatedTimeRemaining = `${Math.round(estimatedSeconds / 60)} minutes`;

      console.log(`✓ Batch completed. Progress: ${globalStats.totalProcessed} processed, ~${globalStats.estimatedTimeRemaining} remaining`);

      // Shorter delay for faster processing
      await new Promise(resolve => setTimeout(resolve, 500));
    }

  } catch (error) {
    console.error("❌ Error in auto-restart generation:", error);
  } finally {
    globalStats.isRunning = false;
  }
}

/**
 * Auto-start consumer content generation on import
 */
export async function autoStartConsumerContent(): Promise<void> {
  // Check if consumer content is needed
  const needsContentResult = await db.execute(sql`
    SELECT COUNT(*) as count FROM studies 
    WHERE (methods_short IS NULL OR methods_short = '')
       OR (results_short IS NULL OR results_short = '')
       OR (conclusion_short IS NULL OR conclusion_short = '')
  `);

  const needsContent = needsContentResult.rows[0]?.count || 0;

  if (needsContent > 0 && !globalStats.isRunning) {
    console.log(`🔍 Found ${needsContent} studies needing consumer content`);
    console.log("🚀 Auto-starting Phase 2 consumer content generation...");
    
    // Start in background
    setTimeout(() => {
      runAutoRestartGeneration().catch(console.error);
    }, 2000);
  }
}

/**
 * Get current auto-restart stats
 */
export function getAutoRestartStats(): AutoRestartStats {
  return globalStats;
}

/**
 * Manual restart function
 */
export async function manualRestartConsumerContent(): Promise<AutoRestartStats> {
  if (globalStats.isRunning) {
    console.log("⚠️ Consumer content generation already running");
    return globalStats;
  }

  console.log("🔄 Manual restart of consumer content generation...");
  await runAutoRestartGeneration();
  return globalStats;
}