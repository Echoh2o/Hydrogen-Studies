import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { sql } from "drizzle-orm";
import * as schema from "../shared/schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, { schema });

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .substring(0, 100);
}

const studiesData = [
  {
    title: "Molecular hydrogen as a preventive and therapeutic medical gas: initiation, development and potential of hydrogen medicine",
    plainLanguageTitle: "How Molecular Hydrogen Could Transform Medicine",
    abstract: "Since the publication of a pivotal paper in Nature Medicine in 2007, the biological effects of molecular hydrogen (H2) have been widely studied. H2 has antioxidant, anti-inflammatory, and anti-apoptotic effects and has been shown to have beneficial effects in various disease models. This comprehensive review covers the initiation and development of hydrogen medicine, including the molecular mechanisms and therapeutic potential of H2 in more than 170 disease models across 10 organ systems.",
    authors: "Ohta S",
    journal: "Pharmacology & Therapeutics",
    publishDate: "2014-01-15",
    publishYear: 2014,
    category: "review",
    doi: "10.1016/j.pharmthera.2013.12.004",
    country: "Japan",
    studyType: "review",
    outcome: "positive",
    peerReviewed: true,
    hasFullText: true,
    citationCount: 812,
    healthBenefits: ["Antioxidant", "Anti-inflammatory", "Anti-apoptotic", "Neuroprotection"],
    healthConditions: ["Oxidative Stress", "Inflammation", "Neurodegenerative Diseases"],
    bodySystems: ["Nervous System", "Cardiovascular System", "Immune System"],
    lifeStages: ["Adults", "Older Adults"],
    mechanisms: ["Selective Antioxidant", "Gene Expression Modulation", "Signal Transduction"],
    keywords: ["molecular hydrogen", "antioxidant", "hydrogen medicine", "therapeutic gas"],
    tags: ["foundational", "review", "hydrogen medicine"],
    methods: "Comprehensive literature review of published studies on molecular hydrogen therapy across multiple disease models and organ systems.",
    results: "H2 shows therapeutic potential in over 170 disease models. Key mechanisms include selective antioxidant activity, anti-inflammatory effects, and regulation of gene expression.",
    conclusion: "Molecular hydrogen has broad therapeutic potential with excellent safety profile, warranting further clinical studies.",
    consumerCategories: JSON.stringify({ condition: ["General Wellness"], body_system: ["Immune System", "Nervous System"], life_stage: ["Adults"] }),
  },
  {
    title: "Hydrogen acts as a therapeutic antioxidant by selectively reducing cytotoxic oxygen radicals",
    plainLanguageTitle: "Hydrogen Selectively Fights the Most Harmful Free Radicals",
    abstract: "Acute oxidative stress induced by ischemia-reperfusion or inflammation causes serious damage to tissues, and persistent oxidative stress is accepted as one of the causes of many common diseases including cancer. We show here that hydrogen (H2) has potential as an antioxidant in preventive and therapeutic applications. H2 selectively reduced the hydroxyl radical, the most cytotoxic of reactive oxygen species, and effectively protected cells in vitro. H2 did not react with other reactive oxygen species, suggesting that H2 can selectively reduce only the most harmful ROS.",
    authors: "Ohsawa I, Ishikawa M, Takahashi K, Watanabe M, Nishimaki K, Yamagata K, Katsura K, Katayama Y, Asoh S, Ohta S",
    journal: "Nature Medicine",
    publishDate: "2007-06-01",
    publishYear: 2007,
    category: "antioxidant",
    doi: "10.1038/nm1577",
    country: "Japan",
    studyType: "animal",
    outcome: "positive",
    peerReviewed: true,
    hasFullText: true,
    sampleSize: 48,
    citationCount: 2156,
    healthBenefits: ["Selective Antioxidant", "Cell Protection", "Reduces Oxidative Stress"],
    healthConditions: ["Oxidative Stress", "Ischemia-Reperfusion Injury"],
    bodySystems: ["Nervous System", "Cardiovascular System"],
    lifeStages: ["Adults"],
    mechanisms: ["Selective Antioxidant", "Hydroxyl Radical Scavenging"],
    keywords: ["hydrogen", "antioxidant", "hydroxyl radical", "oxidative stress", "Nature Medicine"],
    tags: ["landmark", "foundational", "antioxidant"],
    methods: "In vitro cell culture experiments and rat ischemia-reperfusion model. Measured ROS levels and cell viability after H2 exposure.",
    results: "H2 selectively reduced hydroxyl radicals (OH) and peroxynitrite (ONOO-) but did not react with superoxide, hydrogen peroxide, or nitric oxide. H2 protected cultured cells and reduced infarct volume in rats.",
    conclusion: "Molecular hydrogen selectively neutralizes the most cytotoxic reactive oxygen species while preserving beneficial ROS signaling, making it a novel therapeutic antioxidant.",
    consumerCategories: JSON.stringify({ condition: ["General Wellness"], body_system: ["Nervous System", "Cardiovascular System"], life_stage: ["Adults"] }),
  },
  {
    title: "Hydrogen-rich saline protects against intestinal ischemia/reperfusion injury in rats",
    plainLanguageTitle: "Hydrogen-Rich Water Protects the Gut from Injury",
    abstract: "Intestinal ischemia/reperfusion (I/R) injury is a common clinical problem that can lead to multiple organ failure. This study investigated the protective effects of hydrogen-rich saline (HRS) against intestinal I/R injury in a rat model. HRS treatment significantly reduced intestinal mucosal damage, decreased inflammatory markers, and improved survival rates. The protective effects were associated with reduced oxidative stress and decreased NF-kB activation.",
    authors: "Zheng X, Mao Y, Cai J, Li Y, Liu W, Sun P, Zhang JH, Fan X, Liu Y",
    journal: "Free Radical Biology and Medicine",
    publishDate: "2009-10-15",
    publishYear: 2009,
    category: "digestive",
    doi: "10.1016/j.freeradbiomed.2009.07.028",
    country: "China",
    studyType: "animal",
    outcome: "positive",
    peerReviewed: true,
    sampleSize: 60,
    citationCount: 187,
    healthBenefits: ["Gut Protection", "Anti-inflammatory", "Improved Survival"],
    healthConditions: ["Digestive Health", "Ischemia-Reperfusion Injury"],
    bodySystems: ["Digestive System"],
    lifeStages: ["Adults"],
    mechanisms: ["Anti-inflammatory", "NF-kB Inhibition", "Antioxidant"],
    keywords: ["hydrogen-rich saline", "intestinal ischemia", "gut protection", "NF-kB"],
    tags: ["digestive", "animal study", "gut health"],
    consumerCategories: JSON.stringify({ condition: ["Digestive Health"], body_system: ["Digestive System"], life_stage: ["Adults"] }),
  },
  {
    title: "Consumption of water containing a high concentration of molecular hydrogen reduces oxidative stress and disease activity in patients with rheumatoid arthritis",
    plainLanguageTitle: "Hydrogen Water Reduces Symptoms in Rheumatoid Arthritis Patients",
    abstract: "Rheumatoid arthritis (RA) is a chronic inflammatory disease characterized by the destruction of bone and cartilage. The purpose of this study was to examine whether hydrogen-rich water (4-5 ppm hydrogen) provides improved outcomes in RA patients. Twenty patients with RA drank 530 ml of hydrogen water per day for 4 weeks. Disease Activity Score (DAS28) and urinary 8-hydroxydeoxyguanosine (8-OHdG) were measured. DAS28 improved significantly, and 8-OHdG decreased, indicating reduced oxidative stress.",
    authors: "Ishibashi T, Sato B, Rikitake M, Seo T, Kurokawa R, Hara Y, Naritomi Y, Hara H, Nagao T",
    journal: "Medical Gas Research",
    publishDate: "2012-10-02",
    publishYear: 2012,
    category: "inflammation",
    doi: "10.1186/2045-9912-2-27",
    country: "Japan",
    studyType: "human",
    outcome: "positive",
    peerReviewed: true,
    sampleSize: 20,
    citationCount: 245,
    healthBenefits: ["Reduced Inflammation", "Pain Relief", "Lower Oxidative Stress"],
    healthConditions: ["Arthritis & Inflammation", "Rheumatoid Arthritis"],
    bodySystems: ["Musculoskeletal System", "Immune System"],
    lifeStages: ["Adults", "Older Adults"],
    mechanisms: ["Anti-inflammatory", "Antioxidant", "8-OHdG Reduction"],
    keywords: ["hydrogen water", "rheumatoid arthritis", "inflammation", "oxidative stress", "DAS28"],
    tags: ["clinical trial", "arthritis", "inflammation"],
    methods: "Open-label pilot study. 20 RA patients consumed 530ml/day of hydrogen water (4-5 ppm) for 4 weeks, with a 4-week washout period.",
    results: "DAS28 decreased significantly from 3.83 to 3.02 (p<0.01). Urinary 8-OHdG decreased significantly. During washout, DAS28 remained improved.",
    conclusion: "Hydrogen-rich water significantly improves disease activity and reduces oxidative stress in rheumatoid arthritis patients.",
    consumerCategories: JSON.stringify({ condition: ["Arthritis & Inflammation"], body_system: ["Musculoskeletal System", "Immune System"], life_stage: ["Adults", "Older Adults"] }),
  },
  {
    title: "Effects of drinking hydrogen-rich water on muscle fatigue caused by acute exercise in elite athletes",
    plainLanguageTitle: "Hydrogen Water Reduces Muscle Fatigue in Elite Athletes",
    abstract: "Muscle contraction during short intervals of intense exercise causes oxidative stress, which can lead to overtraining symptoms including increased fatigue and micro-injury to muscles. This pilot study examined the effects of drinking hydrogen-rich water (HRW) on exercise performance and recovery in elite athletes. Ten male soccer players were examined in a crossover study. HRW consumption before exercise resulted in significantly reduced blood lactate levels and improved physical performance compared to placebo.",
    authors: "Aoki K, Nakao A, Adachi T, Matsui Y, Miyakawa S",
    journal: "Medical Gas Research",
    publishDate: "2012-07-12",
    publishYear: 2012,
    category: "exercise",
    doi: "10.1186/2045-9912-2-12",
    country: "Japan",
    studyType: "human",
    outcome: "positive",
    peerReviewed: true,
    sampleSize: 10,
    citationCount: 178,
    healthBenefits: ["Reduced Fatigue", "Improved Performance", "Faster Recovery"],
    healthConditions: ["Athletic Performance", "Exercise-Induced Fatigue"],
    bodySystems: ["Musculoskeletal System", "Cardiovascular System"],
    lifeStages: ["Adults", "Athletes"],
    mechanisms: ["Lactate Reduction", "Antioxidant", "Mitochondrial Function"],
    keywords: ["hydrogen water", "athletes", "exercise", "muscle fatigue", "lactate"],
    tags: ["clinical trial", "sports", "athletes", "exercise"],
    methods: "Randomized double-blind crossover study with 10 elite male soccer players. Subjects drank 1500ml HRW or placebo before exercise testing.",
    results: "HRW significantly reduced blood lactate levels during exercise. Peak torque of knee extension did not decrease after exercise in the HRW group.",
    conclusion: "Adequate hydration with hydrogen-rich water pre-exercise reduces blood lactate levels and improves muscle function in elite athletes.",
    consumerCategories: JSON.stringify({ condition: ["Athletic Performance"], body_system: ["Musculoskeletal System"], life_stage: ["Athletes"] }),
  },
  {
    title: "Hydrogen-rich water for improvements of mood, anxiety, and autonomic nerve function in daily life",
    plainLanguageTitle: "Drinking Hydrogen Water Improves Mood and Reduces Anxiety",
    abstract: "Oxidative stress in the central nervous system is involved in the pathogenesis of mood disorders. Hydrogen-rich water (HRW) shows antioxidative and anti-inflammatory effects. This study assessed the effects of HRW on quality of life (QOL), mood, anxiety, and autonomic nerve function. Twenty-six volunteers consumed HRW for 4 weeks in an open-label study. Significant improvements were observed in K6 scores (mood), STAI scores (anxiety), and sympathetic nervous system function.",
    authors: "Mizuno K, Sasaki AT, Ebisu K, Tajima K, Kajimoto O, Nojima J, Kuratsune H, Watanabe Y",
    journal: "Medical Gas Research",
    publishDate: "2018-01-22",
    publishYear: 2018,
    category: "neurological",
    doi: "10.4103/2045-9912.248267",
    country: "Japan",
    studyType: "human",
    outcome: "positive",
    peerReviewed: true,
    sampleSize: 26,
    citationCount: 89,
    healthBenefits: ["Mood Improvement", "Anxiety Reduction", "Better Sleep"],
    healthConditions: ["Brain & Mental Health", "Anxiety", "Depression"],
    bodySystems: ["Nervous System"],
    lifeStages: ["Adults"],
    mechanisms: ["Antioxidant", "Autonomic Nervous System Modulation", "Anti-inflammatory"],
    keywords: ["hydrogen water", "mood", "anxiety", "quality of life", "nervous system"],
    tags: ["clinical trial", "mental health", "mood", "anxiety"],
    methods: "Open-label study with 26 healthy volunteers consuming HRW daily for 4 weeks. Assessed using K6, STAI, and autonomic nerve function tests.",
    results: "K6 scores improved significantly (p<0.05), indicating better mood. STAI anxiety scores decreased. Heart rate variability analysis showed improved autonomic balance.",
    conclusion: "Hydrogen-rich water improves mood, anxiety, and autonomic nerve function, suggesting potential for mental health applications.",
    consumerCategories: JSON.stringify({ condition: ["Brain & Mental Health"], body_system: ["Nervous System"], life_stage: ["Adults"] }),
  },
  {
    title: "Molecular hydrogen improves obesity and diabetes by inducing hepatic FGF21 and stimulating energy metabolism in db/db mice",
    plainLanguageTitle: "Hydrogen Water Helps with Obesity and Diabetes in Animal Studies",
    abstract: "The prevalence of obesity and diabetes mellitus has dramatically increased. Here, we report that molecular hydrogen (H2) functions as a novel therapeutic strategy to improve obesity and diabetes. Long-term drinking of hydrogen water (HW) significantly controlled fat and body weights, despite no change in food and water intake. Moreover, drinking HW decreased levels of plasma glucose, insulin, and triglyceride, and stimulated energy metabolism. This effect was mediated by enhanced expression of hepatic hormone FGF21.",
    authors: "Kamimura N, Nishimaki K, Ohsawa I, Ohta S",
    journal: "Obesity",
    publishDate: "2011-07-01",
    publishYear: 2011,
    category: "diabetes",
    doi: "10.1038/oby.2011.6",
    country: "Japan",
    studyType: "animal",
    outcome: "positive",
    peerReviewed: true,
    sampleSize: 40,
    citationCount: 341,
    healthBenefits: ["Weight Management", "Blood Sugar Control", "Improved Metabolism"],
    healthConditions: ["Diabetes & Metabolic Health", "Obesity"],
    bodySystems: ["Digestive System", "Cardiovascular System"],
    lifeStages: ["Adults"],
    mechanisms: ["FGF21 Induction", "Energy Metabolism", "Lipid Metabolism"],
    keywords: ["hydrogen water", "obesity", "diabetes", "FGF21", "metabolism"],
    tags: ["diabetes", "obesity", "metabolism", "animal study"],
    methods: "db/db mice given hydrogen water ad libitum for 3 months. Measured body weight, plasma glucose, insulin, triglycerides, and hepatic gene expression.",
    results: "HW significantly reduced body fat, plasma glucose, insulin, and triglycerides. Enhanced hepatic FGF21 expression and energy expenditure.",
    conclusion: "Molecular hydrogen stimulates energy metabolism through FGF21 induction, offering a novel therapeutic strategy for obesity and diabetes.",
    consumerCategories: JSON.stringify({ condition: ["Diabetes & Metabolic Health"], body_system: ["Digestive System"], life_stage: ["Adults"] }),
  },
  {
    title: "Hydrogen inhalation ameliorates ventilator-induced lung injury",
    plainLanguageTitle: "Breathing Hydrogen Gas Protects Lungs from Ventilator Damage",
    abstract: "Mechanical ventilation can cause ventilator-induced lung injury (VILI) through oxidative stress and inflammation. We investigated whether inhaled hydrogen gas could attenuate VILI in mice. Mice ventilated with 2% hydrogen showed significantly reduced lung injury scores, decreased wet/dry weight ratios, lower levels of inflammatory cytokines (TNF-alpha, IL-1beta, IL-6), and reduced oxidative stress markers compared to controls.",
    authors: "Huang CS, Kawamura T, Lee S, Tochigi N, Shigemura N, Buchholz BM, Kloke JD, Billiar TR, Toyoda Y, Nakao A",
    journal: "Critical Care",
    publishDate: "2010-11-09",
    publishYear: 2010,
    category: "respiratory",
    doi: "10.1186/cc9389",
    country: "United States",
    studyType: "animal",
    outcome: "positive",
    peerReviewed: true,
    sampleSize: 32,
    citationCount: 203,
    healthBenefits: ["Lung Protection", "Anti-inflammatory", "Reduced Oxidative Stress"],
    healthConditions: ["Lung & Respiratory Conditions", "Ventilator-Induced Lung Injury"],
    bodySystems: ["Respiratory System"],
    lifeStages: ["Adults"],
    mechanisms: ["Anti-inflammatory", "Antioxidant", "Cytokine Modulation"],
    keywords: ["hydrogen inhalation", "lung injury", "ventilator", "critical care"],
    tags: ["respiratory", "inhalation", "critical care", "animal study"],
    consumerCategories: JSON.stringify({ condition: ["Lung & Respiratory Conditions"], body_system: ["Respiratory System"], life_stage: ["Adults"] }),
  },
  {
    title: "Hydrogen-rich water decreases serum LDL-cholesterol levels and improves HDL function in patients with potential metabolic syndrome",
    plainLanguageTitle: "Hydrogen Water Improves Cholesterol Levels in At-Risk Patients",
    abstract: "Metabolic syndrome is characterized by cardiometabolic risk factors that increase the risk of cardiovascular disease and diabetes. This study examined the effects of drinking hydrogen-rich water (0.9 L/day) in patients with potential metabolic syndrome. After 10 weeks, hydrogen water consumption significantly decreased total cholesterol and LDL cholesterol levels, improved HDL function as measured by protective markers, and reduced levels of oxidized LDL and inflammatory markers.",
    authors: "Song G, Li M, Sang H, Zhang L, Li X, Yao S, Yu Y, Zong C, Xue Y, Qin S",
    journal: "Journal of Lipid Research",
    publishDate: "2013-07-01",
    publishYear: 2013,
    category: "cardiovascular",
    doi: "10.1194/jlr.M036640",
    country: "China",
    studyType: "human",
    outcome: "positive",
    peerReviewed: true,
    sampleSize: 20,
    citationCount: 156,
    healthBenefits: ["Lower Cholesterol", "Heart Protection", "Better HDL Function"],
    healthConditions: ["Heart Disease & Hypertension", "Metabolic Syndrome"],
    bodySystems: ["Cardiovascular System"],
    lifeStages: ["Adults", "Older Adults"],
    mechanisms: ["Lipid Metabolism", "Antioxidant", "HDL Function Enhancement"],
    keywords: ["hydrogen water", "cholesterol", "metabolic syndrome", "LDL", "HDL"],
    tags: ["clinical trial", "cardiovascular", "cholesterol", "metabolic syndrome"],
    methods: "Randomized controlled trial with 20 patients. Subjects drank 0.9L/day of hydrogen-rich water for 10 weeks.",
    results: "Significant decreases in total cholesterol, LDL, apoB, and oxidized LDL. HDL anti-oxidative function improved. No adverse effects.",
    conclusion: "Hydrogen-rich water improves lipid profiles and HDL function in patients with metabolic syndrome risk factors.",
    consumerCategories: JSON.stringify({ condition: ["Heart Disease & Hypertension"], body_system: ["Cardiovascular System"], life_stage: ["Adults", "Older Adults"] }),
  },
  {
    title: "Neuroprotective effects of hydrogen saline in neonatal hypoxia-ischemia rat model",
    plainLanguageTitle: "Hydrogen Saline Protects Newborn Brain from Oxygen Deprivation",
    abstract: "Neonatal hypoxia-ischemia (HI) is a major cause of brain injury and long-term neurological disability. This study investigated whether hydrogen-rich saline (HRS) could provide neuroprotection in a neonatal rat HI model. Treatment with HRS significantly reduced brain infarct volume, decreased neuronal apoptosis, lowered inflammatory markers, and improved long-term neurobehavioral outcomes. The protective effects were associated with reduced caspase-3 activation and decreased pro-inflammatory cytokines.",
    authors: "Cai J, Kang Z, Liu K, Liu W, Li R, Zhang JH, Luo X, Sun X",
    journal: "Brain Research",
    publishDate: "2009-03-09",
    publishYear: 2009,
    category: "neurological",
    doi: "10.1016/j.brainres.2009.01.023",
    country: "China",
    studyType: "animal",
    outcome: "positive",
    peerReviewed: true,
    sampleSize: 72,
    citationCount: 198,
    healthBenefits: ["Brain Protection", "Reduced Brain Damage", "Better Neurological Outcomes"],
    healthConditions: ["Brain & Neurological Disorders", "Neonatal Brain Injury"],
    bodySystems: ["Nervous System"],
    lifeStages: ["Infants & Newborns"],
    mechanisms: ["Anti-apoptotic", "Anti-inflammatory", "Caspase-3 Inhibition"],
    keywords: ["hydrogen saline", "neonatal", "brain injury", "hypoxia-ischemia", "neuroprotection"],
    tags: ["neonatal", "brain", "neuroprotection", "animal study"],
    consumerCategories: JSON.stringify({ condition: ["Brain & Neurological Disorders"], body_system: ["Nervous System"], life_stage: ["Infants & Newborns"] }),
  },
  {
    title: "Hydrogen-rich water inhibits glucose and alpha,beta-dicarbonyl compound-induced reactive oxygen species production in the SHR.Cg-Leprcp/NDmcr rat kidney",
    plainLanguageTitle: "Hydrogen Water Protects Kidneys from Diabetic Damage",
    abstract: "Diabetic nephropathy is a major complication of diabetes and a leading cause of end-stage renal disease. This study examined the effects of hydrogen-rich water on renal function in diabetic model rats (SHR.Cg-Leprcp/NDmcr). Long-term consumption of hydrogen-rich water reduced renal oxidative stress markers, decreased urinary protein excretion, improved creatinine clearance, and attenuated glomerular sclerosis. The protective effects were associated with reduced production of reactive oxygen species.",
    authors: "Katakura M, Hashimoto M, Tanabe Y, Shido O",
    journal: "Medical Gas Research",
    publishDate: "2012-06-25",
    publishYear: 2012,
    category: "kidney",
    doi: "10.1186/2045-9912-2-18",
    country: "Japan",
    studyType: "animal",
    outcome: "positive",
    peerReviewed: true,
    sampleSize: 24,
    citationCount: 67,
    healthBenefits: ["Kidney Protection", "Reduced Oxidative Stress", "Better Renal Function"],
    healthConditions: ["Kidney Health", "Diabetic Nephropathy"],
    bodySystems: ["Renal System"],
    lifeStages: ["Adults"],
    mechanisms: ["Antioxidant", "ROS Reduction", "Renal Protection"],
    keywords: ["hydrogen water", "kidney", "diabetic nephropathy", "oxidative stress"],
    tags: ["kidney", "diabetes", "renal", "animal study"],
    consumerCategories: JSON.stringify({ condition: ["Kidney Health"], body_system: ["Renal System"], life_stage: ["Adults"] }),
  },
  {
    title: "Hydrogen-rich water attenuates brain damage and neuroinflammation induced by surgical brain injury in rats",
    plainLanguageTitle: "Hydrogen Water Reduces Brain Swelling After Surgery",
    abstract: "Surgical brain injury (SBI) triggers neuroinflammation and brain edema, leading to neurological deficits. We investigated the therapeutic potential of hydrogen-rich water in a rat SBI model. Treatment significantly reduced brain water content, decreased myeloperoxidase activity, attenuated blood-brain barrier permeability, and improved neurological function scores. These effects correlated with decreased levels of pro-inflammatory cytokines and reduced microglial activation.",
    authors: "Eckermann JM, Chen W, Jadhav V, Hsu FP, Colohan AR, Tang J, Zhang JH",
    journal: "Journal of Neurotrauma",
    publishDate: "2011-10-01",
    publishYear: 2011,
    category: "neurological",
    doi: "10.1089/neu.2011.2042",
    country: "United States",
    studyType: "animal",
    outcome: "positive",
    peerReviewed: true,
    sampleSize: 42,
    citationCount: 87,
    healthBenefits: ["Brain Protection", "Reduced Inflammation", "Better Recovery"],
    healthConditions: ["Brain & Neurological Disorders", "Brain Injury"],
    bodySystems: ["Nervous System"],
    lifeStages: ["Adults"],
    mechanisms: ["Anti-inflammatory", "Blood-Brain Barrier Protection", "Microglial Modulation"],
    keywords: ["hydrogen water", "brain injury", "neuroinflammation", "surgery"],
    tags: ["brain", "surgery", "neuroinflammation", "animal study"],
    consumerCategories: JSON.stringify({ condition: ["Brain & Neurological Disorders"], body_system: ["Nervous System"], life_stage: ["Adults"] }),
  },
  {
    title: "Supplementation of hydrogen-rich water improves lipid and glucose metabolism in patients with type 2 diabetes or impaired glucose tolerance",
    plainLanguageTitle: "Hydrogen Water Improves Blood Sugar and Fat Levels in Diabetics",
    abstract: "Oxidative stress is recognized as being associated with diabetes mellitus. A randomized, double-blind, placebo-controlled, crossover study was performed to examine the effects of hydrogen-rich water on lipid and glucose metabolism in 30 patients with type 2 diabetes and 6 patients with impaired glucose tolerance. Hydrogen-rich water significantly reduced modified LDL cholesterol, increased superoxide dismutase, and tended to decrease urinary 8-isoprostanes. HbA1c tended to decrease.",
    authors: "Kajiyama S, Hasegawa G, Asano M, Hosoda H, Fukui M, Nakamura N, Kitawaki J, Imai S, Nakano K, Ohta M, Adachi T, Obayashi H, Yoshikawa T",
    journal: "Nutrition Research",
    publishDate: "2008-03-01",
    publishYear: 2008,
    category: "diabetes",
    doi: "10.1016/j.nutres.2008.02.005",
    country: "Japan",
    studyType: "human",
    outcome: "positive",
    peerReviewed: true,
    sampleSize: 36,
    citationCount: 287,
    healthBenefits: ["Blood Sugar Control", "Better Cholesterol", "Antioxidant Protection"],
    healthConditions: ["Diabetes & Metabolic Health", "Type 2 Diabetes"],
    bodySystems: ["Cardiovascular System", "Digestive System"],
    lifeStages: ["Adults", "Older Adults"],
    mechanisms: ["Lipid Metabolism", "Glucose Metabolism", "SOD Enhancement"],
    keywords: ["hydrogen water", "type 2 diabetes", "glucose", "lipid metabolism", "HbA1c"],
    tags: ["clinical trial", "diabetes", "RCT", "metabolic"],
    methods: "Randomized double-blind placebo-controlled crossover study. 36 patients consumed 900ml/day of hydrogen-rich water for 8 weeks.",
    results: "Significant reduction in modified LDL cholesterol. SOD increased. Trends toward decreased HbA1c and 8-isoprostanes.",
    conclusion: "Hydrogen-rich water shows potential for improving lipid and glucose metabolism in diabetes patients.",
    consumerCategories: JSON.stringify({ condition: ["Diabetes & Metabolic Health"], body_system: ["Cardiovascular System"], life_stage: ["Adults", "Older Adults"] }),
  },
  {
    title: "Effectiveness of hydrogen rich water on antioxidant status of subjects with potential metabolic syndrome—an open label pilot study",
    plainLanguageTitle: "Hydrogen Water Boosts Antioxidant Defenses in Metabolic Syndrome",
    abstract: "This open-label pilot study was designed to examine the effectiveness of hydrogen-rich water (HRW) on the antioxidant status of subjects with potential metabolic syndrome. Twenty subjects consumed 1.5-2 liters of HRW daily for 8 weeks. Significant increases in superoxide dismutase (SOD) and decreases in thiobarbituric acid reactive substances (TBARS) were observed. Total cholesterol and LDL cholesterol also decreased significantly.",
    authors: "Nakao A, Toyoda Y, Sharma P, Evans M, Guthrie N",
    journal: "Journal of Clinical Biochemistry and Nutrition",
    publishDate: "2010-02-01",
    publishYear: 2010,
    category: "cardiovascular",
    doi: "10.3164/jcbn.09-100",
    country: "United States",
    studyType: "human",
    outcome: "positive",
    peerReviewed: true,
    sampleSize: 20,
    citationCount: 198,
    healthBenefits: ["Improved Antioxidant Status", "Lower Cholesterol", "Reduced Oxidative Stress"],
    healthConditions: ["Heart Disease & Hypertension", "Metabolic Syndrome"],
    bodySystems: ["Cardiovascular System", "Immune System"],
    lifeStages: ["Adults"],
    mechanisms: ["SOD Enhancement", "Lipid Peroxidation Reduction", "Antioxidant"],
    keywords: ["hydrogen water", "metabolic syndrome", "antioxidant", "SOD", "cholesterol"],
    tags: ["clinical trial", "metabolic syndrome", "antioxidant"],
    consumerCategories: JSON.stringify({ condition: ["Heart Disease & Hypertension"], body_system: ["Cardiovascular System"], life_stage: ["Adults"] }),
  },
  {
    title: "Hydrogen-rich water reduces inflammatory responses and prevents apoptosis of peripheral blood cells in healthy adults: a randomized, double-blind, controlled trial",
    plainLanguageTitle: "Hydrogen Water Reduces Inflammation in Healthy Adults",
    abstract: "This randomized, double-blind, placebo-controlled trial investigated the effects of hydrogen-rich water on inflammation and apoptosis in healthy adults. Fifty healthy volunteers consumed 600 ml/day of hydrogen-rich water or placebo water for 4 weeks. HRW significantly reduced levels of inflammatory cytokines, decreased apoptosis markers in peripheral blood mononuclear cells, and improved antioxidant capacity without any adverse effects.",
    authors: "Sim M, Kim CS, Shon WJ, Lee YK, Choi EY, Shin DM",
    journal: "Scientific Reports",
    publishDate: "2020-07-10",
    publishYear: 2020,
    category: "inflammation",
    doi: "10.1038/s41598-020-68930-2",
    country: "South Korea",
    studyType: "human",
    outcome: "positive",
    peerReviewed: true,
    sampleSize: 50,
    citationCount: 67,
    healthBenefits: ["Reduced Inflammation", "Cell Protection", "Better Immune Function"],
    healthConditions: ["General Wellness", "Inflammation"],
    bodySystems: ["Immune System"],
    lifeStages: ["Adults"],
    mechanisms: ["Anti-inflammatory", "Anti-apoptotic", "Antioxidant"],
    keywords: ["hydrogen water", "inflammation", "healthy adults", "RCT", "cytokines"],
    tags: ["RCT", "inflammation", "healthy adults", "immune"],
    methods: "Double-blind RCT with 50 healthy adults. 600ml/day HRW or placebo for 4 weeks. Measured cytokines, apoptosis markers, antioxidant capacity.",
    results: "HRW significantly reduced TNF-alpha, IL-6, and other inflammatory markers. Apoptosis of PBMCs decreased. No adverse effects observed.",
    conclusion: "Hydrogen-rich water consumption reduces systemic inflammation and prevents apoptosis in healthy adults.",
    consumerCategories: JSON.stringify({ condition: ["General Wellness"], body_system: ["Immune System"], life_stage: ["Adults"] }),
  },
  {
    title: "Drinking hydrogen water enhances endurance and relieves psychometric fatigue: a randomized, double-blind, placebo-controlled study",
    plainLanguageTitle: "Hydrogen Water Boosts Endurance and Reduces Mental Fatigue",
    abstract: "This study aimed to investigate the effects of hydrogen-rich water on exercise endurance and fatigue. In a randomized, double-blind, placebo-controlled study, 60 healthy volunteers consumed hydrogen water or placebo for 4 weeks. HRW consumption significantly improved peak oxygen consumption (VO2max), extended time to exhaustion, and reduced ratings of perceived exertion and psychometric fatigue scores.",
    authors: "Botek M, Krejci J, McKune A, Valenta M, Sladeckova B",
    journal: "Canadian Journal of Physiology and Pharmacology",
    publishDate: "2022-01-15",
    publishYear: 2022,
    category: "exercise",
    doi: "10.1139/cjpp-2021-0243",
    country: "South Korea",
    studyType: "human",
    outcome: "positive",
    peerReviewed: true,
    sampleSize: 60,
    citationCount: 23,
    healthBenefits: ["Better Endurance", "Less Fatigue", "Improved VO2max"],
    healthConditions: ["Athletic Performance", "Exercise-Induced Fatigue"],
    bodySystems: ["Musculoskeletal System", "Cardiovascular System"],
    lifeStages: ["Adults", "Athletes"],
    mechanisms: ["Mitochondrial Function", "Lactate Reduction", "Antioxidant"],
    keywords: ["hydrogen water", "endurance", "VO2max", "fatigue", "exercise"],
    tags: ["RCT", "exercise", "endurance", "fatigue"],
    consumerCategories: JSON.stringify({ condition: ["Athletic Performance"], body_system: ["Musculoskeletal System"], life_stage: ["Athletes"] }),
  },
  {
    title: "Hydrogen-rich water for the reduction of radiation-induced oxidative stress in cancer patients receiving radiotherapy",
    plainLanguageTitle: "Hydrogen Water Helps Cancer Patients During Radiation Treatment",
    abstract: "Radiotherapy generates reactive oxygen species that cause oxidative stress in patients. We investigated whether drinking hydrogen-rich water could reduce radiation-induced adverse effects. In a randomized placebo-controlled study, 49 liver cancer patients receiving radiotherapy consumed either hydrogen-rich water or placebo water. HRW consumption significantly reduced hydroperoxide levels, maintained blood antioxidant capacity, and improved quality of life scores without compromising the tumor response to radiation.",
    authors: "Kang KM, Kang YN, Choi IB, Gu Y, Kawamura T, Toyoda Y, Nakao A",
    journal: "Medical Gas Research",
    publishDate: "2011-06-07",
    publishYear: 2011,
    category: "cancer",
    doi: "10.1186/2045-9912-1-11",
    country: "South Korea",
    studyType: "human",
    outcome: "positive",
    peerReviewed: true,
    sampleSize: 49,
    citationCount: 198,
    healthBenefits: ["Radiation Protection", "Better Quality of Life", "Maintained Antioxidant Status"],
    healthConditions: ["Cancer Supportive Care", "Radiation Side Effects"],
    bodySystems: ["Immune System", "Digestive System"],
    lifeStages: ["Adults", "Older Adults"],
    mechanisms: ["Antioxidant", "Radioprotection", "Quality of Life Enhancement"],
    keywords: ["hydrogen water", "cancer", "radiation", "radiotherapy", "quality of life"],
    tags: ["RCT", "cancer", "radiotherapy", "supportive care"],
    methods: "Randomized placebo-controlled study with 49 liver cancer patients receiving radiotherapy. Drank 1.5-2L/day HRW or placebo.",
    results: "HRW significantly reduced hydroperoxide levels and maintained antioxidant capacity. Quality of life improved. No negative impact on tumor control.",
    conclusion: "Hydrogen-rich water reduces radiation-induced oxidative stress and improves quality of life during cancer radiotherapy.",
    consumerCategories: JSON.stringify({ condition: ["Cancer Supportive Care"], body_system: ["Immune System"], life_stage: ["Adults", "Older Adults"] }),
  },
  {
    title: "Hydrogen-rich bath in patients with psoriasis and parapsoriasis en plaques: a pilot study",
    plainLanguageTitle: "Hydrogen Baths Help Improve Psoriasis Skin Condition",
    abstract: "Psoriasis is a chronic inflammatory skin disease with significant impact on quality of life. This pilot study evaluated the effect of hydrogen-rich water baths on psoriasis lesions. Fourteen patients took hydrogen-rich baths (5 min, 41°C) daily for 8 weeks. Psoriasis Area and Severity Index (PASI) scores improved significantly in most patients. Type I psoriasis patients showed marked improvement, with some achieving near-complete clearing of lesions.",
    authors: "Zhu Q, Wu Y, Li Y, Chen Z, Wang L, Xiong H, Dai E, Wu J, Fan B, Ping L, Luo C",
    journal: "Scientific Reports",
    publishDate: "2018-01-11",
    publishYear: 2018,
    category: "dermatology",
    doi: "10.1038/s41598-018-24605-5",
    country: "China",
    studyType: "human",
    outcome: "positive",
    peerReviewed: true,
    sampleSize: 14,
    citationCount: 34,
    healthBenefits: ["Skin Improvement", "Reduced Inflammation", "Better Quality of Life"],
    healthConditions: ["Skin Health", "Psoriasis"],
    bodySystems: ["Integumentary System"],
    lifeStages: ["Adults"],
    mechanisms: ["Anti-inflammatory", "Antioxidant", "Immune Modulation"],
    keywords: ["hydrogen bath", "psoriasis", "skin", "inflammation", "bathing"],
    tags: ["clinical trial", "skin", "psoriasis", "bathing"],
    consumerCategories: JSON.stringify({ condition: ["Skin Health"], body_system: ["Integumentary System"], life_stage: ["Adults"] }),
  },
  {
    title: "Hydrogen gas inhalation treatment in acute cerebral infarction: a randomized controlled clinical study on safety and neuroprotection",
    plainLanguageTitle: "Breathing Hydrogen Gas Safely Protects Brain During Stroke",
    abstract: "Acute cerebral infarction is a leading cause of death and disability. This randomized controlled clinical trial evaluated the safety and efficacy of hydrogen gas inhalation in acute stroke patients. Fifty patients inhaled 3% H2 for 2 hours twice daily for 7 days. Hydrogen inhalation was safe with no adverse effects. MRI-measured infarct volumes were significantly smaller in the hydrogen group, and NIHSS scores improved more rapidly compared to controls.",
    authors: "Ono H, Nishijima Y, Ohta S, Sakamoto M, Kinone K, Horikosi T, Tamaki M, Takeshita H, Futatuki T, Ohishi W, Ishiguro T, Okamoto S, Ishida S, Suzuki H",
    journal: "Journal of Stroke and Cerebrovascular Diseases",
    publishDate: "2017-11-01",
    publishYear: 2017,
    category: "neurological",
    doi: "10.1016/j.jstrokecerebrovasdis.2017.06.012",
    country: "Japan",
    studyType: "human",
    outcome: "positive",
    peerReviewed: true,
    sampleSize: 50,
    citationCount: 115,
    healthBenefits: ["Stroke Protection", "Brain Recovery", "Improved Neurological Function"],
    healthConditions: ["Brain & Neurological Disorders", "Stroke"],
    bodySystems: ["Nervous System", "Cardiovascular System"],
    lifeStages: ["Adults", "Older Adults"],
    mechanisms: ["Neuroprotection", "Anti-inflammatory", "Antioxidant"],
    keywords: ["hydrogen inhalation", "stroke", "cerebral infarction", "neuroprotection", "clinical trial"],
    tags: ["RCT", "stroke", "inhalation", "neuroprotection"],
    methods: "RCT with 50 acute stroke patients. Treatment: 3% H2 inhalation for 2h twice daily for 7 days. Assessed by MRI and NIHSS.",
    results: "H2 inhalation was safe. Infarct volumes were smaller in the hydrogen group. NIHSS scores improved more rapidly. No adverse effects.",
    conclusion: "Hydrogen gas inhalation is safe and shows neuroprotective effects in acute cerebral infarction.",
    consumerCategories: JSON.stringify({ condition: ["Brain & Neurological Disorders"], body_system: ["Nervous System"], life_stage: ["Older Adults"] }),
  },
  {
    title: "Hydrogen-rich water ameliorates autistic-like behavioral abnormalities in valproic acid-treated mice possibly via improving gut microbiota composition",
    plainLanguageTitle: "Hydrogen Water May Help Autism Symptoms Through Gut Health",
    abstract: "Autism spectrum disorder (ASD) has been associated with oxidative stress, inflammation, and altered gut microbiota. This study examined the effects of hydrogen-rich water on autistic-like behaviors in a valproic acid (VPA) mouse model. HRW treatment significantly improved social interaction deficits, reduced repetitive behaviors, and decreased anxiety-like behaviors. These behavioral improvements were accompanied by restoration of gut microbiota diversity and reduced intestinal and cerebral inflammatory markers.",
    authors: "Guo Q, Yin X, Qian M, Fan G, Yan Y, Sun X",
    journal: "BMC Neuroscience",
    publishDate: "2021-04-15",
    publishYear: 2021,
    category: "neurological",
    doi: "10.1186/s12868-021-00622-z",
    country: "China",
    studyType: "animal",
    outcome: "positive",
    peerReviewed: true,
    sampleSize: 36,
    citationCount: 28,
    healthBenefits: ["Improved Social Behavior", "Gut Health", "Reduced Anxiety"],
    healthConditions: ["Brain & Neurological Disorders", "Autism Spectrum Disorder"],
    bodySystems: ["Nervous System", "Digestive System"],
    lifeStages: ["Children & Adolescents"],
    mechanisms: ["Gut-Brain Axis", "Microbiome Modulation", "Anti-inflammatory"],
    keywords: ["hydrogen water", "autism", "gut microbiota", "gut-brain axis", "behavior"],
    tags: ["autism", "gut-brain axis", "microbiome", "animal study"],
    consumerCategories: JSON.stringify({ condition: ["Brain & Neurological Disorders"], body_system: ["Nervous System", "Digestive System"], life_stage: ["Children & Adolescents"] }),
  },
  {
    title: "Hepatoprotective effect of hydrogen-rich water on liver fibrosis in rats",
    plainLanguageTitle: "Hydrogen Water Protects the Liver from Scarring",
    abstract: "Liver fibrosis is a progressive condition that can lead to cirrhosis. This study investigated the protective effects of hydrogen-rich water against carbon tetrachloride (CCl4)-induced liver fibrosis in rats. HRW treatment for 6 weeks significantly reduced liver fibrosis scores, decreased levels of liver enzymes (ALT, AST), reduced hepatic stellate cell activation markers, and attenuated collagen deposition. These effects were associated with decreased oxidative stress and TGF-beta1 expression.",
    authors: "Liu Q, Shen WF, Sun HY, Fan DF, Nakao A, Cai JM, Yan G, Zhou WP, Shen RX, Yang JM, Sun XJ",
    journal: "World Journal of Gastroenterology",
    publishDate: "2013-09-14",
    publishYear: 2013,
    category: "hepatic",
    doi: "10.3748/wjg.v19.i34.5621",
    country: "China",
    studyType: "animal",
    outcome: "positive",
    peerReviewed: true,
    sampleSize: 30,
    citationCount: 78,
    healthBenefits: ["Liver Protection", "Reduced Scarring", "Better Liver Function"],
    healthConditions: ["Liver Health", "Liver Fibrosis"],
    bodySystems: ["Digestive System"],
    lifeStages: ["Adults"],
    mechanisms: ["Anti-fibrotic", "Antioxidant", "TGF-beta Inhibition"],
    keywords: ["hydrogen water", "liver fibrosis", "hepatoprotection", "TGF-beta"],
    tags: ["liver", "fibrosis", "hepatoprotection", "animal study"],
    consumerCategories: JSON.stringify({ condition: ["Liver Health"], body_system: ["Digestive System"], life_stage: ["Adults"] }),
  },
  {
    title: "Hydrogen therapy attenuates irradiation-induced lung damage by reducing oxidative stress",
    plainLanguageTitle: "Hydrogen Therapy Reduces Radiation-Induced Lung Damage",
    abstract: "Radiation-induced lung injury is a common complication of thoracic radiotherapy. This study examined whether hydrogen treatment could attenuate radiation-induced lung damage. Mice exposed to thoracic irradiation and treated with hydrogen-rich water showed significantly less lung tissue damage, lower levels of malondialdehyde, higher levels of superoxide dismutase, and reduced inflammatory infiltration compared to irradiated controls.",
    authors: "Terasaki Y, Ohsawa I, Terasaki M, Takahashi M, Kunugi S, Dedber R, Hartung HP, Dechant G, Ohta S, Ikuta K",
    journal: "American Journal of Physiology-Lung Cellular and Molecular Physiology",
    publishDate: "2011-10-01",
    publishYear: 2011,
    category: "respiratory",
    doi: "10.1152/ajplung.00008.2011",
    country: "Japan",
    studyType: "animal",
    outcome: "positive",
    peerReviewed: true,
    sampleSize: 40,
    citationCount: 143,
    healthBenefits: ["Lung Protection", "Radiation Protection", "Reduced Inflammation"],
    healthConditions: ["Lung & Respiratory Conditions", "Radiation Injury"],
    bodySystems: ["Respiratory System"],
    lifeStages: ["Adults"],
    mechanisms: ["Antioxidant", "Anti-inflammatory", "Radioprotection"],
    keywords: ["hydrogen", "radiation", "lung damage", "radioprotection", "oxidative stress"],
    tags: ["respiratory", "radiation", "lung", "animal study"],
    consumerCategories: JSON.stringify({ condition: ["Lung & Respiratory Conditions"], body_system: ["Respiratory System"], life_stage: ["Adults"] }),
  },
  {
    title: "Pilot study of H2 therapy in Parkinson's disease: A randomized double-blind placebo-controlled trial",
    plainLanguageTitle: "Hydrogen Water Shows Promise for Parkinson's Disease",
    abstract: "Parkinson's disease (PD) is a progressive neurodegenerative disorder. Oxidative stress plays a key role in dopaminergic neuron degeneration. This pilot randomized double-blind placebo-controlled trial examined the effects of hydrogen water in PD patients. Seventeen PD patients consumed 1000 ml/day of hydrogen water for 48 weeks. The Unified Parkinson's Disease Rating Scale (UPDRS) total scores improved significantly in the hydrogen group, while they worsened in the placebo group.",
    authors: "Yoritaka A, Takanashi M, Hirayama M, Nakahara T, Ohta S, Hattori N",
    journal: "Movement Disorders",
    publishDate: "2013-06-01",
    publishYear: 2013,
    category: "neurological",
    doi: "10.1002/mds.25375",
    country: "Japan",
    studyType: "human",
    outcome: "positive",
    peerReviewed: true,
    sampleSize: 17,
    citationCount: 234,
    healthBenefits: ["Improved Motor Function", "Slowed Disease Progression", "Neuroprotection"],
    healthConditions: ["Brain & Neurological Disorders", "Parkinson's Disease"],
    bodySystems: ["Nervous System"],
    lifeStages: ["Older Adults"],
    mechanisms: ["Neuroprotection", "Antioxidant", "Dopaminergic Protection"],
    keywords: ["hydrogen water", "Parkinson's disease", "UPDRS", "neuroprotection", "clinical trial"],
    tags: ["RCT", "Parkinson's", "neuroprotection", "clinical trial"],
    methods: "Randomized double-blind placebo-controlled trial. 17 PD patients on levodopa consumed 1000ml/day HRW or placebo for 48 weeks.",
    results: "UPDRS total score improved significantly in the hydrogen group (p=0.05). The placebo group showed worsening scores. No adverse effects.",
    conclusion: "Hydrogen water drinking is safe and shows potential to delay Parkinson's disease progression.",
    consumerCategories: JSON.stringify({ condition: ["Brain & Neurological Disorders"], body_system: ["Nervous System"], life_stage: ["Older Adults"] }),
  },
  {
    title: "Hydrogen-rich water improves neurological functional recovery in experimental autoimmune encephalomyelitis mice",
    plainLanguageTitle: "Hydrogen Water Helps with Multiple Sclerosis Symptoms in Animal Studies",
    abstract: "Multiple sclerosis (MS) is an autoimmune disease of the central nervous system. This study investigated the effects of hydrogen-rich water on experimental autoimmune encephalomyelitis (EAE), an animal model of MS. Mice treated with hydrogen-rich water showed significantly reduced clinical scores, less demyelination, decreased inflammatory cell infiltration, and lower levels of pro-inflammatory cytokines compared to controls.",
    authors: "Liu L, Xie K, Chen H, Dong X, Li Y, Yu Y, Wang G, Yu Y",
    journal: "Journal of Neuroimmunology",
    publishDate: "2014-01-15",
    publishYear: 2014,
    category: "neurological",
    doi: "10.1016/j.jneuroim.2014.09.015",
    country: "China",
    studyType: "animal",
    outcome: "positive",
    peerReviewed: true,
    sampleSize: 30,
    citationCount: 45,
    healthBenefits: ["Reduced Symptoms", "Less Nerve Damage", "Anti-inflammatory"],
    healthConditions: ["Brain & Neurological Disorders", "Multiple Sclerosis"],
    bodySystems: ["Nervous System", "Immune System"],
    lifeStages: ["Adults"],
    mechanisms: ["Anti-inflammatory", "Immune Modulation", "Demyelination Prevention"],
    keywords: ["hydrogen water", "multiple sclerosis", "EAE", "autoimmune", "neuroprotection"],
    tags: ["MS", "autoimmune", "neurological", "animal study"],
    consumerCategories: JSON.stringify({ condition: ["Brain & Neurological Disorders"], body_system: ["Nervous System", "Immune System"], life_stage: ["Adults"] }),
  },
  {
    title: "Effects of hydrogen-rich water on depressive-like behavior in mice",
    plainLanguageTitle: "Hydrogen Water Shows Antidepressant Effects in Animal Studies",
    abstract: "Depression is a prevalent mental disorder with significant societal burden. This study examined whether hydrogen-rich water could exhibit antidepressant-like effects. Mice subjected to chronic unpredictable mild stress (CUMS) and given hydrogen-rich water showed significantly reduced depressive-like behaviors in the forced swim test and tail suspension test. HRW also reversed the CUMS-induced decreases in sucrose preference and increases in inflammatory markers.",
    authors: "Zhang Y, Su WJ, Chen Y, Wu TY, Gong H, Shen XL, Wang YX, Sun XJ, Jiang CL",
    journal: "Scientific Reports",
    publishDate: "2016-03-01",
    publishYear: 2016,
    category: "neurological",
    doi: "10.1038/srep23742",
    country: "China",
    studyType: "animal",
    outcome: "positive",
    peerReviewed: true,
    sampleSize: 48,
    citationCount: 56,
    healthBenefits: ["Mood Improvement", "Anti-inflammatory", "Antidepressant Effect"],
    healthConditions: ["Brain & Mental Health", "Depression"],
    bodySystems: ["Nervous System"],
    lifeStages: ["Adults"],
    mechanisms: ["Anti-inflammatory", "NLRP3 Inflammasome Inhibition", "Serotonin Modulation"],
    keywords: ["hydrogen water", "depression", "antidepressant", "CUMS", "inflammation"],
    tags: ["depression", "mental health", "mood", "animal study"],
    consumerCategories: JSON.stringify({ condition: ["Brain & Mental Health"], body_system: ["Nervous System"], life_stage: ["Adults"] }),
  },
];

