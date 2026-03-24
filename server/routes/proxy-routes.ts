import { Router, Request, Response } from "express";
import { pool } from "../db";

const router = Router();

// ============================================================
// CONSTANTS
// ============================================================

const BASE_URL = "https://echowater.com/tools/hydrogen-research";
const ITEMS_PER_PAGE = 20;

// ============================================================
// INLINE CSS
// ============================================================

const CSS = `
  /* Reset & Base */
  *,*::before,*::after{box-sizing:border-box}
  .h2r-root{
    font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;
    color:#1a1a2e;line-height:1.6;max-width:1100px;margin:0 auto;padding:0 16px;
    -webkit-font-smoothing:antialiased;
  }

  /* Typography */
  .h2r-h1{font-size:1.75rem;font-weight:700;margin:0 0 8px;color:#0f0f23}
  .h2r-h2{font-size:1.35rem;font-weight:600;margin:24px 0 12px;color:#0f0f23}
  .h2r-h3{font-size:1.1rem;font-weight:600;margin:20px 0 8px;color:#1a1a2e}
  .h2r-subtitle{font-size:0.95rem;color:#555;margin:0 0 24px}
  .h2r-text{font-size:0.93rem;color:#333;margin:0 0 12px}
  .h2r-small{font-size:0.82rem;color:#666}
  .h2r-muted{color:#777}

  /* Links */
  .h2r-link{color:#1a6bc4;text-decoration:none;transition:color .15s}
  .h2r-link:hover{color:#0d4a8c;text-decoration:underline}

  /* Stats Bar */
  .h2r-stats-bar{
    display:flex;flex-wrap:wrap;gap:16px;padding:16px 0;margin:0 0 24px;
    border-bottom:1px solid #e5e7eb;
  }
  .h2r-stat{text-align:center;flex:1;min-width:100px}
  .h2r-stat-number{font-size:1.5rem;font-weight:700;color:#1a6bc4;display:block}
  .h2r-stat-label{font-size:0.78rem;color:#666;text-transform:uppercase;letter-spacing:0.5px}

  /* Search & Filters */
  .h2r-search-form{
    display:flex;flex-wrap:wrap;gap:10px;margin:0 0 24px;
    padding:16px;background:#f8f9fb;border-radius:8px;border:1px solid #e5e7eb;
  }
  .h2r-input,.h2r-select{
    padding:8px 12px;border:1px solid #d1d5db;border-radius:6px;
    font-size:0.9rem;font-family:inherit;background:#fff;
  }
  .h2r-input{flex:1;min-width:200px}
  .h2r-select{min-width:140px}
  .h2r-btn{
    padding:8px 20px;background:#1a6bc4;color:#fff;border:none;border-radius:6px;
    font-size:0.9rem;font-weight:500;cursor:pointer;transition:background .15s;
    font-family:inherit;
  }
  .h2r-btn:hover{background:#155ba0}
  .h2r-btn-secondary{background:#6b7280}
  .h2r-btn-secondary:hover{background:#4b5563}
  .h2r-btn-sm{padding:5px 12px;font-size:0.82rem}

  /* Study Cards */
  .h2r-card{
    border:1px solid #e5e7eb;border-radius:8px;padding:20px;margin:0 0 16px;
    background:#fff;transition:box-shadow .15s;
  }
  .h2r-card:hover{box-shadow:0 2px 8px rgba(0,0,0,0.06)}
  .h2r-card-title{font-size:1.05rem;font-weight:600;margin:0 0 8px;line-height:1.4}
  .h2r-card-meta{font-size:0.82rem;color:#666;margin:0 0 10px}
  .h2r-card-finding{
    font-size:0.9rem;color:#1a1a2e;margin:10px 0;padding:10px 14px;
    background:#f0f7ff;border-left:3px solid #1a6bc4;border-radius:0 4px 4px 0;
  }
  .h2r-card-tags{display:flex;flex-wrap:wrap;gap:6px;margin:10px 0 0}

  /* Badges */
  .h2r-badge{
    display:inline-block;padding:2px 8px;border-radius:4px;font-size:0.75rem;
    font-weight:500;text-transform:uppercase;letter-spacing:0.3px;
  }
  .h2r-badge-human{background:#dcfce7;color:#166534}
  .h2r-badge-rct{background:#dcfce7;color:#166534}
  .h2r-badge-animal{background:#dbeafe;color:#1e40af}
  .h2r-badge-invitro{background:#f3e8ff;color:#6b21a8}
  .h2r-badge-review{background:#f3f4f6;color:#374151}
  .h2r-badge-meta{background:#f3f4f6;color:#374151}
  .h2r-badge-default{background:#f3f4f6;color:#374151}
  .h2r-tag{
    display:inline-block;padding:2px 8px;border-radius:12px;font-size:0.75rem;
    background:#eff6ff;color:#1a6bc4;
  }

  /* Pagination */
  .h2r-pagination{
    display:flex;justify-content:center;gap:6px;margin:32px 0;flex-wrap:wrap;
  }
  .h2r-page-link{
    display:inline-block;padding:6px 12px;border:1px solid #d1d5db;
    border-radius:6px;font-size:0.85rem;color:#1a6bc4;text-decoration:none;
    transition:all .15s;
  }
  .h2r-page-link:hover{background:#eff6ff;border-color:#1a6bc4}
  .h2r-page-link-active{background:#1a6bc4;color:#fff;border-color:#1a6bc4}
  .h2r-page-link-disabled{color:#9ca3af;pointer-events:none;opacity:0.5}

  /* Detail Page */
  .h2r-detail-header{margin:0 0 24px;padding:0 0 16px;border-bottom:1px solid #e5e7eb}
  .h2r-detail-meta{
    display:flex;flex-wrap:wrap;gap:16px;margin:12px 0 0;font-size:0.85rem;color:#555;
  }
  .h2r-detail-meta-item{display:flex;align-items:center;gap:4px}
  .h2r-section{margin:0 0 28px}
  .h2r-section-title{
    font-size:1.05rem;font-weight:600;color:#0f0f23;margin:0 0 10px;
    padding:0 0 6px;border-bottom:2px solid #eff6ff;
  }
  .h2r-key-finding{
    background:#f0f7ff;border:1px solid #bfdbfe;border-radius:8px;padding:16px;
    margin:0 0 24px;font-size:0.95rem;
  }
  .h2r-key-finding-label{font-weight:600;color:#1a6bc4;font-size:0.82rem;text-transform:uppercase;letter-spacing:0.5px;margin:0 0 6px}
  .h2r-metadata-grid{
    display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:12px;
    margin:0 0 24px;
  }
  .h2r-metadata-item{
    background:#f8f9fb;border-radius:6px;padding:12px;
  }
  .h2r-metadata-label{font-size:0.78rem;color:#666;text-transform:uppercase;letter-spacing:0.5px;margin:0 0 4px}
  .h2r-metadata-value{font-size:0.93rem;font-weight:500;color:#1a1a2e}
  .h2r-citation-box{
    background:#f8f9fb;border:1px solid #e5e7eb;border-radius:6px;padding:14px;
    font-size:0.85rem;color:#333;font-style:italic;word-break:break-word;
  }
  .h2r-disclaimer{
    background:#fffbeb;border:1px solid #fde68a;border-radius:6px;padding:14px;
    font-size:0.82rem;color:#92400e;margin:32px 0 0;
  }
  .h2r-related-list{list-style:none;padding:0;margin:0}
  .h2r-related-list li{padding:8px 0;border-bottom:1px solid #f3f4f6}
  .h2r-related-list li:last-child{border-bottom:none}

  /* Tables */
  .h2r-table-wrap{overflow-x:auto;margin:0 0 24px}
  .h2r-table{
    width:100%;border-collapse:collapse;font-size:0.9rem;
  }
  .h2r-table th{
    text-align:left;padding:10px 14px;background:#f8f9fb;border-bottom:2px solid #e5e7eb;
    font-weight:600;font-size:0.82rem;text-transform:uppercase;letter-spacing:0.3px;color:#555;
  }
  .h2r-table td{padding:10px 14px;border-bottom:1px solid #f3f4f6}
  .h2r-table tr:hover td{background:#f8f9fb}

  /* Embed Widget */
  .h2r-embed{max-width:400px;font-size:0.88rem;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden}
  .h2r-embed-header{background:#f8f9fb;padding:12px 14px;border-bottom:1px solid #e5e7eb}
  .h2r-embed-header h3{margin:0;font-size:0.95rem;font-weight:600}
  .h2r-embed-body{max-height:400px;overflow-y:auto;padding:0}
  .h2r-embed-item{padding:12px 14px;border-bottom:1px solid #f3f4f6}
  .h2r-embed-item:last-child{border-bottom:none}
  .h2r-embed-footer{padding:10px 14px;text-align:center;background:#f8f9fb;border-top:1px solid #e5e7eb}

  /* Breadcrumb */
  .h2r-breadcrumb{font-size:0.82rem;color:#666;margin:0 0 16px}
  .h2r-breadcrumb a{color:#1a6bc4;text-decoration:none}
  .h2r-breadcrumb a:hover{text-decoration:underline}
  .h2r-breadcrumb span{margin:0 6px;color:#9ca3af}

  /* Condition Stats */
  .h2r-condition-stats{
    display:flex;flex-wrap:wrap;gap:12px;margin:0 0 24px;
  }
  .h2r-condition-stat-card{
    background:#f8f9fb;border:1px solid #e5e7eb;border-radius:6px;padding:12px 16px;
    text-align:center;min-width:120px;
  }

  /* Responsive */
  @media(max-width:640px){
    .h2r-h1{font-size:1.35rem}
    .h2r-stats-bar{gap:8px}
    .h2r-stat{min-width:80px}
    .h2r-stat-number{font-size:1.2rem}
    .h2r-search-form{flex-direction:column}
    .h2r-input,.h2r-select{min-width:100%}
    .h2r-metadata-grid{grid-template-columns:1fr}
    .h2r-detail-meta{flex-direction:column;gap:8px}
  }
`;

