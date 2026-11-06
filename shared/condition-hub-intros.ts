/**
 * /explore-by-condition/:slug evidence-graded intros (keyword plan waves 3–4) —
 * the single source for the SPA page (ConditionCategoryPage.tsx) AND the bot
 * renderer/meta (seo-body-renderer.ts / page-meta.ts), so crawlers
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
 *    (kidney-health, chronic-fatigue and the wave-5 cholesterol,
 *    type-2-diabetes, fatty-liver-nafld and gut-health hubs are disease
 *    topics — PLAN.md Appendix E; the others carry no bridge either).
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

## What have human studies tested?

Mostly hydrogen added to dialysis fluid, which is a medical treatment, not a drink. We found no controlled trial of drinking hydrogen water for chronic kidney disease.

- **Hydrogen in dialysis fluid.** Researchers dissolved about 30–80 parts per billion of hydrogen into hemodialysis fluid. In a [6-month study of 21 patients](/study/a-novel-bioactive-haemodialysis-system-using-dissolved-dihydrogen-h2-produced-by-water-electrolysis-a-clinical-trial-pmid-20388631) with no comparison group, blood pressure and two inflammation markers fell. In a [non-randomized study of 309 patients](/study/novel-haemodialysis-hd-treatment-employing-molecular-hydrogen-h-2-enriched-dialysis-solution-improves-prognosis-of-chronic-dialysis-patients-a-prospective-observational-study-pmid-29321509) followed for about 3.3 years, the hydrogen group had a 41% lower adjusted risk of death or major heart, stroke or amputation events. A [12-month study of 81 patients](/study/hemodialysis-employing-molecular-hydrogen-h2-enriched-dialysis-solution-may-improve-dialysis-related-fatigue-through-impact-on-energy-metabolism-pmid-39934143) reported less fatigue in the most fatigued patients, again with no control group. This is a medical treatment delivered through a dialysis machine, not a drink.
- **Drinking hydrogen for chronic kidney disease (CKD).** We found no controlled trial. The human evidence is a [single case report](/study/molecular-hydrogen-as-a-potential-adjunctive-therapy-to-improve-renal-function-and-reduce-fatigue-in-an-elderly-patient-with-chronic-comorbidities-a-case-report-pmid-39740897) of an 89-year-old woman whose creatinine fell after she started hydrogen capsules. A [2025 scoping review of 69 publications](/study/molecular-hydrogen-and-kidney-diseases-a-scoping-review-based-on-scientometry-and-data-analytics-pmid-40826940) called for more robust clinical trials.
- **Kidney stones.** In a [2026 randomized trial](https://pubmed.ncbi.nlm.nih.gov/42734448/) of 100 people, 32% of those who added hydrogen-rich water to standard care for 12 weeks responded, versus 28% on standard care alone (and 76% with a Chinese herbal formula).
- **Contrast dye injury and kidney transplants.** We found no human trials.

## What do animal studies suggest (not human evidence)?

In rats and mice, hydrogen reduced sudden kidney injuries caused by contrast dye, a transplant and a chemotherapy drug, though not every experiment was positive. Lab injuries happen fast, while chronic kidney disease develops over years, so these results don't show what hydrogen does in people.

In rats, [inhaled hydrogen gas reduced kidney injury from contrast dye](/study/inhalation-of-hydrogen-gas-is-beneficial-for-preventing-contrast-induced-acute-kidney-injury-in-rats-pmid-25592271), and [hydrogen water given for 150 days after a kidney transplant](/study/oral-hydrogen-water-prevents-chronic-allograft-nephropathy-in-rats-pmid-19907413) slowed chronic graft damage. In mice given the chemotherapy drug cisplatin, [drinking water with about 1.6 ppm hydrogen](/study/molecular-hydrogen-alleviates-nephrotoxicity-induced-by-anti-cancer-drug-cisplatin-without-compromising-anti-tumor-activity-in-mice-pmid-19148645) reduced kidney damage. Not every result is positive: in pig kidneys reconnected to blood outside the body, [2% hydrogen gas did not improve function](/study/hydrogen-gas-does-not-ameliorate-renal-ischemia-reperfusion-injury-in-a-preclinical-model-pmid-29611214).

## What don't we know yet?

Almost everything that matters for people with kidney disease is still untested, from kidney-function results to long-term safety.

- Whether drinking hydrogen water changes eGFR, creatinine or urine protein in people with kidney disease
- Whether the dialysis results hold up in randomized trials by independent groups
- What dose, concentration or duration would matter
- Long-term safety of hydrogen water in people with reduced kidney function

## What should you do if you have kidney disease?

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
      { n: 1, citation: "Nakayama M, Nakano H, Hamada H, et al. A novel bioactive haemodialysis system using dissolved dihydrogen (H2) produced by water electrolysis: a clinical trial. Nephrology Dialysis Transplantation. 2010;25(9):3026-33.", pmid: "20388631", doi: "10.1093/ndt/gfq196", ourStudyPath: "/study/a-novel-bioactive-haemodialysis-system-using-dissolved-dihydrogen-h2-produced-by-water-electrolysis-a-clinical-trial-pmid-20388631" },
      { n: 2, citation: "Nakayama M, Itami N, Suzuki H, et al. Novel haemodialysis (HD) treatment employing molecular hydrogen (H2)-enriched dialysis solution improves prognosis of chronic dialysis patients: a prospective observational study. Scientific Reports. 2018;8(1):254.", pmid: "29321509", doi: "10.1038/s41598-017-18537-x", ourStudyPath: "/study/novel-haemodialysis-hd-treatment-employing-molecular-hydrogen-h-2-enriched-dialysis-solution-improves-prognosis-of-chronic-dialysis-patients-a-prospective-observational-study-pmid-29321509" },
      { n: 3, citation: "Nakayama M, Watanabe K, Sato E, et al. Hemodialysis employing molecular hydrogen (H2) enriched dialysis solution may improve dialysis related fatigue through impact on energy metabolism. Scientific Reports. 2025;15(1):5039.", pmid: "39934143", doi: "10.1038/s41598-025-88827-2", ourStudyPath: "/study/hemodialysis-employing-molecular-hydrogen-h2-enriched-dialysis-solution-may-improve-dialysis-related-fatigue-through-impact-on-energy-metabolism-pmid-39934143" },
      { n: 4, citation: "Lin YT, Lu JW, Ho YJ, et al. Molecular hydrogen as a potential adjunctive therapy to improve renal function and reduce fatigue in an elderly patient with chronic comorbidities: a case report. In Vivo. 2025;39(1):572-576.", pmid: "39740897", doi: "10.21873/invivo.13862", ourStudyPath: "/study/molecular-hydrogen-as-a-potential-adjunctive-therapy-to-improve-renal-function-and-reduce-fatigue-in-an-elderly-patient-with-chronic-comorbidities-a-case-report-pmid-39740897" },
      { n: 5, citation: "Viana J, Castro C, Leiva V. Molecular hydrogen and kidney diseases: a scoping review based on scientometry and data analytics. Medical Gas Research. 2025 (issue 2026;16(2):161-168).", pmid: "40826940", doi: "10.4103/mgr.MEDGASRES-D-25-00047", ourStudyPath: "/study/molecular-hydrogen-and-kidney-diseases-a-scoping-review-based-on-scientometry-and-data-analytics-pmid-40826940" },
      { n: 6, citation: "Yin Y, Wang J, Lian F, et al. Hydrogen-rich water combined with traditional Chinese medicine compound in the treatment of kidney stones: a randomized controlled prospective clinical trial. Medical Gas Research. 2026 (issue 17(1):63-69).", pmid: "42734448", doi: "10.4103/mgr.MEDGASRES-D-26-00067", ourStudyPath: null },
      { n: 7, citation: "Homma K, Yoshida T, Yamashita M, et al. Inhalation of hydrogen gas is beneficial for preventing contrast-induced acute kidney injury in rats. Nephron Experimental Nephrology. 2015.", pmid: "25592271", doi: "10.1159/000369068", ourStudyPath: "/study/inhalation-of-hydrogen-gas-is-beneficial-for-preventing-contrast-induced-acute-kidney-injury-in-rats-pmid-25592271" },
      { n: 8, citation: "Cardinal JS, Zhan J, Wang Y, et al. Oral hydrogen water prevents chronic allograft nephropathy in rats. Kidney International. 2010;77(2):101-9.", pmid: "19907413", doi: "10.1038/ki.2009.421", ourStudyPath: "/study/oral-hydrogen-water-prevents-chronic-allograft-nephropathy-in-rats-pmid-19907413" },
      { n: 9, citation: "Nakashima-Kamimura N, Mori T, Ohsawa I, Asoh S, Ohta S. Molecular hydrogen alleviates nephrotoxicity induced by an anti-cancer drug cisplatin without compromising anti-tumor activity in mice. Cancer Chemotherapy and Pharmacology. 2009;64(4):753-61.", pmid: "19148645", doi: "10.1007/s00280-008-0924-2", ourStudyPath: "/study/molecular-hydrogen-alleviates-nephrotoxicity-induced-by-anti-cancer-drug-cisplatin-without-compromising-anti-tumor-activity-in-mice-pmid-19148645" },
      { n: 10, citation: "Hosgood SA, Moore T, Qurashi M, Adams T, Nicholson ML. Hydrogen gas does not ameliorate renal ischemia reperfusion injury in a preclinical model. Artificial Organs. 2018;42(7):723-727.", pmid: "29611214", doi: "10.1111/aor.13118", ourStudyPath: "/study/hydrogen-gas-does-not-ameliorate-renal-ischemia-reperfusion-injury-in-a-preclinical-model-pmid-29611214" },
    ],
    ownerLink: { href: "/blog/is-hydrogen-water-good-for-kidneys", label: "Is hydrogen water good for your kidneys? Our full, evidence-graded guide" },
    bridgeTopic: null,
    lastReviewed: "2026-11-05",
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

## Does hydrogen reduce fatigue during exercise?

Slightly, in healthy adults. Pooled trials found that hydrogen made exercise feel a little easier and lowered blood lactate a little, but it didn't improve VO2max or endurance.

Most of the controlled trials are here. A [2023 meta-analysis](/study/effects-of-molecular-hydrogen-supplementation-on-fatigue-and-aerobic-capacity-in-healthy-adults-a-systematic-review-and-meta-analysis-pmid-36819697) pooled 19 randomized studies with 402 healthy adults. Hydrogen slightly lowered ratings of perceived effort and blood lactate, but it didn't change VO2max or endurance. A [2024 meta-analysis](/study/can-molecular-hydrogen-supplementation-enhance-physical-performance-in-healthy-adults-a-systematic-review-and-meta-analysis-pmid-38903627) of 27 publications and 597 adults found the same pattern, with no gain in strength. In one of the largest single studies, [99 untrained and 60 trained adults](/study/drinking-hydrogen-water-enhances-endurance-and-relieves-psychometric-fatigue-a-randomized-double-blind-placebo-controlled-study-pmid-31251888) drank 500 mL of hydrogen water (0.8–1.0 ppm) shortly before cycling and reported less fatigue. It drew a [published critique](/study/discussion-drinking-hydrogen-water-enhances-endurance-and-relieves-psychometric-fatigue-a-randomized-double-blind-placebo-controlled-study-pmid-34585956) from other researchers.

**Doses studied:** drinking water with 0.5–5.9 ppm hydrogen, or inhaled gas at 1–68% hydrogen, given as a single dose or daily for 2–14 days. In the 2023 analysis, perceived effort dropped after a single pre-exercise dose but not in the two studies that used several days of intake. The effect is on how tired people felt, not on how far or fast they went. See the [exercise fatigue section of our benefits guide](/blog/molecular-hydrogen-benefits-guide-pillar#does-hydrogen-water-reduce-exercise-fatigue) and our [exercise recovery hub](/explore-by-condition/exercise-recovery).

## Does hydrogen help ME/CFS (chronic fatigue syndrome)?

It hasn't been shown to. The only placebo-controlled pilot trial found no benefit, and the positive reports are case reports without a comparison group.

There is no large trial. A [2026 review](/study/molecular-hydrogen-as-a-treatment-for-mecfs-a-mini-review-of-clinical-evidence-and-mechanistic-rationale-pmid-41930109), written in part by the team that ran them, describes three small pilot trials of hydrogen-rich water made from tablets. The only one with a placebo group (4 weeks, about 12 mg of hydrogen a day) found no benefit, and about half of participants had temporary moderate-to-severe side effects such as headaches and stomach upset. Two later trials without a placebo group, lasting 8 and 16 weeks, reported improvements in self-rated fatigue and physical function. We couldn't find those trials indexed in PubMed.

Separately, [four case reports](/study/successful-treatment-of-myalgic-encephalomyelitischronic-fatigue-syndrome-using-hydrogen-gas-four-case-reports-pmid-37929512) described symptom relief in people with ME/CFS who inhaled hydrogen gas for 3–6 hours a day over 8–20 weeks. There was no comparison group, and four of the five authors work for the company that makes the inhaler used.

## Does hydrogen help fatigue from long COVID, cancer or dialysis?

Not clearly. In the two randomized trials, fatigue on the main measure didn't differ from placebo or plain water; the more positive reports had no comparison group.

- **Long COVID.** In a [single-blind trial](/study/the-effect-of-14-day-consumption-of-hydrogen-rich-water-alleviates-fatigue-but-does-not-ameliorate-dyspnea-in-long-covid-patients-a-pilot-single-blind-and-randomized-controlled-trial-pmid-38794767), 32 adults still fatigued and breathless about a month after COVID-19 drank 1 liter a day of 1.6 ppm hydrogen-rich water or plain water for 14 days. The main analysis found no significant difference in fatigue between groups; a secondary analysis of percentage change favored hydrogen. Breathlessness didn't improve.
- **Cancer.** In a [randomized trial of 49 patients](/study/effects-of-drinking-hydrogen-rich-water-on-the-quality-of-life-of-patients-treated-with-radiotherapy-for-liver-tumors-pmid-22146004) having radiotherapy for liver tumors, 6 weeks of hydrogen-rich water (about 1.1–1.3 ppm, 1.5–2 liters a day) improved overall quality-of-life scores, but fatigue scores didn't differ from placebo. An [uncontrolled report of 82 people with advanced cancer](/study/real-world-survey-of-hydrogen-controlled-cancer-a-follow-up-report-of-82-advanced-cancer-patients-pmid-31552873) who inhaled hydrogen described less fatigue, with no comparison group.
- **Dialysis.** In [81 hemodialysis patients](/study/hemodialysis-employing-molecular-hydrogen-h2-enriched-dialysis-solution-may-improve-dialysis-related-fatigue-through-impact-on-energy-metabolism-pmid-39934143), fatigue fell among the most fatigued after 12 months of hydrogen-enriched dialysis fluid, with no control group. See our [kidney health hub](/explore-by-condition/kidney-health).

## What do animal studies suggest (not human evidence)?

Only that mice given hydrogen water coped better with repeated exhausting exercise.

[Mice forced to swim every day for 4 weeks](/study/hydrogen-water-drinking-exerts-antifatigue-effects-in-chronic-forced-swimming-mice-via-antioxidative-and-anti-inflammatory-activities-pmid-29850492) swam longer and had lower lactate and inflammation markers when they drank hydrogen water. That models repeated exhausting exercise, not the illness-related fatigue of ME/CFS.

## What don't we know yet?

Whether hydrogen helps any illness-related fatigue is still open, because no large, double-blind, placebo-controlled trial has been done. So is whether the small effect on exercise effort matters outside the lab.

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
      { n: 1, citation: "Zhou K, Liu M, Wang Y, et al. Effects of molecular hydrogen supplementation on fatigue and aerobic capacity in healthy adults: a systematic review and meta-analysis. Frontiers in Nutrition. 2023;10:1094767.", pmid: "36819697", doi: "10.3389/fnut.2023.1094767", ourStudyPath: "/study/effects-of-molecular-hydrogen-supplementation-on-fatigue-and-aerobic-capacity-in-healthy-adults-a-systematic-review-and-meta-analysis-pmid-36819697" },
      { n: 2, citation: "Zhou K, Shang Z, Yuan C, et al. Can molecular hydrogen supplementation enhance physical performance in healthy adults? A systematic review and meta-analysis. Frontiers in Nutrition. 2024;11:1387657.", pmid: "38903627", doi: "10.3389/fnut.2024.1387657", ourStudyPath: "/study/can-molecular-hydrogen-supplementation-enhance-physical-performance-in-healthy-adults-a-systematic-review-and-meta-analysis-pmid-38903627" },
      { n: 3, citation: "Mikami T, Tano K, Lee H, et al. Drinking hydrogen water enhances endurance and relieves psychometric fatigue: a randomized, double-blind, placebo-controlled study. Canadian Journal of Physiology and Pharmacology. 2019;97(9):857-862.", pmid: "31251888", doi: "10.1139/cjpp-2019-0059", ourStudyPath: "/study/drinking-hydrogen-water-enhances-endurance-and-relieves-psychometric-fatigue-a-randomized-double-blind-placebo-controlled-study-pmid-31251888" },
      { n: 4, citation: "Falster C, Korfitzen S, Herold M, Lindebjerg J, Elsøe M. Discussion: Drinking hydrogen water enhances endurance and relieves psychometric fatigue: a randomized, double-blind, placebo-controlled study. Canadian Journal of Physiology and Pharmacology. 2021;99(10):1114-1115.", pmid: "34585956", doi: "10.1139/cjpp-2021-0031", ourStudyPath: "/study/discussion-drinking-hydrogen-water-enhances-endurance-and-relieves-psychometric-fatigue-a-randomized-double-blind-placebo-controlled-study-pmid-34585956" },
      { n: 5, citation: "Friedberg F, LeBaron TW. Molecular hydrogen as a treatment for ME/CFS: a mini-review of clinical evidence and mechanistic rationale. Frontiers in Medicine. 2026;13:1760210.", pmid: "41930109", doi: "10.3389/fmed.2026.1760210", ourStudyPath: "/study/molecular-hydrogen-as-a-treatment-for-mecfs-a-mini-review-of-clinical-evidence-and-mechanistic-rationale-pmid-41930109" },
      { n: 6, citation: "Hirano SI, Ichikawa Y, Sato B, Takefuji Y, Satoh F. Successful treatment of myalgic encephalomyelitis/chronic fatigue syndrome using hydrogen gas: four case reports. Medical Gas Research. 2024;14(2):84-86.", pmid: "37929512", doi: "10.4103/2045-9912.385441", ourStudyPath: "/study/successful-treatment-of-myalgic-encephalomyelitischronic-fatigue-syndrome-using-hydrogen-gas-four-case-reports-pmid-37929512" },
      { n: 7, citation: "Tan Y, Xie Y, Dong G, et al. The effect of 14-day consumption of hydrogen-rich water alleviates fatigue but does not ameliorate dyspnea in long-COVID patients: a pilot, single-blind, and randomized, controlled trial. Nutrients. 2024;16(10):1529.", pmid: "38794767", doi: "10.3390/nu16101529", ourStudyPath: "/study/the-effect-of-14-day-consumption-of-hydrogen-rich-water-alleviates-fatigue-but-does-not-ameliorate-dyspnea-in-long-covid-patients-a-pilot-single-blind-and-randomized-controlled-trial-pmid-38794767" },
      { n: 8, citation: "Kang KM, Kang YN, Choi IB, et al. Effects of drinking hydrogen-rich water on the quality of life of patients treated with radiotherapy for liver tumors. Medical Gas Research. 2011;1(1):11.", pmid: "22146004", doi: "10.1186/2045-9912-1-11", ourStudyPath: "/study/effects-of-drinking-hydrogen-rich-water-on-the-quality-of-life-of-patients-treated-with-radiotherapy-for-liver-tumors-pmid-22146004" },
      { n: 9, citation: "Chen JB, Kong XF, Lv YY, et al. \"Real world survey\" of hydrogen-controlled cancer: a follow-up report of 82 advanced cancer patients. Medical Gas Research. 2019;9(3):115-121.", pmid: "31552873", doi: "10.4103/2045-9912.266985", ourStudyPath: "/study/real-world-survey-of-hydrogen-controlled-cancer-a-follow-up-report-of-82-advanced-cancer-patients-pmid-31552873" },
      { n: 10, citation: "Nakayama M, Watanabe K, Sato E, et al. Hemodialysis employing molecular hydrogen (H2) enriched dialysis solution may improve dialysis related fatigue through impact on energy metabolism. Scientific Reports. 2025;15(1):5039.", pmid: "39934143", doi: "10.1038/s41598-025-88827-2", ourStudyPath: "/study/hemodialysis-employing-molecular-hydrogen-h2-enriched-dialysis-solution-may-improve-dialysis-related-fatigue-through-impact-on-energy-metabolism-pmid-39934143" },
      { n: 11, citation: "Ara J, Fadriquela A, Ahmed MF, et al. Hydrogen water drinking exerts antifatigue effects in chronic forced swimming mice via antioxidative and anti-inflammatory activities. BioMed Research International. 2018;2018:2571269.", pmid: "29850492", doi: "10.1155/2018/2571269", ourStudyPath: "/study/hydrogen-water-drinking-exerts-antifatigue-effects-in-chronic-forced-swimming-mice-via-antioxidative-and-anti-inflammatory-activities-pmid-29850492" },
    ],
    ownerLink: { href: "/blog/molecular-hydrogen-benefits-guide-pillar#does-hydrogen-water-reduce-exercise-fatigue", label: "Does hydrogen water reduce exercise fatigue? From our evidence-graded benefits guide" },
    bridgeTopic: null,
    lastReviewed: "2026-11-05",
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

## What have human trials found?

Mixed results from small, short trials. Some found less soreness or lower muscle-damage markers after hard exercise with hydrogen water, a hydrogen bath or inhaled hydrogen; others found no difference.

Most recovery trials were crossover studies, in which the same people tried hydrogen and a look-alike placebo on different occasions.

**Drinking hydrogen water**

- In 12 young men doing a leg workout, drinking 1,260 mL of hydrogen-rich water before, during and after the session lowered blood lactate during exercise. Soreness 24 hours later was 26 versus 41 on a 100-point scale [[3]](/study/hydrogen-rich-water-consumption-positively-affects-muscle-performance-lactate-response-and-alleviates-delayed-onset-of-muscle-soreness-after-resistance-training-pmid-33555824).
- In 12 elite fin swimmers doing two hard sessions in one day, four days of hydrogen water was followed 12 hours later by lower creatine kinase (a blood marker of muscle damage), slightly less soreness and slightly higher jumps [[4]](/study/hydrogen-rich-water-supplementation-promotes-muscle-recovery-after-two-strenuous-training-sessions-performed-on-the-same-day-in-elite-fin-swimmers-randomized-double-blind-placebo-controlled-crossover-trial-pmid-38681143).
- In 18 trained men, eight days of hydrogen water (about 1.9 L a day) let them complete more squat repetitions, but soreness, jump height and perceived recovery at 24 and 48 hours didn't differ from placebo [[5]](/study/effects-of-8-days-intake-of-hydrogen-rich-water-on-muscular-endurance-performance-and-fatigue-recovery-during-resistance-training-pmid-39434721).
- In 27 previously untrained adults over 50 starting resistance training, six weeks of hydrogen water (12 mg of hydrogen per serving, twice a day) lowered blood markers of muscle damage more than placebo water. Strength improved in both groups, and sleep quality tended to improve more with hydrogen, but not significantly [[9]](/study/the-effects-of-drinking-hydrogen-rich-water-for-six-weeks-on-exercise-related-biomarkers-in-exercise-naive-men-and-women-over-50-years-following-resistance-training-program-a-randomized-controlled-pilot-trial-pmid-40525414).

**Hydrogen baths**

- Six young men who soaked for 30 minutes in a hydrogen-rich bath (about 8 mg per liter) right after damaging leg exercise had no rise in creatine kinase at 24 hours and reported less soreness than after a plain bath [[6]](/study/the-effects-of-supersaturated-hydrogen-rich-water-bathing-on-biomarkers-of-muscular-damage-and-soreness-perception-in-young-men-subjected-to-high-intensity-eccentric-exercise-pmid-33123594).
- In nine men, daily 20-minute hydrogen baths for a week after downhill running had no effect on soreness, muscle damage or inflammation [[7]](/study/involvement-of-neutrophil-dynamics-and-function-in-exercise-induced-muscle-damage-and-delayed-onset-muscle-soreness-effect-of-hydrogen-bath-pmid-30257503).

**Inhaled hydrogen**

- Eight men who breathed hydrogen-enriched air (up to about 4% hydrogen) through a nasal tube for an hour after exercise lost less jump height and had less of a urine marker of DNA oxidation. Blood markers of muscle damage and oxidative stress didn't differ [[8]](/study/impact-of-hydrogen-rich-gas-mixture-inhalation-through-nasal-cannula-during-post-exercise-recovery-period-on-subsequent-oxidative-stress-muscle-damage-and-exercise-performances-in-men-pmid-33380581).

**Pooled results.** A 2024 meta-analysis of six studies (76 people) found hydrogen didn't lower a standard blood marker of oxidative stress after exercise, though antioxidant capacity rose slightly [[2]](/study/can-molecular-hydrogen-supplementation-reduce-exercise-induced-oxidative-stress-in-healthy-adults-a-systematic-review-and-meta-analysis-pmid-38590828). Another pooled 27 publications (597 healthy adults): exercise felt slightly easier and blood lactate was slightly lower, but endurance and strength didn't improve [[1]](/study/can-molecular-hydrogen-supplementation-enhance-physical-performance-in-healthy-adults-a-systematic-review-and-meta-analysis-pmid-38903627). We found no meta-analysis pooling soreness or creatine kinase.

## What do animal studies suggest (not human evidence)?

In rats and mice, hydrogen reduced muscle damage and oxidative stress from exhausting exercise. These point to possible mechanisms; they don't show the same happens in people.

Rats that inhaled hydrogen while running to exhaustion had lower muscle markers of oxidative stress, inflammation and cell death [[10]](/study/molecular-hydrogen-downregulates-acute-exhaustive-exercise-induced-skeletal-muscle-damage-pmid-33356867). Mice that drank hydrogen water for four weeks or more ran farther and had fewer signs of muscle damage [[11]](/study/hydrogen-rich-water-improves-endurance-by-reducing-skeletal-muscle-oxidative-stress-and-inflammatory-responses-pmid-41641160).

## What doses and durations were studied?

No standard dose exists, and no trial compared doses or timing. Drinking trials used water with 0.5 to 5.9 ppm hydrogen, for one day to six weeks.

- **Drinking:** 0.5 to 5.9 ppm in the pooled trials [1]; about 1.3 to 2.5 L on test days [3][4]; from one day to six weeks.
- **Bathing:** one 30-minute bath [6] to a week of daily 20-minute baths [7].
- **Inhaling:** 1% to 68% hydrogen across trials [1]; one hour after exercise in the recovery trial [8].

## What don't we know yet?

Whether the small effects matter, whether they apply beyond young and middle-aged men, and whether they hold up in larger, independent trials.

- **Whether the effect matters.** Soreness differences were about 8 to 15 points on a 100-point scale [3][4].
- **Who it applies to.** Most participants were young or middle-aged men [1].
- **Longer use.** Most trials lasted 1 to 14 days [1]; the longest recovery trial lasted six weeks [9].
- **Sleep between sessions.** Only one trial measured sleep, without a significant difference [9].
- **Independent replication.** All five positive trials above come from two university labs (Olomouc, Czechia and Novi Sad, Serbia) or list company-affiliated authors [3][4][6][8][9].
- **Larger trials.** A double-blind trial of hydrogen water and 72-hour recovery in junior footballers has published its protocol; results weren't available when we reviewed this page [[12]](/study/hydrogen-rich-water-consumption-for-acute-and-residual-fatigue-after-simulated-football-matches-protocol-for-a-randomized-double-blinded-placebo-controlled-parallel-trial-pmid-40694834).`,
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
      { n: 1, citation: "Zhou K, et al. Can molecular hydrogen supplementation enhance physical performance in healthy adults? A systematic review and meta-analysis. Front Nutr. 2024;11:1387657.", pmid: "38903627", doi: "10.3389/fnut.2024.1387657", ourStudyPath: "/study/can-molecular-hydrogen-supplementation-enhance-physical-performance-in-healthy-adults-a-systematic-review-and-meta-analysis-pmid-38903627" },
      { n: 2, citation: "Li Y, et al. Can molecular hydrogen supplementation reduce exercise-induced oxidative stress in healthy adults? A systematic review and meta-analysis. Front Nutr. 2024;11:1328705.", pmid: "38590828", doi: "10.3389/fnut.2024.1328705", ourStudyPath: "/study/can-molecular-hydrogen-supplementation-reduce-exercise-induced-oxidative-stress-in-healthy-adults-a-systematic-review-and-meta-analysis-pmid-38590828" },
      { n: 3, citation: "Botek M, et al. Hydrogen rich water consumption positively affects muscle performance, lactate response, and alleviates delayed onset of muscle soreness after resistance training. J Strength Cond Res. 2022;36(10):2792-2799.", pmid: "33555824", doi: "10.1519/JSC.0000000000003979", ourStudyPath: "/study/hydrogen-rich-water-consumption-positively-affects-muscle-performance-lactate-response-and-alleviates-delayed-onset-of-muscle-soreness-after-resistance-training-pmid-33555824" },
      { n: 4, citation: "Sládečková B, et al. Hydrogen-rich water supplementation promotes muscle recovery after two strenuous training sessions performed on the same day in elite fin swimmers: randomized, double-blind, placebo-controlled, crossover trial. Front Physiol. 2024;15:1321160.", pmid: "38681143", doi: "10.3389/fphys.2024.1321160", ourStudyPath: "/study/hydrogen-rich-water-supplementation-promotes-muscle-recovery-after-two-strenuous-training-sessions-performed-on-the-same-day-in-elite-fin-swimmers-randomized-double-blind-placebo-controlled-crossover-trial-pmid-38681143" },
      { n: 5, citation: "Zhou K, et al. Effects of 8 days intake of hydrogen-rich water on muscular endurance performance and fatigue recovery during resistance training. Front Physiol. 2024;15:1458882.", pmid: "39434721", doi: "10.3389/fphys.2024.1458882", ourStudyPath: "/study/effects-of-8-days-intake-of-hydrogen-rich-water-on-muscular-endurance-performance-and-fatigue-recovery-during-resistance-training-pmid-39434721" },
      { n: 6, citation: "Todorovic N, et al. The effects of supersaturated hydrogen-rich water bathing on biomarkers of muscular damage and soreness perception in young men subjected to high-intensity eccentric exercise. J Sports Med (Hindawi Publ Corp). 2020;2020:8836070.", pmid: "33123594", doi: "10.1155/2020/8836070", ourStudyPath: "/study/the-effects-of-supersaturated-hydrogen-rich-water-bathing-on-biomarkers-of-muscular-damage-and-soreness-perception-in-young-men-subjected-to-high-intensity-eccentric-exercise-pmid-33123594" },
      { n: 7, citation: "Kawamura T, et al. Involvement of neutrophil dynamics and function in exercise-induced muscle damage and delayed-onset muscle soreness: effect of hydrogen bath. Antioxidants (Basel). 2018;7(10):127.", pmid: "30257503", doi: "10.3390/antiox7100127", ourStudyPath: "/study/involvement-of-neutrophil-dynamics-and-function-in-exercise-induced-muscle-damage-and-delayed-onset-muscle-soreness-effect-of-hydrogen-bath-pmid-30257503" },
      { n: 8, citation: "Shibayama Y, et al. Impact of hydrogen-rich gas mixture inhalation through nasal cannula during post-exercise recovery period on subsequent oxidative stress, muscle damage, and exercise performances in men. Med Gas Res. 2020;10(4):155-162.", pmid: "33380581", doi: "10.4103/2045-9912.304222", ourStudyPath: "/study/impact-of-hydrogen-rich-gas-mixture-inhalation-through-nasal-cannula-during-post-exercise-recovery-period-on-subsequent-oxidative-stress-muscle-damage-and-exercise-performances-in-men-pmid-33380581" },
      { n: 9, citation: "Kuzmanovic J, et al. The effects of drinking hydrogen-rich water for six weeks on exercise-related biomarkers in exercise-naïve men and women over 50 years following resistance training program: a randomized controlled pilot trial. Res Sports Med. 2025;33(6):711-721.", pmid: "40525414", doi: "10.1080/15438627.2025.2521474", ourStudyPath: "/study/the-effects-of-drinking-hydrogen-rich-water-for-six-weeks-on-exercise-related-biomarkers-in-exercise-naive-men-and-women-over-50-years-following-resistance-training-program-a-randomized-controlled-pilot-trial-pmid-40525414" },
      { n: 10, citation: "Nogueira JE, et al. Molecular hydrogen downregulates acute exhaustive exercise-induced skeletal muscle damage. Can J Physiol Pharmacol. 2021;99(8):812-820.", pmid: "33356867", doi: "10.1139/cjpp-2020-0297", ourStudyPath: "/study/molecular-hydrogen-downregulates-acute-exhaustive-exercise-induced-skeletal-muscle-damage-pmid-33356867" },
      { n: 11, citation: "Mizuno E, et al. Hydrogen-rich water improves endurance by reducing skeletal muscle oxidative stress and inflammatory responses. Front Nutr. 2026;13:1722091.", pmid: "41641160", doi: "10.3389/fnut.2026.1722091", ourStudyPath: "/study/hydrogen-rich-water-improves-endurance-by-reducing-skeletal-muscle-oxidative-stress-and-inflammatory-responses-pmid-41641160" },
      { n: 12, citation: "Hruby M, et al. Hydrogen-rich water consumption for acute and residual fatigue after simulated football matches: protocol for a randomized, double-blinded, placebo-controlled, parallel trial. JMIR Res Protoc. 2025;14:e69744.", pmid: "40694834", doi: "10.2196/69744", ourStudyPath: "/study/hydrogen-rich-water-consumption-for-acute-and-residual-fatigue-after-simulated-football-matches-protocol-for-a-randomized-double-blinded-placebo-controlled-parallel-trial-pmid-40694834" },
    ],
    ownerLink: { href: "/blog/molecular-hydrogen-benefits-guide-pillar", label: "Hydrogen water benefits, graded by evidence" },
    bridgeTopic: null,
    lastReviewed: "2026-11-05",
  },
  "athletic-performance": {
    slug: "athletic-performance",
    h1: "Hydrogen Water and Athletic Performance: What the Studies Show",
    metaTitle: "Hydrogen Water and Athletic Performance | Hydrogen Studies",
    metaDescription:
      "Does hydrogen water improve speed, power or endurance? Pooled trials found exercise felt slightly easier, not better endurance. Graded, with doses studied.",
    evidenceGrade: "low",
    introMarkdown: `*Hydrogen Studies is funded by Echo Technologies LLC, which sells hydrogen water products. Echo doesn't decide which studies we cover or how we describe them — see our [editorial policy](/editorial-policy).*

**Evidence at a glance: Low.** Two meta-analyses of small randomized trials in healthy adults found that hydrogen made exercise feel slightly easier and lowered blood lactate a little, but didn't improve VO2max, endurance or strength. Individual trials disagree: some found small gains in sprint or race performance, and others in trained runners found none. Most lasted from a single session to two weeks.

This page is about performance during exercise: speed, power and endurance. For soreness and muscle damage afterwards, see our [exercise recovery hub](/explore-by-condition/exercise-recovery). Of the 23 human studies in our database tagged athletic or exercise performance, 13 reported an improvement in their main outcome, 7 had mixed results and 3 found no clear effect. Most were small, and an improvement in one small trial isn't the same as a confirmed effect.

## What have pooled trials found?

Small effects on how hard exercise feels, not on how far or fast people go.

- **2024: 27 publications, 597 healthy adults.** Compared with placebo, hydrogen, whether drunk, inhaled, bathed in or swallowed as a powder, slightly lowered ratings of perceived effort and blood lactate. VO2max, endurance and muscle strength didn't improve; the one performance gain was small, in jumping power [[1]](/study/can-molecular-hydrogen-supplementation-enhance-physical-performance-in-healthy-adults-a-systematic-review-and-meta-analysis-pmid-38903627).
- **2023: 19 randomized studies, 402 healthy adults.** Hydrogen slightly lowered perceived effort and blood lactate but didn't change VO2max or endurance. Perceived effort dropped after a single dose before exercise, but not in the two studies that used several days of intake [[2]](/study/effects-of-molecular-hydrogen-supplementation-on-fatigue-and-aerobic-capacity-in-healthy-adults-a-systematic-review-and-meta-analysis-pmid-36819697).

## What have individual trials found?

Some small trials found modest gains, mostly late in repeated sprints or in particular groups of athletes; others found none. The trials below had 8 to 37 participants each.

**Trials reporting a gain**

- In 8 trained male cyclists, two weeks of 2 liters a day of hydrogen-rich water (about 0.45 ppm, and alkaline) stopped peak sprint power from falling late in a 30-minute intermittent cycling test, as it did with placebo water. Mean power, fatigue and total work didn't differ. The trial was single-blind [[3]](/study/effects-of-hydrogen-rich-water-on-prolonged-intermittent-exercise-pmid-28474871).
- In 16 professional soccer players, hydrogen-rich water before 15 repeated 30 m sprints made the last sprints 2% to 3% faster than placebo water. Blood lactate and perceived effort didn't differ [[4]](/study/molecular-hydrogen-mitigates-performance-decrement-during-repeated-sprints-in-professional-soccer-players-pmid-35276867).
- In 37 adults, a week of hydrogen-rich water (1.9 ppm) raised peak and mean power in a short all-out cycling test in trained cyclists, but not in untrained people [[5]](/study/effects-of-7-day-intake-of-hydrogen-rich-water-on-physical-performance-of-trained-and-untrained-subjects-pmid-34079172).
- In 12 national-level finswimmers, 4 days of hydrogen-rich water (0.9 ppm, about 1.3 to 1.7 liters a day) improved a 400 m time trial by 0.6%, but not 50 m sprint times. Lactate, perceived effort and an oxidative-stress marker didn't differ [[6]](/study/hydrogen-rich-water-as-a-performance-enhancing-aid-in-national-level-finswimmers-a-randomized-double-blind-placebo-controlled-crossover-study-pmid-41991147).
- In 20 young adults, breathing 4% hydrogen for 20 minutes a day for 7 days raised peak running speed by up to 4.2% compared with air, at the edge of statistical significance (p = 0.05) [[7]](/study/short-term-h2-inhalation-improves-running-performance-and-torso-strength-in-healthy-adults-pmid-31938004).
- In healthy adults, 500 mL of hydrogen water on each weekday for two weeks raised peak oxygen uptake in a cycling test; a single drink didn't. The trial was single-blind, and two authors work for a company that makes hydrogen generators [[8]](/study/two-week-continuous-supplementation-of-hydrogen-rich-water-increases-peak-oxygen-uptake-during-an-incremental-cycling-exercise-test-in-healthy-humans-a-randomized-single-blinded-placebo-controlled-study-pmid-33380582).

**Trials finding no clear effect**

- In 14 endurance-trained runners, two 290 mL drinks of hydrogen-rich water before a treadmill test didn't change time to exhaustion, VO2max, heart rate or perceived effort [[9]](/study/acute-ingestion-of-hydrogen-rich-water-does-not-improve-incremental-treadmill-running-performance-in-endurance-trained-athletes-pmid-31675478).
- In 24 trained track and field runners, 1,260 mL over the 2 hours before a run at maximal aerobic speed didn't change time to exhaustion or blood lactate [[10]](/study/acute-pre-exercise-hydrogen-rich-water-intake-does-not-improve-running-performance-at-maximal-aerobic-speed-in-trained-track-and-field-runners-a-randomized-double-blind-placebo-controlled-crossover-study-pmid-36538554).
- In 16 runners, hydrogen-rich water before a 4.2 km uphill race had an unclear effect on race time overall. The 4 slowest runners appeared to benefit; the 4 fastest didn't [[11]](/study/hydrogen-rich-water-supplementation-and-up-hill-running-performance-effect-of-athlete-performance-level-pmid-32045879).

## What do animal studies suggest (not human evidence)?

In rodents, hydrogen reduced muscle damage from exhausting exercise, and mice that drank it for weeks ran farther. Animal results like these don't show the same happens in people.

Rats that inhaled hydrogen while running to exhaustion had lower muscle markers of oxidative stress, inflammation and cell death [[12]](/study/molecular-hydrogen-downregulates-acute-exhaustive-exercise-induced-skeletal-muscle-damage-pmid-33356867). Mice that drank hydrogen water for four weeks or more ran farther and had fewer signs of muscle damage [[13]](/study/hydrogen-rich-water-improves-endurance-by-reducing-skeletal-muscle-oxidative-stress-and-inflammatory-responses-pmid-41641160).

## What doses and durations were studied?

No trial compared doses, so there is no evidence-based amount. Most trials gave hydrogen once before exercise or daily for up to two weeks.

- **Drinking:** 0.5 to 5.9 ppm in the pooled trials [1]; from two 290 mL drinks [9] to 2 liters a day [3].
- **Inhaling:** 1% to 68% hydrogen across trials [1]; 4% for 20 minutes a day for a week [7].
- **Timing:** single-dose trials gave the water in the 2 hours before exercise [9][10].

## What don't we know yet?

Whether the small effects make a difference in real competition, and whether they hold up in larger, independent trials.

- **Real-world size.** The gains reported were about 0.6% to 4%, often only late in a test [4][6][7].
- **Who it applies to.** Most participants were young men. Two trials suggest the effect may depend on fitness, in opposite directions [5][11].
- **Longer use.** Most trials lasted from one session to two weeks [1].
- **Independence.** Four of the trials above come from one university group in Olomouc, Czechia [4][6][10][11], and one had authors from a hydrogen-generator company [8].

*Drafted with AI assistance and checked against each linked source by our editorial team. General information, not medical advice.*`,
    faqs: [
      {
        question: "Does hydrogen water make you run faster or longer?",
        answer:
          "Not reliably. Pooled trials in healthy adults found no improvement in endurance or VO2max. A few small trials reported gains, such as a 0.6% faster 400 m swim or faster late sprints, but two trials in trained runners found no change in time to exhaustion. Most trials were small and lasted from one session to two weeks.",
      },
      {
        question: "Does hydrogen water improve sprint or power performance?",
        answer:
          "Possibly a little, in some trials. In 16 soccer players the last of 15 sprints were 2% to 3% faster, and in 8 trained cyclists peak power held up better late in repeated sprints. A pooled analysis found a small gain in jumping power but no change in muscle strength. These were small, short trials.",
      },
      {
        question: "Is inhaled hydrogen better than hydrogen water for performance?",
        answer:
          "No trial has compared them directly. In one 7-day trial of 20 young adults, breathing 4% hydrogen for 20 minutes a day raised peak running speed by up to 4%, at the edge of statistical significance. The pooled analyses included both routes and found small effects on perceived effort, not on endurance.",
      },
    ],
    sources: [
      { n: 1, citation: "Zhou K, et al. Can molecular hydrogen supplementation enhance physical performance in healthy adults? A systematic review and meta-analysis. Front Nutr. 2024;11:1387657.", pmid: "38903627", doi: "10.3389/fnut.2024.1387657", ourStudyPath: "/study/can-molecular-hydrogen-supplementation-enhance-physical-performance-in-healthy-adults-a-systematic-review-and-meta-analysis-pmid-38903627" },
      { n: 2, citation: "Zhou K, et al. Effects of molecular hydrogen supplementation on fatigue and aerobic capacity in healthy adults: a systematic review and meta-analysis. Front Nutr. 2023;10:1094767.", pmid: "36819697", doi: "10.3389/fnut.2023.1094767", ourStudyPath: "/study/effects-of-molecular-hydrogen-supplementation-on-fatigue-and-aerobic-capacity-in-healthy-adults-a-systematic-review-and-meta-analysis-pmid-36819697" },
      { n: 3, citation: "Da Ponte A, et al. Effects of hydrogen rich water on prolonged intermittent exercise. J Sports Med Phys Fitness. 2018;58(5):612-621.", pmid: "28474871", doi: "10.23736/S0022-4707.17.06883-9", ourStudyPath: "/study/effects-of-hydrogen-rich-water-on-prolonged-intermittent-exercise-pmid-28474871" },
      { n: 4, citation: "Botek M, et al. Molecular hydrogen mitigates performance decrement during repeated sprints in professional soccer players. Nutrients. 2022;14(3):508.", pmid: "35276867", doi: "10.3390/nu14030508", ourStudyPath: "/study/molecular-hydrogen-mitigates-performance-decrement-during-repeated-sprints-in-professional-soccer-players-pmid-35276867" },
      { n: 5, citation: "Timón R, et al. Effects of 7-day intake of hydrogen-rich water on physical performance of trained and untrained subjects. Biol Sport. 2021;38(2):269-275.", pmid: "34079172", doi: "10.5114/biolsport.2020.98625", ourStudyPath: "/study/effects-of-7-day-intake-of-hydrogen-rich-water-on-physical-performance-of-trained-and-untrained-subjects-pmid-34079172" },
      { n: 6, citation: "Sládečková B, et al. Hydrogen-rich water as a performance-enhancing aid in national-level finswimmers: a randomized, double-blind, placebo-controlled crossover study. Int J Sports Physiol Perform. 2026;21(7):824-830.", pmid: "41991147", doi: "10.1123/ijspp.2025-0492", ourStudyPath: "/study/hydrogen-rich-water-as-a-performance-enhancing-aid-in-national-level-finswimmers-a-randomized-double-blind-placebo-controlled-crossover-study-pmid-41991147" },
      { n: 7, citation: "Javorac D, et al. Short-term H2 inhalation improves running performance and torso strength in healthy adults. Biol Sport. 2019;36(4):333-339.", pmid: "31938004", doi: "10.5114/biolsport.2019.88756", ourStudyPath: "/study/short-term-h2-inhalation-improves-running-performance-and-torso-strength-in-healthy-adults-pmid-31938004" },
      { n: 8, citation: "Hori A, et al. Two-week continuous supplementation of hydrogen-rich water increases peak oxygen uptake during an incremental cycling exercise test in healthy humans: a randomized, single-blinded, placebo-controlled study. Med Gas Res. 2020;10(4):163-169.", pmid: "33380582", doi: "10.4103/2045-9912.304223", ourStudyPath: "/study/two-week-continuous-supplementation-of-hydrogen-rich-water-increases-peak-oxygen-uptake-during-an-incremental-cycling-exercise-test-in-healthy-humans-a-randomized-single-blinded-placebo-controlled-study-pmid-33380582" },
      { n: 9, citation: "Ooi CH, et al. Acute ingestion of hydrogen-rich water does not improve incremental treadmill running performance in endurance-trained athletes. Appl Physiol Nutr Metab. 2020;45(5):513-519.", pmid: "31675478", doi: "10.1139/apnm-2019-0553", ourStudyPath: "/study/acute-ingestion-of-hydrogen-rich-water-does-not-improve-incremental-treadmill-running-performance-in-endurance-trained-athletes-pmid-31675478" },
      { n: 10, citation: "Valenta M, et al. Acute pre-exercise hydrogen rich water intake does not improve running performance at maximal aerobic speed in trained track and field runners: a randomized, double-blind, placebo-controlled crossover study. PLoS One. 2022;17(12):e0279307.", pmid: "36538554", doi: "10.1371/journal.pone.0279307", ourStudyPath: "/study/acute-pre-exercise-hydrogen-rich-water-intake-does-not-improve-running-performance-at-maximal-aerobic-speed-in-trained-track-and-field-runners-a-randomized-double-blind-placebo-controlled-crossover-study-pmid-36538554" },
      { n: 11, citation: "Botek M, et al. Hydrogen-rich water supplementation and up-hill running performance: effect of athlete performance level. Int J Sports Physiol Perform. 2020;15(8):1193-1196.", pmid: "32045879", doi: "10.1123/ijspp.2019-0507", ourStudyPath: "/study/hydrogen-rich-water-supplementation-and-up-hill-running-performance-effect-of-athlete-performance-level-pmid-32045879" },
      { n: 12, citation: "Nogueira JE, et al. Molecular hydrogen downregulates acute exhaustive exercise-induced skeletal muscle damage. Can J Physiol Pharmacol. 2021;99(8):812-820.", pmid: "33356867", doi: "10.1139/cjpp-2020-0297", ourStudyPath: "/study/molecular-hydrogen-downregulates-acute-exhaustive-exercise-induced-skeletal-muscle-damage-pmid-33356867" },
      { n: 13, citation: "Mizuno E, et al. Hydrogen-rich water improves endurance by reducing skeletal muscle oxidative stress and inflammatory responses. Front Nutr. 2026;13:1722091.", pmid: "41641160", doi: "10.3389/fnut.2026.1722091", ourStudyPath: "/study/hydrogen-rich-water-improves-endurance-by-reducing-skeletal-muscle-oxidative-stress-and-inflammatory-responses-pmid-41641160" },
    ],
    ownerLink: { href: "/blog/molecular-hydrogen-benefits-guide-pillar#does-hydrogen-water-reduce-exercise-fatigue", label: "Does hydrogen water reduce exercise fatigue? From our evidence-graded benefits guide" },
    bridgeTopic: null,
    lastReviewed: "2026-11-05",
  },
  "oxidative-stress": {
    slug: "oxidative-stress",
    h1: "Hydrogen Water and Oxidative Stress: What the Studies Show",
    metaTitle: "Hydrogen Water and Oxidative Stress | Hydrogen Studies",
    metaDescription:
      "Is hydrogen water an antioxidant in people? Human trials of oxidative-stress markers are mixed, and one found more damage. Graded, with the doses studied.",
    evidenceGrade: "very low",
    introMarkdown: `*Hydrogen Studies is funded by Echo Technologies LLC, which sells hydrogen water products. Echo doesn't decide which studies we cover or how we describe them — see our [editorial policy](/editorial-policy).*

**Evidence at a glance: Very low.** "Antioxidant" is the most-marketed benefit of hydrogen, and one of the least consistent in human trials. In a double-blind trial in healthy adults, the main blood markers of oxidative stress didn't differ from plain water. In a trial in people with chronic mountain sickness, hydrogen water raised a marker of oxidative damage. A meta-analysis of exercise studies found no drop in a standard oxidative-stress marker.

This page covers oxidative stress: the balance between reactive oxygen molecules and the body's antioxidant defenses, as measured by markers in blood and urine. Those markers aren't health outcomes in themselves. Of the 232 studies in our database tagged oxidative stress, 41 were in people. Of those 41, 25 reported an improvement in their main outcome, 8 had mixed results, 2 found no clear effect and the rest didn't report one; many were small, short or had no comparison group.

## Where does the antioxidant idea come from?

From a 2007 study in cells and rats. It reported that hydrogen reacted with the most damaging oxygen radicals, such as the hydroxyl radical, but not with the milder ones the body uses as signals, and that breathing hydrogen reduced brain damage in rats after a stroke-like injury [[7]](/study/hydrogen-acts-as-a-therapeutic-antioxidant-by-selectively-reducing-cytotoxic-oxygen-radicals-pmid-17486089).

That "selective antioxidant" idea underlies most hydrogen research since; a 2012 review traces how hydrogen went from being considered biologically inert to being studied as an antioxidant [[8]](/study/hydrogen-from-a-biologically-inert-gas-to-a-unique-antioxidant-doi-10-5772-34908). It hasn't been confirmed as the way hydrogen acts in people.

## What have human trials found?

Mixed results. Blood markers improved in some trials and not in others, and in one trial a marker of oxidative damage went up.

- **38 healthy adults, 4 weeks (double-blind).** 1.5 liters a day of hydrogen water didn't change the main blood markers of oxidative stress or antioxidant capacity compared with plain water. Antioxidant capacity rose more in participants aged 30 and over, and their blood immune cells showed less cell death and lower activity in inflammation-related genes [[2]](/study/hydrogen-rich-water-reduces-inflammatory-responses-and-prevents-apoptosis-of-peripheral-blood-cells-in-healthy-adults-a-randomized-double-blind-controlled-trial-pmid-32699287).
- **61 healthy workers, 8 weeks (double-blind).** 1.5 liters a day of electrolyzed reduced water lowered a blood marker of oxidative stress (d-ROMs) more than mineral water did [[3]](/study/outcomes-assessment-of-sustainable-and-innovatively-simple-lifestyle-modification-at-the-workplace-drinking-electrolyzed-reduced-water-oasis-erw-a-randomized-double-blind-placebo-controlled-trial-pmid-32605142).
- **59 adults with chronic mountain sickness, 8 weeks (blinded).** About 1 liter a day of hydrogen-rich water raised total antioxidant capacity but also raised malondialdehyde, a marker of oxidative damage, more so in people with a higher body mass index. The authors concluded it didn't reduce oxidative damage. Side effects, mostly dizziness, were reported by 50% of the hydrogen group and 37% of the placebo group [[4]](/study/does-hydrogen-rich-water-reduce-oxidative-stress-in-patients-with-chronic-mountain-sickness-a-randomized-blinded-controlled-trial-pmid-41371770).
- **40 physically active adults, 8 weeks.** After alkaline hydrogen-enriched water, an inflammation marker (IL-6) after a maximal exercise test was lower than in the control group. The groups differed at the start, which the authors said limits what the result means [[5]](/study/redox-water-consumption-attenuates-exercise-induced-inflammation-and-oxidative-stress-in-physically-active-adults-a-randomized-controlled-trial-pmid-41754211).
- **534 adults, observational.** People who had drunk electrolyzed hydrogen water for more than 6 months had lower d-ROMs than matched people who hadn't. People who choose a habit can differ in other ways, and two authors had funding from or worked for an electrolyzed-water device maker [[6]](/study/antioxidant-effects-of-continuous-intake-of-electrolyzed-hydrogen-water-in-healthy-adults-pmid-36468139).
- **After exercise (pooled).** A 2024 meta-analysis of 6 studies with 76 healthy adults found hydrogen didn't lower a standard blood marker of oxidative stress after exercise, though antioxidant capacity rose slightly [[1]](/study/can-molecular-hydrogen-supplementation-reduce-exercise-induced-oxidative-stress-in-healthy-adults-a-systematic-review-and-meta-analysis-pmid-38590828).

## What do cell and animal studies suggest (not human evidence)?

Most of the oxidative-stress studies we index were done in cells or animals, often after sudden, severe injuries, and hydrogen often reduced markers of oxidative damage in them. Those models don't show that drinking hydrogen water changes oxidative stress in healthy people, and an antioxidant effect in a lab dish doesn't guarantee one in a person [7].

## What doses and durations were studied?

No trial compared doses. The drinking trials gave about 1 to 1.5 liters a day for 4 to 8 weeks [2][3][4][5].

## What don't we know yet?

Whether changes in these markers mean anything for health, and why the trials disagree.

- **Markers versus outcomes.** None of the trials above linked a change in an oxidative-stress marker to a health outcome.
- **Hydrogen or alkalinity?** Two trials used alkaline electrolyzed water, which differs from plain water in pH as well as hydrogen [3][5].
- **Possible harm.** In one trial, a marker of oxidative damage rose with hydrogen water [4].
- **Independence.** One study's authors had funding from or worked for a device maker [6].

*Drafted with AI assistance and checked against each linked source by our editorial team. General information, not medical advice.*`,
    faqs: [
      {
        question: "Is hydrogen water an antioxidant?",
        answer:
          "In cells and animals it acts like one, but human trials are inconsistent. In 38 healthy adults, 4 weeks of hydrogen water didn't change the main blood markers of oxidative stress. In 61 healthy workers, 8 weeks of electrolyzed reduced water lowered one marker. In 59 people with chronic mountain sickness, a marker of oxidative damage rose. No trial has shown a health benefit from these changes.",
      },
      {
        question: "Does hydrogen water reduce oxidative stress from exercise?",
        answer:
          "Not clearly. A 2024 meta-analysis of 6 studies with 76 healthy adults found that hydrogen didn't lower a standard blood marker of oxidative stress after exercise, though antioxidant capacity rose slightly. Some small trials found lower markers after hard exercise, but many had no proper comparison group.",
      },
      {
        question: "What is a selective antioxidant?",
        answer:
          "It's the idea, from a 2007 study in cells and rats, that hydrogen reacts with the most damaging oxygen radicals, such as the hydroxyl radical, but leaves alone the milder ones the body uses as signals. The idea explains why hydrogen has been studied so much, but it hasn't been confirmed as the way hydrogen acts in people.",
      },
    ],
    sources: [
      { n: 1, citation: "Li Y, et al. Can molecular hydrogen supplementation reduce exercise-induced oxidative stress in healthy adults? A systematic review and meta-analysis. Front Nutr. 2024;11:1328705.", pmid: "38590828", doi: "10.3389/fnut.2024.1328705", ourStudyPath: "/study/can-molecular-hydrogen-supplementation-reduce-exercise-induced-oxidative-stress-in-healthy-adults-a-systematic-review-and-meta-analysis-pmid-38590828" },
      { n: 2, citation: "Sim M, et al. Hydrogen-rich water reduces inflammatory responses and prevents apoptosis of peripheral blood cells in healthy adults: a randomized, double-blind, controlled trial. Sci Rep. 2020;10(1):12130.", pmid: "32699287", doi: "10.1038/s41598-020-68930-2", ourStudyPath: "/study/hydrogen-rich-water-reduces-inflammatory-responses-and-prevents-apoptosis-of-peripheral-blood-cells-in-healthy-adults-a-randomized-double-blind-controlled-trial-pmid-32699287" },
      { n: 3, citation: "Choi YA, et al. Outcomes assessment of sustainable and innovatively simple lifestyle modification at the workplace — drinking electrolyzed-reduced water (OASIS-ERW): a randomized, double-blind, placebo-controlled trial. Antioxidants (Basel). 2020;9(7):564.", pmid: "32605142", doi: "10.3390/antiox9070564", ourStudyPath: "/study/outcomes-assessment-of-sustainable-and-innovatively-simple-lifestyle-modification-at-the-workplace-drinking-electrolyzed-reduced-water-oasis-erw-a-randomized-double-blind-placebo-controlled-trial-pmid-32605142" },
      { n: 4, citation: "Zhang F, et al. Does hydrogen-rich water reduce oxidative stress in patients with chronic mountain sickness? A randomized, blinded, controlled trial. High Alt Med Biol. 2026;27(3):133-142.", pmid: "41371770", doi: "10.1177/15578682251401137", ourStudyPath: "/study/does-hydrogen-rich-water-reduce-oxidative-stress-in-patients-with-chronic-mountain-sickness-a-randomized-blinded-controlled-trial-pmid-41371770" },
      { n: 5, citation: "Stolecka-Warzecha A, et al. Redox water consumption attenuates exercise-induced inflammation and oxidative stress in physically active adults: a randomized controlled trial. Nutrients. 2026;18(4):694.", pmid: "41754211", doi: "10.3390/nu18040694", ourStudyPath: "/study/redox-water-consumption-attenuates-exercise-induced-inflammation-and-oxidative-stress-in-physically-active-adults-a-randomized-controlled-trial-pmid-41754211" },
      { n: 6, citation: "Mizuno K, et al. Antioxidant effects of continuous intake of electrolyzed hydrogen water in healthy adults. Heliyon. 2022;8(11):e11853.", pmid: "36468139", doi: "10.1016/j.heliyon.2022.e11853", ourStudyPath: "/study/antioxidant-effects-of-continuous-intake-of-electrolyzed-hydrogen-water-in-healthy-adults-pmid-36468139" },
      { n: 7, citation: "Ohsawa I, et al. Hydrogen acts as a therapeutic antioxidant by selectively reducing cytotoxic oxygen radicals. Nat Med. 2007;13(6):688-694.", pmid: "17486089", doi: "10.1038/nm1577", ourStudyPath: "/study/hydrogen-acts-as-a-therapeutic-antioxidant-by-selectively-reducing-cytotoxic-oxygen-radicals-pmid-17486089" },
      { n: 8, citation: "Liu SL, Sun XJ, Tao HY. Hydrogen: from a biologically inert gas to a unique antioxidant. In: Oxidative Stress — Molecular Mechanisms and Biological Effects. InTech; 2012.", pmid: null, doi: "10.5772/34908", ourStudyPath: "/study/hydrogen-from-a-biologically-inert-gas-to-a-unique-antioxidant-doi-10-5772-34908" },
    ],
    ownerLink: { href: "/blog/molecular-hydrogen-benefits-guide-pillar#is-hydrogen-water-an-antioxidant-in-people", label: "Is hydrogen water an antioxidant in people? From our evidence-graded benefits guide" },
    bridgeTopic: null,
    lastReviewed: "2026-11-05",
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

## Does drinking hydrogen water improve skin?

Not in the one randomized controlled trial that measured facial skin.

In the only randomized controlled trial we found that measured facial skin, 40 adults aged 70 and older drank 0.5 L a day of hydrogen-rich water (15 ppm) or plain water for six months. Facial skin features didn't differ between groups. The trial's positive findings were elsewhere, such as telomere length and a chair-stand test [[1]](/study/the-effects-of-6-month-hydrogen-rich-water-intake-on-molecular-and-phenotypic-biomarkers-of-aging-in-older-adults-aged-70-years-and-over-a-randomized-controlled-pilot-trial-pmid-34601077).

## Do hydrogen baths improve skin?

The evidence is too thin to say. Two tiny bath studies without a comparison group reported fewer neck wrinkles or fainter spots, and a third, often-cited study didn't test skin aging.

- Six Japanese adults bathed daily in warm hydrogen-rich water (0.2 to 0.4 ppm) for three months. Wrinkles on the back of the neck improved in four of them. There was no comparison group, and most of the paper was cell experiments [[2]](/study/hydrogen-rich-electrolyzed-warm-water-represses-wrinkle-formation-against-uva-ray-together-with-type-i-collagen-production-and-oxidative-stress-diminishment-in-fibroblasts-and-cell-injury-prevention-in-keratinocytes-pmid-22070900).
- Four adults aged 41 to 48 took a 10-minute hydrogen bath (about 0.3 ppm) daily for one to six months. Their skin spots looked smaller and fainter. Again, there was no comparison group [[3]](/study/effects-of-hydrogen-rich-water-bath-on-visceral-fat-and-skin-blotch-with-boiling-resistant-hydrogen-bubbles-pmid-31249254).
- A 2022 hydrogen-bath study that often comes up in searches mainly measured blood antioxidant capacity and an inflammation marker. Its skin remarks came from a few patients with inflammatory diseases, not from a skin-aging test [[6]](/study/hydrogen-rich-bath-with-nano-sized-bubbles-improves-antioxidant-capacity-based-on-oxygen-radical-absorbing-and-inflammation-levels-in-human-serum-pmid-34854419).

All three bath papers share a senior author from one Japanese research group.

## Does putting hydrogen on the skin help?

Two small studies reported changes, such as fewer visible pores or higher skin density, but neither was a blinded, placebo-controlled trial, and wrinkle severity didn't change significantly in the one that measured it.

- Fifteen adults aged 21 to 72 had four weekly facial treatments with hydrogen-rich water (about 2 ppm, strongly alkaline) from an electrolysis device. Visible pores and some pigmentation measures improved, but wrinkle severity didn't change significantly. All participants got the treatment; there was no control group [[5]](/study/topically-applied-molecular-hydrogen-normalizes-skin-parameters-associated-with-oxidative-stress-a-pilot-study-pmid-40563361).
- Twenty people used a hydrogen-generating gel mask on one side of the face and a commercial mask on the other for four weeks. Skin density, measured by ultrasound, rose 18% on the hydrogen side and 10% on the other. The report doesn't describe blinding, and one author is affiliated with a company, BoyazEnergy [[4]](/study/antioxidant-activity-of-hydrogen-water-mask-pack-composed-of-gel-type-emulsion-and-hydrogen-generation-powder-pmid-33419292).

## What do cell and animal studies suggest (not human evidence)?

That hydrogen may reduce oxidative damage from UV light. They don't show that drinking, bathing in or applying hydrogen changes how human skin ages.

- In lab-grown human skin cells, dissolved hydrogen protected against several kinds of oxidative damage [[9]](/study/protective-effects-of-dissolved-molecular-hydrogen-against-hydrogen-peroxide-hydroperoxide-and-glyoxal-induced-injuries-to-human-skin-keratinocytes-pmid-34028646), and hydrogen-rich warm water roughly doubled type I collagen production in lab-grown fibroblasts, the cells that make collagen [2].
- Mice exposed to UVA light for six weeks while breathing 1.3% hydrogen gas 16 hours a day showed fewer signs of photoaging, including less skin thickening, pigment and collagen breakdown [[7]](/study/intermittent-environmental-exposure-to-hydrogen-prevents-skin-photoaging-through-reduction-of-oxidative-stress-pmid-36807963).
- In lab-grown artificial skin, 1.3% hydrogen gas dampened UVA-triggered gene activity linked to skin aging. One author works for Panasonic [[8]](/study/transcriptome-based-evaluation-of-hydrogen-gas-effects-for-preventing-uva-induced-photoaging-using-an-artificial-skin-model-pmid-41749059).

## Has hydrogen been tested in skin diseases?

Only in early studies.

Hydrogen has also been tested in skin diseases, including a hydrogen-water bathing study in 75 people with psoriasis [[10]](/study/positive-effects-of-hydrogen-water-bathing-in-patients-of-psoriasis-and-parapsoriasis-en-plaques-pmid-29795283) and a 21-person pilot trial in people awaiting keloid scar surgery [[11]](/study/exploratory-evaluation-of-hydrogen-rich-water-therapy-for-keloid-management-a-double-blinded-randomized-pilot-trial-pmid-41545661). These are early studies of diseases, separate from cosmetic aging, and don't establish hydrogen as a treatment. If you have a skin condition, talk to a dermatologist.

## What doses and delivery methods were studied?

No standard dose exists. The human studies used drinking water, baths and topical products at very different concentrations, and none compared one route with another.

- **Drinking:** 0.5 L a day at 15 ppm for six months [1].
- **Bathing:** 0.2 to 0.4 ppm, daily, for one to six months [2][3].
- **Topical:** about 2 ppm water in four weekly sessions [5]; a hydrogen-generating mask for four weeks [4].
- **Cells and animals:** 1.3% hydrogen gas [7][8].

## What don't we know yet?

The main questions are still open: whether any form of hydrogen changes how human skin ages, and what else explains the small positive results.

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
      { n: 1, citation: "Zanini D, et al. The effects of 6-month hydrogen-rich water intake on molecular and phenotypic biomarkers of aging in older adults aged 70 years and over: a randomized controlled pilot trial. Exp Gerontol. 2021;155:111574.", pmid: "34601077", doi: "10.1016/j.exger.2021.111574", ourStudyPath: "/study/the-effects-of-6-month-hydrogen-rich-water-intake-on-molecular-and-phenotypic-biomarkers-of-aging-in-older-adults-aged-70-years-and-over-a-randomized-controlled-pilot-trial-pmid-34601077" },
      { n: 2, citation: "Kato S, et al. Hydrogen-rich electrolyzed warm water represses wrinkle formation against UVA ray together with type-I collagen production and oxidative-stress diminishment in fibroblasts and cell-injury prevention in keratinocytes. J Photochem Photobiol B. 2012;106:24-33.", pmid: "22070900", doi: "10.1016/j.jphotobiol.2011.09.006", ourStudyPath: "/study/hydrogen-rich-electrolyzed-warm-water-represses-wrinkle-formation-against-uva-ray-together-with-type-i-collagen-production-and-oxidative-stress-diminishment-in-fibroblasts-and-cell-injury-prevention-in-keratinocytes-pmid-22070900" },
      { n: 3, citation: "Asada R, et al. Effects of hydrogen-rich water bath on visceral fat and skin blotch, with boiling-resistant hydrogen bubbles. Med Gas Res. 2019;9(2):68-73.", pmid: "31249254", doi: "10.4103/2045-9912.260647", ourStudyPath: "/study/effects-of-hydrogen-rich-water-bath-on-visceral-fat-and-skin-blotch-with-boiling-resistant-hydrogen-bubbles-pmid-31249254" },
      { n: 4, citation: "Kwon HJ, et al. Antioxidant activity of hydrogen water mask pack composed of gel-type emulsion and hydrogen generation powder. Int J Mol Sci. 2020;21(24):9731.", pmid: "33419292", doi: "10.3390/ijms21249731", ourStudyPath: "/study/antioxidant-activity-of-hydrogen-water-mask-pack-composed-of-gel-type-emulsion-and-hydrogen-generation-powder-pmid-33419292" },
      { n: 5, citation: "Debkowska N, et al. Topically applied molecular hydrogen normalizes skin parameters associated with oxidative stress: a pilot study. Antioxidants (Basel). 2025;14(6):729.", pmid: "40563361", doi: "10.3390/antiox14060729", ourStudyPath: "/study/topically-applied-molecular-hydrogen-normalizes-skin-parameters-associated-with-oxidative-stress-a-pilot-study-pmid-40563361" },
      { n: 6, citation: "Tanaka Y, et al. Hydrogen-rich bath with nano-sized bubbles improves antioxidant capacity based on oxygen radical absorbing and inflammation levels in human serum. Med Gas Res. 2022;12(3):91-99.", pmid: "34854419", doi: "10.4103/2045-9912.330692", ourStudyPath: "/study/hydrogen-rich-bath-with-nano-sized-bubbles-improves-antioxidant-capacity-based-on-oxygen-radical-absorbing-and-inflammation-levels-in-human-serum-pmid-34854419" },
      { n: 7, citation: "Kiyoi T, et al. Intermittent environmental exposure to hydrogen prevents skin photoaging through reduction of oxidative stress. Geriatr Gerontol Int. 2023;23(4):304-312.", pmid: "36807963", doi: "10.1111/ggi.14562", ourStudyPath: "/study/intermittent-environmental-exposure-to-hydrogen-prevents-skin-photoaging-through-reduction-of-oxidative-stress-pmid-36807963" },
      { n: 8, citation: "Kiyoi T, et al. Transcriptome-based evaluation of hydrogen gas effects for preventing UVA-induced photoaging using an artificial skin model. Geriatr Gerontol Int. 2026;26(3):e70401. (Correction: Geriatr Gerontol Int. 2026;26(4):e70453.)", pmid: "41749059", doi: "10.1111/ggi.70401", ourStudyPath: "/study/transcriptome-based-evaluation-of-hydrogen-gas-effects-for-preventing-uva-induced-photoaging-using-an-artificial-skin-model-pmid-41749059" },
      { n: 9, citation: "Saitoh Y, et al. Protective effects of dissolved molecular hydrogen against hydrogen peroxide-, hydroperoxide-, and glyoxal-induced injuries to human skin keratinocytes. Mol Cell Biochem. 2021;476(10):3613-3622.", pmid: "34028646", doi: "10.1007/s11010-021-04189-z", ourStudyPath: "/study/protective-effects-of-dissolved-molecular-hydrogen-against-hydrogen-peroxide-hydroperoxide-and-glyoxal-induced-injuries-to-human-skin-keratinocytes-pmid-34028646" },
      { n: 10, citation: "Zhu Q, et al. Positive effects of hydrogen-water bathing in patients of psoriasis and parapsoriasis en plaques. Sci Rep. 2018;8(1):8051.", pmid: "29795283", doi: "10.1038/s41598-018-26388-3", ourStudyPath: "/study/positive-effects-of-hydrogen-water-bathing-in-patients-of-psoriasis-and-parapsoriasis-en-plaques-pmid-29795283" },
      { n: 11, citation: "Kuang X, et al. Exploratory evaluation of hydrogen-rich water therapy for keloid management: a double-blinded randomized pilot trial. Aesthetic Plast Surg. 2026;50(9):3448-3459.", pmid: "41545661", doi: "10.1007/s00266-025-05512-5", ourStudyPath: "/study/exploratory-evaluation-of-hydrogen-rich-water-therapy-for-keloid-management-a-double-blinded-randomized-pilot-trial-pmid-41545661" },
    ],
    ownerLink: { href: "/blog/molecular-hydrogen-benefits-guide-pillar", label: "Hydrogen water benefits, graded by evidence" },
    bridgeTopic: null,
    lastReviewed: "2026-11-05",
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

## What have human trials found?

Mostly no difference from placebo. The best-blinded trial, in healthy adults with poor sleep, found none; the most positive result, with inhaled hydrogen in insomnia, came from a 7-day single-blind trial.

**Drinking hydrogen water**

- In 36 adults with obesity, 8 weeks of hydrogen-rich water (1 liter a day, 15 mg of hydrogen) improved sleep-questionnaire scores, but so did placebo. Only one item, self-rated sleep quality, favored hydrogen, at the edge of significance (p = 0.05), with no correction for testing many outcomes [[1]](/study/the-effects-of-8-week-hydrogen-rich-water-consumption-on-appetite-body-composition-sleep-quality-and-circulating-glucagon-like-peptide-1-in-obese-men-and-women-hydrappet-a-randomized-controlled-trial-pmid-40731927).
- In 27 adults over 50 starting strength training, 6 weeks of hydrogen water (12 mg of hydrogen, twice a day) showed a non-significant trend toward better sleep [[2]](/study/the-effects-of-drinking-hydrogen-rich-water-for-six-weeks-on-exercise-related-biomarkers-in-exercise-naive-men-and-women-over-50-years-following-resistance-training-program-a-randomized-controlled-pilot-trial-pmid-40525414) (see our [exercise recovery hub](/explore-by-condition/exercise-recovery)). In 40 adults aged 70 and older, 6 months of hydrogen water (0.5 liters a day, 15 ppm) didn't change sleep outcomes [[3]](/study/the-effects-of-6-month-hydrogen-rich-water-intake-on-molecular-and-phenotypic-biomarkers-of-aging-in-older-adults-aged-70-years-and-over-a-randomized-controlled-pilot-trial-pmid-34601077).
- In a 4-week crossover trial of 26 healthy adults (600 mL a day, 0.8–1.2 ppm), sleep scores after hydrogen water didn't differ from placebo, and daytime sleepiness didn't change [[4]](/study/hydrogen-rich-water-for-improvements-of-mood-anxiety-and-autonomic-nerve-function-in-daily-life-pmid-29497485).
- In a single-blind trial of 32 people with long COVID (1 liter a day of 1.6 ppm hydrogen water or plain water for 14 days), an exploratory analysis of the 19 poor sleepers favored hydrogen on one measure but not another (p = 0.06) [[5]](/study/the-effect-of-14-day-consumption-of-hydrogen-rich-water-alleviates-fatigue-but-does-not-ameliorate-dyspnea-in-long-covid-patients-a-pilot-single-blind-and-randomized-controlled-trial-pmid-38794767) (see our [fatigue hub](/explore-by-condition/chronic-fatigue)).

**Inhaled hydrogen**

- In 66 adults with chronic insomnia, 41 breathed a gas of two-thirds hydrogen and one-third oxygen through a nasal tube, 1 hour twice a day for 7 days; 25 breathed air. On a wrist monitor, the hydrogen group slept longer and lay awake less; sleep efficiency didn't differ. Sleep-quality questionnaire scores were also better than with air. The trial was single-blind, and two of its four authors worked for the inhaler's maker [[6]](/study/effect-of-hydrogen-oxygen-inhalation-on-sleep-disorders-and-abnormal-mood-a-single-blind-randomized-controlled-trial-pmid-40826930).
- After surgery, two hospital trials disagreed. In 75 brain-tumor surgery patients, the hydrogen group slept longer and more efficiently than an oxygen group on some days but not others [[7]](/study/effects-of-perioperative-hydrogen-inhalation-on-brain-edema-and-prognosis-in-patients-with-glioma-a-single-center-randomized-controlled-study-pmid-39099781). In 153 adults aged 65 and older, self-rated sleep didn't differ [[8]](/study/hydrogen-gas-treatment-improves-postoperative-delirium-and-cognitive-dysfunction-in-elderly-noncardiac-patients-pmid-36675728).

**Other: hydrogen jelly**

- In the only double-blind, placebo-controlled trial we found with sleep as its main outcome, 44 healthy adults with poor sleep ate hydrogen-rich jelly (0.9 mg of hydrogen a day) or identical placebo jelly for 8 weeks. Both groups reported better sleep, with no difference between them. An exploratory analysis found more improvement in people with fewer hydrogen-producing gut bacteria, an idea that still needs testing [[9]](/study/individual-variability-in-hydrogen-producing-microbes-influences-the-response-to-hydrogen-supplementation-on-sleep-quality-a-randomized-double-blind-placebo-controlled-parallel-study-pmid-42509250).

## What do animal studies suggest (not human evidence)?

One mouse study found more consolidated sleep after 7 days of hydrogen-rich water. That isn't evidence for people.

- Mice given hydrogen-rich water for 7 days had more consolidated sleep on brain-wave recordings, and after being kept awake they slept more. One author works for a hydrogen products company [[10]](/study/hydrogen-rich-water-improves-sleep-consolidation-and-enhances-forebrain-neuronal-activation-in-mice-pmid-38264142).

## What doses and durations were studied?

No dose has been shown to improve sleep, and no trial compared bedtime with other times. Drinking trials used about 0.5 to 24 mg of hydrogen a day for 2 weeks to 6 months.

- **Drinking:** about 0.5 mg to 24 mg of hydrogen a day, usually in 0.5 to 1 liter of water, for 2 weeks to 6 months [1]–[5]. See [how much hydrogen water per day](/blog/how-much-hydrogen-water-per-day).
- **Jelly:** 0.9 mg a day for 8 weeks [9].
- **Inhaling:** two-thirds hydrogen, one-third oxygen, 2 hours a day for 7 days [6].
- **Timing:** No trial compared bedtime with other times. Drinking trials spread servings through the day or served them with meals [1][4]; the insomnia trial's sessions ended 2 hours before bed [6].

## What don't we know yet?

Whether hydrogen helps sleep at all, in healthy sleepers or in sleep disorders, measured objectively and for longer than a week.

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
      { n: 1, citation: "Todorovic N, et al. The effects of 8-week hydrogen-rich water consumption on appetite, body composition, sleep quality, and circulating glucagon-like peptide-1 in obese men and women (HYDRAPPET): a randomized controlled trial. Medicina (Kaunas). 2025;61(7):1299.", pmid: "40731927", doi: "10.3390/medicina61071299", ourStudyPath: "/study/the-effects-of-8-week-hydrogen-rich-water-consumption-on-appetite-body-composition-sleep-quality-and-circulating-glucagon-like-peptide-1-in-obese-men-and-women-hydrappet-a-randomized-controlled-trial-pmid-40731927" },
      { n: 2, citation: "Kuzmanovic J, et al. The effects of drinking hydrogen-rich water for six weeks on exercise-related biomarkers in exercise-naïve men and women over 50 years following resistance training program: a randomized controlled pilot trial. Res Sports Med. 2025;33(6):711-721.", pmid: "40525414", doi: "10.1080/15438627.2025.2521474", ourStudyPath: "/study/the-effects-of-drinking-hydrogen-rich-water-for-six-weeks-on-exercise-related-biomarkers-in-exercise-naive-men-and-women-over-50-years-following-resistance-training-program-a-randomized-controlled-pilot-trial-pmid-40525414" },
      { n: 3, citation: "Zanini D, et al. The effects of 6-month hydrogen-rich water intake on molecular and phenotypic biomarkers of aging in older adults aged 70 years and over: a randomized controlled pilot trial. Exp Gerontol. 2021;155:111574.", pmid: "34601077", doi: "10.1016/j.exger.2021.111574", ourStudyPath: "/study/the-effects-of-6-month-hydrogen-rich-water-intake-on-molecular-and-phenotypic-biomarkers-of-aging-in-older-adults-aged-70-years-and-over-a-randomized-controlled-pilot-trial-pmid-34601077" },
      { n: 4, citation: "Mizuno K, et al. Hydrogen-rich water for improvements of mood, anxiety, and autonomic nerve function in daily life. Med Gas Res. 2018;7(4):247-255.", pmid: "29497485", doi: "10.4103/2045-9912.222448", ourStudyPath: "/study/hydrogen-rich-water-for-improvements-of-mood-anxiety-and-autonomic-nerve-function-in-daily-life-pmid-29497485" },
      { n: 5, citation: "Tan Y, et al. The effect of 14-day consumption of hydrogen-rich water alleviates fatigue but does not ameliorate dyspnea in long-COVID patients: a pilot, single-blind, and randomized, controlled trial. Nutrients. 2024;16(10):1529.", pmid: "38794767", doi: "10.3390/nu16101529", ourStudyPath: "/study/the-effect-of-14-day-consumption-of-hydrogen-rich-water-alleviates-fatigue-but-does-not-ameliorate-dyspnea-in-long-covid-patients-a-pilot-single-blind-and-randomized-controlled-trial-pmid-38794767" },
      { n: 6, citation: "Gao YH, et al. Effect of hydrogen-oxygen inhalation on sleep disorders and abnormal mood: a single-blind, randomized controlled trial. Med Gas Res. 2025 (issue 2026;16(2):98-102).", pmid: "40826930", doi: "10.4103/mgr.MEDGASRES-D-25-00020", ourStudyPath: "/study/effect-of-hydrogen-oxygen-inhalation-on-sleep-disorders-and-abnormal-mood-a-single-blind-randomized-controlled-trial-pmid-40826930" },
      { n: 7, citation: "Wu F, et al. Effects of perioperative hydrogen inhalation on brain edema and prognosis in patients with glioma: a single-center, randomized controlled study. Front Neurol. 2024;15:1413904.", pmid: "39099781", doi: "10.3389/fneur.2024.1413904", ourStudyPath: "/study/effects-of-perioperative-hydrogen-inhalation-on-brain-edema-and-prognosis-in-patients-with-glioma-a-single-center-randomized-controlled-study-pmid-39099781" },
      { n: 8, citation: "Lin H, et al. Hydrogen gas treatment improves postoperative delirium and cognitive dysfunction in elderly noncardiac patients. J Pers Med. 2022;13(1):67.", pmid: "36675728", doi: "10.3390/jpm13010067", ourStudyPath: "/study/hydrogen-gas-treatment-improves-postoperative-delirium-and-cognitive-dysfunction-in-elderly-noncardiac-patients-pmid-36675728" },
      { n: 9, citation: "Higashikawa F, Kanno K. Individual variability in hydrogen-producing microbes influences the response to hydrogen supplementation on sleep quality: a randomized, double-blind, placebo-controlled, parallel study. Sci Rep. 2026;16(1).", pmid: "42509250", doi: "10.1038/s41598-026-52342-9", ourStudyPath: "/study/individual-variability-in-hydrogen-producing-microbes-influences-the-response-to-hydrogen-supplementation-on-sleep-quality-a-randomized-double-blind-placebo-controlled-parallel-study-pmid-42509250" },
      { n: 10, citation: "Vincent SM, et al. Hydrogen-rich water improves sleep consolidation and enhances forebrain neuronal activation in mice. Sleep Adv. 2023;5(1):zpad057.", pmid: "38264142", doi: "10.1093/sleepadvances/zpad057", ourStudyPath: "/study/hydrogen-rich-water-improves-sleep-consolidation-and-enhances-forebrain-neuronal-activation-in-mice-pmid-38264142" },
    ],
    ownerLink: { href: "/blog/molecular-hydrogen-benefits-guide-pillar#can-hydrogen-water-help-with-sleep-mood-or-stress", label: "Can hydrogen water help with sleep, mood or stress? From our evidence-graded benefits guide" },
    bridgeTopic: null,
    lastReviewed: "2026-11-05",
  },

  // ── Wave 5 (2026-11): metabolic and digestive hubs. Each absorbs the
  // blog posts listed for it in reports/content/hub-consolidation-2026-10-30.csv
  // (301s run after merge); sources: reports/content/wave5-sources-2026-11.csv.

  "cholesterol": {
    slug: "cholesterol",
    h1: "Hydrogen Water and Cholesterol: What the Studies Show",
    metaTitle: "Does Hydrogen Water Lower Cholesterol? | Hydrogen Studies",
    metaDescription:
      "Hydrogen water and cholesterol, graded: pooled trials found small drops in total and LDL cholesterol, too small to cut heart risk. Doses, trials and gaps.",
    evidenceGrade: "low",
    introMarkdown: `*Hydrogen Studies is funded by Echo Technologies LLC, which sells hydrogen water products. Echo doesn't decide which studies we cover or how we describe them — see our [editorial policy](/editorial-policy).*

**Evidence at a glance: Low.** Three meta-analyses of small randomized trials found that hydrogen-rich water lowered total and LDL cholesterol slightly. In the largest, 13 trials with 757 adults with overweight or obesity, total cholesterol fell by about 7 mg/dL and LDL by about 3 mg/dL, and the authors judged both changes too small to lower heart risk. No trial has measured heart attacks or strokes.

This page covers blood cholesterol and triglycerides. If your cholesterol is high, talk to your doctor before trying hydrogen water, and don't stop or change a statin or any other prescribed medicine. For the short answer, see the [cholesterol and blood sugar section of our benefits guide](/blog/molecular-hydrogen-benefits-guide-pillar#does-hydrogen-water-lower-cholesterol-or-blood-sugar).

## What have pooled trials found?

Small drops in total and LDL cholesterol. In the largest analysis, the changes were too small to lower heart risk.

- **2026: 13 trials, 757 adults with overweight or obesity.** Compared with plain or placebo water, hydrogen-rich water lowered total cholesterol by 6.7 mg/dL and LDL ("bad") cholesterol by 3.2 mg/dL. HDL ("good") cholesterol fell slightly, by 1.2 mg/dL, and triglycerides didn't change significantly. The authors concluded that the results don't justify using hydrogen water to lower cholesterol outside research [[1]](/study/the-effect-of-hydrogen-rich-water-interventions-on-lipid-profiles-in-adults-with-overweight-or-obesity-and-associated-metabolic-disorders-a-systematic-review-and-meta-analysis-of-randomized-controlled-trials-pmid-41888952).
- **2024: 8 trials, 357 people with metabolic disorders.** Triglycerides, total cholesterol and LDL dropped slightly; HDL results were inconsistent across trials [[2]](/study/the-effects-of-hydrogen-rich-water-on-blood-lipid-profiles-in-metabolic-disorders-clinical-trials-a-systematic-review-and-meta-analysis-pmid-39839806).
- **2023: 7 studies in clinical populations.** Total cholesterol, LDL and triglycerides fell by small-to-moderate amounts. Five of the seven authors work at a Serbian lab that has run several hydrogen trials [[3]](/study/the-effects-of-hydrogen-rich-water-on-blood-lipid-profiles-in-clinical-populations-a-systematic-review-and-meta-analysis-pmid-37259294).

The three analyses pool many of the same small trials, so they aren't independent confirmations of each other.

## What have individual trials found?

Several small randomized trials found larger cholesterol drops with hydrogen water than with placebo water. Most were small, and two used products from hydrogen companies.

**Randomized, placebo-controlled trials**

- In China, 68 adults with untreated high cholesterol drank 0.9 liters a day of hydrogen-rich water or placebo water for 10 weeks. HDL cholesterol levels didn't change, but lab tests of how well HDL particles worked improved, and total cholesterol fell in more people on hydrogen (47% vs 18%), as did LDL (47% vs 24%) [[4]](/study/hydrogen-activates-atp-binding-cassette-transporter-a1-dependent-efflux-ex-vivo-and-improves-high-density-lipoprotein-function-in-patients-with-hypercholesterolemia-a-double-blinded-randomized-and-placebo-controlled-trial-pmid-25978109).
- In Serbia, 36 adults with obesity drank 1 liter a day of hydrogen-rich water (15 mg of hydrogen) or placebo water for 8 weeks. Total cholesterol fell by about 12 mg/dL in the hydrogen group, significantly more than with placebo, and LDL fell more too. The drinks were supplied by a hydrogen products company that employs one of the authors [[5]](/study/the-effects-of-8-week-hydrogen-rich-water-consumption-on-appetite-body-composition-sleep-quality-and-circulating-glucagon-like-peptide-1-in-obese-men-and-women-hydrappet-a-randomized-controlled-trial-pmid-40731927).
- In India, 60 adults with metabolic syndrome drank water made with hydrogen-producing tablets (more than 5.5 millimoles, about 11 mg, of hydrogen a day) or placebo water for 24 weeks, and blood cholesterol fell more with hydrogen. The lead author is affiliated with the Molecular Hydrogen Institute, a nonprofit that promotes hydrogen research, and the tablets came from a hydrogen-tablet company [[6]](/study/the-effects-of-24-week-high-concentration-hydrogen-rich-water-on-body-composition-blood-lipid-profiles-and-inflammation-biomarkers-in-men-and-women-with-metabolic-syndrome-a-randomized-controlled-trial-pmid-32273740).
- In a crossover trial in Japan, 30 people with type 2 diabetes and 6 with prediabetes drank 900 mL a day of hydrogen-rich water or placebo water for 8 weeks each. With hydrogen, chemically modified LDL fell by 15.5% and small, dense LDL particles by 5.7% [[7]](/study/supplementation-of-hydrogen-rich-water-improves-lipid-and-glucose-metabolism-in-patients-with-type-2-diabetes-or-impaired-glucose-tolerance-pmid-19083400) (see our [type 2 diabetes hub](/explore-by-condition/type-2-diabetes)).

**Studies without a comparison group**

- In 20 people with signs of metabolic syndrome, 10 weeks of hydrogen-rich water (0.9 to 1 liter a day) was followed by lower total and LDL cholesterol [[8]](/study/hydrogen-rich-water-decreases-serum-ldl-cholesterol-levels-and-improves-hdl-function-in-patients-with-potential-metabolic-syndrome-pmid-23610159). In another 20, 1.5 to 2 liters a day was followed by 8% higher HDL at week 4 [[9]](/study/effectiveness-of-hydrogen-rich-water-on-antioxidant-status-of-subjects-with-potential-metabolic-syndrome-an-open-label-pilot-study-pmid-20216947). Without a control group, these changes can't be credited to hydrogen.

## What do animal studies suggest (not human evidence)?

In mice, hydrogen water slowed artery plaque, and a hydrogen-releasing compound boosted a statin's effect, which hints at a possible drug interaction. Neither shows what happens in people.

- Mice bred to develop clogged arteries (apolipoprotein E knockout mice) that drank hydrogen water from 2 to 6 months of age had smaller artery plaques and less oxidative stress in the aorta [[10]](/study/consumption-of-hydrogen-water-prevents-atherosclerosis-in-apolipoprotein-e-knockout-mice-pmid-18996093).
- In mice and cells, magnesium hydride, a compound that releases hydrogen, added to the lipid-lowering effect of the statin atorvastatin. The authors proposed that it slows the liver enzyme that breaks statins down, raising statin levels in the blood [[11]](/study/the-augment-effects-of-magnesium-hydride-on-the-lipid-lowering-effect-of-atorvastatin-an-in-vivo-and-in-vitro-investigation-pmid-39436189). That points to a possible drug interaction to test in people, not a reason to combine the two.

## What doses and durations were studied?

No trial compared doses. Trials gave 0.9 to 2 liters a day, or about 11 to 15 mg of hydrogen a day, for 8 to 24 weeks.

- **Drinking:** 0.9 to 2 liters a day [4][7][8][9], or about 11 to 15 mg of hydrogen a day [5][6].
- **Duration:** 8 to 24 weeks in the placebo-controlled trials [5][6][7].

## What don't we know yet?

Whether the small changes matter for heart health: no trial has measured heart attacks or strokes.

- **Whether the changes matter.** The largest pooled analysis judged them below the level that lowers heart risk [1].
- **Heart attacks and strokes.** No trial has measured them.
- **Hydrogen with statins.** We found no human trial; one mouse study points to a possible interaction [11].
- **Longer use.** The longest placebo-controlled trial lasted 24 weeks [6].
- **Independence.** Two trials and one pooled analysis involve the same Serbian lab [3][5][6], two trials come from one Chinese group [4][8], and two used products from hydrogen companies [5][6].

*Drafted with AI assistance and checked against each linked source by our editorial team. General information, not medical advice.*`,
    faqs: [
      {
        question: "How much does hydrogen water lower LDL cholesterol?",
        answer:
          "Very little. In a 2026 meta-analysis of 13 randomized trials with 757 adults with overweight or obesity, hydrogen-rich water lowered LDL cholesterol by about 3 mg/dL and total cholesterol by about 7 mg/dL compared with plain or placebo water. The authors judged these changes too small to reduce heart risk and said they don't justify using hydrogen water as a cholesterol treatment.",
      },
      {
        question: "Can hydrogen water replace statins?",
        answer:
          "No. Statins lower LDL cholesterol far more than the few mg/dL seen in hydrogen water trials, and they have been shown to prevent heart attacks and strokes, which no hydrogen trial has measured. A mouse study suggested that a hydrogen-releasing compound raises statin levels in the blood, which hasn't been tested in people. If you take a statin, talk to your doctor before adding hydrogen water, and don't stop your medicine.",
      },
      {
        question: "Does hydrogen water lower triglycerides?",
        answer:
          "The results are inconsistent. A 2026 meta-analysis of 13 trials found no significant change in triglycerides, while two smaller meta-analyses from 2023 and 2024 reported small drops. The individual trials were small, lasted 8 to 24 weeks and often enrolled people with obesity or metabolic syndrome. Diet, exercise, alcohol and blood sugar control have larger, better-proven effects on triglycerides.",
      },
      {
        question: "Does hydrogen water raise HDL (good) cholesterol?",
        answer:
          "Not in the pooled trials. A 2026 meta-analysis of 13 randomized trials found that HDL cholesterol fell slightly, by about 1 mg/dL, with hydrogen-rich water. In a 68-person trial in people with high cholesterol, HDL levels didn't change, although lab tests found that HDL particles worked better. Whether that changes heart risk is unknown.",
      },
    ],
    sources: [
      { n: 1, citation: "Ye H, et al. The effect of hydrogen-rich water interventions on lipid profiles in adults with overweight or obesity and associated metabolic disorders: a systematic review and meta-analysis of randomized controlled trials. Diabetol Metab Syndr. 2026;18(1).", pmid: "41888952", doi: "10.1186/s13098-026-02124-0", ourStudyPath: "/study/the-effect-of-hydrogen-rich-water-interventions-on-lipid-profiles-in-adults-with-overweight-or-obesity-and-associated-metabolic-disorders-a-systematic-review-and-meta-analysis-of-randomized-controlled-trials-pmid-41888952" },
      { n: 2, citation: "Jamialahmadi H, et al. The effects of hydrogen-rich water on blood lipid profiles in metabolic disorders clinical trials: a systematic review and meta-analysis. Int J Endocrinol Metab. 2024;22(3):e148600.", pmid: "39839806", doi: "10.5812/ijem-148600", ourStudyPath: "/study/the-effects-of-hydrogen-rich-water-on-blood-lipid-profiles-in-metabolic-disorders-clinical-trials-a-systematic-review-and-meta-analysis-pmid-39839806" },
      { n: 3, citation: "Todorovic N, et al. The effects of hydrogen-rich water on blood lipid profiles in clinical populations: a systematic review and meta-analysis. Pharmaceuticals (Basel). 2023;16(2):142.", pmid: "37259294", doi: "10.3390/ph16020142", ourStudyPath: "/study/the-effects-of-hydrogen-rich-water-on-blood-lipid-profiles-in-clinical-populations-a-systematic-review-and-meta-analysis-pmid-37259294" },
      { n: 4, citation: "Song G, et al. Hydrogen activates ATP-binding cassette transporter A1-dependent efflux ex vivo and improves high-density lipoprotein function in patients with hypercholesterolemia: a double-blinded, randomized, and placebo-controlled trial. J Clin Endocrinol Metab. 2015;100(7):2724-33.", pmid: "25978109", doi: "10.1210/jc.2015-1321", ourStudyPath: "/study/hydrogen-activates-atp-binding-cassette-transporter-a1-dependent-efflux-ex-vivo-and-improves-high-density-lipoprotein-function-in-patients-with-hypercholesterolemia-a-double-blinded-randomized-and-placebo-controlled-trial-pmid-25978109" },
      { n: 5, citation: "Todorovic N, et al. The effects of 8-week hydrogen-rich water consumption on appetite, body composition, sleep quality, and circulating glucagon-like peptide-1 in obese men and women (HYDRAPPET): a randomized controlled trial. Medicina (Kaunas). 2025;61(7):1299.", pmid: "40731927", doi: "10.3390/medicina61071299", ourStudyPath: "/study/the-effects-of-8-week-hydrogen-rich-water-consumption-on-appetite-body-composition-sleep-quality-and-circulating-glucagon-like-peptide-1-in-obese-men-and-women-hydrappet-a-randomized-controlled-trial-pmid-40731927" },
      { n: 6, citation: "LeBaron TW, et al. The effects of 24-week, high-concentration hydrogen-rich water on body composition, blood lipid profiles and inflammation biomarkers in men and women with metabolic syndrome: a randomized controlled trial. Diabetes Metab Syndr Obes. 2020;13:889-896.", pmid: "32273740", doi: "10.2147/DMSO.S240122", ourStudyPath: "/study/the-effects-of-24-week-high-concentration-hydrogen-rich-water-on-body-composition-blood-lipid-profiles-and-inflammation-biomarkers-in-men-and-women-with-metabolic-syndrome-a-randomized-controlled-trial-pmid-32273740" },
      { n: 7, citation: "Kajiyama S, et al. Supplementation of hydrogen-rich water improves lipid and glucose metabolism in patients with type 2 diabetes or impaired glucose tolerance. Nutr Res. 2008;28(3):137-43.", pmid: "19083400", doi: "10.1016/j.nutres.2008.01.008", ourStudyPath: "/study/supplementation-of-hydrogen-rich-water-improves-lipid-and-glucose-metabolism-in-patients-with-type-2-diabetes-or-impaired-glucose-tolerance-pmid-19083400" },
      { n: 8, citation: "Song G, et al. Hydrogen-rich water decreases serum LDL-cholesterol levels and improves HDL function in patients with potential metabolic syndrome. J Lipid Res. 2013;54(7):1884-93.", pmid: "23610159", doi: "10.1194/jlr.M036640", ourStudyPath: "/study/hydrogen-rich-water-decreases-serum-ldl-cholesterol-levels-and-improves-hdl-function-in-patients-with-potential-metabolic-syndrome-pmid-23610159" },
      { n: 9, citation: "Nakao A, et al. Effectiveness of hydrogen rich water on antioxidant status of subjects with potential metabolic syndrome: an open label pilot study. J Clin Biochem Nutr. 2010;46(2):140-9.", pmid: "20216947", doi: "10.3164/jcbn.09-100", ourStudyPath: "/study/effectiveness-of-hydrogen-rich-water-on-antioxidant-status-of-subjects-with-potential-metabolic-syndrome-an-open-label-pilot-study-pmid-20216947" },
      { n: 10, citation: "Ohsawa I, et al. Consumption of hydrogen water prevents atherosclerosis in apolipoprotein E knockout mice. Biochem Biophys Res Commun. 2008;377(4):1195-8.", pmid: "18996093", doi: "10.1016/j.bbrc.2008.10.156", ourStudyPath: "/study/consumption-of-hydrogen-water-prevents-atherosclerosis-in-apolipoprotein-e-knockout-mice-pmid-18996093" },
      { n: 11, citation: "Chen W, et al. The augment effects of magnesium hydride on the lipid lowering effect of atorvastatin: an in vivo and in vitro investigation. Med Gas Res. 2024 (issue 2025;15(1):148-155).", pmid: "39436189", doi: "10.4103/mgr.MEDGASRES-D-23-00047", ourStudyPath: "/study/the-augment-effects-of-magnesium-hydride-on-the-lipid-lowering-effect-of-atorvastatin-an-in-vivo-and-in-vitro-investigation-pmid-39436189" },
    ],
    ownerLink: { href: "/blog/molecular-hydrogen-benefits-guide-pillar#does-hydrogen-water-lower-cholesterol-or-blood-sugar", label: "Does hydrogen water lower cholesterol or blood sugar? From our evidence-graded benefits guide" },
    bridgeTopic: null,
    lastReviewed: "2026-11-05",
  },

  "type-2-diabetes": {
    slug: "type-2-diabetes",
    h1: "Hydrogen and Type 2 Diabetes: What the Studies Show",
    metaTitle: "Hydrogen Water and Type 2 Diabetes | Hydrogen Studies",
    metaDescription:
      "Hydrogen water and type 2 diabetes, graded: the main trial found no change in insulin resistance, and other trials are small or mixed. Doses, gaps, safety.",
    evidenceGrade: "very low",
    introMarkdown: `*Hydrogen Studies is funded by Echo Technologies LLC, which sells hydrogen water products. Echo doesn't decide which studies we cover or how we describe them — see our [editorial policy](/editorial-policy).*

**Evidence at a glance: Very low.** In the main double-blind trial in type 2 diabetes, 50 people drank electrolyzed hydrogen water or filtered water, and insulin resistance, the main outcome, didn't differ between groups. Other trials were small, short or in people without diabetes, with mixed results. The largest data, on inhaled hydrogen, come from medical records, not randomized trials. No study has tested whether hydrogen prevents diabetes complications.

This page covers type 2 diabetes and prediabetes. Hydrogen is not a treatment for diabetes. Don't change your medicine, and if you use insulin or other glucose-lowering drugs, check your levels and tell your doctor before adding anything new. See also our [diabetes research overview](/hydrogen-for/diabetes) and our [cholesterol hub](/explore-by-condition/cholesterol).

## What have human trials found?

Mixed results, and no clear benefit in diabetes itself. The main double-blind trial in type 2 diabetes found no change in insulin resistance; lower blood sugar results come from metabolic syndrome trials and medical-record studies of inhaled hydrogen.

**Drinking hydrogen water: randomized trials**

- **Type 2 diabetes, 50 people.** In a multicenter double-blind trial in Japan, electrolyzed hydrogen water didn't change insulin resistance (measured as HOMA-IR) compared with filtered water. Blood lactate fell in the hydrogen group, and no treatment-related side effects were seen. Two authors work for Nihon Trim, a maker of electrolyzed water devices [[1]](/study/electrolyzed-hydrogen-rich-water-for-oxidative-stress-suppression-and-improvement-of-insulin-resistance-a-multicenter-prospective-double-blind-randomized-control-trial-pmid-35059257).
- **Type 2 diabetes or prediabetes, 36 people.** In an 8-week crossover trial (900 mL a day), hydrogen water lowered chemically modified LDL cholesterol and a urine marker of oxidative stress. In 4 of the 6 people with prediabetes, a glucose tolerance test returned to normal [[2]](/study/supplementation-of-hydrogen-rich-water-improves-lipid-and-glucose-metabolism-in-patients-with-type-2-diabetes-or-impaired-glucose-tolerance-pmid-19083400).
- **High fasting blood sugar, 73 people.** Over 8 weeks, fasting glucose fell in both the hydrogen water group (1 liter a day, about 1.4 mg of hydrogen per liter) and the plain-water group, slightly more with hydrogen. The share of people whose fasting glucose returned to normal didn't differ significantly (69% vs 54%) [[3]](/study/hydrogen-rich-water-ameliorates-metabolic-disorder-via-modifying-gut-microbiota-in-impaired-fasting-glucose-patients-a-randomized-controlled-study-pmid-37371975).
- **Metabolic syndrome, 60 people.** After 24 weeks of water made with hydrogen-producing tablets, fasting glucose and HbA1c were lower than with placebo water. The lead author is affiliated with the Molecular Hydrogen Institute, a nonprofit that promotes hydrogen research [[4]](/study/the-effects-of-24-week-high-concentration-hydrogen-rich-water-on-body-composition-blood-lipid-profiles-and-inflammation-biomarkers-in-men-and-women-with-metabolic-syndrome-a-randomized-controlled-trial-pmid-32273740).
- **Metabolic syndrome or pre-metabolic syndrome, 181 people.** In a 3-month double-blind trial, HbA1c and blood glucose rose slightly with filtered water and fell with electrolyzed hydrogen water, but the difference wasn't statistically significant. One author works for the device maker [[5]](/study/health-effects-of-electrolyzed-hydrogen-water-for-the-metabolic-syndrome-and-pre-metabolic-syndrome-a-3-month-randomized-controlled-trial-and-subsequent-analyses-pmid-38397743).

**Inhaled hydrogen: medical-record studies, not randomized**

- In the records of 1,088 Chinese adults with type 2 diabetes on usual medicine, those who also inhaled hydrogen for 6 months had a larger drop in HbA1c than matched patients who didn't (0.94 vs 0.46 percentage points) [[6]](/study/effectiveness-and-safety-of-hydrogen-inhalation-as-an-adjunct-treatment-in-chinese-type-2-diabetes-patients-a-retrospective-observational-double-arm-real-life-clinical-study-pmid-36743938). People who choose an add-on therapy can differ in ways records don't capture.
- In a single-group record review of 431 adults, HbA1c fell from 9.0% to 8.0% over 6 months of inhalation, with no comparison group. Low blood sugar was the most common side effect [[7]](/study/real-world-effectiveness-and-safety-of-hydrogen-inhalation-in-chinese-patients-with-type-2-diabetes-a-single-arm-retrospective-study-pmid-37431394).

## What do animal studies suggest (not human evidence)?

In obese, diabetic mice, long-term hydrogen water lowered blood glucose and insulin, and in diabetic rats hydrogen protected nerve function. Animal results like these don't show the same in people.

- Obese, diabetic mice (db/db mice) that drank hydrogen water long term had lower blood glucose, insulin and triglycerides, less fatty liver and lower body weight, without eating more. The effect on blood sugar was similar to restricting their food [[8]](/study/molecular-hydrogen-improves-obesity-and-diabetes-by-inducing-hepatic-fgf21-and-stimulating-energy-metabolism-in-dbdb-mice-pmid-21293445).
- In rats with chemically induced diabetes, breathing hydrogen gas for 8 weeks lowered blood glucose more than hydrogen-rich saline injections did, and hydrogen slowed the loss of nerve signal speed, a sign of diabetic nerve damage (neuropathy). It also lowered markers of oxidative stress in the nerves [[9]](/study/hydrogen-exerts-neuroprotective-effects-by-inhibiting-oxidative-stress-in-experimental-diabetic-peripheral-neuropathy-rats-pmid-36204786). No human trial has tested hydrogen for diabetic neuropathy.

## What doses and durations were studied?

No trial compared doses. Drinking trials ran from 8 to 24 weeks, and the inhalation records covered 6 months.

- **Drinking:** 900 mL to 1 liter a day for 8 weeks [2][3]; tablets supplying more than 5.5 millimoles (about 11 mg) of hydrogen a day for 24 weeks [4]; electrolyzed water for 3 months [5].
- **Inhaling:** daily, for 6 months, in the record reviews [6][7].

## What don't we know yet?

Whether hydrogen improves blood sugar control or prevents complications in people with diabetes: neither has been shown.

- **Blood sugar control in diabetes.** The main type 2 diabetes trial found no change in insulin resistance [1]; the lower HbA1c results come from a metabolic syndrome trial [4] and non-randomized inhalation records [6][7].
- **Complications.** No human trial has measured kidney, eye, nerve or heart complications.
- **Medicines.** Interactions haven't been studied; low blood sugar was the most common side effect in one inhalation study [7].
- **Longer use.** The longest randomized trial lasted 24 weeks [4].
- **Independence.** Two trials list authors from Nihon Trim, a maker of electrolyzed water devices [1][5].

*Drafted with AI assistance and checked against each linked source by our editorial team. General information, not medical advice.*`,
    faqs: [
      {
        question: "Does hydrogen water lower HbA1c?",
        answer:
          "Not reliably. In a 24-week trial of 60 adults with metabolic syndrome, HbA1c fell more with hydrogen water made from tablets than with placebo water. In a 3-month trial of 181 people with metabolic syndrome or pre-metabolic syndrome, the HbA1c difference wasn't statistically significant. We found no randomized trial showing that drinking hydrogen water lowers HbA1c in people with type 2 diabetes.",
      },
      {
        question: "Can hydrogen water reverse prediabetes?",
        answer:
          "There's no good evidence that it can. In 73 adults with high fasting blood sugar, fasting glucose fell over 8 weeks in both the hydrogen water and plain-water groups, slightly more with hydrogen, and the share who returned to normal didn't differ significantly. In a smaller trial, 4 of 6 people with prediabetes had a normal glucose tolerance test after 8 weeks of hydrogen water. Weight loss and exercise are proven to lower the risk of diabetes.",
      },
      {
        question: "Does inhaling hydrogen help type 2 diabetes?",
        answer:
          "It hasn't been tested in a randomized trial. Two Chinese studies reviewed the records of people with type 2 diabetes who inhaled hydrogen alongside their usual medicine for 6 months: HbA1c fell more than in matched patients who didn't, or fell from 9.0% to 8.0% in a single group. Without randomization, other differences between patients could explain the results. Low blood sugar was the most common side effect.",
      },
      {
        question: "Should people with type 2 diabetes try hydrogen water?",
        answer:
          "Talk to your doctor first. Hydrogen water hasn't been shown to control blood sugar or prevent diabetes complications, so it can't replace medicine, diet or exercise. The main trial in type 2 diabetes reported no treatment-related side effects, but interactions with diabetes drugs haven't been studied. If you use insulin or other glucose-lowering medicine and add anything new, check your blood sugar more often.",
      },
    ],
    sources: [
      { n: 1, citation: "Ogawa S, et al. Electrolyzed hydrogen-rich water for oxidative stress suppression and improvement of insulin resistance: a multicenter prospective double-blind randomized control trial. Diabetol Int. 2021 (issue 2022;13(1):209-219).", pmid: "35059257", doi: "10.1007/s13340-021-00524-3", ourStudyPath: "/study/electrolyzed-hydrogen-rich-water-for-oxidative-stress-suppression-and-improvement-of-insulin-resistance-a-multicenter-prospective-double-blind-randomized-control-trial-pmid-35059257" },
      { n: 2, citation: "Kajiyama S, et al. Supplementation of hydrogen-rich water improves lipid and glucose metabolism in patients with type 2 diabetes or impaired glucose tolerance. Nutr Res. 2008;28(3):137-43.", pmid: "19083400", doi: "10.1016/j.nutres.2008.01.008", ourStudyPath: "/study/supplementation-of-hydrogen-rich-water-improves-lipid-and-glucose-metabolism-in-patients-with-type-2-diabetes-or-impaired-glucose-tolerance-pmid-19083400" },
      { n: 3, citation: "Liang B, et al. Hydrogen-rich water ameliorates metabolic disorder via modifying gut microbiota in impaired fasting glucose patients: a randomized controlled study. Antioxidants (Basel). 2023;12(6):1245.", pmid: "37371975", doi: "10.3390/antiox12061245", ourStudyPath: "/study/hydrogen-rich-water-ameliorates-metabolic-disorder-via-modifying-gut-microbiota-in-impaired-fasting-glucose-patients-a-randomized-controlled-study-pmid-37371975" },
      { n: 4, citation: "LeBaron TW, et al. The effects of 24-week, high-concentration hydrogen-rich water on body composition, blood lipid profiles and inflammation biomarkers in men and women with metabolic syndrome: a randomized controlled trial. Diabetes Metab Syndr Obes. 2020;13:889-896.", pmid: "32273740", doi: "10.2147/DMSO.S240122", ourStudyPath: "/study/the-effects-of-24-week-high-concentration-hydrogen-rich-water-on-body-composition-blood-lipid-profiles-and-inflammation-biomarkers-in-men-and-women-with-metabolic-syndrome-a-randomized-controlled-trial-pmid-32273740" },
      { n: 5, citation: "Moribe R, et al. Health effects of electrolyzed hydrogen water for the metabolic syndrome and pre-metabolic syndrome: a 3-month randomized controlled trial and subsequent analyses. Antioxidants (Basel). 2024;13(2):145.", pmid: "38397743", doi: "10.3390/antiox13020145", ourStudyPath: "/study/health-effects-of-electrolyzed-hydrogen-water-for-the-metabolic-syndrome-and-pre-metabolic-syndrome-a-3-month-randomized-controlled-trial-and-subsequent-analyses-pmid-38397743" },
      { n: 6, citation: "Zhao Z, et al. Effectiveness and safety of hydrogen inhalation as an adjunct treatment in Chinese type 2 diabetes patients: a retrospective, observational, double-arm, real-life clinical study. Front Endocrinol (Lausanne). 2023;13:1114221.", pmid: "36743938", doi: "10.3389/fendo.2022.1114221", ourStudyPath: "/study/effectiveness-and-safety-of-hydrogen-inhalation-as-an-adjunct-treatment-in-chinese-type-2-diabetes-patients-a-retrospective-observational-double-arm-real-life-clinical-study-pmid-36743938" },
      { n: 7, citation: "Ji H, et al. Real-world effectiveness and safety of hydrogen inhalation in Chinese patients with type 2 diabetes: a single-arm, retrospective study. Diabetes Metab Syndr Obes. 2023;16:2039-2050.", pmid: "37431394", doi: "10.2147/DMSO.S412898", ourStudyPath: "/study/real-world-effectiveness-and-safety-of-hydrogen-inhalation-in-chinese-patients-with-type-2-diabetes-a-single-arm-retrospective-study-pmid-37431394" },
      { n: 8, citation: "Kamimura N, et al. Molecular hydrogen improves obesity and diabetes by inducing hepatic FGF21 and stimulating energy metabolism in db/db mice. Obesity (Silver Spring). 2011;19(7):1396-403.", pmid: "21293445", doi: "10.1038/oby.2011.6", ourStudyPath: "/study/molecular-hydrogen-improves-obesity-and-diabetes-by-inducing-hepatic-fgf21-and-stimulating-energy-metabolism-in-dbdb-mice-pmid-21293445" },
      { n: 9, citation: "Han XC, et al. Hydrogen exerts neuroprotective effects by inhibiting oxidative stress in experimental diabetic peripheral neuropathy rats. Med Gas Res. 2023;13(2):72-77.", pmid: "36204786", doi: "10.4103/2045-9912.345171", ourStudyPath: "/study/hydrogen-exerts-neuroprotective-effects-by-inhibiting-oxidative-stress-in-experimental-diabetic-peripheral-neuropathy-rats-pmid-36204786" },
    ],
    ownerLink: { href: "/blog/molecular-hydrogen-benefits-guide-pillar#does-hydrogen-water-lower-cholesterol-or-blood-sugar", label: "Does hydrogen water lower cholesterol or blood sugar? From our evidence-graded benefits guide" },
    bridgeTopic: null,
    lastReviewed: "2026-11-05",
  },

  "fatty-liver-nafld": {
    slug: "fatty-liver-nafld",
    h1: "Hydrogen and Fatty Liver Disease (NAFLD): What the Studies Show",
    metaTitle: "Hydrogen Water and Fatty Liver (NAFLD) | Hydrogen Studies",
    metaDescription:
      "Hydrogen and fatty liver disease (NAFLD), graded: a few trials of 12 to 43 people, one with less liver fat on MRI and one with no enzyme change. Gaps.",
    evidenceGrade: "very low",
    introMarkdown: `*Hydrogen Studies is funded by Echo Technologies LLC, which sells hydrogen water products. Echo doesn't decide which studies we cover or how we describe them — see our [editorial policy](/editorial-policy).*

**Evidence at a glance: Very low.** A handful of small trials have tested hydrogen in people with fatty liver disease, each with 12 to 43 participants and 4 to 13 weeks of treatment. One found slightly less liver fat on MRI after 4 weeks of hydrogen water; another, 8 weeks long, found no significant change in liver enzymes. No trial has looked at liver scarring or long-term outcomes, and most positive findings come from mice.

This page covers non-alcoholic fatty liver disease (NAFLD), now often called metabolic dysfunction-associated steatotic liver disease (MASLD). Gradual weight loss, physical activity and treating diabetes and high cholesterol are the approaches with the strongest evidence. Talk to your doctor before adding anything, and don't replace your care. For blood fats, including a mouse study of a hydrogen compound taken with a statin, see our [cholesterol hub](/explore-by-condition/cholesterol).

## What have human trials found?

A few small, short trials found slightly less liver fat or small changes in lab measures, but liver enzymes didn't change consistently. None lasted longer than 13 weeks.

**Drinking hydrogen water**

- **12 adults with overweight and mild-to-moderate NAFLD, 4 weeks.** In a double-blind crossover trial, 1 liter a day of hydrogen-rich water reduced liver fat on MRI more than placebo water. AST, a liver enzyme, fell about 10%, but that change wasn't clearly different from no effect. Weight and body composition didn't differ. One author is affiliated with the Molecular Hydrogen Institute, a nonprofit that promotes hydrogen research [[1]](/study/hydrogen-rich-water-reduces-liver-fat-accumulation-and-improves-liver-enzyme-profiles-in-patients-with-non-alcoholic-fatty-liver-disease-a-randomized-controlled-pilot-trial-pmid-30982748).
- **30 adults with NAFLD, 8 weeks.** In a double-blind trial in Slovakia, hydrogen-rich water didn't significantly change liver enzymes. Weight (by about 1 kg) and blood lipids trended lower, and two oxidative-stress markers trended higher, all without statistical significance [[2]](/study/biological-effects-of-hydrogen-water-on-subjects-with-nafld-a-randomized-placebo-controlled-trial-pmid-36290657).
- **30 adults with NAFLD, 8 weeks (lab measures).** A paper from the same Slovak group, in which 17 patients drank water made with hydrogen tablets (three 330 mL servings a day) and 13 got placebo tablets, reported higher coenzyme Q10 in blood platelets and less of a blood marker of oxidation in the hydrogen group. These are lab measures, not liver outcomes [[3]](/study/the-effect-of-adjuvant-therapy-with-molecular-hydrogen-on-endogenous-coenzyme-q10-levels-and-platelet-mitochondrial-bioenergetics-in-patients-with-non-alcoholic-fatty-liver-disease-pmid-37569850).
- **Fatty liver in people with high fasting blood sugar, 8 weeks.** In a trial of 73 adults, 35 also had fatty liver on ultrasound at the start. It was no longer seen in 10 of 16 (63%) on hydrogen water and 6 of 19 (32%) on plain water, a difference the authors called marginally significant [[4]](/study/hydrogen-rich-water-ameliorates-metabolic-disorder-via-modifying-gut-microbiota-in-impaired-fasting-glucose-patients-a-randomized-controlled-study-pmid-37371975) (see our [type 2 diabetes hub](/explore-by-condition/type-2-diabetes)).

**Inhaled hydrogen**

- **43 adults with NAFLD, 13 weeks.** In a randomized, placebo-controlled trial in China, breathing a hydrogen-oxygen gas improved blood lipids and liver enzymes. Liver fat on ultrasound and CT improved significantly only in people with moderate-to-severe disease [[5]](/study/a-randomized-placebo-controlled-clinical-trial-of-hydrogenoxygen-inhalation-for-non-alcoholic-fatty-liver-disease-pmid-35734974).

**Pooled results**

- A 2024 meta-analysis of 8 randomized trials with 433 people who had various liver problems, not only fatty liver, found slight drops in the liver enzymes ALT, AST and ALP with hydrogen-rich water [[6]](https://pubmed.ncbi.nlm.nih.gov/40406427/).

## What do animal studies suggest (not human evidence)?

In mice, hydrogen water reduced fatty liver and liver inflammation. These results don't show the same happens in people.

- In mice fed a diet that causes fatty liver with inflammation (NASH), 8 weeks of hydrogen-rich water lowered liver inflammation, oxidative stress and liver-cell death, much like the diabetes drug pioglitazone. In a mouse model in which NASH leads to liver cancer, mice given hydrogen water had fewer liver tumors [[7]](/study/hydrogen-rich-water-prevents-progression-of-nonalcoholic-steatohepatitis-and-accompanying-hepatocarcinogenesis-in-mice-pmid-22505328).
- Obese, diabetic mice and mice on a high-fat diet that drank hydrogen water had less fatty liver [[8]](/study/molecular-hydrogen-improves-obesity-and-diabetes-by-inducing-hepatic-fgf21-and-stimulating-energy-metabolism-in-dbdb-mice-pmid-21293445).
- In rats given a chemical that causes liver failure and the brain complication of advanced liver disease (hepatic encephalopathy), hydrogen-rich water lowered blood ammonia and reduced damage to the liver and brain [[9]](/study/treatment-with-hydrogen-rich-water-protects-against-thioacetamide-induced-hepatic-encephalopathy-in-rats-through-stabilizing-liver-brain-disturbance-pmid-40410340). That is a model of severe, sudden liver injury, not of fatty liver.

## What doses and durations were studied?

No trial compared doses. Drinking trials used about 1 liter a day for 4 to 8 weeks, and the inhalation trial lasted 13 weeks.

- **Drinking:** 1 liter a day for 4 to 8 weeks [1][4]; hydrogen tablets in three 330 mL servings a day for 8 weeks [3].
- **Inhaling:** a hydrogen-oxygen gas for 13 weeks [5].

## What don't we know yet?

Whether hydrogen changes liver scarring or long-term outcomes, and how it compares with weight loss, the approach with the strongest evidence.

- **Liver scarring and long-term outcomes.** None of the trials above reported liver biopsy results or followed people for longer than 13 weeks [1]–[5].
- **Whether less liver fat lasts.** The MRI trial lasted 4 weeks per treatment [1].
- **How hydrogen compares with weight loss.** No trial compared it with diet or exercise.
- **Independence.** Several trials come from the same research groups or include authors affiliated with the Molecular Hydrogen Institute [1][2][3].

*Drafted with AI assistance and checked against each linked source by our editorial team. General information, not medical advice.*`,
    faqs: [
      {
        question: "Can hydrogen water reduce liver fat?",
        answer:
          "Possibly a little, but the evidence is very weak. In a 4-week crossover trial of 12 adults with mild-to-moderate fatty liver disease, liver fat on MRI fell more with 1 liter a day of hydrogen-rich water than with placebo water. An 8-week trial of 30 people found no significant change in liver enzymes. No trial has shown that hydrogen water reverses fatty liver disease.",
      },
      {
        question: "Does hydrogen water lower liver enzymes like ALT and AST?",
        answer:
          "Slightly, at most. A 2024 meta-analysis of 8 small randomized trials with 433 people who had various liver problems found small drops in ALT, AST and ALP with hydrogen-rich water. In an 8-week placebo-controlled trial of 30 people with fatty liver disease, liver enzymes didn't change significantly. Liver enzymes rise and fall for many reasons, so ask your doctor what your results mean.",
      },
      {
        question: "Has inhaled hydrogen been tested for fatty liver disease?",
        answer:
          "In one trial. In China, 43 adults with fatty liver disease breathed a hydrogen-oxygen gas or a placebo for 13 weeks. Blood lipids and liver enzymes improved, and liver fat on ultrasound and CT improved significantly only in people with moderate-to-severe disease. It is a single small trial from one research group, and hydrogen inhalation is not a standard liver treatment.",
      },
      {
        question: "Should people with fatty liver disease try hydrogen water?",
        answer:
          "Talk to your doctor first. Hydrogen water hasn't been shown to reverse fatty liver disease or prevent liver scarring, and the trials were small and lasted 4 to 13 weeks. Gradual weight loss, regular physical activity and managing diabetes and cholesterol are the approaches with the strongest evidence. Hydrogen water isn't a substitute for them or for regular follow-up of your liver.",
      },
    ],
    sources: [
      { n: 1, citation: "Korovljev D, et al. Hydrogen-rich water reduces liver fat accumulation and improves liver enzyme profiles in patients with non-alcoholic fatty liver disease: a randomized controlled pilot trial. Clin Res Hepatol Gastroenterol. 2019;43(6):688-693.", pmid: "30982748", doi: "10.1016/j.clinre.2019.03.008", ourStudyPath: "/study/hydrogen-rich-water-reduces-liver-fat-accumulation-and-improves-liver-enzyme-profiles-in-patients-with-non-alcoholic-fatty-liver-disease-a-randomized-controlled-pilot-trial-pmid-30982748" },
      { n: 2, citation: "Kura B, et al. Biological effects of hydrogen water on subjects with NAFLD: a randomized, placebo-controlled trial. Antioxidants (Basel). 2022;11(10):1935.", pmid: "36290657", doi: "10.3390/antiox11101935", ourStudyPath: "/study/biological-effects-of-hydrogen-water-on-subjects-with-nafld-a-randomized-placebo-controlled-trial-pmid-36290657" },
      { n: 3, citation: "Sumbalová Z, et al. The effect of adjuvant therapy with molecular hydrogen on endogenous coenzyme Q10 levels and platelet mitochondrial bioenergetics in patients with non-alcoholic fatty liver disease. Int J Mol Sci. 2023;24(15):12477.", pmid: "37569850", doi: "10.3390/ijms241512477", ourStudyPath: "/study/the-effect-of-adjuvant-therapy-with-molecular-hydrogen-on-endogenous-coenzyme-q10-levels-and-platelet-mitochondrial-bioenergetics-in-patients-with-non-alcoholic-fatty-liver-disease-pmid-37569850" },
      { n: 4, citation: "Liang B, et al. Hydrogen-rich water ameliorates metabolic disorder via modifying gut microbiota in impaired fasting glucose patients: a randomized controlled study. Antioxidants (Basel). 2023;12(6):1245.", pmid: "37371975", doi: "10.3390/antiox12061245", ourStudyPath: "/study/hydrogen-rich-water-ameliorates-metabolic-disorder-via-modifying-gut-microbiota-in-impaired-fasting-glucose-patients-a-randomized-controlled-study-pmid-37371975" },
      { n: 5, citation: "Tao G, et al. A randomized, placebo-controlled clinical trial of hydrogen/oxygen inhalation for non-alcoholic fatty liver disease. J Cell Mol Med. 2022;26(14):4113-4123.", pmid: "35734974", doi: "10.1111/jcmm.17456", ourStudyPath: "/study/a-randomized-placebo-controlled-clinical-trial-of-hydrogenoxygen-inhalation-for-non-alcoholic-fatty-liver-disease-pmid-35734974" },
      { n: 6, citation: "Khalili-Tanha G, et al. The impact of hydrogen-rich water on liver enzyme levels in clinical populations: a comprehensive review and meta-analysis. Gastroenterol Hepatol Bed Bench. 2024;17(4):338-348.", pmid: "40406427", doi: "10.22037/ghfbb.v17i4.2990", ourStudyPath: null },
      { n: 7, citation: "Kawai D, et al. Hydrogen-rich water prevents progression of nonalcoholic steatohepatitis and accompanying hepatocarcinogenesis in mice. Hepatology. 2012;56(3):912-21.", pmid: "22505328", doi: "10.1002/hep.25782", ourStudyPath: "/study/hydrogen-rich-water-prevents-progression-of-nonalcoholic-steatohepatitis-and-accompanying-hepatocarcinogenesis-in-mice-pmid-22505328" },
      { n: 8, citation: "Kamimura N, et al. Molecular hydrogen improves obesity and diabetes by inducing hepatic FGF21 and stimulating energy metabolism in db/db mice. Obesity (Silver Spring). 2011;19(7):1396-403.", pmid: "21293445", doi: "10.1038/oby.2011.6", ourStudyPath: "/study/molecular-hydrogen-improves-obesity-and-diabetes-by-inducing-hepatic-fgf21-and-stimulating-energy-metabolism-in-dbdb-mice-pmid-21293445" },
      { n: 9, citation: "Wang X, et al. Treatment with hydrogen-rich water protects against thioacetamide-induced hepatic encephalopathy in rats through stabilizing liver-brain disturbance. Sci Rep. 2025;15(1):17901.", pmid: "40410340", doi: "10.1038/s41598-025-02891-2", ourStudyPath: "/study/treatment-with-hydrogen-rich-water-protects-against-thioacetamide-induced-hepatic-encephalopathy-in-rats-through-stabilizing-liver-brain-disturbance-pmid-40410340" },
    ],
    ownerLink: { href: "/blog/molecular-hydrogen-benefits-guide-pillar#does-molecular-hydrogen-therapy-treat-any-disease", label: "Does molecular hydrogen therapy treat any disease? From our evidence-graded benefits guide" },
    bridgeTopic: null,
    lastReviewed: "2026-11-05",
  },

  "weight-loss-metabolism": {
    slug: "weight-loss-metabolism",
    h1: "Hydrogen Water, Weight Loss and Metabolism: What the Studies Show",
    metaTitle: "Does Hydrogen Water Help Weight Loss? | Hydrogen Studies",
    metaDescription:
      "Hydrogen water and weight loss, graded: in placebo-controlled trials, body weight didn't differ; small studies saw fewer cravings or less body fat. Gaps.",
    evidenceGrade: "very low",
    introMarkdown: `*Hydrogen Studies is funded by Echo Technologies LLC, which sells hydrogen water products. Echo doesn't decide which studies we cover or how we describe them — see our [editorial policy](/editorial-policy).*

**Evidence at a glance: Very low.** No trial has shown that hydrogen water causes meaningful weight loss. In placebo-controlled trials of 4 and 8 weeks, body weight didn't differ from placebo, and a 24-week trial in metabolic syndrome reported only a trend toward a mild drop in BMI. A few small trials reported slightly less body fat, fewer food cravings or smaller waists, mostly as secondary or subgroup findings.

This page covers body weight, body fat, appetite and metabolism. Lasting weight loss comes from changes in eating and activity and, for some people, medicine or surgery; talk to your doctor about what fits you. For blood fats in people with overweight, see our [cholesterol hub](/explore-by-condition/cholesterol); for liver fat, see our [fatty liver hub](/explore-by-condition/fatty-liver-nafld).

## What have human trials found?

No trial has shown meaningful weight loss. Body weight didn't differ from placebo in the placebo-controlled trials; a few small trials reported slightly less body fat or fewer food cravings, mostly as secondary findings.

**Drinking hydrogen water**

- **36 adults with obesity, 8 weeks.** People drank 1 liter a day of hydrogen-rich water (15 mg of hydrogen) or placebo water. Weight and body composition didn't differ between groups; men on hydrogen lost about 2 kg from their starting weight, but that wasn't significantly different from placebo. Food-craving scores, the main outcome, fell more with hydrogen, and blood levels of GLP-1, an appetite hormone, rose. The drinks were supplied by a hydrogen products company that employs one of the authors [[1]](/study/the-effects-of-8-week-hydrogen-rich-water-consumption-on-appetite-body-composition-sleep-quality-and-circulating-glucagon-like-peptide-1-in-obese-men-and-women-hydrappet-a-randomized-controlled-trial-pmid-40731927).
- **10 women with overweight, 4 weeks.** In a crossover trial, caplets of hydrogen-generating minerals didn't change weight, BMI or body measurements compared with placebo, but body fat percentage fell more (3.2% vs 0.9%, p = 0.05), as did triglycerides [[2]](/study/molecular-hydrogen-affects-body-composition-metabolic-profiles-and-mitochondrial-function-in-middle-aged-overweight-women-pmid-28560519).
- **60 adults with metabolic syndrome, 24 weeks.** Water made with hydrogen-producing tablets lowered cholesterol and blood sugar compared with placebo water, with a trend toward a mild drop in BMI and waist-to-hip ratio [[3]](/study/the-effects-of-24-week-high-concentration-hydrogen-rich-water-on-body-composition-blood-lipid-profiles-and-inflammation-biomarkers-in-men-and-women-with-metabolic-syndrome-a-randomized-controlled-trial-pmid-32273740).
- **181 adults with metabolic or pre-metabolic syndrome, 3 months.** Waist size fell more with electrolyzed hydrogen water than with filtered water only in a subgroup of people who were also very physically active. One author works for the device maker [[4]](/study/health-effects-of-electrolyzed-hydrogen-water-for-the-metabolic-syndrome-and-pre-metabolic-syndrome-a-3-month-randomized-controlled-trial-and-subsequent-analyses-pmid-38397743).
- **61 healthy workers, 8 weeks.** By the authors' analysis, fat mass fell more in people who drank 1.5 liters a day of electrolyzed-reduced water than in those who drank mineral water. The abstract doesn't report how much hydrogen the water contained [[5]](/study/outcomes-assessment-of-sustainable-and-innovatively-simple-lifestyle-modification-at-the-workplace-drinking-electrolyzed-reduced-water-oasis-erw-a-randomized-double-blind-placebo-controlled-trial-pmid-32605142).
- **30 adults with fatty liver disease, 8 weeks.** Weight trended about 1 kg lower with hydrogen-rich water, without statistical significance [[6]](/study/biological-effects-of-hydrogen-water-on-subjects-with-nafld-a-randomized-placebo-controlled-trial-pmid-36290657).

**Inhaled hydrogen**

- **20 young women, one 60-minute session.** Breathing hydrogen at rest lowered the respiratory exchange ratio compared with air, a sign that the body was burning relatively more fat than carbohydrate during that hour. The study measured one hour, not body weight [[7]](/study/molecular-hydrogen-inhalation-modulates-resting-metabolism-in-healthy-females-findings-from-a-randomized-double-blind-placebo-controlled-crossover-study-pmid-39923133).

**Pooled results**

- We found no meta-analysis of body weight. A 2026 analysis of 13 trials in adults with overweight or obesity pooled blood fats only, and found small drops in total and LDL cholesterol [[8]](/study/the-effect-of-hydrogen-rich-water-interventions-on-lipid-profiles-in-adults-with-overweight-or-obesity-and-associated-metabolic-disorders-a-systematic-review-and-meta-analysis-of-randomized-controlled-trials-pmid-41888952).

## What do animal studies suggest (not human evidence)?

Obese, diabetic mice gained less weight on hydrogen water. That isn't evidence for people.

- Obese, diabetic mice (db/db mice) that drank hydrogen water long term gained less fat and body weight without eating or drinking more, and used more oxygen, a sign of higher energy use [[9]](/study/molecular-hydrogen-improves-obesity-and-diabetes-by-inducing-hepatic-fgf21-and-stimulating-energy-metabolism-in-dbdb-mice-pmid-21293445).

## What doses and durations were studied?

No trial compared doses. Trials used 1 to 1.5 liters a day, or about 11 to 15 mg of hydrogen a day, for 4 to 24 weeks.

- **Drinking:** 1 to 1.5 liters a day [1][5]; about 11 to 15 mg of hydrogen a day [1][3]; from 4 weeks to 24 weeks [2][3].
- **Inhaling:** a single 60-minute session at rest [7].

## What don't we know yet?

Whether hydrogen has any effect on body weight at all, and for whom.

- **Whether there is any effect on weight.** The two trials built around body composition found no weight difference from placebo [1][2].
- **Who it applies to.** The trials were small and mostly in adults with obesity, overweight or metabolic syndrome.
- **Longer use.** The longest trial lasted 24 weeks [3].
- **Independence.** Three trials come from one Serbian lab or its collaborators [1][2][3], and three used products or had authors from hydrogen companies [1][3][4].

*Drafted with AI assistance and checked against each linked source by our editorial team. General information, not medical advice.*`,
    faqs: [
      {
        question: "Does hydrogen water burn fat?",
        answer:
          "Not in any way shown to matter for weight. In a 4-week trial of 10 women with overweight, body fat percentage fell slightly more with hydrogen-generating caplets than with placebo, but weight didn't change. In 20 young women, breathing hydrogen for an hour shifted the body slightly toward burning fat at rest. Neither shows that hydrogen leads to fat loss over months.",
      },
      {
        question: "Does hydrogen water reduce appetite or cravings?",
        answer:
          "One small trial found fewer cravings. In 36 adults with obesity, 8 weeks of hydrogen-rich water lowered food-craving scores more than placebo water and raised the appetite hormone GLP-1, but body weight didn't differ between groups. Cravings were self-reported, it is a single trial, and the drinks came from a hydrogen products company. Hydrogen water is not comparable to GLP-1 medicines.",
      },
      {
        question: "Is hydrogen water better than plain water for weight loss?",
        answer:
          "There's no good evidence that it is. In placebo-controlled trials of 4 and 8 weeks, people drinking hydrogen water didn't lose more weight than people drinking placebo water, and a 24-week trial in metabolic syndrome found only a trend toward a mild drop in BMI. Drinking water instead of sugary drinks can cut calories, whether or not the water contains hydrogen.",
      },
      {
        question: "Does hydrogen water boost metabolism?",
        answer:
          "Not in a way shown to affect weight. In mice bred to become obese and diabetic, long-term hydrogen water raised oxygen use and lowered body weight without the mice eating less. In people, the only direct measurement we found was one hour of breathing hydrogen, which shifted fuel use toward fat at rest in 20 young women. Neither shows that hydrogen water speeds up metabolism over time.",
      },
    ],
    sources: [
      { n: 1, citation: "Todorovic N, et al. The effects of 8-week hydrogen-rich water consumption on appetite, body composition, sleep quality, and circulating glucagon-like peptide-1 in obese men and women (HYDRAPPET): a randomized controlled trial. Medicina (Kaunas). 2025;61(7):1299.", pmid: "40731927", doi: "10.3390/medicina61071299", ourStudyPath: "/study/the-effects-of-8-week-hydrogen-rich-water-consumption-on-appetite-body-composition-sleep-quality-and-circulating-glucagon-like-peptide-1-in-obese-men-and-women-hydrappet-a-randomized-controlled-trial-pmid-40731927" },
      { n: 2, citation: "Korovljev D, et al. Molecular hydrogen affects body composition, metabolic profiles, and mitochondrial function in middle-aged overweight women. Ir J Med Sci. 2017 (issue 2018;187(1):85-89).", pmid: "28560519", doi: "10.1007/s11845-017-1638-4", ourStudyPath: "/study/molecular-hydrogen-affects-body-composition-metabolic-profiles-and-mitochondrial-function-in-middle-aged-overweight-women-pmid-28560519" },
      { n: 3, citation: "LeBaron TW, et al. The effects of 24-week, high-concentration hydrogen-rich water on body composition, blood lipid profiles and inflammation biomarkers in men and women with metabolic syndrome: a randomized controlled trial. Diabetes Metab Syndr Obes. 2020;13:889-896.", pmid: "32273740", doi: "10.2147/DMSO.S240122", ourStudyPath: "/study/the-effects-of-24-week-high-concentration-hydrogen-rich-water-on-body-composition-blood-lipid-profiles-and-inflammation-biomarkers-in-men-and-women-with-metabolic-syndrome-a-randomized-controlled-trial-pmid-32273740" },
      { n: 4, citation: "Moribe R, et al. Health effects of electrolyzed hydrogen water for the metabolic syndrome and pre-metabolic syndrome: a 3-month randomized controlled trial and subsequent analyses. Antioxidants (Basel). 2024;13(2):145.", pmid: "38397743", doi: "10.3390/antiox13020145", ourStudyPath: "/study/health-effects-of-electrolyzed-hydrogen-water-for-the-metabolic-syndrome-and-pre-metabolic-syndrome-a-3-month-randomized-controlled-trial-and-subsequent-analyses-pmid-38397743" },
      { n: 5, citation: "Choi YA, et al. Outcomes assessment of sustainable and innovatively simple lifestyle modification at the workplace: drinking electrolyzed-reduced water (OASIS-ERW): a randomized, double-blind, placebo-controlled trial. Antioxidants (Basel). 2020;9(7):564.", pmid: "32605142", doi: "10.3390/antiox9070564", ourStudyPath: "/study/outcomes-assessment-of-sustainable-and-innovatively-simple-lifestyle-modification-at-the-workplace-drinking-electrolyzed-reduced-water-oasis-erw-a-randomized-double-blind-placebo-controlled-trial-pmid-32605142" },
      { n: 6, citation: "Kura B, et al. Biological effects of hydrogen water on subjects with NAFLD: a randomized, placebo-controlled trial. Antioxidants (Basel). 2022;11(10):1935.", pmid: "36290657", doi: "10.3390/antiox11101935", ourStudyPath: "/study/biological-effects-of-hydrogen-water-on-subjects-with-nafld-a-randomized-placebo-controlled-trial-pmid-36290657" },
      { n: 7, citation: "Grepl P, et al. Molecular hydrogen inhalation modulates resting metabolism in healthy females: findings from a randomized, double-blind, placebo-controlled crossover study. Med Gas Res. 2025;15(3):367-373.", pmid: "39923133", doi: "10.4103/mgr.MEDGASRES-D-24-00085", ourStudyPath: "/study/molecular-hydrogen-inhalation-modulates-resting-metabolism-in-healthy-females-findings-from-a-randomized-double-blind-placebo-controlled-crossover-study-pmid-39923133" },
      { n: 8, citation: "Ye H, et al. The effect of hydrogen-rich water interventions on lipid profiles in adults with overweight or obesity and associated metabolic disorders: a systematic review and meta-analysis of randomized controlled trials. Diabetol Metab Syndr. 2026;18(1).", pmid: "41888952", doi: "10.1186/s13098-026-02124-0", ourStudyPath: "/study/the-effect-of-hydrogen-rich-water-interventions-on-lipid-profiles-in-adults-with-overweight-or-obesity-and-associated-metabolic-disorders-a-systematic-review-and-meta-analysis-of-randomized-controlled-trials-pmid-41888952" },
      { n: 9, citation: "Kamimura N, et al. Molecular hydrogen improves obesity and diabetes by inducing hepatic FGF21 and stimulating energy metabolism in db/db mice. Obesity (Silver Spring). 2011;19(7):1396-403.", pmid: "21293445", doi: "10.1038/oby.2011.6", ourStudyPath: "/study/molecular-hydrogen-improves-obesity-and-diabetes-by-inducing-hepatic-fgf21-and-stimulating-energy-metabolism-in-dbdb-mice-pmid-21293445" },
    ],
    ownerLink: { href: "/blog/molecular-hydrogen-benefits-guide-pillar", label: "Hydrogen water benefits, graded by evidence" },
    bridgeTopic: null,
    lastReviewed: "2026-11-05",
  },

  "gut-health": {
    slug: "gut-health",
    h1: "Hydrogen Water and Gut Health: What the Studies Show",
    metaTitle: "Hydrogen Water for Gut Health, Graded | Hydrogen Studies",
    metaDescription:
      "Hydrogen water and gut health, graded: small, short trials, mostly of alkaline electrolyzed water, saw normal stools or gut bacteria shifts, not treatment.",
    evidenceGrade: "very low",
    introMarkdown: `*Hydrogen Studies is funded by Echo Technologies LLC, which sells hydrogen water products. Echo doesn't decide which studies we cover or how we describe them — see our [editorial policy](/editorial-policy).*

**Evidence at a glance: Very low.** Human studies of hydrogen and the gut are small and short, and most tested alkaline electrolyzed water, which differs from plain water in pH as well as hydrogen. Some found more normal stools or shifts in gut bacteria; none showed that hydrogen treats a digestive disease. In the only trial in ulcerative colitis, with 10 patients, inhaled hydrogen had no clear treatment effect.

This page covers digestion, bowel habits and the gut microbiome (the bacteria living in the intestine). Diarrhea or constipation that lasts, belly pain, blood in the stool or unexplained weight loss deserve a medical checkup. If you have IBS or inflammatory bowel disease, talk to your doctor before trying hydrogen, and don't change your treatment. See also our [digestive health research overview](/hydrogen-for/gut-health).

## What have human trials found?

Small, short trials, mostly of alkaline electrolyzed water, found more normal stools or shifts in gut bacteria. One trial in acid reflux reported better symptom scores when electrolyzed water was added to standard medicine, but none showed that hydrogen treats a digestive disease.

**Alkaline electrolyzed water that contains hydrogen**

- **20 healthy men, 2 weeks.** In a double-blind trial in Japan, 500 mL a day of alkaline electrolyzed water (0.3 mg of hydrogen per liter, pH 9.5) shifted stool consistency toward "normal" on a standard stool chart and raised Bifidobacterium, a common gut bacterium, compared with purified water. Overall gut bacterial diversity didn't change. The lead author works for Panasonic, which made the water device [[1]](/study/the-effects-of-ingestion-of-hydrogen-dissolved-alkaline-electrolyzed-water-on-stool-consistency-and-gut-microbiota-a-double-blind-randomized-trial-pmid-34213495).
- **60 healthy adults, 4 weeks.** In a double-blind trial, 500 mL or more a day of alkaline electrolyzed water (0.2 mg of hydrogen per liter, pH 9.2) didn't clearly change stomach or bowel symptoms compared with purified water, though stools became slightly more normal in the electrolyzed water group. Two authors work for Panasonic [[2]](/study/daily-ingestion-of-alkaline-electrolyzed-water-containing-hydrogen-influences-human-health-including-gastrointestinal-symptoms-pmid-30713669).
- **84 adults with acid reflux (GERD), 3 months.** Everyone took a standard acid-reducing medicine (a proton pump inhibitor) and drank either electrolyzed reduced water or tap water. Heartburn and regurgitation scores improved more, and blood markers of oxidative stress were better, with the electrolyzed water. The abstract doesn't say whether patients were randomized or blinded, or how much hydrogen the water contained [[8]](/study/modulation-of-the-oxidative-plasmatic-state-in-gastroesophageal-reflux-disease-with-the-addition-of-rich-water-molecular-hydrogen-a-new-biological-vision-pmid-29512923).
- **27 adults with diarrhea-predominant IBS, 8 weeks.** At least 2 liters a day of alkaline-reduced water improved IBS quality-of-life scores more than placebo water, but abdominal pain, and the share of people reporting relief for most weeks (62% vs 43%), didn't differ significantly. The abstract doesn't report the water's hydrogen content [[3]](/study/effects-of-alkaline-reduced-drinking-water-on-irritable-bowel-syndrome-with-diarrhea-a-randomized-double-blind-placebo-controlled-pilot-study-pmid-29849734).

**Hydrogen-rich water**

- **73 adults with high fasting blood sugar, 8 weeks.** One liter a day of hydrogen-rich water shifted the mix of gut bacteria compared with plain water. Digestive symptoms weren't the focus [[4]](/study/hydrogen-rich-water-ameliorates-metabolic-disorder-via-modifying-gut-microbiota-in-impaired-fasting-glucose-patients-a-randomized-controlled-study-pmid-37371975) (see our [type 2 diabetes hub](/explore-by-condition/type-2-diabetes)).
- **Young female soccer players, 2 months.** Measures of gut bacterial diversity rose with hydrogen-rich water, but the groups already differed before the study started, and the overall makeup of their gut bacteria didn't change significantly [[5]](/study/effects-of-the-long-term-consumption-of-hydrogen-rich-water-on-the-antioxidant-activity-and-the-gut-flora-in-female-juvenile-soccer-players-from-suzhou-china-pmid-30713665).

**Inhaled hydrogen**

- **10 adults with active ulcerative colitis, 8 weeks.** In a double-blind trial in Japan, 5 people inhaled 5–6% hydrogen and 5 inhaled air, 4 hours a day. Gut bacteria changed more in the hydrogen group and endoscopy scores improved more, but symptom scores didn't differ, and the authors saw no clear treatment effect. The inhalers came from a hydrogen device company [[6]](/study/hydrogen-gas-inhalation-improved-intestinal-microbiota-in-ulcerative-colitis-a-randomised-double-blind-placebo-controlled-trial-pmid-40868053).

## What do animal studies suggest (not human evidence)?

In mice with chemically induced colitis, hydrogen water limited colon inflammation. That colitis develops in days, unlike human inflammatory bowel disease, so this isn't human evidence.

- In mice given a chemical in their drinking water that inflames the colon, a common model of inflammatory bowel disease, adding hydrogen to the water for the same 7 days limited weight loss, colon shortening and colon inflammation [[7]](/study/hydrogen-mediates-suppression-of-colon-inflammation-induced-by-dextran-sodium-sulfate-pmid-19486890).

## What doses and durations were studied?

No trial compared doses. Most drinking trials used about 500 mL a day of alkaline electrolyzed water for 2 to 4 weeks.

- **Alkaline electrolyzed water:** about 500 mL a day, with 0.2 to 0.3 mg of hydrogen per liter, for 2 to 4 weeks [1][2]; at least 2 liters a day of alkaline-reduced water for 8 weeks [3]; electrolyzed reduced water alongside a proton pump inhibitor for 3 months [8].
- **Hydrogen-rich water:** 1 liter a day for 8 weeks [4].
- **Inhaling:** 5–6% hydrogen, 4 hours a day for 8 weeks [6].

## What don't we know yet?

Whether any benefit comes from hydrogen rather than alkalinity, and whether hydrogen helps any digestive disease.

- **Hydrogen or alkalinity?** Most drinking trials used alkaline electrolyzed or reduced water, so their results can't be credited to hydrogen alone [1][2][3][8].
- **Digestive diseases.** We found no trial in Crohn's disease, and the only ulcerative colitis trial had 10 patients [6].
- **What gut bacteria shifts mean.** The changes seen [1][4][5] haven't been linked to better digestion or health.
- **Independence.** Three trials list authors or devices from companies that make hydrogen water or inhalers [1][2][6].

*Drafted with AI assistance and checked against each linked source by our editorial team. General information, not medical advice.*`,
    faqs: [
      {
        question: "Does hydrogen water change your gut bacteria?",
        answer:
          "Possibly, in small ways. In a 2-week trial of 20 healthy men, alkaline electrolyzed water containing hydrogen raised Bifidobacterium, a common gut bacterium, but didn't change overall diversity. In 73 adults with high fasting blood sugar, 8 weeks of hydrogen-rich water shifted the mix of gut bacteria compared with plain water. No study has shown that these shifts improve digestion or health.",
      },
      {
        question: "Can hydrogen help IBS or ulcerative colitis?",
        answer:
          "It hasn't been shown to. In 27 adults with diarrhea-predominant IBS, alkaline-reduced water improved quality-of-life scores more than placebo water, but abdominal pain didn't differ. In 10 people with ulcerative colitis, 8 weeks of inhaled hydrogen changed gut bacteria but had no clear treatment effect. Most positive colitis results come from mice. If you have IBS or inflammatory bowel disease, stay with the plan you have made with your doctor.",
      },
      {
        question: "Does hydrogen water help with constipation?",
        answer:
          "There's no good evidence that it does. In 20 healthy men, 2 weeks of alkaline electrolyzed water containing hydrogen shifted stool consistency toward normal on a standard stool chart, and a 4-week trial in 60 healthy adults saw stools become slightly more normal. Neither trial enrolled people with constipation. Fiber, fluids and activity are the usual first steps; see a doctor if constipation is new or lasting.",
      },
      {
        question: "Is alkaline electrolyzed water the same as hydrogen water?",
        answer:
          "Not exactly. Alkaline electrolyzed water is made by passing an electric current through water. It contains some dissolved hydrogen, about 0.2 to 0.3 mg per liter in the gut trials, but it is also strongly alkaline, around pH 9 to 9.5. Because most gut trials used this kind of water, their results can't be credited to hydrogen alone.",
      },
    ],
    sources: [
      { n: 1, citation: "Tanaka Y, et al. The effects of ingestion of hydrogen-dissolved alkaline electrolyzed water on stool consistency and gut microbiota: a double-blind randomized trial. Med Gas Res. 2021;11(4):138-144.", pmid: "34213495", doi: "10.4103/2045-9912.318858", ourStudyPath: "/study/the-effects-of-ingestion-of-hydrogen-dissolved-alkaline-electrolyzed-water-on-stool-consistency-and-gut-microbiota-a-double-blind-randomized-trial-pmid-34213495" },
      { n: 2, citation: "Tanaka Y, et al. Daily ingestion of alkaline electrolyzed water containing hydrogen influences human health, including gastrointestinal symptoms. Med Gas Res. 2018;8(4):160-166.", pmid: "30713669", doi: "10.4103/2045-9912.248267", ourStudyPath: "/study/daily-ingestion-of-alkaline-electrolyzed-water-containing-hydrogen-influences-human-health-including-gastrointestinal-symptoms-pmid-30713669" },
      { n: 3, citation: "Shin DW, et al. Effects of alkaline-reduced drinking water on irritable bowel syndrome with diarrhea: a randomized double-blind, placebo-controlled pilot study. Evid Based Complement Alternat Med. 2018;2018:9147914.", pmid: "29849734", doi: "10.1155/2018/9147914", ourStudyPath: "/study/effects-of-alkaline-reduced-drinking-water-on-irritable-bowel-syndrome-with-diarrhea-a-randomized-double-blind-placebo-controlled-pilot-study-pmid-29849734" },
      { n: 4, citation: "Liang B, et al. Hydrogen-rich water ameliorates metabolic disorder via modifying gut microbiota in impaired fasting glucose patients: a randomized controlled study. Antioxidants (Basel). 2023;12(6):1245.", pmid: "37371975", doi: "10.3390/antiox12061245", ourStudyPath: "/study/hydrogen-rich-water-ameliorates-metabolic-disorder-via-modifying-gut-microbiota-in-impaired-fasting-glucose-patients-a-randomized-controlled-study-pmid-37371975" },
      { n: 5, citation: "Sha JB, et al. Effects of the long-term consumption of hydrogen-rich water on the antioxidant activity and the gut flora in female juvenile soccer players from Suzhou, China. Med Gas Res. 2018;8(4):135-143.", pmid: "30713665", doi: "10.4103/2045-9912.248263", ourStudyPath: "/study/effects-of-the-long-term-consumption-of-hydrogen-rich-water-on-the-antioxidant-activity-and-the-gut-flora-in-female-juvenile-soccer-players-from-suzhou-china-pmid-30713665" },
      { n: 6, citation: "Maruyama T, et al. Hydrogen gas inhalation improved intestinal microbiota in ulcerative colitis: a randomised double-blind placebo-controlled trial. Biomedicines. 2025;13(8):1799.", pmid: "40868053", doi: "10.3390/biomedicines13081799", ourStudyPath: "/study/hydrogen-gas-inhalation-improved-intestinal-microbiota-in-ulcerative-colitis-a-randomised-double-blind-placebo-controlled-trial-pmid-40868053" },
      { n: 7, citation: "Kajiya M, et al. Hydrogen mediates suppression of colon inflammation induced by dextran sodium sulfate. Biochem Biophys Res Commun. 2009;386(1):11-5.", pmid: "19486890", doi: "10.1016/j.bbrc.2009.05.117", ourStudyPath: "/study/hydrogen-mediates-suppression-of-colon-inflammation-induced-by-dextran-sodium-sulfate-pmid-19486890" },
      { n: 8, citation: "Franceschelli S, et al. Modulation of the oxidative plasmatic state in gastroesophageal reflux disease with the addition of rich water molecular hydrogen: a new biological vision. J Cell Mol Med. 2018;22(5):2750-2759.", pmid: "29512923", doi: "10.1111/jcmm.13569", ourStudyPath: "/study/modulation-of-the-oxidative-plasmatic-state-in-gastroesophageal-reflux-disease-with-the-addition-of-rich-water-molecular-hydrogen-a-new-biological-vision-pmid-29512923" },
    ],
    ownerLink: { href: "/hydrogen-for/gut-health", label: "Hydrogen and digestive health: what the research tested" },
    bridgeTopic: null,
    lastReviewed: "2026-11-05",
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
 * JSON-LD for a hub with an intro — page meta and the SPA emit exactly this
 * (the BreadcrumbList is added by page meta, which knows the hub's name).
 * Only what the page shows: the H1, the byline's team + "Updated" date
 * (dateModified; no reviewedBy — no named reviewer), and the visible FAQ
 * (FAQPage).
 */
export function conditionHubJsonLd(
  intro: ConditionHubIntro,
  opts: { canonical: string; siteUrl: string },
): Record<string, any>[] {
  const by = conditionHubByline(intro);
  const page: Record<string, any> = {
    "@context": "https://schema.org",
    // A medical topic page that lists studies (PLAN 3.5). `about:
    // MedicalCondition` and reviewedBy wait for the named reviewer (4.8).
    "@type": ["MedicalWebPage", "CollectionPage"],
    name: intro.h1,
    description: intro.metaDescription,
    url: opts.canonical,
    ...(by.date ? { dateModified: by.date.toISOString() } : {}),
    author: { "@type": "Organization", name: EDITORIAL_TEAM, url: `${opts.siteUrl}/editorial-policy` },
    publisher: { "@type": "Organization", name: SITE_NAME, url: opts.siteUrl },
  };
  return [page, faqPageJsonLd(intro.faqs)];
}
