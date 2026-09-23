/**
 * Render-time rewriters for stored article content (markdown or HTML).
 *
 * Shared by the bot renderer (server, HTML after `marked`) and the public blog
 * API that feeds the SPA (markdown/HTML as stored), so crawlers and browsers
 * get the same links:
 *
 *  - rewriteEchoLinks*      — every echowater.com link gets the canonical UTM
 *                             set (CLAUDE.md UTM rule), replacing stale tags.
 *  - stripDeadBlogLinks*    — links to retired (410) / unpublished blog posts
 *                             are unwrapped: the anchor text stays, the <a>
 *                             goes. `isLive` decides per slug/id.
 *  - demoteH1InHtml         — body content never carries a second <h1>; the
 *                             page template owns the only H1.
 *
 * Regex-based on purpose: this module ships to the browser bundle, and the
 * inputs are either sanitized HTML (server) or markdown written by our own
 * pipeline. Keep it dependency-free.
 */

import { buildEchoUrl, isEchoUrl, type EchoUtmContext } from "./echo-products";

// ── HTML attribute helpers ──────────────────────────────────────

function decodeAttr(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&#0*38;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#0*39;/g, "'");
}

function encodeAttr(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}

const HREF_ATTR_RE = /(\bhref\s*=\s*)(["'])([^"']*)\2/gi;

// ── echowater.com UTM normalization ─────────────────────────────

/** Add/normalize UTMs on every echowater.com href in an HTML fragment. */
export function rewriteEchoLinksInHtml(html: string, ctx: EchoUtmContext): string {
  if (!html || !/echowater\.com/i.test(html)) return html;
  return html.replace(HREF_ATTR_RE, (match, prefix: string, _q: string, value: string) => {
    const href = decodeAttr(value);
    if (!isEchoUrl(href)) return match;
    return `${prefix}"${encodeAttr(buildEchoUrl(href, ctx))}"`;
  });
}

// [text](url "title") — url may be wrapped in <...>
const MD_LINK_RE = /(\[[^\]]*\]\(\s*)(<[^>]*>|[^)\s]+)((?:\s+(?:"[^"]*"|'[^']*'))?\s*\))/g;
// <https://...> autolinks
const MD_AUTOLINK_RE = /<((?:https?:)?\/\/[^>\s]+)>/g;

/** Add/normalize UTMs on every echowater.com link in markdown source. */
export function rewriteEchoLinksInMarkdown(md: string, ctx: EchoUtmContext): string {
  if (!md || !/echowater\.com/i.test(md)) return md;
  let out = md.replace(MD_LINK_RE, (match, open: string, rawUrl: string, close: string) => {
    const wrapped = rawUrl.startsWith("<") && rawUrl.endsWith(">");
    const url = wrapped ? rawUrl.slice(1, -1) : rawUrl;
    if (!isEchoUrl(url)) return match;
    const tagged = buildEchoUrl(url, ctx);
    return `${open}${wrapped ? `<${tagged}>` : tagged}${close}`;
  });
  out = out.replace(MD_AUTOLINK_RE, (match, url: string) =>
    isEchoUrl(url) ? `<${buildEchoUrl(url, ctx)}>` : match,
  );
  // Inline HTML inside markdown (e.g. <a href="https://echowater.com">).
  return rewriteEchoLinksInHtml(out, ctx);
}

/** Rewrite echowater.com links in stored content of either format. */
export function rewriteEchoLinks(content: string, ctx: EchoUtmContext): string {
  return rewriteEchoLinksInMarkdown(content, ctx);
}

// ── Retired / unpublished blog links ────────────────────────────

const SITE_HOST_RE = /^(?:https?:)?\/\/(?:www\.)?hydrogenstudies\.com(?=\/|$)/i;

/**
 * If `href` points at a blog POST on this site, return its slug-or-id
 * ("my-post", "123"); otherwise null. Category/listing URLs return null.
 */
export function blogRefFromHref(href: string | null | undefined): string | null {
  if (!href) return null;
  let path = href.trim();
  if (SITE_HOST_RE.test(path)) path = path.replace(SITE_HOST_RE, "") || "/";
  if (!path.startsWith("/blog/")) return null;
  const segs = path.split(/[?#]/)[0].split("/").filter(Boolean); // ["blog", ...]
  if (segs.length < 2) return null;
  const ref = decodeURIComponentSafe(segs[1]);
  if (!ref || ref === "category") return null;
  return ref.toLowerCase();
}

function decodeURIComponentSafe(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

export type IsLiveBlogRef = (slugOrId: string) => boolean;

const HTML_ANCHOR_RE = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi;

/** Unwrap <a> tags that link to non-live blog posts (keeps the anchor text). */
export function stripDeadBlogLinksInHtml(html: string, isLive: IsLiveBlogRef): string {
  if (!html || !/\/blog\//i.test(html)) return html;
  return html.replace(HTML_ANCHOR_RE, (match, attrs: string, inner: string) => {
    const hrefMatch = /\bhref\s*=\s*(["'])([^"']*)\1/i.exec(attrs);
    if (!hrefMatch) return match;
    const ref = blogRefFromHref(decodeAttr(hrefMatch[2]));
    if (ref === null || isLive(ref)) return match;
    return inner;
  });
}

/** Unwrap markdown/inline-HTML links that point at non-live blog posts. */
export function stripDeadBlogLinksInMarkdown(md: string, isLive: IsLiveBlogRef): string {
  if (!md || !/\/blog\//i.test(md)) return md;
  const out = md.replace(MD_LINK_RE, (match, open: string, rawUrl: string) => {
    const url = rawUrl.startsWith("<") && rawUrl.endsWith(">") ? rawUrl.slice(1, -1) : rawUrl;
    const ref = blogRefFromHref(url);
    if (ref === null || isLive(ref)) return match;
    // open = "[text](" → keep just the text
    return open.replace(/^\[/, "").replace(/\]\(\s*$/, "");
  });
  return stripDeadBlogLinksInHtml(out, isLive);
}

/** Strip dead blog links from stored content of either format. */
export function stripDeadBlogLinks(content: string, isLive: IsLiveBlogRef): string {
  return stripDeadBlogLinksInMarkdown(content, isLive);
}

// ── Heading hygiene ─────────────────────────────────────────────

/**
 * Demote every <h1> in a body fragment to <h2>. The page template renders the
 * one true H1 (the article title); generated bodies often repeat it.
 */
export function demoteH1InHtml(html: string): string {
  if (!html || !/<h1\b/i.test(html)) return html;
  return html.replace(/<h1(\s[^>]*)?>/gi, (_m, attrs: string | undefined) => `<h2${attrs ?? ""}>`)
    .replace(/<\/h1\s*>/gi, "</h2>");
}
