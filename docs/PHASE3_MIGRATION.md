# Phase 3 — Public-route SSR migration proposal (PLAN.md §Phase 3)

**Framework: Next.js 15, App Router, ISR** (decided under Josh's full-autonomy directive,
2026-09-01; reversible until scaffold work starts). Rationale over Astro: the entire client
is already React (~300 components port incrementally rather than rewrite), and Phases 6–7
keep adding interactive tools (evidence-gap map, filters, API explorer) where React SSR+ISR
is the natural fit.

## Topology (recommended)

- **New Railway service `web`** running Next.js (standalone output). Express + Postgres stay
  exactly as they are on the existing service.
- **Routing at Cloudflare** (or Railway edge): `/api/*`, `/admin/*`, `/proxy/*`, `/uploads/*`
  → Express service (unchanged). Everything else (public GETs) → Next service.
- **Data access:** Next reads Postgres directly through a thin read-only data layer that
  imports `shared/schema.ts` (same drizzle schema, `DATABASE_URL` read replicaable later).
  No HTTP hop through Express for page data.
- **`/admin` and pipeline tooling stay on the SPA** (PLAN §2 rule): Express keeps serving the
  Vite build for `/admin/*` and login/session routes. Sessions/CSRF untouched.
- **Caching (plan 3.6):** ISR revalidate: studies/hubs 24h, blog on-demand (revalidateTag on
  publish), home 1h. Cloudflare caches HTML for anonymous requests (`s-maxage`,
  `stale-while-revalidate`) — crawler traffic never reaches the rate limiter.

## Route migration order (each behind `NEXT_PUBLIC_SSR_ROUTES` flag, diff-verified)

1. `/study/[id]` — MedicalScholarlyArticle + BreadcrumbList JSON-LD; ≤300-char abstract
   excerpt + PubMed/PMC/DOI links (PLAN §2 abstract rule); markdown→HTML with heading ids.
2. Hubs: `/explore-by-*`, `/hydrogen-for/*` (MedicalWebPage schema; Phase 4 adds reviewedBy).
3. `/blog/[slug]` + `/blog` (Article schema; direct-answer block from 2.4).
4. `/`, `/about`, `/learn/*`, `/editorial-policy`, `/methodology`, misc static.
5. Search pages last (interactive; can stay client-rendered inside the Next shell, still
   noindex per 0.6).

## What ports as-is vs. adapts

- **As-is (client components):** ui/* primitives (shadcn), cards, badges, charts, search
  filter widgets — imported unchanged into Next client components.
- **Adapts (become server components):** page shells (StudyPage, hub pages, BlogPostPage,
  Home) — their data fetching moves from react-query to server-side loaders; Helmet becomes
  Next `metadata` exports.
- **Dies with the migration:** seo-bot-middleware + seo-body-renderer + the UA allowlist
  (plan 3.4), the client CSRF primer for public pages, react-helmet on migrated routes.
- **Study URLs (plan 3.3):** keep current slugs at launch; the PMID/DOI-slug change + 301s is
  its own step after the SSR cutover (don't couple two risky changes).

## Verification (plan 3.2)

`scripts/reports/ssr-diff.ts OLD_URL NEW_URL` — fetches both with a plain UA, compares
visible text (normalized) and JSON-LD blocks, reports similarity + missing schema types.
Run per route before flipping its flag. "Done when" (plan): `curl -A "RandomBot/1.0"` on any
public URL returns full article HTML matching the browser DOM; no code path references a
crawler UA list; CF cache HIT >80% on /study/*.

## Sequencing & effort

1. Scaffold `web/` (Next 15, TS, tailwind config shared) + data layer + /study/[id] — ~1 day.
2. Diff-verify 20 sample studies; fix gaps; staging service on Railway — ~1 day.
3. Hubs + blog + static routes — ~2-3 days.
4. Cutover: Cloudflare route switch per route-family, monitor CWV + GSC crawl stats (0.14
   baselines) — gradual, reversible per family.
5. Delete allowlist + bot renderer (3.4) once all families are cut over.
