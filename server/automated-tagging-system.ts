/**
 * Automated Tagging System for Hydrogen Studies
 *
 * Analyzes study content to generate relevant tags for:
 * - Improved search functionality
 * - Better content sorting and filtering
 * - Enhanced SEO performance
 * - Content discovery and recommendations
 */

import { db } from "./db";
import {
  studies,
  tags,
  studyTags,
  tagCategories,
  tagSynonyms,
} from "@shared/schema";
import { eq, sql, ilike, and, or, inArray } from "drizzle-orm";
import { ai } from "./services/ai-provider";
import { logger } from "./utils/logger";

interface TaggingResult {
  studyId: number;
  tagsAdded: number;
  tagsFromTitle: string[];
  tagsFromAbstract: string[];
  tagsFromKeywords: string[];
  tagsFromAI: string[];
  processingTime: number;
}

interface TagDefinition {
  name: string;
  category: string;
  description?: string;
  synonyms?: string[];
  keywords: string[];
  color?: string;
}

/**
 * Predefined tag definitions for hydrogen research
 */
const HYDROGEN_TAG_DEFINITIONS: TagDefinition[] = [
  // Health Conditions
  {
    name: "Diabetes",
    category: "health_condition",
    description:
      "Studies related to diabetes mellitus and blood glucose management",
    synonyms: [
      "diabetes mellitus",
      "diabetic",
      "hyperglycemia",
      "blood glucose",
    ],
    keywords: [
      "diabetes",
      "diabetic",
      "glucose",
      "insulin",
      "hyperglycemia",
      "blood sugar",
    ],
    color: "#FF6B6B",
  },
  {
    name: "Cardiovascular Disease",
    category: "health_condition",
    description: "Heart and blood vessel related conditions",
    synonyms: ["heart disease", "cardiac", "cardiovascular", "coronary"],
    keywords: [
      "heart",
      "cardiac",
      "cardiovascular",
      "coronary",
      "myocardial",
      "arterial",
    ],
    color: "#FF4757",
  },
  {
    name: "Inflammation",
    category: "health_condition",
    description: "Inflammatory conditions and responses",
    synonyms: ["inflammatory", "inflammation", "anti-inflammatory"],
    keywords: [
      "inflammation",
      "inflammatory",
      "cytokine",
      "interleukin",
      "TNF",
      "NF-kB",
    ],
    color: "#FFA502",
  },
  {
    name: "Oxidative Stress",
    category: "mechanism",
    description:
      "Studies investigating oxidative stress and antioxidant effects",
    synonyms: [
      "reactive oxygen species",
      "ROS",
      "free radicals",
      "antioxidant",
    ],
    keywords: [
      "oxidative",
      "antioxidant",
      "ROS",
      "reactive oxygen",
      "free radical",
      "oxidation",
    ],
    color: "#2ED573",
  },
  {
    name: "Neuroprotection",
    category: "mechanism",
    description: "Protective effects on nervous system",
    synonyms: ["neuroprotective", "brain protection", "neuronal"],
    keywords: [
      "neuroprotection",
      "neuroprotective",
      "neuronal",
      "brain",
      "cognitive",
    ],
    color: "#5352ED",
  },

  // Body Systems
  {
    name: "Brain",
    category: "body_system",
    description: "Central nervous system and brain studies",
    synonyms: ["cerebral", "neural", "neurological", "cognitive"],
    keywords: [
      "brain",
      "cerebral",
      "neural",
      "cognitive",
      "neurological",
      "CNS",
    ],
    color: "#A4B0BE",
  },
  {
    name: "Liver",
    category: "body_system",
    description: "Hepatic system and liver function",
    synonyms: ["hepatic", "liver function"],
    keywords: ["liver", "hepatic", "hepatocyte", "bile", "hepatitis"],
    color: "#8B4513",
  },
  {
    name: "Kidney",
    category: "body_system",
    description: "Renal system and kidney function",
    synonyms: ["renal", "kidney function", "nephron"],
    keywords: ["kidney", "renal", "nephron", "glomerular", "creatinine"],
    color: "#6C5CE7",
  },

  // Study Types
  {
    name: "Human Study",
    category: "study_type",
    description: "Clinical trials and human research",
    synonyms: ["clinical trial", "human trial", "patient study"],
    keywords: ["human", "patient", "clinical", "participant", "volunteer"],
    color: "#00CEC9",
  },
  {
    name: "Animal Study",
    category: "study_type",
    description: "Preclinical animal research",
    synonyms: ["animal model", "in vivo", "rodent"],
    keywords: ["animal", "mouse", "rat", "rodent", "in vivo", "model"],
    color: "#FDCB6E",
  },
  {
    name: "Cell Study",
    category: "study_type",
    description: "In vitro cellular research",
    synonyms: ["in vitro", "cell culture", "cellular"],
    keywords: ["cell", "vitro", "culture", "cellular", "cultured"],
    color: "#E17055",
  },

  // Delivery Methods
  {
    name: "Hydrogen Water",
    category: "delivery_method",
    description: "Hydrogen-rich water administration",
    synonyms: ["hydrogen-rich water", "HRW", "molecular hydrogen water"],
    keywords: ["hydrogen water", "hydrogen-rich", "HRW", "drinking water"],
    color: "#00B894",
  },
  {
    name: "Hydrogen Gas Inhalation",
    category: "delivery_method",
    description: "Inhalation of hydrogen gas",
    synonyms: ["hydrogen inhalation", "H2 gas", "inhalation therapy"],
    keywords: ["inhalation", "inhaled", "gas", "breathing", "respiratory"],
    color: "#74B9FF",
  },
  {
    name: "Hydrogen Injection",
    category: "delivery_method",
    description: "Injectable hydrogen solutions",
    synonyms: ["hydrogen injection", "H2 injection", "saline injection"],
    keywords: [
      "injection",
      "injected",
      "saline",
      "intravenous",
      "subcutaneous",
    ],
    color: "#FD79A8",
  },

  // Outcomes
  {
    name: "Positive Effect",
    category: "outcome",
    description: "Studies showing beneficial effects",
    synonyms: ["beneficial", "improvement", "therapeutic"],
    keywords: [
      "improved",
      "beneficial",
      "therapeutic",
      "positive",
      "effective",
    ],
    color: "#00B894",
  },
  {
    name: "No Effect",
    category: "outcome",
    description: "Studies showing no significant effect",
    synonyms: ["neutral", "no change", "non-significant"],
    keywords: ["no effect", "neutral", "non-significant", "unchanged"],
    color: "#DDD",
  },
];

