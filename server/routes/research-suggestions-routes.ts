import express from 'express';
import { z } from 'zod';
import { fromZodError } from 'zod-validation-error';
import { generateResearchSuggestions } from '../research-suggestions';

const router = express.Router();

// Schema for research wizard selections validation
const wizardSelectionSchema = z.object({
  interests: z.array(z.string()).optional(),
  healthConditions: z.array(z.string()).optional(),
  demographicGroup: z.string().optional(),
  researchType: z.enum(['clinical', 'experimental', 'review', 'case-study', 'any']).optional(),
  deliveryMethod: z.array(z.string()).optional(),
  timeFrame: z.enum(['short-term', 'medium-term', 'long-term', 'any']).optional(),
  focusArea: z.enum(['physical', 'mental', 'both']).optional(),
});

// Route to generate research suggestions based on user selections
router.post('/research-suggestions', async (req, res) => {
  try {
    const selections = req.body;

    // Validate request body
    const validationResult = wizardSelectionSchema.safeParse(selections);
    if (!validationResult.success) {
      const validationError = fromZodError(validationResult.error);
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid input data', 
        errors: validationError.details 
      });
    }

    // Generate suggestions based on user selections
    const suggestions = await generateResearchSuggestions(validationResult.data);

    return res.json({
      success: true,
      data: suggestions
    });
  } catch (error) {
    console.error('Error generating research suggestions:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to generate research suggestions'
    });
  }
});

// Route to get available options for the research wizard
router.get('/research-suggestions/options', async (_req, res) => {
  try {
    // Return predefined options for the wizard
    return res.json({
      success: true,
      data: {
        interests: [
          'Inflammation reduction',
          'Oxidative stress',
          'Athletic performance',
          'Metabolic health',
          'Neurological benefits',
          'Gut health',
          'Cardiovascular health',
          'Skin health'
        ],
        healthConditions: [
          'Diabetes',
          'Hypertension',
          'Arthritis',
          'Neurodegenerative disorders',
          'Metabolic syndrome',
          'Inflammatory bowel disease',
          'Skin conditions',
          'Respiratory conditions',
          'Post-exercise recovery',
          'Chronic fatigue'
        ],
        demographicGroups: [
          'Children',
          'Adolescents',
          'Adults',
          'Elderly',
          'Athletes',
          'Pregnant women',
          'People with chronic conditions'
        ],
        researchTypes: [
          'clinical',
          'experimental',
          'review',
          'case-study',
          'any'
        ],
        deliveryMethods: [
          'Hydrogen-rich water',
          'Hydrogen gas inhalation',
          'Hydrogen-rich saline',
          'Hydrogen bathing',
          'Hydrogen tablets',
          'Topical hydrogen application',
          'Hydrogen-producing intestinal bacteria'
        ],
        timeFrames: [
          'short-term',
          'medium-term',
          'long-term',
          'any'
        ],
        focusAreas: [
          'physical',
          'mental',
          'both'
        ]
      }
    });
  } catch (error) {
    console.error('Error fetching research wizard options:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch research wizard options'
    });
  }
});

export default router;