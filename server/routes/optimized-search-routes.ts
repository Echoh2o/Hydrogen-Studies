/**
 * Optimized Search Routes - High-performance search endpoints
 */

import { Router } from 'express';
import { 
  optimizedSearchEndpoint, 
  optimizedCategoryCounts, 
  getTrendingSearches,
  getStudyOptimized,
  getPerformanceStats
} from '../route-optimization';

const router = Router();

// High-speed search with intelligent caching
router.get('/enhanced', async (req, res) => {
  try {
    const query = req.query.q as string || '';
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = Math.min(parseInt(req.query.pageSize as string) || 20, 100);
    
    const filters = {
      condition: req.query.condition as string,
      year: req.query.year as string,
      journal: req.query.journal as string
    };

    const result = await optimizedSearchEndpoint(query, filters, page, pageSize);
    res.json(result);
  } catch (error) {
    console.error('Enhanced search error:', error);
    res.status(500).json({ error: 'Search temporarily unavailable' });
  }
});

// Lightning-fast trending searches
router.get('/trending', async (req, res) => {
  try {
    const trending = await getTrendingSearches();
    res.json(trending);
  } catch (error) {
    console.error('Trending searches error:', error);
    res.status(500).json({ error: 'Unable to load trending searches' });
  }
});

// Optimized study retrieval
router.get('/study/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid study ID' });
    }

    const study = await getStudyOptimized(id);
    if (!study) {
      return res.status(404).json({ error: 'Study not found' });
    }

    res.json(study);
  } catch (error) {
    console.error('Study retrieval error:', error);
    res.status(500).json({ error: 'Unable to load study' });
  }
});

// Performance monitoring
router.get('/performance', async (req, res) => {
  try {
    const stats = getPerformanceStats();
    res.json(stats);
  } catch (error) {
    console.error('Performance stats error:', error);
    res.status(500).json({ error: 'Unable to load performance stats' });
  }
});

export default router;