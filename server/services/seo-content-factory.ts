/**
 * SEO Content Factory — Automated pillar page + cluster blog generation
 *
 * Generates two types of content:
 * 1. Pillar Pages (3,000-5,000 words) — comprehensive review of a topic
 * 2. Cluster Posts (1,000-2,000 words) — targeted long-tail keyword articles
 *
 * All content references real studies with inline citations, is interlinked,
 * and targets specific keyword patterns for SEO dominance.
 */

import { ai } from "./ai-provider";
import { db } from "../db";
import { studies, blogArticles } from "../../shared/schema";
import { eq, sql, and, ilike, or, desc, isNotNull } from "drizzle-orm";

const SITE_URL = process.env.SITE_URL || "https://hydrogenstudies.com";
const SITE_NAME = "Hydrogen Studies";

// ============================================================
// Topic Mapping — maps conditions to keyword clusters
// ============================================================

export interface TopicCluster {
  slug: string;
  pillarTitle: string;
  pillarKeyword: string;
  condition: string;
  categoryPatterns: string[]; // SQL ILIKE patterns to find related studies
  clusterKeywords: Array<{
    slug: string;
    title: string;
    targetKeyword: string;
    articleType: "explainer" | "comparison" | "faq" | "how-to" | "research-roundup" | "benefits" | "safety";
  }>;
}

/**
 * Generate topic clusters from the actual data in the database
 */
export async function generateTopicClusters(): Promise<TopicCluster[]> {
  // Get all unique categories and their study counts
  const categoryData = await db.select({
    category: studies.category,
    count: sql<number>`count(*)`,
  }).from(studies).groupBy(studies.category).orderBy(desc(sql`count(*)`));

  const clusters: TopicCluster[] = [];

  for (const cat of categoryData) {
    if (!cat.category || Number(cat.count) < 3) continue;

    const condition = cat.category;
    const slug = condition.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

    clusters.push({
      slug,
      pillarTitle: `Hydrogen Therapy for ${condition}: Complete Research Review`,
      pillarKeyword: `hydrogen therapy ${condition.toLowerCase()}`,
      condition,
      categoryPatterns: [`%${condition}%`],
      clusterKeywords: [
        {
          slug: `can-hydrogen-water-help-${slug}`,
          title: `Can Hydrogen Water Help with ${condition}? What Research Shows`,
          targetKeyword: `hydrogen water ${condition.toLowerCase()}`,
          articleType: "explainer",
        },
        {
          slug: `hydrogen-${slug}-research-review`,
          title: `${condition} and Hydrogen Therapy: Latest Research Findings`,
          targetKeyword: `hydrogen ${condition.toLowerCase()} research`,
          articleType: "research-roundup",
        },
        {
          slug: `hydrogen-${slug}-benefits`,
          title: `Benefits of Molecular Hydrogen for ${condition} Patients`,
          targetKeyword: `molecular hydrogen benefits ${condition.toLowerCase()}`,
          articleType: "benefits",
        },
        {
          slug: `hydrogen-water-safe-${slug}`,
          title: `Is Hydrogen Water Safe for ${condition}? Side Effects & Research`,
          targetKeyword: `hydrogen water safe ${condition.toLowerCase()}`,
          articleType: "safety",
        },
        {
          slug: `how-hydrogen-helps-${slug}`,
          title: `How Molecular Hydrogen Works for ${condition}: Mechanisms Explained`,
          targetKeyword: `how does hydrogen help ${condition.toLowerCase()}`,
          articleType: "how-to",
        },
      ],
    });
  }

  return clusters;
}

// ============================================================
// Pillar Page Generation
// ============================================================

export interface GeneratedArticle {
  title: string;
  slug: string;
  content: string;
  summary: string;
  metaTitle: string;
  metaDescription: string;
  ogTitle: string;
  ogDescription: string;
  semanticKeywords: string[];
  questionAnswerPairs: string; // JSON string
  readingLevel: string;
  articleType: string;
  quickInsights: string;
}

