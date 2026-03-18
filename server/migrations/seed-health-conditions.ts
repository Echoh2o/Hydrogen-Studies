/**
 * Seed health conditions for the Shopify App Proxy research database.
 * Inserts 20 high-priority conditions and maps them to existing studies
 * by keyword-matching against study titles and abstracts.
 */

import { db } from "../db";
import { sql } from "drizzle-orm";
import { logger } from "../utils/logger";

interface ConditionSeed {
  name: string;
  slug: string;
  bodySystemSlug: string;
  mechanism: string;
  primaryProduct: string;
  confidenceLevel: string;
  description: string;
  keywords: string[]; // used to match against study titles/abstracts
}

const BODY_SYSTEMS = [
  { name: "Metabolic", slug: "metabolic", description: "Metabolic processes including energy production, glucose regulation, and lipid metabolism" },
  { name: "Musculoskeletal", slug: "musculoskeletal", description: "Muscles, bones, joints, and connective tissues" },
  { name: "Immune", slug: "immune", description: "Immune system function, inflammation, and allergic responses" },
  { name: "Neurological", slug: "neurological", description: "Brain, nervous system, and cognitive function" },
  { name: "Digestive", slug: "digestive", description: "Gastrointestinal tract, gut microbiome, and digestive health" },
  { name: "Dermatological", slug: "dermatological", description: "Skin health, aging, and wound healing" },
  { name: "Cardiovascular", slug: "cardiovascular", description: "Heart, blood vessels, and circulatory system" },
  { name: "Oncology", slug: "oncology", description: "Cancer research and radiation therapy effects" },
  { name: "Renal", slug: "renal", description: "Kidney function and urinary system" },
];

