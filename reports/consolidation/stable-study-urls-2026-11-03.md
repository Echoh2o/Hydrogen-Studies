# Stable study URLs — plan 2026-11-03 (PLAN.md 3.3)

**Status: REPORT ONLY. Nothing has changed.** Approve by adding the line `approved-by: josh` to the top of
`reports/consolidation/stable-study-urls-2026-11-03.csv`, then run
`railway run -- sh -c 'DATABASE_URL="$DATABASE_PUBLIC_URL" npx tsx scripts/consolidation/stable-study-urls.ts --apply --csv reports/consolidation/stable-study-urls-2026-11-03.csv'`.

## What changes

Every live study slug today ends in a 13-digit import-batch timestamp (2276 live studies, 92 distinct
timestamps — a batch marker, not an ID). The stable slug keeps the title words exactly as they are and ends in the
study's permanent identifier. The suffix is what resolves the page from now on (`studyService.getStudyBySlug`), and the
Next study page 301s any other spelling to the canonical slug, so a changed title can never break a link.

| Kind | Form | Studies |
|---|---|---|
| PMID | `<title>-pmid-<PMID>` | 1976 |
| DOI (no PMID) | `<title>-doi-<DOI, lowercase, punctuation → dashes>` | 227 |
| Row id (neither) | `<title>-hs-<id>` | 73 |
| **Total URLs that move** | | **2276** |
| Already stable (unchanged) | | 0 |

Longest new slug: 1080 characters (3 new slugs exceed 300 — their title portions are already that long today and are copied verbatim, never regenerated). Old slugs with uppercase letters: 0.

Rows whose `doi` column holds something that isn't a DOI, so they take the row-id form: 3029 (doi "99233"). Worth a data fix, not a blocker.

### Samples

| id | old | new |
|---|---|---|
| 2007 | `/study/application-of-molecular-hydrogen-as-an-antioxidant-in-responses-to-ventilatory-and-ergogenic-adjustments-during-incremental-exercise-in-humans-1775650467133` | `/study/application-of-molecular-hydrogen-as-an-antioxidant-in-responses-to-ventilatory-and-ergogenic-adjustments-during-incremental-exercise-in-humans-pmid-33573133` |
| 2008 | `/study/hydrogen-rich-water-consumption-positively-affects-muscle-performance-lactate-response-and-alleviates-delayed-onset-of-muscle-soreness-after-resistance-training-1775650467133` | `/study/hydrogen-rich-water-consumption-positively-affects-muscle-performance-lactate-response-and-alleviates-delayed-onset-of-muscle-soreness-after-resistance-training-pmid-33555824` |
| 2009 | `/study/molecular-hydrogen-enhances-osteogenesis-in-danio-rerio-embryos-1775650467133` | `/study/molecular-hydrogen-enhances-osteogenesis-in-danio-rerio-embryos-pmid-33410131` |
| 2010 | `/study/hydrogen-alleviated-neuronal-injury-and-neuroinflammation-induced-by-microglial-activation-via-the-nrf2-pathway-in-sepsis-associated-encephalopathy-1775650467133` | `/study/hydrogen-alleviated-neuronal-injury-and-neuroinflammation-induced-by-microglial-activation-via-the-nrf2-pathway-in-sepsis-associated-encephalopathy-pmid-33992722` |
| 2013 | `/study/acute-hydrogen-rich-water-ingestion-stimulates-cardiac-autonomic-activity-in-healthy-females-1775650467133` | `/study/acute-hydrogen-rich-water-ingestion-stimulates-cardiac-autonomic-activity-in-healthy-females-doi-10-5507-ag-2021-009` |
| 2017 | `/study/hydrogen-water-therapy-in-histopathological-improvement-of-diabetic-nephropathy-on-streptozotocin-induced-diabetic-rats-1775650467133` | `/study/hydrogen-water-therapy-in-histopathological-improvement-of-diabetic-nephropathy-on-streptozotocin-induced-diabetic-rats-doi-10-1063-5-0053002` |
| 2052 | `/study/abstract-consumption-of-hydrogen-water-prevents-the-occurrence-of-neuropathic-pain-in-mice-1775650467134` | `/study/abstract-consumption-of-hydrogen-water-prevents-the-occurrence-of-neuropathic-pain-in-mice-doi-10-1016-j-jns-2015-08-1290` |
| 2054 | `/study/molecular-hydrogen-protects-against-oxidative-stress-induced-raw-2647-macrophage-cells-through-the-activation-of-nrf2-and-inhibition-of-mapk-signaling-pathway-1775650467134` | `/study/molecular-hydrogen-protects-against-oxidative-stress-induced-raw-2647-macrophage-cells-through-the-activation-of-nrf2-and-inhibition-of-mapk-signaling-pathway-doi-10-1007-s13273-020-00074-w` |
| 2031 | `/study/the-use-of-molecular-hydrogen-in-correction-of-no-reflow-syndrome-in-the-polyuric-stage-of-sublimate-nephropathy-1775650467133` | `/study/the-use-of-molecular-hydrogen-in-correction-of-no-reflow-syndrome-in-the-polyuric-stage-of-sublimate-nephropathy-hs-2031` |
| 2057 | `/study/effects-of-alkaline-water-intake-on-gastritis-and-mirna-expression-mir-7-mir-155-mir-135b-and-mir-29c-1775650467134` | `/study/effects-of-alkaline-water-intake-on-gastritis-and-mirna-expression-mir-7-mir-155-mir-135b-and-mir-29c-hs-2057` |
| 2071 | `/study/abstract-protective-effects-of-hydrogen-rich-medium-on-high-glucose-induced-oxidative-stress-and-polyadp-ribosepolymerase-1-dependent-cell-death-parthanatos-in-rat-schwann-cells-in-vitro-1775650467135` | `/study/abstract-protective-effects-of-hydrogen-rich-medium-on-high-glucose-induced-oxidative-stress-and-polyadp-ribosepolymerase-1-dependent-cell-death-parthanatos-in-rat-schwann-cells-in-vitro-hs-2071` |
| 2165 | `/study/effect-of-hydrogen-water-drinking-on-dementia-patient-through-mechanism-of-oxidative-stress-and-immune-redox-balance-1775650467137` | `/study/effect-of-hydrogen-water-drinking-on-dementia-patient-through-mechanism-of-oxidative-stress-and-immune-redox-balance-hs-2165` |

