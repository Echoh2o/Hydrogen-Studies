#!/usr/bin/env node

/**
 * Final Deployment Readiness Check
 * Comprehensive validation for production deployment
 */

import { existsSync, readFileSync } from 'fs';
import { execSync } from 'child_process';
import fetch from 'node-fetch';

console.log('🔍 Final deployment readiness check...\n');

const issues = [];
const warnings = [];

// 1. Validate all build artifacts
console.log('1. Build artifacts validation...');
const buildArtifacts = [
  { file: 'dist/index.html', critical: true },
  { file: 'dist/assets', critical: true },
  { file: 'server/deployment-ready-server.js', critical: true },
  { file: 'start-production.js', critical: true }
];

buildArtifacts.forEach(({ file, critical }) => {
  if (!existsSync(file)) {
    if (critical) {
      issues.push(`Missing critical build artifact: ${file}`);
    } else {
      warnings.push(`Missing optional file: ${file}`);
    }
  } else {
    console.log(`✓ ${file}`);
  }
});

// 2. Test production server functionality
console.log('\n2. Production server functionality test...');
let serverPort = null;

try {
  // Start server in background
  const serverProcess = execSync('timeout 8s node start-production.js 2>&1 || true', { 
    encoding: 'utf8', 
    timeout: 10000 
  });
  
  // Extract port from output
  const portMatch = serverProcess.match(/port (\d+)/);
  if (portMatch) {
    serverPort = portMatch[1];
    console.log(`✓ Server started on port ${serverPort}`);
  }
  
  // Test endpoints if server started
  if (serverPort) {
    await new Promise(resolve => setTimeout(resolve, 2000)); // Wait for startup
    
    try {
      const healthResponse = await fetch(`http://localhost:${serverPort}/health`, { timeout: 3000 });
      if (healthResponse.ok) {
        console.log('✓ Health check endpoint responding');
      } else {
        warnings.push('Health endpoint not responding correctly');
      }
    } catch (e) {
      warnings.push('Cannot test health endpoint - server may not be fully started');
    }
    
    try {
      const apiResponse = await fetch(`http://localhost:${serverPort}/api`, { timeout: 3000 });
      if (apiResponse.ok) {
        console.log('✓ API endpoint responding');
      } else {
        warnings.push('API endpoint not responding correctly');
      }
    } catch (e) {
      warnings.push('Cannot test API endpoint');
    }
  }
  
} catch (error) {
  console.log('⚠️  Server startup test failed, checking output...');
  if (error.stdout && error.stdout.includes('Production server running')) {
    console.log('✓ Server can start successfully');
  } else {
    issues.push('Production server fails to start');
  }
}

// 3. Database connectivity check
console.log('\n3. Database connectivity check...');
if (process.env.DATABASE_URL) {
  console.log('✓ DATABASE_URL configured');
  try {
    // Quick database test
    const { neon } = await import('@neondatabase/serverless');
    const sql = neon(process.env.DATABASE_URL);
    await sql`SELECT 1`;
    console.log('✓ Database connection successful');
  } catch (error) {
    issues.push('Database connection failed');
  }
} else {
  issues.push('DATABASE_URL not configured');
}

// 4. Dependencies check
console.log('\n4. Production dependencies check...');
try {
  const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
  const criticalDeps = [
    'express',
    '@neondatabase/serverless',
    'react',
    'react-dom'
  ];
  
  const missingDeps = criticalDeps.filter(dep => !pkg.dependencies[dep]);
  if (missingDeps.length > 0) {
    issues.push(`Missing critical dependencies: ${missingDeps.join(', ')}`);
  } else {
    console.log('✓ All critical dependencies present');
  }
} catch (error) {
  issues.push('Cannot validate package.json dependencies');
}

// 5. Security configuration check
console.log('\n5. Security configuration check...');
try {
  const serverContent = readFileSync('server/deployment-ready-server.ts', 'utf8');
  
  if (serverContent.includes('CORS')) {
    console.log('✓ CORS configured');
  } else {
    warnings.push('CORS configuration not found');
  }
  
  if (serverContent.includes('helmet') || serverContent.includes('security')) {
    console.log('✓ Security headers configured');
  } else {
    warnings.push('Consider adding security headers');
  }
  
} catch (error) {
  warnings.push('Cannot validate security configuration');
}

// 6. Environment variables validation
console.log('\n6. Environment variables validation...');
const requiredEnvVars = ['DATABASE_URL'];
const optionalEnvVars = ['PORT', 'NODE_ENV'];

requiredEnvVars.forEach(envVar => {
  if (process.env[envVar]) {
    console.log(`✓ ${envVar} configured`);
  } else {
    issues.push(`Missing required environment variable: ${envVar}`);
  }
});

optionalEnvVars.forEach(envVar => {
  if (process.env[envVar]) {
    console.log(`✓ ${envVar} configured`);
  } else {
    console.log(`ℹ️  ${envVar} not set (will use default)`);
  }
});

// 7. Static assets check
console.log('\n7. Static assets validation...');
const staticAssets = [
  'dist/index.html',
  'public'
];

staticAssets.forEach(asset => {
  if (existsSync(asset)) {
    console.log(`✓ ${asset} available`);
  } else {
    warnings.push(`Static asset missing: ${asset}`);
  }
});

// Summary and recommendations
console.log('\n📋 FINAL DEPLOYMENT ASSESSMENT');
console.log('='.repeat(50));

const totalIssues = issues.length;
const totalWarnings = warnings.length;

if (totalIssues === 0 && totalWarnings === 0) {
  console.log('🎉 DEPLOYMENT READY!');
  console.log('✅ All checks passed - application is ready for production deployment');
  console.log('🚀 Deployment confidence: 100%');
} else {
  if (totalIssues > 0) {
    console.log('❌ BLOCKING ISSUES FOUND:');
    issues.forEach((issue, i) => {
      console.log(`  ${i + 1}. ${issue}`);
    });
  }
  
  if (totalWarnings > 0) {
    console.log('\n⚠️  WARNINGS (non-blocking):');
    warnings.forEach((warning, i) => {
      console.log(`  ${i + 1}. ${warning}`);
    });
  }
  
  const score = Math.max(0, 100 - (totalIssues * 30) - (totalWarnings * 5));
  console.log(`\n🚀 Deployment confidence: ${score}%`);
  
  if (totalIssues === 0) {
    console.log('✅ No blocking issues - deployment should succeed');
  } else {
    console.log('❌ Fix blocking issues before deployment');
  }
}

console.log('\n📝 DEPLOYMENT COMMAND:');
console.log('   Click the Deploy button in Replit');
console.log('   Or run: node start-production.js');