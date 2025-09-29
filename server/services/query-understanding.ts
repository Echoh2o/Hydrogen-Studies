/**
 * Query Understanding and Intent Classification Service
 * Provides advanced query interpretation and context awareness
 */

import { OpenAI } from "openai";
import { parseNaturalLanguageQuery, ParsedQuery, QueryIntent } from "./natural-language-parser";

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface QueryContext {
  previousQueries: string[];
  userPreferences: {
    interests: string[];
    preferredStudyTypes: string[];
  };
  sessionContext: {
    viewedStudies: number[];
    appliedFilters: any;
  };
}

export interface EnhancedQuery {
  original: string;
  corrected: string;
  expanded: string[];
  intent: QueryIntent;
  confidence: number;
  context: QueryContext;
  suggestions: QuerySuggestion[];
  relatedQueries: string[];
}

export interface QuerySuggestion {
  text: string;
  type: "correction" | "expansion" | "refinement" | "alternative";
  confidence: number;
}

/**
 * Enhance query with context and understanding
 */
export async function enhanceQueryUnderstanding(
  query: string,
  context?: QueryContext
): Promise<EnhancedQuery> {
  try {
    // Parse the natural language query
    const parsed = await parseNaturalLanguageQuery(query);
    
    // Correct spelling and expand abbreviations
    const corrected = await correctSpellingAndAbbreviations(query);
    
    // Generate query expansions based on context
    const expanded = await generateContextualExpansions(corrected, parsed, context);
    
    // Generate suggestions
    const suggestions = await generateQuerySuggestions(query, parsed, context);
    
    // Generate related queries
    const relatedQueries = generateRelatedQueries(parsed, context);
    
    return {
      original: query,
      corrected,
      expanded,
      intent: parsed.intent,
      confidence: parsed.confidence,
      context: context || createDefaultContext(),
      suggestions,
      relatedQueries
    };
    
  } catch (error) {
    console.error("Error enhancing query understanding:", error);
    
    // Fallback response
    return {
      original: query,
      corrected: query,
      expanded: [query],
      intent: QueryIntent.GENERAL_SEARCH,
      confidence: 0.3,
      context: context || createDefaultContext(),
      suggestions: [],
      relatedQueries: []
    };
  }
}

/**
 * Correct spelling and expand abbreviations using AI
 */
async function correctSpellingAndAbbreviations(query: string): Promise<string> {
  try {
    const systemPrompt = `You are a medical research query corrector specializing in hydrogen therapy.
    Fix spelling errors and expand common abbreviations while preserving the query's intent.
    
    Common expansions:
    - H2 → hydrogen, molecular hydrogen
    - ROS → reactive oxygen species
    - CV/CVD → cardiovascular disease
    - AD → Alzheimer's disease
    - PD → Parkinson's disease
    - T2D → Type 2 diabetes
    - COPD → chronic obstructive pulmonary disease
    - RA → rheumatoid arthritis
    - IBD → inflammatory bowel disease
    - HRW → hydrogen-rich water
    
    Return only the corrected query, nothing else.`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: query }
      ],
      temperature: 0.1,
      max_tokens: 100
    });

    return completion.choices[0].message.content?.trim() || query;
    
  } catch (error) {
    console.error("Error correcting query:", error);
    
    // Basic fallback corrections
    let corrected = query;
    const replacements: Record<string, string> = {
      "H2": "hydrogen",
      "h2": "hydrogen",
      "hidrogen": "hydrogen",
      "hidrojen": "hydrogen",
      "artritis": "arthritis",
      "diabetis": "diabetes",
      "alzhimer": "alzheimer",
      "parkinsons": "parkinson's",
      "inflamation": "inflammation"
    };
    
    for (const [wrong, right] of Object.entries(replacements)) {
      const regex = new RegExp(`\\b${wrong}\\b`, "gi");
      corrected = corrected.replace(regex, right);
    }
    
    return corrected;
  }
}

/**
 * Generate contextual query expansions
 */