/**
 * Generate a pillar page for a specific topic cluster
 */
export async function generatePillarPage(cluster: TopicCluster): Promise<GeneratedArticle | null> {
  if (ai.getProviderStatus().primary === "none") return null;

  // Fetch all related studies for this topic
  const relatedStudies = await db.select({
    id: studies.id,
    title: studies.title,
    abstract: studies.abstract,
    authors: studies.authors,
    journal: studies.journal,
    publishYear: studies.publishYear,
    studyType: studies.studyType,
    outcome: studies.outcome,
    slug: studies.slug,
    conclusion: studies.conclusion,
    sampleSize: studies.sampleSize,
    doi: studies.doi,
    plainLanguageTitle: studies.plainLanguageTitle,
    summary100Words: studies.summary100Words,
  })
    .from(studies)
    .where(
      or(
        ...cluster.categoryPatterns.map(p => ilike(studies.category, p)),
        ilike(studies.title, `%${cluster.condition}%`),
      )
    )
    .orderBy(desc(studies.publishYear))
    .limit(50);

  if (relatedStudies.length === 0) {
    console.log(`[ContentFactory] No studies found for cluster: ${cluster.condition}`);
    return null;
  }

  // Build study summaries for the prompt
  const studySummaries = relatedStudies.map((s, i) => {
    const link = s.slug ? `/study/${s.slug}` : `/study/id/${s.id}`;
    return `[Study ${i + 1}] "${s.plainLanguageTitle || s.title}" (${s.publishYear || "N/A"})
    Authors: ${s.authors?.substring(0, 100)}
    Journal: ${s.journal}
    Type: ${s.studyType || "Unknown"} | Outcome: ${s.outcome || "Unknown"} | N=${s.sampleSize || "N/A"}
    ${s.summary100Words || s.abstract?.substring(0, 300)}
    Link: ${SITE_URL}${link}`;
  }).join("\n\n");

  // Calculate stats
  const humanStudies = relatedStudies.filter(s => s.studyType === "human").length;
  const animalStudies = relatedStudies.filter(s => s.studyType === "animal").length;
  const positiveOutcomes = relatedStudies.filter(s => s.outcome === "positive").length;
  const years = relatedStudies.map(s => s.publishYear).filter(Boolean) as number[];
  const yearRange = years.length ? `${Math.min(...years)}-${Math.max(...years)}` : "various years";

  const prompt = `You are a world-class health science writer and SEO expert. Write a comprehensive PILLAR PAGE about hydrogen therapy for ${cluster.condition}.

TARGET KEYWORD: "${cluster.pillarKeyword}"

RESEARCH DATA (${relatedStudies.length} studies):
- ${humanStudies} human studies, ${animalStudies} animal studies
- ${positiveOutcomes} showed positive outcomes
- Research spans ${yearRange}

STUDIES:
${studySummaries}

REQUIREMENTS:
1. Write 3,000-4,000 words of comprehensive, authoritative content
2. Use an 8th-grade reading level — accessible but authoritative
3. Structure with clear H2 and H3 headings using markdown (## and ###)
4. Reference specific studies with inline links like [Study Title](link)
5. Include real statistics and sample sizes from the studies
6. Add a "Key Takeaways" section at the top (5-7 bullet points)
7. Sections should include:
   - Introduction (what is ${cluster.condition}, why hydrogen?)
   - The Science: How Molecular Hydrogen Works for ${cluster.condition}
   - Research Overview: What the Studies Show
   - Human Clinical Trials (if available)
   - Animal & Lab Studies
   - Hydrogen Delivery Methods Used in Research
   - Safety Profile & Side Effects
   - Practical Implications
   - Frequently Asked Questions (5+ Q&As)
   - Conclusion & Future Directions
8. Include internal links to study pages using full URLs
9. Be honest about limitations — don't overclaim
10. End sections with transition sentences that flow naturally

Return a JSON object with these fields:
- "title": The article title (compelling, includes keyword)
- "content": Full article content in markdown format
- "summary": 2-3 sentence summary
- "metaTitle": SEO title (under 60 chars)
- "metaDescription": SEO description (120-155 chars, includes CTA)
- "ogTitle": Social sharing title (max 65 chars)
- "ogDescription": Social sharing description (max 200 chars)
- "semanticKeywords": Array of 10-15 related keywords
- "questionAnswerPairs": Array of {question, answer} FAQ pairs (5+)
- "quickInsights": 5-7 key takeaways as a bulleted string
- "readingLevel": "general" or "intermediate"`;

  try {
    const systemPrompt = "You are an expert health science writer. Return only valid JSON.";

    const data = await ai.generateJSON(systemPrompt, prompt, {
      temperature: 0.7,
      maxTokens: 8000,
    });

    return {
      title: data.title || cluster.pillarTitle,
      slug: cluster.slug + "-hydrogen-therapy-research",
      content: data.content || "",
      summary: data.summary || "",
      metaTitle: data.metaTitle || cluster.pillarTitle.substring(0, 60),
      metaDescription: data.metaDescription || "",
      ogTitle: data.ogTitle || data.metaTitle || "",
      ogDescription: data.ogDescription || data.metaDescription || "",
      semanticKeywords: data.semanticKeywords || [],
      questionAnswerPairs: JSON.stringify(data.questionAnswerPairs || []),
      readingLevel: data.readingLevel || "general",
      articleType: "pillar_page",
      quickInsights: data.quickInsights || "",
    };
  } catch (error) {
    console.error(`[ContentFactory] Error generating pillar page for ${cluster.condition}:`, error);
    return null;
  }
}

