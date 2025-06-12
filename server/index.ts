// Development server entry point
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
import studyMetadataRoutes from './routes/study-metadata-routes';
import performanceRoutes from './routes/performance-routes';
import comprehensiveImageRoutes from './routes/comprehensive-image-routes';
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
  app.use('/api/performance', performanceRoutes);
  app.use('/api/comprehensive-images', comprehensiveImageRoutes);

  const PORT = parseInt(process.env.PORT || '5000');
  
  return new Promise((resolve, reject) => {
    const server = app.listen(PORT, '0.0.0.0', () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`Health check: http://localhost:${PORT}/health`);
      resolve(server);
    });
    
    server.on('error', (error: any) => {
      if (error.code === 'EADDRINUSE') {
        console.log(`Port ${PORT} in use, trying ${PORT + 1}...`);
        const nextPort = PORT + 1;
        const fallbackServer = app.listen(nextPort, '0.0.0.0', () => {
          console.log(`Server running on port ${nextPort}`);
          resolve(fallbackServer);
        });
        fallbackServer.on('error', reject);
      } else {
        reject(error);
      }
    });
  });
}

// Start the server
startServer().catch(console.error);