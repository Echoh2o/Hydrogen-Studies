import axios from 'axios';
import { BaseScraper } from './base-scraper';
import { InsertStudy } from '@shared/schema';
import { storage } from '../storage';

interface PubMedSearchResult {
  esearchresult: {
    count: string;
    retmax: string;
    retstart: string;
    idlist: string[];
  };
}

interface PubMedSummaryResult {
  result: {
    uids: string[];
    [uid: string]: {
      uid: string;
      pubdate: string;
      epubdate: string;
      source: string;
      authors: Array<{
        name: string;
        authtype: string;
        clusterid: string;
      }>;
      lastauthor: string;
      title: string;
      sortTitle: string;
      volume: string;
      issue: string;
      pages: string;
      lang: string[];
      nlmuniqueid: string;
      issn: string;
      essn: string;
      pubtype: string[];
      recordstatus: string;
      pubstatus: string;
      articleids: Array<{
        idtype: string;
        idtypen: number;
        value: string;
      }>;
      history: Array<{
        pubstatus: string;
        date: string;
      }>;
      references: string[];
      attributes: string[];
      pmcrefcount: string;
      fulljournalname: string;
      elocationid: string;
      doctype: string;
      srccontriblist: any[];
      booktitle: string;
      medium: string;
      edition: string;
      publisherlocation: string;
      publishername: string;
      srcdate: string;
      reportnumber: string;
      availablefromurl: string;
      locationlabel: string;
      doccontriblist: any[];
      docdate: string;
      bookname: string;
      chapter: string;
      sortpubdate: string;
      sortfirstauthor: string;
      vernaculartitle: string;
      abstracttext?: string;
    };
  };
}

export class PubMedScraper extends BaseScraper {
  private apiKey: string;
  private baseUrl = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils';
  
  constructor() {
    super('pubmed');
    this.apiKey = process.env.PUBMED_API_KEY || '';
    if (!this.apiKey) {
      console.warn('Warning: PUBMED_API_KEY not set. API rate limits will be restricted.');
    }
  }
  
  /**
   * Search PubMed for studies related to hydrogen therapy
   */
  async searchArticles(
    query: string = 'hydrogen therapy',
    options: {
      max?: number;
      startIndex?: number;
      sort?: 'relevance' | 'pub_date';
    } = {}
  ): Promise<{ 
    articles: any[]; 
    total: number; 
    nextIndex?: number;
  }> {
    try {
      const { max = 10, startIndex = 0, sort = 'relevance' } = options;
      
      // Step 1: Search for article IDs
      const searchUrl = `${this.baseUrl}/esearch.fcgi?db=pubmed&term=${encodeURIComponent(query)}&retmax=${max}&retstart=${startIndex}&retmode=json&sort=${sort === 'pub_date' ? 'pub+date' : 'relevance'}${this.apiKey ? `&api_key=${this.apiKey}` : ''}`;
      
      const searchResponse = await axios.get<PubMedSearchResult>(searchUrl, {
        headers: this.getRandomizedHeaders()
      });
      
      const searchData = searchResponse.data;
      const idList = searchData.esearchresult.idlist;
      const totalResults = parseInt(searchData.esearchresult.count);
      
      if (idList.length === 0) {
        return { articles: [], total: 0 };
      }
      
      // Step 2: Fetch article details using the IDs
      const summaryUrl = `${this.baseUrl}/esummary.fcgi?db=pubmed&id=${idList.join(',')}&retmode=json${this.apiKey ? `&api_key=${this.apiKey}` : ''}`;
      
      const summaryResponse = await axios.get<PubMedSummaryResult>(summaryUrl, {
        headers: this.getRandomizedHeaders()
      });
      
      const summaryData = summaryResponse.data;
      
      // Step 3: Process the results into a standardized format
      const articles = idList.map(id => {
        const article = summaryData.result[id];
        
        // Extract DOI if available
        const doiObject = article.articleids.find(id => id.idtype === 'doi');
        const doi = doiObject ? doiObject.value : '';
        
        // Extract PMID
        const pmidObject = article.articleids.find(id => id.idtype === 'pubmed');
        const pmid = pmidObject ? pmidObject.value : '';
        
        // Format authors
        const authorsList = article.authors ? 
          article.authors.map(author => author.name).join(', ') : '';
        
        return {
          id: pmid,
          title: article.title,
          abstract: article.abstracttext || '',
          authors: authorsList,
          journal: article.fulljournalname,
          publishDate: article.pubdate,
          doi: doi,
          pmid: pmid,
          articleType: article.pubtype ? article.pubtype.join(', ') : '',
          url: `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`,
          source: 'PubMed'
        };
      });
      
      // Calculate next index for pagination
      const nextIndex = startIndex + idList.length < totalResults ? 
        startIndex + idList.length : undefined;
      
      return { 
        articles, 
        total: totalResults,
        nextIndex
      };
      
    } catch (error) {
      console.error('Error searching PubMed:', error);
      throw new Error(`Failed to search PubMed: ${error.message}`);
    }
  }
  