// ============================================================
// Cluster Blog Post Generation
// ============================================================

/**
 * Generate a cluster blog post targeting a specific long-tail keyword
 */
export async function generateClusterPost(
  cluster: TopicCluster,
  clusterKeyword: TopicCluster["clusterKeywords"][number],
): Promise<GeneratedArticle | null> {
  if (ai.getProviderStatus().primary === "none") return null;

  // Fetch related studies
  const relatedStudies = await db.select({
    id: studies.id,
    title: studies.title,
    abstract: studies.abstract,
    authors: studies.authors,
    journal: studies.journal,
    publishYear: studies.publishYear,
    studyType: studies.studyType,
    outcome: studies.outcome,
    slug: studies.slug,
    conclusion: studies.conclusion,
    plainLanguageTitle: studies.plainLanguageTitle,
    summary100Words: studies.summary100Words,
  })
    .from(studies)
    .where(
      or(
        ...cluster.categoryPatterns.map(p => ilike(studies.category, p)),
        ilike(studies.title, `%${cluster.condition}%`),
      )
    )
    .orderBy(desc(studies.publishYear))
    .limit(15);

  if (relatedStudies.length === 0) return null;

  const studyRefs = relatedStudies.map((s, i) => {
    const link = s.slug ? `/study/${s.slug}` : `/study/id/${s.id}`;
    return `[${i + 1}] "${s.plainLanguageTitle || s.title}" (${s.publishYear || "N/A"}, ${s.journal})
    ${s.summary100Words || s.abstract?.substring(0, 200)}
    Link: ${SITE_URL}${link}`;
  }).join("\n\n");

  const pillarLink = `${SITE_URL}/blog/${cluster.slug}-hydrogen-therapy-research`;

  const articleTypeInstructions: Record<string, string> = {
    explainer: "Write an accessible explainer article that answers the title question directly. Lead with the answer, then provide evidence. Use conversational tone.",
    comparison: "Compare hydrogen therapy to conventional treatments for this condition. Be balanced and evidence-based. Include a comparison table.",
    faq: "Write an FAQ-style article with 8-12 questions and detailed answers. Each answer should reference specific studies.",
    "how-to": "Explain the mechanism of action in plain language. Use analogies. Break down complex biology into digestible concepts.",
    "research-roundup": "Summarize the most important/recent studies. Highlight key findings, trends, and what the research collectively suggests.",
    benefits: "Focus on the specific benefits found in research. Be specific with data points. Organize by benefit type.",
    safety: "Address safety concerns honestly. Discuss side effects (or lack thereof) found in studies. Include dosage information from research.",
  };

  const typeInstruction = articleTypeInstructions[clusterKeyword.articleType] || articleTypeInstructions.explainer;

  const prompt = `You are an expert health science writer and SEO specialist. Write a blog article.

TITLE: ${clusterKeyword.title}
TARGET KEYWORD: "${clusterKeyword.targetKeyword}"
ARTICLE TYPE: ${clusterKeyword.articleType}
PARENT TOPIC: Hydrogen Therapy for ${cluster.condition}
PILLAR PAGE LINK: ${pillarLink}

SPECIFIC INSTRUCTIONS: ${typeInstruction}

REFERENCED STUDIES (use these as citations):
${studyRefs}

REQUIREMENTS:
1. Write 1,200-1,800 words
2. Use 8th-grade reading level
3. Structure with ## and ### markdown headings
4. Target keyword should appear naturally 3-5 times
5. Reference specific studies with inline links
6. Include a brief "Bottom Line" or "Key Takeaway" section
7. Link back to the pillar page at least once: [comprehensive research review](${pillarLink})
8. Include 3-5 FAQ questions at the end
9. Be honest — note when evidence is limited or preliminary
10. Use data points (sample sizes, percentages, p-values when available)
11. Write naturally — avoid keyword stuffing

Return JSON with these fields:
- "title": Article title (compelling, includes keyword naturally)
- "content": Full article in markdown
- "summary": 2-3 sentence summary
- "metaTitle": SEO title under 60 chars
- "metaDescription": 120-155 chars with CTA
- "ogTitle": Social title max 65 chars
- "ogDescription": Social description max 200 chars
- "semanticKeywords": 8-12 related keywords array
- "questionAnswerPairs": Array of {question, answer} pairs (3-5)
- "quickInsights": Key takeaways as bulleted string`;

  try {
    const systemPrompt = "You are an expert health science writer. Return only valid JSON.";

    const data = await ai.generateJSON(systemPrompt, prompt, {
      temperature: 0.7,
      maxTokens: 4000,
    });

    return {
      title: data.title || clusterKeyword.title,
      slug: clusterKeyword.slug,
      content: data.content || "",
      summary: data.summary || "",
      metaTitle: data.metaTitle || clusterKeyword.title.substring(0, 60),
      metaDescription: data.metaDescription || "",
      ogTitle: data.ogTitle || data.metaTitle || "",
      ogDescription: data.ogDescription || data.metaDescription || "",
      semanticKeywords: data.semanticKeywords || [],
      questionAnswerPairs: JSON.stringify(data.questionAnswerPairs || []),
      readingLevel: data.readingLevel || "general",
      articleType: `cluster_${clusterKeyword.articleType}`,
      quickInsights: data.quickInsights || "",
    };
  } catch (error) {
    console.error(`[ContentFactory] Error generating cluster post ${clusterKeyword.slug}:`, error);
    return null;
  }
}

