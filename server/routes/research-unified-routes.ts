import { Router, Request, Response } from 'express';
import { searchPubMed } from '../routes/research-routes';
import { searchEuropePMC } from '../europepmc-api';
import { searchSemanticScholar } from '../semantic-scholar-api';
import { searchCrossRef } from '../crossref-api';
import { storage } from '../storage';
import { extractStudyFromPubMed } from '../pubmed-enricher';
import { extractStudyFromEuropePMC } from '../europepmc-api';
import { extractStudyFromSemanticScholar } from '../semantic-scholar-api';
import { extractStudyFromCrossRef } from '../crossref-api';

const router = Router();

/**
 * Unified search across multiple research databases
 * 
 * This endpoint searches across PubMed, Europe PMC, Semantic Scholar, and CrossRef
 * based on the selected sources and returns consolidated results.
 */
router.get('/api/research/search', async (req: Request, res: Response) => {
  try {
    const { 
      query, 
      page = '1', 
      pageSize = '10', 
      sources = 'pubmed' 
    } = req.query;
    
    if (!query || typeof query !== 'string') {
      return res.status(400).json({ error: 'Query parameter is required' });
    }
    
    const pageNum = parseInt(page as string);
    const pageSizeNum = parseInt(pageSize as string);
    const selectedSources = typeof sources === 'string' ? sources.split(',') : ['pubmed'];
    
    // Track all search results
    let allResults: any[] = [];
    let totalResults = 0;
    let errors: string[] = [];
    
    // Parallel search across all selected databases
    const searchPromises = selectedSources.map(async (source) => {
      try {
        switch (source.toLowerCase()) {
          case 'pubmed':
            const pubmedResults = await searchPubMed(query, pageNum, pageSizeNum);
            const pubmedData = pubmedResults.results.map((item: any) => ({
              ...item,
              source: 'pubmed'
            }));
            allResults = [...allResults, ...pubmedData];
            totalResults += pubmedResults.total;
            break;
            
          case 'europepmc':
            const europepmcResults = await searchEuropePMC(query, pageNum, pageSizeNum);
            if (europepmcResults && europepmcResults.resultList && europepmcResults.resultList.result) {
              const europepmcData = europepmcResults.resultList.result.map((item: any) => ({
                ...item,
                source: 'europepmc'
              }));
              allResults = [...allResults, ...europepmcData];
              totalResults += europepmcResults.hitCount || 0;
            }
            break;
            
          case 'semanticscholar':
            const semanticScholarResults = await searchSemanticScholar(query, pageNum - 1, pageSizeNum);
            if (semanticScholarResults && semanticScholarResults.data) {
              const semanticScholarData = semanticScholarResults.data.map((item: any) => ({
                ...item,
                source: 'semanticscholar'
              }));
              allResults = [...allResults, ...semanticScholarData];
              totalResults += semanticScholarResults.total || 0;
            }
            break;
            
          case 'crossref':
            const crossrefResults = await searchCrossRef(query, pageNum, pageSizeNum);
            if (crossrefResults && crossrefResults.items) {
              const crossrefData = crossrefResults.items.map((item: any) => ({
                ...item,
                source: 'crossref'
              }));
              allResults = [...allResults, ...crossrefData];
              totalResults += crossrefResults.totalResults || 0;
            }
            break;
        }
      } catch (error: any) {
        console.error(`Error searching ${source}:`, error);
        errors.push(`${source}: ${error.message || 'Unknown error'}`);
      }
    });
    
    // Wait for all searches to complete
    await Promise.all(searchPromises);
    
    // Sort results by relevance (could be enhanced with more sophisticated relevance scoring)
    allResults = allResults.slice(0, pageSizeNum);
    
    // Calculate pagination
    const totalPages = Math.ceil(totalResults / pageSizeNum);
    
    res.json({
      data: allResults,
      metadata: {
        total: totalResults,
        page: pageNum,
        pageSize: pageSizeNum,
        totalPages,
        errors: errors.length > 0 ? errors : undefined
      }
    });
  } catch (error: any) {
    console.error('Error in unified research search:', error);
    res.status(500).json({ error: error.message || 'Failed to search research databases' });
  }
});

/**
 * Import a paper from any of the supported research databases
 */
router.post('/api/research/import', async (req: Request, res: Response) => {
  try {
    const { source, ...paperData } = req.body;
    
    if (!source) {
      return res.status(400).json({ error: 'Source is required' });
    }
    
    // Check if study already exists
    let identifier = '';
    if (paperData.pmid) identifier = paperData.pmid;
    else if (paperData.doi) identifier = paperData.doi;
    else if (paperData.paperId) identifier = paperData.paperId;
    
    if (identifier) {
      const existingStudy = await storage.getStudyByIdentifier(identifier);
      if (existingStudy) {
        return res.status(409).json({ 
          message: 'This study already exists in the database',
          study: existingStudy
        });
      }
    }
    
    // Extract study based on source
    let study;
    switch (source.toLowerCase()) {
      case 'pubmed':
        study = await extractStudyFromPubMed(paperData);
        break;
      case 'europepmc':
        study = extractStudyFromEuropePMC(paperData);
        break;
      case 'semanticscholar':
        study = extractStudyFromSemanticScholar(paperData);
        break;
      case 'crossref':
        study = extractStudyFromCrossRef(paperData);
        break;
      default:
        return res.status(400).json({ error: 'Unsupported source' });
    }
    
    if (!study) {
      return res.status(404).json({ error: 'Failed to extract study data from paper' });
    }
    
    // Save study to database
    const savedStudy = await storage.createStudy(study);
    
    res.json({ 
      success: true, 
      message: 'Study imported successfully', 
      study: savedStudy 
    });
  } catch (error: any) {
    console.error('Error importing paper:', error);
    res.status(500).json({ error: error.message || 'Failed to import paper' });
  }
});

/**
 * Schedule a recurring search
 */
router.post('/api/research/schedule', async (req: Request, res: Response) => {
  try {
    // This would be implemented in a future version
    res.status(501).json({ message: 'Scheduled searches are not yet implemented' });
  } catch (error: any) {
    console.error('Error scheduling search:', error);
    res.status(500).json({ error: error.message || 'Failed to schedule search' });
  }
});

export default router;