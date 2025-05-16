/**
 * Update schema to support health conditions and body systems
 */
import { 
  studies,
  type InsertStudy,
  type Study
} from "@shared/schema";
import { db } from "./db";

export async function updateSchemaWithHealthFields() {
  try {
    console.log("Adding health condition and body system fields to studies table...");
    
    // Add health conditions and body systems fields to studies table if they don't exist
    await db.execute(`
      ALTER TABLE studies 
      ADD COLUMN IF NOT EXISTS health_conditions TEXT,
      ADD COLUMN IF NOT EXISTS body_systems TEXT
    `);
    
    console.log("Successfully added health conditions and body systems fields");
    
    // Add keywords field for enhanced search functionality
    await db.execute(`
      ALTER TABLE studies 
      ADD COLUMN IF NOT EXISTS keywords TEXT[]
    `);
    
    console.log("Successfully added keywords array field");
    
    // Update duration field to accept null values
    await db.execute(`
      ALTER TABLE studies
      ALTER COLUMN duration DROP NOT NULL
    `);
    
    console.log("Successfully updated duration field to accept null values");
    
    return true;
  } catch (error) {
    console.error("Error updating schema with health fields:", error);
    throw error;
  }
}

// Update a study with health conditions and body systems
export async function updateStudyWithHealthData(
  studyId: number,
  healthData: {
    healthConditions?: string,
    bodySystems?: string,
    keywords?: string[]
  }
) {
  try {
    // Create update object with only provided fields
    const updateObj: any = {};
    
    if (healthData.healthConditions !== undefined) {
      updateObj.healthConditions = healthData.healthConditions;
    }
    
    if (healthData.bodySystems !== undefined) {
      updateObj.bodySystems = healthData.bodySystems;
    }
    
    if (healthData.keywords !== undefined) {
      updateObj.keywords = healthData.keywords;
    }
    
    // Only update if there are fields to update
    if (Object.keys(updateObj).length > 0) {
      // Use raw SQL for the update to avoid schema validation issues
      // Create a SQL-safe update statement
      const updates = [];
      const params = [];
      let paramCounter = 1;
      
      // Add each field to the updates array
      if (healthData.healthConditions !== undefined) {
        updates.push(`health_conditions = $${paramCounter++}`);
        params.push(healthData.healthConditions);
      }
      
      if (healthData.bodySystems !== undefined) {
        updates.push(`body_systems = $${paramCounter++}`);
        params.push(healthData.bodySystems);
      }
      
      if (healthData.keywords !== undefined) {
        updates.push(`keywords = $${paramCounter++}`);
        params.push(healthData.keywords);
      }
      
      // Only execute if we have fields to update
      if (updates.length > 0) {
        await db.execute(
          `UPDATE studies SET ${updates.join(', ')} WHERE id = $${paramCounter}`,
          [...params, studyId]
        );
      }
    }
    
    return true;
  } catch (error) {
    console.error("Error updating study with health data:", error);
    throw error;
  }
}