// ============================================================
// Save Generated Content to Database
// ============================================================

/**
 * Save a generated article to the blogArticles table
 */
export async function saveGeneratedArticle(
  article: GeneratedArticle,
  studyId?: number,
): Promise<number | null> {
  try {
    // Check if slug already exists
    let slug = article.slug;
    const [existing] = await db.select({ id: blogArticles.id })
      .from(blogArticles)
      .where(eq(blogArticles.slug, slug))
      .limit(1);

    if (existing) {
      console.log(`[ContentFactory] Article with slug "${slug}" already exists (id: ${existing.id}), skipping`);
      return existing.id;
    }

    // Attach to a genuinely related study when the caller supplies one;
    // otherwise leave studyId null. blog_articles.study_id is nullable, so
    // standalone SEO/marketing articles are no longer misattributed to an
    // arbitrary (first-row / id 1) study and won't surface under its /:id/blogs
    // tab or get flagged by the retraction monitor.
    try {
      const [inserted] = await db.insert(blogArticles).values({
        studyId: studyId ?? null,
        title: article.title,
        slug,
        summary: article.summary,
        content: article.content,
        quickInsights: article.quickInsights,
        readingLevel: article.readingLevel,
        articleType: article.articleType,
        isPublished: true,
        metaTitle: article.metaTitle,
        metaDescription: article.metaDescription,
        ogTitle: article.ogTitle,
        ogDescription: article.ogDescription,
        semanticKeywords: article.semanticKeywords,
        questionAnswerPairs: article.questionAnswerPairs,
        canonicalUrl: `${SITE_URL}/blog/${slug}`,
      }).returning({ id: blogArticles.id });

      console.log(`[ContentFactory] Saved article: "${article.title}" (id: ${inserted.id})`);
      return inserted.id;
    } catch (insertError: any) {
      // Handle unique constraint violation (race condition: slug was inserted between our check and insert)
      if (insertError.code === "23505") {
        const uniqueSuffix = Date.now().toString().slice(-6);
        slug = `${article.slug}-${uniqueSuffix}`;
        console.log(`[ContentFactory] Slug collision for "${article.slug}", retrying with "${slug}"`);

        const [inserted] = await db.insert(blogArticles).values({
          studyId,
          title: article.title,
          slug,
          summary: article.summary,
          content: article.content,
          quickInsights: article.quickInsights,
          readingLevel: article.readingLevel,
          articleType: article.articleType,
          isPublished: true,
          metaTitle: article.metaTitle,
          metaDescription: article.metaDescription,
          ogTitle: article.ogTitle,
          ogDescription: article.ogDescription,
          semanticKeywords: article.semanticKeywords,
          questionAnswerPairs: article.questionAnswerPairs,
          canonicalUrl: `${SITE_URL}/blog/${slug}`,
        }).returning({ id: blogArticles.id });

        console.log(`[ContentFactory] Saved article with unique slug: "${article.title}" (id: ${inserted.id})`);
        return inserted.id;
      }
      throw insertError;
    }
  } catch (error) {
    console.error(`[ContentFactory] Error saving article "${article.slug}":`, error);
    return null;
  }
}

