/**
 * Content Enrichment Service
 * 
 * Enhances study data by fetching full abstracts, text, and images from DOI sources,
 * then comparing them with existing database content to provide the most complete information.
 */
import { db } from "./db";
import { studies } from "@shared/schema";
import { getCrossRefArticleByDOI } from "./crossref-api";
import { getEuropePmcArticleByDOI } from "./europepmc-api";
import { getSemanticScholarArticleByDOI } from "./semantic-scholar-api";
import { eq, and, or, isNull, lt, sql } from "drizzle-orm";
import axios from "axios";
import fs from "fs";
import path from "path";
import { load } from "cheerio";

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
    // Get the current study
    const study = await db.query.studies.findFirst({
      where: eq(studies.id, studyId)
    });

    if (!study) {
      return {
        success: false,
        message: `Study with ID ${studyId} not found`,
      };
    }

    if (!study.doi) {
      return {
        success: false,
        message: `Study #${studyId} doesn't have a DOI for enrichment`,
      };
    }

    // Initialize updates tracker
    const updates: EnhancementResult["updates"] = {
      abstract: false,
      fullText: false,
      images: false,
      methods: false,
      results: false,
      conclusion: false,
    };

    // Store initial lengths to check if content was enhanced
    const initialAbstractLength = study.abstract?.length || 0;
    const initialMethodsLength = study.methods?.length || 0;
    const initialResultsLength = study.results?.length || 0;
    const initialConclusionLength = study.conclusion?.length || 0;
    
    // Try to get content from multiple sources
    let fullTextContent = "";
    let imageSrc = "";
    let improvedAbstract = study.abstract || "";
    let improvedMethods = study.methods || "";
    let improvedResults = study.results || "";
    let improvedConclusion = study.conclusion || "";

    // Try CrossRef first
    try {
      console.log(`Fetching CrossRef data for DOI: ${study.doi}`);
      const crossRefData = await getCrossRefArticleByDOI(study.doi);
      
      if (crossRefData && crossRefData.abstract) {
        if (!improvedAbstract || crossRefData.abstract.length > improvedAbstract.length) {
          improvedAbstract = crossRefData.abstract;
          updates.abstract = true;
        }
      }
      
      // Extract URL to try for full text or image
      if (crossRefData && crossRefData.URL) {
        // Try to download the content from the publisher URL
        try {
          const htmlContent = await fetchHtmlContent(crossRefData.URL);
          if (htmlContent && htmlContent.length > 500) {
            fullTextContent = htmlContent;
            updates.fullText = true;
            
            // Extract potential methods, results, conclusions
            const sections = extractSectionsFromFullText(htmlContent);
            if (sections.methods && sections.methods.length > initialMethodsLength) {
              improvedMethods = sections.methods;
              updates.methods = true;
            }
            
            if (sections.results && sections.results.length > initialResultsLength) {
              improvedResults = sections.results;
              updates.results = true;
            }
            
            if (sections.conclusion && sections.conclusion.length > initialConclusionLength) {
              improvedConclusion = sections.conclusion;
              updates.conclusion = true;
            }
          }
        } catch (error) {
          console.error(`Error fetching HTML content from ${crossRefData.URL}:`, error);
        }
      }
    } catch (error) {
      console.error(`Error fetching CrossRef data for DOI ${study.doi}:`, error);
    }

    // Try Europe PMC next
    try {
      console.log(`Fetching Europe PMC data for DOI: ${study.doi}`);
      const europePmcData = await getEuropePmcArticleByDOI(study.doi);
      
      if (europePmcData) {
        // Check for better abstract
        if (europePmcData.abstractText && 
           (!improvedAbstract || europePmcData.abstractText.length > improvedAbstract.length)) {
          improvedAbstract = europePmcData.abstractText;
          updates.abstract = true;
        }
        
        // Check for better methods, results, conclusions
        if (europePmcData.fullTextXML) {
          const sections = extractSectionsFromXml(europePmcData.fullTextXML);
          
          if (sections.methods && sections.methods.length > improvedMethods.length) {
            improvedMethods = sections.methods;
            updates.methods = true;
          }
          
          if (sections.results && sections.results.length > improvedResults.length) {
            improvedResults = sections.results;
            updates.results = true;
          }
          
          if (sections.conclusion && sections.conclusion.length > improvedConclusion.length) {
            improvedConclusion = sections.conclusion;
            updates.conclusion = true;
          }
        }
        
        // Check for images
        if (!imageSrc && europePmcData.firstFigureUrl) {
          imageSrc = europePmcData.firstFigureUrl;
        }
      }
    } catch (error) {
      console.error(`Error fetching Europe PMC data for DOI ${study.doi}:`, error);
    }

    // Try Semantic Scholar last
    try {
      console.log(`Fetching Semantic Scholar data for DOI: ${study.doi}`);
      const semanticScholarData = await getSemanticScholarArticleByDOI(study.doi);
      
      if (semanticScholarData) {
        // Check for better abstract
        if (semanticScholarData.abstract && 
           (!improvedAbstract || semanticScholarData.abstract.length > improvedAbstract.length)) {
          improvedAbstract = semanticScholarData.abstract;
          updates.abstract = true;
        }
        
        // Look for image in Semantic Scholar
        if (!imageSrc && semanticScholarData.imageUrl) {
          imageSrc = semanticScholarData.imageUrl;
        }
      }
    } catch (error) {
      console.error(`Error fetching Semantic Scholar data for DOI ${study.doi}:`, error);
    }

    // Process image if one was found
    let imageUrl = study.imageUrl;
    if (imageSrc && !study.imageUrl) {
      try {
        imageUrl = await downloadImage(imageSrc, studyId);
        updates.images = !!imageUrl;
      } catch (error) {
        console.error(`Error downloading image from ${imageSrc}:`, error);
      }
    }

    // Update the study in the database with enhanced content
    await db.update(studies)
      .set({
        abstract: improvedAbstract,
        methods: improvedMethods,
        results: improvedResults,
        conclusion: improvedConclusion,
        imageUrl: imageUrl
      })
      .where(eq(studies.id, studyId));

    // Determine how many sections were enhanced
    const totalUpdates = Object.values(updates).filter(Boolean).length;
    const successMessage = totalUpdates > 0
      ? `Enhanced ${totalUpdates} sections of study #${studyId}`
      : `No new content found for study #${studyId}`;

    return {
      success: true,
      message: successMessage,
      updates,
      studyId
    };
  } catch (error: any) {
    console.error(`Error enhancing study #${studyId}:`, error);
    return {
      success: false,
      message: `Error: ${error.message || 'Unknown error'}`,
      studyId
    };
  }
}