/**
 * Initialize the tagging system database tables
 */
export async function initializeTaggingSystem(): Promise<void> {
  logger.info("Initializing automated tagging system", "AutomatedTagging");

  try {
    // Create tag categories
    const categories = [
      {
        name: "Health Conditions",
        slug: "health_condition",
        description: "Medical conditions and diseases",
        color: "#FF6B6B",
        sortOrder: 1,
      },
      {
        name: "Body Systems",
        slug: "body_system",
        description: "Organ systems and anatomical regions",
        color: "#A4B0BE",
        sortOrder: 2,
      },
      {
        name: "Mechanisms",
        slug: "mechanism",
        description: "Biological mechanisms and pathways",
        color: "#2ED573",
        sortOrder: 3,
      },
      {
        name: "Study Types",
        slug: "study_type",
        description: "Types of research studies",
        color: "#00CEC9",
        sortOrder: 4,
      },
      {
        name: "Delivery Methods",
        slug: "delivery_method",
        description: "Methods of hydrogen administration",
        color: "#74B9FF",
        sortOrder: 5,
      },
      {
        name: "Outcomes",
        slug: "outcome",
        description: "Study results and effects",
        color: "#00B894",
        sortOrder: 6,
      },
    ];

    for (const category of categories) {
      await db.insert(tagCategories).values(category).onConflictDoNothing();
    }

    // Create predefined tags
    for (const tagDef of HYDROGEN_TAG_DEFINITIONS) {
      // Insert tag
      const [tag] = await db
        .insert(tags)
        .values({
          name: tagDef.name,
          slug: tagDef.name.toLowerCase().replace(/\s+/g, "-"),
          category: tagDef.category,
          description: tagDef.description,
          color: tagDef.color,
          isSystemGenerated: true,
        })
        .onConflictDoNothing()
        .returning();

      // Add synonyms if tag was created
      if (tag && tagDef.synonyms) {
        for (const synonym of tagDef.synonyms) {
          await db
            .insert(tagSynonyms)
            .values({
              tagId: tag.id,
              synonym: synonym.toLowerCase(),
            })
            .onConflictDoNothing();
        }
      }
    }

    logger.info("Tagging system initialized successfully", "AutomatedTagging");
  } catch (error) {
    logger.error("Error initializing tagging system", error, "AutomatedTagging");
    throw error;
  }
}