async function generateContextualExpansions(
  query: string,
  parsed: ParsedQuery,
  context?: QueryContext
): Promise<string[]> {
  const expansions = [query];
  
  try {
    // Use context to enhance expansions
    const contextInfo = context ? `
    Previous queries: ${context.previousQueries.join(", ")}
    User interests: ${context.userPreferences.interests.join(", ")}
    ` : "";

    const systemPrompt = `Generate 3-5 query expansions for medical research search.
    Include synonyms, related terms, and alternative phrasings.
    ${contextInfo}
    Return as a JSON array of strings.`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Query: "${query}"\nIntent: ${parsed.intent}` }
      ],
      temperature: 0.4,
      max_tokens: 200,
      response_format: { type: "json_object" }
    });

    const result = JSON.parse(completion.choices[0].message.content || '{"expansions":[]}');
    expansions.push(...(result.expansions || []));
    
  } catch (error) {
    console.error("Error generating expansions:", error);
    
    // Fallback expansions based on intent
    if (parsed.intent === QueryIntent.COMPARISON) {
      expansions.push(`${query} comparison`);
      expansions.push(`${query} versus`);
      expansions.push(`${query} vs`);
    } else if (parsed.intent === QueryIntent.EFFECTIVENESS) {
      expansions.push(`${query} efficacy`);
      expansions.push(`${query} clinical trials`);
      expansions.push(`${query} results`);
    } else if (parsed.intent === QueryIntent.SIDE_EFFECTS) {
      expansions.push(`${query} adverse effects`);
      expansions.push(`${query} safety`);
      expansions.push(`${query} risks`);
    }
  }
  
  // Add entity-based expansions
  if (parsed.entities.conditions?.length > 0) {
    for (const condition of parsed.entities.conditions) {
      expansions.push(`hydrogen therapy ${condition}`);
      expansions.push(`${condition} hydrogen treatment`);
    }
  }
  
  return [...new Set(expansions)]; // Remove duplicates
}

/**
 * Generate query suggestions
 */
async function generateQuerySuggestions(
  query: string,
  parsed: ParsedQuery,
  context?: QueryContext
): Promise<QuerySuggestion[]> {
  const suggestions: QuerySuggestion[] = [];
  
  try {
    const systemPrompt = `Generate helpful search suggestions for a medical research query.
    Suggest corrections, refinements, and alternatives.
    Return as JSON with structure: {"suggestions": [{"text": "...", "type": "correction|expansion|refinement|alternative", "confidence": 0.9}]}`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Query: "${query}"\nParsed entities: ${JSON.stringify(parsed.entities)}` }
      ],
      temperature: 0.5,
      max_tokens: 300,
      response_format: { type: "json_object" }
    });

    const result = JSON.parse(completion.choices[0].message.content || '{"suggestions":[]}');
    suggestions.push(...(result.suggestions || []));
    
  } catch (error) {
    console.error("Error generating suggestions:", error);
  }
  
  // Add intent-based suggestions
  if (parsed.confidence < 0.7) {
    suggestions.push({
      text: `Did you mean: ${query} clinical trials?`,
      type: "refinement",
      confidence: 0.6
    });
  }
  
  if (parsed.entities.conditions?.length === 0 && query.length > 10) {
    suggestions.push({
      text: "Try adding a specific condition (e.g., arthritis, diabetes)",
      type: "refinement",
      confidence: 0.7
    });
  }
  
  return suggestions;
}

/**
 * Generate related queries
 */
