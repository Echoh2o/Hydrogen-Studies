# Smoke Test Findings & Issue Tracker

**Date:** February 24, 2026
**Tested by:** Manual smoke test of live site (hydrogen-studies-production.up.railway.app)
**Status:** 28 issues identified, categorized by priority

---

## Summary

The site is functional but has significant UX, content, and SEO problems that undermine the core mission: **convincing casual observers that molecular hydrogen is legitimate science**. Most issues fall into three themes:

1. **Search is broken** — multi-word queries return 0 results because search uses LIKE matching against the full query string rather than individual terms
2. **Content is repetitive and generic** — the same "1,304+ studies" stat appears everywhere, copy is boring, and nothing tells a compelling story
3. **Features are half-built** — learning pathways, customer dashboard, explore pages, insights, contact form, share buttons all have dead ends

---

## PRIORITY 1: BROKEN (Things that don't work at all)

### 1.1 Search returns 0 results for multi-word queries
- **Impact:** HIGH — core feature is unusable for benefit category links
- **Root cause:** `server/services/study-service.ts:42-49` — search uses `LIKE '%full query string%'` which requires an exact substring match. "exercise athletic hydrogen performance" will never match anything because no title/abstract contains that exact phrase.
- **Fix:** Split search terms and use OR/AND matching, or implement PostgreSQL full-text search (`tsvector`/`tsquery`)
- **Affected pages:**
  - Benefits page search links (`BenefitsPage.tsx:100` — `searchQuery: "cardiovascular hydrogen"`)
  - Homepage benefit cards (`HomePage.tsx:175-183` — queries like `"cardiovascular heart cardiac hypertension blood pressure"`)
  - All "Browse Research" links from benefit categories
- **Files:** `server/services/study-service.ts:40-50`, `client/src/pages/HomePage.tsx:174-183`, `client/src/pages/BenefitsPage.tsx:96-173`

### 1.2 Contact form goes nowhere
- **Impact:** HIGH — users think they sent a message but nobody receives it
- **Root cause:** `client/src/pages/ContactPage.tsx:92-104` — the submit handler is a `setTimeout` that shows a fake "message received" toast. The actual `contactMutation.mutate(data)` call is commented out, and there's no `/api/contact` backend route.
- **Fix:** Create contact route that either emails via SendGrid or stores in a `contact_messages` DB table
- **Files:** `client/src/pages/ContactPage.tsx:89-105`, need new `server/routes/contact-routes.ts`

### 1.3 "Share this article" doesn't work on desktop
- **Impact:** MEDIUM — `navigator.share` only exists on mobile; desktop silently copies URL with no feedback
- **Root cause:** `client/src/pages/BlogArticlePage.tsx:178-188` — no toast/notification after clipboard copy
- **Fix:** Add a toast notification for clipboard copy fallback
- **Files:** `client/src/pages/BlogArticlePage.tsx:178-188`

### 1.4 Customer dashboard is a dead end
- **Impact:** MEDIUM — after registration, users see a dashboard with non-functional tools, then can never get back to it
- **Root cause:** `MyDashboardPage.tsx` exists but has no navigation links pointing to it after initial registration. The Settings link sends customers to `/admin/settings` which returns "Access Denied"
- **Fix:** Add `/dashboard` to the user menu for non-admin users. Settings link should go to `/dashboard/settings` (customer settings), not `/admin/settings`
- **Files:** `client/src/pages/MyDashboardPage.tsx`, `client/src/components/layout/SiteHeader.tsx`

### 1.5 Explore by Benefit — study counts incorrect, links broken
- **Impact:** MEDIUM — the `getCategoryCount` function on the Body System tab passes `"bodySystem"` but the data key is `"body_system"`, so all counts show 0
- **Root cause:** `client/src/pages/ExploreByBenefit.tsx:163` — `getCategoryCount("bodySystem", category)` doesn't match the switch case `"body_system"`
- **Fix:** Fix the key mismatch, verify API endpoints return real data instead of placeholder data
- **Files:** `client/src/pages/ExploreByBenefit.tsx:150-174`

### 1.6 Consensus AI filter does nothing
- **Impact:** LOW — the "Include Consensus AI" button in search filters sends `includeExternal=true` but without a valid Consensus API key, it silently returns empty results
- **Fix:** Remove the Consensus AI filter from the UI entirely (per user request)
- **Files:** `client/src/pages/SearchPage.tsx:325-339`

---

## PRIORITY 2: UX/CONTENT PROBLEMS (Things that work but are bad)

