/**
 * Simple Title Deduplication System
 * Uses DOI lookups to fix duplicate titles
 */

import { db } from "./db";
import { studies } from "@shared/schema";
import { eq } from "drizzle-orm";
import axios from "axios";

interface CrossRefResponse {
  message: {
    title: string[];
    DOI: string;
  };
}

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
      timeout: 10000
    });

    const data: CrossRefResponse = response.data;
    
    if (data.message && data.message.title && data.message.title.length > 0) {
      return data.message.title[0].trim();
    }
    
    return null;
  } catch (error) {
    console.error(`Error fetching title for DOI ${doi}:`, error);
    return null;
  }
}

/**
 * Fix titles for a specific duplicate group
 */
export async function fixTitlesForGroup(duplicateTitle: string): Promise<{
  processed: number;
  fixed: number;
  errors: number;
}> {
  console.log(`Fixing titles for duplicate group: "${duplicateTitle}"`);
  
  // Get all studies with this duplicate title
  const duplicateStudies = await db
    .select({
      id: studies.id,
      title: studies.title,
      doi: studies.doi
    })
    .from(studies)
    .where(eq(studies.title, duplicateTitle));

  let processed = 0;
  let fixed = 0;
  let errors = 0;

  for (const study of duplicateStudies) {
    processed++;
    
    try {
      if (study.doi && !study.doi.includes('additional informati')) {
        console.log(`  Fetching title from DOI for study ${study.id}: ${study.doi}`);
        const correctTitle = await getTitleFromDOI(study.doi);
        
        if (correctTitle && correctTitle !== study.title) {
          await db
            .update(studies)
            .set({ title: correctTitle })
            .where(eq(studies.id, study.id));
          
          console.log(`  ✓ Updated study ${study.id} title to: "${correctTitle}"`);
          fixed++;
        } else if (correctTitle === study.title) {
          console.log(`  ○ Study ${study.id} already has correct title`);
        } else {
          console.log(`  ✗ Could not retrieve title for study ${study.id}`);
        }
        
        // Be respectful to APIs
        await new Promise(resolve => setTimeout(resolve, 1000));
      } else {
        console.log(`  ○ Study ${study.id} has no valid DOI, skipping`);
      }
      
    } catch (error) {
      console.error(`  ✗ Error processing study ${study.id}:`, error);
      errors++;
    }
  }

  return { processed, fixed, errors };
}

/**
 * Get current duplicate status
 */
export async function getDuplicateStatus(): Promise<{
  totalStudies: number;
  duplicateGroups: number;
  totalDuplicates: number;
  sampleDuplicates: Array<{title: string, count: number}>
}> {
  // Get total studies
  const totalStudies = await db.$count(studies);

  // Get duplicate groups with counts
  const duplicateGroups = await db.execute(
    `SELECT title, COUNT(*) as count 
     FROM studies 
     WHERE title IS NOT NULL 
     GROUP BY title 
     HAVING COUNT(*) > 1 
     ORDER BY COUNT(*) DESC 
     LIMIT 10`
  );

  const sampleDuplicates = (duplicateGroups.rows || []).map(row => ({
    title: row.title as string,
    count: Number(row.count)
  }));

  const totalDuplicates = sampleDuplicates.reduce((sum, item) => sum + (item.count - 1), 0);

  return {
    totalStudies,
    duplicateGroups: sampleDuplicates.length,
    totalDuplicates,
    sampleDuplicates
  };
}

/**
 * Test the system with the worst duplicate group
 */
export async function testTitleFix(): Promise<void> {
  const status = await getDuplicateStatus();
  
  if (status.sampleDuplicates.length > 0) {
    const worstDuplicate = status.sampleDuplicates[0];
    console.log(`Testing title fix with worst duplicate: "${worstDuplicate.title}" (${worstDuplicate.count} copies)`);
    
    const result = await fixTitlesForGroup(worstDuplicate.title);
    
    console.log(`Test complete:`);
    console.log(`  Processed: ${result.processed} studies`);
    console.log(`  Fixed: ${result.fixed} titles`);
    console.log(`  Errors: ${result.errors} failures`);
  } else {
    console.log('No duplicate titles found to test');
  }
}