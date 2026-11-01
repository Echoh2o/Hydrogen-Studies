import { describe, it, expect, vi } from "vitest";

vi.mock("../services/ai-provider", () => ({ ai: { generateJSON: vi.fn() }, MODELS: { HAIKU: "claude-haiku-4-5" } }));

const {
  sectionJats,
  verifyExtraction,
  locateEvidence,
  sampleSizeTraceable,
  durationTraceable,
  concentrationTraceable,
  dosageSpecific,
  NO_COI,
  NO_FUNDING,
} = await import("../services/human-trial-field-extraction");

const JATS = `<?xml version="1.0"?><article><front><article-meta>
<abstract><p>Forty healthy adults drank hydrogen-rich water.</p></abstract></article-meta></front>
<body>
<sec><title>Introduction</title><p>Background text.</p></sec>
<sec sec-type="methods"><title>Materials and Methods</title>
<p>A total of 40 participants (20 H2, 20 placebo) drank 500 mL of hydrogen-rich water (1.6 ppm) twice daily for 8 weeks.</p></sec>
<sec><title>Results</title><p>Fatigue fell.</p></sec>
</body>
<back><ack><p>We thank Dr. Smith.</p></ack>
<sec><title>Funding</title><p>This work was funded by JSPS KAKENHI Grant Number JP19K11500.</p></sec>
<fn-group><fn fn-type="COI-statement"><p>The authors declare no conflict of interest.</p></fn></fn-group>
<ref-list><ref><mixed-citation>Ref 1 funded by grant X</mixed-citation></ref></ref-list>
</back></article>`;

const sec = sectionJats(JATS)!;
const src = { kind: "fulltext" as const, ...sec };
const empty = {
  h2_concentration: null, dosage_protocol: null, duration: null, sample_size: null,
  funding_sources: null, conflict_of_interest: null,
};

describe("sectionJats", () => {
  it("splits abstract, methods, funding and COI; drops references", () => {
    expect(sec.abstract).toContain("Forty healthy adults");
    expect(sec.methods).toContain("1.6 ppm");
    expect(sec.methods).not.toContain("Background text");
    expect(sec.funding).toContain("JP19K11500");
    expect(sec.funding).not.toContain("Ref 1");
    expect(sec.coi).toContain("declare no conflict of interest");
  });
  it("keeps words apart across tags", () => {
    expect(sec.methods).toMatch(/Materials and Methods A total/);
  });
});

describe("traceability checks", () => {
  it("sample size: literal or sum of arms", () => {
    expect(sampleSizeTraceable(40, "A total of 40 participants")).toBe(true);
    expect(sampleSizeTraceable(40, "20 received H2 and 20 placebo")).toBe(true);
    expect(sampleSizeTraceable(40, "Forty adults")).toBe(true);
    expect(sampleSizeTraceable(41, "20 received H2 and 20 placebo")).toBe(false);
  });
  it("sample size: arm sums ignore spelled-out group counts", () => {
    expect(sampleSizeTraceable(60, "randomly divided into two groups, (n = 30) and (n = 30)")).toBe(true);
  });
  it("duration: unit conversions of a quoted '<number> <unit>'", () => {
    expect(durationTraceable(56, "twice daily for 8 weeks")).toBe(true);
    expect(durationTraceable(180, "for 6 months")).toBe(true);
    expect(durationTraceable(14, "for fourteen days")).toBe(true);
    expect(durationTraceable(1, "a single 30 min inhalation")).toBe(true);
    expect(durationTraceable(1, "10-min bathing")).toBe(true);
    expect(durationTraceable(90, "for 8 weeks")).toBe(false);
    // numbers without a time unit, or a bare keyword, are not durations
    expect(durationTraceable(1, "Acute physical exercise increases ROS")).toBe(false);
    expect(durationTraceable(51, "admitted from January 29 to March 20, 2020")).toBe(false);
    expect(durationTraceable(7, "7 patients received H2")).toBe(false);
  });
  it("concentration: needs a unit and the quoted leading number", () => {
    expect(concentrationTraceable("1.6 ppm", "water (1.6 ppm)")).toBe(true);
    expect(concentrationTraceable("0.6 mM", "used if more than 0.6 mM")).toBe(true);
    expect(concentrationTraceable("66.7% H2", "hydrogen (66.7%) and oxygen (33.3%)")).toBe(true);
    expect(concentrationTraceable("1.6 ppm", "water (0.8 ppm)")).toBe(false);
    expect(concentrationTraceable("~80 mL of H2", "producing ~ 80 mL of H 2")).toBe(false);
  });
  it("dosage protocol must be concrete", () => {
    expect(dosageSpecific("500 mL twice daily", "drank 500 mL twice daily")).toBe(true);
    expect(dosageSpecific("inhaled hydrogen", "a clinical trial of inhaled hydrogen")).toBe(false);
  });
  it("evidence is located in abstract vs full text, tolerant of whitespace/punctuation", () => {
    expect(locateEvidence("Forty  healthy adults drank", "T", src)).toBe("abstract");
    expect(locateEvidence("drank 500 mL of hydrogen-rich water (1.6 ppm)", "T", src)).toBe("fulltext");
    expect(locateEvidence("drank 2 L of hydrogen water", "T", src)).toBeNull();
  });
});

