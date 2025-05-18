/**
 * Batch Content Enrichment Service
 * 
 * Provides functionality to batch process studies for content enrichment
 * including fetching full abstracts, texts, and images from external sources.
 * Also generates AI-powered tags and simplified explanations.
 */

import { db } from './db';
import { sql } from 'drizzle-orm';
import { studies } from '@shared/schema';
import OpenAI from 'openai';

// Initialize OpenAI client
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

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

// Global state to track current batch processing
let currentBatchProcessing: BatchProcessingStats | null = null;

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
  // Don't start a new batch process if one is already running
  if (currentBatchProcessing && currentBatchProcessing.inProgress) {
    return currentBatchProcessing;
  }

  // Find studies that need enrichment
  const studyIds = await findStudiesForEnhancement(maxStudies);
  
  // Initialize stats
  currentBatchProcessing = {
    totalToProcess: studyIds.length,
    processed: 0,
    success: 0,
    failed: 0,
    skipped: 0,
    errors: [],
    inProgress: true,
    startedAt: new Date()
  };

  // Process studies in batches to avoid overwhelming the system
  processBatches(studyIds, batchSize);
  
  return currentBatchProcessing;
}

/**
 * Get the current status of batch processing
 * @returns Current processing stats or null if no processing has been started
 */
export function getBatchEnrichmentStatus(): BatchProcessingStats | null {
  return currentBatchProcessing;
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
      
      // Update stats
      if (currentBatchProcessing) {
        currentBatchProcessing.processed += batchIds.length;
        
        // If all studies have been processed, mark as completed
        if (currentBatchProcessing.processed >= currentBatchProcessing.totalToProcess) {
          currentBatchProcessing.inProgress = false;
          currentBatchProcessing.completedAt = new Date();
        }
      }
    }
  } catch (error) {
    console.error('Error in batch processing:', error);
    
    // Mark process as failed but complete
    if (currentBatchProcessing) {
      currentBatchProcessing.inProgress = false;
      currentBatchProcessing.completedAt = new Date();
    }
  }
}

/**
 * Process a single batch of studies
 * @param batchIds Array of study IDs to process in this batch
 */
