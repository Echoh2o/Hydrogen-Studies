#!/usr/bin/env tsx

import { initializeTaggingSystem, tagSingleStudy, getTaggingStats } from './server/automated-tagging-system.js';

async function main() {
  try {
    console.log('Initializing automated tagging system...');
    await initializeTaggingSystem();
    console.log('✓ Tagging system initialized');

    console.log('\nTesting tagging on a sample study...');
    // Tag the first study as a test
    const result = await tagSingleStudy(1);
    console.log('✓ Sample study tagged successfully');
    console.log(`  Tags added: ${result.tagsAdded}`);
    console.log(`  Processing time: ${result.processingTime}ms`);
    
    if (result.tagsFromTitle.length > 0) {
      console.log(`  Tags from title: ${result.tagsFromTitle.join(', ')}`);
    }
    if (result.tagsFromAbstract.length > 0) {
      console.log(`  Tags from abstract: ${result.tagsFromAbstract.join(', ')}`);
    }
    if (result.tagsFromKeywords.length > 0) {
      console.log(`  Tags from keywords: ${result.tagsFromKeywords.join(', ')}`);
    }
    if (result.tagsFromAI.length > 0) {
      console.log(`  Tags from AI: ${result.tagsFromAI.join(', ')}`);
    }

    console.log('\nGetting tagging statistics...');
    const stats = await getTaggingStats();
    console.log('✓ Tagging statistics retrieved');
    console.log(`  Total tags available: ${stats.totalTags}`);
    console.log(`  Total study-tag relationships: ${stats.totalStudyTags}`);
    
    if (stats.topTags.length > 0) {
      console.log('\nTop tags by usage:');
      stats.topTags.slice(0, 10).forEach((tag, index) => {
        console.log(`  ${index + 1}. ${tag.name} (${tag.category}) - ${tag.count} uses`);
      });
    }
    
    if (stats.tagsByCategory.length > 0) {
      console.log('\nTags by category:');
      stats.tagsByCategory.forEach(cat => {
        console.log(`  ${cat.category}: ${cat.count} tags`);
      });
    }
    
    console.log('\n✓ Automated tagging system successfully initialized and tested');
    process.exit(0);
  } catch (error) {
    console.error('Failed to initialize tagging system:', error);
    process.exit(1);
  }
}

main();