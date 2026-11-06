/**
 * Every word the evidence badge, modal, /evidence page and claim widget show
 * (TRUST-BADGE-PLAN guardrail 5). Josh reviews and approves this file (no
 * outside counsel for now); nothing ships to echowater.com until
 * COPY_APPROVAL is stamped.
 *
 * Copy rules (checkable without a lawyer):
 *  - numbers come from the database, always with their denominator;
 *  - lab facts are quoted from a named report (lab, report ID, date);
 *  - never "verified", "certified" (except the lab's own certificate),
 *    "independent", "clinician-approved", "doctor-recommended", "proven",
 *    "shows that", "treats", "cures", or any disease name;
 *  - never says or implies the studies tested Echo products unless a study
 *    actually used an Echo device (usedEchoDevice > 0).
 */
import type { DoseMatch, OutcomeMix } from "./evidence-match";

export const COPY_APPROVAL: { approvedBy: string | null; approvedOn: string | null } = {
  approvedBy: null,
  approvedOn: null,
};

/** The lab's figure as measured (8.25 → "8.25 ppm"), never rounded to a marketing number. */
export function ppmLabel(ppm: number): string {
  return `${Number(ppm.toFixed(2))} ppm`;
}

export function fmt(n: number): string {
  return n.toLocaleString("en-US");
}

export function mixPhrase(m: OutcomeMix): string {
  const parts = [
    m.improved ? `${fmt(m.improved)} improved their main outcome` : "",
    m.no_clear_effect ? `${fmt(m.no_clear_effect)} found no clear effect` : "",
    m.mixed ? `${fmt(m.mixed)} had mixed results` : "",
    m.worsened ? `${fmt(m.worsened)} found it worse` : "",
    m.not_reported ? `${fmt(m.not_reported)} did not report a direction` : "",
  ].filter(Boolean);
  return parts.length > 1 ? `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}` : parts[0] ?? "";
}

export const BADGE = {
  line1: (d: DoseMatch) => `${fmt(d.humanStudies)} human studies on molecular hydrogen`,
  line2: (d: DoseMatch, ppmLabel: string) => `${fmt(d.matched.length)} used drinking water at ≤${ppmLabel}`,
  cta: "See the research",
  source: "From Hydrogen Studies, the research library Echo Water funds",
};

export const PROFILE = {
  h1: (productName: string) => `Research profile: ${productName}`,
  disclosure:
    "Echo Water makes this product and funds Hydrogen Studies. The studies below were run by other researchers; we list them by a fixed rule so the count can be checked.",
  echoDevice: (d: DoseMatch) =>
    d.usedEchoDevice === 0
      ? "None of these studies tested an Echo product. They studied hydrogen water at concentrations this device can reach."
      : `${fmt(d.usedEchoDevice)} of these studies used an Echo device.`,
  echoFunding: (d: DoseMatch) =>
    d.fundedByEcho === 0
      ? `None of them was funded by Echo. ${fmt(d.fundingStated)} of ${fmt(d.matched.length)} state their funding.`
      : `${fmt(d.fundedByEcho)} of them were funded by Echo.`,
  summary: (d: DoseMatch, productName: string, ppmLabel: string) =>
    `Of ${fmt(d.drinkingStudies)} human studies of drinking hydrogen water, ${fmt(d.withConcentration)} report the concentration they used, and ${fmt(d.matched.length)} of those used ${ppmLabel} or less, a level the ${productName} reaches. Of those ${fmt(d.matched.length)}, ${mixPhrase(d.mix)}. ${fmt(d.notReported)} studies did not report a concentration and are not counted.`,
  certificate: (lab: string, reportId: string, testDate: string, summary: string) =>
    `Concentration measured by ${lab}, report ${reportId} (${testDate}): ${summary}.`,
  ruleHeading: "How this count is made",
  tableHeading: "The matched studies",
  notAdvice: "This is a summary of published research, not medical advice. Hydrogen water is not a treatment for any disease.",
  methodology: "How we review studies",
};

export const CLAIM_WIDGET = {
  line: (n: number, m: OutcomeMix) => `Studied in ${fmt(n)} human ${n === 1 ? "study" : "studies"}: ${mixPhrase(m)}`,
  cta: "See the studies",
};

/** Words the copy may never contain (checked by tests against rendered output). */
export const FORBIDDEN_COPY = [
  /\bverified\b/i, /\bindependent(ly)?\b/i, /clinician[- ]approved/i, /doctor[- ]recommended/i, /\bproven\b/i,
  /\bshows? that\b/i, /\btreats?\b/i, /\bcures?\b/i, /\bdiabet/i, /\bcancer/i, /\balzheimer/i, /\bparkinson/i,
];
