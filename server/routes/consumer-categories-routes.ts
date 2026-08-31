import express from "express";
import { db } from "../db";
import { studies } from "../../shared/schema";
import { sql, eq, isNull, or } from "drizzle-orm";
import { ai } from "../services/ai-provider";
import { requireAdmin } from "../auth";
import { aiGenerationRateLimiter } from "../utils/rate-limiting";

const router = express.Router();

// High-performance cache for category counts
let categoryCountsCache: any = null;
let cacheTimestamp = 0;
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

// Cache for life-stage counts — these only change when studies are imported,
// so a short TTL avoids re-running five full-table ILIKE scans on every hit.
let lifeStagesCache: any = null;
let lifeStagesCacheTimestamp = 0;

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
      "Endocrine System",
      "Reproductive System",
      "Hematological System",
      "Whole Body",
    ];

    // Life stage categories
    const lifeStageCategories = [
      "Adolescents",
      "Adults",
      "Older Adults",
      "Men's Health",
      "Women's Health",
      "Athletes",
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
      "Musculoskeletal System": "Fitness",
      "Renal System": "Kidney",
      "Integumentary System": "Dermatology",
      "Endocrine System": "Metabolic",
      "Reproductive System": "__keyword_search__",
      "Hematological System": "__keyword_search__",
      "Whole Body": "__keyword_search__",
      "Adolescents": "__keyword_search__",
      Adults: "__keyword_search__",
      "Older Adults": "__keyword_search__",
      "Men's Health": "__keyword_search__",
      "Women's Health": "__keyword_search__",
      "Athletes": "__keyword_search__",
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
      "Endocrine System",
      "Reproductive System",
      "Hematological System",
      "Whole Body",
    ];

    const lifeStageCategories = [
      "Adolescents",
      "Adults",
      "Older Adults",
      "Men's Health",
      "Women's Health",
      "Athletes",
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
          'Dermatology', 'Aging', 'Fitness', 'Liver'
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
        "Liver": ["liver"],
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

    // Keyword-based counts for categories without a direct DB category
    const keywordCountMap: Record<string, string[]> = {
      "Reproductive System": ["testis", "testicular", "sperm", "ovary", "ovarian", "fertility", "reproductive", "pregnancy", "placenta", "estrogen", "testosterone"],
      "Hematological System": ["hematologic", "erythrocyte", "red blood cell", "platelet", "hemoglobin", "coagulation"],
      "Whole Body": ["systemic", "whole-body", "multi-organ", "sepsis", "frailty", "mitochondrial dysfunction"],
      "Adolescents": ["neonatal", "newborn", "perinatal", "offspring", "fetal", "embryo", "pediatric", "paediatric", "child", "children", "infant", "adolescent", "juvenile"],
      "Adults": ["oxidative stress", "inflammation", "metabolic", "exercise", "endothelial"],
      "Older Adults": ["elderly", "aged", "aging", "ageing", "postmenopausal", "senior", "cognitive", "memory", "alzheimer", "frailty"],
      "Men's Health": ["male", "males", "testicular", "sperm", "testosterone", "reproductive"],
      "Women's Health": ["female", "females", "pregnan", "gestation", "prenatal", "placenta", "placental", "uterine", "maternal", "ovarian", "menopause", "estrogen"],
      "Athletes": ["athlete", "athletes", "physically active", "exercise", "training", "endurance", "resistance training", "fatigue", "lactate", "recovery", "muscle damage"],
    };

    for (const [systemName, keywords] of Object.entries(keywordCountMap)) {
      const likeClauses = keywords.map((_, i) => `LOWER(title) LIKE $${i * 2 + 1} OR LOWER(abstract) LIKE $${i * 2 + 2}`).join(" OR ");
      const params = keywords.flatMap(k => [`%${k}%`, `%${k}%`]);
      try {
        const result = await pool.query(
          `SELECT COUNT(DISTINCT id) as count FROM studies WHERE ${likeClauses}`,
          params
        );
        countMap[`__kw_${systemName}`] = parseInt(result.rows[0]?.count || '0');
      } catch {
        countMap[`__kw_${systemName}`] = 0;
      }
    }

    // Map to consumer-friendly names with authentic counts
    const healthConditionCounts = conditionCategories.map((name) => ({
      name,
      count: (countMap[categoryMapping[name]] || 0).toString(),
    }));

    // Body systems: use the body_systems array column directly (most accurate)
    // Falls back to category mapping + keyword counts if array query fails
    let bodySystemCounts: { name: string; count: string }[];
    try {
      const bsResults = await pool.query(`
        SELECT unnest(body_systems) as body_system, COUNT(DISTINCT id) as count
        FROM studies
        WHERE body_systems IS NOT NULL AND array_length(body_systems, 1) > 0
        GROUP BY body_system
        ORDER BY count DESC
      `);
      const bsMap: Record<string, number> = {};
      bsResults.rows.forEach((row: any) => {
        bsMap[row.body_system] = parseInt(row.count);
      });

      bodySystemCounts = bodySystemCategories.map((name) => {
        // Direct match from body_systems array
        if (bsMap[name] && bsMap[name] > 0) {
          return { name, count: bsMap[name].toString() };
        }
        // Keyword search fallback
        const mapped = categoryMapping[name];
        if (mapped === "__keyword_search__") {
          return { name, count: (countMap[`__kw_${name}`] || 0).toString() };
        }
        // Category column fallback
        return { name, count: (countMap[mapped] || 0).toString() };
      });
    } catch {
      // If body_systems query fails, use original fallback logic
      bodySystemCounts = bodySystemCategories.map((name) => {
        const mapped = categoryMapping[name];
        if (mapped === "__keyword_search__") {
          return { name, count: (countMap[`__kw_${name}`] || 0).toString() };
        }
        return { name, count: (countMap[mapped] || 0).toString() };
      });
    }

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
          keywords = ["heart", "cardiac", "myocardial", "ischemia", "reperfusion", "hypertension", "blood pressure", "endothelial", "vascular", "atherosclerosis", "stroke"];
        } else if (categoryName.includes("Nervous")) {
          keywords = ["brain", "neural", "neuron", "neuro", "cognitive", "memory", "alzheimer", "parkinson", "stroke", "cerebral", "spinal cord", "neuropathy"];
        } else if (categoryName.includes("Immune")) {
          keywords = ["immune", "immunity", "inflammation", "inflammatory", "cytokine", "macrophage", "t cell", "b cell", "immunomodulation", "sepsis"];
        } else if (categoryName.includes("Respiratory")) {
          keywords = ["lung", "pulmonary", "respiratory", "airway", "alveolar", "copd", "asthma", "ards", "pneumonia", "hypoxia"];
        } else if (categoryName.includes("Digestive")) {
          keywords = ["liver", "hepatic", "intestine", "intestinal", "gut", "colon", "gastric", "stomach", "pancreas", "microbiome", "microbiota"];
        } else if (categoryName.includes("Musculoskeletal")) {
          keywords = ["muscle", "skeletal", "exercise", "fatigue", "performance", "strength", "endurance", "bone", "osteo", "arthritis", "tendon"];
        } else if (categoryName.includes("Renal")) {
          keywords = ["kidney", "renal", "nephro", "nephropathy", "nephritis", "dialysis", "acute kidney injury", "chronic kidney disease"];
        } else if (categoryName.includes("Integumentary")) {
          keywords = ["skin", "dermal", "epidermal", "wound", "healing", "burn", "ulcer", "fibrosis", "keratinocyte"];
        } else if (categoryName.includes("Endocrine")) {
          keywords = ["metabolic", "metabolism", "diabetes", "insulin", "glucose", "lipid", "cholesterol", "obesity", "adipose", "metabolic syndrome"];
        } else if (categoryName.includes("Reproductive")) {
          keywords = ["testis", "testicular", "sperm", "ovary", "ovarian", "fertility", "reproductive", "pregnancy", "placenta", "estrogen", "testosterone"];
        } else if (categoryName.includes("Hematological")) {
          keywords = ["blood", "hematologic", "erythrocyte", "red blood cell", "platelet", "hemoglobin", "coagulation", "plasma"];
        } else if (categoryName.includes("Whole Body")) {
          keywords = ["systemic", "whole-body", "multi-organ", "sepsis", "aging", "frailty", "oxidative stress", "mitochondrial dysfunction"];
        }
      } else if (model === "life_stage") {
        if (categoryName.includes("Adolescents")) {
          keywords = ["neonatal", "newborn", "perinatal", "offspring", "fetal", "foetal", "embryo", "embryonic", "pediatric", "paediatric", "child", "children", "infant", "adolescent", "juvenile", "young", "development"];
        } else if (categoryName === "Adults") {
          keywords = ["adult", "adults", "healthy", "oxidative stress", "inflammation", "metabolic", "exercise", "endothelial"];
        } else if (categoryName.includes("Older Adults")) {
          keywords = ["middle-aged", "elderly", "older", "aged", "aging", "ageing", "postmenopausal", "senior", "cognitive", "memory", "alzheimer", "frailty", "muscle", "oxidative stress"];
        } else if (categoryName.includes("Men")) {
          keywords = ["male", "males", "men", "testicular", "sperm", "testosterone", "reproductive"];
        } else if (categoryName.includes("Women")) {
          keywords = ["female", "females", "women", "pregnan", "gestation", "prenatal", "placenta", "placental", "uterine", "maternal", "ovarian", "menopause", "estrogen", "reproductive"];
        } else if (categoryName.includes("Athletes")) {
          keywords = ["athlete", "athletes", "physically active", "exercise", "training", "endurance", "resistance training", "fatigue", "lactate", "recovery", "muscle damage"];
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
        "Musculoskeletal System": "Fitness",
        "Renal System": "Kidney",
        "Integumentary System": "Dermatology",
        "Endocrine System": "Metabolic",
        "Adolescents": "__keyword_search__",
        Adults: "__keyword_search__",
        "Older Adults": "__keyword_search__",
        "Men's Health": "__keyword_search__",
        "Women's Health": "__keyword_search__",
        "Athletes": "__keyword_search__",
      };

      // Categories that need keyword search (no direct DB category)
      const keywordOnlySystems = [
        "Reproductive System", "Hematological System", "Whole Body",
        "Adolescents", "Adults", "Older Adults", "Men's Health", "Women's Health", "Athletes",
      ];

      const dbCategoryName = categoryMapping[categoryName] || categoryName;

      let studyResults: any[];

      if (keywordOnlySystems.includes(categoryName)) {
        // Use keyword search for systems without a DB category
        const likeTerms = categoryKeywords.map((keyword) => `%${keyword}%`);
        const likeClauses = likeTerms.map((_, i) => `LOWER(title) LIKE $${i + 1} OR LOWER(abstract) LIKE $${i + 1}`).join(" OR ");
        // Postgres requires ORDER BY columns to appear in the SELECT list
        // when using DISTINCT, so publish_year is included here.
        const kwQuery = `
          SELECT DISTINCT id, title, abstract, authors, journal,
                 publish_date as "publishDate", publish_year, category, doi,
                 image_url as "imageUrl", slug, consumer_categories
          FROM studies
          WHERE ${likeClauses}
          ORDER BY publish_year DESC NULLS LAST, id DESC
          LIMIT 50
        `;
        const result = await pool.query(kwQuery, likeTerms);
        studyResults = result.rows;
      } else {
        // Query for studies using authentic relational data
        const query = `
          SELECT DISTINCT s.id, s.title, s.abstract, s.authors, s.journal,
                 s.publish_date as "publishDate", s.publish_year, s.category, s.doi,
                 s.image_url as "imageUrl", s.slug, s.consumer_categories
          FROM studies s
          INNER JOIN study_categories sc ON s.id = sc.study_id
          INNER JOIN categories c ON sc.category_id = c.id
          WHERE c.name = $1
          ORDER BY s.publish_year DESC NULLS LAST, s.id DESC
          LIMIT 50
        `;
        const result = await pool.query(query, [dbCategoryName]);
        studyResults = result.rows;
      }

      // If no results from primary query, try health_conditions column + keyword fallback
      if (studyResults.length === 0) {
        console.log(`No results from primary query for ${categoryName}, trying health_conditions + keyword fallback`);

        // First try exact match on health_conditions column
        // `health_conditions` is a text[] column, so a scalar LOWER() on it
        // errors ("function lower(text[]) does not exist"). Match instead when
        // ANY array element equals the requested condition, case-insensitively.
        const hcQuery = `
          SELECT DISTINCT id, title, abstract, authors, journal,
                 publish_date as "publishDate", publish_year, category, doi,
                 image_url as "imageUrl", slug, consumer_categories
          FROM studies
          WHERE EXISTS (
            SELECT 1 FROM unnest(health_conditions) AS hc
            WHERE LOWER(hc) = LOWER($1)
          )
          ORDER BY publish_year DESC NULLS LAST, id DESC
          LIMIT 50
        `;
        const hcResult = await pool.query(hcQuery, [categoryName]);

        if (hcResult.rows.length > 0) {
          studyResults = hcResult.rows;
        } else {
          // Fall back to keyword search in title and abstract
          const searchTerms = categoryKeywords.length > 0
            ? categoryKeywords
            : categoryName.split(/[\s&,]+/).filter((w: string) => w.length > 2);

          if (searchTerms.length > 0) {
            const likeTerms = searchTerms.map((keyword: string) => `%${keyword.toLowerCase()}%`);
            const likeClauses = likeTerms.map((_: string, i: number) =>
              `LOWER(title) LIKE $${i + 1} OR LOWER(abstract) LIKE $${i + 1}`
            ).join(" OR ");

            const kwQuery = `
              SELECT DISTINCT id, title, abstract, authors, journal,
                     publish_date as "publishDate", publish_year, category, doi,
                     image_url as "imageUrl", slug, consumer_categories
              FROM studies
              WHERE ${likeClauses}
              ORDER BY publish_year DESC NULLS LAST, id DESC
              LIMIT 50
            `;
            const kwResult = await pool.query(kwQuery, likeTerms);
            studyResults = kwResult.rows;
          }
        }
      }

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

      // Last resort fallback
      try {
        const { pool } = await import("../db");
        const searchTerms = categoryKeywords.length > 0
          ? categoryKeywords
          : categoryName.split(/[\s&,]+/).filter((w: string) => w.length > 2);
        const likeTerms = searchTerms.map((keyword: string) => `%${keyword.toLowerCase()}%`);

        const fallbackQuery = `
          SELECT id, title, abstract, authors, journal, publish_date as "publishDate",
                 category, doi, image_url as "imageUrl", slug
          FROM studies
          WHERE title ILIKE ANY($1) OR abstract ILIKE ANY($2)
          ORDER BY publish_year DESC NULLS LAST, id DESC
          LIMIT 50
        `;

        const result = await pool.query(fallbackQuery, [likeTerms, likeTerms]);

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
    // Check cache first — counts only change on study import, so serve
    // repeated hits without re-running the five full-table ILIKE scans.
    const now = Date.now();
    if (lifeStagesCache && now - lifeStagesCacheTimestamp < CACHE_TTL) {
      return res.json(lifeStagesCache);
    }

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

    const response = { success: true, data: results };

    // Cache for fast subsequent requests.
    lifeStagesCache = response;
    lifeStagesCacheTimestamp = now;

    return res.json(response);
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
    } catch (err) {
      // Non-fatal — the response still goes out with studyCount=0.
      // Log so we notice if it starts failing systematically.
      console.warn(
        `Anchor-content study count failed for "${decodedCategory}":`,
        err instanceof Error ? err.message : String(err),
      );
    }

    return res.json({
      success: true,
      data: { ...content, studyCount },
    });
  } catch (error) {
    console.error("Error fetching anchor content:", error);
    return res.status(500).json({ success: false, error: "Failed to retrieve anchor content" });
  }
});

