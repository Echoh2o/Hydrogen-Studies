import { Router } from "express";
import { db } from "../db";
import { blogArticles, studies, insertBlogArticleSchema } from "@shared/schema";
import { sql, count, desc, eq, isNotNull, and } from "drizzle-orm";
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
    const sortField = (req.query.sort as string) || "createdAt";
    const sortOrder = ((req.query.order as string) || "desc").toLowerCase() === "asc" ? "asc" : "desc";

    // Whitelist of sortable columns. Anything outside this set silently
    // falls back to createdAt — prevents SQL injection via the sort param
    // and accidental sort-on-secret-field requests.
    const SORT_COLUMNS = {
      createdAt: blogArticles.createdAt,
      publishedAt: blogArticles.publishedAt,
      viewCount: blogArticles.viewCount,
      title: blogArticles.title,
      articleType: blogArticles.articleType,
    } as const;
    const sortColumn = (SORT_COLUMNS as any)[sortField] ?? blogArticles.createdAt;

    // Build query with filters
    let baseQuery = db.select().from(blogArticles).$dynamic();
    let countQuery = db.select({ count: count() }).from(blogArticles).$dynamic();

    const conditions: any[] = [];

    // Default: hide archived rows unless filterStatus explicitly requests them.
    if (filterStatus !== "archived" && filterStatus !== "all") {
      conditions.push(eq(blogArticles.isArchived, false));
    }

    if (search) {
      conditions.push(
        sql`(${blogArticles.title} ILIKE ${"%" + search + "%"} OR ${blogArticles.summary} ILIKE ${"%" + search + "%"})`,
      );
    }
    if (filterType && filterType !== "all") {
      conditions.push(eq(blogArticles.articleType, filterType));
    }
    if (filterStatus === "published") {
      conditions.push(eq(blogArticles.isPublished, true));
    } else if (filterStatus === "draft") {
      // "draft" = unpublished AND not scheduled. Scheduled posts get their own bucket.
      conditions.push(eq(blogArticles.isPublished, false));
      conditions.push(sql`${blogArticles.scheduledFor} IS NULL`);
    } else if (filterStatus === "scheduled") {
      conditions.push(eq(blogArticles.isPublished, false));
      conditions.push(sql`${blogArticles.scheduledFor} IS NOT NULL`);
    } else if (filterStatus === "archived") {
      conditions.push(eq(blogArticles.isArchived, true));
    }

    if (conditions.length > 0) {
      const combined = conditions.length === 1 ? conditions[0] : sql.join(conditions, sql` AND `);
      baseQuery = baseQuery.where(combined);
      countQuery = countQuery.where(combined);
    }

    const blogs = await baseQuery
      .orderBy(sortOrder === "asc" ? sortColumn : desc(sortColumn))
      .limit(limit)
      .offset(offset);

    const [totalResult] = await countQuery;

    // Cross-wire GSC clicks + GA4 sessions per blog over the last 30 days.
    // Two small extra queries — far cheaper than per-row joins because
    // we only fetch metrics for the rows we're returning. If either
    // metrics table is empty (admin hasn't connected yet, or no data
    // landed), the maps stay empty and blogs render with no badges —
    // never breaks the list.
    const slugPaths = blogs.map((b: any) => `/blog/${b.slug}`);
    const ga4Map = new Map<string, number>();
    const gscMap = new Map<string, { clicks: number; impressions: number }>();
    if (slugPaths.length > 0) {
      try {
        const ga4Rows: any = await db.execute(sql`
          SELECT page, SUM(sessions)::int AS sessions
          FROM ga4_page_metrics
          WHERE page = ANY(${slugPaths})
            AND date >= TO_CHAR(CURRENT_DATE - INTERVAL '30 days', 'YYYY-MM-DD')
          GROUP BY page
        `);
        for (const row of (ga4Rows.rows ?? ga4Rows) as Array<{ page: string; sessions: number }>) {
          ga4Map.set(row.page, Number(row.sessions) || 0);
        }
      } catch (err) {
        // Most likely cause: ga4_page_metrics table doesn't exist on a
        // fresh deploy that hasn't run ensureGa4Tables yet. Log and
        // continue — list shouldn't 500 just because metrics aren't ready.
        console.warn("blog list: GA4 metrics enrichment failed:", err instanceof Error ? err.message : err);
      }
      try {
        const gscRows: any = await db.execute(sql`
          SELECT
            REGEXP_REPLACE(page, '^https?://[^/]+', '') AS slug_path,
            SUM(clicks)::int AS clicks,
            SUM(impressions)::int AS impressions
          FROM gsc_query_metrics
          WHERE date >= TO_CHAR(CURRENT_DATE - INTERVAL '30 days', 'YYYY-MM-DD')
            AND REGEXP_REPLACE(page, '^https?://[^/]+', '') = ANY(${slugPaths})
          GROUP BY slug_path
        `);
        for (const row of (gscRows.rows ?? gscRows) as Array<{ slug_path: string; clicks: number; impressions: number }>) {
          gscMap.set(row.slug_path, {
            clicks: Number(row.clicks) || 0,
            impressions: Number(row.impressions) || 0,
          });
        }
      } catch (err) {
        console.warn("blog list: GSC metrics enrichment failed:", err instanceof Error ? err.message : err);
      }
    }

    const enriched = blogs.map((b: any) => {
      const path = `/blog/${b.slug}`;
      const gsc = gscMap.get(path);
      return {
        ...b,
        ga4Sessions30d: ga4Map.get(path) ?? null,
        gscClicks30d: gsc?.clicks ?? null,
        gscImpressions30d: gsc?.impressions ?? null,
      };
    });

    res.json({
      data: enriched,
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
 * Pre-generation context for a study — used by the admin Generate page so
 * the curator sees decision-grade signal *before* clicking Generate:
 *   • Quality score (overall + red-flag count)
 *   • How many blogs already exist for this study
 *   • Content gap for this study's category
 *
 * Single round-trip; everything joined server-side.
 */
router.get("/study-context/:studyId(\\d+)", requireAdmin, async (req, res) => {
  try {
    const studyId = parseInt(req.params.studyId);
    if (isNaN(studyId)) return res.status(400).json({ error: "Invalid study ID" });

    // Pull the study + score + blog count in one go.
    const [row] = await db.execute<{
      title: string;
      category: string;
      overall_score: number | null;
      red_flag_count: number | null;
      score_confidence: string | null;
      blog_count: number;
    }>(sql`
      SELECT
        s.title,
        s.category,
        q.overall_score,
        q.red_flag_count,
        q.score_confidence,
        (SELECT COUNT(*)::int FROM blog_articles b WHERE b.study_id = s.id) AS blog_count
      FROM studies s
      LEFT JOIN study_quality_scores q ON q.study_id = s.id
      WHERE s.id = ${studyId}
      LIMIT 1
    `).then((r: any) => r.rows ?? r);

    if (!row) return res.status(404).json({ error: "Study not found" });

    // Category gap: same formula as blog-recommendation-system. A category
    // with lots of studies but few blogs scores high. 0.5 is the neutral
    // prior used when a category has too few studies to compute reliably.
    const [catRow] = await db.execute<{
      study_count: number;
      blog_count: number;
    }>(sql`
      SELECT
        COUNT(DISTINCT s.id)::int AS study_count,
        COUNT(DISTINCT b.id)::int AS blog_count
      FROM studies s
      LEFT JOIN blog_articles b ON b.study_id = s.id
      WHERE COALESCE(s.category, 'General') = ${row.category || "General"}
    `).then((r: any) => r.rows ?? r);

    const studyCount = Number(catRow?.study_count ?? 0);
    const catBlogCount = Number(catRow?.blog_count ?? 0);
    const categoryGap =
      studyCount >= 2
        ? Math.max(0, 1 - catBlogCount / (studyCount * 1.5))
        : 0.5;

    // GSC opportunity signal: how much search traffic do existing blogs
    // in this category already pull? High impressions = proven demand
    // for the topic; high clicks = winning page exists already (saturated).
    // Both are useful signals before generating new content. Wrapped in
    // try/catch so a missing gsc_query_metrics table doesn't break the
    // existing context endpoint.
    let categoryGscImpressions30d = 0;
    let categoryGscClicks30d = 0;
    try {
      const [gscRow] = await db.execute<{
        impressions: number;
        clicks: number;
      }>(sql`
        SELECT
          COALESCE(SUM(g.impressions), 0)::int AS impressions,
          COALESCE(SUM(g.clicks), 0)::int AS clicks
        FROM gsc_query_metrics g
        INNER JOIN blog_articles b
          ON REGEXP_REPLACE(g.page, '^https?://[^/]+', '') = '/blog/' || b.slug
        WHERE COALESCE(b.study_id, 0) IN (
          SELECT id FROM studies WHERE COALESCE(category, 'General') = ${row.category || "General"}
        )
        AND g.date >= TO_CHAR(CURRENT_DATE - INTERVAL '30 days', 'YYYY-MM-DD')
      `).then((r: any) => r.rows ?? r);
      categoryGscImpressions30d = Number(gscRow?.impressions ?? 0);
      categoryGscClicks30d = Number(gscRow?.clicks ?? 0);
    } catch (gscErr) {
      console.warn(
        "study-context: GSC enrichment failed:",
        gscErr instanceof Error ? gscErr.message : gscErr,
      );
    }

    res.json({
      studyId,
      title: row.title,
      category: row.category,
      qualityScore: row.overall_score != null ? Number(row.overall_score) : null,
      redFlagCount: row.red_flag_count != null ? Number(row.red_flag_count) : 0,
      scoreConfidence: row.score_confidence,
      existingBlogCount: Number(row.blog_count),
      categoryGap: Math.round(categoryGap * 100) / 100,
      categoryGscImpressions30d,
      categoryGscClicks30d,
    });
  } catch (error) {
    console.error("Error fetching study context:", error);
    res.status(500).json({ error: "Failed to fetch study context" });
  }
});

/**
 * Status counts for the admin tab filter. Returns a single object with
 * counts for each bucket so the UI can render badges next to each tab
 * without making 4 separate queries.
 */
router.get("/status-counts", requireAdmin, async (_req, res) => {
  try {
    const [row] = await db.execute<{
      drafts: number;
      scheduled: number;
      published: number;
      archived: number;
    }>(sql`
      SELECT
        COUNT(*) FILTER (WHERE is_published = false AND scheduled_for IS NULL AND is_archived = false)::int AS drafts,
        COUNT(*) FILTER (WHERE is_published = false AND scheduled_for IS NOT NULL AND is_archived = false)::int AS scheduled,
        COUNT(*) FILTER (WHERE is_published = true AND is_archived = false)::int AS published,
        COUNT(*) FILTER (WHERE is_archived = true)::int AS archived
      FROM ${blogArticles}
    `).then((r: any) => r.rows ?? r);
    res.json({
      drafts: Number(row?.drafts ?? 0),
      scheduled: Number(row?.scheduled ?? 0),
      published: Number(row?.published ?? 0),
      archived: Number(row?.archived ?? 0),
    });
  } catch (error) {
    console.error("Error fetching status counts:", error);
    res.status(500).json({ error: "Failed to fetch status counts" });
  }
});

/**
 * Get blogs filtered by study category (e.g., "cardiovascular", "neurological")
 * Joins blog_articles with studies to filter by the study's category field
 */
router.get("/by-category/:category", async (req, res) => {
  try {
    const categorySlug = req.params.category;
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit as string) || 20));
    const offset = (page - 1) * limit;

    if (!categorySlug) {
      return res.status(400).json({
        success: false,
        error: "Category is required",
      });
    }

    // Convert slug back to category name for matching (e.g., "anti-inflammatory" -> "anti-inflammatory")
    // Categories in the DB may use spaces or underscores; try matching with flexible ILIKE
    const categoryPattern = categorySlug.replace(/-/g, "%");

    // Fetch blogs joined with studies, filtered by study category
    const blogs = await db
      .select({
        id: blogArticles.id,
        title: blogArticles.title,
        slug: blogArticles.slug,
        summary: blogArticles.summary,
        imageUrl: blogArticles.imageUrl,
        imageAlt: blogArticles.imageAlt,
        articleType: blogArticles.articleType,
        createdAt: blogArticles.createdAt,
        viewCount: blogArticles.viewCount,
        semanticKeywords: blogArticles.semanticKeywords,
        authorBio: blogArticles.authorBio,
        studyId: blogArticles.studyId,
        studyCategory: studies.category,
      })
      .from(blogArticles)
      .innerJoin(studies, eq(blogArticles.studyId, studies.id))
      .where(
        and(
          eq(blogArticles.isPublished, true),
          sql`LOWER(${studies.category}) ILIKE LOWER(${categoryPattern})`
        )
      )
      .orderBy(desc(blogArticles.createdAt))
      .limit(limit)
      .offset(offset);

    // Get total count
    const [totalResult] = await db
      .select({ count: count() })
      .from(blogArticles)
      .innerJoin(studies, eq(blogArticles.studyId, studies.id))
      .where(
        and(
          eq(blogArticles.isPublished, true),
          sql`LOWER(${studies.category}) ILIKE LOWER(${categoryPattern})`
        )
      );

    res.json({
      data: blogs,
      total: totalResult.count,
      page,
      limit,
      totalPages: Math.ceil(totalResult.count / limit),
      category: categorySlug,
    });
  } catch (error) {
    console.error("Error fetching blogs by category:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch blogs by category",
    });
  }
});

