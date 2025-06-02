/**
 * Fast Title Deduplication System
 * Processes duplicates in parallel with better reporting
 */

import { db } from "./db";
import { studies } from "@shared/schema";
import { eq } from "drizzle-orm";
import axios from "axios";

interface DeduplicationResult {
  totalGroups: number;
  totalStudiesProcessed: number;
  totalTitlesFixed: number;
  totalErrors: number;
  groupsWithChanges: Array<{
    title: string;
    originalCount: number;
    fixedCount: number;
  }>;
}

/**
 * Get correct title from CrossRef DOI API with better error handling
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
      timeout: 5000
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
 * Process a single duplicate group with parallel DOI lookups
 */
async function processDuplicateGroup(duplicateTitle: string): Promise<{
  processed: number;
  fixed: number;
  errors: number;
}> {
  // Get all studies with this duplicate title
  const duplicateStudies = await db
    .select({
      id: studies.id,
      title: studies.title,
      doi: studies.doi
    })
    .from(studies)
    .where(eq(studies.title, duplicateTitle));

  let fixed = 0;
  let errors = 0;

  // Process studies with valid DOIs in parallel batches
  const studiesWithDOI = duplicateStudies.filter(study => 
    study.doi && !study.doi.includes('additional informati')
  );

  if (studiesWithDOI.length === 0) {
    return { processed: duplicateStudies.length, fixed: 0, errors: 0 };
  }

  // Process in small batches to avoid overwhelming the API
  const batchSize = 3;
  for (let i = 0; i < studiesWithDOI.length; i += batchSize) {
    const batch = studiesWithDOI.slice(i, i + batchSize);
    
    const promises = batch.map(async (study) => {
      try {
        const correctTitle = await getTitleFromDOI(study.doi!);
        
        if (correctTitle && correctTitle !== study.title) {
          await db
            .update(studies)
            .set({ title: correctTitle })
            .where(eq(studies.id, study.id));
          
          return { success: true, fixed: true };
        }
        
        return { success: true, fixed: false };
      } catch (error) {
        return { success: false, fixed: false };
      }
    });

    const results = await Promise.all(promises);
    
    results.forEach(result => {
      if (result.success && result.fixed) {
        fixed++;
      } else if (!result.success) {
        errors++;
      }
    });

    // Brief delay between batches
    if (i + batchSize < studiesWithDOI.length) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  return { 
    processed: duplicateStudies.length, 
    fixed, 
    errors 
  };
}

/**
 * Run the complete deduplication process
 */
export async function runFastDeduplication(): Promise<DeduplicationResult> {
  console.log('Starting fast deduplication process...');
  
  // Get all duplicate groups
  const duplicateGroups = await db.execute(
    `SELECT title, COUNT(*) as count 
     FROM studies 
     WHERE title IS NOT NULL 
     GROUP BY title 
     HAVING COUNT(*) > 1 
     ORDER BY COUNT(*) DESC`
  );

  const groups = (duplicateGroups.rows || []).map(row => ({
    title: row.title as string,
    count: Number(row.count)
  }));

  console.log(`Found ${groups.length} duplicate groups to process`);

  let totalStudiesProcessed = 0;
  let totalTitlesFixed = 0;
  let totalErrors = 0;
  const groupsWithChanges = [];

  for (let i = 0; i < groups.length; i++) {
    const group = groups[i];
    console.log(`[${i + 1}/${groups.length}] Processing: "${group.title.substring(0, 60)}..." (${group.count} copies)`);
    
    try {
      const result = await processDuplicateGroup(group.title);
      
      totalStudiesProcessed += result.processed;
      totalTitlesFixed += result.fixed;
      totalErrors += result.errors;
      
      if (result.fixed > 0) {
        groupsWithChanges.push({
          title: group.title,
          originalCount: group.count,
          fixedCount: result.fixed
        });
        console.log(`  ✓ Fixed ${result.fixed} titles in this group`);
      } else {
        console.log(`  ○ No changes needed (titles already correct)`);
      }
      
    } catch (error) {
      console.error(`  ✗ Error processing group:`, error);
      totalErrors++;
    }
  }

  const result: DeduplicationResult = {
    totalGroups: groups.length,
    totalStudiesProcessed,
    totalTitlesFixed,
    totalErrors,
    groupsWithChanges
  };

  console.log('\n=== DEDUPLICATION COMPLETE ===');
  console.log(`Processed ${result.totalGroups} duplicate groups`);
  console.log(`Processed ${result.totalStudiesProcessed} total studies`);
  console.log(`Fixed ${result.totalTitlesFixed} titles`);
  console.log(`Errors: ${result.totalErrors}`);
  
  if (result.groupsWithChanges.length > 0) {
    console.log('\nGroups with title corrections:');
    result.groupsWithChanges.forEach((group, index) => {
      console.log(`  ${index + 1}. "${group.title.substring(0, 60)}..." - Fixed ${group.fixedCount} studies`);
    });
  }

  return result;
}