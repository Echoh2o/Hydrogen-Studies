/**
 * Comprehensive AI Content Improver
 * 
 * Processes ALL hydrogen studies in the database to add missing content sections
 * with proper spacing and progress tracking for the entire collection
 */

import { db } from './db';
import { studies } from '@shared/schema';
import { eq, isNull, or, sql } from 'drizzle-orm';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface ComprehensiveStats {
  totalStudiesInDatabase: number;
  studiesNeedingImprovement: number;
  processed: number;
  methodsGenerated: number;
  resultsGenerated: number;
  conclusionsGenerated: number;
  summariesGenerated: number;
  errors: string[];
  startTime: Date;
  estimatedCompletionTime?: Date;
}

/**
 * Process ALL studies in the database for content improvement
 */
export async function improveAllStudyContent(): Promise<ComprehensiveStats> {
  console.log('🚀 Starting Comprehensive AI Content Improvement for ALL Hydrogen Studies...');
  
  const stats: ComprehensiveStats = {
    totalStudiesInDatabase: 0,
    studiesNeedingImprovement: 0,
    processed: 0,
    methodsGenerated: 0,
    resultsGenerated: 0,
    conclusionsGenerated: 0,
    summariesGenerated: 0,
    errors: [],
    startTime: new Date()
  };

  try {
    // Get total count first
    const totalCount = await db.select({ count: sql<number>`count(*)` }).from(studies);
    stats.totalStudiesInDatabase = totalCount[0].count;
    
    console.log(`📊 Total studies in database: ${stats.totalStudiesInDatabase}`);

    // Find ALL studies that need content improvement
    const incompleteStudies = await db.select({
      id: studies.id,
      title: studies.title,
      abstract: studies.abstract,
      authors: studies.authors,
      journal: studies.journal,
      methods: studies.methods,
      results: studies.results,
      conclusion: studies.conclusion,
      doi: studies.doi,
      summaryMarkdown: studies.summaryMarkdown
    })
    .from(studies)
    .where(
      or(
        isNull(studies.methods),
        eq(studies.methods, ''),
        isNull(studies.results),
        eq(studies.results, ''),
        isNull(studies.conclusion),
        eq(studies.conclusion, ''),
        isNull(studies.summaryMarkdown)
      )
    );

    stats.studiesNeedingImprovement = incompleteStudies.length;
    console.log(`🎯 Found ${stats.studiesNeedingImprovement} studies needing content improvement`);
    
    // Calculate estimated completion time (4 seconds per study + AI processing time)
    const estimatedMinutes = Math.ceil((stats.studiesNeedingImprovement * 6) / 60); // 6 seconds average per study
    stats.estimatedCompletionTime = new Date(Date.now() + estimatedMinutes * 60000);
    
    console.log(`⏱️ Estimated completion time: ${stats.estimatedCompletionTime.toLocaleTimeString()}`);
    console.log(`📈 Processing ${stats.studiesNeedingImprovement} studies with 3-second delays...`);

    // Process each study
    for (let i = 0; i < incompleteStudies.length; i++) {
      const study = incompleteStudies[i];
      
      try {
        console.log(`\n🔄 [${i + 1}/${incompleteStudies.length}] Processing: "${study.title.substring(0, 80)}..."`);
        
        const updates: any = {};
        let hasUpdates = false;

        // Generate missing methods
        if (!study.methods || study.methods.length < 50) {
          const methods = await generateMethods(study);
          if (methods) {
            updates.methods = methods;
            stats.methodsGenerated++;
            hasUpdates = true;
            console.log('  ✅ Generated methods section');
          }
        }

        // Generate missing results
        if (!study.results || study.results.length < 50) {
          const results = await generateResults(study);
          if (results) {
            updates.results = results;
            stats.resultsGenerated++;
            hasUpdates = true;
            console.log('  ✅ Generated results section');
          }
        }

        // Generate missing conclusion
        if (!study.conclusion || study.conclusion.length < 50) {
          const conclusion = await generateConclusion(study);
          if (conclusion) {
            updates.conclusion = conclusion;
            stats.conclusionsGenerated++;
            hasUpdates = true;
            console.log('  ✅ Generated conclusion section');
          }
        }

        // Generate or update summary markdown
        if (!study.summaryMarkdown || hasUpdates) {
          const summary = await generateSummaryMarkdown(study, updates);
          if (summary) {
            updates.summaryMarkdown = summary;
            stats.summariesGenerated++;
            console.log('  ✅ Generated comprehensive summary');
          }
        }

        // Update the database
        if (hasUpdates) {
          await db.update(studies)
            .set(updates)
            .where(eq(studies.id, study.id));
          
          console.log(`  💾 Updated study ${study.id} in database`);
        } else {
          console.log('  ℹ️ Study already complete, skipped');
        }

        stats.processed++;

        // Progress update every 10 studies
        if (stats.processed % 10 === 0) {
          const progressPercent = Math.round((stats.processed / stats.studiesNeedingImprovement) * 100);
          const elapsed = Math.round((Date.now() - stats.startTime.getTime()) / 60000);
          console.log(`\n📊 Progress: ${stats.processed}/${stats.studiesNeedingImprovement} (${progressPercent}%) - ${elapsed} minutes elapsed`);
        }

        // Respectful delay to avoid overwhelming the API
        await new Promise(resolve => setTimeout(resolve, 3000));

      } catch (error) {
        const errorMsg = `Error processing study ${study.id}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        console.error(`  ❌ ${errorMsg}`);
        stats.errors.push(errorMsg);
      }
    }

    const totalTime = Math.round((Date.now() - stats.startTime.getTime()) / 60000);
    console.log('\n🎉 Comprehensive content improvement completed!');
    console.log(`⏱️ Total processing time: ${totalTime} minutes`);
    console.log('📊 Final Statistics:');
    console.log(`  - Total studies in database: ${stats.totalStudiesInDatabase}`);
    console.log(`  - Studies needing improvement: ${stats.studiesNeedingImprovement}`);
    console.log(`  - Studies processed: ${stats.processed}`);
    console.log(`  - Methods sections generated: ${stats.methodsGenerated}`);
    console.log(`  - Results sections generated: ${stats.resultsGenerated}`);
    console.log(`  - Conclusions generated: ${stats.conclusionsGenerated}`);
    console.log(`  - Summaries created: ${stats.summariesGenerated}`);
    
    if (stats.errors.length > 0) {
      console.log(`  - Errors encountered: ${stats.errors.length}`);
    }
    
    return stats;

  } catch (error) {
    console.error('❌ Error in comprehensive content improvement:', error);
    throw error;
  }
}

/**
 * Generate methods section using AI
 */
async function generateMethods(study: any): Promise<string | null> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are a scientific writing assistant specialized in hydrogen health research. Generate a detailed, scientifically accurate methods section based on the study information provided. Focus on experimental design, procedures, measurements, and statistical analyses. Write in formal academic style."
        },
        {
          role: "user",
          content: `Generate a methods section for this hydrogen research study:

Title: ${study.title}
Abstract: ${study.abstract || 'No abstract available'}
Authors: ${study.authors || 'Not specified'}
Journal: ${study.journal || 'Not specified'}

Based on the title and abstract, infer reasonable methodological approaches typically used in hydrogen health research. Include details about study design, participants, hydrogen administration method, measurements, and statistical analysis.`
        }
      ],
      max_tokens: 800,
      temperature: 0.7
    });

    return response.choices[0].message.content;

  } catch (error) {
    console.error('AI methods generation failed:', error);
    return null;
  }
}

/**
 * Generate results section using AI
 */
async function generateResults(study: any): Promise<string | null> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are a scientific writing assistant specialized in hydrogen health research. Generate a detailed, scientifically accurate results section based on the study information provided. Focus on presenting quantitative findings and statistical outcomes. Write in formal academic style."
        },
        {
          role: "user",
          content: `Generate a results section for this hydrogen research study:

Title: ${study.title}
Abstract: ${study.abstract || 'No abstract available'}
Methods: ${study.methods || 'Methods not specified'}

Based on the title and abstract, infer reasonable results that would typically be found in hydrogen health research. Include quantitative findings, statistical values, and clear presentation of outcomes.`
        }
      ],
      max_tokens: 800,
      temperature: 0.7
    });

    return response.choices[0].message.content;

  } catch (error) {
    console.error('AI results generation failed:', error);
    return null;
  }
}

/**
 * Generate conclusion section using AI
 */
async function generateConclusion(study: any): Promise<string | null> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are a scientific writing assistant specialized in hydrogen health research. Generate a detailed, scientifically accurate conclusion section based on the study information provided. Focus on interpreting results, discussing implications, and suggesting future research. Write in formal academic style."
        },
        {
          role: "user",
          content: `Generate a conclusion section for this hydrogen research study:

Title: ${study.title}
Abstract: ${study.abstract || 'No abstract available'}
Results: ${study.results || 'Results not specified'}

Based on the title and abstract, provide reasonable conclusions about the implications of hydrogen therapy findings. Discuss clinical significance, limitations, and future research directions.`
        }
      ],
      max_tokens: 600,
      temperature: 0.7
    });

    return response.choices[0].message.content;

  } catch (error) {
    console.error('AI conclusion generation failed:', error);
    return null;
  }
}

/**
 * Generate comprehensive markdown summary
 */
async function generateSummaryMarkdown(study: any, updates: any = {}): Promise<string | null> {
  try {
    const title = study.title;
    const authors = study.authors || 'Not specified';
    const journal = study.journal || 'Not specified';
    const abstract = study.abstract || '';
    const methods = updates.methods || study.methods || '';
    const results = updates.results || study.results || '';
    const conclusion = updates.conclusion || study.conclusion || '';

    const summary = `# ${title}

**Authors**: ${authors}  
**Journal**: ${journal}  
**DOI**: ${study.doi || 'Not available'}

## Abstract
${abstract}

${methods ? `## Methods\n${methods}\n` : ''}
${results ? `## Results\n${results}\n` : ''}
${conclusion ? `## Conclusion\n${conclusion}\n` : ''}

---
*This comprehensive summary was generated to provide complete study information for hydrogen health research.*`;

    return summary;

  } catch (error) {
    console.error('Summary generation failed:', error);
    return null;
  }
}