
#!/usr/bin/env node

/**
 * Comprehensive Codebase Cleanup
 * Removes orphaned systems, duplicate files, and unused code
 */

import fs from 'fs/promises';
import path from 'path';

const ORPHANED_FILES = [
  // Duplicate server files
  'server/deployment-server.js',
  'server/simple-production.js',
  'server/minimal-stable-server.ts',
  
  // Unused image generation systems
  'server/accelerated-image-generator.ts',
  'server/auto-image-system.ts', 
  'server/bulk-image-generator.ts',
  'server/complete-image-generator.ts',
  'server/fast-image-generator.ts',
  'server/final-image-generator.ts',
  'server/persistent-image-generator.ts',
  'server/turbo-image-generator.ts',
  'server/image-refresh-system.ts',
  'server/local-image-storage.ts',
  
  // Duplicate enrichment systems
  'server/auto-enrichment-manager.ts',
  'server/batch-enrichment-system.ts',
  'server/content-enhancement-coordinator.ts',
  'server/content-enrichment.ts',
  'server/content-priority-queue.ts',
  'server/direct-pubmed-enrichment.ts',
  'server/pubmed-enricher.ts',
  'server/pubmed-full-enrichment.ts',
  'server/targeted-enrichment.ts',
  'server/targeted-research-enrichment.ts',
  'server/study-enrichment-service.ts',
  
  // Duplicate database systems
  'server/database-adapter.ts',
  'server/database-implementation.ts',
  'server/database-optimization.ts',
  'server/database-performance-optimizer.ts',
  'server/db-storage.ts',
  'server/storage.ts',
  
  // Unused monitoring systems
  'server/admin-monitor.ts',
  'server/health-monitoring.ts',
  'server/reliability-stability-monitor.ts',
  'server/performance-monitor.ts',
  
  // Duplicate route files
  'server/routes/admin-enrichment-routes.ts',
  'server/routes/admin-image-routes.ts',
  'server/routes/content-enrichment-routes.ts',
  'server/routes/enrichment-routes.ts',
  'server/routes/image-fix-routes.ts',
  'server/routes/image-generation-routes.ts',
  'server/routes/optimized-api-routes.ts',
  'server/routes/performance-routes.ts',
  
  // Unused utility files
  'server/chatgpt-study-enhancer.ts',
  'server/consumer-content-generator.ts',
  'server/generate-plain-summaries.ts',
  'server/generate-study-slugs.ts',
  'server/keyword-extractor.ts',
  'server/plain-language-title-generator.ts',
  'server/replace-placeholders.ts',
  'server/research-suggestions.ts',
  'server/semantic-search.ts',
  'server/start-content-improvement.ts',
  'server/visual-enhancement.ts',
  
  // Migration files (already applied)
  'server/migrations/add-consumer-categories.ts',
  'server/migrations/add-journal-publish-date.ts',
  'server/migrations/add-multiple-images-support.ts',
  'server/migrations/add-research-data-fields.ts',
  'server/migrations/keyword-monitor-migration.ts',
  'server/migrations/tagging-system-migration.ts',
  'server/schema-migrator.ts',
  'server/schema-update.ts',
  'server/schema-updates.ts',
  
  // Duplicate client pages
  'client/src/pages/AboutPage.tsx',
  'client/src/pages/BlogPage.tsx',
  'client/src/pages/CategoriesPage.tsx',
  'client/src/pages/ContactPage.tsx',
  'client/src/pages/HomePage.tsx',
  'client/src/pages/LearnPage.tsx',
  'client/src/pages/ResourcePage.tsx',
  'client/src/pages/about.tsx',
  'client/src/pages/categories.tsx',
  'client/src/pages/home.tsx',
  'client/src/pages/learn.tsx',
  'client/src/pages/resources.tsx',
  'client/src/pages/studies.tsx',
  
  // Unused admin pages
  'client/src/pages/admin/BatchCategorizationPage.tsx',
  'client/src/pages/admin/BatchEnrichmentPage.tsx',
  'client/src/pages/admin/ContentEnrichmentPage.tsx',
  'client/src/pages/admin/EnhancementPage.tsx',
  'client/src/pages/admin/ImageGenerationPage.tsx',
  'client/src/pages/admin/JournalDateUpdater.tsx',
  'client/src/pages/admin/ResearchDatabasePage.tsx',
  'client/src/pages/admin/ResearchImportPage.tsx',
  
  // Cleanup files
  'cleanup-waste.js',
  'CLEANUP_SUMMARY.md',
  'server/performance-analysis.md',
  
  // Build artifacts
  'build-for-production.js',
  'deploy-config.json',
  'deploy-fix.js',
  'deploy.sh',
  'deployment-fix.js',
  'replit-deploy.js',
  
  // State files
  '.auto-image-state.json',
  '.migration-status.json',
  'server/stop-research-enrichment.flag',
  
  // Duplicate uploads
  'uploads/Hydrogen Research Database_Timeline.xlsx',
  'uploads/file-1747438805490-340351428.xlsx'
];