### 2.1 Hardcoded, repetitive stats everywhere
- **Impact:** HIGH — "1,304+ studies" appears on 5+ pages. Stats should be dynamic from the database and each page should tell a different part of the story.
- **Locations of hardcoded "1,304" or similar:**
  - `HomePage.tsx:64` — stats array `{ number: "1,304", label: "Scientific Studies" }`
  - `HomePage.tsx:96` — hero text "Explore 1,304+ peer-reviewed studies"
  - `BenefitsPage.tsx:177` — research highlights stat
  - `BenefitsPage.tsx:207` — meta description
  - `BenefitsPage.tsx:91` — quick facts "Over 1,300 scientific studies"
  - `ProductsPage.tsx:166` — "research database of 1,304+ studies"
  - `LoginPage.tsx:57` — "700+ Research Studies" (different number!)
- **Fix:** Create an `/api/stats` endpoint that returns dynamic counts (total studies, countries, categories, date range, human vs animal, etc.) and use it across all pages. Each page should highlight different, contextually relevant stats.

### 2.2 "1,304 studies" vs "500+ papers" — confusing
- **Impact:** MEDIUM — `HomePage.tsx:65-66` shows both "1,304 Scientific Studies" and "500+ Published Papers" side by side. A casual reader won't understand the distinction.
- **Fix:** Replace with more meaningful, differentiated stats. Examples: "47 Health Conditions Studied", "25+ Countries", "Human Clinical Trials: 312", "Published Since 2007"

### 2.3 "Join 50K+ Health Enthusiasts" — meaningless badge
- **Impact:** LOW — `HomePage.tsx:123` — there's no mailing list, no community, no basis for this claim
- **Fix:** Remove or replace with something factual like "Updated Weekly" or "Free Research Access"

### 2.4 "Backed by Science" badge — generic
- **Impact:** LOW — `HomePage.tsx:127` — says nothing specific
- **Fix:** Replace with a specific claim like "312 Human Clinical Trials" or "Research from 25+ Countries"

### 2.5 Homepage hero text is repetitive and boring
- **Impact:** MEDIUM — "Explore 1,304+ peer-reviewed studies from leading universities worldwide. Learn how molecular hydrogen could transform your health and wellness journey." (`HomePage.tsx:96-98`)
- **Fix:** Rewrite to tell a compelling story. Focus on the legitimacy angle: "Molecular hydrogen has been studied in over 1,000 peer-reviewed papers across 25 countries. Here's what the science actually says."

### 2.6 Products page repeats the same stat
- **Impact:** LOW — `ProductsPage.tsx:163-167` — "backed by our research database of 1,304+ studies"
- **Fix:** Use product-specific stats instead, e.g., "Hydrogen water is the most-studied delivery method with X clinical trials"

### 2.7 "Browse Research Database" links go to unfiltered /studies
- **Impact:** MEDIUM — every benefit category's "Browse Research Database" button links to `/studies` with no filter (`BenefitsPage.tsx:330-334`)
- **Fix:** Link to `/studies?category=cardiovascular` (or whatever the relevant category is)

### 2.8 Blog titles are all the same scientific jargon
- **Impact:** HIGH — blog list shows truncated academic titles with "..." because they're too long and technical. Titles like "Comprehensive brain tissue metabolomics and biological netwo..." are meaningless to casual readers.
- **Root cause:** Blog generator creates `plain_language_title` but the list page may be showing the raw study title. The AI title prompt at `blog-generator-enhanced.ts:298-302` says "SEO-friendly" but the input is just a summary snippet — it lacks target keyword context.
- **Fix:** Improve the AI prompt to explicitly require: (1) 4th-6th grade reading level, (2) include target SEO keyword, (3) be compelling to someone who knows nothing about hydrogen. Also show `plain_language_title` or generated blog title instead of study title on list pages.

### 2.9 Blog articles have no hero images
- **Impact:** MEDIUM — despite DALL-E integration in the generator, many articles show a placeholder image. The blog list falls back to `placehold.co` URLs (`BlogListPage.tsx:226`)
- **Fix:** Ensure image generation runs for all articles; add SEO-friendly alt tags based on article keywords

### 2.10 "How Hydrogen Works" section — rename and link out
- **Impact:** LOW — `BenefitsPage.tsx:439` says "How Hydrogen Water Works" but should be "How Molecular Hydrogen Improves Health". Each item (Selective Antioxidant, Cellular Protection, Anti-Inflammatory) should link to in-depth anchor content
- **Files:** `BenefitsPage.tsx:436-487`