/**
 * Extract tags from study content using rule-based matching
 */
async function extractTagsFromContent(study: any): Promise<{
  titleTags: string[];
  abstractTags: string[];
  keywordTags: string[];
}> {
  const titleTags: string[] = [];
  const abstractTags: string[] = [];
  const keywordTags: string[] = [];

  const title = (study.title || "").toLowerCase();
  const abstract = (study.abstract || "").toLowerCase();
  const keywords = study.keywords || [];

  // Get all tags with their synonyms
  const allTags = await db
    .select({
      id: tags.id,
      name: tags.name,
      category: tags.category,
    })
    .from(tags);

  const tagSynonymsData = await db
    .select({
      tagId: tagSynonyms.tagId,
      synonym: tagSynonyms.synonym,
    })
    .from(tagSynonyms);

  // Create synonym mapping
  const synonymMap = new Map<number, string[]>();
  tagSynonymsData.forEach((syn) => {
    if (!synonymMap.has(syn.tagId)) {
      synonymMap.set(syn.tagId, []);
    }
    synonymMap.get(syn.tagId)!.push(syn.synonym);
  });

  // Match tags against content
  for (const tag of allTags) {
    const tagKeywords = [tag.name.toLowerCase()];
    const synonyms = synonymMap.get(tag.id) || [];
    tagKeywords.push(...synonyms);

    // Find matching tag definition for additional keywords
    const tagDef = HYDROGEN_TAG_DEFINITIONS.find(
      (def) => def.name.toLowerCase() === tag.name.toLowerCase(),
    );
    if (tagDef) {
      tagKeywords.push(...tagDef.keywords.map((k) => k.toLowerCase()));
    }

    // Check title
    if (tagKeywords.some((keyword) => title.includes(keyword))) {
      titleTags.push(tag.name);
    }

    // Check abstract
    if (tagKeywords.some((keyword) => abstract.includes(keyword))) {
      abstractTags.push(tag.name);
    }

    // Check existing keywords
    if (
      keywords.some((kw: string) =>
        tagKeywords.some((keyword) => kw.toLowerCase().includes(keyword)),
      )
    ) {
      keywordTags.push(tag.name);
    }
  }

  // Remove duplicates using filter
  const uniqueTitleTags = titleTags.filter(
    (tag, index) => titleTags.indexOf(tag) === index,
  );
  const uniqueAbstractTags = abstractTags.filter(
    (tag, index) => abstractTags.indexOf(tag) === index,
  );
  const uniqueKeywordTags = keywordTags.filter(
    (tag, index) => keywordTags.indexOf(tag) === index,
  );

  return {
    titleTags: uniqueTitleTags,
    abstractTags: uniqueAbstractTags,
    keywordTags: uniqueKeywordTags,
  };
}

