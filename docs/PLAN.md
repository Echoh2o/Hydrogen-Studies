# PLAN.md — Hydrogen Studies → Echo Water growth plan (v3)

**Owner:** Josh · **Date:** Aug 31, 2026 · **Supersedes:** v2 (Aug 31)
**What changed in v3:** folds in the self-audit — regulatory placement rules for product bridges, abstract handling, conditional stopgaps, manual-action and Cloudflare bot checks, baselines (authority, CWV), search-page noindex, public-routes-only SSR, echowater.com credibility nits, the 8 ppm transparency page — plus three new pillars: living systematic reviews, the database as an API/MCP tool, and radical-honesty content.

**How to use:** work top to bottom. Every task is a checkbox. "Report first" items produce a report for Josh before anything destructive runs. Phases overlap; order *within* a phase matters.

---

## 1. Standing decisions (don't relitigate these in-session)

- **Generation is paused.** `GENERATION_ENABLED=false`. If it ever resumes: draft-only, reviewer sign-off to publish, ≤5/week. Reason: ~8,777 blog articles earned ~22 clicks in 60 days; 5/hour outruns any cleanup; Google's Mar/Jun/Aug 2026 spam updates target scaled content in health.
- **The corpus is cut by rule, not by percentage.** Keep only URLs with meaningful GSC signal, external backlinks, or a scheduled human rewrite. Expect ≥90% retired. 301 only true same-topic duplicates; 410 the rest (mass-301 into one winner reads as soft-404).
- **Every crawler gets the same HTML a browser gets.** No UA allowlist; server-render public routes.
- **Ownership is disclosed everywhere.** "Built and funded by Echo Technologies LLC" in the footer, on About, on anything commercial. Sponsorship stated openly is the credibility asset.
- **No product bridges on disease pages.** Bridges live only in wellness/performance contexts (Appendix E). Placing a product next to a cancer or diabetes study is an implied disease claim, disclaimer or not, and contradicts Echo's own "no medical claims" footer.
- **No brand-vs-brand "is X worth it" reviews on this domain.** They're replaced by protocol-based measurement data (Phase 6) or moved to echowater.com where the commercial context is obvious. (Blocking decision, Section 12.)
- **Domain stays separate**, with explicit two-way attribution. Consolidation into echowater.com is revisited in 6–12 months, not now.
- **The model is "Examine.com for hydrogen, transparently funded by Echo."** Healthline/Sleep Foundation prove a commercially owned health reference can be a top-cited authority *only while the editorial rigor is real* — both have been hit by core updates when commercial content outgrew it. Rigor is the product, not the wrapper.
- **llms.txt is a five-minute hedge, not a lever.** Google's 2026 guidance says it isn't used; retrieval crawlers barely request it.

---

## 2. Rules of engagement for Claude Code (paste into CLAUDE.md)

```
- Generation stays off: GENERATION_ENABLED=false unless Josh flips it; if on, drafts only.
- Content-destructive ops (merge, 301, 410, noindex, sitemap removal) run only after a report and Josh's approval of the exact URL list.
- Every crawler gets the same HTML as a browser. No user-agent branching that changes content.
- Product/sponsor bridges render only on pages whose primary topic is in the Appendix E allowlist. Never on disease pages.
- Abstracts: show ≤300-character excerpt + link to PubMed/DOI. Never republish full abstracts (publisher copyright). Our summary is ours.
- Every link to echowater.com carries utm_source=hydrogenstudies&utm_medium=referral&utm_campaign=<page_type>&utm_content=<slug>.
- Every indexable page shows: funding disclosure, author or reviewer, last-reviewed date.
- Empty fields never render; no placeholder strings (__no_content__) reach HTML.
- Study URLs use the permanent ID (PMID/DOI-derived); never regenerate slugs.
- SSR migration covers public routes only; /admin and pipeline tooling stay on the SPA.
- Schema only for what's visible on the page. No FAQPage without a visible FAQ, no reviewedBy without a named reviewer.
```

---

## Phase 0 — Today (stop the bleeding, capture baselines; ~half a day)

**Stop the bleeding**
- [ ] **0.1 Pause generation.** `GENERATION_ENABLED` env flag (default false) around the scheduler; log a one-liner when skipped; leave ranking/queue code intact.
- [ ] **0.2 Rate limiter.** (a) Check `app.set('trust proxy', …)`. If the limiter keys on Cloudflare edge IPs instead of real client IPs, the 30/min limit is effectively shared by everyone — fix that first. (b) Scope the app limiter to `/api/*`, add `RATE_LIMIT_MAX` env (default 300). (c) In GSC → Settings → Crawl stats → "By response", record the 429 count; that's the ground truth for how much Google is actually hitting it. (d) The durable fix is edge-caching HTML in Phase 3 so public pages never reach the limiter.
- [ ] **0.3 Ownership disclosure.** Global footer component + `/editorial-policy` and `/methodology` route stubs (real content in Phase 4). Copy in Appendix B. Must appear in the bot-SSR output too.
- [ ] **0.4 Review posts.** Until the Section 12 decision: disclosure banner at the top of every `is-*-worth-it`/brand review post; fix the stale "Echo Go+ 4.5 ppm" benchmark (discontinued; Flask is 8 ppm, H2 Analytics-certified).
- [ ] **0.5 Placeholder leaks.** Bot-SSR drops empty/`__no_content__` fields; fix the duplicated "2,277 are from peer-reviewed journals" line.
- [ ] **0.6 Noindex internal search.** `/search` and `/advanced-search`: `noindex`, remove from sitemap-pages.
- [ ] **0.7 `llms.txt`** as a generated route in `seo-routes.ts` (description, disclosure, hub links, methodology, future dataset, sitemap index). `text/markdown`.
- [ ] **0.8 Wire the unused `public/` schema file** (Organization + WebSite/SearchAction) into `index.html` and bot-SSR; add `parentOrganization`/`funder` → Echo Technologies LLC (Appendix C).
- [ ] **0.9 robots.txt:** remove `Crawl-delay: 1` (Google ignores it; Bing honors it).

