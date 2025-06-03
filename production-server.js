#!/usr/bin/env node

/**
 * Production server configuration
 * Fixes deployment issues with session storage and build configuration
 */

import express from 'express';
import session from 'express-session';
import connectPg from 'connect-pg-simple';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Production environment configuration
process.env.NODE_ENV = 'production';

const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Production session configuration (fixes MemoryStore warning)
if (process.env.DATABASE_URL) {
  const pgStore = connectPg(session);
  
  app.use(session({
    store: new pgStore({
      conString: process.env.DATABASE_URL,
      createTableIfMissing: true,
      ttl: 7 * 24 * 60 * 60, // 7 days
      tableName: 'sessions'
    }),
    secret: process.env.SESSION_SECRET || 'hydrogen-studies-production-secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    },
    name: 'hydrogenstudies.sid'
  }));
} else {
  console.warn('DATABASE_URL not found, using memory store (not recommended for production)');
  app.use(session({
    secret: process.env.SESSION_SECRET || 'fallback-secret',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 24 * 60 * 60 * 1000 }
  }));
}

// Serve static files
const distPath = join(__dirname, 'dist');
if (existsSync(distPath)) {
  app.use(express.static(distPath));
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV 
  });
});

// Fallback for SPA routing
app.get('*', (req, res) => {
  const indexPath = join(distPath, 'index.html');
  if (existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).json({ error: 'Application not built. Run npm run build first.' });
  }
});

app.listen(port, '0.0.0.0', () => {
  console.log(`Production server running on port ${port}`);
  console.log(`Environment: ${process.env.NODE_ENV}`);
  console.log(`Database: ${process.env.DATABASE_URL ? 'Connected' : 'Not configured'}`);
});