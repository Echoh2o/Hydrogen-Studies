import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import * as XLSX from 'xlsx';
import { parse } from 'csv-parse/sync';
import axios from 'axios';
import { studies } from '../../shared/schema';
import { db } from '../db';

const router = Router();

// Interface for column mapping
interface ColumnMapping {
  excelColumn: string;
  dbField: string;
}

// Configure storage for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(process.cwd(), 'uploads');
    
    // Create the directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Create unique filename with original extension
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, file.fieldname + '-' + uniqueSuffix + ext);
  }
});

// Create the multer upload instance
const upload = multer({ 
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max file size
  }
});

// Analyze Excel file headers
router.post('/analyze-excel-file', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file provided' });
    }

    const fileType = req.body.fileType || 'xlsx';
    let headers: string[] = [];
    
    if (fileType === 'xlsx' || fileType === 'xls') {
      // Process Excel file
      const workbook = XLSX.readFile(req.file.path);
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      
      // Get header row (first row) as an array of column names
      const columnData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
      headers = columnData[0] as string[];
    } else if (fileType === 'csv') {
      // Process CSV file
      const fileContent = fs.readFileSync(req.file.path, 'utf8');
      const lines = fileContent.split('\n');
      if (lines.length > 0) {
        headers = parse(lines[0], {
          columns: false,
          skip_empty_lines: true
        })[0];
      }
    }
    
    // Clean up temporary file
    fs.unlinkSync(req.file.path);
    
    return res.json({ 
      success: true, 
      columns: headers 
    });
  } catch (error: any) {
    console.error('Error analyzing Excel file:', error);
    
    // Clean up temporary file if it exists
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    
    return res.status(500).json({
      success: false,
      message: 'Failed to analyze file headers',
      error: error.message
    });
  }
});

// Analyze URL file headers
router.post('/analyze-url-file', async (req, res) => {
  try {
    const { url, fileType } = req.body;
    
    if (!url) {
      return res.status(400).json({ success: false, message: 'No URL provided' });
    }
    
    // Download the file
    const response = await axios.get(url, { responseType: 'arraybuffer' });
    const tempFilePath = path.join('uploads', `temp_${Date.now()}.${fileType}`);
    
    // Ensure uploads directory exists
    if (!fs.existsSync('uploads')) {
      fs.mkdirSync('uploads', { recursive: true });
    }
    
    // Save file temporarily
    fs.writeFileSync(tempFilePath, Buffer.from(response.data));
    
    let headers: string[] = [];
    
    if (fileType === 'xlsx' || fileType === 'xls') {
      // Read and parse the Excel file
      const workbook = XLSX.readFile(tempFilePath);
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      
      // Get header row (first row) as an array of column names
      const columnData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
      headers = columnData[0] as string[];
    } else if (fileType === 'csv') {
      // Read and parse the CSV file
      const fileContent = fs.readFileSync(tempFilePath, 'utf8');
      const lines = fileContent.split('\n');
      if (lines.length > 0) {
        headers = parse(lines[0], {
          columns: false,
          skip_empty_lines: true
        })[0];
      }
    }
    
    // Clean up temporary file
    fs.unlinkSync(tempFilePath);
    
    return res.json({ 
      success: true, 
      columns: headers 
    });
  } catch (error: any) {
    console.error('Error analyzing file from URL:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to analyze file from URL',
      error: error.message
    });
  }
});

