# Content Pipeline Deep Audit — 2026-08-30

Trigger: "create and enhance content doesn't work or do anything — it's dumb when it should
be smart." Investigated via Railway logs, Sentry, live API checks (CrossRef/Semantic Scholar
verified with real requests), git history, and 3 parallel code-tracing passes (creation flow,
enrichment flow, AI-model quality across all 62 call sites).

**Headline evidence:** newest published article was **Aug 12** (18 days of zero output);
**zero `Anthropic usage` log lines** in the current deployment (the wrapper logs every
successful call — no AI work was happening at all).

## Why content creation "did nothing" — root-cause chain

1. **New-study ingestion dead since ~Aug 10** — keyword-monitor `ON CONFLICT` bug (fixed in
   the first audit commit `e8b5eea`). No new studies → nothing downstream.
2. **Autonomous blog generation OFF** — Job 7 is gated on `ENABLE_BLOG_BACKFILL=1`, never set
   in Railway. Added in `95ea135` (Aug 10) "pending the demand-ranked generation rework" —
   but that rework shipped in the same commit. **Decision needed — see "Your decisions" below.**
3. **Every manual Generate/Enrich button died at a double 30s timeout** — client `apiRequest`
   aborted at 30s AND the server 504'd at 30s, while the un-cancelled handler kept working and
   saved results minutes later, invisibly. Admin always saw "Failed". **FIXED**: both sides now
   allow 10 min for the AI-generation path allowlist (`error-handler.ts` + `queryClient.ts`,
   kept in sync).
4. **Every deploy paused running bulk jobs forever** — boot recovery flips running→paused and
   only a manual /admin/jobs visit could resume. **FIXED**: scheduler fast-loop job auto-resumes
   restart-interrupted jobs (≤3 attempts, counter persisted in lastError) and drains pending
   jobs when the worker is idle (`blog-lifecycle.ts`, `job-scheduler.ts`).
5. **Approved pipeline studies never entered the content queue** — pipeline creation bypasses
   `studyService.createStudy`, and the fire-and-forget waterfall skips un-enriched studies.
   **FIXED**: approval now calls `enqueueStudy()` (durable, retried path).
6. **`pipeline-processing` overflowed its 3-min budget every cycle** (10 items × 6 AI calls; the
   16 Sentry timeouts) — orphan kept the advisory lock, later ticks no-op'd. **FIXED**:
   3 items/cycle + 6-min budget.

## Why "enhance" did nothing (all three external APIs were broken)

7. **CrossRef envelope never unwrapped** — enrichment read `crossRefData.abstract` etc. off the
   `{status, message:{...}}` envelope → always `undefined` → CrossRef contributed ZERO data,
   everywhere. **FIXED at 4 call sites**: content-enrichment, doi-enhancer, journal-date-updater,
   crossref-routes date endpoint.
8. **Semantic Scholar 400'd on every call** — requested fields `sections,figures,equations` the
   API rejects (verified live). **FIXED**: fields removed.
9. **Admin "Single Study" button POSTed to a route that didn't exist** (always 404).
   **FIXED**: `POST /api/enrichment/batch/enrichStudy/:id` added (new `enrichStudyById`).
10. **Progress UI hardwired to zeros; Stop was a no-op** — `/batch/status` returned
    `totalToProcess: 0`; `/batch/start` awaited the whole run then said "started, processed: 0";
    `/batch/stop` replied "stopped" without stopping. **FIXED**: background start (202) +
    real stats (`totalToProcess`) + cooperative stop flag + honest 409 when already running.
11. Still open (feature work, not fixed): EuropePMC **full text is never fetched** (needs the
    separate `/fullTextXML` endpoint for `inEPMC` articles), and the enrichment candidate query
    selects on fields (methods/results/conclusion/image) the service can rarely fill — the
    candidate list never visibly shrinks. Documented for a follow-up.

## Why output was "dumb" — quality fixes

