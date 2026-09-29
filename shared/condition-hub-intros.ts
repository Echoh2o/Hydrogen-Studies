/**
 * /explore-by-condition/:slug evidence-graded intros (keyword plan waves 3–4) —
 * the single source for the SPA page (ConditionCategoryPage.tsx) AND the bot
 * renderer/meta (seo-body-renderer.ts / seo-bot-middleware.ts), so crawlers
 * and browsers get the same title, meta description, H1, byline, intro, FAQ
 * (and therefore the same FAQPage JSON-LD), sources and owner-guide link.
 *
 * Only the hubs listed here get the intro; every other condition hub keeps
 * its generic rendering. For these hubs the health_conditions.description
 * and the generic "may benefit and treat…" copy are NOT shown — they
 * contradicted the graded copy.
 *
 * Content was reviewed before it landed here: do not rewrite the prose in
 * code review — change it through the content review.
 *
 *  - Byline: no named reviewer, so the date shows as "Updated", never "Last
 *    reviewed" (shared/seo-markup blogByline; CLAUDE.md).
 *  - `bridgeTopic` is null on every hub: no product/sponsor content
 *    (kidney-health and chronic-fatigue are disease topics — PLAN.md
 *    Appendix E; the other two carry no bridge either).
 *  - Meta: title ≤ 60 chars including " | Hydrogen Studies"; description
 *    140–160 chars (server/__tests__/condition-hub-intros.test.ts).
 *  - introMarkdown uses "## " headings only (the page owns the one H1; both
 *    renderers demote a stray "# " anyway) and cites `sources` by number:
 *    "[[3]](/study/…)" links and bare "[3]" refs.
 *
 * Keep dependency-light: this module ships in the browser bundle.
 */

import {
  blogByline,
  EDITORIAL_TEAM,
  faqPageJsonLd,
  normalizeDoi,
  SITE_NAME,
  type BlogByline,
  type QaPair,
} from "./seo-markup";

export type EvidenceGrade = "very low" | "low" | "moderate" | "high";

export interface ConditionHubSource {
  /** Reference number used by the intro's "[n]" citations. */
  n: number;
  citation: string;
  pmid: string | null;
  doi: string | null;
  /** Our study page for this source ("/study/<permanent slug>"), if we have one. */
  ourStudyPath: string | null;
}

export interface ConditionHubIntro {
  slug: string;
  h1: string;
  /** Full <title>, suffix included. */
  metaTitle: string;
  metaDescription: string;
  evidenceGrade: EvidenceGrade;
  introMarkdown: string;
  faqs: QaPair[];
  sources: ConditionHubSource[];
  /** The owner guide the hub points readers to for the full answer. */
  ownerLink: { href: string; label: string };
  /** Appendix E topic key, or null (no product content on this page). */
  bridgeTopic: string | null;
  /** YYYY-MM-DD; shown as "Updated <date>" (no named reviewer). */
  lastReviewed: string;
}

/** Section headings shared by both renderers (same visible text). */
export const CONDITION_HUB_FAQ_HEADING = "Frequently asked questions";
export const CONDITION_HUB_SOURCES_HEADING = "Sources";
export const CONDITION_HUB_STUDIES_HEADING = "Research Studies";
export const CONDITION_HUB_OWNER_GUIDE_LEAD = "Read the full guide:";

