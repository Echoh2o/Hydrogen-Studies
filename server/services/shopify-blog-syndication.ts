/**
 * Shopify blog syndication (all-in-on-echowater strategy).
 *
 * Pushes reviewed, published Hydrogen Studies articles into echowater.com's
 * NATIVE Shopify blog via the Admin REST API, so the store's own domain
 * accrues the content and its rankings. This is the primary "content on
 * echowater.com" mechanism — unlike the App Proxy, articles created here are
 * first-class store pages with theme, nav, and /blogs/... URLs.
 *
 * Auth follows shopify-client.ts: SHOPIFY_ACCESS_TOKEN (custom-app token,
 * X-Shopify-Access-Token header) + SHOPIFY_STORE_URL. The token additionally
 * needs the write_content scope; a 403 from Shopify means the scope is
 * missing. Optional: SHOPIFY_SYNDICATION_BLOG_HANDLE picks the target blog
 * (defaults to the store's first blog).
 *
 * Safety rails:
 *  - no-ops (isEnabled() false) until the env vars exist,
 *  - only isPublished articles can be syndicated,
 *  - an article is never pushed twice (syndicatedUrl set) unless force,
 *  - body HTML is markdown→HTML (marked) then sanitized with the shared
 *    DOMPurify allowlist before leaving our system.
 */

import { marked } from "marked";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { blogArticles, studies } from "@shared/schema";
import { fetchWithTimeout } from "../utils/http";
import { sanitizeArticleHtml } from "../utils/sanitize-html";
import { escapeHtml, escapeAttr } from "../utils/html-safety";
import { logger } from "../utils/logger";
import { ECHOWATER_ORIGIN } from "@shared/echo-products";

const TAG = "BlogSyndication";
const API_VERSION = "2024-10";
const HYDROGENSTUDIES_ORIGIN = "https://hydrogenstudies.com";

