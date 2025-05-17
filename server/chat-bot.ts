import OpenAI from "openai";
import { semanticSearch } from './vector-database';
import { db } from './db';
import { eq } from 'drizzle-orm';
import { conversations, chatMessages, chatFeedback } from '../shared/schema';

// Sample products database - Can be replaced with a real database or API call to Echo Water
const ECHO_WATER_PRODUCTS = [
  {
    name: "Echo H2 Machine",
    description: "Premium hydrogen water generator with advanced PEM technology for maximum hydrogen concentration",
    url: "https://echowater.com/products/echo-h2-machine",
    imageUrl: "https://echowater.com/cdn/shop/files/echo-h2-server-compressed-2_1024x1024.jpg",
    keywords: ["water", "drink", "hydrogen water", "molecular hydrogen", "h2"],
    healthConditions: ["inflammation", "metabolic", "diabetes", "oxidative stress", "antioxidant", "weight", "energy"]
  },
  {
    name: "Echo H2 Tablet Maker",
    description: "Convenient and portable hydrogen tablet maker for creating hydrogen-rich water on the go",
    url: "https://echowater.com/products/echo-h2-tablets-1",
    imageUrl: "https://echowater.com/cdn/shop/products/echo-h2-tablets.jpg",
    keywords: ["tablets", "portable", "travel", "hydrogen water", "supplements"],
    healthConditions: ["inflammation", "travel", "athletes", "workout", "recovery", "sports", "convenience"]
  },
  {
    name: "Echo H2 Inhaler",
    description: "Premium molecular hydrogen inhalation device for respiratory and systemic benefits",
    url: "https://echowater.com/products/echo-h2-inhaler",
    imageUrl: "https://echowater.com/cdn/shop/products/echo-h2-inhaler.jpg",
    keywords: ["inhale", "inhalation", "breathing", "respiratory", "molecular hydrogen", "lungs"],
    healthConditions: ["respiratory", "asthma", "copd", "lung", "breathing", "allergy", "covid", "pneumonia", "pulmonary"]
  },
  {
    name: "Echo H2 Bath System",
    description: "Advanced hydrogen bath system for full-body hydrogen therapy and skin health",
    url: "https://echowater.com/products/echo-h2-bath",
    imageUrl: "https://echowater.com/cdn/shop/products/echo-h2-bath.jpg",
    keywords: ["bath", "skin", "topical", "bathing", "hydrogen bath", "skin health"],
    healthConditions: ["skin", "psoriasis", "eczema", "dermatitis", "acne", "wound", "healing", "beauty", "anti-aging", "wrinkles"]
  }
];

// Initialize OpenAI client with error handling
let openai;
let openaiInitialized = false;

try {
  if (!process.env.OPENAI_API_KEY) {
    console.warn('Warning: OPENAI_API_KEY is not set or empty. AI functionality will be limited.');
  } else {
    openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    openaiInitialized = true;
    console.log('OpenAI client initialized successfully');
  }
} catch (error) {
  console.error('Failed to initialize OpenAI client:', error);
}

// The newest OpenAI model is "gpt-4o" which was released May 13, 2024
// Do not change this unless explicitly requested by the user
const MODEL = "gpt-4o";

// In-memory cache for frequently asked questions
const responseCache = new Map<string, {
  answer: string;
  sources: any[];
  relatedQuestions: string[];
  productRecommendations?: any[];
  timestamp: number;
}>();

