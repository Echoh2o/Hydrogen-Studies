/**
 * SEO Keyword Strategy Service
 *
 * Keyword-centric content generation for Echo Water marketing + Hydrogen Studies credibility.
 * Uses pillar/cluster model: 1 pillar page + 10+ supporting articles per keyword cluster.
 *
 * Three keyword categories:
 * 1. Product — Echo Water product keywords (commercial intent)
 * 2. Research — Hydrogen science legitimacy (informational intent)
 * 3. Competitor — Differentiation from cheap knockoffs (comparison intent)
 */

import { ai } from "./ai-provider";
import { db } from "../db";
import { studies, blogArticles, seoContentClusters } from "../../shared/schema";
import { eq, sql, desc, ilike, or } from "drizzle-orm";

const SITE_URL = process.env.SITE_URL || "https://hydrogenstudies.com";
const ECHO_SITE = "https://echowater.com";

// ============================================================
// Echo Water Product & Brand Context
// ============================================================

const ECHO_PRODUCTS = [
  {
    product: "Echo Go+ Hydrogen Water Bottle",
    url: `${ECHO_SITE}/products/echo-go-plus`,
    keyword: "hydrogen water bottle",
    description: "Portable hydrogen water generator producing up to 4.5 ppm dissolved hydrogen. Medical-grade titanium-platinum electrode plates. BPA-free Tritan body. USB-C rechargeable.",
  },
  {
    product: "Echo Ultimate Hydrogen Water Machine",
    url: `${ECHO_SITE}/products/echo-ultimate`,
    keyword: "hydrogen water machine",
    description: "Countertop hydrogen water system with 9-stage filtration. Produces hydrogen-rich water up to 1.5 ppm at the tap. Connects to existing water line.",
  },
  {
    product: "Echo H2 Machine",
    url: `${ECHO_SITE}/products/echo-h2-machine`,
    keyword: "hydrogen inhalation machine",
    description: "Molecular hydrogen inhalation device producing 99.99% pure hydrogen gas at therapeutic flow rates. Used by clinics and researchers worldwide.",
  },
  {
    product: "Echo Hydrogen Water Filter",
    url: `${ECHO_SITE}/products/echo-water-filter`,
    keyword: "hydrogen water filter",
    description: "Multi-stage water filtration system with hydrogen infusion. Removes contaminants while adding therapeutic molecular hydrogen.",
  },
];

const ECHO_BRAND_CONTEXT = `Echo Water is a premium hydrogen water technology company. Unlike cheap Chinese knockoff bottles that use low-quality materials and produce minimal hydrogen concentrations, Echo products are:
- Built with medical-grade titanium-platinum electrode plates (not cheap stainless steel)
- Third-party lab tested for hydrogen concentration (verified PPM levels)
- SPE/PEM technology that produces pure H2 without ozone or chlorine byproducts
- Backed by partnerships with hydrogen therapy researchers
- UL certified and BPA-free materials
- Backed by a comprehensive warranty and US-based customer support`;

// ============================================================
// Pre-built Keyword Clusters (seed data)
// ============================================================

export interface KeywordClusterSeed {
  pillarKeyword: string;
  pillarTitle: string;
  slug: string;
  category: "product" | "research" | "competitor";
  targetAudience: "consumer" | "researcher" | "skeptic";
  searchIntent: "informational" | "commercial" | "transactional";
  estimatedSearchVolume?: number;
  priority: number;
  clusterKeywords: Array<{
    keyword: string;
    title: string;
    slug: string;
    articleType: string;
    searchIntent: string;
  }>;
}

