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
import { productCeiling, type DoseMatch, type DoseRoute, type OutcomeMix, type ProductForMatch } from "./evidence-match";

export const COPY_APPROVAL: { approvedBy: string | null; approvedOn: string | null } = {
  approvedBy: "Josh Carr",
  approvedOn: "2026-11-05",
};

/** The lab's figure as measured (8.25 → "8.25 ppm"), never rounded to a marketing number. */
export function ppmLabel(ppm: number): string {
  return `${Number(ppm.toFixed(2))} ppm`;
}

export function fmt(n: number): string {
  return n.toLocaleString("en-US");
}

/**
 * The product's lab figure as shown: "8.25 ppm" (drinking), "2.22 ppm"
 * (bath water), "1,280 mL/min" (hydrogen gas flow).
 */
export function measureLabel(p: ProductForMatch): string {
  const v = productCeiling(p) ?? 0;
  return p.deliveryRoute === "inhaled_gas" ? `${fmt(v)} mL/min` : ppmLabel(v);
}

/** Drink mix: its lab figure is from a sealed vial, so the open-glass limit is used (Josh, 2026-11-06). */
export const OPEN_GLASS = {
  levelNote: (name: string) =>
    `the most hydrogen an open glass of water holds at normal air pressure (H2 Analytics measured more than that for the ${name}, but in a sealed lab vial)`,
  studied: "They studied hydrogen water at or below the level an open glass of water can hold.",
};

/** Bath and inhalation copy added 2026-11-06 — needs Josh's read before those badges go on. */
export const ROUTE_COPY: Record<DoseRoute, {
  line2: (n: string, label: string) => string;
  studiesOf: string;
  doseReported: string;
  levelNote: (productName: string) => string;
  notReported: string;
  studied: string;
  measuredBy: string;
  tableDose: string;
  notAdvice: string;
}> = {
  drinking_water: {
    line2: (n, label) => `${n} used drinking water at ≤${label}`,
    studiesOf: "human studies of drinking hydrogen water",
    doseReported: "report the concentration they used",
    levelNote: (name) => `a level the ${name} reaches`,
    notReported: "studies did not report a concentration and are not counted",
    studied: "They studied hydrogen water at concentrations this device can reach.",
    measuredBy: "Concentration measured by",
    tableDose: "H2 (mg/L)",
    notAdvice: "This is a summary of published research, not medical advice. Hydrogen water is not a treatment for any disease.",
  },
  bath: {
    line2: (n, label) => `${n} used bath water at ≤${label}`,
    studiesOf: "human studies of hydrogen baths",
    doseReported: "report the hydrogen concentration of the bath water",
    levelNote: (name) => `a level the ${name} reached in the lab test`,
    notReported: "studies did not report a bath-water concentration and are not counted",
    studied: "They studied hydrogen baths at concentrations this device reached in the lab test.",
    measuredBy: "Bath-water concentration measured by",
    tableDose: "H2 in bath (mg/L)",
    notAdvice: "This is a summary of published research, not medical advice. Hydrogen bathing is not a treatment for any disease.",
  },
  inhaled_gas: {
    line2: (n, label) => `${n} used a hydrogen flow of ≤${label}`,
    studiesOf: "human studies of breathing hydrogen gas",
    doseReported: "report a hydrogen flow, or the percentage and total flow it can be worked out from",
    levelNote: (name) => `within the hydrogen flow measured from the ${name}`,
    notReported: "studies did not report a flow that can be compared with a device and are not counted",
    studied: "They studied hydrogen gas at flows within this device's measured output.",
    measuredBy: "Hydrogen flow measured by",
    tableDose: "H2 flow (mL/min)",
    notAdvice: "This is a summary of published research, not medical advice. Hydrogen inhalation is not a treatment for any disease.",
  },
};

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
  line2: (d: DoseMatch, label: string) => ROUTE_COPY[d.route ?? "drinking_water"].line2(fmt(d.matched.length), label),
  cta: "See the research",
  source: "From Hydrogen Studies, the research library Echo Water funds",
};

export const PROFILE = {
  h1: (productName: string) => `Research profile: ${productName}`,
  disclosure:
    "Echo Water makes this product and funds Hydrogen Studies. The studies below were run by other researchers; we list them by a fixed rule so the count can be checked.",
  echoDevice: (d: DoseMatch) =>
    d.usedEchoDevice === 0
      ? `None of these studies tested an Echo product. ${d.ceilingBasis === "open_glass_limit" ? OPEN_GLASS.studied : ROUTE_COPY[d.route ?? "drinking_water"].studied}`
      : `${fmt(d.usedEchoDevice)} of these studies used an Echo device.`,
  echoFunding: (d: DoseMatch) =>
    d.fundedByEcho === 0
      ? `None of them was funded by Echo. ${fmt(d.fundingStated)} of ${fmt(d.matched.length)} state their funding.`
      : `${fmt(d.fundedByEcho)} of them were funded by Echo.`,
  summary: (d: DoseMatch, productName: string, label: string) => {
    const c = ROUTE_COPY[d.route ?? "drinking_water"];
    const n = d.matched.length;
    const mix = n ? ` Of those ${fmt(n)}, ${mixPhrase(d.mix)}.` : "";
    const level = d.ceilingBasis === "open_glass_limit" ? OPEN_GLASS.levelNote(productName) : c.levelNote(productName);
    return `Of ${fmt(d.routeStudies ?? d.drinkingStudies)} ${c.studiesOf}, ${fmt(d.withDose ?? d.withConcentration)} ${c.doseReported}, and ${fmt(n)} of those used ${label} or less, ${level}.${mix} ${fmt(d.notReported)} ${c.notReported}.`;
  },
  certificate: (lab: string, reportId: string, testDate: string, summary: string, route: DoseRoute = "drinking_water") =>
    `${ROUTE_COPY[route].measuredBy} ${lab}, report ${reportId} (${testDate}): ${summary}.`,
  ruleHeading: "How this count is made",
  tableHeading: "The matched studies",
  notAdvice: "This is a summary of published research, not medical advice. Hydrogen water is not a treatment for any disease.",
  methodology: "How we review studies",
};

