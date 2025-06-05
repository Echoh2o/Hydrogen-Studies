/**
 * Test PubMed Data Enrichment
 * Direct implementation to populate studies with authentic research data
 */

import { db } from './db';
import { studies } from '../shared/schema';
import { eq } from 'drizzle-orm';

/**
 * Test enrichment for a single study
 */
export async function testEnrichStudy(studyId: number): Promise<void> {
  try {
    console.log(`Testing enrichment for study ${studyId}`);
    
    // Get study details
    const [study] = await db.select().from(studies).where(eq(studies.id, studyId));
    if (!study) {
      console.log(`Study ${studyId} not found`);
      return;
    }

    console.log(`Found study: ${study.title}`);
    console.log(`DOI: ${study.doi}`);

    // Test Europe PMC API (no key required)
    if (study.doi) {
      console.log('Testing Europe PMC API...');
      await testEuropePMC(study.doi);
    }

    // Test CrossRef API (no key required)
    if (study.doi) {
      console.log('Testing CrossRef API...');
      await testCrossRef(study.doi);
    }

    // Test Semantic Scholar API (no key required)
    console.log('Testing Semantic Scholar API...');
    await testSemanticScholar(study.title);

  } catch (error) {
    console.error(`Error testing enrichment for study ${studyId}:`, error);
  }
}

/**
 * Test Europe PMC API
 */
async function testEuropePMC(doi: string): Promise<void> {
  try {
    const searchUrl = `https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=DOI:${doi}&format=json&resultType=core`;
    console.log(`Calling Europe PMC: ${searchUrl}`);
    
    const response = await fetch(searchUrl);
    const data = await response.json();
    
    console.log('Europe PMC Response:', {
      hitCount: data.hitCount,
      results: data.resultList?.result?.length || 0
    });

    if (data.resultList?.result?.[0]) {
      const article = data.resultList.result[0];
      console.log('Article found:', {
        title: article.title,
        pmcid: article.pmcid,
        pmid: article.pmid,
        hasAuthors: !!article.authorList,
        hasGrants: !!article.grantsList
      });

      // Test full text fetch if PMC ID available
      if (article.pmcid) {
        console.log(`Testing full text fetch for ${article.pmcid}...`);
        const fullTextUrl = `https://www.ebi.ac.uk/europepmc/webservices/rest/${article.pmcid}/fullTextXML`;
        const fullTextResponse = await fetch(fullTextUrl);
        console.log('Full text available:', fullTextResponse.ok);
      }
    }

  } catch (error) {
    console.error('Europe PMC API error:', error);
  }
}

/**
 * Test CrossRef API
 */
async function testCrossRef(doi: string): Promise<void> {
  try {
    const url = `https://api.crossref.org/works/${doi}`;
    console.log(`Calling CrossRef: ${url}`);
    
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.message) {
      const work = data.message;
      console.log('CrossRef data found:', {
        title: work.title?.[0],
        citationCount: work['is-referenced-by-count'],
        hasFunder: !!work.funder,
        hasLicense: !!work.license
      });
    }

  } catch (error) {
    console.error('CrossRef API error:', error);
  }
}

/**
 * Test Semantic Scholar API
 */
async function testSemanticScholar(title: string): Promise<void> {
  try {
    const searchUrl = `https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(title)}&fields=title,authors,citationCount,fieldsOfStudy&limit=1`;
    console.log(`Calling Semantic Scholar: ${searchUrl}`);
    
    const response = await fetch(searchUrl);
    const data = await response.json();
    
    console.log('Semantic Scholar Response:', {
      total: data.total,
      results: data.data?.length || 0
    });

    if (data.data?.[0]) {
      const paper = data.data[0];
      console.log('Paper found:', {
        title: paper.title,
        citationCount: paper.citationCount,
        authorsCount: paper.authors?.length,
        fieldsOfStudy: paper.fieldsOfStudy
      });
    }

  } catch (error) {
    console.error('Semantic Scholar API error:', error);
  }
}

/**
 * Populate a study with real data
 */