// Cache timeout - 24 hours
const CACHE_TIMEOUT = 24 * 60 * 60 * 1000;

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
  // Check if OpenAI is properly initialized
  if (!openaiInitialized) {
    console.warn("OpenAI client not initialized - using fallback response");
    return generateFallbackResponse(userQuery, conversationId);
  }
  
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
    
    // 1. Retrieve relevant content from vector DB
    const relevantResults = await semanticSearch(userQuery, 5);
    
    if (!relevantResults || relevantResults.length === 0) {
      const noResultsAnswer = "I couldn't find any relevant information about that in our hydrogen research database. Could you try rephrasing your question or asking about a different aspect of hydrogen research?";
      
      // Save the conversation even when no results
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
    
    // 2. Format the retrieved content into context
    const context = formatSearchResultsToContext(relevantResults);
    
    // 3. Create messages array with conversation history if available
    let formattedHistory: { role: "user" | "assistant", content: string }[] = [];
    
    if (conversationId) {
      // Get conversation history from database if a conversation ID is provided
      const historyItems = await getConversationHistory(conversationId);
      formattedHistory = historyItems.map(item => ({
        role: item.role as "user" | "assistant",
        content: item.content
      }));
    }
    
    const messages = [
      {
        role: "system" as const,
        content: `You are HydrogenHealthAssistant, a specialized AI that only answers questions about hydrogen health and wellness applications based on peer-reviewed scientific studies. Focus exclusively on health topics like hydrogen water, hydrogen inhalation therapy, and hydrogen baths - not energy or fuel cell applications.

IMPORTANT RULES:
1. Only provide information that is directly supported by the peer-reviewed hydrogen health studies in the context.
2. If you cannot answer a question based on the context provided, clearly state that the information is not available in the current research database.
3. Never make up or infer information that is not explicitly stated in the context.
4. When appropriate, suggest Echo Water products that might help with the user's health goals. Echo Water (echowater.com) offers hydrogen-rich water systems and wellness products.
4. Always cite your sources using [Author et al., Year] format when providing information.
5. Maintain a scientific tone but explain concepts in a clear way that is understandable to non-experts.
6. If there are conflicting findings in different studies, mention both perspectives and cite both sources.
7. Format your response in a clear, structured way with short paragraphs and bullet points when appropriate.
8. Do not reference papers or studies that aren't included in the context.
9. When relevant, mention Echo Water hydrogen products that might help with the health condition being discussed.
10. Focus exclusively on health and wellness topics, not energy or industrial applications of hydrogen.

Here is the context from peer-reviewed studies on hydrogen health research:

${context}`
      },
      ...formattedHistory,
      {
        role: "user" as const,
        content: userQuery
      }
    ];

    // 4. Generate response from OpenAI
    const completion = await openai.chat.completions.create({
      model: MODEL,
      messages,
      temperature: 0.2, // More consistent, factual responses
      max_tokens: 1000
    });

    const answer = completion.choices[0].message.content?.trim() || 
      "I couldn't generate a response based on the available research. Please try asking a different question.";
    
    // 5. Generate related questions
    const relatedQuestions = await generateRelatedQuestions(userQuery, answer);
    
    // 6. Extract sources from the relevant results
    const sources = relevantResults.map(result => {
      const metadata = typeof result.metadata === 'string' 
        ? JSON.parse(result.metadata) 
        : result.metadata;
      
      // Handle different possible date column formats
      const publishDate = result.publish_date ? new Date(result.publish_date).toISOString().split('T')[0] : 'Unknown date';
      
      return {
        title: result.title || 'Untitled study',
        doi: metadata?.doi || "No DOI available",
        authors: result.authors || 'Unknown authors',
        publishDate: publishDate
      };
    });
    
    // 7. Remove duplicate sources (same study might appear multiple times)
    const uniqueSources = sources.filter((source, index, self) =>
      index === self.findIndex((s) => s.doi === source.doi)
    );
    
    // 8. Save messages to database if we have a conversation
    if (userId && conversationId) {
      await saveMessage(conversationId, 'user', userQuery);
      await saveMessage(conversationId, 'assistant', answer);
      
      // Update conversation timestamp
      await db
        .update(conversations)
        .set({ updatedAt: new Date() })
        .where(eq(conversations.id, conversationId));
    }
    
    // 9. Cache the response
    responseCache.set(cacheKey, {
      answer,
      sources: uniqueSources,
      relatedQuestions,
      timestamp: Date.now()
    });

    return {
      answer,
      sources: uniqueSources,
      relatedQuestions,
      conversationId
    };
    // Generate product recommendations based on query and answer
    const productRecommendations = getRelevantProducts(userQuery, answer);
    
    return {
      answer,
      sources: uniqueSources,
      relatedQuestions,
      conversationId,
      productRecommendations
    };
  } catch (error) {
    console.error('Error generating chat response:', error);
    return {
      answer: "I'm sorry, I encountered an error processing your question. Please try again later.",
      sources: [],
      relatedQuestions: generateDefaultRelatedQuestions(),
      productRecommendations: []
    };
  }
}

