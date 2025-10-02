/**
 * Semantic Similarity Search
 *
 * Analyzes content relationships and provides intelligent search expansion
 * based on conceptual similarity rather than just keyword matching
 */

import { db } from "./db";
import { studies } from "@shared/schema";
import { sql, like, or } from "drizzle-orm";

// Medical term mapping for hydrogen research
const SEMANTIC_TERM_GROUPS = {
  cardiovascular: [
    "heart",
    "cardiac",
    "cardio",
    "myocardial",
    "coronary",
    "vascular",
    "blood pressure",
    "hypertension",
    "circulation",
    "arterial",
    "ventricular",
  ],
  inflammation: [
    "inflammatory",
    "anti-inflammatory",
    "cytokine",
    "immune",
    "immunology",
    "autoimmune",
    "arthritis",
    "rheumatoid",
    "inflammatory markers",
  ],
  oxidative_stress: [
    "antioxidant",
    "free radicals",
    "reactive oxygen",
    "ROS",
    "oxidative damage",
    "cellular protection",
    "mitochondrial",
    "redox",
  ],
  neurological: [
    "brain",
    "neural",
    "neurological",
    "cognitive",
    "memory",
    "alzheimer",
    "parkinson",
    "neurodegenerative",
    "neuroprotective",
    "cerebral",
  ],
  metabolic: [
    "metabolism",
    "metabolic",
    "diabetes",
    "glucose",
    "insulin",
    "obesity",
    "weight",
    "energy",
    "ATP",
    "metabolic syndrome",
  ],
  liver: [
    "hepatic",
    "liver",
    "hepatitis",
    "hepatocyte",
    "bile",
    "cirrhosis",
    "liver function",
    "hepatoprotective",
  ],
  kidney: [
    "renal",
    "kidney",
    "nephritis",
    "nephron",
    "creatinine",
    "dialysis",
    "kidney function",
    "nephroprotective",
  ],
  cancer: [
    "cancer",
    "tumor",
    "malignant",
    "oncology",
    "carcinoma",
    "metastasis",
    "chemotherapy",
    "anticancer",
    "cytotoxic",
  ],
  skin: [
    "dermatology",
    "skin",
    "dermal",
    "cutaneous",
    "wound",
    "healing",
    "dermatitis",
    "psoriasis",
  ],
  respiratory: [
    "lung",
    "pulmonary",
    "respiratory",
    "bronchial",
    "asthma",
    "breathing",
    "pneumonia",
    "airways",
  ],
};

// Common hydrogen research terms
const HYDROGEN_TERMS = [
  "molecular hydrogen",
  "hydrogen gas",
  "H2",
  "hydrogen water",
  "hydrogen inhalation",
  "hydrogen therapy",
  "hydrogen medicine",
  "hydrogen treatment",
];

/**
 * Expand search query with semantically related terms
 */
export function expandSearchQuery(originalQuery: string): string[] {
  const query = originalQuery.toLowerCase();
  const expandedTerms = [originalQuery];

  // Find matching semantic groups
  for (const [category, terms] of Object.entries(SEMANTIC_TERM_GROUPS)) {
    if (terms.some((term) => query.includes(term.toLowerCase()))) {
      // Add related terms from the same category
      expandedTerms.push(
        ...terms.filter(
          (term) => !query.includes(term.toLowerCase()) && term.length > 3,
        ),
      );
    }
  }

  // Add hydrogen-specific terms if not already included
  if (!HYDROGEN_TERMS.some((term) => query.includes(term.toLowerCase()))) {
    expandedTerms.push(...HYDROGEN_TERMS.slice(0, 3)); // Add a few relevant hydrogen terms
  }

  return expandedTerms.slice(0, 10); // Limit to prevent overly broad searches
}

/**
 * Perform semantic similarity search
 */
