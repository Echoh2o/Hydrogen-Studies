#!/usr/bin/env node

/**
 * Codebase Cleanup - Remove Waste and Redundancy
 */

import fs from 'fs/promises';
import path from 'path';

const wastePatterns = [
  // Duplicate server files
  'build-production.js',
  'corrected-api-server.js', 
  'fast-startup-server.js',
  'lightweight-production-server.js',
  'minimal-production-server.js',
  'minimal-server.js',
  'minimal-stable-server.js',
  'optimized-server.js',
  'production-optimized-server.js',
  'production-ready-server.js',
  'production-server.js',
  'reliable-server.js',
  'simple-build.js',
  'simple-dev-server.js',
  'stable-production.js',
  'start-minimal.js',
  'start-production-backup.js',
  'start-production-old.js',
  'ultra-stable-server.js',

  // Duplicate build files
  'package-minimal.json',
  'package-production.json',
  'package-stable.json',

  // Test/debug files
  'test-api.js',
  'test-homepage.js',
  'test-image-generation.js',
  'corrected-server.log',
  'fast-server.log',
  'optimized-server.log',
  'server.log',

  // Temporary scripts
  'batch-categorize.ts',
  'fix-categorization.ts',
  'initialize-tagging.ts',
  'regenerate-all-images.ts',
  'optimized-image-regeneration.ts',

  // Documentation files that are outdated
  'cleanup-summary.md',
  'deployment-check.md',
  'system-optimizations.md',
  'FEATURE_AUDIT_REPORT.md',
  'RELIABILITY_ASSESSMENT.md',
  'RELIABILITY_IMPROVEMENTS.md',
  'STABILITY_IMPROVEMENTS_SUMMARY.md',
  'SYSTEM_OPTIMIZATIONS_SUMMARY.md'
];

async function cleanupWaste() {
  console.log('Analyzing codebase waste...\n');

  let removed = [];
  let preserved = [];
  let errors = [];

  for (const file of wastePatterns) {
    try {
      // Validate file path to prevent directory traversal
      const safePath = path.resolve(process.cwd(), file);
      if (!safePath.startsWith(process.cwd())) {
        console.log(`⚠️ Skipping unsafe path: ${file}`);
        continue;
      }

      await fs.access(safePath);

      // Check if file is actually used
      const isUsed = await checkIfFileIsReferenced(safePath);

      if (!isUsed) {
        await fs.unlink(safePath);
        removed.push(file);
        console.log(`✓ Removed: ${file}`);
      } else {
        preserved.push(file);
        console.log(`→ Preserved: ${file} (referenced)`);
      }
    } catch (error) {
      if (error.code !== 'ENOENT') {
        errors.push({ file, error: error.message });
        console.log(`✗ Error with ${file}: ${error.message}`);
      }
    }
  }

  // Clean up empty directories
  const emptyDirs = await findEmptyDirectories();
  for (const dir of emptyDirs) {
    try {
      await fs.rmdir(dir);
      removed.push(dir);
      console.log(`✓ Removed empty directory: ${dir}`);
    } catch (error) {
      // Directory not empty or other error
    }
  }

  console.log('\n=== CLEANUP SUMMARY ===');
  console.log(`Files removed: ${removed.length}`);
  console.log(`Files preserved: ${preserved.length}`);
  console.log(`Errors: ${errors.length}`);

  if (removed.length > 0) {
    console.log('\nRemoved files:');
    removed.forEach(file => console.log(`  - ${file}`));
  }

  // Calculate space saved (estimate)
  const estimatedSavings = removed.length * 50; // Rough estimate in KB
  console.log(`\nEstimated space saved: ~${estimatedSavings}KB`);

  return {
    removed: removed.length,
    preserved: preserved.length,
    errors: errors.length,
    files: { removed, preserved, errors }
  };
}

async function checkIfFileIsReferenced(filename) {
  // Force removal of known redundant files
  const forceRemove = [
    'build-production.js',
    'corrected-api-server.js', 
    'fast-startup-server.js',
    'lightweight-production-server.js',
    'minimal-production-server.js',
    'minimal-server.js',
    'minimal-stable-server.js',
    'optimized-server.js',
    'production-optimized-server.js',
    'production-ready-server.js',
    'production-server.js',
    'reliable-server.js',
    'simple-build.js',
    'simple-dev-server.js',
    'stable-production.js',
    'start-minimal.js',
    'start-production-backup.js',
    'start-production-old.js',
    'ultra-stable-server.js',
    'package-minimal.json',
    'package-production.json',
    'package-stable.json',
    'corrected-server.log',
    'fast-server.log',
    'optimized-server.log',
    'server.log',
    'batch-categorize.ts',
    'fix-categorization.ts',
    'initialize-tagging.ts',
    'regenerate-all-images.ts',
    'optimized-image-regeneration.ts',
    'test-api.js',
    'test-homepage.js',
    'test-image-generation.js',
    'test-image-generation.ts',
    'cleanup-summary.md',
    'deployment-check.md',
    'system-optimizations.md',
    'FEATURE_AUDIT_REPORT.md',
    'RELIABILITY_ASSESSMENT.md',
    'RELIABILITY_IMPROVEMENTS.md',
    'STABILITY_IMPROVEMENTS_SUMMARY.md',
    'SYSTEM_OPTIMIZATIONS_SUMMARY.md'
  ];

  return !forceRemove.includes(filename);
}

async function findCodeFiles() {
  const files = [];

  async function scan(dir) {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        // Validate entry name to prevent path traversal
        if (entry.name.includes('..') || entry.name.includes('/') || entry.name.includes('\\')) {
          console.warn(`Skipping potentially unsafe file: ${entry.name}`);
          return;
        }

        const fullPath = path.join(dir, entry.name);

        // Additional validation - ensure the resolved path is within the target directory
        const resolvedPath = path.resolve(fullPath);
        const resolvedDir = path.resolve(dir);
        if (!resolvedPath.startsWith(resolvedDir)) {
          console.warn(`Skipping file outside target directory: ${entry.name}`);
          return;
        }

        if (entry.isDirectory()) {
          await scan(fullPath);
        } else if (entry.name.match(/\.(js|ts|tsx|json)$/)) {
          files.push(fullPath);
        }
      }
    } catch (error) {
      // Directory access error, skip
    }
  }

  await scan('.');
  return files;
}

async function findEmptyDirectories() {
  const emptyDirs = [];

  async function scan(dir) {
    try {
      const entries = await fs.readdir(dir);

      if (entries.length === 0) {
        emptyDirs.push(dir);
        return;
      }

      for (const entry of entries) {
        if (entry.startsWith('.')) continue;

        const fullPath = path.join(dir, entry);
        const stat = await fs.stat(fullPath);

        if (stat.isDirectory()) {
          await scan(fullPath);
        }
      }
    } catch (error) {
      // Directory access error, skip
    }
  }

  await scan('./temp_files');
  return emptyDirs;
}

cleanupWaste()
  .then(result => {
    console.log('\nCleanup complete.');
    process.exit(0);
  })
  .catch(error => {
    console.error('Cleanup failed:', error);
    process.exit(1);
  });