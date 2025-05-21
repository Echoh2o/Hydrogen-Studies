import { Router } from 'express';
import { db } from '../db';
import { studies } from '@shared/schema';
import { isNull, sql } from 'drizzle-orm';

const router = Router();

// Route to fix all missing images directly with a single SQL update
router.post('/fix-all-direct', async (req, res) => {
  try {
    // Use a direct SQL update to set placeholder images for all studies with null image_url
    const result = await db.execute(sql`
      UPDATE studies 
      SET 
        image_url = CONCAT('https://placehold.co/800x500/e2f3ff/003366?text=Hydrogen+Study+', id),
        image_alt = CONCAT('Scientific visualization of hydrogen therapy research: ', title),
        auto_generated_image = true
      WHERE image_url IS NULL
    `);
    
    // Check status after fix
    const status = await db.select({
      totalStudies: sql<number>`count(*)`,
      withImages: sql<number>`count(case when image_url is not null then 1 end)`,
      withoutImages: sql<number>`count(case when image_url is null then 1 end)`
    }).from(studies);
    
    res.json({
      success: true,
      message: 'Successfully added placeholder images to studies with missing images',
      status: status[0]
    });
  } catch (error) {
    console.error('Error fixing study images:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fix study images',
      error: error.message
    });
  }
});

// Route to check current image status
router.get('/status', async (req, res) => {
  try {
    const status = await db.select({
      totalStudies: sql<number>`count(*)`,
      withImages: sql<number>`count(case when image_url is not null then 1 end)`,
      withoutImages: sql<number>`count(case when image_url is null then 1 end)`,
      withPlaceholders: sql<number>`count(case when image_url like 'https://placehold.co%' then 1 end)`
    }).from(studies);
    
    const data = status[0];
    const withCustomImages = Number(data.withImages) - Number(data.withPlaceholders);
    const percentWithImages = Math.round((Number(data.withImages) / Number(data.totalStudies)) * 100);
    
    res.json({
      success: true,
      totalStudies: Number(data.totalStudies),
      withImages: Number(data.withImages),
      withoutImages: Number(data.withoutImages),
      withPlaceholders: Number(data.withPlaceholders),
      withCustomImages: withCustomImages,
      percentWithImages: percentWithImages
    });
  } catch (error) {
    console.error('Error checking image status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check image status',
      error: error.message
    });
  }
});

export default router;