// ============================================================
// Batch Content Generation
// ============================================================

export interface ContentFactoryProgress {
  phase: "pillar" | "cluster";
  topicIndex: number;
  topicTotal: number;
  clusterIndex?: number;
  clusterTotal?: number;
  currentTopic: string;
  currentArticle: string;
  articlesGenerated: number;
  articlesFailed: number;
}

/**
 * Generate all pillar pages and cluster posts for all topics
 */
export async function runContentFactory(options: {
  maxTopics?: number;
  maxClustersPerTopic?: number;
  delayMs?: number;
  pillarOnly?: boolean;
  clusterOnly?: boolean;
  specificTopic?: string;
  onProgress?: (progress: ContentFactoryProgress) => void;
} = {}): Promise<{
  pillarsGenerated: number;
  clustersGenerated: number;
  failed: number;
  topics: string[];
}> {
  const {
    maxTopics = 100,
    maxClustersPerTopic = 5,
    delayMs = 2000,
    pillarOnly = false,
    clusterOnly = false,
    specificTopic,
    onProgress,
  } = options;

  let clusters = await generateTopicClusters();

  // Filter to specific topic if requested
  if (specificTopic) {
    clusters = clusters.filter(c =>
      c.condition.toLowerCase().includes(specificTopic.toLowerCase()) ||
      c.slug.includes(specificTopic.toLowerCase())
    );
  }

  // Limit topics
  clusters = clusters.slice(0, maxTopics);

  let pillarsGenerated = 0;
  let clustersGenerated = 0;
  let failed = 0;
  const topics: string[] = [];

  for (let ti = 0; ti < clusters.length; ti++) {
    const cluster = clusters[ti];
    topics.push(cluster.condition);

    // Generate pillar page
    if (!clusterOnly) {
      onProgress?.({
        phase: "pillar",
        topicIndex: ti,
        topicTotal: clusters.length,
        currentTopic: cluster.condition,
        currentArticle: cluster.pillarTitle,
        articlesGenerated: pillarsGenerated + clustersGenerated,
        articlesFailed: failed,
      });

      const pillar = await generatePillarPage(cluster);
      if (pillar) {
        // Find the most relevant study for the studyId FK
        const [topStudy] = await db.select({ id: studies.id })
          .from(studies)
          .where(
            or(
              ...cluster.categoryPatterns.map(p => ilike(studies.category, p)),
              ilike(studies.title, `%${cluster.condition}%`),
            )
          )
          .limit(1);

        const saved = await saveGeneratedArticle(pillar, topStudy?.id);
        if (saved) {
          pillarsGenerated++;
        } else {
          failed++;
        }
      } else {
        failed++;
      }

      if (delayMs > 0) await new Promise(r => setTimeout(r, delayMs));
    }

    // Generate cluster posts
    if (!pillarOnly) {
      const clusterKws = cluster.clusterKeywords.slice(0, maxClustersPerTopic);

      for (let ci = 0; ci < clusterKws.length; ci++) {
        const ckw = clusterKws[ci];

        onProgress?.({
          phase: "cluster",
          topicIndex: ti,
          topicTotal: clusters.length,
          clusterIndex: ci,
          clusterTotal: clusterKws.length,
          currentTopic: cluster.condition,
          currentArticle: ckw.title,
          articlesGenerated: pillarsGenerated + clustersGenerated,
          articlesFailed: failed,
        });

        const post = await generateClusterPost(cluster, ckw);
        if (post) {
          const [topStudy] = await db.select({ id: studies.id })
            .from(studies)
            .where(
              or(
                ...cluster.categoryPatterns.map(p => ilike(studies.category, p)),
                ilike(studies.title, `%${cluster.condition}%`),
              )
            )
            .limit(1);

          const saved = await saveGeneratedArticle(post, topStudy?.id);
          if (saved) {
            clustersGenerated++;
          } else {
            failed++;
          }
        } else {
          failed++;
        }

        if (delayMs > 0 && ci < clusterKws.length - 1) {
          await new Promise(r => setTimeout(r, delayMs));
        }
      }
    }
  }

  return { pillarsGenerated, clustersGenerated, failed, topics };
}

