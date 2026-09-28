/**
 * Study topic filter — flags hydrogen-ENERGY research so it never reaches a
 * consumer-health database about molecular hydrogen (H2) for human health.
 *
 * Off-topic (flagged): biohydrogen / dark- or photo-fermentation for H2,
 * fuel cells, electrolyzers / industrial water electrolysis, the hydrogen
 * evolution reaction, hydrogen storage/carriers, hydrogen embrittlement,
 * H2 combustion/engines, pipelines, hydrogen economy/policy, and biogas /
 * bioenergy process engineering.
 *
 * On-topic (never flagged): hydrogen-rich water, H2 inhalation, hydrogen-rich
 * saline, hydrogen baths, H2 nanomedicine (photocatalytic/electrocatalytic H2
 * generators used as THERAPY), gut-microbial H2 production and breath tests,
 * hydrogen peroxide, hydrogen sulfide, deuterium, hydrogen bonding, etc.
 *
 * Precision over recall: a study is flagged only when it carries explicit
 * energy vocabulary AND no medical/biological-health vocabulary. Any health
 * term in the title or keywords vetoes the flag outright. Pure (no I/O) so it
 * runs in the import pipeline, the admin study finder, scripts and tests.
 *
 * Owner approval: josh 2026-09-28 "Remove hydrogen energy studies".
 */

export type TopicConfidence = "high" | "medium";

export interface StudyTopicInput {
  title?: string | null;
  abstract?: string | null;
  keywords?: ReadonlyArray<string | null | undefined> | string | null;
  category?: string | null;
  journal?: string | null;
}

export interface StudyTopicVerdict {
  /** true → do not import / do not show publicly. */
  excluded: boolean;
  confidence: TopicConfidence | null;
  /** Short human-readable explanation, e.g. "hydrogen energy: biohydrogen, dark fermentation". */
  reason: string | null;
  /** Energy signal labels found (title/keywords/abstract). */
  energySignals: string[];
  /** Health signal labels found (these veto a flag). */
  healthSignals: string[];
}

type Signal = readonly [label: string, pattern: RegExp];

/**
 * CORE hydrogen-energy technology terms. Specific enough that, absent any
 * health vocabulary, they mean energy/industrial hydrogen research.
 */
const CORE_ENERGY: readonly Signal[] = [
  ["biohydrogen", /\bbio-?hydrogen\b|\bbio-?h2\b/i],
  ["dark fermentation", /\bdark[- ]fermentat/i],
  ["photo-fermentation", /\bphoto-?fermentat/i],
  ["biophotolysis", /\bbio-?photolysis\b/i],
  ["fuel cell", /\bfuel[- ]cells?\b|\bPEMFCs?\b|\bSOFCs?\b/i],
  ["electrolyzer", /\belectroly[sz]ers?\b|\bmicrobial electrolysis cells?\b/i],
  [
    "industrial water electrolysis",
    /\b(?:alkaline|PEM|proton[- ]exchange[- ]membrane|anion[- ]exchange[- ]membrane|solid[- ]oxide|high[- ]temperature)\s+(?:water\s+)?electroly(?:sis|tic cells?)\b/i,
  ],
  [
    "hydrogen evolution reaction",
    /\bhydrogen evolution (?:reactions?|reactivity|activity|performance|catalys\w*|electrocatalys\w*)\b|\b(?:enhanced|efficient|alkaline|acidic|seawater|overall) hydrogen evolution\b|\boxygen (?:evolution|reduction) reactions?\b|\boxygen reduction electrocatalysts?\b/i,
  ],
  [
    "catalytic H2 production",
    /\b(?:electro|photo(?:electro)?|sono|piezo)-?catalytic (?:hydrogen|h2) (?:evolution|production|generation)\b/i,
  ],
  ["electrocatalyst", /\belectrocatalysts?\b/i],
  ["water splitting", /\bwater[- ]splitting\b|\bseawater electrolysis\b/i],
  ["thermochemical H2", /\bthermochemical (?:redox )?(?:cycles?|water|hydrogen)\b|\bsolar thermochemical\b/i],
  ["reforming/gasification", /\b(?:steam|dry|methane|electro)[- ]reforming\b|\bwater[- ]gas shift\b|\bgasification\b|\bsyngas\b/i],
  ["hydrogen sensor", /\b(?:hydrogen|h2) (?:gas )?(?:sensors?|sensing)\b|\bh2 gas response\b/i],
  [
    "hydrogen in metals",
    /\b(?:dissolved )?hydrogen (?:atoms? )?(?:absorption|solubility|permeation|diffusion|in)\b[^.]{0,40}\b(?:metals?|alloys?|steels?|palladium|zirconium|titanium)\b/i,
  ],
  ["hydrogen embrittlement", /\bhydrogen[- ](?:induced |assisted )?(?:embrittlement|cracking)\b/i],
  ["hydrogen carrier (LOHC)", /\bliquid organic hydrogen carriers?\b|\bLOHCs?\b/i],
  ["hydrogen storage", /\bhydrogen storage\b|\bstorage (?:media|materials?) for (?:molecular )?hydrogen\b/i],
  [
    "hydrogen combustion/engine",
    /\bhydrogen[- ](?:fuel(?:l)?ed|powered)\b|\bhydrogen (?:combustion|engines?|internal combustion|blend(?:ing|ed)?|enrich(?:ed|ment) (?:natural gas|methane|fuel))\b|\binternal combustion engines?\b|\bdual[- ]fuel\b|\bgas turbines?\b|\bcombustors?\b|\blaminar (?:burning|flame)\b|\bpremixed h2\b/i,
  ],
  ["hydrogen pipeline", /\b(?:natural[- ]gas|hydrogen) pipelines?\b|\bpipeline steels?\b/i],
  [
    "hydrogen economy/policy",
    /(?<!microbial )(?<!colonic )(?<!gut )(?<!intestinal )\bhydrogen (?:economy|economies|strategy|strategies|policy|policies|infrastructure|refuel(?:l)?ing|valleys?|hubs?|supply chains?|market)\b/i,
  ],
  ["green/blue hydrogen", /\b(?:green|blue|grey|gray|turquoise|low[- ]carbon|renewable) hydrogen\b/i],
  ["hydrogen fuel", /\bhydrogen (?:as (?:a )?)?fuels?\b|\bH2 fuel\b/i],
  ["solar-to-hydrogen", /\bsolar[- ]to[- ]hydrogen\b|\bSTH efficienc/i],
  ["hydrogen yield", /\b(?:hydrogen|H2) (?:yields?|productivit(?:y|ies)|production rates?)\b/i],
];

