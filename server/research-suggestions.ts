/**
 * Research Suggestion Generator
 * 
 * Provides AI-powered research suggestions based on user preferences
 * and available study data.
 */

import { storage } from "./storage";
import { Study } from "@shared/schema";
import OpenAI from "openai";
import { topicsByCategory, healthConditionsList, demographicGroups } from "@shared/research-taxonomy";

// Ensure API key is available
if (!process.env.OPENAI_API_KEY) {
  console.warn("OPENAI_API_KEY is missing. Research suggestion features will be limited.");
}

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Define suggestion types
export type SuggestionPromptType = 
  | 'research_gaps'    // Areas where more research is needed
  | 'trending_topics'  // Currently trending research areas
  | 'personal_health'  // Based on user's health conditions
  | 'application_methods' // Practical applications of hydrogen
  | 'popular_questions'; // Common questions about hydrogen research

export interface ResearchSuggestionParams {
  // Basic user preferences
  interests?: string[];
  healthConditions?: string[];
  demographicGroups?: string[];
  
  // Specific research needs
  researchPurpose?: 'academic' | 'personal_health' | 'clinical' | 'general_interest';
  preferredTopics?: string[];
  
  // Content preferences
  includeRecentOnly?: boolean;
  preferPeerReviewed?: boolean;
  
  // Suggestion type
  suggestionType: SuggestionPromptType;
  
  // Optional user query to focus suggestions
  userQuery?: string;
}

export interface ResearchSuggestion {
  title: string;
  description: string;
  relatedStudies: Study[];
  searchTerms: string[];
  researchGaps?: string[];
  confidence: number; // 0-1 rating of suggestion confidence
}

/**
 * Generate research suggestions based on user preferences
 * @param params User preferences and suggestion parameters
 * @returns Array of research suggestions
 */
export async function generateResearchSuggestions(
  params: ResearchSuggestionParams
): Promise<ResearchSuggestion[]> {
  try {
    // Fetch relevant studies based on user preferences
    const relevantStudies = await getRelevantStudies(params);
    
    // Generate AI prompt based on user preferences and studies
    const prompt = generateSuggestionPrompt(params, relevantStudies);
    
    // Get suggestions from OpenAI
    const suggestions = await getAiSuggestions(prompt, params, relevantStudies);
    
    return suggestions;
  } catch (error) {
    console.error("Error generating research suggestions:", error);
    return [];
  }
}

/**
 * Get relevant studies based on user preferences
 */
async function getRelevantStudies(params: ResearchSuggestionParams): Promise<Study[]> {
  // Build filters based on user preferences
  const filters: any = {
    // Default to recent studies if specified
    ...(params.includeRecentOnly && { dateFrom: new Date(Date.now() - 2 * 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] }),
    
    // Filter by peer-reviewed if specified
    ...(params.preferPeerReviewed && { isPeerReviewed: true }),
  };
  
  // Add health condition filters if specified
  if (params.healthConditions && params.healthConditions.length > 0) {
    filters.healthConditions = params.healthConditions;
  }
  
  // Add keywords from user interests and preferred topics
  const keywordTerms = [
    ...(params.interests || []),
    ...(params.preferredTopics || []),
  ];
  
  if (keywordTerms.length > 0) {
    // Choose a random subset of keywords to avoid overly restrictive searches
    const randomKeywords = keywordTerms
      .sort(() => 0.5 - Math.random())
      .slice(0, Math.min(3, keywordTerms.length));
    
    filters.query = randomKeywords.join(' OR ');
  }
  
  // Get matching studies
  const studies = await storage.getStudies(filters);
  
  // Limit to a reasonable number for analysis
  return studies.slice(0, 20);
}

/**
 * Generate a prompt for the AI based on user preferences and relevant studies
 */
