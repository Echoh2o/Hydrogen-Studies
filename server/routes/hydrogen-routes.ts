import { Router, Request, Response } from 'express';
import { db } from '../db';
import { studies } from '@shared/schema';
import { 
  benefits, 
  demographics, 
  mechanisms, 
  deliveryMethods, 
  durationCategories,
  studyBenefits,
  studyDemographics,
  studyMechanisms,
  studyDeliveryMethods,
  studyDurations,
  studyOutcomes
} from '@shared/schema-hydrogen-fields';
import { eq, sql } from 'drizzle-orm';

const router = Router();

/**
 * Get all benefits
 */
router.get('/api/benefits', async (_req: Request, res: Response) => {
  try {
    const allBenefits = await db.select().from(benefits).orderBy(benefits.displayOrder);
    res.json(allBenefits);
  } catch (error) {
    console.error('Error fetching benefits:', error);
    res.status(500).json({ error: 'Failed to fetch benefits' });
  }
});

/**
 * Get benefit by slug
 */
router.get('/api/benefits/:slug', async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;
    
    const [benefit] = await db.select().from(benefits).where(eq(benefits.slug, slug));
    
    if (!benefit) {
      return res.status(404).json({ error: 'Benefit not found' });
    }
    
    res.json(benefit);
  } catch (error) {
    console.error(`Error fetching benefit with slug ${req.params.slug}:`, error);
    res.status(500).json({ error: 'Failed to fetch benefit' });
  }
});

/**
 * Get studies by benefit
 */
router.get('/api/benefits/:slug/studies', async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;
    
    const [benefit] = await db.select().from(benefits).where(eq(benefits.slug, slug));
    
    if (!benefit) {
      return res.status(404).json({ error: 'Benefit not found' });
    }
    
    const studiesWithBenefit = await db
      .select({
        study: studies,
        benefitId: studyBenefits.benefitId
      })
      .from(studies)
      .innerJoin(studyBenefits, eq(studies.id, studyBenefits.studyId))
      .where(eq(studyBenefits.benefitId, benefit.id));
    
    // Extract just the study data
    const result = studiesWithBenefit.map(item => item.study);
    
    res.json({
      benefit,
      studies: result
    });
  } catch (error) {
    console.error(`Error fetching studies for benefit ${req.params.slug}:`, error);
    res.status(500).json({ error: 'Failed to fetch studies' });
  }
});

/**
 * Get all demographics
 */
router.get('/api/demographics', async (_req: Request, res: Response) => {
  try {
    const allDemographics = await db.select().from(demographics).orderBy(demographics.displayOrder);
    res.json(allDemographics);
  } catch (error) {
    console.error('Error fetching demographics:', error);
    res.status(500).json({ error: 'Failed to fetch demographics' });
  }
});

/**
 * Get demographic by slug
 */
router.get('/api/demographics/:slug', async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;
    
    const [demographic] = await db.select().from(demographics).where(eq(demographics.slug, slug));
    
    if (!demographic) {
      return res.status(404).json({ error: 'Demographic not found' });
    }
    
    res.json(demographic);
  } catch (error) {
    console.error(`Error fetching demographic with slug ${req.params.slug}:`, error);
    res.status(500).json({ error: 'Failed to fetch demographic' });
  }
});

/**
 * Get studies by demographic
 */
router.get('/api/demographics/:slug/studies', async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;
    
    const [demographic] = await db.select().from(demographics).where(eq(demographics.slug, slug));
    
    if (!demographic) {
      return res.status(404).json({ error: 'Demographic not found' });
    }
    
    const studiesWithDemographic = await db
      .select({
        study: studies,
        demographicId: studyDemographics.demographicId
      })
      .from(studies)
      .innerJoin(studyDemographics, eq(studies.id, studyDemographics.studyId))
      .where(eq(studyDemographics.demographicId, demographic.id));
    
    // Extract just the study data
    const result = studiesWithDemographic.map(item => item.study);
    
    res.json({
      demographic,
      studies: result
    });
  } catch (error) {
    console.error(`Error fetching studies for demographic ${req.params.slug}:`, error);
    res.status(500).json({ error: 'Failed to fetch studies' });
  }
});

/**
 * Get all mechanisms
 */
router.get('/api/mechanisms', async (_req: Request, res: Response) => {
  try {
    const allMechanisms = await db.select().from(mechanisms).orderBy(mechanisms.displayOrder);
    res.json(allMechanisms);
  } catch (error) {
    console.error('Error fetching mechanisms:', error);
    res.status(500).json({ error: 'Failed to fetch mechanisms' });
  }
});

/**
 * Get mechanism by slug
 */
router.get('/api/mechanisms/:slug', async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;
    
    const [mechanism] = await db.select().from(mechanisms).where(eq(mechanisms.slug, slug));
    
    if (!mechanism) {
      return res.status(404).json({ error: 'Mechanism not found' });
    }
    
    res.json(mechanism);
  } catch (error) {
    console.error(`Error fetching mechanism with slug ${req.params.slug}:`, error);
    res.status(500).json({ error: 'Failed to fetch mechanism' });
  }
});

/**
 * Get studies by mechanism
 */
router.get('/api/mechanisms/:slug/studies', async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;
    
    const [mechanism] = await db.select().from(mechanisms).where(eq(mechanisms.slug, slug));
    
    if (!mechanism) {
      return res.status(404).json({ error: 'Mechanism not found' });
    }
    
    const studiesWithMechanism = await db
      .select({
        study: studies,
        mechanismId: studyMechanisms.mechanismId
      })
      .from(studies)
      .innerJoin(studyMechanisms, eq(studies.id, studyMechanisms.studyId))
      .where(eq(studyMechanisms.mechanismId, mechanism.id));
    
    // Extract just the study data
    const result = studiesWithMechanism.map(item => item.study);
    
    res.json({
      mechanism,
      studies: result
    });
  } catch (error) {
    console.error(`Error fetching studies for mechanism ${req.params.slug}:`, error);
    res.status(500).json({ error: 'Failed to fetch studies' });
  }
});

