#!/usr/bin/env node

/**
 * Production Server Starter
 * This file starts the production server after the build process
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Check if the built server exists
const distPath = join(__dirname, 'dist', 'index.js');

if (!existsSync(distPath)) {
  console.error('❌ Production build not found!');
  console.error('Please run "npm run build" first.');
  process.exit(1);
}

// Set production environment
process.env.NODE_ENV = 'production';

console.log('🚀 Starting production server...');
console.log(`📁 Server path: ${distPath}`);
console.log(`🌍 Environment: ${process.env.NODE_ENV}`);
console.log(`🔑 Database: ${process.env.DATABASE_URL ? 'Connected' : 'Not configured'}`);

// Start the production server
const server = spawn('node', [distPath], {
  stdio: 'inherit',
  env: {
    ...process.env,
    NODE_ENV: 'production'
  }
});

// Handle process termination
server.on('error', (error) => {
  console.error('❌ Failed to start server:', error);
  process.exit(1);
});

server.on('exit', (code) => {
  if (code !== 0) {
    console.error(`❌ Server exited with code ${code}`);
    process.exit(code);
  }
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down gracefully...');
  server.kill('SIGTERM');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Received termination signal...');
  server.kill('SIGTERM');
  process.exit(0);
});