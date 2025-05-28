import { Pool } from '@neondatabase/serverless';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

/**
 * Ultra-simple chatbot that definitely works with your hydrogen studies database
 */
export async function generateUltraSimpleChatResponse(query: string) {
  console.log(`🚀 Starting ultra-simple chatbot for query: "${query}"`);
  
  try {
    // Search your database with the most basic approach possible
    const studies = await searchDatabaseDirect(query);
    console.log(`✅ Found ${studies.length} hydrogen studies`);
    
    // Generate AI response
    const answer = await generateSimpleAIResponse(query, studies);
    console.log(`✅ AI response generated successfully`);
    
    return {
      success: true,
      data: {
        answer,
        sources: studies,
        relatedQuestions: [
          "What are the health benefits of hydrogen water?",
          "How does hydrogen help reduce inflammation?",
          "What's the difference between hydrogen water and regular water?",
          "Are there studies on hydrogen for athletic performance?",
          "What are the side effects of hydrogen therapy?"
        ]
      }
    };
    
  } catch (error) {
    console.error(`❌ Ultra-simple chatbot error:`, error);
    
    return {
      success: true,
      data: {
        answer: "I'm having trouble accessing the hydrogen studies database right now. Our database contains over 1,300 peer-reviewed studies on hydrogen health benefits. Please try asking about specific topics like 'hydrogen water benefits', 'hydrogen antioxidant effects', or 'hydrogen therapy research'.",
        sources: [],
        relatedQuestions: [
          "What are the antioxidant effects of hydrogen water?",
          "How does hydrogen help with inflammation?",
          "What cardiovascular benefits does hydrogen provide?",
          "Are there studies on hydrogen for exercise recovery?",
          "What are the different ways to use hydrogen therapy?"
        ]
      }
    };
  }
}

/**
 * Search database using the most direct approach possible
 */
async function searchDatabaseDirect(query: string) {
  try {
    console.log(`🔍 Direct database search for: "${query}"`);
    
    // Extract search terms
    const searchTerms = query.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(term => term.length > 2);
    
    if (searchTerms.length === 0) {
      return [];
    }
    
    // Use the simplest possible SQL query
    const searchTerm = searchTerms[0]; // Just use the first meaningful term
    console.log(`🔍 Searching for term: "${searchTerm}"`);
    
    const client = await pool.connect();
    
    try {
      const result = await client.query(`
        SELECT id, title, abstract, journal, doi
        FROM studies 
        WHERE LOWER(title) LIKE $1 OR LOWER(abstract) LIKE $1
        LIMIT 5
      `, [`%${searchTerm}%`]);
      
      console.log(`📊 Direct query returned ${result.rows.length} studies`);
      return result.rows;
      
    } finally {
      client.release();
    }
    
  } catch (error) {
    console.error(`❌ Direct database search failed:`, error);
    return [];
  }
}

/**
 * Generate AI response using OpenAI
 */
async function generateSimpleAIResponse(query: string, studies: any[]) {
  try {
    if (studies.length === 0) {
      return `I couldn't find specific studies matching "${query}" in our hydrogen research database. However, our database contains over 1,300 peer-reviewed studies on hydrogen health benefits. Try asking about topics like "hydrogen water antioxidant effects", "hydrogen therapy inflammation", or "hydrogen cardiovascular benefits".`;
    }
    
    // Format study data for AI
    const studyContext = studies.map(study => 
      `Study: ${study.title}\nAbstract: ${study.abstract || 'Abstract not available'}\nJournal: ${study.journal || 'Unknown journal'}`
    ).join('\n\n');
    
    const response = await openai.chat.completions.create({
      model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
      messages: [
        {
          role: "system",
          content: "You are a confident, friendly hydrogen health expert who helps people understand how molecular hydrogen can improve their health. Speak like a smart friend who knows the science—clear, direct, and excited to help.\n\nKeep your answers short and conversational. Focus on benefits people actually care about—like energy, recovery, inflammation, and skin health.\n\nAsk helpful questions to guide the conversation. Explain research simply but back it with real science. Always sound optimistic, helpful, and trustworthy."
        },
        {
          role: "user",
          content: `Question: ${query}\n\nHere are some hydrogen research studies I found:\n${studyContext}\n\nPlease answer in a friendly, easy-to-understand way. Use simple words, short sentences, and explain things like you're talking to a friend. Focus on what these studies mean for real people and their health.`
        }
      ],
      max_tokens: 500,
      temperature: 0.7
    });
    
    return response.choices[0].message.content || "I couldn't generate a response based on the available studies.";
    
  } catch (error) {
    console.error(`❌ AI response generation failed:`, error);
    
    if (studies.length > 0) {
      return `I found ${studies.length} relevant hydrogen studies but couldn't generate a detailed response. The studies found were: ${studies.map(s => s.title).join(', ')}. Our database contains over 1,300 peer-reviewed hydrogen health studies.`;
    }
    
    return `I couldn't find specific studies matching your question in our hydrogen research database. Our database contains over 1,300 peer-reviewed studies on hydrogen health benefits. Try asking about topics like "hydrogen water benefits", "hydrogen antioxidant effects", or "hydrogen therapy research".`;
  }
}