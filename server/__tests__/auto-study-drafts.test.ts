/**
 * Automatic blog drafts on study upload are OFF by default (2026-10-30: bulk
 * per-study drafts read as SEO spam). Locks in the flag semantics and that the
 * content-queue waterfall's "blogs" step never calls the generator when off.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const generateBlogArticlesForStudy = vi.fn(async () => ({ articles: [], errors: [] }));
vi.mock("../services/blog-generator-enhanced", () => ({ generateBlogArticlesForStudy }));
vi.mock("../services/study-service", () => ({
  studyService: { getStudyById: vi.fn(async (id: number) => ({ id, title: "t" })) },
}));
vi.mock("../db", () => ({ db: {} }));
vi.mock("../utils/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const { autoStudyBlogDraftsEnabled } = await import("../utils/generation-flags");
const { executeStep } = await import("../services/content-generation-worker");

const saved = { ...process.env };

describe("automatic study blog drafts", () => {
  beforeEach(() => {
    delete process.env.AUTO_STUDY_BLOG_DRAFTS;
    delete process.env.GENERATION_ENABLED;
    generateBlogArticlesForStudy.mockClear();
  });
  afterEach(() => {
    process.env = { ...saved };
  });

  it("is off by default", () => {
    expect(autoStudyBlogDraftsEnabled()).toBe(false);
  });

  it("turns on only with AUTO_STUDY_BLOG_DRAFTS=true", () => {
    process.env.AUTO_STUDY_BLOG_DRAFTS = "true";
    expect(autoStudyBlogDraftsEnabled()).toBe(true);
    process.env.AUTO_STUDY_BLOG_DRAFTS = "1";
    expect(autoStudyBlogDraftsEnabled()).toBe(false);
  });

  it("GENERATION_ENABLED=false (the PLAN.md kill-switch) wins over the opt-in", () => {
    process.env.AUTO_STUDY_BLOG_DRAFTS = "true";
    process.env.GENERATION_ENABLED = "false";
    expect(autoStudyBlogDraftsEnabled()).toBe(false);
  });

  it("waterfall 'blogs' step does not generate drafts when off", async () => {
    await executeStep("blogs", 4300);
    expect(generateBlogArticlesForStudy).not.toHaveBeenCalled();
  });

  it("waterfall 'blogs' step generates drafts when opted in", async () => {
    process.env.AUTO_STUDY_BLOG_DRAFTS = "true";
    await executeStep("blogs", 4300);
    expect(generateBlogArticlesForStudy).toHaveBeenCalledOnce();
  });
});
