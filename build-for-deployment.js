#!/usr/bin/env node

/**
 * Complete Deployment Build Script
 * Builds both frontend and backend for production deployment
 */

import { execSync } from 'child_process';
import { existsSync, mkdirSync } from 'fs';

console.log('🚀 Starting complete deployment build...');

try {
  // Step 1: Build frontend
  console.log('📦 Building frontend assets...');
  execSync('npx vite build', {
    stdio: 'inherit'
  });

  // Step 2: Compile backend TypeScript files
  console.log('🔨 Compiling backend TypeScript...');
  execSync('npx esbuild server/production-server.ts --platform=node --packages=external --bundle --format=esm --outfile=server/production-server.js', {
    stdio: 'inherit'
  });

  // Step 3: Verify all required files exist
  const requiredFiles = [
    'dist/index.html',
    'server/production-server.js',
    'start-production.js'
  ];

  let allFilesExist = true;
  for (const file of requiredFiles) {
    if (!existsSync(file)) {
      console.error(`❌ Missing required file: ${file}`);
      allFilesExist = false;
    } else {
      console.log(`✅ Found: ${file}`);
    }
  }

  if (!allFilesExist) {
    throw new Error('Some required files are missing');
  }

  console.log('✅ Deployment build completed successfully!');
  console.log('🎯 Ready for production deployment');

} catch (error) {
  console.error('❌ Build failed:', error.message);
  process.exit(1);
}