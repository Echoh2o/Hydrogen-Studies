/**
 * Markup-compliance helpers shared by the bot renderer (server) and the SPA,
 * so both paths emit the same titles, excerpts, bylines and JSON-LD.
 *
 * Rules encoded here (CLAUDE.md / PLAN.md §2):
 *  - Empty fields never render; placeholder strings (__no_content__, "N/A"…)
 *    never reach HTML                                   → isPlaceholder/realContent
 *  - Abstracts: ≤300-char excerpt + link to PubMed/DOI  → abstractExcerpt/studySourceLink
 *  - Schema only for what's visible; no FAQPage without a visible FAQ, no
 *    reviewedBy without a named reviewer                → faqPairsIfVisible/blogArticleJsonLd
 *  - Every indexable page shows author/reviewer + a date → blogByline
 *  - <title> ≤ 65 chars, cut at a word boundary, no "…"  → buildPageTitle
 *
 * Keep dependency-free: this module ships in the browser bundle.
 */

export const SITE_NAME = "Hydrogen Studies";
export const EDITORIAL_TEAM = "Hydrogen Studies Editorial Team";
export const TITLE_SUFFIX = ` | ${SITE_NAME}`;
export const MAX_TITLE_LENGTH = 65;
export const ABSTRACT_EXCERPT_MAX = 300;

// ── Placeholders ────────────────────────────────────────────────

const PLACEHOLDER_VALUES = new Set([
  "n/a", "na", "n.a.", "null", "undefined", "nan", "none available", "tbd", "tba",
  "not available", "not applicable", "no content", "no data", "-", "--", "—", "–",
  "...", "…", "[]", "{}",
]);

/**
 * True for values that must never be rendered: null/empty/whitespace, pipeline
 * sentinels like "__no_content__" (any __token__), and N/A-style fillers.
 */
export function isPlaceholder(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value !== "string") return false;
  const v = value.trim();
  if (!v) return true;
  if (/^__[a-z0-9_]+__$/i.test(v)) return true;
  return PLACEHOLDER_VALUES.has(v.toLowerCase());
}

/** The string if it is real content, otherwise "". */
export function realContent(value: string | null | undefined): string {
  return isPlaceholder(value) ? "" : String(value).trim();
}

/**
 * Shallow copy of `obj` with every placeholder STRING field nulled, so a page
 * can keep its `{field && …}` guards and never render a sentinel.
 */
export function withoutPlaceholders<T extends Record<string, any>>(obj: T): T {
  const out: Record<string, any> = { ...obj };
  for (const [key, value] of Object.entries(out)) {
    if (typeof value === "string" && isPlaceholder(value)) out[key] = null;
  }
  return out as T;
}

// ── Text utilities ──────────────────────────────────────────────

