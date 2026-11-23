/**
 * CLAUDE.md: public JSON never carries a full publisher abstract — the
 * ≤300-char excerpt replaces it under the same field name. Admins (the admin
 * UI loads and saves studies through these same endpoints) get the full text.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

const admin = vi.hoisted(() => ({ value: false }));
const updateSpy = vi.hoisted(() => vi.fn(async (_id: number, data: any) => ({ id: 12, slug: "s", ...data })));

const LONG_ABSTRACT = `Background: ${"molecular hydrogen was studied in adults ".repeat(40)}UNIQUE-TAIL.`;
const STUDY = {
  id: 12,
  slug: "hydrogen-rich-water-sleep-12",
  title: "Sleep",
  category: "Sleep",
  isExcluded: false,
  pmid: "12345678",
  doi: "10.1000/x",
  journal: "J",
  authors: "A. One",
  abstract: LONG_ABSTRACT,
  fullText: "Full paper body",
  methods: "m",
  results: "r",
  conclusion: "c",
  keywords: [],
};

vi.mock("../services/study-service", () => ({
  studyService: {
    getStudyById: async (id: number) => (id === STUDY.id ? { ...STUDY } : undefined),
    getStudyBySlug: async (slug: string) => (slug === STUDY.slug ? { ...STUDY } : undefined),
    getLatestStudies: async () => [{ ...STUDY }],
    getRelatedStudies: async () => [{ ...STUDY, id: 13 }],
    getStudies: async () => ({ data: [{ ...STUDY }], total: 1, page: 1, pageSize: 20, pageCount: 1 }),
    updateStudy: updateSpy,
  },
}));
vi.mock("../auth", () => ({
  requireAdmin: (_req: any, _res: any, next: any) => next(),
  isElevatedRequest: async () => admin.value,
  isAdminRequest: async () => admin.value,
}));
vi.mock("../services/recommendation-engine", () => ({
  getPersonalizedRecommendations: async () => ({ recommendations: [] }),
}));
vi.mock("../services/web-revalidate", () => ({ notifyWebRevalidate: () => {} }));
vi.mock("../db", () => ({ db: {}, pool: { query: async () => ({ rows: [] }) } }));

const { publicStudy, publicAbstracts, publicAbstractsJson, resolveAbstractAccess, isExcerptOfStored } = await import(
  "../middleware/public-abstracts"
);
const { abstractExcerpt } = await import("@shared/seo-markup");
const { studiesController } = await import("../controllers/studies-controller");

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use(publicAbstractsJson); // as in server/app.ts: before every router…
  app.use(resolveAbstractAccess); // …and the access check after the session
  app.use("/api/studies", studiesController.router);
  return app;
}

beforeEach(() => {
  admin.value = false;
  updateSpy.mockClear();
});

describe("publicStudy / publicAbstracts", () => {
  it("non-admins get a ≤300-char excerpt under the same field name", () => {
    const out = publicStudy(STUDY);
    expect(out.abstract.length).toBeLessThanOrEqual(300);
    expect(out.abstract).toBe(abstractExcerpt(LONG_ABSTRACT));
    expect(out.abstract).not.toContain("UNIQUE-TAIL");
    expect(out.fullText).toBeNull();
    expect(out.title).toBe("Sleep");
  });

  it("admins get the full abstract, untouched", () => {
    expect(publicStudy(STUDY, true)).toBe(STUDY);
    expect(publicAbstracts({ data: [STUDY] }, true).data[0].abstract).toBe(LONG_ABSTRACT);
  });

  it("null stays null; placeholders become null; short abstracts pass", () => {
    expect(publicStudy({ ...STUDY, abstract: null }).abstract).toBeNull();
    expect(publicStudy({ ...STUDY, abstract: "No abstract available." }).abstract).toBeNull();
    expect(publicStudy({ ...STUDY, abstract: "Short abstract." }).abstract).toBe("Short abstract.");
  });

  it("walks nested bodies without mutating the source", () => {
    const body = { results: [{ study: STUDY, score: 1 }], meta: { n: 1 }, when: new Date(0) };
    const out = publicAbstracts(body);
    expect(out.results[0].study.abstract.length).toBeLessThanOrEqual(300);
    expect(STUDY.abstract).toBe(LONG_ABSTRACT);
    expect(out.meta).toBe(body.meta); // untouched branches are not copied
    expect(out.when).toBeInstanceOf(Date);
  });

  it("leaves our own scientific-article abstracts alone", () => {
    const article = { id: 1, articleType: "comprehensive_review", abstract: LONG_ABSTRACT };
    expect(publicAbstracts(article)).toBe(article);
  });

  it("isExcerptOfStored spots an excerpt sent back as an edit", () => {
    expect(isExcerptOfStored(abstractExcerpt(LONG_ABSTRACT), LONG_ABSTRACT)).toBe(true);
    expect(isExcerptOfStored(LONG_ABSTRACT, LONG_ABSTRACT)).toBe(false);
    expect(isExcerptOfStored("A genuinely new abstract.", LONG_ABSTRACT)).toBe(false);
    expect(isExcerptOfStored("Short abstract.", "Short abstract.")).toBe(false);
  });
});

describe("public study endpoints", () => {
  it.each([
    `/api/studies/${STUDY.id}`,
    `/api/studies/${STUDY.id}/detailed`,
    `/api/studies/slug/${STUDY.slug}`,
    "/api/studies/latest?limit=1",
    `/api/studies/metadata/related/${STUDY.id}`,
    "/api/studies?page=1",
  ])("GET %s returns the excerpt to the public", async (path) => {
    const res = await request(makeApp()).get(path);
    expect(res.status).toBe(200);
    const text = JSON.stringify(res.body);
    expect(text).not.toContain("UNIQUE-TAIL");
    expect(text).not.toContain("Full paper body");
    expect(text).toContain(abstractExcerpt(LONG_ABSTRACT).slice(0, 80));
  });

  it("admins get the full abstract, never shared-cached", async () => {
    admin.value = true;
    const res = await request(makeApp()).get(`/api/studies/${STUDY.id}`);
    expect(res.body.abstract).toBe(LONG_ABSTRACT);
    expect(res.headers["cache-control"]).toBe("private, no-store");
  });

  it("PUT ignores an abstract that is only the public excerpt of the stored one", async () => {
    admin.value = true;
    await request(makeApp())
      .put(`/api/studies/${STUDY.id}`)
      .send({ title: "New title", abstract: abstractExcerpt(LONG_ABSTRACT) });
    expect(updateSpy).toHaveBeenCalledTimes(1);
    expect(updateSpy.mock.calls[0][1]).toEqual({ title: "New title" });
  });

  it("PUT still saves a real abstract edit", async () => {
    admin.value = true;
    await request(makeApp()).put(`/api/studies/${STUDY.id}`).send({ abstract: "A genuinely new abstract text." });
    expect(updateSpy.mock.calls[0][1]).toEqual({ abstract: "A genuinely new abstract text." });
  });
});