/**
 * Batch process multiple studies for content enhancement
 */
export async function batchEnhanceStudies(studyIds: number[]): Promise<{
  processed: number,
  success: number,
  failed: number,
  message: string
}> {
  const results = {
    processed: 0,
    success: 0,
    failed: 0,
    message: ""
  };

  console.log(`Starting batch enhancement for ${studyIds.length} studies`);

  for (const studyId of studyIds) {
    try {
      results.processed++;
      const enhancementResult = await enhanceStudyContent(studyId);
      
      if (enhancementResult.success) {
        results.success++;
      } else {
        results.failed++;
      }
      
      // Small delay to avoid hammering external APIs
      await new Promise(resolve => setTimeout(resolve, 1000)); 
    } catch (error) {
      results.failed++;
      console.error(`Error processing study #${studyId}:`, error);
    }
  }

  results.message = `Processed ${results.processed} studies. Successfully enhanced: ${results.success}, Failed: ${results.failed}`;
  console.log(results.message);
  
  return results;
}

/**
 * Fetch HTML content from URL and extract meaningful text
 */
async function fetchHtmlContent(url: string): Promise<string> {
  try {
    const response = await axios.get(url);
    const html = response.data;
    const $ = load(html);
    
    // Remove unnecessary elements
    $('script, style, nav, header, footer, .header, .footer, .nav, .sidebar, .menu, .ad, .advertisement').remove();
    
    // Extract main content
    const mainContent = $('.main, .content, .article, article, main, #content, #main')
      .map((_, el) => $(el).text().trim())
      .get()
      .join('\n\n');
    
    return mainContent || $('body').text().trim();
  } catch (error) {
    console.error(`Error fetching URL ${url}:`, error);
    return '';
  }
}

/**
 * Extract sections from HTML full text
 */