/**
 * POST /api/consumer-categories/categorize/:studyId
 * Categorize a single study using AI
 */
router.post("/categorize/:studyId", requireAdmin, aiGenerationRateLimiter, async (req, res) => {
  try {
    const studyId = parseInt(req.params.studyId);
    if (isNaN(studyId)) {
      return res.status(400).json({ success: false, error: "Invalid study ID" });
    }

    const [study] = await db
      .select({
        id: studies.id,
        title: studies.title,
        abstract: studies.abstract,
        methods: studies.methods,
        results: studies.results,
        conclusion: studies.conclusion,
        category: studies.category,
      })
      .from(studies)
      .where(eq(studies.id, studyId))
      .limit(1);

    if (!study) {
      return res.status(404).json({ success: false, error: "Study not found" });
    }

    const categories = await categorizeStudyWithAI(study);

    await db
      .update(studies)
      .set({ consumerCategories: JSON.stringify(categories) })
      .where(eq(studies.id, studyId));

    return res.json({ success: true, studyId, categories });
  } catch (error) {
    console.error("Error categorizing study:", error);
    return res.status(500).json({ success: false, error: "Failed to categorize study" });
  }
});

/**
 * POST /api/consumer-categories/batch-categorize
 * Batch categorize uncategorized studies
 */
