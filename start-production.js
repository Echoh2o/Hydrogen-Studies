#!/usr/bin/env node

/**
 * Production Server Startup - ES Module Compatible
 */

import { createProductionServer } from './server/production-server.js';
import { existsSync } from 'fs';
import { execSync } from 'child_process';

console.log('🚀 Starting production server...');

// Ensure production server is compiled
if (!existsSync('./server/production-server.js')) {
  console.log('📦 Compiling production server...');
  try {
    execSync('node build-production-server.js', { stdio: 'inherit' });
  } catch (error) {
    console.error('❌ Failed to compile production server:', error.message);
    process.exit(1);
  }
}

// Set production environment
process.env.NODE_ENV = 'production';
process.env.PORT = process.env.PORT || '3000';

console.log(`🌐 Server will run on port ${process.env.PORT}`);

createProductionServer()
  .then(({ app, server }) => {
    console.log('✅ Production server started successfully');
    console.log(`🔗 Server running at http://0.0.0.0:${process.env.PORT}`);
  })
  .catch((error) => {
    console.error('❌ Production server failed to start:', error);
    process.exit(1);
  });