/**
 * Get all study categories that have associated blog articles, with blog counts
 * Returns [{ name, slug, count }]
 */
router.get("/study-categories", async (req, res) => {
  try {
    const categories = await db
      .select({
        name: studies.category,
        count: count(),
      })
      .from(blogArticles)
      .innerJoin(studies, eq(blogArticles.studyId, studies.id))
      .where(
        and(
          eq(blogArticles.isPublished, true),
          isNotNull(studies.category)
        )
      )
      .groupBy(studies.category)
      .orderBy(desc(count()));

    const formattedCategories = categories
      .filter((cat) => cat.name && cat.name.trim() !== "")
      .map((cat) => ({
        name: cat.name,
        slug: cat.name.toLowerCase().replace(/[\s_]+/g, "-").replace(/[^a-z0-9-]/g, ""),
        count: cat.count,
      }));

    res.json({
      success: true,
      categories: formattedCategories,
    });
  } catch (error) {
    console.error("Error fetching study categories for blogs:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch study categories",
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
 * Delete a single blog by id. Used by the Delete action on the admin
 * list. Was previously missing — the front-end DELETE call was 404ing
 * silently.
 */
router.delete("/:id(\\d+)", requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid blog ID" });
    const result = await db
      .delete(blogArticles)
      .where(eq(blogArticles.id, id))
      .returning({ id: blogArticles.id });
    if (result.length === 0) {
      return res.status(404).json({ error: "Blog not found" });
    }
    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting blog:", error);
    res.status(500).json({ error: "Failed to delete blog" });
  }
});

/**
 * Promote an existing blog to pillar status and seed cluster drafts.
 *
 * Workflow:
 *   1. Mark this blog isPillar=true, stamp promotedToPillarAt
 *   2. Find 3-5 related under-served studies in the same category
 *      (excluding the pillar's own source study) using the existing
 *      blog-recommendation-system ranking
 *   3. For each candidate study, generate a single blog draft via the
 *      existing blog-generator-enhanced. Drafts are unpublished and
 *      tagged with pillarBlogId so the pillar editor can show them.
 *   4. Return the pillar + freshly-created cluster IDs.
 *
 * Generation runs synchronously with a 60-second cap. Anything that times
 * out can be retried by clicking Promote again on a still-pillar post —
 * the function is idempotent on isPillar but additive on cluster count.
 */
router.post("/:id(\\d+)/promote-to-pillar", requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid blog ID" });

    // Pillar must exist and have a backing study (we use the study's
    // category to scope cluster candidate selection).
    const [pillar] = await db
      .select()
      .from(blogArticles)
      .where(eq(blogArticles.id, id))
      .limit(1);
    if (!pillar) return res.status(404).json({ error: "Blog not found" });

    const [pillarStudy] = await db
      .select({ id: studies.id, category: studies.category })
      .from(studies)
      .where(eq(studies.id, pillar.studyId))
      .limit(1);
    if (!pillarStudy?.category) {
      return res.status(400).json({
        error:
          "Pillar's source study has no category — can't scope cluster generation. Add a category to the study first.",
      });
    }

    // Mark pillar (idempotent — re-clicking just refreshes the timestamp).
    await db
      .update(blogArticles)
      .set({
        isPillar: true,
        promotedToPillarAt: sql`COALESCE(${blogArticles.promotedToPillarAt}, NOW())`,
        pillarBlogId: null, // a pillar can't be its own cluster
        updatedAt: new Date(),
      })
      .where(eq(blogArticles.id, id));

    // Find candidate studies in the same category that don't already have
    // a blog under this pillar. Prefer studies with quality scores; rank by
    // (quality desc, blog count asc, recency desc) — same idea as the
    // blog-recommendation-system but scoped to this category.
    const candidates = await db.execute<{
      id: number;
      title: string;
    }>(sql`
      SELECT s.id, s.title
      FROM studies s
      LEFT JOIN study_quality_scores q ON q.study_id = s.id
      LEFT JOIN (
        SELECT study_id, COUNT(*)::int AS cnt
        FROM blog_articles
        WHERE pillar_blog_id = ${id} OR study_id = ${pillarStudy.id}
        GROUP BY study_id
      ) b ON b.study_id = s.id
      WHERE s.id <> ${pillarStudy.id}
        AND LOWER(COALESCE(s.category, '')) = LOWER(${pillarStudy.category})
        AND COALESCE(b.cnt, 0) = 0
      ORDER BY
        q.overall_score DESC NULLS LAST,
        s.citation_count DESC NULLS LAST,
        s.id DESC
      LIMIT 5
    `).then((r: any) => r.rows ?? r);

    if (candidates.length === 0) {
      return res.json({
        success: true,
        pillarId: id,
        clusterIds: [],
        message:
          "Marked as pillar, but no eligible cluster candidates found in this category. You can still write cluster posts manually.",
      });
    }

    // Lazy import to avoid circular deps — and so the response can ship
    // partial success if generation fails partway through.
    const { generateBlogArticlesForStudy } = await import("../services/blog-generator-enhanced");

    const clusterIds: number[] = [];
    const generationErrors: Array<{ studyId: number; error: string }> = [];

    for (const candidate of candidates) {
      try {
        // Fetch full study record (generator needs the whole row)
        const [fullStudy] = await db
          .select()
          .from(studies)
          .where(eq(studies.id, candidate.id))
          .limit(1);
        if (!fullStudy) continue;

        // Cap to 60s per cluster — generator usually takes 15-30s.
        const result = (await Promise.race([
          generateBlogArticlesForStudy(fullStudy as any, {
            count: 1,
            articleTypes: ["science_explainer"], // safe default; admin edits later
            fallbackToBasic: true,
          }),
          new Promise((resolve) => setTimeout(() => resolve(null), 60_000)),
        ])) as Awaited<ReturnType<typeof generateBlogArticlesForStudy>> | null;

        if (!result || result.articles.length === 0) {
          generationErrors.push({
            studyId: candidate.id,
            error: "Generator returned no articles (timeout or AI error)",
          });
          continue;
        }

        // Persist each generated article as an unpublished cluster post
        // tagged to this pillar. Generator returns Insert objects, not yet
        // saved — we add the pillar fields here.
        for (const article of result.articles) {
          try {
            const [saved] = await db
              .insert(blogArticles)
              .values({
                ...article,
                pillarBlogId: id,
                isPublished: false,
                isArchived: false,
              })
              .returning({ id: blogArticles.id });
            clusterIds.push(saved.id);
          } catch (dbErr: any) {
            // 23505 = duplicate slug — generator collided. Skip.
            if (dbErr?.code !== "23505") {
              generationErrors.push({
                studyId: candidate.id,
                error: dbErr?.message ?? "DB insert failed",
              });
            }
          }
        }
      } catch (err: any) {
        generationErrors.push({
          studyId: candidate.id,
          error: err?.message ?? String(err),
        });
      }
    }

    res.json({
      success: true,
      pillarId: id,
      clusterIds,
      generated: clusterIds.length,
      candidates: candidates.length,
      errors: generationErrors,
    });
  } catch (err) {
    console.error("Promote-to-pillar error:", err);
    res.status(500).json({
      error: err instanceof Error ? err.message : "Failed to promote to pillar",
    });
  }
});

