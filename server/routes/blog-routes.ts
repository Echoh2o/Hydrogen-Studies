import { Router } from 'express';
import { db } from '../db';
import { blogArticles } from '@shared/schema';
import { sql, count, desc, eq } from 'drizzle-orm';

const router = Router();

/**
 * Get blog statistics for dashboard
 */
router.get('/stats/dashboard', async (req, res) => {
  try {
    // Get total blog count
    const [totalResult] = await db
      .select({ count: count() })
      .from(blogArticles);
    
    // Get published blog count
    const [publishedResult] = await db
      .select({ count: count() })
      .from(blogArticles)
      .where(eq(blogArticles.isPublished, true));
    
    // Get draft blog count
    const [draftResult] = await db
      .select({ count: count() })
      .from(blogArticles)
      .where(eq(blogArticles.isPublished, false));

    const stats = {
      totalBlogs: totalResult.count,
      publishedBlogs: publishedResult.count,
      draftBlogs: draftResult.count
    };

    res.json(stats);
  } catch (error) {
    console.error('Error fetching blog stats:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch blog statistics',
      stats: {
        totalBlogs: 0,
        publishedBlogs: 0,
        draftBlogs: 0
      }
    });
  }
});

/**
 * Get all blog articles with pagination
 */
router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const offset = (page - 1) * limit;

    // Simple query to get all blogs
    const blogs = await db
      .select()
      .from(blogArticles)
      .orderBy(desc(blogArticles.createdAt))
      .limit(limit)
      .offset(offset);

    // Get total count for pagination
    const [totalResult] = await db
      .select({ count: count() })
      .from(blogArticles);

    res.json({
      success: true,
      data: blogs,
      pagination: {
        page,
        limit,
        total: totalResult.count,
        totalPages: Math.ceil(totalResult.count / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching blogs:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch blog articles' 
    });
  }
});

/**
 * Get blog categories (article types)
 */
router.get('/categories', async (req, res) => {
  try {
    // Get unique article types from blog articles
    const categoriesResult = await db
      .select({ articleType: blogArticles.articleType })
      .from(blogArticles)
      .where(sql`${blogArticles.articleType} IS NOT NULL AND ${blogArticles.articleType} != ''`)
      .groupBy(blogArticles.articleType);

    const categories = categoriesResult.map(item => item.articleType).filter(Boolean);

    res.json({
      success: true,
      categories
    });
  } catch (error) {
    console.error('Error fetching blog categories:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch blog categories',
      categories: []
    });
  }
});

/**
 * Get a single blog article by ID
 */
router.get('/:id(\\d+)', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    
    if (isNaN(id)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid blog ID' 
      });
    }

    const [blog] = await db
      .select()
      .from(blogArticles)
      .where(eq(blogArticles.id, id));

    if (!blog) {
      return res.status(404).json({ 
        success: false, 
        error: 'Blog article not found' 
      });
    }

    res.json({
      success: true,
      data: blog
    });
  } catch (error) {
    console.error('Error fetching blog:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch blog article' 
    });
  }
});

export default router;