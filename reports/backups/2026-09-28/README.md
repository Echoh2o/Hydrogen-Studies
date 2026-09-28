# Content changes — 2026-09-28

Approved by Josh in session (re-audit follow-up): "Merge in tablet group approved",
"redirect approved", "please make a recommendation on which pages stay or go and implement it".

## Tablet group: 6 posts merged into `/blog/h2-tabs-side-effects`

Recommendation: keep the generic tablets guide (3,276 GSC impressions / 34 clicks in the
28 days to 09-25, avg pos 5.5) and fold the rest into it. Reasons: (1) PLAN §1 — no
brand-vs-brand reviews on this domain; (2) the brand reviews claimed in-house hydrogen
testing ("we tested … using a dissolved hydrogen meter", "Our testing revealed … 1.2-1.6 PPM")
that can't be documented; (3) the group split impressions on 15 queries, often two of our
URLs at pos 3.0 on "hydrogen tablets".

| Merged (301 → survivor) | id | GSC 28d impr / clicks / pos |
|---|---|---|
| /blog/h2-tabs-review-full | 9911 | 1,347 / 12 / 7.9 |
| /blog/h2-tabs-review-pillar | 9884 | 424 / 8 / 8.4 |
| /blog/vital-reaction-side-effects | 9959 | 1,229 / 16 / 4.8 |
| /blog/hrw-tablets-side-effects | 9952 | 208 / 0 / 11.9 |
| /blog/vital-reaction-review | 9912 | 79 / 0 / 7.2 |
| /blog/vital-reaction-tablets-review-pillar | 9881 | 41 / 3 / 7.6 |

Survivor edit (publish-articles.cjs, backup `backup-h2-tabs-side-effects-*.json`): new H2
"How do brands like H2 Tabs and Vital Reaction compare?" (label checklist, no ratings, and a
transparency note on why brand reviews were removed); target keywords extended with the
merged posts' brand queries. New body: `h2-tabs-side-effects.md`.

Revert a merge: restore `is_published = true` from the backup JSON and deactivate the
`redirects` row for that `from_path`. Revert the survivor: restore `content` and meta from
its backup JSON.

## Redirect repointed

`/blog/hydrogen-water-health-benefits-for-athletes-what-2024-research-shows-565894`
(redirects id 3475): 301 → `…-551697` (a 410) changed to 301 → `/hydrogen-for/athletic-performance`.
External link: ionza.co.nz (DR 28). Sibling URLs `…-571752`, `…-572212`, `…-564510` still
301 → the 410 (no known backlinks; not changed — not in the approved list).

## Keyword plan wave 2: evidence-graded benefits guide

`/blog/molecular-hydrogen-benefits-guide-pillar` (id 9864) rewritten in place (same slug) as
"Hydrogen Water Benefits: An Evidence-Graded Guide to Molecular Hydrogen". It targets "hydrogen water
benefits" (12k/mo), "benefits of hydrogen water" (6.8k), "molecular hydrogen benefits" (1.3k) and
"molecular hydrogen" (3.2k). It has 23 sources, each checked in PubMed (`wave2/sources-verified.csv`), a GRADE-style
evidence table, a limitations section and a visible FAQ (5). Gray bridge topic, so there is no product content.
The previous version contained animal/cell results framed as benefits, case reports, unverifiable
regulatory claims and links to 7 retired (410) posts; all were dropped.
Rollback: `wave2/backup-molecular-hydrogen-benefits-guide-pillar-*.json`.

## Bylines

`author_name = 'Hydrogen Studies Editorial Team'` set on the 6 wave-1 posts (what-is,
side-effects, real-or-fake, how-much-per-day, kidneys, ppm-levels). They were published before
the column existed (#67), so they showed no author.
