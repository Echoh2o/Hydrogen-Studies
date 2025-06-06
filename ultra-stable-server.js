#!/usr/bin/env node

/**
 * Ultra-Stable Server for Hydrogen Research Platform
 * Minimal startup with zero heavy operations
 */

import express from 'express';
import { createServer } from 'http';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import compression from 'compression';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const server = createServer(app);

// Ultra-lightweight middleware only
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request timeout and error boundaries
app.use((req, res, next) => {
  req.setTimeout(30000); // 30 second timeout
  res.setTimeout(30000);
  next();
});

// Health check - immediate response
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage()
  });
});

// Database connection with retry logic
let dbConnection = null;
async function getDatabase() {
  if (!dbConnection) {
    try {
      const { db } = await import('./server/db.js');
      dbConnection = db;
    } catch (error) {
      console.error('Database connection failed:', error.message);
      throw new Error('Database unavailable');
    }
  }
  return dbConnection;
}

// Ultra-fast API routes with minimal queries
app.get('/api/studies', async (req, res) => {
  try {
    const db = await getDatabase();
    const { studies } = await import('./shared/schema.js');
    
    const limit = Math.min(parseInt(req.query.limit) || 20, 50);
    const offset = parseInt(req.query.offset) || 0;
    
    const result = await db.select({
      id: studies.id,
      title: studies.title,
      authors: studies.authors,
      journal: studies.journal,
      year: studies.year,
      study_type: studies.study_type
    }).from(studies).limit(limit).offset(offset);
    
    res.json(result);
  } catch (error) {
    console.error('Studies API error:', error.message);
    res.status(500).json({ error: 'Service temporarily unavailable' });
  }
});

app.get('/api/categories', async (req, res) => {
  try {
    const db = await getDatabase();
    const { categories } = await import('./shared/schema.js');
    
    const result = await db.select().from(categories).limit(20);
    res.json(result);
  } catch (error) {
    console.error('Categories API error:', error.message);
    res.status(500).json({ error: 'Service temporarily unavailable' });
  }
});

app.get('/api/studies/:id', async (req, res) => {
  try {
    const db = await getDatabase();
    const { studies } = await import('./shared/schema.js');
    const { eq } = await import('drizzle-orm');
    
    const result = await db.select().from(studies).where(eq(studies.id, parseInt(req.params.id)));
    
    if (result.length === 0) {
      return res.status(404).json({ error: 'Study not found' });
    }
    
    res.json(result[0]);
  } catch (error) {
    console.error('Study details API error:', error.message);
    res.status(500).json({ error: 'Service temporarily unavailable' });
  }
});

// Static file serving
app.use(express.static(join(__dirname, 'client', 'dist'), {
  maxAge: '1d',
  etag: true
}));

// Fallback to serve React app
app.get('*', (req, res) => {
  try {
    res.sendFile(join(__dirname, 'client', 'dist', 'index.html'));
  } catch (error) {
    res.status(500).send('Application loading error');
  }
});

// Global error handler
app.use((error, req, res, next) => {
  console.error('Global error:', error.message);
  res.status(500).json({ error: 'Internal server error' });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('Received SIGTERM, shutting down gracefully');
  server.close(() => {
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('Received SIGINT, shutting down gracefully');
  server.close(() => {
    process.exit(0);
  });
});

// Ultra-stable startup with multiple fallback ports
const startServer = async (port) => {
  return new Promise((resolve, reject) => {
    const serverInstance = server.listen(port, '0.0.0.0', () => {
      console.log(`Ultra-stable server running on port ${port}`);
      console.log(`Memory usage: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`);
      resolve(port);
    });

    serverInstance.on('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        console.log(`Port ${port} in use, trying ${port + 1}`);
        startServer(port + 1).then(resolve).catch(reject);
      } else {
        console.error('Server startup error:', error.message);
        reject(error);
      }
    });
  });
};

// Start server with automatic port discovery
const PORT = parseInt(process.env.PORT) || 5000;
startServer(PORT)
  .then(port => {
    console.log(`Server successfully started on port ${port}`);
    
    // Minimal background initialization after 10 seconds
    setTimeout(() => {
      console.log('Background services can be manually triggered if needed');
    }, 10000);
  })
  .catch(error => {
    console.error('Failed to start server:', error.message);
    process.exit(1);
  });