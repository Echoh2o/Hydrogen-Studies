/**
 * Auto-Enrichment Manager
 * Ensures batch enrichment continues automatically across app restarts
 */

import { db } from './db';
import { sql } from 'drizzle-orm';
import { startBatchEnrichment, isBatchRunning } from './batch-enrichment-system';

interface EnrichmentState {
  isEnabled: boolean;
  lastRunTime: Date;
  totalProcessed: number;
  targetDaily: number;
}

let enrichmentState: EnrichmentState = {
  isEnabled: true,
  lastRunTime: new Date(),
  totalProcessed: 0,
  targetDaily: 1000 // Target to enrich 1000 studies per day
};

export async function initializeAutoEnrichment(): Promise<void> {
  console.log('Initializing auto-enrichment system...');
  
  try {
    // Check if enrichment should be running
    const unenrichedCount = await getUnenrichedStudyCount();
    
    if (unenrichedCount > 0) {
      console.log(`Found ${unenrichedCount} studies needing enrichment`);
      
      // Start enrichment if not already running
      if (!isBatchRunning()) {
        console.log('Starting auto-enrichment process...');
        
        // Start in background without blocking app startup
        setTimeout(async () => {
          try {
            await startBatchEnrichment();
            console.log('Auto-enrichment completed successfully');
          } catch (error) {
            console.error('Auto-enrichment error:', error);
            // Retry after 5 minutes on error
            setTimeout(() => initializeAutoEnrichment(), 5 * 60 * 1000);
          }
        }, 10000); // Wait 10 seconds after startup
        
      } else {
        console.log('Batch enrichment already running');
      }
    } else {
      console.log('All studies are already enriched with authentic data');
    }
    
  } catch (error) {
    console.error('Error initializing auto-enrichment:', error);
  }
}

export async function getUnenrichedStudyCount(): Promise<number> {
  try {
    const result = await db.execute(sql`
      SELECT COUNT(*) as count
      FROM studies 
      WHERE doi IS NOT NULL 
      AND doi != '' 
      AND (author_affiliations IS NULL OR author_affiliations = '')
    `);
    
    return result.rows?.[0]?.count || 0;
  } catch (error) {
    console.error('Error getting unenriched study count:', error);
    return 0;
  }
}

export async function getEnrichmentStats(): Promise<{
  total: number;
  enriched: number;
  remaining: number;
  percentage: number;
}> {
  try {
    const totalResult = await db.execute(sql`
      SELECT COUNT(*) as count
      FROM studies 
      WHERE doi IS NOT NULL AND doi != ''
    `);
    
    const enrichedResult = await db.execute(sql`
      SELECT COUNT(*) as count
      FROM studies 
      WHERE doi IS NOT NULL 
      AND doi != '' 
      AND author_affiliations IS NOT NULL 
      AND author_affiliations != ''
    `);
    
    const total = totalResult.rows?.[0]?.count || 0;
    const enriched = enrichedResult.rows?.[0]?.count || 0;
    const remaining = total - enriched;
    const percentage = total > 0 ? (enriched / total) * 100 : 0;
    
    return {
      total,
      enriched,
      remaining,
      percentage: Math.round(percentage * 10) / 10
    };
    
  } catch (error) {
    console.error('Error getting enrichment stats:', error);
    return {
      total: 0,
      enriched: 0,
      remaining: 0,
      percentage: 0
    };
  }
}

export function setAutoEnrichmentEnabled(enabled: boolean): void {
  enrichmentState.isEnabled = enabled;
  console.log(`Auto-enrichment ${enabled ? 'enabled' : 'disabled'}`);
}

export function getEnrichmentState(): EnrichmentState {
  return enrichmentState;
}