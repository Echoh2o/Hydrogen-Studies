import express from 'express';
import { db } from '../db';
import { studies, healthConditions, bodySystems } from '../../shared/schema';
import { SQL, count, eq, and, sql, desc } from 'drizzle-orm';

const router = express.Router();

// Get counts for all categorization types
router.get('/counts', async (req, res) => {
  try {
    // Gather all health condition counts
    const healthConditionCounts = await db.select({
      name: healthConditions.name,
      count: count(studies.id)
    })
    .from(healthConditions)
    .leftJoin(
      studies, 
      and(
        eq(healthConditions.id, sql`ANY(${studies.healthConditions})`)
      )
    )
    .groupBy(healthConditions.name)
    .orderBy(desc(count(studies.id)));

    // Gather all body system counts
    const bodySystemCounts = await db.select({
      name: bodySystems.name,
      count: count(studies.id)
    })
    .from(bodySystems)
    .leftJoin(
      studies, 
      and(
        eq(bodySystems.id, sql`ANY(${studies.bodySystems})`)
      )
    )
    .groupBy(bodySystems.name)
    .orderBy(desc(count(studies.id)));
    
    return res.json({
      success: true,
      data: {
        condition: healthConditionCounts,
        body_system: bodySystemCounts,
        life_stage: [] // Not implemented yet
      }
    });
  } catch (error) {
    console.error('Error fetching category counts:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve category counts'
    });
  }
});

// Get studies by category (health condition, body system, or life stage)
router.get('/studies', async (req, res) => {
  try {
    const { model, category } = req.query;
    
    if (!model || !category) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters'
      });
    }
    
    let studyResults = [];
    
    // Filter based on model type
    if (model === 'condition') {
      // Get the condition ID
      const [conditionRecord] = await db
        .select()
        .from(healthConditions)
        .where(eq(healthConditions.name, category as string));
      
      if (!conditionRecord) {
        return res.status(404).json({
          success: false,
          error: 'Health condition not found'
        });
      }
      
      // Get studies with this condition
      studyResults = await db
        .select()
        .from(studies)
        .where(sql`${conditionRecord.id} = ANY(${studies.healthConditions})`)
        .limit(20);
    } 
    else if (model === 'body_system') {
      // Get the body system ID
      const [bodySystemRecord] = await db
        .select()
        .from(bodySystems)
        .where(eq(bodySystems.name, category as string));
      
      if (!bodySystemRecord) {
        return res.status(404).json({
          success: false,
          error: 'Body system not found'
        });
      }
      
      // Get studies with this body system
      studyResults = await db
        .select()
        .from(studies)
        .where(sql`${bodySystemRecord.id} = ANY(${studies.bodySystems})`)
        .limit(20);
    }
    
    return res.json({
      success: true,
      data: studyResults
    });
  } catch (error) {
    console.error('Error fetching studies by category:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve studies'
    });
  }
});

export default router;