export const DEFAULT_KEYWORD_CLUSTERS: KeywordClusterSeed[] = [
  // ========================
  // PRODUCT KEYWORDS (Echo Water)
  // ========================
  {
    pillarKeyword: "hydrogen water bottle",
    pillarTitle: "The Complete Guide to Hydrogen Water Bottles: Science, Benefits, and What to Look For",
    slug: "hydrogen-water-bottle-guide",
    category: "product",
    targetAudience: "consumer",
    searchIntent: "commercial",
    estimatedSearchVolume: 22000,
    priority: 95,
    clusterKeywords: [
      { keyword: "best hydrogen water bottle", title: "Best Hydrogen Water Bottles in 2025: Expert Comparison & Reviews", slug: "best-hydrogen-water-bottles", articleType: "comparison", searchIntent: "commercial" },
      { keyword: "hydrogen water bottle benefits", title: "7 Science-Backed Benefits of Using a Hydrogen Water Bottle Daily", slug: "hydrogen-water-bottle-benefits", articleType: "benefits", searchIntent: "informational" },
      { keyword: "how does a hydrogen water bottle work", title: "How Hydrogen Water Bottles Work: The Science Behind SPE/PEM Electrolysis", slug: "how-hydrogen-water-bottle-works", articleType: "explainer", searchIntent: "informational" },
      { keyword: "hydrogen water bottle vs alkaline water", title: "Hydrogen Water vs Alkaline Water: What the Research Actually Shows", slug: "hydrogen-water-vs-alkaline-water", articleType: "comparison", searchIntent: "informational" },
      { keyword: "hydrogen water bottle side effects", title: "Are Hydrogen Water Bottles Safe? Side Effects, Risks, and What Studies Say", slug: "hydrogen-water-bottle-side-effects", articleType: "safety", searchIntent: "informational" },
      { keyword: "how much hydrogen water should I drink", title: "How Much Hydrogen Water Should You Drink Per Day? Research-Based Guide", slug: "how-much-hydrogen-water-per-day", articleType: "how-to", searchIntent: "informational" },
      { keyword: "hydrogen water bottle for athletes", title: "Hydrogen Water for Athletes: Recovery, Performance, and the Research", slug: "hydrogen-water-bottle-athletes", articleType: "benefits", searchIntent: "commercial" },
      { keyword: "portable hydrogen water generator", title: "Portable Hydrogen Water Generators: What to Know Before You Buy", slug: "portable-hydrogen-water-generator", articleType: "buying-guide", searchIntent: "commercial" },
      { keyword: "hydrogen water bottle PPM levels", title: "Understanding PPM in Hydrogen Water: Why Concentration Matters", slug: "hydrogen-water-ppm-levels", articleType: "explainer", searchIntent: "informational" },
      { keyword: "cheap hydrogen water bottles", title: "Why Cheap Hydrogen Water Bottles Don't Work: Quality vs Price Analysis", slug: "cheap-hydrogen-water-bottles-problems", articleType: "comparison", searchIntent: "commercial" },
    ],
  },
  {
    pillarKeyword: "hydrogen inhalation machine",
    pillarTitle: "Hydrogen Inhalation Therapy: Complete Guide to H2 Breathing Devices",
    slug: "hydrogen-inhalation-machine-guide",
    category: "product",
    targetAudience: "consumer",
    searchIntent: "commercial",
    estimatedSearchVolume: 8000,
    priority: 85,
    clusterKeywords: [
      { keyword: "hydrogen inhalation therapy benefits", title: "Hydrogen Inhalation Therapy: Benefits Backed by Clinical Research", slug: "hydrogen-inhalation-benefits", articleType: "benefits", searchIntent: "informational" },
      { keyword: "best hydrogen inhalation machine", title: "Best Hydrogen Inhalation Machines: Safety, Output, and Quality Compared", slug: "best-hydrogen-inhalation-machines", articleType: "comparison", searchIntent: "commercial" },
      { keyword: "hydrogen inhalation for lungs", title: "Hydrogen Gas Inhalation for Lung Health: What 50+ Studies Reveal", slug: "hydrogen-inhalation-lung-health", articleType: "research-roundup", searchIntent: "informational" },
      { keyword: "how to use hydrogen inhalation machine", title: "How to Use a Hydrogen Inhalation Machine Safely at Home", slug: "how-to-use-hydrogen-inhalation", articleType: "how-to", searchIntent: "informational" },
      { keyword: "hydrogen gas therapy research", title: "Hydrogen Gas Therapy: Comprehensive Research Overview and Clinical Evidence", slug: "hydrogen-gas-therapy-research", articleType: "research-roundup", searchIntent: "informational" },
      { keyword: "hydrogen inhalation dosage", title: "Hydrogen Inhalation Dosage: Flow Rates, Duration, and Research Protocols", slug: "hydrogen-inhalation-dosage-guide", articleType: "how-to", searchIntent: "informational" },
      { keyword: "hydrogen inhalation side effects", title: "Is Hydrogen Inhalation Safe? Side Effects and Safety Data from 100+ Studies", slug: "hydrogen-inhalation-side-effects", articleType: "safety", searchIntent: "informational" },
      { keyword: "hydrogen inhalation vs hydrogen water", title: "Hydrogen Inhalation vs Hydrogen Water: Which Delivers More H2?", slug: "hydrogen-inhalation-vs-water", articleType: "comparison", searchIntent: "informational" },
      { keyword: "hydrogen inhalation for inflammation", title: "Hydrogen Inhalation for Chronic Inflammation: Research & Mechanisms", slug: "hydrogen-inhalation-inflammation", articleType: "explainer", searchIntent: "informational" },
      { keyword: "hydrogen therapy machine for home use", title: "Hydrogen Therapy Machines for Home Use: Complete Buying Guide", slug: "hydrogen-therapy-machine-home", articleType: "buying-guide", searchIntent: "commercial" },
    ],
  },
  {
    pillarKeyword: "hydrogen water filter",
    pillarTitle: "Hydrogen Water Filtration Systems: Clean Water + Molecular Hydrogen",
    slug: "hydrogen-water-filter-guide",
    category: "product",
    targetAudience: "consumer",
    searchIntent: "commercial",
    estimatedSearchVolume: 6500,
    priority: 80,
    clusterKeywords: [
      { keyword: "best hydrogen water filter system", title: "Best Hydrogen Water Filter Systems: Filtration Quality + H2 Output", slug: "best-hydrogen-water-filters", articleType: "comparison", searchIntent: "commercial" },
      { keyword: "hydrogen water filter vs bottle", title: "Hydrogen Water Filter vs Bottle: Which Is Better for Your Home?", slug: "hydrogen-water-filter-vs-bottle", articleType: "comparison", searchIntent: "commercial" },
      { keyword: "countertop hydrogen water machine", title: "Countertop Hydrogen Water Machines: Space-Saving Solutions Reviewed", slug: "countertop-hydrogen-water-machine", articleType: "buying-guide", searchIntent: "commercial" },
      { keyword: "water filtration with hydrogen", title: "How Hydrogen Water Filtration Works: Technology Explained", slug: "water-filtration-hydrogen-technology", articleType: "explainer", searchIntent: "informational" },
      { keyword: "hydrogen water for cooking", title: "Using Hydrogen Water for Cooking: Does It Make a Difference?", slug: "hydrogen-water-for-cooking", articleType: "how-to", searchIntent: "informational" },
      { keyword: "whole house hydrogen water system", title: "Whole House Hydrogen Water: Is It Worth It? Cost & Benefits Analysis", slug: "whole-house-hydrogen-water", articleType: "explainer", searchIntent: "commercial" },
      { keyword: "hydrogen water machine maintenance", title: "Hydrogen Water Machine Maintenance: Cleaning, Filters, and Longevity", slug: "hydrogen-water-machine-maintenance", articleType: "how-to", searchIntent: "informational" },
      { keyword: "water quality and hydrogen infusion", title: "Why Water Quality Matters for Hydrogen Infusion: TDS, pH, and PPM", slug: "water-quality-hydrogen-infusion", articleType: "explainer", searchIntent: "informational" },
      { keyword: "hydrogen water machine cost", title: "Hydrogen Water Machine Cost: Breaking Down Price vs Value", slug: "hydrogen-water-machine-cost-analysis", articleType: "buying-guide", searchIntent: "commercial" },
      { keyword: "echo water filter review", title: "Echo Water Filter Systems: Complete Review and Performance Testing", slug: "echo-water-filter-review", articleType: "review", searchIntent: "commercial" },
    ],
  },
  // ========================
  // RESEARCH / LEGITIMACY KEYWORDS
  // ========================
  {
    pillarKeyword: "is hydrogen water legit",
    pillarTitle: "Is Hydrogen Water Legit? A Deep Dive Into 1,000+ Published Studies",
    slug: "is-hydrogen-water-legit",
    category: "research",
    targetAudience: "skeptic",
    searchIntent: "informational",
    estimatedSearchVolume: 12000,
    priority: 100,
    clusterKeywords: [
      { keyword: "hydrogen water real or fake", title: "Hydrogen Water: Real Science or Expensive Hype? Evidence Review", slug: "hydrogen-water-real-or-fake", articleType: "explainer", searchIntent: "informational" },
      { keyword: "hydrogen water scientific evidence", title: "The Scientific Evidence for Hydrogen Water: What 1,000+ Studies Show", slug: "hydrogen-water-scientific-evidence", articleType: "research-roundup", searchIntent: "informational" },
      { keyword: "hydrogen water scam", title: "Is Hydrogen Water a Scam? Separating Marketing Claims from Research", slug: "hydrogen-water-scam-debunked", articleType: "explainer", searchIntent: "informational" },
      { keyword: "hydrogen water benefits debunked", title: "Hydrogen Water Benefits: What's Proven, What's Promising, and What's Hype", slug: "hydrogen-water-benefits-debunked", articleType: "research-roundup", searchIntent: "informational" },
      { keyword: "molecular hydrogen research", title: "Molecular Hydrogen Research: 20 Years of Scientific Discovery", slug: "molecular-hydrogen-research-history", articleType: "research-roundup", searchIntent: "informational" },
      { keyword: "hydrogen water studies peer reviewed", title: "Peer-Reviewed Hydrogen Water Studies: The Most Important Findings", slug: "hydrogen-water-peer-reviewed-studies", articleType: "research-roundup", searchIntent: "informational" },
      { keyword: "does hydrogen water actually work", title: "Does Hydrogen Water Actually Work? What the Clinical Trials Say", slug: "does-hydrogen-water-work", articleType: "explainer", searchIntent: "informational" },
      { keyword: "hydrogen water vs regular water", title: "Hydrogen Water vs Regular Water: Is There Really a Difference?", slug: "hydrogen-water-vs-regular-water", articleType: "comparison", searchIntent: "informational" },
      { keyword: "hydrogen water clinical trials", title: "Hydrogen Water Clinical Trials: A Database of Human Studies", slug: "hydrogen-water-clinical-trials", articleType: "research-roundup", searchIntent: "informational" },
      { keyword: "what doctors say about hydrogen water", title: "What Doctors and Researchers Say About Hydrogen Water", slug: "doctors-hydrogen-water-opinions", articleType: "expert-roundup", searchIntent: "informational" },
      { keyword: "hydrogen water all hype", title: "Is Hydrogen Water All Hype? A Researcher's Honest Assessment", slug: "hydrogen-water-all-hype", articleType: "explainer", searchIntent: "informational" },
    ],
  },
  {
    pillarKeyword: "molecular hydrogen benefits",
    pillarTitle: "Molecular Hydrogen Benefits: Complete Guide to H2 Therapy Research",
    slug: "molecular-hydrogen-benefits-guide",
    category: "research",
    targetAudience: "consumer",
    searchIntent: "informational",
    estimatedSearchVolume: 15000,
    priority: 90,
    clusterKeywords: [
      { keyword: "hydrogen water for inflammation", title: "Hydrogen Water for Inflammation: What 200+ Studies Reveal", slug: "hydrogen-water-inflammation-research", articleType: "research-roundup", searchIntent: "informational" },
      { keyword: "hydrogen water for gut health", title: "Hydrogen Water and Gut Health: The Microbiome Connection", slug: "hydrogen-water-gut-health", articleType: "explainer", searchIntent: "informational" },
      { keyword: "hydrogen water for skin", title: "Hydrogen Water for Skin Health: Anti-Aging and Dermatology Research", slug: "hydrogen-water-skin-benefits", articleType: "benefits", searchIntent: "informational" },
      { keyword: "hydrogen water for brain health", title: "Hydrogen Water and Brain Health: Neuroprotection Research", slug: "hydrogen-water-brain-health", articleType: "research-roundup", searchIntent: "informational" },
      { keyword: "hydrogen water antioxidant", title: "Hydrogen Water as a Selective Antioxidant: How It Targets Harmful Free Radicals", slug: "hydrogen-water-antioxidant-mechanism", articleType: "explainer", searchIntent: "informational" },
      { keyword: "hydrogen water for weight loss", title: "Can Hydrogen Water Help with Weight Loss? Research Evidence", slug: "hydrogen-water-weight-loss", articleType: "explainer", searchIntent: "informational" },
      { keyword: "hydrogen water for diabetes", title: "Hydrogen Water and Diabetes: Blood Sugar Research & Clinical Trials", slug: "hydrogen-water-diabetes-research", articleType: "research-roundup", searchIntent: "informational" },
      { keyword: "hydrogen water for energy", title: "Hydrogen Water for Energy and Fatigue: Mitochondrial Research", slug: "hydrogen-water-energy-fatigue", articleType: "benefits", searchIntent: "informational" },
      { keyword: "hydrogen water for heart health", title: "Hydrogen Water and Cardiovascular Health: What Research Shows", slug: "hydrogen-water-heart-health", articleType: "research-roundup", searchIntent: "informational" },
      { keyword: "how does molecular hydrogen work in the body", title: "How Molecular Hydrogen Works in the Body: Mechanisms of Action", slug: "how-molecular-hydrogen-works-body", articleType: "explainer", searchIntent: "informational" },
    ],
  },
  // ========================
  // COMPETITOR DIFFERENTIATION
  // ========================
  {
    pillarKeyword: "hydrogen water bottle comparison",
    pillarTitle: "Hydrogen Water Bottle Comparison: Quality, PPM, and What Actually Matters",
    slug: "hydrogen-water-bottle-comparison",
    category: "competitor",
    targetAudience: "consumer",
    searchIntent: "commercial",
    estimatedSearchVolume: 5000,
    priority: 75,
    clusterKeywords: [
      { keyword: "hydrogen water bottle quality test", title: "Hydrogen Water Bottle Quality Testing: Which Brands Actually Deliver?", slug: "hydrogen-water-bottle-quality-test", articleType: "comparison", searchIntent: "commercial" },
      { keyword: "cheap hydrogen water bottle dangers", title: "The Dangers of Cheap Hydrogen Water Bottles: Materials, Ozone, and False PPM", slug: "cheap-hydrogen-water-bottle-dangers", articleType: "safety", searchIntent: "informational" },
      { keyword: "hydrogen water bottle titanium vs stainless", title: "Titanium vs Stainless Steel Electrodes: Why Materials Matter in H2 Bottles", slug: "titanium-vs-stainless-steel-hydrogen", articleType: "explainer", searchIntent: "informational" },
      { keyword: "SPE PEM hydrogen technology", title: "SPE/PEM Technology: The Gold Standard in Hydrogen Water Generation", slug: "spe-pem-hydrogen-technology", articleType: "explainer", searchIntent: "informational" },
      { keyword: "hydrogen water bottle ozone problem", title: "The Ozone Problem in Cheap Hydrogen Bottles: Why SPE/PEM Matters", slug: "hydrogen-bottle-ozone-problem", articleType: "safety", searchIntent: "informational" },
      { keyword: "amazon hydrogen water bottle review", title: "Amazon Hydrogen Water Bottles: Why Most Are a Waste of Money", slug: "amazon-hydrogen-water-bottle-review", articleType: "comparison", searchIntent: "commercial" },
      { keyword: "hydrogen water bottle made in USA", title: "American-Made vs Chinese Hydrogen Water Bottles: What's the Difference?", slug: "american-vs-chinese-hydrogen-bottles", articleType: "comparison", searchIntent: "commercial" },
      { keyword: "how to test hydrogen water concentration", title: "How to Test Your Hydrogen Water: PPM Drops, Meters, and Lab Testing", slug: "how-to-test-hydrogen-water-ppm", articleType: "how-to", searchIntent: "informational" },
      { keyword: "hydrogen water bottle warranty", title: "Hydrogen Water Bottle Warranties: What Quality Brands Offer", slug: "hydrogen-water-bottle-warranty-guide", articleType: "buying-guide", searchIntent: "commercial" },
      { keyword: "hydrogen water bottle certifications", title: "Hydrogen Water Bottle Safety Certifications: UL, CE, and FDA Explained", slug: "hydrogen-water-bottle-certifications", articleType: "explainer", searchIntent: "informational" },
    ],
  },

  // ========================
  // COMPETITOR-SPECIFIC CLUSTERS
  // One pillar + ~8 cluster posts per competitor brand. Tone: factual
  // comparisons grounded in the research database, not hit pieces.
  // ========================

  // 1. Enagic / Kangen — highest-volume MLM ionizer brand
  {
    pillarKeyword: "kangen water alternative",
    pillarTitle: "Kangen Water Alternative: Why Modern Hydrogen Water Bottles Outperform the $4,000 Enagic Machine",
    slug: "kangen-water-alternative",
    category: "competitor",
    targetAudience: "consumer",
    searchIntent: "commercial",
    estimatedSearchVolume: 12000,
    priority: 95,
    clusterKeywords: [
      { keyword: "kangen water review", title: "Kangen Water Review: The Real Pros, Cons, and Science Behind Enagic's SD501", slug: "kangen-water-review", articleType: "review", searchIntent: "commercial" },
      { keyword: "is kangen water worth it", title: "Is Kangen Water Worth $4,000? An Honest Cost-vs-Benefit Analysis", slug: "is-kangen-water-worth-it", articleType: "comparison", searchIntent: "commercial" },
      { keyword: "kangen water vs hydrogen water", title: "Kangen Water vs Hydrogen Water: Ionization, Alkalinity, and What Actually Delivers H2", slug: "kangen-vs-hydrogen-water", articleType: "comparison", searchIntent: "informational" },
      { keyword: "kangen water scam", title: "Is Kangen Water a Scam? Separating MLM Marketing From the Science", slug: "kangen-water-scam-truth", articleType: "explainer", searchIntent: "informational" },
      { keyword: "kangen water complaints", title: "Common Kangen Water Complaints: What Owners Wish They Knew First", slug: "kangen-water-complaints", articleType: "review", searchIntent: "commercial" },
      { keyword: "enagic sd501 vs hydrogen bottle", title: "Enagic SD501 vs Portable Hydrogen Bottle: Size, Cost, and H2 Output Compared", slug: "enagic-sd501-vs-hydrogen-bottle", articleType: "comparison", searchIntent: "commercial" },
      { keyword: "kangen water ppm hydrogen", title: "How Much Molecular Hydrogen Is Actually in Kangen Water? Lab Test Results", slug: "kangen-water-ppm-hydrogen-levels", articleType: "explainer", searchIntent: "informational" },
      { keyword: "cheaper than kangen water", title: "Cheaper Alternatives to Kangen Water That Actually Deliver More Hydrogen", slug: "cheaper-than-kangen-water", articleType: "buying-guide", searchIntent: "commercial" },
    ],
  },

  // 2. Tyent USA
  {
    pillarKeyword: "tyent water ionizer review",
    pillarTitle: "Tyent Water Ionizer Review: Price, Performance, and Simpler Alternatives",
    slug: "tyent-water-ionizer-review",
    category: "competitor",
    targetAudience: "consumer",
    searchIntent: "commercial",
    estimatedSearchVolume: 3000,
    priority: 80,
    clusterKeywords: [
      { keyword: "tyent ach-9 review", title: "Tyent ACE-13 and ACH-9 Reviewed: Is the Premium Price Justified?", slug: "tyent-ach-9-review", articleType: "review", searchIntent: "commercial" },
      { keyword: "tyent vs kangen", title: "Tyent vs Kangen: Head-to-Head on Plates, Output, and Real-World Use", slug: "tyent-vs-kangen", articleType: "comparison", searchIntent: "commercial" },
      { keyword: "tyent vs hydrogen water bottle", title: "Tyent Ionizer vs a Portable Hydrogen Bottle: Which Delivers Actual H2?", slug: "tyent-vs-hydrogen-water-bottle", articleType: "comparison", searchIntent: "commercial" },
      { keyword: "tyent water ionizer price", title: "Tyent Water Ionizer Price Breakdown: What You're Really Paying For", slug: "tyent-water-ionizer-price", articleType: "explainer", searchIntent: "commercial" },
      { keyword: "tyent complaints", title: "Tyent Water Ionizer Complaints: Owner-Reported Issues and Trade-offs", slug: "tyent-complaints", articleType: "review", searchIntent: "commercial" },
      { keyword: "tyent alternative", title: "Best Tyent Alternatives: Hydrogen Water Without the Countertop Commitment", slug: "tyent-alternative", articleType: "buying-guide", searchIntent: "commercial" },
      { keyword: "tyent hydrogen output", title: "How Much Hydrogen Does Tyent Actually Produce? Measured PPM Results", slug: "tyent-hydrogen-output", articleType: "explainer", searchIntent: "informational" },
      { keyword: "tyent water ionizer problems", title: "Tyent Ionizer Problems: Maintenance, Plate Degradation, and Long-Term Costs", slug: "tyent-water-ionizer-problems", articleType: "explainer", searchIntent: "informational" },
    ],
  },

  // 3. AlkaViva
  {
    pillarKeyword: "alkaviva water ionizer review",
    pillarTitle: "AlkaViva Water Ionizer Review: UltraWater Filtration and the Hydrogen Question",
    slug: "alkaviva-water-ionizer-review",
    category: "competitor",
    targetAudience: "consumer",
    searchIntent: "commercial",
    estimatedSearchVolume: 2500,
    priority: 75,
    clusterKeywords: [
      { keyword: "alkaviva vs kangen", title: "AlkaViva vs Kangen: Ionizers Compared on Price, Filtration, and H2 Output", slug: "alkaviva-vs-kangen", articleType: "comparison", searchIntent: "commercial" },
      { keyword: "alkaviva vamos vs vesta", title: "AlkaViva Vamos vs Vesta H2: Which Model Is Right for You?", slug: "alkaviva-vamos-vs-vesta", articleType: "comparison", searchIntent: "commercial" },
      { keyword: "is alkaviva worth it", title: "Is AlkaViva Worth It? An Honest Review of Price vs Performance", slug: "is-alkaviva-worth-it", articleType: "comparison", searchIntent: "commercial" },
      { keyword: "alkaviva ultrawater review", title: "AlkaViva UltraWater Filtration: What It Removes (and What It Doesn't)", slug: "alkaviva-ultrawater-review", articleType: "review", searchIntent: "informational" },
      { keyword: "alkaviva vs hydrogen water bottle", title: "AlkaViva Countertop vs Portable Hydrogen Bottle: Real-World Comparison", slug: "alkaviva-vs-hydrogen-water-bottle", articleType: "comparison", searchIntent: "commercial" },
      { keyword: "alkaviva alternative", title: "AlkaViva Alternatives: Hydrogen Water Options That Skip the $2,000 Counter Unit", slug: "alkaviva-alternative", articleType: "buying-guide", searchIntent: "commercial" },
      { keyword: "alkaviva complaints", title: "AlkaViva Complaints and Issues: What Long-Term Owners Report", slug: "alkaviva-complaints", articleType: "review", searchIntent: "commercial" },
      { keyword: "alkaviva hydrogen water ppm", title: "AlkaViva Hydrogen PPM: How the Ionizer Stacks Up on Measured H2 Output", slug: "alkaviva-hydrogen-water-ppm", articleType: "explainer", searchIntent: "informational" },
    ],
  },

  // 4. Evolv
  {
    pillarKeyword: "evolv hydrogen water bottle review",
    pillarTitle: "Evolv Hydrogen Water Bottle Review: PPM, Materials, and How It Compares",
    slug: "evolv-hydrogen-water-bottle-review",
    category: "competitor",
    targetAudience: "consumer",
    searchIntent: "commercial",
    estimatedSearchVolume: 1800,
    priority: 70,
    clusterKeywords: [
      { keyword: "evolv water bottle review", title: "Evolv Hydrogen Water Bottle: Full Review With Lab-Tested PPM Results", slug: "evolv-water-bottle-review", articleType: "review", searchIntent: "commercial" },
      { keyword: "evolv hydrogen water ppm", title: "What's the Real Hydrogen PPM of an Evolv Bottle? Independent Testing", slug: "evolv-hydrogen-water-ppm", articleType: "explainer", searchIntent: "informational" },
      { keyword: "evolv vs echo water", title: "Evolv vs Echo Water: Hydrogen Output, Materials, and Warranty Side-by-Side", slug: "evolv-vs-echo-water", articleType: "comparison", searchIntent: "commercial" },
      { keyword: "evolv water complaints", title: "Evolv Hydrogen Water Complaints: Common Issues From Verified Users", slug: "evolv-water-complaints", articleType: "review", searchIntent: "commercial" },
      { keyword: "evolv hydrogen water alternative", title: "Evolv Alternatives: Better-Value Hydrogen Water Bottles Worth Considering", slug: "evolv-hydrogen-water-alternative", articleType: "buying-guide", searchIntent: "commercial" },
      { keyword: "is evolv water worth it", title: "Is Evolv Hydrogen Water Worth the Price? Cost-per-Liter Analysis", slug: "is-evolv-water-worth-it", articleType: "comparison", searchIntent: "commercial" },
      { keyword: "evolv water warranty", title: "Evolv Water Warranty and Customer Service: What Owners Actually Get", slug: "evolv-water-warranty", articleType: "explainer", searchIntent: "commercial" },
      { keyword: "evolv spe pem technology", title: "Does Evolv Use SPE/PEM Technology? Electrode Quality Compared", slug: "evolv-spe-pem-technology", articleType: "explainer", searchIntent: "informational" },
    ],
  },

  // 5. Piurify
  {
    pillarKeyword: "piurify hydrogen water bottle review",
    pillarTitle: "Piurify Hydrogen Water Bottle Review: Quality Test, PPM, and Alternatives",
    slug: "piurify-hydrogen-water-bottle-review",
    category: "competitor",
    targetAudience: "consumer",
    searchIntent: "commercial",
    estimatedSearchVolume: 2200,
    priority: 70,
    clusterKeywords: [
      { keyword: "piurify review", title: "Piurify Hydrogen Water Bottle: Independent Review and PPM Testing", slug: "piurify-review", articleType: "review", searchIntent: "commercial" },
      { keyword: "piurify vs echo water", title: "Piurify vs Echo Water: Side-by-Side Comparison on Quality and H2 Output", slug: "piurify-vs-echo-water", articleType: "comparison", searchIntent: "commercial" },
      { keyword: "piurify complaints", title: "Piurify Complaints: What Long-Term Users Wish They Knew", slug: "piurify-complaints", articleType: "review", searchIntent: "commercial" },
      { keyword: "piurify hydrogen ppm", title: "How Much Hydrogen Does a Piurify Bottle Actually Produce?", slug: "piurify-hydrogen-ppm", articleType: "explainer", searchIntent: "informational" },
      { keyword: "piurify warranty", title: "Piurify Hydrogen Water Bottle Warranty: Coverage and Real-World Claims", slug: "piurify-warranty", articleType: "explainer", searchIntent: "commercial" },
      { keyword: "piurify alternative", title: "Piurify Alternatives: Hydrogen Water Bottles With Stronger Output", slug: "piurify-alternative", articleType: "buying-guide", searchIntent: "commercial" },
      { keyword: "is piurify worth it", title: "Is Piurify Worth It? A Cost-vs-Quality Breakdown", slug: "is-piurify-worth-it", articleType: "comparison", searchIntent: "commercial" },
      { keyword: "piurify materials quality", title: "Piurify Materials Explained: Electrodes, BPA, and Build Quality", slug: "piurify-materials-quality", articleType: "explainer", searchIntent: "informational" },
    ],
  },

  // 6. IonBottles
  {
    pillarKeyword: "ionbottles hydrogen water bottle review",
    pillarTitle: "IonBottles Review: Hydrogen Output, Quality, and Better Alternatives",
    slug: "ionbottles-hydrogen-water-bottle-review",
    category: "competitor",
    targetAudience: "consumer",
    searchIntent: "commercial",
    estimatedSearchVolume: 1500,
    priority: 65,
    clusterKeywords: [
      { keyword: "ionbottles review", title: "IonBottles Review: Lab-Tested PPM, Materials, and Long-Term Performance", slug: "ionbottles-review", articleType: "review", searchIntent: "commercial" },
      { keyword: "ionbottles vs echo water", title: "IonBottles vs Echo Water: Quality, Output, and Value Compared", slug: "ionbottles-vs-echo-water", articleType: "comparison", searchIntent: "commercial" },
      { keyword: "ionbottles ppm hydrogen", title: "IonBottles Hydrogen PPM: Does Marketing Match the Output?", slug: "ionbottles-ppm-hydrogen", articleType: "explainer", searchIntent: "informational" },
      { keyword: "ionbottles quality issues", title: "IonBottles Quality Issues: Common Defects and What Owners Report", slug: "ionbottles-quality-issues", articleType: "review", searchIntent: "commercial" },
      { keyword: "ionbottles warranty", title: "IonBottles Warranty Coverage: What's Included, What's Not", slug: "ionbottles-warranty", articleType: "explainer", searchIntent: "commercial" },
      { keyword: "is ionbottles legit", title: "Is IonBottles Legit? Separating Marketing From Real Performance", slug: "is-ionbottles-legit", articleType: "review", searchIntent: "commercial" },
      { keyword: "ionbottles alternative", title: "IonBottles Alternatives: Better-Built Hydrogen Water Bottles", slug: "ionbottles-alternative", articleType: "buying-guide", searchIntent: "commercial" },
      { keyword: "ionbottles electrode material", title: "IonBottles Electrode Materials: Titanium, Platinum, and Why It Matters", slug: "ionbottles-electrode-material", articleType: "explainer", searchIntent: "informational" },
    ],
  },

  // 7. HFactor Water — pre-bottled
  {
    pillarKeyword: "hfactor hydrogen water review",
    pillarTitle: "HFactor Hydrogen Water Review: Does Pre-Bottled H2 Water Actually Work?",
    slug: "hfactor-hydrogen-water-review",
    category: "competitor",
    targetAudience: "consumer",
    searchIntent: "commercial",
    estimatedSearchVolume: 4500,
    priority: 80,
    clusterKeywords: [
      { keyword: "hfactor water review", title: "HFactor Water: Complete Review of the Best-Known Pre-Bottled H2 Brand", slug: "hfactor-water-review", articleType: "review", searchIntent: "commercial" },
      { keyword: "hfactor water ppm", title: "HFactor Hydrogen PPM: What's in the Pouch When You Open It?", slug: "hfactor-water-ppm", articleType: "explainer", searchIntent: "informational" },
      { keyword: "hfactor vs fresh hydrogen water", title: "HFactor Pouches vs Fresh Hydrogen Water: The Shelf-Life Problem", slug: "hfactor-vs-fresh-hydrogen-water", articleType: "comparison", searchIntent: "informational" },
      { keyword: "does hfactor water still have hydrogen", title: "How Long Does HFactor Hold Its Hydrogen? The Science of H2 Escape", slug: "does-hfactor-water-still-have-hydrogen", articleType: "explainer", searchIntent: "informational" },
      { keyword: "hfactor vs hydrogen water bottle", title: "HFactor Pouches vs a Reusable Hydrogen Bottle: Cost and H2 Dose Compared", slug: "hfactor-vs-hydrogen-water-bottle", articleType: "comparison", searchIntent: "commercial" },
      { keyword: "hfactor cost per ounce", title: "HFactor Cost Per Ounce: Why Pre-Bottled Hydrogen Gets Expensive Fast", slug: "hfactor-cost-per-ounce", articleType: "buying-guide", searchIntent: "commercial" },
      { keyword: "hfactor alternative", title: "HFactor Alternatives: Fresher, Higher-PPM Ways to Drink Hydrogen Water", slug: "hfactor-alternative", articleType: "buying-guide", searchIntent: "commercial" },
      { keyword: "is hfactor water worth it", title: "Is HFactor Water Worth It? A Value + Efficacy Breakdown", slug: "is-hfactor-water-worth-it", articleType: "comparison", searchIntent: "commercial" },
    ],
  },

  // 8. Drink HRW
  {
    pillarKeyword: "drink hrw tablets review",
    pillarTitle: "Drink HRW Review: Do Rejuvenation Hydrogen Tablets Live Up to the Research?",
    slug: "drink-hrw-tablets-review",
    category: "competitor",
    targetAudience: "consumer",
    searchIntent: "commercial",
    estimatedSearchVolume: 5500,
    priority: 85,
    clusterKeywords: [
      { keyword: "drink hrw review", title: "Drink HRW Review: The Real Pros and Cons of the Flagship H2 Tablet Brand", slug: "drink-hrw-review", articleType: "review", searchIntent: "commercial" },
      { keyword: "drink hrw rejuvenation review", title: "Drink HRW Rejuvenation Tablets Reviewed: Dissolution Time and Measured PPM", slug: "drink-hrw-rejuvenation-review", articleType: "review", searchIntent: "commercial" },
      { keyword: "drink hrw vs hydrogen water bottle", title: "Drink HRW Tablets vs Hydrogen Water Bottle: Dosing, Cost, and Convenience", slug: "drink-hrw-vs-hydrogen-water-bottle", articleType: "comparison", searchIntent: "commercial" },
      { keyword: "hrw tablets side effects", title: "Drink HRW Tablet Side Effects: What the Research and User Reports Show", slug: "hrw-tablets-side-effects", articleType: "safety", searchIntent: "informational" },
      { keyword: "drink hrw ppm", title: "Drink HRW PPM: Actual Hydrogen Concentration From the Tablets", slug: "drink-hrw-ppm", articleType: "explainer", searchIntent: "informational" },
      { keyword: "drink hrw complaints", title: "Drink HRW Complaints: Common Issues, Taste, and Subscription Gotchas", slug: "drink-hrw-complaints", articleType: "review", searchIntent: "commercial" },
      { keyword: "drink hrw cost per day", title: "Drink HRW Cost Per Day: Is a Tablet Subscription Actually Cheaper Than a Bottle?", slug: "drink-hrw-cost-per-day", articleType: "buying-guide", searchIntent: "commercial" },
      { keyword: "drink hrw alternative", title: "Drink HRW Alternatives: Hydrogen Options With Higher PPM and No Subscription", slug: "drink-hrw-alternative", articleType: "buying-guide", searchIntent: "commercial" },
    ],
  },

  // 9. Vital Reaction
  {
    pillarKeyword: "vital reaction tablets review",
    pillarTitle: "Vital Reaction Review: Hydrogen Tablets Tested for PPM, Dissolution, and Value",
    slug: "vital-reaction-tablets-review",
    category: "competitor",
    targetAudience: "consumer",
    searchIntent: "commercial",
    estimatedSearchVolume: 2800,
    priority: 75,
    clusterKeywords: [
      { keyword: "vital reaction review", title: "Vital Reaction Hydrogen Tablets Review: Independent PPM and Taste Testing", slug: "vital-reaction-review", articleType: "review", searchIntent: "commercial" },
      { keyword: "vital reaction vs drink hrw", title: "Vital Reaction vs Drink HRW: Tablet Makers Compared on Output and Price", slug: "vital-reaction-vs-drink-hrw", articleType: "comparison", searchIntent: "commercial" },
      { keyword: "vital reaction vs hydrogen water bottle", title: "Vital Reaction Tablets vs a Hydrogen Water Bottle: Real-World Dosing", slug: "vital-reaction-vs-hydrogen-water-bottle", articleType: "comparison", searchIntent: "commercial" },
      { keyword: "vital reaction ppm", title: "Vital Reaction PPM: How Much Hydrogen One Tablet Actually Produces", slug: "vital-reaction-ppm", articleType: "explainer", searchIntent: "informational" },
      { keyword: "vital reaction side effects", title: "Vital Reaction Side Effects: Dissolution Products and Magnesium Dose", slug: "vital-reaction-side-effects", articleType: "safety", searchIntent: "informational" },
      { keyword: "vital reaction complaints", title: "Vital Reaction Complaints: User-Reported Issues and Subscription Problems", slug: "vital-reaction-complaints", articleType: "review", searchIntent: "commercial" },
      { keyword: "is vital reaction worth it", title: "Is Vital Reaction Worth It? Price-per-Dose vs Fresh Hydrogen Water", slug: "is-vital-reaction-worth-it", articleType: "comparison", searchIntent: "commercial" },
      { keyword: "vital reaction alternative", title: "Vital Reaction Alternatives: Fresh Hydrogen Water Without Tablets", slug: "vital-reaction-alternative", articleType: "buying-guide", searchIntent: "commercial" },
    ],
  },

  // 10. H2 Tabs
  {
    pillarKeyword: "h2 tabs review",
    pillarTitle: "H2 Tabs Review: Hydrogen Tablets Compared on PPM, Price, and Convenience",
    slug: "h2-tabs-review",
    category: "competitor",
    targetAudience: "consumer",
    searchIntent: "commercial",
    estimatedSearchVolume: 2000,
    priority: 70,
    clusterKeywords: [
      { keyword: "h2 tabs review", title: "H2 Tabs Hydrogen Tablets Review: Full Testing and Honest Assessment", slug: "h2-tabs-review-full", articleType: "review", searchIntent: "commercial" },
      { keyword: "h2 tabs vs drink hrw", title: "H2 Tabs vs Drink HRW: Which Hydrogen Tablet Actually Dissolves Better?", slug: "h2-tabs-vs-drink-hrw", articleType: "comparison", searchIntent: "commercial" },
      { keyword: "h2 tabs vs vital reaction", title: "H2 Tabs vs Vital Reaction: PPM, Ingredients, and Per-Dose Cost", slug: "h2-tabs-vs-vital-reaction", articleType: "comparison", searchIntent: "commercial" },
      { keyword: "h2 tabs vs hydrogen water bottle", title: "H2 Tabs vs Hydrogen Water Bottle: Portability and Real-World Dosing", slug: "h2-tabs-vs-hydrogen-water-bottle", articleType: "comparison", searchIntent: "commercial" },
      { keyword: "h2 tabs ppm", title: "H2 Tabs Hydrogen PPM: Actual Measurements vs Marketing Claims", slug: "h2-tabs-ppm", articleType: "explainer", searchIntent: "informational" },
      { keyword: "h2 tabs side effects", title: "H2 Tabs Side Effects: Magnesium, Dissolution, and Who Should Be Cautious", slug: "h2-tabs-side-effects", articleType: "safety", searchIntent: "informational" },
      { keyword: "h2 tabs worth it", title: "Are H2 Tabs Worth It? Cost-per-Dose Compared to Fresh Hydrogen Water", slug: "h2-tabs-worth-it", articleType: "comparison", searchIntent: "commercial" },
      { keyword: "h2 tabs alternative", title: "Best H2 Tabs Alternatives: Tablets, Bottles, and Fresh Hydrogen Options", slug: "h2-tabs-alternative", articleType: "buying-guide", searchIntent: "commercial" },
    ],
  },
];

