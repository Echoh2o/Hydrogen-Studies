# CLAUDE.md — Hydrogen Studies

Rules of engagement (from docs/PLAN.md §2 — Josh's standing decisions; do not relitigate in-session):

- Generation stays off: `GENERATION_ENABLED=false` unless Josh flips it; if on, drafts only.
- Content-destructive ops (merge, 301, 410, noindex, sitemap removal) run only after a report and Josh's approval of the exact URL list.
- Every crawler gets the same HTML as a browser. No user-agent branching that changes content. (Interim bot-SSR allowlist exists until the Phase 3 SSR migration deletes it.)
- Product/sponsor bridges render only on pages whose primary topic is in the PLAN.md Appendix E allowlist. Never on disease pages.
- Abstracts: show ≤300-character excerpt + link to PubMed/DOI. Never republish full abstracts (publisher copyright). Our summary is ours.
- Every link to echowater.com carries `utm_source=hydrogenstudies&utm_medium=referral&utm_campaign=<page_type>&utm_content=<slug>`.
- Every indexable page shows: funding disclosure, author or reviewer, last-reviewed date.
- Empty fields never render; no placeholder strings (`__no_content__`) reach HTML.
- Study URLs use the permanent ID (PMID/DOI-derived); never regenerate slugs.
- SSR migration covers public routes only; `/admin` and pipeline tooling stay on the SPA.
- Schema only for what's visible on the page. No FAQPage without a visible FAQ, no reviewedBy without a named reviewer.

## Project facts

- Deploys: Railway auto-deploys `hydrogen-studies` (default branch). Schema is owned by boot migrations (`server/migrations/` + `_migrations` table); `drizzle-kit push` is BANNED in prod (drops the runtime-managed `search_vector`). Migrations are boot-fatal — dedupe-first, idempotent, registered in `server/app.ts`.
- Tests: vitest, mocked-db unit convention (no integration DB except the PGlite specs); E2E in CI is `continue-on-error` with 4 known fixture failures + 1 flaky sitemap test — compare failure lists against the base branch before blaming a PR.
- The growth roadmap is `docs/PLAN.md` — work it top to bottom; "report first" items produce a report for Josh before anything destructive runs.
