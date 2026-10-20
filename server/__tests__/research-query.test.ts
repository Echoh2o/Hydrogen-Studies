import { describe, it, expect, vi } from "vitest";
import { CORPUS_ROWS, CONDITION_ROWS } from "./fixtures/research-corpus";

vi.mock("../db", () => ({ db: { execute: vi.fn() } }));
vi.mock("../middleware/seo-body-renderer", () => ({ getConditionRows: vi.fn(), conditionHubWhere: vi.fn() }));

const rq = await import("../services/research-query");

const corpus = CORPUS_ROWS.map(rq.toCorpusStudy);
const byId = (id: number) => corpus.find((s) => s.id === id)!;

describe("toCorpusStudy", () => {
  it("normalizes design, subject, delivery and outcome through research-vocab", () => {
    expect(byId(1)).toMatchObject({ subject: "human", design: "rct", deliveryMethod: "drinking_water", outcome: "positive", species: "Human" });
    expect(byId(2)).toMatchObject({ subject: "human", design: null, deliveryMethod: "inhalation", outcome: "neutral" });
    expect(byId(3)).toMatchObject({ subject: "animal", species: "Rat", deliveryMethod: "inhalation" });
    expect(byId(4)).toMatchObject({ subject: "in_vitro", deliveryMethod: "culture_medium" });
    expect(byId(5)).toMatchObject({ subject: "review", species: null });
  });
});

describe("filters and sorting", () => {
  it("applies structured filters", () => {
    expect(rq.applyFilters(corpus, { subject: "human" }).map((s) => s.id)).toEqual([1, 2, 6]);
    expect(rq.applyFilters(corpus, { deliveryMethod: "inhalation", subject: "human" }).map((s) => s.id)).toEqual([2, 6]);
    expect(rq.applyFilters(corpus, { yearFrom: 2020, minSampleSize: 50 }).map((s) => s.id)).toEqual([6]);
    expect(rq.applyFilters(corpus, { outcome: "neutral" }).map((s) => s.id)).toEqual([2]);
  });

  it("sorts by strength of evidence (RCTs first, then quality)", () => {
    expect(rq.sortStudies(corpus, "evidence").map((s) => s.id)).toEqual([1, 6, 2, 3, 4, 5]);
  });

  it("sorts by text rank for relevance", () => {
    const ranks = new Map([[3, 0.9], [1, 0.2]]);
    expect(rq.sortStudies([byId(1), byId(3)], "relevance", ranks).map((s) => s.id)).toEqual([3, 1]);
  });

  it("builds an OR tsquery from plain words only", () => {
    expect(rq.toOrTsQuery("Does H2 water help fatigue? fatigue!")).toBe("does | h2 | water | help | fatigue");
    expect(rq.toOrTsQuery("!!! ' ;")).toBeNull();
  });
});

describe("matchConditionRow", () => {
  it("resolves slugs, names and loose text", () => {
    expect(rq.matchConditionRow(CONDITION_ROWS, "blood-pressure")?.slug).toBe("blood-pressure");
    expect(rq.matchConditionRow(CONDITION_ROWS, "Blood Pressure")?.slug).toBe("blood-pressure");
    expect(rq.matchConditionRow(CONDITION_ROWS, "fatigue")?.slug).toBe("chronic-fatigue");
    expect(rq.matchConditionRow(CONDITION_ROWS, "glaucoma")).toBeNull();
  });
});

describe("aggregate", () => {
  it("counts buckets and unknowns separately", () => {
    const out = rq.aggregate(corpus, "design");
    expect(out.total_studies).toBe(6);
    expect(out.buckets).toEqual([{ value: "rct", count: 2 }, { value: "review", count: 1 }]);
    expect(out.unknown).toBe(3);
  });

  it("explodes multi-valued conditions", () => {
    const out = rq.aggregate(corpus, "condition");
    expect(out.buckets[0]).toEqual({ value: "Blood Pressure", count: 4 });
  });

  it("orders year buckets newest first", () => {
    expect(rq.aggregate(corpus, "year").buckets.map((b) => b.value)).toEqual(["2024", "2023", "2021", "2019", "2015", "2012"]);
  });
});

describe("evidenceProfile", () => {
  it("summarizes human evidence and coverage", () => {
    const p = rq.evidenceProfile(corpus, 2);
    expect(p.total_studies).toBe(6);
    expect(p.by_subject).toEqual({ human: 3, animal: 1, in_vitro: 1, review: 1 });
    expect(p.human_evidence).toMatchObject({
      studies: 3,
      randomized_controlled_trials: 2,
      total_participants_reported: 120,
      median_sample_size: 40,
      outcomes: { positive: 2, neutral: 1 },
    });
    expect(p.coverage).toMatchObject({ design_known: 3, outcome_known: 5, of: 6 });
    expect(p.publication_years).toEqual({ first: 2012, latest: 2024 });
    expect(p.strongest_studies.map((s) => s.id)).toEqual([1, 6]);
  });
});

describe("output shapes", () => {
  it("studyCard links our page and the DOI, never the abstract", () => {
    const card = rq.studyCard(byId(1));
    expect(card.url).toBe("https://hydrogenstudies.com/study/h2-water-bp-rct");
    expect(card.doi_url).toBe("https://doi.org/10.1000/bp.1");
    expect(card).not.toHaveProperty("abstract");
  });

  it("parses every study reference form", () => {
    expect(rq.parseStudyRef("42")).toEqual({ kind: "id", value: "42" });
    expect(rq.parseStudyRef("https://doi.org/10.1000/xyz")).toEqual({ kind: "doi", value: "10.1000/xyz" });
    expect(rq.parseStudyRef("doi: 10.1000/xyz")).toEqual({ kind: "doi", value: "10.1000/xyz" });
    expect(rq.parseStudyRef("https://hydrogenstudies.com/study/h2-cells?x=1")).toEqual({ kind: "slug", value: "h2-cells" });
    expect(rq.parseStudyRef("h2-cells")).toEqual({ kind: "slug", value: "h2-cells" });
  });
});
