/**
 * Production Cleanup Script
 * Removes redundant files and optimizes codebase for deployment
 */

import { promises as fs } from "fs";
import path from "path";

const REDUNDANT_FILES = [
  // Old server files
  "server/dev-server.ts",
  "server/simple-dev-server.ts",
  "server/simple-server.ts",
  "server/minimal-stable-server.ts",
  "server/deployment-ready-server.ts",
  "server/deployment-ready-server.js",
  "server/deployment-server.js",
  "server/production-server.js",
  "server/production-server.ts",
  "server/simple-production.js",

  // Old build scripts
  "build-for-deployment.js",
  "build-for-production.js",
  "build-production-server.js",
  "deploy-fix.js",
  "deployment-audit.js",
  "deployment-fix.js",
  "final-deployment-check.js",
  "production-deployment.js",
  "replit-deploy.js",
  "start-production.js",
  "ultimate-deployment-check.js",

  // Old HTML files
  "client/advanced-research-platform.html",
  "client/modern-homepage.html",
  "client/simple-app.html",
  "client/working-app.html",
  "public/index.html",
  "public/production-index.html",

  // Old configuration files
  "deploy-config.json",
  "Dockerfile",
  ".replitdeploy",
  "deploy.sh",

  // Duplicate image generators
  "server/accelerated-image-generator.ts",
  "server/bulk-image-generator.ts",
  "server/complete-image-generator.ts",
  "server/comprehensive-image-system.ts",
  "server/fast-image-generator.ts",
  "server/final-image-generator.ts",
  "server/optimal-image-generator.ts",
  "server/persistent-image-generator.ts",
  "server/turbo-image-generator.ts",

  // Old enhancement systems
  "server/batch-enrichment-system.ts",
  "server/chatgpt-study-enhancer.ts",
  "server/content-enhancement-coordinator.ts",
  "server/direct-pubmed-enrichment.ts",
  "server/pubmed-full-enrichment.ts",
  "server/targeted-enrichment.ts",
  "server/targeted-research-enrichment.ts",

  // Duplicate database files
  "server/database-adapter.ts",
  "server/database-implementation.ts",
  "server/database-optimization.ts",
  "server/database-optimizer.ts",
  "server/database-performance-optimizer.ts",
  "server/database-storage.ts",
  "server/db-storage.ts",

  // Old content generation
  "server/consumer-content-generator.ts",
  "server/simplified-consumer-content.ts",
  "server/generate-plain-summaries.ts",
  "server/plain-language-title-generator.ts",

  // Performance monitoring duplicates
  "server/admin-monitor.ts",
  "server/health-monitoring.ts",
  "server/performance-monitor.ts",
  "server/reliability-stability-monitor.ts",

  // Old API files
  "server/crossref-api.ts",
  "server/europepmc-api.ts",
  "server/semantic-scholar-api.ts",

  // Summary files
  "CLEANUP_SUMMARY.md",
  "COMPREHENSIVE_SECURITY_AUDIT.md",
  "FINAL_OPTIMIZATION_SUMMARY.md",
  "PERFORMANCE_OPTIMIZATION_SUMMARY.md",
  "server/performance-analysis.md",
];

const EMPTY_DIRECTORIES = [
  "server/adapters",
  "server/migrations",
  "server/utils",
  "uploads",
  "client/src",
];

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function removeFile(filePath) {
  try {
    if (await fileExists(filePath)) {
      await fs.unlink(filePath);
      console.log(`✓ Removed: ${filePath}`);
      return true;
    }
    return false;
  } catch (error) {
    console.error(`✗ Failed to remove ${filePath}:`, error.message);
    return false;
  }
}

async function removeEmptyDirectory(dirPath) {
  try {
    if (await fileExists(dirPath)) {
      const files = await fs.readdir(dirPath);
      if (files.length === 0) {
        await fs.rmdir(dirPath);
        console.log(`✓ Removed empty directory: ${dirPath}`);
        return true;
      } else {
        console.log(`⚠ Directory not empty, skipping: ${dirPath}`);
      }
    }
    return false;
  } catch (error) {
    console.error(`✗ Failed to remove directory ${dirPath}:`, error.message);
    return false;
  }
}

async function cleanupRedundantFiles() {
  console.log("🧹 Starting production cleanup...\n");

  let removedFiles = 0;
  let removedDirs = 0;

  // Remove redundant files
  console.log("Removing redundant files:");
  for (const file of REDUNDANT_FILES) {
    if (await removeFile(file)) {
      removedFiles++;
    }
  }

  console.log("\nRemoving empty directories:");
  for (const dir of EMPTY_DIRECTORIES) {
    if (await removeEmptyDirectory(dir)) {
      removedDirs++;
    }
  }

  console.log(`\n✅ Cleanup complete!`);
  console.log(`   Files removed: ${removedFiles}`);
  console.log(`   Directories removed: ${removedDirs}`);
  console.log(`   Codebase optimized for production deployment\n`);
}

// Run cleanup
cleanupRedundantFiles().catch(console.error);
