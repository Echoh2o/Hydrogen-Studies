/**
 * Multi-Source Enricher
 * 
 * This module enriches study data by fetching additional details from multiple sources:
 * - PubMed
 * - Europe PMC
 * - Semantic Scholar
 * - CrossRef
 * 
 * The enrichment process prioritizes the most complete data sources for each field.
 */

import { Study } from '@shared/schema';
import { storage } from './storage';
import axios from 'axios';
import { extractPMID, extractPMIDFromIdentifier } from './pubmed-enricher';
import { getEuropePMCArticle } from './europepmc-api';
import { getSemanticScholarPaper } from './semantic-scholar-api';
import { getCrossRefArticleByDOI } from './crossref-api';

/**
 * Enriches a study with data from multiple sources
 * @param studyId The database ID of the study to enrich
 * @returns Object with success status and message
 */
export async function enrichStudyFromAllSources(studyId: number): Promise<{ success: boolean; message: string }> {
  try {
    // Get the study from the database
    const study = await storage.getStudyById(studyId);
    if (!study) {
      return { success: false, message: 'Study not found' };
    }

    // Track which fields we're trying to enrich
    const fieldsToEnrich = new Set([
      'abstract',
      'authors',
      'journal',
      'publishDate',
      'doi',
      'pmid',
      'pdfUrl',
      'citationUrl',
      'methods',
      'results',
      'conclusion',
      'keywords',
      'healthConditions',
      'bodySystems'
    ]);

    // Start with the existing study data
    const enrichedData: Partial<Study> = { ...study };

    // Check which fields are missing or incomplete
    const missingFields = getMissingFields(study, fieldsToEnrich);
    if (missingFields.size === 0) {
      return { success: true, message: 'Study already has complete data' };
    }

    console.log(`Enriching study ID ${studyId} with missing fields:`, Array.from(missingFields));

    // Try to find identifiers
    let pmid = study.pmid || extractPMIDFromIdentifier(study.doi || '') || null;
    const doi = study.doi || null;

    // Data sources to check (in order of priority)
    const dataSourcesChecked: string[] = [];
    let foundNewData = false;

    // --- 1. Try PubMed (most complete for biomedical research) ---
    if (pmid) {
      dataSourcesChecked.push('PubMed');
      const pubmedData = await fetchPubMedArticle(pmid);
      if (pubmedData) {
        const newData = mapPubMedDataToStudy(pubmedData, study);
        Object.assign(enrichedData, newData);
        foundNewData = true;
        
        // Update missing fields
        updateMissingFields(enrichedData, missingFields);
      }
    }

    // --- 2. Try Europe PMC (good for open access content) ---
    if (missingFields.size > 0 && (pmid || doi)) {
      dataSourcesChecked.push('Europe PMC');
      const id = pmid || doi;
      try {
        const europepmcData = await getEuropePMCArticle(id);
        if (europepmcData) {
          const newData = mapEuropePMCDataToStudy(europepmcData, study);
          
          // Only update fields that are still missing
          for (const field of Object.keys(newData)) {
            if (missingFields.has(field as keyof Study)) {
              enrichedData[field as keyof Study] = newData[field as keyof Study];
              foundNewData = true;
            }
          }
          
          // Update missing fields list
          updateMissingFields(enrichedData, missingFields);
        }
      } catch (error) {
        console.error('Error fetching Europe PMC data:', error);
      }
    }

    // --- 3. Try Semantic Scholar (good for citations) ---
    if (missingFields.size > 0 && (pmid || doi)) {
      dataSourcesChecked.push('Semantic Scholar');
      const id = doi ? doi : (pmid ? `PMID:${pmid}` : null);
      if (id) {
        try {
          const semanticScholarData = await getSemanticScholarPaper(id);
          if (semanticScholarData) {
            const newData = mapSemanticScholarDataToStudy(semanticScholarData, study);
            
            // Only update fields that are still missing
            for (const field of Object.keys(newData)) {
              if (missingFields.has(field as keyof Study)) {
                enrichedData[field as keyof Study] = newData[field as keyof Study];
                foundNewData = true;
              }
            }
            
            // Update missing fields list
            updateMissingFields(enrichedData, missingFields);
          }
        } catch (error) {
          console.error('Error fetching Semantic Scholar data:', error);
        }
      }
    }

    // --- 4. Try CrossRef (good for DOI resolution) ---
    if (missingFields.size > 0 && doi) {
      dataSourcesChecked.push('CrossRef');
      try {
        const crossrefData = await getCrossRefArticleByDOI(doi);
        if (crossrefData) {
          const newData = mapCrossRefDataToStudy(crossrefData, study);
          
          // Only update fields that are still missing
          for (const field of Object.keys(newData)) {
            if (missingFields.has(field as keyof Study)) {
              enrichedData[field as keyof Study] = newData[field as keyof Study];
              foundNewData = true;
            }
          }
        }
      } catch (error) {
        console.error('Error fetching CrossRef data:', error);
      }
    }

    // If we found new data, update the study
    if (foundNewData) {
      // Update the study in the database
      await storage.updateStudy(studyId, enrichedData);
      
      return { 
        success: true, 
        message: `Successfully enriched study data from: ${dataSourcesChecked.join(', ')}` 
      };
    } else {
      return { 
        success: false, 
        message: `No additional data found from: ${dataSourcesChecked.join(', ')}` 
      };
    }
  } catch (error) {
    console.error('Error enriching study:', error);
    return { success: false, message: `Error enriching study: ${error}` };
  }
}

