/**
 * Is a candidate paper about MOLECULAR HYDROGEN (H2) as studied in living
 * systems (people, animals, cells, tissues)? Josh, 2026-11-05: "auto reject
 * anything off topic — hydrogen energy, etc."
 *
 * The 2026-09-28 energy filter (study-topic-filter.ts) only removes
 * hydrogen-energy papers. The discovery queue was ~97% other noise matched on
 * the word "hydrogen": hydrogen peroxide, hydrogen sulfide, hydrogen bonds,
 * hydrogen ions/pH, H2-receptor drugs, spectroscopy, sensors, metallurgy.
 * This adds a POSITIVE requirement on top of it.
 *
 *   on_topic  — a molecular-hydrogen intervention/exposure term AND a living-
 *               system term, with no physical-science title cue
 *   off_topic — hydrogen-energy (existing filter), a publication notice, or
 *               nothing hydrogen-related left in the title/abstract once the
 *               unrelated senses (peroxide, sulfide, bonds, ions, H2O, H2S,
 *               H2-receptor drugs, dehydrogenase …) are stripped out
 *   ambiguous — everything else; a person (or the AI check in the queue
 *               cleanup script) decides
 */
import { isHydrogenEnergyStudy, type StudyTopicInput } from "./study-topic-filter";

export type HydrogenRelevance = "on_topic" | "off_topic" | "ambiguous";
export interface HydrogenRelevanceVerdict {
  verdict: HydrogenRelevance;
  reason: string;
}

/** Molecular hydrogen as an intervention or exposure. */
const H2_INTERVENTION = new RegExp(
  [
    // drinking / bathing / infusion / inhalation of H2
    String.raw`molecular hydrogen|hydrogen[- ]rich|hydrogen[- ](?:water|gas|inhal\w*|therap\w*|medicine|saline|bath\w*|nanobubbles?|saturated|dissolved|infused|tablets?|supplement\w*|treatment|administration)`,
    String.raw`inhal\w* (?:of )?(?:molecular |low[- ]concentration )?hydrogen|(?:by|with|of) (?:molecular )?hydrogen (?:against|in|on|for|attenuat|amelior|protect|reduc|improv|alleviat|suppress|prevent|inhibit)`,
    String.raw`\bHRW\b|\bHRS\b|\bH2[- ]?(?:gas|inhal\w*|water|therap\w*|treatment|rich|saline|medicine|supplement\w*|administration)\b|\bH\(2\)[- ]?(?:gas|inhal\w*|water|therap\w*|treatment|rich|saline|medicine)\b`,
    // electrolyzed / reduced / alkaline-ionized water (in scope since the database began)
    String.raw`electroly[sz]ed[- ](?:reduced|alkaline|acid\w*|oxidiz\w*|functional|hydrogen)?[- ]?water|electrochemically reduced water|(?:natural|alkaline|hexagonal)[- ]?reduced water|alkaline[- ](?:ionized|electrolyzed|reduced) water|ionized (?:alkaline )?water|reduced water`,
    // hydrogen made in the body / by materials in living systems
    String.raw`breath hydrogen|hydrogen breath|\bSIBO\b|lactulose|colonic fermentation|intestinal hydrogen|hydrogen[- ](?:producing|generating|releasing) (?:bacteri\w*|nano\w*|material|tablet|scaffold|hydrogel|platform|system|implant|microneedle|staple)`,
    String.raw`hydrogen[- ](?:production|evolution|generation|release)|hydrogenotherm\w*|palladium hydride|metal hydride nano\w*|magnesium hydride|hydrogen[- ]occlud\w*|magnesium (?:implant|staple|alloy)s?|(?:medical )?gas therapy|gas[- ]releasing`,
  ].join("|"),
  "i",
);

/** Living systems (people, animals, cells, tissues, physiology). */
const LIVING =
  /\b(?:patients?|participants?|subjects?|volunteers?|athletes?|humans?|adults?|children|women|men|rats?|mice|mouse|murine|pigs?|porcine|rabbits?|dogs?|zebrafish|cells?|tissues?|organs?|in vivo|in vitro|clinical|trials?|serum|plasma|blood|brain|liver|kidney|heart|lung|skin|muscle|gut|intestin\w*|mitochondri\w*|inflammat\w*|oxidative stress|injury|disease|syndrome|therapy|treatment)\b/i;

