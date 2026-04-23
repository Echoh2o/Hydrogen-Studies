# Content Strategy Plan: GSC Integration + Anchor Pages

**Goal:** Turn the Content tab from a "publish things and hope" workflow into a data-driven topical-authority machine. Use Google Search Console to identify which pages have latent demand, then lean into those with deep, multi-format anchor content surrounded by supporting cluster posts.

**Owner:** Josh.
**Status:** Phase A — pending Google Cloud setup (you), then implementation (me).

---

## Sequence

| Phase | What | Who | Effort | When |
|-------|------|-----|--------|------|
| **A** | GSC integration + opportunities dashboard | Setup: you. Code: me. | ~2-3 days code + ~30 min setup | First |
| **A.5** | Run for 1–2 weeks, observe what GSC actually says | You | passive | Before B |
| **B** | Anchor / cluster workflow (promote-to-anchor, cluster generation, pillar editor) | Me | ~1 week | After A.5 |
| **C** | Visual depth (Chart.js diagrams from study data, hero images, video embeds) | Me | ~3-4 days | Lower urgency |

The single most important thing in this whole plan: **don't build B until A has been running long enough to surprise you.** GSC reality almost never matches strategy hunches.

---

## What you need to set up in Google Cloud (~30 min)

Do these steps once. They're a prerequisite for everything in Phase A. **You have to do this part — I can't create OAuth credentials for you.**

### 1. Create or pick a Google Cloud project

1. Go to https://console.cloud.google.com/
2. In the project picker (top-left), either pick an existing project or click **New Project**.
   - If new: name it something like `hydrogen-studies-gsc`. Org/billing settings can be left at defaults; the GSC API is free.
3. Make sure that project is selected (top-left dropdown should show its name).

### 2. Enable the Search Console API

1. Left nav → **APIs & Services** → **Library**.
2. Search for **Search Console API**. Click it.
3. Click **Enable**.

### 3. Configure the OAuth consent screen

