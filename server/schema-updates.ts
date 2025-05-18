import { sql } from 'drizzle-orm';
import { db } from './db';
import * as schema from '@shared/schema';
import * as hydrogenSchema from '@shared/schema-hydrogen-fields';

/**
 * Run database migrations to update the schema
 */
export async function runDatabaseMigrations() {
  console.log('Starting database migrations...');
  
  try {
    // Add benefits table
    await createBenefitsTable();
    
    // Add demographics table
    await createDemographicsTable();
    
    // Add mechanisms table
    await createMechanismsTable();
    
    // Add delivery methods table
    await createDeliveryMethodsTable();
    
    // Add duration categories table
    await createDurationCategoriesTable();
    
    // Add study outcomes table
    await createStudyOutcomesTable();
    
    // Add mapping tables
    await createMappingTables();
    
    console.log('Database migrations completed successfully');
  } catch (error) {
    console.error('Error running database migrations:', error);
    throw error;
  }
}

/**
 * Create the benefits table
 */
async function createBenefitsTable() {
  try {
    // Check if table exists
    const tableExists = await checkTableExists('benefits');
    if (tableExists) {
      console.log('Benefits table already exists, skipping creation');
      return;
    }
    
    console.log('Creating benefits table...');
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS benefits (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        description TEXT NOT NULL,
        icon TEXT,
        slug TEXT NOT NULL UNIQUE,
        display_order INTEGER NOT NULL DEFAULT 0,
        study_count INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
    console.log('Benefits table created successfully');
  } catch (error) {
    console.error('Error creating benefits table:', error);
    throw error;
  }
}

/**
 * Create the demographics table
 */
async function createDemographicsTable() {
  try {
    // Check if table exists
    const tableExists = await checkTableExists('demographics');
    if (tableExists) {
      console.log('Demographics table already exists, skipping creation');
      return;
    }
    
    console.log('Creating demographics table...');
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS demographics (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        description TEXT NOT NULL,
        icon TEXT,
        slug TEXT NOT NULL UNIQUE,
        display_order INTEGER NOT NULL DEFAULT 0,
        study_count INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
    console.log('Demographics table created successfully');
  } catch (error) {
    console.error('Error creating demographics table:', error);
    throw error;
  }
}

/**
 * Create the mechanisms table
 */
async function createMechanismsTable() {
  try {
    // Check if table exists
    const tableExists = await checkTableExists('mechanisms');
    if (tableExists) {
      console.log('Mechanisms table already exists, skipping creation');
      return;
    }
    
    console.log('Creating mechanisms table...');
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS mechanisms (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        description TEXT NOT NULL,
        icon TEXT,
        slug TEXT NOT NULL UNIQUE,
        display_order INTEGER NOT NULL DEFAULT 0,
        study_count INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
    console.log('Mechanisms table created successfully');
  } catch (error) {
    console.error('Error creating mechanisms table:', error);
    throw error;
  }
}

/**
 * Create the delivery methods table
 */
async function createDeliveryMethodsTable() {
  try {
    // Check if table exists
    const tableExists = await checkTableExists('delivery_methods');
    if (tableExists) {
      console.log('Delivery methods table already exists, skipping creation');
      return;
    }
    
    console.log('Creating delivery methods table...');
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS delivery_methods (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        description TEXT NOT NULL,
        icon TEXT,
        slug TEXT NOT NULL UNIQUE,
        display_order INTEGER NOT NULL DEFAULT 0,
        study_count INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
    console.log('Delivery methods table created successfully');
  } catch (error) {
    console.error('Error creating delivery methods table:', error);
    throw error;
  }
}

/**
 * Create the duration categories table
 */
async function createDurationCategoriesTable() {
  try {
    // Check if table exists
    const tableExists = await checkTableExists('duration_categories');
    if (tableExists) {
      console.log('Duration categories table already exists, skipping creation');
      return;
    }
    
    console.log('Creating duration categories table...');
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS duration_categories (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        description TEXT NOT NULL,
        min_days INTEGER,
        max_days INTEGER,
        display_order INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
    console.log('Duration categories table created successfully');
  } catch (error) {
    console.error('Error creating duration categories table:', error);
    throw error;
  }
}

/**
 * Create the study outcomes table
 */
async function createStudyOutcomesTable() {
  try {
    // Check if table exists
    const tableExists = await checkTableExists('study_outcomes');
    if (tableExists) {
      console.log('Study outcomes table already exists, skipping creation');
      return;
    }
    
    console.log('Creating study outcomes table...');
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS study_outcomes (
        id SERIAL PRIMARY KEY,
        study_id INTEGER NOT NULL UNIQUE REFERENCES studies(id),
        plain_english_summary TEXT NOT NULL,
        key_findings TEXT[],
        significance_level TEXT,
        outcome_direction TEXT,
        confidence_score INTEGER,
        clinical_relevance TEXT,
        why_it_matters TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
    console.log('Study outcomes table created successfully');
  } catch (error) {
    console.error('Error creating study outcomes table:', error);
    throw error;
  }
}

/**
 * Create all mapping tables between studies and categories
 */
async function createMappingTables() {
  try {
    // Study benefits mapping
    await createMappingTable('study_benefits', 'study_id', 'benefit_id', 'benefits');
    
    // Study demographics mapping
    await createMappingTable('study_demographics', 'study_id', 'demographic_id', 'demographics');
    
    // Study mechanisms mapping
    await createMappingTable('study_mechanisms', 'study_id', 'mechanism_id', 'mechanisms');
    
    // Study delivery methods mapping
    await createMappingTable('study_delivery_methods', 'study_id', 'delivery_method_id', 'delivery_methods');
    
    // Study durations mapping
    await createMappingTable('study_durations', 'study_id', 'duration_category_id', 'duration_categories');
  } catch (error) {
    console.error('Error creating mapping tables:', error);
    throw error;
  }
}

/**
 * Create a mapping table between studies and another entity
 */
async function createMappingTable(tableName: string, studyColumn: string, entityColumn: string, entityTable: string) {
  try {
    // Check if table exists
    const tableExists = await checkTableExists(tableName);
    if (tableExists) {
      console.log(`${tableName} table already exists, skipping creation`);
      return;
    }
    
    console.log(`Creating ${tableName} table...`);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS ${sql.identifier(tableName)} (
        ${sql.identifier(studyColumn)} INTEGER NOT NULL REFERENCES studies(id),
        ${sql.identifier(entityColumn)} INTEGER NOT NULL REFERENCES ${sql.identifier(entityTable)}(id),
        PRIMARY KEY (${sql.identifier(studyColumn)}, ${sql.identifier(entityColumn)})
      );
    `);
    console.log(`${tableName} table created successfully`);
  } catch (error) {
    console.error(`Error creating ${tableName} table:`, error);
    throw error;
  }
}

/**
 * Check if a table exists in the database
 */
async function checkTableExists(tableName: string): Promise<boolean> {
  try {
    const result = await db.execute(sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public'
        AND table_name = ${tableName}
      );
    `);
    
    // The result is an array with the first element containing a record with the exists property
    if (result && result.length > 0) {
      // Convert the first result row object to an array and get the first value
      const existsValue = Object.values(result[0])[0];
      return !!existsValue;
    }
    
    return false;
  } catch (error) {
    console.error(`Error checking if ${tableName} table exists:`, error);
    throw error;
  }
}

/**
 * Initialize sample data for the new tables
 */
export async function initializeSampleCategoriesData() {
  try {
    // Benefits
    await initializeBenefits();
    
    // Demographics
    await initializeDemographics();
    
    // Mechanisms
    await initializeMechanisms();
    
    // Delivery Methods
    await initializeDeliveryMethods();
    
    // Duration Categories
    await initializeDurationCategories();
  } catch (error) {
    console.error('Error initializing sample data:', error);
    throw error;
  }
}

/**
 * Initialize sample benefits data
 */
async function initializeBenefits() {
  try {
    // Check if data already exists
    const existingCount = await db.select({ count: sql`COUNT(*)` })
      .from(hydrogenSchema.benefits)
      .then(res => Number(res[0]?.count) || 0);
    
    if (existingCount > 0) {
      console.log(`Benefits data already exists (${existingCount} records), skipping initialization`);
      return;
    }
    
    console.log('Initializing benefits data...');
    
    const benefitsData = [
      {
        name: 'Pain Relief',
        description: 'Studies demonstrating hydrogen\'s effectiveness in reducing various types of pain.',
        slug: 'pain-relief',
        icon: '🌟',
        displayOrder: 1
      },
      {
        name: 'Brain Health',
        description: 'Research on hydrogen\'s effects on cognitive function, memory, and neurological disorders.',
        slug: 'brain-health',
        icon: '🧠',
        displayOrder: 2
      },
      {
        name: 'Skin Health',
        description: 'Studies focusing on hydrogen\'s effects on skin conditions, aging, and appearance.',
        slug: 'skin-health',
        icon: '✨',
        displayOrder: 3
      },
      {
        name: 'Energy & Exercise',
        description: 'Research on hydrogen\'s impact on athletic performance, recovery, and energy levels.',
        slug: 'energy-exercise',
        icon: '⚡',
        displayOrder: 4
      },
      {
        name: 'Inflammation Reduction',
        description: 'Studies showing hydrogen\'s anti-inflammatory properties across different conditions.',
        slug: 'inflammation-reduction',
        icon: '🔥',
        displayOrder: 5
      },
      {
        name: 'Digestive Health',
        description: 'Research on hydrogen\'s effects on gut health, digestive disorders, and the microbiome.',
        slug: 'digestive-health',
        icon: '🍃',
        displayOrder: 6
      },
      {
        name: 'Cellular Protection',
        description: 'Studies on hydrogen\'s antioxidant properties and protection against cellular damage.',
        slug: 'cellular-protection',
        icon: '🛡️',
        displayOrder: 7
      },
      {
        name: 'Metabolic Health',
        description: 'Research on hydrogen\'s effects on diabetes, obesity, and metabolic disorders.',
        slug: 'metabolic-health',
        icon: '⚖️',
        displayOrder: 8
      }
    ];
    
    // Insert benefits
    for (const benefit of benefitsData) {
      await db.insert(hydrogenSchema.benefits).values({
        name: benefit.name,
        description: benefit.description,
        slug: benefit.slug,
        icon: benefit.icon,
        displayOrder: benefit.displayOrder,
        studyCount: 0
      });
    }
    
    console.log('Benefits data initialized successfully');
  } catch (error) {
    console.error('Error initializing benefits data:', error);
    throw error;
  }
}

/**
 * Initialize sample demographics data
 */
async function initializeDemographics() {
  try {
    // Check if data already exists
    const existingCount = await db.select({ count: sql`COUNT(*)` })
      .from(hydrogenSchema.demographics)
      .then(res => Number(res[0]?.count) || 0);
    
    if (existingCount > 0) {
      console.log(`Demographics data already exists (${existingCount} records), skipping initialization`);
      return;
    }
    
    console.log('Initializing demographics data...');
    
    const demographicsData = [
      {
        name: 'Men',
        description: 'Studies specifically involving male participants or focusing on male health issues.',
        slug: 'men',
        icon: '👨',
        displayOrder: 1
      },
      {
        name: 'Women',
        description: 'Studies specifically involving female participants or focusing on women\'s health issues.',
        slug: 'women',
        icon: '👩',
        displayOrder: 2
      },
      {
        name: 'Children',
        description: 'Studies involving participants under 18 years of age or pediatric conditions.',
        slug: 'children',
        icon: '👶',
        displayOrder: 3
      },
      {
        name: 'Elderly',
        description: 'Studies focusing on participants over 65 or age-related conditions.',
        slug: 'elderly',
        icon: '👴',
        displayOrder: 4
      },
      {
        name: 'Athletes',
        description: 'Studies involving active athletes or focusing on sports performance and recovery.',
        slug: 'athletes',
        icon: '🏃',
        displayOrder: 5
      },
      {
        name: 'Healthy Adults',
        description: 'Studies conducted on generally healthy adult participants.',
        slug: 'healthy-adults',
        icon: '💪',
        displayOrder: 6
      },
      {
        name: 'Clinical Patients',
        description: 'Studies involving participants with specific medical conditions or diseases.',
        slug: 'clinical-patients',
        icon: '🏥',
        displayOrder: 7
      }
    ];
    
    // Insert demographics
    for (const demographic of demographicsData) {
      await db.insert(hydrogenSchema.demographics).values({
        name: demographic.name,
        description: demographic.description,
        slug: demographic.slug,
        icon: demographic.icon,
        displayOrder: demographic.displayOrder,
        studyCount: 0
      });
    }
    
    console.log('Demographics data initialized successfully');
  } catch (error) {
    console.error('Error initializing demographics data:', error);
    throw error;
  }
}

/**
 * Initialize sample mechanisms data
 */
async function initializeMechanisms() {
  try {
    // Check if data already exists
    const existingCount = await db.select({ count: sql`COUNT(*)` })
      .from(hydrogenSchema.mechanisms)
      .then(res => Number(res[0]?.count) || 0);
    
    if (existingCount > 0) {
      console.log(`Mechanisms data already exists (${existingCount} records), skipping initialization`);
      return;
    }
    
    console.log('Initializing mechanisms data...');
    
    const mechanismsData = [
      {
        name: 'Antioxidant',
        description: 'Hydrogen\'s ability to neutralize harmful free radicals and reduce oxidative stress.',
        slug: 'antioxidant',
        icon: '🛡️',
        displayOrder: 1
      },
      {
        name: 'Anti-inflammatory',
        description: 'Hydrogen\'s capacity to reduce inflammation by suppressing inflammatory signaling pathways.',
        slug: 'anti-inflammatory',
        icon: '🔥',
        displayOrder: 2
      },
      {
        name: 'Mitochondrial Enhancement',
        description: 'Hydrogen\'s effects on improving mitochondrial function and cellular energy production.',
        slug: 'mitochondrial-enhancement',
        icon: '⚡',
        displayOrder: 3
      },
      {
        name: 'Apoptosis Regulation',
        description: 'Hydrogen\'s ability to regulate programmed cell death (apoptosis) processes.',
        slug: 'apoptosis-regulation',
        icon: '🔄',
        displayOrder: 4
      },
      {
        name: 'Gene Expression Modulation',
        description: 'Hydrogen\'s influence on gene expression and signaling pathways within cells.',
        slug: 'gene-expression-modulation',
        icon: '🧬',
        displayOrder: 5
      },
      {
        name: 'Cell Signaling Modulation',
        description: 'Hydrogen\'s effects on cellular communication and signaling pathways.',
        slug: 'cell-signaling-modulation',
        icon: '📡',
        displayOrder: 6
      },
      {
        name: 'Neuroprotection',
        description: 'Hydrogen\'s ability to protect neurons from damage and degeneration.',
        slug: 'neuroprotection',
        icon: '🧠',
        displayOrder: 7
      },
      {
        name: 'Immune Regulation',
        description: 'Hydrogen\'s effects on modulating and optimizing immune system responses.',
        slug: 'immune-regulation',
        icon: '🌡️',
        displayOrder: 8
      }
    ];
    
    // Insert mechanisms
    for (const mechanism of mechanismsData) {
      await db.insert(hydrogenSchema.mechanisms).values({
        name: mechanism.name,
        description: mechanism.description,
        slug: mechanism.slug,
        icon: mechanism.icon,
        displayOrder: mechanism.displayOrder,
        studyCount: 0
      });
    }
    
    console.log('Mechanisms data initialized successfully');
  } catch (error) {
    console.error('Error initializing mechanisms data:', error);
    throw error;
  }
}

/**
 * Initialize sample delivery methods data
 */
async function initializeDeliveryMethods() {
  try {
    // Check if data already exists
    const existingCount = await db.select({ count: sql`COUNT(*)` })
      .from(hydrogenSchema.deliveryMethods)
      .then(res => Number(res[0]?.count) || 0);
    
    if (existingCount > 0) {
      console.log(`Delivery methods data already exists (${existingCount} records), skipping initialization`);
      return;
    }
    
    console.log('Initializing delivery methods data...');
    
    const deliveryMethodsData = [
      {
        name: 'Hydrogen-Rich Water',
        description: 'Studies using water infused with molecular hydrogen for oral consumption.',
        slug: 'hydrogen-rich-water',
        icon: '💧',
        displayOrder: 1
      },
      {
        name: 'Hydrogen Inhalation',
        description: 'Studies involving inhaling hydrogen gas, typically at low concentrations.',
        slug: 'hydrogen-inhalation',
        icon: '💨',
        displayOrder: 2
      },
      {
        name: 'Hydrogen Baths',
        description: 'Studies using hydrogen-infused water for bathing and topical application.',
        slug: 'hydrogen-baths',
        icon: '🛁',
        displayOrder: 3
      },
      {
        name: 'Hydrogen Tablets',
        description: 'Studies using solid tablets that release hydrogen when dissolved in water.',
        slug: 'hydrogen-tablets',
        icon: '💊',
        displayOrder: 4
      },
      {
        name: 'Intravenous Hydrogen',
        description: 'Studies using hydrogen-rich saline administered intravenously in clinical settings.',
        slug: 'intravenous-hydrogen',
        icon: '💉',
        displayOrder: 5
      },
      {
        name: 'Topical Hydrogen',
        description: 'Studies applying hydrogen-rich solutions directly to the skin or specific body areas.',
        slug: 'topical-hydrogen',
        icon: '🧴',
        displayOrder: 6
      },
      {
        name: 'Hydrogen-Producing Gut Bacteria',
        description: 'Studies involving bacteria that naturally produce hydrogen in the digestive system.',
        slug: 'hydrogen-producing-gut-bacteria',
        icon: '🦠',
        displayOrder: 7
      }
    ];
    
    // Insert delivery methods
    for (const method of deliveryMethodsData) {
      await db.insert(hydrogenSchema.deliveryMethods).values({
        name: method.name,
        description: method.description,
        slug: method.slug,
        icon: method.icon,
        displayOrder: method.displayOrder,
        studyCount: 0
      });
    }
    
    console.log('Delivery methods data initialized successfully');
  } catch (error) {
    console.error('Error initializing delivery methods data:', error);
    throw error;
  }
}

/**
 * Initialize sample duration categories data
 */
async function initializeDurationCategories() {
  try {
    // Check if data already exists
    const existingCount = await db.select({ count: sql`COUNT(*)` })
      .from(hydrogenSchema.durationCategories)
      .then(res => Number(res[0]?.count) || 0);
    
    if (existingCount > 0) {
      console.log(`Duration categories data already exists (${existingCount} records), skipping initialization`);
      return;
    }
    
    console.log('Initializing duration categories data...');
    
    const durationCategoriesData = [
      {
        name: 'Single Dose',
        description: 'Studies examining the effects of a single administration of hydrogen.',
        minDays: null,
        maxDays: 1,
        displayOrder: 1
      },
      {
        name: 'Acute (Short-Term)',
        description: 'Studies examining short-term effects over days or a few weeks.',
        minDays: 1,
        maxDays: 28,
        displayOrder: 2
      },
      {
        name: 'Subchronic',
        description: 'Studies examining effects over 1-3 months of administration.',
        minDays: 29,
        maxDays: 90,
        displayOrder: 3
      },
      {
        name: 'Chronic',
        description: 'Studies examining long-term effects over several months or longer.',
        minDays: 91,
        maxDays: 365,
        displayOrder: 4
      },
      {
        name: 'Long-Term Follow-up',
        description: 'Studies tracking participants after treatment for extended periods.',
        minDays: 366,
        maxDays: null,
        displayOrder: 5
      }
    ];
    
    // Insert duration categories
    for (const category of durationCategoriesData) {
      await db.insert(hydrogenSchema.durationCategories).values({
        name: category.name,
        description: category.description,
        minDays: category.minDays,
        maxDays: category.maxDays,
        displayOrder: category.displayOrder
      });
    }
    
    console.log('Duration categories data initialized successfully');
  } catch (error) {
    console.error('Error initializing duration categories data:', error);
    throw error;
  }
}