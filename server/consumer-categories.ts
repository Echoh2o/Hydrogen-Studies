/**
 * Consumer-Friendly Categorization System for Hydrogen Studies
 *
 * Implements a multi-model categorization approach focused on making
 * research more accessible to regular users through condition-focused,
 * body system, and life stage/audience categories.
 */
import { db } from "./db";
import { studies as studiesTable } from "../shared/schema";
import { eq, isNull, like } from "drizzle-orm";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Define the categorization models
export enum CategorizationModel {
  CONDITION = "condition",
  BODY_SYSTEM = "body_system",
  LIFE_STAGE = "life_stage",
}

// Consumer-friendly category definitions
export const ConsumerCategories = {
  // Condition-Focused Categories (By Disease/Ailment)
  [CategorizationModel.CONDITION]: [
    "Diabetes & Metabolic Health",
    "Heart Disease & Hypertension",
    "Brain & Neurological Disorders",
    "Arthritis & Inflammation",
    "Lung & Respiratory Conditions",
    "Digestive Health (Gut/Liver)",
    "Cancer Supportive Care",
  ],

  // Body System Categories (By Health Area)
  [CategorizationModel.BODY_SYSTEM]: [
    "Cardiovascular Health",
    "Neurological Health",
    "Respiratory Health",
    "Digestive Health",
    "Immune System & Allergies",
    "Musculoskeletal Health",
    "Skin & Dermatological Health",
    "Endocrine & Hormonal Health",
  ],

  // Life Stage / Audience Categories (By Demographic or Lifestyle)
  [CategorizationModel.LIFE_STAGE]: [
    "Women's Health",
    "Men's Health",
    "Children's Health",
    "Senior Health (Healthy Aging)",
    "Athletic Performance & Recovery",
    "General Wellness & Prevention",
  ],
};

// Keywords mapping to help with categorization
const CategoryKeywordMap = {
  "Diabetes & Metabolic Health": [
    "diabetes",
    "metabolic",
    "insulin",
    "blood sugar",
    "glucose",
    "metabolic syndrome",
    "obesity",
    "weight",
  ],
  "Heart Disease & Hypertension": [
    "heart",
    "cardiovascular",
    "blood pressure",
    "hypertension",
    "cholesterol",
    "coronary",
    "cardiac",
    "circulation",
  ],
  "Brain & Neurological Disorders": [
    "brain",
    "neuro",
    "cognitive",
    "memory",
    "alzheimer",
    "parkinson",
    "stroke",
    "dementia",
    "neuroprotective",
  ],
  "Arthritis & Inflammation": [
    "arthritis",
    "inflammation",
    "joint",
    "rheumatoid",
    "osteoarthritis",
    "inflammatory",
    "anti-inflammatory",
  ],
  "Lung & Respiratory Conditions": [
    "lung",
    "pulmonary",
    "respiratory",
    "asthma",
    "copd",
    "breathing",
    "airway",
    "pneumonia",
  ],
  "Digestive Health (Gut/Liver)": [
    "gut",
    "liver",
    "digestive",
    "intestinal",
    "gastrointestinal",
    "colitis",
    "hepatic",
    "stomach",
  ],
  "Cancer Supportive Care": [
    "cancer",
    "tumor",
    "oncology",
    "chemotherapy",
    "radiation",
    "carcinoma",
    "malignant",
  ],

  "Cardiovascular Health": [
    "heart",
    "cardiovascular",
    "blood pressure",
    "cholesterol",
    "circulation",
    "artery",
    "vascular",
  ],
  "Neurological Health": [
    "brain",
    "neuro",
    "cognitive",
    "memory",
    "nerve",
    "nervous system",
    "mental health",
  ],
  "Respiratory Health": [
    "lung",
    "breathing",
    "respiratory",
    "pulmonary",
    "oxygen",
    "airway",
  ],
  "Digestive Health": [
    "digestion",
    "gut",
    "intestine",
    "liver",
    "stomach",
    "bowel",
    "gastrointestinal",
  ],
  "Immune System & Allergies": [
    "immune",
    "allergy",
    "autoimmune",
    "infection",
    "inflammation",
    "immunity",
  ],
  "Musculoskeletal Health": [
    "muscle",
    "bone",
    "joint",
    "skeletal",
    "arthritis",
    "exercise",
    "recovery",
  ],
  "Skin & Dermatological Health": [
    "skin",
    "derma",
    "wound",
    "healing",
    "burn",
    "acne",
    "dermatitis",
  ],
  "Endocrine & Hormonal Health": [
    "hormone",
    "endocrine",
    "thyroid",
    "insulin",
    "testosterone",
    "estrogen",
    "cortisol",
  ],

  "Women's Health": [
    "women",
    "female",
    "menopause",
    "pregnancy",
    "osteoporosis",
    "breast",
    "menstrual",
  ],
  "Men's Health": ["men", "male", "prostate", "testosterone", "erectile"],
  "Children's Health": [
    "child",
    "pediatric",
    "youth",
    "adolescent",
    "development",
    "growth",
  ],
  "Senior Health (Healthy Aging)": [
    "aging",
    "elderly",
    "senior",
    "age-related",
    "longevity",
    "geriatric",
  ],
  "Athletic Performance & Recovery": [
    "athletic",
    "exercise",
    "workout",
    "performance",
    "fitness",
    "endurance",
    "muscle recovery",
    "sport",
  ],
  "General Wellness & Prevention": [
    "wellness",
    "prevention",
    "health maintenance",
    "antioxidant",
    "stress",
    "fatigue",
    "energy",
    "sleep",
  ],
};

