import OpenAI from "openai";
import { db } from './db';
import { eq, or, ilike } from 'drizzle-orm';
import { conversations, chatMessages, chatFeedback, studies } from '../shared/schema';

// Sample products database - Can be replaced with a real database or API call to Echo Water
const ECHO_WATER_PRODUCTS = [
  {
    name: "Echo H2 Machine",
    category: "Hydrogen Water Generator",
    price: "$2,499",
    description: "Professional-grade hydrogen water generator for home use",
    benefits: ["Antioxidant properties", "Improved hydration", "Athletic performance"],
    keywords: ["hydrogen water", "antioxidant", "hydration", "energy", "performance"]
  },
  {
    name: "Echo H2 Pitcher",
    category: "Hydrogen Water Pitcher",
    price: "$399",
    description: "Portable hydrogen water pitcher for daily hydration",
    benefits: ["Convenience", "Portability", "Daily wellness"],
    keywords: ["hydrogen water", "portable", "daily", "convenience", "wellness"]
  },
  {
    name: "Echo Go+",
    category: "Portable Hydrogen Water",
    price: "$199",
    description: "Portable hydrogen water bottle for on-the-go hydration",
    benefits: ["Travel-friendly", "Quick hydrogen infusion", "Active lifestyle"],
    keywords: ["portable", "travel", "active", "sports", "on-the-go"]
  }
];

// Check if OpenAI is initialized
let openaiInitialized = false;
let openai: OpenAI;

try {
  if (process.env.OPENAI_API_KEY) {
    openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    openaiInitialized = true;
  }
} catch (error) {
  console.error('Failed to initialize OpenAI:', error);
  openaiInitialized = false;
}

// Cache for responses to avoid repeated API calls for same questions
const responseCache = new Map<string, {
  answer: string;
  sources: any[];
  relatedQuestions: string[];
  productRecommendations: any[];
  timestamp: number;
}>();

const CACHE_TIMEOUT = 5 * 60 * 1000; // 5 minutes

/**
 * Interface for conversation history with database storage
 */
export interface ConversationHistoryItem {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: Date;
  id?: number;
}

/**
 * Function to generate a chat response based on user query
 * This uses a RAG (Retrieval Augmented Generation) approach
 * to ensure answers are based only on the hydrogen studies
 */