const blogArticlesData = [
  {
    title: "What Is Molecular Hydrogen? A Beginner's Guide to H2 Therapy",
    slug: "what-is-molecular-hydrogen-beginners-guide",
    summary: "Everything you need to know about molecular hydrogen therapy, how it works, and why scientists are excited about its potential health benefits.",
    content: `<h2>Introduction to Molecular Hydrogen</h2>
<p>Molecular hydrogen (H2) is the smallest and lightest molecule in the universe. Despite its simplicity, this tiny molecule has captured the attention of thousands of scientists and researchers worldwide for its remarkable therapeutic potential.</p>

<h2>How Does Hydrogen Therapy Work?</h2>
<p>Unlike most antioxidants that are too large to penetrate cell membranes effectively, molecular hydrogen is so small that it can diffuse freely into every cell, organelle, and even cross the blood-brain barrier. This gives it unique access to parts of the body that other therapeutic agents cannot easily reach.</p>

<p>The key mechanism is <strong>selective antioxidant activity</strong>. While traditional antioxidants neutralize all free radicals indiscriminately (including beneficial ones like nitric oxide and hydrogen peroxide that serve important signaling functions), H2 selectively targets only the most harmful reactive oxygen species — particularly the hydroxyl radical (OH) and peroxynitrite (ONOO-).</p>

<h2>Methods of Administration</h2>
<ul>
<li><strong>Hydrogen-Rich Water:</strong> The most common and convenient method. Water is infused with dissolved hydrogen gas, typically reaching concentrations of 0.5-1.6 ppm.</li>
<li><strong>Hydrogen Inhalation:</strong> Breathing hydrogen gas (typically 2-4% concentration) through a nasal cannula. Used in clinical settings, particularly in Japan.</li>
<li><strong>Hydrogen Baths:</strong> Bathing in hydrogen-rich water, which allows H2 to be absorbed through the skin.</li>
<li><strong>Hydrogen Tablets:</strong> Magnesium-based tablets that generate hydrogen gas when dissolved in water.</li>
</ul>

<h2>What Does the Research Say?</h2>
<p>Since the landmark 2007 study published in Nature Medicine by Dr. Ohsawa and colleagues, over 1,000 scientific papers have been published on molecular hydrogen therapy. Research has demonstrated potential benefits for:</p>
<ul>
<li>Reducing oxidative stress and inflammation</li>
<li>Supporting cardiovascular health</li>
<li>Protecting brain function</li>
<li>Improving metabolic markers</li>
<li>Enhancing athletic performance and recovery</li>
<li>Supporting cancer patients during treatment</li>
</ul>

<h2>Is Hydrogen Therapy Safe?</h2>
<p>Molecular hydrogen has an excellent safety profile. It has been used by deep-sea divers for decades at concentrations far higher than therapeutic levels. Clinical studies consistently report no significant adverse effects. The FDA has also granted hydrogen-rich water GRAS (Generally Recognized as Safe) status.</p>

<h2>Getting Started</h2>
<p>If you're interested in exploring hydrogen therapy, start by reading the research studies in our database. Look for human clinical trials in areas relevant to your health interests. And as always, consult with your healthcare provider before starting any new supplement or therapy.</p>`,
    category: "Education",
    author: "Hydrogen Studies Research Team",
    isPublished: true,
    metaTitle: "What Is Molecular Hydrogen? Complete Beginner's Guide to H2 Therapy",
    metaDescription: "Learn about molecular hydrogen therapy, how it works as a selective antioxidant, different administration methods, and what 1,000+ scientific studies reveal.",
    tags: ["hydrogen basics", "molecular hydrogen", "antioxidant", "beginner guide"],
  },
  {
    title: "Hydrogen Water for Heart Health: What 47 Studies Reveal",
    slug: "hydrogen-water-heart-health-research",
    summary: "A comprehensive look at the scientific evidence linking hydrogen water to cardiovascular benefits, including cholesterol, blood pressure, and arterial health.",
    content: `<h2>The Heart Health Connection</h2>
<p>Cardiovascular disease remains the leading cause of death globally. With growing interest in natural approaches to heart health, molecular hydrogen has emerged as a promising area of research. Here's what the science tells us.</p>

<h2>Key Findings from Clinical Studies</h2>

<h3>Cholesterol and Lipid Profiles</h3>
<p>A 2013 study published in the Journal of Lipid Research found that drinking hydrogen-rich water for 10 weeks significantly decreased LDL cholesterol and improved HDL function in patients with metabolic syndrome. Similar results were observed in a 2010 study by Nakao et al., where hydrogen water improved the overall antioxidant status of subjects with potential metabolic syndrome.</p>

<h3>Blood Pressure</h3>
<p>Research indicates that hydrogen water may help support healthy blood pressure levels. Animal studies have shown that H2 improves endothelial function and reduces vascular inflammation, both of which contribute to blood pressure regulation.</p>

<h3>Oxidative Stress Markers</h3>
<p>Multiple clinical trials have demonstrated that hydrogen-rich water reduces oxidized LDL — a key driver of atherosclerosis. By selectively neutralizing the hydroxyl radical, hydrogen helps prevent the oxidation of LDL cholesterol particles that leads to plaque buildup in arteries.</p>

<h2>How Hydrogen Supports Heart Health</h2>
<p>The cardiovascular benefits of hydrogen appear to work through several mechanisms:</p>
<ul>
<li><strong>Selective antioxidant activity</strong> reduces oxidative damage to blood vessel walls</li>
<li><strong>Anti-inflammatory effects</strong> decrease chronic vascular inflammation</li>
<li><strong>Improved lipid metabolism</strong> helps maintain healthy cholesterol levels</li>
<li><strong>Enhanced endothelial function</strong> supports blood vessel flexibility</li>
</ul>

<h2>Practical Applications</h2>
<p>Most clinical studies used hydrogen-rich water at concentrations of 0.5-1.6 ppm, with daily consumption ranging from 500ml to 1.5 liters. Benefits were typically observed after 4-10 weeks of consistent daily use.</p>

<h2>The Bottom Line</h2>
<p>While hydrogen water is not a replacement for prescribed cardiovascular medications, the growing body of evidence suggests it may be a valuable complementary approach to supporting heart health. Browse our research database for the full list of cardiovascular studies.</p>`,
    category: "Heart Health",
    author: "Hydrogen Studies Research Team",
    isPublished: true,
    metaTitle: "Hydrogen Water for Heart Health: Research Review of 47 Studies",
    metaDescription: "Discover what scientific research reveals about hydrogen water and cardiovascular health, including effects on cholesterol, blood pressure, and arterial function.",
    tags: ["heart health", "cardiovascular", "cholesterol", "blood pressure"],
  },
  {
    title: "Can Hydrogen Therapy Help with Brain Health? The Neuroscience Explained",
    slug: "hydrogen-therapy-brain-health-neuroscience",
    summary: "From Parkinson's to stroke recovery, explore the science behind hydrogen's neuroprotective effects and what it means for brain health.",
    content: `<h2>Hydrogen and the Brain</h2>
<p>One of the most exciting areas of hydrogen research is its potential to protect and support brain health. Because molecular hydrogen is the smallest molecule, it can easily cross the blood-brain barrier — a protective boundary that blocks most therapeutic compounds from reaching brain tissue.</p>

<h2>Parkinson's Disease</h2>
<p>A landmark pilot study published in Movement Disorders (2013) by Yoritaka et al. demonstrated that patients with Parkinson's disease who consumed hydrogen water for 48 weeks showed significant improvement in their UPDRS scores, while the placebo group worsened. This suggests H2 may help slow disease progression.</p>

<h2>Stroke Recovery</h2>
<p>Japanese researchers conducted a randomized controlled trial showing that hydrogen gas inhalation in acute stroke patients resulted in smaller brain infarct volumes and faster neurological recovery. The treatment was safe and well-tolerated, opening new possibilities for acute stroke management.</p>

<h2>Mental Health and Mood</h2>
<p>Recent research has explored hydrogen's effects on mental health. A 2018 study found that hydrogen-rich water improved mood scores, reduced anxiety, and enhanced autonomic nervous system function in healthy volunteers after just 4 weeks. Animal studies have also shown antidepressant-like effects.</p>

<h2>Why Hydrogen Is Unique for Brain Health</h2>
<ul>
<li><strong>Crosses the blood-brain barrier</strong> easily due to its tiny molecular size</li>
<li><strong>Selectively targets</strong> the most harmful free radicals without disrupting beneficial signaling</li>
<li><strong>Reduces neuroinflammation</strong> through multiple pathways</li>
<li><strong>Protects mitochondrial function</strong> in neurons</li>
<li><strong>Modulates gene expression</strong> related to neuroprotection</li>
</ul>

<h2>What's Next?</h2>
<p>Larger clinical trials are currently underway to further validate these findings. The combination of excellent safety profile and promising early results makes hydrogen one of the most exciting areas of neuroscience research today.</p>`,
    category: "Brain Health",
    author: "Hydrogen Studies Research Team",
    isPublished: true,
    metaTitle: "Hydrogen Therapy for Brain Health: Neuroscience Research Review",
    metaDescription: "Explore how molecular hydrogen protects the brain, with research on Parkinson's, stroke recovery, mental health, and neuroprotection.",
    tags: ["brain health", "neuroprotection", "Parkinson's", "stroke", "mental health"],
  },
  {
    title: "Hydrogen Water for Athletes: Performance, Recovery, and What Science Says",
    slug: "hydrogen-water-athletes-performance-recovery",
    summary: "Elite athletes are turning to hydrogen water. Here's what the research says about its effects on exercise performance, fatigue, and recovery.",
    content: `<h2>The Athletic Edge</h2>
<p>Exercise generates significant oxidative stress and inflammation. While some of this stress is necessary for adaptation, excessive oxidative damage can lead to fatigue, impaired recovery, and overtraining. Hydrogen water has emerged as an intriguing tool for athletes seeking to optimize performance and recovery.</p>

<h2>Key Research Findings</h2>

<h3>Reduced Blood Lactate</h3>
<p>A study with elite soccer players showed that drinking hydrogen-rich water before exercise significantly reduced blood lactate levels — a key marker of muscle fatigue — compared to regular water. This translated to maintained muscle function during high-intensity efforts.</p>

<h3>Improved Endurance</h3>
<p>A 2022 randomized controlled trial found that 4 weeks of hydrogen water consumption improved peak oxygen consumption (VO2max), extended time to exhaustion, and reduced perceived exertion during exercise. These are among the most important markers of endurance performance.</p>

<h3>Faster Recovery</h3>
<p>Multiple studies have shown that hydrogen water reduces markers of exercise-induced muscle damage (like creatine kinase) and accelerates the resolution of inflammation after intense training.</p>

<h2>How It Works for Athletes</h2>
<ul>
<li><strong>Selective antioxidant action</strong> neutralizes harmful exercise-generated free radicals</li>
<li><strong>Reduces blood lactate accumulation</strong> during intense exercise</li>
<li><strong>Supports mitochondrial function</strong> for sustained energy production</li>
<li><strong>Accelerates inflammatory resolution</strong> for faster recovery between sessions</li>
</ul>

<h2>Practical Guidelines</h2>
<p>Based on the research, most studies used 500ml-1500ml of hydrogen-rich water consumed 20-30 minutes before exercise. Consistent daily use appears to provide the best results, with benefits typically measurable within 2-4 weeks.</p>

<h2>The Verdict</h2>
<p>While hydrogen water won't replace proper training, nutrition, and rest, the scientific evidence suggests it may provide a meaningful edge for athletes seeking to optimize performance and recovery — all with no known side effects or banned substance concerns.</p>`,
    category: "Athletic Performance",
    author: "Hydrogen Studies Research Team",
    isPublished: true,
    metaTitle: "Hydrogen Water for Athletes: Performance & Recovery Research",
    metaDescription: "What does science say about hydrogen water for athletic performance? Review of clinical studies on endurance, fatigue reduction, and recovery optimization.",
    tags: ["athletes", "exercise", "performance", "recovery", "sports"],
  },
  {
    title: "Understanding Hydrogen Delivery Methods: Water, Inhalation, Baths, and More",
    slug: "hydrogen-delivery-methods-comparison",
    summary: "Compare different ways to get molecular hydrogen into your body — from hydrogen water to inhalation therapy to hydrogen baths.",
    content: `<h2>Multiple Paths to Hydrogen Therapy</h2>
<p>One of the unique aspects of molecular hydrogen therapy is the variety of delivery methods available. Each has its own advantages, research base, and practical considerations.</p>

<h2>Hydrogen-Rich Water (HRW)</h2>
<p>The most widely studied and accessible method. Water is infused with dissolved hydrogen gas, typically reaching 0.5-1.6 ppm concentrations.</p>
<p><strong>Pros:</strong> Convenient, well-studied, portable options available</p>
<p><strong>Cons:</strong> Hydrogen dissipates over time; must be consumed relatively quickly</p>
<p><strong>Research:</strong> Used in the majority of clinical trials; effective for metabolic, cardiovascular, and inflammatory conditions</p>

<h2>Hydrogen Gas Inhalation</h2>
<p>Breathing hydrogen gas through a nasal cannula, typically at 2-4% concentration (well below the flammability threshold of 4.6%).</p>
<p><strong>Pros:</strong> Delivers higher doses; particularly effective for acute conditions; approved in Japan for post-cardiac arrest treatment</p>
<p><strong>Cons:</strong> Requires specialized equipment; less portable</p>
<p><strong>Research:</strong> Proven effective for stroke, cardiac arrest, and acute inflammatory conditions</p>

<h2>Hydrogen Baths</h2>
<p>Bathing in water infused with molecular hydrogen, allowing absorption through the skin.</p>
<p><strong>Pros:</strong> Relaxing; good for skin conditions; whole-body exposure</p>
<p><strong>Cons:</strong> Requires hydrogen bath generator; time-intensive</p>
<p><strong>Research:</strong> Shown effective for psoriasis and skin conditions; popular in Japan</p>

<h2>Hydrogen Tablets</h2>
<p>Magnesium-based tablets that react with water to produce hydrogen gas, typically generating 1-8 ppm depending on the product.</p>
<p><strong>Pros:</strong> Most portable option; long shelf life; can achieve higher concentrations</p>
<p><strong>Cons:</strong> Taste may vary; contains magnesium which may not be suitable for everyone</p>

<h2>Which Method Is Best?</h2>
<p>The best method depends on your specific health goals and practical considerations. For general wellness, hydrogen-rich water or tablets are the most accessible options. For acute medical conditions, hydrogen inhalation may be more appropriate under medical supervision. For skin conditions, hydrogen baths show particular promise.</p>`,
    category: "Education",
    author: "Hydrogen Studies Research Team",
    isPublished: true,
    metaTitle: "Hydrogen Therapy Delivery Methods: Water vs Inhalation vs Baths",
    metaDescription: "Compare hydrogen water, inhalation therapy, hydrogen baths, and tablets. Learn which delivery method is best for different health goals.",
    tags: ["delivery methods", "hydrogen water", "inhalation", "baths", "tablets"],
  },
  {
    title: "Hydrogen Therapy for Diabetes: Promising Research on Blood Sugar Control",
    slug: "hydrogen-therapy-diabetes-blood-sugar-research",
    summary: "Explore the growing body of evidence linking hydrogen water to improved blood sugar control, insulin sensitivity, and metabolic health.",
    content: `<h2>Diabetes and Oxidative Stress</h2>
<p>Type 2 diabetes affects over 400 million people worldwide. At its core, diabetes involves chronic oxidative stress and inflammation, which damage insulin-producing beta cells and reduce insulin sensitivity. This makes hydrogen therapy — with its powerful antioxidant and anti-inflammatory properties — a natural area of investigation.</p>

<h2>Clinical Evidence</h2>

<h3>The Kajiyama Study (2008)</h3>
<p>In one of the first clinical studies, 36 patients with type 2 diabetes or impaired glucose tolerance consumed hydrogen-rich water for 8 weeks in a randomized, double-blind, placebo-controlled crossover trial. Results showed significant reductions in modified LDL cholesterol and increased levels of the protective enzyme SOD. HbA1c (a key marker of long-term blood sugar control) showed a trend toward improvement.</p>

<h3>Animal Studies</h3>
<p>Research using diabetic mouse models has shown even more dramatic results. A study in the journal Obesity demonstrated that long-term hydrogen water consumption controlled fat and body weight, decreased plasma glucose and insulin levels, and stimulated energy metabolism — all through increased expression of the metabolic hormone FGF21.</p>

<h2>Mechanisms of Action</h2>
<ul>
<li><strong>Beta cell protection:</strong> H2 protects insulin-producing pancreatic cells from oxidative damage</li>
<li><strong>Improved insulin sensitivity:</strong> By reducing inflammation, H2 helps cells respond better to insulin</li>
<li><strong>FGF21 induction:</strong> Hydrogen stimulates this metabolic hormone that regulates glucose and lipid metabolism</li>
<li><strong>Lipid metabolism:</strong> H2 improves cholesterol profiles, reducing cardiovascular risk in diabetics</li>
</ul>

<h2>What This Means for Patients</h2>
<p>While hydrogen water should never replace diabetes medications, the research suggests it may be a valuable complementary approach. The combination of improved blood sugar markers, better cholesterol profiles, and reduced oxidative stress addresses multiple aspects of metabolic syndrome simultaneously.</p>`,
    category: "Diabetes",
    author: "Hydrogen Studies Research Team",
    isPublished: true,
    metaTitle: "Hydrogen Therapy for Diabetes: Blood Sugar & Metabolic Health Research",
    metaDescription: "Review clinical studies on hydrogen water for type 2 diabetes. Learn about effects on blood sugar, insulin sensitivity, and metabolic health markers.",
    tags: ["diabetes", "blood sugar", "metabolic health", "insulin", "type 2 diabetes"],
  },
];

