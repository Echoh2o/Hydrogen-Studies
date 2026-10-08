/**
 * /hydrogen-for/:slug topic records — the single source for the SPA page
 * (HydrogenForConditionPage.tsx) AND the bot renderer/meta
 * (seo-body-renderer.ts / seo-bot-middleware.ts), so crawlers and browsers get
 * the same H1, meta, visible FAQ (and therefore the same FAQPage JSON-LD).
 *
 * `bridgeTopic` is the page's primary topic as an Appendix E key; product
 * content renders only when isBridgeAllowed(bridgeTopic) (shared/bridge-policy).
 * Disease and gray-area topics carry `bridgeTopic: null` and no products.
 * "Skin health" is deliberately NOT mapped to "skin-appearance-cosmetic": the
 * page covers UV damage/dermatology, not only cosmetic appearance — counsel
 * must clear it before it gets a bridge.
 *
 * Meta: title ≤ 60 chars including " | Hydrogen Studies"; description 140–160
 * chars (enforced by server/__tests__/markup-compliance.test.ts).
 *
 * FAQs (rewritten 2026-09-29; sources per answer in
 * reports/content/hydrogen-for-faq-sources-2026-09-29.csv):
 *  - 4–6 per topic, 40–90 words each, plain text (they feed FAQPage JSON-LD,
 *    so no links, markdown or citation markers).
 *  - Say only what human evidence shows, with study type and size; label
 *    animal/cell findings as such; no treatment or cure claims; point people
 *    with a disease to their clinician. Grades must match the benefits guide
 *    (/blog/molecular-hydrogen-benefits-guide-pillar) and the condition hubs.
 *  - Questions are unique across these pages and never repeat a condition-hub
 *    FAQ question verbatim (markup-compliance.test.ts).
 * Product `reason` lines describe the product only — no efficacy claims.
 */

import type { ECHO_PRODUCTS } from "./echo-products";

export interface HydrogenForTopic {
  slug: string;
  name: string;
  bodySystem: string;
  searchTerms: string[];
  /** Appendix E topic key, or null (no product content on this page). */
  bridgeTopic: string | null;
  metaTitle: string;
  metaDescription: string;
  /** Rendered only when the bridge policy allows this page's topic. */
  products: Array<{ key: keyof typeof ECHO_PRODUCTS; name: string; reason: string }>;
  faqs: Array<{ question: string; answer: string }>;
}

