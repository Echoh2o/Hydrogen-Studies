# TRUST-BADGE-PLAN.md — Evidence Profile badges for Echo product pages (v1)

**Owner:** Josh · **Date:** Nov 5, 2026 (v1.2, same day: Josh's answers folded in) · **Status:** plan only, no code yet
**Builds on:** `docs/PLAN.md` v3 (4.3, 4.8, 5.1, 5.2, 6.4, 8.1, 8.6, Appendix E). This plan references those items and does not repeat them.

**What it is:** a FrontrowMD-style badge on echowater.com product pages. It keeps two of the three things that make "Clinicians' Choice" work: **a specific number** and **proof on click**. It replaces the third, the claim of independence, with **checkable information about independent research**. The research comes from studies Echo did not fund and that did not use Echo devices, and the page says so only when the data shows it. Every number is computed from the Hydrogen Studies database by a matching rule written in plain language that anyone can re-run.

**How to use:** same as PLAN.md. Work top to bottom. Every task is a checkbox. Each phase has "Done when" criteria. Nothing in this plan ships to echowater.com until Josh approves the copy file (guardrail 5). There is no outside counsel for now, so the copy rules below are written to be checkable without a lawyer.

---

## 1. What exists today (inventory, 2026-11-05)

**Trust/badge pieces already built (reuse them):**
- **`server/routes/embed-routes.ts`**, mounted at `/embed` before CORS and session. It serves `stats.json`, `study-count.js` (fills every `[data-hs-count]` element on echowater.com) and `badge.svg` (light/dark). The badge wording is already FTC-safe: "OUR RESEARCH LIBRARY", never "verified". The headers are already right: `Access-Control-Allow-Origin: *`, `Cross-Origin-Resource-Policy: cross-origin`, `X-Robots-Tag: noindex`. A failed DB read is treated as "unknown", never "0". **Extend this router** for the new SVG and modal script.
- **echowater.com already loads `study-count.js` on every page.** That is how "2,200+" becomes 2,276. It is a client-side swap, so crawlers see the static fallback (inventory 8.1).
- **`server/services/evidence-stats.ts`** has live counts by design, human or not, and outcome, with a 30-minute cache. **`shared/evidence-pages.ts` and `server/middleware/evidence-pages.ts`** power the radical-honesty pages and the gap map, including an embeddable `/evidence-gap-map/embed`. The study-count logic and the "null and negative" definitions live there. Reuse them.
- **`server/routes/proxy-routes.ts`** has study-type badges (`h2r-badge-rct/human/animal/…`) from the old Shopify app proxy. That proxy is dead (`/tools/hydrogen-research` returns 404), but its CSS vocabulary for design labels is reusable in the modal.
- **`client/src/components/ui/badge.tsx`** (shadcn) and **`client/src/components/learn/EvidenceSection.tsx`** are UI only.
- **`server/routes/chat-routes.ts` (`POST /api/chat`)** is the existing public chat. It uses keyword search through `studyService.getStudies`, falls back to *recent studies* when nothing matches, and returns `productRecommendations` for any query. **Phase 3 does not reuse its answer path.** The fallback and the product recommendations break this plan's guardrails.
- **`server/mcp/*` + `study_embeddings`** provide hybrid (keyword + vector) search over studies and log calls to `mcp_calls`. This is the retrieval layer Phase 3 should use.
- **The `/products` device guide** (`shared/products-guide.ts`, live 2026-11-05) already lists Echo's stated concentrations and links the Flask H2 Analytics report. The badge's modal and evidence page should link to it.

**Data today (live DB, 2026-11-05):**

| | Count |
|---|---|
| Studies (not excluded) | 2,276 |
| Human studies | 348 |
| Human studies where people **drank** hydrogen water | 164 |
| …with any concentration text | 70 (43%) |
| …with a concentration we can parse to ppm | 63 |
| …at ≤ 8 ppm (the Flask's certified level) | 58 |
| …at ≤ 1.44 ppm (the H2 machine's stated level) | 35 |
| Human studies with funding recorded | 166 of 348 |
| Studies that used an Echo device | 0 (the one "echo" text hit is "dual-echo MRI") |

**Gaps that block an honest badge:**
1. **Concentration is free text** (`h2_concentration varchar`) in units like ppm, mg/L, mM, ppb and "super-saturated". There is no numeric column, no dose (mL/day), and no record of whether the figure was measured or stated.
2. **Outcome direction is one label per paper and is about 91% "Positive"** for human studies: 308 positive, 29 neutral, 2 negative, 9 unrecorded. Of the 58 dose-matched studies, 57 are "positive". That can't support a statement like "34 studies show…". It needs re-extraction per **primary outcome**, with a `mixed` value (PLAN 4.3 `effect_direction`).
3. **No products table.** Certified concentrations live only in Shopify copy and in `shared/products-guide.ts`.
4. **Reviewer:** Josh confirmed on 2026-11-05 that **Sarah Taylor has reviewed every study in the system and reviews each new study before it is published**, and that she approved the schema. So `reviewedBy` (Person: Sarah Taylor) is allowed on study pages, the evidence page and the modal. **Sarah is a contractor for Echo** (Josh, 2026-11-05), so every byline and schema entry discloses that: "Reviewed by Sarah Taylor, [title], contractor for Echo Water". She is never described as independent (guardrail 2). Her bio, with title and credentials, is coming from Sarah via Josh. The credential part of the byline and `hasCredential`/`jobTitle` render only once it arrives (CLAUDE.md: empty fields never render). The name and affiliation can ship before then.

**Infra facts:** Express on Railway is the source of truth. Next (`web` service) server-renders public routes via `SSR_FAMILIES` (`server/middleware/web-frontdoor.ts`). Cloudflare sits in front.
- It **caches the SVG** (`/embed/badge.svg` → `cf-cache-status: HIT`) and **rewrites its browser TTL to 4 h**.
- HTML is not edge-cached (PLAN 3.6 was dropped).
- There is no Cloudflare API token in this environment, so there is no programmatic purge.

The live Shopify theme cannot be written by the Shopify connector, and Echo's team edits it directly.

---

## 2. Guardrails (proposed additions to CLAUDE.md)

```
- Evidence counts are always computed from the database by a versioned, published matching rule; never hardcoded in code, theme, copy, or metafields by hand.
- Echo's own review is never called "verified," "certified," "independent," "clinician-approved," or "doctor-recommended." Only a third-party lab's device test may be called "certified," naming the lab, report ID and date.
- The badge, modal and Q&A never say or imply the studies tested Echo products, unless a study actually used an Echo device (the `used_echo_device` field).
- No disease or treatment claims on the badge, the modal, /evidence pages, the claim widget, or Q&A answers. Topic widgets render only for Appendix E allowed topics; the API refuses others.
- All badge, modal, claim-widget and Q&A copy lives in one file (shared/evidence-badge-copy.ts), flagged COPY_REVIEW_REQUIRED; nothing ships to echowater.com until Josh marks it approved with a date. Until outside counsel reviews it, the copy uses only (a) numbers computed from the database, (b) facts quoted from a named lab report, and (c) the fixed hedges in this file; it never states a health benefit in its own words.
- Counts always travel with their denominator and outcome mix ("58 of 63 studies that report a concentration; 41 improved the main outcome, 12 no clear effect, 5 mixed"). Never "N studies show X."
- A product gets a dose-match badge only if it has a third-party certificate on file (lab, report ID, date, method, water type).
```

---

## Phase 0 — Data readiness (gates everything else)

**Fields (the human-study subset of PLAN 4.3; it doesn't add a second schema).** These are additive columns via a boot migration, idempotent and registered in `server/app.ts`. No `drizzle-kit push`.
- [ ] **0.1 Numeric concentration.** Add these fields:
  - `h2_concentration_ppm numeric`, normalised to mg/L (ppm = mg/L; mM × 2.016; ppb ÷ 1000)
  - `h2_concentration_kind` (`measured` | `stated` | `nominal` | `not_reported`)
  - `h2_concentration_raw`, which keeps the original text
  - `not_reported`, which must be distinct from NULL ("not extracted yet")
- [ ] **0.2 Dose and exposure.** Add these fields:
  - `dose_ml_per_day numeric`
  - `doses_per_day int`
  - `duration_days int` (normalised from the existing `duration`, with its unit confirmed)
  - `delivery_route` enum: `drinking_water` | `inhaled_gas` | `saline_infusion` | `bath` | `topical` | `other`. Tablets dissolved in water count as `drinking_water`, with `h2_source = tablet`.
- [ ] **0.3 Population.** Add these fields:
  - `population_kind` enum: `healthy` | `athletes` | `older_adults` | `patients`
  - `population_condition text`, required when `patients`; this drives Appendix E
  - `species` (human / animal / in_vitro), from the existing `is_human_trial` and `study_type`
- [ ] **0.4 Outcome direction per primary outcome.** Add these fields:
  - `primary_outcome text`
  - `effect_direction` enum: `improved` | `no_clear_effect` | `worsened` | `mixed` | `not_reported`
  - `effect_direction_evidence`, the ≤300-character quote it was based on, kept internal and never published as abstract text
  - Keep the old `outcome` column until the new field is fully backfilled and spot-checked. Then switch `evidence-stats.ts` and the null-results hub over to the new field.
- [ ] **0.5 Funding and independence.** Add these fields:
  - `funding_category` enum: `public` | `academic` | `industry` | `mixed` | `not_stated`
  - `funded_by_echo bool`
  - `used_echo_device bool`
  - `device_maker text`
  - `coi_declared` enum: `none` | `some` | `not_stated`
  - These feed the "independent research" line. It says only what the data supports, for example "None of the 58 were funded by Echo or used an Echo device; 40 state their funding."
- [ ] **0.6 `products` table.** Seed it from the H2 Analytics documents Echo already publishes on support.echowater.com (table below), not from marketing copy. Columns:
  - `slug`, `shopify_handle`, `name`, `delivery_route`
  - `certified_concentration_ppm` and `certified_at_minutes`
  - `lab`, `report_id`, `test_date`, `method`, `water_type`
  - `certificate_url`
  - `stated_concentration_text`, which is marketing copy shown only as "Echo states…"
  - `badge_enabled bool`
  - `allowed_claim_topics text[]`, which must be a subset of Appendix E
  - This table is the seed of PLAN 6.4.

  | Product | Lab report | Test date | Measured (GC, static headspace) | Water | Certificate of compliance |
  |---|---|---|---|---|---|
  | Echo Flask | H2AR-250116-1 (also H2AR-250618-1) | 2025-01-16 | 6.07 mg/L at 10 min; 8.25 mg/L at 20 min (~350 mL) | distilled, 24.5 °C | IHSA COC 25-0301-1-PB |
  | Echo H2 Machine | H2A-240603-3 | 2024-06-03 | 1.43 mg/L | per report | IHSA COC (PDF) |
  | Echo Ultimate | H2A-240603-4 | 2024-06-03 | 1.46 mg/L | per report | IHSA COC (PDF) |
  | Echo Flow (formerly Server) | H2A-240603-5 | 2024-06-03 | 1.21 mg/L | per report | IHSA COC (PDF) |
  | Echo Pitcher | H2A-240603-6 | 2024-06-03 | 1.03 mg/L at 10 min; 1.40 mg/L at 20 min | per report | IHSA COC (PDF) |
  | Echo Revive (bath) | H2A24020801 | 2024-02-08 | read from PDF at seed time | tap | — |
  | Echo Refresh (inhalation) | H2A24020802 | 2024-02-08 | gas output, read from PDF at seed time | n/a | — |
  | Hydrogen Prebiotic sticks | H2AR-250930-1 (also H2AR-250410-1) | 2025-09-30 | 16.15 mg/L, measured in a sealed headspace vial (5 g in 350 mL) | distilled | IHSA COC 25-0410-1-PX |
  | Echo Forty, Echo One | none yet: still in development; H2 Analytics tests once a product is on sale (Josh, 2026-11-05) | — | — | — | — |

  Store each report's PDF URL (support.echowater.com article attachments) as `certificate_url`/`report_url`. **The stick-pack figure was measured in a closed lab vial.** Its badge and modal must say that, because an open glass will not hold 16 mg/L. Forty and One stay `badge_enabled=false` until they launch and their reports are published. Seeding should pick them up automatically once the support articles exist. Design it so per-timepoint measurements can be added later (`product_measurements`: minute, mg/L, lab, date).
- [ ] **0.7 AI-assisted extraction, report first.** Extend the existing field-extraction pipeline (`h2_extraction_attempted_at`, the 2026-10 backfill scripts) to the new fields.
  - **Input:** title and abstract, plus PMC Open Access full text where it exists. Full text is used for extraction only and never republished.
  - **Model:** the `ai-provider` extraction tier, `effort:"low"`.
  - **Output:** strict JSON per field with a confidence score and the source span (abstract or full text, plus the quote).
  - **Process:** a dry-run CSV first (`reports/research/evidence-fields-<date>.csv`), then `--apply` behind `approved-by: josh`, with a backup JSON and `--rollback`. This is the same pattern as the stable-URL and identity backfills.
  - **Scope order:** human drinking studies (164), then all human studies (348), then everything else.
- [ ] **0.8 Reviewer sign-off (Sarah Taylor, every study).** Sarah already reviews every study before publication. The new extracted fields go through the same gate:
  - Extraction writes to a **pending** state.
  - A review queue in `/admin` shows each field with its source quote.
  - Sarah approves or corrects each one.
  - Only approved values count toward any public number.
  - Each approval records `fields_reviewed_by` and `fields_reviewed_at` per study, which also gives the per-study `lastReviewed` date the schema needs.
  - New studies can't be published until their fields are approved.
  - Corrections are logged in `reports/research/evidence-review-<date>.csv` so extraction prompts can be tuned. Agreement is tracked as an extraction-quality metric, not a sampling estimate.
- [ ] **0.9 Coverage report** (`reports/research/evidence-coverage-<date>.md`). Each field's percentage filled (with `not_reported` counted as filled), the confidence distribution, spot-check agreement, and the before/after outcome mix.

**Coverage targets (for human drinking studies):**
- `delivery_route`, `population_kind`, `effect_direction`: 100%
- `h2_concentration_ppm` or `not_reported`: 100%; numeric value present in at least 60% (today 38%)
- `duration_days`: ≥ 90%
- `funding_category`: 100% (including `not_stated`)
- Sarah's approval: 100% of fields used in any public count; extraction-vs-reviewer agreement on `effect_direction` reported (target ≥ 90%, to tune the prompts)

**Done when:**
- The migration has run in prod and the products table holds the Flask with its certificate.
- The coverage report meets the targets for human drinking studies.
- 100% of studies in any public count have reviewer-approved fields.
- The outcome mix has been re-derived. Whatever share is "improved", the null-results hub and `/limits-of-the-evidence` switch to `effect_direction` in the same deploy.

---

## Phase 1 — Badge service (hydrogenstudies.com)

- [ ] **1.1 Matching engine, `shared/evidence-match.ts`.** One pure function, with versioned rules (`EVIDENCE_RULE_VERSION`), each paired with plain-language text that is rendered verbatim.
  - **Dose-match rule v1:** "Human studies in our database in which people drank hydrogen-rich water, and the paper reports a concentration at or below the level this device was certified to reach (8.25 mg/L after a 20-minute cycle for the Echo Flask). Excluded: retracted or off-topic papers, animal and cell studies, inhaled gas, saline, bathing. Studies that do not report a concentration are counted separately, not matched."
  - **Topic rule:** the same, filtered to one Appendix E topic, by `tag` plus `population_kind ≠ patients`.
  - **Sharing:** PLAN 5.1 ("studied dose vs. your device") calls this same function. It is built once here.
- [ ] **1.2 `GET /api/evidence/:product`** returns JSON. The URL is public and credential-free, CORS `*`, served by the embed router's headers. It returns:
  - `product`: name, certificate fields, link to the `/products` guide
  - `rule`: version and text
  - `counts`: human studies, drinking studies, with concentration, dose-matched, not reported, outcome mix by `effect_direction`, design mix, `funded_by_echo`, `used_echo_device`, funding stated
  - `matched[]`: id, title, PMID/DOI links, design, n, duration, concentration and its kind, `effect_direction`, funding category
  - `version`: rule version, data hash, `generated_at`
  - `reviewer`: only when named with credentials
  - `methodology_url`

  Unknown product, or `badge_enabled=false`, returns 404. A DB error returns 503 with no numbers, never zeros.
- [ ] **1.3 `GET /api/evidence/:product/topic/:topic`** returns the claim-widget data: topic count, outcome mix and top studies. It returns **404 for any topic not in both the product's `allowed_claim_topics` and Appendix E.**
- [ ] **1.4 `GET /badge/:product.svg?v=<data_version>`**, served by the embed router using `renderBadgeSvg` patterns. It shows two lines (copy from the copy file), light/dark themes and an accessible `<title>`. The SVG is the no-JS and crawler fallback. The Shopify block renders HTML text (Phase 2).
- [ ] **1.5 `/evidence/:product` page.** Express page-data plus a Next route; a new SSR family `evidence_profile` matching `/^\/evidence\/[^/]+$/`. It must not collide with the existing `evidence` family, which matches `/evidence-gap-map` etc.
  - **Contents:** the full modal content as a page, a disclosure box ("Echo Water makes this product and funds Hydrogen Studies"), byline, last-updated date, methodology link and the link to the `/products` guide.
  - **Schema (approved by Sarah, 2026-11-05):** `MedicalWebPage` with `reviewedBy` (Person: Sarah Taylor, with credentials and affiliation once supplied), `lastReviewed` (the latest field-approval date among matched studies), plus `BreadcrumbList` + `ItemList` of `ScholarlyArticle`. There is never `about: MedicalCondition` on a product page, and the reviewer byline must be visible on the page.
  - **Indexing:** `noindex,follow` at launch (Josh, 2026-11-05), so the research site's editorial identity stays separate from product pages. It stays out of the sitemap. Revisit after 3 months of Search Console and AI-citation data.
- [ ] **1.6 Cache and invalidation.**
  - **Server:** a 30-minute in-process cache keyed by rule version plus a data hash. The hash is the `max(updated_at)` of matched studies and the product row.
  - **Busting on writes:** extraction applies, admin study edits and product-row changes call `invalidateEvidenceCache()` and POST `web_revalidate` with the tag `/evidence/<product>`.
  - **Cloudflare:** every embeddable asset URL carries `?v=<data_version>` and is served `max-age=31536000, immutable`, so no Cloudflare purge is needed. Cloudflare's 4 h browser-TTL override doesn't matter for versioned URLs. The JSON endpoint is `max-age=300`.
- [ ] **1.7 Tests.**
  - The match function against fixtures, including unit conversions, `not_reported`, inhaled gas excluded and patients excluded from topic widgets.
  - The API's 404 and 503 paths.
  - No forbidden words in rendered copy (guardrail lint).
  - Every number in the SVG equals the API's number.
  - Appendix E topic refusal.

**Done when:**
- `/api/evidence/echo-flask` returns counts that equal a hand-run SQL of the published rule.
- The SVG and the page show the same numbers as the API.
- The page is server-rendered for a Googlebot UA, with disclosure, byline and date.
- A study edit changes the version and updates the page within 30 minutes, with no Cloudflare purge.
- The copy lint and the Appendix E refusal tests pass.

---

## Phase 2 — Shopify integration (spec for the theme repo; no code here)

- [ ] **2.1 Data into Shopify, server-side (depends on PLAN 8.1).** The nightly sync job from 8.1 writes these product metafields:
  - `hydrogenstudies.evidence_profile` (JSON: counts, outcome mix, rule text, version, `generated_at`, `evidence_url`, `svg_url`)
  - `hydrogenstudies.evidence_topics` (JSON keyed by allowed topic)

  The theme renders the badge text from the metafield in Liquid, with no runtime fetch and no layout shift. That way the next outage can't blank it, which is the lesson of the old proxy returning 503. If 8.1 isn't built yet, a minimal one-endpoint sync (≈1–2 days) ships first.
- [ ] **2.2 Theme app block `evidence-badge`.** A section block with settings for theme and placement.
  - It renders from the metafield. If the metafield is missing, stale (> 14 days) or `badge_enabled=false`, **it renders nothing**: no placeholder, no fallback number.
  - Markup is plain text plus a `<button>` with a fixed-height container (CLS 0).
  - The "See the research" link goes to `https://hydrogenstudies.com/evidence/<product>?utm_source=echowater&utm_medium=badge&utm_campaign=evidence_profile&utm_content=<product>`.
- [ ] **2.3 Theme snippet `evidence-claim`** for health-claim lines.
  - **Usage:** `{% render 'evidence-claim', topic: 'athletic-performance' %}`.
  - **Rendering:** it shows the topic count with its denominator and outcome mix from `evidence_topics`, worded like "Studied in 34 human trials · 19 improved the main outcome, 12 no clear effect".
  - **Rules:** the word "show" is never used. If the topic isn't in the metafield, the snippet renders nothing. The theme can't invent a topic, because the API decides which topics exist.
- [ ] **2.4 Modal web component `<hs-evidence-modal>`.**
  - **Loading:** a tiny script from `hydrogenstudies.com/embed/evidence-modal.js?v=…`, loaded on first click through `import()`, not on page load.
  - **On click:** it fetches `/api/evidence/:product` (CORS `*`). It renders the counts, the rule text, the matched-study table with PubMed/DOI links and null/negative rows included, the certificate link, the last-updated date, the methodology link, and the reviewer when available. It also shows a "Read the full profile" link to the page.
  - **Behaviour:** focus trap, Esc to close, and `prefers-reduced-motion` support. No cookies, no third-party trackers. The click events go to GA4 through the theme's existing `dataLayer`.
- [ ] **2.5 Theme repo change list, for the Echo theme team.**
  - **Add:** `blocks/evidence-badge.liquid`, `snippets/evidence-claim.liquid`, and the metafield definitions (`hydrogenstudies` namespace, storefront read access).
  - **Placement:** add the block to the PDP templates for products with `badge_enabled`. Today that is the Flask only.
  - **Replace:** PLAN 8.6's hardcoded "The science" study cards, including removing the prohibited ones listed in `reports/echowater/phase8-actions-2026-11-04.md`, with `evidence-claim` instances for allowed topics.
  - **CSP:** allow `hydrogenstudies.com` for `script-src` and `connect-src`, if the theme sets a CSP.
  - **Testing:** develop and QA on an unpublished duplicate theme, then merge into the live theme in the team's normal flow. **Don't publish a duplicate over live edits.**
- [ ] **2.6 Launch QA.**
  - The PDP badge numbers equal `/api/evidence/echo-flask`.
  - Mobile CLS = 0.
  - The modal works with JavaScript off (the link fallback).
  - Every link to echowater.com inside the modal or page carries the CLAUDE.md UTM.
  - Josh has approved the copy file.

**Done when:**
- The Flask PDP shows the badge, server-rendered from the metafield, with numbers that match the API.
- The modal opens and lists every matched study, including null results.
- The claim snippet renders only for allowed topics.
- The 8.6 cards are replaced, so no prohibited topics remain.
- CLS stays at 0.
- Josh has marked the copy file approved.

---

## Phase 3 — "Ask the research" (retrieval-only Q&A)

- [ ] **3.1 New endpoint `POST /api/ask`, separate from `/api/chat`.** It never recommends products, never falls back to "recent studies", and is `context`-aware (`product`, `topic`, `page`).
- [ ] **3.2 Retrieval.** Use the MCP hybrid search (`study_embeddings`) over the Phase 0 fields. Retrieve the top-k with metadata (design, population, dose, `effect_direction`).
- [ ] **3.3 Answer contract.** Every factual sentence cites a `[study:ID]` that was in the retrieved set.
  - **Post-check validator:** the answer is rejected and regenerated, then falls back to a "here are the closest studies" list, if it has an uncited sentence, cites an ID outside the retrieved set, contains a forbidden term (copy-file lint), or contains a disease or treatment claim.
  - **Weak evidence:** when evidence is weak or missing, it says so in fixed copy. For example: "We found only 2 small human studies on this; neither is conclusive" or "We found no human studies on this."
- [ ] **3.4 Refusals.** A classifier plus rules. Diagnosis, treatment and dosing-for-a-condition questions get fixed copy that points to a clinician.
  - **On echowater.com:** questions on Appendix E prohibited topics get no answer content beyond a link to hydrogenstudies.com, where the research is presented without product context. Disease research next to a product is an implied claim.
  - **On hydrogenstudies.com:** research summaries are allowed, with no product content.
- [ ] **3.5 Logging, objection analysis and support routing.**
  - **Intent split first.** Each question is classified as `research` (what do studies say), `product_support` (orders, shipping, warranty, setup, troubleshooting, certificates, "how do I use my Flask") or `medical` (diagnose, treat, dose for a condition).
  - **Support questions don't get a research answer.** The widget searches the support.echowater.com Help Center through Zendesk's public search API and shows the best matching articles. It then offers "Ask Echo support", which opens a ticket **only if the shopper types their email and agrees**, with the question attached. That's a better answer for them and a qualified lead for support. Certificate questions land on the H2 Analytics articles directly.
  - **Don't auto-forward every question to support.** Many are health questions, which carries privacy and liability risk (support agents must not give medical advice). The volume would also bury real tickets.
  - **Weekly digests, aggregated:**
    - to the **Marketing Command Center**: objections, topic demand, refusal rate
    - to **support**: top product questions with no Help Center match, so articles can be written
    - to **Sarah**: research questions where the database has weak or no evidence (content gaps) A new table `ask_log` with:
  - question text, after PII scrubbing (emails, phones, names)
  - topic, `refused_reason`, retrieved IDs, answer hash
  - context (product, page), timestamp, and a salted day-hash of the IP (never the raw IP)

  Retention is 180 days, and the privacy policy is updated before launch. The weekly digests above are built from this table.
- [ ] **3.6 Abuse and cost.**
  - Per-IP and per-origin rate limits (reuse `chatRateLimiter`), a 500-character limit and a daily cost cap with a kill switch env.
  - **No CAPTCHA at launch.** Cloudflare Turnstile is a free, mostly invisible bot check that stops scripts from hammering the widget and running up AI costs. Rate limits plus the daily cost cap are enough to start. Add Turnstile only if the logs show abuse. It needs a Cloudflare site key, not an API token.
  - Answers are cached for identical normalised questions.
  - The model is the `ai-provider` cheap tier, escalating only on a validator retry.
- [ ] **3.7 Evaluation set.** 150 questions: allowed topics, disease bait, dosing bait, "does Echo cure…", competitor questions, and no-evidence topics. Release gate:
  - 100% of factual sentences cited
  - 0 disease or treatment claims
  - 0 product recommendations
  - ≥ 95% correct refusals
- [ ] **3.8 Widget.** A lazy-loaded `<hs-ask>` from the same embed bundle as 2.4, on echowater.com PDPs and on hydrogenstudies.com. All copy comes from the copy file.

**Done when:**
- The eval set passes the gate.
- `/api/ask` is live with rate limits and a cost cap.
- The `ask_log` export reaches the Marketing Command Center weekly.
- Josh-approved copy is in place.
- `/api/chat`'s product recommendations are removed or limited to Appendix E topics. Track this as a separate fix.

---

## 3. Conflicts with docs/PLAN.md and how to resolve them

- **4.3 (structured fields).** Phase 0 *is* 4.3 for the human-study subset, done first. It is not a parallel schema. 4.3's `evidence_level`, `effect_size` and `registration_id` stay in 4.3 for later.
- **4.8 (trust schema).** The user spec asks for `MedicalWebPage` on `/evidence/:product`. Resolution: use `WebPage` until a named, credentialed reviewer signs off. Then use `MedicalWebPage` with `reviewedBy`/`lastReviewed`, and never `about: MedicalCondition` on a product evidence page.
- **5.1 (dose vs. device).** It uses the same matching engine (1.1). 5.1 stays on hydrogenstudies.com study and hub pages. The badge is the echowater.com side.
- **5.2 (for-clinicians).** Kept separate. The evidence profile isn't a practitioner brief. Josh reviews both copy sets together (no outside counsel for now).
- **6.4 (measurement dataset).** The `products` table (0.6) is its seed. Measurements are added later. Until 6.4 exists, only the lab's certified figure is used.
- **8.1 (nightly sync).** Phase 2.1 depends on it. If 8.1 isn't ready, build its badge slice first.
- **8.6 ("Backed by research" PDP section).** It is replaced by the claim snippet, which also removes the prohibited study cards.
- **Appendix E.** The user's example "Improve Athletic Performance" is an allowed context. But the heading itself is a structure/function claim on a sales page. The widget supports it with data and can't make it compliant, so Josh reviews the headings too, against the claim rules in the copy file.
- **CLAUDE.md UTM rule.** It covers links *to* echowater.com. Links *from* echowater.com to hydrogenstudies.com get the `utm_source=echowater…` tags (2.2). Both directions are tagged.

---

## 4. Open questions for Josh

**Answered 2026-11-05:**
- Reviewer: Sarah reviews every study before it is published, and approved the schema.
- Certificates: on support.echowater.com (seed table in 0.6). Forty and One are still in development and will be tested once they launch.
- Turnstile: not at launch.
- Indexing: `/evidence/:product` launches `noindex,follow`.
- Copy review: Josh, with no outside counsel for now.
- Sarah is an Echo contractor, disclosed in every byline.
- Question logs: routed by intent, as in 3.5.

**Still open:**
1. **Sarah's bio.** Her title and credentials, which Sarah is sending to Josh. Until then, bylines show her name and "contractor for Echo Water" only.

## 5. Assumptions

- Each product's matching ceiling is its **latest H2 Analytics measured value** (Flask 8.25 mg/L at 20 min, shown as "8 ppm"), not marketing copy. Where a report gives several cycles, the longest standard cycle is the ceiling and the others are shown too.
- "Dose match" means the study's reported concentration is ≤ the device's certified concentration and the route is drinking water. Studies that don't report a concentration are shown as a separate count, never silently dropped.
- Water made with tablets counts as drinking water. Inhaled gas, saline infusion and bathing are excluded from drinking-water devices.
- Example figures in the brief ("147 human studies", "38 at ≤8 ppm", "34 studies") are illustrative. Today's real numbers are 348, 58 (of 63 that report a concentration) and TBD per topic.
- The theme repo has its own deploy flow, owned by Echo's theme team. This repo ships only the API, SVG, embed scripts and the spec.
- The modal and Q&A run on hydrogenstudies.com infrastructure (Railway). No Shopify app is needed.

## 6. Suggested order and rough effort

| Order | Work | Effort | Gate |
|---|---|---|---|
| 1 | Phase 0 migrations + products table + extraction dry run | 3–4 days | — |
| 2 | Phase 0 review queue + Sarah's sign-off + apply + coverage report | 3–4 days of engineering, plus Sarah's review time (~164 human drinking studies first) | Josh approves the apply CSV |
| 3 | Copy file draft → Josh's review | 0.5 day to draft, then Josh's review | runs in parallel with 4–5 |
| 4 | Phase 1 engine, API, SVG, page, cache | 4–5 days | Phase 0 done |
| 5 | 8.1 minimal sync + Phase 2 spec handoff | 2 days (sync) + 0.5 day (spec) | Phase 1 live |
| 6 | Phase 2 theme work (Echo theme team) | 2–3 days | copy approved |
| 7 | Phase 3 `/api/ask` + eval set + widget | 7–9 days | Phase 0 done; copy approved |

Total: about 4–5 weeks of engineering. The critical path is Phase 0 data quality and Sarah's review of the extracted fields, not the code.
