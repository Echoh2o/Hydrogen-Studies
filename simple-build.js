#!/usr/bin/env node

// Simple build script that creates a minimal production setup
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

console.log('Creating simple production build...');

// Create dist directory
if (!fs.existsSync('dist')) {
  fs.mkdirSync('dist', { recursive: true });
}

// Copy server files to dist (simplified approach)
const serverFiles = [
  'server/index.ts',
  'server/routes.ts', 
  'server/storage.ts',
  'server/vite.ts'
];

// Just copy the main server file for now
fs.copyFileSync('server/index.ts', 'dist/index.js');

console.log('Simple build complete.');