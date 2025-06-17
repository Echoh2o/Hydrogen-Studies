import { Router, Request, Response } from 'express';
import { searchPubMedWithPagination } from './research-routes';
import { searchEuropePMC, extractStudyFromEuropePMC } from '../europepmc-api';
import { searchSemanticScholar, extractStudyFromSemanticScholar } from '../semantic-scholar-api';
import { searchCrossRef, extractStudyFromCrossRef } from '../crossref-api';
import { storage } from '../storage';
import { enrichStudyFromPubMed as extractStudyFromPubMed } from '../pubmed-enricher';

const router = Router();

// Test endpoint to verify route registration
router.get('/api/research/test', (req: Request, res: Response) => {
  res.json({ success: true, message: 'Research unified routes working' });
});

/**
 * Unified search across multiple research databases
 * 
 * This endpoint searches across PubMed, Europe PMC, Semantic Scholar, and CrossRef
 * based on the selected sources and returns consolidated results. It combines results
 * from different sources by matching DOIs and creates a unified listing.
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
    
    console.log(`Unified search request - Query: "${query}", Sources: ${JSON.stringify(selectedSources)}`);
    
    // Step 1: Check if any matching studies are already in our database to avoid duplicates
    // and to flag studies that are already imported
    let existingStudies: any[] = [];
    try {
      console.log('Getting matching studies from database...');
      try {
        existingStudies = await storage.getStudiesByTitlePartial(query, 50);
      } catch (storageError) {
        console.warn('Storage method not available, skipping database check:', storageError);
        existingStudies = [];
      }
      console.log(`Found ${existingStudies.length} potentially matching studies in our database`);
      
      // Create lookup maps for faster matching
      const existingDOIMap = new Map();
      const existingPMIDMap = new Map();
      
      existingStudies.forEach(study => {
        if (study.doi) existingDOIMap.set(study.doi.toLowerCase(), study.id);
        if (study.pmid) existingPMIDMap.set(study.pmid, study.id);
      });
    } catch (error) {
      console.error('Error checking database for existing studies:', error);
    }
    
    // Step 2: Run searches against each requested source sequentially
    // This is more reliable than parallel searches and respects rate limits
    let allResults: any[] = [];
    let totalResultsCount = 0;
    let errors: string[] = [];
    
    // Process each source one by one
    for (const source of selectedSources) {
      try {
        console.log(`Processing source: ${source}`);
        
        switch (source.toLowerCase()) {
          case 'pubmed':
            // Search PubMed with an increased limit to account for duplicates later
            console.log('Searching PubMed...');
            const pubmedData = await searchPubMedWithPagination(query, pageNum - 1, pageSizeNum * 2);
            const totalPubmedResults = pubmedData.length > 0 ? pubmedData[0]?.totalResults || pubmedData.length : 0;
            
            const formattedPubmedData = pubmedData.map((item: any) => {
              // Check if this study is already in our database
              const isInDatabase = existingStudies.some(study => 
                (study.doi && item.doi && study.doi.toLowerCase() === item.doi.toLowerCase()) ||
                (study.pmid && item.pmid && study.pmid === item.pmid)
              );
              
              // Find the database ID if it exists
              const databaseId = isInDatabase ? 
                existingStudies.find(study => 
                  (study.doi && item.doi && study.doi.toLowerCase() === item.doi.toLowerCase()) ||
                  (study.pmid && item.pmid && study.pmid === item.pmid)
                )?.id : undefined;
              
              return {
                ...item,
                source: 'pubmed',
                inDatabase: isInDatabase,
                databaseId: databaseId
              };
            });
            
            console.log(`Found ${formattedPubmedData.length} results from PubMed`);
            allResults = [...allResults, ...formattedPubmedData];
            totalResultsCount += totalPubmedResults;
            break;
            
          case 'europepmc':
            console.log('Searching EuropePMC...');
            const europepmcResults = await searchEuropePMC(query, pageNum, pageSizeNum * 2);
            if (europepmcResults && europepmcResults.results && europepmcResults.results.length > 0) {
              console.log(`Found ${europepmcResults.results.length} results from EuropePMC of ${europepmcResults.total} total`);
              
              const formattedEPMCData = europepmcResults.results.map((item: any) => {
                // Check if this study is already in our database
                const isInDatabase = existingStudies.some(study => 
                  (study.doi && item.doi && study.doi.toLowerCase() === item.doi.toLowerCase()) ||
                  (study.pmid && item.pmid && study.pmid === item.pmid)
                );
                
                // Find the database ID if it exists
                const databaseId = isInDatabase ? 
                  existingStudies.find(study => 
                    (study.doi && item.doi && study.doi.toLowerCase() === item.doi.toLowerCase()) ||
                    (study.pmid && item.pmid && study.pmid === item.pmid)
                  )?.id : undefined;
                
                return {
                  ...item,
                  source: 'europepmc',
                  inDatabase: isInDatabase,
                  databaseId: databaseId
                };
              });
              
              // Log a sample result for debugging
              if (formattedEPMCData.length > 0) {
                console.log('Sample EuropePMC result:', JSON.stringify(formattedEPMCData[0]).substring(0, 200) + '...');
              }
              
              allResults = [...allResults, ...formattedEPMCData];
              totalResultsCount += europepmcResults.total || 0;
            } else {
              console.log('No results from EuropePMC or unexpected format');
            }
            break;
            
          case 'semanticscholar':
            console.log('Searching Semantic Scholar...');
            const semanticScholarResults = await searchSemanticScholar(query, pageNum - 1, pageSizeNum * 2);
            if (semanticScholarResults && semanticScholarResults.data && semanticScholarResults.data.length > 0) {
              console.log(`Found ${semanticScholarResults.data.length} results from Semantic Scholar`);
              
              const formattedSSData = semanticScholarResults.data.map((item: any) => {
                // Check if this study is already in our database
                const isInDatabase = existingStudies.some(study => 
                  (study.doi && item.doi && study.doi.toLowerCase() === item.doi.toLowerCase())
                );
                
                // Find the database ID if it exists
                const databaseId = isInDatabase ? 
                  existingStudies.find(study => 
                    (study.doi && item.doi && study.doi.toLowerCase() === item.doi.toLowerCase())
                  )?.id : undefined;
                
                return {
                  ...item,
                  source: 'semanticscholar',
                  inDatabase: isInDatabase,
                  databaseId: databaseId
                };
              });
              
              allResults = [...allResults, ...formattedSSData];
              totalResultsCount += semanticScholarResults.total || 0;
            }
            break;
            
          case 'crossref':
            console.log('Searching CrossRef...');
            const crossrefResults = await searchCrossRef(query, pageNum, pageSizeNum * 2);
            if (crossrefResults && crossrefResults.items && crossrefResults.items.length > 0) {
              console.log(`Found ${crossrefResults.items.length} results from CrossRef`);
              
              const formattedCRData = crossrefResults.items.map((item: any) => {
                // Check if this study is already in our database
                const isInDatabase = existingStudies.some(study => 
                  (study.doi && item.DOI && study.doi.toLowerCase() === item.DOI.toLowerCase())
                );
                
                // Find the database ID if it exists
                const databaseId = isInDatabase ? 
                  existingStudies.find(study => 
                    (study.doi && item.DOI && study.doi.toLowerCase() === item.DOI.toLowerCase())
                  )?.id : undefined;
                
                return {
                  ...item,
                  source: 'crossref',
                  inDatabase: isInDatabase,
                  databaseId: databaseId
                };
              });
              
              allResults = [...allResults, ...formattedCRData];
              totalResultsCount += crossrefResults.totalResults || 0;
            }
            break;
            
          default:
            console.log(`Unsupported source: ${source}`);
            errors.push(`Unsupported source: ${source}`);
        }
      } catch (error: any) {
        console.error(`Error searching ${source}:`, error);
        errors.push(`${source}: ${error.message || 'Unknown error'}`);
      }
    }
    
    console.log(`Total results before deduplication: ${allResults.length}`);
    
    // Step 3: Combine and deduplicate results using DOIs and PMIDs
    // Create DOI and PMID maps to group identical studies
    const doiMap = new Map();
    const pmidMap = new Map();
    const titleMap = new Map(); // Fallback for items without DOI or PMID
    
    // First pass: collect items by their DOI/PMID
    allResults.forEach(item => {
      // Handle DOI
      if (item.doi) {
        const doi = item.doi.toLowerCase().trim();
        if (doiMap.has(doi)) {
          doiMap.get(doi).push(item);
        } else {
          doiMap.set(doi, [item]);
        }
      } 
      // Handle PMID (as a fallback if no DOI exists)
      else if (item.pmid) {
        const pmid = item.pmid.toString().trim();
        if (pmidMap.has(pmid)) {
          pmidMap.get(pmid).push(item);
        } else {
          pmidMap.set(pmid, [item]);
        }
      }
      // Handle items with neither DOI nor PMID by title
      else if (item.title) {
        const titleKey = item.title.toLowerCase().trim();
        if (titleMap.has(titleKey)) {
          titleMap.get(titleKey).push(item);
        } else {
          titleMap.set(titleKey, [item]);
        }
      }
    });
    
    // Second pass: process and merge items with the same DOI
    const unifiedResults: any[] = [];
    
    // Process DOI matches (highest priority)
    doiMap.forEach((items, doi) => {
      if (items.length === 1) {
        // Single item - no merging needed
        unifiedResults.push(items[0]);
      } else {
        // Multiple items with same DOI - merge them
        const mergedItem = items.reduce((merged: any, current: any) => {
          // Start with first item's properties
          const result = { ...merged };
          
          // Keep track of which sources were merged
          result.mergedSources = result.mergedSources || [];
          if (!result.mergedSources.includes(current.source)) {
            result.mergedSources.push(current.source);
          }
          
          // Mark as unified since it comes from multiple sources
          result.source = 'unified';
          
          // Take the most complete abstract
          if ((!result.abstract || result.abstract.length < 50) && 
              current.abstract && current.abstract.length > 50) {
            result.abstract = current.abstract;
          }
          
          // Prioritize items already in the database
          if (current.inDatabase) {
            result.inDatabase = true;
            result.databaseId = current.databaseId;
          }
          
          // Fill in missing fields from current item
          Object.entries(current).forEach(([key, value]) => {
            if (!result[key] && value) {
              result[key] = value;
            }
          });
          
          return result;
        }, items[0]);
        
        unifiedResults.push(mergedItem);
      }
    });
    
    // Process PMID matches (only if not already added via DOI)
    pmidMap.forEach((items, pmid) => {
      // Skip if any item with this PMID has already been included via DOI
      const alreadyAdded = unifiedResults.some(item => item.pmid === pmid);
      if (!alreadyAdded) {
        if (items.length === 1) {
          unifiedResults.push(items[0]);
        } else {
          // Merge items with same PMID
          const mergedItem = items.reduce((merged: any, current: any) => {
            const result = { ...merged };
            
            result.mergedSources = result.mergedSources || [];
            if (!result.mergedSources.includes(current.source)) {
              result.mergedSources.push(current.source);
            }
            
            result.source = 'unified';
            
            if ((!result.abstract || result.abstract.length < 50) && 
                current.abstract && current.abstract.length > 50) {
              result.abstract = current.abstract;
            }
            
            if (current.inDatabase) {
              result.inDatabase = true;
              result.databaseId = current.databaseId;
            }
            
            Object.entries(current).forEach(([key, value]) => {
              if (!result[key] && value) {
                result[key] = value;
              }
            });
            
            return result;
          }, items[0]);
          
          unifiedResults.push(mergedItem);
        }
      }
    });
    
    // Process title matches as a last resort
    titleMap.forEach((items, title) => {
      // Skip if already added via DOI or PMID
      const alreadyAdded = unifiedResults.some(item => 
        item.title && item.title.toLowerCase().trim() === title
      );
      
      if (!alreadyAdded) {
        if (items.length === 1) {
          unifiedResults.push(items[0]);
        } else {
          // Merge items with the same title
          const mergedItem = items.reduce((merged: any, current: any) => {
            const result = { ...merged };
            
            result.mergedSources = result.mergedSources || [];
            if (!result.mergedSources.includes(current.source)) {
              result.mergedSources.push(current.source);
            }
            
            result.source = 'unified';
            
            if ((!result.abstract || result.abstract.length < 50) && 
                current.abstract && current.abstract.length > 50) {
              result.abstract = current.abstract;
            }
            
            if (current.inDatabase) {
              result.inDatabase = true;
              result.databaseId = current.databaseId;
            }
            
            Object.entries(current).forEach(([key, value]) => {
              if (!result[key] && value) {
                result[key] = value;
              }
            });
            
            return result;
          }, items[0]);
          
          unifiedResults.push(mergedItem);
        }
      }
    });
    
    console.log(`After deduplication and unification: ${unifiedResults.length} unique results`);
    
    // Step 4: Sort and paginate the results
    // Sort by year (newest first) if available
    unifiedResults.sort((a, b) => {
      const yearA = a.year ? parseInt(a.year) : 0;
      const yearB = b.year ? parseInt(b.year) : 0;
      return yearB - yearA; // Newest first
    });
    
    // Get the paginated results
    const paginatedResults = unifiedResults.slice(0, pageSizeNum);
    
    // Step 5: Count source distribution after deduplication
    const sourceCounts = paginatedResults.reduce((acc: {[key: string]: number}, item: any) => {
      const source = item.source || 'unknown';
      acc[source] = (acc[source] || 0) + 1;
      return acc;
    }, {});
    
    // Step 6: Set the correct source flag
    // Always use 'unified' as the source when multiple sources were requested
    const responseSource = selectedSources.length > 1 ? 'unified' : selectedSources[0].toLowerCase();
    
    // Step 7: Prepare and send the response
    console.log(`Responding with source '${responseSource}' and ${paginatedResults.length} articles`);
    
    const responseObj = {
      success: true,
      source: responseSource,
      query: query,
      total: unifiedResults.length,
      startIndex: (pageNum - 1) * pageSizeNum,
      nextIndex: Math.min(pageNum * pageSizeNum, unifiedResults.length),
      articles: paginatedResults,
      sourceCounts: sourceCounts,
      errors: errors.length > 0 ? errors : undefined
    };
    
    res.json(responseObj);
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