**Checks (report only → `reports/baseline-2026-08.md`)**
- [ ] **0.10 GSC Manual Actions + Security Issues** for both properties. If there's a manual action, that changes Phase 2's shape (reconsideration request after cleanup).
- [ ] **0.11 Spam-update impact.** Aug 10–17 vs Aug 22–29 clicks/impressions, split by `/blog/`, `/study/`, `/explore-by-*`, `/hydrogen-for/`. Expectation to set now: a site flagged by a spam update generally doesn't recover until the *next* spam update re-evaluates it. Blog recovery is a Q4 2026 / Q1 2027 event.
- [ ] **0.12 Cloudflare bot settings.** Security → Bots: confirm "AI Scrapers and Crawlers"/AI-bot blocking isn't blocking verified OAI-SearchBot, ClaudeBot, PerplexityBot, Applebot, bingbot. Spoofed UAs returning 200 from a laptop proves nothing about verified crawlers. Recommendation: allow all, including training crawlers (GPTBot, CCBot); this site exists to be cited.
- [ ] **0.13 Authority baseline (Ahrefs UI export).** DR, referring domains, organic traffic, top pages for hydrogenstudies.com, echowater.com, molecularhydrogeninstitute.org, h2hubb.com, hydrogenwaterstudies.com. This is the biggest unknown in the plan; a tiny RD count stretches every citation timeline.
- [ ] **0.14 Core Web Vitals baseline.** PageSpeed Insights (mobile) for home, a study, a hub, a blog post on hydrogenstudies.com, and home, PDP, science page, a blog post on echowater.com (Replo pages tend to be heavy).
- [ ] **0.15 GA4:** create the AI-referral custom channel group placed above "Referral" (regex: chatgpt, openai, perplexity, claude, anthropic, gemini, copilot, bing.com/chat, you.com, meta.ai) on both properties; note current 30-day figures.

**Done when:** `GENERATION_ENABLED=false` in prod; 429s to verified bots in Railway logs → 0 over 48h (or GSC shows they were never material); disclosure visible in browser and `curl -A Googlebot` output on `/`, `/about`, a review post; `/llms.txt` returns markdown; homepage HTML has Organization JSON-LD; `reports/baseline-2026-08.md` exists.

**Kickoff prompt:**
> Read PLAN.md Sections 1–2 and Phase 0. First report: where the generation scheduler lives, how rate limiting is configured (including whether trust proxy is set and what key the limiter uses), where the bot-SSR renderer builds HTML, and the path of the unwired schema file in public/. Then implement 0.1, 0.2(a–b), 0.5, 0.6, 0.7, 0.8, 0.9 and show me the diff. Don't touch content.

---

## Phase 1 — This week (reports that gate Phase 2; conditional stopgaps)

**Reports (report only)**
- [ ] **1.1 Keep-list (the gate for Phase 2).** Join every blog URL with: GSC 16-mo clicks/impressions/avg position (from the sync), Ahrefs backlinks (`data/ahrefs-backlinks.csv` from "Best by links"), inbound internal links, word count, title-template match (`^Hydrogen Water General:`, `…What 20\d\d Research Shows$`, `^How to Use Hydrogen Water for`), and the `/api/admin/consolidation` cluster id. Output `reports/keep-list.csv` with a proposed action per URL: **keep** (clicks>0 OR impressions≥200 OR backlinks≥1 OR reviewer-scheduled), **merge** (same-topic duplicate of a keep), **retire** (410). Include cluster summaries.
- [ ] **1.2 Sitemap-blog gap.** 8,777 DB articles vs 3,124 sitemap URLs: quality gate (what rule?) or bug? Are excluded articles still 200 + indexable? → `reports/sitemap-gap.csv`.
- [ ] **1.3 Full crawl.** Screaming Frog (or a script) over both domains as a plain UA: redirect chains, canonical mismatches, duplicate titles/descriptions, orphans, non-200s, pages with `noindex`, pages missing disclosure. → `reports/crawl-2026-09.csv`. I only fetched ~15 pages by hand; this will find what I couldn't.
- [ ] **1.4 Locate the echowater proxy config** (Shopify app-proxy prefix/subpath + the serving route). Report status; don't fix — Phase 8 replaces it.