### 2.11 Useless CTA at bottom of Benefits page
- **Impact:** LOW — "Ready to Experience These Benefits?" with a "View Products" button (`BenefitsPage.tsx:489-516`) doesn't serve the educational mission
- **Fix:** Replace with something like "Explore the Research" → link to studies, or "Start Learning" → link to educational content

### 2.12 Login page has wrong study count
- **Impact:** LOW — `LoginPage.tsx:57` says "700+ Research Studies" while everywhere else says 1,304+
- **Fix:** Use dynamic count from API

### 2.13 Login page logo doesn't say "powered by Echo Water"
- **Impact:** LOW — `LoginPage.tsx:143-146` shows "Hydrogen Studies" text only
- **Fix:** Add "powered by Echo Water" subtitle

---

## PRIORITY 3: FEATURES THAT NEED MAJOR IMPROVEMENT

### 3.1 Search needs word-level matching
- **Current:** Single LIKE query against the full search string
- **Needed:** Split query into individual words, match ANY word (OR logic), rank results by how many words match
- **Ideal:** PostgreSQL full-text search with `tsvector`/`tsquery` for proper stemming ("athlete" matches "athletic", "athletes")
- **Impact:** This single fix would make benefit category links, homepage benefit cards, and general search all work properly
- **Files:** `server/services/study-service.ts:40-50`

### 3.2 Blog generation AI prompts need SEO optimization
- **Current prompts:**
  - Content: "Write engaging, accurate content at a 6th grade reading level" (good)
  - Title: "Create engaging, SEO-friendly titles" (too vague — no keyword context)
  - Summary: Just the first paragraph truncated to 300 chars (not optimized)
- **Needed:**
  - Title prompt should include target SEO keywords
  - Summary prompt should be a separate AI call optimized for meta descriptions (150-160 chars, include keyword, include call-to-action)
  - Content should include internal links to related studies and blog posts
  - Content should include H2/H3 headers with keyword variations
- **Files:** `server/services/blog-generator-enhanced.ts:260-313`

### 3.3 Internal linking between content
- **Current:** `server/services/internal-linking-engine.ts` exists but blog articles don't link to each other or to studies
- **Needed:** Auto-link related blog posts within content. When a study is referenced in a blog, the study page should show which blogs reference it.
- **Files:** `server/services/internal-linking-engine.ts`, `client/src/pages/BlogArticlePage.tsx`

### 3.4 SEO keyword management in admin
- **User request:** Add an admin section for managing target SEO keywords (high-value anchor keywords, long-tail keywords, topic clusters)
- **Impact:** HIGH for long-term SEO strategy — blog generation should reference these keywords when creating content
- **Files:** Would need new DB table, admin page, and integration with blog generator

### 3.5 Learning Pathways need real content
- **Current:** `BenefitsPage.tsx:32-85` — four cards with hardcoded fake study counts and "Learn more" that goes nowhere
- **Needed:** Each pathway should link to a curated collection of studies and educational content. Or remove until properly built.
- **Files:** `BenefitsPage.tsx:368-434`

### 3.6 Explore by Delivery Method needs better organization
- **User request:** Should clearly show three main categories:
  1. Hydrogen Gas Inhalation → link to inhalation studies
  2. Bathing in Hydrogen Rich Water → link to topical/bathing studies
  3. Drinking Hydrogen Rich Water → link to drinking water studies
- **Current:** `ExploreByDeliveryMethod.tsx` fetches from `/api/delivery-methods` API — the data may not be well-categorized
- **Files:** `client/src/pages/ExploreByDeliveryMethod.tsx`

### 3.7 Explore by Benefit needs robust anchor content
- **User request:** Each category should link to a comprehensive anchor content piece about "Hydrogen Water and [topic]"
- **Current:** Just shows study cards when you click a category
- **Files:** `client/src/pages/ExploreByBenefit.tsx`

### 3.8 Insights page is a broken version of Analytics
- **Page:** `/insights` — appears to be a less-polished duplicate of `/research-analytics`
- **Fix:** Either improve it to serve a different purpose or redirect to analytics
- **Files:** `client/src/pages/ResearchInsightsPage.tsx`

### 3.9 AI Assistant — remove per user request
- **Current:** Chat page at `/chat`, linked from homepage (`HomePage.tsx:396`, `HomePage.tsx:411-415`)
- **Fix:** Remove all links to `/chat` and the AI assistant CTA section
- **Files:** `client/src/pages/HomePage.tsx:395-396, 402-425`, `client/src/pages/ChatPage.tsx`

