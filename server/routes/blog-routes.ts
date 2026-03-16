import { Router } from "express";
import { db } from "../db";
import { blogArticles, studies, insertBlogArticleSchema } from "@shared/schema";
import { sql, count, desc, eq, isNotNull } from "drizzle-orm";
import { z } from "zod";
import { isAuthenticated, requireAdmin } from "../auth";
import {
  aiGenerationRateLimiter,
  generalApiRateLimiter,
} from "../utils/rate-limiting";

const router = Router();

/**
 * Get blog statistics for dashboard
 */
router.get("/stats/dashboard", async (req, res) => {
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
      const [studiesResult] = await db.select({ count: count() }).from(studies);
      studiesCount = studiesResult?.count || 0;
    } catch (error) {
      console.log("Studies table not accessible, using default count");
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
      recentImports: 0, // Will be enhanced when import tracking is added
    };

    res.json(stats);
  } catch (error) {
    console.error("Error fetching blog stats:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch blog statistics",
      stats: {
        totalBlogs: 0,
        publishedBlogs: 0,
        draftBlogs: 0,
      },
    });
  }
});

/**
 * Get all blog articles with pagination
 */
router.get("/", async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit as string) || 50));
    const offset = (page - 1) * limit;
    const search = req.query.search as string;
    const filterType = req.query.filterType as string;
    const filterStatus = req.query.filterStatus as string;

    // Build query with filters
    let baseQuery = db.select().from(blogArticles).$dynamic();
    let countQuery = db.select({ count: count() }).from(blogArticles).$dynamic();

    // Apply search filter
    if (search) {
      const searchCondition = sql`${blogArticles.title} ILIKE ${"%" + search + "%"} OR ${blogArticles.summary} ILIKE ${"%" + search + "%"}`;
      baseQuery = baseQuery.where(searchCondition);
      countQuery = countQuery.where(searchCondition);
    }

    // Apply type filter
    if (filterType && filterType !== "all") {
      baseQuery = baseQuery.where(eq(blogArticles.articleType, filterType));
      countQuery = countQuery.where(eq(blogArticles.articleType, filterType));
    }

    // Apply status filter
    if (filterStatus === "published") {
      baseQuery = baseQuery.where(eq(blogArticles.isPublished, true));
      countQuery = countQuery.where(eq(blogArticles.isPublished, true));
    } else if (filterStatus === "draft") {
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
      totalPages: Math.ceil(totalResult.count / limit),
    });
  } catch (error) {
    console.error("Error fetching blogs:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch blog articles",
    });
  }
});

/**
 * Get a single blog article by slug
 */
router.get("/slug/:slug", async (req, res) => {
  try {
    const slug = req.params.slug;

    if (!slug) {
      return res.status(400).json({
        success: false,
        error: "Invalid blog slug",
      });
    }

    const [blog] = await db
      .select()
      .from(blogArticles)
      .where(eq(blogArticles.slug, slug));

    if (!blog) {
      return res.status(404).json({
        success: false,
        error: "Blog article not found",
      });
    }

    res.json({
      success: true,
      data: blog,
    });
  } catch (error) {
    console.error("Error fetching blog by slug:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch blog article",
    });
  }
});

/**
 * Get a single blog article by ID
 */
router.get("/:id(\\d+)", async (req, res) => {
  try {
    const id = parseInt(req.params.id);

    if (isNaN(id)) {
      return res.status(400).json({
        success: false,
        error: "Invalid blog ID",
      });
    }

    const [blog] = await db
      .select()
      .from(blogArticles)
      .where(eq(blogArticles.id, id));

    if (!blog) {
      return res.status(404).json({
        success: false,
        error: "Blog article not found",
      });
    }

    res.json({
      success: true,
      data: blog,
    });
  } catch (error) {
    console.error("Error fetching blog:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch blog article",
    });
  }
});

/**
 * Create a new blog article
 * Rate limited to prevent abuse of blog generation
 */