// ============================================================
// Cluster Management
// ============================================================

/**
 * Check if the seo_content_clusters table exists
 */
async function ensureClusterTableExists(): Promise<boolean> {
  try {
    const result = await db.execute(
      sql`SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'seo_content_clusters') AS "exists"`
    );
    return (result as any).rows?.[0]?.exists === true || (result as any)[0]?.exists === true;
  } catch {
    return false;
  }
}

/**
 * Seed the default keyword clusters into the database
 */
export async function seedKeywordClusters(): Promise<{ created: number; existing: number }> {
  if (!(await ensureClusterTableExists())) {
    throw new Error("seo_content_clusters table does not exist yet. Run db:push first.");
  }

  let created = 0;
  let existing = 0;

  for (const seed of DEFAULT_KEYWORD_CLUSTERS) {
    const [exists] = await db.select({ id: seoContentClusters.id })
      .from(seoContentClusters)
      .where(eq(seoContentClusters.slug, seed.slug))
      .limit(1);

    if (exists) {
      existing++;
      continue;
    }

    await db.insert(seoContentClusters).values({
      pillarKeyword: seed.pillarKeyword,
      pillarTitle: seed.pillarTitle,
      slug: seed.slug,
      category: seed.category,
      targetAudience: seed.targetAudience,
      searchIntent: seed.searchIntent,
      clusterKeywords: JSON.stringify(seed.clusterKeywords),
      totalClusterPosts: seed.clusterKeywords.length,
      echoProductReferences: JSON.stringify(
        ECHO_PRODUCTS.filter(p =>
          seed.pillarKeyword.includes(p.keyword) || p.keyword.includes(seed.pillarKeyword.split(" ")[0])
        )
      ),
      includeProductCTA: seed.category === "product" || seed.category === "competitor",
      estimatedSearchVolume: seed.estimatedSearchVolume || null,
      priority: seed.priority,
    });
    created++;
  }

  return { created, existing };
}

