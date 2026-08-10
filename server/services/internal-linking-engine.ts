/**
 * Internal Linking Engine — Intelligent cross-linking for SEO
 *
 * Automatically generates internal links between:
 * - Studies → related studies (same condition/body system)
 * - Studies → blog posts (that reference the study)
 * - Blog posts → pillar pages (parent topic)
 * - Blog posts → related blog posts
 * - Category pages → studies and blogs
 *
 * Uses the smartLinks table to track and manage links.
 */

import { db } from "../db";
import { studies, blogArticles, smartLinks } from "../../shared/schema";
import { eq, sql, and, or, ilike, desc, ne, isNotNull } from "drizzle-orm";

const SITE_URL = process.env.SITE_URL || "https://hydrogenstudies.com";

interface LinkSuggestion {
  fromType: string;
  fromId: number;
  toType: string;
  toId: number;
  anchorText: string;
  context: string;
  relevanceScore: number;
  linkType: string;
}

/**
 * Generate internal links for a study page
 * Links to: related studies, relevant blog posts
 */
export async function generateStudyLinks(studyId: number): Promise<LinkSuggestion[]> {
  const [study] = await db.select().from(studies).where(eq(studies.id, studyId)).limit(1);
  if (!study) return [];

  const links: LinkSuggestion[] = [];

  // Find related studies by category
  const relatedStudies = await db.select({
    id: studies.id,
    title: studies.title,
    plainLanguageTitle: studies.plainLanguageTitle,
    slug: studies.slug,
    category: studies.category,
    outcome: studies.outcome,
  })
    .from(studies)
    .where(
      and(
        eq(studies.category, study.category),
        ne(studies.id, studyId),
      )
    )
    .orderBy(desc(studies.publishYear))
    .limit(5);

  for (const related of relatedStudies) {
    links.push({
      fromType: "study",
      fromId: studyId,
      toType: "study",
      toId: related.id,
      anchorText: related.plainLanguageTitle || related.title.substring(0, 80),
      context: `Related ${study.category} research`,
      relevanceScore: 80,
      linkType: "related",
    });
  }

  // Find blog posts that reference this study's topic
  const relatedBlogs = await db.select({
    id: blogArticles.id,
    title: blogArticles.title,
    slug: blogArticles.slug,
    studyId: blogArticles.studyId,
  })
    .from(blogArticles)
    .where(
      and(
        eq(blogArticles.isPublished, true),
        or(
          eq(blogArticles.studyId, studyId),
          ilike(blogArticles.title, `%${study.category}%`),
        )
      )
    )
    .limit(5);

  for (const blog of relatedBlogs) {
    links.push({
      fromType: "study",
      fromId: studyId,
      toType: "blog",
      toId: blog.id,
      anchorText: blog.title.substring(0, 80),
      context: blog.studyId === studyId ? "Blog article about this study" : "Related blog article",
      relevanceScore: blog.studyId === studyId ? 95 : 70,
      linkType: blog.studyId === studyId ? "citation" : "related",
    });
  }

  return links;
}

/**
 * Generate internal links for a blog post
 * Links to: source study, related studies, pillar page, related blogs
 */
export async function generateBlogLinks(blogId: number): Promise<LinkSuggestion[]> {
  const [blog] = await db.select().from(blogArticles).where(eq(blogArticles.id, blogId)).limit(1);
  if (!blog) return [];

  const links: LinkSuggestion[] = [];

  // Link to source study
  if (blog.studyId) {
    const [sourceStudy] = await db.select({
      id: studies.id,
      title: studies.title,
      plainLanguageTitle: studies.plainLanguageTitle,
      slug: studies.slug,
    })
      .from(studies)
      .where(eq(studies.id, blog.studyId))
      .limit(1);

    if (sourceStudy) {
      links.push({
        fromType: "blog",
        fromId: blogId,
        toType: "study",
        toId: sourceStudy.id,
        anchorText: sourceStudy.plainLanguageTitle || sourceStudy.title.substring(0, 80),
        context: "Original research study",
        relevanceScore: 100,
        linkType: "citation",
      });
    }
  }

  // Find related blog posts scoped to the same topic — either articles about
  // the same source study, or articles about studies in the same category.
  // Without this filter every blog linked to the same 5 lowest-id published
  // blogs regardless of subject.
  // A blog with no source study has no study-scoped related set, so skip.
  const studyId = blog.studyId;
  if (studyId != null) {
    const [blogStudy] = await db.select({ category: studies.category })
      .from(studies)
      .where(eq(studies.id, studyId))
      .limit(1);

    const topicMatch = blogStudy?.category
      ? or(eq(blogArticles.studyId, studyId), eq(studies.category, blogStudy.category))
      : eq(blogArticles.studyId, studyId);

    const relatedBlogs = await db.select({
      id: blogArticles.id,
      title: blogArticles.title,
      slug: blogArticles.slug,
      articleType: blogArticles.articleType,
      studyId: blogArticles.studyId,
    })
      .from(blogArticles)
      .innerJoin(studies, eq(blogArticles.studyId, studies.id))
      .where(
        and(
          ne(blogArticles.id, blogId),
          eq(blogArticles.isPublished, true),
          topicMatch,
        )
      )
      .limit(5);

    for (const related of relatedBlogs) {
      const sameStudy = related.studyId === studyId;
      links.push({
        fromType: "blog",
        fromId: blogId,
        toType: "blog",
        toId: related.id,
        anchorText: related.title.substring(0, 80),
        context: sameStudy ? "More on this study" : "Related reading",
        relevanceScore: sameStudy ? 75 : 60,
        linkType: "related",
      });
    }
  }

  return links;
}

