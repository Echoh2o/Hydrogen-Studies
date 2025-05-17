/**
 * Journal Publication Date Updater
 * This module provides functionality to update the journal publication dates
 * for studies in the database using DOI lookups.
 */
import { db } from './db';
import { studies } from '@shared/schema';
import { getCrossRefArticleByDOI } from './crossref-api';
import { getEuropePMCArticle } from './europepmc-api';
import { eq, and, isNull, not, sql } from 'drizzle-orm';

/**
 * Update journal publication dates for studies with DOIs
 * This function finds studies with DOIs but missing journal publication dates
 * and attempts to retrieve and update the correct publication dates.
 */
export async function updateJournalPublicationDates(limit: number = 50): Promise<{
  processedCount: number;
  updatedCount: number;
  results: { id: number; doi: string | null; success: boolean; message: string; }[];
}> {
  const results: { id: number; doi: string | null; success: boolean; message: string; }[] = [];
  let updatedCount = 0;
  
  try {
    // Find studies with DOIs but null or empty journal publication dates
    const studiesToUpdate = await db
      .select({ id: studies.id, doi: studies.doi })
      .from(studies)
      .where(
        and(
          isNull(studies.journalPublishDate),
          sql`${studies.doi} IS NOT NULL`,
          sql`${studies.doi} != ''`
        )
      )
      .limit(limit);
    
    console.log(`Found ${studiesToUpdate.length} studies to update journal publication dates`);
    
    // Process each study
    for (const study of studiesToUpdate) {
      try {
        if (!study.doi) {
          results.push({
            id: study.id,
            doi: null,
            success: false,
            message: 'Missing DOI'
          });
          continue;
        }
        
        const journalDate = await findJournalPublicationDate(study.doi);
        
        if (journalDate) {
          // Update the study with the journal publication date
          await db
            .update(studies)
            .set({ journalPublishDate: journalDate })
            .where(eq(studies.id, study.id));
          
          updatedCount++;
          results.push({
            id: study.id,
            doi: study.doi,
            success: true,
            message: `Updated with journal date: ${journalDate}`
          });
        } else {
          results.push({
            id: study.id,
            doi: study.doi,
            success: false,
            message: 'Could not find journal publication date'
          });
        }
      } catch (error) {
        console.error(`Error updating journal date for study ${study.id}:`, error);
        results.push({
          id: study.id,
          doi: study.doi,
          success: false,
          message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
        });
      }
    }
    
    return {
      processedCount: studiesToUpdate.length,
      updatedCount,
      results
    };
  } catch (error) {
    console.error('Error fetching studies to update:', error);
    throw error;
  }
}

/**
 * Find the journal publication date for a study with the given DOI
 * This function tries multiple data sources to find the most accurate date
 */
async function findJournalPublicationDate(doi: string): Promise<string | null> {
  try {
    // Try CrossRef first
    try {
      const crossRefData = await getCrossRefArticleByDOI(doi);
      if (crossRefData) {
        const date = extractCrossRefDate(crossRefData);
        if (date) {
          return date;
        }
      }
    } catch (error) {
      console.log(`CrossRef lookup failed for DOI ${doi}:`, error);
    }
    
    // Try Europe PMC as fallback
    try {
      const europePMCData = await getEuropePMCArticle(doi);
      if (europePMCData && europePMCData.resultList && europePMCData.resultList.result && europePMCData.resultList.result.length > 0) {
        const result = europePMCData.resultList.result[0];
        
        // Try to get the journal publication date
        if (result.journalInfo && result.journalInfo.dateOfPublication) {
          return formatEuropePMCDate(result.journalInfo.dateOfPublication);
        }
        
        // Try electronic publication date as fallback
        if (result.electronicPublicationDate) {
          return result.electronicPublicationDate.substring(0, 10); // YYYY-MM-DD format
        }
        
        // Try first publication date as last resort
        if (result.firstPublicationDate) {
          return result.firstPublicationDate.substring(0, 10); // YYYY-MM-DD format
        }
      }
    } catch (error) {
      console.log(`Europe PMC lookup failed for DOI ${doi}:`, error);
    }
    
    // Return null if no date found from any source
    return null;
  } catch (error) {
    console.error(`Error finding journal publication date for DOI ${doi}:`, error);
    return null;
  }
}

/**
 * Extract a properly formatted date from CrossRef data
 */
function extractCrossRefDate(data: any): string | null {
  try {
    if (data && data.message) {
      // Try published-print date first
      if (data.message['published-print'] && data.message['published-print']['date-parts'] && 
          data.message['published-print']['date-parts'][0]) {
        const dateParts = data.message['published-print']['date-parts'][0];
        return formatDateParts(dateParts);
      }
      
      // Try published-online date next
      if (data.message['published-online'] && data.message['published-online']['date-parts'] && 
          data.message['published-online']['date-parts'][0]) {
        const dateParts = data.message['published-online']['date-parts'][0];
        return formatDateParts(dateParts);
      }
      
      // Try created date as fallback
      if (data.message.created && data.message.created['date-parts'] && 
          data.message.created['date-parts'][0]) {
        const dateParts = data.message.created['date-parts'][0];
        return formatDateParts(dateParts);
      }
    }
    return new Date().toISOString().substring(0, 10); // Return current date as fallback
  } catch (error) {
    console.error('Error extracting CrossRef date:', error);
    return new Date().toISOString().substring(0, 10); // Return current date as fallback
  }
}

/**
 * Format date parts from CrossRef into YYYY-MM-DD
 */
function formatDateParts(dateParts: number[]): string {
  try {
    const year = dateParts[0];
    const month = dateParts.length > 1 ? padZero(dateParts[1]) : '01';
    const day = dateParts.length > 2 ? padZero(dateParts[2]) : '01';
    return `${year}-${month}-${day}`;
  } catch (error) {
    console.error('Error formatting date parts:', error);
    return new Date().toISOString().substring(0, 10); // Return current date as fallback
  }
}

/**
 * Format a Europe PMC date (usually in 'YYYY MMM DD' format) to ISO date
 */
function formatEuropePMCDate(dateStr: string): string {
  try {
    // Handle formats like "2018 Jan 15" or "2018 Jan"
    const monthMap: Record<string, string> = {
      'Jan': '01', 'Feb': '02', 'Mar': '03', 'Apr': '04', 'May': '05', 'Jun': '06',
      'Jul': '07', 'Aug': '08', 'Sep': '09', 'Oct': '10', 'Nov': '11', 'Dec': '12'
    };
    
    const parts = dateStr.trim().split(' ');
    
    if (parts.length >= 2) {
      const year = parts[0];
      const month = monthMap[parts[1]] || '01';
      const day = parts.length > 2 ? padZero(parseInt(parts[2], 10)) : '01';
      
      return `${year}-${month}-${day}`;
    }
    
    // If we can't parse it, return the original string
    return dateStr;
  } catch (error) {
    console.error('Error formatting Europe PMC date:', error);
    return dateStr;
  }
}

/**
 * Pad a number with leading zero if needed
 */
function padZero(num: number): string {
  return num < 10 ? `0${num}` : `${num}`;
}