import { describe, expect, it } from "vitest";
import { analyze, MIN_TRIALS, robOverall } from "../../scripts/research/living-review-analyze";

const outcome = (h2: number, ctl: number, extra: Record<string, unknown> = {}) => ({
  domain: "lactate", measure: "lactate", unit: "mmol/L", timepoint: "post", higher_is_better: false,
  value_type: "final", dispersion_type: "SD", values_in: "table", source_location: "Table 1",
  h2: { mean: h2, dispersion: 2, n: 12 }, control: { mean: ctl, dispersion: 2, n: 12 }, ...extra,
});
const paper = (i: number, outcomes: any[]) => ({
  pmcid: `PMC${i}`, pmid: null, doi: null, first_author: `A${i}`, year: 2020, title: "t",
  eligible: true, design: "crossover", outcomes,
});
const sel = (refs: string[]) => ({ analyses: [{ id: "lactate", label: "L", primary: true, comparisons: refs.map((ref) => ({ ref })) }] });

describe("living-review analyze", () => {
  it(`pools only when ≥ ${MIN_TRIALS} distinct trials contribute`, () => {
    const papers = Array.from({ length: 5 }, (_, i) => paper(i, [outcome(10, 11)]));
    const five = analyze(papers as any, sel(papers.map((p) => `${p.pmcid}#0`)))[0];
    expect(five.pooled).not.toBeNull();
    expect(five.pooled!.estimate).toBeGreaterThan(0); // lower lactate favours H2 → positive
    const four = analyze(papers as any, sel(papers.slice(0, 4).map((p) => `${p.pmcid}#0`)))[0];
    expect(four.pooled).toBeNull();
  });
  it("counts subgroups of one trial as one trial", () => {
    const papers = [paper(1, [outcome(10, 11), outcome(10, 11)]), ...Array.from({ length: 3 }, (_, i) => paper(i + 2, [outcome(10, 11)]))];
    const r = analyze(papers as any, sel(["PMC1#0", "PMC1#1", "PMC2#0", "PMC3#0", "PMC4#0"]))[0];
    expect(r.trials).toBe(4);
    expect(r.pooled).toBeNull();
  });
  it("refuses figure-only values, ineligible papers and mixed final/change scores", () => {
    expect(() => analyze([paper(1, [outcome(1, 2, { values_in: "figure_only" })])] as any, sel(["PMC1#0"]))).toThrow(/figure-only/);
    expect(() => analyze([{ ...paper(1, [outcome(1, 2)]), eligible: false }] as any, sel(["PMC1#0"]))).toThrow(/not eligible/);
    expect(() =>
      analyze([paper(1, [outcome(1, 2)]), paper(2, [outcome(1, 2, { value_type: "change" })])] as any, sel(["PMC1#0", "PMC2#0"])),
    ).toThrow(/mixes final and change/);
  });
  it("derives the RoB 2 overall judgement mechanically", () => {
    const all = (v: string) => ({ randomization: v, deviations: v, missing_data: v, measurement: v, selective_reporting: v });
    expect(robOverall(all("low"))).toBe("low");
    expect(robOverall({ ...all("low"), measurement: "some" })).toBe("some");
    expect(robOverall({ ...all("some"), selective_reporting: "high" })).toBe("high");
    expect(robOverall({ ...all("some"), overall_override: "high" })).toBe("high");
    expect(robOverall({ randomization: "low" })).toBe("not_assessed");
    expect(robOverall(undefined)).toBe("not_assessed");
  });
  it("runs sensitivity analyses by whole trial", () => {
    const papers = Array.from({ length: 6 }, (_, i) => ({
      ...paper(i, [outcome(10, 11 + i * 0.1)]),
      risk_of_bias: { randomization: i === 0 ? "high" : "low", deviations: "low", missing_data: "low", measurement: "low", selective_reporting: "low" },
      industry_funded: i === 1 ? true : i === 2 ? null : false,
    }));
    const r = analyze(papers as any, sel(papers.map((p) => `${p.pmcid}#0`)))[0];
    expect(r.sensitivity!.excludeHighRob.dropped).toEqual(["PMC0"]);
    expect(r.sensitivity!.excludeHighRob.result!.trials).toBe(5);
    expect(r.sensitivity!.excludeIndustry.dropped).toEqual(["PMC1"]);
    expect(r.sensitivity!.excludeIndustry.notJudged).toEqual(["PMC2"]);
    expect(r.sensitivity!.leaveOneOut).toHaveLength(6);
    expect(r.sensitivity!.leaveOneOut.every((l) => l.result!.trials === 5)).toBe(true);
    const four = analyze(papers as any, sel(papers.slice(0, 4).map((p) => `${p.pmcid}#0`)))[0];
    expect(four.sensitivity).toBeNull();
  });
});
