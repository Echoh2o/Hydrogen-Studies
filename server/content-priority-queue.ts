/**
 * Content Priority Queue for Hydrogen Studies Database
 * 
 * Implements a priority-based approach to enriching study content,
 * focusing on studies with the most significant data gaps first.
 */
import { db } from './db';
import { studies as studiesTable } from '../shared/schema';
import { eq, isNull, lt, or, asc, and, count } from 'drizzle-orm';
import { enhanceStudyContent } from './batch-enrichment';

// Types of content gaps that need to be addressed
export enum ContentGapType {
  METHODS = 'methods',
  RESULTS = 'results',
  CONCLUSION = 'conclusion', 
  ABSTRACT = 'abstract',
  IMAGES = 'images',
  SIMPLIFIED_EXPLANATION = 'simplified_explanation'
}

// Interface for tracking content gaps
export interface ContentGapStats {
  totalStudies: number;
  missingMethods: number;
  missingResults: number;
  missingConclusion: number;
  missingAbstract: number;
  missingImages: number;
  missingSimplifiedExplanation: number;
}

// Interface for tracking priority processing status
export interface PriorityProcessingStats {
  inProgress: boolean;
  currentPriority: ContentGapType | null;
  processed: number;
  total: number;
  success: number;
  failed: number;
  startedAt?: Date;
  completedAt?: Date;
  errors: Array<{studyId: number; error: string}>;
}

// Global variable to hold processing state
let processingStats: PriorityProcessingStats | null = null;

/**
 * Get statistics about content gaps in the database
 * This helps identify which areas need the most attention
 */
export async function getContentGapStatistics(): Promise<ContentGapStats> {
  try {
    const stats: ContentGapStats = {
      totalStudies: 0,
      missingMethods: 0,
      missingResults: 0,
      missingConclusion: 0,
      missingAbstract: 0,
      missingImages: 0,
      missingSimplifiedExplanation: 0
    };
    
    // Get total number of studies
    const totalResult = await db?.select({ count: count() }).from(studiesTable) || [{ count: 0 }];
    stats.totalStudies = totalResult[0].count;
    
    // Count studies with missing methods
    const missingMethodsResult = await db?.select({ count: count() })
      .from(studiesTable)
      .where(or(
        isNull(studiesTable.methods),
        eq(studiesTable.methods, '')
      )) || [{ count: 0 }];
    stats.missingMethods = missingMethodsResult[0].count;
    
    // Count studies with missing results
    const missingResultsResult = await db?.select({ count: count() })
      .from(studiesTable)
      .where(or(
        isNull(studiesTable.results),
        eq(studiesTable.results, '')
      )) || [{ count: 0 }];
    stats.missingResults = missingResultsResult[0].count;
    
    // Count studies with missing conclusion
    const missingConclusionResult = await db?.select({ count: count() })
      .from(studiesTable)
      .where(or(
        isNull(studiesTable.conclusion),
        eq(studiesTable.conclusion, '')
      )) || [{ count: 0 }];
    stats.missingConclusion = missingConclusionResult[0].count;
    
    // Count studies with missing abstract
    const missingAbstractResult = await db?.select({ count: count() })
      .from(studiesTable)
      .where(or(
        isNull(studiesTable.abstract),
        eq(studiesTable.abstract, '')
      )) || [{ count: 0 }];
    stats.missingAbstract = missingAbstractResult[0].count;
    
    // Count studies with missing images
    const missingImagesResult = await db?.select({ count: count() })
      .from(studiesTable)
      .where(isNull(studiesTable.imageUrl)) || [{ count: 0 }];
    stats.missingImages = missingImagesResult[0].count;
    
    // Count studies with missing simplified explanation
    const missingExplanationResult = await db?.select({ count: count() })
      .from(studiesTable)
      .where(or(
        isNull(studiesTable.simplifiedExplanation),
        eq(studiesTable.simplifiedExplanation, '')
      )) || [{ count: 0 }];
    stats.missingSimplifiedExplanation = missingExplanationResult[0].count;
    
    return stats;
  } catch (error) {
    console.error('Error getting content gap statistics:', error);
    // Return default zeros if there's an error
    return {
      totalStudies: 0,
      missingMethods: 0,
      missingResults: 0,
      missingConclusion: 0,
      missingAbstract: 0,
      missingImages: 0,
      missingSimplifiedExplanation: 0
    };
  }
}

/**
 * Determine the highest priority content gap to address based on statistics
 * @param stats Content gap statistics
 * @returns Highest priority content gap type
 */
