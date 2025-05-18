import { db } from "./db";
import { studies } from "@shared/schema";
import { benefits, demographics, mechanisms, deliveryMethods } from "@shared/schema-hydrogen-fields";
import { eq, like, ilike, inArray, and, or, desc, sql } from "drizzle-orm";
import OpenAI from "openai";

// Initialize OpenAI client
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Interface for suggestion options
interface SuggestionOptions {
  interests: string[];
  healthConditions: string[];
  demographicGroups: string[];
  researchTypes: string[];
  deliveryMethods: string[];
  timeFrames: string[];
}

// Interface for user selections
interface UserSelections {
  interests: string[];
  healthConditions: string[];
  demographicGroup: string;
  researchType: string;
  deliveryMethod: string[];
  timeFrame: string;
  focusArea: string;
}

// Interface for suggestion results
interface ResearchSuggestion {
  title: string;
  description: string;
  searchTerms: string[];
  researchGaps?: string[];
  confidence: number;
  relatedStudies: {
    id: number;
    title: string;
    authors: string;
    abstract: string;
    journal: string;
    publishDate: string;
  }[];
}

// Interface for suggestion response
interface SuggestionResponse {
  suggestions: ResearchSuggestion[];
  searchTerms: string[];
}

/**
 * Get options for the research suggestion wizard
 * This includes available interests, health conditions, demographics, etc.
 */
export async function getSuggestionOptions(): Promise<SuggestionOptions> {
  try {
    // Get benefit categories for interests
    const benefitRecords = await db.select().from(benefits);
    
    // Get demographic groups
    const demographicRecords = await db.select().from(demographics);
    
    // Get mechanisms for interests
    const mechanismRecords = await db.select().from(mechanisms);
    
    // Get delivery methods
    const deliveryMethodRecords = await db.select().from(deliveryMethods);
    
    // Extract common health conditions directly from titles and abstracts
    // Since we don't have dedicated keywords/tags columns, we'll extract from abstracts
    const healthConditionsQuery = await db.select({
      condition: studies.abstract
    }).from(studies)
    .where(sql`${studies.abstract} IS NOT NULL AND ${studies.abstract} != ''`);
    
    // We'll extract potential health conditions in the processing step below
    
    // Extract health conditions from abstracts
    const medicalKeywords = [
      'disease', 'syndrome', 'disorder', 'condition', 'injury', 'cancer', 
      'diabetes', 'inflammation', 'pain', 'arthritis', 'dementia', 'alzheimer',
      'parkinson', 'hypertension', 'obesity', 'stroke', 'heart', 'liver', 'kidney',
      'lung', 'brain', 'depression', 'anxiety', 'stress', 'fatigue', 'chronic'
    ];
    
    // Use a Set to avoid duplicates
    const healthConditionSet = new Set<string>();
    
    // Extract conditions from abstracts
    healthConditionsQuery.forEach(item => {
      if (item.condition) {
        // Split abstract into words
        const words = item.condition.split(/\s+/);
        
        // Look for 1-3 word phrases that could be conditions
        for (let i = 0; i < words.length; i++) {
          for (let len = 1; len <= 3 && i + len <= words.length; len++) {
            const phrase = words.slice(i, i + len).join(' ').toLowerCase();
            
            // Check if the phrase contains any medical keywords
            if (medicalKeywords.some(keyword => phrase.includes(keyword)) && 
                phrase.length > 4 && 
                !phrase.includes('hydrogen')) {
              healthConditionSet.add(phrase.charAt(0).toUpperCase() + phrase.slice(1));
            }
          }
        }
      }
    });
    
    // Convert set to array and limit to 30 conditions
    const healthConditions = Array.from(healthConditionSet).slice(0, 30);
    
    // Get study design types
    const designTypes = ['Clinical Trial', 'Case Study', 'Randomized Controlled Trial', 
      'Meta-Analysis', 'Review', 'Cohort Study', 'Experimental'];
    
    // Get population groups
    const populationGroups = demographicRecords.map(d => d.name);
    
    // Prepare the final options
    return {
      interests: benefitRecords.map(b => b.name),
      healthConditions,
      demographicGroups: populationGroups,
      researchTypes: ['clinical', 'experimental', 'review', 'case-study', 'any'],
      deliveryMethods: deliveryMethodRecords.map(d => d.name),
      timeFrames: ['short-term', 'medium-term', 'long-term', 'any']
    };
  } catch (error) {
    console.error('Error fetching suggestion options:', error);
    throw new Error('Failed to fetch suggestion options');
  }
}

/**
 * Generate research suggestions based on user selections
 */