/** Energy CONTEXT terms — supportive evidence, never sufficient alone. */
const ENERGY_CONTEXT: readonly Signal[] = [
  ["renewable/clean energy", /\b(?:renewable|sustainable|clean|alternative|green) energ(?:y|ies)\b/i],
  ["bioenergy", /\bbio-?energy\b/i],
  ["biofuel", /\bbio-?fuels?\b/i],
  ["energy transition/system", /\benergy (?:transition|carriers?|storage|security|systems?|sectors?|vectors?|demand|conversion)\b/i],
  ["decarbonization", /\bdecarboni[sz]/i],
  ["fossil fuel", /\bfossil fuels?\b/i],
  ["techno-economic", /\btechno-?economic\b|\blevel(?:l)?ized cost\b|\bLCOH\b/i],
  ["power-to-gas", /\bpower[- ]to[- ](?:gas|x|hydrogen)\b/i],
  ["anaerobic digestion", /\banaerobic digest(?:ion|ers?)\b/i],
  ["biogas", /\bbiogas\b|\bbiomethane\b|\bmethane (?:recovery|yields?)\b/i],
  ["wastewater/waste feedstock", /\bwastewaters?\b|\b(?:food|kitchen|organic|agricultural|municipal|solid) wastes?\b|\bmanure\b|\blignocellulos/i],
  ["water electrolysis", /\bwater electrolysis\b/i],
  ["energy efficiency", /\benergy[- ]efficient\b|\bbiomass\b|\b(?:waste )?plastics? waste\b|\bwaste plastics?\b|\burea (?:degradation|oxidation|electrolysis)\b/i],
  ["electrocatalyst overpotential", /\boverpotentials?\b|\bTafel slope\b/i],
  [
    "energy journal",
    /\b(?:international journal of hydrogen energy|journal of power sources|renewable (?:and sustainable )?energy|applied energy|energy (?:&|and) fuels|energy conversion and management|acs energy letters|bioresource technology|fuel processing technology)\b/i,
  ],
];

/**
 * HEALTH / biomedical vocabulary. Any hit in the title or keywords vetoes the
 * flag; abstract hits are tolerated only in tiny numbers (see decide()).
 */
