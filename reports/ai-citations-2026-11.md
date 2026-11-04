# AI citations — November 2026 (baseline)

PLAN.md 7.8 / §10: monthly check of how often AI assistants cite the two sites. This is the first pull, so it is the baseline the following months compare against.

**Source:** Ahrefs API v3 `site-explorer/ai-responses-count` (mode `subdomains`, all countries), pulled 2026-11-04 via the Ahrefs MCP connector. Cost: 120 units per domain (Lite plan, 200,000 units/month). Counts are citation links in AI-generated answers in Ahrefs' tracked prompt set and the number of distinct pages cited, as of the pull date.

## Citations by platform

| Platform | hydrogenstudies.com citations | pages cited | echowater.com citations | pages cited |
|---|---|---|---|---|
| All platforms (deduplicated) | **97** | **41** | **682** | **270** |
| Perplexity | 47 | 23 | 56 | 60 |
| Gemini | 11 | 5 | 46 | 37 |
| Google AI Mode | 8 | 2 | 36 | 31 |
| Google AI Overviews | 4 | 4 | 53 | 36 |
| ChatGPT | 2 | 2 | 100 | 72 |
| Copilot | 0 | 0 | 44 | 45 |
| Grok | 0 | 0 | 0 | 0 |

Reading: hydrogenstudies.com is cited almost entirely by Perplexity (which crawls aggressively and favours sources with citations of their own); ChatGPT and Copilot barely cite it, while they cite echowater.com freely. Gemini and Google AI Mode sit in between. The research site has 41 cited pages out of ~2,900 indexable URLs.

## The five tracked prompts (PLAN §10)

"hydrogen water research", "is hydrogen water backed by science", "hydrogen water studies", "best hydrogen water bottle backed by research", "is hydrogen water a scam".

**Not measured this month.** Per-prompt citation checks need an Ahrefs Brand Radar report with these prompts; the workspace has none (`management/brand-radar/reports` returned an empty list on 2026-11-04). Creating one is a dashboard action for Josh (Brand Radar → new report → brand "Hydrogen Studies", competitors as desired, add the five prompts); once it exists, `brand-radar-cited-pages` and `brand-radar-mentions-overview` give the per-prompt numbers for this report. The §10 target is "cited in ≥30%" of the tracked prompts.

## What changed on the site this month that bears on AI citations

All of these pages were created or made server-rendered for every fetcher (Claude-User, ChatGPT-User, PerplexityBot and friends used to get an empty app shell):

- Every public route is now server-rendered for every visitor; the bot allowlist is gone (PRs #133, #136, #137).
- `/limits-of-the-evidence`, `/null-and-negative-results`, `/is-hydrogen-water-a-scam` (the fifth tracked prompt, answered directly), `/evidence-gap-map` (+ embeddable version), `/dataset` (CSV/JSON, CC BY 4.0, `Dataset` schema), `/state-of-hydrogen-research` (#141–#144).
- 180 researcher and 32 journal profile pages (#140); `BreadcrumbList` and `MedicalWebPage`/`CollectionPage` schema site-wide (#135); OpenAlex citation counts on study pages (#139).
- `llms.txt` lists the dataset, report and gap map under machine-readable resources.

## Next pull (early December 2026)

1. Repeat the two `ai-responses-count` calls; add a "Δ vs. November" column.
2. If the Brand Radar report exists, add the per-prompt table (cited yes/no per platform, cited pages).
3. Note which of the new pages appear among cited pages.

Baseline recorded by the editorial automation on 2026-11-04.