function determineHighestPriority(stats: ContentGapStats): ContentGapType {
  // Create an array of gaps and their respective percentages
  const gaps = [
    { type: ContentGapType.ABSTRACT, percentage: stats.missingAbstract / stats.totalStudies },
    { type: ContentGapType.METHODS, percentage: stats.missingMethods / stats.totalStudies },
    { type: ContentGapType.RESULTS, percentage: stats.missingResults / stats.totalStudies },
    { type: ContentGapType.CONCLUSION, percentage: stats.missingConclusion / stats.totalStudies },
    { type: ContentGapType.IMAGES, percentage: stats.missingImages / stats.totalStudies },
    { type: ContentGapType.SIMPLIFIED_EXPLANATION, percentage: stats.missingSimplifiedExplanation / stats.totalStudies }
  ];
  
  // Sort by percentage (highest first)
  gaps.sort((a, b) => b.percentage - a.percentage);
  
  // Return the gap type with the highest percentage
  return gaps[0].type;
}

/**
 * Find studies that need enrichment for a specific content gap type
 * @param gapType Type of content gap to address
 * @param limit Maximum number of studies to return
 * @returns Array of study IDs that need enrichment
 */
async function findStudiesForGapType(gapType: ContentGapType, limit: number = 50): Promise<number[]> {
  try {
    // Create the appropriate WHERE clause based on the gap type
    let whereClause;
    
    switch (gapType) {
      case ContentGapType.ABSTRACT:
        whereClause = or(
          isNull(studiesTable.abstract),
          eq(studiesTable.abstract, '')
        );
        break;
      case ContentGapType.METHODS:
        whereClause = or(
          isNull(studiesTable.methods),
          eq(studiesTable.methods, '')
        );
        break;
      case ContentGapType.RESULTS:
        whereClause = or(
          isNull(studiesTable.results),
          eq(studiesTable.results, '')
        );
        break;
      case ContentGapType.CONCLUSION:
        whereClause = or(
          isNull(studiesTable.conclusion),
          eq(studiesTable.conclusion, '')
        );
        break;
      case ContentGapType.IMAGES:
        whereClause = isNull(studiesTable.imageUrl);
        break;
      case ContentGapType.SIMPLIFIED_EXPLANATION:
        whereClause = or(
          isNull(studiesTable.simplifiedExplanation),
          eq(studiesTable.simplifiedExplanation, '')
        );
        break;
      default:
        // Default to methods as it's commonly missing
        whereClause = or(
          isNull(studiesTable.methods),
          eq(studiesTable.methods, '')
        );
    }
    
    // Find studies with the specified gap
    const studies = await db?.select({ id: studiesTable.id })
      .from(studiesTable)
      .where(whereClause)
      .orderBy(asc(studiesTable.id))
      .limit(limit);
    
    if (!studies || studies.length === 0) {
      return [];
    }
    
    return studies.map(study => study.id);
  } catch (error) {
    console.error(`Error finding studies for gap type ${gapType}:`, error);
    return [];
  }
}

/**
 * Start priority-based content enrichment process
 * @param batchSize Number of studies to process in each batch
 * @param maxStudies Maximum number of studies to process in total
 * @returns Initial processing stats
 */
export async function startPriorityEnrichment(
  batchSize: number = 10,
  maxStudies: number = 100
): Promise<PriorityProcessingStats> {
  // If already in progress, return current stats
  if (processingStats && processingStats.inProgress) {
    return processingStats;
  }
  
  // Get content gap statistics to determine priorities
  const gapStats = await getContentGapStatistics();
  console.log('Content gap statistics:', gapStats);
  
  // Determine highest priority gap type
  const priorityGap = determineHighestPriority(gapStats);
  console.log(`Highest priority gap: ${priorityGap}`);
  
  // Find studies with that gap type
  const studyIds = await findStudiesForGapType(priorityGap, maxStudies);
  
  if (studyIds.length === 0) {
    return {
      inProgress: false,
      currentPriority: priorityGap,
      processed: 0,
      total: 0,
      success: 0,
      failed: 0,
      startedAt: new Date(),
      completedAt: new Date(),
      errors: []
    };
  }
  
  // Initialize processing stats
  processingStats = {
    inProgress: true,
    currentPriority: priorityGap,
    processed: 0,
    total: studyIds.length,
    success: 0,
    failed: 0,
    startedAt: new Date(),
    errors: []
  };
  
  // Start processing batches in the background
  processPriorityBatches(studyIds, batchSize, priorityGap).catch(error => {
    console.error('Error in priority batch processing:', error);
    if (processingStats) {
      processingStats.inProgress = false;
      processingStats.completedAt = new Date();
    }
  });
  
  return { ...processingStats };
}

/**
 * Get the current status of priority content enrichment
 * @returns Current processing stats or null if no processing has been started
 */
export function getPriorityEnrichmentStatus(): PriorityProcessingStats | null {
  return processingStats ? { ...processingStats } : null;
}

/**
 * Process studies in batches based on priority
 * @param studyIds Array of study IDs to process
 * @param batchSize Number of studies to process in each batch
 * @param gapType Current gap type being addressed
 */