**Conditional stopgaps — skip all three if Phase 3 starts within 30 days (they patch a renderer Phase 3 deletes)**
- [ ] **1.5 Bot-SSR markdown fix** (markdown → HTML with real `<a>` and `<h2 id>`).
- [ ] **1.6 Per-route meta in bot-SSR** (title/description/canonical/OG per study/blog/hub).
- [ ] **1.7 Extend the UA allowlist** with `Claude-User`, `Claude-SearchBot`, `Perplexity-User`, `Meta-ExternalAgent`, `Amazonbot`, `CCBot`, `DuckAssistBot`, `MistralAI-User` (Appendix A).

**Always**
- [ ] **1.8 Thin pages → `noindex` until they have content:** `/products`, `/recommendations`, `/learn/*`, any `/hydrogen-for/*` with <5 studies. Keep in nav; remove from sitemap.

**Done when:** four reports exist; thin pages return `noindex`; (if stopgaps ran) blog posts in `curl -A Googlebot` output contain `<a href>` links and no markdown syntax.

**Kickoff prompt:**
> Read PLAN.md Phase 1. Build the four reports as scripts under scripts/reports/ writing to reports/. For 1.1 use the GSC sync tables and consolidation clusters; leave a clear placeholder if data/ahrefs-backlinks.csv is missing. Print summary stats (counts per proposed action, clusters >10 URLs) and stop. Implement 1.8. Do not merge, redirect, or delete anything.

---

## Phase 2 — Weeks 1–3: supervised consolidation (the needle-mover)

Runs only after Josh approves `reports/keep-list.csv`. Expected: ~8,777 → 200–400 blog URLs.

- [ ] **2.1 Merge same-topic duplicates.** Fold unique substance into the survivor; 301 losers → survivor via the redirect system; log to `reports/redirects-applied.csv`.
- [ ] **2.2 Retire everything else with 410.** Not 301-to-home, not 404. Remove from sitemap and nav in the same deploy.
- [ ] **2.3 Regenerate all sitemaps from the DB** with real `lastmod`; blog sitemap = keeps only. Resubmit in GSC.
- [ ] **2.4 Survivor upgrade pass (first 50):** byline or reviewer, last-reviewed date, 2–3-sentence direct answer up top, links to the specific studies relied on, FAQPage only where an FAQ is visible.
- [ ] **2.5 Same audit for the 721 echowater.com posts** (report first; Shopify URL redirects).
- [ ] **2.6 GSC weekly for 8 weeks:** Pages report ("Crawled – currently not indexed" should fall), `/study/` coverage, 410 processing. Expect impressions to drop; that's the point. If a manual action exists (0.10), file reconsideration after 2.1–2.3 land.

**Done when:** blog sitemap ≤400 URLs; every retired URL returns 410; every survivor has byline/date/direct answer; GSC shows 410s processing.

**Kickoff prompt:**
> Read PLAN.md Phase 2 and reports/keep-list.csv (approved). Build the executor dry-run-by-default: `--plan` prints exactly what will be merged/redirected/retired; `--apply` performs it in batches of 500 with a log. Run `--plan`, show totals and 20 sample rows per action, then stop for my authorization.

---

## Phase 3 — Weeks 2–5: server-render the public site, delete the allowlist

- [ ] **3.1 Framework** (blocking, Section 12): Next.js App Router + ISR (keeps React; best if interactive tools follow) or Astro (least JS; site is ~95% static). Express API and Postgres stay untouched. **Public routes only** — `/admin`, generation, and consolidation tooling stay on the current SPA.
- [ ] **3.2 `/study/[id]` first, behind a flag:** server-rendered title/meta/canonical/OG; `MedicalScholarlyArticle` + `BreadcrumbList` (+ `FAQPage` only if a visible FAQ exists); markdown → HTML with heading ids; ≤300-char abstract excerpt + PubMed/PMC/DOI links; side-by-side diff script (plain UA, visible text + JSON-LD) against the current page. Then roll to hubs, hydrogen-for, learn, about, blog, home.
- [ ] **3.3 Stable study IDs.** PMID or DOI-derived slug; 301 the epoch-suffixed URLs; keep the title portion.
- [ ] **3.4 Delete the UA allowlist and the bot-SSR path.** Remaining UA logic may only *remove* things (analytics for bots), never change content.
- [ ] **3.5 Site-wide JSON-LD:** `Organization` (with `parentOrganization`/`funder`), `WebSite`, `BreadcrumbList`; `MedicalWebPage` on hubs (Phase 4 adds `reviewedBy`).
- [ ] **3.6 Edge caching.** Cloudflare caches HTML for anonymous requests (`s-maxage`, stale-while-revalidate); study/hub revalidate daily, blog on publish, home hourly. This is what makes the rate limiter irrelevant for crawlers.
- [ ] **3.7 CWV pass.** Re-run 0.14 after launch; target LCP <2.5s / INP <200ms on mobile for study and hub pages.

**Done when:** `curl -A "RandomBot/1.0"` on any public URL returns the full article HTML matching the browser DOM; OG preview of a study shows that study's title; no code path references a crawler UA list; Cloudflare cache HIT ratio on `/study/*` >80%.

