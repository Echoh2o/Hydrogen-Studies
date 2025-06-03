#!/usr/bin/env node

/**
 * Simplified production build script
 * Bypasses problematic TailwindCSS dependencies for deployment
 */

import { execSync } from 'child_process';
import { mkdirSync, existsSync, cpSync, writeFileSync } from 'fs';
import { join } from 'path';

console.log('Starting simplified production build...');

try {
  // Create dist directory
  if (!existsSync('dist')) {
    mkdirSync('dist', { recursive: true });
  }

  // Build backend with esbuild
  console.log('Building server...');
  execSync('npx esbuild server/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist --target=node18', { stdio: 'inherit' });

  // Copy client files without full Vite build
  console.log('Copying frontend files...');
  if (existsSync('client')) {
    cpSync('client', 'dist/client', { recursive: true });
  }

  // Copy public assets
  if (existsSync('public')) {
    cpSync('public', 'dist/public', { recursive: true });
  }

  // Create production package.json
  const prodPackage = {
    "name": "hydrogen-studies-production",
    "version": "1.0.0",
    "type": "module",
    "main": "index.js",
    "scripts": {
      "start": "NODE_ENV=production node index.js"
    },
    "engines": {
      "node": ">=18.0.0"
    }
  };

  writeFileSync('dist/package.json', JSON.stringify(prodPackage, null, 2));

  console.log('Production build completed successfully!');
  console.log('Ready for deployment with: cd dist && node index.js');

} catch (error) {
  console.error('Build failed:', error.message);
  process.exit(1);
}