// ============================================================
// HELPER FUNCTIONS
// ============================================================

/**
 * Wraps page content in a full HTML document with inline CSS, meta tags, and canonical URL.
 */
function renderPage(title: string, metaDescription: string, content: string, canonicalPath: string): string {
  const canonicalUrl = `${BASE_URL}${canonicalPath}`;
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeAttr(metaDescription)}">
  <link rel="canonical" href="${escapeAttr(canonicalUrl)}">
  <meta property="og:title" content="${escapeAttr(title)}">
  <meta property="og:description" content="${escapeAttr(metaDescription)}">
  <meta property="og:url" content="${escapeAttr(canonicalUrl)}">
  <meta property="og:type" content="website">
  <style>${CSS}</style>
</head>
<body>
  <div class="h2r-root">
    ${content}
  </div>
</body>
</html>`;
}

/**
 * Renders a page with JSON-LD structured data injected into the head.
 */
function renderPageWithSchema(title: string, metaDescription: string, content: string, canonicalPath: string, jsonLd: object, ogImage?: string): string {
  const canonicalUrl = `${BASE_URL}${canonicalPath}`;
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeAttr(metaDescription)}">
  <link rel="canonical" href="${escapeAttr(canonicalUrl)}">
  <meta property="og:title" content="${escapeAttr(title)}">
  <meta property="og:description" content="${escapeAttr(metaDescription)}">
  <meta property="og:url" content="${escapeAttr(canonicalUrl)}">
  <meta property="og:type" content="article">
  ${ogImage ? `<meta property="og:image" content="${escapeAttr(ogImage)}">` : ""}
  <script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
  <style>${CSS}</style>
</head>
<body>
  <div class="h2r-root">
    ${content}
  </div>
</body>
</html>`;
}

