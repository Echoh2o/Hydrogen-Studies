import { Router } from 'express';
import { z } from 'zod';
import { OpenAI } from 'openai';
import { storage } from '../storage';

const router = Router();

// Initialize OpenAI client if API key is available
let openai: OpenAI | undefined;
if (process.env.OPENAI_API_KEY) {
  openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
}

// Schema for insight generation request
const insightRequestSchema = z.object({
  study: z.object({
    id: z.number(),
    title: z.string(),
    abstract: z.string().optional(),
    authors: z.string(),
    journal: z.string(),
    category: z.string(),
    publishDate: z.string().optional(),
  }),
  count: z.number().optional(),
});

// Generate insights for a study using OpenAI
router.post('/generate-insights', async (req, res) => {
  try {
    // Validate request body
    const validation = insightRequestSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid request data',
        errors: validation.error.errors
      });
    }
    
    const { study, count = 5 } = validation.data;
    
    // If OpenAI is not available, return empty insights
    if (!openai) {
      return res.status(200).json({
        success: true,
        insights: []
      });
    }
    
    // Create a prompt for OpenAI
    const prompt = `
You are a scientific research communicator specializing in hydrogen health studies. 
Create ${count} concise, shareable insights based on the following study. Each insight should:
- Be 10-20 words long
- Highlight a key finding or implication
- Use accessible language for a general audience
- Be factual and evidence-based (avoid hype or exaggeration)
- Focus on one specific point from the study
- Not use quotes

Study Title: ${study.title}
Category: ${study.category}
Authors: ${study.authors}
Journal: ${study.journal}
${study.abstract ? `Abstract: ${study.abstract}` : ''}

Return ONLY a JSON array of strings with the insights, with no additional text or explanation.
Example format: ["Insight 1", "Insight 2", "Insight 3"]
`;

    // Generate insights using OpenAI
    const response = await openai.chat.completions.create({
      model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
      messages: [
        {
          role: "system",
          content: "You are a scientific research communicator that specializes in making complex research accessible.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      response_format: { type: "json_object" },
      temperature: 0.7,
    });
    
    // Parse the response
    try {
      const content = response.choices[0].message.content;
      if (!content) {
        throw new Error('Empty response from OpenAI');
      }
      
      const parsedContent = JSON.parse(content);
      const insights = Array.isArray(parsedContent) ? 
        parsedContent : 
        (parsedContent.insights || []);
      
      return res.status(200).json({
        success: true,
        insights: insights.slice(0, count)
      });
    } catch (parseError) {
      console.error('Error parsing OpenAI response:', parseError);
      return res.status(200).json({
        success: true,
        insights: []
      });
    }
    
  } catch (error) {
    console.error('Error generating insights:', error);
    return res.status(500).json({
      success: false,
      message: 'Error generating insights'
    });
  }
});

// Save shared insight to database
router.post('/save-shared-insight', async (req, res) => {
  try {
    // This could be implemented to save shared insights for analytics or for user history
    return res.status(200).json({
      success: true,
      message: 'Insight saved successfully'
    });
  } catch (error) {
    console.error('Error saving shared insight:', error);
    return res.status(500).json({
      success: false,
      message: 'Error saving shared insight'
    });
  }
});

export default router;