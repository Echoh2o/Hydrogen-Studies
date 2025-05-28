/**
 * Start AI Content Improvement Process
 * 
 * This script initiates the batch content improvement for hydrogen studies,
 * adding AI-generated methods, results, conclusions, and summaries.
 */

import { startBatchEnrichment, getBatchEnrichmentStatus } from './batch-enrichment';
import { db } from './db';
import { studies } from '@shared/schema';
import { isNull, or, eq, lt } from 'drizzle-orm';

async function startContentImprovement() {
  console.log('🚀 Starting AI Content Improvement for Hydrogen Studies...');
  
  try {
    // Check current database status
    const totalStudies = await db.select({ count: studies.id }).from(studies);
    console.log(`📊 Total studies in database: ${totalStudies.length}`);
    
    // Find studies that need content improvement
    const studiesNeedingContent = await db.select({ 
      id: studies.id,
      title: studies.title,
      hasAbstract: studies.abstract,
      hasMethods: studies.methods,
      hasResults: studies.results,
      hasConclusion: studies.conclusion
    })
    .from(studies)
    .where(
      or(
        isNull(studies.methods),
        eq(studies.methods, ''),
        isNull(studies.results), 
        eq(studies.results, ''),
        isNull(studies.conclusion),
        eq(studies.conclusion, '')
      )
    )
    .limit(50);
    
    console.log(`🎯 Found ${studiesNeedingContent.length} studies that need content improvement`);
    
    if (studiesNeedingContent.length === 0) {
      console.log('✅ All studies already have complete content!');
      return;
    }
    
    // Show examples of what will be improved
    console.log('\n📝 Examples of studies that will be enhanced:');
    studiesNeedingContent.slice(0, 5).forEach((study, index) => {
      const missing = [];
      if (!study.hasMethods) missing.push('Methods');
      if (!study.hasResults) missing.push('Results'); 
      if (!study.hasConclusion) missing.push('Conclusion');
      
      console.log(`${index + 1}. "${study.title}" - Missing: ${missing.join(', ')}`);
    });
    
    // Start the batch enrichment process
    console.log('\n🤖 Starting AI content generation...');
    const result = await startBatchEnrichment(5, 50); // Process 5 studies at a time, max 50 studies
    
    console.log('✅ Content improvement process started successfully!');
    console.log(`📈 Processing stats:`, result);
    
    // Monitor progress
    console.log('\n👀 You can monitor progress in the console logs...');
    
  } catch (error) {
    console.error('❌ Error starting content improvement:', error);
  }
}

// Run the content improvement
startContentImprovement().catch(console.error);