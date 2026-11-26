/**
 * PLAN 6.1: run the pre-specified analyses for a living review.
 *
 *   npx tsx scripts/research/living-review-analyze.ts exercise-performance
 *
 * Inputs (data/living-reviews/<review>/):
 *   extraction.json — one record per full-text paper (form: docs/living-reviews/<review>/extraction-form.md)
 *   selection.json  — which extracted outcome feeds each analysis, with the protocol rule used:
 *     { "analyses": [{ "id", "label", "primary", "comparisons": [{ "ref": "<paperKey>#<outcomeIndex>", "label", "note" }] }] }
 *     paperKey = pmcid, or "id:<studyId>" when the paper is not in PMC.
 *
 * Output: results.json — per analysis: every comparison's Hedges' g with its CI and
 * weight, and, when ≥ MIN_TRIALS distinct trials contribute, the pooled
 * DL+HKSJ estimate. No DB access; deterministic, so a diff of results.json
 * is the review's change log.
 */
import fs from "fs";
import path from "path";
import { hedgesG, poolRandomEffects, type DispersionType } from "../../shared/meta-analysis";

export const MIN_TRIALS = 5;

interface Arm { mean: number | null; dispersion: number | [number, number] | null; n: number | null }
interface Outcome {
  domain: string; measure: string; unit: string; timepoint: string;
  higher_is_better: boolean | null; value_type: "final" | "change";
  dispersion_type: string; h2: Arm; control: Arm; values_in: string; source_location: string;
}
interface Paper {
  pmcid: string | null; study_id?: number; pmid: string | null; doi: string | null;
  first_author: string; year: number; title: string; eligible: boolean; design: string;
  outcomes: Outcome[];
  risk_of_bias?: Record<string, string>; funding_coi?: string;
}
interface Selection {
  analyses: { id: string; label: string; primary: boolean; comparisons: { ref: string; label?: string; note?: string }[] }[];
}

const keyOf = (p: Paper) => p.pmcid ?? `id:${p.study_id}`;

export function analyze(papers: Paper[], selection: Selection) {
  const byKey = new Map(papers.map((p) => [keyOf(p), p]));
  return selection.analyses.map((a) => {
    const rows = a.comparisons.map((c) => {
      const [key, idx] = c.ref.split("#");
      const paper = byKey.get(key);
      if (!paper) throw new Error(`${a.id}: unknown paper ${key}`);
      if (!paper.eligible) throw new Error(`${a.id}: ${key} is not eligible`);
      const o = paper.outcomes[Number(idx)];
      if (!o) throw new Error(`${a.id}: ${c.ref} has no outcome`);
      if (o.values_in === "figure_only") throw new Error(`${a.id}: ${c.ref} is figure-only`);
      if (o.higher_is_better == null) throw new Error(`${a.id}: ${c.ref} has no direction`);
      if (o.h2.mean == null || o.control.mean == null || o.h2.n == null || o.control.n == null || o.h2.dispersion == null || o.control.dispersion == null)
        throw new Error(`${a.id}: ${c.ref} is missing numbers`);
      const es = hedgesG(
        { mean: o.h2.mean, dispersion: o.h2.dispersion, n: o.h2.n },
        { mean: o.control.mean, dispersion: o.control.dispersion, n: o.control.n },
        { higherIsBetter: o.higher_is_better, dispersionType: o.dispersion_type as DispersionType },
      );
      return {
        ref: c.ref, trial: key, label: c.label ?? `${paper.first_author} ${paper.year}`, note: c.note ?? null,
        design: paper.design, measure: o.measure, unit: o.unit, timepoint: o.timepoint,
        valueType: o.value_type, dispersionType: o.dispersion_type, source: o.source_location,
        h2: o.h2, control: o.control, ...es,
      };
    });
    const valueTypes = new Set(rows.map((r) => r.valueType));
    if (valueTypes.size > 1) throw new Error(`${a.id}: mixes final and change scores (protocol §5)`);
    const trials = new Set(rows.map((r) => r.trial)).size;
    const pooled = trials >= MIN_TRIALS ? poolRandomEffects(rows.map((r) => r.g), rows.map((r) => r.v)) : null;
    return {
      id: a.id, label: a.label, primary: a.primary, trials, comparisons: rows.length,
      pooled, rows: rows.map((r, i) => ({ ...r, weight: pooled ? pooled.weights[i] : null })),
    };
  });
}

function main() {
  const review = process.argv[2];
  if (!review) throw new Error("usage: living-review-analyze.ts <review>");
  const dir = path.join("data/living-reviews", review);
  const papers: Paper[] = JSON.parse(fs.readFileSync(path.join(dir, "extraction.json"), "utf8"));
  const selection: Selection = JSON.parse(fs.readFileSync(path.join(dir, "selection.json"), "utf8"));
  const results = analyze(papers, selection);
  fs.writeFileSync(path.join(dir, "results.json"), JSON.stringify({ review, minTrials: MIN_TRIALS, analyses: results }, null, 1) + "\n");
  for (const r of results) {
    const p = r.pooled;
    console.log(
      `${r.id.padEnd(12)} trials=${r.trials} k=${r.comparisons} ` +
        (p ? `g=${p.estimate.toFixed(2)} [${p.ciLow.toFixed(2)}, ${p.ciHigh.toFixed(2)}] p=${p.p.toFixed(3)} I²=${p.i2.toFixed(0)}% PI [${p.piLow?.toFixed(2)}, ${p.piHigh?.toFixed(2)}]` : "not pooled (< MIN_TRIALS)"),
    );
  }
}

if (process.argv[1]?.endsWith("living-review-analyze.ts")) main();
