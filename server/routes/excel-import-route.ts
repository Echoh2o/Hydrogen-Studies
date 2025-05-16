import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { importStudiesFromExcel } from '../import';
import { extractKeywords } from '../keyword-extractor';

const router = Router();

// Configure storage
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
  },
  fileFilter: (req, file, cb) => {
    // Accept only Excel files
    const filetypes = /xlsx|xls/;
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = filetypes.test(file.mimetype);
    
    if (extname && mimetype) {
      return cb(null, true);
    } else {
      cb(new Error('Only Excel files are allowed'));
    }
  }
});

// Route to handle file upload and import
router.post('/upload-excel', upload.single('excelFile'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }
    
    const filePath = req.file.path;
    console.log(`Received Excel file: ${filePath}`);
    
    // Import the studies from the Excel file
    const result = await importStudiesFromExcel(filePath);
    
    // Clean up the file after import
    fs.unlinkSync(filePath);
    
    return res.status(200).json({
      success: true,
      message: `Successfully imported ${result.success} out of ${result.total} studies`,
      ...result
    });
  } catch (error: any) {
    console.error('Error importing Excel file:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'An error occurred during import'
    });
  }
});

// Route to handle importing a pre-existing Excel file in the project
router.post('/import-attached-excel', async (req, res) => {
  try {
    const { filePath } = req.body;
    
    if (!filePath) {
      return res.status(400).json({ success: false, message: 'No file path provided' });
    }
    
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, message: `File not found: ${filePath}` });
    }
    
    console.log(`Importing attached Excel file: ${filePath}`);
    
    // Import the studies from the Excel file
    const result = await importStudiesFromExcel(filePath);
    
    return res.status(200).json({
      success: true,
      message: `Successfully imported ${result.success} out of ${result.total} studies`,
      ...result
    });
  } catch (error: any) {
    console.error('Error importing Excel file:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'An error occurred during import'
    });
  }
});

export default router;