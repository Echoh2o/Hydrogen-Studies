/**
 * Anchor id for an article h2/h3 — ONE rule for the crawler renderer
 * (seo-body-renderer markdownToHtml) and the SPA markdown components
 * (client/src/components/blog/markdown-components.tsx), so a link like
 * /blog/hydrogen-therapy-machine-home#is-hydrogen-flammable lands on the same
 * heading for bots and browsers.
 *
 * Takes the heading's visible text (no tags). HTML entities are decoded first,
 * so "What's" → "what-s", not the "what-39-s" that slugifying marked's escaped
 * output produced. Keep dependency-free: ships in the browser bundle.
 */
const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

export function decodeHtmlEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, code: string) => {
    if (code[0] === "#") {
      const n = code[1] === "x" || code[1] === "X" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : m;
    }
    return ENTITIES[code.toLowerCase()] ?? m;
  });
}

export function headingId(text: string): string {
  return decodeHtmlEntities(text)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}
