# Evidence-field coverage — human studies, 2026-11-05

TRUST-BADGE-PLAN Phase 0.9. Extraction: `scripts/research/extract-evidence-fields.ts` (Claude Sonnet tier, abstracts only), applied as **auto_approved** under Sarah Taylor-Laine (Josh, 2026-11-05: she can unapprove later). Backup: `reports/backups/evidence-fields-1793920591759.json`.

Human studies: 348. Extracted: 327. Skipped (no usable abstract): 21.

| Field | Filled | % |
|---|---|---|
| `delivery_route` | 325 | 99% |
| `species` | 327 | 100% |
| `population_kind` | 324 | 99% |
| `effect_direction` | 327 | 100% |
| `effect_direction_evidence` | 269 | 82% |
| `h2_concentration_ppm` | 36 | 11% |
| `duration_days` | 223 | 68% |
| `dose_ml_per_day` | 66 | 20% |
| `funding_category` | 139 | 43% |

`h2_concentration_kind` is set for every study; `not_reported` counts as filled (it means the abstract doesn't give one).

## Outcome direction (primary outcome)

| Direction | Studies |
|---|---|
| improved | 235 |
| mixed | 41 |
| no_clear_effect | 30 |
| not_reported | 17 |
| worsened | 4 |

Before (old single per-paper label, human studies): Positive 308, Neutral 29, Negative 2, unrecorded 9.

## Drinking-water studies (the badge's dose-match pool)

- Studies: 136
- With a numeric concentration: 26 (the rest don't report one in the abstract)
- At or below the Flask's 8.25 mg/L: 22
- Outcome: improved 89, mixed 24, no_clear_effect 14, not_reported 8, worsened 1
- Used an Echo device: 0; funded by Echo: 0

## Gaps vs the plan's targets

- Numeric concentration is far below the 60% target for drinking-water studies: abstracts rarely state it. Next step: PMC Open Access full text for the drinking-water set (extraction only, never republished).
- Funding is 'not stated' for most abstracts; full text would fill it.
- 21 human studies have no usable abstract and were skipped.
