/**
 * Export routes for downloading research data in various formats
 */

import express, { Request, Response } from 'express';
import { storage } from '../storage';
import { handleApiError, handleValidationError, sendSuccessResponse } from '../utils/error-handler';
import { exportToExcel, exportToCsv, exportToJson, generateCitation } from '../utils/export-utils';

const router = express.Router();

// Export all studies or filtered studies to Excel format
router.get('/excel', async (req: Request, res: Response) => {
  try {
    // Parse filter parameters if provided
    const {
      query,
      category,
      yearFrom,
      yearTo,
      author,
      limit = '1000' // Default limit to prevent giant exports
    } = req.query;
    
    // Get studies with optional filters
    const studies = await storage.getStudies({
      query: query as string,
      category: category as string,
      yearFrom: yearFrom as string,
      yearTo: yearTo as string,
      author: author as string,
      pageSize: parseInt(limit as string)
    });

    // Generate Excel buffer
    const excelBuffer = exportToExcel(studies);
    
    // Set headers for file download
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=hydrogen-studies.xlsx');
    
    // Send the buffer
    res.send(excelBuffer);
  } catch (error) {
    handleApiError(res, error, undefined, 500, 'Failed to export studies to Excel');
  }
});

// Export all studies or filtered studies to CSV format
router.get('/csv', async (req: Request, res: Response) => {
  try {
    // Parse filter parameters if provided
    const {
      query,
      category,
      yearFrom,
      yearTo,
      author,
      limit = '1000' // Default limit to prevent giant exports
    } = req.query;
    
    // Get studies with optional filters
    const studies = await storage.getStudies({
      query: query as string,
      category: category as string,
      yearFrom: yearFrom as string,
      yearTo: yearTo as string,
      author: author as string,
      pageSize: parseInt(limit as string)
    });

    // Generate CSV string
    const csvContent = exportToCsv(studies);
    
    // Set headers for file download
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=hydrogen-studies.csv');
    
    // Send the CSV content
    res.send(csvContent);
  } catch (error) {
    handleApiError(res, error, undefined, 500, 'Failed to export studies to CSV');
  }
});

// Export all studies or filtered studies to JSON format
router.get('/json', async (req: Request, res: Response) => {
  try {
    // Parse filter parameters if provided
    const {
      query,
      category,
      yearFrom,
      yearTo,
      author,
      limit = '1000' // Default limit to prevent giant exports
    } = req.query;
    
    // Get studies with optional filters
    const studies = await storage.getStudies({
      query: query as string,
      category: category as string,
      yearFrom: yearFrom as string,
      yearTo: yearTo as string,
      author: author as string,
      pageSize: parseInt(limit as string)
    });

    // Generate JSON string
    const jsonContent = exportToJson(studies);
    
    // Set headers for file download
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename=hydrogen-studies.json');
    
    // Send the JSON content
    res.send(jsonContent);
  } catch (error) {
    handleApiError(res, error, undefined, 500, 'Failed to export studies to JSON');
  }
});

// Generate citation for a specific study
router.get('/citation/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { format = 'APA' } = req.query;
    
    // Validate format
    const validFormats = ['APA', 'MLA', 'Chicago', 'Harvard', 'Vancouver'];
    if (!validFormats.includes(format as string)) {
      return handleValidationError(res, new Error(`Invalid format. Supported formats: ${validFormats.join(', ')}`));
    }
    
    // Validate ID
    const studyId = parseInt(id);
    if (isNaN(studyId)) {
      return handleValidationError(res, new Error('Invalid study ID'));
    }
    
    // Get the study
    const study = await storage.getStudyById(studyId);
    if (!study) {
      return handleValidationError(res, new Error('Study not found'));
    }
    
    // Generate citation
    const citation = generateCitation(
      study, 
      format as 'APA' | 'MLA' | 'Chicago' | 'Harvard' | 'Vancouver'
    );
    
    // Return citation
    sendSuccessResponse(res, { citation, study: { id: study.id, title: study.title } });
  } catch (error) {
    handleApiError(res, error, undefined, 500, 'Failed to generate citation');
  }
});

// Batch export citations for multiple studies
router.post('/citations', async (req: Request, res: Response) => {
  try {
    const { studyIds, format = 'APA' } = req.body;
    
    // Validate format
    const validFormats = ['APA', 'MLA', 'Chicago', 'Harvard', 'Vancouver'];
    if (!validFormats.includes(format)) {
      return handleValidationError(res, new Error(`Invalid format. Supported formats: ${validFormats.join(', ')}`));
    }
    
    // Validate studyIds
    if (!Array.isArray(studyIds) || studyIds.length === 0) {
      return handleValidationError(res, new Error('Invalid or empty study IDs array'));
    }
    
    // Generate citations for each study
    const citations = [];
    for (const id of studyIds) {
      const studyId = parseInt(id);
      if (!isNaN(studyId)) {
        const study = await storage.getStudyById(studyId);
        if (study) {
          const citation = generateCitation(
            study, 
            format as 'APA' | 'MLA' | 'Chicago' | 'Harvard' | 'Vancouver'
          );
          citations.push({
            studyId,
            title: study.title,
            citation
          });
        }
      }
    }
    
    // Return citations
    sendSuccessResponse(res, { citations });
  } catch (error) {
    handleApiError(res, error, undefined, 500, 'Failed to generate citations');
  }
});

export default router;