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
 *   1. Remove anything tag-shaped.
 *   2. Decode the few entities that might evade #1 (`&lt;script&gt;`).
 *   3. Re-strip in case #2 surfaced new tag-shaped strings.
 *   4. Strip control + zero-width chars; collapse whitespace.
 *
 * Not bulletproof against every payload, but good enough for plain-
 * text user inputs that should never contain markup. For richer
 * sanitization (e.g. WYSIWYG content), use a real DOM-aware sanitizer.
 */
export function sanitizeUserText(input: string): string {
  let s = String(input);
  for (let i = 0; i < 2; i++) {
    s = s.replace(/<[^>]*>/g, "");
    s = s
      .replace(/&lt;/gi, "<")
      .replace(/&gt;/gi, ">")
      .replace(/&amp;/gi, "&")
      .replace(/&quot;/gi, '"')
      .replace(/&#0*60;?/g, "<")
      .replace(/&#0*62;?/g, ">");
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