function escapeHtml(str: string): string {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttr(str: string): string {
  if (!str) return "";
  return str.replace(/"/g, "&quot;").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function getStudyTypeBadgeClass(studyType: string | null): string {
  if (!studyType) return "h2r-badge h2r-badge-default";
  const lower = studyType.toLowerCase();
  if (lower.includes("rct") || lower.includes("randomized")) return "h2r-badge h2r-badge-rct";
  if (lower.includes("human") || lower.includes("clinical")) return "h2r-badge h2r-badge-human";
  if (lower.includes("animal")) return "h2r-badge h2r-badge-animal";
  if (lower.includes("vitro") || lower.includes("cell")) return "h2r-badge h2r-badge-invitro";
  if (lower.includes("review")) return "h2r-badge h2r-badge-review";
  if (lower.includes("meta")) return "h2r-badge h2r-badge-meta";
  return "h2r-badge h2r-badge-default";
}

function formatStudyType(studyType: string | null): string {
  if (!studyType) return "Study";
  return studyType
    .split(/[\s_-]+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

function truncate(str: string | null, maxLen: number): string {
  if (!str) return "";
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen).replace(/\s+\S*$/, "") + "...";
}

function buildQueryString(params: Record<string, string | number | undefined>): string {
  const parts: string[] = [];
  for (const [key, val] of Object.entries(params)) {
    if (val !== undefined && val !== "" && val !== null) {
      parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(val))}`);
    }
  }
  return parts.length > 0 ? `?${parts.join("&")}` : "";
}

function renderBreadcrumb(items: Array<{ label: string; href?: string }>): string {
  return `<nav class="h2r-breadcrumb" aria-label="Breadcrumb">${items
    .map((item, i) => {
      if (i === items.length - 1) return escapeHtml(item.label);
      return `<a href="${escapeAttr(item.href || "#")}">${escapeHtml(item.label)}</a><span>/</span>`;
    })
    .join("")}</nav>`;
}

function renderStudyCard(study: any, conditionNames?: string[]): string {
  const displayTitle = study.plain_language_title || study.title;
  const slug = study.slug || study.id;
  const finding = study.results_short || study.conclusion_short || "";
  const imgSrc = study.image_url ? (study.image_url.startsWith("/") ? study.image_url : "/" + study.image_url) : "";

  return `<div class="h2r-card"${imgSrc ? ' style="display:flex;gap:16px;align-items:flex-start"' : ""}>
    ${imgSrc ? `<a href="/tools/hydrogen-research/study/${escapeAttr(slug)}" style="flex-shrink:0"><img src="${escapeAttr(imgSrc)}" alt="" loading="lazy" width="120" height="80" style="width:120px;height:80px;object-fit:cover;border-radius:6px"></a>` : ""}
    <div style="flex:1;min-width:0">
      <a href="/tools/hydrogen-research/study/${escapeAttr(slug)}" class="h2r-link" style="text-decoration:none">
        <div class="h2r-card-title" style="color:#0f0f23">${escapeHtml(displayTitle)}</div>
      </a>
      <div class="h2r-card-meta">
        ${study.authors ? escapeHtml(truncate(study.authors, 80)) + " &middot; " : ""}
        ${study.publish_year ? study.publish_year + " &middot; " : ""}
        ${study.journal ? `<em>${escapeHtml(truncate(study.journal, 50))}</em>` : ""}
        ${study.study_type ? ` &middot; <span class="${getStudyTypeBadgeClass(study.study_type)}">${escapeHtml(formatStudyType(study.study_type))}</span>` : ""}
      </div>
      ${finding ? `<div class="h2r-card-finding">${escapeHtml(truncate(finding, 250))}</div>` : ""}
      ${conditionNames && conditionNames.length > 0 ? `<div class="h2r-card-tags">${conditionNames.map((c) => `<span class="h2r-tag">${escapeHtml(c)}</span>`).join("")}</div>` : ""}
    </div>
  </div>`;
}

function renderPagination(currentPage: number, totalPages: number, baseUrl: string, queryParams: Record<string, string | number | undefined>): string {
  if (totalPages <= 1) return "";

  const links: string[] = [];
  const buildUrl = (page: number) => {
    const params = { ...queryParams, page: page > 1 ? page : undefined };
    return baseUrl + buildQueryString(params as any);
  };

  // Previous
  if (currentPage > 1) {
    links.push(`<a href="${escapeAttr(buildUrl(currentPage - 1))}" class="h2r-page-link">&laquo; Prev</a>`);
  } else {
    links.push(`<span class="h2r-page-link h2r-page-link-disabled">&laquo; Prev</span>`);
  }

  // Page numbers (show max 7 around current)
  const start = Math.max(1, currentPage - 3);
  const end = Math.min(totalPages, currentPage + 3);

  if (start > 1) {
    links.push(`<a href="${escapeAttr(buildUrl(1))}" class="h2r-page-link">1</a>`);
    if (start > 2) links.push(`<span class="h2r-page-link h2r-page-link-disabled">&hellip;</span>`);
  }

  for (let i = start; i <= end; i++) {
    if (i === currentPage) {
      links.push(`<span class="h2r-page-link h2r-page-link-active">${i}</span>`);
    } else {
      links.push(`<a href="${escapeAttr(buildUrl(i))}" class="h2r-page-link">${i}</a>`);
    }
  }

  if (end < totalPages) {
    if (end < totalPages - 1) links.push(`<span class="h2r-page-link h2r-page-link-disabled">&hellip;</span>`);
    links.push(`<a href="${escapeAttr(buildUrl(totalPages))}" class="h2r-page-link">${totalPages}</a>`);
  }

  // Next
  if (currentPage < totalPages) {
    links.push(`<a href="${escapeAttr(buildUrl(currentPage + 1))}" class="h2r-page-link">Next &raquo;</a>`);
  } else {
    links.push(`<span class="h2r-page-link h2r-page-link-disabled">Next &raquo;</span>`);
  }

  return `<nav class="h2r-pagination" aria-label="Pagination">${links.join("")}</nav>`;
}


// ============================================================
// ROUTE 1: Main Search/Browse Page
// GET /proxy/
// ============================================================

router.get("/", async (req: Request, res: Response) => {
  try {
    const page = Math.min(500, Math.max(1, parseInt(req.query.page as string, 10) || 1));
    const search = (req.query.q as string || "").trim().slice(0, 200);
    const conditionSlug = (req.query.condition as string || "").trim().slice(0, 100);
    const studyType = (req.query.type as string || "").trim().slice(0, 50);
    const yearFrom = parseInt(req.query.yearFrom as string, 10) || 0;
    const yearTo = parseInt(req.query.yearTo as string, 10) || 0;

    // Build WHERE clauses
    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (search) {
      conditions.push(`(s.search_vector @@ plainto_tsquery('english', $${paramIndex}) OR s.title ILIKE $${paramIndex + 1})`);
      params.push(search, `%${search}%`);
      paramIndex += 2;
    }

    if (studyType) {
      conditions.push(`s.study_type ILIKE $${paramIndex}`);
      params.push(`%${studyType}%`);
      paramIndex++;
    }

    if (yearFrom) {
      conditions.push(`s.publish_year >= $${paramIndex}`);
      params.push(yearFrom);
      paramIndex++;
    }

    if (yearTo) {
      conditions.push(`s.publish_year <= $${paramIndex}`);
      params.push(yearTo);
      paramIndex++;
    }

    if (conditionSlug) {
      conditions.push(`EXISTS (
        SELECT 1 FROM study_health_conditions shc
        JOIN health_conditions hc ON hc.id = shc.health_condition_id
        WHERE shc.study_id = s.id AND hc.slug = $${paramIndex}
      )`);
      params.push(conditionSlug);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const offset = (page - 1) * ITEMS_PER_PAGE;

    // Count total
    const countQuery = `SELECT COUNT(*) as total FROM studies s ${whereClause}`;
    const countRows = await executeRawQuery(countQuery, params);
    const totalStudies = parseInt(countRows[0]?.total || "0", 10);
    const totalPages = Math.ceil(totalStudies / ITEMS_PER_PAGE);

    // Fetch studies
    const studiesQuery = `
      SELECT s.id, s.title, s.plain_language_title, s.slug, s.authors, s.journal,
             s.publish_year, s.study_type, s.results_short, s.conclusion_short,
             s.is_human_trial, s.peer_reviewed, s.sample_size, s.image_url
      FROM studies s
      ${whereClause}
      ORDER BY s.publish_year DESC NULLS LAST, s.id DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    const studyRows = await executeRawQuery(studiesQuery, [...params, ITEMS_PER_PAGE, offset]);

    // Fetch conditions for each study
    const studyIds = studyRows.map((s: any) => s.id);
    let conditionMap: Record<number, string[]> = {};
    if (studyIds.length > 0) {
      const placeholders = studyIds.map((_: any, i: number) => `$${i + 1}`).join(",");
      const condQuery = `
        SELECT shc.study_id, hc.name FROM study_health_conditions shc
        JOIN health_conditions hc ON hc.id = shc.health_condition_id
        WHERE shc.study_id IN (${placeholders})
      `;
      const condRows = await executeRawQuery(condQuery, studyIds);
      for (const row of condRows) {
        if (!conditionMap[row.study_id]) conditionMap[row.study_id] = [];
        conditionMap[row.study_id].push(row.name);
      }
    }

    // Fetch all conditions for filter dropdown
    const allConditions = await executeRawQuery(
      `SELECT slug, name FROM health_conditions ORDER BY name ASC`,
      []
    );

    // Stats
    const statsRows = await executeRawQuery(`
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE is_human_trial = true) as human_trials,
        COUNT(DISTINCT study_type) as type_count
      FROM studies
    `, []);
    const stats = statsRows[0] || { total: 0, human_trials: 0, type_count: 0 };
    const conditionCountRows = await executeRawQuery(`SELECT COUNT(*) as cnt FROM health_conditions`, []);
    const conditionCount = conditionCountRows[0]?.cnt || 0;

    // Build study cards
    const studyCards = studyRows.map((s: any) => renderStudyCard(s, conditionMap[s.id] || [])).join("");

    const queryParams = {
      q: search || undefined,
      condition: conditionSlug || undefined,
      type: studyType || undefined,
      yearFrom: yearFrom || undefined,
      yearTo: yearTo || undefined,
    };

    const conditionOptions = allConditions
      .map((c: any) => `<option value="${escapeAttr(c.slug)}" ${conditionSlug === c.slug ? "selected" : ""}>${escapeHtml(c.name)}</option>`)
      .join("");

    const content = `
      <h1 class="h2r-h1">Hydrogen Water Research Database</h1>
      <p class="h2r-subtitle">A curated collection of peer-reviewed studies on molecular hydrogen (H&#8322;) therapy, maintained by Echo Water.</p>

      <div class="h2r-stats-bar">
        <div class="h2r-stat">
          <span class="h2r-stat-number">${stats.total}</span>
          <span class="h2r-stat-label">Total Studies</span>
        </div>
        <div class="h2r-stat">
          <span class="h2r-stat-number">${stats.human_trials}</span>
          <span class="h2r-stat-label">Human Trials</span>
        </div>
        <div class="h2r-stat">
          <span class="h2r-stat-number">${conditionCount}</span>
          <span class="h2r-stat-label">Conditions</span>
        </div>
      </div>

      <form class="h2r-search-form" method="GET" action="/tools/hydrogen-research/">
        <input class="h2r-input" type="text" name="q" placeholder="Search studies..." value="${escapeAttr(search)}" aria-label="Search studies">
        <select class="h2r-select" name="condition" aria-label="Filter by condition">
          <option value="">All Conditions</option>
          ${conditionOptions}
        </select>
        <select class="h2r-select" name="type" aria-label="Filter by study type">
          <option value="">All Types</option>
          <option value="human" ${studyType === "human" ? "selected" : ""}>Human Trial</option>
          <option value="animal" ${studyType === "animal" ? "selected" : ""}>Animal Study</option>
          <option value="in vitro" ${studyType === "in vitro" ? "selected" : ""}>In Vitro</option>
          <option value="review" ${studyType === "review" ? "selected" : ""}>Review</option>
          <option value="meta-analysis" ${studyType === "meta-analysis" ? "selected" : ""}>Meta-Analysis</option>
        </select>
        <input class="h2r-input" type="number" name="yearFrom" placeholder="Year from" value="${yearFrom || ""}" style="max-width:100px" aria-label="Year from">
        <input class="h2r-input" type="number" name="yearTo" placeholder="Year to" value="${yearTo || ""}" style="max-width:100px" aria-label="Year to">
        <button class="h2r-btn" type="submit">Search</button>
        ${search || conditionSlug || studyType || yearFrom || yearTo ? '<a href="/tools/hydrogen-research/" class="h2r-btn h2r-btn-secondary" style="text-decoration:none;text-align:center">Clear</a>' : ""}
      </form>

      ${totalStudies === 0 ? '<p class="h2r-text h2r-muted">No studies found matching your criteria. Try adjusting your filters.</p>' : ""}
      ${search || conditionSlug || studyType ? `<p class="h2r-small h2r-muted">${totalStudies} study${totalStudies !== 1 ? "ies" : ""} found</p>` : ""}

      ${studyCards}

      ${renderPagination(page, totalPages, "/tools/hydrogen-research/", queryParams as any)}

      <div style="margin:32px 0;text-align:center;font-size:0.85rem">
        <a href="/tools/hydrogen-research/stats" class="h2r-link">Research Statistics</a>
        &nbsp;&middot;&nbsp;
        <a href="/tools/hydrogen-research/methodology" class="h2r-link">Our Methodology</a>
        &nbsp;&middot;&nbsp;
        <a href="/tools/hydrogen-research/export" class="h2r-link">Export CSV</a>
      </div>
    `;

    const html = renderPage(
      "Hydrogen Water Research Database — Echo Water",
      "Browse peer-reviewed studies on molecular hydrogen therapy. Filter by condition, study type, and year. Curated by Echo Water.",
      content,
      "/"
    );

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(html);
  } catch (error) {
    console.error("Proxy main page error:", error);
    res.status(500).send(renderErrorPage("Unable to load the research database. Please try again later."));
  }
});


// ============================================================
// ROUTE 2: Individual Study Page (SEO-critical)
// GET /proxy/study/:slug
// ============================================================

router.get("/study/:slug", async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;

    // Fetch study
    const studyRows = await executeRawQuery(`
      SELECT s.* FROM studies s WHERE s.slug = $1 LIMIT 1
    `, [slug]);

    if (studyRows.length === 0) {
      res.status(404).send(renderErrorPage("Study not found.", 404));
      return;
    }

    const study = studyRows[0];
    const displayTitle = study.plain_language_title || study.title;

    // Fetch associated conditions
    const condRows = await executeRawQuery(`
      SELECT hc.name, hc.slug FROM study_health_conditions shc
      JOIN health_conditions hc ON hc.id = shc.health_condition_id
      WHERE shc.study_id = $1
    `, [study.id]);

    // Fetch related studies (same conditions, max 5)
    let relatedStudies: any[] = [];
    if (condRows.length > 0) {
      const condIds = condRows.map((c: any) => c.slug);
      const placeholders = condIds.map((_: any, i: number) => `$${i + 2}`).join(",");
      relatedStudies = await executeRawQuery(`
        SELECT DISTINCT s.id, s.title, s.plain_language_title, s.slug, s.publish_year, s.study_type
        FROM studies s
        JOIN study_health_conditions shc ON shc.study_id = s.id
        JOIN health_conditions hc ON hc.id = shc.health_condition_id
        WHERE hc.slug IN (${placeholders}) AND s.id != $1
        ORDER BY s.publish_year DESC NULLS LAST
        LIMIT 5
      `, [study.id, ...condIds]);
    }

    // JSON-LD ScholarlyArticle
    const jsonLd: any = {
      "@context": "https://schema.org",
      "@type": "ScholarlyArticle",
      "headline": study.title,
      "name": displayTitle,
      "description": study.meta_description || study.conclusion_short || truncate(study.abstract, 200),
      "url": `${BASE_URL}/study/${slug}`,
    };
    if (study.authors) {
      jsonLd.author = study.authors.split(",").map((a: string) => ({
        "@type": "Person",
        "name": a.trim(),
      }));
    }
    if (study.journal) {
      jsonLd.isPartOf = { "@type": "Periodical", "name": study.journal };
    }
    if (study.publish_year) {
      jsonLd.datePublished = String(study.publish_year);
    }
    if (study.doi) {
      jsonLd.sameAs = `https://doi.org/${study.doi}`;
    }
    if (study.peer_reviewed) {
      jsonLd.creativeWorkStatus = "Peer-reviewed";
    }
    if (study.image_url) {
      jsonLd.image = study.image_url.startsWith("http") ? study.image_url : `${BASE_URL.replace("/tools/hydrogen-research", "")}${study.image_url.startsWith("/") ? "" : "/"}${study.image_url}`;
    }

    // Build metadata grid
    const metadataItems: Array<{ label: string; value: string }> = [];
    if (study.study_type) metadataItems.push({ label: "Study Type", value: formatStudyType(study.study_type) });
    if (study.sample_size) metadataItems.push({ label: "Sample Size", value: String(study.sample_size) });
    if (study.duration) metadataItems.push({ label: "Duration", value: `${study.duration} days` });
    if (study.h2_delivery_method) metadataItems.push({ label: "H\u2082 Delivery Method", value: study.h2_delivery_method });
    if (study.h2_concentration) metadataItems.push({ label: "H\u2082 Concentration", value: study.h2_concentration });
    if (study.country) metadataItems.push({ label: "Country", value: study.country });
    if (study.peer_reviewed !== null) metadataItems.push({ label: "Peer Reviewed", value: study.peer_reviewed ? "Yes" : "No" });
    if (study.publish_year) metadataItems.push({ label: "Year", value: String(study.publish_year) });

    const metadataGrid = metadataItems.length > 0
      ? `<div class="h2r-metadata-grid">${metadataItems.map((m) => `
          <div class="h2r-metadata-item">
            <div class="h2r-metadata-label">${escapeHtml(m.label)}</div>
            <div class="h2r-metadata-value">${escapeHtml(m.value)}</div>
          </div>`).join("")
        }</div>`
      : "";

    // Citation format (APA-style)
    const authorList = study.authors ? study.authors.split(",")[0].trim() + (study.authors.includes(",") ? " et al." : "") : "Unknown";
    const citation = `${authorList} (${study.publish_year || "n.d."}). ${study.title}. ${study.journal || ""}${study.doi ? `. https://doi.org/${study.doi}` : ""}`;

    // Build page content
    const content = `
      ${renderBreadcrumb([
        { label: "Research Database", href: "/tools/hydrogen-research/" },
        { label: displayTitle },
      ])}

      <div class="h2r-detail-header">
        <h1 class="h2r-h1">${escapeHtml(displayTitle)}</h1>
        ${study.title !== displayTitle ? `<p class="h2r-small h2r-muted" style="margin:4px 0 0">${escapeHtml(study.title)}</p>` : ""}
        <div class="h2r-detail-meta">
          ${study.authors ? `<span class="h2r-detail-meta-item">${escapeHtml(study.authors)}</span>` : ""}
          ${study.journal ? `<span class="h2r-detail-meta-item"><em>${escapeHtml(study.journal)}</em></span>` : ""}
          ${study.publish_year ? `<span class="h2r-detail-meta-item">${study.publish_year}</span>` : ""}
          ${study.study_type ? `<span class="h2r-detail-meta-item"><span class="${getStudyTypeBadgeClass(study.study_type)}">${escapeHtml(formatStudyType(study.study_type))}</span></span>` : ""}
        </div>
        ${condRows.length > 0 ? `<div class="h2r-card-tags" style="margin-top:12px">${condRows.map((c: any) => `<a href="/tools/hydrogen-research/condition/${escapeAttr(c.slug)}" class="h2r-tag" style="text-decoration:none">${escapeHtml(c.name)}</a>`).join("")}</div>` : ""}
      </div>

      ${study.image_url ? `
        <div class="h2r-study-image">
          <img src="${escapeAttr(study.image_url.startsWith('/') ? study.image_url : '/' + study.image_url)}"
               alt="${escapeAttr(study.image_alt || `Research visualization: ${displayTitle}`)}"
               loading="lazy" width="800" height="450"
               style="width:100%;height:auto;border-radius:8px;margin:20px 0;object-fit:cover;max-height:400px">
        </div>
      ` : ""}

      ${study.results_short || study.conclusion_short ? `
        <div class="h2r-key-finding">
          <div class="h2r-key-finding-label">Key Finding</div>
          <p class="h2r-text" style="margin:0">${escapeHtml(study.results_short || study.conclusion_short)}</p>
        </div>
      ` : ""}

      ${metadataGrid}

      ${study.tldr || study.summary_markdown || study.conclusion_short ? `
        <div class="h2r-section">
          <h2 class="h2r-section-title">What This Study Found</h2>
          <p class="h2r-text">${escapeHtml(study.tldr || study.summary_markdown || study.conclusion_short)}</p>
        </div>
      ` : ""}

      ${study.methodology_summary || study.methods_short ? `
        <div class="h2r-section">
          <h2 class="h2r-section-title">How It Was Conducted</h2>
          <p class="h2r-text">${escapeHtml(study.methodology_summary || study.methods_short)}</p>
          ${study.dosage_protocol ? `<p class="h2r-text"><strong>Dosage Protocol:</strong> ${escapeHtml(study.dosage_protocol)}</p>` : ""}
        </div>
      ` : ""}

      ${study.limitations ? `
        <div class="h2r-section">
          <h2 class="h2r-section-title">Study Limitations</h2>
          <p class="h2r-text">${escapeHtml(study.limitations)}</p>
        </div>
      ` : ""}

      ${study.how_to_apply ? `
        <div class="h2r-section">
          <h2 class="h2r-section-title">What This Means for You</h2>
          <p class="h2r-text">${escapeHtml(study.how_to_apply)}</p>
        </div>
      ` : ""}

      ${study.abstract ? `
        <div class="h2r-section">
          <h2 class="h2r-section-title">Abstract</h2>
          <p class="h2r-text">${escapeHtml(study.abstract)}</p>
        </div>
      ` : ""}

      <div class="h2r-section">
        <h2 class="h2r-section-title">Links &amp; Citation</h2>
        <p class="h2r-text">
          ${study.doi ? `<a href="https://doi.org/${escapeAttr(study.doi)}" target="_blank" rel="noopener" class="h2r-link">View on DOI</a>` : ""}
          ${study.doi && study.url ? ` &middot; ` : ""}
          ${study.url ? `<a href="${escapeAttr(study.url)}" target="_blank" rel="noopener" class="h2r-link">View Source</a>` : ""}
        </p>
        <div class="h2r-citation-box">${escapeHtml(citation)}</div>
      </div>

      ${relatedStudies.length > 0 ? `
        <div class="h2r-section">
          <h2 class="h2r-section-title">Related Studies</h2>
          <ul class="h2r-related-list">
            ${relatedStudies.map((rs: any) => `
              <li>
                <a href="/tools/hydrogen-research/study/${escapeAttr(rs.slug || rs.id)}" class="h2r-link">${escapeHtml(rs.plain_language_title || rs.title)}</a>
                <span class="h2r-small h2r-muted">${rs.publish_year || ""} ${rs.study_type ? `&middot; ${escapeHtml(formatStudyType(rs.study_type))}` : ""}</span>
              </li>
            `).join("")}
          </ul>
        </div>
      ` : ""}

      <div class="h2r-disclaimer">
        <strong>Disclaimer:</strong> This summary is for informational purposes only and does not constitute medical advice.
        The research presented here is from peer-reviewed scientific literature. Always consult with a qualified healthcare
        professional before making changes to your health regimen. Individual results may vary.
      </div>
    `;

    const metaDesc = study.meta_description || truncate(study.conclusion_short || study.abstract || displayTitle, 155);

    // Build absolute OG image URL if study has an image
    const ogImageUrl = study.image_url
      ? (study.image_url.startsWith("http") ? study.image_url : `${BASE_URL.replace("/tools/hydrogen-research", "")}${study.image_url.startsWith("/") ? "" : "/"}${study.image_url}`)
      : undefined;

    const html = renderPageWithSchema(
      `${displayTitle} — Hydrogen Research | Echo Water`,
      metaDesc,
      content,
      `/study/${slug}`,
      jsonLd,
      ogImageUrl
    );

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(html);
  } catch (error) {
    console.error("Proxy study page error:", error);
    res.status(500).send(renderErrorPage("Unable to load this study. Please try again later."));
  }
});


