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
    // Process in batches
    for (let i = 0; i < studyIds.length; i += batchSize) {
      const batchIds = studyIds.slice(i, i + batchSize);
      await processBatch(batchIds);
      
      // Update the progress after each batch
      if (processingStats) {
        processingStats.processed = i + batchIds.length;
      }
    }
  } catch (error) {
    console.error('Error in batch processing:', error);
    throw error;
  } finally {
    if (processingStats) {
      processingStats.inProgress = false;
      processingStats.completedAt = new Date();
    }
  }
}

/**
 * Process a single batch of studies
 * @param batchIds Array of study IDs to process in this batch
 */
async function processBatch(batchIds: number[]): Promise<void> {
  // Process each study in parallel
  const promises = batchIds.map(async (studyId) => {
    try {
      const result = await enhanceStudyContent(studyId);

      if (processingStats) {
        if (result.success) {
          processingStats.success++;
        } else {
          processingStats.failed++;
          processingStats.errors.push({
            studyId,
            error: result.message
          });
        }
      }

      return result;
    } catch (error) {
      console.error(`Error processing study ${studyId}:`, error);
      
      if (processingStats) {
        processingStats.failed++;
        processingStats.errors.push({
          studyId,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
      
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
        studyId
      };
    }
  });

  await Promise.all(promises);
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
      if (contentEnhancementResult.updates.fullText && study.fullText) {
        updateData.fullText = study.fullText;
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
    
    // Generate tags/keywords using AI
    if (!updateData.tags || updateData.tags.length < 5) {
      const tags = await generateTagsUsingAI(study, updateData);
      if (tags && tags.length > 0) {
        updateData.tags = tags.join(', ');
        updates.tags = true;
      }
    }
    
    // Generate simplified explanation if missing
    if (!updateData.simplifiedExplanation || updateData.simplifiedExplanation.length < 100) {
      const simplifiedExplanation = await generateSimplifiedExplanation(study, updateData);
      if (simplifiedExplanation) {
        updateData.simplifiedExplanation = simplifiedExplanation;
        updates.simplifiedExplanation = true;
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