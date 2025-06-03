#!/bin/bash

# Production deployment script for Hydrogen Studies
# Fixes deployment issues with Vite and session storage

set -e

echo "🚀 Starting production deployment..."

# Install production dependencies
echo "📦 Installing dependencies..."
npm ci --only=production

# Ensure client directory structure is correct
echo "🔍 Checking client structure..."
if [ ! -f "client/src/main.tsx" ]; then
    echo "❌ Error: client/src/main.tsx not found"
    echo "Current directory structure:"
    ls -la client/src/ || echo "client/src directory not found"
    exit 1
fi

# Build frontend
echo "🏗️ Building frontend..."
export NODE_ENV=production
npx vite build --mode production

# Build backend
echo "🔧 Building backend..."
npx esbuild server/index.ts \
    --platform=node \
    --packages=external \
    --bundle \
    --format=esm \
    --outdir=dist \
    --target=node18 \
    --sourcemap

# Copy static files
echo "📁 Copying static files..."
cp -r public dist/ 2>/dev/null || echo "No public directory to copy"

# Create production package.json
echo "📋 Creating production configuration..."
cat > dist/package.json << EOF
{
  "name": "hydrogen-studies-production",
  "version": "1.0.0",
  "type": "module",
  "main": "index.js",
  "scripts": {
    "start": "NODE_ENV=production node index.js"
  },
  "engines": {
    "node": ">=18.0.0"
  }
}
EOF

echo "✅ Production build complete!"
echo "📁 Built files are in the dist/ directory"
echo "🚀 To deploy: NODE_ENV=production node dist/index.js"