const HEALTH: readonly Signal[] = [
  ["therapy", /\btherap(?:y|ies|eutic|eutics|eutically)\b/i],
  ["treatment", /\btreat(?:ment|ments|ing|ed|s)?\b/i],
  ["patients", /\bpatients?\b|\bparticipants?\b|\bvolunteers?\b/i],
  ["clinical", /\bclinical\b|\brandomi[sz]ed\b|\bplacebo\b|\bcohort\b/i],
  ["disease", /\bdiseases?\b|\bdisorders?\b|\bsyndromes?\b|\bpatholog/i],
  ["cancer", /\bcancers?\b|\btumou?rs?\b|\bcarcinoma|\boncolog/i],
  ["inflammation", /\binflamm/i],
  ["oxidative stress", /\boxidative (?:stress|damage|injury)\b|\bantioxidan/i],
  ["animal model", /\b(?:mice|mouse|murine|rats?|rodents?|piglets?|rabbits?)\b/i],
  ["in vivo", /\bin vivo\b/i],
  ["medicine", /\bmedic(?:al|ine|inal)\b|\bbiomedic|\bnanomedicine\b|\bpharmac/i],
  [
    "hydrogen medicine",
    /\bhydrogen (?:therapy|medicine|gas therapy|inhalation)\b|\bhydrogen[- ]rich\b(?!\s+(?:syngas|gas\b|fuel|streams?|feed))|\bhydrogen(?:ated)? water\b|\belectroly[sz]ed (?:reduced )?water\b|\breduced water\b|\bsaline\b/i,
  ],
  ["inhalation", /\binhal(?:ation|ed|ing)\b|\bnebuli[sz]/i],
  ["breath test", /\bbreath\b|\bSIBO\b/i],
  ["gut", /\bgut\b|\bintestin|\bcolon(?:ic)?\b|\bcolitis\b|\bca?ecal\b|\bfa?ecal\b|\bmicrobiota\b|\bmicrobiome\b/i],
  ["human", /\bhumans?\b|\bwomen\b|\bmen\b|\bchildren\b|\badults?\b|\belderly\b|\bathletes?\b/i],
  ["health", /\bhealth(?:y|care)?\b|\bwell-?being\b/i],
  ["injury", /\binjur(?:y|ies)\b|\bwounds?\b|\bischemi|\bischaemi|\bsepsis\b|\bstroke\b/i],
  [
    "biomedical device",
    /\bimplants?\b|\bnon-?invasive\b|\bbiodegrad|\bbiocompatib|\bbiomaterials?\b|\bwearable\b|\bphysiolog/i,
  ],
  [
    "organ/physiology",
    /\b(?:brain|heart|cardi\w+|liver|hepat\w+|kidneys?|renal|lungs?|pulmonary|skin|dermal|bones?|osteo\w+|muscles?|blood|plasma|serum|neuro\w+|diabet\w+|obes\w+|arthrit\w+|apoptosis|ferroptosis|pyroptosis|mitochondri\w*|immun\w+|cognit\w+|periodont\w+|dental|ocular|retina\w*)\b/i,
  ],
];

/**
 * Phrases that contain a health word but are not health (process-engineering
 * uses of "treatment", etc.). Removed before HEALTH matching.
 */
const NON_HEALTH_PHRASES =
  /\b(?:waste-?water|sewage|sludge|effluent|water|heat|thermal|acid|alkal(?:i|ine)|chemical|surface|plasma|pre-?)[- ]?treat(?:ment|ments|ed)\b|\bpre-?treat(?:ment|ments|ed|ing)?\b|\benvironmental health\b|\bstate of health\b|\bstructural health\b|\bbattery health\b|\bplasma (?:electrolytic|spray|discharge|treatment)\b/gi;

/** Weak "H2 is being produced" phrasing — used only to open the medium path. */
const H2_PRODUCTION = /\b(?:hydrogen|h2)[- ]?(?:production|producing|generation|evolution)\b|\bproduction of (?:molecular )?hydrogen\b|\bhydrogen[- ]producing\b|\bproduce[sd]? hydrogen\b/i;