router.post("/", requireAdmin, aiGenerationRateLimiter, async (req, res) => {
  try {
    // Validate request body with Zod schema
    const blogValidationSchema = z.object({
      title: z.string().min(3, "Title must be at least 3 characters"),
      summary: z.string().min(10, "Summary must be at least 10 characters"),
      content: z.string().min(50, "Content must be at least 50 characters"),
      studyId: z.number().min(1, "Study ID is required").optional().default(1),
      readingLevel: z.string().default("6th"),
      slug: z
        .string()
        .min(3, "Slug must be at least 3 characters")
        .regex(
          /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/,
          "Slug must contain only lowercase letters, numbers, and hyphens (no leading/trailing hyphens)",
        ),
      isPublished: z.boolean().default(false),
      editorNotes: z.string().optional(),
      articleType: z.string().optional().default("manual"),
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
        error: "A blog article with this slug already exists",
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
      id: newBlog.id,
    });
  } catch (error) {
    console.error("Error creating blog article:", error);

    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: error.errors[0].message,
      });
    }

    res.status(500).json({
      success: false,
      error: "Failed to create blog article",
    });
  }
});

/**
 * Update an existing blog article
 */
router.put("/:id(\\d+)", requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);

    if (isNaN(id)) {
      return res.status(400).json({
        success: false,
        error: "Invalid blog ID",
      });
    }

    // Validate request body
    const blogValidationSchema = z.object({
      title: z.string().min(3, "Title must be at least 3 characters"),
      summary: z.string().min(10, "Summary must be at least 10 characters"),
      content: z.string().min(50, "Content must be at least 50 characters"),
      studyId: z.number().min(1, "Study ID is required"),
      readingLevel: z.string().default("6th"),
      slug: z
        .string()
        .min(3, "Slug must be at least 3 characters")
        .regex(
          /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/,
          "Slug must contain only lowercase letters, numbers, and hyphens (no leading/trailing hyphens)",
        ),
      isPublished: z.boolean().default(false),
      editorNotes: z.string().optional(),
      articleType: z.string().optional(),
    });

    const validatedData = blogValidationSchema.parse(req.body);

    // Check if slug already exists for another blog
    const existingBlog = await db
      .select({ id: blogArticles.id })
      .from(blogArticles)
      .where(
        sql`${blogArticles.slug} = ${validatedData.slug} AND ${blogArticles.id} != ${id}`,
      )
      .limit(1);

    if (existingBlog.length > 0) {
      return res.status(400).json({
        success: false,
        error: "A blog article with this slug already exists",
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
        error: "Blog article not found",
      });
    }

    res.json({
      success: true,
      data: updatedBlog,
    });
  } catch (error) {
    console.error("Error updating blog article:", error);

    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: error.errors[0].message,
      });
    }

    res.status(500).json({
      success: false,
      error: "Failed to update blog article",
    });
  }
});

/**
 * Generate AI content for a blog article
 * Used by BlogAddPage "Generate Full Article" button
 */
router.post("/generate-content", requireAdmin, aiGenerationRateLimiter, async (req, res) => {
  try {
    const { title, studyId, articleType, readingLevel } = req.body;

    if (!title) {
      return res.status(400).json({ error: "Title is required" });
    }

    // Get study context if available
    let studyContext = "";
    if (studyId) {
      const [study] = await db
        .select()
        .from(studies)
        .where(eq(studies.id, studyId))
        .limit(1);
      if (study) {
        studyContext = `Study title: ${study.title}\nAbstract: ${study.abstract || "N/A"}\nMethods: ${study.methods || "N/A"}\nResults: ${study.results || "N/A"}\nConclusion: ${study.conclusion || "N/A"}`;
      }
    }

    const { ai } = await import("../services/ai-provider");

    const systemPrompt = `You are a health science writer creating blog articles about hydrogen therapy research for a general audience. Write at a ${readingLevel || "6th"} grade reading level. Use clear, simple language. Output valid HTML content with <h2>, <p>, <ul>, <li> tags. Do not include the title as an <h1> — start with the first section.`;

    const userPrompt = `Write a comprehensive blog article titled "${title}"${articleType ? ` in the style of a ${articleType} article` : ""}.${studyContext ? `\n\nBase it on this study:\n${studyContext}` : ""}\n\nInclude sections for: Introduction, Key Findings, How It Works, What This Means For You, and Future Directions. Each section should have an <h2> heading and 2-3 paragraphs.`;

    const content = await ai.generateText(systemPrompt, userPrompt, {
      maxTokens: 4096,
      temperature: 0.7,
    });

    // Also generate a summary (with fallback if this step fails)
    let summary = "";
    try {
      const summaryPrompt = `Write a 2-3 sentence summary of this article for use in blog listings:\n\n${content.substring(0, 1000)}`;
      summary = await ai.generateText(
        "You are a concise writer. Output only the summary text, no HTML tags.",
        summaryPrompt,
        { maxTokens: 200, temperature: 0.3 },
      );
    } catch (summaryErr) {
      // Fallback: extract first paragraph text from generated content
      const textMatch = content.match(/<p>(.*?)<\/p>/);
      summary = textMatch ? textMatch[1].substring(0, 200) : title;
    }

    res.json({ success: true, content, summary });
  } catch (error) {
    console.error("Error generating blog content:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to generate content",
    });
  }
});

