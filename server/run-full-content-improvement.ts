/**
 * Run Full Database Content Improvement
 * 
 * Process ALL hydrogen studies for comprehensive AI content enhancement
 */

import { improveAllStudyContent } from './comprehensive-content-improver';

async function runFullContentImprovement() {
  console.log('🚀 Starting Full Database AI Content Improvement...');
  console.log('📊 This will process ALL hydrogen studies needing content enhancement');
  
  try {
    const stats = await improveAllStudyContent();
    
    console.log('\n🎉 Full database content improvement completed successfully!');
    console.log('🏆 Your hydrogen research database is now significantly enhanced!');
    
  } catch (error) {
    console.error('❌ Content improvement failed:', error);
    process.exit(1);
  }
}

// Run the comprehensive improvement process
runFullContentImprovement();