router.post("/batch-categorize", requireAdmin, aiGenerationRateLimiter, async (req, res) => {
  try {
    const limit = Math.min(Number(req.body.limit) || 10, 50);

    const uncategorized = await db
      .select({
        id: studies.id,
        title: studies.title,
        abstract: studies.abstract,
        methods: studies.methods,
        results: studies.results,
        conclusion: studies.conclusion,
        category: studies.category,
      })
      .from(studies)
      .where(or(isNull(studies.consumerCategories), eq(studies.consumerCategories, "")))
      .limit(limit);

    let successful = 0;
    let failed = 0;
    const errors: { studyId: number; error: string }[] = [];

    for (const study of uncategorized) {
      try {
        const categories = await categorizeStudyWithAI(study);
        await db
          .update(studies)
          .set({ consumerCategories: JSON.stringify(categories) })
          .where(eq(studies.id, study.id));
        successful++;
        // Small delay to avoid rate limits
        await new Promise((r) => setTimeout(r, 2000));
      } catch (err) {
        failed++;
        errors.push({ studyId: study.id, error: err instanceof Error ? err.message : String(err) });
      }
    }

    return res.json({
      success: true,
      total: uncategorized.length,
      successful,
      failed,
      errors,
    });
  } catch (error) {
    console.error("Error in batch categorization:", error);
    return res.status(500).json({ success: false, error: "Failed to run batch categorization" });
  }
});

