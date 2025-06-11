#!/usr/bin/env node

/**
 * Comprehensive Deployment Audit
 * Identifies and fixes all potential deployment issues
 */

import { existsSync, readFileSync } from 'fs';
import { execSync } from 'child_process';

console.log('🔍 Running comprehensive deployment audit...\n');

const issues = [];
const fixes = [];

// 1. Check critical files exist
console.log('1. Checking critical files...');
const criticalFiles = [
  'package.json',
  'start-production.js',
  'server/production-server.ts',
  'dist/index.html',
  'shared/schema.ts'
];

criticalFiles.forEach(file => {
  if (!existsSync(file)) {
    issues.push(`Missing critical file: ${file}`);
  } else {
    console.log(`✓ Found: ${file}`);
  }
});

// 2. Check package.json configuration
console.log('\n2. Checking package.json configuration...');
try {
  const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
  
  if (pkg.type !== 'module') {
    issues.push('package.json should have "type": "module"');
  } else {
    console.log('✓ ES modules configured');
  }
  
  if (!pkg.scripts.build) {
    issues.push('Missing build script in package.json');
  } else {
    console.log('✓ Build script exists');
  }
  
  if (!pkg.scripts.start) {
    issues.push('Missing start script in package.json');
  } else {
    console.log('✓ Start script exists');
  }
} catch (error) {
  issues.push('Cannot parse package.json');
}

// 3. Check environment variables
console.log('\n3. Checking environment variables...');
if (!process.env.DATABASE_URL) {
  issues.push('DATABASE_URL environment variable missing');
} else {
  console.log('✓ DATABASE_URL configured');
}

// 4. Check production server compilation
console.log('\n4. Checking production server compilation...');
if (!existsSync('server/production-server.js')) {
  issues.push('Production server not compiled - missing server/production-server.js');
  fixes.push('Run: node build-production-server.js');
} else {
  console.log('✓ Production server compiled');
}

// 5. Check frontend build
console.log('\n5. Checking frontend build...');
if (!existsSync('dist/index.html')) {
  issues.push('Frontend not built - missing dist/index.html');
  fixes.push('Run: npm run build or vite build');
} else {
  console.log('✓ Frontend built');
}

// 6. Test production server startup
console.log('\n6. Testing production server startup...');
try {
  const output = execSync('timeout 5s node start-production.js 2>&1 || true', { encoding: 'utf8' });
  if (output.includes('Production server running on port')) {
    console.log('✓ Production server starts successfully');
  } else {
    issues.push('Production server fails to start properly');
    fixes.push('Check start-production.js and production-server.ts for errors');
  }
} catch (error) {
  issues.push('Cannot test production server startup');
}

// 7. Check for conflicting files
console.log('\n7. Checking for conflicting files...');
const conflictingFiles = [
  'server/index.js',
  'dist/server.js',
  'production-server.js'
];

conflictingFiles.forEach(file => {
  if (existsSync(file)) {
    issues.push(`Potentially conflicting file: ${file}`);
    fixes.push(`Consider removing ${file} if not needed`);
  }
});

// 8. Check port configuration
console.log('\n8. Checking port configuration...');
try {
  const startProd = readFileSync('start-production.js', 'utf8');
  if (startProd.includes('PORT') && startProd.includes('5000')) {
    console.log('✓ Port configuration looks correct');
  } else {
    issues.push('Port configuration may be incorrect in start-production.js');
  }
} catch (error) {
  issues.push('Cannot check start-production.js port configuration');
}

// Summary
console.log('\n📋 DEPLOYMENT AUDIT SUMMARY');
console.log('='.repeat(50));

if (issues.length === 0) {
  console.log('🎉 No deployment issues found!');
  console.log('✅ Application appears ready for deployment');
} else {
  console.log(`❌ Found ${issues.length} potential issue(s):`);
  issues.forEach((issue, i) => {
    console.log(`${i + 1}. ${issue}`);
  });
  
  if (fixes.length > 0) {
    console.log('\n🔧 Suggested fixes:');
    fixes.forEach((fix, i) => {
      console.log(`${i + 1}. ${fix}`);
    });
  }
}

console.log('\n🚀 Deployment readiness score:', Math.max(0, 100 - (issues.length * 20)) + '%');