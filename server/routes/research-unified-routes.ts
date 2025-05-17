import { Router, Request, Response } from 'express';
import { searchPubMedWithPagination } from '../routes/research-routes';
import { searchEuropePMC, extractStudyFromEuropePMC } from '../europepmc-api';
import { searchSemanticScholar, extractStudyFromSemanticScholar } from '../semantic-scholar-api';
import { searchCrossRef, extractStudyFromCrossRef } from '../crossref-api';
import { storage } from '../storage';
import { enrichStudyFromPubMed as extractStudyFromPubMed } from '../pubmed-enricher';

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
            // For PubMed, use the searchPubMedWithPagination function
            const pubmedData = await searchPubMedWithPagination(query, pageNum - 1, pageSizeNum);
            const totalPubmedResults = pubmedData.length > 0 ? pubmedData[0]?.totalResults || pubmedData.length : 0;
            
            const formattedPubmedData = pubmedData.map((item: any) => ({
              ...item,
              source: 'pubmed'
            }));
            
            allResults = [...allResults, ...formattedPubmedData];
            totalResults += totalPubmedResults;
            break;
            
          case 'europepmc':
            const europepmcResults = await searchEuropePMC(query, pageNum, pageSizeNum);
            if (europepmcResults && europepmcResults.results) {
              // Results are already formatted in the searchEuropePMC function
              allResults = [...allResults, ...europepmcResults.results];
              totalResults += europepmcResults.total || 0;
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
    
    // Check for DOI duplicates to avoid showing the same study from multiple sources
    const uniqueResults = [];
    const seenDOIs = new Set();
    
    for (const result of allResults) {
      const doi = result.doi || '';
      // If no DOI or not seen before, add to unique results
      if (!doi || !seenDOIs.has(doi.toLowerCase())) {
        if (doi) {
          seenDOIs.add(doi.toLowerCase());
        }
        uniqueResults.push(result);
      }
    }
    
    // Sort results by relevance (could be enhanced with more sophisticated relevance scoring)
    // For now, just limit to requested page size
    allResults = uniqueResults.slice(0, pageSizeNum);
    
    // Check for empty results, if no results from multiple sources, default to PubMed-like format
    if (allResults.length === 0) {
      return res.json({
        success: true,
        source: selectedSources[0],
        query: query,
        total: 0,
        startIndex: 0,
        nextIndex: 0,
        articles: []
      });
    }
    
    // If we have results, format to match the PubMed API format for compatibility with existing frontend
    res.json({
      success: true,
      source: 'unified',  // Mark as unified search
      query: query,
      total: totalResults,
      startIndex: (pageNum - 1) * pageSizeNum,
      nextIndex: pageNum * pageSizeNum,
      articles: allResults,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (error: any) {
    console.error('Error in unified research search:', error);
    res.status(500).json({ error: error.message || 'Failed to search research databases' });
  }
});

/**
 * Add a paper to the review queue from any of the supported research databases
 * This implements the first tier of the two-tier review system
 */
router.post('/api/research/review-queue', async (req: Request, res: Response) => {
  try {
    const { source, userId, ...paperData } = req.body;
    
    if (!source) {
      return res.status(400).json({ error: 'Source is required' });
    }
    
    // Create an external ID based on source and paper ID
    let externalId = '';
    let doi = '';
    
    // Extract ID and DOI based on source
    if (source === 'pubmed' && paperData.pmid) {
      externalId = `pubmed:${paperData.pmid}`;
      doi = paperData.doi || '';
    } else if (source === 'europepmc' && paperData.id) {
      externalId = `europepmc:${paperData.id}`;
      doi = paperData.doi || '';
    } else if (source === 'semanticscholar' && paperData.paperId) {
      externalId = `semanticscholar:${paperData.paperId}`;
      doi = paperData.doi || '';
    } else if (source === 'crossref' && paperData.DOI) {
      externalId = `crossref:${paperData.DOI}`;
      doi = paperData.DOI || '';
    } else {
      return res.status(400).json({ error: 'Missing required identifier for this source' });
    }
    
    // Check for duplicate DOI in existing studies
    if (doi) {
      const duplicateCheck = await storage.checkStudyExists(doi);
      if (duplicateCheck.exists) {
        return res.status(409).json({
          success: false,
          isDuplicate: true,
          message: 'This study already exists in the database',
          studyId: duplicateCheck.studyId
        });
      }
    }
    
    // Extract study data based on source
    let studyData;
    switch (source.toLowerCase()) {
      case 'pubmed':
        studyData = await extractStudyFromPubMed(paperData);
        break;
      case 'europepmc':
        studyData = extractStudyFromEuropePMC(paperData);
        break;
      case 'semanticscholar':
        studyData = extractStudyFromSemanticScholar(paperData);
        break;
      case 'crossref':
        studyData = extractStudyFromCrossRef(paperData);
        break;
      default:
        return res.status(400).json({ error: 'Unsupported source' });
    }
    
    if (!studyData) {
      return res.status(404).json({ error: 'Failed to extract study data from paper' });
    }
    
    // Create review queue item
    const reviewItem = {
      externalId,
      doi,
      title: studyData.title,
      abstract: studyData.abstract,
      authors: studyData.authors,
      journal: studyData.journal,
      publishDate: studyData.publishDate,
      journalPublishDate: studyData.journalPublishDate || null,
      category: studyData.category,
      sourceUrl: studyData.sourceUrl || '',
      sourcePlatform: source.toLowerCase(),
      status: 'pending',
      savedByUserId: userId || null,
      // Store additional data as JSON in reviewNotes for later use when approving
      reviewNotes: JSON.stringify({ 
        originalData: paperData,
        extractedStudy: studyData
      })
    };
    
    // Save to review queue
    const savedReviewItem = await storage.saveStudyForReview(reviewItem);
    
    res.json({
      success: true,
      message: 'Study added to review queue successfully',
      reviewItem: savedReviewItem
    });
  } catch (error: any) {
    console.error('Error adding paper to review queue:', error);
    res.status(500).json({ error: error.message || 'Failed to add paper to review queue' });
  }
});

/**
 * Get items from the study review queue
 */
router.get('/api/research/review-queue', async (req: Request, res: Response) => {
  try {
    const { status, userId } = req.query;
    
    const filters: {status?: string, userId?: string} = {};
    if (status && typeof status === 'string') {
      filters.status = status;
    }
    if (userId && typeof userId === 'string') {
      filters.userId = userId;
    }
    
    const reviewItems = await storage.getStudyReviewQueue(filters);
    
    res.json({
      success: true,
      data: reviewItems
    });
  } catch (error: any) {
    console.error('Error fetching review queue:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch review queue' });
  }
});