/**
 * Generate an AI image for a blog article
 * Called by BlogImageGenerator component
 */
router.post("/:id(\\d+)/generate-image", requireAdmin, aiGenerationRateLimiter, async (req, res) => {
  try {
    const blogId = parseInt(req.params.id);
    if (isNaN(blogId)) {
      return res.status(400).json({ error: "Invalid blog ID" });
    }

    const { generateBlogImage } = await import("../services/image-generator");
    const result = await generateBlogImage(blogId);

    if (!result.success) {
      return res.status(500).json({ error: result.message || "Image generation failed" });
    }

    res.json({
      success: true,
      imageUrl: result.imageUrl,
      imageAlt: `Featured image for blog article ${blogId}`,
    });
  } catch (error) {
    console.error("Error generating blog image:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to generate image",
    });
  }
});

/**
 * Generate content suggestions for a blog
 * Called by BlogContentSuggestions component
 */
router.post("/:id(\\d+)/generate-suggestion", requireAdmin, aiGenerationRateLimiter, async (req, res) => {
  try {
    const blogId = parseInt(req.params.id);
    const { suggestionType, selectedContent } = req.body;

    if (isNaN(blogId)) {
      return res.status(400).json({ error: "Invalid blog ID" });
    }

    const [blog] = await db
      .select()
      .from(blogArticles)
      .where(eq(blogArticles.id, blogId))
      .limit(1);

    if (!blog) {
      return res.status(404).json({ error: "Blog not found" });
    }

    const { ai } = await import("../services/ai-provider");

    const prompts: Record<string, string> = {
      improve: "Improve the following content to be more engaging and informative while maintaining the same reading level:",
      expand: "Expand on the following content with more detail, examples, and research context:",
      simplify: "Simplify the following content to be understandable at a 6th grade reading level:",
      add_examples: "Add real-world examples and practical applications to the following content:",
      add_research_context: "Add relevant research context and citations to the following content:",
      elon_style: "Rewrite the following in a bold, visionary style with short punchy sentences:",
      add_conclusion: "Write a compelling conclusion section for an article that includes this content:",
    };

    const userPrompt = `${prompts[suggestionType] || prompts.improve}\n\n${selectedContent || blog.content}`;

    const result = await ai.generateText(
      "You are a health science content editor. Output only the improved HTML content using <p>, <h2>, <ul>, <li> tags. No explanations.",
      userPrompt,
      { maxTokens: 2048, temperature: 0.7 },
    );

    res.json({ success: true, suggestion: result });
  } catch (error) {
    console.error("Error generating suggestion:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to generate suggestion",
    });
  }
});

/**
 * Generate title suggestions for a blog
 * Called by BlogContentSuggestions component
 */
router.post("/:id(\\d+)/generate-titles", requireAdmin, aiGenerationRateLimiter, async (req, res) => {
  try {
    const blogId = parseInt(req.params.id);
    if (isNaN(blogId)) {
      return res.status(400).json({ error: "Invalid blog ID" });
    }

    const [blog] = await db
      .select()
      .from(blogArticles)
      .where(eq(blogArticles.id, blogId))
      .limit(1);

    if (!blog) {
      return res.status(404).json({ error: "Blog not found" });
    }

    const { ai } = await import("../services/ai-provider");

    const titles = await ai.generateJSON<string[]>(
      "You are an SEO and health content expert. Generate exactly 5 alternative blog titles.",
      `Generate 5 alternative titles for a blog article currently titled "${blog.title}". The article content starts with: ${(blog.content || "").substring(0, 500)}\n\nReturn a JSON array of 5 strings.`,
      { maxTokens: 500, temperature: 0.8 },
    );

    res.json({ success: true, titles: Array.isArray(titles) ? titles : [] });
  } catch (error) {
    console.error("Error generating titles:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to generate titles",
    });
  }
});

