/**
 * Accelerated Content Enhancer
 * 
 * Optimized version with parallel processing, reduced delays, and batch operations
 * to significantly speed up content enhancement
 */

import { db } from './db';
import { studies } from '@shared/schema';
import { eq, isNull, or, sql } from 'drizzle-orm';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface AcceleratedStats {
  totalStudies: number;
  processed: number;
  methodsCompleted: number;
  resultsCompleted: number;
  objectivesCompleted: number;
  summariesCompleted: number;
  errors: string[];
  startTime: Date;
  batchSize: number;
}

/**
 * Accelerated content enhancement with parallel processing
 */
export async function acceleratedContentEnhancement(batchSize: number = 5): Promise<AcceleratedStats> {
  console.log('🚀 Starting ACCELERATED Content Enhancement...');
  console.log(`⚡ Using batch size: ${batchSize} for parallel processing`);
  
  const stats: AcceleratedStats = {
    totalStudies: 0,
    processed: 0,
    methodsCompleted: 0,
    resultsCompleted: 0,
    objectivesCompleted: 0,
    summariesCompleted: 0,
    errors: [],
    startTime: new Date(),
    batchSize
  };

  try {
    // Get studies that need content enhancement - prioritize missing content
    const incompleteStudies = await db.select({
      id: studies.id,
      title: studies.title,
      abstract: studies.abstract,
      authors: studies.authors,
      journal: studies.journal,
      methods: studies.methods,
      results: studies.results,
      conclusion: studies.conclusion,
      objective: studies.objective,
      summaryMarkdown: studies.summaryMarkdown,
      doi: studies.doi
    })
    .from(studies)
    .where(
      or(
        isNull(studies.methods),
        eq(studies.methods, ''),
        isNull(studies.results),
        eq(studies.results, ''),
        isNull(studies.objective),
        eq(studies.objective, ''),
        isNull(studies.summaryMarkdown),
        eq(studies.summaryMarkdown, '')
      )
    );

    stats.totalStudies = incompleteStudies.length;
    console.log(`📊 Found ${stats.totalStudies} studies needing enhancement`);

    // Process studies in parallel batches
    for (let i = 0; i < incompleteStudies.length; i += batchSize) {
      const batch = incompleteStudies.slice(i, i + batchSize);
      console.log(`\n⚡ Processing batch ${Math.floor(i/batchSize) + 1}: studies ${i + 1}-${Math.min(i + batchSize, incompleteStudies.length)}`);

      // Process batch in parallel
      const batchPromises = batch.map(study => processSingleStudyFast(study, stats));
      await Promise.all(batchPromises);

      stats.processed += batch.length;

      // Progress update every few batches
      if ((Math.floor(i/batchSize) + 1) % 3 === 0) {
        const progressPercent = Math.round((stats.processed / stats.totalStudies) * 100);
        const elapsed = Math.round((Date.now() - stats.startTime.getTime()) / 60000);
        const rate = stats.processed / Math.max(elapsed, 1);
        console.log(`📊 Progress: ${stats.processed}/${stats.totalStudies} (${progressPercent}%) - ${elapsed}min elapsed - Rate: ${rate.toFixed(1)} studies/min`);
      }

      // Minimal delay between batches (reduced from 2000ms to 200ms)
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    const totalTime = Math.round((Date.now() - stats.startTime.getTime()) / 60000);
    const finalRate = stats.processed / Math.max(totalTime, 1);
    
    console.log('\n🎉 ACCELERATED Enhancement Complete!');
    console.log(`⚡ Processing time: ${totalTime} minutes`);
    console.log(`⚡ Average rate: ${finalRate.toFixed(1)} studies per minute`);
    console.log(`📊 Final stats: ${stats.methodsCompleted} methods, ${stats.resultsCompleted} results, ${stats.objectivesCompleted} objectives`);
    
    return stats;

  } catch (error) {
    console.error('❌ Error in accelerated enhancement:', error);
    throw error;
  }
}

/**
 * Fast processing of a single study with optimized content generation
 */
async function processSingleStudyFast(study: any, stats: AcceleratedStats): Promise<void> {
  try {
    const updates: any = {};
    let hasUpdates = false;

    // Generate all missing content in parallel for maximum speed
    const contentPromises: Promise<any>[] = [];

    // Methods
    if (!study.methods || study.methods.length < 100) {
      contentPromises.push(
        generateContentFast('methods', study).then(result => {
          if (result) {
            updates.methods = result;
            stats.methodsCompleted++;
            hasUpdates = true;
          }
        })
      );
    }

    // Results  
    if (!study.results || study.results.length < 100) {
      contentPromises.push(
        generateContentFast('results', study).then(result => {
          if (result) {
            updates.results = result;
            stats.resultsCompleted++;
            hasUpdates = true;
          }
        })
      );
    }

    // Objective
    if (!study.objective) {
      contentPromises.push(
        generateContentFast('objective', study).then(result => {
          if (result) {
            updates.objective = result;
            stats.objectivesCompleted++;
            hasUpdates = true;
          }
        })
      );
    }

    // Wait for all content generation to complete
    await Promise.all(contentPromises);

    // Generate summary after other content is ready
    if (!study.summaryMarkdown || hasUpdates) {
      const summary = generateFastSummary(study, updates);
      if (summary) {
        updates.summaryMarkdown = summary;
        stats.summariesCompleted++;
        hasUpdates = true;
      }
    }

    // Update database if we have changes
    if (hasUpdates) {
      await db.update(studies)
        .set(updates)
        .where(eq(studies.id, study.id));
    }

  } catch (error) {
    const errorMsg = `Error processing study ${study.id}: ${error instanceof Error ? error.message : 'Unknown error'}`;
    stats.errors.push(errorMsg);
    console.error(`❌ ${errorMsg}`);
  }
}

/**
 * Fast content generation with reduced token limits and optimized prompts
 */
async function generateContentFast(contentType: string, study: any): Promise<string | null> {
  try {
    let systemPrompt = '';
    let userPrompt = '';
    let maxTokens = 400; // Reduced for speed

    switch (contentType) {
      case 'methods':
        systemPrompt = 'Generate concise but comprehensive methods section for hydrogen research. Focus on key experimental details.';
        userPrompt = `Methods for: ${study.title}\nAbstract: ${study.abstract?.substring(0, 500) || 'N/A'}`;
        break;
      case 'results':
        systemPrompt = 'Generate clear, quantitative results section for hydrogen research. Include key findings and outcomes.';
        userPrompt = `Results for: ${study.title}\nAbstract: ${study.abstract?.substring(0, 500) || 'N/A'}`;
        break;
      case 'objective':
        systemPrompt = 'Generate a clear 1-2 sentence study objective.';
        userPrompt = `Objective for: ${study.title}`;
        maxTokens = 150;
        break;
    }

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      max_tokens: maxTokens,
      temperature: 0.7
    });

    return response.choices[0].message.content;

  } catch (error) {
    console.error(`Fast ${contentType} generation failed:`, error);
    return null;
  }
}

/**
 * Fast summary generation without AI calls for maximum speed
 */
function generateFastSummary(study: any, updates: any = {}): string {
  const title = study.title || 'Untitled Study';
  const authors = study.authors || 'Authors not specified';
  const journal = study.journal || 'Journal not specified';
  const abstract = study.abstract || 'Abstract not available';
  const objective = updates.objective || study.objective || '';
  const methods = updates.methods || study.methods || '';
  const results = updates.results || study.results || '';
  const conclusion = study.conclusion || '';
  const doi = study.doi || 'Not available';

  return `# ${title}

**Authors**: ${authors}  
**Journal**: ${journal}  
**DOI**: ${doi}

${objective ? `## Study Objective\n${objective}\n` : ''}

## Abstract
${abstract}

${methods ? `## Methods\n${methods}\n` : ''}
${results ? `## Results\n${results}\n` : ''}
${conclusion ? `## Conclusion\n${conclusion}\n` : ''}

---
*Comprehensive study summary for hydrogen health research.*`;
}