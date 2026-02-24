/**
 * Chat API Routes
 * Handles AI-powered chat interactions for hydrogen health research
 */

import express from "express";
import { ai } from "../services/ai-provider";
import { studyService } from "../services/study-service";

const router = express.Router();

interface ChatMessage {
  role: "user" | "assistant" | "system";
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
router.post("/chat", async (req, res) => {
  try {
    const { query, conversationId } = req.body;

    if (!query || typeof query !== "string" || query.length > 1000) {
      return res.status(400).json({
        success: false,
        error: "Query is required, must be a string, and at most 1000 characters",
      });
    }

    // Search for relevant studies
    const relevantStudies = await searchRelevantStudies(query);

    // Generate AI response using ai-provider or fallback
    let aiResponse: string;
    if (ai.getProviderStatus().primary !== "none") {
      try {
        aiResponse = await generateAIResponse(query, relevantStudies);
      } catch (error) {
        console.error("Error generating AI response, using fallback:", error);
        aiResponse = generateFallbackResponse(query, relevantStudies);
      }
    } else {
      aiResponse = generateFallbackResponse(query, relevantStudies);
    }

    // Format sources from studies
    const sources = relevantStudies.slice(0, 5).map((study) => ({
      title: study.title || "Untitled Study",
      doi: study.doi || "",
      authors: study.authors || "Unknown",
      publishDate: study.publish_date || study.publication_date || "",
      journal: study.journal || "",
      id: study.id,
    }));

    // Generate related questions
    const relatedQuestions = generateRelatedQuestions(query);

    const response: ChatResponse = {
      answer: aiResponse,
      sources,
      relatedQuestions,
      conversationId: conversationId || Math.floor(Math.random() * 1000000),
      productRecommendations: generateProductRecommendations(query),
    };

    res.json({
      success: true,
      data: response,
    });
  } catch (error) {
    console.error("Chat API error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to process chat request",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Search for relevant studies based on query
async function searchRelevantStudies(query: string): Promise<any[]> {
  try {
    // Use the study service search with the query for database-level filtering
    const studiesResult = await studyService.getStudies({
      query: query,
      limit: 10,
      sortBy: "relevance",
    });
    const studies = studiesResult.data || [];

    // If query-based search returned results, use them
    if (studies.length > 0) {
      return studies;
    }

    // Fallback: get recent studies if no search matches
    const fallbackResult = await studyService.getStudies({ limit: 10, sortBy: "date" });
    return fallbackResult.data || [];
  } catch (error) {
    console.error("Error searching studies:", error);
    return [];
  }
}

// Generate fallback response when OpenAI is not available
function generateFallbackResponse(query: string, studies: any[]): string {
  if (studies.length === 0) {
    return `I found no specific studies matching your query about "${query}". \n\nHydrogen therapy is an emerging field with growing research. Please try searching with different keywords or browse our study database for more information.\n\nYou might also find our educational resources helpful for learning about hydrogen therapy basics.`;
  }

  const topStudies = studies.slice(0, 3);
  let response = `Based on our database of hydrogen research studies, here's what I found relevant to your query about "${query}":\n\n`;

  response += `📚 **Relevant Research Studies:**\n\n`;
  topStudies.forEach((study, index) => {
    response += `${index + 1}. **${study.title || "Untitled Study"}**\n`;
    if (study.authors) response += `   Authors: ${study.authors}\n`;
    if (study.abstract) {
      const shortAbstract = study.abstract.substring(0, 200);
      response += `   Summary: ${shortAbstract}...\n`;
    }
    response += "\n";
  });

  response += `\n💡 **Note:** This is a summary based on our research database. For detailed AI-powered analysis, please ensure the AI service is configured.\n\n`;
  response += `📖 We found ${studies.length} relevant studies in our database. You can explore these studies in detail through our search interface.`;

  return response;
}

// Generate AI response using ai-provider
async function generateAIResponse(
  query: string,
  studies: any[],
): Promise<string> {
  if (ai.getProviderStatus().primary === "none") {
    throw new Error("AI provider not available");
  }

  try {
    const studyContext = studies
      .slice(0, 5)
      .map(
        (study) =>
          `Study: ${study.title}\nAuthors: ${study.authors}\nAbstract: ${study.abstract?.substring(0, 300)}...\n`,
      )
      .join("\n");

    const systemPrompt = `You are a specialized AI assistant for hydrogen health research.
    Provide accurate, evidence-based answers about hydrogen therapy, hydrogen water, and molecular hydrogen health benefits.
    Always base your responses on the provided scientific studies.
    Write at a 6th grade reading level to ensure accessibility.
    Be helpful, informative, and cite the relevant studies in your response.
    Format your response with clear sections and bullet points when appropriate.`;

    const userPrompt = `Question: ${query}

    Relevant Studies:
    ${studyContext}

    Please provide a comprehensive answer based on the scientific evidence from these studies.`;

    const response = await ai.generateText(systemPrompt, userPrompt, {
      maxTokens: 1000,
      temperature: 0.7,
    });

    return (
      response ||
      "I apologize, but I could not generate a response at this time."
    );
  } catch (error) {
    console.error("AI provider error:", error);
    throw new Error("Failed to generate AI response");
  }
}

// Generate related questions based on the query
function generateRelatedQuestions(query: string): string[] {
  const queryLower = query.toLowerCase();
  const allQuestions = [
    "What are the benefits of hydrogen water for health?",
    "How does molecular hydrogen work as an antioxidant?",
    "What conditions can hydrogen therapy help with?",
    "How should hydrogen therapy be administered?",
    "Are there any side effects of hydrogen treatment?",
    "What is the recommended dosage for hydrogen water?",
    "How does hydrogen therapy compare to traditional treatments?",
    "What does the latest research say about hydrogen therapy?",
    "Can hydrogen therapy help with inflammation?",
    "Is hydrogen water safe for daily consumption?",
  ];

  // Try to provide contextually relevant questions
  const relevantQuestions: string[] = [];

  if (queryLower.includes("benefit") || queryLower.includes("help")) {
    relevantQuestions.push("What conditions can hydrogen therapy help with?");
  }
  if (queryLower.includes("safe") || queryLower.includes("side")) {
    relevantQuestions.push("Are there any side effects of hydrogen treatment?");
  }
  if (queryLower.includes("dose") || queryLower.includes("how much")) {
    relevantQuestions.push(
      "What is the recommended dosage for hydrogen water?",
    );
  }
  if (queryLower.includes("inflamm")) {
    relevantQuestions.push("Can hydrogen therapy help with inflammation?");
  }

  // Fill remaining slots with general questions
  const remainingQuestions = allQuestions.filter(
    (q) => !relevantQuestions.includes(q),
  );
  while (relevantQuestions.length < 3 && remainingQuestions.length > 0) {
    relevantQuestions.push(remainingQuestions.shift()!);
  }

  return relevantQuestions.slice(0, 3);
}

// Generate product recommendations
function generateProductRecommendations(query: string): any[] {
  return [
    {
      name: "Echo H2 Flask",
      description:
        "Portable hydrogen-infusing water bottle for on-the-go hydrogen therapy",
      url: "https://echowater.com/products/echo-h2-flask",
      imageUrl: "/images/echo-flask.jpg",
      relevanceScore: 95,
    },
    {
      name: "Echo H2 Machine",
      description: "Premium hydrogen water generator for home use",
      url: "https://echowater.com/products/echo-h2-machine",
      imageUrl: "/images/echo-machine.jpg",
      relevanceScore: 90,
    },
  ];
}

// Get popular questions
router.get("/chat/popular-questions", async (req, res) => {
  try {
    const questions = [
      "What are the benefits of hydrogen water?",
      "How does molecular hydrogen help with inflammation?",
      "Can hydrogen therapy help with diabetes?",
      "What does research say about hydrogen for athletes?",
      "Is hydrogen water safe for daily consumption?",
    ];

    res.json({
      success: true,
      data: questions,
    });
  } catch (error) {
    console.error("Error fetching popular questions:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch popular questions",
    });
  }
});

// Get conversations (placeholder for now)
router.get("/chat/conversations", async (req, res) => {
  try {
    // Return empty array for now - can be implemented with database storage
    res.json({
      success: true,
      data: [],
    });
  } catch (error) {
    console.error("Error fetching conversations:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch conversations",
    });
  }
});

// Advanced chat endpoint with additional features
router.post("/advanced-chat", async (req, res) => {
  try {
    const { query, conversationId, context } = req.body;

    if (!query || typeof query !== "string" || query.length > 1000) {
      return res.status(400).json({
        success: false,
        error: "Query is required, must be a string, and at most 1000 characters",
      });
    }

    // Search for relevant studies with enhanced scoring
    const relevantStudies = await searchRelevantStudies(query);

    // Generate AI response using ai-provider or fallback
    let aiResponse: string;
    if (ai.getProviderStatus().primary !== "none") {
      try {
        // Enhanced AI response with context
        const studyContext = relevantStudies
          .slice(0, 7)
          .map(
            (study) =>
              `Study: ${study.title}\nAuthors: ${study.authors}\nAbstract: ${study.abstract?.substring(0, 400)}...\n`,
          )
          .join("\n");

        const systemPrompt = `You are an advanced AI assistant specializing in hydrogen health research.
        Provide comprehensive, evidence-based answers about hydrogen therapy, hydrogen water, and molecular hydrogen health benefits.
        Always base your responses on the provided scientific studies.
        Write at a 6th grade reading level to ensure accessibility.
        Be thorough and include specific findings, dosages, and recommendations when available.
        Format your response with clear sections, bullet points, and emphasize key takeaways.`;

        const userPrompt = `Question: ${query}
        ${context ? `Additional Context: ${context}` : ""}

        Relevant Studies:
        ${studyContext}

        Please provide a detailed, comprehensive answer based on the scientific evidence from these studies.
        Include specific findings, recommended dosages, and practical applications where relevant.`;

        const response = await ai.generateText(systemPrompt, userPrompt, {
          maxTokens: 1500,
          temperature: 0.7,
        });

        aiResponse =
          response ||
          generateFallbackResponse(query, relevantStudies);
      } catch (error) {
        console.error(
          "Error generating advanced AI response, using fallback:",
          error,
        );
        aiResponse = generateFallbackResponse(query, relevantStudies);
      }
    } else {
      aiResponse = generateFallbackResponse(query, relevantStudies);
    }

    // Format sources from studies with more detail
    const sources = relevantStudies.slice(0, 7).map((study) => ({
      title: study.title || "Untitled Study",
      doi: study.doi || "",
      authors: study.authors || "Unknown",
      publishDate: study.publish_date || study.publication_date || "",
      journal: study.journal || "",
      abstract: study.abstract?.substring(0, 200) + "..." || "",
      id: study.id,
    }));

    // Generate contextually relevant questions
    const relatedQuestions = generateRelatedQuestions(query);

    // Enhanced product recommendations
    const productRecommendations = generateProductRecommendations(query);

    const response: ChatResponse = {
      answer: aiResponse,
      sources,
      relatedQuestions,
      conversationId: conversationId || Math.floor(Math.random() * 1000000),
      productRecommendations,
    };

    res.json({
      success: true,
      data: response,
    });
  } catch (error) {
    console.error("Advanced chat API error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to process advanced chat request",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Submit feedback
router.post("/chat/feedback", async (req, res) => {
  try {
    const { messageId, rating, comment } = req.body;

    // Log feedback for now - can be stored in database later
    console.log("Chat feedback received:", { messageId, rating, comment });

    res.json({
      success: true,
      message: "Feedback submitted successfully",
    });
  } catch (error) {
    console.error("Error submitting feedback:", error);
    res.status(500).json({
      success: false,
      error: "Failed to submit feedback",
    });
  }
});

export default router;
