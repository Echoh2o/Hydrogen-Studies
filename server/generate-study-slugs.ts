/**
 * Generate SEO-friendly URL slugs from plain language titles
 */

import { db } from "./db";
import { studies } from "../shared/schema";
import { eq, isNotNull } from "drizzle-orm";

function createSlug(title: string): string {
  if (!title) return "";

  return title
    .toLowerCase()
    .replace(/["""]/g, "") // Remove quotes
    .replace(/[^a-z0-9\s-]/g, "") // Remove special characters except spaces and hyphens
    .replace(/\s+/g, "-") // Replace spaces with hyphens
    .replace(/-+/g, "-") // Replace multiple hyphens with single hyphen
    .replace(/^-|-$/g, "") // Remove leading/trailing hyphens
    .substring(0, 100); // Limit length for URLs
}

export async function generateStudySlugs(): Promise<void> {
  console.log(
    "Generating SEO-friendly URL slugs from plain language titles...",
  );

  try {
    // Get all studies with plain language titles but no slugs
    const studiesWithTitles = await db
      .select({
        id: studies.id,
        plainLanguageTitle: studies.plainLanguageTitle,
      })
      .from(studies)
      .where(isNotNull(studies.plainLanguageTitle));

    console.log(
      `Found ${studiesWithTitles.length} studies with plain language titles`,
    );

    let updated = 0;
    const slugCounts = new Map<string, number>();

    for (const study of studiesWithTitles) {
      if (!study.plainLanguageTitle) continue;

      let baseSlug = createSlug(study.plainLanguageTitle);
      if (!baseSlug) continue;

      // Handle duplicate slugs by adding numbers
      let finalSlug = baseSlug;
      let counter = 1;

      while (slugCounts.has(finalSlug)) {
        finalSlug = `${baseSlug}-${counter}`;
        counter++;
      }

      slugCounts.set(finalSlug, 1);

      // Update the study with the slug
      await db
        .update(studies)
        .set({ slug: finalSlug })
        .where(eq(studies.id, study.id));

      updated++;

      if (updated % 100 === 0) {
        console.log(`Updated ${updated} study slugs...`);
      }
    }

    console.log(`Successfully generated ${updated} SEO-friendly URL slugs`);
  } catch (error) {
    console.error("Error generating study slugs:", error);
    throw error;
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  generateStudySlugs()
    .then(() => {
      console.log("Slug generation completed");
      process.exit(0);
    })
    .catch((error) => {
      console.error("Slug generation failed:", error);
      process.exit(1);
    });
}
