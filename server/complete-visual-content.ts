/**
 * Complete Visual Content Generation
 * 
 * Generates scientific images for the remaining 575 studies
 * that need visual content to reach 100% completion
 */

import { db } from "./db";
import { sql } from "drizzle-orm";
import { generateImageForStudy } from "./image-generator";

interface VisualCompletionStats {
  totalStudies: number;
  completed: number;
  remaining: number;
  processed: number;
  successful: number;
  failed: number;
  startTime: Date;
  isRunning: boolean;
}

let completionStats: VisualCompletionStats = {
  totalStudies: 0,
  completed: 0,
  remaining: 0,
  processed: 0,
  successful: 0,
  failed: 0,
  startTime: new Date(),
  isRunning: false
};

/**
 * Start visual content completion process
 */
export async function startVisualContentCompletion(): Promise<void> {
  if (completionStats.isRunning) {
    console.log('Visual content completion already running');
    return;
  }

  try {
    completionStats.isRunning = true;
    completionStats.startTime = new Date();
    
    console.log('Starting visual content completion for remaining studies...');
    
    // Get initial statistics
    await updateCompletionStats();
    
    console.log(`Found ${completionStats.remaining} studies needing images`);
    
    if (completionStats.remaining === 0) {
      console.log('All studies already have images - visual content is 100% complete!');
      completionStats.isRunning = false;
      return;
    }

    // Process studies in batches
    await processVisualContentBatches();
    
  } catch (error) {
    console.error('Error starting visual content completion:', error);
    completionStats.isRunning = false;
  }
}

/**
 * Process studies in manageable batches
 */
async function processVisualContentBatches(): Promise<void> {
  const batchSize = 5; // Process 5 studies at a time
  
  while (completionStats.isRunning) {
    try {
      // Get next batch of studies without images
      const studiesResult = await db.execute(sql`
        SELECT id, title, category, abstract, methods_short, results_short
        FROM studies 
        WHERE image_url IS NULL OR image_url = ''
        ORDER BY id
        LIMIT ${batchSize}
      `);

      const studies = studiesResult.rows;
      
      if (studies.length === 0) {
        console.log('Visual content completion finished - all studies now have images!');
        completionStats.isRunning = false;
        break;
      }

      console.log(`Processing batch of ${studies.length} studies for image generation...`);

      // Process each study in the batch
      const promises = studies.map(async (study: any) => {
        try {
          console.log(`Generating image for study ${study.id}: ${study.title}`);
          
          const result = await generateImageForStudy(study.id);
          
          if (result.success) {
            completionStats.successful++;
            console.log(`✓ Image generated for study ${study.id}`);
          } else {
            completionStats.failed++;
            console.log(`✗ Failed to generate image for study ${study.id}: ${result.message}`);
          }
          
          completionStats.processed++;
          
        } catch (error) {
          completionStats.failed++;
          completionStats.processed++;
          console.error(`Error processing study ${study.id}:`, error);
        }
      });

      await Promise.all(promises);

      // Update statistics
      await updateCompletionStats();
      
      console.log(`Batch completed. Progress: ${completionStats.completed}/${completionStats.totalStudies} (${Math.round((completionStats.completed / completionStats.totalStudies) * 100)}%)`);
      
      // Short delay between batches to prevent overwhelming the system
      if (completionStats.remaining > 0) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
      
    } catch (error) {
      console.error('Error in batch processing:', error);
      // Continue with next batch after a longer delay
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
}

/**
 * Update completion statistics
 */
async function updateCompletionStats(): Promise<void> {
  try {
    const statsResult = await db.execute(sql`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN image_url IS NOT NULL AND image_url != '' THEN 1 END) as completed
      FROM studies
    `);

    const stats = statsResult.rows[0] as any;
    completionStats.totalStudies = Number(stats.total);
    completionStats.completed = Number(stats.completed);
    completionStats.remaining = completionStats.totalStudies - completionStats.completed;
    
  } catch (error) {
    console.error('Error updating completion stats:', error);
  }
}

/**
 * Stop visual content completion
 */
export function stopVisualContentCompletion(): void {
  completionStats.isRunning = false;
  console.log('Visual content completion stopped');
}

/**
 * Get current completion statistics
 */
export function getVisualCompletionStats(): VisualCompletionStats {
  return { ...completionStats };
}

/**
 * Get visual content completion progress as percentage
 */
export async function getVisualCompletionProgress(): Promise<number> {
  await updateCompletionStats();
  return completionStats.totalStudies > 0 
    ? Math.round((completionStats.completed / completionStats.totalStudies) * 100) 
    : 0;
}