const EMPTY_DIRECTORIES = [
  'server/db',
  'server/migrations',
  'server/adapters'
];

async function comprehensiveCleanup() {
  console.log('🧹 Starting comprehensive codebase cleanup...\n');
  
  let removed = [];
  let errors = [];
  let totalSize = 0;

  // Step 1: Remove orphaned files
  console.log('📁 Removing orphaned files...');
  for (const file of ORPHANED_FILES) {
    try {
      const stats = await fs.stat(file);
      totalSize += stats.size;
      await fs.unlink(file);
      removed.push(file);
      console.log(`✓ Removed: ${file}`);
    } catch (error) {
      if (error.code !== 'ENOENT') {
        errors.push({ file, error: error.message });
        console.log(`✗ Error removing ${file}: ${error.message}`);
      }
    }
  }

  // Step 2: Remove empty directories
  console.log('\n📂 Removing empty directories...');
  for (const dir of EMPTY_DIRECTORIES) {
    try {
      await fs.rmdir(dir);
      removed.push(dir);
      console.log(`✓ Removed directory: ${dir}`);
    } catch (error) {
      if (error.code !== 'ENOENT' && error.code !== 'ENOTEMPTY') {
        console.log(`✗ Could not remove ${dir}: ${error.message}`);
      }
    }
  }

  // Step 3: Clean up old study images (keep only latest versions)
  console.log('\n🖼️ Cleaning up duplicate study images...');
  try {
    const imageDir = 'uploads/study-images';
    const files = await fs.readdir(imageDir);
    
    // Group files by study ID
    const studyGroups = {};
    files.forEach(file => {
      const match = file.match(/^study-(\d+)-/);
      if (match) {
        const studyId = match[1];
        if (!studyGroups[studyId]) studyGroups[studyId] = [];
        studyGroups[studyId].push(file);
      }
    });

    // Keep only the latest image for each study
    for (const [studyId, studyFiles] of Object.entries(studyGroups)) {
      if (studyFiles.length > 1) {
        // Sort by timestamp (newest last)
        studyFiles.sort();
        const toRemove = studyFiles.slice(0, -1); // Remove all but the last
        
        for (const file of toRemove) {
          try {
            const filePath = path.join(imageDir, file);
            const stats = await fs.stat(filePath);
            totalSize += stats.size;
            await fs.unlink(filePath);
            removed.push(filePath);
            console.log(`✓ Removed old image: ${file}`);
          } catch (error) {
            console.log(`✗ Error removing ${file}: ${error.message}`);
          }
        }
      }
    }
  } catch (error) {
    console.log(`✗ Error cleaning images: ${error.message}`);
  }

  // Step 4: Remove unused blog images
  console.log('\n📰 Cleaning up unused blog images...');
  try {
    const blogImageDir = 'public/uploads/blog';
    const files = await fs.readdir(blogImageDir);
    
    // Remove all old blog images (they're regenerated as needed)
    for (const file of files) {
      if (file.endsWith('.png')) {
        try {
          const filePath = path.join(blogImageDir, file);
          const stats = await fs.stat(filePath);
          totalSize += stats.size;
          await fs.unlink(filePath);
          removed.push(filePath);
          console.log(`✓ Removed blog image: ${file}`);
        } catch (error) {
          console.log(`✗ Error removing ${file}: ${error.message}`);
        }
      }
    }
  } catch (error) {
    console.log(`✗ Error cleaning blog images: ${error.message}`);
  }

  // Step 5: Clean up documentation files
  console.log('\n📄 Removing outdated documentation...');
  const docFiles = [
    'COMPREHENSIVE_SECURITY_AUDIT.md',
    'FINAL_OPTIMIZATION_SUMMARY.md', 
    'PERFORMANCE_OPTIMIZATION_SUMMARY.md'
  ];
  
  for (const file of docFiles) {
    try {
      const stats = await fs.stat(file);
      totalSize += stats.size;
      await fs.unlink(file);
      removed.push(file);
      console.log(`✓ Removed: ${file}`);
    } catch (error) {
      if (error.code !== 'ENOENT') {
        console.log(`✗ Error removing ${file}: ${error.message}`);
      }
    }
  }

  // Results summary
  console.log('\n=== CLEANUP COMPLETE ===');
  console.log(`Files/directories removed: ${removed.length}`);
  console.log(`Errors encountered: ${errors.length}`);
  console.log(`Space saved: ${(totalSize / 1024 / 1024).toFixed(2)} MB`);
  
  if (errors.length > 0) {
    console.log('\nErrors:');
    errors.forEach(({ file, error }) => console.log(`  - ${file}: ${error}`));
  }

  return {
    removed: removed.length,
    errors: errors.length,
    spaceFreed: totalSize,
    cleanedFiles: removed
  };
}

// Run cleanup
comprehensiveCleanup()
  .then(result => {
    console.log('\n✅ Comprehensive cleanup completed successfully!');
    console.log('Your codebase is now streamlined and free of orphaned code.');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Cleanup failed:', error);
    process.exit(1);
  });
