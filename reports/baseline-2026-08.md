# Baseline report — 2026-08/09 (PLAN.md Phase 0 checks 0.10–0.15)

Generated 2026-09-01 by Claude Code. Items marked **[JOSH]** need UI access I don't have;
everything else is measured.

## 0.10 GSC Manual Actions + Security Issues — ✅ CHECKED (Josh, 2026-09-01)
Josh confirmed done. Working assumption: no manual action found (flag here if otherwise —
it would add a reconsideration request to the end of Phase 2 per plan 2.6).

## 0.11 Spam-update impact (from synced GSC data)

Window totals, clicks / impressions by section (source: `gsc_query_metrics`):

| Section | Aug 10–17 | Aug 22–29 |
|---|---|---|
| /blog/ | 3 / 177 | 24 / 5,277 |
| /study/ | 0 / 50 | 2 / 797 |
| /explore-by-* | 8 / 267 | 12 / 604 |
| other | 98 / 356 | 103 / 786 |

**Read with caution:** the GSC sync was dead 6/21→8/30; the 8/30 reconnect backfilled
history, but the Aug 10–17 window looks implausibly sparse vs 22–29 — this pattern is more
likely partial backfill coverage than a genuine 30× impressions jump. Ground truth:
**[JOSH]** pull the same two windows in the GSC UI (16-month view) before treating either
window as real. Directionally consistent either way with the known collapse (~tens of
clicks/week sitewide). Expectation per plan: spam-flagged sites don't recover until the next
spam-update re-evaluation — blog recovery is a Q4 2026 / Q1 2027 event.

## 0.12 Cloudflare bot settings — ✅ CHECKED (Josh, 2026-09-01)
Not blocking. (The mass-429s seen in the first crawl were OUR OWN mis-scoped 30/min
limiter — europepmc router root-mount — fixed in PR #56.)

## 0.13 Authority baseline (Ahrefs) — **[JOSH]**
Ahrefs API is plan-gated: even the FREE subscription-info endpoint returns
`Insufficient plan` — the MCP connection works but the Ahrefs subscription tier has NO API
access (Enterprise feature/paid add-on). Options: 5-min UI export, or add API to the plan.
Until then the keep-list runs on GSC signal only. Export from the Ahrefs UI:
DR, referring domains, organic traffic, top pages for: hydrogenstudies.com, echowater.com,
molecularhydrogeninstitute.org, h2hubb.com, hydrogenwaterstudies.com.
Also export **"Best by links" for hydrogenstudies.com/blog/** → save as
`data/ahrefs-backlinks.csv` (url,backlinks) and re-run
`scripts/reports/keep-list.ts` — backlinks can move URLs from retire → keep.

## 0.14 Core Web Vitals baseline — partial **[JOSH]**
Keyless PageSpeed Insights API rejected all runs (`perf=None`) — it now requires an API key.
Either add `PSI_API_KEY` and re-run `reports/cwv-baseline-raw.txt` generation, or run PSI
manually (mobile) for: hydrogenstudies.com {home, a study page, a hub, a blog post} and
echowater.com {home, Flask PDP, why-hydrogen, a blog post}. Target after Phase 3:
LCP < 2.5s / INP < 200ms on study + hub pages.

## 0.15 GA4 AI-referral channel group — **[JOSH]**
Needs GA4 UI admin on both properties: create custom channel group "AI referrals" ABOVE
"Referral", regex: `chatgpt|openai|perplexity|claude|anthropic|gemini|copilot|bing\.com/chat|you\.com|meta\.ai`,
then note current 30-day figures here as the baseline.

## Measured while baselining (2026-09-01)

- **429s to Googlebot:** Appendix D burst re-run (40 rapid requests to a hub page):
  **40× HTTP 200, zero 429s.** The CF-Connecting-IP limiter keying + static-path exemptions
  + RATE_LIMIT_MAX=300 ship in commit `ea8e966`; keep an eye on GSC Crawl Stats → "By
  response" for the ground-truth trend.
- **Blog corpus:** 8,886 articles total; 3,162 published (= sitemap size); 5,724 drafts,
  0 archived. Drafts do NOT leak (sampled 10: all 301/404 to crawlers) —
  `reports/sitemap-gap.csv`.
- **Keep-list (Phase 2 gate):** of 3,162 published: **53 keep / 0 merge / 3,109 retire
  (98.3%)** under the plan's rule (clicks>0 OR impressions≥200 OR backlinks≥1) —
  `reports/keep-list.csv`. **Caveats before approval:** GSC sync holds ~90 days with a
  June–Aug gap (undercounts keeps), and Ahrefs backlinks aren't loaded yet (0.13). Rerun
  after both, then approve.
- **Echowater proxy (1.4):** Shopify App Proxy path 404s on echowater.com (proxy not
  wired in Shopify admin); origin `/proxy/*` correctly fail-closed (401 HMAC);
  `/pages/hydrogen-studies` is live legacy copy with **zero** links to hydrogenstudies.com —
  `reports/proxy-status.md`. Disposition: leave for Phase 8 (nightly metaobject sync).
- **Generation:** paused and enforced (`GENERATION_ENABLED=false` + code kill-switch);
  autopublish off (`BLOG_AUTOPUBLISH=false`); scheduler logs a skip line each cycle.
