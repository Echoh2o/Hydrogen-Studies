/**
 * Research Taxonomy
 * 
 * Defines categorization systems for hydrogen research including:
 * - Topics and categories
 * - Health conditions
 * - Demographic groups
 * - Delivery methods
 */

// Topics organized by category
export const topicsByCategory = [
  {
    name: "Health Conditions",
    description: "Research related to specific health conditions",
    topics: [
      { id: "neurodegenerative", name: "Neurodegenerative Diseases", description: "Alzheimer's, Parkinson's, dementia, etc." },
      { id: "cardiovascular", name: "Cardiovascular Health", description: "Heart disease, stroke, hypertension, etc." },
      { id: "metabolism", name: "Metabolism & Diabetes", description: "Diabetes, metabolic syndrome, obesity" },
      { id: "inflammation", name: "Inflammation", description: "Inflammatory conditions and diseases" },
      { id: "autoimmune", name: "Autoimmune Disorders", description: "Multiple sclerosis, rheumatoid arthritis, etc." },
      { id: "cancer", name: "Cancer Research", description: "Cancer prevention and treatment" },
      { id: "respiratory", name: "Respiratory Conditions", description: "Asthma, COPD, lung health" },
      { id: "digestive", name: "Digestive Health", description: "IBS, IBD, gut microbiome" },
      { id: "kidney", name: "Kidney Function", description: "Kidney disease and protection" },
      { id: "liver", name: "Liver Health", description: "Liver disease and protection" },
      { id: "mental_health", name: "Mental Health", description: "Depression, anxiety, stress" }
    ]
  },
  {
    name: "Biological Mechanisms",
    description: "Research focused on how hydrogen works in the body",
    topics: [
      { id: "oxidative_stress", name: "Oxidative Stress", description: "Reactive oxygen species and antioxidant activity" },
      { id: "inflammation_mechanism", name: "Inflammation Pathways", description: "Anti-inflammatory mechanisms" },
      { id: "cell_signaling", name: "Cell Signaling", description: "Cellular communication and signaling pathways" },
      { id: "mitochondrial", name: "Mitochondrial Function", description: "Energy production and mitochondrial health" },
      { id: "apoptosis", name: "Apoptosis", description: "Programmed cell death" },
      { id: "gene_expression", name: "Gene Expression", description: "Epigenetic effects and gene regulation" },
      { id: "immune_function", name: "Immune System", description: "Immune response and modulation" },
      { id: "gut_microbiome", name: "Gut Microbiome", description: "Effects on intestinal bacteria" }
    ]
  },
  {
    name: "Delivery Methods",
    description: "Research on different ways to administer hydrogen",
    topics: [
      { id: "hydrogen_water", name: "Hydrogen-Rich Water", description: "Dissolved H2 in drinking water" },
      { id: "inhalation", name: "Hydrogen Gas Inhalation", description: "Breathing H2 gas mixtures" },
      { id: "topical", name: "Topical Application", description: "Hydrogen-rich water for skin" },
      { id: "bath", name: "Hydrogen Baths", description: "Bathing in hydrogen-rich water" },
      { id: "injection", name: "Hydrogen Injection", description: "Intravenous or subcutaneous administration" },
      { id: "tablets", name: "Hydrogen Tablets", description: "Magnesium-based H2 generating tablets" },
      { id: "food", name: "Hydrogen-Rich Food", description: "Food sources that increase hydrogen" }
    ]
  },
  {
    name: "Clinical Applications",
    description: "Research on practical applications in medicine",
    topics: [
      { id: "preventative", name: "Preventative Medicine", description: "Disease prevention applications" },
      { id: "adjunctive", name: "Adjunctive Therapy", description: "Used alongside standard treatments" },
      { id: "exercise", name: "Exercise Performance", description: "Sports and physical performance" },
      { id: "recovery", name: "Recovery & Rehabilitation", description: "Post-surgery or injury recovery" },
      { id: "longevity", name: "Anti-Aging & Longevity", description: "Effects on aging and lifespan" },
      { id: "aesthetic", name: "Skin & Aesthetic", description: "Dermatological applications" }
    ]
  },
  {
    name: "Research Types",
    description: "Different types of research studies",
    topics: [
      { id: "clinical_trials", name: "Clinical Trials", description: "Human intervention studies" },
      { id: "animal_studies", name: "Animal Studies", description: "Research on animal models" },
      { id: "cell_studies", name: "In Vitro Studies", description: "Laboratory cell culture research" },
      { id: "meta_analysis", name: "Meta-Analyses", description: "Statistical analysis of multiple studies" },
      { id: "case_studies", name: "Case Studies", description: "Individual patient reports" },
      { id: "review", name: "Review Articles", description: "Comprehensive research summaries" }
    ]
  }
];

