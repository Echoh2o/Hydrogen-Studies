# KEYWORD_PLAN.md — keyword → owner page map (v1, 2026-09-23)

Companion to `docs/PLAN.md` (the roadmap wins on any conflict). Readable version with
full data: https://claude.ai/artifact/Fpg8QLx9K4R9jP86ZZsCdn · Audit it came from:
https://claude.ai/artifact/CqrJPn16xeNiKMBNsn3kcE

## Rules
- **One owner page per cluster.** Before writing, check GSC for an existing page with
  impressions on the query; rewrite it instead of creating a competitor.
- **≤5 new or rewritten pages per week** (PLAN §1). Human-reviewed drafts only; generation
  stays off. Publish with `scripts/content/publish-articles.cjs` (dry-run first).
- Every page: disclosure line, "Short answer", question H2s, one table or original data
  point, limitations section, visible FAQ (→ FAQPage only because it's visible), sources
  verified in PubMed with our `/study/` links, byline, no pasted abstracts.
- **Bridges:** Appendix E only. Disease/gray topics carry no product content. Buying-intent
  queries belong on echowater.com, not here.
- Merges/301s/410s/sitemap removals need Josh's approval of the exact URL list
  (`scripts/content/merge-articles.cjs`, logged to `reports/redirects-applied.csv`).

## Cluster map (US volume · KD from Ahrefs, Sep 2026)

| Cluster | Main queries | Owner page | Wave | Bridge |
|---|---|---|---|---|
| Definition | hydrogenated water 8.4k·27; molecular hydrogen 3.2k·18; what is hydrogen water 2.2k·0 | `/blog/what-is-hydrogen-water` | 1 ✅ | OK |
| Safety | negative side effects 7.7k·21; side effects 450·4 | `/blog/hydrogen-water-side-effects` | 1 ✅ | none |
| "Is it real?" | good for you 3.6k·28; hoax 2.6k·8; does it work 800·29; scam 200·6 | `/blog/hydrogen-water-real-or-fake` | 1 ✅ | none |
| Dose | how much per day 900·9; how long it lasts 70·0 | `/blog/how-much-hydrogen-water-per-day` | 1 ✅ | OK |
| Kidneys | good for kidneys 1.0k·4 (+27 variants = 3.8k) | `/blog/is-hydrogen-water-good-for-kidneys` | 1 ✅ | **Disease** |
| PPM | hydrogen water ppm 40·1 | `/blog/hydrogen-water-ppm-levels` | 1 ✅ (corrected) | OK |
| Tablets & delivery | hydrogen water tablets 9.5k·30; hydrogen tablets 7.9k·29; how to make 1.2k·0; brand queries (h2 tabs, vital reaction, primecell h2) | `/blog/h2-tabs-side-effects` — rewritten as the generic tablets guide (09-24); 6 tablet posts merged into it (09-28) | 2 ✅ (how-to-make section added 09-29) | OK (device guide) |
| Benefits | hydrogen water benefits 12k·18; benefits of 6.8k·19; molecular hydrogen benefits 1.3k·26; molecular hydrogen 3.2k·18 | `/blog/molecular-hydrogen-benefits-guide-pillar` rebuilt as evidence-graded guide (09-28) | 2 ✅ | Gray → none |
| Comparisons | ionized 500·0; vs alkaline 250·0 | refresh `/blog/hydrogen-water-vs-alkaline-water` | 2 ✅ (09-29) | OK |
| Inhalation & machines | is hydrogen flammable 4.0k·9; hydrogen machine 600·0 (#1) | `/blog/hydrogen-therapy-machine-home` (device guide + "Is hydrogen flammable?") + `/blog/hydrogen-inhalation-side-effects` | 2 ✅ (09-29) | OK (devices) |
| Hubs | kidney, exercise recovery, skin, fatigue intros (PLAN 4.5) | `/explore-by-condition/{kidney-health,exercise-recovery,skin-aging,chronic-fatigue}` (shared/condition-hub-intros.ts) | 3 ✅ (09-29) | none (counsel first) |
| Sleep | hydrogen water before bed 60·–; does hydrogen water help you sleep 10 | new `/explore-by-condition/sleep-quality` hub (+ 301 from /explore-by-benefit/sleep) | 4 ✅ (09-29) | none (counsel first) |
| Devices | bottle benefits 1.6k·14; do bottles work 450·6 | `/products` → honest device guide, lift noindex | 4 | OK after counsel |
| Research | human studies 250·8; hydrogen water studies 150·42 | `/studies`, researcher profiles, dose dataset | 4 | OK |
| Head term | hydrogen water 26k·28 | earned via the trio above + internal links | months 2–3 | OK |
| Buying intent | hydrogen water bottle 19k·12; best bottle 7.1k·4; machine 6.1k·30 | **echowater.com** | — | n/a |

## Baseline → 90-day targets (to 2026-12-23)
Non-branded GSC clicks / 28d: 135 → 800 · non-branded queries in top 3: 22 → 60 · in top 10:
191 → 400 · Ahrefs organic keywords: 30 → 150 · ChatGPT citations (Brand Radar): 0 → 10.

## Open decisions
- Brand-review posts — PLAN §12. **Tablets resolved 2026-09-28** (Josh: "Merge in tablet group
  approved"): h2-tabs-review-full, h2-tabs-review-pillar, hrw-tablets-side-effects,
  vital-reaction-review, vital-reaction-side-effects, vital-reaction-tablets-review-pillar →
  301 `/blog/h2-tabs-side-effects` (they claimed undocumented in-house ppm testing; see
  `reports/backups/2026-09-28/README.md`). Still open: the Kangen posts (kangen-water-review,
  -complaints, -scam-truth, -alternative-pillar, cheaper-than-kangen-water), is-hfactor-water-worth-it,
  alkaviva-ultrawater-review.
- ~~Merge candidate: `/blog/hydrogen-water-scientific-evidence`~~ → merged into `/blog/hydrogen-water-real-or-fake` (2026-09-23, Josh approved).
- Named reviewer before wave 3 hubs; counsel sign-off before any sponsor card.
