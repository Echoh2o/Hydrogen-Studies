/**
 * Page-data API for the Next.js front door (web/). Express stays the source
 * of truth for redirects/410s and never ships a full abstract.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

const state = vi.hoisted(() => ({
  decision: null as any,
  excluded: false,
  study: null as any,
}));

vi.mock("../services/redirect-service", () => ({ resolveRedirect: async () => state.decision }));
vi.mock("../services/excluded-studies", () => ({ isExcludedStudyPath: async () => state.excluded }));
vi.mock("../services/study-service", () => ({
  studyService: {
    getStudyBySlug: async () => state.study,
    getStudyById: async () => state.study,
  },
}));
vi.mock("../middleware/seo-body-renderer", () => ({
  getConditionHubs: async () => [{ slug: "kidney-health", name: "Kidney Health" }],
  getRelatedStudies: async () => [{ slug: "r1", title: "Related", year: 2024 }],
  getRelatedBlogs: async () => [],
  getTopConditions: async () => [{ slug: "kidney-health", name: "Kidney Health" }],
}));
vi.mock("../utils/logger", () => ({ logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() } }));

const { default: router } = await import("../routes/page-data-routes");
const app = express();
app.use("/api/page-data", router);

const LONG_ABSTRACT = "Background: ".padEnd(900, "x") + " UNIQUE-TAIL";

describe("GET /api/page-data/route-status", () => {
  beforeEach(() => {
    state.decision = null;
    state.excluded = false;
  });

  it("passes redirects through", async () => {
    state.decision = { kind: "redirect", status: 301, location: "/blog/new" };
    const res = await request(app).get("/api/page-data/route-status?path=/blog/old");
    expect(res.body).toEqual({ kind: "redirect", status: 301, location: "/blog/new" });
  });

  it("answers gone for 410 rows and excluded studies", async () => {
    state.decision = { kind: "gone", id: 1 };
    expect((await request(app).get("/api/page-data/route-status?path=/blog/x")).body).toEqual({ kind: "gone" });
    state.decision = null;
    state.excluded = true;
    expect((await request(app).get("/api/page-data/route-status?path=/study/x")).body).toEqual({ kind: "gone" });
  });

  it("is ok otherwise and rejects relative paths", async () => {
    expect((await request(app).get("/api/page-data/route-status?path=/study/x")).body).toEqual({ kind: "ok" });
    expect((await request(app).get("/api/page-data/route-status?path=study")).status).toBe(400);
  });
});

describe("GET /api/page-data/study/:slug", () => {
  it("404s unknown and 410s excluded studies", async () => {
    state.study = null;
    expect((await request(app).get("/api/page-data/study/nope")).status).toBe(404);
    state.study = { id: 1, slug: "s", title: "T", isExcluded: true };
    expect((await request(app).get("/api/page-data/study/s")).status).toBe(410);
  });

  it("returns the excerpt (never the full abstract), hub links and related studies", async () => {
    state.study = {
      id: 1,
      slug: "s",
      title: "T",
      isExcluded: false,
      abstract: LONG_ABSTRACT,
      pmid: "38000001",
      healthConditions: ["Kidney Health"],
      bodySystems: [],
      keyFinding: "__no_content__",
    };
    const res = await request(app).get("/api/page-data/study/s");
    expect(res.status).toBe(200);
    expect(JSON.stringify(res.body)).not.toContain("UNIQUE-TAIL");
    expect(res.body.study.abstract).toBeUndefined();
    expect(res.body.study.abstractExcerpt.length).toBeLessThanOrEqual(300);
    expect(res.body.study.keyFinding).toBeFalsy();
    expect(res.body.study.sourceLink.href).toBe("https://pubmed.ncbi.nlm.nih.gov/38000001/");
    expect(res.body.hubLinks).toEqual([{ label: "Kidney Health", href: "/explore-by-condition/kidney-health" }]);
    expect(res.body.related).toHaveLength(1);
  });
});
