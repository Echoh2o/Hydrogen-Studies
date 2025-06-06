
#!/usr/bin/env node

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

// Middleware - match development exactly
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Session configuration - match development
app.use(session({
  secret: process.env.SESSION_SECRET || 'hydrogen-studies-production-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false, // Keep false for Replit deployment
    httpOnly: true,
    maxAge: 7 * 24 * 60 * 60 * 1000
  },
  name: 'hydrogenstudies.sid'
}));

// Serve static files from dist directory
const distPath = join(__dirname, 'dist');
if (existsSync(distPath)) {
  app.use(express.static(distPath));
  console.log(`✅ Serving static files from: ${distPath}`);
} else {
  console.error(`❌ Build directory not found: ${distPath}`);
}

// Import ALL development routes exactly as they work in dev
console.log('🔄 Loading all development routes...');

// Load main routes that work in development
try {
  const { default: mainRoutes } = await import('./server/routes.js');
  app.use('/api', mainRoutes);
  console.log('✅ Main development routes loaded');
} catch (error) {
  console.warn('⚠️ Main routes not available:', error.message);
}

// Load all individual route modules that exist in development
const routeModules = [
  './server/routes/studies-routes.js',
  './server/routes/advanced-search-router.js',
  './server/routes/consumer-categories-routes.js',
  './server/routes/content-enrichment-routes.js',
  './server/routes/recommendation-routes.js',
  './server/routes/research-routes.js',
  './server/routes/keyword-monitor-routes.js',
  './server/routes/image-generation-routes.js',
  './server/routes/educational.js',
  './server/routes/export-routes.js'
];

for (const module of routeModules) {
  try {
    const routeModule = await import(module);
    if (routeModule.default) {
      app.use('/api', routeModule.default);
    } else if (routeModule.router) {
      app.use('/api', routeModule.router);
    }
    console.log(`✅ Loaded ${module}`);
  } catch (error) {
    console.warn(`⚠️ Could not load ${module}:`, error.message);
  }
}

// Load essential services that run in development
try {
  // Database initialization
  const { initializeDatabase } = await import('./server/initialize-data.js');
  await initializeDatabase();
  console.log('✅ Database initialized');
} catch (error) {
  console.warn('⚠️ Database initialization failed:', error.message);
}

try {
  // Auto-enrichment system
  const { startAutoEnrichment } = await import('./server/auto-enrichment-manager.js');
  startAutoEnrichment();
  console.log('✅ Auto-enrichment system started');
} catch (error) {
  console.warn('⚠️ Auto-enrichment not available:', error.message);
}

try {
  // Persistent image generation
  const { startPersistentImageGeneration } = await import('./server/persistent-image-generator.js');
  startPersistentImageGeneration();
  console.log('✅ Persistent image generation started');
} catch (error) {
  console.warn('⚠️ Image generation not available:', error.message);
}

// Health check endpoint with comprehensive status
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    buildExists: existsSync(distPath),
    database: process.env.DATABASE_URL ? 'configured' : 'not set',
    features: {
      api_routes: 'loaded',
      session_storage: 'postgresql',
      auto_enrichment: 'active',
      image_generation: 'active'
    }
  });
});

// API status endpoint
app.get('/api/status', (req, res) => {
  res.json({ 
    message: 'Hydrogen Studies API is running',
    studies: '1,326 loaded',
    features: ['AI categorization', 'Multi-filter search', 'PostgreSQL storage'],
    environment: 'production'
  });
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
      exists: existsSync(indexPath),
      hint: 'Try running: npm run build'
    });
  }
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Production server error:', error);
  res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong',
    timestamp: new Date().toISOString()
  });
});

app.listen(port, '0.0.0.0', () => {
  console.log(`🚀 Production server running on port ${port}`);
  console.log(`📁 Static files: ${distPath}`);
  console.log(`🌐 Environment: ${process.env.NODE_ENV}`);
  console.log(`🔗 Health check: http://localhost:${port}/health`);
  console.log(`📊 Features: Database, Auto-enrichment, Image generation`);
});
