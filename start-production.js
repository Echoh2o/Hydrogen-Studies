#!/usr/bin/env node

/**
 * Production Server for Hydrogen Research Platform
 */

// Import the minimal stable server directly
import('./server/minimal-stable-server.js').then(async ({ createMinimalServer }) => {
  process.env.NODE_ENV = 'production';
  
  console.log('Starting production server...');
  
  try {
    const { app, server } = await createMinimalServer();
    
    // Handle graceful shutdown
    const shutdown = (signal) => {
      console.log(`Received ${signal}, shutting down...`);
      server.close(() => {
        console.log('Server closed');
        process.exit(0);
      });
    };
    
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
    
  } catch (error) {
    console.error('Production server failed:', error);
    
    // Fallback to tsx runner
    console.log('Falling back to tsx runner...');
    const { spawn } = await import('child_process');
    
    const server = spawn('npx', ['tsx', 'server/index.ts'], {
      env: { ...process.env, NODE_ENV: 'production' },
      stdio: 'inherit'
    });
    
    server.on('error', (err) => {
      console.error('Fallback server error:', err);
      process.exit(1);
    });
  }
}).catch(async (error) => {
  console.error('Failed to import server:', error);
  
  // Ultimate fallback
  console.log('Using tsx fallback...');
  const { spawn } = await import('child_process');
  
  const server = spawn('npx', ['tsx', 'server/index.ts'], {
    env: { ...process.env, NODE_ENV: 'production' },
    stdio: 'inherit'
  });
  
  server.on('error', (err) => {
    console.error('Final fallback error:', err);
    process.exit(1);
  });
});