# Phase 3 Completion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish PLAN.md Phase 3 — delete the bot-SSR path (3.4), complete site-wide JSON-LD (3.5), move the last indexable public routes (`/learn/*`, `/research-analytics`) to the Next.js front door, and prepare stable PMID/DOI study URLs (3.3) as a report for Josh's approval.

**Architecture:** Express stays the data/meta source of truth (`/api/page-data/*`), Next (`web/`) renders every public page for every visitor. The 866-line `seo-bot-middleware.ts` is split into what is still live (page meta, revalidate notify, `isBot` for rate limiting) and what is dead (UA-gated prerender, LRU cache, prewarm), and the dead half is deleted with its tests ported to the page-data API. Breadcrumb trails become a shared pure module so the visible `<nav>` and the `BreadcrumbList` schema are built from one array. Stable study URLs ship as a resolver + plan/apply script; the 301 map is a report only until Josh approves.

**Tech Stack:** Express 4, Drizzle/Postgres, Next 14.2 App Router (per-request render, `unstable_cache` page data), React 18 + `@tanstack/react-query` 5 (`HydrationBoundary`), vitest + supertest, Railway (two services: `Hydrogen-Studies` = Express, `web` = Next).

**Already done (verify, don't redo):** 3.1 framework (Next), 3.2 route rollout for study/blog/hubs/hydrogen-for/policy/about/legal/home/studies, 3.6 dropped by Josh (no Cloudflare access), 3.7 CWV pass (#126: mobile Lighthouse 97–98).

**Baseline:** `npx vitest run` → 74 files / 1,352 tests green on `cd0e6d5`.

---

## File map

| Area | Create | Modify | Delete |
|---|---|---|---|
| A. 3.4 bot-SSR removal | `server/services/page-meta.ts`, `server/services/web-revalidate.ts`, `server/utils/user-agent.ts`, `server/__tests__/page-meta.test.ts`, `server/__tests__/user-agent.test.ts`, `server/__tests__/web-revalidate.test.ts` | `server/index.ts`, `server/routes/page-data-routes.ts`, `server/middleware/spa-shell.ts`, `server/controllers/studies-controller.ts`, `server/routes/blog-routes.ts`, `server/services/content-consolidation.ts`, 9 test files (import paths / harness), `CLAUDE.md` (allowlist sentence) | `server/middleware/seo-bot-middleware.ts`, `server/__tests__/seo-bot-middleware.test.ts` |
| B. 3.5 JSON-LD | `shared/breadcrumbs.ts`, `server/__tests__/breadcrumbs-schema.test.ts` | `server/middleware/seo-body-renderer.ts` (all `breadcrumbs([...])` call sites), `server/services/page-meta.ts` (add BreadcrumbList + CollectionPage/MedicalWebPage), `shared/condition-hub-intros.ts` (`conditionHubJsonLd`), `server/__tests__/condition-hub-intros.test.ts` | — |
| C. learn + analytics → Next | `client/src/pages/content/LearnContent.tsx`, `client/src/pages/content/HydrogenBasicsContent.tsx`, `client/src/pages/content/HealthBenefitsContent.tsx`, `client/src/pages/content/HydrogenTherapyGuideContent.tsx`, `client/src/pages/content/ResearchAnalyticsContent.tsx`, `shared/learn-faqs.ts`, `web/app/learn/page.tsx`, `web/app/learn/basics/page.tsx`, `web/app/learn/health-benefits/page.tsx`, `web/app/learn/therapy-guide/page.tsx`, `web/app/research-analytics/page.tsx` | `client/src/pages/LearnPage.tsx`, `client/src/pages/HydrogenBasicsPage.tsx`, `client/src/pages/HealthBenefitsPage.tsx`, `client/src/pages/educational/HydrogenTherapyGuide.tsx`, `client/src/pages/ResearchAnalyticsPage.tsx`, `client/src/components/learn/learn-faqs.ts` (re-export), `web/components/ClientProviders.tsx` (dehydrated state), `server/services/page-meta.ts` (`/learn` entry + FAQPage), `server/middleware/web-frontdoor.ts` (families), Railway var `SSR_FAMILIES` | — |
| D. 3.3 stable study URLs | `scripts/consolidation/stable-study-urls.ts`, `server/__tests__/stable-study-slug.test.ts`, `reports/consolidation/stable-study-urls-2026-11-03.{csv,md}` | `shared/study-slug.ts` (new pure helpers), `server/services/study-service.ts` (`getStudyBySlug` fallbacks), `server/routes/page-data-routes.ts` (return `canonicalSlug`), `web/app/study/[slug]/page.tsx` (`permanentRedirect` when slug ≠ canonical) | — |

Each area is one PR. A → B → C run in the main checkout in that order (B and C edit `page-meta.ts`, which A creates). D runs in parallel in a worktree.

---

## A. Task 1 — Extract live meta code into `server/services/page-meta.ts`

**Files:**
- Create: `server/services/page-meta.ts`
- Create: `server/__tests__/page-meta.test.ts`
- Read: `server/middleware/seo-bot-middleware.ts:1-520` (what to move)

What moves, verbatim except where noted: `PageMeta`, `resolvePageMeta`, `buildStudyMeta`, `buildBlogMeta`, `visibleBlogText`, `exploreIndexMeta`, `resolveStaticPageMeta`, `isContentPath`, `CONTENT_PATH_PATTERNS`, `SITE_URL`, `SITE_NAME`, and the imports they need (`db`, `studies`, `blogArticles`, `eq`, `and`, `toAbsoluteUrl`, the `shared/*` helpers, `marked`, `getConditionHubs` from `../middleware/seo-body-renderer`).

Drop: `ECHOWATER_CANONICAL`, `ECHOWATER_PROXY_BASE`, `canonicalForStudy`, `canonicalForCondition` — the env var is unset in Railway, PLAN §12 says study pages stay canonical on hydrogenstudies.com, and Phase 8.1 replaces the runtime proxy. Canonicals become `${SITE_URL}/study/${slug}` and `${SITE_URL}/explore-by-condition/${slug}` inline.

- [ ] **Step 1: Write the failing test** `server/__tests__/page-meta.test.ts`

```ts
/**
 * Page meta for every public path — what the Next front door and the SPA
 * shell put in <head>. Pure of HTTP: no user agents, no caches.
 */
import { describe, it, expect, vi } from "vitest";

vi.mock("../db", () => ({ db: { select: () => ({ from: () => ({ where: () => ({ limit: async () => [] }) }) }) } }));
vi.mock("../middleware/seo-body-renderer", () => ({ getConditionHubs: async () => [] }));
vi.mock("../utils/logger", () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));

const { buildStudyMeta, buildBlogMeta, resolveStaticPageMeta, isContentPath } = await import("../services/page-meta");

describe("buildStudyMeta", () => {
  it("canonical is always on hydrogenstudies.com and og:image is absolute", () => {
    const meta = buildStudyMeta({ id: 1, slug: "a-study-pmid-123", title: "A Study", imageUrl: "uploads/x.png" });
    expect(meta.canonical).toBe("https://hydrogenstudies.com/study/a-study-pmid-123");
    expect(meta.ogImage).toBe("https://hydrogenstudies.com/uploads/x.png");
    expect((meta.jsonLd as any)["@type"]).toBe("MedicalWebPage");
  });
});

describe("buildBlogMeta", () => {
  it("emits Article only — no FAQPage when the Q&As are not in the body", () => {
    const meta = buildBlogMeta({ slug: "p", title: "P", content: "<p>body</p>", questionAnswerPairs: [{ question: "Hidden?", answer: "Yes" }] });
    expect(Array.isArray(meta.jsonLd)).toBe(false);
    expect((meta.jsonLd as any)["@type"]).toBe("Article");
  });
});

describe("resolveStaticPageMeta", () => {
  it("noindexes /learn and the search pages; indexes hubs", () => {
    expect(resolveStaticPageMeta("/learn/basics")!.robots).toBe("noindex, follow");
    expect(resolveStaticPageMeta("/search")!.robots).toBe("noindex, follow");
    expect(resolveStaticPageMeta("/explore-by-condition")!.robots).toBeUndefined();
  });
  it("unknown paths and unknown hydrogen-for topics have no meta", () => {
    expect(resolveStaticPageMeta("/nope")).toBeNull();
    expect(resolveStaticPageMeta("/hydrogen-for/not-a-topic")).toBeNull();
  });
});

describe("isContentPath", () => {
  it("is true only for DB-backed study/blog paths", () => {
    expect(isContentPath("/study/x")).toBe(true);
    expect(isContentPath("/studies/tags")).toBe(false);
    expect(isContentPath("/about")).toBe(false);
  });
});
```

- [ ] **Step 2: Run it** — `npx vitest run server/__tests__/page-meta.test.ts` → FAIL (module not found).
- [ ] **Step 3: Create `server/services/page-meta.ts`** by moving the code described above. File header comment: "Page meta (title, description, canonical, robots, OG, JSON-LD) for every public path. Consumed by the Next front door (/api/page-data) and the SPA shell. No user-agent logic lives here (PLAN 3.4)."
- [ ] **Step 4: Run it** → PASS.
- [ ] **Step 5: Commit** `refactor(seo): page meta resolvers move to services/page-meta (no UA logic)`.

## A. Task 2 — `web-revalidate.ts` and `user-agent.ts`

**Files:**
- Create: `server/services/web-revalidate.ts` (move `notifyWebRevalidate` verbatim; export it)
- Create: `server/utils/user-agent.ts` (move `BOT_PATTERNS` + `isBot`; header comment: "Used ONLY to scope the crawler rate limiter (server/index.ts). PLAN 3.4: user-agent logic may remove things (analytics, rate-limit scope) but must never change content.")
- Create: `server/__tests__/web-revalidate.test.ts` — port the two `notifyWebRevalidate` tests from `seo-bot-middleware.test.ts:306-337` unchanged except the import path.
- Create: `server/__tests__/user-agent.test.ts` — port `describe("isBot — AI crawler detection")` from `seo-bot-middleware.test.ts:109-133`.

- [ ] Steps: write both tests → run (FAIL) → create modules → run (PASS) → commit `refactor(seo): isBot and notifyWebRevalidate get their own modules`.

## A. Task 3 — Re-point callers and delete the middleware

**Files:**
- Modify: `server/index.ts:23` → `import { isBot } from "./utils/user-agent";`
- Modify: `server/routes/page-data-routes.ts:26` → `from "../services/page-meta"`
- Modify: `server/middleware/spa-shell.ts:19` → `from "../services/page-meta"`
- Modify: `server/controllers/studies-controller.ts:6,725-726`, `server/routes/blog-routes.ts:11,801,841,1367,1451`, `server/services/content-consolidation.ts:25,417` → `import { notifyWebRevalidate } from "../services/web-revalidate"` and call `notifyWebRevalidate(path)` (same argument; the LRU half of `invalidateBotCache` has nothing to clear any more).
- Delete: `server/middleware/seo-bot-middleware.ts`, `server/__tests__/seo-bot-middleware.test.ts` (everything not ported in Tasks 1–2 tested the UA-gated prerender itself: 404 HTML, Vary header, head-asset preservation, LRU; their replacements are `spa-shell.test.ts` and `page-data-routes.test.ts`).
- Modify test import paths: `explore-listed-hubs.test.ts:72`, `markup-compliance.test.ts:71`, `reaudit-2026-09-28.test.ts:85` → `../services/page-meta`; `page-data-routes.test.ts:24` and `spa-shell.test.ts:14` mock `../services/page-meta` instead; `studies-controller-excluded.test.ts:31` mocks `../services/web-revalidate` with `{ notifyWebRevalidate: () => {} }`.

- [ ] **Step 1:** `grep -rn "seo-bot-middleware" server web shared --include='*.ts' --include='*.tsx'` → only the files above.
- [ ] **Step 2:** Make the edits; delete the two files.
- [ ] **Step 3:** `npx tsc --noEmit -p .` → 0 errors (the three harness tests below will still fail to import; fix them in Task 4 before running the suite).
- [ ] **Step 4:** Commit `feat(ssr): delete the bot-only prerender middleware and UA allowlist (PLAN 3.4)`.

## A. Task 4 — Port the three harness tests to the page-data API

The invariant these tests protect is "the HTML a crawler gets equals what a browser gets and has the right status". With the prerender gone, the crawler-facing surface is `GET /api/page-data/page?path=…` (Next renders it for everyone). Mount the real `page-data-routes` router in each harness instead of `seoBotMiddleware`.

**`server/__tests__/seo-meta-compliance.test.ts:163-189`** — replace the describe with:

```ts
describe("#7 page-data serves resolved meta, not the homepage fallback", () => {
  const app = express();
  app.use("/api/page-data", pageDataRoutes);
  it.each(["/hydrogen-for/diabetes", "/insights", "/research-analytics"])("%s", async (p) => {
    const res = await request(app).get(`/api/page-data/page?path=${encodeURIComponent(p)}`);
    expect(res.status).toBe(200);
    expect(res.body.meta.title).not.toBe("Hydrogen Studies | Hydrogen Studies Research Database");
    expect(res.body.meta.canonical).toBe(`https://hydrogenstudies.com${p}`);
    expect(res.body.bodyHtml).toContain("<h1");
  });
});
```
(`import pageDataRoutes from "../routes/page-data-routes";` at the top; drop `fs/os/path` + `seoBotMiddleware` if now unused.)

**`server/__tests__/explore-hub-404.test.ts`** — `siteApp()` becomes `hydrogenRoutes` + `app.use("/api/page-data", pageDataRoutes)` + `sendSpaShell`. In the "unknown hubs" describe, replace the GOOGLEBOT request with `GET /api/page-data/page?path=<url>` and assert `404` (invalid) / `200` (valid); keep the CHROME shell assertions; drop `User-Agent` headers (status must not depend on them). Remove `invalidateBotCache()` from `beforeEach`.

**`server/__tests__/condition-hub-intros.test.ts:445-466`** — the "full Googlebot response" test becomes "page-data head + body agree": request `/api/page-data/page?path=/explore-by-condition/${slug}`; assert `body.meta.title === r.metaTitle`, `body.meta.description === r.metaDescription`, `body.meta.canonical`, `types = (body.meta.jsonLd as any[]).map(b => b["@type"])` equals `["CollectionPage", "FAQPage"]` (Task B changes this expectation), one `<h1` in `bodyHtml`, `faqPairsIfVisible(r.faqs, bodyHtml)` equals `r.faqs`, and `text(bodyHtml)` contains the H1 text. Remove `invalidateBotCache()` from `beforeEach` and the `staticDir` fixture if unused.

- [ ] **Step 1:** Edit the three files as above.
- [ ] **Step 2:** `npx vitest run server/__tests__/seo-meta-compliance.test.ts server/__tests__/explore-hub-404.test.ts server/__tests__/condition-hub-intros.test.ts` → PASS.
- [ ] **Step 3:** `npx vitest run` → all green; `npx tsc --noEmit -p .` → clean.
- [ ] **Step 4:** `CLAUDE.md`: change "(Interim bot-SSR allowlist exists until the Phase 3 SSR migration deletes it.)" to "(The bot-SSR allowlist was deleted 2026-11-03; `isBot` only scopes the crawler rate limiter.)"
- [ ] **Step 5:** Commit `test(ssr): crawler-parity tests run against /api/page-data`; open PR "feat(ssr): delete bot-only prerender + UA allowlist (PLAN 3.4)"; merge when CI is green; confirm Railway deploy SUCCESS; spot-check `curl -A Googlebot` vs plain `curl` on `/explore-by-condition/type-2-diabetes` and `/about` → identical `<title>` and word count.

---

## B. Task 5 — `shared/breadcrumbs.ts`

**Files:**
- Create: `shared/breadcrumbs.ts`
- Test: `server/__tests__/breadcrumbs-schema.test.ts` (pure part)

```ts
/**
 * Breadcrumb trails shared by the crawler/Next renderer (visible <nav>) and
 * page meta (BreadcrumbList JSON-LD) so schema only ever describes what the
 * page shows (CLAUDE.md). The last crumb has no href.
 */