export async function semanticSearch(query: string, limit: number = 20) {
  const expandedTerms = expandSearchQuery(query);

  console.log(
    `Semantic search expanding "${query}" to include:`,
    expandedTerms,
  );

  // Build comprehensive search across all content fields
  const searchConditions = expandedTerms.map((term) => {
    const searchTerm = `%${term.toLowerCase()}%`;
    return or(
      sql`LOWER(${studies.title}) LIKE ${searchTerm}`,
      sql`LOWER(${studies.abstract}) LIKE ${searchTerm}`,
      sql`LOWER(${studies.keywords}) LIKE ${searchTerm}`,
      sql`LOWER(${studies.methods}) LIKE ${searchTerm}`,
      sql`LOWER(${studies.results}) LIKE ${searchTerm}`,
      sql`LOWER(${studies.conclusion}) LIKE ${searchTerm}`,
      sql`LOWER(${studies.objective}) LIKE ${searchTerm}`,
    );
  });

  // Create relevance scoring that weights original query higher
  const originalTerm = `%${query.toLowerCase()}%`;
  const relevanceScore = sql`(
    CASE WHEN LOWER(${studies.title}) LIKE ${originalTerm} THEN 100 ELSE 0 END +
    CASE WHEN LOWER(${studies.abstract}) LIKE ${originalTerm} THEN 80 ELSE 0 END +
    CASE WHEN LOWER(${studies.methods}) LIKE ${originalTerm} THEN 60 ELSE 0 END +
    CASE WHEN LOWER(${studies.results}) LIKE ${originalTerm} THEN 60 ELSE 0 END +
    CASE WHEN LOWER(${studies.conclusion}) LIKE ${originalTerm} THEN 70 ELSE 0 END +
    -- Secondary relevance for expanded terms
    ${expandedTerms
      .slice(1)
      .map((term) => {
        const expandedTerm = `%${term.toLowerCase()}%`;
        return sql`CASE WHEN LOWER(${studies.title}) LIKE ${expandedTerm} THEN 30 ELSE 0 END +
                 CASE WHEN LOWER(${studies.abstract}) LIKE ${expandedTerm} THEN 20 ELSE 0 END +
                 CASE WHEN LOWER(${studies.methods}) LIKE ${expandedTerm} THEN 15 ELSE 0 END +
                 CASE WHEN LOWER(${studies.results}) LIKE ${expandedTerm} THEN 15 ELSE 0 END +
                 CASE WHEN LOWER(${studies.conclusion}) LIKE ${expandedTerm} THEN 20 ELSE 0 END`;
      })
      .join(" + ")}
  )`;

  const searchQuery = db
    .select({
      id: studies.id,
      title: studies.title,
      abstract: studies.abstract,
      authors: studies.authors,
      journal: studies.journal,
      publishDate: studies.publishDate,
      category: studies.category,
      methods: studies.methods,
      results: studies.results,
      conclusion: studies.conclusion,
      doi: studies.doi,
      imageUrl: studies.imageUrl,
      relevanceScore: relevanceScore,
    })
    .from(studies);

  searchQuery.where(or(...searchConditions));

  const results = await query.orderBy(sql`${relevanceScore} DESC`).limit(limit);

  return results;
}

/**
 * Get related studies based on content similarity
 */
export async function getRelatedStudies(studyId: number, limit: number = 5) {
  // Get the original study
  const originalStudy = await db
    .select()
    .from(studies)
    .where(sql`${studies.id} = ${studyId}`)
    .limit(1);

  if (!originalStudy.length) return [];

  const study = originalStudy[0];

  // Extract key terms from the study's content
  const keyTerms = extractKeyTerms(study);

  if (keyTerms.length === 0) return [];

  // Find studies with similar content
  const searchConditions = keyTerms.map((term) => {
    const searchTerm = `%${term.toLowerCase()}%`;
    return or(
      sql`LOWER(${studies.title}) LIKE ${searchTerm}`,
      sql`LOWER(${studies.abstract}) LIKE ${searchTerm}`,
      sql`LOWER(${studies.methods}) LIKE ${searchTerm}`,
      sql`LOWER(${studies.results}) LIKE ${searchTerm}`,
      sql`LOWER(${studies.conclusion}) LIKE ${searchTerm}`,
    );
  });

  const relatedStudies = await db
    .select({
      id: studies.id,
      title: studies.title,
      abstract: studies.abstract,
      authors: studies.authors,
      journal: studies.journal,
      publishDate: studies.publishDate,
      category: studies.category,
      imageUrl: studies.imageUrl,
    })
    .from(studies)
    .where(or(...searchConditions))
    .where(sql`${studies.id} != ${studyId}`) // Exclude the original study
    .limit(limit);

  return relatedStudies;
}

/**
 * Extract key terms from study content for similarity matching
 */
function extractKeyTerms(study: any): string[] {
  const content = [
    study.title || "",
    study.abstract || "",
    study.methods || "",
    study.results || "",
    study.conclusion || "",
    study.keywords || "",
  ]
    .join(" ")
    .toLowerCase();

  const keyTerms: string[] = [];

  // Extract medical terms from semantic groups
  for (const [category, terms] of Object.entries(SEMANTIC_TERM_GROUPS)) {
    for (const term of terms) {
      if (content.includes(term.toLowerCase()) && term.length > 3) {
        keyTerms.push(term);
      }
    }
  }

  // Extract hydrogen-related terms
  for (const term of HYDROGEN_TERMS) {
    if (content.includes(term.toLowerCase())) {
      keyTerms.push(term);
    }
  }

  // Return unique terms, limited to most important ones
  return Array.from(new Set(keyTerms)).slice(0, 8);
}

/**
 * Get search suggestions based on popular terms in the database
 */
export async function getSearchSuggestions(
  partial: string,
  limit: number = 8,
): Promise<string[]> {
  if (partial.length < 2) return [];

  const suggestions: string[] = [];

  // Find matching terms from semantic groups
  for (const [category, terms] of Object.entries(SEMANTIC_TERM_GROUPS)) {
    for (const term of terms) {
      if (
        term.toLowerCase().includes(partial.toLowerCase()) &&
        !suggestions.includes(term) &&
        term.length >= partial.length
      ) {
        suggestions.push(term);
      }
    }
  }

  // Add hydrogen-specific suggestions
  for (const term of HYDROGEN_TERMS) {
    if (
      term.toLowerCase().includes(partial.toLowerCase()) &&
      !suggestions.includes(term)
    ) {
      suggestions.push(term);
    }
  }

  return suggestions.slice(0, limit);
}