/** Physical-science title cues: the paper is about hydrogen as a substance, not a treatment. */
const PHYSICAL_TITLE =
  /spectroscop\w*|\balloys?\b|\bsensors?\b|gas response|catalys\w*|electrod\w*|batter\w*|combustion|semiconductor|thin film|\bsteel\b|embrittlement|astro\w*|interstellar|collision|isotop\w*|adsorption|ironsand|titanomagnetite|ore pellets|hydride storage|permeation|diffusion in|quantum|plasma physics|reaction dynamics|potential energy surface|molecular hydrogen ions/i;

/**
 * Uses of "hydrogen"/"H2" that are NOT molecular hydrogen. Stripped from the
 * text before looking for any remaining hydrogen-related term.
 */
const UNRELATED_SENSES =
  /hydrogen[- ](?:peroxide|sulfide|sulphide|sulfate|sulfite|bond\w*|ions?|cyanide|isotope\w*|exchange|atoms?|abstraction|transfer|chloride|fluoride|flouride|carbonate|phosphate|oxalate|tartrate|citrate|sulfonate|nuclei|nucleus|spin|NMR|deuterium exchange)|\bH2O2\b|\bH\(2\)O\(2\)|\bH2S\b|\bH\(2\)S\b|\bH2O\b|\bH\(2\)O\b|\bH2[- ]?(?:receptors?|blockers?|antagonists?|RAs?)\b|histamine H2|\bdehydrogenas\w*|\bhydrogenas\w*|\bhydrogenat\w*|\bdihydro(?!gen)\w+|\bhydrogen[- ]?(?:bonded|bonding)/gi;

/** Anything hydrogen-related left after stripping unrelated senses. */
const ANY_HYDROGEN =
  /\bhydrogen\w*|\bH2\b|\bH\(2\)|H<sub>2<\/sub>|H&lt;sub&gt;2|\bdihydrogen\b|electroly\w*|reduced water|alkaline[- ]?(?:ionized |reduced )?water|ionized water|medical gas\w*|gas therap\w*|gas biology|\bSIBO\b|lactulose|breath test|hydride|nano-?bubble|alkal\w*[\s\-‐‑]+(?:ionized |reduced |hexagonal )?water|ionized alkali|magnesium[\s\-‐‑]+(?:based|micromotor\w*|implant\w*|staple\w*)|gas(?:es)?[\s\-‐‑]+(?:generating|based|releasing|producing)|gastrointestinal gases|reduction potential|\bORP\b/i;

const NOTICE = /^\s*(?:\[retracted\]|retracted\b|retraction\b|correction\b|corrigendum\b|erratum\b|expression of concern\b|withdrawn\b)/i;

function text(v: unknown): string {
  return Array.isArray(v) ? v.filter(Boolean).join(" ; ") : String(v ?? "");
}

export function molecularHydrogenRelevance(input: StudyTopicInput): HydrogenRelevanceVerdict {
  const title = text(input.title);
  if (NOTICE.test(title)) return { verdict: "off_topic", reason: "publication notice (correction/retraction)" };
  const energy = isHydrogenEnergyStudy(input);
  if (energy.excluded) return { verdict: "off_topic", reason: energy.reason ?? "hydrogen energy" };

  const all = `${title}\n${text(input.keywords)}\n${text(input.abstract)}`;
  const intervention = H2_INTERVENTION.test(all);
  const living = LIVING.test(all);
  const physicalTitle = PHYSICAL_TITLE.test(title);

  if (intervention && living && !physicalTitle) return { verdict: "on_topic", reason: "molecular hydrogen in a living system" };
  const residual = all.replace(UNRELATED_SENSES, " ");
  if (!intervention && !ANY_HYDROGEN.test(residual)) {
    return { verdict: "off_topic", reason: "no molecular hydrogen (only peroxide, sulfide, hydrogen bonds, ions, H2O/H2S or unrelated chemistry)" };
  }
  return { verdict: "ambiguous", reason: intervention ? "hydrogen term without a clear living-system context" : "'hydrogen' in the title without an intervention term" };
}
