/**
 * Rapid Phase 2 Completion System
 * 
 * Multiple speed optimizations to complete consumer content generation in under 2 hours
 */

import { db } from "./db";
import { sql } from "drizzle-orm";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface RapidStats {
  startTime: Date;
  totalProcessed: number;
  studiesPerMinute: number;
  estimatedMinutesRemaining: number;
  isRunning: boolean;
}

let stats: RapidStats = {
  startTime: new Date(),
  totalProcessed: 0,
  studiesPerMinute: 0,
  estimatedMinutesRemaining: 0,
  isRunning: false
};

/**
 * Bulk generation for 15 studies at once
 */
async function rapidBulkGeneration(studies: any[]): Promise<void> {
  const studyList = studies.map((study, i) => {
    const missing = [];
    if (!study.methods_short?.trim()) missing.push('methods');
    if (!study.results_short?.trim()) missing.push('results');
    if (!study.conclusion_short?.trim()) missing.push('conclusion');
    
    return `${i+1}. ${study.title} (Category: ${study.category || 'General'}) - Generate: ${missing.join(', ')}`;
  }).join('\n');

  const prompt = `Create simple explanations for these hydrogen studies. Return JSON array with id (1-${studies.length}), methods, results, conclusion fields.

${studyList}

Format: [{"id":1,"methods":"Study method in simple terms","results":"What they found","conclusion":"What this means for people"}]`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 1500,
      temperature: 0.2,
      response_format: { type: "json_object" }
    });

    const generated = JSON.parse(response.choices[0].message.content || '{}');
    const results = generated.studies || generated.results || Object.values(generated);

    // Parallel database updates
    const updatePromises = studies.map(async (study, index) => {
      const content = Array.isArray(results) ? results[index] : results[index + 1];
      if (!content) return;

      const updates = [];
      const values = [];

      if (content.methods && (!study.methods_short?.trim())) {
        updates.push('methods_short = ?');
        values.push(content.methods);
      }
      if (content.results && (!study.results_short?.trim())) {
        updates.push('results_short = ?');
        values.push(content.results);
      }
      if (content.conclusion && (!study.conclusion_short?.trim())) {
        updates.push('conclusion_short = ?');
        values.push(content.conclusion);
      }

      if (updates.length > 0) {
        values.push(study.id);
        await db.execute(sql.raw(`UPDATE studies SET ${updates.join(', ')} WHERE id = ?`, values));
      }
    });

    await Promise.all(updatePromises);
    stats.totalProcessed += studies.length;

  } catch (error) {
    console.error('Rapid bulk generation error:', error);
  }
}

/**
 * Rapid completion with optimized processing
 */
export async function runRapidCompletion(): Promise<RapidStats> {
  if (stats.isRunning) return stats;

  stats.isRunning = true;
  stats.startTime = new Date();
  console.log('Starting rapid Phase 2 completion...');

  try {
    let batchCount = 0;
    
    while (true) {
      const studiesResult = await db.execute(sql`
        SELECT id, title, category, methods_short, results_short, conclusion_short
        FROM studies 
        WHERE (methods_short IS NULL OR methods_short = '')
           OR (results_short IS NULL OR results_short = '')
           OR (conclusion_short IS NULL OR conclusion_short = '')
        ORDER BY 
          CASE WHEN conclusion_short IS NULL OR conclusion_short = '' THEN 0 ELSE 1 END,
          id
        LIMIT 15
      `);

      const studies = studiesResult.rows;
      if (studies.length === 0) {
        console.log('Rapid completion finished!');
        break;
      }

      batchCount++;
      console.log(`Rapid batch ${batchCount}: processing ${studies.length} studies`);

      await rapidBulkGeneration(studies);

      // Calculate performance metrics
      const elapsed = (new Date().getTime() - stats.startTime.getTime()) / 60000;
      stats.studiesPerMinute = stats.totalProcessed / elapsed;
      
      const remainingResult = await db.execute(sql`
        SELECT COUNT(*) as count FROM studies 
        WHERE (methods_short IS NULL OR methods_short = '')
           OR (results_short IS NULL OR results_short = '')
           OR (conclusion_short IS NULL OR conclusion_short = '')
      `);
      
      const remaining = Number(remainingResult.rows[0]?.count) || 0;
      stats.estimatedMinutesRemaining = remaining / stats.studiesPerMinute;

      console.log(`Progress: ${stats.totalProcessed} completed, ${stats.studiesPerMinute.toFixed(1)}/min, ${stats.estimatedMinutesRemaining.toFixed(1)} minutes remaining`);

      // Short delay for API rate limits
      await new Promise(resolve => setTimeout(resolve, 300));
    }

  } catch (error) {
    console.error('Rapid completion error:', error);
  } finally {
    stats.isRunning = false;
  }

  return stats;
}

export function getRapidStats(): RapidStats {
  return stats;
}