## Safety checks

- Duplicate new slugs within the plan: **0**
- New slugs already used by a different study row (incl. excluded): **0**
- PMIDs shared by two or more live studies: **0**; DOIs shared: **0**. (A shared identifier would surface above as a duplicate new slug.)

## What --apply does, per study (200 per transaction)

1. `UPDATE studies SET slug = <new> WHERE id = ? AND slug = <old>` (a row whose slug changed since this plan is skipped and logged).
2. Insert 301 rows `/study/<old>` and `/studies/<old>` → `/study/<new>` (note `stable-study-urls 2026-11-03`; an existing row for that path is overwritten).
3. Re-point active redirects whose target was `/study/<old>` or `/studies/<old>` to `/study/<new>` — **185 rows today**, so no redirect chains are created.
4. Deactivate any redirect row whose `from_path` equals the new URL (none expected).

Before the first write a backup `reports/backups/stable-study-urls-<ts>.json` ({id, old_slug, new_slug}) is saved;
`--rollback --backup <file>` restores the old slugs and deactivates this run's 301 rows.

## Other references to the old URLs

- **Active redirect rows that already point FROM a live study URL (shadowing the live page): 0.**
- Published blog posts linking to an old study URL: **30 posts, 335 links** — keep working via the 301; a later content pass can rewrite them to the canonical URL (CTR/consolidation scripts already have the pattern).
- Source files that hardcode an old study URL (hub-intro sources + markdown): **190 links in 1 files** — run `npx tsx scripts/consolidation/stable-study-urls.ts --rewrite-sources --csv reports/consolidation/stable-study-urls-2026-11-03.csv` (no database) and ship that code change in the same release as the apply, so internal links are canonical rather than 301s:
  - `shared/condition-hub-intros.ts` (190)
- Sitemaps, hub study lists, related-study links and the homepage read `studies.slug` from the database — they update on their own (sitemap cache ≤ 1 h; Express redirect cache ≤ 5 min; Next page data is revalidated by the script).

## After apply

- Resubmit `sitemap-studies.xml` in Google Search Console; expect a temporary dip while 2,276 URLs are re-crawled (studies currently average position ~30 with ~0 non-branded clicks, so the downside is small).
- Watch GSC Coverage for "Page with redirect" rising and the new URLs becoming indexed over 2–4 weeks.
