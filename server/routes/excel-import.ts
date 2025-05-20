import express, { Request, Response } from 'express';
import multer from 'multer';
import * as XLSX from 'xlsx';
import { storage } from '../storage';
import { InsertStudy } from '@shared/schema';
import path from 'path';
import fs from 'fs';
import axios from 'axios';

const router = express.Router();

// Configure multer for file uploads
const uploadStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(process.cwd(), 'temp_files');
    
    // Create the directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniquePrefix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniquePrefix + '-' + file.originalname);
  }
});

const upload = multer({ storage: uploadStorage });

// Helper function to clean up temporary files
function cleanupTempFile(filePath: string) {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (error) {
    console.error(`Error cleaning up temporary file ${filePath}:`, error);
  }
}

// Helper function to process Excel/CSV data
function processExcelData(workbook: XLSX.WorkBook): InsertStudy[] {
  try {
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    const data = XLSX.utils.sheet_to_json(worksheet);
    
    const studies: InsertStudy[] = data.map((row: any) => {
      // Map fields from Excel/CSV columns to database schema
      return {
        title: row.Title || row.title || '',
        abstract: row.Abstract || row.abstract || '',
        authors: row.Authors || row.authors || row['First Author'] || row.firstAuthor || '',
        journal: row.Journal || row.journal || '',
        publishDate: row['Publish Date'] || row.publishDate || row.Year || row.year || new Date().toISOString(),
        doi: row.DOI || row.doi || '',
        category: row.Category || row.category || row['Primary Topic'] || row.primaryTopic || 'General',
        methods: row.Methods || row.methods || '',
        results: row.Results || row.results || '',
        conclusion: row.Conclusion || row.conclusion || '',
        keyFindings: row['Key Findings'] || row.keyFindings || '',
        healthConditions: row['Health Conditions'] || row.healthConditions || '',
        bodySystems: row['Body Systems'] || row.bodySystems || '',
        sampleSize: row['Sample Size'] || row.sampleSize || '',
        imageUrl: row['Image URL'] || row.imageUrl || '',
        pdfUrl: row['PDF URL'] || row.pdfUrl || '',
        status: 'published',
        studyType: row['Study Type'] || row.studyType || 'clinical',
        country: row.Country || row.country || '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
    });
    
    return studies;
  } catch (error) {
    console.error('Error processing Excel data:', error);
    throw error;
  }
}

// Excel import route
router.post('/excel', upload.single('file'), async (req: Request, res: Response) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'No file uploaded' });
  }
  
  const filePath = req.file.path;
  
  try {
    const workbook = XLSX.readFile(filePath);
    const studies = processExcelData(workbook);
    
    // Import studies to database
    const results = await importStudiesToDatabase(studies);
    
    // Clean up temp file
    cleanupTempFile(filePath);
    
    return res.json({
      success: true,
      total: studies.length,
      ...results
    });
  } catch (error) {
    console.error('Excel import error:', error);
    
    // Clean up temp file
    cleanupTempFile(filePath);
    
    return res.status(500).json({ 
      success: false, 
      message: error instanceof Error ? error.message : 'Failed to import Excel file' 
    });
  }
});

// CSV import route
router.post('/csv', upload.single('csvFile'), async (req: Request, res: Response) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'No file uploaded' });
  }
  
  const filePath = req.file.path;
  
  try {
    const workbook = XLSX.readFile(filePath, { type: 'file' });
    const studies = processExcelData(workbook);
    
    // Import studies to database
    const results = await importStudiesToDatabase(studies);
    
    // Clean up temp file
    cleanupTempFile(filePath);
    
    return res.json({
      success: true,
      total: studies.length,
      ...results
    });
  } catch (error) {
    console.error('CSV import error:', error);
    
    // Clean up temp file
    cleanupTempFile(filePath);
    
    return res.status(500).json({ 
      success: false, 
      message: error instanceof Error ? error.message : 'Failed to import CSV file' 
    });
  }
});

// Google Sheets import route
router.post('/googlesheet', async (req: Request, res: Response) => {
  try {
    const { url } = req.body;
    
    if (!url) {
      return res.status(400).json({ success: false, message: 'No Google Sheet URL provided' });
    }
    
    // Extract the sheet ID from the URL
    const urlPattern = /https:\/\/docs\.google\.com\/spreadsheets\/d\/([a-zA-Z0-9-_]+)\/edit/;
    const match = url.match(urlPattern);
    
    if (!match || !match[1]) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid Google Sheet URL. Please use a URL in the format: https://docs.google.com/spreadsheets/d/SHEET_ID/edit' 
      });
    }
    
    const sheetId = match[1];
    
    // Get the Google Sheet as CSV
    const csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv`;
    
    const response = await axios.get(csvUrl, { responseType: 'arraybuffer' });
    
    // Write response to a temporary file
    const tempFilePath = path.join(process.cwd(), 'temp_files', `gsheet-${Date.now()}.csv`);
    
    // Create the directory if it doesn't exist
    const uploadDir = path.join(process.cwd(), 'temp_files');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    
    fs.writeFileSync(tempFilePath, Buffer.from(response.data));
    
    // Process the CSV file
    const workbook = XLSX.readFile(tempFilePath);
    const studies = processExcelData(workbook);
    
    // Import studies to database
    const results = await importStudiesToDatabase(studies);
    
    // Clean up temp file
    cleanupTempFile(tempFilePath);
    
    return res.json({
      success: true,
      total: studies.length,
      ...results
    });
  } catch (error) {
    console.error('Google Sheet import error:', error);
    
    return res.status(500).json({ 
      success: false, 
      message: error instanceof Error ? error.message : 'Failed to import from Google Sheet' 
    });
  }
});

// Helper function to import studies to database
async function importStudiesToDatabase(studies: InsertStudy[]) {
  let success = 0;
  let failures = 0;
  const errors: string[] = [];
  
  for (const study of studies) {
    try {
      // Skip empty titles
      if (!study.title.trim()) {
        failures++;
        errors.push('Skipped study with empty title');
        continue;
      }
      
      // Insert study to database
      await storage.createStudy(study);
      success++;
    } catch (error) {
      failures++;
      errors.push(error instanceof Error ? error.message : 'Unknown error');
      console.error(`Failed to import study: ${study.title}`, error);
    }
  }
  
  return {
    success,
    failures,
    errors: errors.length > 0 ? errors : undefined
  };
}

// Export import routes
export default router;