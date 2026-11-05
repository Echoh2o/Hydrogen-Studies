# echowater.com — Phase 8 inventory (read-only), 2026-11-04

Scope: PLAN.md Phase 8 (8.1–8.10), checked against Appendix E. Nothing was changed. The only tools used were Shopify Admin GraphQL **queries** (no mutations) and plain `curl -A "Mozilla/5.0"` against the storefront.

Sources:
- Admin API: `pages` (all 181 pages, 4 batches, no `body` except the 2 pages quoted in §C), `urlRedirects`, `menus`, `themes(roles:[MAIN])`, `metaobjectDefinitions`, `products(status:active)` descriptions, `blogs`, `appInstallations`.
- Storefront: the sitemap index (36 pages, 32 products, ~27 collections, 524 blog URLs). **199 URLs were crawled.** That covers every sitemap page, product and collection, plus 103 of the 138 `/blogs/blog/` URLs. Shopify then rate-limited the rest of the blog (HTTP 429), so 0 of 45 `/blogs/newsroom` and 1 of 337 `/blogs/water-quality` URLs were scanned. **The blog part of the compliance scan is partial.**
- Live hydrogenstudies count, from `https://hydrogenstudies.com/embed/stats.json`: `{"totalStudies":2276,"humanTrials":348,"healthConditions":21}`.

Store: Echo Water, Shopify Plus. Main theme: **`EchoWaterShopify/main`** (`gid://shopify/OnlineStoreTheme/180164722994`, role MAIN, last updated 2026-11-04T17:33Z).

---

## A. Summary

| Item | State today | What a change would touch | Content-destructive? |
|---|---|---|---|
| 8.1 Nightly metaobject sync | No research/study metaobject definitions exist. The live count is injected **client-side** by `hydrogenstudies.com/embed/study-count.js`. Static fallback text is "2,200+" (live value is 2,276). The app proxy `/tools/hydrogen-research` returns 404. | New metaobject definitions plus a theme section/snippet. Remove the JS embed later. | No |
| 8.2 `/pages/hydrogen-studies` hub + "Research" in nav | Page is live, 601 words, legacy copy ("DOCTOR APPROVED", "over 1,000 s tudies, 205 of which are actual human studies"). All 17 study links point to `echoh2o.com` PDFs, and none resolve (16 → 404, 1 ends on a 301). Disease study categories are listed. "Research" is not in the live nav. | Page body (default template) or a new page template. Nav menu `new-main-menu-2`. | Copy replacement only; URL kept |
| 8.3 `/pages/why-hydrogen` citations | 1,331 words, **0 inline citations**, 1 link to hydrogenstudies.com. "Jounrey" is **not present** (already reads "Journey"). The page does not say "over 1,000 studies"; it says "2,200+" (JS-updated). The homepage FAQ also says "2,200+", not "over 1,000". | Theme template `page.why-hydrogen` (23 sections). | No |
| 8.4 "How we measure 8 ppm" page | **Not found.** The Flask PDP has a "Lab Results" block (H2 Analytics report H2AR-250116-1: 6.07 mg/L at 10 min, 8.25 mg/L at 20 min) and a PDF certificate (200). No saturation, outgassing-curve or dosing content anywhere crawled. | New page + template. Link from the PDP template(s). | No |
| 8.5 Dedupe | `/pages/hydrogen-science` is still **200** (noindex,nofollow, not in sitemap). Its text is 96% the same as `/pages/why-hydrogen`. `/pages/echo-hydrogen-water` and `-1` **already 301** to `/collections/hydrogen-water`. | URL redirect (+ optionally unpublish the page). | **Yes — needs Josh's approval** |
| 8.6 PDP "Backed by research" | H2, Flow, Revive and Refresh PDPs **already have** a "The science" module with 4 unlinked study titles. **Some titles are prohibited Appendix E topics.** Flask, Forty, One, Ultimate and Prebiotic have no study module, only an FAQ line linking to hydrogenstudies.com. | Product template `main` section blocks / metafields. | No (but removing the prohibited cards is a copy change) |
| 8.7 Quiz / badge / hreflang | `/pages/hydrogen-deficiency-quiz` is published, noindex,nofollow, not in sitemap, and has 0 inbound links among the 199 crawled pages. `/pages/quiz` ("Which Echo Product Is Right for You?") already exists. The accreditedbusiness.com badge is in the theme footer on all 199 crawled pages. hreflang for `/en-mx/` is **present and reciprocal**. | Page publish state / redirect. Footer section. Nothing for hreflang. | Quiz retirement = **yes (approval)** |
| 8.8 Blog E-E-A-T | 103 crawled `/blogs/blog/` posts: all have Article JSON-LD and an author; 0 show "Reviewed by"; 34 link PubMed/DOI/PMC; 23 link hydrogenstudies.com. | Article template + per-article metafields. | No |
| 8.9 Press logos | Section `logos_social_proof` on `/`, `/products/echo-flask`, `/pages/brand-ambassador`. 8 logo images, **empty alt, no links, no dates**. | Theme section blocks. | No |
| 8.10 Organization schema | Theme emits `Organization` with name, url, logo, contactPoint and 5 socials. Missing founder, foundingDate, address, LinkedIn/Crunchbase/Wikidata and subOrganization. **FAQPage JSON-LD is invalid JSON** on 4 pages. `/llms.txt` is Shopify's platform-generated agent file with no Echo/science section. | Theme JSON-LD snippet. FAQ section Liquid. | No |