/**
 * Get all keyword clusters with their generation status
 */
export async function getKeywordClusters() {
  try {
    const result = await db.execute(
      sql`SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'seo_content_clusters') AS "exists"`
    );
    const exists = (result as any).rows?.[0]?.exists === true || (result as any)[0]?.exists === true;
    if (!exists) return [];
  } catch {
    return [];
  }

  const clusters = await db.select().from(seoContentClusters).orderBy(desc(seoContentClusters.priority));
  return clusters.map(c => ({
    ...c,
    clusterKeywords: JSON.parse(c.clusterKeywords || "[]"),
    echoProductReferences: JSON.parse(c.echoProductReferences || "[]"),
  }));
}

// ============================================================
// Content Generation — Keyword-Centric
// ============================================================

/**
 * Generate a pillar page for a keyword cluster
 */
export async function generateKeywordPillarPage(clusterId: number): Promise<{
  success: boolean;
  articleId?: number;
  title?: string;
  message: string;
}> {
  if (!(await ensureClusterTableExists())) {
    return { success: false, message: "seo_content_clusters table not yet created. Deploy with db:push." };
  }
  if (ai.getProviderStatus().primary === "none") {
    return { success: false, message: "No AI provider configured" };
  }

  const [cluster] = await db.select().from(seoContentClusters)
    .where(eq(seoContentClusters.id, clusterId));
  if (!cluster) return { success: false, message: "Cluster not found" };

  const clusterKws = JSON.parse(cluster.clusterKeywords || "[]");
  const echoProducts = JSON.parse(cluster.echoProductReferences || "[]");

  // Find relevant studies from the database
  const searchTerms = cluster.pillarKeyword.split(" ").filter(w => w.length > 3);
  const relatedStudies = await db.select({
    id: studies.id,
    title: studies.title,
    abstract: studies.abstract,
    authors: studies.authors,
    journal: studies.journal,
    publishYear: studies.publishYear,
    studyType: studies.studyType,
    outcome: studies.outcome,
    slug: studies.slug,
    conclusion: studies.conclusion,
    sampleSize: studies.sampleSize,
    summary100Words: studies.summary100Words,
  })
    .from(studies)
    .where(
      or(
        ...searchTerms.map(term => ilike(studies.title, `%${term}%`)),
        ilike(studies.category, `%hydrogen%`),
      )
    )
    .orderBy(desc(studies.publishYear))
    .limit(40);

  const studySummaries = relatedStudies.map((s, i) => {
    const link = s.slug ? `${SITE_URL}/study/${s.slug}` : `${SITE_URL}/study/id/${s.id}`;
    return `[${i + 1}] "${s.title}" (${s.publishYear || "N/A"}, ${s.journal})
    Type: ${s.studyType || "Unknown"} | Outcome: ${s.outcome || "Unknown"} | N=${s.sampleSize || "N/A"}
    ${s.summary100Words || s.abstract?.substring(0, 300) || "No abstract"}
    Link: ${link}`;
  }).join("\n\n");

  const humanStudies = relatedStudies.filter(s => s.studyType === "human").length;
  const positiveOutcomes = relatedStudies.filter(s => s.outcome === "positive").length;

  // Build product context if applicable
  let productContext = "";
  if (cluster.includeProductCTA && echoProducts.length > 0) {
    productContext = `\n\nPRODUCT CONTEXT (weave naturally into content where relevant, NOT as ads):
${echoProducts.map((p: any) => `- ${p.product}: ${p.description} — [Learn more](${p.url})`).join("\n")}

BRAND CONTEXT:
${ECHO_BRAND_CONTEXT}

When mentioning products, be authentic. Reference Echo products as examples of quality hydrogen technology. Position them as the solution when discussing what to look for in hydrogen products. Never be overtly promotional — let the research speak and naturally lead to the product as a recommendation.`;
  }

  // Build cluster article context (what the supporting articles will cover)
  const clusterContext = clusterKws.length > 0
    ? `\n\nSUPPORTING ARTICLES (link to these within the pillar page):
${clusterKws.map((ck: any) => `- [${ck.title}](${SITE_URL}/blog/${ck.slug})`).join("\n")}`
    : "";

  // Different prompts based on category
  const categoryInstructions: Record<string, string> = {
    product: `This is a PRODUCT-FOCUSED pillar page. The reader is considering buying a hydrogen product. Balance education with buying guidance. Include "What to Look For" and "How to Choose" sections. Reference Echo Water products as examples of quality standards.`,
    research: `This is a RESEARCH/CREDIBILITY pillar page. The reader is skeptical about hydrogen water. Lead with the strongest evidence. Be transparent about limitations. Build trust through honesty. Reference the ${relatedStudies.length} real studies in our database.`,
    competitor: `This is a DIFFERENTIATION pillar page. Help readers understand quality differences between hydrogen products. Explain technical differences (electrode materials, PPM levels, safety certifications). Don't name competitors but contrast quality markers clearly.`,
  };

  const prompt = `You are a world-class health science writer and SEO content strategist. Write a comprehensive PILLAR PAGE.

TARGET KEYWORD: "${cluster.pillarKeyword}"
TITLE: ${cluster.pillarTitle}
CATEGORY: ${cluster.category}
TARGET AUDIENCE: ${cluster.targetAudience}
SEARCH INTENT: ${cluster.searchIntent}

${categoryInstructions[cluster.category] || categoryInstructions.research}

RESEARCH DATA (${relatedStudies.length} studies, ${humanStudies} human, ${positiveOutcomes} positive outcomes):
${studySummaries}
${productContext}
${clusterContext}

REQUIREMENTS:
1. Write 3,000-5,000 words of authoritative, engaging content
2. Use 8th-grade reading level — accessible but credible
3. Structure with ## and ### markdown headings
4. Use the target keyword naturally 5-8 times
5. Reference specific studies with inline links
6. Include real statistics and sample sizes
7. Add "Key Takeaways" at the top (5-7 bullet points)
8. Include 5-8 FAQ questions at the end
9. Link to supporting cluster articles where natural
10. Be honest about limitations — credibility builds trust
11. Include a clear "Bottom Line" conclusion
12. If relevant, include a brief product recommendation section

Return JSON with: title, content (markdown), summary, metaTitle (60 chars), metaDescription (155 chars), ogTitle (65 chars), ogDescription (200 chars), semanticKeywords (array), questionAnswerPairs (array of {question, answer}), quickInsights (bulleted string)`;

  try {
    const data = await ai.generateJSON(
      "You are an expert health science and SEO writer. Return only valid JSON.",
      prompt,
      { temperature: 0.7, maxTokens: 10000 }
    );

    const slug = cluster.slug + "-pillar";

    // Check for existing
    const [existing] = await db.select({ id: blogArticles.id })
      .from(blogArticles)
      .where(eq(blogArticles.slug, slug))
      .limit(1);

    if (existing) {
      await db.update(seoContentClusters)
        .set({ pillarArticleId: existing.id, updatedAt: new Date() })
        .where(eq(seoContentClusters.id, clusterId));
      return { success: true, articleId: existing.id, title: data.title, message: "Pillar page already exists" };
    }

    // Find a study ID for the FK
    const studyId = relatedStudies[0]?.id || 1;

    const [article] = await db.insert(blogArticles).values({
      studyId,
      title: data.title || cluster.pillarTitle,
      slug,
      summary: data.summary || "",
      content: data.content || "",
      quickInsights: data.quickInsights || "",
      readingLevel: "general",
      articleType: "pillar_page",
      isPublished: true,
      metaTitle: data.metaTitle || cluster.pillarTitle.substring(0, 60),
      metaDescription: data.metaDescription || "",
      ogTitle: data.ogTitle || "",
      ogDescription: data.ogDescription || "",
      semanticKeywords: data.semanticKeywords || [],
      questionAnswerPairs: JSON.stringify(data.questionAnswerPairs || []),
      canonicalUrl: `${SITE_URL}/blog/${slug}`,
    }).returning({ id: blogArticles.id });

    // Update cluster with pillar article ID
    await db.update(seoContentClusters)
      .set({ pillarArticleId: article.id, updatedAt: new Date() })
      .where(eq(seoContentClusters.id, clusterId));

    return { success: true, articleId: article.id, title: data.title, message: "Pillar page generated and saved" };
  } catch (error) {
    console.error(`[KeywordStrategy] Error generating pillar for "${cluster.pillarKeyword}":`, error);
    return { success: false, message: error instanceof Error ? error.message : "Generation failed" };
  }
}

