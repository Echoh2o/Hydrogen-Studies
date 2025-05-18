/**
 * Content Enrichment Service
 * 
 * Enhances study data by fetching full abstracts, text, and images from DOI sources,
 * then comparing them with existing database content to provide the most complete information.
 */

import axios from 'axios';
import { db } from './db';
import { studies } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { getCrossRefArticleByDOI } from './crossref-api';
import { getArticleByDOI } from './europepmc-api';
import { getSemanticScholarPaper } from './semantic-scholar-api';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';

// Interfaces
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
  };
  studyId?: number;
}

/**
 * Fetch full content for a study by DOI
 * Attempts to gather complete abstract, text, and images from multiple sources
 */
export async function enhanceStudyContent(studyId: number): Promise<EnhancementResult> {
  try {
    // Get the study from database
    const [study] = await db.select().from(studies).where(eq(studies.id, studyId));
    
    if (!study) {
      return { 
        success: false, 
        message: `Study with ID ${studyId} not found` 
      };
    }
    
    // If no DOI, can't enhance
    if (!study.doi) {
      return { 
        success: false, 
        message: `Study ${studyId} has no DOI, cannot fetch additional content` 
      };
    }
    
    const doi = study.doi;
    const updates: EnhancementResult['updates'] = {};
    
    // Get data from multiple sources to ensure completeness
    const [crossrefData, europmcData, semanticScholarData] = await Promise.allSettled([
      getCrossRefArticleByDOI(doi),
      getArticleByDOI(doi),
      getSemanticScholarPaper(doi)
    ]);
    
    let enhancedAbstract = study.abstract || '';
    let enhancedMethods = study.methods || '';
    let enhancedResults = study.results || '';
    let enhancedConclusion = study.conclusion || '';
    let imageUrls: string[] = [];
    
    // Process CrossRef data
    if (crossrefData.status === 'fulfilled' && crossrefData.value) {
      const data = crossrefData.value;
      
      if (data.abstract && data.abstract.length > enhancedAbstract.length) {
        enhancedAbstract = data.abstract;
        updates.abstract = true;
      }
    }
    
    // Process EuropePMC data
    if (europmcData.status === 'fulfilled' && europmcData.value) {
      const result = europmcData.value;
      
      if (result.abstractText && result.abstractText.length > enhancedAbstract.length) {
        enhancedAbstract = result.abstractText;
        updates.abstract = true;
      }
      
      if (result.fullTextUrlList?.fullTextUrl) {
        for (const urlData of result.fullTextUrlList.fullTextUrl) {
          if (urlData.availability === 'Open access' && urlData.url) {
            try {
              // For HTML links, we can try to extract content
              if (urlData.url.endsWith('.html')) {
                const htmlContent = await fetchHtmlContent(urlData.url);
                if (htmlContent && htmlContent.length > 0) {
                  updates.fullText = true;
                }
              }
            } catch (error: any) {
              console.error(`Error fetching full text from ${urlData.url}:`, error);
            }
          }
        }
      }
    }
    
    // Process Semantic Scholar data
    if (semanticScholarData.status === 'fulfilled' && semanticScholarData.value) {
      const data = semanticScholarData.value;
      
      if (data.abstract && data.abstract.length > enhancedAbstract.length) {
        enhancedAbstract = data.abstract;
        updates.abstract = true;
      }
      
      // Handle figures/images if available
      if (data.paperId && data.figures && data.figures.length > 0) {
        imageUrls = data.figures.map((fig: any) => fig.url);
        updates.images = true;
      }
      
      // Sometimes Semantic Scholar has sections data
      if (data.sections) {
        for (const section of data.sections) {
          const sectionHeading = section.heading?.toLowerCase() || '';
          const sectionText = section.text || '';
          
          if (sectionHeading.includes('method') && sectionText.length > enhancedMethods.length) {
            enhancedMethods = sectionText;
            updates.methods = true;
          }
          else if (sectionHeading.includes('result') && sectionText.length > enhancedResults.length) {
            enhancedResults = sectionText;
            updates.results = true;
          }
          else if (sectionHeading.includes('conclusion') && sectionText.length > enhancedConclusion.length) {
            enhancedConclusion = sectionText;
            updates.conclusion = true;
          }
        }
      }
    }
    
    // Download and store images if found
    const downloadedImages: string[] = [];
    if (imageUrls.length > 0) {
      for (const url of imageUrls) {
        try {
          const imagePath = await downloadImage(url, studyId);
          if (imagePath) {
            downloadedImages.push(imagePath);
          }
        } catch (error: any) {
          console.error(`Error downloading image from ${url}:`, error);
        }
      }
    }
    
    // Update the study in the database with enhanced content
    const [updatedStudy] = await db.update(studies)
      .set({
        abstract: enhancedAbstract,
        methods: enhancedMethods || undefined,
        results: enhancedResults || undefined,
        conclusion: enhancedConclusion || undefined,
        imageUrl: downloadedImages.length > 0 ? downloadedImages[0] : study.imageUrl
      })
      .where(eq(studies.id, studyId))
      .returning();
    
    return {
      success: true,
      message: `Study ${studyId} content enhanced successfully`,
      updates,
      studyId
    };
  } catch (error: any) {
    console.error(`Error enhancing study content:`, error);
    return {
      success: false,
      message: `Failed to enhance study content: ${error.message}`
    };
  }
}