function storeHost(): string {
  const raw = (process.env.SHOPIFY_STORE_URL || "").trim();
  if (!raw) throw new Error("SHOPIFY_STORE_URL not set");
  let host = raw.replace(/^https?:\/\//i, "").replace(/\/$/, "");
  if (!host.includes(".")) host = `${host}.myshopify.com`;
  return host;
}

function adminBase(): string {
  return `https://${storeHost()}/admin/api/${API_VERSION}`;
}

function accessToken(): string {
  const t = (process.env.SHOPIFY_ACCESS_TOKEN || "").trim();
  if (!t) throw new Error("SHOPIFY_ACCESS_TOKEN not set");
  return t;
}

/** True iff the env needed to push into the store blog is present. */
export function isSyndicationEnabled(): boolean {
  return Boolean(process.env.SHOPIFY_ACCESS_TOKEN && process.env.SHOPIFY_STORE_URL);
}

async function shopifyRequest<T>(
  method: "GET" | "POST",
  path: string,
  body?: unknown,
): Promise<T> {
  const res = await fetchWithTimeout(`${adminBase()}${path}`, {
    method,
    headers: {
      "X-Shopify-Access-Token": accessToken(),
      "Content-Type": "application/json",
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    if (res.status === 403) {
      throw new Error(
        `Shopify Admin API 403 on ${path} — the access token likely lacks the write_content/read_content scope`,
      );
    }
    throw new Error(`Shopify Admin API ${res.status} on ${path}: ${detail.slice(0, 300)}`);
  }
  return (await res.json()) as T;
}

interface ShopifyBlogRef {
  id: number;
  handle: string;
  title: string;
}

let cachedBlog: ShopifyBlogRef | null = null;

/** Resolve the target store blog (by SHOPIFY_SYNDICATION_BLOG_HANDLE, else first). */
export async function resolveTargetBlog(): Promise<ShopifyBlogRef> {
  if (cachedBlog) return cachedBlog;
  const wanted = (process.env.SHOPIFY_SYNDICATION_BLOG_HANDLE || "").trim().toLowerCase();
  const data = await shopifyRequest<{ blogs: ShopifyBlogRef[] }>("GET", "/blogs.json");
  if (!data.blogs?.length) {
    throw new Error("The store has no blogs — create one in Shopify admin first");
  }
  const blog = wanted
    ? data.blogs.find((b) => b.handle.toLowerCase() === wanted)
    : data.blogs[0];
  if (!blog) {
    throw new Error(
      `No store blog with handle "${wanted}" (available: ${data.blogs.map((b) => b.handle).join(", ")})`,
    );
  }
  cachedBlog = blog;
  return blog;
}

export interface SyndicationResult {
  status: "pushed" | "skipped";
  reason?: string;
  articleId: number;
  storeUrl?: string;
}

/**
 * Push one published article into the store blog. Never double-pushes unless
 * force. Returns the store URL on success and persists syndicatedUrl/At.
 */
export async function syndicateArticle(
  articleId: number,
  opts: { force?: boolean } = {},
): Promise<SyndicationResult> {
  if (!isSyndicationEnabled()) {
    return {
      status: "skipped",
      reason: "Syndication disabled: SHOPIFY_ACCESS_TOKEN / SHOPIFY_STORE_URL not set",
      articleId,
    };
  }

  const article = await db.query.blogArticles.findFirst({
    where: eq(blogArticles.id, articleId),
  });
  if (!article) return { status: "skipped", reason: "Article not found", articleId };
  if (!article.isPublished) {
    return { status: "skipped", reason: "Article is not published — review it first", articleId };
  }
  if (article.syndicatedUrl && !opts.force) {
    return {
      status: "skipped",
      reason: `Already syndicated (${article.syndicatedUrl}) — pass force to re-push`,
      articleId,
      storeUrl: article.syndicatedUrl,
    };
  }

  // Markdown → HTML → shared DOMPurify allowlist. The attribution footer
  // links the real study + our research library (the cross-domain citation).
  const bodyHtml = sanitizeArticleHtml(await marked.parse(article.content || ""));
  let attribution = "";
  if (article.studyId != null) {
    const study = await db.query.studies.findFirst({ where: eq(studies.id, article.studyId) });
    if (study?.slug) {
      attribution =
        `<hr><p><em>Based on <a href="${escapeAttr(`${HYDROGENSTUDIES_ORIGIN}/study/${study.slug}?utm_source=echowater&utm_medium=blog`)}">` +
        `${escapeHtml(study.title)}</a> — explore the full study database at ` +
        `<a href="${escapeAttr(`${HYDROGENSTUDIES_ORIGIN}?utm_source=echowater&utm_medium=blog`)}">Hydrogen Studies</a>.</em></p>`;
    }
  }

  const blog = await resolveTargetBlog();
  const created = await shopifyRequest<{ article: { id: number; handle: string } }>(
    "POST",
    `/blogs/${blog.id}/articles.json`,
    {
      article: {
        title: article.title,
        // Keep our slug so the store URL is predictable and stable.
        handle: article.slug,
        body_html: bodyHtml + attribution,
        tags: ["hydrogen-research", article.articleType].filter(Boolean).join(", "),
        published: true,
        summary_html: article.summary ? `<p>${escapeHtml(article.summary)}</p>` : undefined,
      },
    },
  );

  const storeUrl = `${ECHOWATER_ORIGIN}/blogs/${blog.handle}/${created.article.handle}`;
  await db
    .update(blogArticles)
    .set({ syndicatedUrl: storeUrl, syndicatedAt: new Date() })
    .where(eq(blogArticles.id, articleId));

  logger.info("Article syndicated to store blog", TAG, { articleId, storeUrl });
  return { status: "pushed", articleId, storeUrl };
}

export interface SyndicationStatus {
  enabled: boolean;
  syndicatedCount: number;
  lastSyndicatedAt: string | null;
  targetBlogHandle: string | null;
}

export async function getSyndicationStatus(): Promise<SyndicationStatus> {
  const rows = await db
    .select({ url: blogArticles.syndicatedUrl, at: blogArticles.syndicatedAt })
    .from(blogArticles)
    .where(eq(blogArticles.isPublished, true));
  const syndicated = rows.filter((r) => r.url);
  const last = syndicated
    .map((r) => r.at)
    .filter((d): d is Date => d instanceof Date)
    .sort((a, b) => b.getTime() - a.getTime())[0];
  let targetBlogHandle: string | null = null;
  if (isSyndicationEnabled()) {
    try {
      targetBlogHandle = (await resolveTargetBlog()).handle;
    } catch {
      targetBlogHandle = null;
    }
  }
  return {
    enabled: isSyndicationEnabled(),
    syndicatedCount: syndicated.length,
    lastSyndicatedAt: last ? last.toISOString() : null,
    targetBlogHandle,
  };
}
