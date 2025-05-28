/**
 * Run AI Content Improvement
 * 
 * Execute the simple content improver to add missing sections to hydrogen studies
 */

import { improveStudyContent } from './simple-content-improver';

async function runContentImprovement() {
  console.log('🚀 Starting AI Content Improvement for Hydrogen Studies...');
  
  try {
    // Start with a small batch to test
    const stats = await improveStudyContent(25);
    
    console.log('\n🎉 Content improvement completed successfully!');
    console.log('📊 Final Statistics:');
    console.log(`  - Studies processed: ${stats.totalProcessed}`);
    console.log(`  - Methods sections generated: ${stats.methodsGenerated}`);
    console.log(`  - Results sections generated: ${stats.resultsGenerated}`);
    console.log(`  - Conclusions generated: ${stats.conclusionsGenerated}`);
    console.log(`  - Summaries created: ${stats.summariesGenerated}`);
    
    if (stats.errors.length > 0) {
      console.log(`  - Errors encountered: ${stats.errors.length}`);
      stats.errors.forEach(error => console.log(`    ❌ ${error}`));
    }
    
  } catch (error) {
    console.error('❌ Content improvement failed:', error);
    process.exit(1);
  }
}

// Run the improvement process
runContentImprovement();