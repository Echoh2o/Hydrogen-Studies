# Deep Audit — 2026-08-30

Triggered by: "various errors across the site", "Sarah cannot login". Investigated
via Sentry (`echo-water`), Railway (`Hydrogen-Studies`), live browser + Postgres/deploy
logs, and a code audit (3 parallel review passes: raw-SQL/DB, security/authz, reliability).

**Baseline:** the site is **not** down — 2 of 53,225 requests were 5xx over 24h. The
reported problems are specific defects, not an outage.

Branch: `fix/deep-audit-2026-08-30`. All fixes below are verified (`tsc` clean, 289 tests
pass, production build succeeds). Nothing was deployed.

---

## Fixed in this branch

### 1. Login returns HTTP 500 for accounts with no/blank/corrupt password hash  — **Sarah's bug**
`server/routes/auth-routes.ts` — `bcrypt.compare(pw, user.passwordHash || "")` was
unguarded. `bcrypt.compare` **rejects** on a null/empty/malformed hash (e.g. an account
provisioned via import or Shopify sync that never had a password set), so a normal failed
login threw → mapped to 500 (the client shows "Something went wrong on our end"). The user
lookup path (non-existent user) returned a clean 401, which is why only some accounts hit it.
- **Fix:** new `verifyPassword()` fails closed — any missing/invalid hash or compare error
  returns `false` (invalid credentials), never throws. Added a dummy compare on the
  not-found / no-hash paths to equalize timing (closes a login user-enumeration side channel).
- **Regression test:** `server/__tests__/login-password-verify.test.ts`.
- **Sarah's resolution:** see "Sarah's account" below.

### 2. `explore-by-condition` fallback query crashes — `LOWER(text[])`
`server/routes/consumer-categories-routes.ts:584` — ran `LOWER(health_conditions)` on a
`text[]` array column → Postgres `function lower(text[]) does not exist`, firing repeatedly.
- **Fix:** match when ANY array element equals the condition case-insensitively via
  `EXISTS (SELECT 1 FROM unnest(health_conditions) hc WHERE LOWER(hc)=LOWER($1))`.

### 3. Keyword monitor: every insert throws (`ON CONFLICT` can't match the partial index)
`server/services/keyword-monitor-service.ts:386` — `.onConflictDoNothing({ target: doi })`
against the **partial** unique index `monitor_results_doi_unique … WHERE doi IS NOT NULL`.
Postgres won't infer a partial index unless the statement repeats its predicate, so every
insert threw 42P10 (`DrizzleQueryError` seen repeatedly in deploy logs). No new studies were
being ingested.
- **Fix:** add `where: sql\`doi IS NOT NULL\`` to the conflict target so the partial index is
  inferred. No migration needed (index already exists from migration 018).

### 4. Client-side Sentry was blind (CSP blocked its own ingest host)
`server/app.ts` helmet CSP — `connect-src` omitted the Sentry ingest host, so the browser SDK
could not POST a single event (the `hydrogen-studies-client` project has 0 issues). The
Cloudflare Web Analytics beacon was blocked too (`script-src`).
- **Fix:** added `https://*.ingest.us.sentry.io` / `https://*.ingest.sentry.io` to
  `connect-src`, and `https://static.cloudflareinsights.com` / `https://cloudflareinsights.com`
  for the CF beacon.

### 5. CORS denials threw `Error` → 500 + Sentry spam (497 events)
`server/config/cors-config.ts:130` — a disallowed Origin called back with `new Error(...)`,
which the global error handler turned into a 500 and reported to Sentry for every bot/scanner
sending a foreign `Origin`.
- **Fix:** `callback(null, false)` — a clean CORS denial (no headers, browser still blocks),
  no throw, no Sentry event.

### 6. `GET /api/stats` 404 on every page load
`client/src/lib/csrf.ts:64` — the CSRF-token primer fetched `/api/stats`, which has no route.
- **Fix:** primer now hits `/api/auth/check-session` (a real `/api/*` GET that carries the
  `X-CSRF-Token` header).

### 7. Password-reset tokens stored in plaintext  — **security (HIGH)**
`server/routes/auth-routes.ts` — the raw reset token was persisted and matched by equality.
Any DB read (backup, replica, future SQLi, logs) yielded directly usable, un-expired tokens →
account takeover, including admins.
- **Fix:** store only `sha256(token)`; the raw token lives solely in the emailed link and is
  hashed on lookup. Test updated (`password-reset.test.ts`).
- **Note:** any reset links already outstanding (≤1h TTL) become invalid on deploy — expected.

### 8. `GET /api/trends/report` — unauthenticated AI generation + DB writes
`server/routes/trends-routes.ts:195` — on cache miss, anonymous callers triggered an expensive
AI pipeline and row inserts (its mutating twin `POST /api/trends/analyze` is admin-only).
- **Fix:** cached reports stay public; **generation** on a miss now requires an
  elevated (admin/editor) session — anonymous callers get a clean cache-miss response.