/**
 * Generate a single cluster post for a keyword cluster
 */
export async function generateKeywordClusterPost(
  clusterId: number,
  clusterKeywordIndex: number,
): Promise<{
  success: boolean;
  articleId?: number;
  title?: string;
  message: string;
}> {
  if (!(await ensureClusterTableExists())) {
    return { success: false, message: "seo_content_clusters table not yet created." };
  }
  if (ai.getProviderStatus().primary === "none") {
    return { success: false, message: "No AI provider configured" };
  }

  const [cluster] = await db.select().from(seoContentClusters)
    .where(eq(seoContentClusters.id, clusterId));
  if (!cluster) return { success: false, message: "Cluster not found" };

  const clusterKws = JSON.parse(cluster.clusterKeywords || "[]");
  if (clusterKeywordIndex >= clusterKws.length) {
    return { success: false, message: "Invalid keyword index" };
  }
  const ckw = clusterKws[clusterKeywordIndex];
  const echoProducts = JSON.parse(cluster.echoProductReferences || "[]");

  // Check if already exists
  const [existing] = await db.select({ id: blogArticles.id })
    .from(blogArticles)
    .where(eq(blogArticles.slug, ckw.slug))
    .limit(1);

  if (existing) {
    return { success: true, articleId: existing.id, title: ckw.title, message: "Article already exists" };
  }

  // Find relevant studies
  const searchTerms = ckw.keyword.split(" ").filter((w: string) => w.length > 3);
  const relatedStudies = await db.select({
    id: studies.id,
    title: studies.title,
    abstract: studies.abstract,
    journal: studies.journal,
    publishYear: studies.publishYear,
    studyType: studies.studyType,
    outcome: studies.outcome,
    slug: studies.slug,
    conclusion: studies.conclusion,
    summary100Words: studies.summary100Words,
  })
    .from(studies)
    .where(
      or(
        ...searchTerms.map((term: string) => ilike(studies.title, `%${term}%`)),
        ilike(studies.category, `%hydrogen%`),
      )
    )
    .orderBy(desc(studies.publishYear))
    .limit(15);

  const studyRefs = relatedStudies.map((s, i) => {
    const link = s.slug ? `${SITE_URL}/study/${s.slug}` : `${SITE_URL}/study/id/${s.id}`;
    return `[${i + 1}] "${s.title}" (${s.publishYear || "N/A"}, ${s.journal})\n    ${s.summary100Words || s.abstract?.substring(0, 200) || ""}\n    Link: ${link}`;
  }).join("\n\n");

  const pillarLink = `${SITE_URL}/blog/${cluster.slug}-pillar`;

  let productContext = "";
  if (cluster.includeProductCTA && echoProducts.length > 0) {
    productContext = `\n\nPRODUCT CONTEXT (mention naturally where relevant):
${echoProducts.map((p: any) => `- ${p.product}: ${p.description} — [Learn more](${p.url})`).join("\n")}
Keep product mentions subtle and authentic — reference as examples when discussing quality, technology, or practical recommendations.`;
  }

  const articleTypeInstructions: Record<string, string> = {
    explainer: "Write an accessible explainer. Lead with the answer, then provide evidence.",
    comparison: "Compare options honestly. Use data points. Include a comparison framework.",
    faq: "Write FAQ format with 8-12 questions and evidence-based answers.",
    "how-to": "Write a practical guide with clear steps and research backing.",
    "research-roundup": "Summarize the most important studies. Highlight trends and consensus.",
    benefits: "Focus on specific, research-backed benefits. Use data points.",
    safety: "Address safety concerns honestly. Discuss the safety record from studies.",
    "buying-guide": "Help readers make informed purchasing decisions based on quality markers.",
    review: "Provide an honest, detailed product review with pros, cons, and alternatives.",
    "expert-roundup": "Present expert perspectives and research consensus.",
  };

  const prompt = `You are an expert health science writer. Write a blog article.

TITLE: ${ckw.title}
TARGET KEYWORD: "${ckw.keyword}"
ARTICLE TYPE: ${ckw.articleType}
PARENT PILLAR: ${cluster.pillarTitle}
PILLAR LINK: ${pillarLink}

INSTRUCTIONS: ${articleTypeInstructions[ckw.articleType] || articleTypeInstructions.explainer}

STUDIES:
${studyRefs || "Use general hydrogen therapy research knowledge."}
${productContext}

REQUIREMENTS:
1. Write 1,200-2,000 words
2. 8th-grade reading level
3. Use ## and ### markdown headings
4. Target keyword naturally 3-5 times
5. Reference studies with inline links
6. Link back to pillar page at least once
7. Include "Bottom Line" section
8. 3-5 FAQ questions at end
9. Be honest about evidence limitations

Return JSON: title, content (markdown), summary, metaTitle (60 chars), metaDescription (155 chars), ogTitle, ogDescription, semanticKeywords (array), questionAnswerPairs (array), quickInsights`;

  try {
    const data = await ai.generateJSON(
      "You are an expert health science writer. Return only valid JSON.",
      prompt,
      { temperature: 0.7, maxTokens: 5000 }
    );

    const studyId = relatedStudies[0]?.id || 1;

    const [article] = await db.insert(blogArticles).values({
      studyId,
      title: data.title || ckw.title,
      slug: ckw.slug,
      summary: data.summary || "",
      content: data.content || "",
      quickInsights: data.quickInsights || "",
      readingLevel: "general",
      articleType: `cluster_${ckw.articleType}`,
      isPublished: true,
      metaTitle: data.metaTitle || ckw.title.substring(0, 60),
      metaDescription: data.metaDescription || "",
      ogTitle: data.ogTitle || "",
      ogDescription: data.ogDescription || "",
      semanticKeywords: data.semanticKeywords || [],
      questionAnswerPairs: JSON.stringify(data.questionAnswerPairs || []),
      canonicalUrl: `${SITE_URL}/blog/${ckw.slug}`,
    }).returning({ id: blogArticles.id });

    // Update cluster progress
    await db.update(seoContentClusters)
      .set({
        generatedClusterPosts: sql`${seoContentClusters.generatedClusterPosts} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(seoContentClusters.id, clusterId));

    return { success: true, articleId: article.id, title: data.title, message: "Cluster post generated" };
  } catch (error) {
    console.error(`[KeywordStrategy] Error generating cluster post "${ckw.keyword}":`, error);
    return { success: false, message: error instanceof Error ? error.message : "Generation failed" };
  }
}

/**
 * Generate all content for a cluster (pillar + all supporting articles)
 */
export async function generateFullCluster(
  clusterId: number,
  delayMs: number = 3000,
): Promise<{
  pillar: { success: boolean; articleId?: number };
  clusterPosts: Array<{ keyword: string; success: boolean; articleId?: number }>;
  totalGenerated: number;
  totalFailed: number;
}> {
  // Generate pillar first
  const pillarResult = await generateKeywordPillarPage(clusterId);

  const clusterPosts: Array<{ keyword: string; success: boolean; articleId?: number }> = [];

  const [cluster] = await db.select().from(seoContentClusters)
    .where(eq(seoContentClusters.id, clusterId));

  if (cluster) {
    const clusterKws = JSON.parse(cluster.clusterKeywords || "[]");

    for (let i = 0; i < clusterKws.length; i++) {
      if (delayMs > 0) await new Promise(r => setTimeout(r, delayMs));

      const result = await generateKeywordClusterPost(clusterId, i);
      clusterPosts.push({
        keyword: clusterKws[i].keyword,
        success: result.success,
        articleId: result.articleId,
      });
    }
  }

  return {
    pillar: { success: pillarResult.success, articleId: pillarResult.articleId },
    clusterPosts,
    totalGenerated: (pillarResult.success ? 1 : 0) + clusterPosts.filter(p => p.success).length,
    totalFailed: (pillarResult.success ? 0 : 1) + clusterPosts.filter(p => !p.success).length,
  };
}

/**
 * Get strategy overview — all clusters with progress
 */
export async function getStrategyOverview() {
  const clusters = await getKeywordClusters();

  const totalArticles = clusters.reduce((sum, c) => sum + c.totalClusterPosts + 1, 0); // +1 for pillar
  const generatedArticles = clusters.reduce((sum, c) =>
    sum + c.generatedClusterPosts + (c.pillarArticleId ? 1 : 0), 0);

  return {
    totalClusters: clusters.length,
    productClusters: clusters.filter(c => c.category === "product").length,
    researchClusters: clusters.filter(c => c.category === "research").length,
    competitorClusters: clusters.filter(c => c.category === "competitor").length,
    totalArticlesPlanned: totalArticles,
    totalArticlesGenerated: generatedArticles,
    completionPercent: totalArticles > 0 ? Math.round((generatedArticles / totalArticles) * 100) : 0,
    clusters: clusters.map(c => ({
      id: c.id,
      pillarKeyword: c.pillarKeyword,
      pillarTitle: c.pillarTitle,
      slug: c.slug,
      category: c.category,
      targetAudience: c.targetAudience,
      searchIntent: c.searchIntent,
      priority: c.priority,
      estimatedSearchVolume: c.estimatedSearchVolume,
      hasPillar: !!c.pillarArticleId,
      pillarArticleId: c.pillarArticleId,
      totalClusterPosts: c.totalClusterPosts,
      generatedClusterPosts: c.generatedClusterPosts,
      clusterKeywords: c.clusterKeywords,
      includeProductCTA: c.includeProductCTA,
    })),
  };
}
