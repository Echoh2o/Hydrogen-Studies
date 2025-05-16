/**
 * API routes for importing hydrogen research from Excel and other sources
 */
import express from 'express';
import multer from 'multer';
import * as fs from 'fs';
import * as path from 'path';
import * as XLSX from 'xlsx';
import { storage } from '../storage';
import { InsertStudy } from '@shared/schema';

const router = express.Router();

// Configure multer for file uploads
const upload = multer({
  dest: './uploads/',
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max file size
  },
  fileFilter: (req, file, cb) => {
    // Accept only Excel files
    if (
      file.mimetype === 'application/vnd.ms-excel' ||
      file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ) {
      cb(null, true);
    } else {
      cb(null, false);
      return cb(new Error('Only Excel files are allowed'));
    }
  },
});

/**
 * Import studies from Excel file upload
 * 
 * POST /api/import/excel
 */
router.post('/import/excel', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const filePath = req.file.path;
    console.log(`Processing uploaded Excel file: ${filePath}`);

    // Read Excel file
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0]; // Use first sheet
    const worksheet = workbook.Sheets[sheetName];
    
    // Convert to JSON
    const data = XLSX.utils.sheet_to_json(worksheet);
    console.log(`Found ${data.length} rows in Excel file`);

    // Process data and import studies
    const results = await importStudiesFromData(data);

    // Clean up the temporary file
    fs.unlinkSync(filePath);

    res.status(200).json({
      message: `Successfully processed Excel import`,
      total: data.length,
      imported: results.success,
      failed: results.failed,
      errors: results.errors.slice(0, 10) // Return first 10 errors max
    });
  } catch (err) {
    const error = err as Error;
    console.error('Error importing from Excel:', error);
    
    // Clean up file if it exists
    if (req.file?.path && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    
    res.status(500).json({
      message: `Error importing from Excel: ${error.message}`
    });
  }
});

/**
 * Process and import studies from mapped data
 */
async function importStudiesFromData(data: any[]): Promise<{
  success: number;
  failed: number;
  errors: string[];
}> {
  let successCount = 0;
  let failedCount = 0;
  const errors: string[] = [];

  for (const row of data) {
    try {
      // Map Excel columns to study fields
      // First detect and normalize column names
      const normalizedRow = normalizeColumnNames(row);
      
      // Create study object from row data
      const study = mapRowToStudy(normalizedRow);
      
      // Save to database
      await storage.createStudy(study);
      successCount++;
    } catch (err) {
      const error = err as Error;
      failedCount++;
      errors.push(`Row error: ${error.message}`);
    }
  }

  return {
    success: successCount,
    failed: failedCount,
    errors
  };
}

/**
 * Normalize column names from Excel file
 * This handles differences in capitalization and spacing
 */
