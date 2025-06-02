/**
 * Fast Batch Tagging System
 * Processes multiple studies in parallel for faster completion
 */

import { tagSingleStudy, getTaggingStats } from "./automated-tagging-system";
import { db } from "./db";
import { studies } from "@shared/schema";

/**
 * Process studies in batches with parallel processing
 */
export async function processBatchTagging(batchSize: number = 10, totalBatches: number = 10): Promise<{
  studiesProcessed: number;
  tagsAdded: number;
  errors: number;
  avgProcessingTime: number;
}> {
  console.log(`Starting fast batch tagging: ${totalBatches} batches of ${batchSize} studies each`);
  
  let totalStudiesProcessed = 0;
  let totalTagsAdded = 0;
  let totalErrors = 0;
  let totalProcessingTime = 0;

  for (let batch = 0; batch < totalBatches; batch++) {
    console.log(`\nProcessing batch ${batch + 1}/${totalBatches}...`);
    
    // Get a batch of untagged studies
    const batchStudies = await db
      .select({ id: studies.id })
      .from(studies)
      .limit(batchSize)
      .offset(batch * batchSize);

    if (batchStudies.length === 0) {
      console.log('No more studies to process');
      break;
    }

    // Process batch in parallel (groups of 3 to manage API rate limits)
    const promises = [];
    for (let i = 0; i < batchStudies.length; i += 3) {
      const group = batchStudies.slice(i, i + 3);
      promises.push(processStudyGroup(group));
    }

    const results = await Promise.allSettled(promises);
    
    // Aggregate results
    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        totalStudiesProcessed += result.value.studiesProcessed;
        totalTagsAdded += result.value.tagsAdded;
        totalProcessingTime += result.value.totalTime;
      } else {
        console.error(`Error in group ${index}:`, result.reason);
        totalErrors++;
      }
    });

    console.log(`Batch ${batch + 1} complete: ${batchStudies.length} studies processed`);
    
    // Brief pause between batches
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  const avgProcessingTime = totalProcessingTime / Math.max(totalStudiesProcessed, 1);

  console.log('\n=== FAST BATCH TAGGING COMPLETE ===');
  console.log(`Studies processed: ${totalStudiesProcessed}`);
  console.log(`Tags added: ${totalTagsAdded}`);
  console.log(`Errors: ${totalErrors}`);
  console.log(`Average processing time: ${avgProcessingTime.toFixed(0)}ms per study`);

  return {
    studiesProcessed: totalStudiesProcessed,
    tagsAdded: totalTagsAdded,
    errors: totalErrors,
    avgProcessingTime
  };
}

/**
 * Process a small group of studies in sequence
 */
async function processStudyGroup(studyGroup: { id: number }[]): Promise<{
  studiesProcessed: number;
  tagsAdded: number;
  totalTime: number;
}> {
  let studiesProcessed = 0;
  let tagsAdded = 0;
  let totalTime = 0;

  for (const study of studyGroup) {
    try {
      const result = await tagSingleStudy(study.id);
      studiesProcessed++;
      tagsAdded += result.tagsAdded;
      totalTime += result.processingTime;
      
      if (result.tagsAdded > 0) {
        console.log(`  Study ${study.id}: ${result.tagsAdded} tags added`);
      }
      
      // Small delay between studies in the same group
      await new Promise(resolve => setTimeout(resolve, 500));
      
    } catch (error) {
      console.error(`Error processing study ${study.id}:`, error);
    }
  }

  return { studiesProcessed, tagsAdded, totalTime };
}