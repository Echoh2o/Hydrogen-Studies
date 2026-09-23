/**
 * Product/sponsor bridge placement policy — PLAN.md Appendix E, encoded once.
 *
 * CLAUDE.md: "Product/sponsor bridges render only on pages whose primary topic
 * is in the PLAN.md Appendix E allowlist. Never on disease pages."
 *
 * A "bridge" is ANY product content: sponsor cards, "Shop Echo Water" CTAs,
 * product recommendation cards, PDP links. The ownership disclosure (footer
 * "built and funded by Echo Technologies LLC" + its echowater.com link) is NOT
 * a bridge and still renders everywhere.
 *
 * Rules:
 *  - Allowlist only. A topic is bridge-eligible iff its normalized key is one
 *    of BRIDGE_ALLOWED_TOPICS (or an explicit alias of one).
 *  - Default = NOT allowed: unknown, empty, or unclassified topics get no
 *    bridge (e.g. blog posts, which carry no topic taxonomy yet).
 *  - Named diseases and the Appendix E gray areas (inflammation, gut health,
 *    cognitive function, blood pressure) are prohibited until counsel clears
 *    them. The prohibited-term check is defense-in-depth: even a future alias
 *    that mentions a disease is refused.
 *
 * Shared by the server (bot renderer) and the SPA so both paths make the same
 * decision. Keep it dependency-free.
 */

/** Appendix E "Allowed contexts", as normalized topic keys. */
export const BRIDGE_ALLOWED_TOPICS = [
  "exercise-recovery",
  "athletic-performance",
  "fatigue-energy-healthy-adults",
  "hydration",
  "oxidative-stress-biomarkers-healthy-adults",
  "general-wellness",
  "antioxidant-status",
  "skin-appearance-cosmetic",
  "sleep-quality-healthy-adults",
  "device-guide",
] as const;

export type BridgeTopic = (typeof BRIDGE_ALLOWED_TOPICS)[number];

/**
 * Page slugs / labels that map onto an allowed topic. Only add an alias when
 * the page's PRIMARY topic is genuinely the allowed context (Appendix E).
 */
const BRIDGE_TOPIC_ALIASES: Record<string, BridgeTopic> = {
  "athletic-performance-recovery": "athletic-performance",
  "athletic-performance-and-recovery": "athletic-performance",
  "sports-performance": "athletic-performance",
  "exercise-performance": "athletic-performance",
  "how-hydrogen-devices-work": "device-guide",
};

/**
 * Appendix E "Prohibited contexts" + gray areas (default-prohibited), as
 * substrings of a normalized key. Any hit refuses the bridge outright.
 */
export const BRIDGE_PROHIBITED_TERMS = [
  // named diseases / medical conditions
  "cancer", "oncolog", "tumor", "tumour", "chemo", "radiation",
  "diabet", "metabolic", "nafld", "fatty-liver", "liver-disease",
  "hypertension", "cardiovascular", "heart-disease", "cardiac",
  "kidney", "renal", "nephro",
  "parkinson", "alzheimer", "dementia", "neurodegener",
  "arthritis", "rheumat", "lupus", "sepsis", "covid",
  "respiratory", "lung", "pulmonary", "asthma", "copd",
  "allerg", "autism", "depress", "anxiety", "chronic-fatigue",
  "disease", "disorder", "syndrome", "patient", "diagnos",
  // gray areas → prohibited until counsel clears them
  "inflammation", "inflammatory", "gut", "digestive", "cognitive", "brain",
  "blood-pressure",
];

function normalizeTopic(topic: string | null | undefined): string {
  return String(topic ?? "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const ALLOWED = new Set<string>(BRIDGE_ALLOWED_TOPICS);

/** Resolve a topic/slug/label to its allowed Appendix E topic, or null. */
export function resolveBridgeTopic(topic: string | null | undefined): BridgeTopic | null {
  const key = normalizeTopic(topic);
  if (!key) return null;
  if (BRIDGE_PROHIBITED_TERMS.some((term) => key.includes(term))) return null;
  if (ALLOWED.has(key)) return key as BridgeTopic;
  return BRIDGE_TOPIC_ALIASES[key] ?? null;
}

/**
 * May a page whose primary topic is `topic` render product/sponsor content?
 * Default false.
 */
export function isBridgeAllowed(topic: string | null | undefined): boolean {
  return resolveBridgeTopic(topic) !== null;
}
