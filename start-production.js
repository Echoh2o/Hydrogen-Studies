#!/usr/bin/env node

/**
 * Production Server for Hydrogen Research Platform
 * Uses the built application from dist/index.js or falls back to simplified server
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Check if built application exists
const distIndexPath = join(__dirname, 'dist', 'index.js');

if (existsSync(distIndexPath)) {
  console.log('Starting production server from built application...');
  
  // Set production environment
  process.env.NODE_ENV = 'production';
  
  // Import and run the built application
  try {
    await import('./dist/index.js');
    console.log('Production server started successfully from built application');
  } catch (error) {
    console.error('Failed to start built application:', error);
    console.log('Deployment will use the fallback production server');
    process.exit(1);
  }
} else {
  console.log('Built application not found - deployment requires npm run build first');
  process.exit(1);
}