export async function populateStudyWithRealData(studyId: number): Promise<boolean> {
  try {
    console.log(`Populating study ${studyId} with real data...`);
    
    // Get study details
    const [study] = await db.select().from(studies).where(eq(studies.id, studyId));
    if (!study) {
      console.log(`Study ${studyId} not found`);
      return false;
    }

    let updatedData: any = {};

    // Fetch from Europe PMC
    if (study.doi) {
      const europePmcData = await fetchEuropePmcData(study.doi);
      if (europePmcData) {
        updatedData = { ...updatedData, ...europePmcData };
      }
    }

    // Fetch from CrossRef
    if (study.doi) {
      const crossrefData = await fetchCrossRefData(study.doi);
      if (crossrefData) {
        updatedData = { ...updatedData, ...crossrefData };
      }
    }

    // Fetch from Semantic Scholar
    const semanticData = await fetchSemanticScholarData(study.title);
    if (semanticData) {
      updatedData = { ...updatedData, ...semanticData };
    }

    // Update database if we have data
    if (Object.keys(updatedData).length > 0) {
      await db.update(studies)
        .set(updatedData)
        .where(eq(studies.id, studyId));
      
      console.log(`Successfully updated study ${studyId} with:`, Object.keys(updatedData));
      return true;
    }

    console.log(`No additional data found for study ${studyId}`);
    return false;

  } catch (error) {
    console.error(`Error populating study ${studyId}:`, error);
    return false;
  }
}

async function fetchEuropePmcData(doi: string): Promise<any> {
  try {
    const searchUrl = `https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=DOI:${doi}&format=json&resultType=core`;
    const response = await fetch(searchUrl);
    const data = await response.json();

    if (data.resultList?.result?.[0]) {
      const article = data.resultList.result[0];
      
      const updateData: any = {};

      if (article.authorList?.author) {
        const affiliations = article.authorList.author
          .map((a: any) => `${a.fullName}${a.affiliation ? ` (${a.affiliation})` : ''}`)
          .join('; ');
        updateData.author_affiliations = affiliations;
        console.log('Author affiliations found:', affiliations);
      }

      if (article.grantsList?.grant) {
        const funding = article.grantsList.grant
          .map((g: any) => `${g.agency}${g.grantId ? ` (${g.grantId})` : ''}`)
          .join('; ');
        updateData.funding_sources = funding;
        console.log('Funding sources found:', funding);
      }

      if (article.keywordList?.keyword) {
        updateData.keywords = article.keywordList.keyword;
      }

      // Try to get full text
      if (article.pmcid) {
        try {
          const fullTextUrl = `https://www.ebi.ac.uk/europepmc/webservices/rest/${article.pmcid}/fullTextXML`;
          const fullTextResponse = await fetch(fullTextUrl);
          if (fullTextResponse.ok) {
            const fullTextXml = await fullTextResponse.text();
            updateData.full_text_xml = fullTextXml;
            updateData.full_text = extractTextFromXml(fullTextXml);
          }
        } catch (error) {
          console.log(`Could not fetch full text for ${article.pmcid}`);
        }
      }

      return updateData;
    }
  } catch (error) {
    console.error('Error fetching Europe PMC data:', error);
  }
  return null;
}

async function fetchCrossRefData(doi: string): Promise<any> {
  try {
    const url = `https://api.crossref.org/works/${doi}`;
    const response = await fetch(url);
    const data = await response.json();

    if (data.message) {
      const work = data.message;
      const updateData: any = {};

      if (work['is-referenced-by-count']) {
        updateData.citation_count = work['is-referenced-by-count'];
      }

      if (work.funder) {
        const funding = work.funder.map((f: any) => f.name).join('; ');
        if (!updateData.funding_sources) {
          updateData.funding_sources = funding;
        }
      }

      return updateData;
    }
  } catch (error) {
    console.error('Error fetching CrossRef data:', error);
  }
  return null;
}

async function fetchSemanticScholarData(title: string): Promise<any> {
  try {
    const searchUrl = `https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(title)}&fields=title,authors,citationCount,fieldsOfStudy&limit=1`;
    const response = await fetch(searchUrl);
    const data = await response.json();

    if (data.data?.[0]) {
      const paper = data.data[0];
      const updateData: any = {};

      if (paper.citationCount && !updateData.citation_count) {
        updateData.citation_count = paper.citationCount;
      }

      if (paper.fieldsOfStudy && !updateData.keywords) {
        updateData.keywords = paper.fieldsOfStudy;
      }

      if (paper.authors) {
        const affiliations = paper.authors
          .map((a: any) => `${a.name}${a.affiliations?.join(', ') ? ` (${a.affiliations.join(', ')})` : ''}`)
          .join('; ');
        if (!updateData.author_affiliations) {
          updateData.author_affiliations = affiliations;
        }
      }

      return updateData;
    }
  } catch (error) {
    console.error('Error fetching Semantic Scholar data:', error);
  }
  return null;
}

function extractTextFromXml(xml: string): string {
  return xml
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, 10000); // Limit to first 10k characters
}