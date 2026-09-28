/**
 * Study finder / import guard — hydrogen-ENERGY papers are skipped before any
 * insert or AI spend (owner request 2026-09-28). Mocked-db unit tests.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const ENERGY = {
  title: "Hydrogen-producing facultative anaerobic bacteria isolated from kitchen wastewater for sustainable bioenergy applications",
  abstract: "Hydrogen production through dark fermentation is a promising alternative to clean energy.",
  journal: "Journal of Microbiological Methods",
};
const HEALTH = {
  title: "Hydrogen-rich water improves sleep quality in healthy adults: a randomized controlled trial",
  abstract: "Participants drank hydrogen-rich water for four weeks.",
  journal: "Nutrients",
};

const state = vi.hoisted(() => ({
  queued: [] as any[],
  sets: [] as any[],
  inserts: 0,
  pending: [] as any[],
  afterStatus: "" as string,
  claimRows: [{ id: 1 }] as any[],
}));

/** A awaited-able query-builder step that also exposes .returning(). */
function step(returningRows: any[]): any {
  return Object.assign(Promise.resolve(undefined), { returning: () => Promise.resolve(returningRows) });
}

vi.mock("../db", () => {
  const db: any = {
    insert: () => ({
      values: (v: any) => {
        state.inserts++;
        if (v && typeof v === "object" && "discoveryRunId" in v) state.queued.push(v);
        return step([{ id: 1, ...v }]);
      },
    }),
    update: () => ({
      set: (v: any) => {
        state.sets.push(v);
        return { where: () => step(state.claimRows) };
      },
    }),
    select: () => {
      const chain: any = {
        from: () => chain,
        where: () => chain,
        orderBy: () => chain,
        limit: () => Promise.resolve(state.pending),
      };
      return chain;
    },
    query: {
      studies: { findFirst: async () => undefined },
      pipelineQueue: { findFirst: async () => (state.afterStatus ? { status: state.afterStatus } : undefined) },
    },
    execute: async () => ({ rows: [] }),
  };
  return { db, pool: { query: async () => ({ rows: [] }) }, migrationDb: db };
});

const generateJSON = vi.hoisted(() => vi.fn(async () => ({})));
vi.mock("../services/ai-provider", () => ({
  ai: { generateText: vi.fn(), generateJSON, getProviderStatus: () => ({ primary: "none" }) },
  MODELS: {},
}));

vi.mock("../services/crossref-api", () => ({
  searchCrossRef: async () => ({
    message: {
      items: [
        { DOI: "10.1016/energy.1", title: [ENERGY.title], "container-title": [ENERGY.journal], abstract: ENERGY.abstract },
        { DOI: "10.3390/health.1", title: [HEALTH.title], "container-title": [HEALTH.journal], abstract: HEALTH.abstract },
      ],
    },
  }),
  getCrossRefArticleByDOI: async () => null,
  extractStudyFromCrossRef: () => null,
}));
vi.mock("../services/europepmc-api", () => ({
  searchEuropePMC: async () => ({ results: [] }),
}));
vi.mock("../utils/http", () => ({
  externalApi: { get: async () => ({ data: { esearchresult: { idlist: [] }, result: {} } }) },
  fetchWithTimeout: async () => ({ json: async () => ({}) }),
}));

beforeEach(() => {
  state.queued = [];
  state.sets = [];
  state.inserts = 0;
  state.pending = [];
  state.afterStatus = "";
  state.claimRows = [{ id: 1 }];
  generateJSON.mockClear();
});

describe("runDiscovery (autonomous study finder)", () => {
  it("skips hydrogen-energy papers before queueing and reports the count", async () => {
    const { runDiscovery } = await import("../services/research-discovery-engine");
    const result = await runDiscovery("molecular hydrogen");
    expect(result.skippedOffTopic).toBe(1);
    expect(result.queued).toBe(1);
    expect(state.queued.map((q) => q.title)).toEqual([HEALTH.title]);
  });
});

describe("AI pipeline", () => {
  it("rejects a queued hydrogen-energy item before any AI step", async () => {
    state.pending = [{ id: 7, ...ENERGY, stepResults: "{}", currentStep: 0, retryCount: 0, maxRetries: 3 }];
    state.afterStatus = "rejected";
    const { processPipelineQueue } = await import("../services/study-analysis-pipeline");
    const result = await processPipelineQueue();
    expect(generateJSON).not.toHaveBeenCalled();
    expect(state.sets.some((s) => s.status === "rejected" && /Off-topic/.test(s.errorMessage))).toBe(true);
    expect(result.skippedOffTopic).toBe(1);
    expect(result.failed).toBe(0);
  });

  it("refuses to create a study from an approved hydrogen-energy item", async () => {
    const { createStudyFromPipelineItem } = await import("../services/study-analysis-pipeline");
    // The claim UPDATE ... RETURNING hands back the item itself.
    state.claimRows = [{ id: 9, ...ENERGY, stepResults: "{}" }];
    await expect(createStudyFromPipelineItem(9)).rejects.toMatchObject({ code: "OFF_TOPIC_HYDROGEN_ENERGY" });
    expect(state.inserts).toBe(0);
    expect(state.sets.at(-1)).toMatchObject({ status: "rejected" });
  });
});

describe("studyService.createStudy (manual / bulk / review-queue imports)", () => {
  it("throws OffTopicStudyError and inserts nothing for a hydrogen-energy study", async () => {
    const { studyService } = await import("../services/study-service");
    await expect(
      studyService.createStudy({
        ...ENERGY,
        authors: "A. Author",
        publishDate: "2026-01-01",
        category: "General",
      } as any),
    ).rejects.toMatchObject({ code: "OFF_TOPIC_HYDROGEN_ENERGY", status: 422 });
    expect(state.inserts).toBe(0);
  });
});

describe("admin external-search filtering", () => {
  it("hides hydrogen-energy results from every source shape", async () => {
    const { filterOffTopicSearchResults } = await import("../services/study-topic-guard");
    const crossref = [{ title: [ENERGY.title], abstract: ENERGY.abstract }, { title: [HEALTH.title] }];
    const epmc = [{ title: ENERGY.title, abstractText: ENERGY.abstract }, { title: HEALTH.title }];
    const consensus = [{ paper_title: ENERGY.title, abstract: ENERGY.abstract }, { paper_title: HEALTH.title, abstract: "" }];
    for (const items of [crossref, epmc, consensus]) {
      const { kept, excludedOffTopic } = filterOffTopicSearchResults(items as any[], "test");
      expect(excludedOffTopic).toBe(1);
      expect(kept).toHaveLength(1);
    }
  });
});
