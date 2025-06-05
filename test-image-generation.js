/**
 * Test script for enhanced image generation system
 */

import { generateStudyImage } from './server/enhanced-image-generator.js';

async function testImageGeneration() {
  try {
    console.log('Testing enhanced image generation for study 11...');
    
    const result = await generateStudyImage(11);
    
    if (result.success) {
      console.log('✓ Image generation successful!');
      console.log('Image URL:', result.imageUrl);
      console.log('SEO Description:', result.imageDescription);
      console.log('Prompt used:', result.prompt);
    } else {
      console.log('✗ Image generation failed:', result.error);
    }
    
  } catch (error) {
    console.error('Test failed:', error.message);
  }
}

testImageGeneration();