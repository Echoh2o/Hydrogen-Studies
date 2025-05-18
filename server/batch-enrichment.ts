/**
 * Batch Content Enrichment Service
 * 
 * Provides functionality to batch process studies for content enrichment
 * including fetching full abstracts, texts, and images from external sources.
 * Also generates AI-powered tags and simplified explanations.
 */
import { db } from './db';
import { studies as studiesTable } from '../shared/schema';
import { eq, isNull, lt, or } from 'drizzle-orm';
import { enhanceStudyContent as fetchEnhancedContent } from './content-enrichment';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Interface for tracking batch processing status
interface BatchProcessingStats {
  totalToProcess: number;
  processed: number;
  success: number;
  failed: number;
  skipped: number;
  errors: Array<{studyId: number; error: string}>;
  inProgress: boolean;
  startedAt?: Date;
  completedAt?: Date;
}

// Result of enhancing a single study
interface EnhancementResult {
  success: boolean;
  message: string;
  updates?: {
    abstract?: boolean;
    fullText?: boolean;
    images?: boolean;
    methods?: boolean;
    results?: boolean;
    conclusion?: boolean;
    tags?: boolean;
    simplifiedExplanation?: boolean;
  };
  studyId?: number;
}

// Global variable to hold processing state
let processingStats: BatchProcessingStats | null = null;

/**
 * Start batch processing of studies for content enrichment
 * @param batchSize Number of studies to process in each batch
 * @param maxStudies Maximum number of studies to process in total
 * @returns Initial processing stats
 */
export async function startBatchEnrichment(
  batchSize: number = 10,
  maxStudies: number = 100
): Promise<BatchProcessingStats> {
  if (processingStats && processingStats.inProgress) {
    return processingStats;
  }

  // Find studies that need enrichment
  const studyIds = await findStudiesForEnhancement(maxStudies);
  
  if (studyIds.length === 0) {
    return {
      totalToProcess: 0,
      processed: 0,
      success: 0,
      failed: 0,
      skipped: 0,
      errors: [],
      inProgress: false,
      startedAt: new Date(),
      completedAt: new Date()
    };
  }

  // Initialize processing stats
  processingStats = {
    totalToProcess: studyIds.length,
    processed: 0,
    success: 0,
    failed: 0,
    skipped: 0,
    errors: [],
    inProgress: true,
    startedAt: new Date()
  };

  // Start processing batches in the background
  processBatches(studyIds, batchSize).catch(error => {
    console.error('Error in batch processing:', error);
    if (processingStats) {
      processingStats.inProgress = false;
      processingStats.completedAt = new Date();
    }
  });

  return processingStats;
}

/**
 * Get the current status of batch processing
 * @returns Current processing stats or null if no processing has been started
 */
export function getBatchEnrichmentStatus(): BatchProcessingStats | null {
  return processingStats;
}

/**
 * Process studies in batches
 * @param studyIds Array of study IDs to process
 * @param batchSize Number of studies to process in each batch
 */
async function processBatches(studyIds: number[], batchSize: number): Promise<void> {
  try {
    console.log(`Starting batch processing of ${studyIds.length} studies with batch size ${batchSize}`);
    
    // Process studies one at a time to avoid rate limits
    // We'll use a smaller effective batch size to update the UI more frequently
    const effectiveBatchSize = 1;
    
    for (let i = 0; i < studyIds.length; i += effectiveBatchSize) {
      const batchIds = studyIds.slice(i, i + effectiveBatchSize);
      
      try {
        await processBatch(batchIds);
      } catch (error) {
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
        // Let the individual process increment this now
        // processingStats.processed = i + effectiveBatchSize;
        console.log(`Progress: ${processingStats.processed}/${processingStats.totalToProcess} studies processed`);
      }
    }
  } catch (error) {
    console.error('Error in overall batch processing:', error);
  } finally {
    if (processingStats) {
      processingStats.inProgress = false;
      processingStats.completedAt = new Date();
      console.log(`Batch processing complete. Final stats: ${JSON.stringify(processingStats)}`);
    }
  }
}

/**
 * Process a single batch of studies
 * @param batchIds Array of study IDs to process in this batch
 */
