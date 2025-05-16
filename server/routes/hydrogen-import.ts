import { Router } from 'express';
import path from 'path';
import fs from 'fs';
import { importStudiesFromExcel } from '../import';

const router = Router();

// Import the Hydrogen Research Database directly
router.post('/import-hydrogen-database', async (req, res) => {
  try {
    // Path to the hydrogen research database file
    const fileName = 'Hydrogen Research Database_Timeline.xlsx';
    const filePath = path.resolve(process.cwd(), 'attached_assets', fileName);
    
    console.log(`Attempting to import hydrogen database from: ${filePath}`);
    
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      console.error(`File not found: ${filePath}`);
      return res.status(404).json({ 
        success: false, 
        message: `File not found: ${fileName}` 
      });
    }
    
    // Import the hydrogen research database
    const result = await importStudiesFromExcel(filePath);
    console.log(`Import result:`, result);
    
    return res.status(200).json({
      success: true,
      message: `Successfully imported ${result.success} out of ${result.total} studies from Hydrogen Research Database`,
      imported: result.success,
      total: result.total
    });
  } catch (error) {
    console.error('Error importing hydrogen database:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'An error occurred while importing the hydrogen database',
    });
  }
});

export default router;