/**
 * Helper function to get missing or incomplete fields from a study
 */
function getMissingFields(study: Study, fieldsToCheck: Set<keyof Study>): Set<keyof Study> {
  const missingFields = new Set<keyof Study>();
  
  for (const field of fieldsToCheck) {
    const value = study[field];
    
    // Check if field is missing, empty string, null, or empty array
    if (
      value === undefined || 
      value === null || 
      (typeof value === 'string' && value.trim() === '') ||
      (Array.isArray(value) && value.length === 0)
    ) {
      missingFields.add(field);
    }
  }
  
  return missingFields;
}

/**
 * Helper function to update the list of missing fields
 */
function updateMissingFields(study: Partial<Study>, missingFields: Set<keyof Study>): void {
  for (const field of Array.from(missingFields)) {
    const value = study[field];
    if (
      value !== undefined && 
      value !== null && 
      !(typeof value === 'string' && value.trim() === '') &&
      !(Array.isArray(value) && value.length === 0)
    ) {
      missingFields.delete(field);
    }
  }
}

/**
 * Fetch article data from PubMed by PMID
 */
async function fetchPubMedArticle(pmid: string): Promise<any> {
  try {
    const response = await axios.get(`https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&id=${pmid}&retmode=json`);
    if (response.data && response.data.result && response.data.result[pmid]) {
      return response.data.result[pmid];
    }
    return null;
  } catch (error) {
    console.error('Error fetching PubMed article:', error);
    return null;
  }
}

/**
 * Map PubMed data to study fields
 */
function mapPubMedDataToStudy(pubmedData: any, study: Study): Partial<Study> {
  const updatedData: Partial<Study> = {};
  
  // Map the fields
  if (pubmedData.title && (!study.title || study.title.trim() === '')) {
    updatedData.title = pubmedData.title;
  }
  
  if (pubmedData.abstract && (!study.abstract || study.abstract.trim() === '')) {
    updatedData.abstract = pubmedData.abstract;
  }
  
  if (pubmedData.authors && (!study.authors || study.authors.trim() === '')) {
    const authors = pubmedData.authors.map((author: any) => `${author.name}`).join(', ');
    updatedData.authors = authors;
  }
  
  if (pubmedData.fulljournalname && (!study.journal || study.journal.trim() === '')) {
    updatedData.journal = pubmedData.fulljournalname;
  }
  
  if (pubmedData.pubdate && (!study.publishDate || study.publishDate.trim() === '')) {
    updatedData.publishDate = formatPubMedDate(pubmedData.pubdate);
  }
  
  if (pubmedData.elocationid && pubmedData.elocationid.startsWith('doi:') && (!study.doi || study.doi.trim() === '')) {
    updatedData.doi = pubmedData.elocationid.replace('doi:', '');
  }
  
  if (pubmedData.articleids) {
    const doiObject = pubmedData.articleids.find((id: any) => id.idtype === 'doi');
    if (doiObject && doiObject.value && (!study.doi || study.doi.trim() === '')) {
      updatedData.doi = doiObject.value;
    }
    
    const pmidObject = pubmedData.articleids.find((id: any) => id.idtype === 'pmid');
    if (pmidObject && pmidObject.value && (!study.pmid || study.pmid.trim() === '')) {
      updatedData.pmid = pmidObject.value;
    }
  }
  
  if (pubmedData.availablefromurl && (!study.pdfUrl || study.pdfUrl.trim() === '')) {
    updatedData.pdfUrl = pubmedData.availablefromurl;
  }
  
  return updatedData;
}