/**
 * Match relevant Echo Water products to a user query and answer
 * @param query User's original query
 * @param answer Generated answer from AI
 * @returns Array of relevant product recommendations
 */
function getRelevantProducts(query: string, answer: string) {
  const combinedText = (query + ' ' + answer).toLowerCase();
  
  // Calculate relevance score for each product
  const productsWithScores = ECHO_WATER_PRODUCTS.map(product => {
    let score = 0;
    
    // Score based on keywords matching (0-5 points)
    product.keywords.forEach(keyword => {
      if (combinedText.includes(keyword.toLowerCase())) {
        // Exact matches are weighted more heavily
        score += combinedText.includes(` ${keyword.toLowerCase()} `) ? 2 : 1;
      }
    });
    
    // Score based on health conditions matching (0-10 points)
    if (product.healthConditions) {
      product.healthConditions.forEach(condition => {
        if (combinedText.includes(condition.toLowerCase())) {
          // Health condition matches are weighted most heavily
          score += 3;
        }
      });
    }
    
    // Method of delivery scoring based on context
    if ((product.name.includes('Inhaler') && 
        (combinedText.includes('breath') || 
         combinedText.includes('lung') || 
         combinedText.includes('respir'))) ||
        (product.name.includes('Bath') && 
        (combinedText.includes('skin') || 
         combinedText.includes('topical') || 
         combinedText.includes('external'))) ||
        (product.name.includes('Machine') && 
        (combinedText.includes('drink') || 
         combinedText.includes('water') || 
         combinedText.includes('oral'))) ||
        (product.name.includes('Tablet') && 
        (combinedText.includes('travel') || 
         combinedText.includes('portable') || 
         combinedText.includes('supplement')))
    ) {
      score += 5; // Substantial boost for matching the right delivery method
    }
    
    return { product, score };
  });
  
  // Filter out products with no relevance and sort by score (highest first)
  return productsWithScores
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .map(item => item.product)
    .slice(0, 2); // Limit to max 2 products to avoid overwhelming the user
}

/**
 * Format search results into context for the AI
 */
function formatSearchResultsToContext(results: any[]): string {
  return results.map(result => {
    const metadata = typeof result.metadata === 'string' 
      ? JSON.parse(result.metadata) 
      : result.metadata;
    
    const section = metadata?.section || "content";
    const doi = metadata?.doi || "No DOI available";
    
    return `--- Document [${result.title}] (DOI: ${doi}) ---
Authors: ${result.authors}
Published: ${result.publishDate}
Section: ${section.charAt(0).toUpperCase() + section.slice(1)}

${result.chunk_text}

`;
  }).join("\n");
}

/**
 * Generate related questions based on the current question and answer
 */
async function generateRelatedQuestions(
  originalQuestion: string,
  answer: string,
  count: number = 3
): Promise<string[]> {
  try {
    const response = await openai.chat.completions.create({
      model: MODEL,
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
    } catch (error) {
      console.error("Error parsing related questions JSON:", error);
    }
    
    return generateDefaultRelatedQuestions();
  } catch (error) {
    console.error("Error generating related questions:", error);
    return generateDefaultRelatedQuestions();
  }
}

/**
 * Generate default related questions if the API call fails
 */
function generateDefaultRelatedQuestions(): string[] {
  return [
    "What health benefits does hydrogen-rich water have for inflammation?",
    "How effective is hydrogen inhalation therapy for respiratory conditions?",
    "Can hydrogen baths help with skin conditions?",
    "What's the recommended dosage of hydrogen water for health benefits?",
    "Are there any studies on hydrogen therapy for athletic recovery?"
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
        content
      })
      .returning();
    
    return message.id;
  } catch (error) {
    console.error('Error saving message:', error);
    return 0;
  }
}

/**
 * Get conversation history from the database
 */
export async function getConversationHistory(conversationId: number): Promise<ConversationHistoryItem[]> {
  try {
    const messages = await db
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.conversationId, conversationId))
      .orderBy(chatMessages.timestamp);
    
    return messages.map(msg => ({
      id: msg.id,
      role: msg.role as 'user' | 'assistant',
      content: msg.content,
      timestamp: msg.timestamp
    }));
  } catch (error) {
    console.error('Error retrieving conversation history:', error);
    return [];
  }
}