export function stripTags(str: string | null | undefined): string {
  if (!str) return "";
  return String(str)
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const TRAILING_STOPWORDS = new Set([
  "a", "an", "and", "as", "at", "by", "for", "from", "in", "into", "of", "on",
  "or", "the", "to", "vs", "with", "without", "via", "its", "their", "is", "are",
]);

/**
 * Cut `text` to ≤ max chars at a word boundary. Never cuts mid-word, strips
 * trailing punctuation and dangling stopwords ("…effects of the"), and adds
 * NO ellipsis (callers decide).
 */
export function cutAtWordBoundary(text: string, max: number): string {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  let cut = t.slice(0, max + 1);
  const lastSpace = cut.lastIndexOf(" ");
  cut = lastSpace > 0 ? cut.slice(0, lastSpace) : t.slice(0, max);
  const words = cut.split(" ");
  const clean = (w: string) => w.replace(/[^\p{L}\p{N}]+$/u, "");
  while (words.length > 1) {
    const last = clean(words[words.length - 1]);
    if (!last || TRAILING_STOPWORDS.has(last.toLowerCase())) {
      words.pop();
      continue;
    }
    break;
  }
  return words.join(" ").replace(/[\s,;:\-–—&(/|]+$/u, "").trim();
}

/** ≤ max-char excerpt cut at a word boundary, with "…" when shortened. */
export function excerptAtWord(text: string | null | undefined, max = ABSTRACT_EXCERPT_MAX): string {
  const t = stripTags(text);
  if (!t) return "";
  if (t.length <= max) return t;
  const cut = cutAtWordBoundary(t, max - 1).replace(/[.,;:!?]+$/, "");
  return `${cut}…`;
}

/** Abstract excerpt (≤300 chars incl. the ellipsis). Never the full abstract. */
export function abstractExcerpt(abstract: string | null | undefined): string {
  if (isPlaceholder(abstract)) return "";
  return excerptAtWord(abstract, ABSTRACT_EXCERPT_MAX);
}

// ── Titles ──────────────────────────────────────────────────────

const ELLIPSIS_END_RE = /(?:\.{3}|…)\s*$/;

function stripSiteSuffix(title: string): string {
  return title
    .replace(/\s*[|–—-]\s*Hydrogen Studies(?:\s+(?:Research|Blog|Research Database))?\s*$/i, "")
    .trim();
}

/**
 * Pick the title topic: metaTitle when set (and not itself truncated with an
 * ellipsis), otherwise the first real candidate.
 */
export function pickTitleTopic(metaTitle: string | null | undefined, ...fallbacks: Array<string | null | undefined>): string {
  const candidates = [metaTitle, ...fallbacks];
  for (const c of candidates) {
    const v = realContent(c).replace(/["“”]/g, "");
    if (!v) continue;
    if (c === metaTitle && ELLIPSIS_END_RE.test(v)) continue;
    const cleaned = stripSiteSuffix(v.replace(ELLIPSIS_END_RE, "").trim());
    if (cleaned) return cleaned;
  }
  return "";
}

/**
 * Full <title>: "<topic> | Hydrogen Studies" when that fits in max (65);
 * otherwise the topic alone, cut at a word boundary to ≤ max. Never cuts
 * mid-word and never ends with "…".
 */
export function buildPageTitle(topic: string, max = MAX_TITLE_LENGTH): string {
  const t = stripTags(topic);
  if (!t) return SITE_NAME;
  if (t.length + TITLE_SUFFIX.length <= max) return `${t}${TITLE_SUFFIX}`;
  return cutAtWordBoundary(t, max);
}

export function studyPageTitle(study: {
  metaTitle?: string | null;
  plainLanguageTitle?: string | null;
  title?: string | null;
}): string {
  return buildPageTitle(pickTitleTopic(study.metaTitle, study.plainLanguageTitle, study.title));
}

export function blogPageTitle(blog: { metaTitle?: string | null; title?: string | null }): string {
  return buildPageTitle(pickTitleTopic(blog.metaTitle, blog.title));
}

// ── Dates ───────────────────────────────────────────────────────

export function toDate(value: unknown): Date | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(String(value));
  return isNaN(d.getTime()) ? null : d;
}

/** "September 23, 2026" — UTC so server and browser render the same string. */
export function formatLongDate(value: unknown): string {
  const d = toDate(value);
  if (!d) return "";
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
}

export function isoDate(value: unknown): string | undefined {
  const d = toDate(value);
  return d ? d.toISOString() : undefined;
}

// ── Study: source link, description, JSON-LD ────────────────────

export interface StudyLike {
  id?: number;
  slug?: string | null;
  title?: string | null;
  plainLanguageTitle?: string | null;
  metaTitle?: string | null;
  metaDescription?: string | null;
  summary100Words?: string | null;
  summary50Words?: string | null;
  plainSummary?: string | null;
  abstract?: string | null;
  authors?: string | null;
  journal?: string | null;
  doi?: string | null;
  pmid?: string | number | null;
  url?: string | null;
  keywords?: string[] | null;
  journalPublishDate?: string | null;
  publishDate?: string | null;
  lastModified?: string | Date | null;
  createdAt?: string | Date | null;
}

export function normalizeDoi(doi: string | null | undefined): string {
  const v = realContent(doi);
  return v.replace(/^(?:https?:\/\/(?:dx\.)?doi\.org\/|doi:\s*)/i, "").trim();
}

/**
 * Where readers get the full abstract: PubMed first, then PMC/DOI, then the
 * stored source URL. Null when the study has no resolvable source.
 */
export function studySourceLink(study: Pick<StudyLike, "pmid" | "doi" | "url">): { href: string; label: string } | null {
  const pmid = String(study.pmid ?? "").match(/\d{4,}/)?.[0];
  if (pmid) {
    return { href: `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`, label: "Read the full abstract on PubMed" };
  }
  const url = realContent(study.url);
  if (url && /ncbi\.nlm\.nih\.gov\/pmc|europepmc\.org/i.test(url) && /^https?:\/\//i.test(url)) {
    return { href: url, label: "Read the full abstract on PMC" };
  }
  const doi = normalizeDoi(study.doi);
  if (doi) {
    return { href: `https://doi.org/${doi}`, label: "Read the full abstract via DOI" };
  }
  if (url && /^https?:\/\//i.test(url)) {
    return { href: url, label: "Read the full abstract at the source" };
  }
  return null;
}

/** Our own description text for a study (never the full abstract). */
export function studyDescription(study: StudyLike, max = 300): string {
  const own = [study.metaDescription, study.summary100Words, study.summary50Words, study.plainSummary]
    .map((v) => realContent(v))
    .find(Boolean);
  if (own) return excerptAtWord(own, max);
  return excerptAtWord(abstractExcerpt(study.abstract), max);
}

/** "Updated" date for the study summary line + JSON-LD dateModified. */
export function studyUpdatedAt(study: Pick<StudyLike, "lastModified" | "createdAt">): Date | null {
  return toDate(study.lastModified) ?? toDate(study.createdAt);
}

/**
 * MedicalScholarlyArticle JSON-LD for a study page. Deliberately has NO
 * `abstract` field and a ≤300-char description (publisher copyright).
 */
export function studyJsonLd(
  study: StudyLike,
  opts: { canonical: string; siteUrl: string; image?: string },
): Record<string, any> {
  const headlineSource = realContent(study.title) || realContent(study.plainLanguageTitle);
  const ld: Record<string, any> = {
    "@context": "https://schema.org",
    "@type": "MedicalScholarlyArticle",
    headline: cutAtWordBoundary(headlineSource, 110),
    description: studyDescription(study, 300),
    url: opts.canonical,
    ...(opts.image ? { image: opts.image } : {}),
    ...(realContent(study.journalPublishDate || study.publishDate)
      ? { datePublished: realContent(study.journalPublishDate || study.publishDate) }
      : {}),
    ...(isoDate(studyUpdatedAt(study)) ? { dateModified: isoDate(studyUpdatedAt(study)) } : {}),
    publisher: {
      "@type": "Organization",
      name: SITE_NAME,
      url: opts.siteUrl,
      logo: { "@type": "ImageObject", url: `${opts.siteUrl}/logo.png` },
    },
    mainEntityOfPage: { "@type": "WebPage", "@id": opts.canonical },
  };
  const authors = realContent(study.authors)
    .split(",")
    .map((a) => a.trim())
    .filter((a) => a && !isPlaceholder(a));
  if (authors.length) ld.author = authors.map((name) => ({ "@type": "Person", name }));
  if (realContent(study.journal)) ld.isPartOf = { "@type": "Periodical", name: realContent(study.journal) };
  const doi = normalizeDoi(study.doi);
  if (doi) ld.sameAs = `https://doi.org/${doi}`;
  if (Array.isArray(study.keywords) && study.keywords.length) ld.keywords = study.keywords.join(", ");
  return ld;
}

// ── Blog: byline + Article JSON-LD ──────────────────────────────

export interface BlogBylineInput {
  authorName?: string | null;
  reviewerName?: string | null;
  /** blog_articles.last_reviewed (existing column). */
  lastReviewed?: string | Date | null;
  updatedAt?: string | Date | null;
  publishedAt?: string | Date | null;
  createdAt?: string | Date | null;
}

export interface BlogByline {
  author: string;
  /** True only when a named author_name is set (→ schema Person). */
  authorIsPerson: boolean;
  reviewer: string | null;
  dateLabel: "Last reviewed" | "Updated";
  date: Date | null;
  /** Pre-formatted date, "" when unknown. */
  dateText: string;
  /** Where the byline links (editorial policy). */
  href: string;
}

/**
 * Visible byline for a blog post. "By {author}" always; "Reviewed by X" only
 * when a reviewer is named; "Last reviewed {date}" only when last_reviewed is
 * set AND a reviewer is named, otherwise "Updated {updated_at || published}".
 * No invented names or review dates.
 *
 * Why the reviewer gate: the legacy last_reviewed column is machine-stamped
 * with new Date() at generation time (blog-generator-enhanced.ts) and by the
 * SEO backfill (seo-routes.ts "set to current date if NULL"), so on its own it
 * does not mean a human reviewed the post. Displaying it as "Last reviewed"
 * would be a false claim; paired with a named reviewer it is a real review.
 */
export function blogByline(blog: BlogBylineInput): BlogByline {
  const authorName = realContent(blog.authorName);
  const reviewer = realContent(blog.reviewerName) || null;
  const reviewed = reviewer ? toDate(blog.lastReviewed) : null;
  const date = reviewed ?? toDate(blog.updatedAt) ?? toDate(blog.publishedAt) ?? toDate(blog.createdAt);
  return {
    author: authorName || EDITORIAL_TEAM,
    authorIsPerson: !!authorName,
    reviewer,
    dateLabel: reviewed ? "Last reviewed" : "Updated",
    date,
    dateText: formatLongDate(date),
    href: "/editorial-policy",
  };
}

export function blogArticleJsonLd(
  blog: BlogBylineInput & { title?: string | null },
  opts: { canonical: string; siteUrl: string; description: string; image?: string; keywords?: string[] | null },
): Record<string, any> {
  const by = blogByline(blog);
  const published = toDate(blog.publishedAt) ?? toDate(blog.createdAt);
  const author = by.authorIsPerson
    ? { "@type": "Person", name: by.author }
    : { "@type": "Organization", name: EDITORIAL_TEAM, url: `${opts.siteUrl}/editorial-policy` };
  const webPage: Record<string, any> = { "@type": "WebPage", "@id": opts.canonical };
  if (by.reviewer) {
    webPage.reviewedBy = { "@type": "Person", name: by.reviewer };
    if (by.dateLabel === "Last reviewed" && by.date) webPage.lastReviewed = by.date.toISOString();
  }
  const ld: Record<string, any> = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: cutAtWordBoundary(realContent(blog.title), 110),
    description: excerptAtWord(opts.description, 300),
    url: opts.canonical,
    ...(opts.image ? { image: opts.image } : {}),
    ...(published ? { datePublished: published.toISOString() } : {}),
    ...(by.date ? { dateModified: by.date.toISOString() } : {}),
    author,
    publisher: {
      "@type": "Organization",
      name: SITE_NAME,
      url: opts.siteUrl,
      logo: { "@type": "ImageObject", url: `${opts.siteUrl}/logo.png` },
    },
    mainEntityOfPage: webPage,
  };
  if (opts.keywords?.length) ld.keywords = opts.keywords.join(", ");
  return ld;
}

// ── FAQ visibility ──────────────────────────────────────────────

export interface QaPair {
  question: string;
  answer: string;
}

/** Parse the stored question_answer_pairs JSON ({question,answer} | {q,a}). */
export function parseQaPairs(raw: unknown): QaPair[] {
  let arr: unknown = raw;
  if (typeof raw === "string") {
    try {
      arr = JSON.parse(raw);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(arr)) return [];
  return arr
    .map((qa: any) => ({
      question: realContent(qa?.question ?? qa?.q),
      answer: realContent(qa?.answer ?? qa?.a),
    }))
    .filter((qa) => qa.question && qa.answer);
}

function normalizeForMatch(text: string): string {
  return stripTags(text)
    .replace(/&amp;/g, "&")
    .replace(/&(?:quot|#0*34);/g, '"')
    .replace(/&(?:#0*39|apos|rsquo|lsquo);/g, "'")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

/**
 * FAQPage JSON-LD is allowed only for Q&As a reader can actually see. Returns
 * the pairs when EVERY question's text appears in `visibleText` (rendered page
 * text/HTML), otherwise null → emit no FAQPage.
 */
export function faqPairsIfVisible(pairs: QaPair[], visibleText: string): QaPair[] | null {
  if (!pairs.length) return null;
  const haystack = normalizeForMatch(visibleText);
  if (!haystack) return null;
  const allVisible = pairs.every((qa) => {
    const needle = normalizeForMatch(qa.question);
    return needle.length > 0 && haystack.includes(needle);
  });
  return allVisible ? pairs : null;
}

export function faqPageJsonLd(pairs: QaPair[]): Record<string, any> {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: pairs.map((qa) => ({
      "@type": "Question",
      name: qa.question,
      acceptedAnswer: { "@type": "Answer", text: qa.answer },
    })),
  };
}
