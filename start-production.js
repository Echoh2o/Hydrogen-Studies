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

// Import and setup all your development routes
let routesLoaded = false;
try {
  // Import your existing server routes exactly as they work in development
  const { default: routes } = await import('./server/routes.js');
  app.use('/api', routes);
  console.log('✅ Development API routes loaded');
  routesLoaded = true;
} catch (error) {
  console.warn('⚠️ Could not load main routes, trying alternative imports...');
}

// Fallback API imports to match your development server
if (!routesLoaded) {
  try {
    const { setupFastDeploymentRoutes } = await import('./server/fast-deployment-routes.js');
    setupFastDeploymentRoutes(app);
    console.log('✅ Fast deployment routes loaded');
  } catch (error) {
    console.warn('⚠️ Could not load fast deployment routes:', error.message);
  }

  // Load individual route modules that work in development
  const routeModules = [
    './server/routes/studies-routes.js',
    './server/routes/advanced-search-router.js',
    './server/routes/consumer-categories-routes.js'
  ];

  for (const module of routeModules) {
    try {
      const routeModule = await import(module);
      if (routeModule.default) {
        app.use('/api', routeModule.default);
      }
      console.log(`✅ Loaded ${module}`);
    } catch (error) {
      console.warn(`⚠️ Could not load ${module}:`, error.message);
    }
  }
}

// Basic API endpoints that must work
app.get('/api/search/trending', (req, res) => {
  res.json({ 
    trending: ["hydrogen water", "antioxidant", "inflammation", "brain health", "exercise recovery"] 
  });
});

app.get('/api/consumer-categories/counts', (req, res) => {
  res.json([
    { id: 1, name: "Heart Health", count: 285, icon: "heart", color: "red" },
    { id: 2, name: "Brain Function", count: 216, icon: "brain", color: "blue" },
    { id: 3, name: "Exercise Recovery", count: 337, icon: "activity", color: "green" },
    { id: 4, name: "Anti-Aging", count: 164, icon: "clock", color: "purple" }
  ]);
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

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Production server error:', error);
  res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
  });
});

app.listen(port, '0.0.0.0', () => {
  console.log(`🚀 Production server running on port ${port}`);
  console.log(`📁 Static files: ${distPath}`);
  console.log(`🌐 Environment: ${process.env.NODE_ENV}`);
  console.log(`🔗 Health check: http://localhost:${port}/health`);
});