#!/usr/bin/env node

/**
 * Production Server Startup - ES Module Compatible
 */

import { createProductionServer } from './server/production-server.js';

console.log('🚀 Starting production server...');

createProductionServer()
  .then(() => {
    console.log('✅ Production server started successfully');
  })
  .catch((error) => {
    console.error('❌ Production server failed to start:', error);
    process.exit(1);
  });