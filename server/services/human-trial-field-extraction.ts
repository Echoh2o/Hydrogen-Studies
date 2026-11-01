/**
 * Structured-field extraction for HUMAN studies (h2_concentration,
 * dosage_protocol, duration, sample_size, funding_sources,
 * conflict_of_interest) from Europe PMC open-access full text when available,
 * otherwise the abstract.
 *
 * Anti-guessing policy (every proposal must survive all of these):
 *   - the model must return a verbatim evidence quote for each value;
 *   - the quote must be found in the source text we sent (alphanumeric-only
 *     comparison, so whitespace/quote-style drift doesn't matter);
 *   - numeric values must be traceable to numbers inside the quote;
 *   - fields are proposed only where the stored value is empty.
 * Anything failing a check is dropped (reported as `rejected`, never written).
 *
 * Column formats (shared/schema.ts): h2_concentration varchar(100);
 * dosage_protocol text; duration integer (days); sample_size integer;
 * funding_sources text, ";"-separated (StudyInfoPanel splits on ";");
 * conflict_of_interest text.
 */
import * as cheerio from "cheerio";
import { ai, MODELS } from "./ai-provider";

export const HUMAN_FIELDS = [
  "h2_concentration",
  "dosage_protocol",
  "duration",
  "sample_size",
  "funding_sources",
  "conflict_of_interest",
] as const;
export type HumanField = (typeof HUMAN_FIELDS)[number];

/** Normalized "explicitly none" values — avoid verbatim boilerplate (the
 *  scoring service red-flags any COI text containing "conflict of interest"). */
export const NO_FUNDING = "No external funding declared";
export const NO_COI = "None declared";

export interface SourceText {
  kind: "fulltext" | "abstract";
  abstract: string;
  methods: string;
  funding: string;
  coi: string;
}

export interface CurrentValues {
  h2_concentration: string | null;
  dosage_protocol: string | null;
  duration: number | null;
  sample_size: number | null;
  funding_sources: string | null;
  conflict_of_interest: string | null;
}

export interface Proposal {
  field: HumanField;
  value: string | number;
  source: "fulltext" | "abstract";
  evidence: string;
}

export interface Rejection {
  field: HumanField;
  value: unknown;
  reason: string;
  evidence: string;
}

const squash = (s: string) => s.replace(/\s+/g, " ").trim();

// ---------------------------------------------------------------------------
// JATS sectioning
// ---------------------------------------------------------------------------

const METHODS_TITLE = /method|material|patients?\b|participants?|subjects?\b|study design|design\b|protocol|intervention|procedure|trial/i;
const FUNDING_TITLE = /fund|financ|grant|support|acknowledg/i;
const COI_TITLE = /conflict|competing|disclos|declaration of interest|duality/i;
const MAX_METHODS = 14_000;
const MAX_BACK = 3_000;

/**
 * Pull abstract / methods / funding / COI text out of Europe PMC JATS XML.
 * Returns null when the XML has no usable body (e.g. abstract-only records).
 */