/**
 * Demote a pillar back to a regular post. Removes the isPillar flag but
 * leaves cluster posts intact (they keep their pillarBlogId — admin can
 * manually unlink or repromote to another pillar).
 */
router.post("/:id(\\d+)/demote-from-pillar", requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid blog ID" });
    await db
      .update(blogArticles)
      .set({ isPillar: false, updatedAt: new Date() })
      .where(eq(blogArticles.id, id));
    res.json({ success: true });
  } catch (err) {
    console.error("Demote-from-pillar error:", err);
    res.status(500).json({ error: "Failed to demote pillar" });
  }
});

/**
 * All pillars + per-pillar cluster counts, in a single round-trip.
 *
 * The pillar dashboard at /admin/seo/pillars renders this as a table.
 * Doing per-pillar /:id/cluster fetches would be N+1 queries; this
 * single LEFT JOIN + GROUP BY scales fine for the realistic pillar
 * count (low hundreds at most).
 */
router.get("/pillars", requireAdmin, async (_req, res) => {
  // CTEs pre-aggregate the metrics tables so the LEFT JOINs are 1-to-1
  // on path — without that, joining gsc_query_metrics directly would
  // multiply rows by (queries × days) and inflate the cluster counts.
  const FULL_QUERY = sql`
    WITH gsc_agg AS (
      SELECT
        REGEXP_REPLACE(page, '^https?://[^/]+', '') AS path,
        SUM(clicks)::int AS clicks,
        SUM(impressions)::int AS impressions,
        AVG(position::float)::float AS avg_position
      FROM gsc_query_metrics
      WHERE date >= TO_CHAR(CURRENT_DATE - INTERVAL '30 days', 'YYYY-MM-DD')
      GROUP BY path
    ),
    ga4_agg AS (
      SELECT
        page AS path,
        SUM(sessions)::int AS sessions,
        SUM(engaged_sessions)::int AS engaged_sessions
      FROM ga4_page_metrics
      WHERE date >= TO_CHAR(CURRENT_DATE - INTERVAL '30 days', 'YYYY-MM-DD')
      GROUP BY page
    )
    SELECT
      p.id,
      p.title,
      p.slug,
      p.is_published AS "isPublished",
      p.published_at AS "publishedAt",
      p.promoted_to_pillar_at AS "promotedToPillarAt",
      p.view_count AS "viewCount",
      COUNT(c.id)::int AS "totalClusters",
      COUNT(c.id) FILTER (WHERE c.is_published = true)::int AS "publishedClusters",
      COUNT(c.id) FILTER (WHERE c.is_published = false AND c.scheduled_for IS NULL)::int AS "draftClusters",
      COUNT(c.id) FILTER (WHERE c.is_published = false AND c.scheduled_for IS NOT NULL)::int AS "scheduledClusters",
      MAX(c.published_at) AS "lastClusterPublishedAt",
      COALESCE(g.clicks, 0)::int AS "gscClicks30d",
      COALESCE(g.impressions, 0)::int AS "gscImpressions30d",
      g.avg_position AS "gscAvgPosition",
      COALESCE(a.sessions, 0)::int AS "ga4Sessions30d",
      COALESCE(a.engaged_sessions, 0)::int AS "ga4EngagedSessions30d"
    FROM blog_articles p
    LEFT JOIN blog_articles c ON c.pillar_blog_id = p.id
    LEFT JOIN gsc_agg g ON g.path = '/blog/' || p.slug
    LEFT JOIN ga4_agg a ON a.path = '/blog/' || p.slug
    WHERE p.is_pillar = true
    GROUP BY p.id, g.clicks, g.impressions, g.avg_position, a.sessions, a.engaged_sessions
    ORDER BY p.promoted_to_pillar_at DESC NULLS LAST
  `;
  const FALLBACK_QUERY = sql`
    SELECT
      p.id,
      p.title,
      p.slug,
      p.is_published AS "isPublished",
      p.published_at AS "publishedAt",
      p.promoted_to_pillar_at AS "promotedToPillarAt",
      p.view_count AS "viewCount",
      COUNT(c.id)::int AS "totalClusters",
      COUNT(c.id) FILTER (WHERE c.is_published = true)::int AS "publishedClusters",
      COUNT(c.id) FILTER (WHERE c.is_published = false AND c.scheduled_for IS NULL)::int AS "draftClusters",
      COUNT(c.id) FILTER (WHERE c.is_published = false AND c.scheduled_for IS NOT NULL)::int AS "scheduledClusters",
      MAX(c.published_at) AS "lastClusterPublishedAt",
      0::int AS "gscClicks30d",
      0::int AS "gscImpressions30d",
      NULL::float AS "gscAvgPosition",
      0::int AS "ga4Sessions30d",
      0::int AS "ga4EngagedSessions30d"
    FROM blog_articles p
    LEFT JOIN blog_articles c ON c.pillar_blog_id = p.id
    WHERE p.is_pillar = true
    GROUP BY p.id
    ORDER BY p.promoted_to_pillar_at DESC NULLS LAST
  `;
  try {
    let rows: any[];
    try {
      const result: any = await db.execute(FULL_QUERY);
      rows = result?.rows ?? result ?? [];
    } catch (metricsErr) {
      // Metrics tables don't exist yet (fresh deploy before ensureGa4Tables /
      // ensureGscTables runs) — degrade gracefully to the no-metrics query.
      console.warn("Pillars: metrics tables unavailable, falling back:", metricsErr instanceof Error ? metricsErr.message : metricsErr);
      const result: any = await db.execute(FALLBACK_QUERY);
      rows = result?.rows ?? result ?? [];
    }
    res.json({ data: rows });
  } catch (err) {
    console.error("Pillar list error:", err);
    res.status(500).json({ error: "Failed to fetch pillars" });
  }
});

