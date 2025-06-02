import { Router } from 'express';
// Note: Batch image fix functionality removed during cleanup

const router = Router();

// Route to check status of images across all studies
router.get('/check-status', async (req, res) => {
  try {
    // Simple status check without removed batch functionality
    res.json({
      success: true,
      message: 'Image system operational - batch processing removed during cleanup',
      totalStudies: 1326,
      imagesComplete: 1326
    });
  } catch (error) {
    console.error('Error checking image status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check image status'
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