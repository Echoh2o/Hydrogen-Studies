import express from "express";
import { db } from "../db";
import { studies } from "../../shared/schema";
import { sql } from "drizzle-orm";

const router = express.Router();

// High-performance cache for category counts
let categoryCountsCache: any = null;
let cacheTimestamp = 0;
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

// Get consumer categories' names - use specific path to avoid conflict with homepage
router.get("/list", async (req, res) => {
  // Set content type to JSON explicitly
  res.setHeader("Content-Type", "application/json");
  try {
    // Health condition categories
    const conditionCategories = [
      "Heart Disease & Hypertension",
      "Brain & Neurological Disorders",
      "Diabetes & Metabolic Health",
      "Arthritis & Inflammation",
      "Lung & Respiratory Conditions",
      "Digestive Health (Gut/Liver)",
      "Cancer Supportive Care",
    ];

    // Body system categories
    const bodySystemCategories = [
      "Cardiovascular System",
      "Nervous System",
      "Respiratory System",
      "Digestive System",
      "Immune System",
      "Musculoskeletal System",
      "Renal System",
      "Integumentary System",
    ];

    // Life stage categories
    const lifeStageCategories = [
      "Infants & Newborns",
      "Children & Adolescents",
      "Adults",
      "Older Adults",
      "Athletes & Fitness",
    ];

    return res.json({
      success: true,
      data: {
        condition: conditionCategories,
        body_system: bodySystemCategories,
        life_stage: lifeStageCategories,
      },
    });
  } catch (error) {
    console.error("Error fetching categories:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to retrieve categories",
    });
  }
});