export async function generateChatResponse(
  userQuery: string,
  conversationId?: number,
  userId?: number
): Promise<{ 
  answer: string; 
  sources: { title: string; doi: string; authors: string; publishDate: string }[];
  relatedQuestions: string[];
  productRecommendations?: any[];
  conversationId?: number;
}> {
  // Always search your database first, even if OpenAI has issues
  console.log("Searching hydrogen studies database for:", userQuery);
  
  try {
    // Check cache for recent identical query
    const cacheKey = userQuery.toLowerCase().trim();
    if (responseCache.has(cacheKey)) {
      const cachedResponse = responseCache.get(cacheKey);
      if (cachedResponse && (Date.now() - cachedResponse.timestamp < CACHE_TIMEOUT)) {
        console.log('Using cached response for query:', cacheKey);
        
        // Still record the conversation even when using cached response
        if (userId && conversationId) {
          await saveMessage(conversationId, 'user', userQuery);
          await saveMessage(conversationId, 'assistant', cachedResponse.answer);
        }
        
        return {
          answer: cachedResponse.answer,
          sources: cachedResponse.sources,
          relatedQuestions: cachedResponse.relatedQuestions,
          productRecommendations: cachedResponse.productRecommendations || [],
          conversationId
        };
      }
    }
    
    // If no conversation exists yet and we have a user, create one
    if (!conversationId && userId) {
      try {
        const defaultTitle = userQuery.length > 30 
          ? `${userQuery.substring(0, 30)}...` 
          : userQuery;
        
        const [newConversation] = await db
          .insert(conversations)
          .values({
            userId,
            title: defaultTitle,
            updatedAt: new Date()
          })
          .returning();
        
        conversationId = newConversation.id;
      } catch (error) {
        console.error('Error creating conversation:', error);
      }
    }
    
    // 1. Search your hydrogen studies database for relevant research
    const relevantResults = await searchStudiesDatabase(userQuery, 5);
    console.log(`Found ${relevantResults.length} relevant studies for query: ${userQuery}`);
    
    if (!relevantResults || relevantResults.length === 0) {
      // Try a broader search with individual keywords
      const keywords = userQuery.toLowerCase().split(' ').filter(word => word.length > 3);
      let broaderResults: any[] = [];
      
      for (const keyword of keywords) {
        const keywordResults = await searchStudiesDatabase(keyword, 2);
        broaderResults = broaderResults.concat(keywordResults);
        if (broaderResults.length >= 3) break;
      }
      
      if (broaderResults.length === 0) {
        const noResultsAnswer = "I couldn't find specific studies about that in our hydrogen research database. However, I can provide general information about hydrogen therapy. Could you try asking about specific health conditions, study types, or hydrogen delivery methods?";
        
        if (userId && conversationId) {
          await saveMessage(conversationId, 'user', userQuery);
          await saveMessage(conversationId, 'assistant', noResultsAnswer);
        }
        
        return {
          answer: noResultsAnswer,
          sources: [],
          relatedQuestions: generateDefaultRelatedQuestions(),
          conversationId
        };
      }
      
      // Use broader results if found
      const uniqueResults = broaderResults.filter((result, index, self) => 
        index === self.findIndex(r => r.id === result.id)
      );
      relevantResults.push(...uniqueResults.slice(0, 3));
    }
    
    // 2. Format the retrieved content into context
    const context = formatSearchResultsToContext(relevantResults);
    
    // 3. Get conversation history for better context
    const conversationHistory = conversationId ? await getConversationHistory(conversationId) : [];
    const recentHistory = conversationHistory.slice(-4).map(item => `${item.role}: ${item.content}`).join('\n');
    
    // 4. Generate AI response based on the retrieved studies
    let answer = "";
    
    if (openaiInitialized) {
      try {
        const systemPrompt = `You are an AI assistant specialized in hydrogen health and wellness research. Your responses must be based ONLY on the provided research studies from the hydrogen research database. 

Key guidelines:
- Base your answers exclusively on the provided studies
- Include specific study details when relevant (authors, journal, year)
- If the studies don't contain enough information to answer the question, say so clearly
- Focus on health applications of hydrogen (drinking hydrogen water, inhaling hydrogen gas, hydrogen baths)
- Do not discuss energy or fuel cell applications
- Provide balanced, evidence-based information
- Mention study limitations when relevant
- Use clear, accessible language for general audiences

Recent conversation context:
${recentHistory}

Available research studies:
${context}`;

        const response = await openai.chat.completions.create({
          model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userQuery }
          ],
          temperature: 0.3,
          max_tokens: 800
        });

        answer = response.choices[0].message.content || "I couldn't generate a proper response based on the studies found.";
      } catch (error) {
        console.error('OpenAI API error:', error);
        // Generate answer based on studies without AI assistance
        answer = generateStudyBasedAnswer(relevantResults, userQuery);
      }
    } else {
      // Generate answer based on studies without AI assistance
      answer = generateStudyBasedAnswer(relevantResults, userQuery);
    }

/**
 * Generate answer based on study results when AI is not available
 */
function generateStudyBasedAnswer(studies: any[], query: string): string {
  if (!studies || studies.length === 0) {
    return "I couldn't find specific studies related to your question in our database.";
  }

  let answer = `Based on ${studies.length} relevant hydrogen research studies from our database:\n\n`;
  
  studies.forEach((study, index) => {
    answer += `**Study ${index + 1}: ${study.title}**\n`;
    if (study.authors) answer += `Authors: ${study.authors}\n`;
    if (study.journal) answer += `Journal: ${study.journal}\n`;
    if (study.publishDate) answer += `Published: ${study.publishDate}\n`;
    if (study.abstract) {
      const shortAbstract = study.abstract.length > 200 
        ? study.abstract.substring(0, 200) + "..." 
        : study.abstract;
      answer += `Summary: ${shortAbstract}\n`;
    }
    answer += "\n";
  });

  answer += "These studies from our hydrogen research database provide scientific evidence related to your question. For more detailed information, you can explore the individual studies.";
  
  return answer;
}
    
    // 5. Generate related questions
    const relatedQuestions = await generateRelatedQuestions(userQuery, answer);
    
    // 6. Format sources from the relevant results
    const sources = relevantResults.map(result => ({
      title: result.title,
      doi: result.doi || "No DOI available",
      authors: result.authors || "Not specified",
      publishDate: result.publishDate || "Not specified"
    }));
    
    // 7. Get relevant product recommendations
    const productRecommendations = getRelevantProducts(userQuery, answer);
    
    // 8. Save the conversation to database
    if (userId && conversationId) {
      await saveMessage(conversationId, 'user', userQuery);
      await saveMessage(conversationId, 'assistant', answer);
    }
    
    // 9. Cache the response
    responseCache.set(cacheKey, {
      answer,
      sources,
      relatedQuestions,
      productRecommendations,
      timestamp: Date.now()
    });
    
    return {
      answer,
      sources,
      relatedQuestions,
      productRecommendations,
      conversationId
    };
    
  } catch (error) {
    console.error('Error generating chat response:', error);
    
    // Fallback to a simpler response
    const fallbackAnswer = "I'm experiencing some technical difficulties right now. Please try asking your question again, or contact our support team if the issue persists.";
    
    if (userId && conversationId) {
      await saveMessage(conversationId, 'user', userQuery);
      await saveMessage(conversationId, 'assistant', fallbackAnswer);
    }
    
    return {
      answer: fallbackAnswer,
      sources: [],
      relatedQuestions: generateDefaultRelatedQuestions(),
      conversationId
    };
  }
}