// ============================================================
// ROUTE 3: Condition Landing Page
// GET /proxy/condition/:slug
// ============================================================

router.get("/condition/:slug", async (req: Request, res: Response) => {
  try {
    const slug = (req.params.slug || "").slice(0, 100);
    const page = Math.min(500, Math.max(1, parseInt(req.query.page as string, 10) || 1));

    // Fetch condition
    const condRows = await executeRawQuery(`
      SELECT hc.*, bs.name as body_system_name
      FROM health_conditions hc
      LEFT JOIN body_systems bs ON bs.id = hc.body_system_id
      WHERE hc.slug = $1
      LIMIT 1
    `, [slug]);

    if (condRows.length === 0) {
      res.status(404).send(renderErrorPage("Condition not found.", 404));
      return;
    }

    const condition = condRows[0];

    // Count by study type
    const typeCountRows = await executeRawQuery(`
      SELECT s.study_type, COUNT(*) as cnt
      FROM studies s
      JOIN study_health_conditions shc ON shc.study_id = s.id
      WHERE shc.health_condition_id = $1 AND s.study_type IS NOT NULL
      GROUP BY s.study_type
      ORDER BY cnt DESC
    `, [condition.id]);

    // Total study count for this condition
    const totalCountRows = await executeRawQuery(`
      SELECT COUNT(*) as total
      FROM study_health_conditions shc
      WHERE shc.health_condition_id = $1
    `, [condition.id]);
    const totalStudies = parseInt(totalCountRows[0]?.total || "0", 10);
    const totalPages = Math.ceil(totalStudies / ITEMS_PER_PAGE);
    const offset = (page - 1) * ITEMS_PER_PAGE;

    // Fetch studies for this condition
    const studyRows = await executeRawQuery(`
      SELECT s.id, s.title, s.plain_language_title, s.slug, s.authors, s.journal,
             s.publish_year, s.study_type, s.results_short, s.conclusion_short, s.image_url
      FROM studies s
      JOIN study_health_conditions shc ON shc.study_id = s.id
      WHERE shc.health_condition_id = $1
      ORDER BY s.publish_year DESC NULLS LAST, s.id DESC
      LIMIT $2 OFFSET $3
    `, [condition.id, ITEMS_PER_PAGE, offset]);

    // Study type stats
    const typeStats = typeCountRows.map((t: any) => `
      <div class="h2r-condition-stat-card">
        <span class="${getStudyTypeBadgeClass(t.study_type)}">${escapeHtml(formatStudyType(t.study_type))}</span>
        <div class="h2r-stat-number" style="font-size:1.2rem;margin-top:4px">${t.cnt}</div>
      </div>
    `).join("");

    const studyCards = studyRows.map((s: any) => renderStudyCard(s)).join("");

    const content = `
      ${renderBreadcrumb([
        { label: "Research Database", href: "/tools/hydrogen-research/" },
        { label: condition.name },
      ])}

      <h1 class="h2r-h1">Hydrogen &amp; ${escapeHtml(condition.name)}</h1>
      ${condition.body_system_name ? `<p class="h2r-small h2r-muted">Body System: ${escapeHtml(condition.body_system_name)}</p>` : ""}
      ${condition.description ? `<p class="h2r-text">${escapeHtml(condition.description)}</p>` : ""}

      <p class="h2r-text"><strong>${totalStudies}</strong> study${totalStudies !== 1 ? "ies" : ""} found for this condition.</p>

      ${typeStats ? `
        <h2 class="h2r-h2">Studies by Type</h2>
        <div class="h2r-condition-stats">${typeStats}</div>
      ` : ""}

      <h2 class="h2r-h2">Studies</h2>
      ${studyCards}

      ${renderPagination(page, totalPages, `/tools/hydrogen-research/condition/${slug}`, {})}
    `;

    const html = renderPage(
      `Hydrogen Research for ${condition.name} — Echo Water`,
      `Browse ${totalStudies} peer-reviewed studies on molecular hydrogen and ${condition.name}. Curated by Echo Water.`,
      content,
      `/condition/${slug}`
    );

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(html);
  } catch (error) {
    console.error("Proxy condition page error:", error);
    res.status(500).send(renderErrorPage("Unable to load this condition page. Please try again later."));
  }
});