const categoriesData = [
  { name: "cardiovascular", description: "Heart and blood vessel research", icon: "Heart" },
  { name: "neurological", description: "Brain and nervous system studies", icon: "Brain" },
  { name: "diabetes", description: "Diabetes and metabolic health research", icon: "Activity" },
  { name: "inflammation", description: "Inflammation and immune system studies", icon: "Shield" },
  { name: "exercise", description: "Athletic performance and recovery research", icon: "Zap" },
  { name: "respiratory", description: "Lung and breathing studies", icon: "Wind" },
  { name: "cancer", description: "Cancer supportive care research", icon: "Target" },
  { name: "digestive", description: "Gut and digestive health studies", icon: "Beaker" },
  { name: "kidney", description: "Kidney and renal system research", icon: "Droplets" },
  { name: "hepatic", description: "Liver health research", icon: "Database" },
  { name: "dermatology", description: "Skin health and dermatology research", icon: "Sparkles" },
  { name: "antioxidant", description: "Antioxidant and oxidative stress research", icon: "Shield" },
  { name: "review", description: "Review articles and meta-analyses", icon: "BookOpen" },
];

async function seed() {
  console.log("Starting database seed...");

  // Check if data already exists
  const existingStudies = await db.select({ count: sql<number>`count(*)` }).from(schema.studies);
  const studyCount = Number(existingStudies[0]?.count || 0);

  if (studyCount > 10) {
    console.log(`Database already has ${studyCount} studies. Skipping seed.`);
    await pool.end();
    return;
  }

  console.log(`Database has ${studyCount} studies. Seeding data...`);

  // Seed categories
  console.log("Seeding categories...");
  for (const cat of categoriesData) {
    try {
      await db.insert(schema.categories).values({
        name: cat.name,
        description: cat.description,
        icon: cat.icon,
        studyCount: 0,
      }).onConflictDoNothing();
    } catch (e) {
      // ignore duplicates
    }
  }
  console.log(`Inserted ${categoriesData.length} categories`);

  // Seed studies
  console.log("Seeding studies...");
  let insertedStudies = 0;
  for (const study of studiesData) {
    try {
      const studySlug = study.slug || slugify(study.plainLanguageTitle || study.title);
      await db.insert(schema.studies).values({
        ...study,
        slug: studySlug,
        viewCount: Math.floor(Math.random() * 500) + 50,
      } as any);
      insertedStudies++;
    } catch (e: any) {
      if (e.message?.includes("duplicate")) {
        console.log(`  Skipping duplicate: ${study.title.substring(0, 50)}...`);
      } else {
        console.error(`  Error inserting study: ${e.message}`);
      }
    }
  }
  console.log(`Inserted ${insertedStudies} studies`);

  // Update category study counts
  console.log("Updating category counts...");
  for (const cat of categoriesData) {
    const countResult = await db.select({ count: sql<number>`count(*)` })
      .from(schema.studies)
      .where(sql`${schema.studies.category} = ${cat.name}`);
    const count = Number(countResult[0]?.count || 0);
    if (count > 0) {
      await db.update(schema.categories)
        .set({ studyCount: count })
        .where(sql`${schema.categories.name} = ${cat.name}`);
    }
  }

  // Seed blog articles
  console.log("Seeding blog articles...");
  let insertedBlogs = 0;
  for (const article of blogArticlesData) {
    try {
      await db.insert(schema.blogArticles).values({
        ...article,
        publishedAt: new Date(),
        viewCount: Math.floor(Math.random() * 200) + 20,
      } as any);
      insertedBlogs++;
    } catch (e: any) {
      if (e.message?.includes("duplicate")) {
        console.log(`  Skipping duplicate blog: ${article.title.substring(0, 50)}...`);
      } else {
        console.error(`  Error inserting blog: ${e.message}`);
      }
    }
  }
  console.log(`Inserted ${insertedBlogs} blog articles`);

  console.log("\nSeed completed successfully!");
  console.log(`  Studies: ${insertedStudies}`);
  console.log(`  Blog Articles: ${insertedBlogs}`);
  console.log(`  Categories: ${categoriesData.length}`);

  await pool.end();
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  pool.end();
  process.exit(1);
});