export const HYDROGEN_FOR_TOPICS: Record<string, HydrogenForTopic> = {
  "heart-disease": {
    slug: "heart-disease",
    name: "Heart Disease",
    bodySystem: "Cardiovascular System",
    searchTerms: ["cardiovascular", "heart", "cardiac", "hypertension"],
    bridgeTopic: null,
    metaTitle: "Hydrogen and Heart Disease Research | Hydrogen Studies",
    metaDescription:
      "What peer-reviewed studies report on molecular hydrogen and heart disease: study designs, outcomes and limits of the evidence. Educational, not medical advice.",
    products: [],
    faqs: [
      {
        question: "Can hydrogen water help with heart disease?",
        answer:
          "It hasn't been shown to. No trial has tested whether hydrogen water prevents heart attacks, strokes or deaths from heart disease. Human studies are small and measure stand-in markers such as cholesterol, blood pressure or how well arteries widen, and we grade the evidence for protecting the heart as insufficient. Hydrogen water is not a substitute for heart medicines. If you have heart disease, talk to your cardiologist before adding it.",
      },
      {
        question: "Does hydrogen water lower cholesterol?",
        answer:
          "Slightly, in adults with overweight or obesity. A 2026 meta-analysis of 13 randomized trials with 757 participants found total cholesterol about 6.7 mg/dL lower and LDL cholesterol about 3.2 mg/dL lower with hydrogen-rich water than with plain or placebo water. HDL cholesterol fell a little and triglycerides didn't change. The authors said the changes are too small to matter for heart-disease risk and don't justify using hydrogen water to lower cholesterol.",
      },
      {
        question: "Does hydrogen water lower blood pressure?",
        answer:
          "Drinking trials haven't shown it. In a 6-month trial of 40 adults aged 70 and older, resting blood pressure didn't differ from control water. In 60 adults aged 50 to 70 with high blood pressure, inhaling a hydrogen-oxygen gas 4 hours a day for 2 weeks lowered systolic pressure by about 5 mmHg from starting levels, while the air group didn't change. That trial was small and short. Don't change blood pressure medicine without your doctor.",
      },
      {
        question: "Does hydrogen water improve blood vessel function?",
        answer:
          "One small study found a short-term change. In 34 volunteers, drinking 500 mL of water with 7 ppm hydrogen improved flow-mediated dilation, a measure of how well an artery widens, 30 minutes later compared with placebo water. It tested a single drink, not long-term use or heart outcomes, and one author worked for a hydrogen products company. Larger and longer trials would be needed to know whether it matters for heart health.",
      },
      {
        question: "Has hydrogen been tested in people after a heart attack?",
        answer:
          "Only in a small pilot. In a Japanese study of 20 people having a blocked artery opened after a major heart attack, those who breathed 1.3% hydrogen gas during the procedure had no serious hydrogen-related side effects. The main measure of heart muscle saved didn't differ from the control group, though one pumping measure improved more by 6 months. The study was open-label, wasn't designed to test benefit, and used hospital gas, not hydrogen water.",
      },
      {
        question: "Is hydrogen water safe to drink with heart medications?",
        answer:
          "Drug interactions haven't been formally studied, so nobody can say for certain. Trials of drinking hydrogen water have reported only mild side effects, such as loose stools or heartburn, but they were small and short. Magnesium-based hydrogen tablets add magnesium to the drink, which matters if you also have kidney disease. Keep taking your prescribed medicines, and tell your cardiologist and pharmacist about hydrogen water or any supplement you add.",
      },
    ],
  },
  diabetes: {
    slug: "diabetes",
    name: "Diabetes & Metabolic Health",
    bodySystem: "Endocrine System",
    searchTerms: ["diabetes", "metabolic", "insulin", "blood sugar", "glucose"],
    bridgeTopic: null,
    metaTitle: "Hydrogen and Diabetes Research | Hydrogen Studies",
    metaDescription:
      "Peer-reviewed research on molecular hydrogen in diabetes and metabolic health: what studies measured, who took part, and how strong the evidence is so far.",
    products: [],
    faqs: [
      {
        question: "Can hydrogen water help manage diabetes?",
        answer:
          "It hasn't been shown to. The few randomized trials are small and point in different directions: one found lower blood sugar and HbA1c in adults with metabolic syndrome, while another found no change in insulin resistance in people with type 2 diabetes. No trial measured diabetes complications, and we grade the blood sugar evidence as very low. Hydrogen water is not a replacement for diabetes medicine, so talk to your doctor and don't change your treatment.",
      },
      {
        question: "Does hydrogen water lower blood sugar?",
        answer:
          "The results are mixed. In 50 people with type 2 diabetes, electrolyzed hydrogen water didn't change insulin resistance, the main outcome, compared with filtered water. In 73 adults with high fasting blood sugar, fasting glucose fell in both the hydrogen and plain-water groups over 8 weeks, a little more with hydrogen. A smaller crossover trial reported that 4 of 6 people with prediabetes had normal glucose tolerance tests after 8 weeks of hydrogen water.",
      },
      {
        question: "What did the 24-week hydrogen water trial in metabolic syndrome find?",
        answer:
          "In a double-blind trial, 60 adults with metabolic syndrome drank water made with hydrogen-producing tablets or placebo water for 24 weeks. The hydrogen group ended with lower cholesterol, blood sugar and HbA1c, and better inflammation markers, than the placebo group. It is a single trial of 60 people. The lead author is affiliated with the Molecular Hydrogen Institute, a nonprofit that promotes hydrogen research, and the tablets came from a hydrogen-tablet company.",
      },
      {
        question: "Is hydrogen water safe if you take insulin or other diabetes medicines?",
        answer:
          "Interactions haven't been formally studied. In one small trial of people with muscle diseases, a participant who used insulin had episodes of low blood sugar that stopped after the insulin dose was lowered. One case can't show that hydrogen caused it, but if you use insulin or other glucose-lowering drugs, check your levels and tell your doctor before adding hydrogen water. The type 2 diabetes trial reported no treatment-related side effects.",
      },
      {
        question: "How much hydrogen water was used in diabetes studies?",
        answer:
          "Amounts varied, and no dose has been shown to work. One crossover trial gave 900 mL a day for 8 weeks, a prediabetes trial used 1 liter a day for 8 weeks, and a 24-week metabolic syndrome trial used tablets that made more than 5.5 millimoles, about 11 mg, of hydrogen a day. No trial compared doses. Magnesium-based tablets also add magnesium, which matters if you have diabetic kidney disease.",
      },
    ],
  },
  "brain-health": {
    slug: "brain-health",
    name: "Brain & Mental Health",
    bodySystem: "Nervous System",
    searchTerms: ["brain", "cognitive", "neuro", "alzheimer", "parkinson", "neuroprotective"],
    bridgeTopic: null,
    metaTitle: "Hydrogen and Brain Health Research | Hydrogen Studies",
    metaDescription:
      "Research on molecular hydrogen and brain health, from cognitive outcomes to neurodegeneration: study types, results and the limits of what they show so far.",
    products: [],
    faqs: [
      {
        question: "Can hydrogen therapy help with brain health?",
        answer:
          "It hasn't been shown to in people. Inhaled hydrogen reduced brain injury in rats after an induced stroke, but the largest human trials found no overall benefit: a 1-year trial in 73 people with mild cognitive impairment and a 72-week trial in 178 people with Parkinson's disease. Hospital studies of inhaled hydrogen after stroke or cardiac arrest are small and early. We grade the evidence for protecting the brain as insufficient.",
      },
      {
        question: "Is hydrogen water good for memory or cognitive function?",
        answer:
          "Trials so far found no overall effect. In a 1-year double-blind trial, 73 people with mild cognitive impairment drank about 300 mL of hydrogen water or placebo water a day, and memory and thinking scores didn't differ. Carriers of the APOE4 gene variant did better, a lead for future research rather than a result. In a 6-month trial of 40 adults aged 70 and older, cognitive function didn't differ from control water.",
      },
      {
        question: "Does hydrogen water help Parkinson's disease?",
        answer:
          "The best evidence says no. A pilot trial in 17 people found better symptom scores after 48 weeks, but when the same team ran a larger trial with 178 people at 14 hospitals, drinking 1 liter a day for 72 weeks, symptom scores didn't differ from placebo water. A 16-week pilot of inhaled hydrogen in 20 people also found no benefit. Keep taking your Parkinson's medicines and talk to your neurologist.",
      },
      {
        question: "Can hydrogen reach the brain?",
        answer:
          "In rats, yes. After rats drank hydrogen-rich water, hydrogen levels in the brain, blood and other organs rose within about 5 minutes and then fell; inhaled gas raised levels more slowly but kept them up longer. Brain levels haven't been measured in people. Reaching the brain also isn't the same as protecting it: human trials in memory decline and Parkinson's disease found no overall benefit.",
      },
      {
        question: "Has inhaled hydrogen been tested after a stroke or cardiac arrest?",
        answer:
          "Yes, in small hospital trials. In 50 people with a recent mild-to-moderate stroke, those who inhaled 3% hydrogen for 7 days had better stroke scores than those given standard intravenous medicine, with no placebo group. In 73 people in a coma after cardiac arrest, 2% hydrogen for 18 hours didn't significantly increase good brain recovery at 90 days (56% vs 39%), though survival was higher. That trial stopped early.",
      },
      {
        question: "Does hydrogen water help with anxiety or depression?",
        answer:
          "The evidence is very thin. In a 4-week crossover trial, 26 adults who drank 600 mL a day of hydrogen water had lower scores on a mood-and-anxiety questionnaire than with placebo water. In a 7-day single-blind trial, 66 people with sleep problems who inhaled a hydrogen-oxygen gas had better depression scores, but anxiety didn't differ. Neither tested people diagnosed with depression or anxiety disorders. Talk to a clinician, and don't stop prescribed treatment.",
      },
    ],
  },
  inflammation: {
    slug: "inflammation",
    name: "Arthritis & Inflammation",
    bodySystem: "Immune System",
    searchTerms: ["inflammation", "arthritis", "anti-inflammatory", "rheumatoid", "joint"],
    bridgeTopic: null,
    metaTitle: "Hydrogen and Inflammation Research | Hydrogen Studies",
    metaDescription:
      "Studies on molecular hydrogen, inflammation markers and arthritis: what was measured, in whom, and how consistent the findings are. Educational, not advice.",
    products: [],
    faqs: [
      {
        question: "Does hydrogen water reduce inflammation?",
        answer:
          "Not consistently in people. In a double-blind trial of 38 healthy adults who drank 1.5 liters a day for 4 weeks, blood markers of oxidative stress didn't differ from plain water, though inflammation-related gene activity in blood cells was lower. Other trials measured different markers with mixed results, and in one, a marker of oxidative damage rose. Most trials measured blood markers, not symptoms, and we grade the anti-inflammatory evidence as low.",
      },
      {
        question: "Can hydrogen therapy help with arthritis?",
        answer:
          "For rheumatoid arthritis there are only two small studies, both from one Japanese hospital. In 20 patients who drank 530 mL a day of high-concentration hydrogen water, disease activity scores fell, but there was no comparison group. In 24 patients given intravenous hydrogen saline or placebo saline for 5 days, scores fell in the hydrogen group but not the placebo group. These are pilot results, not proof of a treatment. Don't stop arthritis medicines.",
      },
      {
        question: "Does hydrogen help osteoarthritis or joint pain?",
        answer:
          "It hasn't been tested well in people. We found no human trial of drinking, bathing in or inhaling hydrogen for osteoarthritis or everyday joint pain. The research is mainly in animals, such as a rat study in which hydrogen-rich water injected into the knee joint reduced cartilage damage, and a 2026 review said clinical research is still at an early stage. If joint pain persists, see a doctor to find the cause.",
      },
      {
        question: "Do hydrogen baths reduce inflammation?",
        answer:
          "The evidence is thin and conflicting. In a small Japanese study, C-reactive protein, a blood marker of inflammation, was lower two hours after a 10-minute hydrogen bath than after a plain bath, and a few people with autoimmune diseases had lower levels over months of bathing, with no comparison group. In a crossover trial of nine healthy men, daily hydrogen baths for a week after downhill running had no effect on inflammation.",
      },
      {
        question: "Can hydrogen water replace anti-inflammatory medicine?",
        answer:
          "No. Hydrogen hasn't been shown to work as a treatment for any inflammatory condition, and the human studies are small and short. Drug interactions haven't been formally studied either. If you take medicine for rheumatoid arthritis or another inflammatory condition, keep taking it as prescribed, and talk to your doctor or pharmacist before adding hydrogen water or hydrogen tablets.",
      },
    ],
  },
  "cancer-support": {
    slug: "cancer-support",
    name: "Cancer Supportive Care",
    bodySystem: "Immune System",
    searchTerms: ["cancer", "tumor", "chemotherapy", "radiation", "oncology"],
    bridgeTopic: null,
    metaTitle: "Hydrogen and Cancer Supportive Care | Hydrogen Studies",
    metaDescription:
      "Research on molecular hydrogen alongside cancer treatment, such as side effects of chemotherapy and radiation. Not a cancer treatment; talk to your oncologist.",
    products: [],
    faqs: [
      {
        question: "Can hydrogen water help cancer patients?",
        answer:
          "It hasn't been shown to treat cancer or improve survival. A few small trials measured side effects of cancer treatment, with mixed results. In 49 people having radiotherapy for liver tumors, 6 weeks of hydrogen-rich water improved overall quality-of-life scores and appetite, but fatigue didn't differ from placebo water, and tumor response was similar. Hydrogen is not a cancer treatment. Talk to your oncologist before adding it.",
      },
      {
        question: "Is hydrogen therapy safe during cancer treatment?",
        answer:
          "That hasn't been established. The small trials in people having chemotherapy or radiotherapy reported few side effects, but they were too small to detect uncommon harms, and interactions with specific cancer drugs haven't been studied in people. In one mouse study, hydrogen didn't weaken the chemotherapy drug cisplatin's effect on tumors, which is not proof for people. Tell your oncologist about hydrogen water or anything else you add.",
      },
      {
        question: "Can hydrogen water kill cancer cells?",
        answer:
          "Only in lab and animal studies. For example, hydrogen gas slowed the growth of lung cancer cells in dishes and in tumors grown in mice. No controlled human trial has shown that drinking or inhaling hydrogen shrinks tumors or helps people live longer. An uncontrolled report of 82 people with advanced cancer who inhaled hydrogen described tumor control in some, but without a comparison group it can't show that hydrogen caused it.",
      },
      {
        question: "Does hydrogen water reduce side effects of chemotherapy?",
        answer:
          "One trial suggests a possible effect on the liver. In a single-blind trial at one Chinese hospital, 136 people with colorectal cancer receiving mFOLFOX6 chemotherapy were analyzed; liver enzymes rose in the placebo-water group but not in the hydrogen-water group. It measured blood tests, not symptoms or survival, and needs confirming in other trials. Don't use hydrogen water in place of the supportive care your oncology team recommends.",
      },
      {
        question: "Is hydrogen water the same as hydrogen peroxide?",
        answer:
          "No. Hydrogen water is water with a small amount of dissolved hydrogen gas (H2). Hydrogen peroxide (H2O2) is a different chemical, used as a disinfectant and bleach. So-called food-grade hydrogen peroxide can be dangerous to drink: in one hospital report, four people who drank 35% hydrogen peroxide developed gas bubbles in their blood vessels, and two needed a breathing tube. Hydrogen peroxide is not a proven cancer treatment.",
      },
    ],
  },
  "athletic-performance": {
    slug: "athletic-performance",
    name: "Athletic Performance & Recovery",
    bodySystem: "Musculoskeletal System",
    searchTerms: ["exercise", "athlete", "performance", "recovery", "fatigue", "muscle"],
    bridgeTopic: "athletic-performance",
    metaTitle: "Hydrogen for Athletic Performance | Hydrogen Studies",
    metaDescription:
      "Studies on molecular hydrogen for exercise performance and recovery in healthy adults: fatigue, lactate and muscle-damage markers, and what the results mean.",
    // Product descriptions only — no efficacy claims (the sponsor card sits
    // next to research content).
    products: [
      { key: "flask", name: "Echo Flask Hydrogen Water Bottle", reason: "Portable bottle that makes hydrogen water (up to 8 ppm molecular hydrogen)." },
      { key: "revive", name: "Echo Revive Hydrogen Bath Water Machine", reason: "Machine that dissolves hydrogen gas into bath water." },
    ],
    faqs: [
      {
        question: "Does hydrogen water improve athletic performance?",
        answer:
          "Not for most measures. Two meta-analyses of small randomized trials in healthy adults (402 and 597 participants) found hydrogen made exercise feel slightly easier and lowered blood lactate a little, but it didn't improve VO2max, endurance or strength. The one gain was small, in jumping power. Most trials were small and short.",
      },
      {
        question: "How does hydrogen water help with recovery?",
        answer:
          "The evidence is limited. A few small crossover trials found slightly less muscle soreness or lower creatine kinase, a muscle-damage marker, after hard exercise, while other trials found no difference. The individual studies are on our exercise recovery research hub.",
      },
      {
        question: "How much hydrogen water did exercise studies use?",
        answer:
          "Doses varied widely. In the pooled trials, drinking water held 0.5 to 5.9 ppm hydrogen, often taken as a single drink shortly before exercise or daily for up to two weeks, and inhaled gas ranged from 1% to 68% hydrogen. In one trial, trained runners drank 1,260 mL in four servings over the two hours before a run, and their time to exhaustion didn't improve. No trial compared doses, so there's no evidence-based amount.",
      },
      {
        question: "Is hydrogen water better than plain water for hydration?",
        answer:
          "There's no evidence that it is. Hydrogen water is ordinary water with a few milligrams of dissolved hydrogen per liter at most, and it adds no electrolytes or carbohydrate. In most exercise trials the comparison was the same water without hydrogen, and the differences were limited to slightly lower effort ratings and blood lactate, not better endurance or strength.",
      },
      {
        question: "Is hydrogen water safe for athletes?",
        answer:
          "No serious problems have been reported in exercise trials, but many didn't describe how they checked for side effects, and most lasted from a single session to two weeks. In other trials of drinking hydrogen water, reported side effects were mild, such as loose stools or heartburn. Magnesium-based tablets add magnesium; for adults, the upper limit for magnesium from supplements is 350 mg a day.",
      },
    ],
  },
  "skin-health": {
    slug: "skin-health",
    name: "Skin Health & Anti-Aging",
    bodySystem: "Integumentary System",
    searchTerms: ["skin", "dermatology", "UV", "wrinkle", "aging", "collagen"],
    bridgeTopic: null,
    metaTitle: "Hydrogen and Skin Health Research | Hydrogen Studies",
    metaDescription:
      "Research on molecular hydrogen and skin: UV exposure, oxidative stress and visible signs of aging. Study designs, results and the limits of the evidence today.",
    products: [],
    faqs: [
      {
        question: "Can hydrogen water improve skin health?",
        answer:
          "It hasn't been shown in people. Cell and mouse studies suggest molecular hydrogen may reduce UV-related oxidative stress, but human studies are tiny and mostly uncontrolled, and the one randomized trial that measured facial skin (40 adults aged 70 and over, six months of hydrogen water) found no difference.",
      },
      {
        question: "How does hydrogen therapy help with anti-aging?",
        answer:
          "That's not established. The idea that hydrogen is a selective antioxidant comes mainly from cell and animal research, and later chemistry work questioned it. We found no placebo-controlled trial showing that drinking, bathing in or applying hydrogen reduces wrinkles or improves skin tone in people.",
      },
      {
        question: "Does hydrogen protect skin from sun damage?",
        answer:
          "It hasn't been tested in people. Mice exposed to UVA light for six weeks while breathing 1.3% hydrogen gas 16 hours a day showed fewer signs of photoaging, such as skin thickening, extra pigment and collagen breakdown, and hydrogen-rich water protected lab-grown skin cells from UVA damage. We found no human trial of hydrogen against sunburn or sun-related skin aging, so it isn't a substitute for sunscreen, shade or protective clothing.",
      },
      {
        question: "Does hydrogen water increase collagen?",
        answer:
          "Only in lab dishes so far. Hydrogen-rich warm water roughly doubled type I collagen production in lab-grown human fibroblasts, the cells that make collagen. We found no human study that measured collagen in the skin after drinking, bathing in or applying hydrogen, and a six-month trial in 40 adults aged 70 and older found no difference in facial skin features with hydrogen water.",
      },
      {
        question: "Has hydrogen been tested for psoriasis or other skin conditions?",
        answer:
          "Only in early studies. In a Chinese study with a comparison group, 10 of 41 people with psoriasis who took hydrogen-water baths for 8 weeks had their severity score improve by at least 75%, compared with 1 of 34 in the comparison group. A 21-person pilot trial in people awaiting keloid scar surgery reported less pain and itching with hydrogen water. Neither establishes a treatment; if you have a skin condition, see a dermatologist.",
      },
    ],
  },
  "gut-health": {
    slug: "gut-health",
    name: "Digestive Health",
    bodySystem: "Digestive System",
    searchTerms: ["digestive", "gut", "liver", "gastric", "intestinal", "microbiome"],
    bridgeTopic: null,
    metaTitle: "Hydrogen and Digestive Health Research | Hydrogen Studies",
    metaDescription:
      "Peer-reviewed studies on molecular hydrogen and digestive health, including the gut lining, liver and microbiome: what was tested and how strong the data are.",
    products: [],
    faqs: [
      {
        question: "Can hydrogen water improve gut health?",
        answer:
          "It hasn't been shown in people. Much of the gut research on hydrogen is in animals, such as a rat model of constipation. In one human trial, 73 adults with high fasting blood sugar drank 1 liter a day of hydrogen water or plain water for 8 weeks, and the mix of gut bacteria shifted in the hydrogen group; whether that affects digestive health is unknown. If you have ongoing digestive symptoms, see a doctor.",
      },
      {
        question: "Is hydrogen water good for your liver?",
        answer:
          "The evidence is limited. A 2024 meta-analysis of 8 small randomized trials with 433 people who had various liver problems found slight drops in the liver enzymes ALT, AST and ALP with hydrogen-rich water. But in an 8-week placebo-controlled trial of 30 people with fatty liver disease, liver enzymes didn't change significantly. No trial has shown that hydrogen water prevents or reverses liver disease. If you have liver disease, talk to your doctor.",
      },
      {
        question: "How can you get more hydrogen in your gut?",
        answer:
          "Gut bacteria already make hydrogen when they ferment food your body doesn't absorb, such as milk sugar in people with lactose intolerance. In one small study, drinking hydrogen water raised breath hydrogen only briefly, while milk in people with milk intolerance raised it for up to 9 hours. No human trial has shown that raising gut hydrogen improves health, and more fermentation can also mean more gas and bloating.",
      },
      {
        question: "Can hydrogen water cause bloating or stomach upset?",
        answer:
          "Occasionally, and mildly. In an 8-week study with no comparison group, 20 adults drank 1.5 to 2 liters a day; investigators judged loose stools in 3 people, more frequent bowel movements in 1 and heartburn in 1 as possibly related. Bloating wasn't among them, and nothing serious was reported. Without a comparison group, it's unclear how much came from hydrogen rather than the extra water. Magnesium-based tablets add magnesium, which can loosen stools.",
      },
      {
        question: "Does hydrogen water affect a hydrogen breath test?",
        answer:
          "It can, briefly. Breath tests for lactose intolerance or bacterial overgrowth in the small intestine measure hydrogen in your breath. In a small study, drinking hydrogen water raised breath hydrogen to a peak about 10 to 15 minutes later, and levels then fell quickly back to baseline. If you have a breath test scheduled, tell the clinic you drink hydrogen water and follow its preparation instructions.",
      },
    ],
  },
  "kidney-health": {
    slug: "kidney-health",
    name: "Kidney Health",
    bodySystem: "Urinary System",
    searchTerms: ["kidney", "renal", "nephro"],
    bridgeTopic: null,
    metaTitle: "Hydrogen and Kidney Health Research | Hydrogen Studies",
    metaDescription:
      "Research on molecular hydrogen and kidney health, from renal function markers to injury models: study types, findings and how far the evidence goes so far.",
    products: [],
    faqs: [
      {
        question: "Can hydrogen water help protect kidneys?",
        answer:
          "There's no good evidence that drinking it does in people. In rats and mice, hydrogen reduced kidney damage caused on purpose in the lab, but those sudden injuries differ from chronic kidney disease. Human studies mostly added hydrogen to dialysis fluid, and we found no controlled trial in which people with kidney disease drank hydrogen water and had their kidney function measured. If you have kidney disease, talk to your nephrologist first.",
      },
      {
        question: "What studies exist on hydrogen and kidney health?",
        answer:
          "Most are animal studies of sudden kidney injury, for example from drugs, contrast dye or transplants. In people, the main studies added small amounts of hydrogen to hemodialysis fluid, in small or non-randomized studies, most from one Japanese research group. There is one randomized trial of drinking hydrogen-rich water for kidney stones, with 100 people, and a single case report in chronic kidney disease.",
      },
      {
        question: "Is hydrogen water better for your kidneys than plain water?",
        answer:
          "No study has shown that. In the one randomized trial of drinking hydrogen-rich water for kidney stones, 32% of people who added it to standard care for 12 weeks responded, compared with 28% on standard care alone. Drinking enough fluid, mainly water, is the main self-care step for preventing stones, and plain water does that. For chronic kidney disease, no trial has compared the two.",
      },
      {
        question: "Can hydrogen protect the kidneys during chemotherapy or contrast scans?",
        answer:
          "Only animal studies have tested this. In mice given the chemotherapy drug cisplatin, inhaled hydrogen or hydrogen water reduced kidney damage without weakening the drug's effect on tumors, and in rats, inhaled hydrogen reduced kidney injury from contrast dye. Neither has been shown in people. If you're having chemotherapy or a contrast scan, follow your care team's advice on protecting your kidneys.",
      },
      {
        question: "How much hydrogen was used in the kidney studies?",
        answer:
          "It varied by route. The dialysis studies dissolved about 30 to 80 parts per billion of hydrogen into the dialysis fluid, far less than the roughly 1.6 parts per million in saturated hydrogen water, and delivered it through a dialysis machine rather than as a drink. Mice in a chemotherapy study drank water with about 1.6 ppm. The kidney-stone trial's summary doesn't report the hydrogen concentration.",
      },
    ],
  },
  "lung-health": {
    slug: "lung-health",
    name: "Lung & Respiratory Health",
    bodySystem: "Respiratory System",
    searchTerms: ["lung", "respiratory", "pulmonary", "asthma", "COPD"],
    bridgeTopic: null,
    metaTitle: "Hydrogen and Lung Health Research | Hydrogen Studies",
    metaDescription:
      "Studies on hydrogen inhalation and hydrogen-rich water for lung and respiratory health: what researchers measured, key results, and open questions remaining.",
    products: [],
    faqs: [
      {
        question: "Can hydrogen therapy help with lung conditions?",
        answer:
          "It isn't an established treatment for any lung disease. Most human studies used inhaled hydrogen in hospitals, were small or short, and measured symptoms or blood markers rather than long-term outcomes. One multicenter trial in people hospitalized with a COPD flare-up found better symptom scores but no difference in lung function. If you have asthma, COPD or another lung condition, keep your prescribed treatment and talk to your pulmonologist.",
      },
      {
        question: "Is hydrogen inhalation safe for the lungs?",
        answer:
          "Short, supervised use has usually been well tolerated in small studies, but long-term safety is unknown. Breathing hydrogen slightly dilutes oxygen: in 20 healthy young women, an hour of inhalation lowered average oxygen saturation from 96.7% to 95.9%. In a COPD trial, device-related side effects included dizziness and a nasal-lining injury. Hydrogen is also flammable in air from about 4% to 75%, so home machines carry a fire risk.",
      },
      {
        question: "What did the COPD trial of hydrogen-oxygen gas find?",
        answer:
          "In a double-blind trial at 10 Chinese hospitals, 108 people with a COPD flare-up breathed a hydrogen-oxygen mixture or oxygen alone for 7 days. Breathlessness, cough and sputum scores improved more with hydrogen-oxygen, but lung function and blood oxygen didn't differ between groups. Side effects were reported in 63% of the hydrogen group and 78% of the oxygen group. It lasted one week, in hospital, so it says nothing about home use.",
      },
      {
        question: "Did hydrogen help people with COVID-19?",
        answer:
          "Drinking it didn't. In a triple-blind trial of 675 outpatients with mild-to-moderate COVID-19, hydrogen-rich water twice a day for 21 days didn't reduce worsening by day 14 (46.1% vs 43.5% with placebo). Inhaled hydrogen studies were smaller: in a single-blind trial, 50 people recovering from COVID-19 walked farther and had better lung-function tests after 14 days of inhalation than with placebo gas.",
      },
      {
        question: "Is hydrogen inhalation the same as hydrogen peroxide therapy?",
        answer:
          "No. Hydrogen inhalation means breathing hydrogen gas (H2), usually mixed with air or oxygen. Hydrogen peroxide (H2O2) is a different chemical, used as a disinfectant and bleach. Inhaling or drinking hydrogen peroxide is not a proven treatment for COPD or any lung disease, and drinking concentrated food-grade peroxide has caused dangerous gas bubbles in blood vessels. Ask your pulmonologist before trying either.",
      },
      {
        question: "Can drinking hydrogen water help your lungs?",
        answer:
          "There's little evidence. Most lung research used inhaled gas, not drinking water. In 32 adults with long COVID, 14 days of hydrogen-rich water didn't improve breathlessness compared with plain water, though walking-test distance improved more. The largest COVID-19 trial of drinking hydrogen water, with 675 outpatients, found no benefit. Asthma research includes mouse studies and a single 45-minute inhalation session in 20 patients that reported only blood and breath markers.",
      },
    ],
  },
};

export function getHydrogenForTopic(slug: string | null | undefined): HydrogenForTopic | null {
  if (!slug) return null;
  return HYDROGEN_FOR_TOPICS[slug.toLowerCase()] ?? null;
}