export function sectionJats(xml: string): Omit<SourceText, "kind"> | null {
  // Pad block-level closers so .text() doesn't glue words across tags.
  const padded = xml.replace(/<\/(p|title|td|th|li|label|sec|fn|ack|funding-statement|award-group)>/g, " </$1>");
  const $ = cheerio.load(padded, { xmlMode: true });
  $("ref-list, table-wrap, fig, xref, inline-formula, disp-formula").remove();
  const text = (el: any) => squash($(el).text());

  const abstract = squash($("article-meta abstract").map((_, el) => text(el)).get().join(" "));

  const methodsParts: string[] = [];
  $("body > sec").each((_, el) => {
    const title = squash($(el).children("title").first().text());
    const type = $(el).attr("sec-type") ?? "";
    if (/method|material|subject/i.test(type) || METHODS_TITLE.test(title)) methodsParts.push(text(el));
  });
  const bodyText = squash($("body").text());
  if (!bodyText && !abstract) return null;
  // No recognisable methods heading: fall back to the start of the body.
  const methods = (methodsParts.join(" ") || bodyText).slice(0, MAX_METHODS);

  const funding = new Set<string>();
  const coi = new Set<string>();
  $("funding-group, funding-statement").each((_, el) => { const t = text(el); if (t) funding.add(t); });
  $("ack").each((_, el) => { const t = text(el); if (t) funding.add(t); });
  $("fn").each((_, el) => {
    const type = $(el).attr("fn-type") ?? "";
    const t = text(el);
    if (!t) return;
    if (/coi|conflict|competing/i.test(type) || COI_TITLE.test(t.slice(0, 60))) coi.add(t);
    else if (/financial|supported|fund/i.test(type) || /^\s*(funding|financial support)/i.test(t)) funding.add(t);
  });
  $("sec, notes").each((_, el) => {
    const title = squash($(el).children("title").first().text());
    const type = $(el).attr("sec-type") ?? $(el).attr("notes-type") ?? "";
    if (!title && !type) return;
    if (COI_TITLE.test(title) || /coi|conflict|competing/i.test(type)) coi.add(text(el));
    else if (FUNDING_TITLE.test(title) || /fund|financ|ack/i.test(type)) funding.add(text(el));
  });
  // Statements that live in plain paragraphs (often unheaded back matter).
  $("back p, notes p, fn-group p").each((_, el) => {
    const t = text(el);
    if (/conflicts? of interest|competing interests?|declare no|declares no/i.test(t)) coi.add(t);
    else if (/\bfunded by\b|\bgrant\b|was supported by|financial support|received no (specific |external )?funding/i.test(t)) funding.add(t);
  });

  const join = (s: Set<string>) => [...s].filter(Boolean).join(" | ").slice(0, MAX_BACK);
  return { abstract, methods, funding: join(funding), coi: join(coi) };
}

// ---------------------------------------------------------------------------
// Prompt
// ---------------------------------------------------------------------------

export const HUMAN_EXTRACTION_SYSTEM_PROMPT = `You extract facts from a HUMAN clinical study of molecular hydrogen (H2). Use ONLY the supplied text. NEVER guess, infer, or use outside knowledge. If the text does not explicitly state a value, return null for it.

For every non-null value you MUST give "evidence": ONE exact, verbatim, contiguous quote (max 200 characters) copied from the supplied text that states the value. Never join several quotes, never use "..." or "and" to stitch fragments, never paraphrase. If no single quote states the value, return null.

Values must describe THIS study's own protocol and participants — not background/introduction text, other trials, eligibility criteria, or sample-size calculations for a different number than was enrolled. Never infer "none" from the absence of a statement.

Return JSON:
{
  "h2_concentration": {"value": string|null, "evidence": string|null}   // H2 concentration of the hydrogen itself as stated, short, with units, e.g. "1.6 ppm", "0.8 mM", "2% H2 gas", "1.2 mg/L". NOT a water/gas volume, flow rate, or tablet count.
  "dosage_protocol": {"value": string|null, "evidence": string|null}    // how the H2 was given in this study, with amount and/or frequency and/or length, max 300 chars, e.g. "500 mL H2-rich water twice daily for 8 weeks". null if the text only names the intervention without specifics.
  "duration_days": {"value": integer|null, "evidence": string|null}     // intervention length converted to days (1 week = 7, 1 month = 30, 1 year = 365); a single session lasting hours/minutes = 1; null if no length is stated.
  "sample_size": {"value": integer|null, "evidence": string|null}       // total number of human participants enrolled/randomized (all arms combined)
  "funding_sources": {"value": string[]|"none_declared"|null, "evidence": string|null}  // funders with grant numbers as stated, e.g. ["JSPS KAKENHI (JP19K11500)"]; only organisations that funded the study itself (not people thanked, not article-processing-charge or publication-fee support); attach a grant number to a funder only if the text pairs them; "none_declared" ONLY if the text says the study received no funding
  "conflict_of_interest": {"value": string|"none_declared"|null, "evidence": string|null}  // "none_declared" if authors declare no conflicts; otherwise a short factual summary (max 300 chars) of the declared interests, e.g. "Author X is an employee of Y, which sells H2 generators"
}`;

export function buildHumanExtractionPrompt(title: string | null, src: SourceText): string {
  const parts = [`Title: ${title || "Not available"}`, `Abstract: ${src.abstract || "Not available"}`];
  if (src.kind === "fulltext") {
    parts.push(`Methods (full text excerpt): ${src.methods || "Not available"}`);
    parts.push(`Funding / acknowledgements: ${src.funding || "Not available"}`);
    parts.push(`Conflict of interest statements: ${src.coi || "Not available"}`);
  }
  return parts.join("\n\n");
}

// ---------------------------------------------------------------------------
// Verification
// ---------------------------------------------------------------------------

