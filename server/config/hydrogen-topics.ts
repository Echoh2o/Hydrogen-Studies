/**
 * Hydrogen Topics Configuration
 * Defines all topic areas for evidence synthesis via Consensus API
 */

export interface TopicConfig {
  slug: string;
  title: string;
  searchQuery: string;
  description: string;
  category: "organ_system" | "disease_model" | "mechanism" | "delivery_method";
  minHumanStudies: number;
  keywords: string[];
}

export const hydrogenTopics: TopicConfig[] = [
  // Organ Systems
  {
    slug: "hydrogen-brain-health",
    title: "Hydrogen & Brain Health",
    searchQuery: "molecular hydrogen neuroprotection brain cognitive function",
    description: "Effects of molecular hydrogen on brain health, neuroprotection, and cognitive function",
    category: "organ_system",
    minHumanStudies: 2,
    keywords: ["brain", "neuroprotection", "cognitive", "neurodegeneration"],
  },
  {
    slug: "hydrogen-heart-health",
    title: "Hydrogen & Heart Health",
    searchQuery: "molecular hydrogen cardiovascular heart cardioprotection",
    description: "Cardiovascular benefits of molecular hydrogen therapy",
    category: "organ_system",
    minHumanStudies: 2,
    keywords: ["heart", "cardiovascular", "cardioprotection", "blood pressure"],
  },
  {
    slug: "hydrogen-liver-health",
    title: "Hydrogen & Liver Health",
    searchQuery: "molecular hydrogen liver hepatoprotection fatty liver",
    description: "Hepatoprotective effects of molecular hydrogen",
    category: "organ_system",
    minHumanStudies: 1,
    keywords: ["liver", "hepatoprotection", "NAFLD", "hepatitis"],
  },
  {
    slug: "hydrogen-gut-health",
    title: "Hydrogen & Gut Health",
    searchQuery: "molecular hydrogen gut microbiome intestinal health",
    description: "Effects of molecular hydrogen on gut microbiome and intestinal health",
    category: "organ_system",
    minHumanStudies: 1,
    keywords: ["gut", "microbiome", "intestinal", "digestive"],
  },
  {
    slug: "hydrogen-kidney-health",
    title: "Hydrogen & Kidney Health",
    searchQuery: "molecular hydrogen kidney renal protection nephropathy",
    description: "Renoprotective effects of molecular hydrogen",
    category: "organ_system",
    minHumanStudies: 1,
    keywords: ["kidney", "renal", "nephropathy", "dialysis"],
  },
  {
    slug: "hydrogen-skin-health",
    title: "Hydrogen & Skin Health",
    searchQuery: "molecular hydrogen skin dermatology anti-aging wound healing",
    description: "Dermatological applications of molecular hydrogen",
    category: "organ_system",
    minHumanStudies: 1,
    keywords: ["skin", "dermatology", "anti-aging", "wound healing"],
  },
  {
    slug: "hydrogen-lung-health",
    title: "Hydrogen & Lung Health",
    searchQuery: "molecular hydrogen lung respiratory pulmonary",
    description: "Pulmonary and respiratory effects of molecular hydrogen",
    category: "organ_system",
    minHumanStudies: 1,
    keywords: ["lung", "respiratory", "pulmonary", "COPD", "asthma"],
  },
  // Disease Models
  {
    slug: "hydrogen-metabolic-syndrome",
    title: "Hydrogen & Metabolic Syndrome",
    searchQuery: "molecular hydrogen metabolic syndrome obesity diabetes lipid",
    description: "Effects on metabolic syndrome, obesity, and related conditions",
    category: "disease_model",
    minHumanStudies: 2,
    keywords: ["metabolic syndrome", "obesity", "insulin resistance", "lipid"],
  },
  {
    slug: "hydrogen-neurodegeneration",
    title: "Hydrogen & Neurodegeneration",
    searchQuery: "molecular hydrogen Parkinson Alzheimer neurodegeneration",
    description: "Neuroprotective effects in neurodegenerative diseases",
    category: "disease_model",
    minHumanStudies: 1,
    keywords: ["Parkinson", "Alzheimer", "neurodegeneration", "dementia"],
  },
  {
    slug: "hydrogen-sports-recovery",
    title: "Hydrogen & Sports Recovery",
    searchQuery: "molecular hydrogen exercise performance athletic recovery muscle fatigue",
    description: "Athletic performance and exercise recovery applications",
    category: "disease_model",
    minHumanStudies: 3,
    keywords: ["exercise", "athletic", "recovery", "muscle fatigue", "sports"],
  },
  {
    slug: "hydrogen-inflammation",
    title: "Hydrogen & Inflammation",
    searchQuery: "molecular hydrogen anti-inflammatory inflammation oxidative stress",
    description: "Anti-inflammatory and antioxidant properties",
    category: "mechanism",
    minHumanStudies: 3,
    keywords: ["inflammation", "anti-inflammatory", "oxidative stress", "antioxidant"],
  },
  {
    slug: "hydrogen-cancer",
    title: "Hydrogen & Cancer Research",
    searchQuery: "molecular hydrogen cancer tumor anti-cancer chemotherapy",
    description: "Cancer research and adjuvant therapy applications",
    category: "disease_model",
    minHumanStudies: 1,
    keywords: ["cancer", "tumor", "anti-cancer", "chemotherapy", "radiation"],
  },
  {
    slug: "hydrogen-diabetes",
    title: "Hydrogen & Diabetes",
    searchQuery: "molecular hydrogen diabetes glucose insulin type 2 diabetes",
    description: "Effects on diabetes and blood sugar regulation",
    category: "disease_model",
    minHumanStudies: 2,
    keywords: ["diabetes", "glucose", "insulin", "blood sugar", "HbA1c"],
  },
  // Delivery Methods
  {
    slug: "hydrogen-rich-water",
    title: "Hydrogen-Rich Water",
    searchQuery: "hydrogen-rich water HRW drinking hydrogen dissolved",
    description: "Studies on hydrogen-rich water as a delivery method",
    category: "delivery_method",
    minHumanStudies: 5,
    keywords: ["hydrogen-rich water", "HRW", "dissolved hydrogen", "drinking"],
  },
  {
    slug: "hydrogen-inhalation",
    title: "Hydrogen Inhalation Therapy",
    searchQuery: "hydrogen gas inhalation therapy H2 breathing",
    description: "Studies on hydrogen gas inhalation therapy",
    category: "delivery_method",
    minHumanStudies: 2,
    keywords: ["inhalation", "H2 gas", "breathing", "gas therapy"],
  },
  {
    slug: "hydrogen-bathing",
    title: "Hydrogen Bathing",
    searchQuery: "hydrogen bath hydrogen-rich water bathing topical",
    description: "Topical and bathing applications of hydrogen therapy",
    category: "delivery_method",
    minHumanStudies: 1,
    keywords: ["bath", "bathing", "topical", "transdermal"],
  },
];

export function getTopicBySlug(slug: string): TopicConfig | undefined {
  return hydrogenTopics.find((t) => t.slug === slug);
}

export function getTopicsByCategory(category: TopicConfig["category"]): TopicConfig[] {
  return hydrogenTopics.filter((t) => t.category === category);
}
