#!/usr/bin/env node

/**
 * Production Server Launcher for Hydrogen Research Platform
 */

process.env.NODE_ENV = 'production';

console.log('Starting Hydrogen Research Platform in production mode...');

// Use tsx to run the production server
import { spawn } from 'child_process';

const server = spawn('node', ['server/deployment-server.js'], {
  env: {
    ...process.env,
    NODE_ENV: 'production',
    PORT: process.env.PORT || '5000'
  },
  stdio: 'inherit',
  cwd: process.cwd()
});

server.on('error', (error) => {
  console.error('Production server error:', error);
  process.exit(1);
});

server.on('exit', (code) => {
  console.log(`Production server exited with code ${code}`);
  if (code !== 0) {
    process.exit(code);
  }
});

// Graceful shutdown handling
const shutdown = (signal) => {
  console.log(`Received ${signal}, shutting down production server...`);
  server.kill('SIGTERM');
  
  setTimeout(() => {
    console.log('Force terminating...');
    server.kill('SIGKILL');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGUSR2', () => shutdown('SIGUSR2'));