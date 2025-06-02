#!/usr/bin/env tsx

import { processAllDuplicates } from './server/simple-title-fix.js';

async function main() {
  try {
    console.log('Starting full deduplication process...');
    const result = await processAllDuplicates();
    
    console.log('\n=== FINAL RESULTS ===');
    console.log(`Total groups processed: ${result.totalGroups}`);
    console.log(`Total studies processed: ${result.totalStudiesProcessed}`);
    console.log(`Total titles fixed: ${result.totalTitlesFixed}`);
    console.log(`Total errors: ${result.totalErrors}`);
    
    if (result.processedGroups.length > 0) {
      console.log('\nDetailed results by group:');
      result.processedGroups.forEach((group, index) => {
        if (group.fixed > 0) {
          console.log(`  ${index + 1}. "${group.title.substring(0, 60)}..." - Fixed ${group.fixed}/${group.count} studies`);
        }
      });
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Deduplication process failed:', error);
    process.exit(1);
  }
}

main();