/**
 * Save link suggestions to the smartLinks table
 */
export async function saveLinks(suggestions: LinkSuggestion[]): Promise<number> {
  let saved = 0;

  for (const link of suggestions) {
    try {
      // Check if link already exists
      const [existing] = await db.select({ id: smartLinks.id })
        .from(smartLinks)
        .where(
          and(
            eq(smartLinks.fromType, link.fromType),
            eq(smartLinks.fromId, link.fromId),
            eq(smartLinks.toType, link.toType),
            eq(smartLinks.toId, link.toId),
          )
        )
        .limit(1);

      if (existing) continue;

      await db.insert(smartLinks).values({
        fromType: link.fromType,
        fromId: link.fromId,
        toType: link.toType,
        toId: link.toId,
        anchorText: link.anchorText,
        context: link.context,
        relevanceScore: link.relevanceScore,
        linkType: link.linkType,
        autoGenerated: true,
        isActive: true,
      });
      saved++;
    } catch (error) {
      // Skip duplicates silently
    }
  }

  return saved;
}

/**
 * Build internal links for all studies (batch)
 */
export async function buildAllStudyLinks(options: {
  batchSize?: number;
  onProgress?: (done: number, total: number) => void;
} = {}): Promise<{ processed: number; linksCreated: number }> {
  const { batchSize = 100, onProgress } = options;

  // Rotate coverage across the whole catalog instead of re-scanning the same
  // lowest-id rows every run. Order by least-recently-linked: studies that have
  // never been linked (no smartLinks row → NULL) come first, then the ones whose
  // most recent link is oldest. New links push a study to the back of the queue,
  // so the long tail is eventually processed.
  const allStudyIds = await db.select({ id: studies.id })
    .from(studies)
    .leftJoin(
      smartLinks,
      and(eq(smartLinks.fromType, "study"), eq(smartLinks.fromId, studies.id)),
    )
    .groupBy(studies.id)
    .orderBy(sql`max(${smartLinks.createdAt}) asc nulls first`, studies.id)
    .limit(batchSize);

  let linksCreated = 0;

  for (let i = 0; i < allStudyIds.length; i++) {
    const suggestions = await generateStudyLinks(allStudyIds[i].id);
    linksCreated += await saveLinks(suggestions);
    onProgress?.(i + 1, allStudyIds.length);
  }

  return { processed: allStudyIds.length, linksCreated };
}

/**
 * Build internal links for all blog posts (batch)
 */
export async function buildAllBlogLinks(options: {
  batchSize?: number;
  onProgress?: (done: number, total: number) => void;
} = {}): Promise<{ processed: number; linksCreated: number }> {
  const { batchSize = 100, onProgress } = options;

  // Rotate coverage least-recently-linked first (see buildAllStudyLinks) so the
  // scheduler doesn't re-scan the same 200 oldest published blogs every week.
  const allBlogIds = await db.select({ id: blogArticles.id })
    .from(blogArticles)
    .leftJoin(
      smartLinks,
      and(eq(smartLinks.fromType, "blog"), eq(smartLinks.fromId, blogArticles.id)),
    )
    .where(eq(blogArticles.isPublished, true))
    .groupBy(blogArticles.id)
    .orderBy(sql`max(${smartLinks.createdAt}) asc nulls first`, blogArticles.id)
    .limit(batchSize);

  let linksCreated = 0;

  for (let i = 0; i < allBlogIds.length; i++) {
    const suggestions = await generateBlogLinks(allBlogIds[i].id);
    linksCreated += await saveLinks(suggestions);
    onProgress?.(i + 1, allBlogIds.length);
  }

  return { processed: allBlogIds.length, linksCreated };
}

/**
 * Get internal links for a piece of content (used by frontend for "Related" sections)
 */
export async function getLinksFor(contentType: string, contentId: number): Promise<Array<{
  type: string;
  id: number;
  anchorText: string;
  linkType: string;
  relevanceScore: number;
  url: string;
}>> {
  const links = await db.select()
    .from(smartLinks)
    .where(
      and(
        eq(smartLinks.fromType, contentType),
        eq(smartLinks.fromId, contentId),
        eq(smartLinks.isActive, true),
      )
    )
    .orderBy(desc(smartLinks.relevanceScore))
    .limit(10);

  return links.map(link => {
    let url = "";
    if (link.toType === "study") {
      url = `/study/id/${link.toId}`;
    } else if (link.toType === "blog") {
      url = `/blog/${link.toId}`;
    }

    return {
      type: link.toType,
      id: link.toId,
      anchorText: link.anchorText,
      linkType: link.linkType || "related",
      relevanceScore: link.relevanceScore || 0,
      url,
    };
  });
}