/**
 * Get user's conversations
 */
export async function getUserConversations(userId: number): Promise<any[]> {
  try {
    return await db
      .select()
      .from(conversations)
      .where(eq(conversations.userId, userId))
      .orderBy(conversations.updatedAt, 'desc');
  } catch (error) {
    console.error('Error retrieving user conversations:', error);
    return [];
  }
}

/**
 * Save feedback for a message
 */
export async function saveFeedback(
  messageId: number, 
  rating: number, 
  comment?: string,
  userId?: number
): Promise<boolean> {
  try {
    await db
      .insert(chatFeedback)
      .values({
        messageId,
        userId: userId || null,
        rating,
        comment: comment || null
      });
    
    return true;
  } catch (error) {
    console.error('Error saving feedback:', error);
    return false;
  }
}

/**
 * Get popular questions from the database
 */
export async function getPopularQuestions(category?: string, limit: number = 5): Promise<string[]> {
  try {
    // Check if we have popular questions in the database
    const popularQuestionsFromDB = await db
      .select()
      .from(popularQuestions)
      .orderBy(popularQuestions.clickCount, 'desc')
      .limit(limit);
    
    // If we have questions in the database, return those
    if (popularQuestionsFromDB.length > 0) {
      return popularQuestionsFromDB.map(q => q.question);
    }
    
    // If no category is provided or category is health/general, use these health-focused questions
    if (!category || category === 'health' || category === 'general') {
      return [
        "What are the benefits of hydrogen water for inflammation?",
        "How does molecular hydrogen help with oxidative stress?",
        "Is hydrogen therapy effective for athletic recovery?",
        "What conditions can hydrogen inhalation therapy help with?",
        "Are there any side effects of drinking hydrogen-rich water?",
        "How does hydrogen therapy compare to antioxidant supplements?",
        "What's the science behind hydrogen's effect on mitochondria?",
        "Can hydrogen therapy help with autoimmune conditions?",
        "What dosage of hydrogen is recommended for health benefits?",
        "How does hydrogen water help with skin conditions?"
      ].slice(0, limit);
    }
    
    // For other categories, fall back to default questions
    return generateDefaultRelatedQuestions();
  } catch (error) {
    console.error('Error retrieving popular questions:', error);
    return generateDefaultRelatedQuestions();
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
  const lowerQuery = query.toLowerCase();
  
  // Always include the Echo Flask as a primary recommendation for every query
  const echoFlask = {
    name: "Echo H2 Flask",
    description: "Portable hydrogen-infusing water bottle for on-the-go hydrogen therapy with premium quality materials",
    url: "https://echowater.com/products/echo-h2-flask",
    imageUrl: "https://echowater.com/cdn/shop/products/echo-h2-flask.jpg",
    relevanceScore: 98
  };
  
  // Determine relevant products based on keywords in the query
  let productRecommendations = [];
  let responseCategory = "general";
  
  if (lowerQuery.includes('skin') || lowerQuery.includes('derma') || 
      lowerQuery.includes('psoriasis') || lowerQuery.includes('eczema') || 
      lowerQuery.includes('acne') || lowerQuery.includes('rash')) {
    // Recommend bath system for skin conditions alongside the Flask
    productRecommendations = [
      echoFlask,
      {
        name: "Echo H2 Bath System",
        description: "Advanced hydrogen bath system for full-body hydrogen therapy and skin health",
        url: "https://echowater.com/products/echo-h2-bath",
        imageUrl: "https://echowater.com/cdn/shop/products/echo-h2-bath.jpg",
        relevanceScore: 95
      }
    ];
    responseCategory = "skin";
  } else if (lowerQuery.includes('breath') || lowerQuery.includes('lung') || 
             lowerQuery.includes('inhal') || lowerQuery.includes('respiratory') || 
             lowerQuery.includes('asthma') || lowerQuery.includes('covid')) {
    // Recommend inhaler for respiratory conditions alongside the Flask
    productRecommendations = [
      echoFlask,
      {
        name: "Echo H2 Inhaler",
        description: "Premium molecular hydrogen inhalation device for respiratory and systemic benefits",
        url: "https://echowater.com/products/echo-h2-inhaler",
        imageUrl: "https://echowater.com/cdn/shop/products/echo-h2-inhaler.jpg",
        relevanceScore: 95
      }
    ];
    responseCategory = "respiratory";
  } else if (lowerQuery.includes('travel') || lowerQuery.includes('portable') || 
             lowerQuery.includes('tablet') || lowerQuery.includes('convenient') || 
             lowerQuery.includes('on the go')) {
    // For travel and portable needs, Flask is the perfect solution
    productRecommendations = [
      {
        name: "Echo H2 Flask",
        description: "The ultimate portable hydrogen water solution for travel and on-the-go hydrogen therapy",
        url: "https://echowater.com/products/echo-h2-flask",
        imageUrl: "https://echowater.com/cdn/shop/products/echo-h2-flask.jpg",
        relevanceScore: 100
      }
    ];
    responseCategory = "portable";
  } else if (lowerQuery.includes('athletic') || lowerQuery.includes('workout') || 
             lowerQuery.includes('exercise') || lowerQuery.includes('recovery') || 
             lowerQuery.includes('performance') || lowerQuery.includes('sport')) {
    // Recommend Flask and tablets for athletic performance
    productRecommendations = [
      echoFlask,
      {
        name: "Echo H2 Tablet Maker",
        description: "Portable hydrogen tablets for creating hydrogen-rich water during training sessions and competitions",
        url: "https://echowater.com/products/echo-h2-tablets-1",
        imageUrl: "https://echowater.com/cdn/shop/products/echo-h2-tablets.jpg",
        relevanceScore: 90
      }
    ];
    responseCategory = "athletic";
  } else {
    // Default to Flask and water machine for general queries
    productRecommendations = [
      echoFlask,
      {
        name: "Echo H2 Machine",
        description: "Premium hydrogen water generator for home use - great companion to your Echo Flask for maximum benefits",
        url: "https://echowater.com/products/echo-h2-machine",
        imageUrl: "https://echowater.com/cdn/shop/files/echo-h2-server-compressed-2_1024x1024.jpg",
        relevanceScore: 85
      }
    ];
    responseCategory = "general";
  }
  
  // Create category-specific response
  let answer = "";
  let relatedQuestions = [];
  
  switch (responseCategory) {
    case "skin":
      answer = "I'm sorry, but I'm having trouble accessing my research database at the moment. Your question appears to be about hydrogen therapy for skin conditions. While I can't provide specific research citations right now, hydrogen bath therapy is generally considered beneficial for various skin conditions due to its anti-inflammatory and antioxidant properties. Echo Water's H2 Bath System is designed specifically for topical hydrogen application.";
      relatedQuestions = [
        "How does hydrogen therapy help with psoriasis?",
        "Can hydrogen baths improve eczema symptoms?",
        "What skin conditions can hydrogen therapy help with?",
        "How often should I use hydrogen baths for skin health?"
      ];
      break;
      
    case "respiratory":
      answer = "I'm sorry, but I'm having trouble accessing my research database at the moment. Your question appears to be about hydrogen therapy for respiratory health. While I can't provide specific research citations right now, hydrogen inhalation therapy has been studied for its potential benefits for lung health and respiratory conditions due to its anti-inflammatory properties. Echo Water's H2 Inhaler is designed specifically for respiratory hydrogen application.";
      relatedQuestions = [
        "How does hydrogen inhalation help with respiratory conditions?",
        "Can hydrogen therapy benefit asthma symptoms?",
        "What is the recommended duration for hydrogen inhalation therapy?",
        "Is hydrogen inhalation safe for long-term use?"
      ];
      break;
      
    case "portable":
      answer = "I'm sorry, but I'm having trouble accessing my research database at the moment. Your question appears to be about portable hydrogen therapy options. While I can't provide specific research citations right now, hydrogen tablets are a convenient way to create hydrogen-rich water when traveling or away from home. Echo Water's H2 Tablet Maker provides a portable solution for maintaining your hydrogen therapy regimen on the go.";
      relatedQuestions = [
        "How effective are hydrogen tablets compared to hydrogen machines?",
        "What's the best way to use hydrogen tablets while traveling?",
        "How long does hydrogen water from tablets remain effective?",
        "Can I take hydrogen tablets on an airplane?"
      ];
      break;
      
    case "athletic":
      answer = "I'm sorry, but I'm having trouble accessing my research database at the moment. Your question appears to be about hydrogen therapy for athletic performance and recovery. While I can't provide specific research citations right now, hydrogen has been studied for its potential to reduce exercise-induced fatigue and improve recovery times. Echo Water offers both the H2 Machine for home use and portable H2 tablets that athletes can use during training or competition.";
      relatedQuestions = [
        "When should athletes drink hydrogen water for best results?",
        "How can hydrogen therapy improve athletic recovery?",
        "What sports performance benefits does hydrogen provide?",
        "Can hydrogen water reduce muscle soreness after workouts?"
      ];
      break;
      
    default:
      answer = "I'm sorry, but I'm having trouble accessing my research database at the moment. Your question about hydrogen health appears to be of general interest. While I can't provide specific research citations right now, hydrogen-rich water is being studied for various health benefits due to its antioxidant properties and selective free radical scavenging. Echo Water's H2 Machine provides a convenient way to create hydrogen-rich water at home.";
      relatedQuestions = [
        "What are the general health benefits of hydrogen water?",
        "How much hydrogen water should I drink daily?",
        "How does molecular hydrogen work as an antioxidant?",
        "What health conditions can hydrogen therapy help with?"
      ];
  }
  
  return {
    answer,
    sources: [],
    relatedQuestions,
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
  // Quick keyword-based pre-validation to work even if OpenAI is unavailable
  const lowerQuery = query.toLowerCase();
    
  // If clearly about hydrogen health, approve immediately
  if (lowerQuery.includes('hydrogen water') || 
      lowerQuery.includes('h2 water') ||
      lowerQuery.includes('hydrogen inhalation') ||
      lowerQuery.includes('hydrogen therapy') ||
      lowerQuery.includes('hydrogen bath') ||
      (lowerQuery.includes('molecular hydrogen') && 
       (lowerQuery.includes('health') || 
        lowerQuery.includes('wellness') || 
        lowerQuery.includes('medical') || 
        lowerQuery.includes('treatment')))) {
    return { isValid: true, reason: "Directly relevant to hydrogen health applications" };
  }
    
  // If clearly about energy/fuel cells, reject immediately
  if ((lowerQuery.includes('fuel cell') || 
       lowerQuery.includes('energy storage') ||
       lowerQuery.includes('power generation')) && 
      !lowerQuery.includes('health') && 
      !lowerQuery.includes('medical') && 
      !lowerQuery.includes('drinking')) {
    return { 
      isValid: false, 
      reason: "Query appears to be about hydrogen energy or fuel cells, not health applications" 
    };
  }

  // Check if OpenAI is available
  if (!openaiInitialized) {
    console.warn("OpenAI validation skipped - client not initialized");
    // Default to accepting health-related queries when we can't validate with AI
    return { 
      isValid: true, 
      reason: "Query accepted (validation service unavailable)" 
    };
  }

  try {
    const response = await openai.chat.completions.create({
      model: MODEL,
      messages: [
        {
          role: "system",
          content: "You are an AI that helps validate if user queries are related to hydrogen health and wellness research. Your task is to determine if a query is relevant to hydrogen health studies (molecular hydrogen for health, hydrogen-rich water, hydrogen inhalation therapy, hydrogen baths) and should be answered by a hydrogen health research assistant. The system only answers questions about hydrogen for health and wellness, NOT questions about hydrogen energy, fuel cells, or industrial applications. Return a JSON object with 'isValid' (boolean) and 'reason' (string explaining your decision) fields."
        },
        {
          role: "user",
          content: `Is this query related to hydrogen health research and appropriate for a hydrogen health research assistant to answer? The assistant only answers questions about hydrogen for health and wellness applications, not energy or fuel cells. Query: "${query}"`
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.1,
      max_tokens: 150
    });

    const content = response.choices[0].message.content;
    if (!content) {
      return { isValid: true }; // Default to valid if no response
    }

    try {
      const parsedContent = JSON.parse(content);
      return {
        isValid: parsedContent.isValid === true,
        reason: parsedContent.reason
      };
    } catch (error) {
      console.error("Error parsing validation JSON:", error);
      return { isValid: true }; // Default to valid if parsing fails
    }
  } catch (error) {
    console.error("Error validating query:", error);
    return { isValid: true }; // Default to valid if API call fails
  }
}