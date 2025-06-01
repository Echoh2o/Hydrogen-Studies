/**
 * Auto Visual Enhancement System
 * 
 * Automatically starts and resumes visual content generation after restarts
 * Monitors progress and ensures completion of all 537 missing images
 */

import { db } from './db';
import { studies } from '@shared/schema';
import { isNull, sql } from 'drizzle-orm';

interface VisualEnhancementStatus {
  isRunning: boolean;
  totalProcessed: number;
  totalGenerated: number;
  totalRemaining: number;
  startTime: Date;
  lastActivity: Date;
  batchSize: number;
  estimatedTimeRemaining?: string;
}

let globalStatus: VisualEnhancementStatus = {
  isRunning: false,
  totalProcessed: 0,
  totalGenerated: 0,
  totalRemaining: 537,
  startTime: new Date(),
  lastActivity: new Date(),
  batchSize: 5
};

/**
 * Check current visual content status
 */
async function checkVisualContentStatus() {
  try {
    const results = await db.execute(
      sql`SELECT 
        count(*) as total,
        count(case when image_url is not null then 1 end) as withImages,
        count(case when image_url is null then 1 end) as withoutImages
      FROM studies`
    );

    const stats = results.rows[0];
    globalStatus.totalRemaining = stats.withoutImages;
    
    console.log(`📊 Visual Content Status: ${stats.withImages}/${stats.total} complete (${stats.withoutImages} remaining)`);
    
    return {
      total: stats.total,
      complete: stats.withImages,
      remaining: stats.withoutImages,
      percentage: Math.round((stats.withImages / stats.total) * 100)
    };
  } catch (error) {
    console.error('Error checking visual content status:', error);
    return null;
  }
}

/**
 * Generate image for a single study
 */
async function generateStudyImage(study: any): Promise<boolean> {
  try {
    // Use the existing image generation system
    const { generateImageForStudy } = await import('./image-generator');
    
    const imageResult = await generateImageForStudy(study);
    
    if (imageResult?.success && imageResult.imageUrl) {
      // Update study with generated image using raw SQL
      await db.execute(
        sql`UPDATE studies 
            SET image_url = ${imageResult.imageUrl}, 
                image_alt = ${imageResult.imagePath || `Visual representation of ${study.title}`}
            WHERE id = ${study.id}`
      );
      
      globalStatus.totalGenerated++;
      globalStatus.lastActivity = new Date();
      
      console.log(`✅ Generated image for study ${study.id}: ${study.title?.substring(0, 60)}...`);
      return true;
    }
    
    return false;
  } catch (error) {
    console.error(`❌ Failed to generate image for study ${study.id}:`, error);
    return false;
  }
}

/**
 * Process batch of studies without images
 */
async function processBatchWithoutImages(): Promise<void> {
  try {
    // Get batch of studies without images using raw SQL
    const results = await db.execute(
      sql`SELECT id, title, abstract, category, image_url 
          FROM studies 
          WHERE image_url IS NULL 
          LIMIT ${globalStatus.batchSize}`
    );
    
    const studiesWithoutImages = results.rows;

    if (studiesWithoutImages.length === 0) {
      console.log('✅ All studies now have images - visual enhancement complete!');
      globalStatus.isRunning = false;
      return;
    }

    console.log(`🎨 Processing batch of ${studiesWithoutImages.length} studies for image generation...`);

    // Process studies in parallel (but limited batch size)
    const promises = studiesWithoutImages.map(study => generateStudyImage(study));
    await Promise.allSettled(promises);

    globalStatus.totalProcessed += studiesWithoutImages.length;

    // Check if more work remains
    const statusCheck = await checkVisualContentStatus();
    if (statusCheck && statusCheck.remaining > 0) {
      // Continue with next batch after brief delay
      setTimeout(() => {
        if (globalStatus.isRunning) {
          processBatchWithoutImages();
        }
      }, 2000);
    } else {
      console.log('🎉 Visual enhancement process completed!');
      globalStatus.isRunning = false;
    }

  } catch (error) {
    console.error('❌ Error in batch processing:', error);
    // Retry after delay
    setTimeout(() => {
      if (globalStatus.isRunning) {
        processBatchWithoutImages();
      }
    }, 5000);
  }
}

/**
 * Start visual enhancement process
 */
async function startVisualEnhancement(): Promise<void> {
  if (globalStatus.isRunning) {
    console.log('⚠️ Visual enhancement already running');
    return;
  }

  console.log('🚀 Starting visual enhancement process...');
  
  globalStatus.isRunning = true;
  globalStatus.startTime = new Date();
  globalStatus.totalProcessed = 0;
  globalStatus.totalGenerated = 0;
  
  // Check current status
  const status = await checkVisualContentStatus();
  if (status) {
    globalStatus.totalRemaining = status.remaining;
    
    if (status.remaining === 0) {
      console.log('✅ All studies already have images!');
      globalStatus.isRunning = false;
      return;
    }
  }

  // Start batch processing
  processBatchWithoutImages();
}

/**
 * Auto-start visual enhancement on application startup
 */
async function autoStartVisualEnhancement(): Promise<void> {
  try {
    // Wait a moment for database to be ready
    setTimeout(async () => {
      console.log('🔍 Checking for missing images on startup...');
      
      const status = await checkVisualContentStatus();
      if (status && status.remaining > 0) {
        console.log(`🎨 Found ${status.remaining} studies without images - starting auto-generation`);
        await startVisualEnhancement();
      } else {
        console.log('✅ All studies have images - no visual enhancement needed');
      }
    }, 5000); // 5 second delay after startup
  } catch (error) {
    console.error('Error in auto-start visual enhancement:', error);
  }
}

/**
 * Get current visual enhancement status
 */
export function getVisualEnhancementStatus(): VisualEnhancementStatus {
  return { ...globalStatus };
}

/**
 * Manual start function for admin triggers
 */
export async function manualStartVisualEnhancement(): Promise<VisualEnhancementStatus> {
  await startVisualEnhancement();
  return getVisualEnhancementStatus();
}

/**
 * Stop visual enhancement process
 */
export function stopVisualEnhancement(): void {
  globalStatus.isRunning = false;
  console.log('⏹️ Visual enhancement process stopped');
}

// Auto-start on import
autoStartVisualEnhancement();

export { autoStartVisualEnhancement, startVisualEnhancement, checkVisualContentStatus };