// Import Excel or CSV file with column mapping
router.post('/import-excel', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    const fileType = req.body.fileType || 'xlsx';
    
    // Parse column mappings if provided
    let columnMappings: ColumnMapping[] = [];
    if (req.body.columnMappings) {
      try {
        columnMappings = JSON.parse(req.body.columnMappings);
      } catch (err) {
        console.error('Error parsing column mappings:', err);
      }
    }
    
    let data: any[] = [];
    
    if (fileType === 'xlsx' || fileType === 'xls') {
      // Process Excel file
      const workbook = XLSX.readFile(req.file.path);
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      data = XLSX.utils.sheet_to_json(worksheet);
    } else if (fileType === 'csv') {
      // Process CSV file
      const fileContent = fs.readFileSync(req.file.path, 'utf8');
      data = parse(fileContent, {
        columns: true,
        skip_empty_lines: true
      });
    } else {
      return res.status(400).json({ success: false, message: 'Unsupported file type' });
    }

    console.log(`Processing ${data.length} studies from file with ${columnMappings.length} column mappings`);

    // Prepare for import
    let imported = 0;
    const total = data.length;
    const errors: string[] = [];

    // Process each row
    for (const row of data) {
      try {
        // Initialize study object
        const study: Record<string, any> = {
          createdAt: new Date(),
          updatedAt: new Date()
        };
        
        // If we have column mappings, use them to map data
        if (columnMappings.length > 0) {
          for (const mapping of columnMappings) {
            // Skip if the mapping is empty (do not import this column)
            if (!mapping.dbField) continue;
            
            // Get the value from the row using the Excel column name
            if (row[mapping.excelColumn] !== undefined) {
              // Process special fields
              if (mapping.dbField === 'year' && row[mapping.excelColumn]) {
                study[mapping.dbField] = parseInt(row[mapping.excelColumn].toString());
              } else if (mapping.dbField === 'peerReviewed') {
                study[mapping.dbField] = Boolean(row[mapping.excelColumn]);
              } else if (mapping.dbField === 'categoryId' && row[mapping.excelColumn]) {
                study[mapping.dbField] = parseInt(row[mapping.excelColumn].toString());
              } else {
                study[mapping.dbField] = row[mapping.excelColumn];
              }
            }
          }
        } else {
          // Fallback to traditional field mapping for backward compatibility
          study.title = row.title || row.Title || '';
          study.abstract = row.abstract || row.Abstract || '';
          study.url = row.url || row.URL || row.DOI || '';
          study.journal = row.journal || row.Journal || '';
          study.year = parseInt(row.year || row.Year || '0');
          study.authors = row.authors || row.Authors || '';
          study.methods = row.methods || row.Methods || '';
          study.model = row.model || row.Model || '';
          study.type = row.type || row.Type || '';
          study.country = row.country || row.Country || '';
          study.peerReviewed = Boolean(row.peerReviewed || row.PeerReviewed || false);
          study.categoryId = parseInt(row.categoryId || row.CategoryId || '1');
        }
        
        // Ensure required fields have default values
        study.title = study.title || 'Untitled Study';
        study.abstract = study.abstract || '';
        study.categoryId = study.categoryId || 1;
        
        // Insert into database
        await db.insert(studies).values(study);
        imported++;
      } catch (error: any) {
        console.error(`Error importing study: ${error.message}`);
        errors.push(error.message);
      }
    }

    // Clean up temporary file
    fs.unlinkSync(req.file.path);

    return res.json({
      success: true,
      total,
      imported,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (error: any) {
    console.error('Error importing Excel file:', error);
    
    // Clean up temporary file if it exists
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    return res.status(500).json({
      success: false,
      message: 'Failed to import studies',
      error: error.message
    });
  }
});

// Import from URL with column mapping
router.post('/import-from-url', async (req, res) => {
  try {
    const { url, fileType, columnMappings } = req.body;
    
    if (!url) {
      return res.status(400).json({ success: false, message: 'No URL provided' });
    }
    
    // Download the file
    const response = await axios.get(url, { responseType: 'arraybuffer' });
    const tempFilePath = path.join('uploads', `temp_${Date.now()}.${fileType}`);
    
    // Ensure uploads directory exists
    if (!fs.existsSync('uploads')) {
      fs.mkdirSync('uploads', { recursive: true });
    }
    
    // Save file temporarily
    fs.writeFileSync(tempFilePath, Buffer.from(response.data));
    
    let data: any[] = [];
    
    if (fileType === 'xlsx' || fileType === 'xls') {
      // Process Excel file
      const workbook = XLSX.readFile(tempFilePath);
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      data = XLSX.utils.sheet_to_json(worksheet);
    } else if (fileType === 'csv') {
      // Process CSV file
      const fileContent = fs.readFileSync(tempFilePath, 'utf8');
      data = parse(fileContent, {
        columns: true,
        skip_empty_lines: true
      });
    } else {
      fs.unlinkSync(tempFilePath);
      return res.status(400).json({ success: false, message: 'Unsupported file type' });
    }

    console.log(`Processing ${data.length} studies from URL with ${columnMappings?.length || 0} column mappings`);

    // Prepare for import
    let imported = 0;
    const total = data.length;
    const errors: string[] = [];

    // Process each row
    for (const row of data) {
      try {
        // Initialize study object
        const study: Record<string, any> = {
          createdAt: new Date(),
          updatedAt: new Date()
        };
        
        // If we have column mappings, use them to map data
        if (columnMappings && columnMappings.length > 0) {
          for (const mapping of columnMappings) {
            // Skip if the mapping is empty (do not import this column)
            if (!mapping.dbField) continue;
            
            // Get the value from the row using the Excel column name
            if (row[mapping.excelColumn] !== undefined) {
              // Process special fields
              if (mapping.dbField === 'year' && row[mapping.excelColumn]) {
                study[mapping.dbField] = parseInt(row[mapping.excelColumn].toString());
              } else if (mapping.dbField === 'peerReviewed') {
                study[mapping.dbField] = Boolean(row[mapping.excelColumn]);
              } else if (mapping.dbField === 'categoryId' && row[mapping.excelColumn]) {
                study[mapping.dbField] = parseInt(row[mapping.excelColumn].toString());
              } else {
                study[mapping.dbField] = row[mapping.excelColumn];
              }
            }
          }
        } else {
          // Fallback to traditional field mapping
          study.title = row.title || row.Title || '';
          study.abstract = row.abstract || row.Abstract || '';
          study.url = row.url || row.URL || row.DOI || '';
          study.journal = row.journal || row.Journal || '';
          study.year = parseInt(row.year || row.Year || '0');
          study.authors = row.authors || row.Authors || '';
          study.methods = row.methods || row.Methods || '';
          study.model = row.model || row.Model || '';
          study.type = row.type || row.Type || '';
          study.country = row.country || row.Country || '';
          study.peerReviewed = Boolean(row.peerReviewed || row.PeerReviewed || false);
          study.categoryId = parseInt(row.categoryId || row.CategoryId || '1');
        }
        
        // Ensure required fields have default values
        study.title = study.title || 'Untitled Study';
        study.abstract = study.abstract || '';
        study.categoryId = study.categoryId || 1;
        
        // Insert into database
        await db.insert(studies).values(study);
        imported++;
      } catch (error: any) {
        console.error(`Error importing study: ${error.message}`);
        errors.push(error.message);
      }
    }

    // Clean up temporary file
    fs.unlinkSync(tempFilePath);

    return res.json({
      success: true,
      total,
      imported,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (error: any) {
    console.error('Error importing from URL:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to import studies from URL',
      error: error.message
    });
  }
});

export default router;