/**
 * Extract additional tags using AI analysis
 */
async function extractTagsWithAI(study: any): Promise<string[]> {
  if (ai.getProviderStatus().primary === "none") {
    return [];
  }

  try {
    const systemPrompt = "You are a medical research tag extractor. Analyze studies and return relevant tags as JSON.";

    const userPrompt = `Analyze this hydrogen research study and extract relevant medical and scientific tags.

Title: ${study.title}
Abstract: ${study.abstract || "No abstract available"}

Based on the content, identify relevant tags from these categories:
- Health conditions (diseases, disorders, symptoms)
- Body systems (organs, anatomical regions)
- Research methodology (study type, techniques)
- Biological mechanisms (pathways, processes)
- Treatment outcomes (effects, results)

Return a JSON object with a "tags" array of tag names, maximum 8 tags.`;

    const result = await ai.generateJSON(systemPrompt, userPrompt, {
      maxTokens: 200,
      temperature: 0.3,
    });

    return Array.isArray(result.tags) ? result.tags.slice(0, 8) : [];
  } catch (error) {
    logger.error("Error extracting tags with AI", error, "AutomatedTagging");
    return [];
  }
}

/**
 * Apply tags to a single study
 */
export async function tagSingleStudy(studyId: number): Promise<TaggingResult> {
  const startTime = Date.now();

  try {
    // Get study data - only select fields that exist
    const [study] = await db
      .select({
        id: studies.id,
        title: studies.title,
        abstract: studies.abstract,
        keywords: studies.keywords,
        methods: studies.methods,
        results: studies.results,
        conclusion: studies.conclusion,
        category: studies.category,
        studyType: studies.studyType,
      })
      .from(studies)
      .where(eq(studies.id, studyId));

    if (!study) {
      throw new Error(`Study with ID ${studyId} not found`);
    }

    // Extract tags from content
    const { titleTags, abstractTags, keywordTags } =
      await extractTagsFromContent(study);

    // Extract additional tags with AI
    const aiTags = await extractTagsWithAI(study);

    // Combine all tags
    const allExtractedTags = [
      ...titleTags.map((tag) => ({
        name: tag,
        source: "title",
        confidence: 95,
      })),
      ...abstractTags.map((tag) => ({
        name: tag,
        source: "abstract",
        confidence: 90,
      })),
      ...keywordTags.map((tag) => ({
        name: tag,
        source: "keywords",
        confidence: 100,
      })),
      ...aiTags.map((tag) => ({ name: tag, source: "ai", confidence: 85 })),
    ];

    // Remove duplicates, keeping highest confidence
    const uniqueTags = allExtractedTags.reduce(
      (acc, current) => {
        const existing = acc.find(
          (tag) => tag.name.toLowerCase() === current.name.toLowerCase(),
        );
        if (!existing || current.confidence > existing.confidence) {
          return [
            ...acc.filter(
              (tag) => tag.name.toLowerCase() !== current.name.toLowerCase(),
            ),
            current,
          ];
        }
        return acc;
      },
      [] as typeof allExtractedTags,
    );

    // Clear existing tags for this study
    await db.delete(studyTags).where(eq(studyTags.studyId, studyId));

    let tagsAdded = 0;

    // Add new tags
    for (const tagData of uniqueTags) {
      // Find or create tag
      let [tag] = await db
        .select()
        .from(tags)
        .where(ilike(tags.name, tagData.name));

      if (!tag) {
        // Create new tag if it doesn't exist
        [tag] = await db
          .insert(tags)
          .values({
            name: tagData.name,
            slug: tagData.name.toLowerCase().replace(/\s+/g, "-"),
            category: "uncategorized",
            isSystemGenerated: true,
          })
          .returning();
      }

      if (tag) {
        // Add study-tag relationship
        await db
          .insert(studyTags)
          .values({
            studyId: studyId,
            tagId: tag.id,
            confidence: tagData.confidence,
            source: tagData.source,
          })
          .onConflictDoNothing();

        // Update tag usage count
        await db
          .update(tags)
          .set({ usageCount: sql`${tags.usageCount} + 1` })
          .where(eq(tags.id, tag.id));

        tagsAdded++;
      }
    }

    const processingTime = Date.now() - startTime;

    return {
      studyId,
      tagsAdded,
      tagsFromTitle: titleTags,
      tagsFromAbstract: abstractTags,
      tagsFromKeywords: keywordTags,
      tagsFromAI: aiTags,
      processingTime,
    };
  } catch (error) {
    logger.error("Error tagging study", error, "AutomatedTagging", { studyId });
    throw error;
  }
}

