import { createProductionServer } from './production-server.js';

async function main() {
  try {
    console.log('Starting Hydrogen Research Platform...');
    await createProductionServer();
  } catch (error) {
    console.error('Server startup failed:', error);
    process.exit(1);
  }
}

main();
import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import path from 'path';
import { 
  optimizedSearch, 
  optimizedCategoryCounts, 
  optimizedStudyById,
  getPerformanceMetrics,
  healthCheck,
  initializeProductionPerformance,
  performanceTracker
} from './production-performance-core';
async function startServer() {
  const app = express();

  app.use(cors({
    origin: true,
    credentials: true
  }));

  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // Performance monitoring middleware
  app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
      const duration = Date.now() - start;
      performanceTracker.track(req.path, duration);
    });
    next();
  });
// Performance monitoring routes
  app.get('/api/performance', (req, res) => {
    try {
      const metrics = getPerformanceMetrics();
      res.json(metrics);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch performance metrics' });
    }
  });

  app.get('/health', async (req, res) => {
    try {
      const health = await healthCheck();
      res.json(health);
    } catch (error) {
      res.status(500).json({ 
        status: 'unhealthy', 
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Initialize performance system
  await initializeProductionPerformance();

  const PORT = process.env.PORT || 5000;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`📊 Performance monitoring enabled`);
    console.log(`🏥 Health check: http://localhost:${PORT}/health`);
    console.log(`📈 Performance metrics: http://localhost:${PORT}/api/performance`);
  });
}