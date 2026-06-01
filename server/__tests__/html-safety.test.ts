import { describe, it, expect } from "vitest";
import { escapeHtml, escapeAttr, jsonLdSafe, safeUrl } from "../utils/html-safety";
import { sanitizeArticleHtml } from "../utils/sanitize-html";

describe("escapeAttr", () => {
  it("escapes & before other entities (no double-escaping)", () => {
    // The previous implementation escaped " before &, turning a quote into
    // &amp;quot;. Verify the order is fixed.
    expect(escapeAttr('a"b')).toBe("a&quot;b");
    expect(escapeAttr("a&b")).toBe("a&amp;b");
    expect(escapeAttr('"&')).toBe("&quot;&amp;");
  });
  it("escapes angle brackets", () => {
    expect(escapeAttr("<x>")).toBe("&lt;x&gt;");
  });
  it("returns empty string for nullish", () => {
    expect(escapeAttr(null)).toBe("");
    expect(escapeAttr(undefined)).toBe("");
  });
});

describe("escapeHtml", () => {
  it("escapes the five HTML-significant characters", () => {
    expect(escapeHtml(`<a href="x">&'`)).toBe("&lt;a href=&quot;x&quot;&gt;&amp;&#39;");
  });
});

describe("jsonLdSafe", () => {
  it("neutralizes a </script> breakout in string values", () => {
    const out = jsonLdSafe({ headline: "evil</script><script>alert(1)</script>" });
    expect(out).not.toContain("</script>");
    expect(out).toContain("\\u003c/script");
    // Still valid JSON that round-trips to the original value.
    expect(JSON.parse(out).headline).toBe("evil</script><script>alert(1)</script>");
  });
  it("escapes < > and &", () => {
    expect(jsonLdSafe("<>&")).toBe('"\\u003c\\u003e\\u0026"');
  });
});

describe("safeUrl", () => {
  it("blocks javascript: and data: and vbscript: schemes", () => {
    expect(safeUrl("javascript:alert(1)")).toBe("");
    expect(safeUrl("  JavaScript:alert(1)")).toBe("");
    expect(safeUrl("data:text/html,<script>")).toBe("");
    expect(safeUrl("vbscript:msgbox(1)")).toBe("");
  });
  it("allows http(s), mailto, relative and anchor links", () => {
    expect(safeUrl("https://doi.org/10.1/x")).toBe("https://doi.org/10.1/x");
    expect(safeUrl("http://example.com")).toBe("http://example.com");
    expect(safeUrl("mailto:a@b.com")).toBe("mailto:a@b.com");
    expect(safeUrl("/studies/1")).toBe("/studies/1");
    expect(safeUrl("#section")).toBe("#section");
    expect(safeUrl("//cdn.example.com/x")).toBe("//cdn.example.com/x");
  });
  it("treats schemeless strings as relative", () => {
    expect(safeUrl("example.com/x")).toBe("example.com/x");
  });
  it("returns empty for nullish", () => {
    expect(safeUrl(null)).toBe("");
  });
});

describe("sanitizeArticleHtml", () => {
  it("strips <script> tags", () => {
    expect(sanitizeArticleHtml("<p>ok</p><script>alert(1)</script>")).toBe("<p>ok</p>");
  });
  it("strips unquoted and svg event handlers the old regex missed", () => {
    expect(sanitizeArticleHtml("<img src=x onerror=alert(1)>")).not.toContain("onerror");
    expect(sanitizeArticleHtml("<svg onload=alert(1)></svg>")).not.toContain("onload");
  });
  it("removes javascript: hrefs but keeps safe links and structural html", () => {
    const out = sanitizeArticleHtml('<a href="javascript:alert(1)">x</a>');
    expect(out).not.toContain("javascript:");
    const ok = sanitizeArticleHtml('<a href="https://x.com" title="t">x</a><strong>b</strong>');
    expect(ok).toContain("https://x.com");
    expect(ok).toContain("<strong>b</strong>");
  });
  it("returns empty string for nullish input", () => {
    expect(sanitizeArticleHtml(null)).toBe("");
    expect(sanitizeArticleHtml("")).toBe("");
  });
});
