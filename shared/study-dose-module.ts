/**
 * PLAN 5.1 — "Studied dose vs. your device" on study pages.
 *
 * A factual line built from the study's own reviewed evidence fields ("This
 * study used hydrogen-rich water at 1.6 ppm, 3.2 L a day for 8 days."), then a
 * clearly labeled sponsor aside listing the Echo devices whose H2 Analytics
 * measurement reaches that concentration. Pure and shared: the Next page, the
 * crawler renderer and the SPA all render renderStudyDoseModuleHtml(), so
 * every visitor and crawler gets the same HTML.
 *
 * It is a product bridge (CLAUDE.md / PLAN Appendix E), so it renders only
 * when the study's primary topic is an allowed context:
 *  - reviewed evidence fields (auto_approved or approved — never unapproved);
 *  - a human study of drinking hydrogen water, in healthy people or athletes
 *    (no patients, no named population condition);
 *  - at least one condition tag is an Appendix E claim-topic tag
 *    (shared/evidence-match CLAIM_TOPICS), and every other tag is either a
 *    claim-topic tag or a plainly allowed exercise/fatigue/oxidative-stress
 *    term — one disease or gray-area tag (inflammation, metabolic, cognitive…)
 *    and the study gets nothing;
 *  - a numeric concentration whose source text reads as a concentration
 *    (ppm, ppb, mg/L, µg/L, mM). "0.36 mg of hydrogen" is an amount, not a
 *    concentration, and never renders.
 * Default = nothing. Never inside summary text.
 */
import { BRIDGE_PROHIBITED_TERMS, isBridgeAllowed } from "./bridge-policy";
import { CLAIM_TOPICS } from "./evidence-match";
import { DOSE_MODULE, ppmLabel } from "./evidence-badge-copy";
import { buildEchoUrl, type EchoUtmContext } from "./echo-products";

export interface StudyDoseFields {
  slug: string;
  isHumanTrial: boolean;
  evidenceFieldsStatus: string | null;
  deliveryRoute: string | null;
  concentrationPpm: number | null;
  concentrationKind: string | null;
  concentrationRaw: string | null;
  doseMlPerDay: number | null;
  dosesPerDay: number | null;
  durationDays: number | null;
  populationKind: string | null;
  populationCondition: string | null;
  /** true / false as reviewed; null = not recorded (then we claim neither). */
  usedEchoDevice: boolean | null;
  healthConditions: string[];
}

export interface DoseDevice {
  slug: string;
  name: string;
  shopifyHandle: string;
  deliveryRoute: string;
  certifiedConcentrationPpm: number | null;
  lab: string | null;
  reportId: string | null;
  reportUrl: string | null;
  badgeEnabled: boolean;
  /** Free-text measurement notes; a sealed-vial figure is not drinkable. */
  measurementNote?: string | null;
}

export interface StudyDoseModule {
  topic: string;
  line: string;
  deviceIntro: string;
  devices: { name: string; ppm: string; href: string; reportId: string; reportUrl: string | null; lab: string }[];
  echoNote: string;
  disclaimer: string;
}

const APPROVED = new Set(["auto_approved", "approved"]);
const ALLOWED_POPULATIONS = new Set(["healthy", "athletes"]);
/** Tags that are plainly about exercise, fatigue or oxidative stress in healthy people. */
const ALLOWED_TAG_STEMS = ["exercise", "athletic", "muscle", "muscular", "fatigue", "oxidative-stress", "antioxidant", "sleep-quality", "skin-aging", "hydration", "general-wellness", "endurance", "physical-performance"];
const CONCENTRATION_RAW = /(ppm|ppb|mg\s*\/\s*l\b|[µμu]g\s*\/\s*l\b|[mµμu]mol\s*\/\s*l\b)/i;
const AMOUNT_RAW = /\b(mg|g|ml|µg|μg)\s+of\b/i;

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

/** The study's Appendix E topic (a CLAIM_TOPICS key) or null — the bridge decision for study pages. */
export function studyBridgeTopic(f: StudyDoseFields): string | null {
  if (!f.isHumanTrial || !APPROVED.has(String(f.evidenceFieldsStatus ?? ""))) return null;
  if (!f.populationKind || !ALLOWED_POPULATIONS.has(f.populationKind)) return null;
  if (String(f.populationCondition ?? "").trim()) return null;
  const tags = (f.healthConditions ?? []).map((t) => String(t ?? "").trim()).filter(Boolean);
  if (!tags.length) return null;
  let topic: string | null = null;
  for (const tag of tags) {
    const key = norm(tag);
    if (BRIDGE_PROHIBITED_TERMS.some((term) => key.includes(term))) return null;
    const hit = Object.entries(CLAIM_TOPICS).find(([, t]) => t.tags.some((x) => x.toLowerCase() === tag.toLowerCase()));
    if (hit) {
      topic ??= hit[0];
      continue;
    }
    if (!ALLOWED_TAG_STEMS.some((stem) => key.includes(stem))) return null;
  }
  return topic && isBridgeAllowed(CLAIM_TOPICS[topic].bridgeKey) ? topic : null;
}

/** Does the authors' wording describe a concentration (not an amount per day)? */
export function isConcentrationText(raw: string | null | undefined): boolean {
  const r = String(raw ?? "");
  return CONCENTRATION_RAW.test(r) && !AMOUNT_RAW.test(r);
}