### 9. apex vs www — no canonical redirect + host-only session cookie
Both `hydrogenstudies.com` and `www.hydrogenstudies.com` served 200 with no canonicalization
(SEO duplicate content), and the session/CSRF cookie is host-only (no `COOKIE_DOMAIN`), so a
login on one host isn't sent to the other → "logged in then bounced".
- **Fix:** `server/app.ts` now 301s `www.hydrogenstudies.com` → apex, scoped to exactly that
  host (Railway domain, Shopify proxy host, and health probes untouched), preserving path+query.
- **Also recommended (ops):** set `COOKIE_DOMAIN=.hydrogenstudies.com` (see below).

### 10. Sentry noise filter for known-operational errors
`server/utils/sentry.ts` — `beforeSend` now drops `invalid_grant` (see below) and
`Not allowed by CORS` events. These are expected states surfaced elsewhere (health probe /
admin UI), not bugs; they were burning quota and burying real errors (852 + 497 events).

---

## Sarah's account — root cause & resolution

Her symptom ("Something went wrong on our end") is the **HTTP 500** from bug #1 — so her
stored `password_hash` is null/blank/corrupt (most likely her account was created without a
password, e.g. a Shopify/customer import). Fix #1 stops the 500; to actually let her in:

1. **Verify** (read-only):
   ```sql
   SELECT id, username, email, role, is_active,
          (password_hash IS NULL OR password_hash = '') AS no_password, last_login
   FROM users
   WHERE email ILIKE '%sarah%' OR username ILIKE '%sarah%';
   ```
2. If `is_active = false` → reactivate: `UPDATE users SET is_active = true WHERE id = '<id>';`
3. If `no_password = true` (expected) → after deploying fix #1, have Sarah use **Forgot
   password** to set one (needs `SENDGRID_API_KEY` + `APP_URL`, both set). The reset flow is
   confirmed working and now stores hashed tokens (#7).

---

## Ops actions required (not code)

- **Reconnect GA4 + GSC OAuth** in the admin UI — the refresh tokens are revoked/expired
  (`invalid_grant`), which is why analytics sync is dead and threw 852 Sentry events. #10 stops
  the noise, but only a reconnect restores the data + stops the useless retry each cycle.
- **Set `COOKIE_DOMAIN=.hydrogenstudies.com`** (Railway env) so the session/CSRF cookie is
  shared across apex/www during the redirect rollout (belt-and-suspenders for #9).

---

## Recommended follow-ups (need a schema migration — validate against a DB first)

Migrations are **boot-fatal** here (`app.ts` `process.exit(1)` on failure), so these were NOT
auto-shipped. Each needs a dedupe-then-`CREATE UNIQUE INDEX IF NOT EXISTS` migration following
the pattern in `server/migrations/add-audit-tracking-fields.ts`, plus the matching conflict target.

- **Content-gen double-enqueue** — `server/services/content-generation-worker.ts:157` relies on
  a partial unique index `uq_cgq_active_study` that was never created (migration only made
  non-unique indexes). Two enqueues racing past the pre-SELECT both insert → the same study is
  enriched twice (double AI spend). Fix: `CREATE UNIQUE INDEX uq_cgq_active_study ON
  content_generation_queue (study_id) WHERE status IN ('pending','processing')` + pass as target.
- **`keyword_group_mappings`** — `.onConflictDoNothing()` with no matching unique on
  `(keyword_id, group_id)` → duplicate mapping rows. Add the unique + target.
- **`user_preferences.user_id`** — no unique constraint; `recommendation-engine.ts:817`
  upsert and `user-dashboard-routes.ts:167` select-then-write are both race-prone (currently
  latent — the upsert path has no caller). Add a unique on `user_id`.

## Reliability (investigate)

- **`pipeline-processing` job times out at 180s** (Sentry `SERVER-9`, 16×). Add per-item
  timeouts / chunking, or raise the job budget. Low frequency; not user-facing.

## Lower-priority best-practice (not fixed — product/UX decisions)

- Weak password policy (min length 6) in register/change/reset — consider ≥12.
- `POST /api/studies/:id/view` and `/api/analytics/track-*` are unauthenticated write sinks
  (mitigated: capped, rate-limited). Fine as public sinks; noted.
- Add `router.use(requireAdmin)` inside `doi-enhancer` and `image-generation` routers for
  defense-in-depth (currently protected only by the mount-level guard).
- `/api/auth/logout` is CSRF-exempt (low-impact logout-CSRF).

---

## Checked and found clean

Every `/api/admin/*` router is admin-guarded and the `/api/admin` catch-all ordering is safe;
Shopify webhooks + App Proxy are HMAC-verified fail-closed; no secrets are returned or logged;
raw SQL is parameterized (no injection); session regeneration is performed on login/register
(no fixation); other `ON CONFLICT` targets all have matching constraints; other array columns
use `unnest`/`= ANY`/`array_to_string` correctly.
