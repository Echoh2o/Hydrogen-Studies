#!/usr/bin/env node

/**
 * Staging Deployment Test Suite
 * Comprehensive testing before production deployment
 */

import { spawn, exec } from 'child_process';
import { promisify } from 'util';
import fetch from 'node-fetch';
import fs from 'fs/promises';
import path from 'path';

const execAsync = promisify(exec);

class StagingTest {
  constructor() {
    this.results = {
      build: null,
      server: null,
      endpoints: {},
      frontend: {},
      database: {},
      performance: {},
      issues: []
    };
    this.serverProcess = null;
  }

  async runFullTest() {
    console.log('Starting comprehensive staging deployment test...\n');

    try {
      // 1. Build Test
      await this.testBuild();
      
      // 2. Start staging server
      await this.startStagingServer();
      
      // 3. Wait for server startup
      await this.waitForServer();
      
      // 4. Run all endpoint tests
      await this.testAllEndpoints();
      
      // 5. Test database functionality
      await this.testDatabase();
      
      // 6. Test frontend compilation
      await this.testFrontend();
      
      // 7. Performance tests
      await this.testPerformance();
      
      // 8. Generate report
      this.generateReport();
      
    } catch (error) {
      console.error('Staging test failed:', error);
      this.results.issues.push({
        category: 'System',
        issue: 'Test suite failure',
        error: error.message
      });
    } finally {
      await this.cleanup();
    }
    
    return this.results;
  }

  async testBuild() {
    console.log('Testing build process...');
    
    try {
      // Clean previous build
      await execAsync('rm -rf dist/');
      
      // Run build
      const buildResult = await execAsync('npm run build', { timeout: 120000 });
      
      // Check build outputs
      const distExists = await fs.access('dist/').then(() => true).catch(() => false);
      const indexExists = await fs.access('dist/index.js').then(() => true).catch(() => false);
      const htmlExists = await fs.access('dist/index.html').then(() => true).catch(() => false);
      
      this.results.build = {
        success: distExists && indexExists && htmlExists,
        distExists,
        indexExists,
        htmlExists,
        buildOutput: buildResult.stdout
      };
      
      console.log(`Build: ${this.results.build.success ? 'PASS' : 'FAIL'}`);
      
      if (!this.results.build.success) {
        this.results.issues.push({
          category: 'Build',
          issue: 'Build process failed or missing outputs',
          details: this.results.build
        });
      }
      
    } catch (error) {
      this.results.build = {
        success: false,
        error: error.message
      };
      this.results.issues.push({
        category: 'Build',
        issue: 'Build process error',
        error: error.message
      });
    }
  }

