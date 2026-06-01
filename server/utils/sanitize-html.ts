/**
 * DOM-aware HTML sanitizer for rich content (blog article bodies) that is
 * rendered server-side into crawler-facing HTML and also into the SPA via
 * dangerouslySetInnerHTML.
 *
 * Replaces the previous regex blacklist (strip <script> + quoted on*= ),
 * which was trivially bypassable (unquoted handlers, <svg onload>, <iframe
 * src=javascript:>, nested <scr<script>ipt>, etc.). DOMPurify parses the
 * markup with a real DOM (jsdom) and applies an allowlist.
 *
 * The JSDOM window + DOMPurify instance are created once at module load and
 * reused — building a window per call would be far too slow for the bot
 * render hot path.
 */
import { JSDOM } from "jsdom";
import createDOMPurify from "dompurify";

const { window } = new JSDOM("");
// DOMPurify's WindowLike type doesn't line up with jsdom's DOMWindow; the
// instance is valid at runtime, so cast through any.
const DOMPurify = createDOMPurify(window as any);

/** Tags allowed in article body content. */
const ALLOWED_TAGS = [
  "p", "br", "hr", "span", "div",
  "h1", "h2", "h3", "h4", "h5", "h6",
  "strong", "b", "em", "i", "u", "s", "sub", "sup", "mark", "small",
  "ul", "ol", "li", "dl", "dt", "dd",
  "blockquote", "pre", "code", "figure", "figcaption",
  "a", "img",
  "table", "thead", "tbody", "tfoot", "tr", "th", "td", "caption",
];

const ALLOWED_ATTR = [
  "href", "title", "target", "rel",
  "src", "alt", "width", "height", "loading",
  "class", "id", "itemprop", "datetime", "colspan", "rowspan",
];

/**
 * Sanitize rich HTML content for safe rendering. Strips scripts, event
 * handlers, javascript:/data: URIs, and any tag/attribute outside the
 * allowlist. Returns "" for empty input.
 */
export function sanitizeArticleHtml(dirty: string | null | undefined): string {
  if (!dirty) return "";
  return DOMPurify.sanitize(String(dirty), {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOW_DATA_ATTR: false,
    // DOMPurify blocks javascript:/vbscript: and other dangerous URI schemes
    // on href/src by default; this keeps http(s)/mailto/relative + data:image
    // for inline images only.
    ADD_URI_SAFE_ATTR: [],
  });
}
