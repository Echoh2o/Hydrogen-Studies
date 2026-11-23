/**
 * generateKeywordPillarPage must never insert a pillar whose body is empty or
 * whitespace (matches the cluster-post guard). Mocked-db unit test.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const selectResults = vi.hoisted(() => [] as unknown[][]);
const insertSpy = vi.hoisted(() => vi.fn());
const generateJSON = vi.hoisted(() => vi.fn());

vi.mock("../db", () => {
  function chain(result: unknown[]): any {
    const p: any = new Proxy(function () {}, {
      get(_t, prop) {
        if (prop === "then") {
          return (resolve: any, reject: any) => Promise.resolve(result).then(resolve, reject);
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
      insert: vi.fn((...args: unknown[]) => {
        insertSpy(...args);
        return chain([{ id: 99 }]);
      }),
      update: vi.fn(() => chain([])),
    },
  };
});

vi.mock("../services/ai-provider", () => ({
  ai: {
    getProviderStatus: () => ({ primary: "anthropic" }),
    generateJSON,
  },
}));

const { generateKeywordPillarPage } = await import("../services/seo-keyword-strategy");

const cluster = {
  id: 1,
  slug: "hydrogen-water-benefits",
  pillarKeyword: "hydrogen water benefits",
  pillarTitle: "Hydrogen Water Benefits",
  category: "research",
  targetAudience: "general",
  searchIntent: "informational",
  clusterKeywords: "[]",
  echoProductReferences: "[]",
  includeProductCTA: false,
};

describe("generateKeywordPillarPage empty-body guard", () => {
  beforeEach(() => {
    selectResults.length = 0;
    insertSpy.mockReset();
    generateJSON.mockReset();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  for (const content of ["", "   \n\t ", undefined]) {
    it(`does not insert when content is ${JSON.stringify(content)}`, async () => {
      // cluster lookup, related studies, existing-slug check
      selectResults.push([cluster], [], []);
      generateJSON.mockResolvedValue({ title: "T", content });

      const result = await generateKeywordPillarPage(1);

      expect(result.success).toBe(false);
      expect(result.message).toMatch(/no content/);
      expect(insertSpy).not.toHaveBeenCalled();
    });
  }

  it("still inserts when content is present", async () => {
    selectResults.push([cluster], [], []);
    generateJSON.mockResolvedValue({ title: "T", content: "## Real body\n\nText." });

    const result = await generateKeywordPillarPage(1);

    expect(result.success).toBe(true);
    expect(insertSpy).toHaveBeenCalledTimes(1);
  });
});
