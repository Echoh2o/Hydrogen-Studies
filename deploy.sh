#!/bin/bash

# Production deployment script for Hydrogen Studies

set -e

echo "Starting production deployment..."

# Install dependencies
echo "Installing dependencies..."
npm ci

# Ensure client directory structure is correct
echo "Checking client structure..."
if [ ! -f "client/src/main.tsx" ]; then
    echo "Error: client/src/main.tsx not found"
    ls -la client/src/ || echo "client/src directory not found"
    exit 1
fi

# Build frontend (outputs to dist/public via vite.config.ts)
echo "Building frontend..."
export NODE_ENV=production
npx vite build --mode production

# Build backend (outputs to dist/index.js)
echo "Building backend..."
npx esbuild server/index.ts \
    --platform=node \
    --packages=external \
    --bundle \
    --format=esm \
    --outdir=dist \
    --target=node18

# Copy static public assets (images, robots.txt, sitemaps, etc.)
echo "Copying static files..."
cp -r public/* dist/public/ 2>/dev/null || echo "No public directory to copy"

# Verify build output
if [ ! -f "dist/index.js" ]; then
    echo "Error: Backend build failed - dist/index.js not found"
    exit 1
fi

if [ ! -f "dist/public/index.html" ]; then
    echo "Error: Frontend build failed - dist/public/index.html not found"
    exit 1
fi

echo "Production build complete!"
echo "Built files are in the dist/ directory"
echo "To run: NODE_ENV=production node dist/index.js"