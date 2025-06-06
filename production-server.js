#!/usr/bin/env node

/**
 * Production Server for Hydrogen Research Platform
 * Zero-initialization startup for maximum stability
 */

import express from 'express';
import { createServer } from 'http';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const server = createServer(app);

// Minimal middleware
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));

// Request logging for debugging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
  next();
});

// Immediate health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Database lazy loading
let dbInstance = null;
async function getDB() {
  if (!dbInstance) {
    try {
      const { db } = await import('./server/db.js');
      dbInstance = db;
      console.log('Database connection established');
    } catch (error) {
      console.error('Database connection failed:', error.message);
      throw error;
    }
  }
  return dbInstance;
}

// Core API endpoints
app.get('/api/studies', async (req, res) => {
  try {
    const db = await getDB();
    const { studies } = await import('./shared/schema.js');
    
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const result = await db.select().from(studies).limit(limit);
    
    res.json(result);
  } catch (error) {
    console.error('Studies API error:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

app.get('/api/categories', async (req, res) => {
  try {
    const db = await getDB();
    const { categories } = await import('./shared/schema.js');
    
    const result = await db.select().from(categories);
    res.json(result);
  } catch (error) {
    console.error('Categories API error:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

app.get('/api/studies/:id', async (req, res) => {
  try {
    const db = await getDB();
    const { studies } = await import('./shared/schema.js');
    const { eq } = await import('drizzle-orm');
    
    const result = await db.select().from(studies).where(eq(studies.id, parseInt(req.params.id)));
    
    if (result.length === 0) {
      return res.status(404).json({ error: 'Study not found' });
    }
    
    res.json(result[0]);
  } catch (error) {
    console.error('Study details error:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// Serve client files
const clientPath = join(__dirname, 'client', 'dist');
app.use(express.static(clientPath));

// React app fallback
app.get('*', (req, res) => {
  res.sendFile(join(clientPath, 'index.html'), (err) => {
    if (err) {
      res.status(500).send('Application error');
    }
  });
});

// Error handling
app.use((error, req, res, next) => {
  console.error('Server error:', error);
  res.status(500).json({ error: 'Internal server error' });
});

// Production startup
const startProduction = async () => {
  const PORT = parseInt(process.env.PORT) || 5000;
  
  return new Promise((resolve, reject) => {
    const attempt = (port) => {
      server.listen(port, '0.0.0.0', () => {
        console.log(`Production server running on port ${port}`);
        console.log(`Environment: ${process.env.NODE_ENV || 'production'}`);
        resolve(port);
      }).on('error', (error) => {
        if (error.code === 'EADDRINUSE') {
          console.log(`Port ${port} busy, trying ${port + 1}`);
          attempt(port + 1);
        } else {
          reject(error);
        }
      });
    };
    
    attempt(PORT);
  });
};

// Graceful shutdown
const shutdown = () => {
  console.log('Shutting down server...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// Start server
startProduction()
  .then(port => {
    console.log(`Server ready on port ${port}`);
  })
  .catch(error => {
    console.error('Startup failed:', error);
    process.exit(1);
  });