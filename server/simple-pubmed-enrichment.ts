/**
 * Simple PubMed Enrichment - Working Implementation
 * Populates studies with authentic research data using direct database operations
 */

import { db } from './db';
import { studies } from '../shared/schema';
import { eq, sql } from 'drizzle-orm';

export async function enrichStudySimple(studyId: number): Promise<boolean> {
  try {
    console.log(`Enriching study ${studyId} with authentic PubMed data`);
    
    // Get study details
    const [study] = await db.select().from(studies).where(eq(studies.id, studyId));
    if (!study) {
      console.log(`Study ${studyId} not found`);
      return false;
    }

    console.log(`Processing: ${study.title}`);
    console.log(`DOI: ${study.doi}`);

    let enrichmentData: any = {};

    // Fetch authentic data from Europe PMC
    if (study.doi) {
      try {
        const pmcData = await fetchEuropePMCData(study.doi);
        Object.assign(enrichmentData, pmcData);
      } catch (error) {
        console.log('Europe PMC fetch error:', error);
      }
    }

    // Fetch authentic data from CrossRef
    if (study.doi) {
      try {
        const crossrefData = await fetchCrossRefData(study.doi);
        Object.assign(enrichmentData, crossrefData);
      } catch (error) {
        console.log('CrossRef fetch error:', error);
      }
    }

    // Update database using Drizzle ORM
    if (Object.keys(enrichmentData).length > 0) {
      console.log('Updating database with authentic data:', Object.keys(enrichmentData));
      
      // Clean up duplicate field names - keep only underscore versions
      const cleanData = { ...enrichmentData };
      delete cleanData.citationCount;
      delete cleanData.fundingSources;
      
      await db.update(studies)
        .set(cleanData)
        .where(eq(studies.id, studyId));
      
      console.log(`Successfully updated study ${studyId} with authentic research data`);
      return true;
    }

    console.log(`No authentic data retrieved for study ${studyId}`);
    return false;

  } catch (error) {
    console.error(`Error enriching study ${studyId}:`, error);
    return false;
  }
}

async function fetchEuropePMCData(doi: string) {
  const searchUrl = `https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=DOI:${doi}&format=json&resultType=core`;
  console.log(`Fetching from Europe PMC: ${searchUrl}`);
  
  const response = await fetch(searchUrl);
  const data = await response.json();

  const enrichment: any = {};

  if (data.resultList?.result?.[0]) {
    const article = data.resultList.result[0];
    console.log(`Found article in Europe PMC: ${article.title}`);
    
    // Author affiliations from authentic source
    if (article.authorList?.author) {
      const affiliations = article.authorList.author
        .map((a: any) => `${a.fullName}${a.affiliation ? ` (${a.affiliation})` : ''}`)
        .filter(af => af.trim().length > 0)
        .join('; ');
      
      if (affiliations.length > 0) {
        enrichment.author_affiliations = affiliations;
        console.log('Authentic author affiliations:', affiliations);
      }
    }

    // Funding sources from authentic source
    if (article.grantsList?.grant) {
      const funding = article.grantsList.grant
        .map((g: any) => `${g.agency}${g.grantId ? ` (${g.grantId})` : ''}`)
        .filter(f => f.trim().length > 0)
        .join('; ');
      
      if (funding.length > 0) {
        enrichment.funding_sources = funding;
        console.log('Authentic funding sources:', funding);
      }
    }

    // Keywords from authentic source
    if (article.keywordList?.keyword) {
      enrichment.keywords = article.keywordList.keyword;
      console.log('Authentic keywords:', article.keywordList.keyword);
    }

    // Try to fetch full text if PMC ID available
    if (article.pmcid) {
      try {
        console.log(`Attempting to fetch full text for PMC ID: ${article.pmcid}`);
        const fullTextUrl = `https://www.ebi.ac.uk/europepmc/webservices/rest/${article.pmcid}/fullTextXML`;
        const fullTextResponse = await fetch(fullTextUrl);
        
        if (fullTextResponse.ok) {
          const fullTextXml = await fullTextResponse.text();
          console.log(`Successfully retrieved full text (${fullTextXml.length} characters)`);
          
          // Extract statistical methods
          const methodsMatch = fullTextXml.match(/<sec[^>]*>[\s\S]*?<title[^>]*>.*?(methods?|statistical|analysis).*?<\/title>[\s\S]*?<\/sec>/i);
          if (methodsMatch) {
            const methodsText = methodsMatch[0]
              .replace(/<[^>]*>/g, ' ')
              .replace(/\s+/g, ' ')
              .trim()
              .substring(0, 1000);
            enrichment.statistical_methods = methodsText;
            console.log('Extracted statistical methods from full text');
          }
          
          // Extract ethics information
          const ethicsMatch = fullTextXml.match(/<sec[^>]*>[\s\S]*?<title[^>]*>.*?(ethics?|ethical|approval|consent).*?<\/title>[\s\S]*?<\/sec>/i);
          if (ethicsMatch) {
            const ethicsText = ethicsMatch[0]
              .replace(/<[^>]*>/g, ' ')
              .replace(/\s+/g, ' ')
              .trim()
              .substring(0, 500);
            enrichment.ethical_approval = ethicsText;
            console.log('Extracted ethical approval information');
          }
          
          // Store first portion of full text
          const cleanText = fullTextXml
            .replace(/<[^>]*>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
          enrichment.full_text = cleanText.substring(0, 5000);
          console.log('Extracted full text content');
        }
      } catch (error) {
        console.log(`Could not fetch full text for ${article.pmcid}:`, error);
      }
    }
  }

  return enrichment;
}

async function fetchCrossRefData(doi: string) {
  const url = `https://api.crossref.org/works/${doi}`;
  console.log(`Fetching from CrossRef: ${url}`);
  
  const response = await fetch(url);
  const data = await response.json();

  const enrichment: any = {};

  if (data.message) {
    const work = data.message;
    console.log(`Found work in CrossRef: ${work.title?.[0]}`);
    
    // Citation count from authentic source
    if (work['is-referenced-by-count']) {
      enrichment.citation_count = work['is-referenced-by-count'];
      console.log('Authentic citation count:', enrichment.citation_count);
    }

    // Additional funding sources from authentic source
    if (work.funder && work.funder.length > 0) {
      const crossrefFunding = work.funder
        .map((f: any) => f.name)
        .filter(name => name && name.trim().length > 0)
        .join('; ');
      
      if (crossrefFunding.length > 0 && !enrichment.funding_sources) {
        enrichment.funding_sources = crossrefFunding;
        console.log('Authentic CrossRef funding:', crossrefFunding);
      }
    }
  }

  return enrichment;
}

export async function enrichMultipleStudies(studyIds: number[]): Promise<void> {
  console.log(`Starting batch enrichment for ${studyIds.length} studies`);
  
  for (let i = 0; i < studyIds.length; i++) {
    const studyId = studyIds[i];
    console.log(`Processing study ${i + 1}/${studyIds.length}: ${studyId}`);
    
    await enrichStudySimple(studyId);
    
    // Rate limiting - wait 1 second between requests
    if (i < studyIds.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  console.log('Batch enrichment completed');
}