/**
 * Process all studies for automated tagging
 */
export async function processAllStudiesForTagging(): Promise<{
  totalStudies: number;
  successfullyTagged: number;
  errors: number;
  totalTagsAdded: number;
  avgProcessingTime: number;
}> {
  logger.info("Starting automated tagging for all studies", "AutomatedTagging");

  const allStudies = await db.select({ id: studies.id }).from(studies);

  let successfullyTagged = 0;
  let errors = 0;
  let totalTagsAdded = 0;
  let totalProcessingTime = 0;

  for (let i = 0; i < allStudies.length; i++) {
    const study = allStudies[i];

    try {
      logger.info("Tagging study", "AutomatedTagging", { progress: `${i + 1}/${allStudies.length}`, studyId: study.id });

      const result = await tagSingleStudy(study.id);

      successfullyTagged++;
      totalTagsAdded += result.tagsAdded;
      totalProcessingTime += result.processingTime;

      if (result.tagsAdded > 0) {
        logger.info("Added tags to study", "AutomatedTagging", { tagsAdded: result.tagsAdded });
      } else {
        logger.info("No new tags added", "AutomatedTagging");
      }
    } catch (error) {
      logger.error("Error tagging study in batch", error, "AutomatedTagging", { studyId: study.id });
      errors++;
    }

    // Brief delay to avoid overwhelming APIs
    if (i < allStudies.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  const avgProcessingTime =
    totalProcessingTime / Math.max(successfullyTagged, 1);

  logger.info("Automated tagging complete", "AutomatedTagging", {
    totalStudies: allStudies.length,
    successfullyTagged,
    errors,
    totalTagsAdded,
    avgProcessingTimeMs: Math.round(avgProcessingTime),
  });

  return {
    totalStudies: allStudies.length,
    successfullyTagged,
    errors,
    totalTagsAdded,
    avgProcessingTime,
  };
}

/**
 * Get tagging statistics
 */
export async function getTaggingStats(): Promise<{
  totalTags: number;
  totalStudyTags: number;
  topTags: Array<{ name: string; count: number; category: string }>;
  tagsByCategory: Array<{ category: string; count: number }>;
}> {
  const totalTags = await db.$count(tags);
  const totalStudyTags = await db.$count(studyTags);

  const topTagsResult = await db
    .select({
      name: tags.name,
      category: tags.category,
      count: tags.usageCount,
    })
    .from(tags)
    .orderBy(sql`${tags.usageCount} DESC`)
    .limit(20);

  // Ensure count is never null
  const topTags = topTagsResult.map((tag) => ({
    name: tag.name,
    category: tag.category,
    count: tag.count || 0,
  }));

  const categoryStatsResult = await db
    .select({
      category: tags.category,
      count: sql<number>`COUNT(*)::int`,
    })
    .from(tags)
    .groupBy(tags.category)
    .orderBy(sql`COUNT(*) DESC`);

  return {
    totalTags,
    totalStudyTags,
    topTags,
    tagsByCategory: categoryStatsResult.map((stat) => ({
      category: stat.category,
      count: stat.count || 0,
    })),
  };
}
