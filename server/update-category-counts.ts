import { db } from "./db";
import { categories, studyCategories } from "@shared/schema";
import { eq, sql } from "drizzle-orm";

/**
 * Updates the study counts for all categories based on the actual number
 * of studies assigned to each category in the new multi-category system
 */
export async function updateCategoryCounts(): Promise<void> {
  try {
    console.log("Starting category count update...");
    
    // Get counts of studies by category using the junction table
    const categoryCounts = await db
      .select({
        categoryId: studyCategories.categoryId,
        count: sql<number>`count(distinct ${studyCategories.studyId})::int`
      })
      .from(studyCategories)
      .groupBy(studyCategories.categoryId);
    
    console.log("Category counts:", categoryCounts);
    
    // Reset all category counts to 0 first
    const allCategories = await db.select().from(categories);
    for (const category of allCategories) {
      await db
        .update(categories)
        .set({ studyCount: 0 })
        .where(eq(categories.id, category.id));
    }
    
    // Update each category with its actual count
    for (const countData of categoryCounts) {
      const categoryId = countData.categoryId;
      const count = countData.count;
      
      // Update the study count directly using category ID
      await db
        .update(categories)
        .set({ studyCount: count })
        .where(eq(categories.id, categoryId));
          
      console.log(`Updated count for category ID ${categoryId} to ${count}`);
    }
    
    console.log("Category count update completed");
  } catch (error) {
    console.error("Error updating category counts:", error);
    throw error;
  }
}

/**
 * Updates the study count for a specific category
 */
export async function updateSingleCategoryCount(categoryId: number): Promise<void> {
  try {
    // Count studies with this category using the junction table
    const [countResult] = await db
      .select({
        count: sql<number>`count(distinct ${studyCategories.studyId})::int`
      })
      .from(studyCategories)
      .where(eq(studyCategories.categoryId, categoryId));
    
    const count = countResult?.count || 0;
    
    // Update the study count
    await db
      .update(categories)
      .set({ studyCount: count })
      .where(eq(categories.id, categoryId));
      
    console.log(`Updated count for category ID ${categoryId} to ${count}`);
  } catch (error) {
    console.error(`Error updating count for category ID ${categoryId}:`, error);
    throw error;
  }
}