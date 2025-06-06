#!/usr/bin/env node

/**
 * Minimal Stable Server for Hydrogen Research Platform
 * Focuses on core functionality without heavy initialization
 */

import express from 'express';
import { createServer } from 'http';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const server = createServer(app);

// Basic middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve static files
app.use(express.static(join(__dirname, 'dist')));

// Basic API routes with minimal dependencies
app.get('/api/studies', async (req, res) => {
  try {
    const { db } = await import('./server/db.js');
    const { studies } = await import('./shared/schema.js');
    
    const result = await db.select().from(studies).limit(20);
    res.json(result);
  } catch (error) {
    console.error('Studies API error:', error);
    res.status(500).json({ error: 'Database connection failed' });
  }
});

app.get('/api/categories', async (req, res) => {
  try {
    const { db } = await import('./server/db.js');
    const { categories } = await import('./shared/schema.js');
    
    const result = await db.select().from(categories);
    res.json(result);
  } catch (error) {
    console.error('Categories API error:', error);
    res.status(500).json({ error: 'Database connection failed' });
  }
});

// Fallback to serve React app
app.get('*', (req, res) => {
  res.sendFile(join(__dirname, 'dist', 'index.html'));
});

// Port fallback mechanism
const startServer = (port) => {
  server.listen(port, '0.0.0.0', () => {
    console.log(`Minimal server running on port ${port}`);
  }).on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
      console.log(`Port ${port} in use, trying ${port + 1}`);
      startServer(port + 1);
    } else {
      console.error('Server error:', error);
      process.exit(1);
    }
  });
};

const PORT = parseInt(process.env.PORT) || 5000;
startServer(PORT);