function generateRelatedQueries(
  parsed: ParsedQuery,
  context?: QueryContext
): string[] {
  const related: string[] = [];
  
  // Based on intent
  switch (parsed.intent) {
    case QueryIntent.COMPARISON:
      related.push("Hydrogen therapy effectiveness ranking");
      related.push("Best hydrogen delivery method");
      break;
    case QueryIntent.EFFECTIVENESS:
      related.push("Hydrogen therapy success rates");
      related.push("Clinical evidence for hydrogen treatment");
      break;
    case QueryIntent.SIDE_EFFECTS:
      related.push("Hydrogen therapy safety profile");
      related.push("Contraindications for hydrogen treatment");
      break;
    case QueryIntent.SPECIFIC_CONDITION:
      if (parsed.entities.conditions?.length > 0) {
        const condition = parsed.entities.conditions[0];
        related.push(`Alternative treatments for ${condition}`);
        related.push(`Latest ${condition} research`);
      }
      break;
    case QueryIntent.DEMOGRAPHIC_SPECIFIC:
      if (parsed.entities.demographics?.ageGroups?.length > 0) {
        const group = parsed.entities.demographics.ageGroups[0];
        related.push(`Safety of hydrogen therapy for ${group}`);
        related.push(`Dosage recommendations for ${group}`);
      }
      break;
  }
  
  // Based on entities
  if (parsed.entities.deliveryMethods?.length > 0) {
    const method = parsed.entities.deliveryMethods[0];
    related.push(`How to use hydrogen ${method}`);
    related.push(`Benefits of hydrogen ${method}`);
  }
  
  // Add context-based suggestions
  if (context?.previousQueries?.length > 0) {
    const lastQuery = context.previousQueries[context.previousQueries.length - 1];
    if (lastQuery !== parsed.originalQuery) {
      related.push(`More about: ${lastQuery}`);
    }
  }
  
  return related.slice(0, 6);
}

/**
 * Create default context
 */
function createDefaultContext(): QueryContext {
  return {
    previousQueries: [],
    userPreferences: {
      interests: [],
      preferredStudyTypes: []
    },
    sessionContext: {
      viewedStudies: [],
      appliedFilters: {}
    }
  };
}

/**
 * Analyze query complexity
 */
export function analyzeQueryComplexity(query: string): {
  complexity: "simple" | "moderate" | "complex";
  features: string[];
} {
  const features: string[] = [];
  
  // Check for comparison words
  if (/\bvs\b|\bversus\b|\bcompare\b|\bbetter\b/i.test(query)) {
    features.push("comparison");
  }
  
  // Check for temporal constraints
  if (/\brecent\b|\blast\s+year\b|\b202\d\b|\blatest\b/i.test(query)) {
    features.push("temporal");
  }
  
  // Check for effectiveness queries
  if (/\beffective\b|\bbest\b|\boptimal\b|\bsuccess\b/i.test(query)) {
    features.push("effectiveness");
  }
  
  // Check for demographic specifiers
  if (/\belderly\b|\bchildren\b|\bathletes\b|\bpregnant\b/i.test(query)) {
    features.push("demographic");
  }
  
  // Check for multiple conditions
  const conditionMatches = query.match(/\b(arthritis|diabetes|heart|cancer|alzheimer|parkinson)\b/gi);
  if (conditionMatches && conditionMatches.length > 1) {
    features.push("multiple_conditions");
  }
  
  // Determine complexity
  let complexity: "simple" | "moderate" | "complex";
  if (features.length === 0 || query.split(" ").length < 5) {
    complexity = "simple";
  } else if (features.length <= 2) {
    complexity = "moderate";
  } else {
    complexity = "complex";
  }
  
  return { complexity, features };
}

/**
 * Extract key phrases from query
 */
export function extractKeyPhrases(query: string): string[] {
  const phrases: string[] = [];
  
  // Common medical phrases
  const patterns = [
    /hydrogen\s+(therapy|treatment|water|inhalation|gas)/gi,
    /\b(clinical|randomized|controlled)\s+trial/gi,
    /\b(meta-analysis|systematic review)/gi,
    /\b(side effects?|adverse events?)/gi,
    /\b(elderly|pediatric|adult|senior)\s+patients?/gi,
    /\b(cardiovascular|neurological|metabolic)\s+disease/gi,
    /\b(oxidative stress|inflammation|immune)/gi
  ];
  
  for (const pattern of patterns) {
    const matches = query.match(pattern);
    if (matches) {
      phrases.push(...matches.map(m => m.toLowerCase()));
    }
  }
  
  return [...new Set(phrases)];
}