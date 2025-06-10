/**
 * Production Build Script
 * Creates optimized frontend build for deployment
 */

import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

console.log('🏗️ Building frontend for production...');

// Run Vite build
const build = spawn('npx', ['vite', 'build'], {
  stdio: 'inherit',
  env: { ...process.env, NODE_ENV: 'production' }
});

build.on('close', (code) => {
  if (code === 0) {
    console.log('✅ Frontend build completed successfully');
    
    // Ensure production index.html exists in dist
    if (fs.existsSync('dist/index.html')) {
      console.log('✅ Production assets ready for deployment');
    } else {
      console.error('❌ Build failed - no index.html found in dist/');
      process.exit(1);
    }
  } else {
    console.error(`❌ Build failed with code ${code}`);
    process.exit(1);
  }
});

build.on('error', (error) => {
  console.error('❌ Build error:', error);
  process.exit(1);
});