/**
 * Small text-cleaning helpers used across route handlers.
 *
 * Lives here (instead of inlined per route) so:
 *   1. Tests can import them directly without booting the route module
 *   2. Future routes can reuse the same sanitization without copy-paste
 *
 * Originally inlined in contact-routes.ts and multi-format-routes.ts
 * during Phase 1 audit fixes (commit 3647e80).
 */

/**
 * Strip HTML tags + zero-width characters from a free-text user
 * input field. Used for public POST endpoints (contact form, etc.)
 * to prevent stored XSS.
 *
 * Conservative approach (regex tag-strip rather than DOM parser):
 *   1. DECODE entities first — decoding can surface tag-shaped strings that
 *      were (multiply) entity-encoded, e.g. `&amp;lt;img ...&amp;gt;`.
 *   2. Strip anything tag-shaped.
 *   3. Repeat 1-2 to a fixpoint: the old strip-then-decode order left a
 *      decoded tag un-stripped, so a double-encoded payload slipped through.
 *      Looping until the string stops changing closes that hole.
 *   4. Strip control + zero-width chars; collapse whitespace.
 *
 * Not bulletproof against every payload, but good enough for plain-
 * text user inputs that should never contain markup. For richer
 * sanitization (e.g. WYSIWYG content), use a real DOM-aware sanitizer.
 */
export function sanitizeUserText(input: string): string {
  let s = String(input);
  // Bounded fixpoint loop (10 = generous backstop; real inputs converge in 1-3).
  for (let i = 0; i < 10; i++) {
    const before = s;
    // Decode BEFORE stripping. Decode `&amp;` LAST so a payload like
    // `&amp;lt;` becomes `&lt;` this pass and `<` the next, guaranteeing a
    // later strip pass sees the surfaced tag.
    s = s
      .replace(/&lt;/gi, "<")
      .replace(/&gt;/gi, ">")
      .replace(/&quot;/gi, '"')
      .replace(/&#0*60;?/g, "<")
      .replace(/&#0*62;?/g, ">")
      .replace(/&amp;/gi, "&");
    s = s.replace(/<[^>]*>/g, "");
    if (s === before) break;
  }
  s = s.replace(/[\u0000-\u001f\u007f-\u009f\u200B-\u200F\uFEFF]/g, "");
  s = s.replace(/\s+/g, " ").trim();
  return s;
}

/**
 * Safe JSON.parse wrapper for stored content fields. Returns the
 * supplied fallback if the input is null, empty, or unparseable —
 * so a single corrupted DB row can't crash an export endpoint.
 *
 * Type parameter is the expected shape; the fallback should match it
 * (e.g. an empty array) so downstream `.forEach` keeps working.
 */
export function safeJsonParse<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}