---

## B. Item-by-item detail

### 8.1 Replace the runtime proxy with a nightly sync

- **Metaobject definitions that exist (23):** faq_items (24 entries), article_item (6), how_to_use (5), quote_card (13), icon_with_text (9), badge (7), what_s_included_product (2), importer_address (1), `shopify--knowledge-base-fact` (23), and Shopify taxonomy types (material, color-pattern, age-group, flavor, dietary-*, supplement-*, product-certifications-standards, water-filter-application, drinkware-material). **None hold study counts, evidence levels, featured studies, reviewer credentials or living-review numbers.**
- **How the count gets into the page today:** a `<script src="https://hydrogenstudies.com/embed/study-count.js" defer>` on every page fetches `/embed/stats.json` and rewrites each `<span data-hs-count>`. Static HTML says "2,200+"; after JS it shows 2,276. Crawlers that don't run JS see "2,200+". This doesn't cause a 503, but the number does not live in the HTML.
- **App proxy:** `https://echowater.com/tools/hydrogen-research` → 404 and `/tools/hydrogen-research/studies` → 404 (both re-checked today; `/apps/hydrogen-research` also 404). `https://hydrogenstudies.com/proxy/studies` → 401. This matches `reports/proxy-status.md`. The Admin API does not expose app-proxy configuration, and none of the first 50 `appInstallations` is a Hydrogen Studies app (that query was not paginated). I could not confirm which app, if any, owns the proxy subpath.
- **Change touches:** new metaobject definition(s) + entries (sync job writes) and a theme section/snippet that reads them. No URL or content removal.

### 8.2 `/pages/hydrogen-studies` → Research hub; "Research" in main nav

- **URL:** `https://echowater.com/pages/hydrogen-studies` → 200. Self-canonical, in sitemap. Title "Hydrogen Water Research & Studies | Echo Water". Shopify page `gid://shopify/Page/133027561778`, templateSuffix "" (default page template; content is in the **page body**). 601 words rendered.
- **Current copy (excerpts):**
  - "DOCTOR APPROVED Because of our science-based philosophy, many doctors and scientific specialists support us and our products."
  - "There are over 1,000 s tudies on hydrogen, 205 of which are actual human studies." (sic)
  - "We have found 2,200+ peer-reviewed studies on the benefits of hydrogen…" (both counts appear on the same page)
  - "Our products are designed to provide a therapeutic amount of hydrogen gas for the body."
