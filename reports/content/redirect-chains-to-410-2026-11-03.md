# Redirect chains that end in a 410 — for Josh's approval

**Found 2026-11-03 during the CTR pass.** 5,378 active 301s point at a URL that Phase 2 later retired with a 410. A crawler or visitor follows the 301 and then gets "gone". The outcome is right, but each one costs two requests instead of one. The first hops have had 187,023 hits in total, and 4,431 were hit in the last 30 days, so crawlers are still spending budget on them.

Exact list: `redirect-chains-to-410-2026-11-03.csv` (id, from_path, current_target, hit_count, last_hit).

## Proposed

1. **Change each of the 5,378 from a 301 to a 410.** Same end result, one hop. This is a 410 change, so under CLAUDE.md it waits for approval of the exact list (the CSV).
2. **Exception to decide first:** 115 of these source URLs still had Google impressions in the last 90 days. Option: 301 those to the matching topic hub instead of a 410, keeping whatever ranking they still have. I can produce that 115-row mapping for review before anything runs.

## Already done (non-destructive)

- 172 chains of two 301s were collapsed to point straight at their final page. All 6 final targets were checked live (200). Backup: `reports/backups/redirect-chain-collapse-*.csv`.
- The cancer-support post's 50 older duplicates now point straight at `/hydrogen-for/cancer-support`.
