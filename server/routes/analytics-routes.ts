
import { Router } from 'express';
import { db } from '../db';
import { studies } from '../../shared/schema';
import { sql } from 'drizzle-orm';

const router = Router();

// Get comprehensive analytics data
router.get('/analytics', async (req, res) => {
  try {
    // Get basic statistics
    const totalStudiesResult = await db.select({ count: sql<number>`count(*)` }).from(studies);
    const totalStudies = totalStudiesResult[0]?.count || 0;

    // Get citation statistics
    const citationStats = await db.select({
      totalCitations: sql<number>`sum(citation_count)`,
      avgCitations: sql<number>`avg(citation_count)`,
      maxCitations: sql<number>`max(citation_count)`
    }).from(studies).where(sql`citation_count IS NOT NULL`);

    // Get studies with citations for network analysis
    const citedStudiesResult = await db.select({ count: sql<number>`count(*)` })
      .from(studies)
      .where(sql`citation_count > 0`);

    const connectedStudies = citedStudiesResult[0]?.count || 0;

    // Get high impact studies
    const highImpactStudies = await db.select({
      id: studies.id,
      title: studies.title,
      citations: studies.citationCount,
      year: sql<number>`EXTRACT(YEAR FROM publish_date)`
    })
    .from(studies)
    .where(sql`citation_count > 10`)
    .orderBy(sql`citation_count DESC`)
    .limit(10);

    res.json({
      totalStudies,
      totalCitations: citationStats[0]?.totalCitations || 0,
      avgCitations: citationStats[0]?.avgCitations || 0,
      maxCitations: citationStats[0]?.maxCitations || 0,
      connectedStudies,
      highImpactStudies: highImpactStudies.map(study => ({
        title: study.title,
        citations: study.citations || 0,
        year: study.year || new Date().getFullYear()
      }))
    });

  } catch (error) {
    console.error('Error fetching analytics data:', error);
    res.status(500).json({ 
      error: 'Failed to fetch analytics data',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get publication timeline data
router.get('/timeline', async (req, res) => {
  try {
    // Get yearly publication counts
    const yearlyDataQuery = `
      SELECT 
        EXTRACT(YEAR FROM publish_date) as year,
        COUNT(*) as annual,
        SUM(COUNT(*)) OVER (ORDER BY EXTRACT(YEAR FROM publish_date)) as cumulative,
        CASE 
          WHEN LAG(COUNT(*)) OVER (ORDER BY EXTRACT(YEAR FROM publish_date)) IS NULL THEN 0
          ELSE ROUND(
            ((COUNT(*) - LAG(COUNT(*)) OVER (ORDER BY EXTRACT(YEAR FROM publish_date))) * 100.0 / 
             LAG(COUNT(*)) OVER (ORDER BY EXTRACT(YEAR FROM publish_date))), 1
          )
        END as growth_rate
      FROM studies 
      WHERE publish_date IS NOT NULL 
        AND EXTRACT(YEAR FROM publish_date) >= 2000
        AND EXTRACT(YEAR FROM publish_date) <= EXTRACT(YEAR FROM CURRENT_DATE)
      GROUP BY EXTRACT(YEAR FROM publish_date)
      ORDER BY year
    `;

    const yearlyResult = await db.execute(sql.raw(yearlyDataQuery));
    const yearlyData = yearlyResult.rows.map((row: any) => ({
      year: parseInt(row.year),
      annual: parseInt(row.annual),
      cumulative: parseInt(row.cumulative),
      growthRate: parseFloat(row.growth_rate) || 0
    }));

    // Get category breakdown by year
    const categoryBreakdownQuery = `
      SELECT 
        EXTRACT(YEAR FROM publish_date) as year,
        SUM(CASE WHEN category ILIKE '%cardiovascular%' OR title ILIKE '%heart%' OR title ILIKE '%cardiac%' THEN 1 ELSE 0 END) as cardiovascular,
        SUM(CASE WHEN category ILIKE '%neuro%' OR title ILIKE '%brain%' OR title ILIKE '%cognitive%' THEN 1 ELSE 0 END) as neurological,
        SUM(CASE WHEN category ILIKE '%metabolic%' OR title ILIKE '%diabetes%' OR title ILIKE '%glucose%' THEN 1 ELSE 0 END) as metabolic,
        SUM(CASE WHEN category ILIKE '%inflam%' OR title ILIKE '%inflam%' OR title ILIKE '%immune%' THEN 1 ELSE 0 END) as inflammatory,
        SUM(CASE WHEN 
          NOT (category ILIKE '%cardiovascular%' OR title ILIKE '%heart%' OR title ILIKE '%cardiac%' OR
               category ILIKE '%neuro%' OR title ILIKE '%brain%' OR title ILIKE '%cognitive%' OR
               category ILIKE '%metabolic%' OR title ILIKE '%diabetes%' OR title ILIKE '%glucose%' OR
               category ILIKE '%inflam%' OR title ILIKE '%inflam%' OR title ILIKE '%immune%')
          THEN 1 ELSE 0 END) as other
      FROM studies 
      WHERE publish_date IS NOT NULL 
        AND EXTRACT(YEAR FROM publish_date) >= 2000
        AND EXTRACT(YEAR FROM publish_date) <= EXTRACT(YEAR FROM CURRENT_DATE)
      GROUP BY EXTRACT(YEAR FROM publish_date)
      ORDER BY year
    `;

    const categoryResult = await db.execute(sql.raw(categoryBreakdownQuery));
    const categoryBreakdown = categoryResult.rows.map((row: any) => ({
      year: parseInt(row.year),
      cardiovascular: parseInt(row.cardiovascular),
      neurological: parseInt(row.neurological),
      metabolic: parseInt(row.metabolic),
      inflammatory: parseInt(row.inflammatory),
      other: parseInt(row.other)
    }));

    res.json({
      yearlyData,
      categoryBreakdown,
      cumulativeData: yearlyData // Same data, different perspective
    });

  } catch (error) {
    console.error('Error fetching timeline data:', error);
    res.status(500).json({ 
      error: 'Failed to fetch timeline data',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get citation network data
router.get('/citation-network', async (req, res) => {
  try {
    // Get studies with citation data for network nodes
    const nodesQuery = `
      SELECT 
        id,
        title,
        COALESCE(citation_count, 0) as citations,
        COALESCE(category, 'General') as category,
        EXTRACT(YEAR FROM publish_date) as year,
        doi,
        authors
      FROM studies 
      WHERE citation_count IS NOT NULL 
        AND citation_count > 0
      ORDER BY citation_count DESC
      LIMIT 100
    `;

    const nodesResult = await db.execute(sql.raw(nodesQuery));
    const nodes = nodesResult.rows.map((row: any) => ({
      id: row.id.toString(),
      title: row.title || 'Untitled Study',
      citations: parseInt(row.citations) || 0,
      category: row.category || 'General',
      year: parseInt(row.year) || new Date().getFullYear(),
      connections: [] // Will be populated with actual citation data
    }));

    // Generate simplified citation links based on categories and years
    // In a real implementation, this would come from actual citation data
    const links: Array<{source: string, target: string, strength: number}> = [];
    
    nodes.forEach((sourceNode, sourceIndex) => {
      // Create connections to studies in the same category or nearby years
      nodes.forEach((targetNode, targetIndex) => {
        if (sourceIndex !== targetIndex && links.length < 200) {
          const categoryMatch = sourceNode.category === targetNode.category;
          const yearProximity = Math.abs(sourceNode.year - targetNode.year) <= 2;
          const citationSimilarity = Math.abs(sourceNode.citations - targetNode.citations) < 50;
          
          if ((categoryMatch && yearProximity) || (categoryMatch && citationSimilarity)) {
            const strength = categoryMatch ? 0.8 : 0.4;
            links.push({
              source: sourceNode.id,
              target: targetNode.id,
              strength
            });
          }
        }
      });
    });

    // Get top cited studies
    const topCited = nodes.slice(0, 10).map(node => ({
      title: node.title,
      citations: node.citations,
      year: node.year,
      category: node.category
    }));

    // Calculate network statistics
    const totalConnections = links.length;
    const clusters = new Set(nodes.map(n => n.category)).size;

    res.json({
      nodes,
      links,
      topCited,
      clusters,
      stats: {
        totalNodes: nodes.length,
        totalConnections,
        clusters,
        averageCitations: nodes.reduce((sum, node) => sum + node.citations, 0) / nodes.length
      }
    });

  } catch (error) {
    console.error('Error fetching citation network data:', error);
    res.status(500).json({ 
      error: 'Failed to fetch citation network data',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get research impact metrics
router.get('/impact-metrics', async (req, res) => {
  try {
    // Calculate H-index approximation
    const hIndexQuery = `
      SELECT citation_count
      FROM studies 
      WHERE citation_count IS NOT NULL 
        AND citation_count > 0
      ORDER BY citation_count DESC
    `;

    const citationResult = await db.execute(sql.raw(hIndexQuery));
    const citations = citationResult.rows.map((row: any) => parseInt(row.citation_count));
    
    // Calculate H-index
    let hIndex = 0;
    for (let i = 0; i < citations.length; i++) {
      if (citations[i] >= i + 1) {
        hIndex = i + 1;
      } else {
        break;
      }
    }

    // Get recent citation trends
    const recentTrendsQuery = `
      SELECT 
        EXTRACT(YEAR FROM publish_date) as year,
        AVG(citation_count) as avg_citations,
        COUNT(*) as study_count
      FROM studies 
      WHERE publish_date IS NOT NULL 
        AND citation_count IS NOT NULL
        AND EXTRACT(YEAR FROM publish_date) >= EXTRACT(YEAR FROM CURRENT_DATE) - 5
      GROUP BY EXTRACT(YEAR FROM publish_date)
      ORDER BY year
    `;

    const trendsResult = await db.execute(sql.raw(recentTrendsQuery));
    const recentTrends = trendsResult.rows.map((row: any) => ({
      year: parseInt(row.year),
      avgCitations: parseFloat(row.avg_citations),
      studyCount: parseInt(row.study_count)
    }));

    // Calculate growth in citations
    const citationGrowth = recentTrends.length > 1 ? 
      ((recentTrends[recentTrends.length - 1].avgCitations - recentTrends[0].avgCitations) / 
       recentTrends[0].avgCitations * 100) : 0;

    res.json({
      hIndex,
      averageCitations: citations.reduce((sum, c) => sum + c, 0) / citations.length,
      citationGrowth: Math.round(citationGrowth),
      recentTrends,
      totalCitations: citations.reduce((sum, c) => sum + c, 0)
    });

  } catch (error) {
    console.error('Error fetching impact metrics:', error);
    res.status(500).json({ 
      error: 'Failed to fetch impact metrics',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
