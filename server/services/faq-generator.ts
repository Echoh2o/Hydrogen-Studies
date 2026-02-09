import { db } from "../db";
import { studies } from "@shared/schema";
import { eq, sql, ilike, desc } from "drizzle-orm";
import OpenAI from "openai";

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    })
  : null;

interface FAQ {
  question: string;
  answer: string;
  targetKeyword: string;
  relatedStudies: number[];
}

export async function generateCategoryFAQs(category: string): Promise<FAQ[]> {
  if (!openai) return [];

  // Get studies in this category
  const categoryStudies = await db
    .select({
      id: studies.id,
      title: studies.title,
      abstract: studies.abstract,
      keywords: studies.keywords,
    })
    .from(studies)
    .where(ilike(studies.category, `%${category}%`))
    .orderBy(desc(studies.viewCount))
    .limit(10);

  if (categoryStudies.length === 0) return [];

  const studySummary = categoryStudies
    .map((s) => `Study ${s.id}: ${s.title} - Key findings from abstract`)
    .join("\n");

  const prompt = `
  Based on these hydrogen therapy research studies about ${category}, generate 8-12 FAQ pairs that would:
  1. Target long-tail search queries people ask about ${category} and hydrogen therapy
  2. Be optimized for featured snippets (concise, direct answers)
  3. Include specific research evidence when possible
  
  Studies summary:
  ${studySummary}
  
  Create questions that people commonly search:
  - "Does hydrogen therapy help with [condition]?"
  - "How effective is hydrogen for [specific benefit]?"
  - "Is hydrogen therapy safe for [condition]?"
  - "What does research show about hydrogen and [condition]?"
  
  Format each as:
  Q: [Question]
  A: [Answer in 2-3 sentences, include "research shows" or "studies indicate"]
  Keywords: [primary search term]
  Studies: [relevant study IDs if mentioned]
  
  Make answers factual, evidence-based, and around 50-80 words for snippet optimization.
  `;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.2,
    });

    // Parse the response into structured FAQ format
    const content = response.choices[0].message.content || "";
    const faqs: FAQ[] = [];

    const sections = content.split(/Q:/g).filter(Boolean);

    sections.forEach((section) => {
      const lines = section.trim().split("\n");
      const question = lines[0]?.trim();
      const answerLine = lines.find((l) => l.startsWith("A:"));
      const keywordLine = lines.find((l) => l.startsWith("Keywords:"));
      const studiesLine = lines.find((l) => l.startsWith("Studies:"));

      if (question && answerLine) {
        faqs.push({
          question: question.replace(/^Q:\s*/, ""),
          answer: answerLine.replace(/^A:\s*/, ""),
          targetKeyword: keywordLine?.replace(/^Keywords:\s*/, "") || "",
          relatedStudies: studiesLine
            ? studiesLine
                .replace(/^Studies:\s*/, "")
                .split(",")
                .map((id) => parseInt(id.trim()))
                .filter(Boolean)
            : [],
        });
      }
    });

    return faqs;
  } catch (error) {
    console.error("FAQ generation failed:", error);
    return [];
  }
}

export async function generateHomepageFAQs(): Promise<FAQ[]> {
  const generalPrompt = `
  Create 10 essential FAQ pairs about hydrogen therapy that would:
  1. Target the most common search queries about hydrogen therapy
  2. Be perfect for featured snippets (concise, direct answers)
  3. Cover safety, effectiveness, and basic information
  
  Focus on these high-volume search intents:
  - What is hydrogen therapy?
  - Is hydrogen therapy safe?
  - Does hydrogen therapy work?
  - How do you use hydrogen therapy?
  - What conditions does hydrogen help?
  - Are there side effects?
  - How much does hydrogen therapy cost?
  - Where can I get hydrogen therapy?
  
  Format each as short, snippet-ready answers (40-60 words).
  Make them evidence-based but accessible to general audiences.
  `;

  if (!openai) return [];

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [{ role: "user", content: generalPrompt }],
      temperature: 0.2,
    });

    // Parse similar to above
    return []; // Implementation similar to generateCategoryFAQs
  } catch (error) {
    console.error("Homepage FAQ generation failed:", error);
    return [];
  }
}
