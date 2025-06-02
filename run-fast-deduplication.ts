#!/usr/bin/env tsx

import { runFastDeduplication } from './server/fast-deduplication.js';

async function main() {
  try {
    const result = await runFastDeduplication();
    
    console.log('\n=== FINAL SUMMARY ===');
    console.log(`Total duplicate groups: ${result.totalGroups}`);
    console.log(`Total studies processed: ${result.totalStudiesProcessed}`);
    console.log(`Total titles corrected: ${result.totalTitlesFixed}`);
    console.log(`Processing errors: ${result.totalErrors}`);
    
    if (result.totalTitlesFixed > 0) {
      console.log(`\nSuccessfully corrected ${result.totalTitlesFixed} study titles using authoritative DOI sources.`);
    } else {
      console.log('\nAll duplicate titles were already correct according to their DOI sources.');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Deduplication failed:', error);
    process.exit(1);
  }
}

main();