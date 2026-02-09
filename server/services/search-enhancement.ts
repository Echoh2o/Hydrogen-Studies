/**
 * Search Enhancement with Semantic Query Expansion
 *
 * Extends search queries with related medical and hydrogen research terms
 */

// Medical term groups for semantic expansion
const SEMANTIC_GROUPS = {
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
  ],
  inflammation: [
    "inflammatory",
    "anti-inflammatory",
    "cytokine",
    "immune",
    "arthritis",
    "rheumatoid",
  ],
  oxidative: [
    "antioxidant",
    "free radicals",
    "reactive oxygen",
    "ROS",
    "oxidative damage",
    "cellular protection",
  ],
  neurological: [
    "brain",
    "neural",
    "cognitive",
    "memory",
    "alzheimer",
    "parkinson",
    "neurodegenerative",
  ],
  metabolic: [
    "metabolism",
    "diabetes",
    "glucose",
    "insulin",
    "obesity",
    "metabolic syndrome",
  ],
  liver: ["hepatic", "liver", "hepatitis", "hepatocyte"],
  kidney: ["renal", "kidney", "nephritis", "dialysis"],
  cancer: ["cancer", "tumor", "malignant", "oncology", "carcinoma"],
  respiratory: ["lung", "pulmonary", "respiratory", "asthma"],
};

/**
 * Expand search query with semantically related terms
 */
export function expandQuery(originalQuery: string): string[] {
  const query = originalQuery.toLowerCase();
  const expandedTerms = [originalQuery];

  // Find matching semantic groups and add related terms
  for (const [category, terms] of Object.entries(SEMANTIC_GROUPS)) {
    if (terms.some((term) => query.includes(term))) {
      // Add a few most relevant related terms
      expandedTerms.push(
        ...terms
          .filter((term) => !query.includes(term) && term.length > 3)
          .slice(0, 3),
      );
    }
  }

  return expandedTerms.slice(0, 8); // Limit to prevent overly broad searches
}

/**
 * Get search suggestions for autocomplete
 */
export function getSearchSuggestions(partial: string): string[] {
  if (partial.length < 2) return [];

  const suggestions: string[] = [];
  const partialLower = partial.toLowerCase();

  // Find matching terms from all semantic groups
  for (const terms of Object.values(SEMANTIC_GROUPS)) {
    for (const term of terms) {
      if (term.includes(partialLower) && term.length >= partial.length) {
        suggestions.push(term);
      }
    }
  }

  return suggestions.slice(0, 8);
}
