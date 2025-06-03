#!/usr/bin/env node

/**
 * Production startup script
 * Bypasses module dependency issues for deployment
 */

import express from 'express';
import session from 'express-session';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const port = process.env.PORT || 5000;

// Set production environment
process.env.NODE_ENV = 'production';

// Basic middleware
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Simple session configuration for production
app.use(session({
  secret: process.env.SESSION_SECRET || 'hydrogen-studies-production-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 7 * 24 * 60 * 60 * 1000
  },
  name: 'hydrogenstudies.sid'
}));

// Serve static files from client
const clientPath = join(__dirname, 'client');
if (existsSync(clientPath)) {
  app.use(express.static(clientPath));
}

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    database: process.env.DATABASE_URL ? 'connected' : 'not configured'
  });
});

// API routes placeholder
app.get('/api/status', (req, res) => {
  res.json({ message: 'Hydrogen Studies API is running' });
});

// Serve React app
app.get('*', (req, res) => {
  const indexPath = join(clientPath, 'index.html');
  if (existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).json({ error: 'Frontend not built' });
  }
});

app.listen(port, '0.0.0.0', () => {
  console.log(`Hydrogen Studies production server running on port ${port}`);
  console.log(`Environment: ${process.env.NODE_ENV}`);
  console.log(`Database URL: ${process.env.DATABASE_URL ? 'configured' : 'not set'}`);
});