/**
 * Search your hydrogen studies database for relevant research
 */
async function searchStudiesDatabase(query: string, limit: number = 5): Promise<any[]> {
  try {
    const searchTerms = query.toLowerCase();
    
    // Search through your studies database
    const results = await db
      .select({
        id: studies.id,
        title: studies.title,
        abstract: studies.abstract,
        authors: studies.authors,
        journal: studies.journal,
        publishDate: studies.publishDate,
        doi: studies.doi,
        category: studies.category,
        healthConditions: studies.healthConditions,
        keywords: studies.keywords
      })
      .from(studies)
      .where(
        or(
          ilike(studies.title, `%${searchTerms}%`),
          ilike(studies.abstract, `%${searchTerms}%`),
          ilike(studies.healthConditions, `%${searchTerms}%`),
          ilike(studies.category, `%${searchTerms}%`)
        )
      )
      .limit(limit);
    
    return results;
  } catch (error) {
    console.error('Error searching studies database:', error);
    return [];
  }
}

/**
 * Format search results into context for the AI
 */
function formatSearchResultsToContext(results: any[]): string {
  return results.map(result => {
    return `
Study: ${result.title}
Authors: ${result.authors || 'Not specified'}
Journal: ${result.journal || 'Not specified'}
Publication Date: ${result.publishDate || 'Not specified'}
DOI: ${result.doi || 'No DOI available'}
Category: ${result.category || 'General'}
Abstract: ${result.abstract || 'No abstract available'}
Health Conditions: ${result.healthConditions || 'Not specified'}
---`;
  }).join("\n\n");
}

/**
 * Generate related questions based on the current question and answer
 */
async function generateRelatedQuestions(originalQuestion: string, answer: string, count: number = 3): Promise<string[]> {
  if (!openaiInitialized) {
    return generateDefaultRelatedQuestions();
  }

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
      messages: [
        {
          role: "system",
          content: "You are an AI specialized in hydrogen health and wellness applications. Generate related questions that users might want to ask next based on their current question and the answer provided. Make sure these questions are specific, relevant to health applications of hydrogen (drinking hydrogen water, inhaling hydrogen gas, or hydrogen baths), and would help the user explore the topic further. Focus exclusively on health topics, not energy or fuel cell applications. Provide exactly 3 questions in JSON format."
        },
        {
          role: "user",
          content: `Original question: "${originalQuestion}"\n\nAnswer provided: "${answer}"\n\nGenerate ${count} related follow-up questions in JSON format with the key 'questions'.`
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.7,
      max_tokens: 250
    });

    const content = response.choices[0].message.content;
    if (!content) return generateDefaultRelatedQuestions();

    try {
      const parsedContent = JSON.parse(content);
      if (Array.isArray(parsedContent.questions)) {
        return parsedContent.questions.slice(0, count);
      }
    } catch (parseError) {
      console.error('Error parsing related questions JSON:', parseError);
    }
  } catch (error) {
    console.error('Error generating related questions:', error);
  }
  
  return generateDefaultRelatedQuestions();
}

/**
 * Match relevant Echo Water products to a user query and answer
 * @param query User's original query
 * @param answer Generated answer from AI
 * @returns Array of relevant product recommendations
 */
function getRelevantProducts(query: string, answer: string) {
  const combinedText = (query + " " + answer).toLowerCase();
  
  return ECHO_WATER_PRODUCTS
    .map(product => {
      let relevanceScore = 0;
      
      // Check if any product keywords appear in the query or answer
      product.keywords.forEach(keyword => {
        if (combinedText.includes(keyword.toLowerCase())) {
          relevanceScore += 1;
        }
      });
      
      // Boost score if category is mentioned
      if (combinedText.includes(product.category.toLowerCase())) {
        relevanceScore += 2;
      }
      
      return { product, relevanceScore };
    })
    .filter(item => item.relevanceScore > 0)
    .sort((a, b) => b.relevanceScore - a.relevanceScore)
    .map(item => item.product)
    .slice(0, 2); // Limit to max 2 products to avoid overwhelming the user
}

/**
 * Generate default related questions if the API call fails
 */
function generateDefaultRelatedQuestions(): string[] {
  return [
    "What are the different ways to consume hydrogen for health benefits?",
    "How does hydrogen water compare to regular water?",
    "What health conditions have been studied with hydrogen therapy?"
  ];
}

