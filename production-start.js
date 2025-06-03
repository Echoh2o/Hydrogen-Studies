#!/usr/bin/env node

// Production server starter that handles the deployment correctly
import { execSync } from 'child_process';

console.log('Starting Hydrogen Research Platform for production deployment...');

// Set production environment
process.env.NODE_ENV = 'production';
process.env.PORT = process.env.PORT || '5000';

try {
  // Create minimal build directory structure if it doesn't exist
  execSync('mkdir -p dist public', { stdio: 'inherit' });
  
  // Copy essential files for production
  execSync('cp client/index.html public/index.html', { stdio: 'inherit' });
  
  console.log('Production setup complete. Starting server...');
  
  // Start the server directly with tsx
  execSync('tsx server/index.ts', { 
    stdio: 'inherit',
    env: process.env 
  });
  
} catch (error) {
  console.error('Production startup error:', error.message);
  
  // Fallback: try to start without any build steps
  console.log('Attempting fallback startup...');
  execSync('tsx server/index.ts', { 
    stdio: 'inherit',
    env: process.env 
  });
}