**Kickoff prompt:**
> Read PLAN.md Phase 3. Propose the migration for the chosen framework, listing which React components port as-is and confirming /admin stays on the SPA. Ship /study/[id] behind a feature flag with the diff script. Stop when the study route is live in staging.

---

## Phase 4 — Weeks 3–8: the trust layer (turns "a database" into "the reference")

- [ ] **4.1 Hire the reviewer — and make it a methodologist** (blocking, Section 12). One credentialed reviewer on retainer (PhD/MD/PharmD) *with systematic-review or meta-analysis experience*, because Phase 6's living reviews depend on it. Name, credentials, photo, review date on summaries.
- [ ] **4.2 About / Methodology / Editorial policy** (three real pages, ≥600 words each): who runs it; that Echo funds it and how editorial independence works; inclusion criteria; that drafts are AI-assisted and what the human review step is; update cadence; corrections process; contact.
- [ ] **4.3 Evidence grading + structured fields.** Add to the study schema and backfill (AI-assisted extraction → reviewer spot-check of a random 5%): `evidence_level` (1 SR/MA of RCTs · 2 RCT · 3 non-randomized human · 4 animal · 5 in vitro/hypothesis), `n_participants`, `population`, `delivery_method`, `h2_concentration_ppm`, `dose_ml_per_day`, `duration_days`, `outcome_measures`, `effect_direction` (positive / null / negative / mixed), `effect_size` where reported, `registration_id` (ClinicalTrials.gov/UMIN), **`funding_source`** and **`conflict_of_interest`** (industry-funded flag — it will flag Echo-funded work too; that's the point). Render as badges; make filterable. Nobody else in the category exposes dose, concentration, or funding as data.
- [ ] **4.4 Study page upgrade.** Direct-answer paragraph first; abstract excerpt (≤300 chars) + PubMed/PMC/DOI; journal/year; citation count via OpenAlex (free); "Reviewed by [name] on [date]"; evidence badge; funding badge; "What this study does and doesn't show"; related studies.
- [ ] **4.5 Expand the hubs (23 explore + 20 condition + 10 hydrogen-for → ~60) into real articles:** 300–800 reviewed words (what the human evidence shows, what animal data suggests, doses studied, open questions), then the study list, then the best surviving post. These are the pages LLMs cite for "does hydrogen water help with X."
- [ ] **4.6 Radical-honesty pages.** `/limits-of-the-evidence` (small samples, short durations, industry funding, geographic concentration, publication bias); `/is-hydrogen-water-a-scam` — a rigorous, balanced answer that concedes the weaknesses; a **"null and negative results"** filter and hub that surfaces them rather than burying them. MHI is advocacy-tinged and brand blogs are cheerleaders; the honest source wins the citations and the clinicians.
- [ ] **4.7 Researcher and journal profile pages.** One page per prolific author (Ohta, Ostojic, LeBaron, Nakao, and the rest of the top ~40) and per journal, listing their studies with ORCID/affiliation links. Cheap, entity-rich, earns links from the researchers themselves, and doubles as advisor recruiting.
- [ ] **4.8 Trust schema:** `MedicalWebPage` with `reviewedBy` (Person + credentials), `lastReviewed`, `about` → `MedicalCondition`; `MedicalScholarlyArticle` with `citation` (DOI), `author`, `isPartOf` (journal), `datePublished`, `funder` where known.

**Done when:** every indexed page shows reviewer/author, last-reviewed date, disclosure; ≥80% of human studies have evidence level + dose/concentration/duration + funding populated where reported; ≥40 hubs have ≥300 reviewed words; honesty pages live; ≥40 researcher profiles.

---

## Phase 5 — Weeks 4–10: the bridges to Echo (labeled, honest, placed by rule)

Placement rule for every bridge: **Appendix E allowlist only.** Nothing on pages whose primary topic is a named disease.

- [ ] **5.1 "Studied dose vs. your device" module** on allowed study/hub pages. Factual line generated from 4.3 fields: *"This trial used 1.6 ppm hydrogen-rich water, 1.5 L/day for 4 weeks. Matching that at home requires a device certified at ≥1.6 ppm."* Below it, a clearly labeled **"From our sponsor, Echo Water"** card (Flask, 8 ppm certified) with UTM and `rel="sponsored"`. Standard wellness disclaimer. Never inside summary text. Counsel reviews the template before launch.
- [ ] **5.2 `/for-clinicians` hub (the wholesale bridge — wholesale is ~80% of revenue; practitioners are one segment of it).** Two-artifact rule so research isn't promotional labeling: (a) evidence briefs per *allowed* topic published by Hydrogen Studies, no product content, open HTML + gated PDF (email + profession); (b) a separate "Stock hydrogen devices in your practice" page on echowater.com that the hub links to. Leads → Klaviyo practitioner segment → existing StoryBrand wholesale flows + Attio. Counsel reviews the briefs.
- [ ] **5.3 Research Digest newsletter.** Monthly, written by the reviewer, consumer + practitioner segments, sponsored footer, signup on every page. Also send to Echo's existing customer list (retention + credibility).
- [ ] **5.4 Consumer bridges:** allowed hubs get "Which delivery method did these studies use?" → matching Echo category; home gets a two-sentence "Why this database exists" (Josh's founding story) → echowater.com/about; `/products` becomes an honest "how hydrogen devices work and what to look for" guide (concentration certification, electrode materials, third-party testing, outgassing) with Echo listed and labeled among devices meeting the bar; then remove its `noindex`.
- [ ] **5.5 Review-post disposition** per Section 12 (recommended: replace with the Phase 6 measurement dataset; move brand-vs-brand comparisons to echowater.com).
- [ ] **5.6 UTM discipline** (CLAUDE.md rule); confirm attribution lands in Shopify and GA4.

**Done when:** every *allowed* study/hub page has one labeled bridge and every disease page has none (crawl check); `/for-clinicians` live with ≥5 briefs; Klaviyo receives practitioner leads tagged with source; GA4 shows a `hydrogenstudies` referral source with revenue attached.

---

## Phase 6 — Weeks 8–20 (then ongoing): original science — what nobody else in the category has

- [ ] **6.1 Living systematic reviews.** Per-outcome pages with pooled effect estimates, forest plots, heterogeneity, and a GRADE certainty rating, updated as studies land, with a methods section, PRISMA-style flow, version history, and the reviewer as author. Start with the three outcomes that have the most RCTs (likely exercise recovery/performance, metabolic markers, oxidative-stress biomarkers); require ≥5 RCTs before pooling. This is the Examine "Human Effect Matrix" taken further, it's publishable (submit the first one to a journal — a citable paper about your own database), and it's the single most citable thing you can build.
- [ ] **6.2 "State of Hydrogen Research" annual report + public dataset.** Studies by year, evidence level, condition, delivery method, country, funding, human vs. animal, typical doses. Charts + analysis + CSV under CC BY 4.0 with `Dataset` schema and a Zenodo DOI. Seed from `/research-analytics`. Original data is the highest-leverage content type for AI citations and what journalists write about.
- [ ] **6.3 Interactive evidence-gap map.** Outcome × evidence-level matrix (counts, direction, certainty) — the visual version of 6.2; PR-able; embeddable.
- [ ] **6.4 Device measurement dataset (replaces the reviews).** Open testing protocol (concentration at 0/5/15/30 min after generation, method, temperature), every major bottle/tablet tested, third-party lab confirmation on the top 10, published as a dated dataset with the conflict of interest stated on the page. Ties directly to the PPM-meter project. This is what Reddit and YouTube reviewers will cite instead of "is X worth it."
- [ ] **6.5 Direct-answer structure everywhere:** each H2 opens with a 2–3-sentence answer; question-style headings; visible dates.

**Done when:** ≥3 living reviews published with methods + versioning; report + dataset + DOI live; gap map live; measurement dataset covers ≥15 devices with protocol published.

---

## Phase 7 — Weeks 6–16: distribution (be the tool, not just the page)

- [ ] **7.1 Public API + MCP server.** Expose the database as a documented REST API (OpenAPI spec, API keys, rate limits) and an MCP server on Railway with tools like `search_studies(query, filters)`, `get_study(id)`, `get_evidence_summary(outcome)`, `list_conditions()`. Every response carries attribution ("Source: Hydrogen Studies, funded by Echo Technologies") and the study URL. List it in the Anthropic connector directory and OpenAI's app/connector directory; publish a ChatGPT app (Apps SDK) wrapping the same endpoints. When someone asks Claude or ChatGPT about hydrogen research, the assistant calls your database and credits it. Most 2026-native distribution move on the list, and squarely in Josh's wheelhouse.
- [ ] **7.2 Internal-link the winners.** GSC striking-distance keywords (positions 5–30) from the sync → links from hubs and high-impression pages. Only meaningful after Phase 3 made links visible to bots.
- [ ] **7.3 YouTube.** "Study breakdown" shorts (60–90s from the TL;DRs) on the Echo channel, embedded on study pages and linking back; plus a monthly "journal club" live with the reviewer. Brand mentions in YouTube titles/transcripts are the strongest single correlate with AI Overview visibility in Ahrefs' 75k-brand study.
- [ ] **7.4 Reddit, transparently.** r/HydrogenWater, r/Biohackers, r/Supplements, r/longevity — answer with study links, disclosed affiliation, never product pushes; a reviewer AMA once the honesty pages exist.
- [ ] **7.5 Entity consistency.** Identical org name/description/`sameAs` on both sites, LinkedIn, Crunchbase; create Wikidata items with neutral facts. Do not edit Wikipedia to self-cite; let the dataset and living reviews earn it.
- [ ] **7.6 Digital PR** on 6.1/6.2/6.4 to health/longevity journalists and the podcast circuit already in the ambassador pool.
- [ ] **7.7 Paid AI placements test.** ChatGPT ads (via Adspirer/Supermetrics CGPTA) on category queries ("hydrogen water research", "best hydrogen water bottle"), small test budget, UTM-tracked; AI referrals convert ~4–5× organic, so even modest volume can pay.
- [ ] **7.8 Monthly AI-citation check** in the Ahrefs UI (API is plan-gated) for the Section 10 prompts → `reports/ai-citations-YYYY-MM.md`.

**Done when:** API + MCP server public with docs and directory listings; ≥10 shorts + 1 journal club live; hydrogenstudies.com appears in ≥30% of tracked AI prompts; paid test has a measured CPA.

---

## Phase 8 — In parallel: echowater.com (Shopify theme + a sync job)

- [ ] **8.1 Replace the runtime proxy with a nightly sync.** Python job (MCC pattern) reads the hydrogenstudies API and writes Shopify **metaobjects**: live study count, counts by evidence level, featured human studies per allowed topic, reviewer credentials, living-review headline numbers. Content lands in the HTML; nothing to 503.
- [ ] **8.2 Rebuild `/pages/hydrogen-studies` as the Research hub** (already indexed — reuse the URL). Replace the legacy Synergy-era copy ("DOCTOR APPROVED", "over 1,000 s tudies, 205 human") with the hub from 8.1. Add **"Research"** to the main nav.
- [ ] **8.3 Science page citations.** `/pages/why-hydrogen`: number every mechanism claim and link it to a specific study page; reference list; fix "Jounrey"; replace "over 1,000 studies" (here and in the homepage FAQ) with the live-count metaobject.
- [ ] **8.4 "How we measure 8 ppm" transparency page.** The category's biggest objection (saturation at atmospheric pressure is ~1.6 ppm; most human trials used 0.5–1.6 ppm water) answered head-on: the third-party test method, how the Flask exceeds saturation, the outgassing curve (concentration at 0/5/15/30 min), what "certified" means, and how to drink it to get the studied dose. Link it from every PDP.
- [ ] **8.5 Dedupe.** `/pages/hydrogen-science` is a word-for-word copy of `/pages/why-hydrogen` → 301. Check `/pages/echo-hydrogen-water` vs `/pages/echo-hydrogen-water-1` the same way; use the 1.3 crawl for the rest.
- [ ] **8.6 "Backed by research" section on hydrogen PDPs** — 3–5 studies from *allowed* topics only (Flask → exercise recovery, fatigue, oxidative-stress markers), each linking to hydrogenstudies. Factual only.
- [ ] **8.7 Credibility nits.** Retire or rename the "hydrogen deficiency quiz" (not a recognized concept; clinicians will wince — reframe as "find your Echo product"); replace the accreditedbusiness.com badge (not the BBB; reads as a paid seal) with a real BBB profile or drop it; confirm Shopify Markets emits hreflang for `/en-mx/` so those ~1,500 URLs aren't duplicates.
- [ ] **8.8 Blog E-E-A-T:** bylines + reviewer + study links on surviving posts (after 2.5).
- [ ] **8.9 Press logos → linked, dated coverage.**
- [ ] **8.10 Organization schema:** add `founder`, `foundingDate`, `address`, `sameAs` (socials, Crunchbase, LinkedIn, Wikidata), `subOrganization` → Hydrogen Studies. Optional "About Echo / Science" section in Shopify's `llms.txt` if the theme allows.

**Done when:** Research in nav; hub live with live count matching hydrogenstudies.com; science page has ≥15 inline citations; 8 ppm page live and linked from PDPs; every hydrogen PDP shows ≥3 studies; duplicates 301'd; quiz and badge resolved.

---

## 9. Assumptions and unknowns (what this plan was written without)

- No traffic, ranking, or backlink data for either domain (Ahrefs wasn't available; GSC wasn't accessed). Phase 0.13 fills this; if referring domains are in the single digits, extend the Phase 6–7 timelines.
- ~15 pages fetched by hand, not a crawl (1.3 fixes this).
- The user-facing JS app was never rendered; UX, search, filters, and CWV are unassessed (0.14, 3.7).
- The stack (Express + Helmet + Vite/React + Postgres on Railway behind Cloudflare) was inferred from headers and confirmed only partly by Claude Code.
- Cloudflare AI-bot settings were not observable from outside (0.12).
- Google policy and AI-citation statistics come from vendor and practitioner studies with different panels; directional, not precise.
- Regulatory guidance here is not legal advice; counsel reviews Appendix B, Appendix E, 5.1, 5.2, and 8.4 before launch.

---

## 10. Measurement

| Metric | Source | Baseline | 90-day target |
|---|---|---|---|
| 429s to verified bots | Railway logs (bot-hit table: UA, status, path); GSC Crawl stats | record in 0.2/0.13 | 0 |
| Blog URLs live (200) | DB | ~8,777 | 200–400 |
| `/study/` pages indexed | GSC Pages report | pull today | ≥95% of 2,277 |
| Hubs with reviewed intro | DB | 0 | ≥40 |
| Living reviews published | site | 0 | 3 |
| Referring domains (DR) | Ahrefs | 0.13 | +25 quality domains after Phase 6 |
| CWV (mobile) study + hub pages | PSI/CrUX | 0.14 | LCP <2.5s, INP <200ms |
| Referral sessions → echowater.com | GA4 source/medium; Shopify UTM | ~0 (no links today) | 30-day baseline, then +50%/quarter |
| Revenue attributed to hydrogenstudies | Shopify UTM / GA4 | 0 | track |
| Practitioner leads (`/for-clinicians`) | Klaviyo by source; Attio | 0 | 20+/month |
| Digest subscribers | Klaviyo | 0 | 1,000 |
| API/MCP calls per month | server logs | 0 | track; ≥1 directory listing live |
| AI referral sessions (both sites) | GA4 custom channel group (0.15) | pull today | +50% |
| AI citations, tracked prompts | Ahrefs UI monthly: "hydrogen water research", "is hydrogen water backed by science", "hydrogen water studies", "best hydrogen water bottle backed by research", "is hydrogen water a scam" | pull today | cited in ≥30% |
| Paid AI placement CPA | Adspirer/UTM | n/a | measured |

Weekly review for 8 weeks (GSC coverage, 429s, referral sessions), monthly after.

---

## 11. Growth ideas outside the two sites

1. **Commission a registered human trial on the Echo Flask** (university partner, ClinicalTrials.gov pre-registration, open-access publication, indexed in your own database). "The only hydrogen bottle with its own peer-reviewed trial" can't be copied quickly. ~$75–200k; coordinate marketing use with regulatory counsel.
2. **Small research-grant program** ($5–25k awards) alongside the trial. Relationships with scientists become reviewers, advisors, and citations. Consider **sponsoring or partnering with MHI** rather than competing — their certification course already exists; a clinician CE course from you should be clinical-practice-focused or built with them.
3. **Real-world evidence from the Flask app.** Opt-in structured self-experiments (recovery, HRV, sleep with wearable data) produce original data no competitor has. Needs ethics/IRB review and counsel; longer horizon, large payoff, feeds Phase 6.
4. **Make the database the content layer of the Fullscript-style wholesale platform** you've been scoping — evidence and ordering in one practitioner portal.
5. **Agentic commerce completeness.** UCP is live; make sure Google Merchant Center and OpenAI's Agentic Commerce listing carry certifications, warranty, and the research link so product cards and citations point at the same brand.
6. **Localize the research layer** (Spanish first — `en-mx` exists — then Japanese, where much of the primary research originates).
7. **Science one-pager for affiliates/Amazon A+** generated from the database so Impact/Everflow partners cite the same studies.
8. **Name defense:** register `hydrogen-studies.com` and obvious variants (a competitor runs `hydrogenwaterstudies.com`); consider "Hydrogen Studies by Echo" in the logo lockup.

---

## 12. Decisions needed from Josh

**Blocking**
- [ ] Brand-vs-brand reviews: keep with disclosure / move to echowater.com / **replace with the measurement dataset (recommended)**.
- [ ] Framework for Phase 3: Next.js vs. Astro.
- [ ] The reviewer/methodologist: budget and who.
- [ ] Approve `reports/keep-list.csv` before Phase 2 runs.

**Non-blocking**
- [ ] Generation: stay paused, or resume draft-only with reviewer sign-off (≤5/week)?
- [ ] Cloudflare: allow training crawlers (GPTBot, CCBot) as well as search crawlers? (Recommended: allow all.)
- [ ] Public API/MCP: free and open with attribution, or keyed with a free tier? (Recommended: free + attribution.)
- [ ] MHI: partner/sponsor, or compete?
- [ ] Practitioner briefs: gated PDF + open HTML (recommended) or fully open?
- [ ] Legal review of Appendices B and E, tasks 5.1, 5.2, 8.4.
- [ ] If any runtime proxy survives, canonical direction: study pages canonical to hydrogenstudies.com (recommended).

---

## Appendix A — Crawler UAs to verify in logs

Googlebot, Googlebot-Image, Google-InspectionTool, Storebot-Google, bingbot, DuckDuckBot, Applebot, GPTBot, OAI-SearchBot, ChatGPT-User, ClaudeBot, Claude-User, Claude-SearchBot, PerplexityBot, Perplexity-User, Meta-ExternalAgent, Amazonbot, CCBot, DuckAssistBot, MistralAI-User, YouBot, cohere-ai. (`Google-Extended` is a robots.txt token, not a crawler.) After Phase 3 none of these need special handling; verify at the Cloudflare layer that verified bots aren't blocked (0.12).

## Appendix B — Disclosure copy (draft; counsel reviews)

**Footer, every page:** Hydrogen Studies is built and funded by Echo Technologies LLC, the maker of Echo Water hydrogen products. Our research team selects and summarizes studies independently; Echo does not decide which studies are included or how they are described. [Editorial policy] · [Methodology] · [Contact]

**Review-post banner (until the Section 12 decision):** This site is owned by Echo Technologies LLC, which sells hydrogen water products, including the Echo Flask. Read our editorial policy.

**Sponsor card label:** "From our sponsor, Echo Water" — device name, certified concentration, link. Never inside summary text. Allowed pages only (Appendix E).

**Methodology excerpt:** Summaries are drafted with AI assistance from the abstract or full text, then reviewed for accuracy by [Name, credentials] before publication. Each study carries the reviewer's name and review date. Funding sources and conflicts of interest are recorded for every study, including studies funded by Echo Technologies. Corrections: [process].

## Appendix C — Schema sketches

```json
{"@context":"https://schema.org","@type":"Organization","name":"Hydrogen Studies",
 "url":"https://hydrogenstudies.com","logo":"https://hydrogenstudies.com/logo.png",
 "description":"Evidence-graded database and living reviews of peer-reviewed molecular hydrogen research.",
 "parentOrganization":{"@type":"Organization","name":"Echo Technologies LLC","url":"https://echowater.com"},
 "funder":{"@type":"Organization","name":"Echo Technologies LLC","url":"https://echowater.com"},
 "sameAs":["https://www.linkedin.com/company/...","https://www.wikidata.org/wiki/Q..."]}
```

```json
{"@context":"https://schema.org","@type":"MedicalWebPage",
 "about":{"@type":"MedicalCondition","name":"Oxidative stress"},
 "reviewedBy":{"@type":"Person","name":"[Reviewer]","honorificSuffix":"PhD","jobTitle":"Scientific Reviewer"},
 "lastReviewed":"2026-09-15","dateModified":"2026-09-15",
 "publisher":{"@type":"Organization","name":"Hydrogen Studies"}}
```

```json
{"@context":"https://schema.org","@type":"Dataset","name":"Hydrogen Studies Research Database Export",
 "description":"Peer-reviewed molecular hydrogen studies with evidence level, condition, delivery method, concentration, dose, duration, and funding source.",
 "license":"https://creativecommons.org/licenses/by/4.0/",
 "creator":{"@type":"Organization","name":"Hydrogen Studies"},
 "distribution":{"@type":"DataDownload","encodingFormat":"text/csv","contentUrl":"https://hydrogenstudies.com/data/hydrogen-studies.csv"},
 "identifier":"https://doi.org/10.5281/zenodo.XXXXXXX"}
```

On echowater.com, extend the existing `Organization` block with `founder`, `foundingDate`, `address`, `sameAs`, and `"subOrganization":{"@type":"Organization","name":"Hydrogen Studies","url":"https://hydrogenstudies.com"}`.

## Appendix D — External evidence (re-runnable)

```bash
# SPA shell for browsers (3,192 B) vs bot-SSR; Claude-User gets the shell
curl -sL https://hydrogenstudies.com | wc -c
curl -sL -A "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)" https://hydrogenstudies.com | wc -c
curl -sL -A "Claude-User" https://hydrogenstudies.com/about | wc -c

# Googlebot hits the 30/min limiter from a single IP (5×429 in a 40-request burst on Aug 31)
for i in $(seq 1 40); do curl -s -o /dev/null -w "%{http_code}\n" \
  -A "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)" \
  "https://hydrogenstudies.com/explore-by-condition/inflammation?n=$i"; done | sort | uniq -c

# Raw markdown in bot HTML; no links to Echo
curl -sL -A "Mozilla/5.0 (compatible; Googlebot/2.1)" https://hydrogenstudies.com/blog/is-piurify-worth-it | grep -c '\*\*'
curl -sL -A "Mozilla/5.0 (compatible; Googlebot/2.1)" https://hydrogenstudies.com/about | grep -c echowater

# echowater.com: legacy "hydrogen-studies" page, duplicate science page
curl -sL https://echowater.com/pages/hydrogen-studies | grep -c hydrogenstudies   # 0
diff <(curl -sL https://echowater.com/pages/why-hydrogen | sed 's/<[^>]*>//g' | tr -s ' \n' | head -c 4000) \
     <(curl -sL https://echowater.com/pages/hydrogen-science | sed 's/<[^>]*>//g' | tr -s ' \n' | head -c 4000) | head
```

## Appendix E — Bridge placement rules (counsel reviews before launch)

**Allowed contexts** (page's primary topic; sponsor card, dose module, PDP research modules, practitioner briefs may appear):
exercise recovery · athletic performance · fatigue/energy in healthy adults · hydration · oxidative-stress biomarkers in healthy adults · general wellness/antioxidant status · skin appearance (cosmetic, non-disease) · sleep quality in healthy adults · the "how devices work / what to look for" guide.

**Prohibited contexts** (no product content of any kind, no sponsor card, no PDP link):
any page whose primary topic is a named disease or medical condition — cancer/oncology support, diabetes, metabolic syndrome, NAFLD, hypertension/cardiovascular disease, kidney disease, Parkinson's, Alzheimer's/dementia, rheumatoid arthritis, lupus, sepsis, COVID/respiratory disease, radiation side effects, allergies, autism, depression/anxiety disorders, chronic fatigue syndrome — and any study page whose population is patients with a diagnosed condition.

**Gray areas → default to prohibited** until counsel clears them (e.g., "inflammation," "gut health," "cognitive function," "blood pressure" as topics). The disclosure footer still appears everywhere; only product content is restricted.

**Mechanics:** each hub/study record carries a `bridge_allowed` boolean derived from its primary topic taxonomy; the renderer checks it; the Phase 1.3 crawl script asserts no product link appears on `bridge_allowed=false` pages.

## Appendix F — Living review page template (Phase 6.1)

Title (outcome) · Direct answer (2–3 sentences, with certainty) · Bottom line for consumers / for clinicians · Pooled estimate + forest plot + heterogeneity · GRADE certainty and why · Included studies table (evidence level, n, dose, concentration, duration, funding, effect) · Excluded studies and reasons · Methods (search date, criteria, PRISMA flow) · Limitations · Version history and next scheduled update · Reviewer/author, date · How to cite.