const CONDITIONS: ConditionSeed[] = [
  {
    name: "Metabolic Syndrome",
    slug: "metabolic-syndrome",
    bodySystemSlug: "metabolic",
    mechanism: "oxidative-stress",
    primaryProduct: "echo-flask",
    confidenceLevel: "strong",
    description: "A cluster of conditions including high blood pressure, high blood sugar, excess body fat, and abnormal cholesterol levels that increase the risk of heart disease, stroke, and diabetes.",
    keywords: ["metabolic syndrome", "metabolic disorder", "insulin resistance", "metabolic"],
  },
  {
    name: "Type 2 Diabetes",
    slug: "type-2-diabetes",
    bodySystemSlug: "metabolic",
    mechanism: "oxidative-stress",
    primaryProduct: "echo-flask",
    confidenceLevel: "strong",
    description: "A chronic condition affecting how the body processes blood sugar (glucose). Hydrogen water research shows promising effects on glycemic control and insulin sensitivity.",
    keywords: ["diabetes", "diabetic", "glucose", "glycemic", "insulin", "blood sugar", "hyperglycemia", "hba1c"],
  },
  {
    name: "Rheumatoid Arthritis",
    slug: "rheumatoid-arthritis",
    bodySystemSlug: "musculoskeletal",
    mechanism: "inflammation",
    primaryProduct: "echo-flask",
    confidenceLevel: "strong",
    description: "An autoimmune disorder causing chronic inflammation of the joints. Molecular hydrogen has demonstrated anti-inflammatory properties relevant to RA management.",
    keywords: ["rheumatoid", "arthritis", "joint inflammation", "autoimmune arthritis", "synovial"],
  },
  {
    name: "Exercise Recovery",
    slug: "exercise-recovery",
    bodySystemSlug: "musculoskeletal",
    mechanism: "oxidative-stress",
    primaryProduct: "echo-flask",
    confidenceLevel: "strong",
    description: "The process of muscle repair and adaptation after physical exercise. Hydrogen water may reduce exercise-induced oxidative stress and accelerate recovery.",
    keywords: ["exercise", "athletic", "muscle fatigue", "recovery", "sport", "physical performance", "training", "ergogenic", "muscle damage"],
  },
  {
    name: "Inflammation",
    slug: "inflammation",
    bodySystemSlug: "immune",
    mechanism: "inflammation",
    primaryProduct: "echo-flask",
    confidenceLevel: "strong",
    description: "The body's natural immune response that can become chronic and contribute to disease. Molecular hydrogen selectively reduces harmful reactive oxygen species.",
    keywords: ["inflammation", "inflammatory", "anti-inflammatory", "cytokine", "nf-kb", "il-6", "tnf", "c-reactive protein", "crp"],
  },
  {
    name: "Oxidative Stress",
    slug: "oxidative-stress",
    bodySystemSlug: "metabolic",
    mechanism: "oxidative-stress",
    primaryProduct: "echo-flask",
    confidenceLevel: "strong",
    description: "An imbalance between free radicals and antioxidants in the body. Hydrogen acts as a selective antioxidant targeting the most harmful hydroxyl radicals.",
    keywords: ["oxidative stress", "antioxidant", "free radical", "reactive oxygen species", "ros", "hydroxyl radical", "redox", "malondialdehyde", "mda", "8-ohdg", "superoxide dismutase", "sod"],
  },
  {
    name: "Cognitive Function",
    slug: "cognitive-function",
    bodySystemSlug: "neurological",
    mechanism: "neuroprotection",
    primaryProduct: "echo-flask",
    confidenceLevel: "moderate",
    description: "Mental processes including memory, attention, and decision-making. Hydrogen may support cognitive health through neuroprotective mechanisms.",
    keywords: ["cognitive", "cognition", "memory", "brain", "neuroprotect", "mental", "alzheimer", "dementia", "neurodegener"],
  },
  {
    name: "Gut Health",
    slug: "gut-health",
    bodySystemSlug: "digestive",
    mechanism: "gut-microbiome",
    primaryProduct: "echo-flask",
    confidenceLevel: "moderate",
    description: "The function and balance of the gastrointestinal tract and its microbiome. Hydrogen water may positively influence gut barrier function and microbial diversity.",
    keywords: ["gut", "intestinal", "microbiome", "gastrointestinal", "colitis", "ibs", "bowel", "digestive", "gastric", "colon"],
  },
  {
    name: "Skin Aging",
    slug: "skin-aging",
    bodySystemSlug: "dermatological",
    mechanism: "oxidative-stress",
    primaryProduct: "echo-h2-machine",
    confidenceLevel: "moderate",
    description: "The progressive deterioration of skin structure and function. Hydrogen water bathing may reduce UV damage and improve skin elasticity.",
    keywords: ["skin", "dermat", "wrinkle", "uv", "photoaging", "collagen", "wound healing", "epiderm"],
  },
  {
    name: "Blood Pressure",
    slug: "blood-pressure",
    bodySystemSlug: "cardiovascular",
    mechanism: "oxidative-stress",
    primaryProduct: "echo-flask",
    confidenceLevel: "strong",
    description: "The force of blood pushing against artery walls. Hydrogen may help maintain healthy blood pressure through vascular protective effects.",
    keywords: ["blood pressure", "hypertension", "hypotension", "vascular", "endothelial", "systolic", "diastolic", "arterial"],
  },
  {
    name: "Fatty Liver (NAFLD)",
    slug: "fatty-liver-nafld",
    bodySystemSlug: "metabolic",
    mechanism: "oxidative-stress",
    primaryProduct: "echo-flask",
    confidenceLevel: "strong",
    description: "Non-alcoholic fatty liver disease, a condition of excess fat stored in the liver. Hydrogen may reduce hepatic oxidative stress and inflammation.",
    keywords: ["fatty liver", "nafld", "nash", "hepatic", "liver", "hepatosteatosis", "liver fibrosis"],
  },
  {
    name: "Parkinson's Disease",
    slug: "parkinsons-disease",
    bodySystemSlug: "neurological",
    mechanism: "neuroprotection",
    primaryProduct: "echo-flask",
    confidenceLevel: "strong",
    description: "A progressive neurodegenerative disorder affecting movement. Hydrogen has shown neuroprotective effects in both animal models and human trials.",
    keywords: ["parkinson", "dopamin", "substantia nigra", "neurodegenerat", "motor function", "tremor"],
  },
  {
    name: "Athletic Performance",
    slug: "athletic-performance",
    bodySystemSlug: "musculoskeletal",
    mechanism: "mitochondrial",
    primaryProduct: "echo-flask",
    confidenceLevel: "moderate",
    description: "Physical capabilities during sport and exercise. Hydrogen may enhance performance through improved mitochondrial function and reduced fatigue.",
    keywords: ["athletic", "performance", "endurance", "vo2", "lactate", "sprint", "power output", "aerobic", "anaerobic"],
  },
  {
    name: "Radiation Therapy Side Effects",
    slug: "radiation-therapy-side-effects",
    bodySystemSlug: "oncology",
    mechanism: "oxidative-stress",
    primaryProduct: "echo-refresh",
    confidenceLevel: "strong",
    description: "Adverse effects from cancer radiation treatment. Hydrogen water has demonstrated radioprotective effects, reducing side effects without compromising treatment efficacy.",
    keywords: ["radiation", "radiotherapy", "radioprotect", "cancer treatment", "irradiation", "chemoradiation", "mucositis"],
  },
  {
    name: "Allergies",
    slug: "allergies",
    bodySystemSlug: "immune",
    mechanism: "inflammation",
    primaryProduct: "echo-flask",
    confidenceLevel: "moderate",
    description: "Immune system overreactions to normally harmless substances. Hydrogen may modulate allergic responses through anti-inflammatory pathways.",
    keywords: ["allergy", "allergic", "histamine", "ige", "atopic", "rhinitis", "asthma", "hypersensitivity"],
  },
  {
    name: "Chronic Fatigue",
    slug: "chronic-fatigue",
    bodySystemSlug: "immune",
    mechanism: "mitochondrial",
    primaryProduct: "echo-flask",
    confidenceLevel: "moderate",
    description: "Persistent exhaustion not relieved by rest. Hydrogen may support energy production through mitochondrial function improvement.",
    keywords: ["fatigue", "chronic fatigue", "tiredness", "energy", "mitochondri", "atp"],
  },
  {
    name: "Kidney Health",
    slug: "kidney-health",
    bodySystemSlug: "renal",
    mechanism: "oxidative-stress",
    primaryProduct: "echo-flask",
    confidenceLevel: "moderate",
    description: "The functional integrity of the kidneys. Hydrogen may protect against kidney damage from various causes including ischemia and toxins.",
    keywords: ["kidney", "renal", "nephro", "dialysis", "creatinine", "glomerular", "proteinuria", "ckd"],
  },
  {
    name: "Cholesterol",
    slug: "cholesterol",
    bodySystemSlug: "cardiovascular",
    mechanism: "oxidative-stress",
    primaryProduct: "echo-flask",
    confidenceLevel: "strong",
    description: "Blood lipid levels including LDL, HDL, and total cholesterol. Hydrogen may help maintain healthy cholesterol through antioxidant mechanisms.",
    keywords: ["cholesterol", "lipid", "ldl", "hdl", "triglyceride", "dyslipidemia", "hyperlipidemia", "statin", "atherosclerosis"],
  },
  {
    name: "Weight Loss & Metabolism",
    slug: "weight-loss-metabolism",
    bodySystemSlug: "metabolic",
    mechanism: "oxidative-stress",
    primaryProduct: "echo-flask",
    confidenceLevel: "emerging",
    description: "Body weight management and metabolic rate. Emerging research suggests hydrogen may support healthy metabolism and body composition.",
    keywords: ["weight", "obesity", "bmi", "body mass", "adipose", "fat loss", "metabolism", "thermogenesis", "leptin"],
  },
  {
    name: "Anxiety & Stress",
    slug: "anxiety-stress",
    bodySystemSlug: "neurological",
    mechanism: "neuroprotection",
    primaryProduct: "echo-flask",
    confidenceLevel: "preliminary",
    description: "Mental health conditions involving excessive worry and stress response. Preliminary research explores hydrogen's potential anxiolytic and stress-buffering effects.",
    keywords: ["anxiety", "stress", "cortisol", "anxiolytic", "mood", "depression", "psychological", "mental health"],
  },
];