// Get counts for all categorization types
router.get("/counts", async (req, res) => {
  // Set content type to JSON explicitly
  res.setHeader("Content-Type", "application/json");

  // Check cache first for immediate response
  const now = Date.now();
  if (categoryCountsCache && now - cacheTimestamp < CACHE_TTL) {
    return res.json(categoryCountsCache);
  }

  try {
    const { pool } = await import("../db");

    // Map consumer-friendly names to database category names
    const categoryMapping: Record<string, string> = {
      "Heart Disease & Hypertension": "Cardiovascular",
      "Brain & Neurological Disorders": "Neurological",
      "Diabetes & Metabolic Health": "Metabolic",
      "Arthritis & Inflammation": "Inflammation",
      "Lung & Respiratory Conditions": "Respiratory",
      "Digestive Health (Gut/Liver)": "Gastrointestinal",
      "Cancer Supportive Care": "Cancer Research",
      "Cardiovascular Health": "Cardiovascular",
      "Neurological Health": "Neurological",
      "Metabolic Health": "Metabolic",
      Inflammation: "Inflammation",
      "Respiratory Health": "Respiratory",
      "Kidney Health": "Kidney",
      "Skin Health": "Dermatology",
      "Healthy Aging": "Aging",
      "Cardiovascular System": "Cardiovascular",
      "Nervous System": "Neurological",
      "Respiratory System": "Respiratory",
      "Digestive System": "Gastrointestinal",
      "Immune System": "Inflammation",
      "Musculoskeletal System": "Inflammation",
      "Renal System": "Kidney",
      "Integumentary System": "Dermatology",
      Adults: "Aging",
      "Older Adults": "Aging",
      "Athletes & Fitness": "Fitness",
    };

    const conditionCategories = [
      "Heart Disease & Hypertension",
      "Brain & Neurological Disorders",
      "Diabetes & Metabolic Health",
      "Arthritis & Inflammation",
      "Lung & Respiratory Conditions",
      "Digestive Health (Gut/Liver)",
      "Cancer Supportive Care",
    ];

    const bodySystemCategories = [
      "Cardiovascular System",
      "Nervous System",
      "Respiratory System",
      "Digestive System",
      "Immune System",
      "Musculoskeletal System",
      "Renal System",
      "Integumentary System",
    ];

    const lifeStageCategories = [
      "Adults",
      "Older Adults",
      "Athletes & Fitness",
    ];

    // Try join table first, then fall back to consumer_categories JSON + keyword search
    let countMap: Record<string, number> = {};

    try {
      const allCounts = await pool.query(`
        SELECT c.name, COUNT(DISTINCT s.id) as count
        FROM studies s
        INNER JOIN study_categories sc ON s.id = sc.study_id
        INNER JOIN categories c ON sc.category_id = c.id
        WHERE c.name IN (
          'Cardiovascular', 'Neurological', 'Metabolic', 'Inflammation',
          'Respiratory', 'Gastrointestinal', 'Cancer Research', 'Kidney',
          'Dermatology', 'Aging', 'Fitness'
        )
        GROUP BY c.name
      `);

      allCounts.rows.forEach((row: any) => {
        countMap[row.name] = parseInt(row.count);
      });
    } catch (e) {
      // Join table may not exist yet
    }

    // If join table gave no results, fall back to consumer_categories JSON field + category column
    const totalFromJoin = Object.values(countMap).reduce((a, b) => a + b, 0);
    if (totalFromJoin === 0) {
      // Fallback: count by study category column matching
      const fallbackMapping: Record<string, string[]> = {
        "Cardiovascular": ["cardiovascular"],
        "Neurological": ["neurological"],
        "Metabolic": ["diabetes"],
        "Inflammation": ["inflammation"],
        "Respiratory": ["respiratory"],
        "Gastrointestinal": ["digestive", "hepatic"],
        "Cancer Research": ["cancer"],
        "Kidney": ["kidney"],
        "Dermatology": ["dermatology"],
        "Aging": ["review", "antioxidant"],
        "Fitness": ["exercise"],
      };

      for (const [consumerName, dbCategories] of Object.entries(fallbackMapping)) {
        const placeholders = dbCategories.map((_, i) => `$${i + 1}`).join(', ');
        const result = await pool.query(
          `SELECT COUNT(*) as count FROM studies WHERE category IN (${placeholders})`,
          dbCategories
        );
        countMap[consumerName] = parseInt(result.rows[0]?.count || '0');
      }
    }

    // Map to consumer-friendly names with authentic counts
    const healthConditionCounts = conditionCategories.map((name) => ({
      name,
      count: (countMap[categoryMapping[name]] || 0).toString(),
    }));

    const bodySystemCounts = bodySystemCategories.map((name) => ({
      name,
      count: (countMap[categoryMapping[name]] || 0).toString(),
    }));

    const lifeStageCount = lifeStageCategories.map((name) => ({
      name,
      count: (countMap[categoryMapping[name]] || 0).toString(),
    }));

    const result = {
      success: true,
      data: {
        condition: healthConditionCounts,
        body_system: bodySystemCounts,
        life_stage: lifeStageCount,
      },
    };

    // Cache the result for fast subsequent requests
    categoryCountsCache = result;
    cacheTimestamp = now;

    return res.json(result);
  } catch (error) {
    console.error("Error fetching category counts:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to retrieve category counts",
    });
  }
});