/**
 * Map Europe PMC data to study fields
 */
function mapEuropePMCDataToStudy(europepmcData: any, study: Study): Partial<Study> {
  const updatedData: Partial<Study> = {};
  
  if (europepmcData.title && (!study.title || study.title.trim() === '')) {
    updatedData.title = europepmcData.title;
  }
  
  if (europepmcData.abstractText && (!study.abstract || study.abstract.trim() === '')) {
    updatedData.abstract = europepmcData.abstractText;
  }
  
  if (europepmcData.authorString && (!study.authors || study.authors.trim() === '')) {
    updatedData.authors = europepmcData.authorString;
  }
  
  if (europepmcData.journalTitle && (!study.journal || study.journal.trim() === '')) {
    updatedData.journal = europepmcData.journalTitle;
  }
  
  if (europepmcData.firstPublicationDate && (!study.publishDate || study.publishDate.trim() === '')) {
    updatedData.publishDate = europepmcData.firstPublicationDate;
  }
  
  if (europepmcData.doi && (!study.doi || study.doi.trim() === '')) {
    updatedData.doi = europepmcData.doi;
  }
  
  if (europepmcData.pmid && (!study.pmid || study.pmid.trim() === '')) {
    updatedData.pmid = europepmcData.pmid;
  }
  
  if (europepmcData.fullTextUrlList && europepmcData.fullTextUrlList.fullTextUrl) {
    const pdfUrl = europepmcData.fullTextUrlList.fullTextUrl.find((url: any) => 
      url.availabilityCode === 'OA' && url.documentStyle === 'pdf'
    );
    
    if (pdfUrl && pdfUrl.url && (!study.pdfUrl || study.pdfUrl.trim() === '')) {
      updatedData.pdfUrl = pdfUrl.url;
    }
  }
  
  if (europepmcData.keywordList && europepmcData.keywordList.keyword && 
      (!study.keywords || !study.keywords.length)) {
    updatedData.keywords = europepmcData.keywordList.keyword;
  }
  
  return updatedData;
}

/**
 * Map Semantic Scholar data to study fields
 */
function mapSemanticScholarDataToStudy(semanticScholarData: any, study: Study): Partial<Study> {
  const updatedData: Partial<Study> = {};
  
  if (semanticScholarData.title && (!study.title || study.title.trim() === '')) {
    updatedData.title = semanticScholarData.title;
  }
  
  if (semanticScholarData.abstract && (!study.abstract || study.abstract.trim() === '')) {
    updatedData.abstract = semanticScholarData.abstract;
  }
  
  if (semanticScholarData.authors && (!study.authors || study.authors.trim() === '')) {
    const authors = semanticScholarData.authors.map((author: any) => author.name).join(', ');
    updatedData.authors = authors;
  }
  
  if (semanticScholarData.venue && (!study.journal || study.journal.trim() === '')) {
    updatedData.journal = semanticScholarData.venue;
  }
  
  if (semanticScholarData.year && (!study.publishDate || study.publishDate.trim() === '')) {
    updatedData.publishDate = `${semanticScholarData.year}-01-01`;
  }
  
  if (semanticScholarData.externalIds && semanticScholarData.externalIds.DOI && 
      (!study.doi || study.doi.trim() === '')) {
    updatedData.doi = semanticScholarData.externalIds.DOI;
  }
  
  if (semanticScholarData.externalIds && semanticScholarData.externalIds.PMID && 
      (!study.pmid || study.pmid.trim() === '')) {
    updatedData.pmid = semanticScholarData.externalIds.PMID;
  }
  
  if (semanticScholarData.openAccessPdf && semanticScholarData.openAccessPdf.url && 
      (!study.pdfUrl || study.pdfUrl.trim() === '')) {
    updatedData.pdfUrl = semanticScholarData.openAccessPdf.url;
  }
  
  if (semanticScholarData.url && (!study.citationUrl || study.citationUrl.trim() === '')) {
    updatedData.citationUrl = semanticScholarData.url;
  }
  
  return updatedData;
}

/**
 * Map CrossRef data to study fields
 */
