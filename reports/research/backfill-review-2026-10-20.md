# Study field backfill — results and decisions for Josh (2026-10-20)

MCP plan Phase 0. Haiku extraction over all 2,283 live studies. Only empty fields were written; nothing was
overwritten or excluded. Revert data: `backup-pre-backfill-2026-10-20-21-{30,40,41}.json`.

## Coverage, before → after

| Field | Before | After |
| --- | ---: | ---: |
| study_design (new) | 0% | **99.9%** (2,281; #3817 and #4112 left — see below) |
| sample_size | 0% | 26.9% overall, **86% of human studies** (reviews and in-vitro have none by nature) |
| duration (days) | 0% | 35.7% |
| outcome | 77.0% | 82.4% (remaining gaps are mostly reviews) |
| h2_delivery_method | 84.6% | 86.7% |
| h2_concentration | 0.7% | 20.8% |
| dosage_protocol | 0.6% | 49.2% |

Full tables: `field-coverage-2026-10-20.md` (before) and `field-coverage-2026-10-20-after.md` (after).

## What the corpus actually contains (by extracted design)

| Design | Studies | Sample size known |
| --- | ---: | ---: |
| animal | 1,087 | 269 |
| review | 447 | — |
| in_vitro | 284 | — |
| **rct** | **127** | 113 |
| uncontrolled_trial | 73 | 50 |
| case_report | 61 | 57 |
| controlled_trial | 60 | 53 |
| observational | 43 | 40 |
| meta_analysis | 20 | 8 |
| other (mixed designs, errata, notices) | 79 | 12 |

That is **364 primary human studies, 127 of them RCTs**, plus 20 meta-analyses. The site currently says
"475 human trials" (`is_human_trial`), and that figure includes about 100 reviews and meta-analyses (see D2).

## Decisions needed (nothing below has been applied)

Every row is in `backfill-corrections-2026-10-20-21-30.csv` and `…-21-41.csv` (id, field, current, proposed, title).

**D1. 196 papers flagged off-topic → candidates for exclusion (410).**
Most are clearly not molecular-hydrogen research:
- alkaline or ionized water, and strong-acid electrolyzed water used as a disinfectant;
- breath-hydrogen tests (SIBO, lactose malabsorption);
- magnesium and iron implant corrosion;
- "hydrogen ion" (pH) papers.

Some are judgment calls that should probably stay: H2-releasing nanomaterials, palladium hydride, and the
inhaler-safety guideline (#4086).
Recommended: review the list, then run it through the existing exclusion flow
(`scripts/content/exclude-energy-studies.ts --ids <csv>`, then `--apply`). Per CLAUDE.md, this needs your approval
of the exact list.

**D2. 157 studies flagged `is_human_trial` true → false (and 7 false → true).**
- 71 "clinical"-bucket reviews and 13 meta-analyses are marked as human trials.
- 25 observational studies (breath tests and similar) gave participants no hydrogen.

Applying this changes the public "human trials" number on `/api/learn-stats` and the Learn page from 475 to roughly
330. It is more accurate, but it is a public number going down.

**D3. 37 publication notices:**
- 17 retraction notices,
- 16 errata or corrigenda,
- 4 expressions of concern,
- plus #4112, whose title is "[Retracted] Molecular hydrogen improves type 2 diabetes…".

None of these are studies. Recommended: exclude the errata and notices. For each retracted paper, check whether
the original article is also in the corpus.

**D4. 30 `study_type` corrections for the legacy "clinical" bucket** (e.g. → Rat, Human, Mouse). These are low-risk
and make species search accurate. 5 proposals are junk ("not specified", empty) and should be skipped.

## How the MCP server uses this today

The MCP tools classify subject from `study_design` first, so human-vs-animal answers are already correct without
D2. The D1 and D3 decisions affect what the tools (and the site) count at all.