/**
 * Get all blog categories with article counts
 */
router.get("/categories", async (req, res) => {
  try {
    const categories = await db
      .select({
        name: blogArticles.articleType,
        count: count(),
      })
      .from(blogArticles)
      .where(isNotNull(blogArticles.articleType))
      .groupBy(blogArticles.articleType)
      .orderBy(desc(count()));

    const filteredCategories = categories.filter(
      (cat) => cat.name && cat.name.trim() !== "",
    );

    res.json({
      success: true,
      categories: filteredCategories,
    });
  } catch (error) {
    console.error("Error fetching blog categories:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch blog categories",
    });
  }
});

/**
 * Add a new blog category
 * SECURITY: Requires admin access - only admin users can create categories
 */
router.post("/categories", requireAdmin, async (req, res) => {
  try {
    const { name } = z
      .object({
        name: z
          .string()
          .min(1, "Category name is required")
          .max(50, "Category name too long"),
      })
      .parse(req.body);

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
        error: "Category already exists",
      });
    }

    // Since categories are stored as article types in blog_articles,
    // we don't need to create a separate record - just return success
    // Categories are created when blog articles use them
    res.json({
      success: true,
      message: `Category "${trimmedName}" is ready to be used`,
    });
  } catch (error) {
    console.error("Error adding blog category:", error);

    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: error.errors[0].message,
      });
    }

    res.status(500).json({
      success: false,
      error: "Failed to add blog category",
    });
  }
});

/**
 * Update a blog category name
 * SECURITY: Requires admin access - only admin users can modify categories
 */
router.put("/categories/:name", requireAdmin, async (req, res) => {
  try {
    const oldName = decodeURIComponent(req.params.name);
    const { name: newName } = z
      .object({
        name: z
          .string()
          .min(1, "Category name is required")
          .max(50, "Category name too long"),
      })
      .parse(req.body);

    const trimmedNewName = newName.trim();

    // Check if old category exists
    const existingArticles = await db
      .select({ count: count() })
      .from(blogArticles)
      .where(eq(blogArticles.articleType, oldName));

    if (existingArticles.length === 0 || existingArticles[0].count === 0) {
      return res.status(404).json({
        success: false,
        error: "Category not found",
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
        error: "A category with this name already exists",
      });
    }

    // Update all blog articles with the old category name
    const result = await db
      .update(blogArticles)
      .set({
        articleType: trimmedNewName,
        updatedAt: new Date(),
      })
      .where(eq(blogArticles.articleType, oldName))
      .returning({ id: blogArticles.id });

    res.json({
      success: true,
      message: `Updated ${result.length} articles from "${oldName}" to "${trimmedNewName}"`,
    });
  } catch (error) {
    console.error("Error updating blog category:", error);

    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: error.errors[0].message,
      });
    }

    res.status(500).json({
      success: false,
      error: "Failed to update blog category",
    });
  }
});

/**
 * Delete a blog category
 * SECURITY: Requires admin access - only admin users can delete categories
 */
router.delete("/categories/:name", requireAdmin, async (req, res) => {
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
        error: "Category not found",
      });
    }

    // Set article_type to null for all articles with this category
    const result = await db
      .update(blogArticles)
      .set({
        articleType: null,
        updatedAt: new Date(),
      })
      .where(eq(blogArticles.articleType, categoryName))
      .returning({ id: blogArticles.id });

    res.json({
      success: true,
      message: `Removed category "${categoryName}" from ${result.length} articles`,
    });
  } catch (error) {
    console.error("Error deleting blog category:", error);
    res.status(500).json({
      success: false,
      error: "Failed to delete blog category",
    });
  }
});

export default router;