export async function generateResearchSuggestions(
  selections: UserSelections
): Promise<SuggestionResponse> {
  try {
    // Step 1: Find relevant studies based on user selections
    const relevantStudies = await findRelevantStudies(selections);
    
    if (relevantStudies.length === 0) {
      // If no studies match the criteria, use AI to generate suggestions
      // without specific study references
      return await generateAIBasedSuggestions(selections, []);
    }
    
    // Step 2: Generate AI-based research suggestions with relevant studies
    return await generateAIBasedSuggestions(selections, relevantStudies);
  } catch (error) {
    console.error('Error generating research suggestions:', error);
    throw new Error('Failed to generate research suggestions');
  }
}

/**
 * Find studies relevant to the user's selections
 */
async function findRelevantStudies(selections: UserSelections): Promise<any[]> {
  // Build query conditions based on user selections
  const conditions = [];
  
  // Interests (map to benefits)
  if (selections.interests.length > 0) {
    // Search in the abstract and title
    const interestConditions = selections.interests.map(interest => 
      or(
        ilike(studies.title, `%${interest}%`),
        ilike(studies.abstract, `%${interest}%`)
      )
    );
    conditions.push(or(...interestConditions));
  }
  
  // Health conditions
  if (selections.healthConditions.length > 0) {
    const healthConditions = selections.healthConditions.map(condition => 
      or(
        ilike(studies.title, `%${condition}%`),
        ilike(studies.abstract, `%${condition}%`)
      )
    );
    conditions.push(or(...healthConditions));
  }
  
  // Demographic group
  if (selections.demographicGroup && selections.demographicGroup !== 'any') {
    // Search in the abstract
    conditions.push(
      or(
        ilike(studies.title, `%${selections.demographicGroup}%`),
        ilike(studies.abstract, `%${selections.demographicGroup}%`)
      )
    );
  }
  
  // Research type
  if (selections.researchType && selections.researchType !== 'any') {
    const typeMap = {
      'clinical': ['clinical trial', 'randomized', 'double-blind', 'placebo-controlled'],
      'experimental': ['experimental', 'laboratory', 'in vitro', 'animal model'],
      'review': ['review', 'meta-analysis', 'systematic review'],
      'case-study': ['case study', 'case report', 'case series']
    };
    
    const typeTerms = typeMap[selections.researchType as keyof typeof typeMap] || [];
    
    if (typeTerms.length > 0) {
      const typeConditions = typeTerms.map(term => 
        or(
          ilike(studies.title, `%${term}%`),
          ilike(studies.abstract, `%${term}%`)
        )
      );
      conditions.push(or(...typeConditions));
    }
  }
  
  // Delivery methods
  if (selections.deliveryMethod.length > 0) {
    const deliveryConditions = selections.deliveryMethod.map(method => 
      or(
        ilike(studies.title, `%${method}%`),
        ilike(studies.abstract, `%${method}%`)
      )
    );
    conditions.push(or(...deliveryConditions));
  }
  
  // Get query with all conditions
  let query = db.select().from(studies);
  
  if (conditions.length > 0) {
    query = query.where(and(...conditions));
  }
  
  // Sort by most recent studies
  query = query.orderBy(desc(studies.publishDate));
  
  // Limit to 50 studies for performance
  query = query.limit(50);
  
  // Execute query
  const results = await query;
  
  // Format results
  return results.map(study => ({
    id: study.id,
    title: study.title,
    abstract: study.abstract || '',
    authors: study.authors || '',
    journal: study.journal || 'Scientific Journal',
    publishDate: study.publishDate || '',
  }));
}

/**
 * Generate research suggestions using OpenAI API
 */