  /**
   * Fetch full article details for a specific PubMed ID
   */
  async getArticleDetails(pmid: string): Promise<any> {
    try {
      // Fetch detailed article information
      const detailsUrl = `${this.baseUrl}/efetch.fcgi?db=pubmed&id=${pmid}&retmode=xml${this.apiKey ? `&api_key=${this.apiKey}` : ''}`;
      
      const response = await axios.get(detailsUrl, {
        headers: this.getRandomizedHeaders()
      });
      
      // For XML response, we would need to parse the XML
      // This is a simplified version that returns the raw XML
      return {
        xml: response.data,
        url: `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`
      };
      
    } catch (error) {
      console.error(`Error fetching article details for PMID ${pmid}:`, error);
      throw new Error(`Failed to fetch article details: ${error.message}`);
    }
  }
  
  /**
   * Convert a PubMed article to our study format
   */
  convertToStudy(article: any): InsertStudy {
    // Determine if the article is peer-reviewed based on journal and pub type
    const isPeerReviewed = this.isPeerReviewedArticle(article);
    
    // Extract publication year from the date
    let publishYear = null;
    if (article.publishDate) {
      const yearMatch = article.publishDate.match(/(\d{4})/);
      if (yearMatch && yearMatch[1]) {
        publishYear = parseInt(yearMatch[1]);
      }
    }
    
    // Convert the article to our study schema
    const study: InsertStudy = {
      title: article.title || '',
      abstract: article.abstract || '',
      authors: article.authors || '',
      journal: article.journal || '',
      publishDate: this.formatDate(article.publishDate) || new Date().toISOString(),
      publishYear,
      category: this.detectCategory(article.title, article.abstract),
      methods: '',
      results: '',
      conclusion: '',
      doi: article.doi || '',
      pdfUrl: article.url || '',
      citationUrl: article.url || '',
      peerReviewed: isPeerReviewed,
      imageUrl: '',
      keywords: this.extractKeywords(article.title, article.abstract),
      healthConditions: this.extractHealthConditions(article.title, article.abstract),
      bodySystems: this.extractBodySystems(article.title, article.abstract),
      studyType: this.detectStudyType(article.title, article.abstract, article.articleType),
      country: '',
      region: '',
      sampleSize: null,
      duration: ''
    };
    
    return study;
  }
  
  /**
   * Format a PubMed date to ISO string
   */
  private formatDate(pubmedDate: string): string {
    if (!pubmedDate) return new Date().toISOString();
    
    try {
      // Handle different PubMed date formats
      // Format: YYYY Mon Day
      const dateFormat = /^(\d{4})\s+([A-Za-z]{3})(?:\s+(\d{1,2}))?/;
      const match = pubmedDate.match(dateFormat);
      
      if (match) {
        const [_, year, month, day] = match;
        const months: Record<string, number> = {
          Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
          Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11
        };
        
        // Use 1 as default day if not provided
        const dayNumber = day ? parseInt(day) : 1;
        
        return new Date(
          parseInt(year),
          months[month] || 0,
          dayNumber
        ).toISOString();
      }
      
      // Try parsing as is
      const date = new Date(pubmedDate);
      if (!isNaN(date.getTime())) {
        return date.toISOString();
      }
      
      // Fall back to current date
      return new Date().toISOString();
      
    } catch (error) {
      console.warn(`Error parsing date "${pubmedDate}":`, error);
      return new Date().toISOString();
    }
  }
  
  /**
   * Determine if an article is peer-reviewed based on journal info
   */
  private isPeerReviewedArticle(article: any): boolean {
    // Most articles in PubMed are from peer-reviewed journals
    // Articles with these pub types are typically not peer-reviewed
    const nonPeerReviewedTypes = [
      'preprint', 
      'blog', 
      'comment', 
      'letter', 
      'news', 
      'editorial'
    ];
    
    if (article.articleType) {
      const articleType = article.articleType.toLowerCase();
      for (const type of nonPeerReviewedTypes) {
        if (articleType.includes(type)) {
          return false;
        }
      }
    }
    
    return true;
  }
  