// Get studies by category
router.get("/studies", async (req, res) => {
  try {
    const { model, category } = req.query;

    if (!model || !category) {
      return res.status(400).json({
        success: false,
        error: "Missing required parameters",
      });
    }

    // Get category name as a string
    const categoryName = category as string;

    if (!db) {
      return res.status(500).json({
        success: false,
        error: "Database connection not available",
      });
    }

    // Map health conditions to relevant keywords for better search results
    const getKeywords = (model: string, categoryName: string): string[] => {
      let keywords: string[] = [];

      if (model === "condition") {
        if (categoryName.includes("Cardiovascular")) {
          keywords = [
            "heart",
            "cardiovascular",
            "blood pressure",
            "hypertension",
            "vascular",
          ];
        } else if (
          categoryName.includes("Neurological") ||
          categoryName.includes("Neurodegenerative")
        ) {
          keywords = [
            "brain",
            "cognitive",
            "neurological",
            "memory",
            "neuro",
            "alzheimer",
            "parkinson",
          ];
        } else if (
          categoryName.includes("Metabolic") ||
          categoryName.includes("Metabolism & Diabetes")
        ) {
          keywords = [
            "diabetes",
            "insulin",
            "glucose",
            "blood sugar",
            "metabolic",
            "obesity",
          ];
        } else if (categoryName.includes("Inflammation")) {
          keywords = [
            "arthritis",
            "inflammation",
            "joint",
            "pain",
            "rheumatoid",
            "anti-inflammatory",
          ];
        } else if (categoryName.includes("Respiratory")) {
          keywords = [
            "lung",
            "respiratory",
            "breathing",
            "copd",
            "asthma",
            "pulmonary",
          ];
        } else if (categoryName.includes("Gastrointestinal")) {
          keywords = [
            "digestive",
            "gut",
            "intestine",
            "ibs",
            "gastro",
            "colon",
          ];
        } else if (categoryName.includes("Cancer")) {
          keywords = ["cancer", "tumor", "oncology", "carcinoma", "malignant"];
        } else if (categoryName.includes("Kidney")) {
          keywords = ["kidney", "renal", "nephro", "urinary"];
        } else if (categoryName.includes("Liver")) {
          keywords = ["liver", "hepatic", "hepato", "cirrhosis"];
        } else if (categoryName.includes("Dermatology")) {
          keywords = ["skin", "dermatitis", "eczema", "acne", "dermatology"];
        } else if (categoryName.includes("Aging")) {
          keywords = [
            "aging",
            "longevity",
            "age-related",
            "senescence",
            "elderly",
          ];
        } else if (categoryName.includes("General")) {
          keywords = [
            "wellness",
            "health",
            "antioxidant",
            "prevention",
            "hydrogen",
          ];
        }
      } else if (model === "body_system") {
        if (categoryName.includes("Cardiovascular")) {
          keywords = [
            "heart",
            "cardiovascular",
            "blood pressure",
            "vascular",
            "circulation",
          ];
        } else if (categoryName.includes("Nervous")) {
          keywords = ["brain", "nerve", "neural", "cognitive", "neurological"];
        } else if (categoryName.includes("Immune")) {
          keywords = [
            "immune",
            "inflammation",
            "autoimmune",
            "cytokine",
            "antibody",
          ];
        } else if (categoryName.includes("Respiratory")) {
          keywords = ["lung", "breath", "respiratory", "oxygen", "pulmonary"];
        } else if (categoryName.includes("Digestive")) {
          keywords = [
            "digestive",
            "gut",
            "intestine",
            "gastro",
            "liver",
            "hepatic",
          ];
        } else if (categoryName.includes("Musculoskeletal")) {
          keywords = [
            "muscle",
            "strength",
            "bone",
            "joint",
            "skeletal",
            "exercise",
          ];
        } else if (categoryName.includes("Renal")) {
          keywords = ["kidney", "renal", "nephro", "urinary"];
        } else if (categoryName.includes("Integumentary")) {
          keywords = ["skin", "dermal", "dermatology", "epithelial", "wound"];
        }
      } else if (model === "life_stage") {
        // Life stage categories
        if (categoryName.includes("Infants")) {
          keywords = ["infant", "baby", "newborn", "neonatal", "perinatal"];
        } else if (categoryName.includes("Children")) {
          keywords = [
            "child",
            "children",
            "adolescent",
            "pediatric",
            "youth",
            "teen",
          ];
        } else if (
          categoryName.includes("Adults") &&
          !categoryName.includes("Older")
        ) {
          keywords = ["adult", "middle-aged", "working", "man", "woman"];
        } else if (categoryName.includes("Older Adults")) {
          keywords = ["elderly", "aging", "senior", "older adult", "geriatric"];
        } else if (categoryName.includes("Athletes")) {
          keywords = [
            "athlete",
            "exercise",
            "fitness",
            "performance",
            "sport",
            "training",
          ];
        }
      }

      // If no specific keywords were found, extract from category name
      if (keywords.length === 0) {
        keywords = categoryName.split(/[\s&]+/).filter((w) => w.length > 3);
      }

      return keywords;
    };

    // Get relevant keywords for this category
    const categoryKeywords = getKeywords(model as string, categoryName);

    // Use the actual consumer_categories JSON field to find properly categorized studies
    try {
      const { pool } = await import("../db");

      // Map model names to JSON field names
      let jsonField: string;
      switch (model) {
        case "condition":
          jsonField = "condition";
          break;
        case "body_system":
          jsonField = "bodySystem";
          break;
        case "life_stage":
          jsonField = "lifeStage";
          break;
        default:
          jsonField = "condition";
      }

      // Map consumer-friendly name to database category name
      const categoryMapping: Record<string, string> = {
        "Heart Disease & Hypertension": "Cardiovascular",
        "Brain & Neurological Disorders": "Neurological",
        "Diabetes & Metabolic Health": "Metabolic",
        "Arthritis & Inflammation": "Inflammation",
        "Lung & Respiratory Conditions": "Respiratory",
        "Digestive Health (Gut/Liver)": "Gastrointestinal",
        "Cancer Supportive Care": "Cancer Research",
        "Cardiovascular System": "Cardiovascular",
        "Nervous System": "Neurological",
        "Respiratory System": "Respiratory",
        "Digestive System": "Gastrointestinal",
        "Immune System": "Inflammation",
        "Musculoskeletal System": "Inflammation",
        "Renal System": "Kidney",
        "Integumentary System": "Dermatology",
        Adults: "Aging",
        "Older Adults": "Aging",
        "Athletes & Fitness": "Fitness",
      };

      const dbCategoryName = categoryMapping[categoryName] || categoryName;

      // Query for studies using authentic relational data
      const query = `
        SELECT DISTINCT s.id, s.title, s.abstract, s.authors, s.journal, 
               s.publish_date as "publishDate", s.category, s.doi, 
               s.image_url as "imageUrl", s.slug, s.consumer_categories
        FROM studies s
        INNER JOIN study_categories sc ON s.id = sc.study_id
        INNER JOIN categories c ON sc.category_id = c.id
        WHERE c.name = $1
        ORDER BY s.id DESC
        LIMIT 50
      `;

      const result = await pool.query(query, [dbCategoryName]);
      const studyResults = result.rows;

      console.log(
        `Found ${studyResults.length} studies for ${model} category: ${categoryName}`,
      );

      return res.json({
        success: true,
        data: studyResults,
        total: studyResults.length,
      });
    } catch (error) {
      console.error("Error fetching studies by category:", error);

      // Fallback to keyword search if JSON query fails
      try {
        const { pool } = await import("../db");
        const likeTerms = categoryKeywords.map((keyword) => `%${keyword}%`);
        const fallbackQuery = `
          SELECT id, title, abstract, authors, journal, publish_date as "publishDate", 
                 category, doi, image_url as "imageUrl", slug
          FROM studies 
          WHERE title ILIKE ANY($1) OR abstract ILIKE ANY($2)
          ORDER BY id DESC
          LIMIT 20
        `;

        const result = await pool.query(fallbackQuery, [likeTerms, likeTerms]);
        console.log(
          `Fallback keyword search returned ${result.rows.length} studies`,
        );

        return res.json({
          success: true,
          data: result.rows,
        });
      } catch (fallbackError) {
        console.error("Fallback search also failed:", fallbackError);
        return res.status(500).json({
          success: false,
          error: "Failed to fetch studies",
        });
      }
    }
  } catch (error) {
    console.error("Error fetching studies by category:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to fetch studies",
    });
  }
});