function normalizeColumnNames(row: any): any {
  const normalized: any = {};
  
  // Define mappings from potential Excel columns to our database fields
  const columnMappings: { [key: string]: string } = {
    // Common variations of field names
    'title': 'title',
    'study title': 'title',
    'paper title': 'title',
    'research title': 'title',
    
    'abstract': 'abstract',
    'summary': 'abstract',
    'description': 'abstract',
    
    'authors': 'authors',
    'author': 'authors',
    'researcher': 'authors',
    'researchers': 'authors',
    
    'journal': 'journal',
    'publication': 'journal',
    'source': 'journal',
    
    'date': 'publishDate',
    'publish date': 'publishDate',
    'publication date': 'publishDate',
    'year': 'publishYear',
    'publish year': 'publishYear',
    
    'category': 'category',
    'topic': 'category',
    'field': 'category',
    
    'methods': 'methods',
    'methodology': 'methods',
    'method': 'methods',
    
    'results': 'results',
    'findings': 'results',
    'outcome': 'results',
    
    'conclusion': 'conclusion',
    'conclusions': 'conclusion',
    
    'doi': 'doi',
    'digital object identifier': 'doi',
    
    'url': 'sourceUrl',
    'link': 'sourceUrl',
    'source url': 'sourceUrl',
    
    'pdf': 'pdfUrl',
    'pdf url': 'pdfUrl',
    'pdf link': 'pdfUrl',
    
    'citation': 'citationUrl',
    'citation url': 'citationUrl',
    'citation link': 'citationUrl',
    
    'peer reviewed': 'peerReviewed',
    'peer-reviewed': 'peerReviewed',
    
    'country': 'country',
    'location': 'country',
    
    'region': 'region',
    'area': 'region',
    
    'study type': 'studyType',
    'type': 'studyType',
    
    'sample size': 'sampleSize',
    'participants': 'sampleSize',
    'subjects': 'sampleSize',
    
    'duration': 'duration',
    'study duration': 'duration',
    'length': 'duration'
  };
  
  // Normalize each column name
  for (const key in row) {
    const normalizedKey = key.toLowerCase().trim();
    
    // Find the matching database field
    let mappedField = null;
    for (const mapKey in columnMappings) {
      if (normalizedKey === mapKey || normalizedKey.includes(mapKey)) {
        mappedField = columnMappings[mapKey];
        break;
      }
    }
    
    // If we found a mapping, use it; otherwise keep the original
    if (mappedField) {
      normalized[mappedField] = row[key];
    } else {
      normalized[normalizedKey] = row[key];
    }
  }
  
  return normalized;
}

/**
 * Map a row from Excel to a study object
 */
function mapRowToStudy(row: any): InsertStudy {
  // Format dates
  let publishDate = row.publishDate;
  if (publishDate) {
    if (typeof publishDate === 'number') {
      // Excel date number
      publishDate = new Date(Math.round((publishDate - 25569) * 86400 * 1000)).toISOString();
    } else if (typeof publishDate === 'string') {
      try {
        publishDate = new Date(publishDate).toISOString();
      } catch (e) {
        // If date parsing fails, use current date
        publishDate = new Date().toISOString();
      }
    } else {
      publishDate = new Date().toISOString();
    }
  } else {
    publishDate = new Date().toISOString();
  }
  
  // Extract year from publishDate if not explicitly provided
  let publishYear = row.publishYear;
  if (!publishYear && publishDate) {
    try {
      publishYear = new Date(publishDate).getFullYear();
    } catch (e) {
      publishYear = null;
    }
  }
  
  // Format boolean fields
  const peerReviewed = typeof row.peerReviewed === 'string' 
    ? row.peerReviewed.toLowerCase() === 'true' || row.peerReviewed.toLowerCase() === 'yes'
    : !!row.peerReviewed;
  
  // Format array fields with comma separation if needed
  let authors = row.authors;
  if (typeof authors === 'string') {
    authors = authors.trim();
  } else if (Array.isArray(authors)) {
    authors = authors.join(', ');
  }
  
  // Create the study object
  const study: InsertStudy = {
    title: row.title || 'Untitled Study',
    abstract: row.abstract || `This is a hydrogen research study.`,
    authors: authors || 'Unknown Authors',
    journal: row.journal || 'Unknown Journal',
    publishDate: publishDate,
    category: row.category || 'Hydrogen Research',
    methods: row.methods || null,
    results: row.results || null,
    conclusion: row.conclusion || null,
    doi: row.doi || null,
    pdfUrl: row.pdfUrl || null,
    citationUrl: row.citationUrl || null,
    peerReviewed: peerReviewed,
    publishYear: publishYear !== undefined ? Number(publishYear) : null,
    country: row.country || null,
    region: row.region || null,
    studyType: row.studyType || null,
    sampleSize: row.sampleSize ? Number(row.sampleSize) : null,
    duration: row.duration ? Number(row.duration) : null,
    hasFullText: false,
    sourceUrl: row.sourceUrl || null,
    sourcePlatform: 'Excel Import'
  };
  
  return study;
}

export default router;