function normalize(text: string | null | undefined): string {
  if (!text) return "";
  return String(text)
    .replace(/<[^>]+>/g, "") // H<sub>2</sub> → H2, <i>…</i> → …
    .replace(/&amp;/g, "&")
    .replace(/&lt;|&gt;/g, " ")
    .replace(/&[a-z]+;|&#\d+;/gi, " ")
    .replace(/₂/g, "2")
    .replace(/[‐-―−]/g, "-")
    // Detach glued citation markers ("hydrogen economies3,5." → "economies 3,5")
    // so word boundaries hold; needs ≥3 lowercase letters so H2/CO2/MgH2 stay.
    .replace(/([a-z]{3,})(\d+(?:[,–-]\d+)*)(?=[\s.,;:)]|$)/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim();
}

function keywordText(input: StudyTopicInput): string {
  const kw = input.keywords;
  const parts: string[] = [];
  if (Array.isArray(kw)) parts.push(...kw.filter((k): k is string => typeof k === "string"));
  else if (typeof kw === "string") parts.push(kw);
  if (input.category) parts.push(input.category);
  return normalize(parts.join("; "));
}

function matchLabels(text: string, signals: readonly Signal[]): string[] {
  if (!text) return [];
  const out: string[] = [];
  for (const [label, re] of signals) if (re.test(text)) out.push(label);
  return out;
}

function healthLabels(text: string): string[] {
  return matchLabels(text.replace(NON_HEALTH_PHRASES, " "), HEALTH);
}

const NOT_EXCLUDED = (energySignals: string[], healthSignals: string[]): StudyTopicVerdict => ({
  excluded: false,
  confidence: null,
  reason: null,
  energySignals,
  healthSignals,
});

/**
 * Classify one study (or search result / import candidate).
 *
 *   high   — title names a core hydrogen-energy technology (or says H2 is
 *            being produced while keywords/abstract name one), ≥2 distinct
 *            energy signals overall, no health term in title/keywords and at
 *            most one in the abstract.
 *   medium — no health term anywhere, and either a core signal in the title
 *            or ≥1 core + ≥1 context signal (or ≥3 context signals with
 *            "hydrogen" in the title) across keywords/abstract/journal.
 *
 * Both confidences set `excluded: true`; the confidence is carried into
 * reports so a human can review medium rows first.
 */
export function isHydrogenEnergyStudy(input: StudyTopicInput): StudyTopicVerdict {
  const title = normalize(input.title);
  const kw = keywordText(input);
  const abs = normalize(input.abstract);
  const journal = normalize(input.journal);

  const coreTitle = matchLabels(title, CORE_ENERGY);
  const coreRest = matchLabels(`${kw}\n${abs}`, CORE_ENERGY);
  const ctxAll = matchLabels(`${title}\n${kw}\n${abs}\n${journal}`, ENERGY_CONTEXT);
  const core = Array.from(new Set([...coreTitle, ...coreRest]));
  const energySignals = Array.from(new Set([...core, ...ctxAll]));

  const healthTitle = healthLabels(title);
  const healthKw = healthLabels(kw);
  const healthAbs = healthLabels(abs);
  const healthSignals = Array.from(new Set([...healthTitle, ...healthKw, ...healthAbs]));

  if (energySignals.length === 0) return NOT_EXCLUDED(energySignals, healthSignals);
  // Health framing in the title or keywords always wins (hydrogen therapy,
  // "microbial hydrogen economy alleviates colitis", H2 nanogenerators, ...).
  if (healthTitle.length > 0 || healthKw.length > 0) return NOT_EXCLUDED(energySignals, healthSignals);

  const titleSaysProduction = H2_PRODUCTION.test(title);
  const titleSaysHydrogen = /\bhydrogen\b|\bh2\b/i.test(title);

  const high =
    healthAbs.length <= 1 &&
    energySignals.length >= 2 &&
    (coreTitle.length >= 1 || (titleSaysProduction && coreRest.length >= 1));

  const medium =
    !high &&
    healthAbs.length === 0 &&
    (coreTitle.length >= 1 ||
      (core.length >= 1 && ctxAll.length >= 1) ||
      (titleSaysHydrogen && ctxAll.length >= 3));

  if (!high && !medium) return NOT_EXCLUDED(energySignals, healthSignals);

  return {
    excluded: true,
    confidence: high ? "high" : "medium",
    reason: `hydrogen energy (not human health): ${energySignals.slice(0, 4).join(", ")}`,
    energySignals,
    healthSignals,
  };
}

/** Convenience for list filtering (search results, import batches). */
export function partitionByEnergyTopic<T>(
  items: readonly T[],
  toInput: (item: T) => StudyTopicInput,
): { kept: T[]; excluded: Array<{ item: T; verdict: StudyTopicVerdict }> } {
  const kept: T[] = [];
  const excluded: Array<{ item: T; verdict: StudyTopicVerdict }> = [];
  for (const item of items) {
    const verdict = isHydrogenEnergyStudy(toInput(item));
    if (verdict.excluded) excluded.push({ item, verdict });
    else kept.push(item);
  }
  return { kept, excluded };
}
