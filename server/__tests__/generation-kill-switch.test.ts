/**
 * docs/PLAN.md §2 kill-switch: "Generation stays off: GENERATION_ENABLED=false
 * unless Josh flips it; if on, drafts only." Covers the SEO content factory,
 * keyword-strategy generators and the weekly research digest. Mocked-db unit test.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const selectResults = vi.hoisted(() => [] as unknown[][]);
const insertedValues = vi.hoisted(() => [] as any[]);
const generateJSON = vi.hoisted(() => vi.fn());
const findFirst = vi.hoisted(() => vi.fn());

vi.mock("../db", () => {
  function chain(result: unknown[]): any {
    const p: any = new Proxy(function () {}, {
      get(_t, prop) {
        if (prop === "then") {
          return (resolve: any, reject: any) => Promise.resolve(result).then(resolve, reject);
        }
        if (prop === "values") {
          return (v: any) => {
            insertedValues.push(v);
            return chain([{ id: 99, ...v }]);
          };
        }
        return () => p;
      },
      apply: () => p,
    });
    return p;
  }
  return {
    db: {
      execute: vi.fn(async () => ({ rows: [{ exists: true }] })),
      select: vi.fn(() => chain(selectResults.shift() ?? [])),
      insert: vi.fn(() => chain([])),
      update: vi.fn(() => chain([])),
      query: { researchDigests: { findFirst } },
    },
  };
});

vi.mock("../services/ai-provider", () => ({
  ai: {
    getProviderStatus: () => ({ primary: "anthropic" }),
    generateJSON,
  },
}));

const { generateKeywordPillarPage, generateKeywordClusterPost, generateFullCluster } =
  await import("../services/seo-keyword-strategy");
const { generatePillarPage, saveGeneratedArticle, runContentFactory } =
  await import("../services/seo-content-factory");
const { generateWeeklyDigest } = await import("../services/research-digest-generator");
const { requireGenerationEnabled } = await import("../routes/seo-content-factory-routes");

const cluster = {
  id: 1,
  slug: "hydrogen-water-benefits",
  pillarKeyword: "hydrogen water benefits",
  pillarTitle: "Hydrogen Water Benefits",
  category: "research",
  targetAudience: "general",
  searchIntent: "informational",
  clusterKeywords: JSON.stringify([{ keyword: "k", title: "K", slug: "k", articleType: "guide" }]),
  echoProductReferences: "[]",
  includeProductCTA: false,
};
const longBody = "## Body\n\n" + "Real text. ".repeat(80);

beforeEach(() => {
  selectResults.length = 0;
  insertedValues.length = 0;
  generateJSON.mockReset();
  findFirst.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => {
  delete process.env.GENERATION_ENABLED;
});

describe("GENERATION_ENABLED=false — no model call, no insert", () => {
  beforeEach(() => {
    process.env.GENERATION_ENABLED = "false";
  });

  it("keyword-strategy pillar / cluster post / full cluster", async () => {
    expect((await generateKeywordPillarPage(1)).message).toMatch(/GENERATION_ENABLED=false/);
    expect((await generateKeywordClusterPost(1, 0)).success).toBe(false);
    expect((await generateFullCluster(1, 0)).totalGenerated).toBe(0);
    expect(generateJSON).not.toHaveBeenCalled();
    expect(insertedValues).toHaveLength(0);
  });

  it("content factory pillar / save / run", async () => {
    expect(await generatePillarPage({ condition: "x", slug: "x" } as any)).toBeNull();
    expect(
      await saveGeneratedArticle({ title: "T", slug: "t", content: longBody } as any),
    ).toBeNull();
    expect((await runContentFactory()).pillarsGenerated).toBe(0);
    expect(generateJSON).not.toHaveBeenCalled();
    expect(insertedValues).toHaveLength(0);
  });

  it("weekly digest returns null without touching the db or model", async () => {
    expect(await generateWeeklyDigest()).toBeNull();
    expect(findFirst).not.toHaveBeenCalled();
    expect(generateJSON).not.toHaveBeenCalled();
    expect(insertedValues).toHaveLength(0);
  });

  it("admin route gate answers 409", () => {
    const res: any = { status: vi.fn(() => res), json: vi.fn(() => res) };
    const next = vi.fn();
    requireGenerationEnabled({} as any, res, next);
    expect(res.status).toHaveBeenCalledWith(409);
    expect(next).not.toHaveBeenCalled();
  });
});

describe("generation on — drafts only", () => {
  it("keyword pillar inserts isPublished:false", async () => {
    selectResults.push([cluster], [], []);
    generateJSON.mockResolvedValue({ title: "T", content: longBody });
    const r = await generateKeywordPillarPage(1);
    expect(r.success).toBe(true);
    expect(insertedValues[0].isPublished).toBe(false);
  });

  it("keyword cluster post inserts isPublished:false", async () => {
    selectResults.push([cluster], [], []);
    generateJSON.mockResolvedValue({ title: "T", content: longBody });
    const r = await generateKeywordClusterPost(1, 0);
    expect(r.success).toBe(true);
    expect(insertedValues[0].isPublished).toBe(false);
  });

  it("content factory saveGeneratedArticle inserts isPublished:false", async () => {
    selectResults.push([]); // no existing slug
    const id = await saveGeneratedArticle({ title: "T", slug: "t", content: longBody } as any);
    expect(id).toBe(99);
    expect(insertedValues[0].isPublished).toBe(false);
  });

  it("the canned empty-week digest is never published", async () => {
    findFirst.mockResolvedValue(null);
    selectResults.push([]); // no studies this week
    const d = await generateWeeklyDigest();
    expect(generateJSON).not.toHaveBeenCalled();
    expect(insertedValues[0].isPublished).toBe(false);
    expect(d?.isPublished).toBe(false);
  });

  it("an AI-written digest is saved as a draft", async () => {
    findFirst.mockResolvedValue(null);
    selectResults.push([{ id: 5, title: "S", category: "General" }]);
    generateJSON.mockResolvedValue({
      title: "D", narrative: "<p>x</p>", trendingTopics: [], notableFindings: [],
      metaTitle: "m", metaDescription: "m",
    });
    await generateWeeklyDigest();
    expect(generateJSON).toHaveBeenCalledTimes(1);
    expect(insertedValues[0].isPublished).toBe(false);
    expect(insertedValues[0].publishedAt).toBeUndefined();
  });
});
