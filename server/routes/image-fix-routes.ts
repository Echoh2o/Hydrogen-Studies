import { Router } from 'express';
import { eq, isNull } from 'drizzle-orm';
import { studies } from '@shared/schema';
import { db } from '../db/db';

const router = Router();

// Route to fix studies without proper images
router.post('/batch-fix-missing-images', async (req, res) => {
  try {
    // Find studies with missing or empty image URLs
    const studiesWithoutImages = await db
      .select({ id: studies.id, title: studies.title })
      .from(studies)
      .where(isNull(studies.image_url));

    console.log(`Found ${studiesWithoutImages.length} studies without images`);
    
    // Add placeholder images for each study
    let updateCount = 0;
    const batchSize = 50;
    
    for (let i = 0; i < studiesWithoutImages.length; i += batchSize) {
      const batch = studiesWithoutImages.slice(i, i + batchSize);
      
      for (const study of batch) {
        await db.update(studies)
          .set({
            image_url: `https://placehold.co/800x400/e2f3ff/003366?text=Hydrogen+Study+${study.id}`,
            image_alt: `Scientific visualization of hydrogen therapy research: ${study.title}`,
            auto_generated_image: true
          })
          .where(eq(studies.id, study.id));
        
        updateCount++;
      }
      
      console.log(`Processed ${updateCount} out of ${studiesWithoutImages.length} studies`);
    }
    
    return res.status(200).json({
      success: true,
      message: `Updated ${updateCount} studies with placeholder images`,
      studiesProcessed: updateCount
    });
  } catch (error) {
    console.error('Error fixing missing study images:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update study images',
      error: error.message
    });
  }
});

// Route to check image status across studies
router.get('/check-image-status', async (req, res) => {
  try {
    const totalStudies = await db
      .select({ count: studies.id.count() })
      .from(studies);
    
    const studiesWithImages = await db
      .select({ count: studies.id.count() })
      .from(studies)
      .where(isNull(studies.image_url).not());
    
    const studiesWithoutImages = await db
      .select({ count: studies.id.count() })
      .from(studies)
      .where(isNull(studies.image_url));
    
    return res.status(200).json({
      success: true,
      totalStudies: Number(totalStudies[0].count),
      studiesWithImages: Number(studiesWithImages[0].count),
      studiesWithoutImages: Number(studiesWithoutImages[0].count),
      percentage: Math.round((Number(studiesWithImages[0].count) / Number(totalStudies[0].count)) * 100)
    });
  } catch (error) {
    console.error('Error checking image status:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to check image status',
      error: error.message
    });
  }
});

export default router;