/**
 * Cluster cohort — pillar metadata + the list of cluster posts that
 * declare this blog as their pillar. Used by the pillar editor side panel
 * and (later) the pillar dashboard.
 */
router.get("/:id(\\d+)/cluster", requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid blog ID" });

    const [pillar] = await db
      .select({
        id: blogArticles.id,
        title: blogArticles.title,
        slug: blogArticles.slug,
        isPillar: blogArticles.isPillar,
        promotedToPillarAt: blogArticles.promotedToPillarAt,
        viewCount: blogArticles.viewCount,
      })
      .from(blogArticles)
      .where(eq(blogArticles.id, id))
      .limit(1);
    if (!pillar) return res.status(404).json({ error: "Blog not found" });

    const clusters = await db
      .select({
        id: blogArticles.id,
        title: blogArticles.title,
        slug: blogArticles.slug,
        isPublished: blogArticles.isPublished,
        publishedAt: blogArticles.publishedAt,
        scheduledFor: blogArticles.scheduledFor,
        viewCount: blogArticles.viewCount,
        articleType: blogArticles.articleType,
        createdAt: blogArticles.createdAt,
      })
      .from(blogArticles)
      .where(eq(blogArticles.pillarBlogId, id))
      .orderBy(desc(blogArticles.createdAt));

    res.json({
      pillar,
      clusters,
      counts: {
        total: clusters.length,
        published: clusters.filter((c) => c.isPublished).length,
        draft: clusters.filter((c) => !c.isPublished && !c.scheduledFor).length,
        scheduled: clusters.filter((c) => !c.isPublished && c.scheduledFor).length,
      },
    });
  } catch (err) {
    console.error("Cluster lookup error:", err);
    res.status(500).json({ error: "Failed to fetch cluster cohort" });
  }
});