1. Left nav → **APIs & Services** → **OAuth consent screen**.
2. User type: **External**. (Even though only you'll use it, "Internal" requires a Google Workspace org. External + keeping the app in "Testing" mode is fine for a single user.)
3. Fill in the required fields:
   - **App name:** `Hydrogen Studies GSC`
   - **User support email:** your email
   - **Developer contact email:** your email
   - You can leave logo, app domain, etc. blank.
4. **Scopes** step → Click **Add or Remove Scopes** → search for `webmasters.readonly` → check `https://www.googleapis.com/auth/webmasters.readonly` → Update.
5. **Test users** step → Add the Google account that owns Search Console access for hydrogenstudies.com.
6. Save. App will be in "Testing" mode — that's fine.

### 4. Create OAuth 2.0 Client credentials

1. Left nav → **APIs & Services** → **Credentials**.
2. Click **+ Create Credentials** → **OAuth client ID**.
3. **Application type:** Web application.
4. **Name:** `Hydrogen Studies GSC Server`.
5. **Authorized redirect URIs** — add both:
   - `https://hydrogenstudies.com/api/admin/gsc/oauth/callback`
   - `http://localhost:5000/api/admin/gsc/oauth/callback` (replace 5000 with your dev port if different)
6. Click **Create**.
7. A modal will show **Client ID** and **Client Secret**. Copy both — you'll paste them into Railway env vars next.

### 5. Verify domain ownership in Search Console

You almost certainly already have this since you have GSC data, but to confirm:

1. Go to https://search.google.com/search-console
2. The property `hydrogenstudies.com` should be listed.
3. The Google account associated with the property must be the same account you added as a test user in step 3.5.

If the domain isn't verified or is verified to a different Google account, you'll need to verify it (usually a DNS TXT record). Skip if it's already there.

### 6. Set environment variables in Railway

In the Railway dashboard for the production service, add three env vars:

```
GSC_CLIENT_ID=<the Client ID from step 4>
GSC_CLIENT_SECRET=<the Client Secret from step 4>
GSC_SITE_URL=sc-domain:hydrogenstudies.com
```

Notes:
- `GSC_SITE_URL` uses GSC's domain-property format. If your property is verified as a URL prefix (e.g., `https://hydrogenstudies.com/`) instead of a domain property, use that exact string instead.
- For local dev, also add these to your `.env` (gitignored).
- The OAuth refresh token gets stored in the database (encrypted) once you authorize, not in env. So no `GSC_REFRESH_TOKEN` needed up front.

### 7. Tell me when done

Reply with "GCP setup done." I'll start Phase A. The first thing I'll build is a connect button in the admin UI that triggers the OAuth dance — you click it once, authorize with the same Google account that has GSC access, and the refresh token gets stored. After that, the nightly cron can pull data forever.

---

## Phase A: GSC Integration (what I'll build)

### Backend

1. **Schema**
   - `gsc_credentials` table: encrypted refresh token, account email, granted scopes, last refresh timestamp.
   - `gsc_query_metrics` table: one row per (date, page, query). Columns: date, page (URL), query, impressions, clicks, ctr, position. Indexed on (page, date) and (query, date).
   - `gsc_sync_runs` table: one row per cron pull. Columns: started_at, completed_at, days_pulled, rows_inserted, error.

2. **OAuth flow**
   - `GET /api/admin/gsc/oauth/start` → redirects to Google consent.
   - `GET /api/admin/gsc/oauth/callback` → exchanges code for refresh token, stores encrypted, redirects back to admin UI.
   - `POST /api/admin/gsc/disconnect` → revokes + deletes the stored credential.

3. **Sync service**
   - Uses the official `googleapis` npm package (only new dep).
   - Pulls data using `searchanalytics.query` with dimensions `[page, query, date]`, dataState `final`.
   - Default lookback: last 90 days on first sync, then daily incremental for the past 3 days (data settles for ~2 days).
   - Stores rows with upsert on (date, page, query).

4. **Cron job (Job 17)**
   - Runs every 6 hours. Pulls the last 3 days of data. Cheap; respects the GSC quota generously.
   - Surfaces last-run timestamp in the existing System Health monitoring card.

5. **Opportunities query endpoints**
   - `GET /api/admin/gsc/opportunities/climbers` — queries at position 11-30 with ≥100 impressions/30d. The "almost there" goldmine.
   - `GET /api/admin/gsc/opportunities/low-ctr` — pages with CTR <2% and ≥500 impressions/30d. Title/meta-description fixes.
   - `GET /api/admin/gsc/opportunities/orphan-queries` — queries we rank for that don't have a dedicated blog/study page in our DB.
   - `GET /api/admin/gsc/page/:slug` — per-page metrics: impressions, clicks, position over time + top queries.

### Admin UI

1. **New page: `/admin/seo/search-console`**
   - Connect/disconnect button (status indicator).
   - Last sync timestamp.
   - Three opportunity sections: Climbers / Low-CTR / Orphan Queries — each a sortable table with one-click actions ("Open in editor," "Generate blog from this query," "View existing page").
   - Sparkline trends per opportunity row.

2. **Cross-wired into existing tools**
   - Blog list page: new column "GSC traffic 30d" (clicks number).
   - Blog edit page: side panel "GSC performance" — impressions, clicks, position, top 5 queries this page ranks for.
   - Generate page: when a study is selected, show "GSC opportunity score" as part of the existing decision-grade signal strip.
   - Blog recommendations: composite rank score gets a new GSC-derived component (proven demand > theoretical content gap).
   - System Health card: GSC sync status (connected? last pull? rows fresh?).

### Done when

- The Connect button works and stores a refresh token that survives restart.
- The nightly cron pulls successfully — visible in System Health.
- The Opportunities dashboard shows real data with non-empty rows.
- The blog list shows GSC traffic numbers.

### Decision checkpoint after Phase A

After 1–2 weeks of GSC data accumulating, we look at:
- Which opportunities are real (high-impression queries you don't have an anchor for)?
- Are there obvious patterns (e.g., "all the orphan queries cluster around 5 health conditions")?
- Are there pages that are clearly underperforming (high impressions / low clicks) where a title rewrite would print traffic?

That observation is what informs Phase B's priorities.

---

## Phase B: Anchor / Cluster Workflow (sketch — finalize after Phase A.5)

This is "topical authority": pillar pages with cluster support. Ranks slowly but compounds aggressively.

### Concept
- **Pillar page** = the killer anchor. Long-form, comprehensive, with FAQ/HowTo schema, multiple images, comparison tables.
- **Cluster pages** = 3-7 supporting blog posts on related sub-topics, all linking back to the pillar with descriptive anchor text.
- **Internal links** auto-generated by the existing `internal-linking-engine.ts` (currently dormant).

### What gets built

1. **Schema check**: the `seoContentClusters` table is already in the schema (someone started this earlier). Audit what's there, decide whether to use it or replace it.

2. **"Promote to anchor" action** on a blog post:
   - Triggered manually from the blog list / edit page (informed by GSC opportunity score).
   - Auto-generates 3-5 cluster post drafts on related sub-topics (using the existing recommendation engine + GSC orphan queries).
   - Builds internal-link bundle: cluster→pillar links + pillar→cluster contextual links.
   - Marks the original as `isPillar = true` so the editor surfaces depth tools.

3. **Pillar editor** (extends BlogEditPage):
   - Long-form section editor (multiple H2 sections, drag to reorder).
   - FAQ schema generator (auto-extracts Q&A from the article + lets you edit).
   - Comparison-table builder (e.g., "Hydrogen Water vs. CoQ10 for X").
   - Structured-data preview (live JSON-LD output).
   - "Cluster cohort" panel showing all linked cluster posts + their GSC performance.

4. **Pillar dashboard** (new page `/admin/seo/pillars`):
   - List of pillar pages with: GSC impressions, clicks, position, # of cluster posts, link health.
   - 30/60/90-day rank lift since pillar promotion.

### Effort: ~1 week

---

## Phase C: Visual Depth (sketch — lower urgency)

Defer until Phase B has proven that we want to invest editorial time in pillar pages.

### What gets built

1. **Chart.js diagrams from study data**
   - Pull from `studies.results`, `studies.sampleSize`, `studies.h2Concentration`, etc.
   - Auto-generate: outcome bar charts, dosage timeline, study-design Sankey, condition-prevalence comparisons.
   - Embedded as SVG in blog content. Real numbers, branded styling, no AI hallucination.

2. **Hero image regeneration with style consistency**
   - One brand style guide JSON, used for every blog hero.
   - Re-roll button on the editor.
   - Multi-image generator already exists — extend it.

3. **`youtubeEmbedId` field on blog posts**
   - Manual curation (you drop in a YouTube video ID), renders as oEmbed.
   - Cheap, immediate, doesn't pretend to be AI-generated.

4. **What we explicitly DON'T build**
   - Text-to-video AI generation. Quality is bad, cost is high, latency is minutes per video.
   - Text-to-infographic AI generation. Models hallucinate stats and produce ugly typography. Chart.js with real data is strictly better.

### Effort: ~3-4 days

---

## Success metrics

We'll know this is working if, 90 days post-Phase B launch:

- **At least 3 pillar pages** moved from page 2-3 to page 1 for their target keyword (measurable in GSC).
- **Total GSC clicks** up ≥30% on pillar+cluster URLs.
- **CTR on rewritten low-CTR pages** up ≥1 percentage point (small number, big traffic impact).
- **Time from "spotted opportunity" to "published anchor + 3 clusters"** under 1 hour of admin time, mostly clicking buttons.

If we hit those, the system works. If not, we look at what GSC says is happening and iterate.

---

## Decisions (settled)

1. **Sequence**: Phase A → 1–2 week observation → Phase B. ✅
2. **Encryption key**: Auto-generated on first boot, persisted in `system_secrets` table. Survives restarts. No manual env var to set. ✅
3. **OAuth account**: Same Google account that has Search Console access for hydrogenstudies.com. ✅

---

## Status checkpoints

- [x] **Me:** Phase A backend (schema, OAuth, sync service, cron, endpoints, encryption helper).
- [x] **Me:** Phase A admin UI (Search Console page + System Health card cross-wire).
- [x] **Me:** Deploy Phase A.
- [ ] **You:** Complete the 7-step Google Cloud setup above.
- [ ] **You:** Add `GSC_CLIENT_ID`, `GSC_CLIENT_SECRET`, `GSC_SITE_URL` env vars to Railway.
- [ ] **You:** Click Connect on `/admin/seo/search-console`, authorize with the GSC-owning Google account.
- [ ] **You:** Wait for first sync to finish (a few minutes for the 90-day backfill).
- [ ] **You:** Use it for 1–2 weeks. Note what's surprising.
- [ ] **You + me:** Phase B kickoff conversation informed by the actual GSC data.

---

## What to do once Railway picks up the deploy

1. Set the three env vars in Railway: `GSC_CLIENT_ID`, `GSC_CLIENT_SECRET`, `GSC_SITE_URL=sc-domain:hydrogenstudies.com`.
2. Redeploy if Railway doesn't auto-restart on env-var change.
3. Open https://hydrogenstudies.com/admin/seo/search-console.
4. Click **Connect Google Search Console**. You'll be redirected to Google to authorize — sign in with the account that owns the GSC property and approve.
5. After redirect back, the page should show "Connected" with the email. The first sync runs automatically at the next 6-hour cron tick, OR you can click **Sync now** to trigger it immediately. The 90-day backfill takes ~2-5 minutes depending on traffic volume.
6. The Opportunities tabs populate as data lands. Check back the next day to see real Climbers / Low-CTR / Orphan Queries.

If anything fails:
- "Google did not return a refresh token" → revoke at https://myaccount.google.com/permissions, then Connect again.
- OAuth callback "state mismatch" → make sure the redirect URI in Google Cloud exactly matches what the server uses (`https://hydrogenstudies.com/api/admin/gsc/oauth/callback`).
- Sync stays at 0 rows after several minutes → check Railway logs for `GscService` errors. Most likely cause is `GSC_SITE_URL` not matching the verified property.
