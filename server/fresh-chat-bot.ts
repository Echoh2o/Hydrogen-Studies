import { db } from './db';
import { studies } from '../shared/schema';
import { ilike, or } from 'drizzle-orm';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Fresh, reliable chatbot that always searches your hydrogen studies database
 */
export async function generateFreshChatResponse(query: string) {
  console.log(`🔍 Searching hydrogen studies for: "${query}"`);
  
  try {
    // Step 1: Search your hydrogen studies database
    const searchResults = await searchHydrogenDatabase(query);
    console.log(`✅ Found ${searchResults.length} relevant hydrogen studies`);
    
    if (searchResults.length === 0) {
      console.log(`❌ No studies found, returning helpful message`);
      return {
        answer: "I couldn't find specific studies in our hydrogen research database that match your question. Try asking about topics like 'hydrogen water antioxidant effects', 'hydrogen therapy inflammation', or 'hydrogen cardiovascular benefits'. Our database contains over 1,300 peer-reviewed hydrogen health studies.",
        sources: [],
        relatedQuestions: [
          "What are the antioxidant effects of hydrogen water?",
          "How does hydrogen help reduce inflammation?",
          "What cardiovascular benefits does hydrogen provide?",
          "Are there studies on hydrogen for athletic performance?",
          "What are the different ways to use hydrogen therapy?"
        ]
      };
    }

    // Step 2: Generate AI response using your studies
    console.log(`🤖 Generating AI response using ${searchResults.length} studies`);
    const aiAnswer = await generateAIResponse(query, searchResults);
    
    // Step 3: Format sources from your database
    const sources = searchResults.map(study => ({
      title: study.title,
      authors: study.authors || "Authors not specified",
      journal: study.journal || "Journal not specified", 
      publishDate: study.publishDate || "Date not specified",
      doi: study.doi || "DOI not available"
    }));

    console.log(`✅ Generated complete response with ${sources.length} study citations`);
    
    return {
      answer: aiAnswer,
      sources: sources,
      relatedQuestions: [
        "What other hydrogen health benefits are documented?",
        "How does hydrogen compare to other antioxidants?", 
        "What's the optimal dosage for hydrogen therapy?",
        "Are there any side effects of hydrogen treatment?",
        "Which delivery method is most effective?"
      ]
    };
    
  } catch (error) {
    console.error(`❌ Error in fresh chatbot:`, error);
    
    // Even if AI fails, try to return your study data directly
    try {
      const emergencyResults = await searchHydrogenDatabase(query);
      if (emergencyResults.length > 0) {
        console.log(`🔄 AI failed but found ${emergencyResults.length} studies, returning direct results`);
        
        const directAnswer = `I found ${emergencyResults.length} relevant studies in our hydrogen research database:\n\n` +
          emergencyResults.map((study, index) => 
            `${index + 1}. **${study.title}**\n` +
            `   Authors: ${study.authors || 'Not specified'}\n` +
            `   Journal: ${study.journal || 'Not specified'}\n` +
            `   ${study.abstract ? study.abstract.substring(0, 200) + '...' : 'Abstract not available'}\n`
          ).join('\n');

        return {
          answer: directAnswer,
          sources: emergencyResults.map(study => ({
            title: study.title,
            authors: study.authors || "Authors not specified",
            journal: study.journal || "Journal not specified",
            publishDate: study.publishDate || "Date not specified", 
            doi: study.doi || "DOI not available"
          })),
          relatedQuestions: [
            "What are the main benefits of hydrogen therapy?",
            "How does molecular hydrogen work in the body?",
            "What are the different hydrogen delivery methods?"
          ]
        };
      }
    } catch (searchError) {
      console.error(`❌ Emergency search also failed:`, searchError);
    }

    return {
      answer: "I'm experiencing technical difficulties accessing the research database. Please try your question again in a moment.",
      sources: [],
      relatedQuestions: []
    };
  }
}

/**
 * Search your hydrogen studies database with comprehensive matching
 */
async function searchHydrogenDatabase(query: string, limit: number = 5) {
  try {
    // Use a simple SQL approach that works with your database
    const searchTerm = `%${query.toLowerCase()}%`;
    
    console.log(`🔍 Searching for: "${query}"`);

    const results = await db
      .select({
        id: studies.id,
        title: studies.title,
        abstract: studies.abstract,
        authors: studies.authors,
        journal: studies.journal,
        publishDate: studies.publishDate,
        doi: studies.doi,
        category: studies.category
      })
      .from(studies)
      .where(
        or(
          ilike(studies.title, searchTerm),
          ilike(studies.abstract, searchTerm),
          ilike(studies.category, searchTerm)
        )
      )
      .limit(limit);

    console.log(`📊 Database returned ${results.length} studies`);
    return results;
    
  } catch (error) {
    console.error(`❌ Database search error:`, error);
    return [];
  }
}

/**
 * Generate AI response using OpenAI and your study data
 */
async function generateAIResponse(query: string, studies: any[]) {
  try {
    const studyContext = studies.map(study => `
**Study:** ${study.title}
**Authors:** ${study.authors || 'Not specified'}
**Journal:** ${study.journal || 'Not specified'}
**Published:** ${study.publishDate || 'Not specified'}
**Abstract:** ${study.abstract || 'No abstract available'}
**Health Conditions:** ${study.healthConditions || 'Not specified'}
**DOI:** ${study.doi || 'Not available'}
`).join('\n---\n');

    const response = await openai.chat.completions.create({
      model: 'gpt-4o', // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
      messages: [
        {
          role: 'system',
          content: `You are an expert hydrogen health research assistant. Answer questions based ONLY on the provided hydrogen research studies. Be accurate, cite specific studies, and focus on health applications of hydrogen (drinking hydrogen water, inhaling hydrogen gas, hydrogen baths) - not energy applications. Provide detailed, scientific answers with proper study citations.`
        },
        {
          role: 'user', 
          content: `Based on these hydrogen health studies, please answer this question: ${query}

Available Research Studies:
${studyContext}

Please provide a comprehensive answer citing the relevant studies and their specific findings.`
        }
      ],
      max_tokens: 1000,
      temperature: 0.2
    });

    return response.choices[0].message.content || "Unable to generate response from the available studies.";
    
  } catch (aiError) {
    console.error(`❌ OpenAI API error:`, aiError);
    throw aiError;
  }
}