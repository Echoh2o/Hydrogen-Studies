/**
 * Citation build (Job 8) must not rerun on every deploy: its weekly last-run
 * lives in memory, so on the first run after boot it seeds that from the DB
 * (max created_at of study_citations). Sentry SERVER-9.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const builder = vi.hoisted(() => ({
  buildCitationNetwork: vi.fn(async () => ({ studiesProcessed: 0, totalOutgoing: 0, totalIncoming: 0 })),
  getLastCitationBuildAt: vi.fn(async (): Promise<Date | null> => null),
}));

vi.mock("../services/citation-network-builder", () => builder);
vi.mock("../services/keyword-monitor-service", () => ({ checkScheduledSearches: vi.fn() }));
vi.mock("../services/targeted-enrichment", () => ({ checkAndEnrichStudies: vi.fn() }));
vi.mock("../services/retraction-monitor", () => ({ batchRetractionCheck: vi.fn() }));
vi.mock("../services/internal-linking-engine", () => ({ buildAllStudyLinks: vi.fn(), buildAllBlogLinks: vi.fn() }));
vi.mock("../services/blog-generator-enhanced", () => ({ generateBlogArticlesForStudy: vi.fn() }));
vi.mock("../services/crossref-api", () => ({ getCrossRefArticleByDOI: vi.fn() }));
vi.mock("../db", () => ({ db: {}, pool: {} }));
vi.mock("../utils/advisory-lock", () => ({ withAdvisoryLock: (_k: string, fn: () => unknown) => fn() }));
vi.mock("../utils/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));

const { JobScheduler } = await import("../services/job-scheduler");

const DAY = 24 * 60 * 60 * 1000;

function freshScheduler(): any {
  // Bypass the singleton so each test starts with empty in-memory state.
  const Ctor: any = JobScheduler;
  return new Ctor();
}

describe("citation-build boot skip", () => {
  beforeEach(() => {
    builder.buildCitationNetwork.mockClear();
    builder.getLastCitationBuildAt.mockReset();
  });

  it("skips on first run after boot when the DB shows a run within 7 days", async () => {
    const last = new Date(Date.now() - 2 * DAY);
    builder.getLastCitationBuildAt.mockResolvedValue(last);
    const s = freshScheduler();

    await s.runCitationBuildJob();

    expect(builder.buildCitationNetwork).not.toHaveBeenCalled();
    expect(s.lastCitationBuildCheck).toEqual(last);

    // Subsequent ticks stay skipped (in-memory now seeded), no extra DB reads.
    await s.runCitationBuildJob();
    expect(builder.buildCitationNetwork).not.toHaveBeenCalled();
    expect(builder.getLastCitationBuildAt).toHaveBeenCalledTimes(1);
  });

  it("runs when the last DB run is older than 7 days", async () => {
    builder.getLastCitationBuildAt.mockResolvedValue(new Date(Date.now() - 8 * DAY));
    const s = freshScheduler();

    await s.runCitationBuildJob();

    expect(builder.buildCitationNetwork).toHaveBeenCalledTimes(1);
  });

  it("runs when there is no DB signal (empty table / query failure)", async () => {
    builder.getLastCitationBuildAt.mockResolvedValue(null);
    const s = freshScheduler();

    await s.runCitationBuildJob();

    expect(builder.buildCitationNetwork).toHaveBeenCalledTimes(1);
  });
});
