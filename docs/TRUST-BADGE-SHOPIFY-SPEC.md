# Evidence badge on echowater.com — theme spec (TRUST-BADGE-PLAN Phase 2)

**For:** Echo's theme team (the Shopify theme repo `EchoWaterShopify/main`) · **From:** Hydrogen Studies · **Date:** 2026-11-05
**Status:** spec only. The hydrogenstudies.com side is built (Phase 1, PR #171). Badges stay off until Josh approves the copy in `shared/evidence-badge-copy.ts`.

## What the shopper sees

On an eligible product page, under the price or near the "Lab results" block:

> **327 human studies on molecular hydrogen · 36 used drinking water at ≤8.25 ppm → See the research**
> From Hydrogen Studies, the research library Echo Water funds

Next to a health-benefit heading such as "Athletic performance", a one-line claim widget:

> Studied in 23 human studies: 13 improved their main outcome, 3 found no clear effect and 7 had mixed results · See the studies

Clicking either opens a modal with:
- the counts and outcome mix
- the matching rule in plain language
- every matched study, with PubMed or DOI links, including null and mixed results
- the H2 Analytics report
- the reviewer (Sarah Taylor-Laine, M.Sc., Research Director, Echo Water)
- the date and a methodology link

A "Read the full profile" link goes to `https://hydrogenstudies.com/evidence/<product>`.

**Eligible products today:** Echo Flask (`echo-flask`), Echo H2 Machine (`echo-h2-machine`), Echo Ultimate (`echo-ultimate`) and Echo Flow (`echo-flow`). Each has a lab-measured drinking-water concentration. These are not eligible:
- **Prebiotic sticks:** measured in a sealed vial.
- **Revive and Refresh:** a bath and an inhaler.
- **Pitcher:** a draft product.
- **Forty and One:** not yet tested.

## Data path (no runtime dependency, no layout shift)

1. **Nightly sync (Hydrogen Studies side).** A job writes two product metafields in the `hydrogenstudies` namespace using the existing `SHOPIFY_ACCESS_TOKEN` (store `ef6478-2.myshopify.com` = echowater.com). The token needs `write_products`; the theme team should confirm the scope.
   - `hydrogenstudies.evidence_profile` (json): `{ slug, line1, line2, cta, source, evidenceUrl, svgUrl, version, generatedAt }`
   - `hydrogenstudies.evidence_topics` (json): `{ "<topic>": { line, cta, url } }` for the Appendix E topics with ≥ 3 studies: athletic-performance, exercise-recovery, oxidative-stress, sleep-quality, skin-appearance, fatigue-energy

   The values come from `GET https://hydrogenstudies.com/api/evidence/<slug>` and `/topic/<topic>`. Products without an enabled badge get **no** metafield.
2. **Theme renders from the metafield in Liquid.** The page needs no fetch, so a hydrogenstudies.com outage can't blank the badge (that's the lesson of the old `/tools/hydrogen-research` proxy returning 503).
3. **The modal fetches live** from `https://hydrogenstudies.com/api/evidence/<slug>` on click. CORS is `*` and no cookies are sent.

## Theme repo changes

| File | Change |
|---|---|
| `blocks/evidence-badge.liquid` (new app/theme block) | Renders from `product.metafields.hydrogenstudies.evidence_profile.value`. **Renders nothing** if the metafield is missing, or if `generatedAt` is older than 14 days. Fixed-height container, so CLS is 0. Markup: a `<button>` with line1/line2 and a small source line. No placeholder, no fallback number. |
| `snippets/evidence-claim.liquid` (new) | `{% render 'evidence-claim', topic: 'athletic-performance' %}`. Renders `evidence_topics[topic].line` and a "See the studies" button. **Renders nothing** if the topic key is absent; the server decides which topics exist (Appendix E only). |
| `assets/` or a script tag | `<script type="module" src="https://hydrogenstudies.com/embed/evidence-modal.js?v=<version>">` loaded on **first click** (dynamic `import()`), not on page load. The web component `<hs-evidence-modal product="echo-flask">` is built on the Hydrogen Studies side (Phase 2.4). |
| Product templates for the eligible products | Add the `evidence-badge` block. |
| `echo-*-pdp` sections ("The science" cards) | Remove the hardcoded study cards, which include prohibited topics (see `reports/echowater/phase8-actions-2026-11-04.md`, theme patch 2). Replace them with `evidence-claim` renders for allowed topics. |
| Theme CSP (if set) | Allow `https://hydrogenstudies.com` in `script-src` and `connect-src`. |

**Links:**
- Links from echowater.com to hydrogenstudies.com carry `utm_source=echowater&utm_medium=badge&utm_campaign=evidence_profile&utm_content=<slug>`.
- Links inside the modal that point back to echowater.com carry the hydrogenstudies UTM rule.

## Rules the theme must keep

- **No custom wording.** Never edit the badge or claim wording in the theme. All copy comes from the metafield or the API, so it stays the approved copy.
- **Disease topics are out.** Never place the claim widget next to a disease or medical-condition heading.
- **No hardcoded counts.** Don't hardcode any count, even as a fallback.

## QA before publishing (on an unpublished theme copy, then merged into live)

- The badge numbers equal `https://hydrogenstudies.com/api/evidence/echo-flask`.
- Mobile CLS is 0, and the modal loads only on click.
- With JavaScript off, the link opens `/evidence/echo-flask`.
- An ineligible product shows nothing.
- Each removed "science" card is gone from the H2, Flow, Revive and Refresh pages.

## Rollout

1. Josh approves `shared/evidence-badge-copy.ts`, which stamps `COPY_APPROVAL`.
2. Turn on the Flask badge (`products.badge_enabled`), then the H2, Ultimate and Flow.
3. The first metafield sync runs.
4. The theme team ships the block and snippet.
