/**
 * Single source of truth for blog article types.
 *
 * The frontend (BlogGeneratePage) and backend (blog-generator-enhanced,
 * blog-recommendation-system) both import from here. Changes to this file
 * automatically flow into the UI (as new checkboxes), the generator (as
 * new prompt branches), and stored article_type values in the DB.
 *
 * To add a new article type:
 *   1. Append an entry below.
 *   2. Add the corresponding prompt branch in
 *      `server/services/blog-generator-enhanced.ts::createContentPrompt`.
 *   3. (Optional) Update recommendation heuristics in
 *      `server/services/blog-recommendation-system.ts` so the new type
 *      gets suggested when appropriate.
 *
 * Reading level is a property *of the type*, not an independent choice.
 * A protocol guide should be 8th-grade; a research summary can afford
 * college-level. Admins can still override per-generation if needed.
 */

export type ReadingLevel = "6th" | "8th" | "10th" | "12th" | "college";

export interface BlogArticleTypeDef {
  /** Machine key — stored in DB and used as the switch value in prompts. */
  id: string;
  /** Human-friendly label shown in the admin UI. */
  label: string;
  /** One-line description shown as a tooltip / subtitle. */
  description: string;
  /** Default reading level for this type. Can be overridden per generation. */
  defaultReadingLevel: ReadingLevel;
  /** Target word count — informs prompts and rough cost/time. */
  targetWordCount: number;
  /** Whether this type should be selected by default on the generate page. */
  defaultEnabled: boolean;
  /**
   * SEO intent — what kind of search this article is meant to capture.
   * Purely advisory; the prompt builder uses it to nudge tone.
   */
  searchIntent: "informational" | "commercial" | "navigational" | "transactional";
}

/**
 * Flesch-Kincaid target ranges per reading level. Used in system prompts.
 */
export const READING_LEVEL_INSTRUCTIONS: Record<ReadingLevel, string> = {
  "6th":
    "Write at a 6th grade reading level (ages 11-12; Flesch-Kincaid 60-70). Use short sentences and simple words. Always define scientific terms.",
  "8th":
    "Write at an 8th grade reading level (ages 13-14; Flesch-Kincaid 50-60). Short paragraphs. Explain jargon on first use.",
  "10th":
    "Write at a 10th grade reading level (Flesch-Kincaid 40-50). Comfortable with basic medical terminology as long as context is provided.",
  "12th":
    "Write at a 12th grade reading level (Flesch-Kincaid 30-40). Assume the reader is a health-literate adult. Use precise terminology.",
  college:
    "Write for a health-literate adult audience with some scientific background (Flesch-Kincaid 20-30). Use precise clinical terminology; no need to over-explain basic biology.",
};

export const BLOG_ARTICLE_TYPES: BlogArticleTypeDef[] = [
  {
    id: "science_explainer",
    label: "Science Explainer",
    description:
      "Breaks down what the researchers did, what they found, and why it matters. Captures informational searches.",
    defaultReadingLevel: "6th",
    targetWordCount: 900,
    defaultEnabled: true,
    searchIntent: "informational",
  },
  {
    id: "practical_guide",
    label: "Practical Guide",
    description:
      "Translates the study into actionable guidance on hydrogen water use (amount, timing, quality). Commercial intent.",
    defaultReadingLevel: "6th",
    targetWordCount: 800,
    defaultEnabled: true,
    searchIntent: "commercial",
  },
  {
    id: "faq",
    label: "FAQ",
    description:
      "Q&A format using schema.org-friendly headings. Targets featured snippets and 'people also ask' boxes.",
    defaultReadingLevel: "6th",
    targetWordCount: 800,
    defaultEnabled: true,
    searchIntent: "informational",
  },
  {
    id: "condition_deep_dive",
    label: "Condition Deep Dive",
    description:
      "Long-form synthesis for a specific health condition, weaving this study into broader evidence. Ranks for high-intent condition queries.",
    defaultReadingLevel: "8th",
    targetWordCount: 1500,
    defaultEnabled: false,
    searchIntent: "informational",
  },
  {
    id: "protocol_guide",
    label: "Protocol / Dosage Guide",
    description:
      "Focused on 'how much, how often, how' — uses the study's dosage/concentration/delivery-method data directly.",
    defaultReadingLevel: "8th",
    targetWordCount: 900,
    defaultEnabled: false,
    searchIntent: "commercial",
  },
  {
    id: "myth_buster",
    label: "Myth Buster",
    description:
      "Debunks a common claim about hydrogen water using this study as the primary evidence. Captures skeptic searches.",
    defaultReadingLevel: "6th",
    targetWordCount: 800,
    defaultEnabled: false,
    searchIntent: "informational",
  },
  {
    id: "listicle",
    label: "Listicle / Roundup",
    description:
      "Structured list piece — 'N things this study shows about X'. High share rate, easy scan.",
    defaultReadingLevel: "6th",
    targetWordCount: 700,
    defaultEnabled: false,
    searchIntent: "informational",
  },
  {
    id: "news_post",
    label: "Research News",
    description:
      "Short timely post announcing a new high-impact study. Uses the study's recency; best for breakthroughs.",
    defaultReadingLevel: "8th",
    targetWordCount: 500,
    defaultEnabled: false,
    searchIntent: "informational",
  },
];

/** Helper: find a type by id, or fall back to science_explainer. */
export function getArticleTypeDef(id: string): BlogArticleTypeDef {
  return (
    BLOG_ARTICLE_TYPES.find((t) => t.id === id) ?? BLOG_ARTICLE_TYPES[0]
  );
}

/** Default-enabled ids — what a brand-new Generate Blog session starts with. */
export const DEFAULT_ARTICLE_TYPE_IDS: string[] = BLOG_ARTICLE_TYPES.filter(
  (t) => t.defaultEnabled,
).map((t) => t.id);