const alnum = (s: string) =>
  s.normalize("NFKD").toLowerCase().replace(/[‐-―]/g, "-").replace(/[^a-z0-9]+/g, "");

/** Where (if anywhere) the quote occurs in the source we sent. */
export function locateEvidence(evidence: string, title: string | null, src: SourceText): "abstract" | "fulltext" | null {
  const q = alnum(evidence);
  if (q.length < 6) return null;
  if (alnum(`${title ?? ""} ${src.abstract}`).includes(q)) return "abstract";
  if (src.kind === "fulltext" && alnum(`${src.methods} ${src.funding} ${src.coi}`).includes(q)) return "fulltext";
  return null;
}

const WORD_NUMS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, fourteen: 14, fifteen: 15, sixteen: 16, eighteen: 18, twenty: 20,
  thirty: 30, forty: 40, fifty: 50, sixty: 60, hundred: 100,
};

export function numbersIn(s: string): number[] {
  // Drop digits glued to letters (H2, O2, JP19K…) — formulas and codes, not counts.
  const cleaned = s.replace(/[A-Za-z]+\d[A-Za-z\d]*/g, " ").replace(/(\d),(\d{3})\b/g, "$1$2");
  const nums = (cleaned.match(/\d+(?:\.\d+)?/g) ?? []).map(Number);
  for (const w of s.toLowerCase().match(/[a-z]+/g) ?? []) if (WORD_NUMS[w]) nums.push(WORD_NUMS[w]);
  return nums;
}

/**
 * sample_size must appear in the quote, or equal the sum of its integers (arm
 * sizes) — digits-only first, so "two groups (n = 30) and (n = 30)" sums to 60.
 */
export function sampleSizeTraceable(n: number, evidence: string): boolean {
  const nums = numbersIn(evidence).filter(Number.isInteger);
  if (nums.includes(n)) return true;
  const digits = (evidence.replace(/[A-Za-z]+\d[A-Za-z\d]*/g, " ").match(/\d+/g) ?? []).map(Number);
  const sums = (xs: number[]) => xs.length > 1 && xs.length <= 6 && xs.reduce((a, b) => a + b, 0) === n;
  return sums(digits) || sums(nums);
}

/** Days per unit for "<number> <unit>" phrases in a duration quote. */
const DURATION_UNITS: Array<[RegExp, number[]]> = [
  [/^(years?|yrs?)\b/i, [365]],
  [/^(months?|mo)\b/i, [28, 30, 30.4, 31]],
  [/^(weeks?|wks?)\b/i, [7]],
  [/^(days?|d)\b/i, [1]],
  [/^(nights?)\b/i, [1]],
];
const WORD_NUM_RE = new RegExp(`\\b(\\d+(?:\\.\\d+)?|${Object.keys(WORD_NUMS).join("|")})\\b[\\s-]*`, "gi");

/**
 * duration (days) must be a unit conversion of a "<number> <unit>" phrase in
 * the quote. 1 day additionally accepts a quoted sub-day exposure
 * ("30-min inhalation", "for 2 hr", "a single session").
 */
export function durationTraceable(days: number, evidence: string): boolean {
  if (days === 1 && (/\d+(\.\d+)?[\s-]*(min(ute)?s?|h|hr|hrs|hours?)\b/i.test(evidence) || /\bsingle (session|dose|bout|administration|exposure)\b/i.test(evidence))) {
    return true;
  }
  for (const m of evidence.matchAll(WORD_NUM_RE)) {
    const raw = m[1].toLowerCase();
    const n = /^\d/.test(raw) ? Number(raw) : WORD_NUMS[raw];
    const rest = evidence.slice((m.index ?? 0) + m[0].length);
    const unit = DURATION_UNITS.find(([re]) => re.test(rest));
    if (n && unit && unit[1].some((f) => Math.abs(n * f - days) <= Math.max(1, days * 0.02))) return true;
  }
  return false;
}

const CONCENTRATION_UNIT = /(ppm|ppb|mg\s*\/\s*l|[µμu]g\s*\/\s*l|m?mol\s*\/\s*l|[µμu]mol|\bm?m\b|[µμu]m\b|%|percent|vol)/i;

/** A concentration needs a concentration unit, and its leading number must be quoted. */
export function concentrationTraceable(value: string, evidence: string): boolean {
  const first = value.match(/\d+(?:\.\d+)?/)?.[0];
  if (!first || !CONCENTRATION_UNIT.test(value)) return false;
  return numbersIn(evidence).includes(Number(first));
}

