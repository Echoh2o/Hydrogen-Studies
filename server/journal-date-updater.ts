/**
 * Journal Publication Date Updater
 * This module provides functionality to update the journal publication dates
 * for studies in the database using DOI lookups.
 */
import { db } from './db';
import { eq, isNull, and } from 'drizzle-orm';
import { getCrossRefArticleByDOI } from './crossref-api';
import { getSemanticScholarArticleByDOI } from './semantic-scholar-api';
import { getEuropePMCArticle } from './europepmc-api';
import { studies, Study } from '@shared/schema';

/**
 * Update journal publication dates for studies with DOIs
 * This function finds studies with DOIs but missing journal publication dates
 * and attempts to retrieve and update the correct publication dates.
 */
export async function updateJournalPublicationDates(limit: number = 50): Promise<{
  processed: number;
  updated: number;
  failed: number;
  results: Array<{ id: number; doi: string; success: boolean; message: string }>;
}> {
  // Find studies with DOIs but without journal publication dates
  const studiesNeedingDates = await db
    .select()
    .from(studies)
    .where(
      and(
        isNull(studies.journalPublishDate),
        studies.doi.isNotNull()
      )
    )
    .limit(limit);

  console.log(`Found ${studiesNeedingDates.length} studies needing journal publication dates`);

  const results = [];
  let updated = 0;
  let failed = 0;

  for (const study of studiesNeedingDates) {
    try {
      const journalDate = await findJournalPublicationDate(study.doi);
      
      if (journalDate) {
        // Update the study with the journal publication date
        await db
          .update(studies)
          .set({ journalPublishDate: journalDate })
          .where(eq(studies.id, study.id));
        
        results.push({
          id: study.id,
          doi: study.doi,
          success: true,
          message: `Updated with journal date: ${journalDate}`
        });
        
        updated++;
      } else {
        results.push({
          id: study.id,
          doi: study.doi,
          success: false,
          message: 'Could not determine journal publication date from available sources'
        });
        
        failed++;
      }
    } catch (error) {
      console.error(`Error updating journal date for study ${study.id}:`, error);
      
      results.push({
        id: study.id,
        doi: study.doi,
        success: false,
        message: `Error: ${error.message || 'Unknown error'}`
      });
      
      failed++;
    }
  }

  return {
    processed: studiesNeedingDates.length,
    updated,
    failed,
    results
  };
}

/**
 * Find the journal publication date for a study with the given DOI
 * This function tries multiple data sources to find the most accurate date
 */
async function findJournalPublicationDate(doi: string): Promise<string | null> {
  try {
    // Try CrossRef first (most reliable for publication dates)
    const crossRefData = await getCrossRefArticleByDOI(doi);
    if (crossRefData && crossRefData.published) {
      const date = extractCrossRefDate(crossRefData);
      if (date) return date;
    }
    
    // Try Semantic Scholar next
    const semanticData = await getSemanticScholarArticleByDOI(doi);
    if (semanticData && semanticData.year) {
      // Semantic Scholar often only has year, so we'll use January 1st of that year
      // if we don't have a more precise date from CrossRef
      return `${semanticData.year}-01-01`;
    }
    
    // Try Europe PMC as a last resort
    const europePMCData = await getEuropePMCArticle(doi);
    if (europePMCData && europePMCData.journalInfo && europePMCData.journalInfo.dateOfPublication) {
      return formatEuropePMCDate(europePMCData.journalInfo.dateOfPublication);
    }
    
    return null;
  } catch (error) {
    console.error(`Error finding journal date for DOI ${doi}:`, error);
    return null;
  }
}

/**
 * Extract a properly formatted date from CrossRef data
 */
function extractCrossRefDate(data: any): string | null {
  try {
    // CrossRef can have different date formats
    if (data.published && data.published['date-parts'] && data.published['date-parts'][0]) {
      const dateParts = data.published['date-parts'][0];
      
      // Handle complete date (year, month, day)
      if (dateParts.length >= 3) {
        return `${dateParts[0]}-${padZero(dateParts[1])}-${padZero(dateParts[2])}`;
      }
      
      // Handle year and month
      if (dateParts.length === 2) {
        return `${dateParts[0]}-${padZero(dateParts[1])}-01`;
      }
      
      // Handle year only
      if (dateParts.length === 1) {
        return `${dateParts[0]}-01-01`;
      }
    }
    
    // Fallback for other date formats
    if (data.published && data.published.timestamp) {
      return new Date(data.published.timestamp).toISOString().split('T')[0];
    }
    
    return null;
  } catch (error) {
    console.error('Error extracting CrossRef date:', error);
    return null;
  }
}

/**
 * Format a Europe PMC date (usually in 'YYYY MMM DD' format) to ISO date
 */
function formatEuropePMCDate(dateStr: string): string {
  try {
    // Handle cases like "2018 Jan 15" or "2018 Jan" or "2018"
    const parts = dateStr.trim().split(/\s+/);
    const year = parts[0];
    
    if (parts.length === 1) {
      return `${year}-01-01`; // Year only
    }
    
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthIndex = monthNames.indexOf(parts[1]);
    const month = monthIndex >= 0 ? padZero(monthIndex + 1) : '01';
    
    if (parts.length === 2) {
      return `${year}-${month}-01`; // Year and month
    }
    
    const day = padZero(parseInt(parts[2], 10)) || '01';
    return `${year}-${month}-${day}`; // Full date
  } catch (error) {
    console.error('Error formatting Europe PMC date:', error);
    return null;
  }
}

/**
 * Pad a number with leading zero if needed
 */
function padZero(num: number): string {
  return num < 10 ? `0${num}` : `${num}`;
}