// ============================================================
// ROUTE 4: Aggregate Statistics Page
// GET /proxy/stats
// ============================================================

router.get("/stats", async (_req: Request, res: Response) => {
  try {
    // Studies by year
    const byYear = await executeRawQuery(`
      SELECT publish_year, COUNT(*) as cnt
      FROM studies
      WHERE publish_year IS NOT NULL
      GROUP BY publish_year
      ORDER BY publish_year DESC
    `, []);

    // Studies by type
    const byType = await executeRawQuery(`
      SELECT study_type, COUNT(*) as cnt
      FROM studies
      WHERE study_type IS NOT NULL
      GROUP BY study_type
      ORDER BY cnt DESC
    `, []);

    // Studies by condition (top 20)
    const byCondition = await executeRawQuery(`
      SELECT hc.name, hc.slug, COUNT(*) as cnt
      FROM study_health_conditions shc
      JOIN health_conditions hc ON hc.id = shc.health_condition_id
      GROUP BY hc.id, hc.name, hc.slug
      ORDER BY cnt DESC
      LIMIT 20
    `, []);

    // Studies by country (top 20)
    const byCountry = await executeRawQuery(`
      SELECT country, COUNT(*) as cnt
      FROM studies
      WHERE country IS NOT NULL AND country != ''
      GROUP BY country
      ORDER BY cnt DESC
      LIMIT 20
    `, []);

    // Overall stats
    const overallRows = await executeRawQuery(`
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE is_human_trial = true) as human_trials,
        COUNT(*) FILTER (WHERE peer_reviewed = true) as peer_reviewed,
        MIN(publish_year) FILTER (WHERE publish_year IS NOT NULL) as earliest_year,
        MAX(publish_year) FILTER (WHERE publish_year IS NOT NULL) as latest_year
      FROM studies
    `, []);
    const overall = overallRows[0] || {};

    const renderTable = (headers: string[], rows: string[][]) => `
      <div class="h2r-table-wrap">
        <table class="h2r-table">
          <thead><tr>${headers.map((h) => `<th>${escapeHtml(h)}</th>`).join("")}</tr></thead>
          <tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join("")}</tr>`).join("")}</tbody>
        </table>
      </div>
    `;

    const content = `
      ${renderBreadcrumb([
        { label: "Research Database", href: "/tools/hydrogen-research/" },
        { label: "Statistics" },
      ])}

      <h1 class="h2r-h1">The State of Hydrogen Water Research</h1>
      <p class="h2r-subtitle">Aggregate statistics from our curated database of molecular hydrogen studies.</p>

      <div class="h2r-stats-bar">
        <div class="h2r-stat">
          <span class="h2r-stat-number">${overall.total || 0}</span>
          <span class="h2r-stat-label">Total Studies</span>
        </div>
        <div class="h2r-stat">
          <span class="h2r-stat-number">${overall.human_trials || 0}</span>
          <span class="h2r-stat-label">Human Trials</span>
        </div>
        <div class="h2r-stat">
          <span class="h2r-stat-number">${overall.peer_reviewed || 0}</span>
          <span class="h2r-stat-label">Peer Reviewed</span>
        </div>
        <div class="h2r-stat">
          <span class="h2r-stat-number">${overall.earliest_year || "—"}–${overall.latest_year || "—"}</span>
          <span class="h2r-stat-label">Year Range</span>
        </div>
      </div>

      <h2 class="h2r-h2">Studies by Year</h2>
      ${renderTable(
        ["Year", "Studies"],
        byYear.map((r: any) => [String(r.publish_year), String(r.cnt)])
      )}

      <h2 class="h2r-h2">Studies by Type</h2>
      ${renderTable(
        ["Study Type", "Count"],
        byType.map((r: any) => [
          `<span class="${getStudyTypeBadgeClass(r.study_type)}">${escapeHtml(formatStudyType(r.study_type))}</span>`,
          String(r.cnt),
        ])
      )}

      <h2 class="h2r-h2">Top Conditions Studied</h2>
      ${renderTable(
        ["Condition", "Studies"],
        byCondition.map((r: any) => [
          `<a href="/tools/hydrogen-research/condition/${escapeAttr(r.slug)}" class="h2r-link">${escapeHtml(r.name)}</a>`,
          String(r.cnt),
        ])
      )}

      <h2 class="h2r-h2">Studies by Country</h2>
      ${renderTable(
        ["Country", "Studies"],
        byCountry.map((r: any) => [escapeHtml(r.country), String(r.cnt)])
      )}

      <div style="margin:32px 0;text-align:center">
        <a href="/tools/hydrogen-research/export" class="h2r-btn" style="text-decoration:none;display:inline-block">Download CSV</a>
      </div>
    `;

    const html = renderPage(
      "Hydrogen Research Statistics — Echo Water",
      "Explore statistics on molecular hydrogen research: studies by year, type, condition, and country.",
      content,
      "/stats"
    );

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(html);
  } catch (error) {
    console.error("Proxy stats page error:", error);
    res.status(500).send(renderErrorPage("Unable to load statistics. Please try again later."));
  }
});


// ============================================================
// ROUTE 5: Methodology Page (Static)
// GET /proxy/methodology
// ============================================================

router.get("/methodology", async (_req: Request, res: Response) => {
  try {
    const content = `
      ${renderBreadcrumb([
        { label: "Research Database", href: "/tools/hydrogen-research/" },
        { label: "Methodology" },
      ])}

      <h1 class="h2r-h1">Our Research Curation Methodology</h1>
      <p class="h2r-subtitle">How we select, verify, and present molecular hydrogen studies.</p>

      <div class="h2r-section">
        <h2 class="h2r-section-title">Source Selection</h2>
        <p class="h2r-text">
          Studies in this database are sourced from major biomedical literature databases, including PubMed,
          CrossRef, and Europe PMC. We focus on research that investigates the therapeutic potential of
          molecular hydrogen (H&#8322;) in any form: hydrogen-rich water, hydrogen gas inhalation,
          hydrogen-rich saline, and topical application.
        </p>
      </div>

      <div class="h2r-section">
        <h2 class="h2r-section-title">Inclusion Criteria</h2>
        <p class="h2r-text">To be included in our database, a study must meet the following criteria:</p>
        <ul class="h2r-text">
          <li>Published in a peer-reviewed journal</li>
          <li>Available through recognized academic databases (PubMed, CrossRef, etc.)</li>
          <li>Directly investigates molecular hydrogen as a primary or significant variable</li>
          <li>Contains sufficient methodological detail for evaluation</li>
          <li>Written in or translated to English</li>
        </ul>
      </div>

      <div class="h2r-section">
        <h2 class="h2r-section-title">Study Classification</h2>
        <p class="h2r-text">Each study is classified by:</p>
        <ul class="h2r-text">
          <li><strong>Study Type:</strong> Human clinical trial, animal study, in vitro (cell/tissue),
              systematic review, or meta-analysis</li>
          <li><strong>Health Condition:</strong> The condition or biological system examined</li>
          <li><strong>H&#8322; Delivery Method:</strong> How hydrogen was administered (drinking water,
              inhalation, injection, bathing, etc.)</li>
          <li><strong>Quality Indicators:</strong> Peer review status, sample size, study duration,
              and methodology rigor</li>
        </ul>
      </div>

      <div class="h2r-section">
        <h2 class="h2r-section-title">Plain Language Summaries</h2>
        <p class="h2r-text">
          Each study includes a plain language summary designed to make the research accessible
          to non-scientists. These summaries are generated with AI assistance and reviewed for
          accuracy. They highlight key findings, methodology, and practical implications while
          preserving scientific integrity.
        </p>
      </div>

      <div class="h2r-section">
        <h2 class="h2r-section-title">Limitations &amp; Transparency</h2>
        <p class="h2r-text">
          We strive for objectivity and transparency. Important notes about our database:
        </p>
        <ul class="h2r-text">
          <li>This database does not represent all published hydrogen research globally</li>
          <li>We include studies with positive, negative, and neutral outcomes</li>
          <li>Inclusion in this database does not imply endorsement of study conclusions</li>
          <li>Echo Water funds this database as a resource; we have a commercial interest in hydrogen water products</li>
          <li>Always consult qualified healthcare professionals for medical decisions</li>
        </ul>
      </div>

      <div class="h2r-section">
        <h2 class="h2r-section-title">Updates</h2>
        <p class="h2r-text">
          This database is updated regularly as new studies are published. We continuously
          refine our classification system and plain language summaries. If you notice an error
          or would like to suggest a study for inclusion, please contact us.
        </p>
      </div>

      <div class="h2r-disclaimer">
        <strong>Disclaimer:</strong> This database is maintained by Echo Water for informational
        purposes only. It does not constitute medical advice. The presence of a study in this
        database does not imply endorsement of its conclusions. Always consult with a qualified
        healthcare professional regarding health decisions.
      </div>
    `;

    const html = renderPage(
      "Research Methodology — Hydrogen Water Studies | Echo Water",
      "Learn how we curate, verify, and present molecular hydrogen research. Our methodology ensures scientific accuracy and accessibility.",
      content,
      "/methodology"
    );

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(html);
  } catch (error) {
    console.error("Proxy methodology page error:", error);
    res.status(500).send(renderErrorPage("Unable to load methodology page. Please try again later."));
  }
});


// ============================================================
// ROUTE 6: XML Sitemap
// GET /proxy/sitemap.xml
// ============================================================

router.get("/sitemap.xml", async (_req: Request, res: Response) => {
  try {
    // Fetch all study slugs
    const studySlugs = await executeRawQuery(`
      SELECT slug, last_modified, publish_year
      FROM studies
      WHERE slug IS NOT NULL AND slug != ''
      ORDER BY publish_year DESC NULLS LAST
    `, []);

    // Fetch all condition slugs
    const conditionSlugs = await executeRawQuery(`
      SELECT slug FROM health_conditions ORDER BY name ASC
    `, []);

    const now = new Date().toISOString().split("T")[0];

    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${BASE_URL}/</loc>
    <lastmod>${now}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>${BASE_URL}/stats</loc>
    <lastmod>${now}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>
  <url>
    <loc>${BASE_URL}/methodology</loc>
    <lastmod>${now}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.5</priority>
  </url>`;

    for (const study of studySlugs) {
      const lastmod = study.last_modified
        ? new Date(study.last_modified).toISOString().split("T")[0]
        : now;
      xml += `
  <url>
    <loc>${BASE_URL}/study/${escapeXml(study.slug)}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>`;
    }

    for (const cond of conditionSlugs) {
      xml += `
  <url>
    <loc>${BASE_URL}/condition/${escapeXml(cond.slug)}</loc>
    <lastmod>${now}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>`;
    }

    xml += `
</urlset>`;

    res.setHeader("Content-Type", "application/xml; charset=utf-8");
    res.send(xml);
  } catch (error) {
    console.error("Proxy sitemap error:", error);
    res.status(500).send('<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>');
  }
});


