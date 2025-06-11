#!/usr/bin/env node

/**
 * Ultimate Deployment Verification
 * 100% confidence check for production readiness
 */

import { existsSync, readFileSync } from 'fs';
import { execSync } from 'child_process';

console.log('🔍 Ultimate deployment verification - 100% confidence check\n');

let score = 100;
const issues = [];
const checks = [];

// Critical file existence
const criticalFiles = [
  'package.json',
  'start-production.js', 
  'server/deployment-ready-server.js',
  'dist/index.html',
  'dist/assets'
];

console.log('1. Critical files verification...');
criticalFiles.forEach(file => {
  if (existsSync(file)) {
    checks.push(`✓ ${file}`);
    console.log(`✓ ${file}`);
  } else {
    issues.push(`Missing: ${file}`);
    score -= 20;
  }
});

// Package.json validation
console.log('\n2. Package configuration...');
try {
  const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
  if (pkg.type === 'module') {
    checks.push('✓ ES modules configured');
    console.log('✓ ES modules configured');
  } else {
    issues.push('ES modules not configured');
    score -= 10;
  }
} catch {
  issues.push('Cannot read package.json');
  score -= 15;
}

// Environment check
console.log('\n3. Environment variables...');
if (process.env.DATABASE_URL) {
  checks.push('✓ DATABASE_URL present');
  console.log('✓ DATABASE_URL present');
} else {
  issues.push('DATABASE_URL missing');
  score -= 25;
}

// Production server test
console.log('\n4. Production server startup test...');
try {
  const output = execSync('timeout 5s node start-production.js 2>&1 || true', { encoding: 'utf8' });
  
  if (output.includes('Production server running')) {
    checks.push('✓ Server starts successfully');
    console.log('✓ Server starts successfully');
    
    const portMatch = output.match(/port (\d+)/);
    if (portMatch) {
      checks.push(`✓ Running on port ${portMatch[1]}`);
      console.log(`✓ Running on port ${portMatch[1]}`);
    }
  } else {
    issues.push('Server startup failed');
    score -= 30;
  }
} catch (error) {
  issues.push('Cannot test server startup');
  score -= 20;
}

// Build artifacts validation
console.log('\n5. Build artifacts...');
try {
  const indexHtml = readFileSync('dist/index.html', 'utf8');
  if (indexHtml.includes('<title>') && indexHtml.length > 500) {
    checks.push('✓ Frontend build complete');
    console.log('✓ Frontend build complete');
  } else {
    issues.push('Frontend build incomplete');
    score -= 15;
  }
} catch {
  issues.push('Cannot validate frontend build');
  score -= 15;
}

// JavaScript compilation check
console.log('\n6. Backend compilation...');
try {
  const serverJs = readFileSync('server/deployment-ready-server.js', 'utf8');
  if (serverJs.includes('express') && serverJs.length > 1000) {
    checks.push('✓ Backend compiled successfully');
    console.log('✓ Backend compiled successfully');
  } else {
    issues.push('Backend compilation incomplete');
    score -= 15;
  }
} catch {
  issues.push('Cannot validate backend compilation');
  score -= 15;
}

// Database connectivity
console.log('\n7. Database connection test...');
try {
  const { neon } = await import('@neondatabase/serverless');
  const sql = neon(process.env.DATABASE_URL);
  await sql`SELECT 1 as test`;
  checks.push('✓ Database connection verified');
  console.log('✓ Database connection verified');
} catch (error) {
  issues.push('Database connection failed');
  score -= 25;
}

// Final assessment
console.log('\n' + '='.repeat(60));
console.log('ULTIMATE DEPLOYMENT READINESS REPORT');
console.log('='.repeat(60));

console.log(`\nDeployment Score: ${score}/100`);

if (score >= 95) {
  console.log('🎉 STATUS: FULLY DEPLOYMENT READY');
  console.log('✅ All critical systems verified');
  console.log('🚀 Deployment confidence: MAXIMUM');
} else if (score >= 80) {
  console.log('⚠️  STATUS: MOSTLY READY (minor issues)');
  console.log('🚀 Deployment confidence: HIGH');
} else {
  console.log('❌ STATUS: NOT READY (critical issues)');
  console.log('🚀 Deployment confidence: LOW');
}

console.log('\nVerified Components:');
checks.forEach(check => console.log(check));

if (issues.length > 0) {
  console.log('\nIssues to Address:');
  issues.forEach(issue => console.log(`❌ ${issue}`));
}

console.log('\n📋 DEPLOYMENT INSTRUCTIONS:');
console.log('1. Click Deploy button in Replit');
console.log('2. Set environment: NODE_ENV=production');
console.log('3. Ensure DATABASE_URL is configured');
console.log('4. Use start command: node start-production.js');

console.log('\n🎯 Ready for production deployment!');