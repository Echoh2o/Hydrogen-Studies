/**
 * Chat API Routes
 * Handles AI-powered chat interactions for hydrogen health research
 */

import express from 'express';
import OpenAI from 'openai';
import { storage } from '../storage';

const router = express.Router();

// Initialize OpenAI client
let openai: OpenAI | null = null;

try {
  if (process.env.OPENAI_API_KEY) {
    openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }
} catch (error) {
  console.error('Failed to initialize OpenAI client:', error);
}

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  id?: number;
  timestamp?: Date;
}

interface ChatResponse {
  answer: string;
  sources: any[];
  relatedQuestions: string[];
  conversationId?: number;
  productRecommendations?: any[];
}

// Main chat endpoint
router.post('/chat', async (req, res) => {
  try {
    const { query, conversationId } = req.body;

    if (!query || typeof query !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Query is required and must be a string'
      });
    }

    // Check if OpenAI is available
    if (!openai) {
      return res.status(503).json({
        success: false,
        error: 'AI service is currently unavailable. Please check API configuration.',
        fallback: true
      });
    }

    console.log('Processing chat query:', query);

    // Search for relevant studies
    const relevantStudies = await searchRelevantStudies(query);
    console.log(`Found ${relevantStudies.length} relevant studies`);

    // Generate AI response using OpenAI
    const aiResponse = await generateAIResponse(query, relevantStudies);

    // Format sources from studies
    const sources = relevantStudies.slice(0, 5).map(study => ({
      title: study.title || 'Untitled Study',
      doi: study.doi || '',
      authors: study.authors || 'Unknown',
      publishDate: study.publish_date || study.publication_date || '',
      journal: study.journal || '',
      id: study.id
    }));

    // Generate related questions
    const relatedQuestions = generateRelatedQuestions(query);

    const response: ChatResponse = {
      answer: aiResponse,
      sources,
      relatedQuestions,
      conversationId: conversationId || Math.floor(Math.random() * 1000000),
      productRecommendations: generateProductRecommendations(query)
    };

    res.json({
      success: true,
      data: response
    });

  } catch (error) {
    console.error('Chat API error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process chat request',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Search for relevant studies based on query
async function searchRelevantStudies(query: string): Promise<any[]> {
  try {
    const studiesResult = await storage.getStudies();
    const studies = studiesResult.data || [];
    const searchTerms = query.toLowerCase().split(/\s+/);
    
    const scoredStudies = studies.map((study: any) => {
      let score = 0;
      const searchableText = [
        study.title,
        study.abstract,
        study.keywords,
        study.methods,
        study.results,
        study.conclusions
      ].join(' ').toLowerCase();

      // Score based on term matches
      searchTerms.forEach(term => {
        const matches = (searchableText.match(new RegExp(term, 'g')) || []).length;
        score += matches;
      });

      return { ...study, relevanceScore: score };
    });

    // Return top 10 most relevant studies
    return scoredStudies
      .filter((study: any) => study.relevanceScore > 0)
      .sort((a: any, b: any) => b.relevanceScore - a.relevanceScore)
      .slice(0, 10);
      
  } catch (error) {
    console.error('Error searching studies:', error);
    return [];
  }
}

// Generate AI response using OpenAI
async function generateAIResponse(query: string, studies: any[]): Promise<string> {
  if (!openai) {
    throw new Error('OpenAI client not available');
  }

  try {
    const studyContext = studies.slice(0, 5).map(study => 
      `Study: ${study.title}\nAuthors: ${study.authors}\nAbstract: ${study.abstract?.substring(0, 300)}...\n`
    ).join('\n');

    const systemPrompt = `You are a specialized AI assistant for hydrogen health research. 
    Provide accurate, evidence-based answers about hydrogen therapy, hydrogen water, and molecular hydrogen health benefits.
    Always base your responses on the provided scientific studies.
    Be helpful, informative, and cite the relevant studies in your response.`;

    const userPrompt = `Question: ${query}

    Relevant Studies:
    ${studyContext}

    Please provide a comprehensive answer based on the scientific evidence from these studies.`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      max_tokens: 1000,
      temperature: 0.7
    });

    return completion.choices[0]?.message?.content || 'I apologize, but I could not generate a response at this time.';
    
  } catch (error) {
    console.error('OpenAI API error:', error);
    throw new Error('Failed to generate AI response');
  }
}

// Generate related questions
function generateRelatedQuestions(query: string): string[] {
  const questions = [
    "What are the benefits of hydrogen water for health?",
    "How does molecular hydrogen work as an antioxidant?",
    "What conditions can hydrogen therapy help with?",
    "How should hydrogen therapy be administered?",
    "Are there any side effects of hydrogen treatment?"
  ];

  return questions.slice(0, 3);
}

// Generate product recommendations
function generateProductRecommendations(query: string): any[] {
  return [
    {
      name: "Echo H2 Flask",
      description: "Portable hydrogen-infusing water bottle for on-the-go hydrogen therapy",
      url: "https://echowater.com/products/echo-h2-flask",
      imageUrl: "/images/echo-flask.jpg",
      relevanceScore: 95
    },
    {
      name: "Echo H2 Machine",
      description: "Premium hydrogen water generator for home use",
      url: "https://echowater.com/products/echo-h2-machine",
      imageUrl: "/images/echo-machine.jpg",
      relevanceScore: 90
    }
  ];
}

// Get popular questions
router.get('/chat/popular-questions', async (req, res) => {
  try {
    const questions = [
      "What are the benefits of hydrogen water?",
      "How does molecular hydrogen help with inflammation?",
      "Can hydrogen therapy help with diabetes?",
      "What does research say about hydrogen for athletes?",
      "Is hydrogen water safe for daily consumption?"
    ];

    res.json({
      success: true,
      data: questions
    });
  } catch (error) {
    console.error('Error fetching popular questions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch popular questions'
    });
  }
});

// Get conversations (placeholder for now)
router.get('/chat/conversations', async (req, res) => {
  try {
    // Return empty array for now - can be implemented with database storage
    res.json({
      success: true,
      data: []
    });
  } catch (error) {
    console.error('Error fetching conversations:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch conversations'
    });
  }
});

// Submit feedback
router.post('/chat/feedback', async (req, res) => {
  try {
    const { messageId, rating, comment } = req.body;
    
    // Log feedback for now - can be stored in database later
    console.log('Chat feedback received:', { messageId, rating, comment });
    
    res.json({
      success: true,
      message: 'Feedback submitted successfully'
    });
  } catch (error) {
    console.error('Error submitting feedback:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to submit feedback'
    });
  }
});

export default router;