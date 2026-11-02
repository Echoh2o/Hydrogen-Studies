# Study headline accuracy — report (2026-11-02)

**Drafts only. Nothing has been changed on the site.** Applying the rewrites
needs Josh's approval (PLAN WS2 "headline accuracy pass").

## What was flagged (674 of 2,305 plain-language study titles)
- **455** animal / lab studies whose title doesn't say so — readers (and AI
  summaries) take "Hydrogen Saline Protects Newborn Brains…" as a human result.
- **215** titles with overclaim words (prevents, destroys, fights, cures, kills…).
- **4** non-human studies whose title names people/patients.

Rules (`flags` column): design ∈ {animal, in_vitro} and no animal/lab wording;
overclaim verb; non-human + human-outcome words.

## Drafts
`proposed_title` was drafted by Claude Haiku from the original paper title,
design and species (`scripts/content/draft-headline-fixes.ts`): name the animal
or "lab cell studies", no cure/treat/prevent language, plain English, ≤90 chars.
`needs_review` marks 27 drafts that still trip a rule (several are false
positives — goats, fruit flies, chinchillas are named; the regex just doesn't
know them).

Sample:
| was | proposed |
|---|---|
| Hydrogen Water Protects Hearts from Damage After Blood Flow Loss | Hydrogen Water Reduced Heart Damage After Blood Flow Loss in Rats |
| Hydrogen Nanoparticles Protect Brain After Stroke in Breakthrough Study | Hydrogen Nanoparticles in Mice Protect Brain After Stroke |
| Natural Hydrogen Waters Prevent Type 1 Diabetes in Lab Studies | Natural Hydrogen Waters Reduced Type 1 Diabetes Signs in Lab Tests |

## Data issue found
Some rows have `study_design = animal` with species "Cell Culture" (should be
`in_vitro`). The drafts follow the species, so the wording is right either way;
fixing the design field is a separate data correction.

## To apply (after approval)
Approve the CSV (edit any `proposed_title`, blank a row to skip) → a script
writes `plain_language_title` with a JSON backup and invalidates the study
pages (Next revalidates them immediately).
