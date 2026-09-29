/**
 * SEO Body Renderer — Generates real HTML body content for crawler requests
 *
 * Injects H1, content, internal links, breadcrumbs, and footer into the
 * SPA shell so search engine crawlers see fully-formed pages, not an empty div.
 */

import { db } from "../db";
import { headingId } from "../../shared/heading-id";
import { sql } from "drizzle-orm";
import { sanitizeArticleHtml } from "../utils/sanitize-html";
import { marked } from "marked";
import {
  ECHOWATER_ORIGIN,
  ECHO_PRODUCTS,
  echoProductUrl,
  pageContextFromPath,
} from "../../shared/echo-products";
import {
  demoteH1InHtml,
  rewriteEchoLinksInHtml,
  stripDeadBlogLinksInHtml,
} from "../../shared/content-links";
import {
  EDITORIAL_TEAM,
  abstractExcerpt,
  blogByline,
  formatLongDate,
  isoDate,
  normalizeDoi,
  studySourceLink,
  studyUpdatedAt,
  withoutPlaceholders,
  type BlogByline,
} from "../../shared/seo-markup";
import { isBridgeAllowed } from "../../shared/bridge-policy";
import { getHydrogenForTopic } from "../../shared/hydrogen-for-topics";
import {
  CONDITION_HUB_FAQ_HEADING,
  CONDITION_HUB_OWNER_GUIDE_LEAD,
  CONDITION_HUB_SOURCES_HEADING,
  CONDITION_HUB_STUDIES_HEADING,
  conditionHubByline,
  conditionHubSourceId,
  conditionHubSourceLinks,
  getConditionHubIntro,
  type ConditionHubIntro,
} from "../../shared/condition-hub-intros";
import { getLiveBlogPredicate } from "../services/live-blog-index";
import { conditionHubTermsPattern } from "../utils/condition-hub-terms";
import {
  BODY_SYSTEM_HUBS,
  bodySystemHubName,
  bodySystemHubPathForValue,
  bodySystemLikePatterns,
  conditionHubForValue,
  exploreDetailCopy,
  exploreHubPath,
  exploreIndexCopy,
  findBodySystemHub,
  isExploreHubType,
  isHubSlugShape,
  isListedExploreHubType,
  LISTED_EXPLORE_HUB_SLUGS,
  listedExploreHubs,
  studyCountLabel,
  type BodySystemHub,
  type ConditionHubRef,
  type ExploreHubSummary,
  type ListedExploreHubType,
} from "../../shared/explore-hubs";

const SITE_URL = process.env.SITE_URL || "https://hydrogenstudies.com";

/**
 * The evidence-graded benefits guide. /benefits was merged into it (owner
 * approved 2026-09-28; the 301 is a redirects-table row), so template links
 * point at the final URL instead of hopping through the redirect.
 */
const BENEFITS_GUIDE_PATH = "/blog/molecular-hydrogen-benefits-guide-pillar";

// ── Utilities ─────────────────────────────────────────────────

