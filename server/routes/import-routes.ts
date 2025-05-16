import express from 'express';
import multer from 'multer';
import path from 'path';
import * as importService from '../import';
import fs from 'fs';

const router = express.Router();

// Configure multer for file uploads
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      const uploadDir = path.join(process.cwd(), 'uploads');
      // Create directory if it doesn't exist
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
      // Create unique filename
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
  }),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max file size
  },
  fileFilter: (req, file, cb) => {
    // Accept only specific file types
    const filetypes = /xlsx|xls|csv|json/;
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = filetypes.test(file.mimetype);
    
    if (extname && mimetype) {
      return cb(null, true);
    } else {
      cb(new Error('Only .xlsx, .xls, .csv, or .json files are allowed'));
    }
  }
});

/**
 * Import studies from an Excel file
 * POST /api/import/excel
 */
router.post('/import/excel', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ 
        success: false, 
        message: 'No file uploaded' 
      });
    }

    const filePath = req.file.path;
    const fileExt = path.extname(req.file.originalname).toLowerCase();
    
    let result;
    
    if (fileExt === '.xlsx' || fileExt === '.xls') {
      result = await importService.importStudiesFromExcel(filePath);
    } else if (fileExt === '.csv') {
      result = await importService.importStudiesFromCsv(filePath);
    } else if (fileExt === '.json') {
      result = await importService.importStudiesFromJson(filePath);
    } else {
      return res.status(400).json({
        success: false,
        message: 'Unsupported file format'
      });
    }
    
    // Clean up the uploaded file
    fs.unlinkSync(filePath);
    
    return res.status(200).json({
      success: true,
      imported: result.success,
      total: result.total,
      failed: result.total - result.success,
      message: `Successfully imported ${result.success} out of ${result.total} studies`
    });
    
  } catch (error: any) {
    console.error('Import error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to import studies'
    });
  }
});

/**
 * Import studies from Google Sheets
 * POST /api/import/sheets
 */
router.post('/import/sheets', async (req, res) => {
  try {
    const { sheetUrl } = req.body;
    
    if (!sheetUrl) {
      return res.status(400).json({
        success: false,
        message: 'Google Sheet URL is required'
      });
    }
    
    const result = await importService.importStudiesFromGoogleSheets(sheetUrl);
    
    return res.status(200).json({
      success: true,
      imported: result.success,
      total: result.total,
      failed: result.total - result.success,
      message: `Successfully imported ${result.success} out of ${result.total} studies`
    });
    
  } catch (error: any) {
    console.error('Google Sheets import error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to import studies from Google Sheets'
    });
  }
});

export default router;