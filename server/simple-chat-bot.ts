import { db } from './db';
import { studies } from '../shared/schema';
import { ilike, or } from 'drizzle-orm';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Simple, reliable chat response generator that always searches your hydrogen studies database
 */
export async function generateSimpleChatResponse(
  userQuery: string,
  conversationId?: number,
  userId?: number
) {
  try {
    console.log(`Searching hydrogen studies for: "${userQuery}"`);
    
    // 1. Search your hydrogen studies database
    const relevantStudies = await searchHydrogenStudies(userQuery, 5);
    console.log(`Found ${relevantStudies.length} relevant studies`);
    
    if (relevantStudies.length === 0) {
      return {
        answer: "I couldn't find any specific studies in our hydrogen research database that match your question. Could you try rephrasing your question or ask about topics like inflammation, antioxidant effects, cardiovascular health, or hydrogen water benefits?",
        sources: [],
        relatedQuestions: [
          "What are the antioxidant effects of hydrogen water?",
          "How does hydrogen help with inflammation?",
          "What cardiovascular benefits does hydrogen provide?",
          "Are there studies on hydrogen water for athletes?",
          "What are the safety considerations for hydrogen therapy?"
        ],
        conversationId
      };
    }

    // 2. Create study-based context
    const studyContext = relevantStudies.map(study => `
Study: ${study.title}
Authors: ${study.authors || 'Not specified'}
Journal: ${study.journal || 'Not specified'}
Year: ${study.publishDate || 'Not specified'}
Abstract: ${study.abstract || 'No abstract available'}
Health Conditions: ${study.healthConditions || 'Not specified'}
DOI: ${study.doi || 'Not available'}
`).join('\n---\n');

    // 3. Generate AI response using OpenAI
    const aiResponse = await openai.chat.completions.create({
      model: 'gpt-4o', // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
      messages: [
        {
          role: 'system',
          content: `You are an expert hydrogen health research assistant. Answer questions based ONLY on the provided hydrogen studies. Be accurate and cite specific studies when making claims. Focus on health applications of hydrogen (drinking hydrogen water, inhaling hydrogen gas, hydrogen baths) - not energy or fuel cells.`
        },
        {
          role: 'user',
          content: `Question: ${userQuery}

Available hydrogen studies:
${studyContext}

Please answer the question based on these studies. Include specific study citations and be clear about what the research shows.`
        }
      ],
      max_tokens: 800,
      temperature: 0.3
    });

    const answer = aiResponse.choices[0].message.content || "I couldn't generate a response based on the available studies.";

    // 4. Format sources
    const sources = relevantStudies.map(study => ({
      title: study.title,
      authors: study.authors || "Not specified",
      journal: study.journal || "Not specified",
      publishDate: study.publishDate || "Not specified",
      doi: study.doi || "No DOI available"
    }));

    // 5. Generate related questions
    const relatedQuestions = [
      "What other health benefits does hydrogen provide?",
      "Are there any side effects of hydrogen therapy?",
      "How does hydrogen compare to other antioxidants?",
      "What's the optimal dosage for hydrogen water?",
      "Which delivery method is most effective?"
    ];

    return {
      answer,
      sources,
      relatedQuestions,
      conversationId
    };

  } catch (error) {
    console.error('Error in simple chat response:', error);
    
    // Even if AI fails, try to return study data
    try {
      const emergencyStudies = await searchHydrogenStudies(userQuery, 3);
      if (emergencyStudies.length > 0) {
        const simpleAnswer = `I found ${emergencyStudies.length} relevant studies in our hydrogen research database:\n\n` +
          emergencyStudies.map(study => 
            `• ${study.title}\n  Authors: ${study.authors || 'Not specified'}\n  ${study.abstract?.substring(0, 200) || 'No abstract available'}...`
          ).join('\n\n');

        return {
          answer: simpleAnswer,
          sources: emergencyStudies.map(study => ({
            title: study.title,
            authors: study.authors || "Not specified",
            journal: study.journal || "Not specified",
            publishDate: study.publishDate || "Not specified",
            doi: study.doi || "No DOI available"
          })),
          relatedQuestions: [
            "What are the main benefits of hydrogen therapy?",
            "How does hydrogen work in the body?",
            "What are the different ways to use hydrogen?"
          ],
          conversationId
        };
      }
    } catch (searchError) {
      console.error('Emergency search also failed:', searchError);
    }

    return {
      answer: "I'm experiencing technical difficulties accessing the research database. Please try again in a moment.",
      sources: [],
      relatedQuestions: [],
      conversationId
    };
  }
}

/**
 * Search your hydrogen studies database
 */
async function searchHydrogenStudies(query: string, limit: number = 5) {
  try {
    const searchTerms = query.toLowerCase().split(' ').filter(word => word.length > 2);
    
    // Create search conditions for each term
    const searchConditions = searchTerms.flatMap(term => [
      ilike(studies.title, `%${term}%`),
      ilike(studies.abstract, `%${term}%`),
      ilike(studies.healthConditions, `%${term}%`),
      ilike(studies.category, `%${term}%`),
      ilike(studies.keywords, `%${term}%`)
    ]);

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
      .where(or(...searchConditions))
      .limit(limit);

    return results;
  } catch (error) {
    console.error('Error searching studies:', error);
    return [];
  }
}