function esc(str: string | null | undefined): string {
  if (!str) return "";
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function truncate(str: string, max: number): string {
  if (!str || str.length <= max) return str || "";
  return str.substring(0, max - 3) + "...";
}

function fmtDate(d: string | Date | null | undefined): string {
  if (!d) return "";
  const date = d instanceof Date ? d : new Date(d);
  if (isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

// ── Cached shared data ────────────────────────────────────────

let _topConditions: { name: string; slug: string }[] | null = null;
let _topConditionsAt = 0;

async function getTopConditions(): Promise<{ name: string; slug: string }[]> {
  if (_topConditions && Date.now() - _topConditionsAt < 30 * 60 * 1000) return _topConditions;
  try {
    const r = await db.execute(sql`
      SELECT name, slug FROM health_conditions
      WHERE slug IS NOT NULL
      ORDER BY study_count DESC NULLS LAST
      LIMIT 20
    `);
    _topConditions = (r.rows || []).map((row: any) => ({ name: row.name, slug: row.slug }));
    _topConditionsAt = Date.now();
  } catch {
    _topConditions = [];
  }
  return _topConditions!;
}

/** A health_conditions row — the canonical condition hubs. */
interface ConditionRow {
  slug: string;
  name: string;
  description: string | null;
  study_count: number;
}

let _conditionRows: ConditionRow[] | null = null;
let _conditionRowsAt = 0;

async function getConditionRows(): Promise<ConditionRow[]> {
  if (_conditionRows && Date.now() - _conditionRowsAt < 30 * 60 * 1000) return _conditionRows;
  const r = await db.execute(sql`
    SELECT name, slug, description, study_count FROM health_conditions WHERE slug IS NOT NULL
  `);
  _conditionRows = ((r.rows || []) as any[]).map((row) => ({
    slug: row.slug,
    name: row.name,
    description: row.description ?? null,
    study_count: Number(row.study_count) || 0,
  }));
  // Never cache an empty result (e.g. a boot-time prewarm that ran before the
  // 007 seed migration): the 404 predicate reads these lists, so a cached
  // empty list would 404 every real hub for 30 minutes.
  _conditionRowsAt = _conditionRows.length ? Date.now() : 0;
  return _conditionRows;
}

/**
 * WHERE clause of the ONE condition-hub study query: a study tagged with the
 * hub's name (the crawler's original rule) OR whose title / plain-language
 * title / condition tags name one of the hub's synonyms at a word start
 * (server/utils/condition-hub-terms.ts — the keyword fallback the SPA page
 * used). Excluded studies never match.
 */
function conditionHubWhere(row: ConditionRow) {
  const tagMatch = sql`array_to_string(health_conditions, ' ') ILIKE ${"%" + row.name + "%"}`;
  const pattern = conditionHubTermsPattern(row.slug, row.name);
  const termMatch = pattern
    ? sql` OR LOWER(COALESCE(title, '') || ' ' || COALESCE(plain_language_title, '') || ' ' || COALESCE(array_to_string(health_conditions, ' '), '')) ~ ${pattern}`
    : sql``;
  return sql`slug IS NOT NULL AND is_excluded = false AND (${tagMatch}${termMatch})`;
}

/** A study on a condition hub (crawler list + GET /api/explore/condition/:slug/studies). */
export interface ConditionHubStudy {
  slug: string;
  title: string;
  publish_year: number | null;
  journal: string | null;
  study_type: string | null;
  /** ≤300-char abstract excerpt ("" when there is no real abstract) — never the full abstract. */
  excerpt: string;
}

/**
 * The studies a condition hub lists — ONE query for the crawler page
 * (renderConditionPage) and the SPA page (GET /api/explore/condition/:slug/studies),
 * so both list the same studies in the same order: name-tagged studies
 * first, then newest. Null when the slug has no health_conditions row.
 */
export async function getConditionHubStudies(
  slug: string,
): Promise<{ hub: { slug: string; name: string; description: string | null }; studies: ConditionHubStudy[] } | null> {
  const row = (await getConditionRows()).find((r) => r.slug === slug);
  if (!row) return null;
  const r = await db.execute(sql`
    SELECT slug, COALESCE(plain_language_title, title) AS title, publish_year, journal, study_type, abstract
    FROM studies
    WHERE ${conditionHubWhere(row)}
    ORDER BY (array_to_string(health_conditions, ' ') ILIKE ${"%" + row.name + "%"}) DESC NULLS LAST,
             publish_year DESC NULLS LAST, id DESC
    LIMIT 100
  `);
  const studies = ((r.rows || []) as any[]).map((s) => ({
    slug: s.slug,
    title: s.title,
    publish_year: s.publish_year ?? null,
    journal: s.journal ?? null,
    study_type: s.study_type ?? null,
    excerpt: abstractExcerpt(s.abstract),
  }));
  return { hub: { slug: row.slug, name: row.name, description: row.description }, studies };
}

/** How many studies a condition hub page lists (the same query, capped like the list). */
async function countConditionHubStudies(row: ConditionRow): Promise<number> {
  const r = await db.execute(sql`
    SELECT count(*)::int AS n FROM (SELECT 1 FROM studies WHERE ${conditionHubWhere(row)} LIMIT 100) q
  `);
  return Number((r.rows?.[0] as any)?.n) || 0;
}

let _conditionHubSummaries: ExploreHubSummary[] | null = null;
let _conditionHubSummariesAt = 0;

/**
 * Every condition hub that exists, most-studied first: a health_conditions
 * row (the canonical hubs — the table renderConditionPage and
 * sitemap-categories resolve from) whose page lists ≥1 study with the shared
 * query (getConditionHubStudies). Any other /explore-by-condition/<slug> is a
 * 404 for bots and browsers alike. The crawler index, the SPA index
 * (GET /api/explore/condition/hubs), study-page links, sitemap-categories and
 * the 404 predicate (exploreHubExists) all read this list; `studyCount` is
 * the number of studies the hub page lists. Throws on a DB error (callers
 * decide how to degrade).
 */
export async function getConditionHubSummaries(): Promise<ExploreHubSummary[]> {
  if (_conditionHubSummaries && Date.now() - _conditionHubSummariesAt < 30 * 60 * 1000) {
    return _conditionHubSummaries;
  }
  const rows = await getConditionRows();
  const counted = await Promise.all(rows.map(async (row) => ({ row, n: await countConditionHubStudies(row) })));
  _conditionHubSummaries = counted
    .filter(({ n }) => n > 0)
    .sort((a, b) => b.n - a.n || b.row.study_count - a.row.study_count || a.row.name.localeCompare(b.row.name))
    .map(({ row, n }) => ({
      slug: row.slug,
      name: row.name,
      path: exploreHubPath("condition", row.slug),
      studyCount: n,
    }));
  _conditionHubSummariesAt = _conditionHubSummaries.length ? Date.now() : 0; // empty → not cached
  return _conditionHubSummaries;
}

/**
 * Condition hubs as { slug, name } — study pages link a condition only when
 * it is in this list. A DB error links nothing rather than risk 404 links.
 */
async function getConditionHubs(): Promise<ConditionHubRef[]> {
  try {
    return (await getConditionHubSummaries()).map(({ slug, name }) => ({ slug, name }));
  } catch {
    return [];
  }
}

let _liveBodySystemHubs: BodySystemHub[] | null = null;
let _liveBodySystemHubsAt = 0;

function bodySystemMatchSql(slug: string) {
  return sql.join(
    bodySystemLikePatterns(slug).map((p) => sql`LOWER(array_to_string(body_systems, ' ')) LIKE ${p}`),
    sql` OR `,
  );
}

/**
 * Canonical body-system hubs that resolve right now — renderBodySystemPage
 * 404s a hub with no matching study, so the index links only these.
 */
export async function getLiveBodySystemHubs(): Promise<BodySystemHub[]> {
  if (_liveBodySystemHubs && Date.now() - _liveBodySystemHubsAt < 30 * 60 * 1000) return _liveBodySystemHubs;
  const live = await Promise.all(
    BODY_SYSTEM_HUBS.map(async (hub) => {
      const r = await db.execute(sql`
        SELECT 1 FROM studies WHERE (${bodySystemMatchSql(hub.slug)}) AND slug IS NOT NULL AND is_excluded = false LIMIT 1
      `);
      return (r.rows || []).length > 0 ? hub : null;
    }),
  );
  _liveBodySystemHubs = live.filter((h): h is BodySystemHub => h !== null);
  _liveBodySystemHubsAt = _liveBodySystemHubs.length ? Date.now() : 0; // empty → not cached (404 predicate)
  return _liveBodySystemHubs;
}

const _liveListedHubs = new Map<ListedExploreHubType, { hubs: ExploreHubSummary[]; at: number }>();

/**
 * Curated demographic / delivery-method / benefit / life-stage / mechanism
 * hubs (shared/explore-hubs.ts) whose page lists at least one study right
 * now, with that count. The crawler index (renderExploreIndex), the SPA index
 * (GET /api/explore/:type/hubs) and the 404 predicate (exploreHubExists) all
 * read this, so browsers and bots link exactly the same hubs and every other
 * slug is a 404. Counts come from the same query the hub page itself runs
 * (getExploreDetailStudies), so an index count always equals the number of
 * studies on the linked page.
 */
export async function getLiveExploreHubs(type: ListedExploreHubType): Promise<ExploreHubSummary[]> {
  const cached = _liveListedHubs.get(type);
  if (cached && Date.now() - cached.at < 30 * 60 * 1000) return cached.hubs;
  const counts: Record<string, number> = {};
  await Promise.all(
    LISTED_EXPLORE_HUB_SLUGS[type].map(async (slug) => {
      counts[slug] = (await getExploreDetailStudies(slug)).length;
    }),
  );
  const hubs = listedExploreHubs(type, counts);
  // Empty → not cached (the 404 predicate reads this list).
  _liveListedHubs.set(type, { hubs, at: hubs.length ? Date.now() : 0 });
  return hubs;
}

/**
 * THE "hub exists" predicate for /explore-by-<type>/<slug> — one rule per
 * type, shared by the crawler renderer (null body → hard 404), the SPA shell
 * fallback (server/index.ts → HTTP 404) and GET /api/explore/:type/:slug
 * (→ the SPA renders NotFound). Bots and browsers therefore get the same
 * status for every hub URL:
 *   - condition:   a health_conditions row with ≥1 study (getConditionHubSummaries)
 *   - body-system: a canonical BODY_SYSTEM_HUBS slug with ≥1 study
 *                  (getLiveBodySystemHubs — renderBodySystemPage already
 *                  404'd a canonical hub without studies)
 *   - mechanism / life-stage: one of the sitemap-explore hubs
 *                  (MECHANISM_HUB_SLUGS / LIFE_STAGE_HUB_SLUGS). A sitemap hub
 *                  whose page lists no study stays valid: dropping it from the
 *                  sitemap is a content-destructive op that needs the owner's
 *                  approval of the URL (reports/hub-404-impact-2026-09-28.csv).
 *   - delivery-method / demographic / benefit: a curated slug whose page lists
 *                  ≥1 study (getLiveExploreHubs)
 * Case / trailing-slash variants never get here: URL hygiene 301s them first.
 * Throws on a DB error — callers choose how to degrade.
 */
export async function exploreHubExists(type: string, slug: string): Promise<boolean> {
  if (!isExploreHubType(type) || !isHubSlugShape(slug)) return false;
  if (type === "condition") {
    return (await getConditionHubSummaries()).some((h) => h.slug === slug);
  }
  if (type === "body-system") {
    if (!findBodySystemHub(slug)) return false;
    return (await getLiveBodySystemHubs()).some((h) => h.slug === slug);
  }
  if (!isListedExploreHubType(type)) return false;
  if (!LISTED_EXPLORE_HUB_SLUGS[type].includes(slug)) return false;
  if (SITEMAP_LISTED_HUB_TYPES.has(type)) return true;
  return (await getLiveExploreHubs(type)).some((h) => h.slug === slug);
}

/** Listed hub types whose every curated slug is advertised in sitemap-explore. */
const SITEMAP_LISTED_HUB_TYPES: ReadonlySet<ListedExploreHubType> = new Set<ListedExploreHubType>(["mechanism", "life-stage"]);

/**
 * Drop the cached hub lists. Called once boot migrations finish: the bot-cache
 * prewarm can run while migrations are still going, and a hub row a migration
 * adds (e.g. 024 sleep-quality) would otherwise 404 until the 30-minute cache
 * expired (2026-09-29).
 */
export function invalidateHubCaches(): void {
  __resetConditionHubsForTests();
}

/** Test-only: drop the cached hub lists. */
export function __resetConditionHubsForTests(): void {
  _conditionHubSummaries = null;
  _conditionHubSummariesAt = 0;
  _conditionRows = null;
  _conditionRowsAt = 0;
  _liveBodySystemHubs = null;
  _liveBodySystemHubsAt = 0;
  _liveListedHubs.clear();
}

// ── Shared HTML fragments ─────────────────────────────────────

function breadcrumbs(items: { label: string; href?: string }[]): string {
  const lis = items.map((item, i) => {
    const isLast = i === items.length - 1;
    if (item.href && !isLast) {
      return `<li><a href="${esc(item.href)}">${esc(item.label)}</a></li>`;
    }
    return `<li aria-current="page">${esc(truncate(item.label, 60))}</li>`;
  });
  return `<nav aria-label="Breadcrumb"><ol>${lis.join("")}</ol></nav>\n`;
}

function footer(conditions: { name: string; slug: string }[]): string {
  let h = `\n<footer>\n<nav>\n`;
  h += `<section><h3>Research Database</h3><ul>`;
  h += `<li><a href="/">Home</a></li>`;
  h += `<li><a href="/studies">All Studies</a></li>`;
  h += `<li><a href="/blog">Blog</a></li>`;
  h += `<li><a href="/search">Search</a></li>`;
  h += `<li><a href="/advanced-search">Advanced Search</a></li>`;
  h += `</ul></section>`;

  h += `<section><h3>Browse Research</h3><ul>`;
  h += `<li><a href="/explore-by-condition">By Health Condition</a></li>`;
  h += `<li><a href="/explore-by-body-system">By Body System</a></li>`;
  h += `<li><a href="/explore-by-mechanism">By Mechanism</a></li>`;
  h += `<li><a href="/explore-by-delivery-method">By Delivery Method</a></li>`;
  h += `<li><a href="/explore-by-life-stage">By Life Stage</a></li>`;
  h += `<li><a href="/explore-by-benefit">By Benefit</a></li>`;
  h += `</ul></section>`;

  if (conditions.length > 0) {
    h += `<section><h3>Popular Conditions</h3><ul>`;
    for (const c of conditions.slice(0, 12)) {
      h += `<li><a href="/explore-by-condition/${esc(c.slug)}">${esc(c.name)}</a></li>`;
    }
    h += `</ul></section>`;
  }

  h += `<section><h3>Learn</h3><ul>`;
  h += `<li><a href="/learn/basics">Hydrogen Basics</a></li>`;
  h += `<li><a href="/learn/health-benefits">Health Benefits</a></li>`;
  h += `<li><a href="/learn/therapy-guide">Therapy Guide</a></li>`;
  h += `<li><a href="${BENEFITS_GUIDE_PATH}">Hydrogen water benefits (evidence-graded)</a></li>`;
  h += `</ul></section>`;

  h += `<section><h3>Company</h3><ul>`;
  h += `<li><a href="/about">About</a></li>`;
  h += `<li><a href="/contact">Contact</a></li>`;
  h += `<li><a href="/privacy">Privacy Policy</a></li>`;
  h += `<li><a href="/terms">Terms of Service</a></li>`;
  h += `</ul></section>`;

  h += `\n</nav>\n`;
  // Ownership disclosure (PLAN.md 0.3, Appendix B) — must appear in crawler
  // output on every page, same as the browser footer. The href is tagged with
  // the page's own utm_campaign/utm_content by renderPageBody's UTM rewriter.
  // No product links here (Appendix E: the footer is on disease pages too).
  h += `<p>Hydrogen Studies is built and funded by Echo Technologies LLC, the maker of `;
  h += `<a href="${ECHOWATER_ORIGIN}/" rel="sponsored noopener">Echo Water</a> hydrogen products. `;
  h += `Our research team selects and summarizes studies independently; Echo does not decide which studies are included or how they are described. `;
  h += `<a href="/editorial-policy">Editorial policy</a> · <a href="/methodology">Methodology</a> · <a href="/contact">Contact</a></p>\n`;
  h += `<p>&copy; ${new Date().getFullYear()} Hydrogen Studies. Evidence-based hydrogen therapy research database.</p>\n`;
  h += `</footer>`;
  return h;
}

/**
 * Visible blog byline, directly under the H1 (CLAUDE.md: author or reviewer +
 * last-reviewed date on every indexable page). Copy comes from the shared
 * blogByline() so it matches BlogPage.tsx and the Article JSON-LD exactly.
 */
export function renderBlogBylineHtml(b: {
  author_name?: string | null;
  reviewer_name?: string | null;
  last_reviewed?: string | Date | null;
  updated_at?: string | Date | null;
  published_at?: string | Date | null;
  created_at?: string | Date | null;
}): string {
  return renderBylineHtml(blogByline({
    authorName: b.author_name,
    reviewerName: b.reviewer_name,
    lastReviewed: b.last_reviewed,
    updatedAt: b.updated_at,
    publishedAt: b.published_at,
    createdAt: b.created_at,
  }));
}

/** Byline markup for a resolved byline — the bot twin of the SPA's <Byline>. */
export function renderBylineHtml(by: BlogByline): string {
  let h = `<p class="byline">By <a href="${by.href}">${esc(by.author)}</a>`;
  if (by.reviewer) h += ` · Reviewed by ${esc(by.reviewer)}`;
  if (by.date) h += ` · ${by.dateLabel} <time datetime="${isoDate(by.date)}">${esc(by.dateText)}</time>`;
  h += `</p>\n`;
  return h;
}

/**
 * Markdown → HTML for crawler bodies (PLAN.md 1.5): marked, then slug ids on
 * h2/h3 so in-page anchors work. Callers sanitize (sanitizeArticleHtml) and
 * demote any body <h1> (demoteH1InHtml) — the page's only H1 is its title.
 */
function markdownToHtml(md: string): string {
  const html = marked.parse(md, { async: false }) as string;
  // Same id rule as the SPA (shared/heading-id): visible text with inline
  // tags stripped and entities decoded.
  return html.replace(/<h([23])>([\s\S]*?)<\/h\1>/g, (m, lvl, inner) => {
    const id = headingId(inner.replace(/<[^>]*>/g, ""));
    return id ? `<h${lvl} id="${id}">${inner}</h${lvl}>` : m;
  });
}

// ── Data queries ──────────────────────────────────────────────

async function getRelatedStudies(studyId: number, condition: string | null, limit = 8): Promise<{ slug: string; title: string; year: number | null }[]> {
  if (!condition) return [];
  try {
    const r = await db.execute(sql`
      SELECT slug, COALESCE(plain_language_title, title) as title, publish_year as year
      FROM studies
      WHERE array_to_string(health_conditions, ' ') ILIKE ${"%" + condition + "%"}
        AND id != ${studyId} AND slug IS NOT NULL AND is_excluded = false
      ORDER BY publish_year DESC NULLS LAST
      LIMIT ${limit}
    `);
    return (r.rows || []).map((row: any) => ({ slug: row.slug, title: row.title, year: row.year }));
  } catch { return []; }
}

async function getRelatedBlogs(keyword: string, limit = 5): Promise<{ slug: string; title: string }[]> {
  if (!keyword) return [];
  try {
    const r = await db.execute(sql`
      SELECT slug, title FROM blog_articles
      WHERE is_published = true AND is_archived = false AND slug IS NOT NULL
        AND title ILIKE ${"%" + keyword + "%"}
      ORDER BY created_at DESC LIMIT ${limit}
    `);
    return (r.rows || []).map((row: any) => ({ slug: row.slug, title: row.title }));
  } catch { return []; }
}

async function getRelatedBlogsForBlog(blogId: number, category: string | null, limit = 8): Promise<{ slug: string; title: string }[]> {
  try {
    const r = await db.execute(sql`
      SELECT slug, title FROM blog_articles
      WHERE is_published = true AND is_archived = false AND slug IS NOT NULL AND id != ${blogId}
        ${category ? sql`AND title ILIKE ${"%" + category + "%"}` : sql``}
      ORDER BY created_at DESC LIMIT ${limit}
    `);
    return (r.rows || []).map((row: any) => ({ slug: row.slug, title: row.title }));
  } catch { return []; }
}

async function getRecentStudies(limit = 15): Promise<{ slug: string; title: string }[]> {
  try {
    const r = await db.execute(sql`
      SELECT slug, COALESCE(plain_language_title, title) as title
      FROM studies WHERE slug IS NOT NULL AND is_excluded = false
      ORDER BY created_at DESC NULLS LAST LIMIT ${limit}
    `);
    return (r.rows || []).map((row: any) => ({ slug: row.slug, title: row.title }));
  } catch { return []; }
}

async function getRecentBlogs(limit = 10): Promise<{ slug: string; title: string }[]> {
  try {
    const r = await db.execute(sql`
      SELECT slug, title FROM blog_articles
      WHERE is_published = true AND is_archived = false AND slug IS NOT NULL
      ORDER BY created_at DESC LIMIT ${limit}
    `);
    return (r.rows || []).map((row: any) => ({ slug: row.slug, title: row.title }));
  } catch { return []; }
}

// ── Page renderers ────────────────────────────────────────────

export async function renderStudy(slugOrId: string): Promise<string | null> {
  try {
    const studyCols = sql`id, title, plain_language_title, slug, authors, journal, publish_year,
      doi, pmid, url, study_type, outcome, peer_reviewed, country, category,
      health_conditions, body_systems,
      tldr, key_finding, plain_summary, summary_100_words, summary_50_words,
      practical_takeaway, how_to_apply, abstract, last_modified, created_at`;
    const isNumeric = /^\d+$/.test(slugOrId);
    const r = isNumeric
      ? await db.execute(sql`SELECT ${studyCols} FROM studies WHERE id = ${parseInt(slugOrId)} AND is_excluded = false LIMIT 1`)
      : await db.execute(sql`SELECT ${studyCols} FROM studies WHERE slug = ${slugOrId} AND is_excluded = false LIMIT 1`);
    const row: any = r.rows?.[0];
    if (!row) return null;
    // CLAUDE.md: empty fields never render; pipeline sentinels such as
    // key_finding = "__no_content__" never reach HTML. Null them all up front
    // so every `if (s.x)` guard below skips them.
    const s: any = withoutPlaceholders(row);

    const title = s.plain_language_title || s.title;
    // health_conditions is a text array — use first element for display
    const conditionsArr: string[] = (s.health_conditions || []).filter((c: string) => c && c.trim());
    const condition = conditionsArr[0] || s.category || null;
    const bodySystemsArr: string[] = (s.body_systems || []).filter((b: string) => b && b.trim());
    const bodySystem = bodySystemsArr[0] || null;
    const [related, relatedBlogs, conditions, conditionHubs] = await Promise.all([
      getRelatedStudies(s.id, condition),
      getRelatedBlogs(condition || ""),
      getTopConditions(),
      getConditionHubs(),
    ]);
    // Link a condition / body system only when a real hub exists for it
    // (shared/explore-hubs.ts). Long-tail values have no hub and render as
    // plain text — re-audit 2026-09-28: 284/300 study pages linked a 404.
    const conditionHub = conditionHubForValue(condition, conditionHubs);
    const conditionHref = conditionHub ? exploreHubPath("condition", conditionHub.slug) : null;
    const bodySystemHref = bodySystemHubPathForValue(bodySystem);

    const crumbs: { label: string; href?: string }[] = [
      { label: "Home", href: "/" },
      { label: "Studies", href: "/studies" },
    ];
    if (condition && conditionHref) {
      crumbs.push({ label: condition, href: conditionHref });
    }
    crumbs.push({ label: truncate(title, 50) });

    let h = breadcrumbs(crumbs);
    h += `<article itemscope itemtype="https://schema.org/MedicalScholarlyArticle">\n`;
    h += `<h1 itemprop="headline">${esc(title)}</h1>\n`;
    // Author/reviewer + date line (CLAUDE.md: every indexable page shows one).
    // Same copy as SEOStudyPage.tsx.
    const updated = studyUpdatedAt({ lastModified: s.last_modified, createdAt: s.created_at });
    h += `<p class="byline">Summary by <a href="/methodology">${esc(EDITORIAL_TEAM)}</a>`;
    if (updated) h += ` · Updated <time datetime="${isoDate(updated)}">${esc(formatLongDate(updated))}</time>`;
    h += `</p>\n`;

    // Metadata table
    const doi = normalizeDoi(s.doi);
    h += `<dl>`;
    if (s.authors) h += `<dt>Authors</dt><dd itemprop="author">${esc(s.authors)}</dd>`;
    if (s.journal) h += `<dt>Journal</dt><dd>${esc(s.journal)}</dd>`;
    if (s.publish_year) h += `<dt>Year</dt><dd itemprop="datePublished">${s.publish_year}</dd>`;
    if (doi) h += `<dt>DOI</dt><dd><a href="https://doi.org/${esc(doi)}" rel="noopener">${esc(doi)}</a></dd>`;
    if (s.study_type) h += `<dt>Study Type</dt><dd>${esc(s.study_type)}</dd>`;
    if (s.outcome) h += `<dt>Outcome</dt><dd>${esc(s.outcome)}</dd>`;
    if (s.peer_reviewed) h += `<dt>Peer Reviewed</dt><dd>Yes</dd>`;
    if (s.country) h += `<dt>Country</dt><dd>${esc(s.country)}</dd>`;
    if (condition) {
      h += `<dt>Health Condition</dt><dd>${conditionHref ? `<a href="${esc(conditionHref)}">${esc(condition)}</a>` : esc(condition)}</dd>`;
    }
    if (bodySystem) {
      h += `<dt>Body System</dt><dd>${bodySystemHref ? `<a href="${esc(bodySystemHref)}">${esc(bodySystem)}</a>` : esc(bodySystem)}</dd>`;
    }
    h += `</dl>\n`;

    // Content sections
    if (s.tldr) h += `<section><h2>TL;DR</h2><p>${esc(s.tldr)}</p></section>\n`;
    if (s.key_finding) h += `<section><h2>Key Finding</h2><p>${esc(s.key_finding)}</p></section>\n`;
    if (s.plain_summary) {
      h += `<section><h2>Summary</h2><p itemprop="description">${esc(s.plain_summary)}</p></section>\n`;
    } else if (s.summary_100_words) {
      h += `<section><h2>Summary</h2><p itemprop="description">${esc(s.summary_100_words)}</p></section>\n`;
    } else if (s.summary_50_words) {
      h += `<section><h2>Summary</h2><p itemprop="description">${esc(s.summary_50_words)}</p></section>\n`;
    }
    if (s.practical_takeaway) h += `<section><h2>Practical Takeaway</h2><p>${esc(s.practical_takeaway)}</p></section>\n`;
    if (s.how_to_apply) h += `<section><h2>How to Apply This Research</h2><p>${esc(s.how_to_apply)}</p></section>\n`;
    // CLAUDE.md: never republish the full abstract (publisher copyright) —
    // ≤300-char excerpt + a link to the source. Same as SEOStudyPage.tsx.
    const excerpt = abstractExcerpt(s.abstract);
    const source = studySourceLink({ pmid: s.pmid, doi: s.doi, url: s.url });
    if (excerpt || source) {
      h += `<section><h2>Abstract (excerpt)</h2>`;
      if (excerpt) h += `<p>${esc(excerpt)}</p>`;
      if (source) h += `<p><a href="${esc(source.href)}" rel="noopener">${esc(source.label)}</a></p>`;
      h += `</section>\n`;
    }
    h += `</article>\n`;

    // Related studies
    if (related.length > 0) {
      h += `<nav aria-label="Related Studies"><h2>Related Studies</h2><ul>`;
      for (const rs of related) {
        h += `<li><a href="/study/${esc(rs.slug)}">${esc(rs.title)}</a>`;
        if (rs.year) h += ` (${rs.year})`;
        h += `</li>`;
      }
      h += `</ul></nav>\n`;
    }

    // Related blogs
    if (relatedBlogs.length > 0) {
      h += `<nav aria-label="Related Articles"><h2>Related Articles</h2><ul>`;
      for (const rb of relatedBlogs) h += `<li><a href="/blog/${esc(rb.slug)}">${esc(rb.title)}</a></li>`;
      h += `</ul></nav>\n`;
    }

    h += footer(conditions);
    return h;
  } catch { return null; }
}

export async function renderBlog(slugOrId: string): Promise<string | null> {
  try {
    const blogCols = sql`id, title, slug, content, summary, created_at, updated_at, published_at,
      author_name, reviewer_name, last_reviewed`;
    const isNumeric = /^\d+$/.test(slugOrId);
    const r = isNumeric
      ? await db.execute(sql`SELECT ${blogCols} FROM blog_articles WHERE id = ${parseInt(slugOrId)} AND is_published = true AND is_archived = false LIMIT 1`)
      : await db.execute(sql`SELECT ${blogCols} FROM blog_articles WHERE slug = ${slugOrId} AND is_published = true AND is_archived = false LIMIT 1`);
    const b: any = r.rows?.[0];
    if (!b) return null;

    const [relatedBlogs, conditions, isLiveBlog] = await Promise.all([
      getRelatedBlogsForBlog(b.id, null),
      getTopConditions(),
      getLiveBlogPredicate(),
    ]);

    const crumbs = [
      { label: "Home", href: "/" },
      { label: "Blog", href: "/blog" },
      { label: truncate(b.title, 50) },
    ];

    let h = breadcrumbs(crumbs);
    // PLAN.md 0.4: brand/review posts carry an ownership banner until the
    // Section 12 disposition (replace with measurement data / move to
    // echowater.com). Match "is X worth it" slugs and review-style titles.
    const isReviewPost =
      /(^|-)is-.*-worth-it($|-)|-review($|-)|-vs-/.test(String(b.slug ?? "")) ||
      /\bworth it\b|\breview\b/i.test(String(b.title ?? ""));
    if (isReviewPost) {
      h += `<aside role="note"><p><strong>Disclosure:</strong> This site is owned by Echo Technologies LLC, `;
      h += `which sells hydrogen water products, including the Echo Flask. `;
      h += `<a href="/editorial-policy">Read our editorial policy</a>.</p></aside>\n`;
    }
    h += `<article itemscope itemtype="https://schema.org/Article">\n`;
    h += `<h1 itemprop="headline">${esc(b.title)}</h1>\n`;
    h += renderBlogBylineHtml(b);
    if (b.created_at) h += `<time itemprop="datePublished" datetime="${new Date(b.created_at).toISOString()}">${fmtDate(b.created_at)}</time>\n`;

    // Blog content — DOM-aware allowlist sanitization (DOMPurify), keeps
    // structural HTML while stripping scripts/handlers/dangerous URIs.
    //
    // PLAN.md 1.5 stopgap: many generated articles are stored as MARKDOWN, and
    // crawlers were served the raw source — literal ** and [text](url) with no
    // real <a> links or heading structure. Render markdown → HTML first (with
    // slug ids on h2/h3 so anchors work), then sanitize as before.
    if (b.content) {
      let raw = b.content as string;
      const looksLikeMarkdown =
        !/<(p|h\d|div|ul|ol|table)\b/i.test(raw) &&
        /(\*\*|^#{1,3} |\n#{1,3} |\]\()/m.test(raw);
      if (looksLikeMarkdown) {
        try {
          raw = markdownToHtml(raw);
        } catch {
          // fall through with the original content — sanitizer still applies
        }
      }
      // After sanitizing: unwrap links to retired (410) / unpublished posts
      // (keep the anchor text) and demote any body <h1> — the page's only H1
      // is the title above. The SPA gets the same treatment (public blog API
      // + BlogPage markdown components).
      const safeContent = demoteH1InHtml(stripDeadBlogLinksInHtml(sanitizeArticleHtml(raw), isLiveBlog));
      h += `<div itemprop="articleBody">${safeContent}</div>\n`;
    } else if (b.summary) {
      h += `<div itemprop="articleBody"><p>${esc(b.summary)}</p></div>\n`;
    }
    h += `</article>\n`;

    if (relatedBlogs.length > 0) {
      h += `<nav aria-label="Related Articles"><h2>Related Articles</h2><ul>`;
      for (const rb of relatedBlogs) h += `<li><a href="/blog/${esc(rb.slug)}">${esc(rb.title)}</a></li>`;
      h += `</ul></nav>\n`;
    }

    h += footer(conditions);
    return h;
  } catch { return null; }
}

/**
 * Editorial-policy / methodology stubs for crawlers (PLAN.md 0.3). Content
 * mirrors the client pages (EditorialPolicyPage.tsx / MethodologyPage.tsx) —
 * keep in sync until Phase 4.2 replaces both with full pages.
 */
async function renderPolicyPage(pathname: string): Promise<string> {
  const conditions = await getTopConditions();
  const isEditorial = pathname === "/editorial-policy";
  let h = breadcrumbs([
    { label: "Home", href: "/" },
    { label: isEditorial ? "Editorial Policy" : "Methodology" },
  ]);
  if (isEditorial) {
    h += `<article><h1>Editorial Policy</h1>
<h2>Who funds this site</h2>
<p>Hydrogen Studies is built and funded by Echo Technologies LLC, the maker of Echo Water hydrogen products. We state this on every page because sponsored science reporting is only trustworthy when the sponsorship is visible.</p>
<h2>Editorial independence</h2>
<p>Our research team selects and summarizes studies independently. Echo does not decide which studies are included, excluded, or how any study is described. Studies with unfavorable, null, or negative findings for hydrogen products are included on the same basis as favorable ones — and studies funded by industry, including any funded by Echo Technologies, are flagged as such.</p>
<h2>What this site is not</h2>
<p>Hydrogen Studies is an educational research database, not medical advice and not product marketing. Product mentions appear only in clearly labeled sponsor modules, never inside study summaries, and never on pages about diagnosed medical conditions.</p>
<p>A fuller version of this policy — including our correction process, reviewer credentials, and update cadence — is being prepared and will replace this page. Questions in the meantime: <a href="/contact">contact us</a>.</p>
</article>\n`;
  } else {
    h += `<article><h1>Methodology</h1>
<h2>How studies enter the database</h2>
<p>Studies are discovered from PubMed, Europe PMC, CrossRef, and related indexes using hydrogen-therapy search terms, then screened before publication. Every study page links its primary source (DOI, PubMed, or PMC) so claims can be checked against the original paper. Retractions are monitored and flagged.</p>
<h2>How summaries are produced</h2>
<p>Summaries are drafted with AI assistance from the study abstract or full text, then reviewed before publication. We are transparent about this because we believe the review step, not the drafting tool, is what makes a summary trustworthy. Named reviewer credentials and per-study review dates are being rolled out across the database.</p>
<h2>Funding and conflicts</h2>
<p>Hydrogen Studies is funded by Echo Technologies LLC. Study funding sources and conflicts of interest are being recorded as structured, filterable data for every study — including studies funded by Echo Technologies or other industry sources, which are flagged as industry-funded.</p>
<p>A fuller version — inclusion criteria, evidence grading, update cadence, and the corrections process — is being prepared and will replace this page.</p>
</article>\n`;
  }
  h += footer(conditions);
  return h;
}

async function renderHomepage(): Promise<string> {
  const [conditions, recent, blogs, statsR] = await Promise.all([
    getTopConditions(),
    getRecentStudies(15),
    getRecentBlogs(10),
    db.execute(sql`SELECT count(*) as total, count(*) FILTER (WHERE peer_reviewed = true) as reviewed FROM studies WHERE is_excluded = false`).catch(() => ({ rows: [{ total: 0, reviewed: 0 }] })),
  ]);

  const total = Number((statsR.rows?.[0] as any)?.total || 0);
  const reviewed = Number((statsR.rows?.[0] as any)?.reviewed || 0);

  let h = `<h1>Hydrogen Studies Research Database</h1>\n`;
  // One claim, once (the old copy said "peer-reviewed" twice back to back —
  // PLAN.md 0.5).
  h += `<p>Explore ${total.toLocaleString()} hydrogen therapy research studies — `;
  h += `${reviewed.toLocaleString()} from peer-reviewed journals. `;
  h += `Evidence-based insights on molecular hydrogen for health conditions, organized by body system, condition, and mechanism.</p>\n`;

  h += `<section><h2>Browse Research</h2><ul>`;
  h += `<li><a href="/explore-by-condition">Browse by Health Condition</a></li>`;
  h += `<li><a href="/explore-by-body-system">Browse by Body System</a></li>`;
  h += `<li><a href="/explore-by-mechanism">Browse by Mechanism</a></li>`;
  h += `<li><a href="/explore-by-delivery-method">Browse by Delivery Method</a></li>`;
  h += `<li><a href="/explore-by-life-stage">Browse by Life Stage</a></li>`;
  h += `<li><a href="/studies">View All Studies</a></li>`;
  h += `<li><a href="/search">Search Studies</a></li>`;
  h += `<li><a href="/advanced-search">Advanced Search</a></li>`;
  h += `</ul></section>\n`;

  if (conditions.length > 0) {
    h += `<section><h2>Popular Health Conditions</h2><ul>`;
    for (const c of conditions) h += `<li><a href="/explore-by-condition/${esc(c.slug)}">${esc(c.name)}</a></li>`;
    h += `</ul></section>\n`;
  }

  if (recent.length > 0) {
    h += `<section><h2>Recent Research Studies</h2><ul>`;
    for (const s of recent) h += `<li><a href="/study/${esc(s.slug)}">${esc(s.title)}</a></li>`;
    h += `</ul></section>\n`;
  }

  if (blogs.length > 0) {
    h += `<section><h2>Latest Articles</h2><ul>`;
    for (const b of blogs) h += `<li><a href="/blog/${esc(b.slug)}">${esc(b.title)}</a></li>`;
    h += `</ul></section>\n`;
  }

  h += `<section><h2>Learn About Hydrogen</h2><ul>`;
  h += `<li><a href="/learn/basics">Hydrogen Therapy Basics</a></li>`;
  h += `<li><a href="/learn/health-benefits">Health Benefits Guide</a></li>`;
  h += `<li><a href="/learn/therapy-guide">Therapy Guide</a></li>`;
  h += `<li><a href="${BENEFITS_GUIDE_PATH}">Hydrogen water benefits (evidence-graded)</a></li>`;
  h += `</ul></section>\n`;

  h += footer(conditions);
  return h;
}

async function renderStudiesList(): Promise<string> {
  const [studiesR, conditions] = await Promise.all([
    db.execute(sql`
      SELECT slug, COALESCE(plain_language_title, title) as title, publish_year, journal
      FROM studies WHERE slug IS NOT NULL AND is_excluded = false
      ORDER BY publish_year DESC NULLS LAST LIMIT 200
    `),
    getTopConditions(),
  ]);

  let h = breadcrumbs([{ label: "Home", href: "/" }, { label: "Research Studies" }]);
  h += `<h1>Research Studies Directory</h1>\n`;
  h += `<p>Browse our comprehensive directory of hydrogen therapy research studies. Filter by condition, body system, study type, and outcome.</p>\n`;

  const rows = (studiesR.rows || []) as any[];
  h += `<section><h2>Studies</h2><ul>`;
  for (const s of rows) {
    h += `<li><a href="/study/${esc(s.slug)}">${esc(s.title)}</a>`;
    const meta = [s.publish_year, s.journal].filter(Boolean).join(", ");
    if (meta) h += ` — ${esc(String(meta))}`;
    h += `</li>`;
  }
  h += `</ul></section>\n`;

  if (conditions.length > 0) {
    h += `<section><h2>Browse by Condition</h2><ul>`;
    for (const c of conditions) h += `<li><a href="/explore-by-condition/${esc(c.slug)}">${esc(c.name)}</a></li>`;
    h += `</ul></section>\n`;
  }

  h += footer(conditions);
  return h;
}

export async function renderBlogList(): Promise<string> {
  // blog_articles has NO `category` column — selecting it threw, the catch-all
  // in the middleware fell through, and bots got the empty SPA shell for /blog
  // (audit 2026-09). Live posts only: published AND not archived.
  const [blogsR, conditions] = await Promise.all([
    db.execute(sql`
      SELECT slug, title, created_at
      FROM blog_articles
      WHERE is_published = true AND is_archived = false AND slug IS NOT NULL
      ORDER BY created_at DESC LIMIT 200
    `),
    getTopConditions(),
  ]);

  let h = breadcrumbs([{ label: "Home", href: "/" }, { label: "Blog" }]);
  h += `<h1>Hydrogen Health Blog</h1>\n`;
  h += `<p>Plain-language articles explaining hydrogen therapy research. Understand the science behind molecular hydrogen and its health benefits.</p>\n`;

  const rows = (blogsR.rows || []) as any[];
  h += `<ul>`;
  for (const b of rows) {
    h += `<li><a href="/blog/${esc(b.slug)}">${esc(b.title)}</a>`;
    if (b.created_at) h += ` — <time datetime="${isoDate(b.created_at)}">${esc(formatLongDate(b.created_at))}</time>`;
    h += `</li>`;
  }
  h += `</ul>\n`;

  h += footer(conditions);
  return h;
}

/**
 * Evidence-graded intro of a condition hub (shared/condition-hub-intros.ts),
 * the crawler twin of ConditionCategoryPage's intro: H1, byline ("Updated" —
 * no named reviewer), the intro (markdown → HTML through the blog-body path),
 * the visible FAQ its FAQPage JSON-LD describes, and the numbered sources the
 * intro's "[n]" refs point to.
 */
export function renderConditionHubIntroHtml(intro: ConditionHubIntro): string {
  let h = `<article>\n<h1>${esc(intro.h1)}</h1>\n`;
  h += renderBylineHtml(conditionHubByline(intro));
  const body = demoteH1InHtml(sanitizeArticleHtml(markdownToHtml(intro.introMarkdown)));
  h += `<div class="hub-intro">${body}</div>\n`;
  if (intro.faqs.length > 0) {
    h += `<section aria-labelledby="faq"><h2 id="faq">${esc(CONDITION_HUB_FAQ_HEADING)}</h2>`;
    for (const faq of intro.faqs) h += `<h3>${esc(faq.question)}</h3><p>${esc(faq.answer)}</p>`;
    h += `</section>\n`;
  }
  if (intro.sources.length > 0) {
    h += `<section aria-labelledby="sources"><h2 id="sources">${esc(CONDITION_HUB_SOURCES_HEADING)}</h2><ol>`;
    for (const s of intro.sources) {
      h += `<li id="${conditionHubSourceId(s.n)}">${esc(s.citation)}`;
      conditionHubSourceLinks(s).forEach((link, i) => {
        const attrs = link.external ? ` target="_blank" rel="noopener noreferrer"` : "";
        h += `${i === 0 ? " " : " · "}<a href="${esc(link.href)}"${attrs}>${esc(link.label)}</a>`;
      });
      h += `</li>`;
    }
    h += `</ol></section>\n`;
  }
  h += `</article>\n`;
  return h;
}

/** "Read the full guide: <owner page>" — after the study list. */
export function renderConditionHubOwnerGuideHtml(intro: ConditionHubIntro): string {
  return `<section class="owner-guide"><p><strong>${esc(CONDITION_HUB_OWNER_GUIDE_LEAD)}</strong> ` +
    `<a href="${esc(intro.ownerLink.href)}">${esc(intro.ownerLink.label)}</a></p></section>\n`;
}

async function renderConditionPage(slug: string): Promise<string | null> {
  try {
    // Not a hub (no health_conditions row, or a row whose page lists no
    // study) → hard 404.
    if (!(await exploreHubExists("condition", slug))) return null;
    // The ONE condition-hub study query, shared with the SPA page
    // (GET /api/explore/condition/:slug/studies): name tag OR hub synonyms.
    // It used to match the name tag only — 0 studies on kidney-health while
    // the SPA listed ~50.
    const hubStudies = await getConditionHubStudies(slug);
    if (!hubStudies) return null;
    const cond = hubStudies.hub;

    const [relatedBlogs, conditions] = await Promise.all([
      getRelatedBlogs(cond.name),
      getTopConditions(),
    ]);

    const studies = hubStudies.studies;
    // Evidence-graded hubs (keyword plan wave 3) — same record the SPA
    // page renders (ConditionCategoryPage.tsx).
    const intro = getConditionHubIntro(slug);

    let studyItems = "";
    for (const s of studies) {
      studyItems += `<li><a href="/study/${esc(s.slug)}">${esc(s.title)}</a>`;
      const meta = [s.publish_year, s.journal, s.study_type].filter(Boolean).join(", ");
      if (meta) studyItems += ` — ${esc(String(meta))}`;
      studyItems += `</li>`;
    }

    let h = breadcrumbs([
      { label: "Home", href: "/" },
      { label: "Health Conditions", href: "/explore-by-condition" },
      { label: cond.name },
    ]);
    if (intro) {
      // The reviewed intro REPLACES health_conditions.description and the
      // generic count line: they contradicted it ("Hydrogen water bathing
      // may reduce UV damage…"). No sponsor/product block (bridgeTopic null).
      h += renderConditionHubIntroHtml(intro);
      if (studies.length > 0) {
        h += `<section><h2>${esc(CONDITION_HUB_STUDIES_HEADING)}</h2>`;
        h += `<p>${studyCountLabel(studies.length)} in our database.</p><ul>${studyItems}</ul></section>\n`;
      }
      h += renderConditionHubOwnerGuideHtml(intro);
    } else {
      h += `<h1>Hydrogen Research for ${esc(cond.name)}</h1>\n`;
      if (cond.description) h += `<p>${esc(cond.description)}</p>\n`;
      h += `<p>${studies.length} research stud${studies.length === 1 ? "y" : "ies"} on hydrogen therapy for ${esc(cond.name.toLowerCase())}.</p>\n`;
      if (studies.length > 0) {
        h += `<section><h2>Research Studies</h2><ul>${studyItems}</ul></section>\n`;
      }
    }

    if (relatedBlogs.length > 0) {
      h += `<section><h2>Related Articles</h2><ul>`;
      for (const b of relatedBlogs) h += `<li><a href="/blog/${esc(b.slug)}">${esc(b.title)}</a></li>`;
      h += `</ul></section>\n`;
    }

    // Cross-link other conditions
    const others = conditions.filter((c) => c.slug !== slug);
    if (others.length > 0) {
      h += `<section><h2>Explore Other Conditions</h2><ul>`;
      for (const c of others.slice(0, 15)) h += `<li><a href="/explore-by-condition/${esc(c.slug)}">${esc(c.name)}</a></li>`;
      h += `</ul></section>\n`;
    }

    h += footer(conditions);
    return h;
  } catch { return null; }
}

async function renderBodySystemPage(slug: string): Promise<string | null> {
  // Only the canonical hubs (the sitemap list, shared/explore-hubs.ts) with
  // ≥1 study exist; they resolve via their curated terms. Any other slug —
  // the ~100 long-tail values (/explore-by-body-system/molecular, …) that
  // used to render a words-or-slug match — is a hard 404, for browsers too.
  const displayName = findBodySystemHub(slug)?.label
    ?? slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  try {
    if (!(await exploreHubExists("body-system", slug))) return null;
    const likeAny = bodySystemMatchSql(slug);
    const [studiesR, conditions] = await Promise.all([
      db.execute(sql`
        SELECT slug, COALESCE(plain_language_title, title) as title, publish_year, journal
        FROM studies
        WHERE (${likeAny})
          AND slug IS NOT NULL AND is_excluded = false
        ORDER BY publish_year DESC NULLS LAST LIMIT 100
      `),
      getTopConditions(),
    ]);

    const studies = (studiesR.rows || []) as any[];
    if (studies.length === 0) return null;

    let h = breadcrumbs([
      { label: "Home", href: "/" },
      { label: "Body Systems", href: "/explore-by-body-system" },
      { label: displayName },
    ]);
    h += `<h1>Hydrogen Research: ${esc(displayName)}</h1>\n`;
    // bodySystemHubName ends in "System" exactly once ("the immune system",
    // not "the immune system system").
    h += `<p>Research studies on molecular hydrogen's effects on the ${esc(bodySystemHubName(slug).toLowerCase())}. Browse clinical trials, reviews, and findings.</p>\n`;

    h += `<section><h2>Research Studies</h2><ul>`;
    for (const s of studies) {
      h += `<li><a href="/study/${esc(s.slug)}">${esc(s.title)}</a>`;
      const meta = [s.publish_year, s.journal].filter(Boolean).join(", ");
      if (meta) h += ` — ${esc(String(meta))}`;
      h += `</li>`;
    }
    h += `</ul></section>\n`;

    h += footer(conditions);
    return h;
  } catch { return null; }
}

async function renderExploreIndex(type: string): Promise<string> {
  const conditions = await getTopConditions();
  const titles: Record<string, string> = {
    condition: "Hydrogen Research by Health Condition",
    "body-system": "Hydrogen Research by Body System",
    // Shared with the SPA index pages (same H1 for browsers and bots).
    mechanism: exploreIndexCopy("mechanism").h1,
    "delivery-method": exploreIndexCopy("delivery-method").h1,
    "life-stage": exploreIndexCopy("life-stage").h1,
    benefit: exploreIndexCopy("benefit").h1,
    demographic: exploreIndexCopy("demographic").h1,
  };
  const title = titles[type] || "Explore Hydrogen Research";

  let h = breadcrumbs([{ label: "Home", href: "/" }, { label: title }]);
  h += `<h1>${esc(title)}</h1>\n`;

  if (type === "condition") {
    // The condition hubs that exist (a health_conditions row with studies) —
    // the same list GET /api/explore/condition/hubs serves the SPA index.
    try {
      const hubs = await getConditionHubSummaries();
      h += `<ul>`;
      for (const c of hubs) {
        h += `<li><a href="${esc(c.path)}">${esc(c.name)}</a>`;
        if (c.studyCount) h += ` (${c.studyCount} studies)`;
        h += `</li>`;
      }
      h += `</ul>\n`;
    } catch {
      h += `<p>Explore conditions by browsing the research database.</p>\n`;
    }
  } else if (type === "body-system") {
    // The canonical hubs (the sitemap-explore list) that resolve, not every
    // distinct body_systems value: slugifying ~200 raw values linked 20 URLs
    // that 404 and ~170 thin long-tail pages (re-audit 2026-09-28).
    try {
      const hubs = await getLiveBodySystemHubs();
      h += `<ul>`;
      for (const hub of hubs) {
        h += `<li><a href="${exploreHubPath("body-system", hub.slug)}">${esc(hub.label)}</a></li>`;
      }
      h += `</ul>\n`;
    } catch {
      h += `<p>Browse research by body system.</p>\n`;
    }
  } else if (isListedExploreHubType(type)) {
    // The curated hubs that list studies — the same list (and links) the SPA
    // index renders from GET /api/explore/:type/hubs. Before 2026-09-28 these
    // indexes linked no hub at all for crawlers (benefit, life-stage and
    // mechanism until the hub-404 change).
    h += `<p>${esc(exploreIndexCopy(type).intro)}</p>\n`;
    try {
      const hubs = await getLiveExploreHubs(type);
      if (hubs.length > 0) {
        h += `<ul>`;
        for (const hub of hubs) {
          h += `<li><a href="${esc(hub.path)}">${esc(hub.name)}</a> (${studyCountLabel(hub.studyCount)})</li>`;
        }
        h += `</ul>\n`;
      }
    } catch {
      // Hub list unavailable — the intro and cross-links still render.
    }
  } else {
    h += `<p>Explore hydrogen therapy research organized by ${type.replace(/-/g, " ")}.</p>\n`;
  }

  // Cross-link to other browse pages
  h += `<section><h2>More Ways to Browse</h2><ul>`;
  for (const [key, label] of Object.entries(titles)) {
    if (key !== type) h += `<li><a href="/explore-by-${key}">${esc(label)}</a></li>`;
  }
  h += `<li><a href="/studies">All Studies</a></li>`;
  h += `<li><a href="/blog">Blog Articles</a></li>`;
  h += `</ul></section>\n`;

  h += footer(conditions);
  return h;
}

export interface ExploreDetailStudy {
  slug: string;
  title: string;
  publish_year: number | null;
  journal: string | null;
}

/**
 * Studies listed on an /explore-by-<type>/<slug> detail hub. Shared by the
 * crawler body below and the SPA (GET /api/explore/:type/:slug/studies), so
 * browsers and crawlers list the same studies.
 */
export async function getExploreDetailStudies(slug: string): Promise<ExploreDetailStudy[]> {
  const searchTerm = slug.replace(/-/g, " ");
  const studiesR = await db.execute(sql`
    SELECT slug, COALESCE(plain_language_title, title) as title, publish_year, journal
    FROM studies WHERE slug IS NOT NULL AND is_excluded = false AND (
      LOWER(title) LIKE LOWER(${"%" + searchTerm + "%"})
      OR LOWER(array_to_string(health_conditions, ' ')) LIKE LOWER(${"%" + searchTerm + "%"})
      OR LOWER(array_to_string(body_systems, ' ')) LIKE LOWER(${"%" + searchTerm + "%"})
      OR LOWER(COALESCE(h2_delivery_method, '')) LIKE LOWER(${"%" + searchTerm + "%"})
    )
    ORDER BY publish_year DESC NULLS LAST LIMIT 100
  `);
  return ((studiesR.rows || []) as any[]).map((row) => ({
    slug: row.slug,
    title: row.title,
    publish_year: row.publish_year ?? null,
    journal: row.journal ?? null,
  }));
}

async function renderExploreDetail(type: string, slug: string): Promise<string | null> {
  // Same H1/intro copy as the SPA hub page (shared/explore-hubs.ts).
  const { name: displayName, h1, intro } = exploreDetailCopy(slug);
  try {
    // Only hubs that exist render (exploreHubExists); any other slug (e.g.
    // /explore-by-demographic/xyzzy) used to render an empty 200 page (soft
    // 404) — now a hard 404, for browsers too.
    if (!(await exploreHubExists(type, slug))) return null;
    const [studies, conditions] = await Promise.all([
      getExploreDetailStudies(slug),
      getTopConditions(),
    ]);

    const parentLabels: Record<string, string> = {
      mechanism: "Mechanisms",
      "delivery-method": "Delivery Methods",
      "life-stage": "Life Stages",
      benefit: "Benefits",
      demographic: "Demographics",
    };

    let h = breadcrumbs([
      { label: "Home", href: "/" },
      { label: parentLabels[type] || type, href: `/explore-by-${type}` },
      { label: displayName },
    ]);
    h += `<h1>${esc(h1)}</h1>\n`;
    h += `<p>${esc(intro)}</p>\n`;

    if (studies.length > 0) {
      h += `<section><h2>Research Studies</h2><ul>`;
      for (const s of studies) {
        h += `<li><a href="/study/${esc(s.slug)}">${esc(s.title)}</a>`;
        if (s.publish_year) h += ` (${s.publish_year})`;
        h += `</li>`;
      }
      h += `</ul></section>\n`;
    }

    h += footer(conditions);
    return h;
  } catch { return null; }
}

export async function renderHydrogenForPage(slug: string): Promise<string | null> {
  // Same topic record as the SPA (HydrogenForConditionPage.tsx). Unknown
  // slugs have no page in the SPA either → null → hard 404.
  const topic = getHydrogenForTopic(slug);
  if (!topic) return null;
  const displayName = topic.name;
  const searchTerm = slug.replace(/-/g, " ");
  try {
    const [studiesR, blogsR, conditions] = await Promise.all([
      db.execute(sql`
        SELECT slug, COALESCE(plain_language_title, title) as title, publish_year, outcome
        FROM studies WHERE slug IS NOT NULL AND is_excluded = false AND (
          LOWER(array_to_string(health_conditions, ' ')) LIKE LOWER(${"%" + searchTerm + "%"})
          OR LOWER(title) LIKE LOWER(${"%" + searchTerm + "%"})
        )
        ORDER BY publish_year DESC NULLS LAST LIMIT 30
      `),
      getRelatedBlogs(searchTerm, 8),
      getTopConditions(),
    ]);

    const studies = (studiesR.rows || []) as any[];

    let h = breadcrumbs([{ label: "Home", href: "/" }, { label: `Hydrogen for ${displayName}` }]);
    h += `<h1>Hydrogen for ${esc(displayName)}</h1>\n`;
    h += `<p>Research on how molecular hydrogen therapy may help with ${esc(displayName.toLowerCase())}. `;
    h += `Explore ${studies.length} peer-reviewed studies below.</p>\n`;

    if (studies.length > 0) {
      h += `<section><h2>Research Studies</h2><ul>`;
      for (const s of studies) {
        h += `<li><a href="/study/${esc(s.slug)}">${esc(s.title)}</a>`;
        if (s.publish_year) h += ` (${s.publish_year})`;
        if (s.outcome) h += ` — ${esc(s.outcome)}`;
        h += `</li>`;
      }
      h += `</ul></section>\n`;
    }

    if (blogsR.length > 0) {
      h += `<section><h2>Related Articles</h2><ul>`;
      for (const b of blogsR) h += `<li><a href="/blog/${esc(b.slug)}">${esc(b.title)}</a></li>`;
      h += `</ul></section>\n`;
    }

    // Sponsor card — ONLY on Appendix E allowlisted topics (shared policy);
    // disease/gray-area topics get no product content of any kind.
    if (isBridgeAllowed(topic.bridgeTopic) && topic.products.length > 0) {
      const ctx = pageContextFromPath(`/hydrogen-for/${topic.slug}`);
      h += `<aside aria-label="Sponsor"><h2>From our sponsor, Echo Water</h2>`;
      h += `<p>Hydrogen Studies is funded by Echo Technologies LLC, which makes these products.</p><ul>`;
      for (const p of topic.products) {
        const product = ECHO_PRODUCTS[p.key];
        if (!product) continue;
        h += `<li><a href="${esc(echoProductUrl(product, ctx))}" rel="sponsored noopener">${esc(p.name)}</a> — ${esc(p.reason)}</li>`;
      }
      h += `</ul></aside>\n`;
    }

    // Visible FAQ — the page's FAQPage JSON-LD (seo-bot-middleware) is only
    // legitimate because these questions are rendered here, as in the SPA.
    if (topic.faqs.length > 0) {
      h += `<section><h2>Frequently Asked Questions</h2>`;
      for (const faq of topic.faqs) {
        h += `<h3>${esc(faq.question)}</h3><p>${esc(faq.answer)}</p>`;
      }
      h += `</section>\n`;
    }

    h += `<p><strong>Disclaimer:</strong> The information on this page is derived from published scientific research and is for educational purposes only. It is not intended to diagnose, treat, cure, or prevent any disease.</p>\n`;

    h += footer(conditions);
    return h;
  } catch { return null; }
}

function renderStaticPage(pathname: string): string | null {
  const pages: Record<string, { title: string; desc: string }> = {
    "/about": { title: "About Hydrogen Studies", desc: "Hydrogen Studies is the most comprehensive database of molecular hydrogen research, dedicated to making scientific research accessible to everyone." },
    "/contact": { title: "Contact Us", desc: "Get in touch with the Hydrogen Studies team. Questions about hydrogen research, partnership inquiries, or feedback welcome." },
    "/products": { title: "Hydrogen Products", desc: "Explore hydrogen water generators, inhalation devices, and other hydrogen therapy products backed by research." },
    "/recommendations": { title: "Research Recommendations", desc: "Personalized hydrogen therapy research recommendations based on your interests and health conditions." },
    "/privacy": { title: "Privacy Policy", desc: "How we collect, use, and protect your personal information." },
    "/terms": { title: "Terms of Service", desc: "Terms of service for using the Hydrogen Studies research database and website." },
    "/disclaimer": { title: "Medical Disclaimer", desc: "This website provides educational information only and is not a substitute for professional medical advice." },
    "/search": { title: "Search Research Studies", desc: "Search our database of hydrogen therapy research studies by keyword, condition, body system, or mechanism of action." },
    "/advanced-search": { title: "Advanced Research Search", desc: "Advanced search with filters for study type, outcome, date range, body system, and health condition." },
    "/hydrogen-therapy-guide": { title: "Hydrogen Therapy Guide", desc: "The complete evidence-based guide to hydrogen therapy — methods, research, safety, and practical guidance." },
    "/insights": { title: "Research Insights", desc: "Data-driven insights and trends from the hydrogen therapy research landscape." },
    "/research-analytics": { title: "Research Analytics", desc: "Analytics and statistics about the hydrogen therapy research landscape." },
  };

  // Learn pages
  const learnPages: Record<string, { title: string; desc: string }> = {
    "/learn/basics": { title: "Hydrogen Therapy Basics", desc: "Everything you need to know about molecular hydrogen therapy — what it is, how it works, and what the research shows." },
    "/learn/health-benefits": { title: "Hydrogen Health Benefits Guide", desc: "A comprehensive guide to the health benefits of molecular hydrogen, backed by peer-reviewed research." },
    "/learn/therapy-guide": { title: "Hydrogen Therapy Guide", desc: "Your complete guide to hydrogen therapy — methods, dosages, safety profile, and what to expect." },
  };

  const page = pages[pathname] || learnPages[pathname];
  if (!page) return null;

  const isLearn = pathname.startsWith("/learn/");
  const crumbs: { label: string; href?: string }[] = [{ label: "Home", href: "/" }];
  if (isLearn) crumbs.push({ label: "Learn", href: "/learn/basics" });
  crumbs.push({ label: page.title });

  let h = breadcrumbs(crumbs);
  h += `<h1>${esc(page.title)}</h1>\n`;
  h += `<p>${esc(page.desc)}</p>\n`;

  // Internal links section
  h += `<section><h2>Explore More</h2><ul>`;
  h += `<li><a href="/studies">Browse All Studies</a></li>`;
  h += `<li><a href="/blog">Read Blog Articles</a></li>`;
  h += `<li><a href="/explore-by-condition">Research by Condition</a></li>`;
  h += `<li><a href="/explore-by-body-system">Research by Body System</a></li>`;
  if (isLearn) {
    for (const [path, lp] of Object.entries(learnPages)) {
      if (path !== pathname) h += `<li><a href="${path}">${esc(lp.title)}</a></li>`;
    }
  }
  h += `</ul></section>\n`;

  // No footer needed here — caller won't add it either since this returns fully formed content
  // Actually, let's add footer for consistency
  return h;
}

// ── Main dispatcher ───────────────────────────────────────────

/**
 * Render the crawler body for `pathname`. Every echowater.com link in the
 * output (footer disclosure, sponsor cards, links inside article bodies) is
 * normalized to utm_campaign=<page_type>&utm_content=<slug> for THIS page —
 * the same rule the SPA applies via pageContextFromPath().
 */
export async function renderPageBody(pathname: string): Promise<string | null> {
  const body = await dispatchPageBody(pathname);
  return body ? rewriteEchoLinksInHtml(body, pageContextFromPath(pathname)) : body;
}

async function dispatchPageBody(pathname: string): Promise<string | null> {
  // Disclosure/policy pages (PLAN.md 0.3): must be crawlable — the footer
  // disclosure links here from every page, so a bot 404 would undermine it.
  if (pathname === "/editorial-policy" || pathname === "/methodology") {
    return renderPolicyPage(pathname);
  }

  // Study page
  const studyMatch = pathname.match(/^\/stud(?:y|ies)\/([^/]+)$/);
  if (studyMatch) return renderStudy(studyMatch[1]);

  // Blog page
  const blogMatch = pathname.match(/^\/blog\/([^/]+)$/);
  if (blogMatch) return renderBlog(blogMatch[1]);

  // Homepage
  if (pathname === "/" || pathname === "") return renderHomepage();

  // Listing pages
  if (pathname === "/studies") return renderStudiesList();
  if (pathname === "/blog") return renderBlogList();

  // Explore by condition
  const condMatch = pathname.match(/^\/explore-by-condition\/([^/]+)$/);
  if (condMatch) return renderConditionPage(condMatch[1]);
  if (pathname === "/explore-by-condition") return renderExploreIndex("condition");

  // Explore by body system
  const bsMatch = pathname.match(/^\/explore-by-body-system\/([^/]+)$/);
  if (bsMatch) return renderBodySystemPage(bsMatch[1]);
  if (pathname === "/explore-by-body-system") return renderExploreIndex("body-system");

  // Explore by mechanism / delivery-method / life-stage / benefit / demographic
  const exploreTypes = ["mechanism", "delivery-method", "life-stage", "benefit", "demographic"];
  for (const type of exploreTypes) {
    const re = new RegExp(`^/explore-by-${type}/([^/]+)$`);
    const m = pathname.match(re);
    if (m) return renderExploreDetail(type, m[1]);
    if (pathname === `/explore-by-${type}`) return renderExploreIndex(type);
  }

  // Hydrogen-for pages
  const h4Match = pathname.match(/^\/hydrogen-for\/([^/]+)$/);
  if (h4Match) return renderHydrogenForPage(h4Match[1]);

  // Static / learn pages
  const staticContent = renderStaticPage(pathname);
  if (staticContent) {
    const conditions = await getTopConditions();
    return staticContent + footer(conditions);
  }

  return null;
}