/** A protocol must say something concrete: an amount, a frequency, or a length. */
export function dosageSpecific(value: string, evidence: string): boolean {
  const concrete = /\d|\b(once|twice|daily|weekly|per day|a day|times)\b/i;
  return concrete.test(value) && concrete.test(evidence);
}

/** A "none" value needs a quote that actually says none. */
const NO_FUNDING_EVIDENCE = /\bno (specific |external |financial )?(funding|grant|financial support)|not (receive|funded|supported)|without (any )?funding|unfunded|received no\b|\b(funding|financial support|grants?|sources? of support)\b[^.]{0,30}\b(none|nil)\b/i;
const NO_COI_EVIDENCE = /\b(no|not|none|nothing|absence)\b[^.]{0,60}\b(conflicts?|competing|interests?|disclos|relationships?)|nothing to disclose|\bnone\b/i;

const isEmpty = (v: unknown) =>
  v === null || v === undefined || (typeof v === "string" && v.trim() === "") || (typeof v === "number" && v <= 0);

const str = (v: unknown, max: number) => (typeof v === "string" && v.trim() ? squash(v).slice(0, max) : null);
const int = (v: unknown, max: number) =>
  typeof v === "number" && Number.isFinite(v) && v > 0 && v <= max ? Math.round(v) : typeof v === "string" && /^\d+$/.test(v.trim()) && Number(v) > 0 && Number(v) <= max ? Number(v) : null;

/**
 * Turn the model's JSON into fill-empty-only proposals. Pure — unit tested.
 */
export function verifyExtraction(
  raw: Record<string, any>,
  title: string | null,
  src: SourceText,
  current: CurrentValues,
): { proposals: Proposal[]; rejected: Rejection[] } {
  const proposals: Proposal[] = [];
  const rejected: Rejection[] = [];
  const consider = (field: HumanField, rawKey: string, coerce: (v: unknown) => string | number | null, trace?: (v: any, ev: string) => boolean) => {
    const entry = raw?.[rawKey];
    if (!entry || typeof entry !== "object") return;
    const value = coerce(entry.value);
    if (value === null) return;
    if (!isEmpty(current[field])) return; // fill-empty-only
    const evidence = typeof entry.evidence === "string" ? squash(entry.evidence).slice(0, 200) : "";
    const where = evidence ? locateEvidence(evidence, title, src) : null;
    if (!where) return void rejected.push({ field, value, reason: "evidence not found in source", evidence });
    if (trace && !trace(value, evidence)) return void rejected.push({ field, value, reason: "value not traceable to evidence", evidence });
    proposals.push({ field, value, source: where, evidence });
  };

  consider("h2_concentration", "h2_concentration", (v) => str(v, 100), (v, ev) => concentrationTraceable(v, ev));
  consider("dosage_protocol", "dosage_protocol", (v) => str(v, 500), (v, ev) => dosageSpecific(v, ev));
  consider("duration", "duration_days", (v) => int(v, 36_500), (v, ev) => durationTraceable(v, ev));
  consider("sample_size", "sample_size", (v) => int(v, 1_000_000), (v, ev) => sampleSizeTraceable(v, ev));
  consider("funding_sources", "funding_sources", (v) => {
    if (v === "none_declared") return NO_FUNDING;
    if (Array.isArray(v)) {
      const items = v.map((x) => str(x, 300)).filter((x): x is string => !!x && !x.includes(";"));
      return items.length ? items.join("; ").slice(0, 1000) : null;
    }
    return str(v, 1000);
  }, (v, ev) => v !== NO_FUNDING || NO_FUNDING_EVIDENCE.test(ev));
  consider("conflict_of_interest", "conflict_of_interest", (v) => (v === "none_declared" ? NO_COI : str(v, 500)),
    (v, ev) => v !== NO_COI || NO_COI_EVIDENCE.test(ev));
  return { proposals, rejected };
}

export async function extractHumanTrialFields(title: string | null, src: SourceText): Promise<Record<string, any>> {
  return ai.generateJSON<Record<string, any>>(HUMAN_EXTRACTION_SYSTEM_PROMPT, buildHumanExtractionPrompt(title, src), {
    model: MODELS.HAIKU,
    maxTokens: 1200,
    temperature: 0,
    caller: "human-trial-field-extraction",
  });
}
