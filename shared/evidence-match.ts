/**
 * TRUST-BADGE-PLAN Phase 1.1 — the matching rules behind every badge number.
 * Pure and versioned: the plain-language rule text is rendered verbatim on the
 * evidence page so anyone can re-run the count. PLAN 5.1 reuses this.
 *
 * Inputs are study rows whose evidence fields are approved (auto_approved or
 * approved — never unapproved); the server query enforces that.
 */
import { isBridgeAllowed } from "./bridge-policy";

export const EVIDENCE_RULE_VERSION = "1";

export interface EvidenceStudyRow {
  id: number;
  slug: string;
  title: string;
  publishYear: number | null;
  pmid: string | null;
  doi: string | null;
  studyDesign: string | null;
  sampleSize: number | null;
  durationDays: number | null;
  deliveryRoute: string | null;
  concentrationPpm: number | null;
  concentrationKind: string | null;
  populationKind: string | null;
  effectDirection: string;
  fundingCategory: string | null;
  fundedByEcho: boolean;
  usedEchoDevice: boolean;
  healthConditions: string[];
}

export interface ProductForMatch {
  slug: string;
  name: string;
  deliveryRoute: string;
  certifiedConcentrationPpm: number | null;
}

export interface OutcomeMix {
  improved: number;
  no_clear_effect: number;
  worsened: number;
  mixed: number;
  not_reported: number;
}

export function outcomeMix(rows: readonly EvidenceStudyRow[]): OutcomeMix {
  const m: OutcomeMix = { improved: 0, no_clear_effect: 0, worsened: 0, mixed: 0, not_reported: 0 };
  for (const r of rows) {
    const k = (r.effectDirection in m ? r.effectDirection : "not_reported") as keyof OutcomeMix;
    m[k]++;
  }
  return m;
}

/** Dose match, rule v1. */
export function doseMatchRuleText(p: ProductForMatch): string {
  const ppm = p.certifiedConcentrationPpm;
  return `Human studies in the Hydrogen Studies database in which people drank hydrogen water, and the paper reports a hydrogen concentration at or below ${ppm} mg/L (the concentration H2 Analytics measured for the ${p.name}). Animal and cell studies, inhaled gas, saline and bathing studies are excluded. Studies that do not report a concentration are counted separately, never matched. A study's result is the direction of its primary outcome as recorded from the abstract and reviewed by our reviewer.`;
}

export interface DoseMatch {
  humanStudies: number;
  drinkingStudies: number;
  withConcentration: number;
  notReported: number;
  matched: EvidenceStudyRow[];
  mix: OutcomeMix;
  fundedByEcho: number;
  usedEchoDevice: number;
  fundingStated: number;
}

export function doseMatch(humanRows: readonly EvidenceStudyRow[], p: ProductForMatch): DoseMatch {
  const drinking = humanRows.filter((r) => r.deliveryRoute === "drinking_water");
  const withConc = drinking.filter((r) => r.concentrationPpm != null);
  const ceiling = p.certifiedConcentrationPpm ?? -1;
  const matched = withConc.filter((r) => (r.concentrationPpm as number) <= ceiling + 1e-9);
  return {
    humanStudies: humanRows.length,
    drinkingStudies: drinking.length,
    withConcentration: withConc.length,
    notReported: drinking.length - withConc.length,
    matched,
    mix: outcomeMix(matched),
    fundedByEcho: matched.filter((r) => r.fundedByEcho).length,
    usedEchoDevice: matched.filter((r) => r.usedEchoDevice).length,
    fundingStated: matched.filter((r) => r.fundingCategory && r.fundingCategory !== "not_stated").length,
  };
}

/** Claim topics (Appendix E allowed contexts only) → condition tags. */
export const CLAIM_TOPICS: Record<string, { label: string; tags: string[]; bridgeKey: string }> = {
  "athletic-performance": { label: "athletic performance", bridgeKey: "athletic-performance", tags: ["Athletic Performance", "Exercise Performance", "Athletic Performance Decline"] },
  "exercise-recovery": { label: "exercise recovery", bridgeKey: "exercise-recovery", tags: ["Exercise-Induced Muscle Damage", "Exercise Fatigue", "Exercise-Induced Fatigue", "Muscle Fatigue", "Athletic Fatigue"] },
  "oxidative-stress": { label: "oxidative-stress markers in healthy adults", bridgeKey: "oxidative-stress-biomarkers-healthy-adults", tags: ["Oxidative Stress", "Exercise-Induced Oxidative Stress"] },
  "sleep-quality": { label: "sleep quality in healthy adults", bridgeKey: "sleep-quality-healthy-adults", tags: ["Sleep Quality"] },
  "skin-appearance": { label: "skin appearance", bridgeKey: "skin-appearance-cosmetic", tags: ["Skin Aging"] },
  "fatigue-energy": { label: "fatigue and energy in healthy adults", bridgeKey: "fatigue-energy-healthy-adults", tags: ["Fatigue", "Mental Fatigue"] },
};

export function isClaimTopic(topic: string): boolean {
  const t = CLAIM_TOPICS[topic];
  return !!t && isBridgeAllowed(t.bridgeKey);
}

export function topicRuleText(topic: string): string {
  const t = CLAIM_TOPICS[topic];
  return `Human studies in the Hydrogen Studies database tagged ${t.tags.map((x) => `"${x}"`).join(", ")}, in healthy people or athletes (studies in patients with a diagnosed condition are excluded). A study's result is the direction of its primary outcome as recorded from the abstract and reviewed by our reviewer.`;
}

export function topicMatch(humanRows: readonly EvidenceStudyRow[], topic: string): { studies: EvidenceStudyRow[]; mix: OutcomeMix } {
  const t = CLAIM_TOPICS[topic];
  const tags = new Set(t.tags.map((x) => x.toLowerCase()));
  const studies = humanRows.filter((r) => r.populationKind !== "patients" && r.healthConditions.some((c) => tags.has(c.toLowerCase())));
  return { studies, mix: outcomeMix(studies) };
}
