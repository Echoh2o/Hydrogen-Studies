#!/usr/bin/env node

/**
 * Deployment Readiness Check
 * Quick validation that deployment will match preview functionality
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';

const execAsync = promisify(exec);

async function checkDeploymentReadiness() {
  console.log('=== DEPLOYMENT READINESS CHECK ===\n');
  
  const results = {
    build: false,
    server: false,
    files: false,
    overall: false,
    issues: []
  };

  // 1. Check build files exist
  try {
    await fs.access('dist/index.js');
    await fs.access('dist/index.html');
    results.files = true;
    console.log('✅ Build files present');
  } catch (error) {
    results.issues.push('Missing build files - run npm run build');
    console.log('❌ Build files missing');
  }

  // 2. Validate production server file
  try {
    const serverContent = await fs.readFile('start-production.js', 'utf8');
    if (serverContent.includes('await import(\'./dist/index.js\')')) {
      results.server = true;
      console.log('✅ Production server configured correctly');
    } else {
      results.issues.push('Production server not configured to load built application');
      console.log('❌ Production server misconfigured');
    }
  } catch (error) {
    results.issues.push('Cannot read production server file');
    console.log('❌ Production server file issue');
  }

  // 3. Check if build is current
  try {
    const serverStat = await fs.stat('server/index.ts');
    const distStat = await fs.stat('dist/index.js');
    
    if (distStat.mtime > serverStat.mtime) {
      results.build = true;
      console.log('✅ Build is current');
    } else {
      results.issues.push('Build may be outdated - run npm run build');
      console.log('⚠️  Build may be outdated');
    }
  } catch (error) {
    results.issues.push('Cannot verify build currency');
    console.log('❌ Cannot verify build status');
  }

  // Overall assessment
  results.overall = results.files && results.server && results.build;

  console.log('\n=== SUMMARY ===');
  if (results.overall) {
    console.log('✅ READY FOR DEPLOYMENT');
    console.log('The deployed version should match preview functionality.');
  } else {
    console.log('❌ NOT READY FOR DEPLOYMENT');
    console.log('\nIssues to resolve:');
    results.issues.forEach((issue, index) => {
      console.log(`${index + 1}. ${issue}`);
    });
  }

  console.log('\n=== DEPLOYMENT INSTRUCTIONS ===');
  console.log('1. Fix any issues listed above');
  console.log('2. Run: npm run build (if needed)');
  console.log('3. Test locally: node start-production.js');
  console.log('4. Deploy via Replit Deploy button');
  console.log('5. Verify deployed site matches preview');

  return results;
}

// Run check
checkDeploymentReadiness()
  .then(results => {
    process.exit(results.overall ? 0 : 1);
  })
  .catch(error => {
    console.error('Readiness check failed:', error);
    process.exit(1);
  });