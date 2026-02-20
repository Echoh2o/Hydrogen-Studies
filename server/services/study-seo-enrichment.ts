/**
 * Study SEO Enrichment Service
 *
 * Uses AI (OpenAI GPT-4o) to enrich each study with:
 * - Plain language title
 * - Meta title & description (SEO-optimized)
 * - Multiple summary lengths (50, 100, 200 words)
 * - FAQ Q&A pairs
 * - Semantic keywords
 * - OG/Twitter social tags
 * - Health condition/body system categorization
 *
 * This transforms raw academic studies into unique, value-added pages
 * that won't be flagged as duplicate content.
 */

import OpenAI from "openai";
import { db } from "../db";
import { studies } from "../../shared/schema";
import { eq, isNull, sql, and, or } from "drizzle-orm";

const SITE_NAME = "Hydrogen Studies";

const initializeOpenAI = (): OpenAI | null => {
  if (!process.env.OPENAI_API_KEY) {
    console.warn("[StudyEnrichment] OpenAI API key not configured");
    return null;
  }
  try {
    return new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      timeout: 45000,
      maxRetries: 2,
    });
  } catch (error) {
    console.error("[StudyEnrichment] Failed to initialize OpenAI:", error);
    return null;
  }
};

interface EnrichmentResult {
  plainLanguageTitle: string;
  metaTitle: string;
  metaDescription: string;
  ogTitle: string;
  ogDescription: string;
  twitterTitle: string;
  twitterDescription: string;
  summary50Words: string;
  summary100Words: string;
  summary200Words: string;
  semanticKeywords: string[];
  questionAnswerPairs: Array<{ question: string; answer: string }>;
  healthConditions: string[];
  bodySystems: string[];
  lifeStages: string[];
  mechanisms: string[];
  tags: string[];
  readingLevel: string;
  whyItMatters: string;
  keyFindings: string[];
  methodsPlainLanguage: string;
  limitations: string;
}

async function enrichStudyWithAI(study: {
  id: number;
  title: string;
  abstract: string;
  authors: string;
  journal: string;
  category: string;
  methods?: string | null;
  results?: string | null;
  conclusion?: string | null;
  keywords?: string[] | null;
  doi?: string | null;
  studyType?: string | null;
  outcome?: string | null;
}): Promise<EnrichmentResult | null> {
  const openai = initializeOpenAI();
  if (!openai) return null;

  const prompt = `You are an expert science communicator and SEO specialist. Analyze this hydrogen therapy research study and generate enrichment data.

STUDY:
Title: ${study.title}
Authors: ${study.authors}
Journal: ${study.journal}
Category: ${study.category}
DOI: ${study.doi || "N/A"}
Study Type: ${study.studyType || "Not specified"}
Outcome: ${study.outcome || "Not specified"}

Abstract: ${study.abstract}

${study.methods ? `Methods: ${study.methods}` : ""}
${study.results ? `Results: ${study.results}` : ""}
${study.conclusion ? `Conclusion: ${study.conclusion}` : ""}
${study.keywords?.length ? `Keywords: ${study.keywords.join(", ")}` : ""}

Generate a JSON object with ALL of these fields:

1. "plainLanguageTitle" — Rewrite the title in plain English for general audiences. Make it compelling and searchable. Max 80 chars. Example: "Hydrogen Water Reduces Joint Pain in Arthritis Patients"

2. "metaTitle" — SEO-optimized page title. Must be under 60 characters. Include primary keyword. Example: "Hydrogen Water for Arthritis Pain | Study Results"

3. "metaDescription" — SEO meta description. Must be 120-155 characters. Include a call-to-action. Example: "New research shows hydrogen water significantly reduces arthritis pain. Read the study findings and what they mean for patients."

4. "ogTitle" — Social sharing title (max 65 chars). Slightly more engaging than metaTitle.
5. "ogDescription" — Social sharing description (max 200 chars). Encourage clicks.
6. "twitterTitle" — Twitter card title (max 60 chars).
7. "twitterDescription" — Twitter card description (max 140 chars).

8. "summary50Words" — Exactly ~50 word plain-language summary of the study.
9. "summary100Words" — Exactly ~100 word summary explaining the study, methods, key findings, and significance.
10. "summary200Words" — Exactly ~200 word comprehensive summary written at 8th grade reading level. Explain what researchers did, what they found, and why it matters. Add context about hydrogen therapy.

11. "semanticKeywords" — Array of 8-15 LSI (related) keywords for SEO. Include variations of hydrogen therapy terms, the condition studied, and related search terms. Example: ["hydrogen water benefits", "molecular hydrogen arthritis", "H2 therapy joint pain", ...]

12. "questionAnswerPairs" — Array of 5 FAQ objects with "question" and "answer" fields. Questions should be what real people would Google. Answers should be 2-3 sentences. Examples:
  - "Can hydrogen water help with arthritis?"
  - "What did this study find about hydrogen therapy?"
  - "How does molecular hydrogen reduce inflammation?"
  - "Is hydrogen water safe for [condition] patients?"
  - "How much hydrogen water was used in this study?"

13. "healthConditions" — Array of specific health conditions studied (e.g., ["Type 2 Diabetes", "Metabolic Syndrome"])
14. "bodySystems" — Array of body systems affected (e.g., ["Cardiovascular", "Endocrine"])
15. "lifeStages" — Array of relevant life stages (e.g., ["Adults", "Elderly"]). Use: Pregnancy, Infants, Children, Adolescents, Adults, Elderly, Athletes
16. "mechanisms" — Array of hydrogen delivery mechanisms (e.g., ["Hydrogen Water", "Hydrogen Inhalation"])
17. "tags" — Array of 5-10 descriptive tags (e.g., ["clinical trial", "double-blind", "anti-inflammatory", "oxidative stress"])

18. "readingLevel" — Target reading level: "general", "intermediate", or "advanced"

19. "whyItMatters" — 2-3 sentences explaining the real-world significance in plain language.
20. "keyFindings" — Array of 3-5 bullet-point findings from the study.
21. "methodsPlainLanguage" — 2-3 sentences explaining the methodology in plain language.
22. "limitations" — 1-2 sentences noting study limitations honestly.

Return ONLY the JSON object, no markdown formatting.`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: "You are an expert science communicator and SEO specialist. Always return valid JSON." },
        { role: "user", content: prompt }
      ],
      response_format: { type: "json_object" },
      temperature: 0.7,
    });

    const content = response.choices[0].message.content;
    if (!content) return null;

    const data = JSON.parse(content) as EnrichmentResult;
    return data;
  } catch (error) {
    console.error(`[StudyEnrichment] Error enriching study ${study.id}:`, error);
    return null;
  }
}

