# Living review protocol — Molecular hydrogen and exercise performance and recovery

Version 1.0 · written 2026-11-25, before any data were pooled · PLAN.md §6.1

This protocol is fixed before synthesis. Any later change is logged in the change table at the bottom
with its date and reason, and the published page links here.

## 1. Question

In humans doing exercise, does molecular hydrogen (H2), compared with a placebo or control, change
exercise performance, perceived exertion, or markers of fatigue and recovery?

| | |
|---|---|
| **Population** | Adults or adolescents performing an acute exercise bout or a training programme: untrained, trained, athletes, older adults. Trials where exercise is part of treating a disease (post-COVID rehab, COPD, cardiac rehab) are excluded and kept for a separate review. |
| **Intervention** | Exogenous H2 by any route: H2-rich water, H2-producing tablets or sticks, H2 gas inhalation, H2 bathing. Electrolyzed or alkaline-reduced water is included only when dissolved H2 is reported. Any dose, acute or repeated. |
| **Comparator** | Placebo (plain, degassed or deaerated water; placebo tablet; air or placebo gas) or no-treatment control. |
| **Outcomes** | See §4. |
| **Design** | Randomized controlled trials, parallel or crossover. A trial that never states its allocation or order was random counts as not randomized. Non-randomized and uncontrolled trials are listed but not pooled. |

## 2. Sources and search

1. The Hydrogen Studies corpus: every non-excluded human trial with `study_design` in (`rct`,
   `controlled_trial`) whose title, conditions or keywords match exercise terms (query in
   `scripts/research/living-review-candidates.ts`). The corpus is itself built from PubMed and
   Europe PMC hydrogen searches.
2. Each update re-runs the corpus query and a PubMed search:
   `(hydrogen-rich water OR molecular hydrogen OR hydrogen gas OR hydrogen inhalation OR "hydrogen water") AND (exercise OR athlete* OR fatigue OR lactate OR endurance OR sprint OR "muscle damage")`, filtered to clinical trials.
3. Reference lists of included trials and of published meta-analyses on the same question are checked
   for trials the searches missed.

## 3. Screening and extraction

- **Title screen** removes records that are plainly off-question (no exercise, disease rehab,
  commentary, H2 not the intervention). Reasons are recorded per record.
- **Full-text eligibility** is judged from the full text. Records without accessible full text are
  listed as "full text not retrieved" in the flow diagram, not silently dropped.
- **Extraction** uses a fixed form (`extraction-form.md`). A first pass is machine-assisted: an AI
  model reads the open-access full text and records each value with its source location (table, row).
  A second, independent pass re-checks every number against the paper. The named reviewer spot-checks
  extracted values before each version is published. The page states this plainly.
- Values shown only in figures are **not** digitized. They are recorded as "figure only" and the
  trial counts toward the narrative summary but not the pooled estimate.
- Reported dispersion is stored exactly as published (SD, SE or 95% CI). Conversion to SD happens in
  code (`shared/meta-analysis.ts`) so it can be audited.

## 4. Outcomes

Primary (each pooled separately; one result per trial per outcome):

1. **Endurance performance**: time to exhaustion, time-trial time, total work or distance.
2. **Blood lactate** immediately after (or at the end of) the exercise test.
3. **Rating of perceived exertion (RPE)** at the end of, or during the final stage of, the test.

Secondary: power and strength (peak or mean power, jump height, sprint time, sprint decrement);
muscle-damage markers (creatine kinase at ~24 h); muscle soreness; heart rate; VO2 and ventilation;
exercise-induced oxidative-stress and inflammation markers.

Timepoint rules when a trial reports several: lactate immediately post-exercise; CK closest to 24 h;
RPE at the end of the test; performance from the main test named in the paper's aims. Where a trial
reports several measures in the same outcome, the one named primary by the authors is used; otherwise
the first listed.

## 5. Effect measure and synthesis

- **Effect size**: standardized mean difference, Hedges' g. Sign is set so a positive g always favours
  hydrogen (lower lactate, lower RPE, longer time to exhaustion all count as positive).
- Final values are used. Change scores are used only when final values are unavailable. SMDs from
  the two are not mixed in the same pooled analysis.
- **Crossover trials** are analysed as if they were parallel trials (Cochrane Handbook 23.2.6). This
  ignores the within-person correlation, so it overstates uncertainty. That is the conservative
  choice. A sensitivity analysis uses paired data where the trial reports it.
- **Pooling** happens only when ≥5 RCTs report the outcome (PLAN §6.1). Below that, the outcome gets a
  narrative summary and a forest plot without a diamond.
- **Model**: random-effects, DerSimonian–Laird τ², Hartung–Knapp–Sidik–Jonkman 95% CI; 95%
  prediction interval when k ≥ 3. Heterogeneity is reported as τ², Q and I².
- **Pre-specified subgroups**: route (drink vs inhaled); timing (single dose vs repeated ≥ 7 days);
  participants (trained vs untrained).
- **Sensitivity**: excluding high risk-of-bias trials; excluding trials funded by or with authors
  employed by H2 product companies; leave-one-out.
- **Small-study effects**: funnel plot and Egger's test only when k ≥ 10.

## 6. Risk of bias and certainty

- **Risk of bias**: Cochrane RoB 2, five domains (randomization, deviations, missing data, measurement,
  selective reporting), per trial per outcome where they differ. Crossover trials also get
  carry-over and period effects noted.
- **Certainty**: GRADE per pooled outcome, starting at high for RCTs and rating down for risk of bias,
  inconsistency, indirectness, imprecision and publication bias. The page shows the GRADE table with
  reasons for every downgrade.

## 7. Updating

- **Cadence**: the candidate query and the PubMed search re-run quarterly, and whenever a new eligible
  trial is added to the corpus.
- **Versioning**: each update is a new version number with its date, what changed (trials added,
  values corrected), and whether the conclusion changed. Old versions stay readable.
- Data and code are public: the extraction file and the engine are in the repository, and the page
  links the dataset.

## 8. Conflicts of interest

Hydrogen Studies is funded by Echo Technologies LLC, which sells hydrogen water products. Echo had no
role in choosing outcomes or methods. This protocol was fixed before pooling. Every trial is reported,
including null and negative results. The page carries the standard funding disclosure.

## 9. Change log

| Date | Version | Change | Reason |
|---|---|---|---|
| 2026-11-25 | 1.0 | Protocol written | — |
| 2026-11-25 | 1.1 | §1 Design: "never states random allocation → not randomized" written out | Two crossover trials (Todorovic 2020, Kawamura 2016) say only "crossover"; the rule is applied to both the same way. Clarifies the existing criterion; no outcome or method changed. |