- **Study list:** 17 links, all to `https://echoh2o.com/wp-content/uploads/*.pdf`. They redirect to `echowater.com/wp-content/...`. Checked all 17: **16 → 404**; 1 (a trailing-slash duplicate) ends on an unresolved 301. Category headers include CANCER, DIABETES, INFLAMMATION AND DISEASES, NEUROLOGICAL DISORDERS, EYES (cataract), LIVER. Titles include "Hydrogen–Water Enhances 5-Fluorouracil-Induced Inhibition of Colon Cancer" and "Hydrogen as a Novel Hypothesized Emerging Treatment for Oxidative Stress in Autism". The filenames suggest full-text publisher PDFs (e.g. `Nature_070508-compressed.pdf`), which goes against the abstract/copyright rule. They are dead links today.
- **Inbound links:** among the 199 crawled pages, only the page itself (canonical) references `/pages/hydrogen-studies`. Redirects already pointing at it: `/h2-studies`, `/studies`, `/pages/scientific-studies`, `/pages/science`, `/pages/h2-studies` (+2 malformed variants), `/research.html`.
- **Near-duplicate `/pages/h2-studies`:** unpublished, already **301 → /pages/hydrogen-studies**. Nothing to do.
- **Main nav (live header = menu `new-main-menu-2`):** Shop ▸ (Hydrogen Water, Water Filtration, Whole House Water Filters, Under Sink & Kitchen, Wellness, Accessories, Replacement Filters, Shop All) · Learn ▸ (FAQ, **Science → /pages/why-hydrogen**, Gut Health, Free Water Contaminant Scan, About ECHO, Blog) · Support. The header also has a featured "ECHO Flask" card. **No "Research" item.**
  - Unused menu `new-mega-menu-4-2026` (not in the live header) contains "1,355+ Peer-reviewed studies on Molecular Hydrogen- Backed by Dr. Paul Barattiero" → `https://hydrogenstudies.com/studies`. That count is stale and the wording is endorsement-style.
  - Menu `main-menu` (legacy: Echo Flask, Hydrogen Water #, Water Filters #, Shop All) is not the live header.
- **Change touches:** page body (or switch to a new `page.research-hub` template fed by 8.1 metaobjects) and the nav menu `new-main-menu-2` (add "Research"). The URL is reused, so nothing is removed. The disease-category study list is product-adjacent content on a commercial domain. Under Appendix E it should not carry over into the new hub next to product links.

### 8.3 `/pages/why-hydrogen` — citations, "Jounrey", study count

- **URL:** 200, self-canonical, in sitemap. Title "Hydrogen Water Benefits: The Science of H2 – Echo Water". Page `gid://shopify/Page/153767117106`, template **`why-hydrogen`** (content in 23 theme sections; Admin body is just the meta summary). 1,331 words.
- **Citations:** 0 inline. Main-content links are only `https://hydrogenstudies.com` ("Review the Studies") and 3 PDPs (Flask, Prebiotic, Ultimate) in a "Shop Hydrogen Water" module.
- **Mechanism claims to cite:** about 8 "journey" accordion statements (Nrf2/SOD/catalase, NF-κB/NLRP3, mitochondria/ATP, etc.), 15 ✔ claims across Brain / Heart & Metabolism / Exercise / Gut / Skin, plus 5 "How?" chains. Examples: "Hydrogen reduces inflammatory signaling molecules like NF-kB, NLRP3 inflammasome, and Pro-inflammatory cytokines." · "✔ Improves insulin sensitivity" · "• Improved glucose control".
- **"Jounrey":** not found in the HTML of `/pages/why-hydrogen` or `/pages/hydrogen-science`. Both read "Hydrogen's Journey". Already fixed.
- **"over 1,000 studies":** not on `/pages/why-hydrogen` and not in the homepage FAQ. Both now say "2,200+" in a `data-hs-count` span (JS-updated to 2,276). why-hydrogen also says "more than 53 countries" (unsourced). The "over 1,000" string survives only on `/pages/hydrogen-studies` (8.2).
- **Change touches:** theme template `templates/page.why-hydrogen.json` section settings/blocks (not the page body).

### 8.4 "How we measure 8 ppm" page

- **Not found.** No page handle, title or crawled text covers saturation (~1.6 ppm), outgassing over time, or a test method.
- **What exists:**
  - `/products/echo-flask`: "Lab Results — The ECHO Hydrogen Flask has been lab‑tested and certified by H2 Analytics (Report H2AR‑250116‑1, dated January 16, 2025). Using gas chromatography testing on distilled water, the Flask consistently delivered 6.07 mg/L … after a 10‑minute cycle and up to 8.25 mg/L after 20 minutes…" The report PDF (`cdn.shopify.com/.../Echo_Flask_H2_Test_Report_H2AR-250116-1.pdf`) → 200. Also: "valid certification status by H2 Analytics in conformance with IHSA and US EPA standards. Registration# 24-0701-1-PB".
  - `/pages/echo-flask-compare` and `/pages/flask`: "Certified PPM 8 PPM vs < 5 PPM", "H2 Analytics Certified".
- **Stated PDP concentrations (for the page's context):** Flask "up to 8 ppm (20-min cycle) / 6 ppm in 10 min" · Forty 6 ppm · One 4 ppm · Ultimate up to 1.46 ppm · H2 up to 1.44 ppm · Flow up to 1.21 ppm · Revive up to 1.6 ppm · Prebiotic "16 PPM".
- **Change touches:** new Shopify page + template, and a link block in the product template(s).

### 8.5 Dedupe

| URL | Status today | Duplicate of | Evidence |
|---|---|---|---|
| `/pages/hydrogen-science` | **200**, `noindex,nofollow`, self-canonical, not in sitemap, published (template `how-hydrogen-helps`), 0 inbound links found | `/pages/why-hydrogen` | Word-sequence similarity 0.962; 5-word shingle Jaccard 0.897. Differences are casing/punctuation ("By, Why Hydrogen?" vs "But, why hydrogen?"). |
| `/pages/echo-hydrogen-water` | unpublished; **already 301 → /collections/hydrogen-water** (redirect id 607148179762) | n/a | done |
| `/pages/echo-hydrogen-water-1` | unpublished; **already 301 → /collections/hydrogen-water** (607199002930) | n/a | done |

- Shingle comparison across all crawled pages and products with ≥80 words: **no other pair above 0.5 Jaccard.**
- Existing redirects worth knowing: `/pages/warranty`, `/pages/echo-technologies-product-warranty`, `/pages/echo-product-warranties` → `/pages/product-warranties` (warranty dupes resolved). `/pages/faqs` → `/pages/faq`. `/pages/echoh2water` and `/pages/drfab` → `/products/echo-flask`.
- One 2-hop chain: `/pages/dr-fab` → `/pages/drfab` → `/products/echo-flask`.
- **Change touches:** URL redirect (Online Store → Navigation → URL redirects). Unpublishing the page is optional; Shopify applies a redirect only when the path doesn't resolve, so the page must be unpublished or deleted first. **Content-destructive → approval required (list in §D).**

### 8.6 "Backed by research" on hydrogen PDPs

| PDP | Study module? | Current study cards (unlinked titles; "Browse the research hub →" links `https://hydrogenstudies.com`) | Appendix E status of the cards |
|---|---|---|---|
| `/products/echo-flask` | No (FAQ line "2,200+ peer-reviewed studies" → hydrogenstudies.com) | n/a | n/a |
| `/products/echo-forty-hydrogen-tumbler` | No (FAQ line) | n/a | n/a |
| `/products/echo-one-machine` | No (FAQ line) | n/a | n/a |
| `/products/echo-ultimate-hydrogen-water` | No (no hydrogenstudies link) | n/a | n/a |
| `/products/hydrogen-prebiotic-stick-pack-30-pack` | No | n/a | n/a |
| `/products/echo-h2-hydrogen-water-machine` | **Yes** | Oxidative stress · Hydration ("…antioxidant capacity in healthy adults") · Gut health · **Metabolic markers: "Hydrogen-rich water and markers of oxidative balance in metabolic syndrome"** | Metabolic syndrome = **prohibited**. Gut health = gray (default prohibited). |
| `/products/echo-flow-hydrogen-water-machine` | **Yes** | Same 4 as H2 (incl. **metabolic syndrome**) | same |
| `/products/echo-revive-hydrogen-bath-machine` | **Yes** | **"Dermatology: Hydrogen water bathing — positive effects on psoriasis and parapsoriasis"** · Body composition (visceral fat, skin blotches) · Inflammation · Skin aging (wrinkles) | Psoriasis = named disease → **prohibited**. Inflammation = gray. Wrinkles = allowed (cosmetic). |
| `/products/echo-refresh-hydrogen-inhalation-machine` | **Yes** | Oxidative stress · Recovery (exercise) · Cognition (fatigue/mood) · **"Cardiopulmonary: Hydrogen-oxygen mixed gas inhalation and respiratory symptom outcomes"** | Respiratory disease = **prohibited**. Cognition = gray. |

- None of the cards link to a specific study. Several titles read as paraphrases ("…mechanisms under study"), not published titles. I couldn't verify them against PubMed in this pass.
- Plan target for the Flask (exercise recovery, fatigue, oxidative-stress markers) is not met: the Flask has no module.
- **Change touches:** product template(s), the `main` section in each product template JSON (blocks), or a metafield/metaobject-driven block once 8.1 exists.

### 8.7 Credibility nits

**Hydrogen deficiency quiz**
- `https://echowater.com/pages/hydrogen-deficiency-quiz`: 200, published (`gid://shopify/Page/138487431474`, default template). `<meta name="robots" content="noindex,nofollow">`, not in sitemap. H1 "Hydrogen Deficiency Quiz" plus an Okendo quiz embed (`oke-channel-quiz-id="7704a2e6-2128-4d2d-921e-f3f88a632202"`); the quiz questions render client-side and were not read.
- **Where it appears:** 0 of 199 crawled pages link to it. No menu item points to it. Off-site use (email/ads) is unknown.
- The only "deficiency" mention found is `/blogs/blog/echo-ceo-josh-carr`, which already caveats it: "('Hydrogen deficiency' isn't a recognized medical diagnosis; this is Josh's analogy.)"
- A reframed quiz **already exists**: `/pages/quiz`, title "Quiz: Which Echo Product Is Right for You?" (Okendo quiz `5eb606ef-…`), in sitemap, indexable.

**accreditedbusiness.com badge**
- Footer section `sections--25021308469554__footer`: `<a href="https://www.accreditedbusiness.com/accredited-businesses/echo-water-llc/" target="_blank">` wrapping an inline SVG seal. It is on **all 199 crawled pages** (site-wide footer). Target → 200. No `bbb.org` link anywhere crawled.
- **Change touches:** theme footer section (remove the block or swap in a BBB profile URL). Not content-destructive.

**hreflang for `/en-mx/`**
- `https://echowater.com/en-mx/`: `hreflang="x-default"` → `/`, `en` → `/`, `en-ZA` → `https://echowater.co.za/`, `en-MX` → `/en-mx`; canonical `https://echowater.com/en-mx`.
- `https://echowater.com/en-mx/products/echo-flask`: the same 4 alternates; canonical `/en-mx/products/echo-flask`. The US PDP carries the same reciprocal set with a US canonical.
- The sitemap index lists `/en-mx/sitemap_{products,pages,collections,blogs,articles}_1.xml`.
- **Result: Shopify Markets emits reciprocal hreflang; nothing to change.** (`<html lang="en">` on both.)

### 8.8 Blog E-E-A-T (partial sample)

- Blog counts (Admin): `blog` 298 articles (138 URLs in sitemap), `newsroom` 76 (45 in sitemap), `water-quality` 485 (337 in sitemap). `home`, `hydrogen-water-research`, `hydrogen-water-health` and `water-quality-news` have 0 articles.
- Of the 103 crawled `/blogs/blog/` posts:
  - JSON-LD authors: Sarah Taylor 21, Jacob Colvin Walker 19, Alesha Peluso 13, Audrey Barattiero 13, Echo Water Editorial Team 12, Alex Koritz 9, Echo Water 5, Josh Carr 3, others ≤2.
  - **0 posts show "Reviewed by" / "Medically reviewed".**
  - 34 link PubMed/DOI/PMC; 23 link hydrogenstudies.com.
- Gated on 2.5 (which posts survive). **Change touches:** article template plus per-article metafields (reviewer, reviewed date).

### 8.9 Press logos

- Section `logos_social_proof` ("section-logo-slider") on `/` (`…__logos_social_proof_ERWH7U`), `/products/echo-flask` (`…__logos_social_proof_z8MGFJ`) and `/pages/brand-ambassador`.
- Logos (file names): Logo_WomensHealth, Logo_TheIndependent, Logo_Forbes, Logo_10xHealth, Logo_DOAC, Logo_NBC, Logo_ABC, Logo_FoxNews. **All 8 have `alt=""`, there are no `<a>` links in the section, and no dates.**
- `/pages/newsroom` has dated, linked coverage (businesswire ×3, athletechnews, inboundlogistics, msn.com, coasttocoastam, pagesuite, YouTube). **None of it is Forbes, NBC, ABC, Fox News, Women's Health, The Independent or DOAC.** Only 10X Health matches (the press release "Echo and 10X Health Launch Co-Branded Hydrogen Flask").
- One newsroom link carries a theme-preview token (`…?_cd=…&preview_theme_id=180164722994&preview_token=r33f1rau…`). That's a cleanup nit.
- **Change touches:** the logo-slider section blocks in the home, Flask product and brand-ambassador templates (add link + date per logo, or drop logos with no verifiable coverage).

### 8.10 Organization schema / llms.txt

- **Current `Organization` JSON-LD** (same on `/`, `/pages/about`, `/pages/why-hydrogen`, `/products/echo-flask`; emitted by the theme — the exact snippet file was not read):
  `{"@type":"Organization","name":"Echo Water","url":"https://echowater.com","logo":".../square_logo.webp","contactPoint":{"@type":"ContactPoint","contactType":"customer service","url":"https://echowater.com/pages/contact"},"sameAs":["https://x.com/echohydrogen","https://www.facebook.com/echohydrogen","https://www.instagram.com/echohydrogen","https://www.youtube.com/@Echohydrogen","https://www.tiktok.com/@echohydrogen"]}`
  - Missing: `founder`, `foundingDate`, `address`, `subOrganization`, LinkedIn/Crunchbase/Wikidata in `sameAs`.
  - Facts the /pages/about timeline already shows: "2005 | The Beginning | Paul Barattiero founded ECHO…" · "2016 | Launched hydrogenstudies.com" · "2023 | Paul Barattiero brings in Josh Carr as CEO". Per the schema rule, add only what is visible on the page.
- **Schema defects found while checking:**
  - **`FAQPage` JSON-LD is invalid JSON** (raw newline inside a string, right after `<span data-hs-count>2,200+</span>`) on `/`, `/products/echo-flask`, `/pages/brand-ambassador` and `/pages/corporate-gifting`. It is valid on `/pages/faq` and `/pages/echo-flask-resource-library`. The `data-hs-count` span HTML is also embedded inside the JSON-LD `text`.
  - `/products/echo-flask` has **two `Product` blocks** with the same `@id` (`/products/echo-flask#product`): one has aggregateRating 4.6/543, the other has offers/gtin.
- **`/llms.txt`:** 200, Shopify platform-generated "Agent Instructions — Echo Water" (Shop skill, UCP, store policies). It mirrors `/agents.md`. **No About Echo / Science section.** I didn't verify whether the theme can override it.

---

## C. Compliance flag list — disease / cure / "proven" claims on public pages

Every flag below was quoted from the rendered storefront on 2026-11-04 (main content only).

- **Counted:** 16 public URLs — 12 firm, 4 gray.
- **Not counted:** 2 stored-but-not-public pages, and the water-quality pages that discuss contaminants.
- Standard disclaimers ("not intended to diagnose, treat, cure, or prevent any disease") were excluded from matching.

### C1. Firm flags (12)

| # | URL | Exact quote(s) |
|---|---|---|
| 1 | `/pages/hydrogen-studies` | "DOCTOR APPROVED … many doctors educating their patients about molecular hydrogen water and recommend it to them as a therapeutic benefit." · "Our products are designed to provide a therapeutic amount of hydrogen gas for the body." · Category headers "CANCER", "DIABETES", "NEUROLOGICAL DISORDERS" with titles "Hydrogen–Water Enhances 5-Fluorouracil-Induced Inhibition of Colon Cancer", "Hydrogen as a Novel Hypothesized Emerging Treatment for Oxidative Stress in Autism" |
| 2 | `/pages/why-hydrogen` | "✔ Improves insulin sensitivity" · "Result • Healthier cholesterol • Improved glucose control" (same page carries a "Shop Hydrogen Water" product module) |
| 3 | `/` (home) | "Clinically Studied \| Scientifically Proven \| Naturally Powerful" · "Repairs the Microbiome" · FAQ: "Research suggests it may help with various health conditions." |
| 4 | `/products/echo-flask` | "Repairs the Microbiome \| Plays a role in the gut's natural microbial ecosystem." · FAQ: "Research suggests it may help with various health conditions." |
| 5 | `/products/echo-h2-hydrogen-water-machine` | Study card "Metabolic markers \| Hydrogen-rich water and markers of oxidative balance in metabolic syndrome" (prohibited topic on a PDP) |
| 6 | `/products/echo-flow-hydrogen-water-machine` | Same card: "Hydrogen-rich water and markers of oxidative balance in metabolic syndrome" |
| 7 | `/products/echo-revive-hydrogen-bath-machine` | "Dermatology \| Hydrogen water bathing — positive effects on psoriasis and parapsoriasis" · "Published work on hydrogen bathing looks at wrinkles, blotches and skin conditions such as psoriasis." |
| 8 | `/products/echo-refresh-hydrogen-inhalation-machine` | "Cardiopulmonary \| Hydrogen-oxygen mixed gas inhalation and respiratory symptom outcomes" · "Use as a stand alone therapy or combine with other modalities" (also in the Admin product description) |
| 9 | `/products/echo-replacement-filters` (product description) | "…reduce your exposure to various toxins that can contribute to a variety of health issues, such as infection, liver and kidney damage, cancer, and more. … the Echo Replacement Filters have been tested and proven to provide you with truly safe and clean drinking water." |
| 10 | `/pages/ebook-download-page` | "Hydrogen gas (H2) reduces oxidative stress and inflammation which is the leading cause of disease." (attributed to "Dr Paul Barattiero") |
| 11 | `/pages/newsroom` | Video title "Hydrogen Water for Chronic Pain Relief" (01.01.2024) |
| 12 | `/blogs/blog/can-hydrogen-water-help-with-weight-loss` | "Yes—hydrogen water can support weight loss by improving metabolism, balancing blood sugar, and lowering oxidative stress." · "…helping stabilize blood sugar, hydrogen water creates the kind of internal environment where healthy weight loss can actually happen." |

### C2. Gray flags (4) — Appendix E gray areas (inflammation, gut health, condition-primary pages)

| # | URL | Exact quote(s) |
|---|---|---|
| 13 | `/products/hydrogen-prebiotic-stick-pack-30-pack` | "Help reduce inflammation & accelerate recovery" · "hydrogen reduces gut inflammation and supports microbial diversity" · "combines clinically-backed molecular hydrogen with prebiotic fiber" |
| 14 | `/pages/gut-health` | "Hydrogen water restores balance to your gut's hydrogen economy." · "Anti-inflammatory … Gut Barrier Protection" |
| 15 | `/pages/pain-webinar` | Primary topic is a condition: "Acute pain is a signal. Chronic pain can become a loop." · "What research suggests about H₂ and pain-related outcomes, including soreness, inflammatory pain, neuropathic pain…" (page does carry the FDA disclaimer) |
| 16 | `/pages/hydrogen-webinar-replay` | Testimonial: "I just received my 6-month labs and saw a large reduction in inflammatory markers — and the biggest thing I'd changed this year was consistently drinking hydrogen water from Echo." |

### C3. Not public (stored in Admin; unpublished and 301'd) — not counted

- `/pages/echoh2water` (→ 301 `/products/echo-flask`), Admin body: "hydrogen water has been proven to help regulate heart disease, diabetes, reduce wrinkles and skin issues, and speed up wound healing." · "hydrogen water has been proven to improve mental clarity, prevent cognitive illness … and help with mental illnesses."
- `/pages/drfab` (→ 301 `/products/echo-flask`), Admin body: "At HydrogenStudies.com there are 1000+ studies showing hydrogen to be exert disease modifying effects with hundreds of Diseases including cancer, diabetes, Parkinsons, Rhuematoid Arthritis…" · "Hydrogen proven to increase cognitive (brain) function."

### C4. Context, not counted

- `/pages/water-quality-analysis-v2` and `/pages/schedule-consultation` link **water contaminants** to cancer/disease (e.g. "Linked to cancer, thyroid disease, and immune suppression."). These describe contaminants, not hydrogen or product benefits.
- Most other blog hits for disease terms are hedged descriptions of studies ("In adults with metabolic syndrome, 24 weeks of hydrogen-rich water reduced total cholesterol…") or explicit negations ("None of this means molecular hydrogen is a cure for depression…"). Many are disease-topic posts; whether product CTAs appear on them belongs to the 2.5/8.8 review.
- **Blog coverage is partial:** 103/138 blog URLs, 0/45 newsroom, 1/337 water-quality.

---

## D. Proposed 301s (content-destructive — Josh approves the exact list)

| # | From | To | Why | Prereq |
|---|---|---|---|---|
| 1 | `/pages/hydrogen-science` | `/pages/why-hydrogen` | 96% word-sequence match. Currently 200 + noindex, not in sitemap, 0 inbound links found. | Unpublish page `gid://shopify/Page/161668628786` first (Shopify redirects only fire on unresolved paths) |
| 2 *(optional, 8.7)* | `/pages/hydrogen-deficiency-quiz` | `/pages/quiz` | Retire the "deficiency" framing; the product-finder quiz already exists. Currently noindex, not in sitemap, 0 inbound links found. Off-site (email/ad) links unknown — check Klaviyo/ads before approving. | Unpublish page `gid://shopify/Page/138487431474` first |
| 3 *(optional, hygiene)* | `/pages/dr-fab` | `/products/echo-flask` | Collapse a 2-hop chain (`/pages/dr-fab` → `/pages/drfab` → PDP) by retargeting existing redirect 463044837682 | none (edit of an existing redirect) |

Already done, no action: `/pages/echo-hydrogen-water` and `/pages/echo-hydrogen-water-1` → `/collections/hydrogen-water`; `/pages/h2-studies` → `/pages/hydrogen-studies`; warranty duplicates → `/pages/product-warranties`.

---

## E. Page inventory notes

- 181 Shopify pages total. 36 are in the sitemap; many published landing pages (`/pages/flask`, affiliate/influencer landers, webinars) are noindex and outside the sitemap.
- Many "0-word" pages in Admin are theme-template pages (templateSuffix set), so their copy lives in theme JSON sections, not the page body. That's the case for why-hydrogen, hydrogen-science, faq, about, why-echo, newsroom, gut-health, the flask pages and pain-webinar.
- Pages whose content **is** in the page body (default template): hydrogen-studies, hydrogen-deficiency-quiz (H1 + embed), privacy/terms, store-locator, product-warranties.