export interface Crumb { label: string; href?: string }

const HOME: Crumb = { label: "Home", href: "/" };

export function blogPostBreadcrumbs(title: string): Crumb[] {
  return [HOME, { label: "Blog", href: "/blog" }, { label: truncateLabel(title, 50) }];
}
export function blogListBreadcrumbs(): Crumb[] { return [HOME, { label: "Blog" }]; }
export function studiesListBreadcrumbs(): Crumb[] { return [HOME, { label: "Research Studies" }]; }
export function conditionHubBreadcrumbs(conditionName: string): Crumb[] {
  return [HOME, { label: "Health Conditions", href: "/explore-by-condition" }, { label: conditionName }];
}
export function bodySystemHubBreadcrumbs(displayName: string): Crumb[] {
  return [HOME, { label: "Body Systems", href: "/explore-by-body-system" }, { label: displayName }];
}
export const EXPLORE_PARENT_LABELS: Record<string, string> = {
  mechanism: "Mechanisms", "delivery-method": "Delivery Methods", "life-stage": "Life Stages",
  benefit: "Benefits", demographic: "Demographics",
};
export function exploreDetailBreadcrumbs(type: string, displayName: string): Crumb[] {
  return [HOME, { label: EXPLORE_PARENT_LABELS[type] || type, href: `/explore-by-${type}` }, { label: displayName }];
}
export function exploreIndexBreadcrumbs(title: string): Crumb[] { return [HOME, { label: title }]; }
export function hydrogenForBreadcrumbs(displayName: string): Crumb[] { return [HOME, { label: `Hydrogen for ${displayName}` }]; }
export function policyBreadcrumbs(title: string): Crumb[] { return [HOME, { label: title }]; }

