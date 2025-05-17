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
    
    // Perform searches sequentially for more reliable results
    for (const source of selectedSources) {
      try {
        console.log(`Processing source: ${source}`);
        
        switch (source.toLowerCase()) {
          case 'pubmed':
            // For PubMed, use the searchPubMedWithPagination function
            console.log('Searching PubMed...');
            const pubmedData = await searchPubMedWithPagination(query, pageNum - 1, pageSizeNum);
            const totalPubmedResults = pubmedData.length > 0 ? pubmedData[0]?.totalResults || pubmedData.length : 0;
            
            const formattedPubmedData = pubmedData.map((item: any) => ({
              ...item,
              source: 'pubmed'
            }));
            
            console.log(`Found ${formattedPubmedData.length} results from PubMed`);
            allResults = [...allResults, ...formattedPubmedData];
            totalResults += totalPubmedResults;
            break;
            
          case 'europepmc':
            console.log('Searching EuropePMC...');
            const europepmcResults = await searchEuropePMC(query, pageNum, pageSizeNum);
            if (europepmcResults && europepmcResults.results) {
              // Results are already formatted in the searchEuropePMC function
              console.log(`Found ${europepmcResults.results.length} results from EuropePMC`);
              allResults = [...allResults, ...europepmcResults.results];
              totalResults += europepmcResults.total || 0;
            } else {
              console.log('No results from EuropePMC or unexpected format', europepmcResults);
            }
            break;
            
          case 'semanticscholar':
            console.log('Searching Semantic Scholar...');
            const semanticScholarResults = await searchSemanticScholar(query, pageNum - 1, pageSizeNum);
            if (semanticScholarResults && semanticScholarResults.data) {
              const semanticScholarData = semanticScholarResults.data.map((item: any) => ({
                ...item,
                source: 'semanticscholar'
              }));
              console.log(`Found ${semanticScholarData.length} results from Semantic Scholar`);
              allResults = [...allResults, ...semanticScholarData];
              totalResults += semanticScholarResults.total || 0;
            }
            break;
            
          case 'crossref':
            console.log('Searching CrossRef...');
            const crossrefResults = await searchCrossRef(query, pageNum, pageSizeNum);
            if (crossrefResults && crossrefResults.items) {
              const crossrefData = crossrefResults.items.map((item: any) => ({
                ...item,
                source: 'crossref'
              }));
              console.log(`Found ${crossrefData.length} results from CrossRef`);
              allResults = [...allResults, ...crossrefData];
              totalResults += crossrefResults.totalResults || 0;
            }
            break;
        }
      } catch (error: any) {
        console.error(`Error searching ${source}:`, error);
        errors.push(`${source}: ${error.message || 'Unknown error'}`);
      }
    }
    
    console.log(`Unified search returned: ${allResults.length} results`);
    
    // Check for DOI duplicates to avoid showing the same study from multiple sources
    const uniqueResults = [];
    const seenDOIs = new Set();
    const seenPMIDs = new Set();
    
    // Debug in detail what we have in allResults
    console.log(`All results before deduplication: ${allResults.length}`);
    
    // Count per source before deduplication
    const preDedupeSourceCounts = {};
    allResults.forEach(item => {
      const source = item.source || 'unknown';
      preDedupeSourceCounts[source] = (preDedupeSourceCounts[source] || 0) + 1;
    });
    console.log(`Source counts before deduplication: ${JSON.stringify(preDedupeSourceCounts)}`);
    
    for (const result of allResults) {
      const doi = result.doi || '';
      const pmid = result.pmid || '';
      
      // If no identifiers or not seen before, add to unique results
      if ((!doi && !pmid) || 
          (doi && !seenDOIs.has(doi.toLowerCase())) || 
          (pmid && !seenPMIDs.has(pmid))) {
        
        // Add to tracking sets
        if (doi) {
          seenDOIs.add(doi.toLowerCase());
        }
        if (pmid) {
          seenPMIDs.add(pmid);
        }
        
        uniqueResults.push(result);
      }
    }
    
    console.log(`After deduplication: ${uniqueResults.length} unique results`);
    
    // Count per source after deduplication 
    const postDedupeSourceCounts = {};
    uniqueResults.forEach(item => {
      const source = item.source || 'unknown';
      postDedupeSourceCounts[source] = (postDedupeSourceCounts[source] || 0) + 1;
    });
    console.log(`Source counts after deduplication: ${JSON.stringify(postDedupeSourceCounts)}`);
    
    // Sort results by year (newest first) if available
    uniqueResults.sort((a, b) => {
      const yearA = a.year ? parseInt(a.year) : 0;
      const yearB = b.year ? parseInt(b.year) : 0;
      return yearB - yearA; // Newest first
    });
    
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
    
    // For debugging, log the source counts
    const sourceCounts = allResults.reduce((acc, item) => {
      const source = item.source || 'unknown';
      acc[source] = (acc[source] || 0) + 1;
      return acc;
    }, {});
    
    console.log(`Source counts in unified search: ${JSON.stringify(sourceCounts)}`);
    console.log(`Combined results: ${allResults.length} total studies found`);
    
    // Always use "unified" as the source when we have multiple sources requested
    // Only use "pubmed" when it's the only source explicitly requested
    const finalSource = 
      selectedSources.length === 1 && selectedSources[0].toLowerCase() === 'pubmed' 
        ? 'pubmed' 
        : 'unified';
        
    console.log(`Request details: query="${query}", sources=${JSON.stringify(selectedSources)}, page=${pageNum}, pageSize=${pageSizeNum}`);
    console.log(`Using response source: ${finalSource}`);
    
    // If we've requested europepmc but got no results specifically from there, log that
    if (selectedSources.includes('europepmc') && 
        (!preDedupeSourceCounts['europepmc'] || preDedupeSourceCounts['europepmc'] === 0)) {
      console.log('WARNING: EuropePMC was requested but returned no results');
    }
    
    // Format response based on available results
    res.json({
      success: true,
      source: finalSource,
      query: query,
      total: totalResults,
      startIndex: (pageNum - 1) * pageSizeNum,
      nextIndex: pageNum * pageSizeNum,
      articles: uniqueResults, // Use de-duped results
      sourceCounts: sourceCounts, // Include source counts for debugging
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