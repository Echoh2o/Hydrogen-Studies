/**
 * Shared HTML-safety helpers for server-side rendered output (App Proxy SSR,
 * SEO bot middleware, body renderer). These render untrusted data — study
 * fields ingested from CrossRef/PubMed, AI-generated text, admin input — into
 * HTML, so every sink must escape for its context.
 */

/** Escape for use in HTML text/element context. */
export function escapeHtml(str: string | null | undefined): string {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Escape for use inside a double-quoted HTML attribute. `&` MUST be escaped
 * first, otherwise the entities produced for the other characters get
 * double-escaped (e.g. `"` -> `&quot;` -> `&amp;quot;`).
 */
export function escapeAttr(str: string | null | undefined): string {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Serialize a value for embedding inside a <script type="application/ld+json">
 * block. JSON.stringify does NOT escape `<` or `/`, so a field containing the
 * literal `</script>` would break out of the block and inject markup. Escaping
 * `<`, `>` and `&` to their \uXXXX forms keeps the payload inert while staying
 * valid JSON.
 */
export function jsonLdSafe(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026");
}

/**
 * Return `url` only if it uses a safe scheme for an href/src — http(s),
 * mailto, or a relative/anchor path. Anything else (javascript:, data:,
 * vbscript:, etc.) becomes "". Prevents `javascript:` URI XSS when rendering
 * ingested links like study.url / study.image_url.
 */
export function safeUrl(url: string | null | undefined): string {
  if (!url) return "";
  const trimmed = url.trim();
  // Relative paths and anchors are safe (no scheme).
  if (/^(\/|#|\?)/.test(trimmed)) return trimmed;
  // Scheme-relative (//host) inherits the page scheme — allow it.
  if (trimmed.startsWith("//")) return trimmed;
  const match = trimmed.match(/^([a-zA-Z][a-zA-Z0-9+.-]*):/);
  if (!match) return trimmed; // no scheme at all (e.g. "example.com/x") — treat as relative
  const scheme = match[1].toLowerCase();
  return scheme === "http" || scheme === "https" || scheme === "mailto" ? trimmed : "";
}
