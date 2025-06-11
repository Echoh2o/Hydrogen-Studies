#!/usr/bin/env node

/**
 * Production Deployment Script
 * Complete deployment solution with health checks and proper port binding
 */

import { spawn } from 'child_process';
import { existsSync } from 'fs';
import fetch from 'node-fetch';

const PORT = process.env.PORT || '5000';
const HOST = '0.0.0.0';

console.log('🚀 Initializing production deployment...');

// Validate environment
if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL is required for production');
  process.exit(1);
}

// Build if needed
if (!existsSync('./server/production-server.js')) {
  console.log('📦 Building production server...');
  try {
    const buildProcess = spawn('node', ['build-production-server.js'], {
      stdio: 'inherit'
    });
    
    await new Promise((resolve, reject) => {
      buildProcess.on('close', (code) => {
        if (code === 0) resolve();
        else reject(new Error(`Build failed with code ${code}`));
      });
    });
  } catch (error) {
    console.error('❌ Build failed:', error.message);
    process.exit(1);
  }
}

// Start production server
console.log(`🌐 Starting server on ${HOST}:${PORT}...`);

const server = spawn('node', ['start-production.js'], {
  stdio: 'inherit',
  env: {
    ...process.env,
    NODE_ENV: 'production',
    PORT: PORT
  }
});

server.on('error', (error) => {
  console.error('❌ Server startup error:', error);
  process.exit(1);
});

// Health check after startup
setTimeout(async () => {
  try {
    const response = await fetch(`http://localhost:${PORT}/health`);
    if (response.ok) {
      console.log('✅ Health check passed - deployment successful');
    } else {
      console.log('⚠️  Server started but health check failed');
    }
  } catch (error) {
    console.log('⚠️  Health check failed - server may still be starting');
  }
}, 3000);

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('Shutting down...');
  server.kill('SIGTERM');
});

process.on('SIGINT', () => {
  console.log('Shutting down...');
  server.kill('SIGINT');
});