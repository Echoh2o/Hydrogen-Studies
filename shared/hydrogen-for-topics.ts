/**
 * /hydrogen-for/:slug topic records — the single source for the SPA page
 * (HydrogenForConditionPage.tsx) AND the bot renderer/meta
 * (seo-body-renderer.ts / seo-bot-middleware.ts), so crawlers and browsers get
 * the same H1, meta, visible FAQ (and therefore the same FAQPage JSON-LD).
 *
 * `bridgeTopic` is the page's primary topic as an Appendix E key; product
 * content renders only when isBridgeAllowed(bridgeTopic) (shared/bridge-policy).
 * Disease and gray-area topics carry `bridgeTopic: null` and no products.
 * "Skin health" is deliberately NOT mapped to "skin-appearance-cosmetic": the
 * page covers UV damage/dermatology, not only cosmetic appearance — counsel
 * must clear it before it gets a bridge.
 *
 * Meta: title ≤ 60 chars including " | Hydrogen Studies"; description 140–160
 * chars (enforced by server/__tests__/markup-compliance.test.ts).
 */

import type { ECHO_PRODUCTS } from "./echo-products";

export interface HydrogenForTopic {
  slug: string;
  name: string;
  bodySystem: string;
  searchTerms: string[];
  /** Appendix E topic key, or null (no product content on this page). */
  bridgeTopic: string | null;
  metaTitle: string;
  metaDescription: string;
  /** Rendered only when the bridge policy allows this page's topic. */
  products: Array<{ key: keyof typeof ECHO_PRODUCTS; name: string; reason: string }>;
  faqs: Array<{ question: string; answer: string }>;
}