/**
 * Save a message to the database
 */
async function saveMessage(conversationId: number, role: 'user' | 'assistant', content: string): Promise<number> {
  try {
    const [message] = await db
      .insert(chatMessages)
      .values({
        conversationId,
        role,
        content,
        timestamp: new Date()
      })
      .returning();
    
    return message.id;
  } catch (error) {
    console.error('Error saving message:', error);
    throw error;
  }
}

/**
 * Get conversation history from the database
 */
export async function getConversationHistory(conversationId: number): Promise<ConversationHistoryItem[]> {
  try {
    const messages = await db
      .select({
        id: chatMessages.id,
        role: chatMessages.role,
        content: chatMessages.content,
        timestamp: chatMessages.timestamp
      })
      .from(chatMessages)
      .where(eq(chatMessages.conversationId, conversationId))
      .orderBy(chatMessages.timestamp);
    
    return messages;
  } catch (error) {
    console.error('Error getting conversation history:', error);
    return [];
  }
}

/**
 * Get user's conversations
 */
export async function getUserConversations(userId: number): Promise<any[]> {
  try {
    const userConversations = await db
      .select()
      .from(conversations)
      .where(eq(conversations.userId, userId))
      .orderBy(conversations.updatedAt);
    
    return userConversations;
  } catch (error) {
    console.error('Error getting user conversations:', error);
    return [];
  }
}

/**
 * Save feedback for a message
 */
export async function saveFeedback(
  messageId: number,
  userId: number,
  rating: number,
  feedback?: string
): Promise<void> {
  try {
    await db
      .insert(chatFeedback)
      .values({
        messageId,
        userId,
        rating,
        feedback,
        timestamp: new Date()
      });
  } catch (error) {
    console.error('Error saving feedback:', error);
    throw error;
  }
}

/**
 * Get popular questions from the database
 */
export async function getPopularQuestions(category?: string, limit: number = 5): Promise<string[]> {
  try {
    // This would need a proper implementation based on your database structure
    // For now, return default questions
    return [
      "What are the health benefits of drinking hydrogen water?",
      "How does hydrogen gas therapy work?",
      "Is hydrogen water safe to drink daily?",
      "What's the difference between hydrogen water and alkaline water?",
      "Can hydrogen therapy help with inflammation?"
    ];
  } catch (error) {
    console.error('Error getting popular questions:', error);
    return [];
  }
}

/**
 * Generate a fallback response when OpenAI API is unavailable
 * This ensures users still get relevant product recommendations
 * even when the AI service is down or experiencing issues
 */
function generateFallbackResponse(query: string, conversationId?: number): {
  answer: string;
  sources: any[];
  relatedQuestions: string[];
  productRecommendations: any[];
  conversationId?: number;
} {
  const fallbackAnswer = `I'm currently experiencing some technical difficulties with my AI processing, but I can still help you with information about hydrogen health products and research.

Based on your question about "${query}", you might be interested in exploring our hydrogen water solutions or learning more about the research behind hydrogen therapy.

Please try asking your question again, or feel free to browse our product recommendations below.`;

  const productRecommendations = getRelevantProducts(query, "");
  
  return {
    answer: fallbackAnswer,
    sources: [],
    relatedQuestions: generateDefaultRelatedQuestions(),
    productRecommendations,
    conversationId
  };
}

/**
 * Function to validate if a user query is appropriate
 * Helps prevent queries unrelated to hydrogen research
 */
export async function validateQuery(query: string): Promise<{
  isValid: boolean;
  reason?: string;
}> {
  const hydrogenKeywords = [
    'hydrogen', 'h2', 'molecular hydrogen', 'hydrogen water', 'hydrogen gas', 
    'hydrogen therapy', 'antioxidant', 'oxidative stress', 'inflammation',
    'echo water', 'health', 'wellness', 'medical', 'study', 'research'
  ];
  
  const queryLower = query.toLowerCase();
  const hasHydrogenContext = hydrogenKeywords.some(keyword => 
    queryLower.includes(keyword)
  );
  
  // Allow general health questions even if they don't mention hydrogen directly
  const healthKeywords = [
    'health', 'wellness', 'medical', 'treatment', 'therapy', 'benefits',
    'side effects', 'safety', 'clinical', 'study', 'research'
  ];
  
  const hasHealthContext = healthKeywords.some(keyword => 
    queryLower.includes(keyword)
  );
  
  if (hasHydrogenContext || hasHealthContext || query.length < 10) {
    return { isValid: true };
  }
  
  return {
    isValid: false,
    reason: "This question doesn't seem to be related to hydrogen health research. Please ask about hydrogen therapy, hydrogen water, or related health topics."
  };
}