  /**
   * Detect study category based on title and abstract
   */
  private detectCategory(title: string, abstract: string): string {
    const content = `${title} ${abstract}`.toLowerCase();
    
    // Check for common categories
    if (content.includes('inflammation') || content.includes('inflammatory')) {
      return 'Inflammation';
    } else if (content.includes('cancer') || content.includes('tumor') || content.includes('oncology')) {
      return 'Cancer';
    } else if (content.includes('brain') || content.includes('neuro') || content.includes('cognitive')) {
      return 'Neurological';
    } else if (content.includes('heart') || content.includes('cardiac') || content.includes('cardiovascular')) {
      return 'Cardiovascular';
    } else if (content.includes('diabetes') || content.includes('metabolic')) {
      return 'Metabolic';
    } else if (content.includes('skin') || content.includes('dermatology')) {
      return 'Dermatology';
    } else if (content.includes('liver') || content.includes('hepatic')) {
      return 'Liver';
    } else if (content.includes('kidney') || content.includes('renal')) {
      return 'Kidney';
    } else if (content.includes('lung') || content.includes('respiratory') || content.includes('pulmonary')) {
      return 'Respiratory';
    } else if (content.includes('gut') || content.includes('intestine') || content.includes('gastro')) {
      return 'Gastrointestinal';
    } else if (content.includes('muscle') || content.includes('exercise') || content.includes('athletic')) {
      return 'Fitness';
    }
    
    return 'General';
  }
  
  /**
   * Extract keywords from title and abstract
   */
  private extractKeywords(title: string, abstract: string): string {
    const content = `${title} ${abstract}`.toLowerCase();
    const potentialKeywords = [
      'hydrogen', 'h2', 'molecular hydrogen', 'hydrogen-rich', 'hydrogen gas',
      'antioxidant', 'inflammation', 'oxidative stress', 'reactive oxygen species',
      'therapeutic', 'treatment', 'therapy', 'disease', 'prevention',
      'mitochondria', 'signaling', 'nrf2', 'water', 'saline'
    ];
    
    const foundKeywords = potentialKeywords.filter(keyword => 
      content.includes(keyword.toLowerCase())
    );
    
    return foundKeywords.join(', ');
  }
  
  /**
   * Extract health conditions mentioned in title and abstract
   */
  private extractHealthConditions(title: string, abstract: string): string {
    const content = `${title} ${abstract}`.toLowerCase();
    const conditions = [
      'alzheimer', 'parkinson', 'diabetes', 'cancer', 'stroke', 'heart disease',
      'arthritis', 'asthma', 'copd', 'depression', 'anxiety', 'hypertension',
      'obesity', 'inflammation', 'injury', 'wound', 'pain', 'fatigue',
      'allergy', 'autoimmune', 'ischemia'
    ];
    
    const foundConditions = conditions.filter(condition => 
      content.includes(condition.toLowerCase())
    );
    
    return foundConditions.join(', ');
  }
  
  /**
   * Extract body systems mentioned in title and abstract
   */
  private extractBodySystems(title: string, abstract: string): string {
    const content = `${title} ${abstract}`.toLowerCase();
    const systems = [
      'nervous system', 'brain', 'neurological',
      'cardiovascular', 'heart', 'circulatory',
      'respiratory', 'lung', 'pulmonary',
      'digestive', 'gastrointestinal', 'gut', 'intestine',
      'immune system', 'lymphatic',
      'endocrine', 'hormonal',
      'muscular', 'muscle',
      'skeletal', 'bone',
      'integumentary', 'skin',
      'renal', 'kidney', 'urinary',
      'reproductive'
    ];
    
    const foundSystems = systems.filter(system => 
      content.includes(system.toLowerCase())
    );
    
    return foundSystems.join(', ');
  }
  
  /**
   * Detect study type based on content and article type
   */
  private detectStudyType(title: string, abstract: string, articleType: string): string {
    const content = `${title} ${abstract} ${articleType || ''}`.toLowerCase();
    
    // Check for specific study types
    if (content.includes('review') || content.includes('meta-analysis')) {
      if (content.includes('systematic')) {
        return 'Systematic Review';
      }
      return 'Review';
    } else if (content.includes('randomized') || content.includes('rct')) {
      return 'Randomized Controlled Trial';
    } else if (content.includes('case report') || content.includes('case study')) {
      return 'Case Report';
    } else if (content.includes('cohort')) {
      return 'Cohort Study';
    } else if (content.includes('observational')) {
      return 'Observational Study';
    } else if (content.includes('clinical trial')) {
      return 'Clinical Trial';
    } else if (content.includes('pilot')) {
      return 'Pilot Study';
    } else if (content.includes('animal') || content.includes('mouse') || content.includes('rat') || 
              content.includes('mice') || content.includes('in vivo')) {
      return 'Animal Study';
    } else if (content.includes('in vitro') || content.includes('cell')) {
      return 'In Vitro Study';
    }
    
    return 'Research Article';
  }
}