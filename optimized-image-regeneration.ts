/**
 * Optimized image regeneration for all studies using actual DALL-E 3 rate limits
 * Rate limits: 5000 RPM and 7 images per minute
 */

import { generateStudyImage } from './server/enhanced-image-generator';
import { db } from './server/db';
import { studies } from './shared/schema';

async function optimizedImageRegeneration() {
  try {
    console.log('Starting optimized image regeneration for all studies...');
    
    // Get all study IDs
    const allStudies = await db.select({ id: studies.id }).from(studies);
    const studyIds = allStudies.map(s => s.id);
    
    console.log(`Found ${studyIds.length} studies to regenerate images for`);
    console.log(`Estimated completion time: ${Math.ceil(studyIds.length / 7)} minutes\n`);
    
    // Process 7 images per minute to respect rate limits
    const batchSize = 7;
    let completed = 0;
    let successful = 0;
    let failed = 0;
    
    for (let i = 0; i < studyIds.length; i += batchSize) {
      const batch = studyIds.slice(i, i + batchSize);
      const batchNumber = Math.floor(i / batchSize) + 1;
      const totalBatches = Math.ceil(studyIds.length / batchSize);
      
      console.log(`\nBatch ${batchNumber}/${totalBatches}: Processing studies ${batch.join(', ')}`);
      
      // Process all images in batch simultaneously
      const batchPromises = batch.map(async (studyId) => {
        try {
          const result = await generateStudyImage(studyId);
          if (result.success) {
            console.log(`✓ Study ${studyId}: Enhanced image generated`);
            return { success: true, studyId };
          } else {
            console.log(`✗ Study ${studyId}: ${result.error}`);
            return { success: false, studyId, error: result.error };
          }
        } catch (error) {
          console.log(`✗ Study ${studyId}: ${error.message}`);
          return { success: false, studyId, error: error.message };
        }
      });
      
      // Wait for all images in batch to complete
      const batchResults = await Promise.all(batchPromises);
      
      // Count results
      const batchSuccessful = batchResults.filter(r => r.success).length;
      const batchFailed = batchResults.filter(r => !r.success).length;
      
      successful += batchSuccessful;
      failed += batchFailed;
      completed += batch.length;
      
      console.log(`Batch ${batchNumber} complete: ${batchSuccessful}/${batch.length} successful`);
      console.log(`Progress: ${completed}/${studyIds.length} (${Math.round(completed/studyIds.length*100)}%)`);
      
      // Wait 60 seconds before next batch (7 images per minute rate limit)
      if (i + batchSize < studyIds.length) {
        console.log('Waiting 60 seconds for rate limit...');
        await new Promise(resolve => setTimeout(resolve, 60000));
      }
    }
    
    console.log(`\n✅ Image regeneration complete!`);
    console.log(`Total: ${completed}/${studyIds.length} studies processed`);
    console.log(`Successful: ${successful}`);
    console.log(`Failed: ${failed}`);
    
  } catch (error) {
    console.error('Error in optimized image regeneration:', error);
    throw error;
  }
}

// Start the regeneration process
optimizedImageRegeneration()
  .then(() => {
    console.log('All images regenerated successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Regeneration failed:', error);
    process.exit(1);
  });