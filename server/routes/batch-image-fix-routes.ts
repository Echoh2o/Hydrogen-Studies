import { Router } from 'express';
import { fixAllStudyImages, checkImageStatus } from '../batch-image-fix';

const router = Router();

// Route to check status of images across all studies
router.get('/check-status', async (req, res) => {
  try {
    const status = await checkImageStatus();
    res.json(status);
  } catch (error) {
    console.error('Error checking image status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check image status',
      error: error.message
    });
  }
});

// Route to fix all missing images
router.post('/fix-all', async (req, res) => {
  try {
    const result = await fixAllStudyImages();
    res.json(result);
  } catch (error) {
    console.error('Error fixing study images:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fix study images',
      error: error.message
    });
  }
});

export default router;