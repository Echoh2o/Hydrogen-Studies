#!/usr/bin/env node

/**
 * Build Production Server - Compiles TypeScript to JavaScript
 */

import { execSync } from 'child_process';
import { existsSync } from 'fs';

console.log('🔨 Building production server...');

try {
  // Compile production-server.ts to production-server.js
  console.log('Compiling TypeScript files...');
  
  execSync('npx esbuild server/production-server.ts --platform=node --packages=external --bundle --format=esm --outfile=server/production-server.js', {
    stdio: 'inherit'
  });

  // Verify the file was created
  if (existsSync('server/production-server.js')) {
    console.log('✅ Production server compiled successfully');
  } else {
    throw new Error('Compilation failed - output file not found');
  }

} catch (error) {
  console.error('❌ Build failed:', error.message);
  process.exit(1);
}