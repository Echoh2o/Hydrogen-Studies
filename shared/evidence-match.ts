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
  /** Inhaled H2 flow in mL/min (stated, or % × total flow); migration 034. */
  h2FlowMlMin?: number | null;
  hyperbaric?: boolean;
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
  /** Inhalation devices: the highest H2 flow the lab measured (mL/min). */
  certifiedH2FlowMlMin?: number | null;
}

/** Delivery routes a product can be dose-matched on, and what is compared. */
export type DoseRoute = "drinking_water" | "bath" | "inhaled_gas";
export const DOSE_ROUTES: readonly DoseRoute[] = ["drinking_water", "bath", "inhaled_gas"];

export function isDoseRoute(route: string | null | undefined): route is DoseRoute {
  return (DOSE_ROUTES as readonly string[]).includes(String(route));
}

/** The product's lab figure for its route: mg/L for water and baths, mL/min of H2 for gas. */
export function productCeiling(p: ProductForMatch): number | null {
  if (!isDoseRoute(p.deliveryRoute)) return null;
  const v = p.deliveryRoute === "inhaled_gas" ? p.certifiedH2FlowMlMin : p.certifiedConcentrationPpm;
  return v == null || !isFinite(Number(v)) ? null : Number(v);
}

/** A study's comparable dose on a route; null = not reported in a comparable form. */
export function studyDose(r: EvidenceStudyRow, route: DoseRoute): number | null {
  if (route === "inhaled_gas") return r.hyperbaric ? null : r.h2FlowMlMin ?? null;
  return r.concentrationPpm;
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

/** Dose match, rule v1 (drinking water); bath and inhaled gas added 2026-11-06. */
export function doseMatchRuleText(p: ProductForMatch): string {
  const v = productCeiling(p);
  const result = "A study's result is the direction of its primary outcome as recorded from the abstract and reviewed by our reviewer.";
  if (p.deliveryRoute === "bath") {
    return `Human studies in the Hydrogen Studies database in which people bathed in hydrogen-rich water, and the paper reports the hydrogen concentration of the bath water at or below ${v} mg/L (the concentration H2 Analytics measured in the tub water after running the ${p.name} for 60 minutes in warm water). Animal and cell studies, and drinking, inhaled-gas, saline and topical studies are excluded. Studies that do not report a bath-water concentration are counted separately, never matched. ${result}`;
  }
  if (p.deliveryRoute === "inhaled_gas") {
    return `Human studies in the Hydrogen Studies database in which people breathed hydrogen gas at normal air pressure, and the paper reports a hydrogen flow at or below ${(v ?? 0).toLocaleString("en-US")} mL per minute (the highest hydrogen flow H2 Analytics measured from the ${p.name}). A flow counts when the authors state it, or when they state both the hydrogen percentage and the total gas flow (hydrogen flow = percentage × total flow). Studies that give only a percentage, such as 2% hydrogen in a mask, describe the air breathed rather than a device's output, so they are counted separately and never matched; so are diving and pressure-chamber studies. Animal and cell studies, and drinking, bathing and saline studies are excluded. ${result}`;
  }
  return `Human studies in the Hydrogen Studies database in which people drank hydrogen water, and the paper reports a hydrogen concentration at or below ${v} mg/L (the concentration H2 Analytics measured for the ${p.name}). Animal and cell studies, inhaled gas, saline and bathing studies are excluded. Studies that do not report a concentration are counted separately, never matched. ${result}`;
}

export interface DoseMatch {
  route: DoseRoute;
  humanStudies: number;
  /** Human studies on the product's route (drinking, bathing or inhalation). */
  routeStudies: number;
  /** Of those, how many report a comparable dose. */
  withDose: number;
  /** Drinking-route names, kept for API compatibility (= routeStudies / withDose). */
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
  const route: DoseRoute = isDoseRoute(p.deliveryRoute) ? p.deliveryRoute : "drinking_water";
  const onRoute = humanRows.filter((r) => r.deliveryRoute === route);
  const withDose = onRoute.filter((r) => studyDose(r, route) != null);
  const ceiling = productCeiling(p) ?? -1;
  const matched = withDose.filter((r) => (studyDose(r, route) as number) <= ceiling + 1e-9);
  return {
    route,
    humanStudies: humanRows.length,
    routeStudies: onRoute.length,
    withDose: withDose.length,
    drinkingStudies: onRoute.length,
    withConcentration: withDose.length,
    notReported: onRoute.length - withDose.length,
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

const ROUTE_PHRASE: Record<DoseRoute, string> = {
  drinking_water: "of drinking hydrogen water",
  bath: "of hydrogen baths",
  inhaled_gas: "of breathing hydrogen gas",
};

export function topicRuleText(topic: string, route?: DoseRoute): string {
  const t = CLAIM_TOPICS[topic];
  return `Human studies${route ? ` ${ROUTE_PHRASE[route]}` : ""} in the Hydrogen Studies database tagged ${t.tags.map((x) => `"${x}"`).join(", ")}, in healthy people or athletes (studies in patients with a diagnosed condition are excluded). A study's result is the direction of its primary outcome as recorded from the abstract and reviewed by our reviewer.`;
}

/** Topic studies; with a route, only studies of that delivery route (a product's claim widget). */
export function topicMatch(humanRows: readonly EvidenceStudyRow[], topic: string, route?: DoseRoute): { studies: EvidenceStudyRow[]; mix: OutcomeMix } {
  const t = CLAIM_TOPICS[topic];
  const tags = new Set(t.tags.map((x) => x.toLowerCase()));
  const studies = humanRows.filter(
    (r) => (!route || r.deliveryRoute === route) && r.populationKind !== "patients" && r.healthConditions.some((c) => tags.has(c.toLowerCase())),
  );
  return { studies, mix: outcomeMix(studies) };
}