export function truncateLabel(s: string, max: number): string {
  return s.length > max ? `${s.slice(0, max).trimEnd()}…` : s;
}

/** Standalone BreadcrumbList block (studyJsonLd embeds the same shape). */
export function breadcrumbListJsonLd(crumbs: readonly Crumb[], siteUrl: string): Record<string, any> {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: c.label,
      ...(c.href ? { item: `${siteUrl}${c.href}` } : {}),
    })),
  };
}
```

Note `truncate()` in `seo-body-renderer.ts:90` — check its exact behaviour and make `truncateLabel` identical (the renderer truncates the LAST crumb to 60 in `breadcrumbs()` and blog titles to 50 before that; keep both so visible text == schema `name`). The renderer's `breadcrumbs()` must stop truncating independently: it should render `c.label` as given, and the shared builders do the truncation.

- [ ] Test (pure): `breadcrumbListJsonLd(blogPostBreadcrumbs("T"), SITE)` → 3 items, positions 1..3, last has no `item`, `item` URLs absolute. Run → FAIL → implement → PASS → commit `feat(seo): shared breadcrumb trails + BreadcrumbList builder`.

## B. Task 6 — Renderer uses the shared trails; meta emits BreadcrumbList + page type

**Files:**
- Modify: `server/middleware/seo-body-renderer.ts` — every `breadcrumbs([...])` call (lines 611, 725, 791, 888, 926, 1013, 1080, 1118, 1238, 1284, 1368) uses the matching `shared/breadcrumbs.ts` builder; `breadcrumbs()` renders labels untruncated.
- Modify: `server/services/page-meta.ts`:
  - `buildBlogMeta`: `jsonLd` becomes `[article, breadcrumbListJsonLd(blogPostBreadcrumbs(blog.title), SITE_URL), ...(visibleFaq ? [faqPage] : [])]`.
  - `resolvePageMeta` (async) grows a condition-hub branch BEFORE `resolveStaticPageMeta`: look up `getConditionHubs()` for `name`; build meta with `jsonLd = [hubPage, breadcrumbListJsonLd(conditionHubBreadcrumbs(name), SITE_URL), ...faq]` where `hubPage` is `{"@context","@type": ["MedicalWebPage","CollectionPage"], name: <visible H1>, description, url, dateModified?, author (editorial team → /editorial-policy), publisher, about: {"@type":"MedicalCondition", name}}`. For intro hubs the H1 is `intro.h1`; otherwise `Hydrogen Research for ${name}`. Keep `conditionHubJsonLd(intro, …)` as the builder for the intro case but change its `@type` to the array form and add `about`; its FAQPage stays.
  - `resolveStaticPageMeta`: body-system / explore-detail / mechanism / life-stage / explore index / `/studies` / `/blog` / policy / `/hydrogen-for/*` entries get `jsonLd: [collectionOrMedicalPage, breadcrumbListJsonLd(...)]` (`/hydrogen-for/*`: `["MedicalWebPage","CollectionPage"]` with `about: {"@type":"Thing", name: topic.name}` + existing FAQPage). Name fields must equal the renderer's visible `<h1>` text — reuse the same shared copy helpers (`exploreDetailCopy(slug).h1`, `exploreIndexCopy(type).h1`, `mechanismHubMeta`, `bodySystemHubName`, `Hydrogen for ${topic.name}`). Static about/contact/legal pages get NO BreadcrumbList (their Next bodies show no trail).
- Modify: `server/__tests__/condition-hub-intros.test.ts` — expected types become `[["MedicalWebPage","CollectionPage"], "BreadcrumbList", "FAQPage"]` (compare with `toEqual`).
- Test: `server/__tests__/breadcrumbs-schema.test.ts` (integration half): mount `page-data-routes` with the db mock pattern from `explore-hub-404.test.ts` (copy its `vi.mock("../db", …)` state machine) and for each of `/blog/<slug>`, `/explore-by-condition/type-2-diabetes`, `/explore-by-body-system/cardiovascular`, `/explore-by-mechanism/hydrogen-water`, `/explore-by-condition`, `/hydrogen-for/diabetes`, `/studies`, `/blog`, `/editorial-policy` assert: `BreadcrumbList.itemListElement.map(n => n.name)` equals the text of `<nav aria-label="Breadcrumb"> li` in `bodyHtml`; every CollectionPage/MedicalWebPage `name` equals the `<h1>` text.

- [ ] Steps: write the integration test → FAIL → implement renderer + meta → PASS → full suite → commit `feat(seo): BreadcrumbList on every page with a visible trail; MedicalWebPage on condition and hydrogen-for hubs (PLAN 3.5)`; PR; merge on green; after deploy `POST https://web-production-6fb716d.up.railway.app/web_revalidate` (header `x-page-data-key`, body `{}`) so Next drops cached page data; verify live JSON-LD on a hub, a blog post, `/explore-by-condition`, `/hydrogen-for/cancer-support` with the Rich Results test or `curl | grep ld+json`.

---

## C. Task 7 — `/learn` on Next

**Files:**
- Create: `shared/learn-faqs.ts` (move `LEARN_FAQS` here; `client/src/components/learn/learn-faqs.ts` becomes `export { LEARN_FAQS } from "@shared/learn-faqs";` — check how the client resolves `@shared` (vite alias exists)).
- Create: `client/src/pages/content/LearnContent.tsx` — `"use client"`; the 13 section components in order inside `<main className="learn-page">` (move the `learn-page` wrapper class so styles match). No Helmet, no header/footer.
- Modify: `client/src/pages/LearnPage.tsx` — keep Helmet + `JsonLd` + `SiteHeader`/`Footer`; body = `<LearnContent />`.
- Modify: `web/components/ClientProviders.tsx` — accept `dehydratedState?: unknown`; wrap children in `<HydrationBoundary state={dehydratedState}>` (from `@tanstack/react-query`).
- Create: `web/app/learn/page.tsx`:

```tsx
import { QueryClient, dehydrate } from "@tanstack/react-query";
import { LearnContent } from "@/pages/content/LearnContent";
import { LEARN_FAQS } from "@shared/learn-faqs";
import { faqPageJsonLd } from "@shared/seo-markup";
import { contentPage } from "@web/lib/content-page";
import { expressJson } from "@web/lib/page-data";
import { ClientProviders } from "@web/components/ClientProviders";

// The FAQ is visible (FaqSection renders LEARN_FAQS), so FAQPage is allowed.
const page = contentPage("/learn", [faqPageJsonLd(LEARN_FAQS)]);
export const dynamic = "force-dynamic";
export const generateMetadata = page.generateMetadata;

export default async function Page() {
  const qc = new QueryClient();
  try {
    const stats = await expressJson<unknown>("/api/learn-stats", 600, ["/learn"]);
    qc.setQueryData(["/api/learn-stats"], stats);
  } catch {
    // sections render their fallbacks and fetch on the client
  }
  return (
    <page.Shell className="learn-page">
      <ClientProviders dehydratedState={dehydrate(qc)}>
        <LearnContent />
      </ClientProviders>
    </page.Shell>
  );
}
```
- Modify: `server/services/page-meta.ts` static table — add `"/learn": { title: "Learn About Molecular Hydrogen | Hydrogen Studies", description: <LearnPage's meta description> }` (robots stays `noindex, follow` via `noindexFor` — PLAN 0.6 decision; flag to Josh). Do NOT also add FAQPage in Express meta for `/learn` (the Next page adds it; the SPA page already emits it) — one source each, no duplicate blocks.
- `web/lib/content-page.tsx` `pageTypeFor` → `"learn"` UTM value falls out of `path.slice(1)` ("learn"); fine.

- [ ] **Verify locally:** `npm run build:web && EXPRESS_ORIGIN=http://localhost:5000 PAGE_DATA_KEY=… node web/.next/standalone/web/server.js` with Express running; `curl -s localhost:3000/learn | wc -w` ≫ 273 and contains an `<h1`; no hydration warnings in the browser console (chrome-devtools MCP on localhost:3000/learn).
- [ ] Commit `feat(ssr): /learn renders on the Next front door`.

## C. Task 8 — `/learn/basics`, `/learn/health-benefits`, `/learn/therapy-guide`

Same shape as Task 7 for each: extract `<...Content />` (everything between `SiteHeader` and `Footer`; keep `Helmet`/`JsonLd` in the SPA page), Next page = `contentPage(path)` + `WouterBridge` (they use wouter `Link`) + `ClientProviders` only if the content uses react-query (check imports; the three listed use `react`, `wouter`, ui components only). Any `JsonLd` the SPA page emits that describes visible content (e.g. a FAQPage whose questions are on the page) goes into `contentPage(path, [thatBlock])`; anything not visible is dropped (CLAUDE.md). Note `HydrogenTherapyGuide.tsx` had a fake `Course` schema removed in #130 — confirm nothing like it remains.

- [ ] Build + curl each → real body; commit `feat(ssr): /learn/* guides render on Next`.

## C. Task 9 — `/research-analytics`

- Create `client/src/pages/content/ResearchAnalyticsContent.tsx` (`"use client"`; the page body with its `useQuery` calls; no Helmet/header/footer). SPA `ResearchAnalyticsPage.tsx` wraps it.
- Create `web/app/research-analytics/page.tsx`: `contentPage("/research-analytics")`; prefetch into a `QueryClient` each of `/api/studies/analytics`, `/api/studies/timeline`, `/api/studies/trends`, `/api/studies/health-outcomes`, `/api/studies/citation-network` (keys exactly as the components use them — `["/api/studies/analytics"]` etc.), `dehydrate`, render inside `ClientProviders`. Charts that need a DOM width render client-side only; the numbers and headings must be in the server HTML (`curl | grep` a stat value).
- [ ] Commit `feat(ssr): /research-analytics renders on Next with server-fetched data`.

## C. Task 10 — Switch the families on

- Modify `server/middleware/web-frontdoor.ts` `SSR_FAMILIES`: add `learn: /^\/learn(?:\/[^/]+)?$/`, `analytics: /^\/research-analytics$/`.
- Open PR "feat(ssr): /learn/*, /research-analytics on the Next front door"; merge on green; wait for BOTH Railway services to deploy (`web` watches `client/src/**`, `shared/**`, `web/**`).
- Set Railway var on the Express service: `SSR_FAMILIES=study,blog,hubs,policy,pages,studies,home,learn,analytics` (`railway variables --set` or the MCP `set-variables`); the service restarts.
- Verify prod: for `/learn`, `/learn/basics`, `/learn/health-benefits`, `/learn/therapy-guide`, `/research-analytics`: `curl -s -A Googlebot URL | wc -w` equals plain `curl` word count and is ≫ 300; `<title>` matches; `robots` tags unchanged (`/learn*` still noindex; `/research-analytics` index). Mobile Lighthouse on `/learn` via chrome-devtools MCP: LCP < 2.5 s, CLS ≈ 0.
- Rollback: remove the two keys from `SSR_FAMILIES`.
- [ ] Update memory (`project_structural_seo_2026-10-30.md`) with the new families and what is still on the SPA (`/search`, `/advanced-search`, `/improved-search`, `/products`, `/recommendations`, `/blog/category/*`, `/studies/tags/*`, account pages — all noindex).

---

## D. Task 11 — Stable study slug helpers (`shared/study-slug.ts`)

Scheme (PLAN 3.3 "PMID or DOI-derived slug; keep the title portion"): `titlePortion(slug)` strips a trailing `-<13 digits>` batch epoch (every one of the 2,276 live slugs has one; 92 distinct epochs = import batches, not IDs). New slug:
- PMID present → `${title}-pmid-${pmid}` (1,976 studies)
- else DOI present → `${title}-doi-${doiSlug}` where `doiSlug = normalizeDoi(doi).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")` (228)
- else → `${title}-hs-${id}` (72)

```ts
export function titlePortion(slug: string): string { return slug.replace(/-\d{13}$/, ""); }
export function stableStudySlug(s: { id: number; slug: string; pmid?: string | null; doi?: string | null }): { slug: string; kind: "pmid" | "doi" | "id" }
export function parseStableSuffix(slug: string): { kind: "pmid"; pmid: string } | { kind: "doi"; doiSlug: string } | { kind: "id"; id: number } | null
```
`parseStableSuffix` matches `/-pmid-(\d{4,9})$/`, `/-doi-([a-z0-9-]+)$/`, `/-hs-(\d+)$/`. Tests in `server/__tests__/stable-study-slug.test.ts`: the three kinds, title portion kept verbatim, epoch stripped, a legacy slug (no suffix) parses to `null`, DOI slug for `10.3760/cma.j.issn.0412-4081.2018.08.010`.

## D. Task 12 — Resolver fallbacks + canonical redirect

- `server/services/study-service.ts` `getStudyBySlug`: after the exact match misses, `parseStableSuffix(normalizedSlug)`; `pmid` → `WHERE pmid = $1`; `id` → `WHERE id = $1`; `doi` → `WHERE slug LIKE '%-doi-' || $1` (post-apply) — return the row (its `slug` is canonical).
- `server/routes/page-data-routes.ts` `/study/:slug`: unchanged (returns `study.slug`).
- `web/app/study/[slug]/page.tsx`: in `load`, after fetching, `if (decodeURIComponent(slug) !== data.study.slug) permanentRedirect(`/study/${data.study.slug}`)` (import from `next/navigation`). Also in `generateMetadata` path (it calls `load`) — a redirect thrown there is fine in Next 14.
- Unit test for the fallback order with the mocked-db convention (`page-data-routes.test.ts` style: mock `studyService`).
- Commit `feat(study): resolve stable PMID/DOI/id study slugs; redirect drifted title portions to the canonical slug`.

## D. Task 13 — Plan/apply script + report (report only)

`scripts/consolidation/stable-study-urls.ts` (run via `railway run -- sh -c 'DATABASE_URL="$DATABASE_PUBLIC_URL" npx tsx scripts/consolidation/stable-study-urls.ts --plan'`):
- `--plan`: SELECT live studies (`is_excluded = false`) → compute new slug → write `reports/consolidation/stable-study-urls-<YYYY-MM-DD>.csv` (`id,kind,old_slug,new_slug,pmid,doi,title`) and `.md` (counts by kind; collision check — refuse if any `new_slug` duplicates; count of existing `redirects.to_path` rows that point at an old slug (will be re-pointed); count of blog bodies containing `/study/<old_slug>` links (covered by 301s; listed for info); 10 sample rows).
- `--apply`: refuses unless the CSV's first line is `approved-by: josh`. In one transaction per 200 rows: `UPDATE studies SET slug = new WHERE id = ? AND slug = old` (skip if the row changed since the plan), `INSERT INTO redirects (from_path,to_path,status_code,note)` for `/study/<old>` and `/studies/<old>` → `/study/<new>` (301, note `stable-study-urls <date>`), `UPDATE redirects SET to_path = '/study/<new>' WHERE to_path = '/study/<old>'` (no chains). Backup JSON `reports/backups/stable-study-urls-<ts>.json` with `{id, old_slug}` BEFORE writing. After: call `notifyWebRevalidate()` (all), `__resetSitemapCacheForTests`-equivalent (`seo-routes` sitemap cache) — check the export name — and log counts. Rollback = swap columns from the backup.
- Run `--plan` for real; commit the CSV + MD under `reports/consolidation/`; PR "report(study): stable PMID/DOI study URLs — resolver + 2,276-row 301 plan (apply awaits approval)". Do NOT run `--apply`.

---

## Self-review

- Spec coverage: 3.3 → D; 3.4 → A; 3.5 → B; 3.2 remaining routes → C; 3.6 dropped; 3.7 verified in C.10. `/blog/category/*`, `/studies/tags/*`, search, products, recommendations stay on the SPA (noindex, not in sitemaps) — out of Phase 3 scope, listed for Josh.
- Names used consistently: `page-meta.ts` exports `PageMeta, resolvePageMeta, buildStudyMeta, buildBlogMeta, resolveStaticPageMeta, isContentPath`; `web-revalidate.ts` exports `notifyWebRevalidate`; `user-agent.ts` exports `isBot`; `shared/breadcrumbs.ts` exports the builders listed in Task 5; `shared/study-slug.ts` exports `titlePortion, stableStudySlug, parseStableSuffix`.
- Josh-only items surfaced at the end: approve the 3.3 CSV; decide whether `/learn*` drops `noindex`; `/insights` → server-side 301 to `/research-analytics` (currently a client-side redirect that returns 200 + index).
