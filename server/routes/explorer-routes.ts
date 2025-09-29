import { Router } from 'express';
import { explorerDataService } from '../services/explorer-data-service';

const router = Router();

// Get timeline data
router.get('/api/explorer/timeline-data', async (req, res) => {
  try {
    const startYear = req.query.startYear ? parseInt(req.query.startYear as string) : 2000;
    const endYear = req.query.endYear ? parseInt(req.query.endYear as string) : new Date().getFullYear();
    
    const data = await explorerDataService.getTimelineData(startYear, endYear);
    res.json(data);
  } catch (error) {
    console.error('Error fetching timeline data:', error);
    res.status(500).json({ error: 'Failed to fetch timeline data' });
  }
});

// Get body systems data
router.get('/api/explorer/body-systems', async (req, res) => {
  try {
    const data = await explorerDataService.getBodySystemsData();
    res.json(data);
  } catch (error) {
    console.error('Error fetching body systems data:', error);
    res.status(500).json({ error: 'Failed to fetch body systems data' });
  }
});

// Get study connections
router.get('/api/explorer/study-connections', async (req, res) => {
  try {
    const studyId = req.query.studyId ? parseInt(req.query.studyId as string) : undefined;
    const data = await explorerDataService.getStudyConnections(studyId);
    res.json(data);
  } catch (error) {
    console.error('Error fetching study connections:', error);
    res.status(500).json({ error: 'Failed to fetch study connections' });
  }
});

// Get research evolution data
router.get('/api/explorer/research-evolution', async (req, res) => {
  try {
    const startYear = req.query.startYear ? parseInt(req.query.startYear as string) : 2000;
    const data = await explorerDataService.getResearchEvolution(startYear);
    res.json(data);
  } catch (error) {
    console.error('Error fetching research evolution:', error);
    res.status(500).json({ error: 'Failed to fetch research evolution data' });
  }
});

// Get geographic distribution
router.get('/api/explorer/geographic-distribution', async (req, res) => {
  try {
    const data = await explorerDataService.getGeographicDistribution();
    res.json(data);
  } catch (error) {
    console.error('Error fetching geographic distribution:', error);
    res.status(500).json({ error: 'Failed to fetch geographic distribution' });
  }
});

// Get comparison data for multiple studies
router.get('/api/explorer/comparison/:ids', async (req, res) => {
  try {
    const ids = req.params.ids.split(',').map(id => parseInt(id));
    
    if (ids.length < 2 || ids.length > 3) {
      return res.status(400).json({ error: 'Please select 2-3 studies for comparison' });
    }
    
    const data = await explorerDataService.getComparisonData(ids);
    res.json(data);
  } catch (error) {
    console.error('Error fetching comparison data:', error);
    res.status(500).json({ error: 'Failed to fetch comparison data' });
  }
});

// Clear cache endpoint (admin only)
router.post('/api/explorer/clear-cache', async (req, res) => {
  try {
    explorerDataService.clearCache();
    res.json({ message: 'Cache cleared successfully' });
  } catch (error) {
    console.error('Error clearing cache:', error);
    res.status(500).json({ error: 'Failed to clear cache' });
  }
});

export default router;