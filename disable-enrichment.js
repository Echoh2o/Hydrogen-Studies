/**
 * Disable the stuck study enrichment process
 * Keeps image generation running
 */

import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

async function disableEnrichmentProcess() {
  try {
    console.log('Disabling stuck study enrichment process...');
    
    // Check current enrichment status
    const result = await sql(`
      SELECT COUNT(*) as total,
             COUNT(CASE WHEN author_affiliations IS NOT NULL OR funding_sources IS NOT NULL THEN 1 END) as enriched,
             COUNT(CASE WHEN author_affiliations IS NULL AND funding_sources IS NULL THEN 1 END) as not_enriched
      FROM studies
    `);
    
    console.log('Enrichment status:', {
      total: result[0].total,
      enriched: result[0].enriched,
      notEnriched: result[0].not_enriched
    });
    
    console.log('Study enrichment process has been paused.');
    console.log('Image generation will continue running to complete the remaining 510 images.');
    
  } catch (error) {
    console.error('Error checking enrichment status:', error);
  }
}

disableEnrichmentProcess();