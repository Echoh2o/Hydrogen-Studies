/**
 * Simple Research Enrichment
 * 
 * Streamlined approach to add authentic research links using CrossRef and PubMed APIs
 */

import { db } from './db';
import { sql } from 'drizzle-orm';

interface EnrichmentStats {
  processed: number;
  enriched: number;
  errors: number;
}

async function enrichResearchData() {
  console.log('Starting research data enrichment...');
  
  const stats: EnrichmentStats = {
    processed: 0,
    enriched: 0,
    errors: 0
  };

  // Get studies that need enrichment
  const studies = await db.execute(sql`
    SELECT id, title, doi 
    FROM studies 
    WHERE doi IS NOT NULL 
    AND doi != ''
    AND (citation_url IS NULL OR citation_url = '')
    ORDER BY id
    LIMIT 200
  `);

  console.log(`Found ${studies.rows.length} studies needing enrichment`);

  for (const study of studies.rows) {
    stats.processed++;
    
    try {
      const doi = study.doi as string;
      const enrichmentData = await getResearchLinks(doi);
      
      if (enrichmentData.citationUrl || enrichmentData.sourceUrl) {
        await updateStudyLinks(study.id as number, enrichmentData);
        stats.enriched++;
        console.log(`✓ Enriched study ${study.id}: ${study.title}`);
      }
      
    } catch (error) {
      stats.errors++;
      console.log(`✗ Error with study ${study.id}: ${error}`);
    }
    
    // Rate limiting
    await new Promise(resolve => setTimeout(resolve, 300));
    
    if (stats.processed % 10 === 0) {
      console.log(`Progress: ${stats.processed} processed, ${stats.enriched} enriched`);
    }
  }

  console.log('\nEnrichment completed:');
  console.log(`Processed: ${stats.processed}`);
  console.log(`Enriched: ${stats.enriched}`);
  console.log(`Errors: ${stats.errors}`);
  
  return stats;
}

async function getResearchLinks(doi: string) {
  const links = {
    citationUrl: '',
    sourceUrl: '',
    pdfUrl: ''
  };

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
      
      links.citationUrl = `https://doi.org/${doi}`;
      links.sourceUrl = work.URL || `https://doi.org/${doi}`;
      
      const pdfLink = work.link?.find((l: any) => 
        l['content-type']?.includes('pdf') || 
        l['content-type']?.includes('application/pdf')
      );
      
      if (pdfLink) {
        links.pdfUrl = pdfLink.URL;
      }
    }
  } catch (error) {
    console.log(`CrossRef failed for ${doi}`);
  }

  // Try PubMed if we don't have good links yet
  if (!links.citationUrl) {
    try {
      const searchResponse = await fetch(
        `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=${encodeURIComponent(doi)}&retmode=json`
      );

      if (searchResponse.ok) {
        const searchData = await searchResponse.json();
        const pmid = searchData.esearchresult?.idlist?.[0];

        if (pmid) {
          links.citationUrl = `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`;
          if (!links.sourceUrl) {
            links.sourceUrl = `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`;
          }
        }
      }
    } catch (error) {
      console.log(`PubMed failed for ${doi}`);
    }
  }

  return links;
}

async function updateStudyLinks(studyId: number, links: any) {
  const updates = [];
  const values = [studyId];
  
  if (links.citationUrl) {
    updates.push('citation_url = $' + (values.length + 1));
    values.push(links.citationUrl);
  }
  
  if (links.sourceUrl) {
    updates.push('source_url = $' + (values.length + 1));
    values.push(links.sourceUrl);
  }
  
  if (links.pdfUrl) {
    updates.push('pdf_url = $' + (values.length + 1));
    values.push(links.pdfUrl);
  }
  
  if (updates.length > 0) {
    const query = `UPDATE studies SET ${updates.join(', ')} WHERE id = $1`;
    await db.execute(sql.raw(query, values));
  }
}

// Run enrichment
enrichResearchData()
  .then(stats => {
    console.log('Research enrichment completed successfully');
    process.exit(0);
  })
  .catch(error => {
    console.error('Research enrichment failed:', error);
    process.exit(1);
  });