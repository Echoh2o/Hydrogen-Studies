/**
 * Semantic Scholar API Integration
 * Documentation: https://api.semanticscholar.org/
 * 
 * This service provides access to academic papers and their metadata
 * which helps us enrich our hydrogen studies with more complete information.
 */

import axios from 'axios';
import type { InsertStudy } from '@shared/schema';

// Using public Semantic Scholar API without authentication

/**
 * Get article details by DOI for content enrichment
 * @param doi Digital Object Identifier
 * @returns Article data with fields optimized for content enrichment
 */
export async function getSemanticScholarArticleByDOI(doi: string): Promise<any> {
  const paper = await getSemanticScholarPaper(doi);
  if (!paper) return null;
  
  return {
    abstract: paper.abstract || '',
    title: paper.title || '',
    authors: paper.authors ? paper.authors.map((a: any) => a.name).join(', ') : '',
    imageUrl: paper.figures && paper.figures.length > 0 ? paper.figures[0].url : null,
    sections: paper.sections || [],
  };
}

/**
 * Get detailed paper information from Semantic Scholar by DOI
 * @param doi Digital Object Identifier
 * @returns Paper data
 */
export async function getSemanticScholarPaper(doi: string): Promise<any> {
  try {
    const response = await axios.get(`https://api.semanticscholar.org/graph/v1/paper/DOI:${doi}`, {
      params: {
        fields: 'title,abstract,url,journal,year,authors,venue,publicationDate,referenceCount,citationCount,influentialCitationCount,tldr,publicationTypes,publicationVenue,fieldsOfStudy,s2FieldsOfStudy,paperId,externalIds,isOpenAccess,openAccessPdf,citationStyles,embedding,sections,figures,equations',
      },
      headers: {},
      timeout: 10000
    });
    
    return response.data;
  } catch (error) {
    console.error(`Error fetching paper from Semantic Scholar by DOI ${doi}:`, error);
    return null;
  }
}

/**
 * Search Semantic Scholar for papers
 * @param query Search query
 * @param limit Number of results to return
 * @param offset Offset for pagination
 * @returns Search results
 */
export async function searchSemanticScholar(query: string, limit: number = 10, offset: number = 0): Promise<any> {
  try {
    const response = await axios.get('https://api.semanticscholar.org/graph/v1/paper/search', {
      params: {
        query,
        limit,
        offset,
        fields: 'title,abstract,url,journal,year,authors,venue,publicationDate,externalIds,isOpenAccess'
      },
      headers: {},
      timeout: 10000
    });
    
    return response.data;
  } catch (error) {
    console.error(`Error searching Semantic Scholar for "${query}":`, error);
    return { data: [], total: 0, offset, next: null };
  }
}

/**
 * Extract study data from Semantic Scholar API response
 * @param paperData Paper data from Semantic Scholar API
 * @returns Formatted study data for insertion
 */
export function extractStudyFromSemanticScholar(paperData: any): InsertStudy | null {
  if (!paperData) return null;

  // Extract DOI if available
  const doi = paperData.externalIds?.DOI || null;
  
  // Extract PubMed ID if available
  const pmid = paperData.externalIds?.PubMed || null;
  
  // Determine publication date
  let publishDate = new Date().toISOString().split('T')[0]; // Default to today
  
  if (paperData.publicationDate) {
    publishDate = paperData.publicationDate;
  } else if (paperData.year) {
    publishDate = `${paperData.year}-01-01`;
  }
  
  // Format authors
  let authors = '';
  if (paperData.authors && paperData.authors.length > 0) {
    authors = paperData.authors.map((author: any) => author.name).join(', ');
  }
  
  // Check if paper is peer-reviewed
  const isPeerReviewed = paperData.publicationTypes && 
    Array.isArray(paperData.publicationTypes) &&
    (paperData.publicationTypes.includes('Journal Article') || 
     paperData.publicationTypes.includes('Conference Paper'));
  
  // Construct the study object
  const study: InsertStudy = {
    title: paperData.title || 'Untitled Study',
    abstract: paperData.abstract || '',
    authors,
    journal: paperData.venue || paperData.journal?.name || 'Scientific Journal',
    publishDate,
    journalPublishDate: publishDate,
    category: 'general', // Default category
    peerReviewed: isPeerReviewed,
    hasMedia: paperData.figures && paperData.figures.length > 0,
    hasFullText: Boolean(paperData.openAccessPdf),
    doi,
    pmid,
    imageUrl: paperData.figures && paperData.figures.length > 0 ? paperData.figures[0].url : null,
    imageAlt: paperData.figures && paperData.figures.length > 0 ? paperData.figures[0].name || 'Figure from study' : null,
    pdfUrl: paperData.openAccessPdf?.url || null,
    citationUrl: doi ? `https://doi.org/${doi}` : null,
    sourcePlatform: 'Semantic Scholar'
  };

  return study;
}