function volume(ml: number): string {
  return ml >= 1000 ? `${Number((ml / 1000).toFixed(1))} L` : `${Math.round(ml)} mL`;
}

function duration(days: number): string {
  if (days === 1) return "on a single day";
  if (days >= 14 && days % 7 === 0) return `for ${days / 7} weeks`;
  return `for ${days} days`;
}

/** "This study used hydrogen-rich water at 1.6 ppm, 3.2 L a day for 8 days." — only the fields it has. */
export function studyDoseLine(f: StudyDoseFields): string | null {
  if (f.concentrationPpm == null || !(f.concentrationPpm > 0) || !isConcentrationText(f.concentrationRaw)) return null;
  const range = /\d\s*(?:-|–|to)\s*\d/.test(String(f.concentrationRaw ?? ""));
  let line = `${DOSE_MODULE.linePrefix} ${range ? "up to " : ""}${ppmLabel(f.concentrationPpm)}`;
  const days = f.durationDays != null && f.durationDays > 0 ? f.durationDays : null;
  const amount = f.doseMlPerDay != null && f.doseMlPerDay > 0 ? `${volume(f.doseMlPerDay)}${days === 1 ? "" : " a day"}` : "";
  if (amount) line += `, ${amount}`;
  if (days) line += ` ${duration(days)}`;
  return `${line}. ${f.concentrationKind === "measured" ? DOSE_MODULE.measured : DOSE_MODULE.stated}`;
}

/** Devices with a drinkable lab measurement at or above the studied concentration, highest first. */
export function devicesReaching(ppm: number, devices: readonly DoseDevice[]): DoseDevice[] {
  return devices
    .filter((d) => d.badgeEnabled && d.deliveryRoute === "drinking_water" && d.certifiedConcentrationPpm != null && d.reportId)
    .filter((d) => !/sealed|closed lab vial|headspace vial/i.test(String(d.measurementNote ?? "")))
    .filter((d) => (d.certifiedConcentrationPpm as number) + 1e-9 >= ppm)
    .sort((a, b) => (b.certifiedConcentrationPpm as number) - (a.certifiedConcentrationPpm as number));
}

export function buildStudyDoseModule(f: StudyDoseFields, devices: readonly DoseDevice[]): StudyDoseModule | null {
  if (f.deliveryRoute !== "drinking_water") return null;
  const topic = studyBridgeTopic(f);
  if (!topic) return null;
  const line = studyDoseLine(f);
  if (!line) return null;
  const reaching = devicesReaching(f.concentrationPpm as number, devices);
  // No device reaches it → no sponsor content at all, just nothing (the dose
  // line alone would be a bridge with no product, which helps nobody).
  if (!reaching.length) return null;
  const ctx: EchoUtmContext = { pageType: "study", slug: f.slug };
  return {
    topic,
    line,
    deviceIntro: DOSE_MODULE.deviceIntro(ppmLabel(f.concentrationPpm as number)),
    devices: reaching.map((d) => ({
      name: d.name,
      ppm: ppmLabel(d.certifiedConcentrationPpm as number),
      href: buildEchoUrl(`/products/${d.shopifyHandle}`, ctx),
      reportId: d.reportId as string,
      reportUrl: d.reportUrl,
      lab: d.lab || "H2 Analytics",
    })),
    echoNote: f.usedEchoDevice === true ? DOSE_MODULE.echoUsed : f.usedEchoDevice === false ? DOSE_MODULE.echoNotUsed : DOSE_MODULE.echoUnknown,
    disclaimer: DOSE_MODULE.disclaimer,
  };
}

// Same escaping as React's renderToStaticMarkup, so this string and the React
// view (client/src/components/study/StudyDoseModule.tsx) are byte-identical (tested).
const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#x27;");

/**
 * The crawler renderer's HTML. Next and the SPA render the same markup with
 * the React view; a test keeps the two identical.
 */
export function renderStudyDoseModuleHtml(m: StudyDoseModule): string {
  let h = `<section class="dose-module mb-8" aria-labelledby="dose-module-heading">`;
  h += `<h2 id="dose-module-heading" class="mb-3 text-xl font-semibold text-neutral-900">${esc(DOSE_MODULE.heading)}</h2>`;
  h += `<p class="leading-relaxed text-neutral-700">${esc(m.line)}</p>`;
  h += `<aside class="sponsor mt-4 rounded-lg border border-neutral-300 bg-neutral-50 p-4 text-sm text-neutral-700" aria-label="Sponsor">`;
  h += `<p class="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">${esc(DOSE_MODULE.sponsorLabel)}</p>`;
  h += `<p class="mb-2">${esc(m.deviceIntro)}</p><ul class="mb-2 list-disc pl-5">`;
  for (const d of m.devices) {
    h += `<li><a href="${esc(d.href)}" rel="sponsored noopener" class="text-primary underline">${esc(d.name)}</a>: ${esc(d.ppm)}`;
    h += d.reportUrl
      ? ` (<a href="${esc(d.reportUrl)}" rel="noopener" class="underline">${esc(d.lab)} report ${esc(d.reportId)}</a>)`
      : ` (${esc(d.lab)} report ${esc(d.reportId)})`;
    h += `</li>`;
  }
  h += `</ul><p class="mb-2">${esc(m.echoNote)}</p><p class="text-xs text-neutral-500">${esc(m.disclaimer)}</p>`;
  h += `</aside></section>`;
  return h;
}
