/**
 * Schema updates to add standardized study summaries
 */
import { studies, type InsertStudy, type Study } from "@shared/schema";
import { db } from "../server/db";
import { eq } from "drizzle-orm";

// Function to update study schema with standardized summaries
export async function updateStudyWithStandardizedSummary(
  studyId: number,
  summary: {
    objective: string;
    methodsShort: string;
    resultsShort: string;
    conclusionShort: string;
    summaryMarkdown: string;
  },
) {
  try {
    // Update the database schema first to add the new columns if they don't exist
    await db.execute(`
      ALTER TABLE studies 
      ADD COLUMN IF NOT EXISTS objective TEXT, 
      ADD COLUMN IF NOT EXISTS methods_short TEXT,
      ADD COLUMN IF NOT EXISTS results_short TEXT,
      ADD COLUMN IF NOT EXISTS conclusion_short TEXT,
      ADD COLUMN IF NOT EXISTS summary_markdown TEXT
    `);

    // Now update the study with the standardized summary
    const [updatedStudy] = await db
      .update(studies)
      .set({
        objective: summary.objective,
        methodsShort: summary.methodsShort,
        resultsShort: summary.resultsShort,
        conclusionShort: summary.conclusionShort,
        summaryMarkdown: summary.summaryMarkdown,
      })
      .where(eq(studies.id, studyId))
      .returning();

    return updatedStudy;
  } catch (error) {
    console.error("Error updating study with standardized summary:", error);
    throw error;
  }
}

// Function to generate standardized summary from existing study data
export async function generateStandardizedSummary(study: Study): Promise<{
  objective: string;
  methodsShort: string;
  resultsShort: string;
  conclusionShort: string;
  summaryMarkdown: string;
}> {
  // Extract objective from abstract (typically the first sentence)
  const objective = extractObjective(study.abstract);

  // Create shortened versions of methods, results, and conclusion
  const methodsShort = study.methods
    ? shortenText(study.methods, 250)
    : extractMethodsFromAbstract(study.abstract);

  const resultsShort = study.results
    ? shortenText(study.results, 250)
    : extractResultsFromAbstract(study.abstract);

  const conclusionShort = study.conclusion
    ? shortenText(study.conclusion, 250)
    : extractConclusionFromAbstract(study.abstract);

  // Generate markdown format for the full summary
  const summaryMarkdown = `
## Objective
${objective}

## Methods
${study.methods || methodsShort}

## Results
${study.results || resultsShort}

## Conclusion
${study.conclusion || conclusionShort}

${study.doi ? `**DOI**: [${study.doi}](https://doi.org/${study.doi})` : ""}
${study.pdfUrl ? `**Full Text**: [View PDF](${study.pdfUrl})` : ""}
${study.citationUrl ? `**Citation**: [View Citation](${study.citationUrl})` : ""}
`;

  // Return the standardized summary object
  return {
    objective,
    methodsShort,
    resultsShort,
    conclusionShort,
    summaryMarkdown,
  };
}

// Helper function to extract objective from abstract
function extractObjective(abstract: string): string {
  // Typically the first sentence contains the objective
  const firstSentence = abstract.split(/\.(?:\s|$)/)[0];
  if (firstSentence && firstSentence.length > 10) {
    return firstSentence + ".";
  }

  // If first sentence extraction doesn't work, just return the first 200 chars
  return abstract.substring(0, 200) + (abstract.length > 200 ? "..." : "");
}

// Helper function to extract methods from abstract
function extractMethodsFromAbstract(abstract: string): string {
  // Look for common methods indicators in the abstract
  const methodsKeywords = [
    "method",
    "design",
    "procedure",
    "study design",
    "approach",
  ];

  // Try to find sentences containing methods keywords
  const sentences = abstract.split(/\.(?:\s|$)/);
  for (const keyword of methodsKeywords) {
    for (const sentence of sentences) {
      if (sentence.toLowerCase().includes(keyword)) {
        return sentence.trim() + ".";
      }
    }
  }

  // If nothing found, return the second sentence if it exists (often contains methods)
  return sentences.length > 1
    ? sentences[1].trim() + "."
    : "Methods not specified.";
}

// Helper function to extract results from abstract
function extractResultsFromAbstract(abstract: string): string {
  // Look for common results indicators in the abstract
  const resultsKeywords = ["result", "show", "found", "demonstrate", "reveal"];

  // Try to find sentences containing results keywords
  const sentences = abstract.split(/\.(?:\s|$)/);
  for (const keyword of resultsKeywords) {
    for (const sentence of sentences) {
      if (sentence.toLowerCase().includes(keyword)) {
        return sentence.trim() + ".";
      }
    }
  }

  // If nothing found, return a middle sentence if possible
  const middleIndex = Math.floor(sentences.length / 2);
  return sentences.length > middleIndex
    ? sentences[middleIndex].trim() + "."
    : "Results not specified.";
}

// Helper function to extract conclusion from abstract
function extractConclusionFromAbstract(abstract: string): string {
  // Look for common conclusion indicators in the abstract
  const conclusionKeywords = [
    "conclusion",
    "suggest",
    "indicate",
    "conclude",
    "implication",
  ];

  // Try to find sentences containing conclusion keywords
  const sentences = abstract.split(/\.(?:\s|$)/);
  for (const keyword of conclusionKeywords) {
    for (const sentence of sentences) {
      if (sentence.toLowerCase().includes(keyword)) {
        return sentence.trim() + ".";
      }
    }
  }

  // If nothing found, return the last sentence (often contains conclusion)
  return sentences.length > 0
    ? sentences[sentences.length - 1].trim() + "."
    : "Conclusion not specified.";
}

// Helper function to shorten text to specified length
function shortenText(text: string, maxLength: number): string {
  if (!text || text.length <= maxLength) {
    return text;
  }

  // Try to shorten at sentence boundary
  const truncated = text.substring(0, maxLength);
  const lastPeriod = truncated.lastIndexOf(".");

  if (lastPeriod > maxLength * 0.7) {
    // If we can find a period after 70% of the max length, use that
    return truncated.substring(0, lastPeriod + 1);
  }

  // Otherwise just truncate and add ellipsis
  return truncated + "...";
}