/**
 * Get content factory status — how many topics have content, how many don't
 */
export async function getContentFactoryStatus(): Promise<{
  totalTopics: number;
  topicsWithPillar: number;
  topicsWithoutPillar: number;
  totalClusterPosts: number;
  totalBlogPosts: number;
  topics: Array<{
    condition: string;
    studyCount: number;
    hasPillar: boolean;
    clusterCount: number;
  }>;
}> {
  const clusters = await generateTopicClusters();

  // Get all existing blog slugs
  const existingBlogs = await db.select({
    slug: blogArticles.slug,
    articleType: blogArticles.articleType,
  }).from(blogArticles);

  const blogSlugs = new Set(existingBlogs.map(b => b.slug));

  const [totalBlogsResult] = await db.select({ count: sql<number>`count(*)` }).from(blogArticles);

  const topics = clusters.map(cluster => {
    const pillarSlug = cluster.slug + "-hydrogen-therapy-research";
    const hasPillar = blogSlugs.has(pillarSlug);
    const clusterCount = cluster.clusterKeywords.filter(ck => blogSlugs.has(ck.slug)).length;

    // Get study count from category patterns (approximate)
    return {
      condition: cluster.condition,
      studyCount: 0, // Will be filled below
      hasPillar,
      clusterCount,
    };
  });

  return {
    totalTopics: clusters.length,
    topicsWithPillar: topics.filter(t => t.hasPillar).length,
    topicsWithoutPillar: topics.filter(t => !t.hasPillar).length,
    totalClusterPosts: existingBlogs.filter(b => b.articleType?.startsWith("cluster_")).length,
    totalBlogPosts: Number(totalBlogsResult?.count || 0),
    topics,
  };
}
