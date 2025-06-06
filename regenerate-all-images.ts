/**
 * Regenerate all study images with enhanced SEO-optimized descriptions
 */

import { generateImagesForStudies } from './server/enhanced-image-generator';
import { db } from './server/db';
import { studies } from './shared/schema';

async function regenerateAllImages() {
  try {
    console.log('Starting batch image regeneration for all studies...');
    
    // Get all study IDs
    const allStudies = await db.select({ id: studies.id }).from(studies);
    const studyIds = allStudies.map(s => s.id);
    
    console.log(`Found ${studyIds.length} studies to regenerate images for`);
    
    // Process in small batches to respect DALL-E 3 rate limits
    const batchSize = 3;
    let completed = 0;
    
    for (let i = 0; i < studyIds.length; i += batchSize) {
      const batch = studyIds.slice(i, i + batchSize);
      
      console.log(`Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(studyIds.length / batchSize)} (studies ${batch.join(', ')})`);
      
      // Generate images for current batch
      const results = await generateImagesForStudies(batch, batchSize);
      
      // Count successful generations
      const successful = results.filter(r => r.success).length;
      completed += successful;
      
      console.log(`Batch complete: ${successful}/${batch.length} successful. Total: ${completed}/${studyIds.length}`);
      
      // Rate limiting delay between batches (DALL-E 3 has strict limits)
      if (i + batchSize < studyIds.length) {
        console.log('Waiting 15 seconds before next batch...');
        await new Promise(resolve => setTimeout(resolve, 15000));
      }
    }
    
    console.log(`\n✓ Image regeneration complete: ${completed}/${studyIds.length} studies processed`);
    
  } catch (error) {
    console.error('Error in batch image regeneration:', error);
    throw error;
  }
}

// Start the regeneration process
regenerateAllImages()
  .then(() => {
    console.log('All images regenerated successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Regeneration failed:', error);
    process.exit(1);
  });