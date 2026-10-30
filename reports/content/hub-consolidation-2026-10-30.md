# Blog → hub consolidation report (2026-10-30)

**Report only — nothing has been redirected.** Per CLAUDE.md, 301s run only after
Josh approves the exact URL list in `hub-consolidation-2026-10-30.csv`.

## Why
GSC, last 28 days: hubs average position 7.6, blogs 18.6, study pages 30. The
templated "How to Use Hydrogen Water for X" posts compete with the hub for the
same query (e.g. cholesterol post vs `/explore-by-condition/cholesterol`), so
neither page wins. One owner page per topic; the hub becomes that owner.

## Order of operations (per target hub)
1. Write the hub's evidence-graded intro (`shared/condition-hub-intros.ts`, same
   format as kidney-health / sleep-quality), absorbing anything useful from the
   post. Hubs without an intro are only study lists — 301ing a post into one
   would throw its content away.
2. Josh approves the row → 301 the post → resubmit the hub via IndexNow.

Five hubs need intros first: gut-health, cholesterol, type-2-diabetes,
fatty-liver-nafld, weight-loss-metabolism (~1,000 combined impressions/90d on
the posts that would fold in). That is one content wave (PLAN §1 cap: ≤5/week).

## Rows that can go now (negligible traffic)
arthritis-290536, psoriasis-099066, general-health-180766, kids-surgery-218367.

## Keep
spine-pain-855883 (pos 6.7) and bladder-control-082030 (pos 7.6): no hub
covers them and they rank — refresh with evidence grading instead.

## Other overlap clusters (decision needed, not in the CSV)
- Kangen: scam-truth, review, alternative-pillar, cheaper-than, complaints (the
  open PLAN §12 review-post decision).
- Filters: hydrogen-water-filter-guide-pillar, best-hydrogen-water-filters,
  hydrogen-water-filter-vs-bottle.
- Research overviews: hydrogen-water-clinical-trials,
  hydrogen-water-peer-reviewed-studies, molecular-hydrogen-research-history.

## Indexing flag
The 2026-09-23 wave-1 guides (`/blog/what-is-hydrogen-water`,
`/blog/hydrogen-water-side-effects`, `/blog/is-hydrogen-water-good-for-kidneys`)
return 200 and are in the sitemap but have ~0 GSC impressions in 5 weeks (only a
`?ref=` variant appears). Check them in GSC URL Inspection — likely
"Crawled/Discovered – currently not indexed".
