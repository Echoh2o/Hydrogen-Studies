/**
 * SEO Body Renderer — Generates real HTML body content for crawler requests
 *
 * Injects H1, content, internal links, breadcrumbs, and footer into the
 * SPA shell so search engine crawlers see fully-formed pages, not an empty div.
 */

import { db } from "../db";
import { sql } from "drizzle-orm";
import { sanitizeArticleHtml } from "../utils/sanitize-html";

const SITE_URL = process.env.SITE_URL || "https://hydrogenstudies.com";

// ── Utilities ─────────────────────────────────────────────────

function esc(str: string | null | undefined): string {
  if (!str) return "";
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function stripHtml(str: string | null | undefined): string {
  if (!str) return "";
  return str.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
}

function truncate(str: string, max: number): string {
  if (!str || str.length <= max) return str || "";
  return str.substring(0, max - 3) + "...";
}

function slugify(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
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
  h += `<li><a href="/benefits">Benefits Overview</a></li>`;
  h += `</ul></section>`;

  h += `<section><h3>Company</h3><ul>`;
  h += `<li><a href="/about">About</a></li>`;
  h += `<li><a href="/contact">Contact</a></li>`;
  h += `<li><a href="/privacy">Privacy Policy</a></li>`;
  h += `<li><a href="/terms">Terms of Service</a></li>`;
  h += `</ul></section>`;

  h += `\n</nav>\n`;
  // Ownership disclosure (PLAN.md 0.3, Appendix B) — must appear in crawler
  // output on every page, same as the browser footer.
  h += `<p>Hydrogen Studies is built and funded by Echo Technologies LLC, the maker of `;
  h += `<a href="https://echowater.com?utm_source=hydrogenstudies&amp;utm_medium=referral&amp;utm_campaign=footer&amp;utm_content=disclosure" rel="sponsored">Echo Water</a> hydrogen products. `;
  h += `Our research team selects and summarizes studies independently; Echo does not decide which studies are included or how they are described. `;
  h += `<a href="/editorial-policy">Editorial policy</a> · <a href="/methodology">Methodology</a> · <a href="/contact">Contact</a></p>\n`;
  h += `<p>&copy; ${new Date().getFullYear()} Hydrogen Studies. Evidence-based hydrogen therapy research database.</p>\n`;
  h += `</footer>`;
  return h;
}

// ── Data queries ──────────────────────────────────────────────

async function getRelatedStudies(studyId: number, condition: string | null, limit = 8): Promise<{ slug: string; title: string; year: number | null }[]> {
  if (!condition) return [];
  try {
    const r = await db.execute(sql`
      SELECT slug, COALESCE(plain_language_title, title) as title, publish_year as year
      FROM studies
      WHERE array_to_string(health_conditions, ' ') ILIKE ${"%" + condition + "%"}
        AND id != ${studyId} AND slug IS NOT NULL
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
      WHERE is_published = true AND slug IS NOT NULL
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
      WHERE is_published = true AND slug IS NOT NULL AND id != ${blogId}
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
      FROM studies WHERE slug IS NOT NULL
      ORDER BY created_at DESC NULLS LAST LIMIT ${limit}
    `);
    return (r.rows || []).map((row: any) => ({ slug: row.slug, title: row.title }));
  } catch { return []; }
}

async function getRecentBlogs(limit = 10): Promise<{ slug: string; title: string }[]> {
  try {
    const r = await db.execute(sql`
      SELECT slug, title FROM blog_articles
      WHERE is_published = true AND slug IS NOT NULL
      ORDER BY created_at DESC LIMIT ${limit}
    `);
    return (r.rows || []).map((row: any) => ({ slug: row.slug, title: row.title }));
  } catch { return []; }
}

// ── Page renderers ────────────────────────────────────────────

async function renderStudy(slugOrId: string): Promise<string | null> {
  try {
    const studyCols = sql`id, title, plain_language_title, slug, authors, journal, publish_year,
      doi, study_type, outcome, peer_reviewed, country, category,
      health_conditions, body_systems,
      tldr, key_finding, plain_summary, summary_100_words, summary_50_words,
      practical_takeaway, how_to_apply, abstract`;
    const isNumeric = /^\d+$/.test(slugOrId);
    const r = isNumeric
      ? await db.execute(sql`SELECT ${studyCols} FROM studies WHERE id = ${parseInt(slugOrId)} LIMIT 1`)
      : await db.execute(sql`SELECT ${studyCols} FROM studies WHERE slug = ${slugOrId} LIMIT 1`);
    const s: any = r.rows?.[0];
    if (!s) return null;

    const title = s.plain_language_title || s.title;
    // health_conditions is a text array — use first element for display
    const conditionsArr: string[] = s.health_conditions || [];
    const condition = conditionsArr[0] || s.category || null;
    const bodySystemsArr: string[] = s.body_systems || [];
    const bodySystem = bodySystemsArr[0] || null;
    const [related, relatedBlogs, conditions] = await Promise.all([
      getRelatedStudies(s.id, condition),
      getRelatedBlogs(condition || ""),
      getTopConditions(),
    ]);

    const crumbs: { label: string; href?: string }[] = [
      { label: "Home", href: "/" },
      { label: "Studies", href: "/studies" },
    ];
    if (condition) {
      crumbs.push({ label: condition, href: `/explore-by-condition/${slugify(condition)}` });
    }
    crumbs.push({ label: truncate(title, 50) });

    let h = breadcrumbs(crumbs);
    h += `<article itemscope itemtype="https://schema.org/MedicalScholarlyArticle">\n`;
    h += `<h1 itemprop="headline">${esc(title)}</h1>\n`;

    // Metadata table
    h += `<dl>`;
    if (s.authors) h += `<dt>Authors</dt><dd itemprop="author">${esc(s.authors)}</dd>`;
    if (s.journal) h += `<dt>Journal</dt><dd>${esc(s.journal)}</dd>`;
    if (s.publish_year) h += `<dt>Year</dt><dd itemprop="datePublished">${s.publish_year}</dd>`;
    if (s.doi) h += `<dt>DOI</dt><dd><a href="https://doi.org/${esc(s.doi)}" rel="noopener">${esc(s.doi)}</a></dd>`;
    if (s.study_type) h += `<dt>Study Type</dt><dd>${esc(s.study_type)}</dd>`;
    if (s.outcome) h += `<dt>Outcome</dt><dd>${esc(s.outcome)}</dd>`;
    if (s.peer_reviewed) h += `<dt>Peer Reviewed</dt><dd>Yes</dd>`;
    if (s.country) h += `<dt>Country</dt><dd>${esc(s.country)}</dd>`;
    if (condition) h += `<dt>Health Condition</dt><dd><a href="/explore-by-condition/${slugify(condition)}">${esc(condition)}</a></dd>`;
    if (bodySystem) h += `<dt>Body System</dt><dd><a href="/explore-by-body-system/${slugify(bodySystem)}">${esc(bodySystem)}</a></dd>`;
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
    if (s.abstract) h += `<section><h2>Abstract</h2><p>${esc(stripHtml(s.abstract))}</p></section>\n`;
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

async function renderBlog(slugOrId: string): Promise<string | null> {
  try {
    const isNumeric = /^\d+$/.test(slugOrId);
    const r = isNumeric
      ? await db.execute(sql`SELECT id, title, slug, content, summary, created_at FROM blog_articles WHERE id = ${parseInt(slugOrId)} AND is_published = true AND is_archived = false LIMIT 1`)
      : await db.execute(sql`SELECT id, title, slug, content, summary, created_at FROM blog_articles WHERE slug = ${slugOrId} AND is_published = true AND is_archived = false LIMIT 1`);
    const b: any = r.rows?.[0];
    if (!b) return null;

    const [relatedBlogs, conditions] = await Promise.all([
      getRelatedBlogsForBlog(b.id, null),
      getTopConditions(),
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
    if (b.created_at) h += `<time itemprop="datePublished" datetime="${new Date(b.created_at).toISOString()}">${fmtDate(b.created_at)}</time>\n`;

    // Blog content — DOM-aware allowlist sanitization (DOMPurify), keeps
    // structural HTML while stripping scripts/handlers/dangerous URIs.
    if (b.content) {
      const safeContent = sanitizeArticleHtml(b.content as string);
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
    db.execute(sql`SELECT count(*) as total, count(*) FILTER (WHERE peer_reviewed = true) as reviewed FROM studies`).catch(() => ({ rows: [{ total: 0, reviewed: 0 }] })),
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
  h += `<li><a href="/benefits">Benefits Overview</a></li>`;
  h += `</ul></section>\n`;

  h += footer(conditions);
  return h;
}

async function renderStudiesList(): Promise<string> {
  const [studiesR, conditions] = await Promise.all([
    db.execute(sql`
      SELECT slug, COALESCE(plain_language_title, title) as title, publish_year, journal
      FROM studies WHERE slug IS NOT NULL
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

async function renderBlogList(): Promise<string> {
  const [blogsR, conditions] = await Promise.all([
    db.execute(sql`
      SELECT slug, title, category, created_at
      FROM blog_articles WHERE is_published = true AND slug IS NOT NULL
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
    if (b.category) h += ` — ${esc(b.category)}`;
    h += `</li>`;
  }
  h += `</ul>\n`;

  h += footer(conditions);
  return h;
}

async function renderConditionPage(slug: string): Promise<string | null> {
  try {
    const condR = await db.execute(sql`
      SELECT name, slug, description FROM health_conditions WHERE slug = ${slug} LIMIT 1
    `);
    const cond: any = condR.rows?.[0];
    if (!cond) return null;

    const [studiesR, relatedBlogs, conditions] = await Promise.all([
      db.execute(sql`
        SELECT slug, COALESCE(plain_language_title, title) as title, publish_year, journal, study_type
        FROM studies
        WHERE array_to_string(health_conditions, ' ') ILIKE ${"%" + cond.name + "%"} AND slug IS NOT NULL
        ORDER BY publish_year DESC NULLS LAST LIMIT 100
      `),
      getRelatedBlogs(cond.name),
      getTopConditions(),
    ]);

    const studies = (studiesR.rows || []) as any[];

    let h = breadcrumbs([
      { label: "Home", href: "/" },
      { label: "Health Conditions", href: "/explore-by-condition" },
      { label: cond.name },
    ]);
    h += `<h1>Hydrogen Research for ${esc(cond.name)}</h1>\n`;
    if (cond.description) h += `<p>${esc(cond.description)}</p>\n`;
    h += `<p>${studies.length} research stud${studies.length === 1 ? "y" : "ies"} on hydrogen therapy for ${esc(cond.name.toLowerCase())}.</p>\n`;

    if (studies.length > 0) {
      h += `<section><h2>Research Studies</h2><ul>`;
      for (const s of studies) {
        h += `<li><a href="/study/${esc(s.slug)}">${esc(s.title)}</a>`;
        const meta = [s.publish_year, s.journal, s.study_type].filter(Boolean).join(", ");
        if (meta) h += ` — ${esc(String(meta))}`;
        h += `</li>`;
      }
      h += `</ul></section>\n`;
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
  const displayName = slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  try {
    const searchTerm = slug.replace(/-/g, " ");
    const [studiesR, conditions] = await Promise.all([
      db.execute(sql`
        SELECT slug, COALESCE(plain_language_title, title) as title, publish_year, journal
        FROM studies
        WHERE (LOWER(array_to_string(body_systems, ' ')) LIKE LOWER(${"%" + searchTerm + "%"})
            OR LOWER(array_to_string(body_systems, ' ')) LIKE LOWER(${"%" + slug + "%"}))
          AND slug IS NOT NULL
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
    h += `<p>Research studies on molecular hydrogen's effects on the ${esc(displayName.toLowerCase())} system. Browse clinical trials, reviews, and findings.</p>\n`;

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
    mechanism: "Hydrogen Research by Mechanism",
    "delivery-method": "Hydrogen Research by Delivery Method",
    "life-stage": "Hydrogen Research by Life Stage",
    benefit: "Hydrogen Research by Health Benefit",
    demographic: "Hydrogen Research by Demographics",
  };
  const title = titles[type] || "Explore Hydrogen Research";

  let h = breadcrumbs([{ label: "Home", href: "/" }, { label: title }]);
  h += `<h1>${esc(title)}</h1>\n`;

  if (type === "condition") {
    try {
      const r = await db.execute(sql`
        SELECT name, slug, study_count FROM health_conditions
        WHERE slug IS NOT NULL ORDER BY study_count DESC NULLS LAST
      `);
      h += `<ul>`;
      for (const c of (r.rows || []) as any[]) {
        h += `<li><a href="/explore-by-condition/${esc(c.slug)}">${esc(c.name)}</a>`;
        if (c.study_count) h += ` (${c.study_count} studies)`;
        h += `</li>`;
      }
      h += `</ul>\n`;
    } catch {
      h += `<p>Explore conditions by browsing the research database.</p>\n`;
    }
  } else if (type === "body-system") {
    try {
      const r = await db.execute(sql`
        SELECT DISTINCT unnest(body_systems) as body_system FROM studies
        WHERE body_systems IS NOT NULL ORDER BY 1
      `);
      h += `<ul>`;
      for (const row of (r.rows || []) as any[]) {
        const bs = row.body_system;
        h += `<li><a href="/explore-by-body-system/${slugify(bs)}">${esc(bs)}</a></li>`;
      }
      h += `</ul>\n`;
    } catch {
      h += `<p>Browse research by body system.</p>\n`;
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

async function renderExploreDetail(type: string, slug: string): Promise<string | null> {
  const displayName = slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  const searchTerm = slug.replace(/-/g, " ");
  try {
    const [studiesR, conditions] = await Promise.all([
      db.execute(sql`
        SELECT slug, COALESCE(plain_language_title, title) as title, publish_year, journal
        FROM studies WHERE slug IS NOT NULL AND (
          LOWER(title) LIKE LOWER(${"%" + searchTerm + "%"})
          OR LOWER(array_to_string(health_conditions, ' ')) LIKE LOWER(${"%" + searchTerm + "%"})
          OR LOWER(array_to_string(body_systems, ' ')) LIKE LOWER(${"%" + searchTerm + "%"})
          OR LOWER(COALESCE(h2_delivery_method, '')) LIKE LOWER(${"%" + searchTerm + "%"})
        )
        ORDER BY publish_year DESC NULLS LAST LIMIT 100
      `),
      getTopConditions(),
    ]);

    const studies = (studiesR.rows || []) as any[];
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
    h += `<h1>${esc(displayName)} — Hydrogen Therapy Research</h1>\n`;
    h += `<p>Research studies related to ${esc(displayName.toLowerCase())} in hydrogen therapy.</p>\n`;

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

async function renderHydrogenForPage(slug: string): Promise<string | null> {
  const displayName = slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  const searchTerm = slug.replace(/-/g, " ");
  try {
    const [studiesR, blogsR, conditions] = await Promise.all([
      db.execute(sql`
        SELECT slug, COALESCE(plain_language_title, title) as title, publish_year, outcome
        FROM studies WHERE slug IS NOT NULL AND (
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

    h += footer(conditions);
    return h;
  } catch { return null; }
}

function renderStaticPage(pathname: string): string | null {
  const pages: Record<string, { title: string; desc: string }> = {
    "/about": { title: "About Hydrogen Studies", desc: "Hydrogen Studies is the most comprehensive database of molecular hydrogen research, dedicated to making scientific research accessible to everyone." },
    "/benefits": { title: "Health Benefits of Hydrogen", desc: "Discover the scientifically-studied health benefits of molecular hydrogen, from anti-inflammatory effects to neuroprotection, backed by peer-reviewed research." },
    "/contact": { title: "Contact Us", desc: "Get in touch with the Hydrogen Studies team. Questions about hydrogen research, partnership inquiries, or feedback welcome." },
    "/products": { title: "Hydrogen Products", desc: "Explore hydrogen water generators, inhalation devices, and other hydrogen therapy products backed by research." },
    "/recommendations": { title: "Research Recommendations", desc: "Personalized hydrogen therapy research recommendations based on your interests and health conditions." },
    "/privacy": { title: "Privacy Policy", desc: "How we collect, use, and protect your personal information." },
    "/terms": { title: "Terms of Service", desc: "Terms of service for using the Hydrogen Studies research database and website." },
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

export async function renderPageBody(pathname: string): Promise<string | null> {
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
