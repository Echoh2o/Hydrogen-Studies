#!/usr/bin/env tsx

import { processBatchTagging } from './server/fast-batch-tagging.js';
import { getTaggingStats } from './server/automated-tagging-system.js';

async function main() {
  try {
    console.log('Starting fast batch tagging process...');
    
    // Process 5 batches of 10 studies each (50 studies total)
    const result = await processBatchTagging(10, 5);
    
    console.log('\nGetting updated tagging statistics...');
    const stats = await getTaggingStats();
    
    console.log('\n=== BATCH TAGGING RESULTS ===');
    console.log(`Studies processed: ${result.studiesProcessed}`);
    console.log(`Tags added: ${result.tagsAdded}`);
    console.log(`Processing errors: ${result.errors}`);
    console.log(`Average time per study: ${result.avgProcessingTime.toFixed(0)}ms`);
    
    console.log('\n=== UPDATED SYSTEM STATISTICS ===');
    console.log(`Total unique tags: ${stats.totalTags}`);
    console.log(`Total study-tag relationships: ${stats.totalStudyTags}`);
    
    if (stats.topTags.length > 0) {
      console.log('\nMost popular tags:');
      stats.topTags.slice(0, 10).forEach((tag, index) => {
        console.log(`  ${index + 1}. ${tag.name} (${tag.category}) - ${tag.count} studies`);
      });
    }
    
    console.log('\nTag-based search system is now operational with real data');
    process.exit(0);
  } catch (error) {
    console.error('Batch tagging failed:', error);
    process.exit(1);
  }
}

main();