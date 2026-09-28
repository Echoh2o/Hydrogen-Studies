/**
 * Public study API endpoints answer 410 for excluded (off-topic
 * hydrogen-energy) studies; admins/editors still get the row.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

const elevated = vi.hoisted(() => ({ value: false }));
const getStudiesSpy = vi.hoisted(() => vi.fn(async (_f: any) => ({ data: [], total: 0, page: 1, pageSize: 20, pageCount: 0 })));

const EXCLUDED = { id: 4298, slug: "kitchen-wastewater-bioenergy-1788216910213", title: "Energy", category: "General", isExcluded: true };
const LIVE = { id: 12, slug: "hydrogen-rich-water-sleep-12", title: "Sleep", category: "Sleep", isExcluded: false };

vi.mock("../services/study-service", () => ({
  studyService: {
    getStudyById: async (id: number) => (id === EXCLUDED.id ? EXCLUDED : id === LIVE.id ? LIVE : undefined),
    getStudyBySlug: async (slug: string) => (slug === EXCLUDED.slug ? EXCLUDED : slug === LIVE.slug ? LIVE : undefined),
    getRelatedStudies: async () => [],
    getStudyInsights: async () => null,
    getStudies: getStudiesSpy,
  },
}));
vi.mock("../auth", () => ({
  requireAdmin: (_req: any, _res: any, next: any) => next(),
  isElevatedRequest: async () => elevated.value,
}));
vi.mock("../services/recommendation-engine", () => ({
  getPersonalizedRecommendations: async () => ({ recommendations: [] }),
}));
vi.mock("../middleware/seo-bot-middleware", () => ({ invalidateBotCache: () => {} }));
vi.mock("../db", () => ({ db: {}, pool: { query: async () => ({ rows: [] }) } }));

const { studiesController } = await import("../controllers/studies-controller");

function makeApp() {
  const app = express();
  app.use("/api/studies", studiesController.router);
  return app;
}

beforeEach(() => {
  elevated.value = false;
  getStudiesSpy.mockClear();
});

describe("public study endpoints gate excluded studies", () => {
  it.each([
    `/api/studies/slug/${EXCLUDED.slug}`,
    `/api/studies/${EXCLUDED.id}`,
    `/api/studies/${EXCLUDED.id}/detailed`,
    `/api/studies/metadata/related/${EXCLUDED.id}`,
    `/api/studies/${EXCLUDED.id}/recommendations`,
    `/api/studies/${EXCLUDED.id}/insights`,
  ])("GET %s → 410 for the public", async (path) => {
    const res = await request(makeApp()).get(path);
    expect(res.status).toBe(410);
    expect(res.body.gone).toBe(true);
  });

  it("live studies are unaffected", async () => {
    expect((await request(makeApp()).get(`/api/studies/slug/${LIVE.slug}`)).status).toBe(200);
    expect((await request(makeApp()).get(`/api/studies/${LIVE.id}`)).status).toBe(200);
  });

  it("admins/editors still get the excluded row (editor, deletion flows)", async () => {
    elevated.value = true;
    const res = await request(makeApp()).get(`/api/studies/${EXCLUDED.id}`);
    expect(res.status).toBe(200);
    expect(res.body.isExcluded).toBe(true);
  });

  it("the public listing can never opt in to excluded studies", async () => {
    await request(makeApp()).get("/api/studies?includeExcluded=true");
    expect(getStudiesSpy.mock.calls[0][0]).toMatchObject({ includeExcluded: false });
  });

  it("an admin listing can opt in explicitly", async () => {
    elevated.value = true;
    await request(makeApp()).get("/api/studies?includeExcluded=true");
    expect(getStudiesSpy.mock.calls[0][0]).toMatchObject({ includeExcluded: true });
  });
});