async function generateAIBasedSuggestions(
  selections: UserSelections,
  relevantStudies: any[]
): Promise<SuggestionResponse> {
  // Create a prompt that describes what we want
  const prompt = generatePrompt(selections, relevantStudies);
  
  try {
    // Generate suggestions using OpenAI
    const completion = await openai.chat.completions.create({
      model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
      messages: [
        {
          role: "system",
          content: "You are a hydrogen research expert specializing in providing research suggestions based on user preferences. Your suggestions should be specific, actionable, and grounded in scientific evidence."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.7,
      max_tokens: 2500
    });
    
    // Parse the response
    const responseText = completion.choices[0].message.content || "";
    const responseJSON = JSON.parse(responseText);
    
    // Return the suggestions
    return {
      suggestions: responseJSON.suggestions || [],
      searchTerms: responseJSON.searchTerms || []
    };
  } catch (error) {
    console.error('Error generating AI suggestions:', error);
    
    // Fallback to simplified response if OpenAI fails
    return generateFallbackSuggestions(selections);
  }
}

/**
 * Generate a prompt for the OpenAI API based on user selections
 */
function generatePrompt(selections: UserSelections, relevantStudies: any[]): string {
  const { 
    interests, 
    healthConditions, 
    demographicGroup, 
    researchType, 
    deliveryMethod, 
    timeFrame,
    focusArea 
  } = selections;
  
  let prompt = `Generate research suggestions for hydrogen health research based on the following preferences:

User Preferences:
- Interests: ${interests.length > 0 ? interests.join(', ') : 'Any health area'}
- Health Conditions: ${healthConditions.length > 0 ? healthConditions.join(', ') : 'No specific conditions'}
- Demographic Group: ${demographicGroup !== 'any' ? demographicGroup : 'Any demographic'}
- Research Type: ${researchType !== 'any' ? researchType : 'Any research type'}
- Hydrogen Delivery Methods: ${deliveryMethod.length > 0 ? deliveryMethod.join(', ') : 'Any delivery method'}
- Time Frame: ${timeFrame !== 'any' ? timeFrame : 'Any time frame'}
- Focus Area: ${focusArea !== 'both' ? focusArea : 'Both physical and mental health'}

`;

  // Add information about relevant studies if available
  if (relevantStudies.length > 0) {
    prompt += `\nBased on these preferences, I found ${relevantStudies.length} relevant studies on hydrogen research. Here are a few key studies to inform your suggestions:\n\n`;
    
    // Add details of up to 5 most relevant studies
    const topStudies = relevantStudies.slice(0, 5);
    topStudies.forEach((study, index) => {
      prompt += `Study ${index + 1}: "${study.title}"
Authors: ${study.authors}
Published: ${study.publishDate || 'Unknown date'}
Journal: ${study.journal}
Abstract: ${study.abstract || 'No abstract available'}

`;
    });
  } else {
    prompt += "\nI couldn't find any studies that exactly match these preferences, so please generate suggestions that could inspire new research in this area.\n";
  }
  
  prompt += `
Please generate at least 3 research suggestions based on the user's preferences ${relevantStudies.length > 0 ? 'and the provided studies' : ''}.

For each suggestion, include:
1. A clear title
2. A detailed description of the research focus
3. Specific search terms that would be useful for finding related research
4. Potential research gaps that could be addressed
5. A confidence score (0-100) indicating how well supported this suggestion is by existing research
6. Related studies (with ID, title, authors, journal, and publication date)

Provide your response in JSON format with the following structure:
{
  "suggestions": [
    {
      "title": "Suggestion title",
      "description": "Detailed description",
      "searchTerms": ["term1", "term2", "term3"],
      "researchGaps": ["gap1", "gap2"],
      "confidence": 85,
      "relatedStudies": [
        {
          "id": 123,
          "title": "Study title",
          "authors": "Author names",
          "journal": "Journal name",
          "publishDate": "2023-01-01"
        }
      ]
    }
  ],
  "searchTerms": ["term1", "term2", "term3"]
}

The "searchTerms" array at the top level should include the most important terms that summarize these research suggestions as a whole.`;

  return prompt;
}

/**
 * Generate fallback suggestions when OpenAI API fails
 */
function generateFallbackSuggestions(selections: UserSelections): SuggestionResponse {
  const { interests, healthConditions, demographicGroup, deliveryMethod } = selections;
  
  // Create basic search terms from user selections
  const searchTerms = [
    "hydrogen therapy",
    "molecular hydrogen",
    ...interests,
    ...healthConditions,
    ...(demographicGroup !== 'any' ? [demographicGroup] : []),
    ...deliveryMethod
  ];
  
  // Generate a basic suggestion
  const suggestion: ResearchSuggestion = {
    title: "Hydrogen Therapy Research Suggestion",
    description: `Research on the effects of hydrogen therapy ${
      interests.length > 0 ? `for ${interests.join(' and ')}` : 'for health benefits'
    } ${
      healthConditions.length > 0 ? `in patients with ${healthConditions.join(' or ')}` : ''
    } ${
      demographicGroup !== 'any' ? `focusing on ${demographicGroup}` : ''
    } ${
      deliveryMethod.length > 0 ? `using ${deliveryMethod.join(' or ')}` : ''
    }.`,
    searchTerms: searchTerms.slice(0, 5),
    researchGaps: [
      "Long-term effects of hydrogen therapy",
      "Optimal dosage and administration protocols",
      "Comparison between different delivery methods"
    ],
    confidence: 60,
    relatedStudies: []
  };
  
  return {
    suggestions: [suggestion],
    searchTerms: searchTerms.slice(0, 8)
  };
}