export const HYDROGEN_FOR_TOPICS: Record<string, HydrogenForTopic> = {
  "heart-disease": {
    slug: "heart-disease",
    name: "Heart Disease",
    bodySystem: "Cardiovascular System",
    searchTerms: ["cardiovascular", "heart", "cardiac", "hypertension"],
    bridgeTopic: null,
    metaTitle: "Hydrogen and Heart Disease Research | Hydrogen Studies",
    metaDescription:
      "What peer-reviewed studies report on molecular hydrogen and heart disease: study designs, outcomes and limits of the evidence. Educational, not medical advice.",
    products: [],
    faqs: [
      { question: "Can hydrogen water help with heart disease?", answer: "Multiple peer-reviewed studies suggest molecular hydrogen may support cardiovascular health by reducing oxidative stress, improving endothelial function, and lowering inflammation markers associated with heart disease. Always consult your cardiologist." },
      { question: "How does hydrogen therapy support heart health?", answer: "Hydrogen acts as a selective antioxidant that targets harmful hydroxyl radicals in cardiac tissue. Studies show it may help protect against ischemia-reperfusion injury and reduce markers of cardiovascular inflammation." },
      { question: "What delivery method is best for heart health?", answer: "Most cardiovascular studies used hydrogen-rich water as the delivery method. Drinking hydrogen water daily is the most studied approach for heart health benefits." },
    ],
  },
  diabetes: {
    slug: "diabetes",
    name: "Diabetes & Metabolic Health",
    bodySystem: "Endocrine System",
    searchTerms: ["diabetes", "metabolic", "insulin", "blood sugar", "glucose"],
    bridgeTopic: null,
    metaTitle: "Hydrogen and Diabetes Research | Hydrogen Studies",
    metaDescription:
      "Peer-reviewed research on molecular hydrogen in diabetes and metabolic health: what studies measured, who took part, and how strong the evidence is so far.",
    products: [],
    faqs: [
      { question: "Can hydrogen water help manage diabetes?", answer: "Several clinical studies have shown that hydrogen-rich water may help improve insulin sensitivity and reduce oxidative stress markers in patients with type 2 diabetes and metabolic syndrome. It is not a replacement for medication." },
      { question: "What does the research say about hydrogen and blood sugar?", answer: "Research suggests molecular hydrogen may help regulate glucose metabolism through its anti-inflammatory and antioxidant properties, potentially supporting better blood sugar control alongside standard care." },
    ],
  },
  "brain-health": {
    slug: "brain-health",
    name: "Brain & Mental Health",
    bodySystem: "Nervous System",
    searchTerms: ["brain", "cognitive", "neuro", "alzheimer", "parkinson", "neuroprotective"],
    bridgeTopic: null,
    metaTitle: "Hydrogen and Brain Health Research | Hydrogen Studies",
    metaDescription:
      "Research on molecular hydrogen and brain health, from cognitive outcomes to neurodegeneration: study types, results and the limits of what they show so far.",
    products: [],
    faqs: [
      { question: "Can hydrogen therapy help with brain health?", answer: "Studies show molecular hydrogen can cross the blood-brain barrier and may provide neuroprotective effects. Research has explored its potential benefits for cognitive function, memory, and protection against neurodegenerative conditions." },
      { question: "Is hydrogen water good for cognitive function?", answer: "Several studies suggest hydrogen-rich water may support cognitive function by reducing oxidative stress and neuroinflammation, which are key factors in cognitive decline." },
      { question: "Which hydrogen delivery method is best for brain health?", answer: "Both hydrogen water and hydrogen inhalation have been studied for brain health. Inhalation may provide more rapid delivery, while hydrogen water offers convenient daily use." },
    ],
  },
  inflammation: {
    slug: "inflammation",
    name: "Arthritis & Inflammation",
    bodySystem: "Immune System",
    searchTerms: ["inflammation", "arthritis", "anti-inflammatory", "rheumatoid", "joint"],
    bridgeTopic: null,
    metaTitle: "Hydrogen and Inflammation Research | Hydrogen Studies",
    metaDescription:
      "Studies on molecular hydrogen, inflammation markers and arthritis: what was measured, in whom, and how consistent the findings are. Educational, not advice.",
    products: [],
    faqs: [
      { question: "Does hydrogen water reduce inflammation?", answer: "Multiple studies demonstrate that molecular hydrogen has anti-inflammatory properties. It may help modulate inflammatory responses by regulating pro-inflammatory cytokines and reducing oxidative stress." },
      { question: "Can hydrogen therapy help with arthritis?", answer: "Research suggests hydrogen-rich water and hydrogen baths may help reduce inflammation markers and improve symptoms in patients with rheumatoid arthritis and other inflammatory joint conditions." },
    ],
  },
  "cancer-support": {
    slug: "cancer-support",
    name: "Cancer Supportive Care",
    bodySystem: "Immune System",
    searchTerms: ["cancer", "tumor", "chemotherapy", "radiation", "oncology"],
    bridgeTopic: null,
    metaTitle: "Hydrogen and Cancer Supportive Care | Hydrogen Studies",
    metaDescription:
      "Research on molecular hydrogen alongside cancer treatment, such as side effects of chemotherapy and radiation. Not a cancer treatment; talk to your oncologist.",
    products: [],
    faqs: [
      { question: "Can hydrogen water help cancer patients?", answer: "Research suggests molecular hydrogen may help reduce side effects of cancer treatments like chemotherapy and radiation. It is being studied as a complementary approach to improve quality of life during cancer therapy, not as a cancer treatment itself." },
      { question: "Is hydrogen therapy safe during cancer treatment?", answer: "Studies have generally shown hydrogen to be safe and well-tolerated. However, patients should always consult their oncologist before adding any complementary therapy to their cancer treatment plan." },
    ],
  },
  "athletic-performance": {
    slug: "athletic-performance",
    name: "Athletic Performance & Recovery",
    bodySystem: "Musculoskeletal System",
    searchTerms: ["exercise", "athlete", "performance", "recovery", "fatigue", "muscle"],
    bridgeTopic: "athletic-performance",
    metaTitle: "Hydrogen for Athletic Performance | Hydrogen Studies",
    metaDescription:
      "Studies on molecular hydrogen for exercise performance and recovery in healthy adults: fatigue, lactate and muscle-damage markers, and what the results mean.",
    products: [
      { key: "flask", name: "Echo Flask Hydrogen Water Bottle", reason: "Portable hydrogen water for pre/post-workout hydration" },
      { key: "revive", name: "Echo Revive Hydrogen Bath Water Machine", reason: "Hydrogen baths for muscle recovery and soreness relief" },
    ],
    faqs: [
      { question: "Does hydrogen water improve athletic performance?", answer: "Several studies have shown that hydrogen-rich water may reduce exercise-induced fatigue, decrease blood lactate levels, and improve endurance capacity in athletes." },
      { question: "How does hydrogen water help with recovery?", answer: "Research suggests hydrogen water may accelerate recovery by reducing muscle damage markers (like creatine kinase), lowering oxidative stress from intense exercise, and supporting anti-inflammatory processes." },
    ],
  },
  "skin-health": {
    slug: "skin-health",
    name: "Skin Health & Anti-Aging",
    bodySystem: "Integumentary System",
    searchTerms: ["skin", "dermatology", "UV", "wrinkle", "aging", "collagen"],
    bridgeTopic: null,
    metaTitle: "Hydrogen and Skin Health Research | Hydrogen Studies",
    metaDescription:
      "Research on molecular hydrogen and skin: UV exposure, oxidative stress and visible signs of aging. Study designs, results and the limits of the evidence today.",
    products: [],
    faqs: [
      { question: "Can hydrogen water improve skin health?", answer: "Studies suggest molecular hydrogen may help protect skin from UV damage, reduce oxidative stress that contributes to aging, and promote better skin hydration and elasticity." },
      { question: "How does hydrogen therapy help with anti-aging?", answer: "Hydrogen acts as a selective antioxidant that targets the most harmful free radicals responsible for cellular aging. Research shows it may help reduce wrinkles, improve skin tone, and protect against environmental skin damage." },
    ],
  },
  "gut-health": {
    slug: "gut-health",
    name: "Digestive Health",
    bodySystem: "Digestive System",
    searchTerms: ["digestive", "gut", "liver", "gastric", "intestinal", "microbiome"],
    bridgeTopic: null,
    metaTitle: "Hydrogen and Digestive Health Research | Hydrogen Studies",
    metaDescription:
      "Peer-reviewed studies on molecular hydrogen and digestive health, including the gut lining, liver and microbiome: what was tested and how strong the data are.",
    products: [],
    faqs: [
      { question: "Can hydrogen water improve gut health?", answer: "Research suggests molecular hydrogen may help protect the gastrointestinal lining, reduce digestive inflammation, and support gut barrier function. Some studies also show potential benefits for the gut microbiome." },
      { question: "Is hydrogen water good for digestive issues?", answer: "Studies have explored hydrogen-rich water for conditions like gastritis, colitis, and liver health. The anti-inflammatory and antioxidant properties of H2 may help alleviate symptoms of various digestive disorders." },
    ],
  },
  "kidney-health": {
    slug: "kidney-health",
    name: "Kidney Health",
    bodySystem: "Urinary System",
    searchTerms: ["kidney", "renal", "nephro"],
    bridgeTopic: null,
    metaTitle: "Hydrogen and Kidney Health Research | Hydrogen Studies",
    metaDescription:
      "Research on molecular hydrogen and kidney health, from renal function markers to injury models: study types, findings and how far the evidence goes so far.",
    products: [],
    faqs: [
      { question: "Can hydrogen water help protect kidneys?", answer: "Research suggests molecular hydrogen may have renoprotective effects, helping to reduce oxidative damage to kidney tissue and potentially improving renal function markers." },
      { question: "What studies exist on hydrogen and kidney health?", answer: "Several studies have examined hydrogen-rich water for kidney protection, particularly in cases of drug-induced nephrotoxicity and ischemia-reperfusion injury. Results generally show reduced oxidative stress markers." },
    ],
  },
  "lung-health": {
    slug: "lung-health",
    name: "Lung & Respiratory Health",
    bodySystem: "Respiratory System",
    searchTerms: ["lung", "respiratory", "pulmonary", "asthma", "COPD"],
    bridgeTopic: null,
    metaTitle: "Hydrogen and Lung Health Research | Hydrogen Studies",
    metaDescription:
      "Studies on hydrogen inhalation and hydrogen-rich water for lung and respiratory health: what researchers measured, key results, and open questions remaining.",
    products: [],
    faqs: [
      { question: "Can hydrogen therapy help with lung conditions?", answer: "Studies suggest hydrogen inhalation and hydrogen-rich water may help reduce lung inflammation and oxidative stress. Research has explored its potential benefits for various respiratory conditions." },
      { question: "Is hydrogen inhalation safe for the lungs?", answer: "Hydrogen gas has been studied in clinical settings and is generally considered safe at therapeutic concentrations. Hydrogen inhalation therapy is being researched as a complementary approach for respiratory support." },
    ],
  },
};

export function getHydrogenForTopic(slug: string | null | undefined): HydrogenForTopic | null {
  if (!slug) return null;
  return HYDROGEN_FOR_TOPICS[slug.toLowerCase()] ?? null;
}
