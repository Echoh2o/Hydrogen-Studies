/**
 * Research Digest Generator
 *
 * Aggregates studies added in the past week and generates an AI-powered
 * narrative summary with trending topics and notable findings.
 * Idempotent: won't regenerate for the same week.
 */

import { db } from "../db";
import { studies, researchDigests } from "@shared/schema";
import type { ResearchDigest } from "@shared/schema";
import { eq, sql, gte, lte, desc, and } from "drizzle-orm";
import { ai } from "./ai-provider";
import { logger } from "../utils/logger";

/**
 * Get the Monday and Sunday of the previous completed week.
 *
 * The scheduler runs the digest job on Mondays, so summarizing the week
 * containing 'now' would cover a week that has barely started (near-zero
 * studies) and permanently lock an empty digest. Instead we look back to the
 * previous week — which has fully ended — so the digest summarizes real studies.
 */
function getPreviousWeekBounds(): { weekStart: string; weekEnd: string } {
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0 = Sunday
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;

  const monday = new Date(now);
  // Shift to this week's Monday, then subtract 7 days for the previous week.
  monday.setDate(now.getDate() + mondayOffset - 7);
  monday.setHours(0, 0, 0, 0);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);

  return {
    weekStart: monday.toISOString().split("T")[0],
    weekEnd: sunday.toISOString().split("T")[0],
  };
}

/**
 * Generate the slug for a week's digest
 */
function weekSlug(weekStart: string): string {
  return `hydrogen-research-digest-${weekStart}`;
}

/**
 * Check if a digest already exists for this week
 */
async function digestExistsForWeek(weekStart: string): Promise<ResearchDigest | null> {
  const existing = await db.query.researchDigests.findFirst({
    where: eq(researchDigests.weekStart, weekStart),
  });
  return existing || null;
}

/**
 * Generate a weekly research digest.
 * Idempotent — returns existing digest if one already exists for this week.
 */
export async function generateWeeklyDigest(): Promise<ResearchDigest> {
  const { weekStart, weekEnd } = getPreviousWeekBounds();

  // Check idempotency
  const existing = await digestExistsForWeek(weekStart);
  if (existing) {
    logger.info("Digest already exists for this week", "DigestGenerator", { weekStart });
    return existing;
  }

  // Get studies added this week
  const weekStudies = await db
    .select()
    .from(studies)
    .where(
      and(
        gte(studies.createdAt, new Date(weekStart)),
        lte(studies.createdAt, new Date(weekEnd + "T23:59:59Z")),
      ),
    )
    .orderBy(desc(studies.id));

  if (weekStudies.length === 0) {
    logger.info("No studies this week, skipping digest", "DigestGenerator");
    // Create a minimal digest so we don't retry
    const [digest] = await db
      .insert(researchDigests)
      .values({
        weekStart,
        weekEnd,
        title: `Hydrogen Research Digest: ${weekStart}`,
        slug: weekSlug(weekStart),
        narrative: "<p>No new studies were added this week. Check back next week for the latest hydrogen research updates.</p>",
        narrativeMarkdown: "No new studies were added this week. Check back next week for the latest hydrogen research updates.",
        trendingTopics: "[]",
        notableFindings: "[]",
        studyCount: 0,
        studyIds: "[]",
        isPublished: true,
      })
      .returning();
    return digest;
  }

  logger.info(`Generating digest for ${weekStudies.length} studies`, "DigestGenerator", { weekStart });

  // Prepare study summaries for the AI
  const studySummaries = weekStudies.slice(0, 30).map((s) => ({
    id: s.id,
    title: s.plainLanguageTitle || s.title,
    category: s.category,
    outcome: s.outcome || "unknown",
    conditions: s.healthConditions || [],
    summary: s.summary100Words || s.summary50Words || s.conclusionShort || s.abstract?.substring(0, 200) || "",
    studyType: s.studyType || "unknown",
  }));

  // Generate narrative with AI
  const digestContent = await ai.generateJSON<{
    title: string;
    narrative: string;
    trendingTopics: string[];
    notableFindings: { studyId: number; title: string; finding: string }[];
    metaTitle: string;
    metaDescription: string;
  }>(
    `You are the editor-in-chief of HydrogenStudies.com, the world's most authoritative hydrogen research database.

Write a weekly research digest that:
1. Opens with a compelling overview of this week's research landscape
2. Groups findings by theme (e.g., "Advances in Neuroprotection", "New Clinical Evidence")
3. Highlights the most significant studies with brief explanations
4. Uses HTML formatting (h2, h3, p, ul/li, strong, em) for rich content
5. Includes practical implications for consumers
6. Maintains scientific accuracy while being accessible to a general audience
7. References specific studies by their plain language title
8. Ends with a forward-looking statement about upcoming research directions

The tone should be authoritative yet approachable — like a knowledgeable friend explaining the latest research.

Return JSON with:
- title: Compelling digest title (include the week date)
- narrative: Full HTML narrative (800-1200 words)
- trendingTopics: Array of 3-5 trending research themes this week
- notableFindings: Array of { studyId, title, finding } for the top 3-5 most important studies
- metaTitle: SEO title (max 60 chars)
- metaDescription: SEO description (max 155 chars)`,
    `Week: ${weekStart} to ${weekEnd}
Total new studies: ${weekStudies.length}

Studies this week:
${JSON.stringify(studySummaries, null, 2)}`,
    { maxTokens: 3000 },
  );

  // Create the digest
  const [digest] = await db
    .insert(researchDigests)
    .values({
      weekStart,
      weekEnd,
      title: digestContent.title,
      slug: weekSlug(weekStart),
      narrative: digestContent.narrative,
      trendingTopics: JSON.stringify(digestContent.trendingTopics),
      notableFindings: JSON.stringify(digestContent.notableFindings),
      studyCount: weekStudies.length,
      studyIds: JSON.stringify(weekStudies.map((s) => s.id)),
      metaTitle: digestContent.metaTitle,
      metaDescription: digestContent.metaDescription,
      isPublished: true,
      publishedAt: new Date(),
    })
    .returning();

  logger.info("Weekly digest generated", "DigestGenerator", {
    digestId: digest.id,
    weekStart,
    studyCount: weekStudies.length,
    topics: digestContent.trendingTopics,
  });

  return digest;
}

/**
 * Get the latest published digest
 */
export async function getLatestDigest(): Promise<ResearchDigest | null> {
  const digest = await db.query.researchDigests.findFirst({
    where: eq(researchDigests.isPublished, true),
    orderBy: [desc(researchDigests.weekStart)],
  });
  return digest || null;
}

/**
 * Get all published digests (for archive)
 */
export async function getDigestArchive(
  limit: number = 20,
  offset: number = 0,
): Promise<ResearchDigest[]> {
  return db
    .select()
    .from(researchDigests)
    .where(eq(researchDigests.isPublished, true))
    .orderBy(desc(researchDigests.weekStart))
    .limit(limit)
    .offset(offset);
}

/**
 * Get a single digest by slug
 */
export async function getDigestBySlug(slug: string): Promise<ResearchDigest | null> {
  const digest = await db.query.researchDigests.findFirst({
    where: eq(researchDigests.slug, slug),
  });
  return digest || null;
}