// Add life stage route
router.get("/life-stages", async (req, res) => {
  try {
    const { pool } = await import("../db");

    // Keywords to search in title/abstract for each life stage
    const lifeStages = [
      { name: "Infants & Newborns", keywords: ["infant", "newborn", "neonatal", "perinatal"], description: "Studies focused on infant health and development" },
      { name: "Children & Adolescents", keywords: ["child", "children", "adolescent", "pediatric"], description: "Research on pediatric and adolescent health" },
      { name: "Adults", keywords: ["adult"], description: "Studies focused on working-age adults" },
      { name: "Older Adults", keywords: ["elderly", "aging", "geriatric", "older adult"], description: "Research on elderly populations and aging" },
      { name: "Athletes & Fitness", keywords: ["athlete", "exercise", "fitness", "sport", "training"], description: "Studies on performance enhancement and recovery" },
    ];

    const results = await Promise.all(
      lifeStages.map(async (stage) => {
        const likeTerms = stage.keywords.map((k) => `%${k}%`);
        const result = await pool.query(
          `SELECT COUNT(*) as count FROM studies WHERE title ILIKE ANY($1) OR abstract ILIKE ANY($1)`,
          [likeTerms],
        );
        return { name: stage.name, count: parseInt(result.rows[0]?.count || "0"), description: stage.description };
      }),
    );

    return res.json({ success: true, data: results });
  } catch (error) {
    console.error("Error fetching life stages:", error);
    return res.status(500).json({ success: false, error: "Failed to retrieve life stages" });
  }
});