// ============================================================
// ROUTE 7: Embeddable Widget
// GET /proxy/embed/:conditionSlug
// ============================================================

router.get("/embed/:conditionSlug", async (req: Request, res: Response) => {
  try {
    const { conditionSlug } = req.params;

    // Fetch condition
    const condRows = await executeRawQuery(`
      SELECT id, name, slug FROM health_conditions WHERE slug = $1 LIMIT 1
    `, [conditionSlug]);

    if (condRows.length === 0) {
      res.status(404).send(renderErrorPage("Condition not found.", 404));
      return;
    }

    const condition = condRows[0];

    // Fetch 5 most recent studies for this condition
    const studyRows = await executeRawQuery(`
      SELECT s.id, s.title, s.plain_language_title, s.slug, s.publish_year, s.study_type, s.journal
      FROM studies s
      JOIN study_health_conditions shc ON shc.study_id = s.id
      WHERE shc.health_condition_id = $1
      ORDER BY s.publish_year DESC NULLS LAST, s.id DESC
      LIMIT 5
    `, [condition.id]);

    const items = studyRows.map((s: any) => `
      <div class="h2r-embed-item">
        <a href="${BASE_URL}/study/${escapeAttr(s.slug || s.id)}" target="_blank" rel="noopener" class="h2r-link" style="font-weight:500;font-size:0.88rem">
          ${escapeHtml(s.plain_language_title || s.title)}
        </a>
        <div class="h2r-small h2r-muted" style="margin-top:3px">
          ${s.publish_year || ""} ${s.study_type ? `&middot; <span class="${getStudyTypeBadgeClass(s.study_type)}">${escapeHtml(formatStudyType(s.study_type))}</span>` : ""}
        </div>
      </div>
    `).join("");

    // The embed is a self-contained HTML snippet (no full page shell needed, but include base styling)
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>${CSS}</style>
</head>
<body style="margin:0;padding:0;background:transparent">
  <div class="h2r-root" style="padding:0">
    <div class="h2r-embed">
      <div class="h2r-embed-header">
        <h3>Hydrogen Research: ${escapeHtml(condition.name)}</h3>
      </div>
      <div class="h2r-embed-body">
        ${studyRows.length > 0 ? items : '<div class="h2r-embed-item"><p class="h2r-small h2r-muted">No studies available yet.</p></div>'}
      </div>
      <div class="h2r-embed-footer">
        <a href="${BASE_URL}/condition/${escapeAttr(condition.slug)}" target="_blank" rel="noopener" class="h2r-link">
          View all studies &rarr;
        </a>
      </div>
    </div>
  </div>
</body>
</html>`;

    // Allow embedding from any domain (the whole point of this widget)
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Content-Security-Policy", "frame-ancestors *");
    res.removeHeader("X-Frame-Options");
    res.send(html);
  } catch (error) {
    console.error("Proxy embed error:", error);
    res.status(500).send("<p>Unable to load widget.</p>");
  }
});


// ============================================================
// ROUTE 8: CSV Export
// GET /proxy/export
// ============================================================

router.get("/export", async (req: Request, res: Response) => {
  try {
    const conditionSlug = (req.query.condition as string || "").trim();

    let query: string;
    let params: any[];

    if (conditionSlug) {
      query = `
        SELECT s.title, s.authors, s.journal, s.publish_year, s.study_type,
               s.doi, s.country, s.sample_size, s.duration,
               s.h2_delivery_method, s.h2_concentration,
               s.peer_reviewed, s.is_human_trial,
               s.results_short, s.conclusion_short, s.slug
        FROM studies s
        JOIN study_health_conditions shc ON shc.study_id = s.id
        JOIN health_conditions hc ON hc.id = shc.health_condition_id
        WHERE hc.slug = $1
        ORDER BY s.publish_year DESC NULLS LAST
      `;
      params = [conditionSlug];
    } else {
      query = `
        SELECT s.title, s.authors, s.journal, s.publish_year, s.study_type,
               s.doi, s.country, s.sample_size, s.duration,
               s.h2_delivery_method, s.h2_concentration,
               s.peer_reviewed, s.is_human_trial,
               s.results_short, s.conclusion_short, s.slug
        FROM studies s
        ORDER BY s.publish_year DESC NULLS LAST
      `;
      params = [];
    }

    const rows = await executeRawQuery(query, params);

    const headers = [
      "Title", "Authors", "Journal", "Year", "Study Type",
      "DOI", "Country", "Sample Size", "Duration (days)",
      "H2 Delivery Method", "H2 Concentration",
      "Peer Reviewed", "Human Trial",
      "Key Result", "Conclusion", "URL"
    ];

    const csvRows = rows.map((r: any) => [
      csvEscape(r.title),
      csvEscape(r.authors),
      csvEscape(r.journal),
      r.publish_year || "",
      csvEscape(r.study_type),
      csvEscape(r.doi),
      csvEscape(r.country),
      r.sample_size || "",
      r.duration || "",
      csvEscape(r.h2_delivery_method),
      csvEscape(r.h2_concentration),
      r.peer_reviewed ? "Yes" : "No",
      r.is_human_trial ? "Yes" : "No",
      csvEscape(r.results_short),
      csvEscape(r.conclusion_short),
      r.slug ? `${BASE_URL}/study/${r.slug}` : "",
    ]);

    const csv = [headers.join(","), ...csvRows.map((r: string[]) => r.join(","))].join("\n");

    const filename = conditionSlug
      ? `hydrogen-research-${conditionSlug}.csv`
      : "hydrogen-research-database.csv";

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(csv);
  } catch (error) {
    console.error("Proxy export error:", error);
    res.status(500).send("Unable to generate export. Please try again later.");
  }
});


// ============================================================
// UTILITY FUNCTIONS
// ============================================================

/**
 * Execute a raw parameterized SQL query and return rows.
 * Uses the pool from db.ts for safe parameterized queries.
 */
async function executeRawQuery(query: string, params: any[]): Promise<any[]> {
  const result = await pool.query(query, params);
  return result.rows;
}

/**
 * Escape a value for CSV output.
 */
function csvEscape(val: string | null | undefined): string {
  if (val === null || val === undefined) return "";
  const str = String(val);
  if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Escape a string for XML output.
 */
function escapeXml(str: string): string {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Render a simple error page.
 */
function renderErrorPage(message: string, statusCode: number = 500): string {
  return renderPage(
    `${statusCode === 404 ? "Not Found" : "Error"} — Hydrogen Research | Echo Water`,
    "An error occurred while loading this page.",
    `
      <div style="text-align:center;padding:60px 20px">
        <h1 class="h2r-h1">${statusCode === 404 ? "Page Not Found" : "Something Went Wrong"}</h1>
        <p class="h2r-text h2r-muted">${escapeHtml(message)}</p>
        <a href="/tools/hydrogen-research/" class="h2r-btn" style="display:inline-block;margin-top:16px;text-decoration:none">
          Back to Research Database
        </a>
      </div>
    `,
    "/"
  );
}


export default router;
