/**
 * Research Suggestions Service
 * 
 * Provides intelligent research topic suggestions based on user inputs
 * using OpenAI and our database of hydrogen research.
 */

import OpenAI from "openai";
import { db } from "./db";
import { studies } from "@shared/schema";
import { eq, like, ilike, and, or, desc } from "drizzle-orm";
import { researchTaxonomy } from "../shared/research-taxonomy";

// Initialize OpenAI
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Interface for user selections in research wizard
interface WizardSelections {
  interests?: string[];
  healthConditions?: string[];
  demographicGroup?: string;
  researchType?: 'clinical' | 'experimental' | 'review' | 'case-study' | 'any';
  deliveryMethod?: string[];
  timeFrame?: 'short-term' | 'medium-term' | 'long-term' | 'any';
  focusArea?: 'physical' | 'mental' | 'both';
}

// Interface for generated research suggestions
interface ResearchSuggestion {
  title: string;
  description: string;
  searchTerms: string[];
  researchGaps?: string[];
  confidence: number;
  relatedStudies: Array<{
    id: number;
    title: string;
    authors: string;
    abstract: string;
    journal: string;
    publishDate: string;
  }>;
}

// Main function to generate research suggestions
export async function generateResearchSuggestions(
  selections: WizardSelections
): Promise<{ suggestions: ResearchSuggestion[], searchTerms: string[] }> {
  try {
    // Step 1: Find relevant studies based on user selections
    const relevantStudies = await findRelevantStudies(selections);
    
    // Step 2: Generate search terms based on selections
    const searchTerms = generateSearchTerms(selections);
    
    // Step 3: Generate research suggestions using OpenAI
    const suggestions = await generateSuggestionsUsingAI(selections, relevantStudies, searchTerms);
    
    // Step 4: For each suggestion, find related existing studies
    for (const suggestion of suggestions) {
      suggestion.relatedStudies = await findRelatedStudies(suggestion, relevantStudies);
    }
    
    return {
      suggestions,
      searchTerms
    };
  } catch (error) {
    console.error("Error generating research suggestions:", error);
    throw error;
  }
}

// Find studies that match the user's selections
async function findRelevantStudies(selections: WizardSelections) {
  try {
    let query = db.select().from(studies);
    const conditions = [];
    
    // Add conditions based on user selections
    if (selections.interests && selections.interests.length > 0) {
      // Match studies with similar focus areas
      const interestConditions = selections.interests.map(interest => 
        or(
          ilike(studies.title, `%${interest}%`),
          ilike(studies.abstract, `%${interest}%`),
          ilike(studies.keywords, `%${interest}%`),
          ilike(studies.tags, `%${interest}%`)
        )
      );
      conditions.push(or(...interestConditions));
    }
    
    if (selections.healthConditions && selections.healthConditions.length > 0) {
      // Match studies about these health conditions
      const healthConditions = selections.healthConditions.map(condition => 
        or(
          ilike(studies.title, `%${condition}%`),
          ilike(studies.abstract, `%${condition}%`),
          ilike(studies.keywords, `%${condition}%`),
          ilike(studies.tags, `%${condition}%`)
        )
      );
      conditions.push(or(...healthConditions));
    }
    
    if (selections.demographicGroup && selections.demographicGroup !== 'any') {
      // Match studies targeting specific demographic groups
      conditions.push(
        or(
          ilike(studies.title, `%${selections.demographicGroup}%`),
          ilike(studies.abstract, `%${selections.demographicGroup}%`),
          ilike(studies.populationGroup, `%${selections.demographicGroup}%`)
        )
      );
    }
    
    if (selections.researchType && selections.researchType !== 'any') {
      // Match by study type
      conditions.push(
        or(
          ilike(studies.studyType, `%${selections.researchType}%`),
          ilike(studies.studyDesign, `%${selections.researchType}%`)
        )
      );
    }
    
    if (selections.deliveryMethod && selections.deliveryMethod.length > 0) {
      // Match studies using specific hydrogen delivery methods
      const deliveryConditions = selections.deliveryMethod.map(method => 
        or(
          ilike(studies.title, `%${method}%`),
          ilike(studies.abstract, `%${method}%`),
          ilike(studies.keywords, `%${method}%`),
          ilike(studies.interventionType, `%${method}%`)
        )
      );
      conditions.push(or(...deliveryConditions));
    }
    
    // Apply conditions to query
    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }
    
    // Limit to recent and high-quality studies
    query = query.orderBy(desc(studies.journalImpactFactor), desc(studies.citationCount), desc(studies.publishDate));
    
    // Execute query and get results
    const results = await query.limit(20);
    return results;
    
  } catch (error) {
    console.error("Error finding relevant studies:", error);
    return [];
  }
}

