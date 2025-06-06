#!/usr/bin/env node

import express from 'express';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const port = process.env.PORT || 5000;

// Set production environment
process.env.NODE_ENV = 'production';

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Serve static files from dist directory
const distPath = join(__dirname, 'dist');
if (existsSync(distPath)) {
  app.use(express.static(distPath));
  console.log(`✅ Serving static files from: ${distPath}`);
} else {
  console.error(`❌ Build directory not found: ${distPath}`);
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    buildExists: existsSync(distPath)
  });
});

// Basic API routes for deployment
app.get('/api/search/trending', (req, res) => {
  res.json({ trending: ["hydrogen water", "antioxidant", "inflammation", "brain health"] });
});

app.get('/api/tags/categories', (req, res) => {
  res.json({ categories: [] });
});

app.get('/api/search/enhanced', (req, res) => {
  res.json({ studies: [], total: 0 });
});

// SPA fallback - serve index.html for all non-API routes
app.get('*', (req, res) => {
  const indexPath = join(distPath, 'index.html');
  if (existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).json({ 
      error: 'Application not built. Run npm run build first.',
      path: indexPath,
      exists: existsSync(indexPath)
    });
  }
});

app.listen(port, '0.0.0.0', () => {
  console.log(`🚀 Production server running on port ${port}`);
  console.log(`📁 Static files: ${distPath}`);
  console.log(`🌐 Environment: ${process.env.NODE_ENV}`);
});