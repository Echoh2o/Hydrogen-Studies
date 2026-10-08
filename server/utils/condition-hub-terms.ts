/**
 * Synonyms per condition hub (/explore-by-condition/<slug>) — the "keyword
 * fallback" half of the ONE study query both the crawler page and the SPA
 * page list (seo-body-renderer getConditionHubStudies).
 *
 * Why: the crawler page matched studies only by the hub's display name in the
 * `health_conditions` tag array, which found 0 studies for kidney-health,
 * fatty-liver-nafld, weight-loss-metabolism and anxiety-stress ("Anxiety &
 * Stress" is never a tag) while the SPA page's own keyword fallback listed ~50
 * (bot 0 vs browser 50 — 2026-09-28). `study_health_conditions` is empty in
 * production, so the mapping table can't be used either.
 *
 * Started from the keyword lists the 007 seed used to compute
 * health_conditions.study_count (server/migrations/seed-health-conditions.ts),
 * minus terms that swamp a hub with off-topic studies (bare "stress" pulled
 * every "oxidative stress" paper into anxiety-stress; "ros"/"sod"/"uv"/"atp"
 * substring-match unrelated words; bare "liver"/"lipid"/"brain"/"performance"
 * are far broader than the hub). Terms match at a word START (Postgres `\m`),
 * so a stem like "nephro" matches "nephropathy" and "ige" never matches
 * "digestive". Production, 2026-09-28: every hub lists 35–100+ studies.
 */

export const CONDITION_HUB_TERMS: Readonly<Record<string, readonly string[]>> = {
  allergies: ["allerg", "histamine", "ige", "atopic", "rhinitis", "asthma", "hypersensitivity", "anaphyla"],
  "anxiety-stress": [
    "anxiety", "anxiolytic", "anxious", "depression", "depressive", "antidepress", "mood", "cortisol",
    "psychological stress", "mental stress", "chronic stress", "restraint stress", "social stress",
    "post-traumatic", "ptsd", "mental health",
  ],
  "athletic-performance": [
    "athlet", "endurance", "vo2", "lactate", "sprint", "power output", "aerobic", "anaerobic",
    "exercise performance", "physical performance", "ergogenic", "sports performance",
  ],
  "blood-pressure": ["blood pressure", "hypertension", "hypertensive", "antihypertensive", "hypotension", "systolic", "diastolic"],
  cholesterol: [
    "cholesterol", "ldl", "hdl", "triglyceride", "dyslipid", "hyperlipid", "hypercholesterol", "lipoprotein",
    "lipid profile", "lipid metabolism", "atherosclero", "statin",
  ],
  "chronic-fatigue": ["fatigue", "tiredness", "myalgic", "me/cfs", "cfs"],
  "cognitive-function": ["cognitive", "cognition", "memory", "alzheimer", "dementia", "neurodegener", "neuroprotect"],
  "exercise-recovery": [
    "exercise", "athlet", "sport", "muscle damage", "muscle fatigue", "muscle soreness", "doms",
    "post-exercise", "physical activity", "ergogenic", "training",
  ],
  "fatty-liver-nafld": [
    "fatty liver", "nafld", "nash", "masld", "mash", "steatosis", "steatohepatitis", "hepatosteatosis",
    "liver fibrosis", "hepatic fibrosis", "hepatic steatosis",
  ],
  "gut-health": [
    "gut", "intestinal", "intestine", "microbiome", "microbiota", "gastrointestinal", "colitis", "ibs",
    "bowel", "digestive", "gastric", "colon", "colonic",
  ],
  inflammation: [
    "inflammation", "inflammatory", "anti-inflammatory", "cytokine", "nf-kb", "nf-κb", "il-6", "tnf",
    "c-reactive protein", "nlrp3", "inflammasome",
  ],
  // Wave 4 (2026-09-29): precise phrases only — bare "sleep" adds ~13
  // sleep-apnea animal models and no human studies; "anesthe"/"melatonin"
  // are mostly off-topic (scratchpad sleep-terms census, 2026-09-29).
  "sleep-quality": [
    "sleep quality", "poor sleep", "sleep disorder", "sleep disturbance", "sleep deprivation", "sleep-deprived",
    "sleep loss", "sleep consolidation", "sleep physiology", "sleep-wake", "sleep duration", "sleep efficiency",
    "insomnia", "circadian",
  ],
  "kidney-health": ["kidney", "renal", "nephro", "dialysis", "creatinine", "glomerul", "proteinuria", "ckd"],
  "metabolic-syndrome": ["metabolic syndrome", "insulin resistance", "metabolic disorder", "metabolic dysfunction", "prediabet"],
  "oxidative-stress": [
    "oxidative stress", "oxidative damage", "antioxidant", "free radical", "reactive oxygen species",
    "hydroxyl radical", "redox", "malondialdehyde", "superoxide", "8-ohdg", "lipid peroxidation",
  ],
  "parkinsons-disease": ["parkinson", "dopamin", "substantia nigra", "tremor"],
  "radiation-therapy-side-effects": ["radiation", "radiotherapy", "radioprotect", "irradiat", "chemoradi", "mucositis"],
  "rheumatoid-arthritis": ["rheumatoid", "arthritis", "synovial", "synovitis", "autoimmune arthritis", "joint inflammation"],
  "skin-aging": [
    "skin", "dermat", "wrinkle", "photoaging", "photoage", "collagen", "wound healing", "epiderm", "keratinocyte",
    "ultraviolet",
  ],
  "type-2-diabetes": [
    "diabetes", "diabetic", "glycemic", "glycaemic", "hyperglycemi", "hyperglycaemi", "blood sugar", "hba1c", "insulin",
  ],
  "weight-loss-metabolism": [
    "obesity", "obese", "overweight", "weight loss", "weight gain", "body weight", "body mass", "bmi", "adipos",
    "fat loss", "thermogenesis", "leptin", "energy expenditure",
  ],
};

const STOPWORDS = new Set(["and", "the", "with", "health", "disease", "diseases", "conditions", "condition"]);

/**
 * Terms for a hub: the curated list, or — for a health_conditions row added
 * later without one — the lowercase words (≥4 letters, no stopwords) of its
 * name, so a new hub still lists its studies instead of 404ing.
 */
export function conditionHubTerms(slug: string, name: string): string[] {
  const curated = CONDITION_HUB_TERMS[slug];
  if (curated) return [...curated];
  return (name ?? "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 4 && !STOPWORDS.has(w));
}

/**
 * Postgres ARE matching any term at a word start: `\m(?:kidney|renal|…)`.
 * Terms are regex-escaped. Null when there are no terms (name-tag match only).
 */
export function conditionHubTermsPattern(slug: string, name: string): string | null {
  const terms = conditionHubTerms(slug, name);
  if (terms.length === 0) return null;
  const escaped = terms.map((t) => t.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  return `\\m(?:${escaped.join("|")})`;
}
