# Echowater embeds — live study count + footer badge

Agent playbook for the echowater.com Shopify theme (`~/dev/Shopify/EchoWaterShopify`).
Hand this file to a Claude Code session in the theme repo:

> Follow ~/dev/Hydrogen-Studies/docs/ECHOWATER_EMBEDS.md — install the embeds, convert every
> study-count reference, add the footer badge, then give me the report.

Served by hydrogenstudies.com (`server/routes/embed-routes.ts`):

| URL | What |
| --- | --- |
| `https://hydrogenstudies.com/embed/study-count.js` | Fills every `[data-hs-count]` element with the live count |
| `https://hydrogenstudies.com/embed/badge.svg` | Footer badge with the live count baked in (`?theme=dark` for dark footers) |
| `https://hydrogenstudies.com/embed/stats.json` | Raw counts: `{ totalStudies, humanTrials, healthConditions }` |

Prerequisite: `curl -sI https://hydrogenstudies.com/embed/study-count.js` returns 200. If it 404s the
Hydrogen Studies PR isn't deployed yet — stop and say so.

## Rules

1. **One number, one source.** Every claim about how many hydrogen studies exist uses the live count.
   No hardcoded study totals remain in the theme except the single fallback in `snippets/hs-study-count.liquid`.
2. **Never overclaim.** Static fallback text is always rounded DOWN to the nearest 100 with a `+`
   (e.g. live 2,283 → `2,200+`). Check `https://hydrogenstudies.com/embed/stats.json` for the live total.
   The theme currently says `2,500+` in places — that exceeds the real count and must go.
3. **Describe it as "studies" or "peer-reviewed studies".** The total is NOT a count of clinical or human
   trials — drop "clinical"/"human" qualifiers next to it ("2,200+ published clinical studies" →
   "{% render 'hs-study-count' %} peer-reviewed studies").
4. **Badge wording is fixed server-side** ("Our research library · Hydrogen Studies"). Do not write
   "authorized", "certified", "verified" or "approved" anywhere near it: Hydrogen Studies is funded by
   Echo Technologies, so a seal-style claim would be a self-issued endorsement.
5. **Only convert research-size claims.** Leave alone: participant counts, a single study's numbers,
   years, prices, review counts, "studies show…" with no number.

## Step 1 — install (once)

Create `snippets/hs-study-count.liquid`:

```liquid
{%- comment -%}
  Live Hydrogen Studies total. Renders plain inline text that inherits the surrounding style.
  The fallback is what no-JS visitors/crawlers see; keep it rounded DOWN with "+".
  Usage: {% render 'hs-study-count' %}  or  {% render 'hs-study-count', format: 'floor' %}  (→ 2,200+)
{%- endcomment -%}
{%- assign hs_fallback = '2,200+' -%}
<span data-hs-count{% if format == 'floor' %} data-hs-format="floor"{% endif %}>{{ hs_fallback }}</span>
```

Create `snippets/hydrogen-studies-badge.liquid`:

```liquid
{%- comment -%} Usage: {% render 'hydrogen-studies-badge' %} or {% render 'hydrogen-studies-badge', theme: 'dark' %} {%- endcomment -%}
<a href="https://hydrogenstudies.com/?utm_source=echowater&utm_medium=referral&utm_campaign=footer_badge"
   class="hs-badge" style="display:inline-block;line-height:0">
  <img src="https://hydrogenstudies.com/embed/badge.svg{% if theme == 'dark' %}?theme=dark{% endif %}"
       width="220" height="64" loading="lazy"
       alt="Hydrogen Studies – Echo Water's molecular hydrogen research library">
</a>
```

Add the loader once, just before `</body>`, in **each** of `layout/theme.liquid`,
`layout/theme.partners.liquid` and `layout/theme.claim.liquid` (not `password.liquid`):

```liquid
<script src="https://hydrogenstudies.com/embed/study-count.js" defer></script>
```

## Step 2 — find every reference

```bash
grep -rnoiE "[0-9][0-9,]*\+?\s*(peer[- ]reviewed |published |scientific |clinical |research )*(studies|research papers|scientific papers|papers|articles|trials)" \
  sections snippets blocks templates layout locales config
```

Also search for spelled-out forms ("over a thousand studies", "thousands of studies") and read each hit in
context (Rule 5).

## Step 3 — convert, by where the text lives

| Where | Replace the number with |
| --- | --- |
| Liquid markup (`sections/`, `snippets/`, `blocks/`, `layout/`) — visible text | `{% render 'hs-study-count' %}` |
| JSON template / `config/settings_data.json` setting whose schema type is `richtext`, `inline_richtext`, `html` or `liquid` | `<span data-hs-count>2,200+</span>` (for `liquid` type, the render tag also works) |
| JSON setting of type `text` / `textarea` (HTML is escaped) | Static rounded-down text `2,200+` — list it in the report |
| Inside an HTML attribute, `<title>`, meta tags, JSON-LD, or a JS string | Static rounded-down text `2,200+` — list it in the report |
| `snippets/reploChunk.*` (Replo-generated; edits get overwritten on republish) | Don't edit — list file + text in the report for a Replo/admin change |
| Admin content (product descriptions, pages, blog posts) | `<span data-hs-count>2,200+</span>` in the HTML editor (script is global) |

Look up a setting's type in the `{% schema %}` of the section named by the block's `"type"`.

## Step 4 — footer badge

Render `{% render 'hydrogen-studies-badge' %}` once in the site footer section(s) used by `footer-group`
(and `flask-landing-footer-group` if the landing footers should carry it). Use `theme: 'dark'` when the
footer background is dark. Keep it next to other trust/legal items, not inside a link list.

## Step 5 — verify

1. Re-run the Step 2 grep: the only remaining totals are the snippet fallback and the reported static ones.
2. `shopify theme check` passes (no new errors).
3. `shopify theme dev` (or a preview theme), open the home page, a Flask landing page and an FAQ:
   - the number shows the live total and inherits the heading/paragraph style;
   - DevTools console has no errors from `study-count.js`;
   - the footer badge shows the live count and links with the UTM params.
4. Never publish to the live theme without Josh's go-ahead — push to an unpublished/preview theme.

## Step 6 — report

- Files changed, and per-file count of references converted.
- Static (non-live) references left, with file:line and why (attribute, `text` setting, JSON-LD…).
- Replo chunks / admin content still needing a manual or Replo change.
- Any claim that was rewritten beyond swapping the number (e.g. dropped "clinical").
