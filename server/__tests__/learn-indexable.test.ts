/**
 * /learn guides are indexable (Josh, 2026-11-04): listed in sitemap-pages,
 * with a visible author + date byline (CLAUDE.md indexable-page rule) and no
 * invented reviewer. Thin/app pages stay out of the sitemap.
 */
import { describe, it, expect, vi } from "vitest";
import express from "express";
import request from "supertest";

vi.mock("../db", () => ({
  db: { execute: async () => ({ rows: [] }), select: () => ({ from: () => ({ where: () => ({ limit: async () => [] }) }) }) },
  pool: { query: async () => ({ rows: [] }) },
}));
vi.mock("../utils/logger", () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));

import seoRoutes from "../routes/seo-routes";
import { LEARN_PATHS, LEARN_LAST_REVIEWED, learnByline } from "../../shared/learn-pages";

const SITE = "https://hydrogenstudies.com";

describe("/learn indexable", () => {
  it("sitemap-pages lists every /learn guide and still omits thin/app pages", async () => {
    const app = express();
    app.use(seoRoutes);
    const res = await request(app).get("/sitemap-pages.xml");
    expect(res.status).toBe(200);
    for (const p of LEARN_PATHS) expect(res.text).toContain(`<loc>${SITE}${p}</loc>`);
    for (const p of ["/products", "/recommendations", "/search", "/advanced-search"]) {
      expect(res.text).not.toContain(`<loc>${SITE}${p}</loc>`);
    }
  });

  it("byline: editorial team, dated, no reviewer", () => {
    const b = learnByline();
    expect(b.author).toBe("Hydrogen Studies Editorial Team");
    expect(b.reviewer).toBeNull();
    expect(b.dateLabel).toBe("Updated");
    expect(b.date?.toISOString().slice(0, 10)).toBe(LEARN_LAST_REVIEWED);
    expect(b.dateText).toMatch(/November 2, 2026/);
  });
});
