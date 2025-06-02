/**
 * Priority-based Title Deduplication
 * Focuses on the worst duplicate groups first with real-time progress
 */

import { db } from "./db";
import { studies } from "@shared/schema";
import { eq } from "drizzle-orm";
import axios from "axios";

interface DeduplicationProgress {
  currentGroup: number;
  totalGroups: number;
  currentTitle: string;
  studiesProcessed: number;
  titlesFixed: number;
  errors: number;
  isComplete: boolean;
}

let currentProgress: DeduplicationProgress = {
  currentGroup: 0,
  totalGroups: 0,
  currentTitle: '',
  studiesProcessed: 0,
  titlesFixed: 0,
  errors: 0,
  isComplete: false
};

/**
 * Get correct title from CrossRef DOI API
 */
async function getTitleFromDOI(doi: string): Promise<string | null> {
  try {
    if (!doi || doi === '' || doi.includes('additional informati')) {
      return null;
    }

    const cleanDOI = doi.replace(/^(https?:\/\/)?(dx\.)?doi\.org\//, '').trim();
    
    const response = await axios.get(`https://api.crossref.org/works/${cleanDOI}`, {
      headers: {
        'User-Agent': 'HydrogenStudies/1.0 (mailto:research@hydrogenstudies.com)'
      },
      timeout: 8000
    });

    if (response.data?.message?.title?.[0]) {
      return response.data.message.title[0].trim();
    }
    
    return null;
  } catch (error) {
    return null;
  }
}

/**
 * Process the top 10 worst duplicate groups
 */
export async function processTopDuplicates(): Promise<DeduplicationProgress> {
  console.log('Starting priority deduplication (top 10 worst groups)...');
  
  // Get the worst duplicate groups (highest count)
  const duplicateGroups = await db.execute(
    `SELECT title, COUNT(*) as count 
     FROM studies 
     WHERE title IS NOT NULL 
     GROUP BY title 
     HAVING COUNT(*) > 1 
     ORDER BY COUNT(*) DESC 
     LIMIT 10`
  );

  const groups = (duplicateGroups.rows || []).map(row => ({
    title: row.title as string,
    count: Number(row.count)
  }));

  currentProgress = {
    currentGroup: 0,
    totalGroups: groups.length,
    currentTitle: '',
    studiesProcessed: 0,
    titlesFixed: 0,
    errors: 0,
    isComplete: false
  };

  console.log(`Processing top ${groups.length} duplicate groups (worst offenders)`);

  for (let i = 0; i < groups.length; i++) {
    const group = groups[i];
    currentProgress.currentGroup = i + 1;
    currentProgress.currentTitle = group.title;
    
    console.log(`\n[${i + 1}/${groups.length}] Processing: "${group.title.substring(0, 60)}..." (${group.count} copies)`);
    
    try {
      // Get all studies with this duplicate title
      const duplicateStudies = await db
        .select({
          id: studies.id,
          title: studies.title,
          doi: studies.doi
        })
        .from(studies)
        .where(eq(studies.title, group.title));

      let groupFixed = 0;
      let groupErrors = 0;

      for (const study of duplicateStudies) {
        currentProgress.studiesProcessed++;
        
        if (study.doi && !study.doi.includes('additional informati')) {
          try {
            const correctTitle = await getTitleFromDOI(study.doi);
            
            if (correctTitle && correctTitle !== study.title) {
              await db
                .update(studies)
                .set({ title: correctTitle })
                .where(eq(studies.id, study.id));
              
              groupFixed++;
              currentProgress.titlesFixed++;
              console.log(`  ✓ Updated study ${study.id}: "${correctTitle.substring(0, 50)}..."`);
            }
            
            // Rate limiting - wait between API calls
            await new Promise(resolve => setTimeout(resolve, 500));
            
          } catch (error) {
            groupErrors++;
            currentProgress.errors++;
            console.log(`  ✗ Error processing study ${study.id}`);
          }
        }
      }

      if (groupFixed > 0) {
        console.log(`  Group result: Fixed ${groupFixed} titles`);
      } else {
        console.log(`  Group result: All titles already correct`);
      }
      
    } catch (error) {
      console.error(`  ✗ Error processing group:`, error);
      currentProgress.errors++;
    }
  }

  currentProgress.isComplete = true;
  
  console.log('\n=== PRIORITY DEDUPLICATION COMPLETE ===');
  console.log(`Processed ${currentProgress.totalGroups} priority groups`);
  console.log(`Processed ${currentProgress.studiesProcessed} studies`);
  console.log(`Fixed ${currentProgress.titlesFixed} titles`);
  console.log(`Errors: ${currentProgress.errors}`);

  return currentProgress;
}

/**
 * Get current deduplication progress
 */
export function getDeduplicationProgress(): DeduplicationProgress {
  return { ...currentProgress };
}

/**
 * Check final duplicate status after processing
 */
export async function checkFinalDuplicateStatus(): Promise<{
  remainingGroups: number;
  remainingDuplicates: number;
  processedStudies: number;
  fixedTitles: number;
}> {
  // Get remaining duplicates
  const remainingResult = await db.execute(
    `SELECT COUNT(*) as groups, SUM(count - 1) as duplicates
     FROM (
       SELECT title, COUNT(*) as count
       FROM studies 
       WHERE title IS NOT NULL 
       GROUP BY title 
       HAVING COUNT(*) > 1
     ) remaining`
  );

  const remaining = remainingResult.rows?.[0];

  return {
    remainingGroups: Number(remaining?.groups) || 0,
    remainingDuplicates: Number(remaining?.duplicates) || 0,
    processedStudies: currentProgress.studiesProcessed,
    fixedTitles: currentProgress.titlesFixed
  };
}