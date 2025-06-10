/**
 * Auto Image Generation System
 * Automatically restarts image generation after server restarts until all studies have images
 */

import { sql } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';

interface AutoSystemState {
  isEnabled: boolean;
  totalStudies: number;
  studiesWithImages: number;
  lastCheckTime: Date;
  generationActive: boolean;
  autoStartEnabled: boolean;
}

const STATE_FILE = path.join(process.cwd(), '.auto-image-state.json');

let systemState: AutoSystemState = {
  isEnabled: false,
  totalStudies: 0,
  studiesWithImages: 0,
  lastCheckTime: new Date(),
  generationActive: false,
  autoStartEnabled: true
};

/**
 * Load system state from file
 */
function loadSystemState(): void {
  try {
    if (fs.existsSync(STATE_FILE)) {
      const data = fs.readFileSync(STATE_FILE, 'utf8');
      const savedState = JSON.parse(data);
      systemState = {
        ...savedState,
        lastCheckTime: new Date(savedState.lastCheckTime),
        generationActive: false // Reset on server restart
      };
      console.log('Auto-image system state loaded:', systemState);
    }
  } catch (error) {
    console.error('Failed to load auto-image state:', error);
  }
}

/**
 * Save system state to file
 */
function saveSystemState(): void {
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify(systemState, null, 2));
  } catch (error) {
    console.error('Failed to save auto-image state:', error);
  }
}

/**
 * Check current database status
 */
async function checkDatabaseStatus(db: any): Promise<{total: number, withImages: number, withoutImages: number}> {
  try {
    const totalResult = await db.execute(sql`SELECT COUNT(*) as count FROM studies`);
    const withImagesResult = await db.execute(sql`SELECT COUNT(*) as count FROM studies WHERE image_url IS NOT NULL`);
    
    const total = (totalResult as any).rows?.[0]?.count || 0;
    const withImages = (withImagesResult as any).rows?.[0]?.count || 0;
    const withoutImages = total - withImages;
    
    return { total, withImages, withoutImages };
  } catch (error) {
    console.error('Error checking database status:', error);
    return { total: 0, withImages: 0, withoutImages: 0 };
  }
}

/**
 * Start image generation if needed
 */
async function startGenerationIfNeeded(db: any): Promise<void> {
  if (systemState.generationActive) {
    console.log('Image generation already active');
    return;
  }

  try {
    const { startFinalGeneration } = await import('./final-image-generator');
    const result = await startFinalGeneration(db);
    
    if (result.success) {
      systemState.generationActive = true;
      console.log('Auto-started image generation:', result.message);
    } else {
      console.log('Failed to auto-start generation:', result.message);
    }
  } catch (error) {
    console.error('Error auto-starting generation:', error);
  }
}

/**
 * Initialize auto-image system on server startup
 */
export async function initializeAutoImageSystem(db: any): Promise<void> {
  console.log('Initializing auto-image system...');
  
  loadSystemState();
  
  const status = await checkDatabaseStatus(db);
  console.log(`Database status: ${status.total} total, ${status.withImages} with images, ${status.withoutImages} without images`);
  
  // Update system state
  const previousTotal = systemState.totalStudies;
  systemState.totalStudies = status.total;
  systemState.studiesWithImages = status.withImages;
  systemState.lastCheckTime = new Date();
  
  // Check if all studies have images
  const allStudiesHaveImages = status.withoutImages === 0;
  
  if (allStudiesHaveImages) {
    console.log('✓ All studies have images - disabling auto-start');
    systemState.autoStartEnabled = false;
    systemState.isEnabled = false;
  } else {
    // Check if new studies were added
    const newStudiesAdded = status.total > previousTotal;
    
    if (newStudiesAdded) {
      console.log(`New studies detected (${status.total - previousTotal} added) - enabling auto-start`);
      systemState.autoStartEnabled = true;
    }
    
    // Auto-start if enabled and studies need images
    if (systemState.autoStartEnabled) {
      console.log(`Auto-starting image generation for ${status.withoutImages} studies without images`);
      systemState.isEnabled = true;
      await startGenerationIfNeeded(db);
    } else {
      console.log('Auto-start disabled - run manually if needed');
    }
  }
  
  saveSystemState();
  
  // Set up monitoring interval
  setInterval(async () => {
    await monitorProgress(db);
  }, 60000); // Check every minute
}

