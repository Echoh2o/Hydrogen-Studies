/**
 * Tests for the pure helper functions that drive the 404 → redirect
 * suggestion engine. Important because these run on every backfill
 * cron cycle (Job 20) and every Resolve dialog open — small bugs here
 * propagate to thousands of entries.
 *
 * Skips DB-bound logic (getRankedSuggestions, backfillSuggestions);
 * those need integration tests with a real Postgres connection.
 */
import { describe, it, expect, vi } from "vitest";

// Mock the DB module so importing redirect-service doesn't require a
// real DATABASE_URL. None of the helpers we're testing here actually
// hit the DB — they're pure functions.
vi.mock("../db", () => ({
  db: {},
}));

import {
  isBotProbe,
  reconstructQuery,
  tokenOverlap,
  popularityBonus,
  assertSameSitePath,
} from "../services/redirect-service";

describe("isBotProbe", () => {
  it("flags WordPress probes", () => {
    expect(isBotProbe("/wp-admin/setup-config.php")).toBe(true);
    expect(isBotProbe("/wp-content/uploads/something.php")).toBe(true);
    expect(isBotProbe("/wordpress/login")).toBe(true);
    expect(isBotProbe("/xmlrpc.php")).toBe(true);
  });

  it("flags dotfile probes", () => {
    expect(isBotProbe("/.env")).toBe(true);
    expect(isBotProbe("/.env.production")).toBe(true);
    expect(isBotProbe("/.git/config")).toBe(true);
    expect(isBotProbe("/.aws/credentials")).toBe(true);
    expect(isBotProbe("/.ssh/id_rsa")).toBe(true);
  });

  it("flags PHP DB admin tools", () => {
    expect(isBotProbe("/phpmyadmin")).toBe(true);
    expect(isBotProbe("/adminer.php")).toBe(true);
    expect(isBotProbe("/pma/index.php")).toBe(true);
  });

  it("flags IoT / router exploits", () => {
    expect(isBotProbe("/HNAP1/")).toBe(true);
    expect(isBotProbe("/GponForm/diag_Form?images")).toBe(true);
    expect(isBotProbe("/boaform/admin/formLogin")).toBe(true);
  });

  it("flags Microsoft Exchange enumeration", () => {
    expect(isBotProbe("/owa/auth/logon.aspx")).toBe(true);
    expect(isBotProbe("/autodiscover/autodiscover.xml")).toBe(true);
    expect(isBotProbe("/ecp/Current/exporttool/")).toBe(true);
  });

  it("flags asset extensions", () => {
    expect(isBotProbe("/missing.js")).toBe(true);
    expect(isBotProbe("/styles.css")).toBe(true);
    expect(isBotProbe("/sourcemap.map")).toBe(true);
    expect(isBotProbe("/font.woff2")).toBe(true);
  });

  it("flags admin paths under /admin (but not /admin-* legit segments)", () => {
    // Direct /admin probes are bot territory
    expect(isBotProbe("/admin")).toBe(true);
    expect(isBotProbe("/admin/login.php")).toBe(true);
    expect(isBotProbe("/administrator")).toBe(true);
    // BUT /admin-something is allowed through (could be a real path)
    expect(isBotProbe("/admin-portal")).toBe(false);
  });

  it("does NOT flag legitimate user 404s", () => {
    // Typo'd study slug
    expect(isBotProbe("/study/hydrogen-water-anti-aging")).toBe(false);
    // Mistyped blog
    expect(isBotProbe("/blog/some-typo-here")).toBe(false);
    // Category page that doesn't exist
    expect(isBotProbe("/explore-by-condition/cardiovascula")).toBe(false);
    // Just a path
    expect(isBotProbe("/products")).toBe(false);
  });
});