export const CONDITION_HUB_INTROS: Record<string, ConditionHubIntro> = {

  "kidney-health": {
    slug: "kidney-health",
    h1: "Hydrogen and Kidney Health: A Guide to the Studies",
    metaTitle: "Hydrogen Water and Kidneys: The Studies | Hydrogen Studies",
    metaDescription:
      "Molecular hydrogen and kidney research, graded: hydrogen dialysis studies, one kidney stone trial, CKD case reports and animal data, with doses and gaps.",
    evidenceGrade: "very low",
    introMarkdown: `*Hydrogen Studies is funded by Echo Technologies LLC, which sells hydrogen water products. Echo doesn't decide which studies we cover or how we describe them — see our [editorial policy](/editorial-policy).*

**Evidence at a glance: very low** for drinking hydrogen water and kidney health. The best human data come from hydrogen added to dialysis fluid, in small or non-randomized studies, mostly from one Japanese group.

This page maps the research on molecular hydrogen and the kidneys. For the plain-language answer and safety advice, read our full guide: **[Is hydrogen water good for your kidneys?](/blog/is-hydrogen-water-good-for-kidneys)**

## What kind of research is this?

Of the roughly 95 studies in our database with the kidneys in the title, about two-thirds were in rats, mice or other animals. Only 16 involved people, and 15 of those were about dialysis.

## What the human studies tested

- **Hydrogen in dialysis fluid.** Researchers dissolved about 30–80 parts per billion of hydrogen into hemodialysis fluid. In a [6-month study of 21 patients](/study/a-novel-bioactive-haemodialysis-system-using-dissolved-dihydrogen-h2-produced-by-water-electrolysis-a-clinical-trial-1775650467159) with no comparison group, blood pressure and two inflammation markers fell. In a [non-randomized study of 309 patients](/study/novel-haemodialysis-hd-treatment-employing-molecular-hydrogen-h-2-enriched-dialysis-solution-improves-prognosis-of-chronic-dialysis-patients-a-prospective-observational-study-1775650467142) followed for about 3.3 years, the hydrogen group had a 41% lower adjusted risk of death or major heart, stroke or amputation events. A [12-month study of 81 patients](/study/hemodialysis-employing-molecular-hydrogen-h2-enriched-dialysis-solution-may-improve-dialysis-related-fatigue-through-impact-on-energy-metabolism-1775650467176) reported less fatigue in the most fatigued patients, again with no control group. This is a medical treatment delivered through a dialysis machine, not a drink.
- **Drinking hydrogen for chronic kidney disease (CKD).** We found no controlled trial. The human evidence is a [single case report](/study/molecular-hydrogen-as-a-potential-adjunctive-therapy-to-improve-renal-function-and-reduce-fatigue-in-an-elderly-patient-with-chronic-comorbidities-a-case-report-1775650467176) of an 89-year-old woman whose creatinine fell after she started hydrogen capsules. A [2025 scoping review of 69 publications](/study/molecular-hydrogen-and-kidney-diseases-a-scoping-review-based-on-scientometry-and-data-analytics-1777577956394) called for more robust clinical trials.
- **Kidney stones.** In a [2026 randomized trial](https://pubmed.ncbi.nlm.nih.gov/42734448/) of 100 people, 32% of those who added hydrogen-rich water to standard care for 12 weeks responded, versus 28% on standard care alone (and 76% with a Chinese herbal formula).
- **Contrast dye injury and kidney transplants.** We found no human trials.

## What animal studies suggest (not human evidence)

In rats, [inhaled hydrogen gas reduced kidney injury from contrast dye](/study/inhalation-of-hydrogen-gas-is-beneficial-for-preventing-contrast-induced-acute-kidney-injury-in-rats-1775650467148), and [hydrogen water given for 150 days after a kidney transplant](/study/oral-hydrogen-water-prevents-chronic-allograft-nephropathy-in-rats-1775650467158) slowed chronic graft damage. In mice given the chemotherapy drug cisplatin, [drinking water with about 1.6 ppm hydrogen](/study/molecular-hydrogen-alleviates-nephrotoxicity-induced-by-anti-cancer-drug-cisplatin-without-compromising-anti-tumor-activity-in-mice-1775650467160) reduced kidney damage. Not every result is positive: in pig kidneys reconnected to blood outside the body, [2% hydrogen gas did not improve function](/study/hydrogen-gas-does-not-ameliorate-renal-ischemia-reperfusion-injury-in-a-preclinical-model-1775650467141). Lab injuries are sudden; CKD develops over years.

## What we don't know

- Whether drinking hydrogen water changes eGFR, creatinine or urine protein in people with kidney disease
- Whether the dialysis results hold up in randomized trials by independent groups
- What dose, concentration or duration would matter
- Long-term safety of hydrogen water in people with reduced kidney function

## If you have kidney disease

Talk to your nephrologist before trying hydrogen water, and don't change any treatment. It counts toward any fluid limit. Magnesium-based hydrogen tablets leave [magnesium in the drink](/blog/h2-tabs-side-effects#how-much-magnesium-is-in-a-hydrogen-tablet-drink), which matters when the kidneys can't clear it well.

*Drafted with AI assistance and checked against each linked source by our editorial team. General information, not medical advice.*`,
    faqs: [
      {
        question: "Are there clinical trials of hydrogen water for kidney disease?",
        answer:
          "Very few. We found no controlled trial in which people with chronic kidney disease drank hydrogen water and had their kidney function measured. The only randomized trial we found of drinking hydrogen-rich water for a kidney condition enrolled 100 people with kidney stones: after 12 weeks, 32% of those who added hydrogen water to standard care responded, compared with 28% on standard care alone. Most other human studies added hydrogen to dialysis fluid rather than drinking water.",
      },
      {
        question: "Why do most human studies of hydrogen and the kidneys involve dialysis?",
        answer:
          "Researchers in Japan developed a way to dissolve small amounts of hydrogen, about 30 to 80 parts per billion, into the fluid used for hemodialysis, and tested it in people already on dialysis. In the largest study, 309 patients were followed for about 3.3 years, and those on hydrogen-enriched dialysis had a lower adjusted risk of death or major heart, stroke or amputation events. Patients were not randomized, and the results apply to a medical dialysis system, not to drinking hydrogen water.",
      },
      {
        question: "Do animal studies show that hydrogen protects the kidneys?",
        answer:
          "In many rat and mouse studies, hydrogen given as drinking water, injected saline or inhaled gas reduced kidney damage caused on purpose in the lab, for example by a chemotherapy drug, contrast dye or a kidney transplant. Not every study was positive: hydrogen gas did not improve the function of pig kidneys reconnected to blood outside the body. Animal results are reasons to run human trials, not proof that hydrogen protects human kidneys.",
      },
      {
        question: "What should people with kidney disease know before trying hydrogen water?",
        answer:
          "Talk to your nephrologist first, especially if you have chronic kidney disease or are on dialysis, and don't change any treatment. Hydrogen water still counts toward any daily fluid limit. Magnesium-based hydrogen tablets leave magnesium in the drink, and the kidneys are the main way the body gets rid of extra magnesium. Hydrogen water is not a substitute for kidney care.",
      },
    ],
    sources: [
      { n: 1, citation: "Nakayama M, Nakano H, Hamada H, et al. A novel bioactive haemodialysis system using dissolved dihydrogen (H2) produced by water electrolysis: a clinical trial. Nephrology Dialysis Transplantation. 2010;25(9):3026-33.", pmid: "20388631", doi: "10.1093/ndt/gfq196", ourStudyPath: "/study/a-novel-bioactive-haemodialysis-system-using-dissolved-dihydrogen-h2-produced-by-water-electrolysis-a-clinical-trial-1775650467159" },
      { n: 2, citation: "Nakayama M, Itami N, Suzuki H, et al. Novel haemodialysis (HD) treatment employing molecular hydrogen (H2)-enriched dialysis solution improves prognosis of chronic dialysis patients: a prospective observational study. Scientific Reports. 2018;8(1):254.", pmid: "29321509", doi: "10.1038/s41598-017-18537-x", ourStudyPath: "/study/novel-haemodialysis-hd-treatment-employing-molecular-hydrogen-h-2-enriched-dialysis-solution-improves-prognosis-of-chronic-dialysis-patients-a-prospective-observational-study-1775650467142" },
      { n: 3, citation: "Nakayama M, Watanabe K, Sato E, et al. Hemodialysis employing molecular hydrogen (H2) enriched dialysis solution may improve dialysis related fatigue through impact on energy metabolism. Scientific Reports. 2025;15(1):5039.", pmid: "39934143", doi: "10.1038/s41598-025-88827-2", ourStudyPath: "/study/hemodialysis-employing-molecular-hydrogen-h2-enriched-dialysis-solution-may-improve-dialysis-related-fatigue-through-impact-on-energy-metabolism-1775650467176" },
      { n: 4, citation: "Lin YT, Lu JW, Ho YJ, et al. Molecular hydrogen as a potential adjunctive therapy to improve renal function and reduce fatigue in an elderly patient with chronic comorbidities: a case report. In Vivo. 2025;39(1):572-576.", pmid: "39740897", doi: "10.21873/invivo.13862", ourStudyPath: "/study/molecular-hydrogen-as-a-potential-adjunctive-therapy-to-improve-renal-function-and-reduce-fatigue-in-an-elderly-patient-with-chronic-comorbidities-a-case-report-1775650467176" },
      { n: 5, citation: "Viana J, Castro C, Leiva V. Molecular hydrogen and kidney diseases: a scoping review based on scientometry and data analytics. Medical Gas Research. 2025 (issue 2026;16(2):161-168).", pmid: "40826940", doi: "10.4103/mgr.MEDGASRES-D-25-00047", ourStudyPath: "/study/molecular-hydrogen-and-kidney-diseases-a-scoping-review-based-on-scientometry-and-data-analytics-1777577956394" },
      { n: 6, citation: "Yin Y, Wang J, Lian F, et al. Hydrogen-rich water combined with traditional Chinese medicine compound in the treatment of kidney stones: a randomized controlled prospective clinical trial. Medical Gas Research. 2026 (issue 17(1):63-69).", pmid: "42734448", doi: "10.4103/mgr.MEDGASRES-D-26-00067", ourStudyPath: null },
      { n: 7, citation: "Homma K, Yoshida T, Yamashita M, et al. Inhalation of hydrogen gas is beneficial for preventing contrast-induced acute kidney injury in rats. Nephron Experimental Nephrology. 2015.", pmid: "25592271", doi: "10.1159/000369068", ourStudyPath: "/study/inhalation-of-hydrogen-gas-is-beneficial-for-preventing-contrast-induced-acute-kidney-injury-in-rats-1775650467148" },
      { n: 8, citation: "Cardinal JS, Zhan J, Wang Y, et al. Oral hydrogen water prevents chronic allograft nephropathy in rats. Kidney International. 2010;77(2):101-9.", pmid: "19907413", doi: "10.1038/ki.2009.421", ourStudyPath: "/study/oral-hydrogen-water-prevents-chronic-allograft-nephropathy-in-rats-1775650467158" },
      { n: 9, citation: "Nakashima-Kamimura N, Mori T, Ohsawa I, Asoh S, Ohta S. Molecular hydrogen alleviates nephrotoxicity induced by an anti-cancer drug cisplatin without compromising anti-tumor activity in mice. Cancer Chemotherapy and Pharmacology. 2009;64(4):753-61.", pmid: "19148645", doi: "10.1007/s00280-008-0924-2", ourStudyPath: "/study/molecular-hydrogen-alleviates-nephrotoxicity-induced-by-anti-cancer-drug-cisplatin-without-compromising-anti-tumor-activity-in-mice-1775650467160" },
      { n: 10, citation: "Hosgood SA, Moore T, Qurashi M, Adams T, Nicholson ML. Hydrogen gas does not ameliorate renal ischemia reperfusion injury in a preclinical model. Artificial Organs. 2018;42(7):723-727.", pmid: "29611214", doi: "10.1111/aor.13118", ourStudyPath: "/study/hydrogen-gas-does-not-ameliorate-renal-ischemia-reperfusion-injury-in-a-preclinical-model-1775650467141" },
    ],
    ownerLink: { href: "/blog/is-hydrogen-water-good-for-kidneys", label: "Is hydrogen water good for your kidneys? Our full, evidence-graded guide" },
    bridgeTopic: null,
    lastReviewed: "2026-09-29",
  },
  "chronic-fatigue": {
    slug: "chronic-fatigue",
    h1: "Hydrogen and Fatigue: What Studies Show, From Exercise to ME/CFS",
    metaTitle: "Hydrogen Water and Fatigue: The Evidence | Hydrogen Studies",
    metaDescription:
      "Hydrogen water and fatigue research, graded: a small drop in exercise fatigue in healthy adults, but very weak evidence for ME/CFS, long COVID and cancer.",
    evidenceGrade: "very low",
    introMarkdown: `*Hydrogen Studies is funded by Echo Technologies LLC, which sells hydrogen water products. Echo doesn't decide which studies we cover or how we describe them — see our [editorial policy](/editorial-policy).*

**Evidence at a glance: very low** for chronic fatigue syndrome (ME/CFS), long COVID and cancer-related fatigue. **Moderate** that hydrogen slightly reduces how tiring exercise feels in healthy adults.

"Fatigue" means two different things in hydrogen research, and the evidence for each is very different. About 40 human studies in our database mention fatigue. Roughly 16 tested exercise in healthy adults or athletes. About 20 involved people with a diagnosed illness, and most of those were single-patient case reports or small pilot studies.

## Fatigue during exercise in healthy adults

Most of the controlled trials are here. A [2023 meta-analysis](/study/effects-of-molecular-hydrogen-supplementation-on-fatigue-and-aerobic-capacity-in-healthy-adults-a-systematic-review-and-meta-analysis-1777577956390) pooled 19 randomized studies with 402 healthy adults. Hydrogen slightly lowered ratings of perceived effort and blood lactate, but it didn't change VO2max or endurance. A [2024 meta-analysis](/study/can-molecular-hydrogen-supplementation-enhance-physical-performance-in-healthy-adults-a-systematic-review-and-meta-analysis-1777577956391) of 27 publications and 597 adults found the same pattern, with no gain in strength. In one of the largest single studies, [99 untrained and 60 trained adults](/study/drinking-hydrogen-water-enhances-endurance-and-relieves-psychometric-fatigue-a-randomized-double-blind-placebo-controlled-study-1775650467139) drank 500 mL of hydrogen water (0.8–1.0 ppm) shortly before cycling and reported less fatigue. It drew a [published critique](/study/discussion-drinking-hydrogen-water-enhances-endurance-and-relieves-psychometric-fatigue-a-randomized-double-blind-placebo-controlled-study-1777577956388) from other researchers.

**Doses studied:** drinking water with 0.5–5.9 ppm hydrogen, or inhaled gas at 1–68% hydrogen, given as a single dose or daily for 2–14 days. In the 2023 analysis, perceived effort dropped after a single pre-exercise dose but not in the two studies that used several days of intake. The effect is on how tired people felt, not on how far or fast they went. See the [exercise fatigue section of our benefits guide](/blog/molecular-hydrogen-benefits-guide-pillar#does-hydrogen-water-reduce-exercise-fatigue) and our [exercise recovery hub](/explore-by-condition/exercise-recovery).

## ME/CFS (chronic fatigue syndrome)

There is no large trial. A [2026 review](/study/molecular-hydrogen-as-a-treatment-for-mecfs-a-mini-review-of-clinical-evidence-and-mechanistic-rationale-1777577956394), written in part by the team that ran them, describes three small pilot trials of hydrogen-rich water made from tablets. The only one with a placebo group (4 weeks, about 12 mg of hydrogen a day) found no benefit, and about half of participants had temporary moderate-to-severe side effects such as headaches and stomach upset. Two later trials without a placebo group, lasting 8 and 16 weeks, reported improvements in self-rated fatigue and physical function. We couldn't find those trials indexed in PubMed.

Separately, [four case reports](/study/successful-treatment-of-myalgic-encephalomyelitischronic-fatigue-syndrome-using-hydrogen-gas-four-case-reports-1775650467171) described symptom relief in people with ME/CFS who inhaled hydrogen gas for 3–6 hours a day over 8–20 weeks. There was no comparison group, and four of the five authors work for the company that makes the inhaler used.

## Long COVID, cancer and dialysis fatigue

- **Long COVID.** In a [single-blind trial](/study/the-effect-of-14-day-consumption-of-hydrogen-rich-water-alleviates-fatigue-but-does-not-ameliorate-dyspnea-in-long-covid-patients-a-pilot-single-blind-and-randomized-controlled-trial-1775650467172), 32 adults still fatigued and breathless about a month after COVID-19 drank 1 liter a day of 1.6 ppm hydrogen-rich water or plain water for 14 days. The main analysis found no significant difference in fatigue between groups; a secondary analysis of percentage change favored hydrogen. Breathlessness didn't improve.
- **Cancer.** In a [randomized trial of 49 patients](/study/effects-of-drinking-hydrogen-rich-water-on-the-quality-of-life-of-patients-treated-with-radiotherapy-for-liver-tumors-1775650467157) having radiotherapy for liver tumors, 6 weeks of hydrogen-rich water (about 1.1–1.3 ppm, 1.5–2 liters a day) improved overall quality-of-life scores, but fatigue scores didn't differ from placebo. An [uncontrolled report of 82 people with advanced cancer](/study/real-world-survey-of-hydrogen-controlled-cancer-a-follow-up-report-of-82-advanced-cancer-patients-1775650467138) who inhaled hydrogen described less fatigue, with no comparison group.
- **Dialysis.** In [81 hemodialysis patients](/study/hemodialysis-employing-molecular-hydrogen-h2-enriched-dialysis-solution-may-improve-dialysis-related-fatigue-through-impact-on-energy-metabolism-1775650467176), fatigue fell among the most fatigued after 12 months of hydrogen-enriched dialysis fluid, with no control group. See our [kidney health hub](/explore-by-condition/kidney-health).

## What animal studies suggest (not human evidence)

[Mice forced to swim every day for 4 weeks](/study/hydrogen-water-drinking-exerts-antifatigue-effects-in-chronic-forced-swimming-mice-via-antioxidative-and-anti-inflammatory-activities-1775650467140) swam longer and had lower lactate and inflammation markers when they drank hydrogen water. That models repeated exhausting exercise, not the illness-related fatigue of ME/CFS.

## What we don't know

- Whether hydrogen helps ME/CFS in a large, double-blind, placebo-controlled trial
- Whether the small drop in exercise effort lasts, or matters outside the lab
- Whether hydrogen changes everyday tiredness in healthy people who aren't exercising
- Which dose, if any, helps, and whether high tablet doses cause more side effects

Fatigue that lasts for weeks deserves a medical checkup. If you have ME/CFS, long COVID or cancer, talk to your doctor before adding anything, and don't replace your care.

*Drafted with AI assistance and checked against each linked source by our editorial team. General information, not medical advice.*`,
    faqs: [
      {
        question: "Does hydrogen water help with chronic fatigue syndrome (ME/CFS)?",
        answer:
          "It hasn't been shown to. The only placebo-controlled trial we know of in ME/CFS, a small 4-week pilot using about 12 mg of hydrogen a day from tablets, found no benefit, and about half of participants had temporary side effects such as headaches and stomach upset. Two later pilot trials without a placebo group, and four case reports, described improvements in self-rated symptoms. That is very low-certainty evidence, and hydrogen is not a treatment for ME/CFS.",
      },
      {
        question: "Does hydrogen water reduce tiredness during exercise?",
        answer:
          "Slightly, in healthy adults. Two meta-analyses of randomized trials, with 402 and 597 participants, found that hydrogen made exercise feel a little easier and lowered blood lactate, but it did not improve VO2max, endurance or strength. Most trials were small and short, often a single drink of 0.5 to 5.9 ppm hydrogen water shortly before exercise.",
      },
      {
        question: "Can hydrogen water help with long COVID fatigue?",
        answer:
          "The evidence is very limited. In one trial, 32 adults still fatigued about a month after COVID-19 drank 1 liter a day of hydrogen-rich water or plain water for 14 days. The main analysis found no significant difference in fatigue between the groups; a secondary analysis favored hydrogen, and breathlessness did not improve. Larger, double-blind trials are needed.",
      },
      {
        question: "Does hydrogen water give you more energy?",
        answer:
          "There's no good evidence that it boosts everyday energy in healthy people who aren't exercising. The measured effects are on how hard exercise feels during short lab tests. Fatigue that lasts for weeks can have many medical causes, so it deserves a checkup rather than a supplement.",
      },
    ],
    sources: [
      { n: 1, citation: "Zhou K, Liu M, Wang Y, et al. Effects of molecular hydrogen supplementation on fatigue and aerobic capacity in healthy adults: a systematic review and meta-analysis. Frontiers in Nutrition. 2023;10:1094767.", pmid: "36819697", doi: "10.3389/fnut.2023.1094767", ourStudyPath: "/study/effects-of-molecular-hydrogen-supplementation-on-fatigue-and-aerobic-capacity-in-healthy-adults-a-systematic-review-and-meta-analysis-1777577956390" },
      { n: 2, citation: "Zhou K, Shang Z, Yuan C, et al. Can molecular hydrogen supplementation enhance physical performance in healthy adults? A systematic review and meta-analysis. Frontiers in Nutrition. 2024;11:1387657.", pmid: "38903627", doi: "10.3389/fnut.2024.1387657", ourStudyPath: "/study/can-molecular-hydrogen-supplementation-enhance-physical-performance-in-healthy-adults-a-systematic-review-and-meta-analysis-1777577956391" },
      { n: 3, citation: "Mikami T, Tano K, Lee H, et al. Drinking hydrogen water enhances endurance and relieves psychometric fatigue: a randomized, double-blind, placebo-controlled study. Canadian Journal of Physiology and Pharmacology. 2019;97(9):857-862.", pmid: "31251888", doi: "10.1139/cjpp-2019-0059", ourStudyPath: "/study/drinking-hydrogen-water-enhances-endurance-and-relieves-psychometric-fatigue-a-randomized-double-blind-placebo-controlled-study-1775650467139" },
      { n: 4, citation: "Falster C, Korfitzen S, Herold M, Lindebjerg J, Elsøe M. Discussion: Drinking hydrogen water enhances endurance and relieves psychometric fatigue: a randomized, double-blind, placebo-controlled study. Canadian Journal of Physiology and Pharmacology. 2021;99(10):1114-1115.", pmid: "34585956", doi: "10.1139/cjpp-2021-0031", ourStudyPath: "/study/discussion-drinking-hydrogen-water-enhances-endurance-and-relieves-psychometric-fatigue-a-randomized-double-blind-placebo-controlled-study-1777577956388" },
      { n: 5, citation: "Friedberg F, LeBaron TW. Molecular hydrogen as a treatment for ME/CFS: a mini-review of clinical evidence and mechanistic rationale. Frontiers in Medicine. 2026;13:1760210.", pmid: "41930109", doi: "10.3389/fmed.2026.1760210", ourStudyPath: "/study/molecular-hydrogen-as-a-treatment-for-mecfs-a-mini-review-of-clinical-evidence-and-mechanistic-rationale-1777577956394" },
      { n: 6, citation: "Hirano SI, Ichikawa Y, Sato B, Takefuji Y, Satoh F. Successful treatment of myalgic encephalomyelitis/chronic fatigue syndrome using hydrogen gas: four case reports. Medical Gas Research. 2024;14(2):84-86.", pmid: "37929512", doi: "10.4103/2045-9912.385441", ourStudyPath: "/study/successful-treatment-of-myalgic-encephalomyelitischronic-fatigue-syndrome-using-hydrogen-gas-four-case-reports-1775650467171" },
      { n: 7, citation: "Tan Y, Xie Y, Dong G, et al. The effect of 14-day consumption of hydrogen-rich water alleviates fatigue but does not ameliorate dyspnea in long-COVID patients: a pilot, single-blind, and randomized, controlled trial. Nutrients. 2024;16(10):1529.", pmid: "38794767", doi: "10.3390/nu16101529", ourStudyPath: "/study/the-effect-of-14-day-consumption-of-hydrogen-rich-water-alleviates-fatigue-but-does-not-ameliorate-dyspnea-in-long-covid-patients-a-pilot-single-blind-and-randomized-controlled-trial-1775650467172" },
      { n: 8, citation: "Kang KM, Kang YN, Choi IB, et al. Effects of drinking hydrogen-rich water on the quality of life of patients treated with radiotherapy for liver tumors. Medical Gas Research. 2011;1(1):11.", pmid: "22146004", doi: "10.1186/2045-9912-1-11", ourStudyPath: "/study/effects-of-drinking-hydrogen-rich-water-on-the-quality-of-life-of-patients-treated-with-radiotherapy-for-liver-tumors-1775650467157" },
      { n: 9, citation: "Chen JB, Kong XF, Lv YY, et al. \"Real world survey\" of hydrogen-controlled cancer: a follow-up report of 82 advanced cancer patients. Medical Gas Research. 2019;9(3):115-121.", pmid: "31552873", doi: "10.4103/2045-9912.266985", ourStudyPath: "/study/real-world-survey-of-hydrogen-controlled-cancer-a-follow-up-report-of-82-advanced-cancer-patients-1775650467138" },
      { n: 10, citation: "Nakayama M, Watanabe K, Sato E, et al. Hemodialysis employing molecular hydrogen (H2) enriched dialysis solution may improve dialysis related fatigue through impact on energy metabolism. Scientific Reports. 2025;15(1):5039.", pmid: "39934143", doi: "10.1038/s41598-025-88827-2", ourStudyPath: "/study/hemodialysis-employing-molecular-hydrogen-h2-enriched-dialysis-solution-may-improve-dialysis-related-fatigue-through-impact-on-energy-metabolism-1775650467176" },
      { n: 11, citation: "Ara J, Fadriquela A, Ahmed MF, et al. Hydrogen water drinking exerts antifatigue effects in chronic forced swimming mice via antioxidative and anti-inflammatory activities. BioMed Research International. 2018;2018:2571269.", pmid: "29850492", doi: "10.1155/2018/2571269", ourStudyPath: "/study/hydrogen-water-drinking-exerts-antifatigue-effects-in-chronic-forced-swimming-mice-via-antioxidative-and-anti-inflammatory-activities-1775650467140" },
    ],
    ownerLink: { href: "/blog/molecular-hydrogen-benefits-guide-pillar#does-hydrogen-water-reduce-exercise-fatigue", label: "Does hydrogen water reduce exercise fatigue? From our evidence-graded benefits guide" },
    bridgeTopic: null,
    lastReviewed: "2026-09-29",
  },
  "exercise-recovery": {
    slug: "exercise-recovery",
    h1: "Hydrogen Water and Exercise Recovery: What the Studies Show",
    metaTitle: "Hydrogen Water for Exercise Recovery | Hydrogen Studies",
    metaDescription:
      "Does hydrogen water, a hydrogen bath or inhaled hydrogen speed recovery? Small trials on soreness, creatine kinase and lactate, graded, with doses studied.",
    evidenceGrade: "low",
    introMarkdown: `*Hydrogen Studies is funded by Echo Technologies LLC, which sells hydrogen water products. Echo doesn't decide which studies we cover or how we describe them — see our [editorial policy](/editorial-policy).*

**Evidence at a glance: Low.** A handful of small, short human trials found less muscle soreness or lower muscle-damage markers after hard exercise with hydrogen, but other trials found no difference. The recovery trials had 6 to 27 participants, and none lasted longer than six weeks.

This page is about recovery: how muscles feel, and what blood markers show, in the hours and days after hard exercise. For speed, endurance and strength during exercise, see [hydrogen for athletic performance](/hydrogen-for/athletic-performance).

## What human trials found

Most recovery trials were crossover studies, in which the same people tried hydrogen and a look-alike placebo on different occasions.

**Drinking hydrogen water**

- In 12 young men doing a leg workout, drinking 1,260 mL of hydrogen-rich water before, during and after the session lowered blood lactate during exercise. Soreness 24 hours later was 26 versus 41 on a 100-point scale [[3]](/study/hydrogen-rich-water-consumption-positively-affects-muscle-performance-lactate-response-and-alleviates-delayed-onset-of-muscle-soreness-after-resistance-training-1775650467133).
- In 12 elite fin swimmers doing two hard sessions in one day, four days of hydrogen water was followed 12 hours later by lower creatine kinase (a blood marker of muscle damage), slightly less soreness and slightly higher jumps [[4]](/study/hydrogen-rich-water-supplementation-promotes-muscle-recovery-after-two-strenuous-training-sessions-performed-on-the-same-day-in-elite-fin-swimmers-randomized-double-blind-placebo-controlled-crossover-trial-1775650467172).
- In 18 trained men, eight days of hydrogen water (about 1.9 L a day) let them complete more squat repetitions, but soreness, jump height and perceived recovery at 24 and 48 hours didn't differ from placebo [[5]](/study/effects-of-8-days-intake-of-hydrogen-rich-water-on-muscular-endurance-performance-and-fatigue-recovery-during-resistance-training-1775650467175).
- In 27 previously untrained adults over 50 starting resistance training, six weeks of hydrogen water (12 mg of hydrogen per serving, twice a day) lowered blood markers of muscle damage more than placebo water. Strength improved in both groups, and sleep quality tended to improve more with hydrogen, but not significantly [[9]](/study/the-effects-of-drinking-hydrogen-rich-water-for-six-weeks-on-exercise-related-biomarkers-in-exercise-naive-men-and-women-over-50-years-following-resistance-training-program-a-randomized-controlled-pilot-trial-1775650467178).

**Hydrogen baths**

- Six young men who soaked for 30 minutes in a hydrogen-rich bath (about 8 mg per liter) right after damaging leg exercise had no rise in creatine kinase at 24 hours and reported less soreness than after a plain bath [[6]](/study/the-effects-of-supersaturated-hydrogen-rich-water-bathing-on-biomarkers-of-muscular-damage-and-soreness-perception-in-young-men-subjected-to-high-intensity-eccentric-exercise-1775650467137).
- In nine men, daily 20-minute hydrogen baths for a week after downhill running had no effect on soreness, muscle damage or inflammation [[7]](/study/involvement-of-neutrophil-dynamics-and-function-in-exercise-induced-muscle-damage-and-delayed-onset-muscle-soreness-effect-of-hydrogen-bath-1775650467141).

**Inhaled hydrogen**

- Eight men who breathed hydrogen-enriched air (up to about 4% hydrogen) through a nasal tube for an hour after exercise lost less jump height and had less of a urine marker of DNA oxidation. Blood markers of muscle damage and oxidative stress didn't differ [[8]](/study/impact-of-hydrogen-rich-gas-mixture-inhalation-through-nasal-cannula-during-post-exercise-recovery-period-on-subsequent-oxidative-stress-muscle-damage-and-exercise-performances-in-men-1775650467167).

**Pooled results.** A 2024 meta-analysis of six studies (76 people) found hydrogen didn't lower a standard blood marker of oxidative stress after exercise, though antioxidant capacity rose slightly [[2]](/study/can-molecular-hydrogen-supplementation-reduce-exercise-induced-oxidative-stress-in-healthy-adults-a-systematic-review-and-meta-analysis-1777577956391). Another pooled 27 publications (597 healthy adults): exercise felt slightly easier and blood lactate was slightly lower, but endurance and strength didn't improve [[1]](/study/can-molecular-hydrogen-supplementation-enhance-physical-performance-in-healthy-adults-a-systematic-review-and-meta-analysis-1777577956391). We found no meta-analysis pooling soreness or creatine kinase.

## What animal studies suggest (not human evidence)

Rats that inhaled hydrogen while running to exhaustion had lower muscle markers of oxidative stress, inflammation and cell death [[10]](/study/molecular-hydrogen-downregulates-acute-exhaustive-exercise-induced-skeletal-muscle-damage-1775650467136). Mice that drank hydrogen water for four weeks or more ran farther and had fewer signs of muscle damage [[11]](/study/hydrogen-rich-water-improves-endurance-by-reducing-skeletal-muscle-oxidative-stress-and-inflammatory-responses-1775650467183). These point to possible mechanisms; they don't show the same happens in people.

## Doses and durations studied

- **Drinking:** 0.5 to 5.9 ppm in the pooled trials [1]; about 1.3 to 2.5 L on test days [3][4]; from one day to six weeks.
- **Bathing:** one 30-minute bath [6] to a week of daily 20-minute baths [7].
- **Inhaling:** 1% to 68% hydrogen across trials [1]; one hour after exercise in the recovery trial [8].

No standard dose exists, and no trial compared doses or timing.

## What we don't know

- **Whether the effect matters.** Soreness differences were about 8 to 15 points on a 100-point scale [3][4].
- **Who it applies to.** Most participants were young or middle-aged men [1].
- **Longer use.** Most trials lasted 1 to 14 days [1]; the longest recovery trial lasted six weeks [9].
- **Sleep between sessions.** Only one trial measured sleep, without a significant difference [9].
- **Independent replication.** All five positive trials above come from two university labs (Olomouc, Czechia and Novi Sad, Serbia) or list company-affiliated authors [3][4][6][8][9].
- **Larger trials.** A double-blind trial of hydrogen water and 72-hour recovery in junior footballers has published its protocol; results weren't available when we reviewed this page [[12]](/study/hydrogen-rich-water-consumption-for-acute-and-residual-fatigue-after-simulated-football-matches-protocol-for-a-randomized-double-blinded-placebo-controlled-parallel-trial-1775650467180).`,
    faqs: [
      {
        question: "Does hydrogen water reduce muscle soreness after exercise?",
        answer:
          "Possibly a little, but the evidence is thin. In two small crossover trials of 12 people each, soreness 12 to 24 hours after hard exercise was about 8 to 15 points lower on a 100-point scale with hydrogen water than with placebo water. An 18-person trial found no difference in soreness at 24 or 48 hours, and no recovery trial lasted longer than six weeks.",
      },
      {
        question: "Is a hydrogen bath good for muscle recovery?",
        answer:
          "The two trials disagree. Six men who took one 30-minute hydrogen bath after damaging leg exercise reported less soreness and had no rise in creatine kinase, a blood marker of muscle damage, the next day. Nine men who took daily 20-minute hydrogen baths for a week after downhill running saw no effect on soreness, muscle damage or inflammation. Both studies were very small.",
      },
      {
        question: "Should you drink hydrogen water before or after a workout?",
        answer:
          "No trial has compared timing directly. Recovery trials gave hydrogen water before and during the session, sometimes right after it too, and some started one to seven days beforehand. Because timing wasn't tested, there is no evidence-based best time.",
      },
      {
        question: "Does hydrogen water reduce lactic acid after exercise?",
        answer:
          "Slightly, in some trials. A 2024 meta-analysis of trials in 597 healthy adults found blood lactate during exercise was a little lower with hydrogen than with placebo, though many individual trials found no difference. Lower lactate hasn't been shown to mean faster recovery or better endurance.",
      },
    ],
    sources: [
      { n: 1, citation: "Zhou K, et al. Can molecular hydrogen supplementation enhance physical performance in healthy adults? A systematic review and meta-analysis. Front Nutr. 2024;11:1387657.", pmid: "38903627", doi: "10.3389/fnut.2024.1387657", ourStudyPath: "/study/can-molecular-hydrogen-supplementation-enhance-physical-performance-in-healthy-adults-a-systematic-review-and-meta-analysis-1777577956391" },
      { n: 2, citation: "Li Y, et al. Can molecular hydrogen supplementation reduce exercise-induced oxidative stress in healthy adults? A systematic review and meta-analysis. Front Nutr. 2024;11:1328705.", pmid: "38590828", doi: "10.3389/fnut.2024.1328705", ourStudyPath: "/study/can-molecular-hydrogen-supplementation-reduce-exercise-induced-oxidative-stress-in-healthy-adults-a-systematic-review-and-meta-analysis-1777577956391" },
      { n: 3, citation: "Botek M, et al. Hydrogen rich water consumption positively affects muscle performance, lactate response, and alleviates delayed onset of muscle soreness after resistance training. J Strength Cond Res. 2022;36(10):2792-2799.", pmid: "33555824", doi: "10.1519/JSC.0000000000003979", ourStudyPath: "/study/hydrogen-rich-water-consumption-positively-affects-muscle-performance-lactate-response-and-alleviates-delayed-onset-of-muscle-soreness-after-resistance-training-1775650467133" },
      { n: 4, citation: "Sládečková B, et al. Hydrogen-rich water supplementation promotes muscle recovery after two strenuous training sessions performed on the same day in elite fin swimmers: randomized, double-blind, placebo-controlled, crossover trial. Front Physiol. 2024;15:1321160.", pmid: "38681143", doi: "10.3389/fphys.2024.1321160", ourStudyPath: "/study/hydrogen-rich-water-supplementation-promotes-muscle-recovery-after-two-strenuous-training-sessions-performed-on-the-same-day-in-elite-fin-swimmers-randomized-double-blind-placebo-controlled-crossover-trial-1775650467172" },
      { n: 5, citation: "Zhou K, et al. Effects of 8 days intake of hydrogen-rich water on muscular endurance performance and fatigue recovery during resistance training. Front Physiol. 2024;15:1458882.", pmid: "39434721", doi: "10.3389/fphys.2024.1458882", ourStudyPath: "/study/effects-of-8-days-intake-of-hydrogen-rich-water-on-muscular-endurance-performance-and-fatigue-recovery-during-resistance-training-1775650467175" },
      { n: 6, citation: "Todorovic N, et al. The effects of supersaturated hydrogen-rich water bathing on biomarkers of muscular damage and soreness perception in young men subjected to high-intensity eccentric exercise. J Sports Med (Hindawi Publ Corp). 2020;2020:8836070.", pmid: "33123594", doi: "10.1155/2020/8836070", ourStudyPath: "/study/the-effects-of-supersaturated-hydrogen-rich-water-bathing-on-biomarkers-of-muscular-damage-and-soreness-perception-in-young-men-subjected-to-high-intensity-eccentric-exercise-1775650467137" },
      { n: 7, citation: "Kawamura T, et al. Involvement of neutrophil dynamics and function in exercise-induced muscle damage and delayed-onset muscle soreness: effect of hydrogen bath. Antioxidants (Basel). 2018;7(10):127.", pmid: "30257503", doi: "10.3390/antiox7100127", ourStudyPath: "/study/involvement-of-neutrophil-dynamics-and-function-in-exercise-induced-muscle-damage-and-delayed-onset-muscle-soreness-effect-of-hydrogen-bath-1775650467141" },
      { n: 8, citation: "Shibayama Y, et al. Impact of hydrogen-rich gas mixture inhalation through nasal cannula during post-exercise recovery period on subsequent oxidative stress, muscle damage, and exercise performances in men. Med Gas Res. 2020;10(4):155-162.", pmid: "33380581", doi: "10.4103/2045-9912.304222", ourStudyPath: "/study/impact-of-hydrogen-rich-gas-mixture-inhalation-through-nasal-cannula-during-post-exercise-recovery-period-on-subsequent-oxidative-stress-muscle-damage-and-exercise-performances-in-men-1775650467167" },
      { n: 9, citation: "Kuzmanovic J, et al. The effects of drinking hydrogen-rich water for six weeks on exercise-related biomarkers in exercise-naïve men and women over 50 years following resistance training program: a randomized controlled pilot trial. Res Sports Med. 2025;33(6):711-721.", pmid: "40525414", doi: "10.1080/15438627.2025.2521474", ourStudyPath: "/study/the-effects-of-drinking-hydrogen-rich-water-for-six-weeks-on-exercise-related-biomarkers-in-exercise-naive-men-and-women-over-50-years-following-resistance-training-program-a-randomized-controlled-pilot-trial-1775650467178" },
      { n: 10, citation: "Nogueira JE, et al. Molecular hydrogen downregulates acute exhaustive exercise-induced skeletal muscle damage. Can J Physiol Pharmacol. 2021;99(8):812-820.", pmid: "33356867", doi: "10.1139/cjpp-2020-0297", ourStudyPath: "/study/molecular-hydrogen-downregulates-acute-exhaustive-exercise-induced-skeletal-muscle-damage-1775650467136" },
      { n: 11, citation: "Mizuno E, et al. Hydrogen-rich water improves endurance by reducing skeletal muscle oxidative stress and inflammatory responses. Front Nutr. 2026;13:1722091.", pmid: "41641160", doi: "10.3389/fnut.2026.1722091", ourStudyPath: "/study/hydrogen-rich-water-improves-endurance-by-reducing-skeletal-muscle-oxidative-stress-and-inflammatory-responses-1775650467183" },
      { n: 12, citation: "Hruby M, et al. Hydrogen-rich water consumption for acute and residual fatigue after simulated football matches: protocol for a randomized, double-blinded, placebo-controlled, parallel trial. JMIR Res Protoc. 2025;14:e69744.", pmid: "40694834", doi: "10.2196/69744", ourStudyPath: "/study/hydrogen-rich-water-consumption-for-acute-and-residual-fatigue-after-simulated-football-matches-protocol-for-a-randomized-double-blinded-placebo-controlled-parallel-trial-1775650467180" },
    ],
    ownerLink: { href: "/blog/molecular-hydrogen-benefits-guide-pillar", label: "Hydrogen water benefits, graded by evidence" },
    bridgeTopic: null,
    lastReviewed: "2026-09-29",
  },
  "skin-aging": {
    slug: "skin-aging",
    h1: "Hydrogen Water, Hydrogen Baths and Skin Aging: What the Studies Show",
    metaTitle: "Hydrogen Water Benefits for Skin, Graded | Hydrogen Studies",
    metaDescription:
      "Hydrogen water and hydrogen baths for aging skin: human studies are tiny and mostly uncontrolled, and a 6-month trial found no facial-skin change. Details.",
    evidenceGrade: "very low",
    introMarkdown: `*Hydrogen Studies is funded by Echo Technologies LLC, which sells hydrogen water products. Echo doesn't decide which studies we cover or how we describe them — see our [editorial policy](/editorial-policy).*

**Evidence at a glance: Very low.** Human studies of hydrogen and skin appearance are tiny (4 to 40 people) and mostly have no comparison group. The one randomized controlled trial that measured facial skin found no difference. Most positive findings come from cells and mice exposed to ultraviolet (UV) light.

This page covers skin appearance and aging: wrinkles, spots, skin density and sun-related aging (photoaging). For the broader topic, see [hydrogen and skin health](/hydrogen-for/skin-health).

## Drinking hydrogen water

In the only randomized controlled trial we found that measured facial skin, 40 adults aged 70 and older drank 0.5 L a day of hydrogen-rich water (15 ppm) or plain water for six months. Facial skin features didn't differ between groups. The trial's positive findings were elsewhere, such as telomere length and a chair-stand test [[1]](/study/the-effects-of-6-month-hydrogen-rich-water-intake-on-molecular-and-phenotypic-biomarkers-of-aging-in-older-adults-aged-70-years-and-over-a-randomized-controlled-pilot-trial-1775650467164).

## Hydrogen baths

Hydrogen baths are widely searched, but the skin evidence is thin:

- Six Japanese adults bathed daily in warm hydrogen-rich water (0.2 to 0.4 ppm) for three months. Wrinkles on the back of the neck improved in four of them. There was no comparison group, and most of the paper was cell experiments [[2]](/study/hydrogen-rich-electrolyzed-warm-water-represses-wrinkle-formation-against-uva-ray-together-with-type-i-collagen-production-and-oxidative-stress-diminishment-in-fibroblasts-and-cell-injury-prevention-in-keratinocytes-1775650467155).
- Four adults aged 41 to 48 took a 10-minute hydrogen bath (about 0.3 ppm) daily for one to six months. Their skin spots looked smaller and fainter. Again, there was no comparison group [[3]](/study/effects-of-hydrogen-rich-water-bath-on-visceral-fat-and-skin-blotch-with-boiling-resistant-hydrogen-bubbles-1775650467137).
- A 2022 hydrogen-bath study that often comes up in searches mainly measured blood antioxidant capacity and an inflammation marker. Its skin remarks came from a few patients with inflammatory diseases, not from a skin-aging test [[6]](/study/hydrogen-rich-bath-with-nano-sized-bubbles-improves-antioxidant-capacity-based-on-oxygen-radical-absorbing-and-inflammation-levels-in-human-serum-1775650467165).

All three bath papers share a senior author from one Japanese research group.

## Topical hydrogen: water, masks and devices

- Fifteen adults aged 21 to 72 had four weekly facial treatments with hydrogen-rich water (about 2 ppm, strongly alkaline) from an electrolysis device. Visible pores and some pigmentation measures improved, but wrinkle severity didn't change significantly. All participants got the treatment; there was no control group [[5]](/study/topically-applied-molecular-hydrogen-normalizes-skin-parameters-associated-with-oxidative-stress-a-pilot-study-1775650467178).
- Twenty people used a hydrogen-generating gel mask on one side of the face and a commercial mask on the other for four weeks. Skin density, measured by ultrasound, rose 18% on the hydrogen side and 10% on the other. The report doesn't describe blinding, and one author is affiliated with a company, BoyazEnergy [[4]](/study/antioxidant-activity-of-hydrogen-water-mask-pack-composed-of-gel-type-emulsion-and-hydrogen-generation-powder-1775650467136).

## What cell and animal studies suggest (not human evidence)

- In lab-grown human skin cells, dissolved hydrogen protected against several kinds of oxidative damage [[9]](/study/protective-effects-of-dissolved-molecular-hydrogen-against-hydrogen-peroxide-hydroperoxide-and-glyoxal-induced-injuries-to-human-skin-keratinocytes-1775650467162), and hydrogen-rich warm water roughly doubled type I collagen production in lab-grown fibroblasts, the cells that make collagen [2].
- Mice exposed to UVA light for six weeks while breathing 1.3% hydrogen gas 16 hours a day showed fewer signs of photoaging, including less skin thickening, pigment and collagen breakdown [[7]](/study/intermittent-environmental-exposure-to-hydrogen-prevents-skin-photoaging-through-reduction-of-oxidative-stress-1775650467169).
- In lab-grown artificial skin, 1.3% hydrogen gas dampened UVA-triggered gene activity linked to skin aging. One author works for Panasonic [[8]](/study/transcriptome-based-evaluation-of-hydrogen-gas-effects-for-preventing-uva-induced-photoaging-using-an-artificial-skin-model-1775650467183).

These suggest hydrogen may reduce oxidative stress from UV light. They don't show that drinking, bathing in or applying hydrogen changes how human skin ages.

## Skin disease research

Hydrogen has also been tested in skin diseases, including a hydrogen-water bathing study in 75 people with psoriasis [[10]](/study/positive-effects-of-hydrogen-water-bathing-in-patients-of-psoriasis-and-parapsoriasis-en-plaques-1775650467143) and a 21-person pilot trial in people awaiting keloid scar surgery [[11]](/study/exploratory-evaluation-of-hydrogen-rich-water-therapy-for-keloid-management-a-double-blinded-randomized-pilot-trial-1775650467183). These are early studies of diseases, separate from cosmetic aging, and don't establish hydrogen as a treatment. If you have a skin condition, talk to a dermatologist.

## Doses and delivery studied

- **Drinking:** 0.5 L a day at 15 ppm for six months [1].
- **Bathing:** 0.2 to 0.4 ppm, daily, for one to six months [2][3].
- **Topical:** about 2 ppm water in four weekly sessions [5]; a hydrogen-generating mask for four weeks [4].
- **Cells and animals:** 1.3% hydrogen gas [7][8].

## What we don't know

- **Whether hydrogen changes wrinkles, elasticity or sun damage in people.** We found no placebo-controlled trial showing it.
- **Whether the route matters.** We found no study comparing drinking, bathing and applying hydrogen.
- **What else explains the results.** The topical study's water was also strongly alkaline (about pH 10.4) [5].
- **Long-term effects.** The longest human study lasted six months [1].
- **Independence.** Several studies here come from one research group [2][3][6] or have company-affiliated authors [4][8].`,
    faqs: [
      {
        question: "Does drinking hydrogen water reduce wrinkles?",
        answer:
          "There's no good evidence that it does. In the only randomized controlled trial we found that measured facial skin, 40 adults aged 70 and older drank 0.5 liters a day of hydrogen-rich water or plain water for six months, and their facial skin features didn't differ. Claims about wrinkles rest mainly on cell and mouse studies.",
      },
      {
        question: "Does a hydrogen bath help your skin?",
        answer:
          "It hasn't been shown. Two small Japanese studies reported fewer neck wrinkles in 4 of 6 people after three months of daily hydrogen baths, and smaller skin spots in 4 people after up to six months, but neither had a comparison group, so the changes can't be credited to hydrogen. We found no controlled trial of hydrogen baths for skin aging.",
      },
      {
        question: "Do hydrogen face masks or topical hydrogen water work?",
        answer:
          "The evidence is preliminary. A 15-person study of four weekly facial treatments with hydrogen-rich water found smaller-looking pores and some pigmentation changes but no significant change in wrinkles, and it had no control group. A 20-person split-face study found skin density rose more with a hydrogen mask than with a commercial mask over four weeks. Neither was a placebo-controlled trial.",
      },
    ],
    sources: [
      { n: 1, citation: "Zanini D, et al. The effects of 6-month hydrogen-rich water intake on molecular and phenotypic biomarkers of aging in older adults aged 70 years and over: a randomized controlled pilot trial. Exp Gerontol. 2021;155:111574.", pmid: "34601077", doi: "10.1016/j.exger.2021.111574", ourStudyPath: "/study/the-effects-of-6-month-hydrogen-rich-water-intake-on-molecular-and-phenotypic-biomarkers-of-aging-in-older-adults-aged-70-years-and-over-a-randomized-controlled-pilot-trial-1775650467164" },
      { n: 2, citation: "Kato S, et al. Hydrogen-rich electrolyzed warm water represses wrinkle formation against UVA ray together with type-I collagen production and oxidative-stress diminishment in fibroblasts and cell-injury prevention in keratinocytes. J Photochem Photobiol B. 2012;106:24-33.", pmid: "22070900", doi: "10.1016/j.jphotobiol.2011.09.006", ourStudyPath: "/study/hydrogen-rich-electrolyzed-warm-water-represses-wrinkle-formation-against-uva-ray-together-with-type-i-collagen-production-and-oxidative-stress-diminishment-in-fibroblasts-and-cell-injury-prevention-in-keratinocytes-1775650467155" },
      { n: 3, citation: "Asada R, et al. Effects of hydrogen-rich water bath on visceral fat and skin blotch, with boiling-resistant hydrogen bubbles. Med Gas Res. 2019;9(2):68-73.", pmid: "31249254", doi: "10.4103/2045-9912.260647", ourStudyPath: "/study/effects-of-hydrogen-rich-water-bath-on-visceral-fat-and-skin-blotch-with-boiling-resistant-hydrogen-bubbles-1775650467137" },
      { n: 4, citation: "Kwon HJ, et al. Antioxidant activity of hydrogen water mask pack composed of gel-type emulsion and hydrogen generation powder. Int J Mol Sci. 2020;21(24):9731.", pmid: "33419292", doi: "10.3390/ijms21249731", ourStudyPath: "/study/antioxidant-activity-of-hydrogen-water-mask-pack-composed-of-gel-type-emulsion-and-hydrogen-generation-powder-1775650467136" },
      { n: 5, citation: "Debkowska N, et al. Topically applied molecular hydrogen normalizes skin parameters associated with oxidative stress: a pilot study. Antioxidants (Basel). 2025;14(6):729.", pmid: "40563361", doi: "10.3390/antiox14060729", ourStudyPath: "/study/topically-applied-molecular-hydrogen-normalizes-skin-parameters-associated-with-oxidative-stress-a-pilot-study-1775650467178" },
      { n: 6, citation: "Tanaka Y, et al. Hydrogen-rich bath with nano-sized bubbles improves antioxidant capacity based on oxygen radical absorbing and inflammation levels in human serum. Med Gas Res. 2022;12(3):91-99.", pmid: "34854419", doi: "10.4103/2045-9912.330692", ourStudyPath: "/study/hydrogen-rich-bath-with-nano-sized-bubbles-improves-antioxidant-capacity-based-on-oxygen-radical-absorbing-and-inflammation-levels-in-human-serum-1775650467165" },
      { n: 7, citation: "Kiyoi T, et al. Intermittent environmental exposure to hydrogen prevents skin photoaging through reduction of oxidative stress. Geriatr Gerontol Int. 2023;23(4):304-312.", pmid: "36807963", doi: "10.1111/ggi.14562", ourStudyPath: "/study/intermittent-environmental-exposure-to-hydrogen-prevents-skin-photoaging-through-reduction-of-oxidative-stress-1775650467169" },
      { n: 8, citation: "Kiyoi T, et al. Transcriptome-based evaluation of hydrogen gas effects for preventing UVA-induced photoaging using an artificial skin model. Geriatr Gerontol Int. 2026;26(3):e70401. (Correction: Geriatr Gerontol Int. 2026;26(4):e70453.)", pmid: "41749059", doi: "10.1111/ggi.70401", ourStudyPath: "/study/transcriptome-based-evaluation-of-hydrogen-gas-effects-for-preventing-uva-induced-photoaging-using-an-artificial-skin-model-1775650467183" },
      { n: 9, citation: "Saitoh Y, et al. Protective effects of dissolved molecular hydrogen against hydrogen peroxide-, hydroperoxide-, and glyoxal-induced injuries to human skin keratinocytes. Mol Cell Biochem. 2021;476(10):3613-3622.", pmid: "34028646", doi: "10.1007/s11010-021-04189-z", ourStudyPath: "/study/protective-effects-of-dissolved-molecular-hydrogen-against-hydrogen-peroxide-hydroperoxide-and-glyoxal-induced-injuries-to-human-skin-keratinocytes-1775650467162" },
      { n: 10, citation: "Zhu Q, et al. Positive effects of hydrogen-water bathing in patients of psoriasis and parapsoriasis en plaques. Sci Rep. 2018;8(1):8051.", pmid: "29795283", doi: "10.1038/s41598-018-26388-3", ourStudyPath: "/study/positive-effects-of-hydrogen-water-bathing-in-patients-of-psoriasis-and-parapsoriasis-en-plaques-1775650467143" },
      { n: 11, citation: "Kuang X, et al. Exploratory evaluation of hydrogen-rich water therapy for keloid management: a double-blinded randomized pilot trial. Aesthetic Plast Surg. 2026;50(9):3448-3459.", pmid: "41545661", doi: "10.1007/s00266-025-05512-5", ourStudyPath: "/study/exploratory-evaluation-of-hydrogen-rich-water-therapy-for-keloid-management-a-double-blinded-randomized-pilot-trial-1775650467183" },
    ],
    ownerLink: { href: "/blog/molecular-hydrogen-benefits-guide-pillar", label: "Hydrogen water benefits, graded by evidence" },
    bridgeTopic: null,
    lastReviewed: "2026-09-29",
  },

  "sleep-quality": {
    slug: "sleep-quality",
    h1: "Hydrogen Water and Sleep Quality: What the Studies Show",
    metaTitle: "Does Hydrogen Water Help You Sleep? | Hydrogen Studies",
    metaDescription:
      "Hydrogen water, jelly and inhaled hydrogen for sleep, graded: a few small trials with mixed results; the best-blinded one found no benefit over placebo.",
    evidenceGrade: "very low",
    introMarkdown: `*Hydrogen Studies is funded by Echo Technologies LLC, which sells hydrogen water products. Echo doesn't decide which studies we cover or how we describe them — see our [editorial policy](/editorial-policy).*

**Evidence at a glance: Very low.** A few small human trials have measured sleep, mostly as a side outcome. The best-blinded trial, in healthy adults with poor sleep, found no difference from placebo. The most positive, of inhaled hydrogen in people with insomnia, lasted 7 days and was single-blind.

This page covers sleep quality in adults. Insomnia and sleep apnea are medical conditions: if you often can't fall or stay asleep, snore loudly, or someone has noticed pauses in your breathing at night, see a clinician. For the short answer, see the [sleep section of our benefits guide](/blog/molecular-hydrogen-benefits-guide-pillar#can-hydrogen-water-help-with-sleep-mood-or-stress).

## What human trials found

**Drinking hydrogen water**

- In 36 adults with obesity, 8 weeks of hydrogen-rich water (1 liter a day, 15 mg of hydrogen) improved sleep-questionnaire scores, but so did placebo. Only one item, self-rated sleep quality, favored hydrogen, at the edge of significance (p = 0.05), with no correction for testing many outcomes [[1]](/study/the-effects-of-8-week-hydrogen-rich-water-consumption-on-appetite-body-composition-sleep-quality-and-circulating-glucagon-like-peptide-1-in-obese-men-and-women-hydrappet-a-randomized-controlled-trial-1775650467179).
- In 27 adults over 50 starting strength training, 6 weeks of hydrogen water (12 mg of hydrogen, twice a day) showed a non-significant trend toward better sleep [[2]](/study/the-effects-of-drinking-hydrogen-rich-water-for-six-weeks-on-exercise-related-biomarkers-in-exercise-naive-men-and-women-over-50-years-following-resistance-training-program-a-randomized-controlled-pilot-trial-1775650467178) (see our [exercise recovery hub](/explore-by-condition/exercise-recovery)). In 40 adults aged 70 and older, 6 months of hydrogen water (0.5 liters a day, 15 ppm) didn't change sleep outcomes [[3]](/study/the-effects-of-6-month-hydrogen-rich-water-intake-on-molecular-and-phenotypic-biomarkers-of-aging-in-older-adults-aged-70-years-and-over-a-randomized-controlled-pilot-trial-1775650467164).
- In a 4-week crossover trial of 26 healthy adults (600 mL a day, 0.8–1.2 ppm), sleep scores after hydrogen water didn't differ from placebo, and daytime sleepiness didn't change [[4]](/study/hydrogen-rich-water-for-improvements-of-mood-anxiety-and-autonomic-nerve-function-in-daily-life-1775650467142).
- In a single-blind trial of 32 people with long COVID (1 liter a day of 1.6 ppm hydrogen water or plain water for 14 days), an exploratory analysis of the 19 poor sleepers favored hydrogen on one measure but not another (p = 0.06) [[5]](/study/the-effect-of-14-day-consumption-of-hydrogen-rich-water-alleviates-fatigue-but-does-not-ameliorate-dyspnea-in-long-covid-patients-a-pilot-single-blind-and-randomized-controlled-trial-1775650467172) (see our [fatigue hub](/explore-by-condition/chronic-fatigue)).

**Inhaled hydrogen**

- In 66 adults with chronic insomnia, 41 breathed a gas of two-thirds hydrogen and one-third oxygen through a nasal tube, 1 hour twice a day for 7 days; 25 breathed air. On a wrist monitor, the hydrogen group slept longer and lay awake less; sleep efficiency didn't differ. Sleep-quality questionnaire scores were also better than with air. The trial was single-blind, and two of its four authors worked for the inhaler's maker [[6]](/study/effect-of-hydrogen-oxygen-inhalation-on-sleep-disorders-and-abnormal-mood-a-single-blind-randomized-controlled-trial-1775650467179).
- After surgery, two hospital trials disagreed. In 75 brain-tumor surgery patients, the hydrogen group slept longer and more efficiently than an oxygen group on some days but not others [[7]](/study/effects-of-perioperative-hydrogen-inhalation-on-brain-edema-and-prognosis-in-patients-with-glioma-a-single-center-randomized-controlled-study-1775650467174). In 153 adults aged 65 and older, self-rated sleep didn't differ [[8]](/study/hydrogen-gas-treatment-improves-postoperative-delirium-and-cognitive-dysfunction-in-elderly-noncardiac-patients-1775650467169).

**Other: hydrogen jelly**

- In the only double-blind, placebo-controlled trial we found with sleep as its main outcome, 44 healthy adults with poor sleep ate hydrogen-rich jelly (0.9 mg of hydrogen a day) or identical placebo jelly for 8 weeks. Both groups reported better sleep, with no difference between them. An exploratory analysis found more improvement in people with fewer hydrogen-producing gut bacteria, an idea that still needs testing [[9]](/study/individual-variability-in-hydrogen-producing-microbes-influences-the-response-to-hydrogen-supplementation-on-sleep-quality-a-randomized-double-blind-placebo-controlled-parallel-study-1785513615619).

## What animal studies suggest (not human evidence)

- Mice given hydrogen-rich water for 7 days had more consolidated sleep on brain-wave recordings, and after being kept awake they slept more. One author works for a hydrogen products company [[10]](/study/hydrogen-rich-water-improves-sleep-consolidation-and-enhances-forebrain-neuronal-activation-in-mice-1775650467171).

## Doses and durations studied

- **Drinking:** about 0.5 mg to 24 mg of hydrogen a day, usually in 0.5 to 1 liter of water, for 2 weeks to 6 months [1]–[5]. See [how much hydrogen water per day](/blog/how-much-hydrogen-water-per-day).
- **Jelly:** 0.9 mg a day for 8 weeks [9].
- **Inhaling:** two-thirds hydrogen, one-third oxygen, 2 hours a day for 7 days [6].
- **Timing:** No trial compared bedtime with other times. Drinking trials spread servings through the day or served them with meals [1][4]; the insomnia trial's sessions ended 2 hours before bed [6].

## What we don't know

- **Whether hydrogen helps healthy sleepers.** The best-blinded trial found no difference, and in two trials the placebo group improved as well [1][9].
- **Objective and longer-term sleep.** Only two trials used a sleep-tracking device [6][7], none used an overnight sleep-lab study, and the insomnia trial lasted 7 days [6].
- **Independence.** Three drinking trials come from one lab in Serbia [1][2][3]; several had company-linked authors or products [1][2][6][9].
- **Sleep disorders.** We found no human trial of hydrogen for sleep apnea, and none comparing it with proven insomnia treatment such as cognitive behavioral therapy (CBT-I).
- **Safety.** Few side effects were reported [1][9], but in one surgical trial low blood oxygen during inhalation was more common with hydrogen (7% vs 3%) [8]. See [hydrogen water side effects](/blog/hydrogen-water-side-effects) and [hydrogen inhalation side effects](/blog/hydrogen-inhalation-side-effects).

*Drafted with AI assistance and checked against each linked source by our editorial team. General information, not medical advice.*`,
    faqs: [
      {
        question: "Does hydrogen water help you sleep?",
        answer:
          "It hasn't been shown to. In the only double-blind, placebo-controlled trial we found with sleep as its main outcome, 44 healthy adults with poor sleep took hydrogen-rich jelly or placebo jelly for 8 weeks, and sleep improved about equally in both groups. Trials of drinking hydrogen water, with 26 to 40 people each, found no difference, a non-significant trend or a borderline result, usually with sleep as a side outcome.",
      },
      {
        question: "Should you drink hydrogen water before bed?",
        answer:
          "No trial has tested bedtime timing. In the drinking trials, people had hydrogen water with meals or spread through the day, and in the inhaled-gas trial, sessions ended 2 hours before bed. There's no evidence that bedtime is better than any other time, and drinking a lot of any fluid late in the evening can mean more trips to the bathroom at night.",
      },
      {
        question: "Does inhaling hydrogen improve sleep?",
        answer:
          "One small trial suggests it might, in the short term. In 66 adults with chronic insomnia, those who inhaled a hydrogen-oxygen gas for 1 hour twice a day for 7 days slept longer and rated their sleep better than those who breathed air. But the trial was short and single-blind, and two of its four authors worked for the device maker. In hospital patients after surgery, two trials of inhaled hydrogen gave mixed results.",
      },
      {
        question: "Can hydrogen treat insomnia or sleep apnea?",
        answer:
          "There's no good evidence that it can. We found no human trial of hydrogen for sleep apnea and only one 7-day trial in insomnia. Both are medical conditions with proven treatments, such as cognitive behavioral therapy for insomnia (CBT-I) and CPAP for sleep apnea. If you often have trouble sleeping, snore loudly, or someone has noticed pauses in your breathing at night, see a clinician.",
      },
    ],
    sources: [
      { n: 1, citation: "Todorovic N, et al. The effects of 8-week hydrogen-rich water consumption on appetite, body composition, sleep quality, and circulating glucagon-like peptide-1 in obese men and women (HYDRAPPET): a randomized controlled trial. Medicina (Kaunas). 2025;61(7):1299.", pmid: "40731927", doi: "10.3390/medicina61071299", ourStudyPath: "/study/the-effects-of-8-week-hydrogen-rich-water-consumption-on-appetite-body-composition-sleep-quality-and-circulating-glucagon-like-peptide-1-in-obese-men-and-women-hydrappet-a-randomized-controlled-trial-1775650467179" },
      { n: 2, citation: "Kuzmanovic J, et al. The effects of drinking hydrogen-rich water for six weeks on exercise-related biomarkers in exercise-naïve men and women over 50 years following resistance training program: a randomized controlled pilot trial. Res Sports Med. 2025;33(6):711-721.", pmid: "40525414", doi: "10.1080/15438627.2025.2521474", ourStudyPath: "/study/the-effects-of-drinking-hydrogen-rich-water-for-six-weeks-on-exercise-related-biomarkers-in-exercise-naive-men-and-women-over-50-years-following-resistance-training-program-a-randomized-controlled-pilot-trial-1775650467178" },
      { n: 3, citation: "Zanini D, et al. The effects of 6-month hydrogen-rich water intake on molecular and phenotypic biomarkers of aging in older adults aged 70 years and over: a randomized controlled pilot trial. Exp Gerontol. 2021;155:111574.", pmid: "34601077", doi: "10.1016/j.exger.2021.111574", ourStudyPath: "/study/the-effects-of-6-month-hydrogen-rich-water-intake-on-molecular-and-phenotypic-biomarkers-of-aging-in-older-adults-aged-70-years-and-over-a-randomized-controlled-pilot-trial-1775650467164" },
      { n: 4, citation: "Mizuno K, et al. Hydrogen-rich water for improvements of mood, anxiety, and autonomic nerve function in daily life. Med Gas Res. 2018;7(4):247-255.", pmid: "29497485", doi: "10.4103/2045-9912.222448", ourStudyPath: "/study/hydrogen-rich-water-for-improvements-of-mood-anxiety-and-autonomic-nerve-function-in-daily-life-1775650467142" },
      { n: 5, citation: "Tan Y, et al. The effect of 14-day consumption of hydrogen-rich water alleviates fatigue but does not ameliorate dyspnea in long-COVID patients: a pilot, single-blind, and randomized, controlled trial. Nutrients. 2024;16(10):1529.", pmid: "38794767", doi: "10.3390/nu16101529", ourStudyPath: "/study/the-effect-of-14-day-consumption-of-hydrogen-rich-water-alleviates-fatigue-but-does-not-ameliorate-dyspnea-in-long-covid-patients-a-pilot-single-blind-and-randomized-controlled-trial-1775650467172" },
      { n: 6, citation: "Gao YH, et al. Effect of hydrogen-oxygen inhalation on sleep disorders and abnormal mood: a single-blind, randomized controlled trial. Med Gas Res. 2025 (issue 2026;16(2):98-102).", pmid: "40826930", doi: "10.4103/mgr.MEDGASRES-D-25-00020", ourStudyPath: "/study/effect-of-hydrogen-oxygen-inhalation-on-sleep-disorders-and-abnormal-mood-a-single-blind-randomized-controlled-trial-1775650467179" },
      { n: 7, citation: "Wu F, et al. Effects of perioperative hydrogen inhalation on brain edema and prognosis in patients with glioma: a single-center, randomized controlled study. Front Neurol. 2024;15:1413904.", pmid: "39099781", doi: "10.3389/fneur.2024.1413904", ourStudyPath: "/study/effects-of-perioperative-hydrogen-inhalation-on-brain-edema-and-prognosis-in-patients-with-glioma-a-single-center-randomized-controlled-study-1775650467174" },
      { n: 8, citation: "Lin H, et al. Hydrogen gas treatment improves postoperative delirium and cognitive dysfunction in elderly noncardiac patients. J Pers Med. 2022;13(1):67.", pmid: "36675728", doi: "10.3390/jpm13010067", ourStudyPath: "/study/hydrogen-gas-treatment-improves-postoperative-delirium-and-cognitive-dysfunction-in-elderly-noncardiac-patients-1775650467169" },
      { n: 9, citation: "Higashikawa F, Kanno K. Individual variability in hydrogen-producing microbes influences the response to hydrogen supplementation on sleep quality: a randomized, double-blind, placebo-controlled, parallel study. Sci Rep. 2026;16(1).", pmid: "42509250", doi: "10.1038/s41598-026-52342-9", ourStudyPath: "/study/individual-variability-in-hydrogen-producing-microbes-influences-the-response-to-hydrogen-supplementation-on-sleep-quality-a-randomized-double-blind-placebo-controlled-parallel-study-1785513615619" },
      { n: 10, citation: "Vincent SM, et al. Hydrogen-rich water improves sleep consolidation and enhances forebrain neuronal activation in mice. Sleep Adv. 2023;5(1):zpad057.", pmid: "38264142", doi: "10.1093/sleepadvances/zpad057", ourStudyPath: "/study/hydrogen-rich-water-improves-sleep-consolidation-and-enhances-forebrain-neuronal-activation-in-mice-1775650467171" },
    ],
    ownerLink: { href: "/blog/molecular-hydrogen-benefits-guide-pillar#can-hydrogen-water-help-with-sleep-mood-or-stress", label: "Can hydrogen water help with sleep, mood or stress? From our evidence-graded benefits guide" },
    bridgeTopic: null,
    lastReviewed: "2026-10-05",
  },
};

