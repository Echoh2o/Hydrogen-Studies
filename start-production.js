#!/usr/bin/env node

/**
 * Simple Production Server for Hydrogen Research Platform
 * Directly runs the server without complex build process
 */

// Set production environment
process.env.NODE_ENV = 'production';

console.log('Starting production server for Hydrogen Research Platform...');

try {
  // Use dynamic import to load and start the server
  const { spawn } = await import('child_process');
  
  console.log('Starting server with tsx...');
  
  const server = spawn('npx', ['tsx', 'server/index.ts'], {
    env: { 
      ...process.env, 
      NODE_ENV: 'production',
      PORT: process.env.PORT || '5000'
    },
    stdio: 'inherit',
    cwd: process.cwd()
  });
  
  server.on('error', (error) => {
    console.error('Server process error:', error);
    process.exit(1);
  });
  
  server.on('exit', (code) => {
    console.log(`Server process exited with code ${code}`);
    if (code !== 0) {
      process.exit(code);
    }
  });
  
  // Handle shutdown signals
  const shutdown = (signal) => {
    console.log(`Received ${signal}, shutting down gracefully...`);
    server.kill('SIGTERM');
    setTimeout(() => {
      console.log('Force killing server...');
      server.kill('SIGKILL');
      process.exit(1);
    }, 5000);
  };
  
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGUSR2', () => shutdown('SIGUSR2'));
  
  console.log('Production server startup initiated');
  
} catch (error) {
  console.error('Failed to start production server:', error);
  process.exit(1);
}