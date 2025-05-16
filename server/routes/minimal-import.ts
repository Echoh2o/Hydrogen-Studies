import { Router } from 'express';
import { db } from '../db';
import { studies } from '../../shared/schema';
import { enrichStudyFromPubMed, batchEnrichStudies } from '../pubmed-enricher';

const router = Router();

/**
 * Endpoint for adding a single study with minimal information
 * Can be just a title, just an identifier (URL, DOI, PMID), or both
 */
router.post('/import/minimal', async (req, res) => {
  try {
    const { title, identifier, autoEnrich } = req.body;
    
    // Ensure we have at least one of title or identifier
    if (!title && !identifier) {
      return res.status(400).json({
        success: false,
        message: 'Either title or identifier (URL, DOI, or PMID) must be provided'
      });
    }
    
    // Create minimal study record
    const [study] = await db.insert(studies)
      .values({
        title: title || 'Untitled Study',
        url: identifier || '',
        abstract: '',
        journal: '',
        year: null,
        authors: '',
        categoryId: 1, // Default category
        createdAt: new Date(),
        updatedAt: new Date()
      })
      .returning();
    
    let enrichResult = { success: false, message: 'Enrichment not attempted' };
    
    // Auto-enrich if requested
    if (autoEnrich && study) {
      enrichResult = await enrichStudyFromPubMed(study.id);
    }
    
    return res.status(200).json({
      success: true,
      message: 'Study added successfully',
      study,
      autoEnriched: enrichResult.success,
      enrichMessage: enrichResult.message
    });
  } catch (error: any) {
    console.error('Error in minimal import:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to add study'
    });
  }
});

/**
 * Endpoint for batch importing multiple studies with minimal information
 * Each line can be a title, URL, DOI, or PMID
 */
router.post('/import/minimal-batch', async (req, res) => {
  try {
    const { data, autoEnrich } = req.body;
    
    if (!data || typeof data !== 'string' || !data.trim()) {
      return res.status(400).json({
        success: false,
        message: 'No data provided for batch import'
      });
    }
    
    // Split input by lines
    const lines = data.split('\n').filter(line => line.trim());
    
    if (lines.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid lines found in input data'
      });
    }
    
    // Process each line and add as a study
    const results = [];
    const studyIds = [];
    
    for (const line of lines) {
      try {
        // Determine if line is probably an identifier or a title
        const trimmedLine = line.trim();
        let title = '';
        let identifier = '';
        
        // Check if it looks like a URL
        if (trimmedLine.startsWith('http') || trimmedLine.includes('doi.org') || 
            trimmedLine.includes('pubmed') || trimmedLine.includes('ncbi.nlm.nih.gov')) {
          identifier = trimmedLine;
        } 
        // Check if it looks like a DOI
        else if (trimmedLine.toLowerCase().startsWith('doi:') || trimmedLine.match(/10\.\d{4,}/i)) {
          identifier = trimmedLine;
        }
        // Check if it looks like a PMID
        else if (trimmedLine.toLowerCase().startsWith('pmid:') || 
                 trimmedLine.match(/^\d+$/) || 
                 trimmedLine.match(/^PMID[ :]+\d+$/i)) {
          identifier = trimmedLine;
        }
        // Otherwise treat as a title
        else {
          title = trimmedLine;
        }
        
        // Create minimal study record
        const [study] = await db.insert(studies)
          .values({
            title: title || 'Untitled Study',
            url: identifier || '',
            abstract: '',
            journal: '',
            year: null,
            authors: '',
            categoryId: 1, // Default category
            createdAt: new Date(),
            updatedAt: new Date()
          })
          .returning();
        
        results.push({
          success: true,
          line: trimmedLine,
          studyId: study.id
        });
        
        studyIds.push(study.id);
      } catch (error: any) {
        results.push({
          success: false,
          line: line.trim(),
          error: error.message
        });
      }
    }
    
    // Process enrichment if requested
    let enriched = 0;
    if (autoEnrich && studyIds.length > 0) {
      for (const id of studyIds) {
        try {
          const enrichResult = await enrichStudyFromPubMed(id);
          if (enrichResult.success) {
            enriched++;
          }
          
          // Add a delay to avoid overloading the PubMed API
          await new Promise(resolve => setTimeout(resolve, 500));
        } catch (error) {
          console.error(`Error enriching study ${id}:`, error);
        }
      }
    }
    
    const successCount = results.filter(r => r.success).length;
    
    return res.status(200).json({
      success: true,
      message: `Batch import completed: ${successCount} of ${lines.length} studies imported successfully`,
      imported: successCount,
      total: lines.length,
      enriched,
      results
    });
  } catch (error: any) {
    console.error('Error in batch import:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to process batch import'
    });
  }
});

/**
 * Endpoint for enriching existing studies with PubMed data
 */
router.post('/enrich/batch', async (req, res) => {
  try {
    const { limit = 50 } = req.body;
    
    // Check if PubMed API key is available
    if (!process.env.PUBMED_API_KEY) {
      return res.status(400).json({
        success: false,
        message: 'PubMed API key is required for enrichment'
      });
    }
    
    const count = await batchEnrichStudies(limit);
    
    return res.status(200).json({
      success: true,
      message: `Enriched ${count} studies with PubMed data`,
      count
    });
  } catch (error: any) {
    console.error('Error in batch enrichment:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to enrich studies'
    });
  }
});

export default router;