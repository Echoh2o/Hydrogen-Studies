/**
 * Natural Language Query Parser Service
 * Uses OpenAI to understand and parse natural language search queries
 */

import { OpenAI } from "openai";

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Entity types for extraction
export interface ParsedQuery {
  originalQuery: string;
  intent: QueryIntent;
  entities: ExtractedEntities;
  filters: SearchFilters;
  expandedQueries: string[];
  confidence: number;
  explanation: string;
}

export enum QueryIntent {
  GENERAL_SEARCH = "general_search",
  COMPARISON = "comparison",
  EFFECTIVENESS = "effectiveness",
  SIDE_EFFECTS = "side_effects",
  RECENT_RESEARCH = "recent_research",
  SPECIFIC_CONDITION = "specific_condition",
  DEMOGRAPHIC_SPECIFIC = "demographic_specific",
  TREATMENT_METHOD = "treatment_method",
}

export interface ExtractedEntities {
  conditions: string[];
  demographics: {
    ageGroups: string[];
    populations: string[];
  };
  deliveryMethods: string[];
  bodySystems: string[];
  comparisons: {
    itemA: string;
    itemB: string;
  }[];
  temporalConstraints: {
    recency: string; // "recent", "last year", "past 5 years", etc.
    specific: string; // specific dates if mentioned
  };
  effectiveness: {
    metric: string;
    comparison: string;
  };
  studyTypes: string[];
}

export interface SearchFilters {
  healthConditions: string[];
  bodySystems: string[];
  deliveryMethods: string[];
  ageGroups: string[];
  yearFrom?: number;
  yearTo?: number;
  studyType?: string;
  peerReviewed?: boolean;
  sortBy?: "relevance" | "date" | "effectiveness";
}

/**
 * Parse natural language query using OpenAI
 */
export async function parseNaturalLanguageQuery(
  query: string,
): Promise<ParsedQuery> {
  try {
    const systemPrompt = `You are an expert medical research query parser specializing in hydrogen therapy research. 
    Analyze the user's natural language query and extract structured information.
    
    Tasks:
    1. Identify the query intent (general search, comparison, effectiveness, side effects, recent research, etc.)
    2. Extract entities (conditions, age groups, delivery methods, body systems, etc.)
    3. Generate appropriate search filters
    4. Expand the query with related terms and synonyms
    5. Provide confidence score (0-1) and explanation
    
    Common hydrogen therapy terms to recognize:
    - H2 = molecular hydrogen = hydrogen gas
    - Hydrogen water = H2-rich water = HRW
    - Hydrogen inhalation = H2 gas inhalation
    - Elderly = seniors = older adults = 60+ = over 60
    - Athletes = sports = performance = exercise
    
    Return a JSON object with the parsed information.`;

    const userPrompt = `Parse this search query: "${query}"
    
    Return JSON with this structure:
    {
      "intent": "general_search|comparison|effectiveness|side_effects|recent_research|specific_condition|demographic_specific|treatment_method",
      "entities": {
        "conditions": ["arthritis", "heart disease", etc.],
        "demographics": {
          "ageGroups": ["elderly", "adults", "children", etc.],
          "populations": ["athletes", "diabetics", etc.]
        },
        "deliveryMethods": ["water", "inhalation", "injection", etc.],
        "bodySystems": ["cardiovascular", "neurological", etc.],
        "comparisons": [{"itemA": "hydrogen water", "itemB": "inhalation"}],
        "temporalConstraints": {
          "recency": "recent|last year|past 5 years|null",
          "specific": "2024|null"
        },
        "effectiveness": {
          "metric": "most effective|best|optimal|null",
          "comparison": "better than|worse than|equal to|null"
        },
        "studyTypes": ["clinical trial", "meta-analysis", etc.]
      },
      "filters": {
        "healthConditions": [],
        "bodySystems": [],
        "deliveryMethods": [],
        "ageGroups": [],
        "yearFrom": null,
        "yearTo": null,
        "studyType": null,
        "peerReviewed": true,
        "sortBy": "relevance|date|effectiveness"
      },
      "expandedQueries": ["original query", "synonym version 1", "related query"],
      "confidence": 0.95,
      "explanation": "Interpreted as a search for..."
    }`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.3,
      max_tokens: 1000,
      response_format: { type: "json_object" },
    });

    const parsed = JSON.parse(completion.choices[0].message.content || "{}");

    // Map the parsed intent string to enum
    const intentMap: Record<string, QueryIntent> = {
      general_search: QueryIntent.GENERAL_SEARCH,
      comparison: QueryIntent.COMPARISON,
      effectiveness: QueryIntent.EFFECTIVENESS,
      side_effects: QueryIntent.SIDE_EFFECTS,
      recent_research: QueryIntent.RECENT_RESEARCH,
      specific_condition: QueryIntent.SPECIFIC_CONDITION,
      demographic_specific: QueryIntent.DEMOGRAPHIC_SPECIFIC,
      treatment_method: QueryIntent.TREATMENT_METHOD,
    };

    return {
      originalQuery: query,
      intent: intentMap[parsed.intent] || QueryIntent.GENERAL_SEARCH,
      entities: parsed.entities || {},
      filters: parsed.filters || {},
      expandedQueries: parsed.expandedQueries || [query],
      confidence: parsed.confidence || 0.5,
      explanation:
        parsed.explanation || "Searching for studies related to your query",
    };
  } catch (error) {
    console.error("Error parsing natural language query:", error);

    // Fallback to basic parsing
    return {
      originalQuery: query,
      intent: QueryIntent.GENERAL_SEARCH,
      entities: extractBasicEntities(query),
      filters: createBasicFilters(query),
      expandedQueries: [query],
      confidence: 0.3,
      explanation: "Basic search for: " + query,
    };
  }
}

