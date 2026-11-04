/**
 * Page meta for every public path — what the Next front door and the SPA
 * shell put in <head>. Pure of HTTP: no user agents, no caches (PLAN 3.4).
 */
import { describe, it, expect, vi } from "vitest";

vi.mock("../db", () => ({
  db: { select: () => ({ from: () => ({ where: () => ({ limit: async () => [] }) }) }) },
  pool: { query: () => new Promise(() => {}) },
}));
vi.mock("../middleware/seo-body-renderer", () => ({ getConditionHubs: async () => [] }));
vi.mock("../utils/logger", () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));

const { buildStudyMeta, buildBlogMeta, resolveStaticPageMeta, resolvePageMeta, isContentPath } = await import(
  "../services/page-meta"
);

describe("buildStudyMeta", () => {
  it("canonical is always on hydrogenstudies.com and og:image is absolute", () => {
    const meta = buildStudyMeta({ id: 1, slug: "a-study-pmid-123", title: "A Study", imageUrl: "uploads/x.png" });
    expect(meta.canonical).toBe("https://hydrogenstudies.com/study/a-study-pmid-123");
    expect(meta.ogImage).toBe("https://hydrogenstudies.com/uploads/x.png");
    expect((meta.jsonLd as any)["@type"]).toBe("MedicalWebPage");
    expect((meta.jsonLd as any).image).toBe("https://hydrogenstudies.com/uploads/x.png");
  });
});

describe("buildBlogMeta", () => {
  it("emits Article only — no FAQPage when the Q&As are not in the body", () => {
    const meta = buildBlogMeta({
      slug: "p",
      title: "P",
      content: "<p>body</p>",
      questionAnswerPairs: [{ question: "Hidden?", answer: "Yes" }],
    });
    const types = (meta.jsonLd as any[]).map((b) => b["@type"]);
    expect(types).toEqual(["Article", "BreadcrumbList"]);
    expect(meta.canonical).toBe("https://hydrogenstudies.com/blog/p");
  });
});

describe("resolveStaticPageMeta", () => {
  it("noindexes /learn and the search pages; indexes hubs", () => {
    expect(resolveStaticPageMeta("/learn/basics")!.robots).toBe("noindex, follow");
    expect(resolveStaticPageMeta("/learn")!.robots).toBe("noindex, follow");
    expect(resolveStaticPageMeta("/learn")!.title).toBe("Learn About Molecular Hydrogen | Hydrogen Studies");
    expect(resolveStaticPageMeta("/learn")!.jsonLd).toBeUndefined();
    expect(resolveStaticPageMeta("/search")!.robots).toBe("noindex, follow");
    expect(resolveStaticPageMeta("/explore-by-condition")!.robots).toBeUndefined();
    expect(resolveStaticPageMeta("/researchers")!.robots).toBeUndefined();
    expect(resolveStaticPageMeta("/limits-of-the-evidence")!.robots).toBeUndefined();
    expect(resolveStaticPageMeta("/null-and-negative-results")!.title.length).toBeLessThanOrEqual(65);
    expect(resolveStaticPageMeta("/dataset")!.title.length).toBeLessThanOrEqual(65);
    expect(resolveStaticPageMeta("/state-of-hydrogen-research")!.title.length).toBeLessThanOrEqual(65);
    expect(resolveStaticPageMeta("/researchers")!.title).toBe("Researchers Publishing on Molecular Hydrogen | Hydrogen Studies");
  });

  it("condition hubs are canonical on hydrogenstudies.com (no cross-domain canonical)", () => {
    expect(resolveStaticPageMeta("/explore-by-condition/type-2-diabetes")!.canonical).toBe(
      "https://hydrogenstudies.com/explore-by-condition/type-2-diabetes",
    );
    expect(resolveStaticPageMeta("/explore-by-condition/blood-pressure")!.canonical).toBe(
      "https://hydrogenstudies.com/explore-by-condition/blood-pressure",
    );
  });

  it("unknown paths and unknown hydrogen-for topics have no meta", () => {
    expect(resolveStaticPageMeta("/nope")).toBeNull();
    expect(resolveStaticPageMeta("/hydrogen-for/not-a-topic")).toBeNull();
  });
});

describe("resolvePageMeta", () => {
  it("falls through to static meta, and returns null for a content path with no row", async () => {
    expect((await resolvePageMeta("/about"))!.title).toContain("About");
    expect(await resolvePageMeta("/study/no-such-slug")).toBeNull();
    expect(await resolvePageMeta("/blog/no-such-slug")).toBeNull();
  });
});

describe("isContentPath", () => {
  it("is true only for DB-backed study/blog paths", () => {
    expect(isContentPath("/study/x")).toBe(true);
    expect(isContentPath("/studies/x")).toBe(true);
    expect(isContentPath("/blog/x")).toBe(true);
    expect(isContentPath("/studies/tags")).toBe(false);
    expect(isContentPath("/about")).toBe(false);
  });
});
