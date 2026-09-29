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

## Wave-2 leftovers published (Josh: "can you also do the left over wave 2 pages")
All four pages were rewritten in place, with every source checked in PubMed. None has product content: the old product links were removed, and the disclosure is the only mention of the funder.
- `/blog/hydrogen-water-vs-alkaline-water`: a full rewrite covering pH vs dissolved H2, ionizer (ERW) water, ORP and "microcluster" myths, and safety (ionizer water above pH 9.8, kidney disease). It includes an original buffering table: ~1,800 L of pH 9.5 ionizer water matches one teaspoon of baking soda.
- `/blog/h2-tabs-side-effects`: added "How do you make hydrogen water?" (the four routes, what controls the dose you actually drink, DIY warnings, how to test it) and a matching FAQ. All existing content is kept.
- `/blog/hydrogen-therapy-machine-home`: rewritten from a buying guide into an honest device guide. It adds a table of the H2 doses used in 10 human studies and an "Is hydrogen flammable?" section (4–75% in air; H2–O2 machines are an explosion risk; safety steps). The disclosure notes that Echo sells hydrogen machines, including an inhalation machine.
- `/blog/hydrogen-inhalation-side-effects`: refreshed with adverse events from 15 human studies in a table. The unsupported "100+ studies" claim was corrected, with a visible correction note.
Backups and published copies: `wave2-leftovers/`.

## Wave 4: sleep-quality hub launched (Josh: "lets launch the sleep hub now")
- PR #84 was merged. Migration 024 added the hub row and it went live at 04:54 UTC. The 30-minute delay came from a boot cache warm-up that ran before the migration; it's fixed in this PR (hub caches are invalidated after migrations).
- `scripts/content/launch-sleep-hub.sql`: adds the 301 `/explore-by-benefit/sleep` → `/explore-by-condition/sleep-quality` and tags 6 cited human trials "Sleep Quality".
- The benefits guide's sleep section now includes the null double-blind jelly trial (Higashikawa 2026) and links to the hub (`reports/content/wave4/benefits-guide`).