// List of health conditions for filtering
export const healthConditionsList = [
  { id: "alzheimers", name: "Alzheimer's Disease", category: "Neurodegenerative" },
  { id: "parkinsons", name: "Parkinson's Disease", category: "Neurodegenerative" },
  { id: "dementia", name: "Dementia", category: "Neurodegenerative" },
  { id: "stroke", name: "Stroke", category: "Neurodegenerative" },
  { id: "heart_disease", name: "Heart Disease", category: "Cardiovascular" },
  { id: "hypertension", name: "Hypertension", category: "Cardiovascular" },
  { id: "atherosclerosis", name: "Atherosclerosis", category: "Cardiovascular" },
  { id: "diabetes", name: "Diabetes", category: "Metabolic" },
  { id: "obesity", name: "Obesity", category: "Metabolic" },
  { id: "metabolic_syndrome", name: "Metabolic Syndrome", category: "Metabolic" },
  { id: "arthritis", name: "Arthritis", category: "Inflammatory" },
  { id: "multiple_sclerosis", name: "Multiple Sclerosis", category: "Autoimmune" },
  { id: "lupus", name: "Lupus", category: "Autoimmune" },
  { id: "cancer_general", name: "Cancer (General)", category: "Cancer" },
  { id: "lung_cancer", name: "Lung Cancer", category: "Cancer" },
  { id: "colorectal_cancer", name: "Colorectal Cancer", category: "Cancer" },
  { id: "asthma", name: "Asthma", category: "Respiratory" },
  { id: "copd", name: "COPD", category: "Respiratory" },
  { id: "ibs", name: "Irritable Bowel Syndrome", category: "Digestive" },
  { id: "ibd", name: "Inflammatory Bowel Disease", category: "Digestive" },
  { id: "kidney_disease", name: "Kidney Disease", category: "Kidney" },
  { id: "liver_disease", name: "Liver Disease", category: "Liver" },
  { id: "depression", name: "Depression", category: "Mental Health" },
  { id: "anxiety", name: "Anxiety", category: "Mental Health" },
  { id: "stress", name: "Stress", category: "Mental Health" },
  { id: "sleep_disorders", name: "Sleep Disorders", category: "Mental Health" },
  { id: "skin_conditions", name: "Skin Conditions", category: "Dermatological" },
  { id: "allergies", name: "Allergies", category: "Immune" },
  { id: "chronic_fatigue", name: "Chronic Fatigue", category: "Metabolic" }
];

// Demographic groups for targeting research
export const demographicGroups = [
  { id: "elderly", name: "Elderly", description: "Adults over 65 years" },
  { id: "women", name: "Women", description: "Female-specific health concerns" },
  { id: "men", name: "Men", description: "Male-specific health concerns" },
  { id: "children", name: "Children", description: "Under 18 years" },
  { id: "athletes", name: "Athletes", description: "Sports and physical performance" },
  { id: "pregnant", name: "Pregnant Women", description: "Pregnancy-related research" },
  { id: "disabled", name: "People with Disabilities", description: "Research focused on disabilities" }
];

// Delivery methods for hydrogen
export const deliveryMethods = [
  { 
    id: "hydrogen_water", 
    name: "Hydrogen-Rich Water", 
    description: "Water containing dissolved molecular hydrogen",
    examples: ["Bottled hydrogen water", "Hydrogen generators", "Hydrogen tablets in water"]
  },
  { 
    id: "inhalation", 
    name: "Hydrogen Gas Inhalation", 
    description: "Breathing hydrogen gas, typically mixed with other gases",
    examples: ["H2 inhalers", "Hydrogen gas generators", "Medical hydrogen mixtures"]
  },
  { 
    id: "topical", 
    name: "Topical Applications", 
    description: "Direct application to the skin or affected areas",
    examples: ["H2 sprays", "Hydrogen-rich creams", "Hydrogen water bathing"]
  },
  { 
    id: "bath", 
    name: "Hydrogen Baths", 
    description: "Immersion in hydrogen-rich water",
    examples: ["Hydrogen bath systems", "Hydrogen spa treatments"]
  },
  { 
    id: "tablets", 
    name: "Hydrogen Tablets", 
    description: "Pills or tablets that generate hydrogen",
    examples: ["Magnesium-based hydrogen tablets", "Hydrogen-producing supplements"]
  }
];