/** The store modal names only store-listable studies (shared/evidence-match.ts storeList). */
export const STORE_LIST = {
  more: (n: number) => `${fmt(n)} more ${n === 1 ? "study is" : "studies are"} listed in the full profile on Hydrogen Studies.`,
  fullProfile: "See all studies",
};

export const CLAIM_WIDGET = {
  line: (n: number, m: OutcomeMix) => `Studied in ${fmt(n)} human ${n === 1 ? "study" : "studies"}: ${mixPhrase(m)}`,
  cta: "See the studies",
};

/**
 * PLAN 5.1 — the "studied dose" module on allowed study pages
 * (shared/study-dose-module.ts). The dose line is built from the study's own
 * reviewed fields; device figures are H2 Analytics measurements.
 */
export const DOSE_MODULE = {
  heading: "The hydrogen dose in this study",
  linePrefix: "This study used hydrogen-rich water at",
  stated: "Concentration as reported by the authors.",
  measured: "Concentration as measured by the authors.",
  sponsorLabel: "From our sponsor, Echo Water",
  deviceIntro: (ppm: string) =>
    `Echo Water funds Hydrogen Studies. These Echo devices reached at least ${ppm} when H2 Analytics (Las Vegas) measured them:`,
  echoNotUsed: "This study did not use an Echo device. The measurements above come from Echo's lab reports, not from this study.",
  echoUsed: "This study used an Echo device. The measurements above come from Echo's lab reports, not from this study.",
  echoUnknown: "The measurements above come from Echo's lab reports, not from this study.",
  disclaimer:
    "Drinking water at the same concentration does not mean you will get the same result as the people in this study. This is not medical advice, and hydrogen water is not a treatment for any disease.",
};

/**
 * The "About Hydrogen Studies" modal behind the store's footer/product trust
 * badge (/embed/trust-modal.js). Approved by Josh Carr 2026-11-09. The
 * relationship is the trust signal: say plainly that Echo funds the site.
 */
export const TRUST_MODAL = {
  ariaLabel: "About Hydrogen Studies",
  title: "Hydrogen Studies",
  subtitle: "The research library Echo Water funds",
  intro:
    "Hydrogen Studies collects published research on molecular hydrogen in one searchable place, so you can read the science behind hydrogen water for yourself.",
  statStudies: "studies indexed",
  statHuman: "human studies",
  howHeading: "How the library works",
  points: [
    "Study pages link to the original paper on PubMed or the publisher's site wherever one exists.",
    "Studies that found no effect, or a worse result, are listed alongside the positive ones.",
    "Study summaries are reviewed by our scientific reviewer before they are published.",
    "The summaries explain the research. They are not medical advice, and hydrogen water is not a treatment for any disease.",
  ],
  reviewerLabel: "Scientific reviewer",
  disclosure:
    "Echo Water (Echo Technologies LLC) owns and funds Hydrogen Studies. The studies were run by other researchers; Hydrogen Studies summarizes them and links to the source.",
  editorialPolicy: "Editorial policy",
  methodology: "How we review studies",
  visit: "Visit Hydrogen Studies",
  close: "Close",
};

/** Words the copy may never contain (checked by tests against rendered output). */
export const FORBIDDEN_COPY = [
  /\bverified\b/i, /\bindependent(ly)?\b/i, /clinician[- ]approved/i, /doctor[- ]recommended/i, /\bproven\b/i,
  /\bshows? that\b/i, /\btreats?\b/i, /\bcures?\b/i, /\bdiabet/i, /\bcancer/i, /\balzheimer/i, /\bparkinson/i,
];

/** "Ask the research" (TRUST-BADGE-PLAN Phase 3) — fixed copy; answers themselves are generated and validated. */
export const ASK = {
  intro: "Ask what the published research on molecular hydrogen says. Answers come only from studies in the Hydrogen Studies database and cite them.",
  medical:
    "We can't give medical advice, diagnose a condition, or recommend a dose for a health problem. Please talk to your doctor. If it helps, you can browse what studies have measured at hydrogenstudies.com.",
  diseaseOnStore:
    "We don't discuss research on medical conditions here, next to products. You can read what studies on this topic found, without any product information, at Hydrogen Studies.",
  support: "That sounds like a question for Echo's support team. These help articles may answer it:",
  supportHandoff: "Still need help? Ask Echo support",
  none: "We found no human studies in our database that answer this. Most hydrogen research so far is in cells and animals.",
  weakPrefix: "The evidence here is limited:",
  fallback: "We couldn't write a reliable answer, so here are the closest studies in the database:",
  limit: "We've reached today's limit for questions. Please try again tomorrow, or browse the studies at hydrogenstudies.com.",
  disabled: "Ask the research isn't available yet.",
};
