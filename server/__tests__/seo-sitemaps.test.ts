/**
 * Sitemap image entries — Google image sitemaps require ABSOLUTE
 * <image:loc> URLs and silently ignore relative ones, so studies/blog
 * sitemaps must absolutize the relative /uploads/... paths stored in the DB.
 */
import { describe, it, expect, vi } from "vitest";
import express from "express";
import request from "supertest";

const dbRows = vi.hoisted(() => ({ current: [] as any[] }));

vi.mock("../db", () => {
  function chain(): any {
    const p: any = new Proxy(function () {}, {
      get(_t, prop) {
        if (prop === "then") {
          return (resolve: any, reject: any) =>
            Promise.resolve([...dbRows.current]).then(resolve, reject);
        }
        return () => p;
      },
      apply() {
        return p;
      },
    });
    return p;
  }
  return { db: chain(), pool: { query: () => new Promise(() => {}) } };
});

vi.mock("../auth", () => ({
  requireAdmin: (_req: any, _res: any, next: any) => next(),
}));

import seoRoutes from "../routes/seo-routes";

function makeApp() {
  const app = express();
  app.use(seoRoutes);
  return app;
}

describe("sitemap image:loc URLs", () => {
  it("absolutizes relative study image URLs", async () => {
    dbRows.current = [
      {
        id: 7,
        slug: "image-study",
        lastModified: new Date("2026-07-01"),
        createdAt: new Date("2026-06-01"),
        imageUrl: "/uploads/study-images/study_7.png",
        title: "Study With Image",
        publishYear: 2026,
      },
    ];

    const res = await request(makeApp()).get("/sitemap-studies.xml");

    expect(res.status).toBe(200);
    expect(res.text).toContain(
      "<image:loc>https://hydrogenstudies.com/uploads/study-images/study_7.png</image:loc>"
    );
    expect(res.text).not.toContain("<image:loc>/uploads");
  });

  it("absolutizes relative blog image URLs", async () => {
    dbRows.current = [
      {
        id: 9,
        slug: "image-blog",
        updatedAt: new Date("2026-07-01"),
        createdAt: new Date("2026-06-01"),
        imageUrl: "/uploads/blog-images/blog_9.png",
        title: "Blog With Image",
        isPublished: true,
      },
    ];

    const res = await request(makeApp()).get("/sitemap-blog.xml");

    expect(res.status).toBe(200);
    expect(res.text).toContain(
      "<image:loc>https://hydrogenstudies.com/uploads/blog-images/blog_9.png</image:loc>"
    );
    expect(res.text).not.toContain("<image:loc>/uploads");
  });

  it("leaves already-absolute image URLs untouched", async () => {
    dbRows.current = [
      {
        id: 8,
        slug: "cdn-study",
        lastModified: new Date("2026-07-01"),
        createdAt: new Date("2026-06-01"),
        imageUrl: "https://cdn.example.com/study_8.png",
        title: "CDN Study",
        publishYear: 2026,
      },
    ];

    // Unique cache key per sitemap route; the studies key was already set by
    // the first test, so exercise via a fresh module registry.
    vi.resetModules();
    const { default: freshRoutes } = await import("../routes/seo-routes");
    const app = express();
    app.use(freshRoutes);

    const res = await request(app).get("/sitemap-studies.xml");

    expect(res.status).toBe(200);
    expect(res.text).toContain(
      "<image:loc>https://cdn.example.com/study_8.png</image:loc>"
    );
  });
});