function generateSuggestionPrompt(
  params: ResearchSuggestionParams, 
  relevantStudies: Study[]
): string {
  let systemPrompt = `You are a hydrogen research specialist advisor helping a user discover relevant research topics. 
Based on the user's preferences and available research data, suggest specific research topics that would be of interest.

User preferences:
- Interests: ${params.interests?.join(', ') || 'Not specified'}
- Health conditions: ${params.healthConditions?.join(', ') || 'Not specified'}
- Demographic groups: ${params.demographicGroups?.join(', ') || 'Not specified'}
- Research purpose: ${params.researchPurpose || 'Not specified'}
- Preferred topics: ${params.preferredTopics?.join(', ') || 'Not specified'}
- User query: ${params.userQuery || 'Not specified'}

Here are ${relevantStudies.length} studies related to their interests:\n`;

  // Add summaries of relevant studies to provide context
  const studySummaries = relevantStudies.map((study, index) => {
    return `Study ${index + 1}: "${study.title}" - ${study.abstract.substring(0, 150)}...`;
  }).join('\n\n');
  
  systemPrompt += studySummaries;
  
  // Add specific instructions based on suggestion type
  switch (params.suggestionType) {
    case 'research_gaps':
      systemPrompt += `\n\nBased on the available studies, identify 3-5 specific research gaps or areas where more research on hydrogen gas therapy is needed. Focus on practical topics that could yield clinically relevant results.`;
      break;
    case 'trending_topics':
      systemPrompt += `\n\nIdentify 3-5 trending research topics in hydrogen gas therapy based on the recent studies. Focus on areas that seem to be gaining momentum in the research community.`;
      break;
    case 'personal_health':
      systemPrompt += `\n\nSuggest 3-5 specific research areas related to the user's health conditions (${params.healthConditions?.join(', ') || 'general health'}). Focus on practical applications of hydrogen therapy that might benefit their specific situation.`;
      break;
    case 'application_methods':
      systemPrompt += `\n\nSuggest 3-5 specific research topics focused on methods of hydrogen application (drinking hydrogen water, inhalation, hydrogen baths) that would be relevant to the user's interests.`;
      break;
    case 'popular_questions':
      systemPrompt += `\n\nBased on the research data, identify 3-5 common questions that people might have about hydrogen therapy, particularly related to the user's interests and health conditions.`;
      break;
  }
  
  systemPrompt += `\n\nFor each suggestion:
1. Provide a specific, focused research topic title
2. Include a brief description explaining why this topic is relevant 
3. Suggest 3-5 search terms that would help find relevant studies 
4. List any specific research gaps in this area
5. Indicate your confidence in this suggestion (0.0-1.0)

Format your response as a JSON array of objects with the structure:
[
  {
    "title": "Topic title",
    "description": "Description of relevance",
    "searchTerms": ["term1", "term2", "term3"],
    "researchGaps": ["gap1", "gap2"],
    "confidence": 0.8
  },
  ...
]
`;

  return systemPrompt;
}

/**
 * Get AI-generated research suggestions
 */
async function getAiSuggestions(
  prompt: string, 
  params: ResearchSuggestionParams,
  relevantStudies: Study[]
): Promise<ResearchSuggestion[]> {
  try {
    // Make API call to OpenAI
    const response = await openai.chat.completions.create({
      model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
      messages: [
        { role: "system", content: prompt }
      ],
      temperature: 0.7,
      response_format: { type: "json_object" },
    });
    
    // Parse the response
    const content = response.choices[0].message.content || '{"suggestions": []}';
    const parsed = JSON.parse(content);
    
    // Extract suggestions
    const aiSuggestions = Array.isArray(parsed) ? parsed : (parsed.suggestions || []);
    
    // Enhance suggestions with relevant studies
    return aiSuggestions.map((suggestion: any) => {
      // Find studies that match the suggestion's search terms
      const matchingStudies = findMatchingStudies(suggestion.searchTerms, relevantStudies);
      
      return {
        ...suggestion,
        relatedStudies: matchingStudies.slice(0, 3) // Limit to top 3 matching studies
      };
    });
  } catch (error) {
    console.error("Error getting AI suggestions:", error);
    return [];
  }
}

