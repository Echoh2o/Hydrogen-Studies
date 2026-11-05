# echowater.com — Phase 8 actions, 2026-11-04

Josh approved Shopify access on 2026-11-04. The inventory is in `phase8-inventory-2026-11-04.md`. This file records what was changed, what needs a theme edit, and what needs Josh's approval.

## Done on the store (live)

| Item | Change | Backup |
|---|---|---|
| 8.2 Research hub | `/pages/hydrogen-studies` body replaced. Removed: "DOCTOR APPROVED", "therapeutic amount", "over 1,000 s tudies, 205…", the cancer/diabetes/autism study categories and 17 dead `echoh2o.com` PDF links (most were full publisher PDFs). New copy: what Hydrogen Studies is and that Echo funds it, the live count (still JS-updated via `data-hs-count`), links to the allowed-topic hubs only (exercise recovery, athletic performance, oxidative stress, antioxidant status, skin aging, sleep quality), the H2 Analytics Flask report, the brand-neutral device guide, and "not a treatment for any disease". | `reports/backups/echowater/page-hydrogen-studies-2026-11-04.json` |
| 8.2 Nav | "Research" → `/pages/hydrogen-studies` added as a top-level item in the live header menu `new-main-menu-2`, between Learn and Support. All other items resent unchanged. | `reports/backups/echowater/menu-new-main-menu-2-2026-11-04.json` |
| 8.4 8 ppm page | Created **unpublished** draft `/pages/how-we-measure-hydrogen` ("How We Measure 8 ppm", Page 167092420914). Uses only the published H2 Analytics report (H2AR-250116-1: 6.07 mg/L at 10 min, 8.25 mg/L at 20 min, GC, distilled water), saturation physics (~1.6 ppm), and the database's dose range. It states that outgassing has not been measured yet. PLAN Section 12 lists 8.4 for legal review, so it stays unpublished until counsel and Josh sign off. Then link it from the PDPs. | n/a (new) |

Rollback: re-send the backup body with `pageUpdate` / the backup items with `menuUpdate`.

## Theme patches (live theme writes are blocked for the connector)

Several PDP templates on the live theme were edited today (17:28–17:33 UTC). A copied theme published later would undo those edits, so these patches go to whoever edits the theme. Each one is small.

1. **Broken FAQPage JSON-LD** on `/`, `/products/echo-flask`, `/pages/brand-ambassador`, `/pages/corporate-gifting`. `sections/clarity-faqs.liquid` already uses `| json`, but the answer contains the token `[study_count]`. A later site-wide replace swaps that token for `<span data-hs-count>2,200+</span>` plus a newline, *inside* the JSON string, so the JSON becomes invalid. Fix in `sections/clarity-faqs.liquid`:
   ```liquid
   "text": {{ block.settings.answer | replace: '[study_count]', '2,200+' | strip_html | strip_newlines | json }}
   ```
   Apply the same change to any other FAQ section that prints JSON-LD from answers containing `[study_count]`.
2. **Prohibited study cards on PDPs (Appendix E).** These cards are hardcoded in the `echo-*-pdp` sections. Remove them, or replace them with allowed-topic cards that link to a specific study:
   - `echo-h2-pdp` and the Flow PDP: "Metabolic markers: Hydrogen-rich water and markers of oxidative balance in metabolic syndrome"
   - `echo-revive-pdp`: "Dermatology: Hydrogen water bathing — positive effects on psoriasis and parapsoriasis", plus the sentence "…skin conditions such as psoriasis."
   - `echo-refresh-pdp`: "Cardiopulmonary: Hydrogen-oxygen mixed gas inhalation and respiratory symptom outcomes"
3. **Home/Flask FAQ copy** (block settings in the templates): "Research suggests it may help with various health conditions." and "potential therapeutic benefits". Proposed replacement: "Hydrogen water is being studied for antioxidant effects, exercise recovery and energy. Most research so far is in cells and animals, and human trials are small. It is not a treatment for any disease."
4. **8.10 Organization schema** (`snippets/schema.organization.liquid`): add `foundingDate: "2005"` and `founder: Paul Barattiero`. Both are visible on `/pages/about`. Add `subOrganization` → Hydrogen Studies (`https://hydrogenstudies.com`). Add LinkedIn/Crunchbase to `sameAs` once the URLs are confirmed.
5. **8.7 accreditedbusiness.com badge**: remove it from `sections/footer.liquid`, or swap in a real BBB profile.
6. **8.9 Press logos** (`sections/logos-social-proof.liquid`): add alt text, plus a link and date per logo. Drop logos with no verifiable coverage. The newsroom has none from Forbes, NBC, ABC, Fox News, Women's Health, The Independent or DOAC.

## Needs Josh's approval (content-destructive — exact URLs)

| # | From | To | Note |
|---|---|---|---|
| 1 | `/pages/hydrogen-science` | `/pages/why-hydrogen` | 96% duplicate; noindex; must unpublish page 161668628786 first |
| 2 | `/pages/hydrogen-deficiency-quiz` | `/pages/quiz` | retires the "deficiency" framing; check email/ad links first; unpublish page 138487431474 first |
| 3 | `/pages/dr-fab` | `/products/echo-flask` | retarget existing redirect 463044837682 to remove a 2-hop chain |

## Compliance copy (12 firm flags in the inventory §C1)

Not changed yet: these are marketing pages owned by the Echo team. Of the 12, the hub page (#1) is now fixed. The PDP cards (#5–#8) are theme patch 2 above, and the home/Flask FAQ lines (#3, #4) are theme patch 3. The rest are page or product copy that the content owner should rewrite, or that Josh can tell me to rewrite:
- `/pages/why-hydrogen`: "✔ Improves insulin sensitivity", "Improved glucose control" (also 8.3 citations)
- `/` and `/products/echo-flask`: "Scientifically Proven", "Repairs the Microbiome"
- `/products/echo-replacement-filters` description: "…cancer, and more… tested and proven"
- `/pages/ebook-download-page`: "…inflammation which is the leading cause of disease"
- `/pages/newsroom`: video "Hydrogen Water for Chronic Pain Relief"
- `/blogs/blog/can-hydrogen-water-help-with-weight-loss`: "balancing blood sugar"

## Not started

- **8.1 nightly metaobject sync:** engineering work. The JS embed already supplies the live count, so nothing is broken.
- **8.3 citations on why-hydrogen:** 23 theme sections. This needs the theme-edit path above and a study-by-claim mapping.
- **8.6 Flask research block:** the Flask PDP has none. It needs the theme path and three or more allowed-topic study links.
