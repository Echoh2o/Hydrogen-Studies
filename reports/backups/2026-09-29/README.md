# Content changes, 2026-09-29

All of these were approved by Josh in session.

- **Benefits merge (continued).** "sure merge it too" covers
  `/blog/hydrogen-water-health-benefits-how-it-travels-your-body-200719` (id 7311). It was unpublished and
  301'd to `/blog/molecular-hydrogen-benefits-guide-pillar`. The older redirect `…-2024-606454` was repointed so it doesn't chain.
  Backup: `merges/`.
- **Hub variant 301s.** "Approve all 75 301s": 75 unknown hub slugs now 301 to their canonical hub, for example
  ophthalmologic → eyes-vision, hepatic → liver, atherosclerosis → cholesterol. The list, with impressions, is in
  `reports/hub-404-impact-2026-09-28.csv` (PR #81). Every other unknown hub slug now returns 404 (#81).
- **Empty life-stage hubs.** "Yes, 404 + drop from sitemap": `infants-children` and `elderly-aging` had 0 studies.
  The code change is in #81.
- **Anti-aging post.** "301 to the skin-aging hub": `/blog/how-to-use-hydrogen-water-for-anti-aging-a-science-backed-guide-617073`
  (id 7492) presented a mouse study as advice for people and named Echo machines. It was unpublished and 301'd to
  `/explore-by-condition/skin-aging`. The 16 older consolidation 301s that pointed at it were repointed to the hub. Backup: `merges/`.
- **Hub links in 13 blog posts.** Links to redirected hub URLs now point straight at the target hub. Links to hubs that no
  longer exist (e.g. `/explore-by-condition/cancer`, `chronic-pain`, `allodynia`, `myelosuppression`) are now
  plain text. Backups of each post: `hub-link-fixes/`.
