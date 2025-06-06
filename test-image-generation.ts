/**
 * Test image generation for a small batch of studies
 */

import { generateStudyImage } from './server/enhanced-image-generator';

async function testImageGeneration() {
  try {
    console.log('Testing enhanced image generation on 5 studies...');
    
    // Test with studies 100, 200, 300, 400, 500
    const testStudyIds = [100, 200, 300, 400, 500];
    
    for (const studyId of testStudyIds) {
      console.log(`\nGenerating image for study ${studyId}...`);
      
      const result = await generateStudyImage(studyId);
      
      if (result.success) {
        console.log(`✓ Study ${studyId}: ${result.imageDescription}`);
      } else {
        console.log(`✗ Study ${studyId}: ${result.error}`);
      }
      
      // Small delay between requests
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    console.log('\nTest batch complete');
    
  } catch (error) {
    console.error('Test failed:', error);
  }
}

testImageGeneration();