// Generate search terms based on user selections
function generateSearchTerms(selections: WizardSelections): string[] {
  const terms: string[] = [];
  
  // Add general hydrogen terms
  terms.push("molecular hydrogen", "hydrogen therapy", "hydrogen medicine");
  
  // Add terms from interests
  if (selections.interests && selections.interests.length > 0) {
    terms.push(...selections.interests);
  }
  
  // Add health condition terms
  if (selections.healthConditions && selections.healthConditions.length > 0) {
    terms.push(...selections.healthConditions);
  }
  
  // Add demographic terms
  if (selections.demographicGroup && selections.demographicGroup !== 'any') {
    terms.push(selections.demographicGroup);
  }
  
  // Add study type terms
  if (selections.researchType && selections.researchType !== 'any') {
    terms.push(selections.researchType);
  }
  
  // Add delivery method terms
  if (selections.deliveryMethod && selections.deliveryMethod.length > 0) {
    terms.push(...selections.deliveryMethod);
  }
  
  // Add time frame specific terms
  if (selections.timeFrame && selections.timeFrame !== 'any') {
    const timeFrameTerms = {
      'short-term': ['acute', 'immediate effects', 'short-term'],
      'medium-term': ['weeks', 'months', 'medium-term'],
      'long-term': ['chronic', 'long-term', 'prolonged use']
    };
    
    terms.push(...timeFrameTerms[selections.timeFrame]);
  }
  
  // Add focus area terms
  if (selections.focusArea) {
    const focusTerms = {
      'physical': ['physical health', 'physical performance', 'physiological'],
      'mental': ['mental health', 'cognitive', 'neurological', 'brain'],
      'both': ['health', 'wellbeing', 'holistic']
    };
    
    terms.push(...focusTerms[selections.focusArea]);
  }
  
  // Remove duplicates and return
  return [...new Set(terms)];
}

// Generate research suggestions using OpenAI
async function generateSuggestionsUsingAI(
  selections: WizardSelections,
  studies: any[],
  searchTerms: string[]
): Promise<ResearchSuggestion[]> {
  try {
    // Create context from studies
    const studiesContext = studies.map(study => 
      `Title: ${study.title}\nJournal: ${study.journal}\nAbstract: ${study.abstract}\n`
    ).join('\n---\n');
    
    // Create prompt for OpenAI
    const prompt = `
You are a hydrogen research expert specializing in hydrogen health research. Your task is to generate 3 research topic suggestions based on the following user interests and relevant studies.

USER INTERESTS:
${selections.interests ? 'Interests: ' + selections.interests.join(', ') : ''}
${selections.healthConditions ? 'Health Conditions: ' + selections.healthConditions.join(', ') : ''}
${selections.demographicGroup ? 'Demographic Group: ' + selections.demographicGroup : ''}
${selections.researchType ? 'Research Type: ' + selections.researchType : ''}
${selections.deliveryMethod ? 'Delivery Method: ' + selections.deliveryMethod.join(', ') : ''}
${selections.timeFrame ? 'Time Frame: ' + selections.timeFrame : ''}
${selections.focusArea ? 'Focus Area: ' + selections.focusArea : ''}

SEARCH TERMS:
${searchTerms.join(', ')}

EXISTING RELEVANT STUDIES:
${studiesContext}

Generate 3 research topic suggestions that would be valuable to study based on the user's interests and the existing research. For each suggestion, include:
1. A title for the research topic
2. A description of the research focus (2-3 sentences)
3. 5-7 specific search terms that would help find relevant studies
4. 2-3 research gaps that this topic addresses
5. A confidence score (0-100) indicating how promising this research direction is based on existing evidence

Format each suggestion as a JSON object with these fields:
- title (string)
- description (string)
- searchTerms (array of strings)
- researchGaps (array of strings)
- confidence (number from 0 to 100)

Return an array of these 3 JSON objects without any additional text.
`;

    // Call OpenAI API
    const completion = await openai.chat.completions.create({
      model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
      messages: [
        { role: "system", content: "You are a hydrogen health research specialist with expertise in suggesting promising research directions." },
        { role: "user", content: prompt }
      ],
      response_format: { type: "json_object" }
    });

    // Parse response
    const responseContent = completion.choices[0].message.content;
    const parsedResponse = JSON.parse(responseContent);
    
    if (Array.isArray(parsedResponse.suggestions)) {
      return parsedResponse.suggestions;
    } else {
      // If the API didn't return the expected format, create a default suggestion
      return createDefaultSuggestions(selections);
    }
  } catch (error) {
    console.error("Error generating suggestions using AI:", error);
    return createDefaultSuggestions(selections);
  }
}

