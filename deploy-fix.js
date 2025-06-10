#!/usr/bin/env node

/**
 * Deployment Fix - Ensures proper server startup for Replit deployment
 */

import { spawn } from 'child_process';
import fs from 'fs';

console.log('🚀 Starting production deployment...');

// Ensure database connection
if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL is required');
  process.exit(1);
}

// Use the deployment server
const serverPath = 'server/deployment-server.js';

if (!fs.existsSync(serverPath)) {
  console.error(`❌ Server file not found: ${serverPath}`);
  process.exit(1);
}

console.log(`✓ Starting server: ${serverPath}`);

const server = spawn('node', [serverPath], {
  stdio: 'inherit',
  env: {
    ...process.env,
    NODE_ENV: 'production',
    PORT: process.env.PORT || '5000'
  }
});

server.on('error', (error) => {
  console.error('❌ Server startup error:', error);
  process.exit(1);
});

server.on('close', (code) => {
  console.log(`Server exited with code ${code}`);
  process.exit(code);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('Received SIGTERM, shutting down...');
  server.kill('SIGTERM');
});

process.on('SIGINT', () => {
  console.log('Received SIGINT, shutting down...');
  server.kill('SIGINT');
});