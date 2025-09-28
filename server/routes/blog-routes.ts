import { Router } from 'express';
import { db } from '../db';
import { blogArticles, studies, insertBlogArticleSchema } from '@shared/schema';
import { sql, count, desc, eq, isNotNull } from 'drizzle-orm';
import { z } from 'zod';
import { isAuthenticated, requireAdmin } from '../auth';
import { aiGenerationRateLimiter, generalApiRateLimiter } from '../rate-limiting';

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
    const limit = parseInt(req.query.limit as string) || 50; // Default 50 for admin pages
    const offset = (page - 1) * limit;
    const search = req.query.search as string;
    const filterType = req.query.filterType as string;
    const filterStatus = req.query.filterStatus as string;

    // Build query with filters
    let baseQuery = db.select().from(blogArticles);
    let countQuery = db.select({ count: count() }).from(blogArticles);
    
    // Apply search filter
    if (search) {
      const searchCondition = sql`${blogArticles.title} ILIKE ${'%' + search + '%'} OR ${blogArticles.summary} ILIKE ${'%' + search + '%'}`;
      baseQuery = baseQuery.where(searchCondition);
      countQuery = countQuery.where(searchCondition);
    }
    
    // Apply type filter
    if (filterType && filterType !== 'all') {
      baseQuery = baseQuery.where(eq(blogArticles.articleType, filterType));
      countQuery = countQuery.where(eq(blogArticles.articleType, filterType));
    }
    
    // Apply status filter
    if (filterStatus === 'published') {
      baseQuery = baseQuery.where(eq(blogArticles.isPublished, true));
      countQuery = countQuery.where(eq(blogArticles.isPublished, true));
    } else if (filterStatus === 'draft') {
      baseQuery = baseQuery.where(eq(blogArticles.isPublished, false));
      countQuery = countQuery.where(eq(blogArticles.isPublished, false));
    }
    
    // Apply ordering and pagination
    const blogs = await baseQuery
      .orderBy(desc(blogArticles.createdAt))
      .limit(limit)
      .offset(offset);

    // Get total count for pagination
    const [totalResult] = await countQuery;

    // Consistent response format with studies endpoint
    res.json({
      data: blogs,
      total: totalResult.count,
      page,
      limit,
      totalPages: Math.ceil(totalResult.count / limit)
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
 * Rate limited to prevent abuse of blog generation
 */
router.post('/', aiGenerationRateLimiter, async (req, res) => {
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

/**
 * Get all blog categories with article counts
 */
router.get('/categories', async (req, res) => {
  try {
    const categories = await db
      .select({
        name: blogArticles.articleType,
        count: count()
      })
      .from(blogArticles)
      .where(isNotNull(blogArticles.articleType))
      .groupBy(blogArticles.articleType)
      .orderBy(desc(count()));

    const filteredCategories = categories.filter(cat => cat.name && cat.name.trim() !== '');

    res.json({
      success: true,
      categories: filteredCategories
    });
  } catch (error) {
    console.error('Error fetching blog categories:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch blog categories'
    });
  }
});

/**
 * Add a new blog category
 * SECURITY: Requires admin access - only admin users can create categories
 */
router.post('/categories', requireAdmin, async (req, res) => {
  try {
    const { name } = z.object({
      name: z.string().min(1, "Category name is required").max(50, "Category name too long")
    }).parse(req.body);

    const trimmedName = name.trim();

    // Check if category already exists
    const existingCategory = await db
      .select({ count: count() })
      .from(blogArticles)
      .where(eq(blogArticles.articleType, trimmedName))
      .limit(1);

    if (existingCategory.length > 0 && existingCategory[0].count > 0) {
      return res.status(400).json({
        success: false,
        error: 'Category already exists'
      });
    }

    // Since categories are stored as article types in blog_articles,
    // we don't need to create a separate record - just return success
    // Categories are created when blog articles use them
    res.json({
      success: true,
      message: `Category "${trimmedName}" is ready to be used`
    });
  } catch (error) {
    console.error('Error adding blog category:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: error.errors[0].message
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to add blog category'
    });
  }
});

/**
 * Update a blog category name
 * SECURITY: Requires admin access - only admin users can modify categories
 */
router.put('/categories/:name', requireAdmin, async (req, res) => {
  try {
    const oldName = decodeURIComponent(req.params.name);
    const { name: newName } = z.object({
      name: z.string().min(1, "Category name is required").max(50, "Category name too long")
    }).parse(req.body);

    const trimmedNewName = newName.trim();

    // Check if old category exists
    const existingArticles = await db
      .select({ count: count() })
      .from(blogArticles)
      .where(eq(blogArticles.articleType, oldName));

    if (existingArticles.length === 0 || existingArticles[0].count === 0) {
      return res.status(404).json({
        success: false,
        error: 'Category not found'
      });
    }

    // Check if new category name already exists
    const conflictingCategory = await db
      .select({ count: count() })
      .from(blogArticles)
      .where(eq(blogArticles.articleType, trimmedNewName));

    if (conflictingCategory.length > 0 && conflictingCategory[0].count > 0) {
      return res.status(400).json({
        success: false,
        error: 'A category with this name already exists'
      });
    }

    // Update all blog articles with the old category name
    const result = await db
      .update(blogArticles)
      .set({ 
        articleType: trimmedNewName,
        updatedAt: new Date()
      })
      .where(eq(blogArticles.articleType, oldName))
      .returning({ id: blogArticles.id });

    res.json({
      success: true,
      message: `Updated ${result.length} articles from "${oldName}" to "${trimmedNewName}"`
    });
  } catch (error) {
    console.error('Error updating blog category:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: error.errors[0].message
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to update blog category'
    });
  }
});

/**
 * Delete a blog category
 * SECURITY: Requires admin access - only admin users can delete categories
 */
router.delete('/categories/:name', requireAdmin, async (req, res) => {
  try {
    const categoryName = decodeURIComponent(req.params.name);

    // Check if category exists
    const existingArticles = await db
      .select({ count: count() })
      .from(blogArticles)
      .where(eq(blogArticles.articleType, categoryName));

    if (existingArticles.length === 0 || existingArticles[0].count === 0) {
      return res.status(404).json({
        success: false,
        error: 'Category not found'
      });
    }

    // Set article_type to null for all articles with this category
    const result = await db
      .update(blogArticles)
      .set({ 
        articleType: null,
        updatedAt: new Date()
      })
      .where(eq(blogArticles.articleType, categoryName))
      .returning({ id: blogArticles.id });

    res.json({
      success: true,
      message: `Removed category "${categoryName}" from ${result.length} articles`
    });
  } catch (error) {
    console.error('Error deleting blog category:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete blog category'
    });
  }
});

export default router;