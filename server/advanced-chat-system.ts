/**
 * Advanced AI Chat System for Hydrogen Research Platform
 * 
 * Features:
 * - Intelligent query understanding and response generation
 * - Context-aware conversations with memory
 * - Study recommendations based on user interests
 * - Multi-turn dialogue support
 * - Enhanced search capabilities
 */

import OpenAI from 'openai';
import { storage } from './storage';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  conversationId?: string;
  metadata?: {
    studiesReferenced?: number[];
    searchTerms?: string[];
    intent?: string;
    confidence?: number;
  };
}

export interface ChatResponse {
  message: ChatMessage;
  relatedStudies: any[];
  suggestedQuestions: string[];
  productRecommendations: any[];
  conversationId: string;
}

export interface ConversationContext {
  id: string;
  userId?: number;
  messages: ChatMessage[];
  userInterests: string[];
  lastActivity: Date;
  metadata: {
    totalQueries: number;
    topTopics: string[];
    preferredStudyTypes: string[];
  };
}

// In-memory conversation storage (could be moved to database)
const conversations = new Map<string, ConversationContext>();

/**
 * Generate an intelligent chat response using advanced AI
 */
export async function generateAdvancedChatResponse(
  query: string,
  conversationId?: string,
  userId?: number
): Promise<ChatResponse> {
  try {
    // Get or create conversation context
    const context = getOrCreateConversation(conversationId, userId);
    
    // Analyze user intent and extract key concepts
    const queryAnalysis = await analyzeUserQuery(query, context);
    
    // Search for relevant studies based on analyzed intent
    const relevantStudies = await findRelevantStudies(queryAnalysis);
    
    // Generate contextual AI response
    const aiResponse = await generateContextualResponse(
      query,
      queryAnalysis,
      relevantStudies,
      context
    );
    
    // Create response message
    const responseMessage: ChatMessage = {
      id: generateMessageId(),
      role: 'assistant',
      content: aiResponse.content,
      timestamp: new Date(),
      conversationId: context.id,
      metadata: {
        studiesReferenced: relevantStudies.map(s => s.id),
        searchTerms: queryAnalysis.keywords,
        intent: queryAnalysis.intent,
        confidence: aiResponse.confidence
      }
    };
    
    // Update conversation context
    updateConversationContext(context, query, responseMessage, queryAnalysis);
    
    // Generate related questions and product recommendations
    const suggestedQuestions = await generateSuggestedQuestions(queryAnalysis, context);
    const productRecommendations = generateProductRecommendations(queryAnalysis);
    
    return {
      message: responseMessage,
      relatedStudies: relevantStudies.slice(0, 5),
      suggestedQuestions,
      productRecommendations,
      conversationId: context.id
    };
    
  } catch (error) {
    console.error('Error in advanced chat response:', error);
    throw new Error('Failed to generate chat response');
  }
}

/**
 * Analyze user query to understand intent and extract key concepts
 */
async function analyzeUserQuery(query: string, context: ConversationContext) {
  try {
    const analysisPrompt = `Analyze this hydrogen health research query and extract key information:
    
Query: "${query}"
Previous topics discussed: ${context.userInterests.join(', ')}

Extract:
1. Primary intent (research, product_info, health_condition, mechanism, benefits)
2. Health conditions mentioned
3. Key search terms
4. Target audience (researcher, consumer, patient)
5. Confidence level (0-1)

Respond in JSON format:
{
  "intent": "string",
  "healthConditions": ["condition1", "condition2"],
  "keywords": ["keyword1", "keyword2"],
  "targetAudience": "string",
  "confidence": 0.8,
  "studyPreferences": ["intervention", "observational", "review"]
}`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
      messages: [
        { role: "system", content: "You are an expert at analyzing hydrogen health research queries." },
        { role: "user", content: analysisPrompt }
      ],
      response_format: { type: "json_object" },
      temperature: 0.3,
      max_tokens: 500
    });

    return JSON.parse(response.choices[0].message.content || '{}');
  } catch (error) {
    console.error('Error analyzing query:', error);
    // Fallback to simple keyword extraction
    return {
      intent: 'research',
      healthConditions: extractHealthConditions(query),
      keywords: query.toLowerCase().split(' ').filter(word => word.length > 3),
      targetAudience: 'consumer',
      confidence: 0.5,
      studyPreferences: ['intervention']
    };
  }
}