/**
 * Patch a single blog's lifecycle status without resending the whole body.
 * The big PUT /:id requires title/summary/content all present, which made
 * the publish toggle on the list page silently fail validation. This is
 * a small, focused endpoint that just changes status fields.
 *
 * Body: { isPublished?, isArchived?, scheduledFor?: ISO string | null }
 *   • Setting isPublished=true also stamps publishedAt = NOW() if it was null.
 *   • Setting isPublished=false clears scheduledFor (avoids "schedule to
 *     a past time" auto-republish).
 *   • Setting isArchived=true forces isPublished=false.
 */
router.patch("/:id(\\d+)/status", requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid blog ID" });

    const schema = z.object({
      isPublished: z.boolean().optional(),
      isArchived: z.boolean().optional(),
      scheduledFor: z.string().datetime().nullable().optional(),
    });
    const data = schema.parse(req.body);

    const set: any = { updatedAt: new Date() };
    if (data.isArchived === true) {
      set.isArchived = true;
      set.isPublished = false;
    } else if (data.isArchived === false) {
      set.isArchived = false;
    }
    if (data.isPublished === true) {
      set.isPublished = true;
      // Stamp publishedAt only if not already set (preserve original go-live).
      set.publishedAt = sql`COALESCE(${blogArticles.publishedAt}, NOW())`;
      set.scheduledFor = null;
    } else if (data.isPublished === false && data.isArchived !== true) {
      set.isPublished = false;
    }
    if (data.scheduledFor === null) {
      set.scheduledFor = null;
    } else if (data.scheduledFor) {
      set.scheduledFor = new Date(data.scheduledFor);
    }

    const [row] = await db
      .update(blogArticles)
      .set(set)
      .where(eq(blogArticles.id, id))
      .returning();
    if (!row) return res.status(404).json({ error: "Blog not found" });
    res.json({ success: true, data: row });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    console.error("Error patching blog status:", error);
    res.status(500).json({ error: "Failed to update blog status" });
  }
});

