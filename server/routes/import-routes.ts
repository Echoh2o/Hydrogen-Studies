import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { importStudiesFromExcel, importStudiesFromCsv, importStudiesFromJson } from '../import';
import excelImportRoutes from './excel-import-route';

const router = Router();

// Register the Excel-specific import routes
router.use(excelImportRoutes);

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

// Import studies from CSV file upload
router.post('/import/csv', upload.single('csvFile'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }
    
    const filePath = req.file.path;
    console.log(`Received CSV file: ${filePath}`);
    
    // Import the studies from the CSV file
    const result = await importStudiesFromCsv(filePath);
    
    // Clean up the file after import
    fs.unlinkSync(filePath);
    
    return res.status(200).json({
      success: true,
      message: `Successfully imported ${result.success} out of ${result.total} studies`,
      ...result
    });
  } catch (error: any) {
    console.error('Error importing CSV file:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'An error occurred during import'
    });
  }
});

// Import studies from JSON file upload
router.post('/import/json', upload.single('jsonFile'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }
    
    const filePath = req.file.path;
    console.log(`Received JSON file: ${filePath}`);
    
    // Import the studies from the JSON file
    const result = await importStudiesFromJson(filePath);
    
    // Clean up the file after import
    fs.unlinkSync(filePath);
    
    return res.status(200).json({
      success: true,
      message: `Successfully imported ${result.success} out of ${result.total} studies`,
      ...result
    });
  } catch (error: any) {
    console.error('Error importing JSON file:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'An error occurred during import'
    });
  }
});

// Import from attached files in the project
router.post('/import/attached', async (req, res) => {
  try {
    const { filePath, fileType } = req.body;
    
    if (!filePath || !fileType) {
      return res.status(400).json({ 
        success: false, 
        message: 'File path and file type are required' 
      });
    }
    
    console.log(`Attempting to import from: ${filePath}`);
    const absolutePath = path.resolve(process.cwd(), filePath);
    console.log(`Absolute path: ${absolutePath}`);
    
    // Check if file exists
    if (!fs.existsSync(absolutePath)) {
      return res.status(404).json({ 
        success: false, 
        message: `File not found: ${absolutePath}` 
      });
    }
    
    let result;
    
    // Import based on file type
    switch (fileType.toLowerCase()) {
      case 'csv':
        result = await importStudiesFromCsv(filePath);
        break;
      case 'json':
        result = await importStudiesFromJson(filePath);
        break;
      case 'xlsx':
      case 'xls':
        result = await importStudiesFromExcel(filePath);
        break;
      default:
        return res.status(400).json({ 
          success: false, 
          message: 'Unsupported file type. Supported types: csv, json, xlsx, xls' 
        });
    }
    
    return res.status(200).json({
      success: true,
      message: `Successfully imported ${result.success} out of ${result.total} studies`,
      ...result
    });
  } catch (error: any) {
    console.error('Error importing attached file:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'An error occurred during import'
    });
  }
});

export default router;