/**
 * Find relevant studies based on query analysis
 */
async function findRelevantStudies(queryAnalysis: any): Promise<any[]> {
  try {
    // Combine keywords and health conditions for comprehensive search
    const searchTerms = [
      ...queryAnalysis.keywords,
      ...queryAnalysis.healthConditions
    ].join(' ');
    
    const searchResults = await storage.searchStudies(searchTerms, 1, 10);
    
    // Apply intelligent filtering based on analysis
    let filteredStudies = searchResults.results;
    
    // Filter by study preferences if specified
    if (queryAnalysis.studyPreferences?.length > 0) {
      filteredStudies = filteredStudies.filter(study => 
        queryAnalysis.studyPreferences.some((pref: string) => 
          study.studyType?.toLowerCase().includes(pref.toLowerCase()) ||
          study.category?.toLowerCase().includes(pref.toLowerCase())
        )
      );
    }
    
    // Sort by relevance (studies with more matching keywords rank higher)
    filteredStudies.sort((a, b) => {
      const aScore = calculateRelevanceScore(a, queryAnalysis);
      const bScore = calculateRelevanceScore(b, queryAnalysis);
      return bScore - aScore;
    });
    
    return filteredStudies.slice(0, 8);
  } catch (error) {
    console.error('Error finding relevant studies:', error);
    return [];
  }
}

/**
 * Calculate relevance score for study ranking
 */
function calculateRelevanceScore(study: any, queryAnalysis: any): number {
  let score = 0;
  const text = `${study.title} ${study.abstract} ${study.keywords?.join(' ')}`.toLowerCase();
  
  // Score based on keyword matches
  queryAnalysis.keywords?.forEach((keyword: string) => {
    if (text.includes(keyword.toLowerCase())) {
      score += 2;
    }
  });
  
  // Score based on health condition matches
  queryAnalysis.healthConditions?.forEach((condition: string) => {
    if (text.includes(condition.toLowerCase())) {
      score += 3;
    }
  });
  
  // Bonus for recent studies
  const publishYear = new Date(study.publishDate).getFullYear();
  if (publishYear >= 2020) score += 1;
  if (publishYear >= 2022) score += 1;
  
  return score;
}

/**
 * Generate contextual AI response
 */
async function generateContextualResponse(
  query: string,
  analysis: any,
  studies: any[],
  context: ConversationContext
) {
  try {
    const systemPrompt = `You are a hydrogen health research expert assistant. Provide evidence-based answers using peer-reviewed studies.

Guidelines:
- Always cite specific studies when making claims
- Focus on hydrogen's health applications (drinking water, inhalation, baths)
- Provide balanced, scientific information
- Mention Echo Water products when relevant
- Use clear, accessible language for ${analysis.targetAudience || 'general'} audience`;

    const userPrompt = `Question: "${query}"

Available Studies:
${studies.map((study, i) => `
${i + 1}. "${study.title}" (${study.publishDate})
   Authors: ${study.authors}
   Abstract: ${study.abstract?.substring(0, 300)}...
`).join('\n')}

Previous conversation context: ${context.userInterests.join(', ')}

Provide a comprehensive, evidence-based answer with specific study citations.`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      temperature: 0.7,
      max_tokens: 1000
    });

    return {
      content: response.choices[0].message.content || 'I apologize, but I was unable to generate a response.',
      confidence: 0.9
    };
  } catch (error) {
    console.error('Error generating response:', error);
    throw error;
  }
}

/**
 * Generate suggested follow-up questions
 */