/**
 * Bulk lifecycle update across many blogs in one round-trip.
 * Body: { ids: number[], action: 'publish' | 'unpublish' | 'archive' | 'unarchive' | 'delete' | 'schedule', scheduledFor?: ISO string }
 * Returns: { affected: number }
 */
router.post("/bulk-update", requireAdmin, async (req, res) => {
  try {
    const schema = z.object({
      ids: z.array(z.number().int().positive()).min(1).max(500),
      action: z.enum([
        "publish",
        "unpublish",
        "archive",
        "unarchive",
        "delete",
        "schedule",
      ]),
      scheduledFor: z.string().datetime().optional(),
    });
    const { ids, action, scheduledFor } = schema.parse(req.body);

    const inIds = sql`${blogArticles.id} IN (${sql.join(
      ids.map((id) => sql`${id}`),
      sql`, `,
    )})`;

    let affected = 0;
    if (action === "delete") {
      const result = await db
        .delete(blogArticles)
        .where(inIds)
        .returning({ id: blogArticles.id });
      affected = result.length;
    } else {
      const set: any = { updatedAt: new Date() };
      if (action === "publish") {
        set.isPublished = true;
        set.publishedAt = sql`COALESCE(${blogArticles.publishedAt}, NOW())`;
        set.scheduledFor = null;
        set.isArchived = false;
      } else if (action === "unpublish") {
        set.isPublished = false;
      } else if (action === "archive") {
        set.isArchived = true;
        set.isPublished = false;
      } else if (action === "unarchive") {
        set.isArchived = false;
      } else if (action === "schedule") {
        if (!scheduledFor) {
          return res.status(400).json({ error: "scheduledFor required for action=schedule" });
        }
        const when = new Date(scheduledFor);
        if (when.getTime() <= Date.now()) {
          return res.status(400).json({ error: "scheduledFor must be a future time" });
        }
        set.scheduledFor = when;
        set.isPublished = false;
        set.isArchived = false;
      }
      const result = await db
        .update(blogArticles)
        .set(set)
        .where(inIds)
        .returning({ id: blogArticles.id });
      affected = result.length;
    }

    res.json({ success: true, affected });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    console.error("Error in bulk-update:", error);
    res.status(500).json({ error: "Failed to apply bulk update" });
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