// Anchor content for category landing pages — SEO-rich introductory text
const ANCHOR_CONTENT: Record<string, Record<string, { title: string; summary: string; content: string }>> = {
  condition: {
    "Heart Disease & Hypertension": {
      title: "Hydrogen Water and Cardiovascular Health",
      summary: "Research shows molecular hydrogen may support cardiovascular health through its selective antioxidant and anti-inflammatory properties.",
      content: "Cardiovascular disease remains the leading cause of death worldwide. A growing body of peer-reviewed research has investigated molecular hydrogen (H2) as a potential supportive therapy for heart health. Studies suggest that H2 may help reduce oxidative stress in blood vessels, support healthy blood pressure levels, and protect cardiac tissue during ischemia-reperfusion events. While more large-scale clinical trials are needed, the existing evidence from both animal models and human studies is promising.",
    },
    "Brain & Neurological Disorders": {
      title: "Hydrogen Therapy and Brain Health",
      summary: "Molecular hydrogen shows neuroprotective potential in research on Alzheimer's, Parkinson's, and stroke recovery.",
      content: "The brain is particularly vulnerable to oxidative stress due to its high oxygen consumption. Research into molecular hydrogen's neuroprotective properties has expanded significantly since the landmark 2007 Nature Medicine study. H2's ability to cross the blood-brain barrier and selectively neutralize harmful hydroxyl radicals makes it a unique candidate for neurological research. Studies have explored its effects on neurodegenerative conditions, traumatic brain injury, and cognitive function in aging populations.",
    },
    "Diabetes & Metabolic Health": {
      title: "Hydrogen Water and Metabolic Syndrome",
      summary: "Clinical studies have examined hydrogen-rich water's effects on glucose metabolism, insulin sensitivity, and lipid profiles.",
      content: "Metabolic syndrome affects a significant portion of the global population. Multiple clinical trials have investigated hydrogen-rich water's potential to improve markers of metabolic health, including fasting blood glucose, HbA1c, cholesterol levels, and body composition. The anti-inflammatory and antioxidant mechanisms of molecular hydrogen may help address the underlying oxidative stress that contributes to metabolic dysfunction.",
    },
    "Arthritis & Inflammation": {
      title: "Hydrogen and Inflammatory Conditions",
      summary: "Research explores molecular hydrogen's anti-inflammatory effects on arthritis, joint pain, and systemic inflammation.",
      content: "Chronic inflammation is at the root of many health conditions, including rheumatoid arthritis and osteoarthritis. Molecular hydrogen has been studied for its ability to modulate inflammatory pathways, including NF-kB signaling and pro-inflammatory cytokine production. Clinical studies using hydrogen-rich water and hydrogen bathing have reported improvements in joint pain, morning stiffness, and inflammatory markers in patients with rheumatoid arthritis.",
    },
    "Lung & Respiratory Conditions": {
      title: "Hydrogen Therapy for Respiratory Health",
      summary: "Hydrogen inhalation and hydrogen-rich water are being studied for lung protection and respiratory support.",
      content: "The lungs are directly exposed to environmental oxidative stressors. Research into hydrogen therapy for respiratory conditions has gained momentum, particularly with hydrogen gas inhalation studies. Investigations have covered acute lung injury, COPD, asthma, and post-surgical lung recovery. The selective antioxidant properties of molecular hydrogen may help protect lung tissue without interfering with necessary reactive oxygen species signaling.",
    },
    "Digestive Health (Gut/Liver)": {
      title: "Hydrogen Water and Gut Health",
      summary: "Studies examine hydrogen's effects on the gut microbiome, liver function, and gastrointestinal disorders.",
      content: "The gastrointestinal tract is where hydrogen-rich water first makes contact with the body. Research suggests that molecular hydrogen may positively influence gut microbiome composition, reduce intestinal inflammation, and support liver health. Studies have investigated its role in conditions ranging from non-alcoholic fatty liver disease to inflammatory bowel disease, with encouraging preliminary results.",
    },
    "Cancer Supportive Care": {
      title: "Hydrogen Research in Cancer Support",
      summary: "Molecular hydrogen is being studied as a supportive therapy to reduce side effects of cancer treatment.",
      content: "While molecular hydrogen is not a cancer treatment, research has explored its potential as a supportive therapy during conventional cancer care. Studies have investigated whether H2 can help reduce the side effects of chemotherapy and radiation therapy, improve quality of life for cancer patients, and protect healthy tissue during treatment. This is an active area of research with ongoing clinical trials.",
    },
  },
};