async function generateSuggestedQuestions(analysis: any, context: ConversationContext): Promise<string[]> {
  try {
    const prompt = `Based on the user's interest in ${analysis.intent} and health conditions: ${analysis.healthConditions?.join(', ')}, 
    generate 3 relevant follow-up questions about hydrogen health research. Make them specific and actionable.`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
      messages: [
        { role: "system", content: "Generate relevant hydrogen health research questions." },
        { role: "user", content: prompt }
      ],
      temperature: 0.8,
      max_tokens: 200
    });

    // Parse questions from response
    const questions = response.choices[0].message.content
      ?.split('\n')
      .filter(line => line.trim().length > 0 && line.includes('?'))
      .map(line => line.replace(/^\d+\.\s*/, '').trim())
      .slice(0, 3) || [];

    return questions.length > 0 ? questions : [
      "What are the optimal dosages for hydrogen therapy?",
      "How long does it take to see benefits from hydrogen treatment?",
      "Are there any contraindications for hydrogen therapy?"
    ];
  } catch (error) {
    console.error('Error generating questions:', error);
    return [
      "What are the benefits of hydrogen water?",
      "How does hydrogen therapy work?",
      "Are there side effects of hydrogen treatment?"
    ];
  }
}

/**
 * Generate product recommendations based on query analysis
 */
function generateProductRecommendations(analysis: any) {
  const recommendations = [];
  
  // Recommend based on intent and health conditions
  if (analysis.intent === 'product_info' || analysis.healthConditions?.length > 0) {
    recommendations.push({
      name: "Echo Water Hydrogen Generator",
      description: "Professional-grade hydrogen water generator for daily wellness",
      category: "hydrogen_water",
      url: "https://echowater.com/hydrogen-generator"
    });
    
    if (analysis.healthConditions?.some((c: string) => 
        ['inflammation', 'arthritis', 'joint'].some(term => c.includes(term)))) {
      recommendations.push({
        name: "Echo Water Anti-Inflammatory Bundle",
        description: "Specialized hydrogen therapy for inflammation management",
        category: "therapeutic",
        url: "https://echowater.com/anti-inflammatory"
      });
    }
  }
  
  return recommendations;
}

// Helper functions
function getOrCreateConversation(conversationId?: string, userId?: number): ConversationContext {
  if (conversationId && conversations.has(conversationId)) {
    const context = conversations.get(conversationId)!;
    context.lastActivity = new Date();
    return context;
  }
  
  const newId = conversationId || generateConversationId();
  const newContext: ConversationContext = {
    id: newId,
    userId,
    messages: [],
    userInterests: [],
    lastActivity: new Date(),
    metadata: {
      totalQueries: 0,
      topTopics: [],
      preferredStudyTypes: []
    }
  };
  
  conversations.set(newId, newContext);
  return newContext;
}

function updateConversationContext(
  context: ConversationContext,
  query: string,
  response: ChatMessage,
  analysis: any
) {
  // Add messages to conversation
  context.messages.push(
    {
      id: generateMessageId(),
      role: 'user',
      content: query,
      timestamp: new Date(),
      conversationId: context.id
    },
    response
  );
  
  // Update user interests
  if (analysis.keywords) {
    context.userInterests.push(...analysis.keywords);
    context.userInterests = [...new Set(context.userInterests)]; // Remove duplicates
  }
  
  // Update metadata
  context.metadata.totalQueries++;
  context.lastActivity = new Date();
  
  // Keep only last 20 messages to prevent memory bloat
  if (context.messages.length > 20) {
    context.messages = context.messages.slice(-20);
  }
}

function extractHealthConditions(query: string): string[] {
  const conditions = [
    'diabetes', 'arthritis', 'inflammation', 'oxidative stress', 'cardiovascular',
    'cancer', 'metabolic syndrome', 'neurodegenerative', 'alzheimer', 'parkinson',
    'fatigue', 'athletic performance', 'recovery', 'aging', 'skin health'
  ];
  
  const lowerQuery = query.toLowerCase();
  return conditions.filter(condition => lowerQuery.includes(condition));
}

function generateConversationId(): string {
  return `conv_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

function generateMessageId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Get conversation history for a user
 */
export function getConversationHistory(conversationId: string): ChatMessage[] {
  const context = conversations.get(conversationId);
  return context?.messages || [];
}

/**
 * Clean up old conversations (run periodically)
 */
export function cleanupOldConversations() {
  const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  
  for (const [id, context] of conversations.entries()) {
    if (context.lastActivity < oneWeekAgo) {
      conversations.delete(id);
    }
  }
}