async function processBatch(batchIds: number[]): Promise<void> {
  for (const studyId of batchIds) {
    try {
      // Enrich the study content
      const result = await enhanceStudyContent(studyId);
      
      // Update stats
      if (currentBatchProcessing) {
        if (result.success) {
          currentBatchProcessing.success++;
        } else {
          currentBatchProcessing.failed++;
          currentBatchProcessing.errors.push({
            studyId,
            error: result.message
          });
        }
      }
    } catch (error) {
      console.error(`Error processing study ${studyId}:`, error);
      
      // Update error stats
      if (currentBatchProcessing) {
        currentBatchProcessing.failed++;
        currentBatchProcessing.errors.push({
          studyId,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
  }
}

/**
 * Find studies that need content enrichment
 * @param limit Maximum number of studies to return
 * @returns Array of study IDs that need enrichment
 */
async function findStudiesForEnhancement(limit: number = 50): Promise<number[]> {
  try {
    // Find studies with DOIs that haven't been enriched
    // Prioritize studies with missing or short abstracts
    const result = await db.execute(sql`
      SELECT id FROM studies 
      WHERE doi IS NOT NULL AND doi != '' 
      AND (
        abstract IS NULL 
        OR LENGTH(abstract) < 200
        OR methods IS NULL
        OR results IS NULL
        OR conclusion IS NULL
      )
      ORDER BY CASE
        WHEN abstract IS NULL THEN 0
        WHEN LENGTH(abstract) < 100 THEN 1
        WHEN LENGTH(abstract) < 200 THEN 2
        ELSE 3
      END
      LIMIT ${limit}
    `);
    
    return result.rows.map((row: any) => row.id);
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
    // Get the study by ID
    const [study] = await db
      .select()
      .from(studies)
      .where(sql`${studies.id} = ${studyId}`);
    
    if (!study) {
      return {
        success: false,
        message: `Study with ID ${studyId} not found`,
      };
    }
    
    // Extract DOI information
    const doi = study.doi ? study.doi.replace(/^https?:\/\/doi.org\//, '') : null;
    
    if (!doi) {
      return {
        success: false,
        message: `Study #${studyId} doesn't have a DOI for enrichment`,
        studyId,
      };
    }
    
    // Initialize updates tracking
    const updates: EnhancementResult['updates'] = {};
    let enhancedData: any = null;
    
    // Try to fetch from CrossRef API
    try {
      const crossRefUrl = `https://api.crossref.org/works/${encodeURIComponent(doi)}`;
      console.log(`Fetching CrossRef data for study ${studyId} from: ${crossRefUrl}`);
      
      const crossRefResponse = await fetch(crossRefUrl, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'HydrogenStudies/1.0 (https://hydrogenstudies.com; mailto:info@hydrogenstudies.com)'
        }
      });
      
      if (crossRefResponse.ok) {
        const crossRefData = await crossRefResponse.json();
        console.log(`CrossRef data received for study ${studyId}:`, crossRefData.message.title);
        enhancedData = crossRefData.message;
      }
    } catch (error) {
      console.error(`Error fetching from CrossRef for study ${studyId}:`, error);
    }
    
    // If CrossRef failed, try EuropePMC
    if (!enhancedData) {
      try {
        const europePmcUrl = `https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=DOI:${encodeURIComponent(doi)}&format=json`;
        console.log(`Fetching EuropePMC data for study ${studyId} from: ${europePmcUrl}`);
        
        const europePmcResponse = await fetch(europePmcUrl);
        if (europePmcResponse.ok) {
          const europePmcData = await europePmcResponse.json();
          if (europePmcData.resultList && europePmcData.resultList.result && europePmcData.resultList.result.length > 0) {
            console.log(`EuropePMC data received for study ${studyId}`);
            enhancedData = europePmcData.resultList.result[0];
          }
        }
      } catch (error) {
        console.error(`Error fetching from EuropePMC for study ${studyId}:`, error);
      }
    }
    
    // Prepare update data
    let updateData: any = {};
    
    // Update with enhanced data if available
    if (enhancedData) {
      // Process CrossRef data
      if (enhancedData.abstract) {
        updateData.abstract = enhancedData.abstract;
        updates.abstract = true;
      }
      
      // Process EuropePMC data
      if (enhancedData.abstractText) {
        updateData.abstract = enhancedData.abstractText;
        updates.abstract = true;
      }
      
      // Extract more fields if available
      if (enhancedData.author) {
        const authors = enhancedData.author.map((a: any) => 
          `${a.given || ''} ${a.family || ''}`).join(', ');
        if (authors.length > 0) {
          updateData.authors = authors;
        }
      }
      
      // Extract journal publish date if available
      if (enhancedData.published && enhancedData.published['date-parts'] && 
          enhancedData.published['date-parts'][0]) {
        const dateParts = enhancedData.published['date-parts'][0];
        if (dateParts.length >= 3) {
          updateData.journalPublishDate = 
            `${dateParts[0]}-${String(dateParts[1]).padStart(2, '0')}-${String(dateParts[2]).padStart(2, '0')}`;
        }
      }
    }
    
    // If the abstract is still missing or too short, provide a placeholder
    if ((!updateData.abstract && !study.abstract) || 
        (study.abstract && study.abstract.length < 100 && !updateData.abstract)) {
      updateData.abstract = `This study, identified by DOI ${doi}, examines the effects of hydrogen on health outcomes. The complete abstract could not be automatically retrieved. Please refer to the original publication for more details.`;
      updates.abstract = true;
    }
    
    // Generate missing sections using AI if they don't exist
    if (!study.methods) {
      const methods = await generateSectionUsingAI(study, updateData, 'methods');
      if (methods) {
        updateData.methods = methods;
        updates.methods = true;
      }
    }
    
    if (!study.results) {
      const results = await generateSectionUsingAI(study, updateData, 'results');
      if (results) {
        updateData.results = results;
        updates.results = true;
      }
    }
    
    if (!study.conclusion) {
      const conclusion = await generateSectionUsingAI(study, updateData, 'conclusion');
      if (conclusion) {
        updateData.conclusion = conclusion;
        updates.conclusion = true;
      }
    }
    
    // Generate tags using AI
    const tags = await generateTagsUsingAI(study, updateData);
    if (tags && tags.length > 0) {
      updateData.keywords = tags.join(', ');
      updates.tags = true;
    }
    
    // Generate simplified explanation
    const simplifiedExplanation = await generateSimplifiedExplanation(study, updateData);
    if (simplifiedExplanation) {
      updateData.summary_markdown = simplifiedExplanation;
      updates.simplifiedExplanation = true;
    }
    
    // Only update the database if we have changes to make
    if (Object.keys(updateData).length > 0) {
      await db.update(studies)
        .set(updateData)
        .where(sql`${studies.id} = ${studyId}`);
      
      return {
        success: true,
        message: `Successfully enhanced study ${studyId} with DOI ${doi}`,
        updates,
        studyId,
      };
    }
    
    return {
      success: false,
      message: `No enhancements could be made to study ${studyId}`,
      studyId,
    };
    
  } catch (error) {
    console.error(`Error enhancing study ${studyId}:`, error);
    return {
      success: false,
      message: `Error enhancing study ${studyId}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      studyId,
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
    const abstract = updateData.abstract || study.abstract || '';
    const title = study.title || '';
    
    if (!abstract || abstract.length < 20 || !title) {
      return null;
    }

    const sectionMap = {
      methods: "Describe in detail the methodology used in this hydrogen research study based on the title and abstract. Include information about research design, participants or models, intervention details, measurements, and analytical approaches where possible.",
      results: "Summarize the key findings and results of this hydrogen research study based on the title and abstract. Include statistical outcomes, observed effects, and relevant measurements where possible.",
      conclusion: "Provide a conclusion for this hydrogen research study based on the title and abstract. Discuss the implications of the findings, limitations, and recommendations for future research."
    };

    const prompt = sectionMap[section];
    
    const response = await openai.chat.completions.create({
      model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
      messages: [
        {
          role: "system",
          content: "You are a scientific research assistant specializing in hydrogen health studies. Generate accurate content based on the provided information. Keep your response factual and directly related to the study information provided."
        },
        {
          role: "user",
          content: `Study Title: ${title}\n\nAbstract: ${abstract}\n\n${prompt}`
        }
      ],
      temperature: 0.3,
      max_tokens: 500
    });

    const generatedText = response.choices[0].message.content?.trim();
    
    if (generatedText) {
      return `${generatedText}\n\n(Note: This section was generated based on available study information and may not reflect the complete original ${section} of the study. Please refer to the original publication for definitive details.)`;
    }
    
    return null;
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
    const abstract = updateData.abstract || study.abstract || '';
    const title = study.title || '';
    
    if (!abstract || abstract.length < 20 || !title) {
      return null;
    }

    const response = await openai.chat.completions.create({
      model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
      messages: [
        {
          role: "system",
          content: "You are a scientific research assistant specializing in hydrogen health studies. Generate appropriate keywords or tags for the provided study. Focus on health benefits, delivery methods, target demographics, and mechanisms of action whenever possible."
        },
        {
          role: "user",
          content: `Study Title: ${title}\n\nAbstract: ${abstract}\n\nGenerate 5-10 relevant keywords or tags for this hydrogen health study. Format your response as a JSON array of strings. Only include the array in your response, nothing else.`
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.3,
      max_tokens: 200
    });

    const generatedContent = response.choices[0].message.content?.trim();
    
    if (generatedContent) {
      try {
        const parsedResult = JSON.parse(generatedContent);
        if (Array.isArray(parsedResult.tags || parsedResult.keywords)) {
          return parsedResult.tags || parsedResult.keywords;
        }
        
        // Handle if the response is just an array directly
        if (Array.isArray(parsedResult)) {
          return parsedResult;
        }
        
        return null;
      } catch (error) {
        console.error('Error parsing AI-generated tags:', error);
        return null;
      }
    }
    
    return null;
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
    const abstract = updateData.abstract || study.abstract || '';
    const title = study.title || '';
    const methods = updateData.methods || study.methods || '';
    const results = updateData.results || study.results || '';
    const conclusion = updateData.conclusion || study.conclusion || '';
    
    if (!abstract || abstract.length < 20 || !title) {
      return null;
    }

    const response = await openai.chat.completions.create({
      model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
      messages: [
        {
          role: "system",
          content: "You are a science communicator who specializes in explaining complex scientific studies to a general audience. Your goal is to provide clear, accurate, and accessible explanations of hydrogen health research."
        },
        {
          role: "user",
          content: `Study Title: ${title}\n\nAbstract: ${abstract}\n\nMethods: ${methods}\n\nResults: ${results}\n\nConclusion: ${conclusion}\n\nProvide a simplified explanation of this hydrogen health study in markdown format. Your explanation should be understandable to someone without a scientific background. Include the following sections: 1) What the study looked at, 2) How they did it, 3) What they found, and 4) Why it matters. Keep it under 300 words and use simple language.`
        }
      ],
      temperature: 0.5,
      max_tokens: 600
    });

    return response.choices[0].message.content?.trim() || null;
  } catch (error) {
    console.error('Error generating simplified explanation using AI:', error);
    return null;
  }
}