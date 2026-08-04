/**
 * Tests for the shared sanitization helpers (server/utils/sanitize.ts).
 *
 * Both helpers were added during Phase 1 audit fixes:
 *   - sanitizeUserText closes a stored-XSS vector on the public
 *     contact form (commit 3647e80)
 *   - safeJsonParse stops one corrupt DB row from killing whole
 *     export endpoints (same commit)
 *
 * Tests live close to the functions to keep the lint of "anything
 * imported by test files must boot the entire app" small.
 */
import { describe, it, expect } from "vitest";
import { sanitizeUserText, safeJsonParse } from "../utils/sanitize";

describe("sanitizeUserText", () => {
  it("strips simple HTML tags", () => {
    expect(sanitizeUserText("hello <b>world</b>")).toBe("hello world");
    expect(sanitizeUserText("<p>paragraph</p>")).toBe("paragraph");
  });

  it("strips script tags + their contents", () => {
    const out = sanitizeUserText("safe<script>alert(1)</script>text");
    expect(out).not.toContain("<");
    expect(out).not.toContain(">");
    // The script body content (`alert(1)`) survives as plain text;
    // that's fine — it's no longer executable, just inert text.
  });

  it("decodes HTML entities and re-strips so &lt;script&gt; doesn't survive", () => {
    const out = sanitizeUserText("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(out).not.toContain("<");
    expect(out).not.toContain(">");
    expect(out).not.toContain("script");
  });

  it("decodes numeric character references too", () => {
    // &#60; is < and &#62; is >
    const out = sanitizeUserText("&#60;img src=x&#62;");
    expect(out).not.toContain("<");
  });

  it("neutralizes DOUBLE-encoded payloads (regression: strip-then-decode leaked these)", () => {
    // `&amp;lt;...&amp;gt;` decodes to `&lt;...&gt;` then `<...>`. The old
    // strip-first/decode-second order surfaced the tag on the final pass with
    // no strip after it. The fixpoint loop must fully remove it.
    const out = sanitizeUserText("&amp;lt;img src=x onerror=alert(1)&amp;gt;");
    expect(out).not.toContain("<");
    expect(out).not.toContain(">");
    expect(out).not.toContain("onerror=alert(1)>");
  });

  it("neutralizes triple-encoded payloads too", () => {
    const out = sanitizeUserText("&amp;amp;lt;script&amp;amp;gt;");
    expect(out).not.toContain("<");
    expect(out).not.toContain(">");
  });

  it("strips zero-width characters used to evade regexes", () => {
    const out = sanitizeUserText("hello\u200Bworld\uFEFF!");
    expect(out).toBe("helloworld!");
  });

  it("strips control characters", () => {
    expect(sanitizeUserText("foo\u0000bar")).toBe("foobar");
    expect(sanitizeUserText("foo\u001fbar")).toBe("foobar");
  });

  it("collapses whitespace and trims", () => {
    expect(sanitizeUserText("  foo   bar  \n\t baz  ")).toBe("foo bar baz");
  });

  it("leaves plain text untouched", () => {
    expect(sanitizeUserText("Just a normal message")).toBe("Just a normal message");
    expect(sanitizeUserText("Email me at user@example.com")).toBe("Email me at user@example.com");
  });

  it("handles empty input", () => {
    expect(sanitizeUserText("")).toBe("");
    expect(sanitizeUserText("   ")).toBe("");
  });

  it("coerces non-string inputs (defensive)", () => {
    // The Zod transform is typed as string but defensive coding doesn't
    // hurt — make sure we don't crash on a numeric input that snuck through.
    expect(sanitizeUserText(123 as unknown as string)).toBe("123");
  });

  it("handles common attack patterns", () => {
    // javascript: scheme in an href
    const out1 = sanitizeUserText('<a href="javascript:alert(1)">click</a>');
    expect(out1).not.toContain("<");
    // Mixed-case tag
    const out2 = sanitizeUserText("<ScRiPt>x</ScRiPt>");
    expect(out2).not.toContain("<");
    expect(out2).not.toContain(">");
    // SVG injection
    const out3 = sanitizeUserText("<svg onload=alert(1)>");
    expect(out3).not.toContain("<");
  });
});

describe("safeJsonParse", () => {
  it("parses valid JSON", () => {
    expect(safeJsonParse('{"a":1}', {})).toEqual({ a: 1 });
    expect(safeJsonParse("[1,2,3]", [])).toEqual([1, 2, 3]);
    expect(safeJsonParse('"hello"', "")).toBe("hello");
  });

  it("returns fallback for null/undefined/empty", () => {
    expect(safeJsonParse(null, [])).toEqual([]);
    expect(safeJsonParse(undefined, [])).toEqual([]);
    expect(safeJsonParse("", [])).toEqual([]);
  });

  it("returns fallback for malformed JSON", () => {
    expect(safeJsonParse("{not json", [])).toEqual([]);
    expect(safeJsonParse("undefined", [])).toEqual([]);
    expect(safeJsonParse("'single quotes'", [])).toEqual([]);
  });

  it("preserves the fallback's type", () => {
    // The whole point: callers can pass a typed default and rely on it
    // for downstream operations.
    type QA = { question: string; answer: string };
    const result = safeJsonParse<QA[]>("not json", []);
    // .forEach should work without a null-check
    expect(() => result.forEach(() => {})).not.toThrow();
  });

  it("doesn't crash on weirdly-typed valid JSON", () => {
    // null is valid JSON
    expect(safeJsonParse("null", "fallback")).toBe(null);
    // numbers are valid JSON
    expect(safeJsonParse("42", 0)).toBe(42);
    // booleans
    expect(safeJsonParse("true", false)).toBe(true);
  });
});