export async function seedHealthConditions() {
  logger.info("Starting health conditions seeding...", "ConditionSeeder");

  try {
    // Step 1: Ensure body systems exist
    for (const bs of BODY_SYSTEMS) {
      await db.execute(sql`
        INSERT INTO body_systems (name, slug, description)
        VALUES (${bs.name}, ${bs.slug}, ${bs.description})
        ON CONFLICT (slug) DO NOTHING
      `);
    }
    logger.info(`Ensured ${BODY_SYSTEMS.length} body systems exist`, "ConditionSeeder");

    // Step 2: Get body system IDs
    const bsResult = await db.execute(sql`SELECT id, slug FROM body_systems`);
    const bsMap = new Map<string, number>();
    for (const row of (bsResult.rows || []) as any[]) {
      bsMap.set(row.slug, row.id);
    }

    // Step 3: Insert conditions
    let conditionsInserted = 0;
    for (const condition of CONDITIONS) {
      const bodySystemId = bsMap.get(condition.bodySystemSlug);
      if (!bodySystemId) {
        logger.warn(`Body system not found: ${condition.bodySystemSlug}`, "ConditionSeeder");
        continue;
      }

      await db.execute(sql`
        INSERT INTO health_conditions (
          name, slug, description, body_system_id,
          mechanism_summary, primary_product, confidence_level,
          display_order, study_count
        ) VALUES (
          ${condition.name}, ${condition.slug}, ${condition.description},
          ${bodySystemId}, ${condition.mechanism}, ${condition.primaryProduct},
          ${condition.confidenceLevel}, ${conditionsInserted}, 0
        )
        ON CONFLICT (slug) DO UPDATE SET
          description = EXCLUDED.description,
          mechanism_summary = EXCLUDED.mechanism_summary,
          primary_product = EXCLUDED.primary_product,
          confidence_level = EXCLUDED.confidence_level
      `);
      conditionsInserted++;
    }
    logger.info(`Upserted ${conditionsInserted} health conditions`, "ConditionSeeder");

    // Step 4: Map studies to conditions via keyword matching
    const conditionResult = await db.execute(sql`SELECT id, slug FROM health_conditions`);
    const conditionMap = new Map<string, number>();
    for (const row of (conditionResult.rows || []) as any[]) {
      conditionMap.set(row.slug, row.id);
    }

    let totalMappings = 0;
    const mappingReport: { condition: string; count: number }[] = [];

    for (const condition of CONDITIONS) {
      const conditionId = conditionMap.get(condition.slug);
      if (!conditionId) continue;

      // Build keyword matching WHERE clause
      // Match against title and abstract using ILIKE
      const keywordClauses = condition.keywords
        .map((kw) => `(LOWER(title) LIKE '%${kw.toLowerCase().replace(/'/g, "''")}%' OR LOWER(abstract) LIKE '%${kw.toLowerCase().replace(/'/g, "''")}%')`)
        .join(" OR ");

      // Find matching studies
      const matchResult = await db.execute(
        sql.raw(`SELECT id FROM studies WHERE ${keywordClauses}`)
      );
      const matchedStudies = (matchResult.rows || []) as any[];

      // Insert mappings
      let conditionMappings = 0;
      for (const study of matchedStudies) {
        await db.execute(sql`
          INSERT INTO study_health_conditions (study_id, health_condition_id)
          VALUES (${study.id}, ${conditionId})
          ON CONFLICT DO NOTHING
        `);
        conditionMappings++;
      }

      totalMappings += conditionMappings;
      mappingReport.push({ condition: condition.name, count: conditionMappings });

      // Update study count on the condition
      await db.execute(sql`
        UPDATE health_conditions
        SET study_count = ${conditionMappings}
        WHERE id = ${conditionId}
      `);
    }

    // Step 5: Update human trial counts
    await db.execute(sql`
      UPDATE health_conditions hc SET human_trial_count = (
        SELECT COUNT(DISTINCT shc.study_id)
        FROM study_health_conditions shc
        JOIN studies s ON s.id = shc.study_id
        WHERE shc.health_condition_id = hc.id
          AND (
            LOWER(s.study_type) LIKE '%human%'
            OR LOWER(s.study_type) LIKE '%clinical%'
            OR LOWER(s.study_type) LIKE '%rct%'
            OR LOWER(s.study_type) LIKE '%randomized%'
            OR s.is_human_trial = true
          )
      )
    `);

    // Log mapping report
    logger.info(`Study-condition mapping complete:`, "ConditionSeeder");
    for (const entry of mappingReport.sort((a, b) => b.count - a.count)) {
      logger.info(`  ${entry.condition}: ${entry.count} studies`, "ConditionSeeder");
    }
    logger.info(`Total mappings created: ${totalMappings}`, "ConditionSeeder");

    // Return type is void for migration runner compatibility
  } catch (error) {
    logger.error("Health conditions seeding failed", error, "ConditionSeeder");
    throw error;
  }
}
