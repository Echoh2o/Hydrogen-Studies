/**
 * Research Suggestions Routes
 * 
 * API endpoints for the AI-powered research suggestion wizard
 */

import express from "express";
import { 
  generateResearchSuggestions, 
  getSuggestedSearchTerms, 
  getWizardSteps,
  type ResearchSuggestionParams
} from "../research-suggestions";
import { ZodError, z } from "zod";
import { fromZodError } from "zod-validation-error";

const router = express.Router();

// Input validation schema
const suggestionParamsSchema = z.object({
  interests: z.array(z.string()).optional(),
  healthConditions: z.array(z.string()).optional(),
  demographicGroups: z.array(z.string()).optional(),
  researchPurpose: z.enum(['academic', 'personal_health', 'clinical', 'general_interest']).optional(),
  preferredTopics: z.array(z.string()).optional(),
  includeRecentOnly: z.boolean().optional(),
  preferPeerReviewed: z.boolean().optional(),
  suggestionType: z.enum([
    'research_gaps', 
    'trending_topics', 
    'personal_health', 
    'application_methods', 
    'popular_questions'
  ]),
  userQuery: z.string().optional()
});

// Get wizard configuration steps
router.get("/wizard-steps", async (req, res) => {
  try {
    const steps = getWizardSteps();
    res.json(steps);
  } catch (error) {
    console.error("Error fetching wizard steps:", error);
    res.status(500).json({ message: "Failed to fetch wizard steps" });
  }
});

// Generate research suggestions
router.post("/generate", async (req, res) => {
  try {
    // Validate input
    const params = suggestionParamsSchema.parse(req.body);
    
    // Check if OpenAI API key is available
    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ 
        message: "OpenAI API key is missing. Please provide an API key to use this feature." 
      });
    }
    
    // Generate suggestions
    const suggestions = await generateResearchSuggestions(params);
    
    // Return the results
    res.json({
      suggestions,
      searchTerms: getSuggestedSearchTerms(params)
    });
  } catch (error) {
    console.error("Error generating research suggestions:", error);
    
    if (error instanceof ZodError) {
      const validationError = fromZodError(error);
      return res.status(400).json({ 
        message: "Invalid request parameters", 
        errors: validationError.details 
      });
    }
    
    res.status(500).json({ message: "Failed to generate research suggestions" });
  }
});

// Get suggested search terms
router.post("/search-terms", async (req, res) => {
  try {
    // Validate input
    const params = suggestionParamsSchema.parse(req.body);
    
    // Generate search terms
    const searchTerms = getSuggestedSearchTerms(params);
    
    // Return the results
    res.json({ searchTerms });
  } catch (error) {
    console.error("Error generating search terms:", error);
    
    if (error instanceof ZodError) {
      const validationError = fromZodError(error);
      return res.status(400).json({ 
        message: "Invalid request parameters", 
        errors: validationError.details 
      });
    }
    
    res.status(500).json({ message: "Failed to generate search terms" });
  }
});

export default router;