#!/usr/bin/env node

/**
 * Test deployed API endpoints to verify functionality
 */

import https from 'https';

const API_BASE = 'https://hydrogenstudies.replit.app';

function testEndpoint(path, description) {
  return new Promise((resolve) => {
    console.log(`Testing ${description}: ${API_BASE}${path}`);
    
    https.get(`${API_BASE}${path}`, (res) => {
      let data = '';
      
      res.on('data', chunk => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          console.log(`✓ ${description} - Status: ${res.statusCode}`);
          console.log(`  Response keys: ${Object.keys(json).join(', ')}`);
          
          if (json.studies) {
            console.log(`  Studies count: ${json.studies.length}`);
          }
          if (json.total !== undefined) {
            console.log(`  Total: ${json.total}`);
          }
          
          resolve({ success: true, status: res.statusCode, data: json });
        } catch (error) {
          console.log(`✗ ${description} - JSON parse error`);
          console.log(`  Raw response: ${data.substring(0, 200)}`);
          resolve({ success: false, status: res.statusCode, error: error.message });
        }
      });
    }).on('error', (error) => {
      console.log(`✗ ${description} - Request error: ${error.message}`);
      resolve({ success: false, error: error.message });
    });
  });
}

async function runTests() {
  console.log('Testing deployed API endpoints...\n');
  
  const tests = [
    ['/health', 'Health check'],
    ['/api/studies?limit=3', 'Studies endpoint'],
    ['/api/categories', 'Categories endpoint'],
    ['/api/studies/condition/respiratory', 'Condition endpoint'],
    ['/api/search/enhanced?q=hydrogen&limit=2', 'Enhanced search']
  ];
  
  for (const [path, description] of tests) {
    await testEndpoint(path, description);
    console.log('');
  }
  
  console.log('API testing complete.');
}

runTests().catch(console.error);