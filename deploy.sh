#!/bin/bash

# Simple deployment script that builds only the frontend
echo "Building frontend assets..."

# Build only the frontend (Vite build)
npx vite build --outDir=public

echo "Frontend build complete. Starting production server..."

# Start the server with tsx (no bundling needed)
NODE_ENV=production tsx server/index.ts