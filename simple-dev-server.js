
#!/usr/bin/env node

import express from 'express';
import { createServer } from 'vite';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const port = process.env.PORT || 5000;

// Basic middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Basic API routes for testing
app.get('/api/status', (req, res) => {
  res.json({ 
    message: 'Simple dev server running',
    timestamp: new Date().toISOString()
  });
});

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', mode: 'simple-dev' });
});

try {
  // Set up Vite dev server
  const vite = await createServer({
    server: { middlewareMode: true },
    appType: 'spa',
    root: join(__dirname, 'client')
  });
  
  app.use(vite.ssrFixStacktrace);
  app.use(vite.middlewares);
  
  console.log('✅ Vite dev server configured');
} catch (error) {
  console.error('❌ Failed to setup Vite:', error.message);
  
  // Fallback: serve static files if available
  const distPath = join(__dirname, 'dist');
  if (existsSync(distPath)) {
    app.use(express.static(distPath));
    console.log('📁 Serving static files as fallback');
  }
}

app.listen(port, '0.0.0.0', () => {
  console.log(`🚀 Simple dev server running on port ${port}`);
});
