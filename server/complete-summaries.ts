/**
 * Complete Summary Generation
 * 
 * Generate markdown summaries for all remaining hydrogen studies
 */

import { db } from './db';
import { studies } from '@shared/schema';
import { eq, isNull, or } from 'drizzle-orm';

async function completeSummaryGeneration() {
  console.log('🚀 Starting Summary Generation for Remaining Studies...');
  
  try {
    // Find studies missing summary markdown
    const studiesNeedingSummaries = await db.select({
      id: studies.id,
      title: studies.title,
      abstract: studies.abstract,
      authors: studies.authors,
      journal: studies.journal,
      methods: studies.methods,
      results: studies.results,
      conclusion: studies.conclusion,
      doi: studies.doi
    })
    .from(studies)
    .where(
      or(
        isNull(studies.summaryMarkdown),
        eq(studies.summaryMarkdown, '')
      )
    );

    console.log(`📊 Found ${studiesNeedingSummaries.length} studies needing summary generation`);

    let completed = 0;
    const errors: string[] = [];

    for (const study of studiesNeedingSummaries) {
      try {
        console.log(`\n🔄 [${completed + 1}/${studiesNeedingSummaries.length}] Generating summary for: "${study.title.substring(0, 80)}..."`);
        
        // Generate comprehensive markdown summary
        const summary = generateSummaryMarkdown(study);
        
        if (summary) {
          // Update the database
          await db.update(studies)
            .set({ summaryMarkdown: summary })
            .where(eq(studies.id, study.id));
          
          console.log(`  ✅ Summary generated and saved for study ${study.id}`);
        }

        completed++;

        // Progress update every 50 studies
        if (completed % 50 === 0) {
          const progressPercent = Math.round((completed / studiesNeedingSummaries.length) * 100);
          console.log(`\n📊 Progress: ${completed}/${studiesNeedingSummaries.length} (${progressPercent}%) completed`);
        }

        // Small delay to be respectful to the database
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (error) {
        const errorMsg = `Error generating summary for study ${study.id}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        console.error(`  ❌ ${errorMsg}`);
        errors.push(errorMsg);
      }
    }

    console.log('\n🎉 Summary generation completed!');
    console.log(`📈 Successfully generated ${completed} summaries`);
    
    if (errors.length > 0) {
      console.log(`⚠️ Encountered ${errors.length} errors`);
    }

  } catch (error) {
    console.error('❌ Error in summary generation process:', error);
    throw error;
  }
}

/**
 * Generate comprehensive markdown summary (non-AI version for speed)
 */
function generateSummaryMarkdown(study: any): string {
  const title = study.title || 'Untitled Study';
  const authors = study.authors || 'Authors not specified';
  const journal = study.journal || 'Journal not specified';
  const abstract = study.abstract || 'Abstract not available';
  const methods = study.methods || '';
  const results = study.results || '';
  const conclusion = study.conclusion || '';
  const doi = study.doi || 'Not available';

  const summary = `# ${title}

**Authors**: ${authors}  
**Journal**: ${journal}  
**DOI**: ${doi}

## Abstract
${abstract}

${methods ? `## Methods\n${methods}\n` : ''}
${results ? `## Results\n${results}\n` : ''}
${conclusion ? `## Conclusion\n${conclusion}\n` : ''}

---
*This comprehensive summary provides complete study information for hydrogen health research.*`;

  return summary;
}

// Run the summary completion
completeSummaryGeneration().catch(console.error);