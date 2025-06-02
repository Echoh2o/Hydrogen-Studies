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
      
      if (categoryRecord) {
        // Update the study count
        await db
          .update(categories)
          .set({ studyCount: count })
          .where(eq(categories.id, categoryRecord.id));
          
        console.log(`Updated count for category '${categoryName}' to ${count}`);
      } else {
        console.log(`Category '${categoryName}' not found in categories table`);
      }
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
export async function updateSingleCategoryCount(categoryName: string): Promise<void> {
  try {
    // Count studies with this category
    const [countResult] = await db
      .select({
        count: sql<number>`count(*)::int`
      })
      .from(studies)
      .where(eq(studies.category, categoryName));
    
    const count = countResult?.count || 0;
    
    // Find the category by name
    const [categoryRecord] = await db
      .select()
      .from(categories)
      .where(eq(categories.name, categoryName));
    
    if (categoryRecord) {
      // Update the study count
      await db
        .update(categories)
        .set({ studyCount: count })
        .where(eq(categories.id, categoryRecord.id));
        
      console.log(`Updated count for category '${categoryName}' to ${count}`);
    } else {
      console.log(`Category '${categoryName}' not found in categories table`);
    }
  } catch (error) {
    console.error(`Error updating count for category '${categoryName}':`, error);
    throw error;
  }
}