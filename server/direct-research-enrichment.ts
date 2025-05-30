/**
 * Direct Research Enrichment
 * Enhances studies with authentic data from research APIs
 */

import { db } from './db';
import { sql } from 'drizzle-orm';

async function enrichWithResearchAPIs() {
  console.log('Starting direct research enrichment...');
  
  // Get studies missing authentic research data
  const studiesNeedingEnrichment = await db.execute(sql`
    SELECT id, title, doi
    FROM studies 
    WHERE doi IS NOT NULL AND doi != ''
      AND (pdf_url IS NULL OR pdf_url = '' OR citation_url IS NULL OR citation_url = '' OR source_url IS NULL OR source_url = '')
    LIMIT 20
  `);

  console.log(`Found ${studiesNeedingEnrichment.rows.length} studies needing enrichment`);

  let enriched = 0;
  for (const study of studiesNeedingEnrichment.rows) {
    try {
      const enrichmentData = await fetchAuthenticData(study.doi as string);
      
      if (enrichmentData) {
        await db.execute(sql`
          UPDATE studies 
          SET 
            pdf_url = COALESCE(pdf_url, ${enrichmentData.pdfUrl}),
            citation_url = COALESCE(citation_url, ${enrichmentData.citationUrl}),
            source_url = COALESCE(source_url, ${enrichmentData.sourceUrl})
          WHERE id = ${study.id}
        `);
        
        enriched++;
        console.log(`Enriched study ${study.id}: ${study.title}`);
      }
      
      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 300));
      
    } catch (error) {
      console.warn(`Failed to enrich study ${study.id}:`, error);
    }
  }

  console.log(`Enrichment completed: ${enriched}/${studiesNeedingEnrichment.rows.length} studies enhanced`);
}

async function fetchAuthenticData(doi: string) {
  // Try CrossRef first
  try {
    const response = await fetch(`https://api.crossref.org/works/${doi}`, {
      headers: {
        'User-Agent': 'HydrogenStudies/1.0 (mailto:contact@hydrogenstudies.com)'
      }
    });

    if (response.ok) {
      const data = await response.json();
      const work = data.message;

      return {
        citationUrl: `https://doi.org/${doi}`,
        sourceUrl: work.URL || `https://doi.org/${doi}`,
        pdfUrl: work.link?.find((l: any) => l['content-type']?.includes('pdf'))?.URL || null
      };
    }
  } catch (error) {
    console.log(`CrossRef failed for ${doi}`);
  }

  // Fallback to PubMed search
  try {
    const searchResponse = await fetch(
      `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=${encodeURIComponent(doi)}&retmode=json`
    );

    if (searchResponse.ok) {
      const searchData = await searchResponse.json();
      const pmid = searchData.esearchresult?.idlist?.[0];

      if (pmid) {
        return {
          citationUrl: `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`,
          sourceUrl: `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`,
          pdfUrl: null
        };
      }
    }
  } catch (error) {
    console.log(`PubMed failed for ${doi}`);
  }

  return null;
}

enrichWithResearchAPIs().then(() => {
  console.log('Research enrichment process completed');
  process.exit(0);
}).catch(error => {
  console.error('Research enrichment failed:', error);
  process.exit(1);
});