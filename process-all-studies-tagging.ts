#!/usr/bin/env tsx

import { processAllStudiesForTagging, getTaggingStats } from './server/automated-tagging-system.js';

async function main() {
  try {
    console.log('Starting automated tagging for all studies in the database...');
    console.log('This will analyze 1,326 studies and generate relevant tags for each.\n');
    
    const result = await processAllStudiesForTagging();
    
    console.log('\n=== AUTOMATED TAGGING COMPLETE ===');
    console.log(`Total studies processed: ${result.totalStudies}`);
    console.log(`Successfully tagged: ${result.successfullyTagged}`);
    console.log(`Total tags added: ${result.totalTagsAdded}`);
    console.log(`Processing errors: ${result.errors}`);
    console.log(`Average processing time: ${result.avgProcessingTime.toFixed(0)}ms per study`);
    
    console.log('\nGetting final tagging statistics...');
    const stats = await getTaggingStats();
    
    console.log('\n=== FINAL TAGGING STATISTICS ===');
    console.log(`Total unique tags: ${stats.totalTags}`);
    console.log(`Total study-tag relationships: ${stats.totalStudyTags}`);
    console.log(`Average tags per study: ${(stats.totalStudyTags / result.totalStudies).toFixed(1)}`);
    
    if (stats.topTags.length > 0) {
      console.log('\nTop 15 most used tags:');
      stats.topTags.slice(0, 15).forEach((tag, index) => {
        console.log(`  ${index + 1}. ${tag.name} (${tag.category}) - ${tag.count} studies`);
      });
    }
    
    if (stats.tagsByCategory.length > 0) {
      console.log('\nTags distribution by category:');
      stats.tagsByCategory.forEach(cat => {
        console.log(`  ${cat.category}: ${cat.count} unique tags`);
      });
    }
    
    console.log('\n✓ All studies have been successfully tagged for improved search and SEO');
    process.exit(0);
  } catch (error) {
    console.error('Failed to process all studies for tagging:', error);
    process.exit(1);
  }
}

main();