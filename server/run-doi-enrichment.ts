/**
 * Direct DOI-Based Study Enrichment
 * Fetches authentic data from journal sources using DOIs for all 1,278 studies
 */

import { pool } from './db';

async function enrichStudiesWithDoi() {
  console.log('🚀 Starting DOI-based enrichment of hydrogen studies...');
  
  try {
    // Get all studies with DOIs that need enhancement
    const result = await pool.query(`
      SELECT id, title, doi, abstract, authors, journal, publish_date 
      FROM studies 
      WHERE doi IS NOT NULL AND doi != '' 
      AND (abstract IS NULL OR LENGTH(abstract) < 50 OR journal IS NULL OR journal = '' OR authors IS NULL OR authors = '')
      ORDER BY id
      LIMIT 100
    `);
    
    const studies = result.rows;
    console.log(`📊 Found ${studies.length} studies with DOIs that need enhancement`);

    if (studies.length === 0) {
      console.log('✅ All studies with DOIs are already well-enriched!');
      return;
    }

    let processed = 0;
    let enhanced = 0;
    let failed = 0;

    for (const study of studies) {
      try {
        console.log(`Processing study ${study.id}: ${study.title.substring(0, 50)}...`);
        
        const cleanDoi = study.doi.replace(/^https?:\/\/doi.org\//, '');
        console.log(`  DOI: ${cleanDoi}`);

        // Try CrossRef API first (most comprehensive academic metadata)
        let enrichmentData = await fetchFromCrossRef(cleanDoi);

        // If CrossRef fails, try PubMed
        if (!enrichmentData) {
          enrichmentData = await fetchFromPubMed(cleanDoi);
        }

        // If both fail, try EuropePMC
        if (!enrichmentData) {
          enrichmentData = await fetchFromEuropePMC(cleanDoi);
        }

        if (enrichmentData) {
          await updateStudyWithEnrichment(study.id, enrichmentData);
          enhanced++;
          console.log(`  ✅ Successfully enriched study ${study.id}`);
        } else {
          failed++;
          console.log(`  ⚠️  No enrichment data found for study ${study.id}`);
        }

      } catch (error) {
        failed++;
        console.error(`  ❌ Failed to enrich study ${study.id}:`, error);
      }
      
      processed++;
      
      // Respectful delay between requests
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log('🎉 DOI enrichment completed!');
    console.log(`📊 Results: ${enhanced} enhanced, ${failed} failed out of ${processed} processed`);

  } catch (error) {
    console.error('❌ Error during DOI enrichment:', error);
  }
}

/**
 * Fetch data from CrossRef API
 */
async function fetchFromCrossRef(doi: string): Promise<any | null> {
  try {
    const url = `https://api.crossref.org/works/${encodeURIComponent(doi)}`;
    
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'HydrogenStudies/1.0 (https://hydrogenstudies.com; mailto:info@hydrogenstudies.com)'
      }
    });

    if (!response.ok) {
      console.log(`    CrossRef API failed: ${response.status}`);
      return null;
    }

    const data = await response.json();
    const work = data.message;

    const enrichmentData: any = {};

    // Enhanced abstract
    if (work.abstract) {
      enrichmentData.abstract = work.abstract;
      console.log(`    ✅ Found abstract from CrossRef`);
    }

    // Authors
    if (work.author && Array.isArray(work.author)) {
      const authors = work.author.map((author: any) => 
        `${author.given || ''} ${author.family || ''}`.trim()
      ).filter(Boolean);
      
      if (authors.length > 0) {
        enrichmentData.authors = authors.join(', ');
        console.log(`    ✅ Found ${authors.length} authors from CrossRef`);
      }
    }

    // Journal information
    if (work['container-title']?.[0]) {
      enrichmentData.journal = work['container-title'][0];
      console.log(`    ✅ Found journal from CrossRef: ${enrichmentData.journal}`);
    }

    // Publication date
    if (work.published?.['date-parts']?.[0]) {
      const dateParts = work.published['date-parts'][0];
      if (dateParts.length >= 3) {
        enrichmentData.publish_date = `${dateParts[0]}-${String(dateParts[1]).padStart(2, '0')}-${String(dateParts[2]).padStart(2, '0')}`;
        console.log(`    ✅ Found publication date from CrossRef: ${enrichmentData.publish_date}`);
      }
    }

    return Object.keys(enrichmentData).length > 0 ? enrichmentData : null;

  } catch (error) {
    console.log(`    CrossRef error:`, error);
    return null;
  }
}