/**
 * Extract basic entities without AI (fallback)
 */
function extractBasicEntities(query: string): ExtractedEntities {
  const lowerQuery = query.toLowerCase();

  const conditions = [];
  const deliveryMethods = [];
  const bodySystems = [];
  const ageGroups = [];

  // Check for common conditions
  const commonConditions = [
    "arthritis",
    "diabetes",
    "heart disease",
    "cancer",
    "alzheimer",
    "parkinson",
    "inflammation",
    "oxidative stress",
    "hypertension",
  ];

  for (const condition of commonConditions) {
    if (lowerQuery.includes(condition)) {
      conditions.push(condition);
    }
  }

  // Check for delivery methods
  if (lowerQuery.includes("water") || lowerQuery.includes("drink")) {
    deliveryMethods.push("water");
  }
  if (lowerQuery.includes("inhal") || lowerQuery.includes("breath")) {
    deliveryMethods.push("inhalation");
  }
  if (lowerQuery.includes("inject") || lowerQuery.includes("iv")) {
    deliveryMethods.push("injection");
  }

  // Check for age groups
  if (
    lowerQuery.includes("elder") ||
    lowerQuery.includes("senior") ||
    lowerQuery.includes("older")
  ) {
    ageGroups.push("elderly");
  }
  if (lowerQuery.includes("child") || lowerQuery.includes("pediatric")) {
    ageGroups.push("children");
  }
  if (lowerQuery.includes("athlete") || lowerQuery.includes("sport")) {
    ageGroups.push("athletes");
  }

  // Check for body systems
  const bodySysTerms = {
    cardiovascular: ["heart", "cardiac", "blood", "vascular"],
    neurological: ["brain", "neural", "cognitive", "memory"],
    respiratory: ["lung", "breath", "pulmonary"],
    digestive: ["stomach", "intestin", "gut", "digest"],
    immune: ["immune", "immunity", "infection"],
  };

  for (const [system, terms] of Object.entries(bodySysTerms)) {
    if (terms.some((term) => lowerQuery.includes(term))) {
      bodySystems.push(system);
    }
  }

  return {
    conditions,
    demographics: {
      ageGroups,
      populations: [],
    },
    deliveryMethods,
    bodySystems,
    comparisons: [],
    temporalConstraints: {
      recency: lowerQuery.includes("recent") ? "recent" : "",
      specific: "",
    },
    effectiveness: {
      metric: "",
      comparison: "",
    },
    studyTypes: [],
  };
}

/**
 * Create basic filters from query (fallback)
 */
function createBasicFilters(query: string): SearchFilters {
  const entities = extractBasicEntities(query);
  const currentYear = new Date().getFullYear();

  const filters: SearchFilters = {
    healthConditions: entities.conditions,
    bodySystems: entities.bodySystems,
    deliveryMethods: entities.deliveryMethods,
    ageGroups: entities.demographics.ageGroups,
  };

  // Add temporal filters
  if (query.toLowerCase().includes("recent")) {
    filters.yearFrom = currentYear - 2;
    filters.yearTo = currentYear;
  } else if (query.toLowerCase().includes("last year")) {
    filters.yearFrom = currentYear - 1;
    filters.yearTo = currentYear;
  } else if (query.toLowerCase().includes("past 5 years")) {
    filters.yearFrom = currentYear - 5;
    filters.yearTo = currentYear;
  }

  return filters;
}

/**
 * Generate search suggestions based on partial query
 */
export async function generateSearchSuggestions(
  partial: string,
): Promise<string[]> {
  if (partial.length < 3) return [];

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "Generate 5 relevant search suggestions for hydrogen therapy research based on the partial query. Return as JSON array of strings.",
        },
        {
          role: "user",
          content: `Partial query: "${partial}"\nSuggest completions focused on hydrogen therapy, medical conditions, and research.`,
        },
      ],
      temperature: 0.5,
      max_tokens: 200,
      response_format: { type: "json_object" },
    });

    const result = JSON.parse(
      completion.choices[0].message.content || '{"suggestions":[]}',
    );
    return result.suggestions || [];
  } catch (error) {
    console.error("Error generating suggestions:", error);

    // Fallback suggestions
    const suggestions = [
      `${partial} hydrogen therapy`,
      `${partial} for elderly patients`,
      `${partial} clinical trials`,
      `${partial} effectiveness`,
      `${partial} vs traditional treatment`,
    ];

    return suggestions.slice(0, 5);
  }
}

/**
 * Correct spelling and expand abbreviations
 */
export async function correctAndExpandQuery(query: string): Promise<string> {
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "Correct spelling errors and expand medical abbreviations in the query. Keep the meaning intact. Return only the corrected query.",
        },
        {
          role: "user",
          content: `Query: "${query}"\nExpand abbreviations like H2->hydrogen, ROS->reactive oxygen species, etc.`,
        },
      ],
      temperature: 0.1,
      max_tokens: 100,
    });

    return completion.choices[0].message.content?.trim() || query;
  } catch (error) {
    console.error("Error correcting query:", error);

    // Basic expansion
    let corrected = query;
    const expansions: Record<string, string> = {
      H2: "hydrogen",
      ROS: "reactive oxygen species",
      CV: "cardiovascular",
      neuro: "neurological",
      inflam: "inflammation",
    };

    for (const [abbr, expanded] of Object.entries(expansions)) {
      const regex = new RegExp(`\\b${abbr}\\b`, "gi");
      corrected = corrected.replace(regex, expanded);
    }

    return corrected;
  }
}
