# Old study URLs that 404 — proposed 301 map (2026-11-23)

**Status: REPORT ONLY. Nothing has changed.** Approve by adding `approved-by: josh` as the
first line of `legacy-study-404s-2026-11-23.csv`, then run
`railway run -- sh -c 'DATABASE_URL="$DATABASE_PUBLIC_URL" npx tsx scripts/consolidation/legacy-study-404s.ts --apply --csv reports/consolidation/legacy-study-404s-2026-11-23.csv'`.
`--rollback --backup <file>` deactivates exactly the rows that run created.

## Source

Railway HTTP logs, every `404` on `/study/*`, 2026-11-16 → 2026-11-23: **19,288 hits on 2,837 URLs**
(~2,700/day). Paths that resolve today (a live slug or an active redirect) are left out. Targets are
the study's current slug verbatim; no slug is regenerated.

Who hits them: Meta's AI crawler (`meta-externalagent`) 63%, browser user agents ~29%, AhrefsBot 4%,
Googlebot 20 hits. Search Console lists only 7 such URLs, so this is mostly crawl budget and AI
citations, not lost Google rankings.

## Proposed: 2,510 URLs (17,515 hits, 91%)

| Match | URLs | Hits | What it is |
|---|---:|---:|---|
| same-title | 1,640 | 11,214 | Same title words, different punctuation (`stim1-orai1` → `stim1orai1-pmid-…`, `ischaemia-reperfusion` → `ischaemiareperfusion-…`) |
| truncated | 798 | 5,851 | Old slugs cut at ~80 characters; each is a ≥40-char prefix of exactly one study |
| extended | 72 | 450 | Old `<title>-<number>` slugs; where the number is present it is always our row id − 485 (2768 → 3253), an old id scheme — independent confirmation |

24 of the matches are excluded (off-topic) studies: those rows are **410**, not 301, matching how
excluded studies already answer.

Only unambiguous matches are proposed: a URL that fits more than one study is left out.

## Not proposed: 327 URLs (1,773 hits)

`legacy-study-404s-2026-11-23-unmatched.csv`. Mostly short keyword-style slugs from an older system
(`hydrogen-water-cognitive-therapy-panic-attacks-women`) and off-topic papers we don't carry
(hydrogen sulfide, interstellar hydrogen, gasification). They stay 404. `deleted_studies` is empty,
so there's no record to justify 410s.