/**
 * Use AI to categorize a study into consumer-friendly categories
 */
async function categorizeStudyWithAI(study: {
  id: number;
  title: string;
  abstract: string | null;
  methods: string | null;
  results: string | null;
  conclusion: string | null;
  category: string;
}) {
  if (ai.getProviderStatus().primary === "none") {
    // Fallback: use existing category to make a best guess
    return inferCategoriesFromStudyCategory(study.category);
  }

  const studyContent = [
    `Title: ${study.title}`,
    study.abstract ? `Abstract: ${study.abstract.substring(0, 500)}` : "",
    study.methods ? `Methods: ${study.methods.substring(0, 300)}` : "",
    study.conclusion ? `Conclusion: ${study.conclusion.substring(0, 300)}` : "",
  ].filter(Boolean).join("\n");

  const prompt = `Categorize this hydrogen therapy study into consumer-friendly categories.

${studyContent}

Return JSON with these arrays (use ONLY the exact category names listed):

condition: Pick from: "Heart Disease & Hypertension", "Brain & Neurological Disorders", "Diabetes & Metabolic Health", "Arthritis & Inflammation", "Lung & Respiratory Conditions", "Digestive Health (Gut/Liver)", "Cancer Supportive Care"

bodySystem: Pick from: "Cardiovascular System", "Nervous System", "Respiratory System", "Digestive System", "Immune System", "Musculoskeletal System", "Renal System", "Integumentary System"

lifeStage: Pick from: "Infants & Newborns", "Children & Adolescents", "Adults", "Older Adults", "Athletes & Fitness"

Only include categories that are clearly relevant. Return valid JSON only.`;

  try {
    const result = await ai.generateJSON(
      "You are a medical research categorization assistant. Return valid JSON only.",
      prompt,
      { temperature: 0.3, maxTokens: 300, model: "claude-haiku-4-5" },
    );

    return {
      condition: Array.isArray(result.condition) ? result.condition : [],
      bodySystem: Array.isArray(result.bodySystem) ? result.bodySystem : [],
      lifeStage: Array.isArray(result.lifeStage) ? result.lifeStage : [],
    };
  } catch {
    return inferCategoriesFromStudyCategory(study.category);
  }
}