/**
 * Get all delivery methods
 */
router.get('/api/delivery-methods', async (_req: Request, res: Response) => {
  try {
    const allDeliveryMethods = await db.select().from(deliveryMethods).orderBy(deliveryMethods.displayOrder);
    res.json(allDeliveryMethods);
  } catch (error) {
    console.error('Error fetching delivery methods:', error);
    res.status(500).json({ error: 'Failed to fetch delivery methods' });
  }
});

/**
 * Get delivery method by slug
 */
router.get('/api/delivery-methods/:slug', async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;
    
    const [deliveryMethod] = await db.select().from(deliveryMethods).where(eq(deliveryMethods.slug, slug));
    
    if (!deliveryMethod) {
      return res.status(404).json({ error: 'Delivery method not found' });
    }
    
    res.json(deliveryMethod);
  } catch (error) {
    console.error(`Error fetching delivery method with slug ${req.params.slug}:`, error);
    res.status(500).json({ error: 'Failed to fetch delivery method' });
  }
});

/**
 * Get studies by delivery method
 */
router.get('/api/delivery-methods/:slug/studies', async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;
    
    const [deliveryMethod] = await db.select().from(deliveryMethods).where(eq(deliveryMethods.slug, slug));
    
    if (!deliveryMethod) {
      return res.status(404).json({ error: 'Delivery method not found' });
    }
    
    const studiesWithDeliveryMethod = await db
      .select({
        study: studies,
        deliveryMethodId: studyDeliveryMethods.deliveryMethodId
      })
      .from(studies)
      .innerJoin(studyDeliveryMethods, eq(studies.id, studyDeliveryMethods.studyId))
      .where(eq(studyDeliveryMethods.deliveryMethodId, deliveryMethod.id));
    
    // Extract just the study data
    const result = studiesWithDeliveryMethod.map(item => item.study);
    
    res.json({
      deliveryMethod,
      studies: result
    });
  } catch (error) {
    console.error(`Error fetching studies for delivery method ${req.params.slug}:`, error);
    res.status(500).json({ error: 'Failed to fetch studies' });
  }
});

/**
 * Get all duration categories
 */
router.get('/api/duration-categories', async (_req: Request, res: Response) => {
  try {
    const allDurationCategories = await db.select().from(durationCategories).orderBy(durationCategories.displayOrder);
    res.json(allDurationCategories);
  } catch (error) {
    console.error('Error fetching duration categories:', error);
    res.status(500).json({ error: 'Failed to fetch duration categories' });
  }
});

/**
 * Get study outcome (consumer-friendly summary)
 */
router.get('/api/studies/:id/outcome', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const studyId = parseInt(id);
    
    if (isNaN(studyId)) {
      return res.status(400).json({ error: 'Invalid study ID' });
    }
    
    const [outcome] = await db.select().from(studyOutcomes).where(eq(studyOutcomes.studyId, studyId));
    
    if (!outcome) {
      return res.status(404).json({ error: 'Study outcome not found' });
    }
    
    res.json(outcome);
  } catch (error) {
    console.error(`Error fetching outcome for study ${req.params.id}:`, error);
    res.status(500).json({ error: 'Failed to fetch study outcome' });
  }
});

/**
 * Get study tags (all associated categories)
 */
router.get('/api/studies/:id/tags', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const studyId = parseInt(id);
    
    if (isNaN(studyId)) {
      return res.status(400).json({ error: 'Invalid study ID' });
    }
    
    // Get all the associated tags for this study from all the different categories
    const studyBenefitData = await db
      .select({
        benefit: benefits
      })
      .from(studyBenefits)
      .innerJoin(benefits, eq(studyBenefits.benefitId, benefits.id))
      .where(eq(studyBenefits.studyId, studyId));
    
    const studyDemographicData = await db
      .select({
        demographic: demographics
      })
      .from(studyDemographics)
      .innerJoin(demographics, eq(studyDemographics.demographicId, demographics.id))
      .where(eq(studyDemographics.studyId, studyId));
    
    const studyMechanismData = await db
      .select({
        mechanism: mechanisms
      })
      .from(studyMechanisms)
      .innerJoin(mechanisms, eq(studyMechanisms.mechanismId, mechanisms.id))
      .where(eq(studyMechanisms.studyId, studyId));
    
    const studyDeliveryMethodData = await db
      .select({
        deliveryMethod: deliveryMethods
      })
      .from(studyDeliveryMethods)
      .innerJoin(deliveryMethods, eq(studyDeliveryMethods.deliveryMethodId, deliveryMethods.id))
      .where(eq(studyDeliveryMethods.studyId, studyId));
    
    const studyDurationData = await db
      .select({
        durationCategory: durationCategories
      })
      .from(studyDurations)
      .innerJoin(durationCategories, eq(studyDurations.durationCategoryId, durationCategories.id))
      .where(eq(studyDurations.studyId, studyId));
    
    res.json({
      benefits: studyBenefitData.map(item => item.benefit),
      demographics: studyDemographicData.map(item => item.demographic),
      mechanisms: studyMechanismData.map(item => item.mechanism),
      deliveryMethods: studyDeliveryMethodData.map(item => item.deliveryMethod),
      durationCategories: studyDurationData.map(item => item.durationCategory)
    });
  } catch (error) {
    console.error(`Error fetching tags for study ${req.params.id}:`, error);
    res.status(500).json({ error: 'Failed to fetch study tags' });
  }
});

export default router;