/**
 * Monitor generation progress
 */
async function monitorProgress(db: any): Promise<void> {
  if (!systemState.isEnabled) return;
  
  try {
    const status = await checkDatabaseStatus(db);
    const previousWithImages = systemState.studiesWithImages;
    
    systemState.totalStudies = status.total;
    systemState.studiesWithImages = status.withImages;
    systemState.lastCheckTime = new Date();
    
    // Check if generation completed
    if (status.withoutImages === 0) {
      console.log('🎉 All studies now have images - disabling auto-start');
      systemState.autoStartEnabled = false;
      systemState.isEnabled = false;
      systemState.generationActive = false;
    } else {
      // Check if generation stopped but images still needed
      const { getFinalProgress } = await import('./final-image-generator');
      const progress = getFinalProgress();
      
      if (!progress.isActive && status.withoutImages > 0) {
        console.log(`Generation stopped but ${status.withoutImages} studies still need images - restarting`);
        systemState.generationActive = false;
        await startGenerationIfNeeded(db);
      }
      
      // Check for new studies
      if (status.total > systemState.totalStudies) {
        console.log(`New studies detected - ensuring generation continues`);
        if (!progress.isActive) {
          systemState.generationActive = false;
          await startGenerationIfNeeded(db);
        }
      }
    }
    
    // Log progress if images were generated
    if (status.withImages > previousWithImages) {
      const newImages = status.withImages - previousWithImages;
      console.log(`Progress: +${newImages} new images (${status.withImages}/${status.total} complete)`);
    }
    
    saveSystemState();
  } catch (error) {
    console.error('Error monitoring progress:', error);
  }
}

/**
 * Manual control functions
 */
export async function enableAutoImageSystem(db: any): Promise<{success: boolean, message: string}> {
  const status = await checkDatabaseStatus(db);
  
  if (status.withoutImages === 0) {
    return {
      success: false,
      message: 'All studies already have images'
    };
  }
  
  systemState.autoStartEnabled = true;
  systemState.isEnabled = true;
  saveSystemState();
  
  await startGenerationIfNeeded(db);
  
  return {
    success: true,
    message: `Enabled auto-system for ${status.withoutImages} studies`
  };
}

export function disableAutoImageSystem(): {success: boolean, message: string} {
  systemState.autoStartEnabled = false;
  systemState.isEnabled = false;
  saveSystemState();
  
  return {
    success: true,
    message: 'Disabled auto-image system'
  };
}

export function getAutoImageSystemStatus(): AutoSystemState & {remainingStudies: number} {
  return {
    ...systemState,
    remainingStudies: systemState.totalStudies - systemState.studiesWithImages
  };
}

/**
 * Force check for new studies and restart if needed
 */
export async function checkForNewStudies(db: any): Promise<{success: boolean, message: string, newStudies: number}> {
  const status = await checkDatabaseStatus(db);
  const previousTotal = systemState.totalStudies;
  const newStudies = Math.max(0, status.total - previousTotal);
  
  if (newStudies > 0) {
    console.log(`Detected ${newStudies} new studies`);
    systemState.autoStartEnabled = true;
    systemState.isEnabled = true;
    systemState.totalStudies = status.total;
    systemState.studiesWithImages = status.withImages;
    saveSystemState();
    
    if (status.withoutImages > 0) {
      await startGenerationIfNeeded(db);
      return {
        success: true,
        message: `Started generation for ${newStudies} new studies`,
        newStudies
      };
    }
  }
  
  return {
    success: true,
    message: newStudies > 0 ? `Found ${newStudies} new studies (all have images)` : 'No new studies found',
    newStudies
  };
}