describe("reconstructQuery", () => {
  it("strips noise segments and tokenizes the rest", () => {
    const result = reconstructQuery("/studies/hydrogen-water-cardiovascular-effects");
    expect(result.tokens).toContain("hydrogen");
    expect(result.tokens).toContain("water");
    expect(result.tokens).toContain("cardiovascular");
    expect(result.tokens).toContain("effects");
    // "studies" is a noise segment, should not appear
    expect(result.tokens).not.toContain("studies");
    expect(result.pathHint).toBe("study");
    expect(result.lastSegment).toBe("hydrogen-water-cardiovascular-effects");
  });

  it("detects path hint from blog prefix", () => {
    expect(reconstructQuery("/blog/something").pathHint).toBe("blog");
    expect(reconstructQuery("/article/something").pathHint).toBe("blog");
    expect(reconstructQuery("/posts/something").pathHint).toBe("blog");
  });

  it("detects condition path hint", () => {
    expect(
      reconstructQuery("/tools/hydrogen-research/condition/diabetes").pathHint,
    ).toBe("condition");
  });

  it("strips file extensions on the last segment", () => {
    const result = reconstructQuery("/blog/old-post.html");
    expect(result.tokens).toContain("old");
    expect(result.tokens).toContain("post");
    expect(result.tokens).not.toContain("html");
  });

  it("drops stopwords + numeric segments + dates", () => {
    const result = reconstructQuery("/2024/05/the-and-or-test");
    // "the", "and", "or" are stopwords and should be dropped
    expect(result.tokens).not.toContain("the");
    expect(result.tokens).not.toContain("and");
    expect(result.tokens).not.toContain("or");
    // "test" survives (4 chars, not a stopword)
    expect(result.tokens).toContain("test");
  });

  it("returns empty tokens for trailing-slash homepage variants", () => {
    expect(reconstructQuery("/").tokens).toEqual([]);
    expect(reconstructQuery("///").tokens).toEqual([]);
  });

  it("returns no path hint for unrecognized prefixes", () => {
    expect(reconstructQuery("/random/path").pathHint).toBe(null);
  });
});

describe("tokenOverlap", () => {
  it("counts how many query tokens appear in any field", () => {
    const tokens = ["hydrogen", "diabetes", "kidney"];
    const fields = [["diabetes", "metabolic"], ["hydrogen-rich-water"], null];
    // "hydrogen" (split from hydrogen-rich-water) + "diabetes" appear; "kidney" does not.
    expect(tokenOverlap(tokens, fields)).toBe(2);
  });

  it("returns 0 when tokens is empty", () => {
    expect(tokenOverlap([], [["foo", "bar"]])).toBe(0);
  });

  it("ignores null/undefined fields", () => {
    expect(tokenOverlap(["foo"], [null, undefined])).toBe(0);
  });

  it("splits hyphenated tags into individual tokens", () => {
    // "anti-aging" should match "aging" or "anti" tokens
    expect(tokenOverlap(["aging"], [["anti-aging"]])).toBe(1);
  });

  it("only counts each query token once even if it appears in multiple fields", () => {
    expect(tokenOverlap(["foo"], [["foo"], ["foo"], ["foo"]])).toBe(1);
  });

  it("ignores tokens shorter than 3 chars from the haystack", () => {
    // "ab" is 2 chars, won't make it into the haystack set
    expect(tokenOverlap(["ab"], [["ab", "long"]])).toBe(0);
  });
});

describe("popularityBonus", () => {
  it("returns 0 for null / 0 view counts", () => {
    expect(popularityBonus(null)).toBe(0);
    expect(popularityBonus(undefined)).toBe(0);
    expect(popularityBonus(0)).toBe(0);
  });

  it("scales logarithmically — caps at 0.05", () => {
    expect(popularityBonus(1)).toBeGreaterThan(0);
    expect(popularityBonus(1)).toBeLessThan(0.01);
    expect(popularityBonus(10)).toBeGreaterThan(popularityBonus(1));
    expect(popularityBonus(10_000_000)).toBeLessThanOrEqual(0.05);
  });

  it("bonus at 10 views is roughly 0.017 (matches the comment)", () => {
    const b = popularityBonus(10);
    expect(b).toBeGreaterThan(0.015);
    expect(b).toBeLessThan(0.02);
  });
});

describe("assertSameSitePath", () => {
  it("accepts plain absolute paths", () => {
    expect(() => assertSameSitePath("/studies/foo")).not.toThrow();
    expect(() => assertSameSitePath("/")).not.toThrow();
    expect(() => assertSameSitePath("/blog/post-name")).not.toThrow();
  });

  it("rejects empty or non-string input", () => {
    expect(() => assertSameSitePath("")).toThrow(/required/);
    expect(() => assertSameSitePath(null as unknown as string)).toThrow(/required/);
  });

  it("rejects relative paths", () => {
    expect(() => assertSameSitePath("studies/foo")).toThrow(/absolute/);
    expect(() => assertSameSitePath("./foo")).toThrow(/absolute/);
  });

  it("rejects protocol-relative URLs (open-redirect vector)", () => {
    expect(() => assertSameSitePath("//evil.com/phish")).toThrow(/external/);
    expect(() => assertSameSitePath("//attacker")).toThrow(/external/);
  });

  it("rejects backslash tricks", () => {
    expect(() => assertSameSitePath("/\\evil.com")).toThrow(/external/);
  });

  it("rejects raw URL schemes embedded in the path", () => {
    expect(() => assertSameSitePath("/https://evil.com")).toThrow(/scheme/);
    expect(() => assertSameSitePath("/javascript://x")).toThrow(/scheme/);
  });
});
