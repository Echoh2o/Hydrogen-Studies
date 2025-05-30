/**
 * Optimized API Routes with Memory Caching and Performance Enhancements
 */

import { Router } from 'express';
import { 
  getStudyOptimized, 
  searchStudiesOptimized, 
  getCategoryStatsOptimized, 
  getDatabaseStatsOptimized,
  getRelatedStudiesOptimized,
  invalidateCache,
  getCacheMetrics
} from '../memory-cache-optimizer';

const router = Router();

/**
 * Optimized single study endpoint with caching
 */
router.get('/studies/:id', async (req, res) => {
  try {
    const studyId = parseInt(req.params.id);
    
    if (isNaN(studyId)) {
      return res.status(400).json({ error: 'Invalid study ID' });
    }

    const study = await getStudyOptimized(studyId);
    
    if (!study) {
      return res.status(404).json({ error: 'Study not found' });
    }

    // Add response headers for caching
    res.set('Cache-Control', 'public, max-age=300'); // 5 minutes
    res.set('ETag', `"study-${studyId}-${Date.now()}"`);
    
    res.json({
      success: true,
      data: study
    });
    
  } catch (error) {
    console.error('Error fetching study:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Optimized search endpoint with cursor-based pagination
 */
router.get('/search/studies', async (req, res) => {
  try {
    const {
      q: query,
      category,
      startYear,
      endYear,
      hasCitations,
      limit = 20,
      cursor
    } = req.query;

    const searchParams = {
      query: query as string,
      category: category as string,
      startYear: startYear ? parseInt(startYear as string) : undefined,
      endYear: endYear ? parseInt(endYear as string) : undefined,
      hasCitations: hasCitations === 'true',
      limit: Math.min(parseInt(limit as string) || 20, 100), // Max 100 per request
      cursor: cursor ? parseInt(cursor as string) : 0
    };

    const results = await searchStudiesOptimized(searchParams);
    
    // Add pagination metadata
    const response = {
      success: true,
      data: results.studies,
      pagination: {
        hasMore: results.hasMore,
        nextCursor: results.nextCursor,
        limit: searchParams.limit
      },
      meta: {
        total: results.total,
        query: searchParams
      }
    };

    // Cache headers for search results
    res.set('Cache-Control', 'public, max-age=180'); // 3 minutes for search
    res.json(response);
    
  } catch (error) {
    console.error('Error in search:', error);
    res.status(500).json({ error: 'Search failed' });
  }
});

/**
 * Optimized category statistics endpoint
 */
router.get('/categories/stats', async (req, res) => {
  try {
    const stats = await getCategoryStatsOptimized();
    
    res.set('Cache-Control', 'public, max-age=1800'); // 30 minutes
    res.json({
      success: true,
      data: stats
    });
    
  } catch (error) {
    console.error('Error fetching category stats:', error);
    res.status(500).json({ error: 'Failed to fetch category statistics' });
  }
});

/**
 * Optimized database overview endpoint
 */
router.get('/stats/overview', async (req, res) => {
  try {
    const stats = await getDatabaseStatsOptimized();
    
    res.set('Cache-Control', 'public, max-age=900'); // 15 minutes
    res.json({
      success: true,
      data: stats
    });
    
  } catch (error) {
    console.error('Error fetching database stats:', error);
    res.status(500).json({ error: 'Failed to fetch database statistics' });
  }
});

/**
 * Optimized related studies endpoint
 */
router.get('/studies/:id/related', async (req, res) => {
  try {
    const studyId = parseInt(req.params.id);
    const limit = Math.min(parseInt(req.query.limit as string) || 5, 20);
    
    if (isNaN(studyId)) {
      return res.status(400).json({ error: 'Invalid study ID' });
    }

    const relatedStudies = await getRelatedStudiesOptimized(studyId, limit);
    
    res.set('Cache-Control', 'public, max-age=600'); // 10 minutes
    res.json({
      success: true,
      data: relatedStudies,
      meta: {
        studyId,
        limit,
        count: relatedStudies.length
      }
    });
    
  } catch (error) {
    console.error('Error fetching related studies:', error);
    res.status(500).json({ error: 'Failed to fetch related studies' });
  }
});

/**
 * Batch studies endpoint for efficient multiple study retrieval
 */
router.post('/studies/batch', async (req, res) => {
  try {
    const { ids } = req.body;
    
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'Invalid study IDs array' });
    }

    if (ids.length > 50) {
      return res.status(400).json({ error: 'Maximum 50 studies per batch request' });
    }

    const studyPromises = ids.map(id => getStudyOptimized(parseInt(id)));
    const studies = await Promise.all(studyPromises);
    
    // Filter out null results and maintain order
    const results = studies.filter(study => study !== null);
    
    res.set('Cache-Control', 'public, max-age=300'); // 5 minutes
    res.json({
      success: true,
      data: results,
      meta: {
        requested: ids.length,
        found: results.length
      }
    });
    
  } catch (error) {
    console.error('Error in batch fetch:', error);
    res.status(500).json({ error: 'Batch fetch failed' });
  }
});

/**
 * Cache management endpoint (for administration)
 */
router.post('/cache/invalidate', async (req, res) => {
  try {
    const { pattern } = req.body;
    
    if (!pattern) {
      return res.status(400).json({ error: 'Cache pattern required' });
    }

    invalidateCache(pattern);
    
    res.json({
      success: true,
      message: `Cache invalidated for pattern: ${pattern}`
    });
    
  } catch (error) {
    console.error('Error invalidating cache:', error);
    res.status(500).json({ error: 'Cache invalidation failed' });
  }
});

/**
 * Cache metrics endpoint for monitoring
 */
router.get('/cache/metrics', async (req, res) => {
  try {
    const metrics = getCacheMetrics();
    
    res.json({
      success: true,
      data: metrics,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Error fetching cache metrics:', error);
    res.status(500).json({ error: 'Failed to fetch cache metrics' });
  }
});

/**
 * Optimized autocomplete endpoint for search suggestions
 */
router.get('/search/suggestions', async (req, res) => {
  try {
    const { q: query, limit = 10 } = req.query;
    
    if (!query || (query as string).length < 2) {
      return res.json({ success: true, data: [] });
    }

    // This could be cached more aggressively since suggestions don't change often
    const suggestions = await searchStudiesOptimized({
      query: query as string,
      limit: Math.min(parseInt(limit as string) || 10, 20)
    });

    const uniqueTitles = suggestions.studies
      .map(study => study.title)
      .filter((title, index, array) => array.indexOf(title) === index)
      .slice(0, parseInt(limit as string) || 10);

    res.set('Cache-Control', 'public, max-age=3600'); // 1 hour for suggestions
    res.json({
      success: true,
      data: uniqueTitles
    });
    
  } catch (error) {
    console.error('Error fetching suggestions:', error);
    res.status(500).json({ error: 'Failed to fetch suggestions' });
  }
});

export default router;