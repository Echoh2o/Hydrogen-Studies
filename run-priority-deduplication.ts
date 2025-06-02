#!/usr/bin/env tsx

import { processTopDuplicates, checkFinalDuplicateStatus } from './server/priority-deduplication.js';

async function main() {
  try {
    console.log('Starting priority deduplication process...');
    
    const result = await processTopDuplicates();
    
    console.log('\n=== CHECKING FINAL STATUS ===');
    const finalStatus = await checkFinalDuplicateStatus();
    
    console.log('\n=== PRIORITY DEDUPLICATION SUMMARY ===');
    console.log(`Processed: ${result.studiesProcessed} studies`);
    console.log(`Fixed: ${result.titlesFixed} titles using DOI lookups`);
    console.log(`Errors: ${result.errors}`);
    console.log(`Remaining duplicate groups: ${finalStatus.remainingGroups}`);
    console.log(`Remaining duplicate studies: ${finalStatus.remainingDuplicates}`);
    
    if (result.titlesFixed > 0) {
      console.log(`\n✓ Successfully corrected ${result.titlesFixed} study titles using authoritative CrossRef data.`);
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Priority deduplication failed:', error);
    process.exit(1);
  }
}

main();