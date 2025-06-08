#!/usr/bin/env node

/**
 * Deployment Quality Assurance Check
 * Validates that deployed version matches preview functionality
 */

import fetch from 'node-fetch';

const PREVIEW_BASE = 'http://localhost:5000';
const DEPLOYED_BASE = 'https://hydrogenstudies.replit.app';

const criticalEndpoints = [
  '/api/search/trending',
  '/api/search/enhanced',
  '/api/consumer-categories/counts',
  '/api/studies?limit=5',
  '/api/categories',
  '/health'
];

const testCases = [
  {
    name: 'Basic Search',
    endpoint: '/api/search/enhanced?q=hydrogen&limit=5',
    validate: (data) => data.studies && data.studies.length > 0
  },
  {
    name: 'Category Search',
    endpoint: '/api/studies?category=cardiovascular&limit=3',
    validate: (data) => data.data && data.data.length >= 0
  },
  {
    name: 'Study Detail',
    endpoint: '/api/studies/1',
    validate: (data) => data.id && data.title
  },
  {
    name: 'Consumer Categories',
    endpoint: '/api/consumer-categories/counts',
    validate: (data) => data.success && data.data
  }
];

async function checkEndpoint(baseUrl, endpoint) {
  try {
    const response = await fetch(`${baseUrl}${endpoint}`, {
      timeout: 10000,
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'QualityCheck/1.0'
      }
    });
    
    if (!response.ok) {
      return {
        success: false,
        status: response.status,
        error: `HTTP ${response.status}: ${response.statusText}`
      };
    }
    
    const data = await response.json();
    return {
      success: true,
      status: response.status,
      data: data,
      responseTime: response.headers.get('x-response-time') || 'unknown'
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

async function runQualityCheck() {
  console.log('🔍 Starting Deployment Quality Check...\n');
  
  const results = {
    preview: {},
    deployed: {},
    comparison: {},
    issues: []
  };
  
  // Test all critical endpoints
  for (const endpoint of criticalEndpoints) {
    console.log(`Testing: ${endpoint}`);
    
    // Check preview version
    const previewResult = await checkEndpoint(PREVIEW_BASE, endpoint);
    results.preview[endpoint] = previewResult;
    
    // Check deployed version
    const deployedResult = await checkEndpoint(DEPLOYED_BASE, endpoint);
    results.deployed[endpoint] = deployedResult;
    
    // Compare results
    const comparison = {
      preview_works: previewResult.success,
      deployed_works: deployedResult.success,
      status_match: previewResult.status === deployedResult.status,
      both_working: previewResult.success && deployedResult.success
    };
    
    results.comparison[endpoint] = comparison;
    
    if (!comparison.both_working) {
      results.issues.push({
        endpoint,
        issue: !previewResult.success ? 'Preview failing' : 'Deployment failing',
        preview_error: previewResult.error,
        deployed_error: deployedResult.error
      });
    }
    
    console.log(`  Preview: ${previewResult.success ? '✅' : '❌'} ${previewResult.status || 'ERR'}`);
    console.log(`  Deployed: ${deployedResult.success ? '✅' : '❌'} ${deployedResult.status || 'ERR'}`);
    console.log('');
  }
  
  // Test specific functionality
  console.log('🧪 Testing Specific Functionality...\n');
  
  for (const test of testCases) {
    console.log(`Testing: ${test.name}`);
    
    const previewResult = await checkEndpoint(PREVIEW_BASE, test.endpoint);
    const deployedResult = await checkEndpoint(DEPLOYED_BASE, test.endpoint);
    
    let previewValid = false;
    let deployedValid = false;
    
    if (previewResult.success) {
      try {
        previewValid = test.validate(previewResult.data);
      } catch (e) {
        previewValid = false;
      }
    }
    
    if (deployedResult.success) {
      try {
        deployedValid = test.validate(deployedResult.data);
      } catch (e) {
        deployedValid = false;
      }
    }
    
    console.log(`  Preview: ${previewValid ? '✅' : '❌'} (${previewResult.success ? 'Connected' : 'Failed'})`);
    console.log(`  Deployed: ${deployedValid ? '✅' : '❌'} (${deployedResult.success ? 'Connected' : 'Failed'})`);
    
    if (previewValid !== deployedValid) {
      results.issues.push({
        test: test.name,
        endpoint: test.endpoint,
        issue: 'Validation mismatch between preview and deployed',
        preview_valid: previewValid,
        deployed_valid: deployedValid
      });
    }
    console.log('');
  }
  
  // Summary
  console.log('📊 Quality Check Summary');
  console.log('========================');
  
  if (results.issues.length === 0) {
    console.log('✅ All tests passed - Preview and Deployed versions match!');
  } else {
    console.log(`❌ Found ${results.issues.length} issues:`);
    results.issues.forEach((issue, index) => {
      console.log(`\n${index + 1}. ${issue.issue}`);
      console.log(`   Endpoint: ${issue.endpoint || issue.test}`);
      if (issue.preview_error) console.log(`   Preview Error: ${issue.preview_error}`);
      if (issue.deployed_error) console.log(`   Deployed Error: ${issue.deployed_error}`);
    });
  }
  
  return results;
}

// Run the check
if (import.meta.url === `file://${process.argv[1]}`) {
  runQualityCheck()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Quality check failed:', error);
      process.exit(1);
    });
}

export { runQualityCheck };