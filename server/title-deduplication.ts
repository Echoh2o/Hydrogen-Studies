/**
 * Title Deduplication System
 * 
 * Uses DOI lookups to retrieve correct, authoritative titles for duplicate studies
 */

import { db } from "./db";
import { studies } from "@shared/schema";
import { eq, sql } from "drizzle-orm";
import axios from "axios";

interface CrossRefResponse {
  message: {
    title: string[];
    DOI: string;
    author?: Array<{ given?: string; family?: string }>;
    published?: { 'date-parts': number[][] };
    'container-title'?: string[];
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

    // Clean the DOI
    const cleanDOI = doi.replace(/^(https?:\/\/)?(dx\.)?doi\.org\//, '').trim();
    
    const response = await axios.get(`https://api.crossref.org/works/${cleanDOI}`, {
      headers: {
        'User-Agent': 'HydrogenStudies/1.0 (mailto:research@hydrogenstudies.com)'
      },
      timeout: 10000
    });

    const data: CrossRefResponse = response.data;
    
    if (data.message && data.message.title && data.message.title.length > 0) {
      // Get the primary title and clean it
      return data.message.title[0].trim();
    }
    
    return null;
  } catch (error) {
    console.error(`Error fetching title for DOI ${doi}:`, error);
    return null;
  }
}

/**
 * Get correct title from PubMed API using PMID
 */
async function getTitleFromPMID(pmid: string): Promise<string | null> {
  try {
    if (!pmid) return null;

    const response = await axios.get('https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi', {
      params: {
        db: 'pubmed',
        id: pmid,
        retmode: 'xml',
        rettype: 'abstract'
      },
      timeout: 10000
    });

    // Parse XML to extract title
    const xmlData = response.data;
    const titleMatch = xmlData.match(/<ArticleTitle>(.*?)<\/ArticleTitle>/);
    
    if (titleMatch && titleMatch[1]) {
      return titleMatch[1].trim();
    }
    
    return null;
  } catch (error) {
    console.error(`Error fetching title for PMID ${pmid}:`, error);
    return null;
  }
}

/**
 * Fix duplicate titles by getting correct titles from DOI/PMID
 */
export async function fixDuplicateTitles(): Promise<{
  processed: number;
  fixed: number;
  errors: number;
}> {
  console.log('Starting duplicate title deduplication process...');
  
  // Get all studies with duplicate titles that have DOIs
  const duplicateGroups = await db.execute(sql`
    SELECT title, COUNT(*) as count, STRING_AGG(id::text, ',') as study_ids
    FROM studies 
    WHERE title IS NOT NULL 
    GROUP BY title 
    HAVING COUNT(*) > 1
    ORDER BY COUNT(*) DESC
  `);

  let processed = 0;
  let fixed = 0;
  let errors = 0;

  for (const group of duplicateGroups.rows || []) {
    const title = group.title as string;
    const studyIds = (group.study_ids as string).split(',').map(id => parseInt(id.trim()));
    
    console.log(`\nProcessing duplicate group: "${title}" (${studyIds.length} studies)`);
    
    // Get all studies in this duplicate group
    const duplicateStudies = await db
      .select()
      .from(studies)
      .where(sql`id = ANY(ARRAY[${studyIds.join(',')}])`);

    for (const study of duplicateStudies) {
      processed++;
      
      try {
        let correctTitle: string | null = null;
        
        // First try to get title from DOI
        if (study.doi && !study.doi.includes('additional informati')) {
          console.log(`  Fetching title from DOI for study ${study.id}: ${study.doi}`);
          correctTitle = await getTitleFromDOI(study.doi);
          
          // Add a small delay to be respectful to APIs
          await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        // If DOI didn't work, try PMID if available
        if (!correctTitle && study.pmid) {
          console.log(`  Fetching title from PMID for study ${study.id}: ${study.pmid}`);
          correctTitle = await getTitleFromPMID(study.pmid);
          
          await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        // Update the study with the correct title if found
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
          console.log(`  ✗ Could not retrieve correct title for study ${study.id}`);
        }
        
      } catch (error) {
        console.error(`  ✗ Error processing study ${study.id}:`, error);
        errors++;
      }
    }
  }

  console.log(`\nDeduplication complete:`);
  console.log(`  Processed: ${processed} studies`);
  console.log(`  Fixed: ${fixed} titles`);
  console.log(`  Errors: ${errors} failures`);

  return { processed, fixed, errors };
}

/**
 * Check duplicate status after cleanup
 */
export async function checkDuplicateStatus(): Promise<{
  totalStudies: number;
  duplicateGroups: number;
  totalDuplicates: number;
}> {
  const [totalResult] = await db.execute(sql`SELECT COUNT(*) as total FROM studies`);
  const totalStudies = totalResult.total as number;

  const duplicateResult = await db.execute(sql`
    SELECT 
      COUNT(*) as duplicate_groups,
      SUM(count - 1) as total_duplicates
    FROM (
      SELECT title, COUNT(*) as count
      FROM studies 
      WHERE title IS NOT NULL 
      GROUP BY title 
      HAVING COUNT(*) > 1
    ) AS duplicate_counts
  `);

  const duplicateGroups = (duplicateResult.rows[0]?.duplicate_groups as number) || 0;
  const totalDuplicates = (duplicateResult.rows[0]?.total_duplicates as number) || 0;

  return {
    totalStudies,
    duplicateGroups,
    totalDuplicates
  };
}

/**
 * Process duplicates in batches to avoid overwhelming APIs
 */
export async function fixDuplicateTitlesInBatches(batchSize: number = 50): Promise<void> {
  const status = await checkDuplicateStatus();
  console.log(`Starting batch processing of ${status.totalDuplicates} duplicate titles...`);

  let totalFixed = 0;
  let totalErrors = 0;
  let batchNumber = 1;

  // Process in smaller batches to be respectful to external APIs
  while (true) {
    console.log(`\n--- Processing Batch ${batchNumber} ---`);
    
    const result = await fixDuplicateTitles();
    totalFixed += result.fixed;
    totalErrors += result.errors;

    // Check if we still have duplicates
    const currentStatus = await checkDuplicateStatus();
    
    if (currentStatus.totalDuplicates === 0 || result.fixed === 0) {
      console.log('\nDeduplication process complete!');
      break;
    }

    console.log(`Batch ${batchNumber} complete. Remaining duplicates: ${currentStatus.totalDuplicates}`);
    batchNumber++;

    // Wait between batches to be respectful to APIs
    console.log('Waiting 10 seconds before next batch...');
    await new Promise(resolve => setTimeout(resolve, 10000));
  }

  console.log(`\nFinal Results:`);
  console.log(`  Total titles fixed: ${totalFixed}`);
  console.log(`  Total errors: ${totalErrors}`);
  
  const finalStatus = await checkDuplicateStatus();
  console.log(`  Remaining duplicates: ${finalStatus.totalDuplicates}`);
}