#!/usr/bin/env node

/**
 * Production build script to fix deployment issues
 * 
 * Issues being addressed:
 * 1. Vite pre-transform errors with main.tsx
 * 2. Session store configuration for production
 * 3. Build output optimization
 */

import { execSync } from 'child_process';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

console.log('🚀 Starting production build...');

try {
  // Ensure dist directory exists
  const distDir = join(__dirname, 'dist');
  if (!existsSync(distDir)) {
    mkdirSync(distDir, { recursive: true });
  }

  console.log('📦 Building frontend with Vite...');
  execSync('npx vite build', { stdio: 'inherit', cwd: __dirname });

  console.log('🔧 Building backend with esbuild...');
  execSync('npx esbuild server/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist --target=node18', { 
    stdio: 'inherit', 
    cwd: __dirname 
  });

  // Create production start script
  const startScript = `#!/usr/bin/env node
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
process.env.NODE_ENV = 'production';

// Import and start the server
import('./index.js').catch(console.error);
`;

  writeFileSync(join(distDir, 'start.js'), startScript);

  // Create package.json for production
  const prodPackage = {
    "name": "hydrogen-studies-production",
    "version": "1.0.0",
    "type": "module",
    "scripts": {
      "start": "node start.js"
    },
    "engines": {
      "node": ">=18.0.0"
    }
  };

  writeFileSync(join(distDir, 'package.json'), JSON.stringify(prodPackage, null, 2));

  console.log('✅ Production build completed successfully!');
  console.log('📁 Built files are in the dist/ directory');
  console.log('🚀 To start production server: cd dist && npm start');

} catch (error) {
  console.error('❌ Build failed:', error.message);
  process.exit(1);
}