export function getConditionHubIntro(slug: string | null | undefined): ConditionHubIntro | null {
  if (!slug) return null;
  return CONDITION_HUB_INTROS[slug.toLowerCase()] ?? null;
}

/**
 * Visible byline: "By Hydrogen Studies Editorial Team · Updated <date>" — the
 * blog byline helper with no author/reviewer, so the label is "Updated".
 */
export function conditionHubByline(intro: Pick<ConditionHubIntro, "lastReviewed">): BlogByline {
  return blogByline({ authorName: null, reviewerName: null, updatedAt: intro.lastReviewed });
}

export interface ConditionHubSourceLink {
  href: string;
  label: "PubMed" | "DOI" | "Our summary";
  external: boolean;
}

/**
 * Links for one numbered source: PubMed when there is a PMID, otherwise the
 * DOI; plus our own study summary when we have the study.
 */
export function conditionHubSourceLinks(source: ConditionHubSource): ConditionHubSourceLink[] {
  const links: ConditionHubSourceLink[] = [];
  const pmid = (source.pmid ?? "").trim();
  const doi = normalizeDoi(source.doi);
  if (/^\d+$/.test(pmid)) {
    links.push({ href: `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`, label: "PubMed", external: true });
  } else if (doi) {
    links.push({ href: `https://doi.org/${doi}`, label: "DOI", external: true });
  }
  const ours = (source.ourStudyPath ?? "").trim();
  if (ours.startsWith("/study/")) {
    links.push({ href: ours, label: "Our summary", external: false });
  }
  return links;
}

/** "source-3" — the id of source 3's list item. */
export function conditionHubSourceId(n: number): string {
  return `source-${n}`;
}

/**
 * JSON-LD for a hub with an intro — the bot <head> and the SPA emit exactly
 * this. Only what the page shows: the H1, the byline's team + "Updated"
 * date (dateModified; no reviewedBy — no named reviewer), and the visible
 * FAQ (FAQPage).
 */
export function conditionHubJsonLd(
  intro: ConditionHubIntro,
  opts: { canonical: string; siteUrl: string },
): Record<string, any>[] {
  const by = conditionHubByline(intro);
  const page: Record<string, any> = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: intro.h1,
    description: intro.metaDescription,
    url: opts.canonical,
    ...(by.date ? { dateModified: by.date.toISOString() } : {}),
    author: { "@type": "Organization", name: EDITORIAL_TEAM, url: `${opts.siteUrl}/editorial-policy` },
    publisher: { "@type": "Organization", name: SITE_NAME, url: opts.siteUrl },
  };
  return [page, faqPageJsonLd(intro.faqs)];
}