---

## PRIORITY 4: CONTENT STRATEGY IMPROVEMENTS

### 4.1 Dynamic, contextual stats instead of one repeated number
Instead of "1,304+ studies" everywhere, each page should highlight different facets:
- **Homepage:** Total studies, countries, and one "wow" stat (e.g., "312 human clinical trials")
- **Benefits page:** Stats relevant to the selected benefit category
- **Products page:** Delivery-method-specific study counts
- **Blog:** "X new studies published this month" or trending topics

### 4.2 The story of hydrogen science legitimacy
The site's mission is to show hydrogen is real science. Stats to surface:
- First hydrogen medical study: 2007 (Nature Medicine)
- Growth trend: studies per year increasing
- Geographic spread: 25+ countries
- Institution credibility: top universities publishing
- Human clinical trials vs. animal studies breakdown
- Most-studied health conditions

### 4.3 Blog content needs images with SEO alt tags
Every blog post should have:
- A hero image (DALL-E generated or stock)
- Alt tags that include the target keyword
- In-article images for long content pieces

### 4.4 Blog-to-study and study-to-blog cross-linking
When a blog references a study, the study detail page should show "Articles about this research". This creates a content web that improves SEO and user engagement.

---

## Implementation Priority Order

| # | Issue | Effort | Impact | Do When |
|---|-------|--------|--------|---------|
| 1 | Fix search (word-level matching) | M | Critical | Now — unblocks all benefit links |
| 2 | Contact form backend | S | High | Now — basic functionality |
| 3 | Remove AI assistant links | S | Low | Now — quick cleanup |
| 4 | Remove Consensus AI filter | S | Low | Now — quick cleanup |
| 5 | Dynamic stats API | M | High | This week |
| 6 | Fix Explore by Benefit count mismatch | S | Medium | This week |
| 7 | Fix customer dashboard navigation | S | Medium | This week |
| 8 | Fix "Browse Research Database" links to include category | S | Medium | This week |
| 9 | Improve blog AI prompts (SEO titles, summaries) | M | High | This week |
| 10 | Remove/fix dead badges ("50K+", "Backed by Science") | S | Low | This week |
| 11 | Blog hero images + alt tags | M | Medium | Week 2 |
| 12 | Search upgrade to full-text search | L | High | Week 2 |
| 13 | SEO keyword admin panel | L | High | Week 2-3 |
| 14 | Internal cross-linking engine | L | High | Week 2-3 |
| 15 | Learning pathways rebuild | L | Medium | Week 3-4 |
| 16 | Anchor content for explore categories | XL | High | Ongoing |
| 17 | Share button fix | S | Low | Anytime |
| 18 | Rename "How Hydrogen Works" section | S | Low | Anytime |
| 19 | Fix login page details | S | Low | Anytime |

---

## Files Referenced

| File | Issues |
|------|--------|
| `server/services/study-service.ts` | 1.1, 3.1 |
| `client/src/pages/HomePage.tsx` | 1.1, 2.1, 2.2, 2.3, 2.4, 2.5, 3.9 |
| `client/src/pages/BenefitsPage.tsx` | 1.1, 2.1, 2.7, 2.10, 2.11, 3.5 |
| `client/src/pages/ContactPage.tsx` | 1.2 |
| `client/src/pages/BlogArticlePage.tsx` | 1.3, 3.3 |
| `client/src/pages/BlogListPage.tsx` | 2.8, 2.9 |
| `client/src/pages/SearchPage.tsx` | 1.6 |
| `client/src/pages/MyDashboardPage.tsx` | 1.4 |
| `client/src/pages/ExploreByBenefit.tsx` | 1.5, 3.7 |
| `client/src/pages/ExploreByDeliveryMethod.tsx` | 3.6 |
| `client/src/pages/ProductsPage.tsx` | 2.1, 2.6 |
| `client/src/pages/LoginPage.tsx` | 2.12, 2.13 |
| `client/src/pages/ResearchInsightsPage.tsx` | 3.8 |
| `client/src/pages/ChatPage.tsx` | 3.9 |
| `server/services/blog-generator-enhanced.ts` | 2.8, 3.2 |
| `server/services/internal-linking-engine.ts` | 3.3 |
| `client/src/components/layout/SiteHeader.tsx` | 1.4 |