async function processBatch(batchIds: number[]): Promise<void> {
  console.log(`Processing batch of ${batchIds.length} studies: ${batchIds.join(', ')}`);
  
  // To avoid OpenAI rate limits, process studies sequentially instead of in parallel
  // with a significant delay between studies
  for (const studyId of batchIds) {
    try {
      console.log(`Starting to process study ${studyId}`);
      
      // Always increment processed count at the start
      // This ensures the UI shows progress even if we hit errors
      if (processingStats) {
        processingStats.processed++;
      }
      
      // Try to process the study with built-in retry for rate limits
      try {
        const result = await enhanceStudyContent(studyId);
        
        if (processingStats) {
          if (result.success) {
            processingStats.success++;
            console.log(`Successfully enhanced study ${studyId}`);
          } else {
            processingStats.failed++;
            processingStats.errors.push({
              studyId,
              error: result.message
            });
            console.log(`Failed to enhance study ${studyId}: ${result.message}`);
          }
        }
      } catch (processingError) {
        // Check if it's a rate limit error
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
    // This delay happens even if the batch is marked as not in progress
    console.log(`Waiting 5 seconds before processing next study...`);
    await new Promise(resolve => setTimeout(resolve, 5000)); // 5 second pause
    
    // Check if we should stop processing
    if (!processingStats?.inProgress) {
      console.log(`Batch processing was cancelled, stopping after study ${studyId}`);
      break;
    }
  }
  
  console.log(`Completed batch processing. Stats: ${JSON.stringify(processingStats)}`);
}

/**
 * Find studies that need content enrichment
 * @param limit Maximum number of studies to return
 * @returns Array of study IDs that need enrichment
 */
async function findStudiesForEnhancement(limit: number = 50): Promise<number[]> {
  try {
    // Find studies that need content enrichment
    // We'll look for studies that have missing or empty:
    // - methods
    // - results 
    // - conclusion
    // These fields exist in our schema and can be enhanced with AI
    const incompleteStudies = await db.select({ id: studiesTable.id })
      .from(studiesTable)
      .where(
        or(
          // Missing or empty fields that we know exist in the schema
          eq(studiesTable.abstract, ''),
          eq(studiesTable.methods, ''),
          eq(studiesTable.results, ''),
          eq(studiesTable.conclusion, '')
        )
      )
      .limit(limit);

    // If no studies with empty content, look for null content
    if (incompleteStudies.length === 0) {
      const nullValueStudies = await db.select({ id: studiesTable.id })
        .from(studiesTable)
        .where(
          or(
            isNull(studiesTable.methods),
            isNull(studiesTable.results),
            isNull(studiesTable.conclusion)
          )
        )
        .limit(limit);
        
      return nullValueStudies.map(study => study.id);
    }

    return incompleteStudies.map(study => study.id);
  } catch (error) {
    console.error('Error finding studies for enhancement:', error);
    return [];
  }
}

/**
 * Enhance a single study's content with external data and AI-generated improvements
 * @param studyId ID of the study to enhance
 * @returns Result of the enhancement process
 */
export async function enhanceStudyContent(studyId: number): Promise<EnhancementResult> {
  try {
    // Get the original study
    const [study] = await db.select().from(studiesTable).where(eq(studiesTable.id, studyId));
    
    if (!study) {
      return {
        success: false,
        message: `Study with ID ${studyId} not found`,
        studyId
      };
    }

    // Use content enrichment to fetch external data
    const contentEnhancementResult = await fetchEnhancedContent(studyId);
    
    // If content enhancement failed, still continue with AI generation
    let updateData: any = { ...study };
    
    if (contentEnhancementResult.success && contentEnhancementResult.updates) {
      // Copy updates from content enrichment
      if (contentEnhancementResult.updates.abstract && study.abstract) {
        updateData.abstract = study.abstract;
      }
      if (contentEnhancementResult.updates.methods && study.methods) {
        updateData.methods = study.methods;
      }
      if (contentEnhancementResult.updates.results && study.results) {
        updateData.results = study.results;
      }
      if (contentEnhancementResult.updates.conclusion && study.conclusion) {
        updateData.conclusion = study.conclusion;
      }
    }

    // Check if we need to generate missing sections using AI
    const updates: Record<string, boolean> = { ...contentEnhancementResult.updates };
    
    // Generate missing sections if needed
    if (!updateData.methods || updateData.methods.length < 50) {
      const methodsText = await generateSectionUsingAI(study, updateData, 'methods');
      if (methodsText) {
        updateData.methods = methodsText;
        updates.methods = true;
      }
    }
    
    if (!updateData.results || updateData.results.length < 50) {
      const resultsText = await generateSectionUsingAI(study, updateData, 'results');
      if (resultsText) {
        updateData.results = resultsText;
        updates.results = true;
      }
    }
    
    if (!updateData.conclusion || updateData.conclusion.length < 50) {
      const conclusionText = await generateSectionUsingAI(study, updateData, 'conclusion');
      if (conclusionText) {
        updateData.conclusion = conclusionText;
        updates.conclusion = true;
      }
    }
    
    // Generate standardized summary fields if missing using the existing generateSectionUsingAI function
    if (!updateData.methodsShort || updateData.methodsShort?.length < 50) {
      // We'll use the existing generateSectionUsingAI with a modified prompt
      const methodsText = await generateSectionUsingAI(study, updateData, 'methods');
      if (methodsText) {
        // Create a shorter version for the methodsShort field
        const methodsShort = methodsText.split('.').slice(0, 2).join('.') + '.';
        updateData.methodsShort = methodsShort;
        updates.methodsShort = true;
      }
    }
    
    if (!updateData.resultsShort || updateData.resultsShort?.length < 50) {
      // We'll use the existing generateSectionUsingAI with a modified prompt
      const resultsText = await generateSectionUsingAI(study, updateData, 'results');
      if (resultsText) {
        // Create a shorter version for the resultsShort field
        const resultsShort = resultsText.split('.').slice(0, 2).join('.') + '.';
        updateData.resultsShort = resultsShort;
        updates.resultsShort = true;
      }
    }
    
    if (!updateData.conclusionShort || updateData.conclusionShort?.length < 50) {
      // We'll use the existing generateSectionUsingAI with a modified prompt
      const conclusionText = await generateSectionUsingAI(study, updateData, 'conclusion');
      if (conclusionText) {
        // Create a shorter version for the conclusionShort field
        const conclusionShort = conclusionText.split('.').slice(0, 2).join('.') + '.';
        updateData.conclusionShort = conclusionShort;
        updates.conclusionShort = true;
      }
    }
    
    // Generate summary markdown if missing
    if (!updateData.summaryMarkdown || updateData.summaryMarkdown?.length < 100) {
      // Generate a markdown summary
      const title = study.title;
      const authors = study.authors;
      const journal = study.journal;
      const publishDate = study.journalPublishDate || study.publishDate;
      const abstract = updateData.abstract || study.abstract || '';
      const methods = updateData.methods || study.methods || '';
      const results = updateData.results || study.results || '';
      const conclusion = updateData.conclusion || study.conclusion || '';
      
      // Create the markdown content
      const summaryMarkdown = `
## ${title}

**Authors**: ${authors || 'Not specified'}
**Journal**: ${journal || 'Not specified'}
**Published**: ${publishDate || 'Not specified'}

### Abstract
${abstract}

${methods ? `### Methods\n${methods}` : ''}
${results ? `### Results\n${results}` : ''}
${conclusion ? `### Conclusion\n${conclusion}` : ''}
`;
      
      if (summaryMarkdown) {
        updateData.summaryMarkdown = summaryMarkdown;
        updates.summaryMarkdown = true;
      }
    }

    // Update the study in the database
    await db.update(studiesTable)
      .set({
        ...updateData,
        updatedAt: new Date()
      })
      .where(eq(studiesTable.id, studyId));

    return {
      success: true,
      message: 'Study content enhanced successfully',
      updates,
      studyId
    };
  } catch (error) {
    console.error(`Error enhancing study ${studyId}:`, error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error occurred',
      studyId
    };
  }
}

/**
 * Generate content for a missing section using AI
 * @param study Original study data
 * @param updateData Updated study data
 * @param section Section to generate (methods, results, conclusion)
 * @returns Generated section text or null if generation failed
 */
async function generateSectionUsingAI(
  study: any,
  updateData: any,
  section: 'methods' | 'results' | 'conclusion'
): Promise<string | null> {
  try {
    if (!process.env.OPENAI_API_KEY) {
      console.warn('OPENAI_API_KEY not set, skipping AI generation');
      return null;
    }

    // Use available data to create context for the AI
    const title = study.title || '';
    const abstract = study.abstract || updateData.abstract || '';
    
    // Create a section-specific prompt
    let prompt = '';
    if (section === 'methods') {
      prompt = `Based on the following title and abstract of a hydrogen research study, generate a detailed methods section. 
      The methods section should describe how the study was conducted, what techniques were used, and how the data was collected and analyzed. 
      Format your response as follows:
      
      Title: ${title}
      
      Abstract: ${abstract}
      
      Methods:`;
    } else if (section === 'results') {
      const methods = study.methods || updateData.methods || '';
      prompt = `Based on the following title, abstract, and methods of a hydrogen research study, generate a detailed results section. 
      The results section should describe the findings of the study, including any data, measurements, observations, and outcomes that were observed.
      
      Title: ${title}
      
      Abstract: ${abstract}
      
      Methods: ${methods}
      
      Results:`;
    } else if (section === 'conclusion') {
      const results = study.results || updateData.results || '';
      prompt = `Based on the following title, abstract, and results of a hydrogen research study, generate a detailed conclusion section. 
      The conclusion should summarize the key findings, discuss their implications, mention any limitations of the study, and suggest future research directions.
      
      Title: ${title}
      
      Abstract: ${abstract}
      
      Results: ${results}
      
      Conclusion:`;
    }

    // Call OpenAI to generate the section
    const response = await openai.chat.completions.create({
      model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
      messages: [
        {
          role: "system",
          content: `You are a scientific writing assistant specialized in hydrogen health research. 
          Your task is to generate high-quality, scientifically accurate content based on the available information. 
          If you don't have enough information to generate accurate content, acknowledge the limitations in your response.
          Write in a formal, academic tone appropriate for scientific research papers.`
        },
        { role: "user", content: prompt }
      ],
      max_tokens: 800,
      temperature: 0.3,
    });

    // Extract and return the generated text
    return response.choices[0].message.content.trim();
  } catch (error) {
    console.error(`Error generating ${section} using AI:`, error);
    return null;
  }
}

/**
 * Generate tags/keywords for a study using AI
 * @param study Original study data
 * @param updateData Updated study data
 * @returns Array of generated tags/keywords or null if generation failed
 */
async function generateTagsUsingAI(study: any, updateData: any): Promise<string[] | null> {
  try {
    if (!process.env.OPENAI_API_KEY) {
      console.warn('OPENAI_API_KEY not set, skipping AI generation');
      return null;
    }

    // Use available data to create context for the AI
    const title = study.title || '';
    const abstract = study.abstract || updateData.abstract || '';
    
    // Create a prompt for tag generation
    const prompt = `Generate 5-10 relevant tags or keywords for the following hydrogen health research study. 
    Return these keywords as a JSON array of strings.
    
    Title: ${title}
    
    Abstract: ${abstract}`;

    // Call OpenAI to generate tags
    const response = await openai.chat.completions.create({
      model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
      messages: [
        {
          role: "system",
          content: `You are a scientific research assistant specialized in hydrogen health studies.
          Your task is to generate relevant tags/keywords for research papers.
          Return only the array of keywords as JSON, no additional text.`
        },
        { role: "user", content: prompt }
      ],
      response_format: { type: "json_object" },
      max_tokens: 300,
      temperature: 0.3,
    });

    // Parse and return the generated tags
    const content = response.choices[0].message.content;
    const parsedContent = JSON.parse(content);
    
    // Extract tags from the JSON response
    return Array.isArray(parsedContent.keywords) 
      ? parsedContent.keywords 
      : Array.isArray(parsedContent.tags) 
        ? parsedContent.tags 
        : Object.values(parsedContent)[0];
  } catch (error) {
    console.error('Error generating tags using AI:', error);
    return null;
  }
}

/**
 * Generate simplified explanation of the study using AI
 * @param study Original study data
 * @param updateData Updated study data
 * @returns Simplified explanation in markdown format or null if generation failed
 */
async function generateSimplifiedExplanation(study: any, updateData: any): Promise<string | null> {
  try {
    if (!process.env.OPENAI_API_KEY) {
      console.warn('OPENAI_API_KEY not set, skipping AI generation');
      return null;
    }

    // Use available data to create context for the AI
    const title = study.title || '';
    const abstract = study.abstract || updateData.abstract || '';
    const methods = study.methods || updateData.methods || '';
    const results = study.results || updateData.results || '';
    const conclusion = study.conclusion || updateData.conclusion || '';
    
    // Create a prompt for simplified explanation
    const prompt = `Create a simplified explanation of the following hydrogen health research study in 3-5 paragraphs.
    Explain the key findings, why they matter, and their potential impact on health in language that a non-scientist can understand.
    Format your response in markdown with appropriate headings and bullet points for clarity. Include a "Key Takeaways" section at the end.
    
    Title: ${title}
    
    Abstract: ${abstract}
    
    Methods: ${methods}
    
    Results: ${results}
    
    Conclusion: ${conclusion}`;

    // Call OpenAI to generate simplified explanation
    const response = await openai.chat.completions.create({
      model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
      messages: [
        {
          role: "system",
          content: `You are a science communicator specialized in explaining complex hydrogen health research to the general public.
          Your task is to create clear, accurate, and engaging explanations that maintain scientific integrity while being accessible.
          Use simple language, avoid jargon, and focus on the practical implications for health and wellness.`
        },
        { role: "user", content: prompt }
      ],
      max_tokens: 1000,
      temperature: 0.5,
    });

    // Extract and return the generated explanation
    return response.choices[0].message.content.trim();
  } catch (error) {
    console.error('Error generating simplified explanation using AI:', error);
    return null;
  }
}