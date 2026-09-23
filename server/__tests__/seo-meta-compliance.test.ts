/**
 * Bot <head> meta — markup compliance (PR A, audit 2026-09-23):
 *   #1 no FAQPage on study pages; blog FAQPage only when the Q&As are visible
 *   #2 study JSON-LD carries no full abstract
 *   #7 per-route meta (no homepage FALLBACK) for /hydrogen-for/*, /insights,
 *      /research-analytics
 *   #11 titles ≤ 65 chars, no mid-word "…"
 *   #12 Article JSON-LD author/dateModified/reviewedBy mirror the byline
 */
import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import express from "express";
import request from "supertest";
import fs from "fs";
import os from "os";
import path from "path";

vi.mock("../db", () => ({ db: {}, pool: { query: () => new Promise(() => {}) } }));
vi.mock("../middleware/seo-body-renderer", () => ({
  renderPageBody: async () => "<h1>Rendered body</h1>",
}));

import {
  buildBlogMeta,
  buildStudyMeta,
  resolveStaticPageMeta,
  seoBotMiddleware,
} from "../middleware/seo-bot-middleware";

const LONG_ABSTRACT =
  "Background: Molecular hydrogen has been proposed as a selective antioxidant. " +
  "Methods: In this randomized, double-blind, placebo-controlled trial, 120 healthy adults consumed 1.5 L/day of hydrogen-rich water or placebo water for 8 weeks. " +
  "Results: Hydrogen-rich water reduced urinary 8-OHdG by 14% and serum MDA by 9% compared with placebo, with no adverse events. " +
  "Conclusions: Daily intake of hydrogen-rich water may reduce oxidative stress biomarkers in healthy adults; UNIQUE-TAIL-MARKER.";

const asArray = (ld: unknown) => (Array.isArray(ld) ? ld : [ld]) as any[];

describe("#1/#2/#11 study meta", () => {
  const study = {
    id: 3,
    slug: "h2-fatigue",
    title:
      "Effects of Hydrogen-Rich Water on Fatigue and Oxidative Stress Biomarkers in Healthy Adults: A Randomized Controlled Trial",
    plainLanguageTitle: null,
    abstract: LONG_ABSTRACT,
    authors: "A. One, B. Two",
    doi: "10.1000/x",
    questionAnswerPairs: JSON.stringify([{ question: "Q1?", answer: "A1" }, { q: "Q2?", a: "A2" }]),
    lastModified: new Date("2026-09-01T00:00:00Z"),
  };

  it("never emits FAQPage (no visible FAQ on study pages)", () => {
    const meta = buildStudyMeta(study);
    const types = asArray(meta.jsonLd).map((ld) => ld["@type"]);
    expect(types).toEqual(["MedicalScholarlyArticle"]);
    expect(JSON.stringify(meta.jsonLd)).not.toContain("FAQPage");
  });

  it("JSON-LD has no abstract field and never the full abstract text", () => {
    const ld = asArray(buildStudyMeta(study).jsonLd)[0];
    expect(ld.abstract).toBeUndefined();
    expect(JSON.stringify(ld)).not.toContain("UNIQUE-TAIL-MARKER");
    expect(ld.description.length).toBeLessThanOrEqual(300);
    expect(ld.dateModified).toBe("2026-09-01T00:00:00.000Z");
  });

  it("title ≤ 65 chars, word boundary, no ellipsis; description ≤ 160", () => {
    const meta = buildStudyMeta(study);
    expect(meta.title.length).toBeLessThanOrEqual(65);
    expect(meta.title).not.toMatch(/…|\.\.\./);
    expect(study.title.startsWith(meta.title)).toBe(true);
    expect(meta.description.length).toBeLessThanOrEqual(160);
  });

  it("prefers metaTitle when set", () => {
    expect(buildStudyMeta({ ...study, metaTitle: "Hydrogen Water and Fatigue" }).title)
      .toBe("Hydrogen Water and Fatigue | Hydrogen Studies");
  });
});

