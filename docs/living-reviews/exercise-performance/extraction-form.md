# Extraction form — living review: molecular hydrogen and exercise performance/recovery

You are extracting data for a systematic review. Accuracy matters more than coverage: a wrong number
published on a forest plot is worse than a missing one. Never estimate, never digitize figures, never
fill a value from memory or from another paper.

## Get the paper
Load the PubMed tools with ToolSearch ("select:mcp__pubmed__get_full_text_article"), then fetch each
PMCID in your batch (one or two per call). Use only the fetched text.

## Eligibility (decide per paper from the full text)
- Population: humans doing an exercise bout or an exercise-training programme (healthy, trained,
  untrained, athletes, older adults without a disease focus). Disease-treatment populations → exclude.
- Intervention: exogenous molecular hydrogen (H2-rich water, H2 tablets/magnesium sticks, H2 gas
  inhalation, H2 bathing, electrolyzed/alkaline-reduced water ONLY if dissolved H2 is reported).
- Comparator: placebo or control (plain water, deaerated/degassed water, placebo gas, no intervention).
- Design: randomized (parallel or crossover). Non-randomized → exclude ("not randomized").
- Outcome: at least one exercise performance or recovery outcome (list below).

## Outcomes to extract (all that are reported)
domain values:
- `lactate` (blood lactate, mmol/L; note timepoint: during, peak, post, recovery)
- `rpe` (rating of perceived exertion; note scale Borg 6-20 / CR10)
- `tte` (time to exhaustion / time trial / total work / distance — endurance performance)
- `power` (peak/mean power, jump height, strength, torque, sprint time, repeated-sprint decrement)
- `ck` (creatine kinase or other muscle-damage marker: myoglobin, LDH)
- `soreness` (DOMS / muscle soreness VAS)
- `hr` (heart rate during/after exercise, HR recovery)
- `vo2` (VO2, VO2peak, ventilation, RER)
- `oxstress` (exercise-induced MDA, d-ROMs, BAP, 8-OHdG, TAC etc.)
- `inflammation` (IL-6, CRP, TNF etc.)
- `other`
For each outcome give H2 group and control group mean, SD and n, at the single most relevant timepoint
(for lactate prefer immediately post-exercise; for CK prefer 24 h post; for performance the main test).
If the paper reports only change scores, extract those and set `value_type: "change"`.
If it reports SE or 95% CI instead of SD, record exactly what is reported in `dispersion_type`
("SD" | "SE" | "CI95" | "IQR" | "none") and the raw numbers — do NOT convert.
If a value is only in a figure, record the outcome with `values_in: "figure_only"` and no numbers.
For crossover designs also record any paired statistic reported (paired t, p-value, mean difference
with SD of differences, correlation).

## Output
Write ONE JSON file (path given in your task) containing an array, one object per paper:
{
  "pmcid": "", "pmid": "", "doi": "", "first_author": "", "year": 0, "title": "",
  "eligible": true|false, "exclusion_reason": "",
  "randomized": "yes"|"no"|"unclear", "randomization_quote": "short verbatim quote ≤25 words",
  "blinding": "double"|"single"|"open"|"unclear",
  "design": "parallel"|"crossover",
  "population": {"n_randomized": 0, "n_analysed": 0, "sex": "", "age_mean": null, "training_status": ""},
  "intervention": {"route": "water"|"tablet"|"gas"|"bath"|"other", "h2_concentration": "as reported", "dose": "volume/frequency/inhalation %", "timing": "acute"|"short-term (<=7d)"|"chronic (>7d)", "duration_days": null},
  "comparator": "",
  "exercise_test": "",
  "outcomes": [{
     "domain": "", "measure": "", "unit": "", "timepoint": "", "higher_is_better": true|false,
     "value_type": "final"|"change", "dispersion_type": "SD",
     "h2": {"mean": null, "dispersion": null, "n": null},
     "control": {"mean": null, "dispersion": null, "n": null},
     "paired_stat": "", "values_in": "table"|"text"|"figure_only",
     "source_location": "e.g. Table 2, row 'Lactate post'", "reported_p": ""
  }],
  "risk_of_bias": {"randomization": "low|some|high", "deviations": "low|some|high", "missing_data": "low|some|high", "measurement": "low|some|high", "selective_reporting": "low|some|high", "notes": ""},
  "funding_coi": "as stated, e.g. 'funded by X; author employed by H2 company'",
  "extractor_notes": ""
}
Then re-open the JSON and verify every number against the paper text a second time; fix anything wrong.
Your final message: one line per paper (pmcid, eligible y/n, number of outcomes with numbers) plus
anything you were unsure about. Do not paste the JSON.