function inferCategoriesFromStudyCategory(category: string) {
  const cat = (category || "").toLowerCase();
  const result: { condition: string[]; bodySystem: string[]; lifeStage: string[] } = {
    condition: [],
    bodySystem: [],
    lifeStage: ["Adults"],
  };

  if (cat.includes("cardiovascular")) {
    result.condition.push("Heart Disease & Hypertension");
    result.bodySystem.push("Cardiovascular System");
  }
  if (cat.includes("neurological")) {
    result.condition.push("Brain & Neurological Disorders");
    result.bodySystem.push("Nervous System");
  }
  if (cat.includes("diabetes") || cat.includes("metabolic")) {
    result.condition.push("Diabetes & Metabolic Health");
  }
  if (cat.includes("inflammation")) {
    result.condition.push("Arthritis & Inflammation");
    result.bodySystem.push("Immune System");
  }
  if (cat.includes("respiratory")) {
    result.condition.push("Lung & Respiratory Conditions");
    result.bodySystem.push("Respiratory System");
  }
  if (cat.includes("gastrointestinal") || cat.includes("hepatic")) {
    result.condition.push("Digestive Health (Gut/Liver)");
    result.bodySystem.push("Digestive System");
  }
  if (cat.includes("cancer")) {
    result.condition.push("Cancer Supportive Care");
  }
  if (cat.includes("kidney")) {
    result.bodySystem.push("Renal System");
  }
  if (cat.includes("dermatology")) {
    result.bodySystem.push("Integumentary System");
  }
  if (cat.includes("exercise") || cat.includes("fitness")) {
    result.lifeStage.push("Athletes & Fitness");
  }

  return result;
}

export default router;