function mapCrossRefDataToStudy(crossrefData: any, study: Study): Partial<Study> {
  const updatedData: Partial<Study> = {};
  
  if (crossrefData.title && crossrefData.title[0] && (!study.title || study.title.trim() === '')) {
    updatedData.title = crossrefData.title[0];
  }
  
  if (crossrefData.abstract && (!study.abstract || study.abstract.trim() === '')) {
    updatedData.abstract = crossrefData.abstract;
  }
  
  if (crossrefData.author && (!study.authors || study.authors.trim() === '')) {
    const authors = crossrefData.author.map((author: any) => {
      return author.given && author.family 
        ? `${author.given} ${author.family}` 
        : (author.family || author.given || '');
    }).join(', ');
    updatedData.authors = authors;
  }
  
  if (crossrefData['container-title'] && crossrefData['container-title'][0] && 
      (!study.journal || study.journal.trim() === '')) {
    updatedData.journal = crossrefData['container-title'][0];
  }
  
  if (crossrefData.created && crossrefData.created['date-parts'] && 
      (!study.publishDate || study.publishDate.trim() === '')) {
    const dateParts = crossrefData.created['date-parts'][0];
    if (dateParts.length >= 3) {
      updatedData.publishDate = `${dateParts[0]}-${String(dateParts[1]).padStart(2, '0')}-${String(dateParts[2]).padStart(2, '0')}`;
    } else if (dateParts.length >= 2) {
      updatedData.publishDate = `${dateParts[0]}-${String(dateParts[1]).padStart(2, '0')}-01`;
    } else if (dateParts.length >= 1) {
      updatedData.publishDate = `${dateParts[0]}-01-01`;
    }
  }
  
  if (crossrefData.DOI && (!study.doi || study.doi.trim() === '')) {
    updatedData.doi = crossrefData.DOI;
  }
  
  if (crossrefData.link && crossrefData.link.length > 0) {
    const pdfLink = crossrefData.link.find((link: any) => 
      link['content-type'] && link['content-type'].includes('pdf')
    );
    
    if (pdfLink && pdfLink.URL && (!study.pdfUrl || study.pdfUrl.trim() === '')) {
      updatedData.pdfUrl = pdfLink.URL;
    }
  }
  
  if (crossrefData.URL && (!study.citationUrl || study.citationUrl.trim() === '')) {
    updatedData.citationUrl = crossrefData.URL;
  }
  
  return updatedData;
}

/**
 * Format a PubMed date string to ISO date
 */
function formatPubMedDate(dateString: string): string {
  if (!dateString) return '';
  
  // PubMed dates can be in various formats
  // Try to parse it into YYYY-MM-DD
  
  // Remove any timezone information
  dateString = dateString.split(' ').slice(0, 3).join(' ');
  
  // Check for YYYY MMM DD format
  const matches = dateString.match(/(\d{4}) ([A-Za-z]{3}) (\d{1,2})/);
  if (matches) {
    const year = matches[1];
    const month = getMonthNumber(matches[2]);
    const day = matches[3].padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  
  // Check for YYYY format
  const yearMatch = dateString.match(/^(\d{4})$/);
  if (yearMatch) {
    return `${yearMatch[1]}-01-01`;
  }
  
  // If all else fails, return the original string
  return dateString;
}

/**
 * Convert month name to month number
 */
function getMonthNumber(monthName: string): string {
  const months: { [key: string]: string } = {
    'Jan': '01', 'Feb': '02', 'Mar': '03', 'Apr': '04', 'May': '05', 'Jun': '06',
    'Jul': '07', 'Aug': '08', 'Sep': '09', 'Oct': '10', 'Nov': '11', 'Dec': '12'
  };
  
  return months[monthName] || '01';
}

/**
 * Batch process studies that need enrichment
 * @param limit Maximum number of studies to process
 * @returns Number of studies enriched
 */
export async function batchEnrichStudies(limit: number = 10): Promise<number> {
  try {
    // Get studies that might need enrichment (missing key fields)
    const studies = await storage.getStudiesNeedingEnrichment(limit);
    
    if (studies.length === 0) {
      console.log('No studies found that need enrichment');
      return 0;
    }
    
    console.log(`Found ${studies.length} studies that need enrichment`);
    
    let enrichedCount = 0;
    
    for (const study of studies) {
      const result = await enrichStudyFromAllSources(study.id);
      
      if (result.success) {
        enrichedCount++;
        console.log(`Successfully enriched study ID ${study.id}: ${result.message}`);
      } else {
        console.log(`Failed to enrich study ID ${study.id}: ${result.message}`);
      }
    }
    
    return enrichedCount;
  } catch (error) {
    console.error('Error in batch enrichment:', error);
    return 0;
  }
}