async function processPriorityBatches(
  studyIds: number[], 
  batchSize: number,
  gapType: ContentGapType
): Promise<void> {
  try {
    console.log(`Starting priority batch processing of ${studyIds.length} studies for ${gapType} with batch size ${batchSize}`);
    
    // Process studies in smaller batches to avoid overwhelming the system
    const effectiveBatchSize = 1; // Process one at a time for better stability
    
    for (let i = 0; i < studyIds.length; i += effectiveBatchSize) {
      const batchIds = studyIds.slice(i, i + effectiveBatchSize);
      
      try {
        await processPriorityBatch(batchIds, gapType);
      } catch (error: any) {
        console.error(`Error processing batch ${i / effectiveBatchSize + 1}:`, error);
        
        // Continue with the next batch even if this one failed
        if (error.toString().includes('rate_limit_exceeded')) {
          console.log('Hit rate limit, pausing for 10 seconds before continuing...');
          // If rate limited, wait longer before trying the next study
          await new Promise(resolve => setTimeout(resolve, 10000));
        }
      }
      
      // Update the progress after each batch
      if (processingStats) {
        console.log(`Progress: ${processingStats.processed}/${processingStats.total} studies processed for ${gapType}`);
      }
    }
  } catch (error) {
    console.error('Error in overall priority batch processing:', error);
  } finally {
    if (processingStats) {
      processingStats.inProgress = false;
      processingStats.completedAt = new Date();
      console.log(`Priority batch processing complete for ${gapType}. Final stats:`, processingStats);
    }
  }
}

/**
 * Process a single batch of studies based on priority
 * @param batchIds Array of study IDs to process in this batch
 * @param gapType Current gap type being addressed
 */
async function processPriorityBatch(batchIds: number[], gapType: ContentGapType): Promise<void> {
  console.log(`Processing batch of ${batchIds.length} studies for ${gapType}: ${batchIds.join(', ')}`);
  
  // Process studies sequentially with appropriate delay to avoid rate limits
  for (const studyId of batchIds) {
    try {
      console.log(`Starting to process study ${studyId} for ${gapType}`);
      
      // Always increment processed count at the start
      if (processingStats) {
        processingStats.processed++;
      }
      
      // Try to process the study with retry for rate limits
      try {
        const result = await enhanceStudyContent(studyId);
        
        if (processingStats) {
          if (result.success) {
            processingStats.success++;
            console.log(`Successfully enhanced study ${studyId} for ${gapType}`);
          } else {
            processingStats.failed++;
            processingStats.errors.push({
              studyId,
              error: result.message
            });
            console.log(`Failed to enhance study ${studyId} for ${gapType}: ${result.message}`);
          }
        }
      } catch (processingError: any) {
        // Handle rate limit errors with retry
        if (processingError.toString().includes('rate_limit_exceeded')) {
          console.log(`Rate limit hit for study ${studyId}. Waiting 15 seconds before continuing...`);
          await new Promise(resolve => setTimeout(resolve, 15000)); // 15 second pause
          
          // Try once more after the pause
          try {
            const retryResult = await enhanceStudyContent(studyId);
            if (processingStats) {
              if (retryResult.success) {
                processingStats.success++;
                console.log(`Successfully enhanced study ${studyId} on retry`);
              } else {
                processingStats.failed++;
                processingStats.errors.push({
                  studyId,
                  error: retryResult.message
                });
              }
            }
          } catch (retryError) {
            // If retry also fails, count as a failure but continue batch
            console.error(`Retry failed for study ${studyId}:`, retryError);
            if (processingStats) {
              processingStats.failed++;
              processingStats.errors.push({
                studyId,
                error: `Retry failed: ${retryError instanceof Error ? retryError.message : 'Unknown error'}`
              });
            }
          }
        } else {
          // Not a rate limit error
          console.error(`Error processing study ${studyId}:`, processingError);
          if (processingStats) {
            processingStats.failed++;
            processingStats.errors.push({
              studyId,
              error: processingError instanceof Error ? processingError.message : 'Unknown error'
            });
          }
        }
      }
    } catch (outerError) {
      // This catches any errors in the outer try block
      console.error(`Unexpected error processing study ${studyId}:`, outerError);
      
      if (processingStats) {
        // Even on error, we count this as processed
        processingStats.failed++;
        processingStats.errors.push({
          studyId,
          error: outerError instanceof Error ? outerError.message : 'Unknown error'
        });
      }
    }
    
    // Always add a significant delay between studies to avoid rate limits
    console.log(`Waiting 5 seconds before processing next study for ${gapType}...`);
    await new Promise(resolve => setTimeout(resolve, 5000)); // 5 second pause
    
    // Check if we should stop processing
    if (!processingStats?.inProgress) {
      console.log(`Priority batch processing was cancelled, stopping after study ${studyId}`);
      break;
    }
  }
  
  console.log(`Completed batch processing for ${gapType}. Stats:`, processingStats);
}