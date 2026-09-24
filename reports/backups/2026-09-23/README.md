# Content backups — 2026-09-23/24

Rollback copies taken immediately before each change (keyword plan wave 1 + follow-ups,
approved by Josh in session).

- `hydrogenstudies-posts/backup-<slug>-<ts>.json` — full `blog_articles` rows before a rewrite
  or merge (publish-articles.cjs / merge-articles.cjs). Revert: restore `content`, `title`,
  meta fields and `is_published` from the JSON.
- `hydrogenstudies-posts/orig-<slug>.md` — `content` before contextual links to the wave-1
  guides were inserted (10 posts). Revert: set `content` back to this file.
- `echowater-articles/<id>.json` — Shopify article bodies before link repairs / new links
  (24 edited, 4 unchanged). Revert: `articleUpdate(id, article: {body: <backup body>})`.
  Change log: `reports/echowater-link-changes-2026-09-23.csv`.
- `echowater-flask-seo-before-after.json` — Echo Flask product SEO title/description before
  and after. Revert: `productUpdate(product: {id, seo: {title: "", description: <current>}})`.