/**
 * Use AI to categorize a study into the consumer-friendly categories
 * @param studyId ID of the study to categorize
 * @returns Results of the categorization process
 */
export async function categorizeStudyForConsumers(studyId: number): Promise<{
  success: boolean;
  message: string;
  categories?: {
    condition: string[];
    bodySystem: string[];
    lifeStage: string[];
  };
}> {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return {
        success: false,
        message: "OPENAI_API_KEY not set, unable to categorize study",
      };
    }

    // Get the study data
    const [study] =
      (await db
        ?.select()
        .from(studiesTable)
        .where(eq(studiesTable.id, studyId))) || [];

    if (!study) {
      return {
        success: false,
        message: `Study with ID ${studyId} not found`,
      };
    }

    // Extract relevant information for categorization
    const title = study.title || "";
    const abstract = study.abstract || "";
    const methods = study.methods || "";
    const results = study.results || "";
    const conclusion = study.conclusion || "";

    // Combine the study content for analysis
    const studyContent = `
      TITLE: ${title}
      
      ABSTRACT: ${abstract}
      
      METHODS: ${methods}
      
      RESULTS: ${results}
      
      CONCLUSION: ${conclusion}
    `;

    // Use OpenAI to categorize the study
    const response = await openai.chat.completions.create({
      model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
      messages: [
        {
          role: "system",
          content: `You are a scientific categorization expert specializing in hydrogen health research. 
          Your task is to categorize a research study into consumer-friendly categories for a health research platform.
          Analyze the study carefully and determine which categories it fits into based on the content.
          Return ONLY a JSON object with your categorization, no other text.`,
        },
        {
          role: "user",
          content: `Please categorize this hydrogen health research study into the following consumer-friendly category groups:

          CONDITION-FOCUSED CATEGORIES:
          - Diabetes & Metabolic Health
          - Heart Disease & Hypertension
          - Brain & Neurological Disorders
          - Arthritis & Inflammation
          - Lung & Respiratory Conditions
          - Digestive Health (Gut/Liver)
          - Cancer Supportive Care
          
          BODY SYSTEM CATEGORIES:
          - Cardiovascular Health
          - Neurological Health
          - Respiratory Health
          - Digestive Health
          - Immune System & Allergies
          - Musculoskeletal Health
          - Skin & Dermatological Health
          - Endocrine & Hormonal Health
          
          LIFE STAGE / AUDIENCE CATEGORIES:
          - Women's Health
          - Men's Health
          - Children's Health
          - Senior Health (Healthy Aging)
          - Athletic Performance & Recovery
          - General Wellness & Prevention
          
          STUDY CONTENT:
          ${studyContent}
          
          For each category group, assign one or more categories that apply to this study.
          If a category doesn't apply, don't include it.
          Format your response as JSON with this structure:
          {
            "condition": ["applicable categories"],
            "bodySystem": ["applicable categories"],
            "lifeStage": ["applicable categories"]
          }`,
        },
      ],
      response_format: { type: "json_object" },
      temperature: 0.3,
    });

    // Extract and parse the categorization result
    const categorization = JSON.parse(response.choices[0].message.content);

    // Update the study with the new categories
    await updateStudyWithConsumerCategories(studyId, categorization);

    return {
      success: true,
      message:
        "Study successfully categorized for consumer-friendly navigation",
      categories: categorization,
    };
  } catch (error) {
    console.error("Error categorizing study for consumers:", error);
    return {
      success: false,
      message: `Error categorizing study: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}

/**
 * Update a study with consumer-friendly categories
 * @param studyId ID of the study to update
 * @param categories Category data to save
 */
async function updateStudyWithConsumerCategories(
  studyId: number,
  categories: {
    condition: string[];
    bodySystem: string[];
    lifeStage: string[];
  },
): Promise<void> {
  try {
    // Serialize the categories for storage
    const consumerCategories = JSON.stringify(categories);

    // Update the study record with the new categories
    await db
      ?.update(studiesTable)
      .set({
        // Using a 'custom' or 'consumerCategories' field to store this data
        // This allows us to keep the original category field intact while adding this new information
        consumerCategories,
        updatedAt: new Date(),
      })
      .where(eq(studiesTable.id, studyId));
  } catch (error) {
    console.error(
      `Error updating study ${studyId} with consumer categories:`,
      error,
    );
    throw error;
  }
}

/**
 * Batch categorize multiple studies
 * @param limit Maximum number of studies to process
 * @returns Results of batch processing
 */
export async function batchCategorizeStudies(limit: number = 10): Promise<{
  total: number;
  success: number;
  failed: number;
  errors: Array<{ studyId: number; error: string }>;
}> {
  const results = {
    total: 0,
    success: 0,
    failed: 0,
    errors: [] as Array<{ studyId: number; error: string }>,
  };

  try {
    // Find studies that haven't been categorized yet
    const studyIds = await findUncategorizedStudies(limit);
    results.total = studyIds.length;

    if (studyIds.length === 0) {
      return results;
    }

    // Process each study with a delay to avoid rate limits
    for (const studyId of studyIds) {
      try {
        console.log(
          `Categorizing study ${studyId} for consumer-friendly navigation...`,
        );
        const result = await categorizeStudyForConsumers(studyId);

        if (result.success) {
          results.success++;
          console.log(`Successfully categorized study ${studyId}`);
        } else {
          results.failed++;
          results.errors.push({
            studyId,
            error: result.message,
          });
          console.error(
            `Failed to categorize study ${studyId}: ${result.message}`,
          );
        }
      } catch (error) {
        results.failed++;
        results.errors.push({
          studyId,
          error: error instanceof Error ? error.message : "Unknown error",
        });
        console.error(`Error categorizing study ${studyId}:`, error);
      }

      // Add a delay to avoid rate limits
      console.log("Waiting 5 seconds before processing next study...");
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }

    return results;
  } catch (error) {
    console.error("Error in batch categorization:", error);
    return results;
  }
}

/**
 * Find studies that haven't been categorized with consumer-friendly categories
 * @param limit Maximum number of studies to return
 * @returns Array of study IDs
 */
async function findUncategorizedStudies(limit: number = 20): Promise<number[]> {
  try {
    // Find studies that haven't had consumer categories assigned yet
    const uncategorizedStudies = await db
      ?.select({ id: studiesTable.id })
      .from(studiesTable)
      .where(isNull(studiesTable.consumerCategories))
      .limit(limit);

    if (!uncategorizedStudies || uncategorizedStudies.length === 0) {
      console.log("No studies found that need consumer categorization");
      return [];
    }

    console.log(
      `Found ${uncategorizedStudies.length} studies that need consumer categorization`,
    );
    return uncategorizedStudies.map((study) => study.id);
  } catch (error) {
    console.error("Error finding uncategorized studies:", error);
    return [];
  }
}

/**
 * Search for studies by consumer category
 * @param categoryModel The categorization model to search within
 * @param category The specific category to search for
 * @param limit Maximum number of studies to return
 * @returns Array of matching studies
 */
export async function findStudiesByConsumerCategory(
  categoryModel: CategorizationModel,
  category: string,
  limit: number = 50,
): Promise<any[]> {
  try {
    // Convert model to the property name in our JSON structure
    let jsonField: string;
    switch (categoryModel) {
      case CategorizationModel.CONDITION:
        jsonField = "condition";
        break;
      case CategorizationModel.BODY_SYSTEM:
        jsonField = "bodySystem";
        break;
      case CategorizationModel.LIFE_STAGE:
        jsonField = "lifeStage";
        break;
      default:
        jsonField = "condition";
    }

    // PostgreSQL JSON query to find studies with the specified category
    // Using JSON containment operators to check if the category exists in the array
    const studies = await db
      ?.select()
      .from(studiesTable)
      .where(
        // This is a simplification - actual implementation would require proper JSON query based on database provider
        like(studiesTable.consumerCategories, `%${category}%`),
      )
      .limit(limit);

    return studies || [];
  } catch (error) {
    console.error(
      `Error finding studies by consumer category (${categoryModel}: ${category}):`,
      error,
    );
    return [];
  }
}

/**
 * Get all available categories across all models
 * @returns Object containing all category models with their categories
 */
export function getAllConsumerCategories() {
  return ConsumerCategories;
}

/**
 * Get counts of studies for each consumer category
 * This is useful for displaying category navigation with counts
 * @returns Category counts for each model
 */
export async function getConsumerCategoryCounts(): Promise<{
  condition: Record<string, number>;
  bodySystem: Record<string, number>;
  lifeStage: Record<string, number>;
}> {
  // Initialize the result object with zeros for all categories
  const result = {
    condition: Object.fromEntries(
      ConsumerCategories[CategorizationModel.CONDITION].map((cat) => [cat, 0]),
    ),
    bodySystem: Object.fromEntries(
      ConsumerCategories[CategorizationModel.BODY_SYSTEM].map((cat) => [
        cat,
        0,
      ]),
    ),
    lifeStage: Object.fromEntries(
      ConsumerCategories[CategorizationModel.LIFE_STAGE].map((cat) => [cat, 0]),
    ),
  };

  try {
    // Get all studies with consumer categories
    const studies = await db
      ?.select({
        id: studiesTable.id,
        consumerCategories: studiesTable.consumerCategories,
      })
      .from(studiesTable)
      .where(isNull(studiesTable.consumerCategories).not());

    if (!studies || studies.length === 0) {
      return result;
    }

    // Count studies for each category
    for (const study of studies) {
      if (!study.consumerCategories) continue;

      try {
        const categories = JSON.parse(study.consumerCategories);

        // Count condition categories
        if (categories.condition) {
          for (const cat of categories.condition) {
            if (result.condition[cat] !== undefined) {
              result.condition[cat]++;
            }
          }
        }

        // Count body system categories
        if (categories.bodySystem) {
          for (const cat of categories.bodySystem) {
            if (result.bodySystem[cat] !== undefined) {
              result.bodySystem[cat]++;
            }
          }
        }

        // Count life stage categories
        if (categories.lifeStage) {
          for (const cat of categories.lifeStage) {
            if (result.lifeStage[cat] !== undefined) {
              result.lifeStage[cat]++;
            }
          }
        }
      } catch (e) {
        console.error(
          `Error parsing consumer categories for study ${study.id}:`,
          e,
        );
      }
    }

    return result;
  } catch (error) {
    console.error("Error getting consumer category counts:", error);
    return result;
  }
}