/**
 * Update the status of a study in the review queue (approve or reject)
 * This implements the second tier of the two-tier review system
 */
router.put('/api/research/review-queue/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status, userId, notes } = req.body;
    
    if (!id || !status || !userId) {
      return res.status(400).json({ error: 'ID, status, and userId are required' });
    }
    
    if (status !== 'approved' && status !== 'rejected') {
      return res.status(400).json({ error: 'Status must be either "approved" or "rejected"' });
    }
    
    // Get the review item
    const reviewItem = await storage.getStudyReviewQueueById(parseInt(id));
    if (!reviewItem) {
      return res.status(404).json({ error: 'Review item not found' });
    }
    
    // Update the review status
    const updatedItem = await storage.updateStudyReviewStatus(
      parseInt(id),
      status,
      userId,
      notes
    );
    
    // If approved, create the actual study
    if (status === 'approved') {
      try {
        // Parse the stored study data from reviewNotes
        const storedData = JSON.parse(reviewItem.reviewNotes || '{}');
        const studyData = storedData.extractedStudy;
        
        if (!studyData) {
          return res.status(400).json({ error: 'No valid study data found in review item' });
        }
        
        // Save the study to the database
        const savedStudy = await storage.createStudy(studyData);
        
        res.json({
          success: true,
          message: 'Study approved and imported successfully',
          reviewItem: updatedItem,
          study: savedStudy
        });
      } catch (importError: any) {
        console.error('Error importing approved study:', importError);
        res.status(500).json({ 
          error: importError.message || 'Failed to import approved study',
          reviewItem: updatedItem  // Still return the updated review item
        });
      }
    } else {
      // If rejected, just return the updated review item
      res.json({
        success: true,
        message: 'Study rejected successfully',
        reviewItem: updatedItem
      });
    }
  } catch (error: any) {
    console.error('Error updating review queue item:', error);
    res.status(500).json({ error: error.message || 'Failed to update review queue item' });
  }
});

/**
 * Delete an item from the review queue
 */
router.delete('/api/research/review-queue/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    if (!id) {
      return res.status(400).json({ error: 'ID is required' });
    }
    
    await storage.deleteStudyFromReviewQueue(parseInt(id));
    
    res.json({
      success: true,
      message: 'Study removed from review queue'
    });
  } catch (error: any) {
    console.error('Error deleting review queue item:', error);
    res.status(500).json({ error: error.message || 'Failed to delete review queue item' });
  }
});

/**
 * Import a paper directly from any of the supported research databases (legacy method)
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