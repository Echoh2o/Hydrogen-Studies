/**
 * Editorial byline for indexable non-article pages — hubs, listings,
 * profiles, home and the static pages (CLAUDE.md: every indexable page shows
 * author or reviewer + a last-reviewed/updated date; audit 2026-11-22,
 * reports/audit-2026-11-22/06-indexable-pages-missing-trust-fields.csv).
 *
 *   "By the Hydrogen Studies Editorial Team · Last updated <date>"
 *
 * Never names the study reviewer (she reviews studies, not hubs) and emits no
 * reviewedBy schema. The date must be truthful and deterministic:
 *   - pages that list studies → the newest COALESCE(last_modified, created_at)
 *     among the listed studies (the column sitemap-studies uses for lastmod);
 *   - static pages → STATIC_PAGE_UPDATED below.
 * No date → no line (empty fields never render).
 *
 * Dependency-free apart from seo-markup: ships in the browser bundle.
 */
import { EDITORIAL_TEAM, formatLongDate, toDate } from "./seo-markup";

/**
 * Last copy change per static page = the last git commit that changed that
 * page's text (content moved to client/src/pages/content/* on 2026-11-02 with
 * no copy change, so the date is the last edit before the move).
 * BUMP the date whenever you change the page's copy.
 */
export const STATIC_PAGE_UPDATED: Readonly<Record<string, string>> = {
  "/about": "2026-03-13", // AboutContent.tsx (was pages/about.tsx, 5c164ef)
  "/contact": "2026-03-13", // ContactContent.tsx + contact-faqs.ts (was ContactPage.tsx, 525a604)
  "/terms": "2026-08-04", // TermsContent.tsx (4183f85; matches its "Effective Date")
  "/privacy": "2026-09-23", // PrivacyContent.tsx (11efe0f; matches its "Last Updated")
};

export interface PageByline {
  author: string;
  href: string;
  /** YYYY-MM-DD */
  iso: string;
  dateText: string;
}

export function pageByline(date: unknown): PageByline | null {
  const d = toDate(date);
  if (!d) return null;
  return { author: EDITORIAL_TEAM, href: "/editorial-policy", iso: d.toISOString().slice(0, 10), dateText: formatLongDate(d) };
}

/** Newest date among the values (study last_modified/created_at), or null. */
export function newestDate(values: Iterable<unknown>): Date | null {
  let best: Date | null = null;
  for (const v of values) {
    const d = toDate(v);
    if (d && (!best || d > best)) best = d;
  }
  return best;
}

function escHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Crawler/Express HTML twin of <PageBylineLine>. "" when there's no date. */
export function pageBylineHtml(date: unknown): string {
  const b = pageByline(date);
  if (!b) return "";
  return `<p class="byline">By the <a href="${b.href}">${escHtml(b.author)}</a> · Last updated <time datetime="${b.iso}">${escHtml(b.dateText)}</time></p>\n`;
}