/**
 * Find studies that match the given search terms
 */
function findMatchingStudies(searchTerms: string[], studies: Study[]): Study[] {
  if (!searchTerms || searchTerms.length === 0) {
    return [];
  }
  
  // Score each study based on how well it matches the search terms
  const scoredStudies = studies.map(study => {
    let score = 0;
    const titleLower = study.title.toLowerCase();
    const abstractLower = study.abstract.toLowerCase();
    
    // Check each search term
    searchTerms.forEach(term => {
      const termLower = term.toLowerCase();
      
      // Higher score for title matches
      if (titleLower.includes(termLower)) {
        score += 3;
      }
      
      // Lower score for abstract matches
      if (abstractLower.includes(termLower)) {
        score += 1;
      }
    });
    
    return { study, score };
  });
  
  // Sort by score (highest first) and return just the studies
  return scoredStudies
    .sort((a, b) => b.score - a.score)
    .filter(item => item.score > 0)
    .map(item => item.study);
}

/**
 * Get a list of suggested search terms based on user preferences
 */
export function getSuggestedSearchTerms(params: ResearchSuggestionParams): string[] {
  const suggestions: string[] = [];
  
  // Add terms based on health conditions
  if (params.healthConditions && params.healthConditions.length > 0) {
    params.healthConditions.forEach(condition => {
      suggestions.push(`hydrogen ${condition}`);
      suggestions.push(`molecular hydrogen ${condition}`);
    });
  }
  
  // Add terms based on interests and topics
  const topics = [...(params.interests || []), ...(params.preferredTopics || [])];
  if (topics.length > 0) {
    topics.forEach(topic => {
      suggestions.push(`hydrogen ${topic}`);
      suggestions.push(`${topic} hydrogen therapy`);
    });
  }
  
  // Add general hydrogen research terms
  suggestions.push('hydrogen water benefits');
  suggestions.push('hydrogen inhalation therapy');
  suggestions.push('molecular hydrogen clinical trials');
  
  // Return unique terms, up to 10
  return Array.from(new Set(suggestions)).slice(0, 10);
}

/**
 * Get default wizard steps for the research suggestion wizard
 */
export function getWizardSteps() {
  return [
    {
      id: 'purpose',
      title: 'Research Purpose',
      description: 'What is your primary purpose for exploring hydrogen research?',
      options: [
        { id: 'personal_health', label: 'Personal Health', description: 'Finding research relevant to my health conditions' },
        { id: 'academic', label: 'Academic Research', description: 'Scholarly or professional research purposes' },
        { id: 'clinical', label: 'Clinical Application', description: 'Using hydrogen in clinical practice' },
        { id: 'general_interest', label: 'General Interest', description: 'Just curious about hydrogen research' }
      ]
    },
    {
      id: 'topics',
      title: 'Research Topics',
      description: 'Select topics you\'re interested in:',
      options: topicsByCategory.flatMap(category => 
        category.topics.map(topic => ({
          id: topic.id,
          label: topic.name,
          description: topic.description || '',
          category: category.name
        }))
      )
    },
    {
      id: 'health',
      title: 'Health Conditions',
      description: 'Select any health conditions you\'re interested in:',
      options: healthConditionsList.map(condition => ({
        id: condition.id,
        label: condition.name,
        description: condition.description || ''
      }))
    },
    {
      id: 'demographics',
      title: 'Demographics',
      description: 'Select any specific demographic groups of interest:',
      options: demographicGroups.map(group => ({
        id: group.id,
        label: group.name,
        description: group.description || ''
      }))
    },
    {
      id: 'preferences',
      title: 'Search Preferences',
      description: 'Fine-tune your research suggestions:',
      options: [
        { id: 'recent_only', label: 'Recent Studies Only', description: 'Limit to studies published in the last 2 years' },
        { id: 'peer_reviewed', label: 'Peer-Reviewed Only', description: 'Only include peer-reviewed research' }
      ]
    }
  ];
}