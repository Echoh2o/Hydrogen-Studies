import { Router } from 'express';
import { db } from '../db';
import { blogArticles, studies, insertBlogArticleSchema } from '@shared/schema';
import { sql, count, desc, eq } from 'drizzle-orm';
import { z } from 'zod';

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

    // Get total studies count
    let studiesCount = 0;
    try {
      const [studiesResult] = await db
        .select({ count: count() })
        .from(studies);
      studiesCount = studiesResult?.count || 0;
    } catch (error) {
      console.log('Studies table not accessible, using default count');
      studiesCount = 0;
    }
    
    // Get categories count (approximate)
    const categoriesCount = 8; // Known categories from the system
    
    const stats = {
      // Blog stats
      totalBlogs: totalResult.count,
      publishedBlogs: publishedResult.count,
      draftBlogs: draftResult.count,
      // Study stats  
      totalStudies: studiesCount,
      categoriesCount,
      recentImports: 0 // Will be enhanced when import tracking is added
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

/**
 * Create a new blog article
 */
router.post('/', async (req, res) => {
  try {
    // Validate request body with Zod schema
    const blogValidationSchema = z.object({
      title: z.string().min(3, "Title must be at least 3 characters"),
      summary: z.string().min(10, "Summary must be at least 10 characters"),
      content: z.string().min(50, "Content must be at least 50 characters"),
      studyId: z.number().min(1, "Study ID is required").optional().default(1),
      readingLevel: z.string().default("6th"),
      slug: z.string().min(3, "Slug must be at least 3 characters")
        .regex(/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/, "Slug must contain only lowercase letters, numbers, and hyphens (no leading/trailing hyphens)"),
      isPublished: z.boolean().default(false),
      editorNotes: z.string().optional(),
      articleType: z.string().optional().default("manual")
    });

    const validatedData = blogValidationSchema.parse(req.body);

    // Check if slug already exists
    const existingBlog = await db
      .select({ id: blogArticles.id })
      .from(blogArticles)
      .where(eq(blogArticles.slug, validatedData.slug))
      .limit(1);

    if (existingBlog.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'A blog article with this slug already exists'
      });
    }

    // Create the blog article
    const [newBlog] = await db
      .insert(blogArticles)
      .values({
        title: validatedData.title,
        slug: validatedData.slug,
        summary: validatedData.summary,
        content: validatedData.content,
        studyId: validatedData.studyId,
        readingLevel: validatedData.readingLevel,
        articleType: validatedData.articleType,
        isPublished: validatedData.isPublished,
        editorNotes: validatedData.editorNotes || null,
      })
      .returning();

    res.status(201).json({
      success: true,
      data: newBlog,
      id: newBlog.id
    });

  } catch (error) {
    console.error('Error creating blog article:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: error.errors[0].message
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to create blog article'
    });
  }
});

/**
 * Update an existing blog article
 */
router.put('/:id(\\d+)', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    
    if (isNaN(id)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid blog ID' 
      });
    }

    // Validate request body
    const blogValidationSchema = z.object({
      title: z.string().min(3, "Title must be at least 3 characters"),
      summary: z.string().min(10, "Summary must be at least 10 characters"),
      content: z.string().min(50, "Content must be at least 50 characters"),
      studyId: z.number().min(1, "Study ID is required"),
      readingLevel: z.string().default("6th"),
      slug: z.string().min(3, "Slug must be at least 3 characters")
        .regex(/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/, "Slug must contain only lowercase letters, numbers, and hyphens (no leading/trailing hyphens)"),
      isPublished: z.boolean().default(false),
      editorNotes: z.string().optional(),
      articleType: z.string().optional()
    });

    const validatedData = blogValidationSchema.parse(req.body);

    // Check if slug already exists for another blog
    const existingBlog = await db
      .select({ id: blogArticles.id })
      .from(blogArticles)
      .where(sql`${blogArticles.slug} = ${validatedData.slug} AND ${blogArticles.id} != ${id}`)
      .limit(1);

    if (existingBlog.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'A blog article with this slug already exists'
      });
    }

    // Update the blog article
    const [updatedBlog] = await db
      .update(blogArticles)
      .set({
        title: validatedData.title,
        slug: validatedData.slug,
        summary: validatedData.summary,
        content: validatedData.content,
        studyId: validatedData.studyId,
        readingLevel: validatedData.readingLevel,
        articleType: validatedData.articleType,
        isPublished: validatedData.isPublished,
        editorNotes: validatedData.editorNotes || null,
        updatedAt: new Date(),
      })
      .where(eq(blogArticles.id, id))
      .returning();

    if (!updatedBlog) {
      return res.status(404).json({
        success: false,
        error: 'Blog article not found'
      });
    }

    res.json({
      success: true,
      data: updatedBlog
    });

  } catch (error) {
    console.error('Error updating blog article:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: error.errors[0].message
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to update blog article'
    });
  }
});

export default router;