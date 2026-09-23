/**
 * #6 — retired (410) / unpublished posts never reach public pages via the
 * APIs that feed the SPA:
 *  - GET /api/blogs/slug/:slug (public) unwraps in-body links to dead posts
 *  - /api/internal-links (RelatedContent) only returns live blog targets
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";

const dialect = new PgDialect();
const captured = vi.hoisted(() => ({ where: [] as any[], rows: [] as any[] }));

vi.mock("../db", () => {
  function chain(): any {
    const p: any = new Proxy(function () {}, {
      get(_t, prop) {
        if (prop === "then") {
          return (resolve: any, reject: any) => Promise.resolve([...captured.rows]).then(resolve, reject);
        }
        if (prop === "where") {
          return (arg: any) => {
            captured.where.push(arg);
            return p;
          };
        }
        return () => p;
      },
      apply() {
        return p;
      },
    });
    return p;
  }
  return { db: chain(), migrationDb: chain(), pool: { query: () => new Promise(() => {}) } };
});

vi.mock("../services/live-blog-index", () => ({
  getLiveBlogPredicate: async () => (ref: string) => ref === "live-post",
  invalidateLiveBlogIndex: () => {},
}));

import { toPublicBlog } from "../routes/blog-routes";
import { getLinksFor } from "../services/internal-linking-engine";

beforeEach(() => {
  captured.where = [];
  captured.rows = [];
});

describe("public blog API content", () => {
  it("unwraps links to retired posts and drops editorNotes", async () => {
    const out = await toPublicBlog({
      id: 1,
      slug: "x",
      editorNotes: "internal",
      content: "Read [the old guide](/blog/retired-post) and [the new one](/blog/live-post).",
    });
    expect(out.editorNotes).toBeUndefined();
    expect(out.content).toBe("Read the old guide and [the new one](/blog/live-post).");
  });

  it("leaves content without blog links untouched", async () => {
    const out = await toPublicBlog({ id: 1, content: "No links here." });
    expect(out.content).toBe("No links here.");
  });
});

describe("internal-links (RelatedContent) blog targets", () => {
  it("filters blog targets to published AND not archived, and links by slug", async () => {
    captured.rows = [
      { link: { toType: "blog", toId: 9, anchorText: "Live", linkType: "related", relevanceScore: 70 }, blogSlug: "live-post" },
      { link: { toType: "study", toId: 3, anchorText: "Study", linkType: "related", relevanceScore: 80 }, blogSlug: null },
    ];
    const links = await getLinksFor("blog", 1);
    expect(links.map((l) => l.url)).toEqual(["/blog/live-post", "/study/id/3"]);

    const { sql: whereSql } = dialect.sqlToQuery(captured.where[0]);
    expect(whereSql).toMatch(/"blog_articles"\."is_published" = true/);
    expect(whereSql).toMatch(/"blog_articles"\."is_archived" = false/);
  });
});
