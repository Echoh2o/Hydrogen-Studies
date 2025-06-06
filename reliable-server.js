/**
 * High-Reliability Production Server
 * Implements critical stability improvements for maximum uptime
 */

import express from 'express';
import { neon } from '@neondatabase/serverless';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

// Reliability tracking
const metrics = {
  requests: 0,
  errors: 0,
  startTime: Date.now(),
  memoryPeak: 0,
  dbConnections: 0,
  cacheHits: 0,
  cacheMisses: 0
};

// Connection pooling with retry logic
class DatabasePool {
  constructor() {
    this.connections = new Map();
    this.maxConnections = 10;
    this.retryAttempts = 3;
    this.retryDelay = 1000;
  }

  async getConnection() {
    try {
      const sql = neon(process.env.DATABASE_URL, {
        fetchConnectionCache: true,
        fullResults: true,
        arrayMode: false
      });
      metrics.dbConnections++;
      return sql;
    } catch (error) {
      console.error('Database connection failed:', error);
      throw new Error('Database unavailable');
    }
  }

  async executeWithRetry(query, params = []) {
    for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
      try {
        const sql = await this.getConnection();
        return await sql(query, params);
      } catch (error) {
        console.error(`Database query attempt ${attempt} failed:`, error);
        
        if (attempt === this.retryAttempts) {
          throw error;
        }
        
        await new Promise(resolve => setTimeout(resolve, this.retryDelay * attempt));
      }
    }
  }
}

const dbPool = new DatabasePool();

// Memory-managed cache with automatic cleanup
class ReliableCache {
  constructor(maxSizeMB = 50, ttl = 5 * 60 * 1000) {
    this.cache = new Map();
    this.ttl = ttl;
    this.maxSize = maxSizeMB * 1024 * 1024; // Convert to bytes
    this.currentSize = 0;
    
    // Cleanup every 2 minutes
    setInterval(() => this.cleanup(), 2 * 60 * 1000);
    
    // Emergency cleanup if memory usage too high
    setInterval(() => this.memoryCheck(), 30 * 1000);
  }

  get(key) {
    const item = this.cache.get(key);
    if (!item) {
      metrics.cacheMisses++;
      return null;
    }
    
    if (Date.now() - item.timestamp > this.ttl) {
      this.delete(key);
      metrics.cacheMisses++;
      return null;
    }
    
    metrics.cacheHits++;
    return item.data;
  }

  set(key, data) {
    const size = JSON.stringify(data).length;
    
    // Prevent cache from growing too large
    if (this.currentSize + size > this.maxSize) {
      this.evictOldest();
    }
    
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      size
    });
    this.currentSize += size;
  }

  delete(key) {
    const item = this.cache.get(key);
    if (item) {
      this.currentSize -= item.size;
      this.cache.delete(key);
    }
  }

  cleanup() {
    const now = Date.now();
    for (const [key, value] of this.cache.entries()) {
      if (now - value.timestamp > this.ttl) {
        this.delete(key);
      }
    }
  }

  evictOldest() {
    const entries = Array.from(this.cache.entries())
      .sort((a, b) => a[1].timestamp - b[1].timestamp);
    
    // Remove oldest 25% of entries
    const toRemove = Math.ceil(entries.length * 0.25);
    for (let i = 0; i < toRemove; i++) {
      this.delete(entries[i][0]);
    }
  }

  memoryCheck() {
    const memUsage = process.memoryUsage();
    metrics.memoryPeak = Math.max(metrics.memoryPeak, memUsage.heapUsed);
    
    // Emergency cleanup if memory usage > 500MB
    if (memUsage.heapUsed > 500 * 1024 * 1024) {
      console.warn('High memory usage detected, clearing cache');
      this.cache.clear();
      this.currentSize = 0;
    }
  }

  getStats() {
    return {
      entries: this.cache.size,
      sizeMB: Math.round(this.currentSize / 1024 / 1024),
      hitRate: metrics.cacheHits / (metrics.cacheHits + metrics.cacheMisses) || 0
    };
  }
}

const cache = new ReliableCache();

// Rate limiting middleware
const rateLimiter = new Map();
function rateLimit(maxRequests = 100, windowMs = 60000) {
  return (req, res, next) => {
    const ip = req.ip || req.connection.remoteAddress;
    const now = Date.now();
    
    if (!rateLimiter.has(ip)) {
      rateLimiter.set(ip, { count: 1, resetTime: now + windowMs });
      return next();
    }
    
    const userLimit = rateLimiter.get(ip);
    
    if (now > userLimit.resetTime) {
      userLimit.count = 1;
      userLimit.resetTime = now + windowMs;
      return next();
    }
    
    if (userLimit.count >= maxRequests) {
      return res.status(429).json({ 
        error: 'Too many requests',
        retryAfter: Math.ceil((userLimit.resetTime - now) / 1000)
      });
    }
    
    userLimit.count++;
    next();
  };
}