/**
 * Enrich a single study and save to database
 */
export async function enrichAndSaveStudy(studyId: number): Promise<boolean> {
  try {
    const [study] = await db.select().from(studies).where(eq(studies.id, studyId)).limit(1);
    if (!study) {
      console.error(`[StudyEnrichment] Study ${studyId} not found`);
      return false;
    }

    console.log(`[StudyEnrichment] Enriching study ${studyId}: ${study.title.substring(0, 60)}...`);

    const enrichment = await enrichStudyWithAI(study);
    if (!enrichment) {
      console.error(`[StudyEnrichment] AI enrichment failed for study ${studyId}`);
      return false;
    }

    // Build the slug from plain language title
    const slug = study.slug || enrichment.plainLanguageTitle
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .substring(0, 100);

    // Save enrichment data
    await db.update(studies).set({
      plainLanguageTitle: enrichment.plainLanguageTitle,
      metaTitle: enrichment.metaTitle,
      metaDescription: enrichment.metaDescription,
      ogTitle: enrichment.ogTitle,
      ogDescription: enrichment.ogDescription,
      twitterTitle: enrichment.twitterTitle,
      twitterDescription: enrichment.twitterDescription,
      twitterCard: "summary_large_image",
      summary50Words: enrichment.summary50Words,
      summary100Words: enrichment.summary100Words,
      summary200Words: enrichment.summary200Words,
      semanticKeywords: enrichment.semanticKeywords,
      questionAnswerPairs: JSON.stringify(enrichment.questionAnswerPairs),
      healthConditions: enrichment.healthConditions,
      bodySystems: enrichment.bodySystems,
      lifeStages: enrichment.lifeStages,
      mechanisms: enrichment.mechanisms,
      tags: enrichment.tags,
      readingLevel: enrichment.readingLevel,
      slug,
      enhancedWithAI: true,
      lastModified: new Date(),
      // Store extended content in structured data
      structuredData: JSON.stringify({
        whyItMatters: enrichment.whyItMatters,
        keyFindings: enrichment.keyFindings,
        methodsPlainLanguage: enrichment.methodsPlainLanguage,
        limitations: enrichment.limitations,
      }),
    }).where(eq(studies.id, studyId));

    console.log(`[StudyEnrichment] Successfully enriched study ${studyId}`);
    return true;
  } catch (error) {
    console.error(`[StudyEnrichment] Error saving enrichment for study ${studyId}:`, error);
    return false;
  }
}

/**
 * Get count of studies that need enrichment
 */
export async function getEnrichmentCandidateCount(): Promise<number> {
  const [result] = await db.select({ count: sql<number>`count(*)` })
    .from(studies)
    .where(
      or(
        eq(studies.enhancedWithAI, false),
        isNull(studies.enhancedWithAI),
        isNull(studies.metaTitle),
        isNull(studies.summary100Words)
      )
    );
  return Number(result?.count || 0);
}

/**
 * Get next batch of studies that need enrichment
 */
export async function getEnrichmentCandidates(limit: number = 10): Promise<Array<{ id: number; title: string }>> {
  return db.select({ id: studies.id, title: studies.title })
    .from(studies)
    .where(
      or(
        eq(studies.enhancedWithAI, false),
        isNull(studies.enhancedWithAI),
        isNull(studies.metaTitle),
        isNull(studies.summary100Words)
      )
    )
    .orderBy(studies.id)
    .limit(limit);
}

/**
 * Batch enrich studies with progress tracking
 */
export async function batchEnrichStudies(options: {
  batchSize?: number;
  delayMs?: number;
  onProgress?: (done: number, total: number, studyId: number) => void;
} = {}): Promise<{ success: number; failed: number; total: number }> {
  const { batchSize = 50, delayMs = 1000, onProgress } = options;

  const candidates = await getEnrichmentCandidates(batchSize);
  const total = candidates.length;
  let success = 0;
  let failed = 0;

  for (let i = 0; i < candidates.length; i++) {
    const candidate = candidates[i];
    const result = await enrichAndSaveStudy(candidate.id);
    if (result) {
      success++;
    } else {
      failed++;
    }

    onProgress?.(i + 1, total, candidate.id);

    // Rate limiting delay between API calls
    if (i < candidates.length - 1 && delayMs > 0) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }

  return { success, failed, total };
}

export { EnrichmentResult };