describe("verifyExtraction", () => {
  const raw = {
    h2_concentration: { value: "1.6 ppm", evidence: "hydrogen-rich water (1.6 ppm)" },
    dosage_protocol: { value: "500 mL H2-rich water twice daily for 8 weeks", evidence: "drank 500 mL of hydrogen-rich water (1.6 ppm) twice daily for 8 weeks" },
    duration_days: { value: 56, evidence: "twice daily for 8 weeks" },
    sample_size: { value: 40, evidence: "A total of 40 participants (20 H2, 20 placebo)" },
    funding_sources: { value: ["JSPS KAKENHI (JP19K11500)"], evidence: "This work was funded by JSPS KAKENHI Grant Number JP19K11500." },
    conflict_of_interest: { value: "none_declared", evidence: "The authors declare no conflict of interest." },
  };

  it("proposes every verified field with its source", () => {
    const { proposals, rejected } = verifyExtraction(raw, "T", src, empty);
    expect(rejected).toEqual([]);
    const by = Object.fromEntries(proposals.map((p) => [p.field, p]));
    expect(by.h2_concentration.value).toBe("1.6 ppm");
    expect(by.duration.value).toBe(56);
    expect(by.sample_size.value).toBe(40);
    expect(by.funding_sources.value).toBe("JSPS KAKENHI (JP19K11500)");
    expect(by.conflict_of_interest.value).toBe(NO_COI);
    expect(by.sample_size.source).toBe("fulltext");
  });

  it("is fill-empty-only", () => {
    const { proposals } = verifyExtraction(raw, "T", src, { ...empty, sample_size: 38, h2_concentration: "1.2 ppm" });
    expect(proposals.map((p) => p.field)).not.toContain("sample_size");
    expect(proposals.map((p) => p.field)).not.toContain("h2_concentration");
  });

  it("drops values whose quote is not in the source (hallucinated evidence)", () => {
    const { proposals, rejected } = verifyExtraction(
      { sample_size: { value: 60, evidence: "Sixty participants were enrolled" } }, "T", src, empty);
    expect(proposals).toEqual([]);
    expect(rejected[0]).toMatchObject({ field: "sample_size", reason: "evidence not found in source" });
  });

  it("drops numbers the quote does not support", () => {
    const { proposals, rejected } = verifyExtraction(
      { duration_days: { value: 90, evidence: "twice daily for 8 weeks" } }, "T", src, empty);
    expect(proposals).toEqual([]);
    expect(rejected[0].reason).toBe("value not traceable to evidence");
  });

  it("null values and missing evidence never become proposals", () => {
    const { proposals } = verifyExtraction(
      { h2_concentration: { value: null, evidence: null }, dosage_protocol: { value: "x", evidence: null } }, "T", src, empty);
    expect(proposals).toEqual([]);
  });

  it("'none' funding requires a quote that says none", () => {
    const abs = { kind: "abstract" as const, abstract: "The study received no external funding. Patients improved.", methods: "", funding: "", coi: "" };
    const ok = verifyExtraction({ funding_sources: { value: "none_declared", evidence: "The study received no external funding." } }, "T", abs, empty);
    expect(ok.proposals[0]).toMatchObject({ value: NO_FUNDING, source: "abstract" });
    const bad = verifyExtraction({ funding_sources: { value: "none_declared", evidence: "Patients improved." } }, "T", abs, empty);
    expect(bad.proposals).toEqual([]);
  });

  it("abstract-only sources ignore full-text sections", () => {
    const abs = { ...src, kind: "abstract" as const };
    const { proposals } = verifyExtraction({ sample_size: raw.sample_size }, "T", abs, empty);
    expect(proposals).toEqual([]);
  });
});