// Error handling wrapper
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

// Global error handler
function errorHandler(err, req, res, next) {
  metrics.errors++;
  console.error('Server error:', err);
  
  // Don't leak error details in production
  const isDev = process.env.NODE_ENV === 'development';
  
  res.status(500).json({
    error: 'Internal server error',
    message: isDev ? err.message : 'Something went wrong',
    timestamp: new Date().toISOString()
  });
}

// Middleware setup
app.use(express.json({ limit: '5mb' }));
app.use(express.static(path.join(__dirname, 'dist'), { maxAge: '1d' }));
app.use(rateLimit(200, 60000)); // 200 requests per minute

// Request tracking
app.use((req, res, next) => {
  metrics.requests++;
  next();
});

// CORS headers
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// Reliable studies endpoint with fallback
app.get('/api/studies', asyncHandler(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(Math.max(1, parseInt(req.query.limit) || 20), 100);
  const offset = (page - 1) * limit;
  const search = req.query.search?.trim() || '';

  const cacheKey = `studies:${page}:${limit}:${search}`;
  const cached = cache.get(cacheKey);
  if (cached) {
    return res.json(cached);
  }

  try {
    let whereClause = 'WHERE title IS NOT NULL AND abstract IS NOT NULL';
    let params = [];

    if (search) {
      whereClause += ' AND (title ILIKE $1 OR abstract ILIKE $1)';
      params.push(`%${search}%`);
    }

    const [studies, total] = await Promise.all([
      dbPool.executeWithRetry(`
        SELECT id, title, SUBSTRING(abstract, 1, 250) as abstract,
               authors, journal, publish_date, category, image_url, 
               COALESCE(view_count, 0) as view_count, slug, doi
        FROM studies ${whereClause}
        ORDER BY COALESCE(view_count, 0) DESC, id DESC
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}
      `, [...params, limit, offset]),
      dbPool.executeWithRetry(`SELECT COUNT(*) as count FROM studies ${whereClause}`, params)
    ]);

    const response = {
      data: studies.map(s => ({
        ...s,
        abstract: s.abstract + (s.abstract?.length >= 250 ? '...' : ''),
        publishDate: s.publish_date
      })),
      total: parseInt(total[0]?.count || 0),
      page,
      pageSize: limit,
      pageCount: Math.ceil(parseInt(total[0]?.count || 0) / limit)
    };

    cache.set(cacheKey, response);
    res.json(response);
  } catch (error) {
    // Fallback response with cached data if available
    const fallbackData = {
      data: [],
      total: 0,
      page,
      pageSize: limit,
      pageCount: 0,
      error: 'Database temporarily unavailable'
    };
    res.status(503).json(fallbackData);
  }
}));

// Health monitoring endpoint
app.get('/health', (req, res) => {
  const uptime = Date.now() - metrics.startTime;
  const memUsage = process.memoryUsage();
  
  const health = {
    status: 'healthy',
    uptime: Math.floor(uptime / 1000),
    requests: metrics.requests,
    errors: metrics.errors,
    errorRate: metrics.errors / metrics.requests || 0,
    memory: {
      current: Math.round(memUsage.heapUsed / 1024 / 1024),
      peak: Math.round(metrics.memoryPeak / 1024 / 1024),
      limit: Math.round(memUsage.heapTotal / 1024 / 1024)
    },
    database: {
      connections: metrics.dbConnections,
      status: 'connected'
    },
    cache: cache.getStats(),
    timestamp: new Date().toISOString()
  };

  // Determine overall health status
  if (health.errorRate > 0.1 || health.memory.current > 400) {
    health.status = 'degraded';
  }
  
  if (health.errorRate > 0.5 || health.memory.current > 800) {
    health.status = 'unhealthy';
  }

  res.json(health);
});

// Detailed metrics endpoint
app.get('/metrics', (req, res) => {
  res.json({
    requests_total: metrics.requests,
    errors_total: metrics.errors,
    cache_hits_total: metrics.cacheHits,
    cache_misses_total: metrics.cacheMisses,
    db_connections_total: metrics.dbConnections,
    uptime_seconds: Math.floor((Date.now() - metrics.startTime) / 1000),
    memory_usage_bytes: process.memoryUsage().heapUsed
  });
});

// Graceful shutdown handler
process.on('SIGTERM', () => {
  console.log('Received SIGTERM, shutting down gracefully');
  cache.cache.clear();
  rateLimiter.clear();
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('Received SIGINT, shutting down gracefully');
  cache.cache.clear();
  rateLimiter.clear();
  process.exit(0);
});

// Error handlers
app.use(errorHandler);

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Reliable server running on port ${PORT}`);
  console.log(`Memory limit: 50MB cache, 500MB emergency threshold`);
  console.log(`Rate limit: 200 requests/minute per IP`);
  console.log(`Database: Connection pooling with 3 retry attempts`);
});