  async startStagingServer() {
    console.log('Starting staging server...');
    
    return new Promise((resolve, reject) => {
      this.serverProcess = spawn('node', ['start-production.js'], {
        env: { ...process.env, NODE_ENV: 'production', PORT: '5001' },
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let serverOutput = '';
      
      this.serverProcess.stdout.on('data', (data) => {
        serverOutput += data.toString();
        if (data.toString().includes('serving on port') || 
            data.toString().includes('Application startup complete')) {
          this.results.server = {
            success: true,
            pid: this.serverProcess.pid,
            output: serverOutput
          };
          resolve();
        }
      });

      this.serverProcess.stderr.on('data', (data) => {
        console.error('Server error:', data.toString());
      });

      this.serverProcess.on('error', (error) => {
        this.results.server = {
          success: false,
          error: error.message
        };
        reject(error);
      });

      // Timeout after 30 seconds
      setTimeout(() => {
        if (!this.results.server) {
          this.results.server = {
            success: false,
            error: 'Server startup timeout'
          };
          reject(new Error('Server startup timeout'));
        }
      }, 30000);
    });
  }

  async waitForServer() {
    console.log('Waiting for server to be ready...');
    
    const maxAttempts = 30;
    let attempt = 0;
    
    while (attempt < maxAttempts) {
      try {
        const response = await fetch('http://localhost:5001/health', { timeout: 2000 });
        if (response.ok) {
          console.log('Server ready');
          return;
        }
      } catch (error) {
        // Server not ready yet
      }
      
      await new Promise(resolve => setTimeout(resolve, 1000));
      attempt++;
    }
    
    throw new Error('Server failed to become ready');
  }

  async testAllEndpoints() {
    console.log('Testing all API endpoints...');
    
    const endpoints = [
      { path: '/health', name: 'Health Check' },
      { path: '/api/search/trending', name: 'Trending Search' },
      { path: '/api/search/enhanced', name: 'Enhanced Search' },
      { path: '/api/consumer-categories/counts', name: 'Category Counts' },
      { path: '/api/studies?limit=5', name: 'Studies List' },
      { path: '/api/studies/1', name: 'Study Detail' },
      { path: '/api/categories', name: 'Categories' },
      { path: '/api/search/enhanced?q=hydrogen&limit=3', name: 'Search with Query' }
    ];

    for (const endpoint of endpoints) {
      try {
        const start = Date.now();
        const response = await fetch(`http://localhost:5001${endpoint.path}`, {
          timeout: 10000,
          headers: { 'Accept': 'application/json' }
        });
        
        const responseTime = Date.now() - start;
        const data = response.ok ? await response.json() : null;
        
        this.results.endpoints[endpoint.path] = {
          name: endpoint.name,
          success: response.ok,
          status: response.status,
          responseTime,
          hasData: data !== null && (Array.isArray(data) ? data.length > 0 : Object.keys(data).length > 0)
        };
        
        if (!response.ok) {
          this.results.issues.push({
            category: 'API',
            issue: `${endpoint.name} endpoint failed`,
            path: endpoint.path,
            status: response.status
          });
        }
        
        console.log(`  ${endpoint.name}: ${response.ok ? 'PASS' : 'FAIL'} (${responseTime}ms)`);
        
      } catch (error) {
        this.results.endpoints[endpoint.path] = {
          name: endpoint.name,
          success: false,
          error: error.message
        };
        
        this.results.issues.push({
          category: 'API',
          issue: `${endpoint.name} endpoint error`,
          path: endpoint.path,
          error: error.message
        });
        
        console.log(`  ${endpoint.name}: ERROR - ${error.message}`);
      }
    }
  }

  async testDatabase() {
    console.log('Testing database functionality...');
    
    try {
      // Test studies count
      const studiesResponse = await fetch('http://localhost:5001/api/studies?limit=1');
      const studiesData = await studiesResponse.json();
      
      // Test categories
      const categoriesResponse = await fetch('http://localhost:5001/api/categories');
      const categoriesData = await categoriesResponse.json();
      
      this.results.database = {
        success: studiesResponse.ok && categoriesResponse.ok,
        studiesCount: studiesData?.total || 0,
        categoriesCount: Array.isArray(categoriesData) ? categoriesData.length : 0,
        hasStudies: studiesData?.total > 0,
        hasCategories: Array.isArray(categoriesData) && categoriesData.length > 0
      };
      
      console.log(`Database: ${this.results.database.success ? 'PASS' : 'FAIL'}`);
      console.log(`  Studies: ${this.results.database.studiesCount}`);
      console.log(`  Categories: ${this.results.database.categoriesCount}`);
      
      if (!this.results.database.hasStudies) {
        this.results.issues.push({
          category: 'Database',
          issue: 'No studies found in database',
          count: this.results.database.studiesCount
        });
      }
      
    } catch (error) {
      this.results.database = {
        success: false,
        error: error.message
      };
      
      this.results.issues.push({
        category: 'Database',
        issue: 'Database test failed',
        error: error.message
      });
    }
  }

  async testFrontend() {
    console.log('Testing frontend...');
    
    try {
      // Test main page
      const response = await fetch('http://localhost:5001/', {
        headers: { 'Accept': 'text/html' }
      });
      
      const html = await response.text();
      
      this.results.frontend = {
        success: response.ok,
        status: response.status,
        hasHtml: html.includes('<html'),
        hasReact: html.includes('react') || html.includes('React'),
        hasTitle: html.includes('<title>'),
        size: html.length
      };
      
      console.log(`Frontend: ${this.results.frontend.success ? 'PASS' : 'FAIL'}`);
      
      if (!this.results.frontend.success) {
        this.results.issues.push({
          category: 'Frontend',
          issue: 'Frontend page failed to load',
          status: response.status
        });
      }
      
    } catch (error) {
      this.results.frontend = {
        success: false,
        error: error.message
      };
      
      this.results.issues.push({
        category: 'Frontend',
        issue: 'Frontend test failed',
        error: error.message
      });
    }
  }

  async testPerformance() {
    console.log('Testing performance...');
    
    const performanceTests = [
      { name: 'Quick Search', path: '/api/search/enhanced?q=hydrogen&limit=5' },
      { name: 'Study Load', path: '/api/studies/1' },
      { name: 'Categories', path: '/api/consumer-categories/counts' }
    ];
    
    const results = {};
    
    for (const test of performanceTests) {
      const times = [];
      
      // Run test 3 times
      for (let i = 0; i < 3; i++) {
        try {
          const start = Date.now();
          const response = await fetch(`http://localhost:5001${test.path}`);
          const time = Date.now() - start;
          
          if (response.ok) {
            times.push(time);
          }
        } catch (error) {
          // Skip failed requests
        }
      }
      
      if (times.length > 0) {
        const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
        results[test.name] = {
          success: true,
          averageTime: Math.round(avgTime),
          times: times,
          acceptable: avgTime < 2000 // Under 2 seconds
        };
        
        if (!results[test.name].acceptable) {
          this.results.issues.push({
            category: 'Performance',
            issue: `${test.name} is slow`,
            averageTime: avgTime,
            threshold: 2000
          });
        }
      } else {
        results[test.name] = {
          success: false,
          error: 'All requests failed'
        };
      }
      
      console.log(`  ${test.name}: ${results[test.name].success ? results[test.name].averageTime + 'ms' : 'FAIL'}`);
    }
    
    this.results.performance = results;
  }

  generateReport() {
    console.log('\n========================================');
    console.log('STAGING DEPLOYMENT TEST REPORT');
    console.log('========================================\n');
    
    // Overall status
    const hasIssues = this.results.issues.length > 0;
    const criticalIssues = this.results.issues.filter(i => 
      i.category === 'Build' || i.category === 'Database' || i.category === 'System'
    );
    
    console.log(`Overall Status: ${hasIssues ? (criticalIssues.length > 0 ? 'CRITICAL' : 'WARNING') : 'PASS'}`);
    console.log(`Total Issues: ${this.results.issues.length}`);
    console.log(`Critical Issues: ${criticalIssues.length}\n`);
    
    // Component status
    console.log('Component Status:');
    console.log(`  Build: ${this.results.build?.success ? 'PASS' : 'FAIL'}`);
    console.log(`  Server: ${this.results.server?.success ? 'PASS' : 'FAIL'}`);
    console.log(`  Database: ${this.results.database?.success ? 'PASS' : 'FAIL'}`);
    console.log(`  Frontend: ${this.results.frontend?.success ? 'PASS' : 'FAIL'}\n`);
    
    // API endpoints summary
    const endpointCount = Object.keys(this.results.endpoints).length;
    const passedEndpoints = Object.values(this.results.endpoints).filter(e => e.success).length;
    console.log(`API Endpoints: ${passedEndpoints}/${endpointCount} passing\n`);
    
    // Issues
    if (this.results.issues.length > 0) {
      console.log('Issues Found:');
      this.results.issues.forEach((issue, index) => {
        console.log(`  ${index + 1}. [${issue.category}] ${issue.issue}`);
        if (issue.error) console.log(`     Error: ${issue.error}`);
        if (issue.details) console.log(`     Details: ${JSON.stringify(issue.details, null, 2)}`);
      });
      console.log('');
    }
    
    // Recommendations
    if (criticalIssues.length > 0) {
      console.log('RECOMMENDATION: DO NOT DEPLOY - Critical issues must be resolved');
    } else if (hasIssues) {
      console.log('RECOMMENDATION: Review warnings before deploying');
    } else {
      console.log('RECOMMENDATION: Ready for deployment');
    }
    
    console.log('\n========================================\n');
  }

  async cleanup() {
    if (this.serverProcess) {
      console.log('Stopping staging server...');
      this.serverProcess.kill();
    }
  }
}

// Run staging test
if (import.meta.url === `file://${process.argv[1]}`) {
  const test = new StagingTest();
  test.runFullTest()
    .then((results) => {
      const criticalIssues = results.issues.filter(i => 
        i.category === 'Build' || i.category === 'Database' || i.category === 'System'
      );
      process.exit(criticalIssues.length > 0 ? 1 : 0);
    })
    .catch((error) => {
      console.error('Staging test suite failed:', error);
      process.exit(1);
    });
}

export { StagingTest };