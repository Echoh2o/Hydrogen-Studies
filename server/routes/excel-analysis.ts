import express from 'express';
import multer from 'multer';
import * as XLSX from 'xlsx';
import path from 'path';
import fs from 'fs';
import axios from 'axios';

const router = express.Router();

// Set up multer for temporary file storage
const upload = multer({ dest: 'uploads/' });

// Route to analyze an uploaded Excel file and return column headers
router.post('/analyze-excel-file', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file provided' });
    }

    const workbook = XLSX.readFile(req.file.path);
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    
    // Get header row (first row) as an array of column names
    const columnData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
    const headers = columnData[0] as string[];
    
    // Clean up temporary file
    fs.unlinkSync(req.file.path);
    
    return res.json({ columns: headers });
  } catch (error) {
    console.error('Error analyzing Excel file:', error);
    return res.status(500).json({
      error: 'Failed to analyze Excel file',
      message: (error as Error).message
    });
  }
});

// Route to analyze a file from a URL
router.post('/analyze-url-file', async (req, res) => {
  try {
    const { url, fileType } = req.body;
    
    if (!url) {
      return res.status(400).json({ error: 'No URL provided' });
    }
    
    // Download the file
    const response = await axios.get(url, { responseType: 'arraybuffer' });
    const tempFilePath = path.join('uploads', `temp_${Date.now()}.${fileType}`);
    
    // Ensure uploads directory exists
    if (!fs.existsSync('uploads')) {
      fs.mkdirSync('uploads');
    }
    
    // Save file temporarily
    fs.writeFileSync(tempFilePath, Buffer.from(response.data));
    
    // Read and parse the file
    const workbook = XLSX.readFile(tempFilePath);
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    
    // Get header row (first row) as an array of column names
    const columnData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
    const headers = columnData[0] as string[];
    
    // Clean up temporary file
    fs.unlinkSync(tempFilePath);
    
    return res.json({ columns: headers });
  } catch (error) {
    console.error('Error analyzing file from URL:', error);
    return res.status(500).json({
      error: 'Failed to analyze file from URL',
      message: (error as Error).message
    });
  }
});

export default router;