function extractSectionsFromFullText(htmlText: string): {
  methods?: string;
  results?: string;
  conclusion?: string;
} {
  const $ = load(htmlText);
  const sections: any = {};
  
  // Common section header selectors
  const methodsSelectors = [
    '#methods', '.methods', 'h2:contains("Methods")', 'h3:contains("Methods")', 
    'h2:contains("Materials and Methods")', 'h3:contains("Materials and Methods")',
    'section:contains("Methods")'
  ];
  
  const resultsSelectors = [
    '#results', '.results', 'h2:contains("Results")', 'h3:contains("Results")',
    'section:contains("Results")'
  ];
  
  const conclusionSelectors = [
    '#conclusion', '.conclusion', 'h2:contains("Conclusion")', 'h3:contains("Conclusions")',
    'h2:contains("Discussion")', 'h3:contains("Discussion")',
    'section:contains("Conclusion")', 'section:contains("Discussion")'
  ];
  
  // Extract methods
  for (const selector of methodsSelectors) {
    const methodsText = extractSectionText($, selector);
    if (methodsText && methodsText.length > 100) {
      sections.methods = methodsText;
      break;
    }
  }
  
  // Extract results
  for (const selector of resultsSelectors) {
    const resultsText = extractSectionText($, selector);
    if (resultsText && resultsText.length > 100) {
      sections.results = resultsText;
      break;
    }
  }
  
  // Extract conclusion/discussion
  for (const selector of conclusionSelectors) {
    const conclusionText = extractSectionText($, selector);
    if (conclusionText && conclusionText.length > 100) {
      sections.conclusion = conclusionText;
      break;
    }
  }
  
  return sections;
}

/**
 * Helper to extract text from section
 */
function extractSectionText($: any, selector: string): string {
  const element = $(selector).first();
  if (!element.length) return '';
  
  // If it's a heading, get all text until the next heading
  if (selector.includes('h2:') || selector.includes('h3:')) {
    let text = '';
    let next = element.next();
    while (next.length && !next.is('h2, h3')) {
      text += next.text().trim() + '\n\n';
      next = next.next();
    }
    return text.trim();
  }
  
  // Otherwise get text from the actual element
  return element.text().trim();
}

/**
 * Extract sections from XML (for PMC)
 */
function extractSectionsFromXml(xml: string): {
  methods?: string;
  results?: string;
  conclusion?: string;
} {
  try {
    const $ = load(xml, { xmlMode: true });
    const sections: any = {};
    
    // Methods section
    $('sec[sec-type="methods"], sec:contains("Methods"), sec:contains("METHODS")').each(function() {
      if (!sections.methods) {
        sections.methods = $(this).text().trim();
      }
    });
    
    // Results section
    $('sec[sec-type="results"], sec:contains("Results"), sec:contains("RESULTS")').each(function() {
      if (!sections.results) {
        sections.results = $(this).text().trim();
      }
    });
    
    // Conclusion section
    $('sec[sec-type="conclusions"], sec:contains("Conclusion"), sec:contains("CONCLUSION"), sec:contains("Discussion"), sec:contains("DISCUSSION")').each(function() {
      if (!sections.conclusion) {
        sections.conclusion = $(this).text().trim();
      }
    });
    
    return sections;
  } catch (error) {
    console.error('Error extracting sections from XML:', error);
    return {};
  }
}

/**
 * Download an image from URL and save it to the uploads directory
 */
async function downloadImage(url: string, studyId: number): Promise<string | null> {
  try {
    const response = await axios.get(url, { responseType: 'arraybuffer' });
    const contentType = response.headers['content-type'];
    
    // Ensure it's an image
    if (!contentType || !contentType.startsWith('image/')) {
      return null;
    }
    
    // Create uploads directory if it doesn't exist
    const uploadsDir = path.join(process.cwd(), 'uploads');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    
    // Determine file extension
    const extension = contentType.split('/')[1] || 'jpg';
    const fileName = `study_${studyId}_${Date.now()}.${extension}`;
    const filePath = path.join(uploadsDir, fileName);
    
    // Write the file
    fs.writeFileSync(filePath, Buffer.from(response.data));
    
    // Return the relative path for storage in the database
    return `/uploads/${fileName}`;
  } catch (error) {
    console.error(`Error downloading image from ${url}:`, error);
    return null;
  }
}

/**
 * Find studies with incomplete content for enhancement
 */
export async function findStudiesForEnhancement(limit: number = 50): Promise<number[]> {
  try {
    // Use raw SQL for more complex conditions
    const result = await db.execute(sql`
      SELECT id FROM studies 
      WHERE doi IS NOT NULL 
      AND (
        abstract IS NULL 
        OR LENGTH(abstract) < 200
        OR methods IS NULL 
        OR results IS NULL 
        OR conclusion IS NULL 
        OR image_url IS NULL
      )
      ORDER BY created_at DESC
      LIMIT ${limit}
    `);
    
    if (!result.rows || result.rows.length === 0) {
      return [];
    }
    
    return result.rows.map(row => Number(row.id));
  } catch (error) {
    console.error('Error finding studies for enhancement:', error);
    return [];
  }
}