12. **Canned boilerplate persisted as if AI-generated** — **FIXED**:
    - multi-format (podcast/infographic/social/video/newsletter): all 5 catch→canned-template
      blocks now rethrow; `fallbackToBasic` default flipped to false; all-failed → 502, partial
      failure named in the response message.
    - blog-recommendation articles: removed `|| "This is a ${articleType} article about…"`
      fallback and the catch→canned block; failures propagate honestly.
    - chat: fallback study-list is now *labeled* as a degraded mode instead of being passed
      off as the assistant's answer (both chat routes).
13. **Bulk paths ran on Haiku while interactive paths used Sonnet** (same user-facing fields) —
    **FIXED**: TL;DR generator default → Sonnet+effort:low (bulk backfill paths inherit);
    study-summary enrichment + content-worker summaries → Sonnet+effort:low;
    blog-recommendation articles → Sonnet (wrapper default).
14. **Token caps below the prompts' own specs** (truncated mid-sentence, or silent self-
    compression) — **FIXED**: blog worker 2048→4096 (+AI race timeout 30s→150s — at 30s every
    article generation raced its own timeout); blog-recommendation 2048→4096 (45s→150s);
    pillar pages 8000/10000→12000 with a new 300s provider timeout tier for >6000-token calls;
    OpenAI fallback timeout now scales with size too (was a flat 30s that killed exactly the
    long-form calls most likely to need the fallback).
15. **Empty articles published** — `content: data.content || ""` with `isPublished: true`.
    **FIXED**: <500-char bodies now abort generation (pillar + cluster in both factories) plus a
    choke-point guard in `saveGeneratedArticle`.
16. **`generateJSON` was one-shot** — a parse failure silently dropped the whole generation via
    callers' catch→null. **FIXED**: one regeneration retry with an explicit JSON reminder.
17. **"Success" lies fixed**: zero-article generation now returns 502 with the first real error
    (the UI's existing error toast shows it); `undefined` no longer interpolated into the SEO
    evidence prompt; transient AI errors no longer permanently mark studies as
    `__no_content__` (only study-specific invalid-JSON does).
18. **Log flooding fixed** — CrossRef/PubMed/SemanticScholar catch blocks dumped entire axios
    error objects (thousands of Railway lines per routine DOI 404; actively flooding during the
    Sunday freshness run). Now one concise line via shared `describeHttpError` (`utils/http.ts`).

## Your decisions (not auto-changed)

- **`ENABLE_BLOG_BACKFILL=1`** — re-enables autonomous blog generation (up to 50 articles per
  10-min cycle at full backlog!). Given the SEO review found 8,777 dup-heavy articles ≈ 22
  clicks/60d, consider enabling only after the consolidation plan, or lowering
  `MAX_BLOGS_PER_CYCLE` first. One Railway env var away.
- **Reconnect GA4/GSC OAuth** (also from audit 1) — until then the generator's demand-ranking
  signal is all zeros and falls back to ID order.

## Deferred (feature/refactor work, documented not shipped)

- EuropePMC fullTextXML fetch + candidate-query alignment (finding 11).
- Persist SEO-factory + image-generation job state (currently in-memory Maps — a restart
  erases progress and the UI reads vanish-as-success).
- `retryCount` not incremented on stale-recovery resets (pipeline items can churn without ever
  reaching `failed`).
- H2-field enrichment has no route/scheduler (script-only); summary enrichment has no admin UI.
- An "awaiting approval" badge — pipeline output parks at `awaiting_approval` invisibly.
- `uq_cgq_active_study` unique index + other migrations (boot-fatal migration policy; listed in
  DEEP_AUDIT_2026-08-30.md).

## Verification

`tsc` clean · 289/289 tests pass · production build succeeds. 28 files changed.
The enrichment fixes (CrossRef envelope, S2 fields) were verified against the live APIs'
actual response shapes; the rest by tracing + types + tests.