// Create default suggestions when AI fails
function createDefaultSuggestions(selections: WizardSelections): ResearchSuggestion[] {
  const defaultSuggestions: ResearchSuggestion[] = [];
  
  // Generate suggestion titles based on user selections
  let focusTerms: string[] = [];
  
  if (selections.interests && selections.interests.length > 0) {
    focusTerms = [...focusTerms, ...selections.interests];
  }
  
  if (selections.healthConditions && selections.healthConditions.length > 0) {
    focusTerms = [...focusTerms, ...selections.healthConditions];
  }
  
  if (focusTerms.length === 0) {
    focusTerms = ["oxidative stress", "inflammation", "metabolic health"];
  }
  
  const deliveryMethod = 
    selections.deliveryMethod && selections.deliveryMethod.length > 0 
      ? selections.deliveryMethod[0] 
      : "hydrogen-rich water";
  
  for (let i = 0; i < 3 && i < focusTerms.length; i++) {
    defaultSuggestions.push({
      title: `Effects of ${deliveryMethod} on ${focusTerms[i]} in ${selections.demographicGroup || 'humans'}`,
      description: `This research would investigate how ${deliveryMethod} affects ${focusTerms[i]} in ${selections.demographicGroup || 'human'} subjects. The study would measure key biomarkers and clinical outcomes.`,
      searchTerms: [
        "molecular hydrogen",
        deliveryMethod,
        focusTerms[i],
        selections.demographicGroup || "humans",
        "clinical trial",
        "biomarkers"
      ],
      researchGaps: [
        `Limited research on ${focusTerms[i]} with ${deliveryMethod}`,
        "Lack of standardized protocols for hydrogen administration",
        "Need for long-term outcome studies"
      ],
      confidence: 75 - (i * 10),
      relatedStudies: []
    });
  }
  
  return defaultSuggestions;
}

// Find existing studies related to a specific suggestion
async function findRelatedStudies(suggestion: ResearchSuggestion, preFilteredStudies: any[]): Promise<any[]> {
  // If we already have pre-filtered studies, use those
  if (preFilteredStudies.length > 0) {
    // Sort by relevance to the suggestion
    const scoredStudies = preFilteredStudies.map(study => {
      let score = 0;
      
      // Check title matches
      for (const term of suggestion.searchTerms) {
        if (study.title.toLowerCase().includes(term.toLowerCase())) {
          score += 3;
        }
        if (study.abstract && study.abstract.toLowerCase().includes(term.toLowerCase())) {
          score += 2;
        }
        if (study.keywords && study.keywords.toLowerCase().includes(term.toLowerCase())) {
          score += 1;
        }
      }
      
      return { ...study, relevanceScore: score };
    });
    
    // Sort by relevance score
    scoredStudies.sort((a, b) => b.relevanceScore - a.relevanceScore);
    
    // Return top results, formatted
    return scoredStudies.slice(0, 5).map(study => ({
      id: study.id,
      title: study.title,
      authors: study.authors || 'Unknown',
      abstract: study.abstract || 'Not available',
      journal: study.journal || 'Unknown journal',
      publishDate: study.publishDate ? new Date(study.publishDate).toISOString().split('T')[0] : 'Unknown date'
    }));
  }
  
  // If no pre-filtered studies, query database
  try {
    // Build a query looking for matching studies
    const searchConditions = suggestion.searchTerms.map(term => 
      or(
        ilike(studies.title, `%${term}%`),
        ilike(studies.abstract, `%${term}%`),
        ilike(studies.keywords, `%${term}%`)
      )
    );
    
    const relatedStudies = await db
      .select()
      .from(studies)
      .where(or(...searchConditions))
      .orderBy(desc(studies.journalImpactFactor), desc(studies.citationCount))
      .limit(5);
    
    // Format results
    return relatedStudies.map(study => ({
      id: study.id,
      title: study.title,
      authors: study.authors || 'Unknown',
      abstract: study.abstract || 'Not available',
      journal: study.journal || 'Unknown journal',
      publishDate: study.publishDate ? new Date(study.publishDate).toISOString().split('T')[0] : 'Unknown date'
    }));
  } catch (error) {
    console.error("Error finding related studies:", error);
    return [];
  }
}

// Helper functions for taxonomy mapping
function findCategoryForTopic(category: string, topic: string) {
  const categoryData = researchTaxonomy.find(cat => cat.name.toLowerCase() === category.toLowerCase());
  if (!categoryData) return null;
  
  return categoryData.topics.find(t => t.toLowerCase() === topic.toLowerCase());
}

function findRelatedTopicsForCondition(condition: string) {
  // Find all topics that might relate to this condition across categories
  const relatedTopics = [];
  
  for (const category of researchTaxonomy) {
    for (const topic of category.topics) {
      if (topic.toLowerCase().includes(condition.toLowerCase())) {
        relatedTopics.push({ category: category.name, topic });
      }
    }
  }
  
  return relatedTopics;
}

function findCategoriesForDemographicGroup(group: string) {
  // Find categories that relate to specific demographic groups
  const demographicCategories = researchTaxonomy.filter(
    cat => cat.name.toLowerCase().includes('demographic') || 
           cat.name.toLowerCase().includes('population')
  );
  
  const matchingTopics = [];
  
  for (const category of demographicCategories) {
    for (const topic of category.topics) {
      if (topic.toLowerCase().includes(group.toLowerCase())) {
        matchingTopics.push({ category: category.name, topic });
      }
    }
  }
  
  return matchingTopics;
}