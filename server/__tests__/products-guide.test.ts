/**
 * PLAN 5.4 — /products is the honest device guide (Josh, 2026-11-04):
 * indexable, in the sitemap, schema = what's visible, Echo labeled as funder,
 * no disease claims, every Echo link UTM-tagged.
 */
import { describe, it, expect, vi } from "vitest";
import express from "express";
import request from "supertest";

vi.mock("../db", () => ({
  db: { execute: async () => ({ rows: [] }), select: () => ({ from: () => ({ where: () => ({ limit: async () => [] }) }) }) },
  pool: { query: async () => ({ rows: [] }) },
}));
vi.mock("../middleware/seo-body-renderer", () => ({ getConditionHubs: async () => [] }));
vi.mock("../utils/logger", () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));

import seoRoutes from "../routes/seo-routes";
import { resolveStaticPageMeta } from "../services/page-meta";
import { ECHO_PRODUCTS, echoProductUrl, pageContextFromPath } from "../../shared/echo-products";
import * as guide from "../../shared/products-guide";

const SITE = "https://hydrogenstudies.com";

describe("/products device guide", () => {
  it("is indexable with a ≤65-char title, WebPage + BreadcrumbList (Home → H1)", () => {
    const meta = resolveStaticPageMeta("/products")!;
    expect(meta.robots).toBeUndefined();
    expect(meta.title.length).toBeLessThanOrEqual(65);
    const blocks = meta.jsonLd as any[];
    expect(blocks.map((b) => b["@type"])).toEqual(["WebPage", "BreadcrumbList"]);
    const crumbs = blocks[1].itemListElement.map((i: any) => i.name);
    expect(crumbs).toEqual(["Home", guide.PRODUCTS_H1]);
    expect(guide.PRODUCTS_H1.length).toBeLessThanOrEqual(60);
  });

  it("is listed in sitemap-pages", async () => {
    const app = express();
    app.use(seoRoutes);
    const res = await request(app).get("/sitemap-pages.xml");
    expect(res.text).toContain(`<loc>${SITE}/products</loc>`);
  });

  it("byline: editorial team, dated, no reviewer claimed", () => {
    const b = guide.productsByline();
    expect(b.reviewer).toBeNull();
    expect(b.date?.toISOString().slice(0, 10)).toBe(guide.PRODUCTS_LAST_REVIEWED);
  });

  it("every Echo device is a known store product and its link carries the UTM rule", () => {
    const ctx = pageContextFromPath("/products");
    for (const f of guide.ECHO_DEVICE_FACTS) {
      const p = ECHO_PRODUCTS[f.key];
      expect(p).toBeDefined();
      const u = new URL(echoProductUrl(p, ctx));
      expect(u.hostname).toBe("echowater.com");
      expect(u.searchParams.get("utm_source")).toBe("hydrogenstudies");
      expect(u.searchParams.get("utm_medium")).toBe("referral");
      expect(u.searchParams.get("utm_campaign")).toBe("products");
      expect(u.searchParams.get("utm_content")).toBe("products");
    }
  });

  it("copy makes no disease, cure or treatment claims for any device", () => {
    const copy = JSON.stringify([
      guide.PRODUCTS_SUMMARY, guide.DEVICE_TYPES, guide.CHECKLIST, guide.ECHO_DEVICE_FACTS, guide.ECHO_TESTING_NOTE, guide.PRODUCTS_FAQS,
    ]).toLowerCase();
    for (const term of ["diabetes", "cancer", "alzheimer", "arthritis", "heart disease", "proven to", "cures", "prevents"]) {
      expect(copy).not.toContain(term);
    }
    // The only mention of treating/curing is the warning against such claims.
    expect(copy.match(/treat or cure/g)?.length ?? 0).toBe(1);
  });

  it("FAQ has real questions and answers (FAQPage source = visible accordion)", () => {
    expect(guide.PRODUCTS_FAQS.length).toBeGreaterThanOrEqual(3);
    for (const f of guide.PRODUCTS_FAQS) {
      expect(f.question.endsWith("?")).toBe(true);
      expect(f.answer.length).toBeGreaterThan(60);
    }
  });
});