/**
 * Fetch data from PubMed API
 */
async function fetchFromPubMed(doi: string): Promise<any | null> {
  try {
    // Search for the paper by DOI to get PMID
    const searchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=${encodeURIComponent(doi)}[DOI]&retmode=json`;
    
    const searchResponse = await fetch(searchUrl);
    if (!searchResponse.ok) {
      console.log(`    PubMed search failed: ${searchResponse.status}`);
      return null;
    }

    const searchData = await searchResponse.json();
    if (!searchData.esearchresult?.idlist?.[0]) {
      console.log(`    No PubMed ID found for DOI`);
      return null;
    }

    const pmid = searchData.esearchresult.idlist[0];
    console.log(`    Found PMID: ${pmid}`);

    // Get detailed information
    const fetchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pubmed&id=${pmid}&retmode=xml`;
    
    const fetchResponse = await fetch(fetchUrl);
    if (!fetchResponse.ok) {
      console.log(`    PubMed fetch failed: ${fetchResponse.status}`);
      return null;
    }

    const xmlData = await fetchResponse.text();
    
    // Basic XML parsing (simplified)
    const enrichmentData: any = {};
    
    // Extract journal name
    const journalMatch = xmlData.match(/<Title>(.*?)<\/Title>/);
    if (journalMatch) {
      enrichmentData.journal = journalMatch[1];
      console.log(`    ✅ Found journal from PubMed: ${enrichmentData.journal}`);
    }

    return Object.keys(enrichmentData).length > 0 ? enrichmentData : null;

  } catch (error) {
    console.log(`    PubMed error:`, error);
    return null;
  }
}

/**
 * Fetch data from EuropePMC API
 */
async function fetchFromEuropePMC(doi: string): Promise<any | null> {
  try {
    const url = `https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=DOI:${encodeURIComponent(doi)}&format=json`;
    
    const response = await fetch(url);
    if (!response.ok) {
      console.log(`    EuropePMC failed: ${response.status}`);
      return null;
    }

    const data = await response.json();
    if (!data.resultList?.result?.[0]) {
      console.log(`    No results from EuropePMC`);
      return null;
    }

    const paper = data.resultList.result[0];
    const enrichmentData: any = {};

    // Abstract
    if (paper.abstractText) {
      enrichmentData.abstract = paper.abstractText;
      console.log(`    ✅ Found abstract from EuropePMC`);
    }

    // Journal
    if (paper.journalTitle) {
      enrichmentData.journal = paper.journalTitle;
      console.log(`    ✅ Found journal from EuropePMC: ${enrichmentData.journal}`);
    }

    // Authors
    if (paper.authorString) {
      enrichmentData.authors = paper.authorString;
      console.log(`    ✅ Found authors from EuropePMC`);
    }

    return Object.keys(enrichmentData).length > 0 ? enrichmentData : null;

  } catch (error) {
    console.log(`    EuropePMC error:`, error);
    return null;
  }
}

/**
 * Update study with enriched data
 */
async function updateStudyWithEnrichment(studyId: number, enrichmentData: any): Promise<void> {
  const updates = [];
  const values = [];
  let updateIndex = 1;

  for (const [key, value] of Object.entries(enrichmentData)) {
    if (value) {
      updates.push(`${key} = $${updateIndex++}`);
      values.push(value);
    }
  }

  if (updates.length > 0) {
    values.push(studyId);
    const query = `UPDATE studies SET ${updates.join(', ')} WHERE id = $${updateIndex}`;
    await pool.query(query, values);
  }
}

// Run the enrichment
enrichStudiesWithDoi();