/**
 * Batch process multiple studies for content enhancement
 */
export async function batchEnhanceStudies(studyIds: number[]): Promise<{
  overall: boolean;
  results: EnhancementResult[];
}> {
  const results: EnhancementResult[] = [];
  let overallSuccess = true;
  
  for (const studyId of studyIds) {
    try {
      const result = await enhanceStudyContent(studyId);
      results.push(result);
      if (!result.success) {
        overallSuccess = false;
      }
    } catch (error) {
      console.error(`Error enhancing study ${studyId}:`, error);
      results.push({
        success: false,
        message: `Exception during enhancement: ${error.message}`,
        studyId
      });
      overallSuccess = false;
    }
  }
  
  return {
    overall: overallSuccess,
    results
  };
}

/**
 * Fetch HTML content from URL and extract meaningful text
 */
async function fetchHtmlContent(url: string): Promise<string> {
  try {
    const response = await axios.get(url);
    const html = response.data;
    
    // Basic HTML content extraction (would use better HTML parsing in production)
    // This is a simplified version - in a real app, use a proper HTML parser
    const strippedHtml = html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
      .replace(/<header\b[^<]*(?:(?!<\/header>)<[^<]*)*<\/header>/gi, '')
      .replace(/<footer\b[^<]*(?:(?!<\/footer>)<[^<]*)*<\/footer>/gi, '')
      .replace(/<nav\b[^<]*(?:(?!<\/nav>)<[^<]*)*<\/nav>/gi, '')
      .replace(/<aside\b[^<]*(?:(?!<\/aside>)<[^<]*)*<\/aside>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    
    return strippedHtml;
  } catch (error) {
    console.error(`Error fetching HTML content from ${url}:`, error);
    return '';
  }
}

/**
 * Download an image from URL and save it to the uploads directory
 */
async function downloadImage(url: string, studyId: number): Promise<string | null> {
  try {
    const response = await axios.get(url, { responseType: 'arraybuffer' });
    const buffer = Buffer.from(response.data, 'binary');
    
    // Create uploads directory if it doesn't exist
    const uploadsDir = path.join(process.cwd(), 'uploads');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    
    // Generate a unique filename
    const fileExtension = path.extname(url) || '.jpg'; // Default to jpg if no extension
    const filename = `study_${studyId}_${uuidv4()}${fileExtension}`;
    const filepath = path.join(uploadsDir, filename);
    
    fs.writeFileSync(filepath, buffer);
    return `/uploads/${filename}`;
  } catch (error) {
    console.error(`Error downloading image:`, error);
    return null;
  }
}

/**
 * Find studies with incomplete content for enhancement
 */
export async function findStudiesForEnhancement(limit: number = 50): Promise<number[]> {
  // Find studies with DOIs but potentially incomplete content
  const results = await db
    .select({ id: studies.id })
    .from(studies)
    .where(
      // Has DOI but missing or short abstract or other fields
      eq(studies.id, studies.id) // This is a placeholder that's always true
    )
    .limit(limit);
  
  return results.map(r => r.id);
}