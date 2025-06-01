/**
 * Simple Visual Enhancement System
 * 
 * Clean implementation focused on generating images for studies without existing visuals
 */

import { db } from './db';
import { sql } from 'drizzle-orm';

interface VisualStats {
  isRunning: boolean;
  totalProcessed: number;
  totalGenerated: number;
  totalRemaining: number;
  startTime: Date;
  lastActivity: Date;
  estimatedTimeRemaining?: string;
}

let visualStats: VisualStats = {
  isRunning: false,
  totalProcessed: 0,
  totalGenerated: 0,
  totalRemaining: 0,
  startTime: new Date(),
  lastActivity: new Date()
};

/**
 * Check how many studies need images
 */
async function checkImageStatus() {
  try {
    const results = await db.execute(
      sql`SELECT 
        count(*) as total,
        count(case when image_url is not null then 1 end) as withImages,
        count(case when image_url is null then 1 end) as withoutImages
      FROM studies`
    );

    const stats = results.rows[0] as any;
    visualStats.totalRemaining = Number(stats.withoutimages || 0);
    
    console.log(`📊 Image Status: ${stats.withimages}/${stats.total} studies have images (${stats.withoutimages} remaining)`);
    
    return {
      total: Number(stats.total || 0),
      withImages: Number(stats.withimages || 0),
      withoutImages: Number(stats.withoutimages || 0)
    };
  } catch (error) {
    console.error('❌ Error checking image status:', error);
    return { total: 0, withImages: 0, withoutImages: 0 };
  }
}

/**
 * Generate image for a single study
 */
async function generateImageForStudy(study: any): Promise<boolean> {
  try {
    const { generateImageForStudy } = await import('./image-generator');
    
    const imageResult = await generateImageForStudy(study);
    
    if (imageResult?.success && imageResult.imageUrl) {
      // Update study with generated image
      await db.execute(
        sql`UPDATE studies 
            SET image_url = ${imageResult.imageUrl}, 
                image_alt = ${imageResult.imagePath || `Visual representation of ${study.title}`},
                auto_generated_image = true
            WHERE id = ${study.id}`
      );
      
      visualStats.totalGenerated++;
      visualStats.totalProcessed++;
      visualStats.lastActivity = new Date();
      
      console.log(`✅ Generated image for study ${study.id}: ${study.title?.substring(0, 60)}...`);
      return true;
    }
    
    return false;
  } catch (error) {
    console.error(`❌ Failed to generate image for study ${study.id}:`, error);
    visualStats.totalProcessed++;
    return false;
  }
}

/**
 * Process a batch of studies needing images
 */
async function processBatch(batchSize: number = 3): Promise<boolean> {
  try {
    // Get studies without images
    const results = await db.execute(
      sql`SELECT id, title, abstract, category
          FROM studies 
          WHERE image_url IS NULL 
          LIMIT ${batchSize}`
    );
    
    const studies = results.rows;
    
    if (studies.length === 0) {
      console.log('✅ All studies now have images - visual enhancement complete!');
      visualStats.isRunning = false;
      return false;
    }
    
    console.log(`🎨 Processing batch of ${studies.length} studies for image generation...`);
    
    // Process studies in parallel (small batches to avoid overwhelming the system)
    const promises = studies.map(study => generateImageForStudy(study));
    await Promise.all(promises);
    
    // Update remaining count
    await checkImageStatus();
    
    return studies.length > 0;
  } catch (error) {
    console.error('❌ Error in batch processing:', error);
    return false;
  }
}

/**
 * Start visual enhancement process
 */
export async function startVisualEnhancement(): Promise<void> {
  if (visualStats.isRunning) {
    console.log('⏸️ Visual enhancement already running');
    return;
  }
  
  console.log('🎨 Starting visual enhancement process...');
  
  visualStats.isRunning = true;
  visualStats.startTime = new Date();
  visualStats.totalProcessed = 0;
  visualStats.totalGenerated = 0;
  
  // Check initial status
  await checkImageStatus();
  
  // Process in background
  processInBackground();
}

/**
 * Background processing loop
 */
async function processInBackground(): Promise<void> {
  while (visualStats.isRunning) {
    try {
      const hasMore = await processBatch(3);
      
      if (!hasMore) {
        visualStats.isRunning = false;
        console.log('🎉 Visual enhancement completed!');
        break;
      }
      
      // Wait between batches to avoid overwhelming the system
      await new Promise(resolve => setTimeout(resolve, 2000));
      
    } catch (error) {
      console.error('❌ Error in background processing:', error);
      // Wait longer on errors
      await new Promise(resolve => setTimeout(resolve, 10000));
    }
  }
}

/**
 * Stop visual enhancement process
 */
export function stopVisualEnhancement(): void {
  visualStats.isRunning = false;
  console.log('⏹️ Visual enhancement stopped');
}

/**
 * Get current visual enhancement status
 */
export function getVisualEnhancementStatus(): VisualStats {
  return { ...visualStats };
}

/**
 * Auto-start visual enhancement on import (if needed)
 */
export async function autoStartVisualEnhancement(): Promise<void> {
  try {
    const status = await checkImageStatus();
    
    if (status.withoutImages > 0) {
      console.log(`🎨 Found ${status.withoutImages} studies needing images - starting visual enhancement...`);
      await startVisualEnhancement();
    } else {
      console.log('✅ All studies already have images - visual enhancement not needed');
    }
  } catch (error) {
    console.error('❌ Error in auto-start visual enhancement:', error);
  }
}