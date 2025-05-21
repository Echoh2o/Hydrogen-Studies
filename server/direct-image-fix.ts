/**
 * Direct Image Fix Utility
 * 
 * A simple, direct approach to fix missing images in studies
 * by adding placeholder images where needed
 */

import { db } from "./db";
import { studies } from "@shared/schema";
import { sql } from "drizzle-orm";

/**
 * Fix all studies missing images with a single SQL operation
 * This uses direct SQL for maximum efficiency and reliability
 */
export async function fixMissingImages() {
  try {
    // Get current status before fix
    const beforeStatus = await getImageStatus();
    
    // Run direct SQL update for all studies without images
    // This is the most efficient way to handle this operation
    const result = await db.execute(sql`
      UPDATE studies 
      SET 
        image_url = CONCAT('https://placehold.co/800x500/e2f3ff/003366?text=Hydrogen+Study+', id),
        image_alt = CONCAT('Scientific visualization of hydrogen therapy research: ', title),
        auto_generated_image = true
      WHERE image_url IS NULL
    `);
    
    // Get status after the update
    const afterStatus = await getImageStatus();
    
    // Return results
    return {
      success: true,
      message: 'Successfully fixed missing images',
      fixed: afterStatus.withImages - beforeStatus.withImages,
      before: beforeStatus,
      after: afterStatus
    };
  } catch (error) {
    console.error('Error fixing missing images:', error);
    return {
      success: false,
      message: `Failed to fix missing images: ${error.message}`,
      error: error.message
    };
  }
}

/**
 * Get current status of images across all studies
 */
export async function getImageStatus() {
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
    
    return {
      totalStudies: Number(data.totalStudies),
      withImages: Number(data.withImages),
      withoutImages: Number(data.withoutImages),
      withPlaceholders: Number(data.withPlaceholders),
      withCustomImages: withCustomImages,
      percentWithImages: percentWithImages
    };
  } catch (error) {
    console.error('Error getting image status:', error);
    throw error;
  }
}