describe("#1/#11/#12 blog meta", () => {
  const blog = {
    id: 1,
    slug: "h2-sleep",
    title: "Does Hydrogen Water Improve Sleep Quality? What the Clinical Research Actually Shows",
    summary: "A look at the evidence.",
    content: "## Intro\n\nText.\n\n## FAQ\n\n### Is hydrogen water safe?\n\nGenerally.\n",
    questionAnswerPairs: JSON.stringify([
      { question: "Is hydrogen water safe?", answer: "Generally." },
      { question: "Hidden question never shown on the page?", answer: "x" },
    ]),
    createdAt: new Date("2026-02-01T00:00:00Z"),
    updatedAt: new Date("2026-09-02T00:00:00Z"),
    lastReviewed: new Date("2026-02-01T00:00:00Z"), // machine-stamped
    authorName: null,
    reviewerName: null,
  };

  it("omits FAQPage when any stored question is not visible", () => {
    const types = asArray(buildBlogMeta(blog).jsonLd).map((ld) => ld["@type"]);
    expect(types).toEqual(["Article"]);
  });

  it("emits FAQPage when every question is visible in the rendered body", () => {
    const visible = {
      ...blog,
      questionAnswerPairs: JSON.stringify([{ question: "Is hydrogen water safe?", answer: "Generally." }]),
    };
    const types = asArray(buildBlogMeta(visible).jsonLd).map((ld) => ld["@type"]);
    expect(types).toEqual(["Article", "FAQPage"]);
  });

  it("Article author/dateModified mirror the visible byline; no reviewedBy without a reviewer", () => {
    const ld = asArray(buildBlogMeta(blog).jsonLd)[0];
    expect(ld.author).toEqual({
      "@type": "Organization",
      name: "Hydrogen Studies Editorial Team",
      url: "https://hydrogenstudies.com/editorial-policy",
    });
    expect(ld.dateModified).toBe("2026-09-02T00:00:00.000Z");
    expect(JSON.stringify(ld)).not.toContain("reviewedBy");
  });

  it("adds reviewedBy (on the WebPage) only when a reviewer is named", () => {
    const ld = asArray(buildBlogMeta({ ...blog, reviewerName: "John Doe, PhD" }).jsonLd)[0];
    expect(ld.mainEntityOfPage.reviewedBy).toEqual({ "@type": "Person", name: "John Doe, PhD" });
  });

  it("title never ends mid-word with an ellipsis", () => {
    const meta = buildBlogMeta(blog);
    expect(meta.title.length).toBeLessThanOrEqual(65);
    expect(meta.title).not.toMatch(/…|\.\.\./);
    expect(blog.title.startsWith(meta.title)).toBe(true);
  });
});

describe("#7 per-route static meta", () => {
  it.each([
    "/hydrogen-for/heart-disease", "/hydrogen-for/diabetes", "/hydrogen-for/brain-health",
    "/hydrogen-for/inflammation", "/hydrogen-for/cancer-support", "/hydrogen-for/athletic-performance",
    "/hydrogen-for/skin-health", "/hydrogen-for/gut-health", "/hydrogen-for/kidney-health",
    "/hydrogen-for/lung-health", "/insights", "/research-analytics", "/hydrogen-therapy-guide",
  ])("%s has its own title/description/self-canonical", (p) => {
    const meta = resolveStaticPageMeta(p)!;
    expect(meta).not.toBeNull();
    expect(meta.title).not.toBe("Hydrogen Studies | Hydrogen Studies Research Database");
    expect(meta.title.length).toBeLessThanOrEqual(60);
    expect(meta.description.length).toBeGreaterThanOrEqual(140);
    expect(meta.description.length).toBeLessThanOrEqual(160);
    expect(meta.canonical).toBe(`https://hydrogenstudies.com${p}`);
  });

  it("hydrogen-for meta carries FAQPage (the FAQ is rendered visibly)", () => {
    const ld = resolveStaticPageMeta("/hydrogen-for/diabetes")!.jsonLd as any;
    expect(ld["@type"]).toBe("FAQPage");
    expect(ld.mainEntity[0].name).toBe("Can hydrogen water help manage diabetes?");
  });

  it("unknown hydrogen-for slug has no meta", () => {
    expect(resolveStaticPageMeta("/hydrogen-for/not-a-topic")).toBeNull();
  });
});

describe("#7 middleware serves resolved meta, not FALLBACK", () => {
  let staticDir: string;
  let app: express.Express;
  const GOOGLEBOT = "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)";

  beforeAll(() => {
    staticDir = fs.mkdtempSync(path.join(os.tmpdir(), "seo-meta-test-"));
    fs.writeFileSync(
      path.join(staticDir, "index.html"),
      `<!doctype html><html><head><title>x</title></head><body><div id="root"></div></body></html>`,
    );
    app = express();
    app.use(seoBotMiddleware(staticDir));
    app.get(/.*/, (_req, res) => res.send("SPA"));
  });

  afterAll(() => fs.rmSync(staticDir, { recursive: true, force: true }));

  it.each(["/hydrogen-for/diabetes", "/insights", "/research-analytics"])("%s", async (p) => {
    const res = await request(app).get(p).set("User-Agent", GOOGLEBOT);
    expect(res.status).toBe(200);
    expect(res.headers["x-bot-cache"]).not.toBe("FALLBACK");
    expect(res.text).not.toContain("<title>Hydrogen Studies | Hydrogen Studies Research Database</title>");
    expect(res.text).toContain(`<link rel="canonical" href="https://hydrogenstudies.com${p}" />`);
    expect(res.text).toContain('<link rel="icon" href="/favicon.ico" sizes="48x48" />');
  });
});
