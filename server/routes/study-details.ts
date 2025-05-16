import { Router } from 'express';
import { z } from 'zod';
import axios from 'axios';
import { db } from '../db';
import { studies } from '../../shared/schema';
import { extractPMIDFromIdentifier } from '../pubmed-enricher';

const router = Router();

// Schema for validating fetch details request
const fetchDetailsSchema = z.object({
  identifier: z.string().min(1, "Identifier is required")
});

/**
 * Fetch study details from PubMed using DOI or PMID
 */
router.post('/studies/fetch-details', async (req, res) => {
  try {
    const { identifier } = fetchDetailsSchema.parse(req.body);
    
    // Check if this is a DOI or PMID
    const pmid = extractPMIDFromIdentifier(identifier);
    
    if (!pmid) {
      return res.status(400).json({
        success: false,
        message: "Could not extract a valid PMID from the provided identifier"
      });
    }
    
    // Fetch article data from PubMed
    const articleData = await fetchPubMedArticleDetails(pmid);
    
    if (!articleData) {
      return res.status(404).json({
        success: false,
        message: "No article found with the provided identifier"
      });
    }
    
    return res.json({
      success: true,
      study: articleData
    });
  } catch (error: any) {
    console.error('Error fetching study details:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch study details'
    });
  }
});

/**
 * Fetch article data from PubMed by PMID
 */
async function fetchPubMedArticleDetails(pmid: string): Promise<any> {
  try {
    const apiKey = process.env.PUBMED_API_KEY;
    
    if (!apiKey) {
      throw new Error('PubMed API key is not configured');
    }
    
    // First, get the summary
    const summaryUrl = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi';
    const summaryParams = {
      db: 'pubmed',
      id: pmid,
      retmode: 'json',
      api_key: apiKey
    };
    
    const summaryResponse = await axios.get(summaryUrl, { params: summaryParams });
    const summaryData = summaryResponse.data.result[pmid];
    
    if (!summaryData) {
      return null;
    }
    
    // Then, get the abstract
    const fetchUrl = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi';
    const fetchParams = {
      db: 'pubmed',
      id: pmid,
      retmode: 'xml',
      api_key: apiKey
    };
    
    const fetchResponse = await axios.get(fetchUrl, { params: fetchParams });
    const xml = fetchResponse.data;
    
    // Extract abstract from XML
    let abstract = '';
    const abstractMatch = xml.match(/<AbstractText[^>]*>([\s\S]*?)<\/AbstractText>/g);
    
    if (abstractMatch) {
      abstract = abstractMatch.map((match: string) => {
        // Remove HTML tags
        return match.replace(/<[^>]*>/g, '');
      }).join(' ');
    }
    
    // Build the study object
    const study = {
      title: summaryData.title || '',
      abstract: abstract || '',
      authors: formatAuthors(summaryData.authors) || '',
      journal: summaryData.fulljournalname || summaryData.source || '',
      publishDate: formatPubDate(summaryData.pubdate) || '',
      doi: extractDOI(xml) || '',
      pdfUrl: `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`, // Default to PubMed URL
      citationUrl: `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`, // Default to PubMed URL
      methods: '',
      results: '',
      conclusion: '',
      year: extractYear(summaryData.pubdate),
      // Extract other fields as needed
    };
    
    return study;
  } catch (error) {
    console.error('Error fetching PubMed article:', error);
    return null;
  }
}

/**
 * Format authors into a string
 */
function formatAuthors(authors: any[]): string {
  if (!authors || !Array.isArray(authors)) return '';
  
  return authors
    .filter(author => author.name)
    .map(author => author.name)
    .join(', ');
}

/**
 * Format publication date
 */
function formatPubDate(pubdate: string): string {
  if (!pubdate) return '';
  
  // Convert to ISO format if possible
  try {
    const date = new Date(pubdate);
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0];
    }
  } catch (e) {}
  
  return pubdate;
}

/**
 * Extract year from publication date
 */
function extractYear(pubdate: string): number | null {
  if (!pubdate) return null;
  
  const yearMatch = pubdate.match(/\b(19|20)\d{2}\b/);
  
  if (yearMatch) {
    return parseInt(yearMatch[0], 10);
  }
  
  return null;
}

/**
 * Extract DOI from XML
 */
function extractDOI(xml: string): string | null {
  const doiMatch = xml.match(/<ArticleId IdType="doi">(.*?)<\/ArticleId>/);
  
  if (doiMatch && doiMatch[1]) {
    return doiMatch[1];
  }
  
  return null;
}

export default router;