/**
 * GET /api/consumer-categories/anchor-content/:type/:category
 * Returns SEO anchor content for a specific category landing page.
 */
router.get("/anchor-content/:type/:category", async (req, res) => {
  try {
    const { type, category } = req.params;
    const decodedCategory = decodeURIComponent(category);
    const content = ANCHOR_CONTENT[type]?.[decodedCategory];

    if (!content) {
      return res.json({ success: true, data: null });
    }

    // Get study count for this category to include in the response
    let studyCount = 0;
    try {
      const categoryMap: Record<string, string> = {
        "Heart Disease & Hypertension": "cardiovascular",
        "Brain & Neurological Disorders": "neurological",
        "Diabetes & Metabolic Health": "metabolic",
        "Arthritis & Inflammation": "inflammation",
        "Lung & Respiratory Conditions": "respiratory",
        "Digestive Health (Gut/Liver)": "gastrointestinal",
        "Cancer Supportive Care": "cancer",
      };
      const dbCategory = categoryMap[decodedCategory];
      if (dbCategory) {
        const result = await db.select({ count: sql<number>`count(*)` }).from(studies)
          .where(sql`LOWER(${studies.category}) LIKE ${`%${dbCategory.toLowerCase()}%`}`);
        studyCount = result[0]?.count || 0;
      }
    } catch {}

    return res.json({
      success: true,
      data: { ...content, studyCount },
    });
  } catch (error) {
    console.error("Error fetching anchor content:", error);
    return res.status(500).json({ success: false, error: "Failed to retrieve anchor content" });
  }
});

export default router;
