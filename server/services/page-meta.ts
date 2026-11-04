/**
 * Page meta for every public path — title, description, canonical, robots,
 * Open Graph image/type and the page's JSON-LD.
 *
 * Consumed by the Next.js front door (server/routes/page-data-routes.ts →
 * web/) and by the SPA shell (server/middleware/spa-shell.ts), so browsers
 * and crawlers get the same <head>. No user-agent logic lives here
 * (PLAN.md 3.4): the bot-only prerender that used to own this code was
 * deleted 2026-11-03.
 */
import { db } from "../db";
import { studies, blogArticles } from "../../shared/schema";
import { eq, and } from "drizzle-orm";
import { logger } from "../utils/logger";
import { toAbsoluteUrl } from "../utils/absolute-url";
import {
  blogArticleJsonLd,
  blogPageTitle,
  buildPageTitle,
  collectionPageJsonLd,
  datasetJsonLd,
  profilePageJsonLd,
  webPageJsonLd,
  excerptAtWord,
  faqPageJsonLd,
  faqPairsIfVisible,
  parseQaPairs,
  realContent,
  studyDescription,
  studyJsonLd,
  studyPageTitle,
} from "../../shared/seo-markup";
import { getHydrogenForTopic } from "../../shared/hydrogen-for-topics";
import { conditionHubJsonLd, getConditionHubIntro } from "../../shared/condition-hub-intros";
import {
  bodySystemHubName,
  exploreDetailCopy,
  exploreDetailMeta,
  exploreIndexCopy,
  exploreIndexH1,
  findBodySystemHub,
  mechanismHubMeta,
  titleCaseSlug,
  type ConditionHubRef,
  type ListedExploreHubType,
} from "../../shared/explore-hubs";
import { studyBreadcrumbs, studyHubLinks } from "../../shared/study-page";
import {
  blogListBreadcrumbs,
  blogPostBreadcrumbs,
  bodySystemHubBreadcrumbs,
  breadcrumbListJsonLd,
  conditionHubBreadcrumbs,
  exploreDetailBreadcrumbs,
  exploreIndexBreadcrumbs,
  hydrogenForBreadcrumbs,
  journalBreadcrumbs,
  LAST_CRUMB_MAX,
  pageBreadcrumbs,
  policyBreadcrumbs,
  profilesIndexBreadcrumbs,
  researcherBreadcrumbs,
  studiesListBreadcrumbs,
  truncateLabel,
  type Crumb,
} from "../../shared/breadcrumbs";
import { getConditionHubs } from "../middleware/seo-body-renderer";
import { getJournal, getResearcher } from "./profiles";
import { openAlexAuthorUrl, orcidUrl } from "../../shared/author-identity";
import {
  JOURNALS_H1,
  RESEARCHERS_H1,
  journalDescription,
  journalTitle,
  researcherDescription,
  researcherTitle,
} from "../../shared/profiles";
import {
  LIMITS_H1,
  LIMITS_LAST_REVIEWED,
  LIMITS_PATH,
  NULL_RESULTS_H1,
  NULL_RESULTS_PATH,
  SCAM_FAQS,
  SCAM_H1,
  SCAM_LAST_REVIEWED,
  SCAM_PATH,
  GAP_MAP_H1,
  GAP_MAP_LAST_REVIEWED,
  GAP_MAP_PATH,
} from "../../shared/evidence-pages";
import {
  DATASET_CSV_PATH,
  DATASET_FIELDS,
  DATASET_H1,
  DATASET_JSON_PATH,
  DATASET_LAST_REVIEWED,
  DATASET_LICENSE_URL,
  DATASET_PATH,
  REPORT_H1,
  REPORT_LAST_REVIEWED,
  REPORT_PATH,
} from "../../shared/dataset";
import { marked } from "marked";

const SITE_URL = process.env.SITE_URL || "https://hydrogenstudies.com";
const SITE_NAME = "Hydrogen Studies";

// Paths whose content is definitively DB-backed: a resolution miss means the
// page truly doesn't exist (vs. a SPA route missing from the static-meta map),
// so bots must get a hard 404 instead of a soft-404 fallback.
const CONTENT_PATH_PATTERNS = [
  /^\/study\/[^/]+$/,
  /^\/studies\/(?!tags$)[^/]+$/,
  /^\/blog\/[^/]+$/,
  /^\/researchers\/[^/]+$/,
  /^\/journals\/[^/]+$/,
];

export function isContentPath(pathname: string): boolean {
  return CONTENT_PATH_PATTERNS.some(pattern => pattern.test(pathname));
}


export interface PageMeta {
  title: string;
  description: string;
  canonical: string;
  ogType: string;
  ogImage: string;
  jsonLd?: object;
  robots?: string;
}

/** Resolve meta tags for a given URL path */
export async function resolvePageMeta(pathname: string): Promise<PageMeta | null> {
  try {
    // Study page: /study/:slug
    const studySlugMatch = pathname.match(/^\/study\/([^/]+)$/);
    if (studySlugMatch) {
      const slug = studySlugMatch[1];
      // Skip if it's a numeric ID (legacy route)
      if (/^\d+$/.test(slug)) {
        // Excluded (off-topic) studies never render: the 410 guard in app.ts
        // answers first; this keeps the prerender honest if reached directly.
        const [study] = await db.select().from(studies).where(and(eq(studies.id, parseInt(slug)), eq(studies.isExcluded, false))).limit(1);
        if (study) return buildStudyMeta(study, await getConditionHubs());
      } else {
        const [study] = await db.select().from(studies).where(and(eq(studies.slug, slug), eq(studies.isExcluded, false))).limit(1);
        if (study) return buildStudyMeta(study, await getConditionHubs());
      }
      return null;
    }

    // Alternative study path: /studies/:slug
    const studiesSlugMatch = pathname.match(/^\/studies\/([^/]+)$/);
    if (studiesSlugMatch && !/^(tags)$/.test(studiesSlugMatch[1])) {
      const slug = studiesSlugMatch[1];
      const [study] = await db.select().from(studies).where(and(eq(studies.slug, slug), eq(studies.isExcluded, false))).limit(1);
      if (study) return buildStudyMeta(study, await getConditionHubs());
      return null;
    }

    // Blog page: /blog/:slug or /blog/:id
    const blogMatch = pathname.match(/^\/blog\/([^/]+)$/);
    if (blogMatch) {
      const idOrSlug = blogMatch[1];
      let blog;
      // Only published, non-archived articles are prerendered — drafts and
      // soft-deleted posts must fall through to the hard-404 branch, matching
      // the body renderer (seo-body-renderer.ts) and every other public query.
      if (/^\d+$/.test(idOrSlug)) {
        [blog] = await db.select().from(blogArticles).where(and(
          eq(blogArticles.id, parseInt(idOrSlug)),
          eq(blogArticles.isPublished, true),
          eq(blogArticles.isArchived, false),
        )).limit(1);
      } else {
        [blog] = await db.select().from(blogArticles).where(and(
          eq(blogArticles.slug, idOrSlug),
          eq(blogArticles.isPublished, true),
          eq(blogArticles.isArchived, false),
        )).limit(1);
      }
      if (blog) return buildBlogMeta(blog);
      return null;
    }

    // Researcher / journal profiles (PLAN 4.7): name, counts and the trail
    // come from the same index the renderer uses; unknown slug → null → 404.
    const researcherMatch = pathname.match(/^\/researchers\/([^/]+)$/);
    if (researcherMatch) {
      const p = await getResearcher(researcherMatch[1]);
      if (!p) return null;
      const canonical = `${SITE_URL}/researchers/${p.slug}`;
      const description = excerptAtWord(researcherDescription(p), 160);
      return {
        title: buildPageTitle(researcherTitle(p)),
        description,
        canonical,
        ogType: "profile",
        ogImage: `${SITE_URL}/logo.png`,
        jsonLd: [
          profilePageJsonLd({
            name: p.name,
            description,
            canonical,
            siteUrl: SITE_URL,
            // Only what the page shows (identity resolved from OpenAlex authorships).
            sameAs: p.identity ? [...(p.identity.orcid ? [orcidUrl(p.identity.orcid)] : []), openAlexAuthorUrl(p.identity.openalexAuthorId)] : undefined,
            affiliation: p.identity?.institution ?? null,
          }),
          breadcrumbListJsonLd(researcherBreadcrumbs(p.name), SITE_URL),
        ],
      };
    }
    const journalMatch = pathname.match(/^\/journals\/([^/]+)$/);
    if (journalMatch) {
      const j = await getJournal(journalMatch[1]);
      if (!j) return null;
      const canonical = `${SITE_URL}/journals/${j.slug}`;
      const description = excerptAtWord(journalDescription(j), 160);
      return {
        title: buildPageTitle(journalTitle(j)),
        description,
        canonical,
        ogType: "website",
        ogImage: `${SITE_URL}/logo.png`,
        jsonLd: [
          collectionPageJsonLd({ name: j.name, description, canonical, siteUrl: SITE_URL, about: { "@type": "Periodical", name: j.name } }),
          breadcrumbListJsonLd(journalBreadcrumbs(j.name), SITE_URL),
        ],
      };
    }

    // Condition hubs: the visible crumb is the health_conditions row's name
    // (what the renderer shows), so the BreadcrumbList needs the hub list.
    const conditionMatch = pathname.match(/^\/explore-by-condition\/([^/]+)$/);
    if (conditionMatch) {
      const base = resolveStaticPageMeta(pathname);
      if (!base) return null;
      const hub = (await getConditionHubs()).find((h) => h.slug === conditionMatch[1]);
      if (!hub) return base; // not a live hub — the renderer 404s it
      const blocks = asBlocks(base.jsonLd);
      if (!blocks.length) {
        // No reviewed intro: the renderer's generic H1.
        blocks.push(
          collectionPageJsonLd({
            name: `Hydrogen Research for ${hub.name}`,
            description: base.description,
            canonical: base.canonical,
            siteUrl: SITE_URL,
            medical: true,
          }),
        );
      }
      blocks.push(breadcrumbListJsonLd(conditionHubBreadcrumbs(hub.name), SITE_URL));
      return { ...base, jsonLd: blocks };
    }

    // Static pages
    return resolveStaticPageMeta(pathname);
  } catch (err) {
    logger.error("resolvePageMeta failed", err, "PageMeta", { pathname });
    return null;
  }
}

export function buildStudyMeta(study: any, conditionHubs: readonly ConditionHubRef[] = []): PageMeta {
  const slug = study.slug || `id/${study.id}`;
  const canonical = `${SITE_URL}/study/${slug}`;
  const ogImage = toAbsoluteUrl(study.ogImage || study.imageUrl || "/logo.png", SITE_URL);
  // Same trail the body renderer shows (shared/study-page.ts).
  const pageLabel = realContent(study.plainLanguageTitle) || realContent(study.title);
  // Same truncation as the visible trail (web/app/study/[slug]/page.tsx).
  const breadcrumbs = studyBreadcrumbs(
    pageLabel,
    studyHubLinks({ healthConditions: study.healthConditions, bodySystems: study.bodySystems }, conditionHubs),
  ).map((c, i, all) => (i === all.length - 1 ? { label: truncateLabel(c.label, LAST_CRUMB_MAX) } : c));

  // Shared with the SPA (SEOStudyPage) so both paths emit identical schema.
  // No `abstract` field and a ≤300-char description (publisher copyright).
  //
  // No FAQPage: study pages render no visible FAQ, and the hidden
  // question_answer_pairs column must never become schema (CLAUDE.md: no
  // FAQPage without a visible FAQ).
  const jsonLd = studyJsonLd(study, { canonical, siteUrl: SITE_URL, image: ogImage, breadcrumbs });

  return {
    title: studyPageTitle(study),
    description: excerptAtWord(studyDescription(study, 300), 160),
    canonical,
    ogType: "article",
    ogImage,
    jsonLd,
  };
}

/**
 * Text a reader actually sees on a blog page (title, summary, rendered body)
 * — the FAQPage visibility check runs against this.
 */
function visibleBlogText(blog: any): string {
  let body = String(blog.content || "");
  if (body && !/<(p|h\d|div|ul|ol|table)\b/i.test(body)) {
    try {
      body = marked.parse(body, { async: false }) as string;
    } catch {
      // keep the raw source — still text-searchable
    }
  }
  return `${blog.title || ""}\n${blog.summary || ""}\n${body}`;
}

export function buildBlogMeta(blog: any): PageMeta {
  const description =
    realContent(blog.metaDescription) || realContent(blog.summary100Words) || realContent(blog.summary);
  const canonical = `${SITE_URL}/blog/${blog.slug}`;
  const ogImage = toAbsoluteUrl(blog.ogImage || blog.imageUrl || "/logo.png", SITE_URL);

  // author/dateModified/reviewedBy mirror the visible byline (shared/seo-markup).
  const article = blogArticleJsonLd(blog, {
    canonical,
    siteUrl: SITE_URL,
    description,
    image: ogImage,
    keywords: blog.semanticKeywords,
  });

  // FAQPage only when EVERY stored question is visible in the rendered
  // article. question_answer_pairs is a hidden column; most posts don't show
  // those Q&As, and schema for invisible content is a spam signal.
  const visibleFaq = faqPairsIfVisible(parseQaPairs(blog.questionAnswerPairs), visibleBlogText(blog));

  return {
    title: blogPageTitle(blog),
    description: excerptAtWord(description, 160),
    canonical,
    ogType: "article",
    ogImage,
    // The renderer shows Home › Blog › title above the article.
    jsonLd: [
      article,
      ...(visibleFaq ? [faqPageJsonLd(visibleFaq)] : []),
      breadcrumbListJsonLd(blogPostBreadcrumbs(blog.title), SITE_URL),
    ],
  };
}

function asBlocks(jsonLd: PageMeta["jsonLd"]): Record<string, any>[] {
  return jsonLd ? (Array.isArray(jsonLd) ? [...jsonLd] : [jsonLd]) : [];
}

/** Page block + BreadcrumbList for a listing page with a visible trail. */
function listingJsonLd(opts: {
  name: string;
  description: string;
  canonical: string;
  crumbs: Crumb[];
  medical?: boolean;
}): Record<string, any>[] {
  return [
    collectionPageJsonLd({ ...opts, siteUrl: SITE_URL }),
    breadcrumbListJsonLd(opts.crumbs, SITE_URL),
  ];
}

/** Blocks for the static listing/policy paths the renderer shows a trail on. */
function staticPathJsonLd(pathname: string, description: string): Record<string, any>[] | undefined {
  const canonical = `${SITE_URL}${pathname}`;
  if (pathname === "/studies") {
    return listingJsonLd({ name: "Research Studies Directory", description, canonical, crumbs: studiesListBreadcrumbs() });
  }
  if (pathname === "/blog") {
    return listingJsonLd({ name: "Hydrogen Health Blog", description, canonical, crumbs: blogListBreadcrumbs() });
  }
  const index = pathname.match(/^\/explore-by-([a-z-]+)$/);
  if (index) {
    const h1 = exploreIndexH1(index[1]);
    return listingJsonLd({ name: h1, description, canonical, crumbs: exploreIndexBreadcrumbs(h1) });
  }
  if (pathname === LIMITS_PATH) {
    return [
      webPageJsonLd({ name: LIMITS_H1, description, canonical, siteUrl: SITE_URL, dateModified: LIMITS_LAST_REVIEWED }),
      breadcrumbListJsonLd(pageBreadcrumbs(LIMITS_H1), SITE_URL),
    ];
  }
  if (pathname === NULL_RESULTS_PATH) {
    return listingJsonLd({ name: NULL_RESULTS_H1, description, canonical, crumbs: pageBreadcrumbs(NULL_RESULTS_H1) });
  }
  if (pathname === DATASET_PATH) {
    return [
      datasetJsonLd({
        name: DATASET_H1,
        description,
        canonical,
        siteUrl: SITE_URL,
        licenseUrl: DATASET_LICENSE_URL,
        dateModified: DATASET_LAST_REVIEWED,
        distributions: [
          { contentUrl: `${SITE_URL}${DATASET_CSV_PATH}`, encodingFormat: "text/csv" },
          { contentUrl: `${SITE_URL}${DATASET_JSON_PATH}`, encodingFormat: "application/json" },
        ],
        fields: DATASET_FIELDS,
      }),
      breadcrumbListJsonLd(pageBreadcrumbs(DATASET_H1), SITE_URL),
    ];
  }
  if (pathname === REPORT_PATH) {
    return [
      webPageJsonLd({ name: REPORT_H1, description, canonical, siteUrl: SITE_URL, dateModified: REPORT_LAST_REVIEWED }),
      breadcrumbListJsonLd(pageBreadcrumbs(REPORT_H1), SITE_URL),
    ];
  }
  if (pathname === GAP_MAP_PATH) {
    return [
      webPageJsonLd({ name: GAP_MAP_H1, description, canonical, siteUrl: SITE_URL, dateModified: GAP_MAP_LAST_REVIEWED }),
      breadcrumbListJsonLd(pageBreadcrumbs(GAP_MAP_H1), SITE_URL),
    ];
  }
  if (pathname === SCAM_PATH) {
    // The FAQ is rendered visibly on the page (renderScamPage), so FAQPage is allowed.
    return [
      webPageJsonLd({ name: SCAM_H1, description, canonical, siteUrl: SITE_URL, dateModified: SCAM_LAST_REVIEWED }),
      faqPageJsonLd(SCAM_FAQS),
      breadcrumbListJsonLd(pageBreadcrumbs(SCAM_H1), SITE_URL),
    ];
  }
  if (pathname === "/researchers") {
    return listingJsonLd({ name: RESEARCHERS_H1, description, canonical, crumbs: profilesIndexBreadcrumbs(RESEARCHERS_H1) });
  }
  if (pathname === "/journals") {
    return listingJsonLd({ name: JOURNALS_H1, description, canonical, crumbs: profilesIndexBreadcrumbs(JOURNALS_H1) });
  }
  if (pathname === "/editorial-policy") return [breadcrumbListJsonLd(policyBreadcrumbs("Editorial Policy"), SITE_URL)];
  if (pathname === "/methodology") return [breadcrumbListJsonLd(policyBreadcrumbs("Methodology"), SITE_URL)];
  return undefined;
}

function exploreIndexMeta(type: ListedExploreHubType): { title: string; description: string } {
  const { title, description } = exploreIndexCopy(type);
  return { title, description };
}

export function resolveStaticPageMeta(pathname: string): PageMeta | null {
  // PLAN.md 0.6 + 1.8: internal-search pages and thin pages carry
  // noindex,follow until they have real content. Kept in nav; removed from
  // sitemap-pages in seo-routes.ts (same deploy).
  const NOINDEX_PATHS = new Set([
    "/search",
    "/advanced-search",
    "/products",
    "/recommendations",
  ]);
  const noindexFor = (p: string): string | undefined =>
    NOINDEX_PATHS.has(p) || p.startsWith("/learn/") || p === "/learn"
      ? "noindex, follow"
      : undefined;

  const pages: Record<string, { title: string; description: string }> = {
    "/": {
      title: `Hydrogen Studies | ${SITE_NAME} Research Database`,
      description: "Search 2,000+ published studies on molecular hydrogen, with plain-English summaries and evidence grades, organized by condition, body system and mechanism."
    },
    "/studies": {
      title: `Research Studies Directory | ${SITE_NAME}`,
      description: "Browse our comprehensive directory of hydrogen therapy research studies. Filter by condition, body system, study type, and outcome."
    },
    "/blog": {
      title: `Hydrogen Health Blog | ${SITE_NAME}`,
      description: "Plain-language articles explaining hydrogen therapy research. Understand the science behind molecular hydrogen and its health benefits."
    },
    "/editorial-policy": {
      title: `Editorial Policy | ${SITE_NAME}`,
      description: "How Hydrogen Studies selects, summarizes, and reviews research — and how editorial independence from our funder, Echo Technologies LLC, works."
    },
    "/methodology": {
      title: `Methodology | ${SITE_NAME}`,
      description: "How studies enter the Hydrogen Studies database, how summaries are drafted and reviewed, and how funding and conflicts of interest are recorded."
    },
    "/about": {
      title: `About | ${SITE_NAME}`,
      description: "Learn about Hydrogen Studies — the most comprehensive database of molecular hydrogen research, dedicated to making scientific research accessible."
    },
    "/search": {
      title: `Search Research | ${SITE_NAME}`,
      description: "Search our database of hydrogen therapy research studies by keyword, condition, body system, or mechanism of action."
    },
    "/advanced-search": {
      title: `Advanced Research Search | ${SITE_NAME}`,
      description: "Advanced search with filters for study type, outcome, date range, body system, and health condition across hydrogen therapy research."
    },
    "/explore-by-condition": {
      title: `Hydrogen Research by Health Condition | ${SITE_NAME}`,
      description: "Explore hydrogen therapy research organized by health condition. Find studies on diabetes, Alzheimer's, arthritis, cancer support, and more."
    },
    "/explore-by-body-system": {
      title: `Hydrogen Research by Body System | ${SITE_NAME}`,
      description: "Browse hydrogen therapy studies organized by body system — brain, heart, digestive, immune, musculoskeletal, and more."
    },
    // Shared index copy (shared/explore-hubs.ts exploreIndexCopy) — the SPA
    // demographic, delivery-method and benefit indexes render the same
    // title/description for browsers.
    "/explore-by-mechanism": exploreIndexMeta("mechanism"),
    "/explore-by-life-stage": exploreIndexMeta("life-stage"),
    "/explore-by-demographic": exploreIndexMeta("demographic"),
    "/explore-by-delivery-method": exploreIndexMeta("delivery-method"),
    "/explore-by-benefit": exploreIndexMeta("benefit"),
    // /learn stays noindex,follow (PLAN 0.6) until Josh lifts it; the Next
    // page adds the FAQPage block (the FAQ is visible there).
    "/learn": {
      title: `Learn About Molecular Hydrogen | ${SITE_NAME}`,
      description: "Everything you need to understand molecular hydrogen (H₂) — what it is, how it works, and what 2,000+ studies have (and haven't) found. Plain English. No hype.",
    },
    "/learn/basics": {
      title: `Hydrogen Therapy Basics | ${SITE_NAME}`,
      description: "Everything you need to know about molecular hydrogen therapy — what it is, how it works, and what the research shows."
    },
    "/learn/health-benefits": {
      title: `Hydrogen Health Benefits Guide | ${SITE_NAME}`,
      description: "A comprehensive guide to the health benefits of molecular hydrogen, backed by peer-reviewed research studies."
    },
    "/learn/therapy-guide": {
      title: `Hydrogen Therapy Guide | ${SITE_NAME}`,
      description: "Your complete guide to hydrogen therapy — methods, dosages studied, safety profile, and what to expect from research findings."
    },
    "/recommendations": {
      title: `Research Recommendations | ${SITE_NAME}`,
      description: "Personalized hydrogen therapy research recommendations based on your interests, health conditions, and reading history."
    },
    "/products": {
      title: `Hydrogen Products | ${SITE_NAME}`,
      description: "Hydrogen water bottles, machines, inhalation and bath devices from Echo Water, the company that funds Hydrogen Studies."
    },
    "/contact": {
      title: `Contact Us | ${SITE_NAME}`,
      description: "Get in touch with the Hydrogen Studies team. Questions about hydrogen research, partnership inquiries, or feedback welcome."
    },
    "/privacy": {
      title: `Privacy Policy | ${SITE_NAME}`,
      description: "Hydrogen Studies privacy policy — how we collect, use, and protect your personal information."
    },
    "/disclaimer": {
      title: `Medical Disclaimer | ${SITE_NAME}`,
      description: "Important medical disclaimer for Hydrogen Studies. This website provides educational information only and is not a substitute for professional medical advice.",
    },
    "/terms": {
      title: `Terms of Service | ${SITE_NAME}`,
      description: "Terms of service for using the Hydrogen Studies research database and website."
    },
    // These three rendered a body for bots but had no meta entry, so they got
    // the homepage title/description (X-Bot-Cache: FALLBACK) — audit 2026-09.
    "/insights": {
      title: `Hydrogen Research Insights | ${SITE_NAME}`,
      description: "Trends across the hydrogen research database: publication volume by year, study types, conditions studied and where the evidence is strong or still thin."
    },
    // PLAN 4.6 — radical-honesty pages (numbers computed live by the renderer).
    [LIMITS_PATH]: {
      title: `The Limits of the Evidence on Hydrogen | ${SITE_NAME}`,
      description: "How much hydrogen research is actually in people, how small and short the trials are, how positive the published results skew, where the work comes from and what has been replicated — computed live.",
    },
    // PLAN 6.2 — open dataset + yearly report.
    [DATASET_PATH]: {
      title: `Open Dataset: Every Hydrogen Study, CSV + JSON | ${SITE_NAME}`,
      description: "Download every study in the Hydrogen Studies database as CSV or JSON under CC BY 4.0: identity, design class, sample size, duration, delivery, concentration, outcome direction, funding, tags and citation counts.",
    },
    [REPORT_PATH]: {
      title: `State of Hydrogen Research: Live Figures | ${SITE_NAME}`,
      description: "Molecular hydrogen research by the numbers, computed live: studies per year, by design, delivery method, country and condition, the journals and authors publishing it, and how complete the record is.",
    },
    [GAP_MAP_PATH]: {
      title: `Evidence Gap Map for Hydrogen Research | ${SITE_NAME}`,
      description: "Every health condition with 20+ hydrogen studies, by evidence type — systematic reviews, randomized trials, other human studies, animal and laboratory work — with human result direction and reviewed certainty. Computed live.",
    },
    [SCAM_PATH]: {
      title: `Is Hydrogen Water a Scam? An Honest Answer | ${SITE_NAME}`,
      description: "Not a scam, but heavily oversold: what the research on hydrogen water actually shows, what it does not, the red flags to watch for, and our own conflict of interest, with the numbers computed live.",
    },
    [NULL_RESULTS_PATH]: {
      title: `Null and Negative Results in Hydrogen Research | ${SITE_NAME}`,
      description: "Every study in our database whose main result for hydrogen was neutral, negative or mixed, people first — the results most hydrogen sites leave out, with links to each paper.",
    },
    "/researchers": {
      title: `Researchers Publishing on Molecular Hydrogen | ${SITE_NAME}`,
      description: "The most prolific authors of molecular hydrogen research, each with a page listing their studies, journals and topics, with links to every paper.",
    },
    "/journals": {
      title: `Journals Publishing Hydrogen Research | ${SITE_NAME}`,
      description: "Journals with ten or more molecular hydrogen studies in our database, each with a page listing those studies and linking to every paper.",
    },
    "/research-analytics": {
      title: `Hydrogen Research Analytics | ${SITE_NAME}`,
      description: "Charts and statistics on published molecular hydrogen research: studies per year, human vs animal trials, delivery methods and the conditions most studied."
    },
    "/hydrogen-therapy-guide": {
      title: `Hydrogen Therapy Guide | ${SITE_NAME}`,
      description: "An evidence-based guide to molecular hydrogen: delivery methods, doses used in studies, safety data, and what the peer-reviewed research does and doesn't show."
    },
  };

  // /hydrogen-for/:slug — meta derives from the shared topic record (same
  // source as the SPA page). Unknown slugs have no page: null → hard 404.
  const hydrogenForMatch = pathname.match(/^\/hydrogen-for\/([^/]+)$/);
  if (hydrogenForMatch) {
    const topic = getHydrogenForTopic(hydrogenForMatch[1]);
    if (!topic) return null;
    return {
      title: topic.metaTitle,
      description: topic.metaDescription,
      canonical: `${SITE_URL}/hydrogen-for/${topic.slug}`,
      ogType: "website",
      ogImage: `${SITE_URL}/logo.png`,
      // The FAQ is rendered visibly on the page (renderer + SPA), so FAQPage
      // schema is allowed here; the H1 is "Hydrogen for <name>".
      jsonLd: [
        collectionPageJsonLd({
          name: `Hydrogen for ${topic.name}`,
          description: topic.metaDescription,
          canonical: `${SITE_URL}/hydrogen-for/${topic.slug}`,
          siteUrl: SITE_URL,
          medical: true,
        }),
        faqPageJsonLd(topic.faqs),
        breadcrumbListJsonLd(hydrogenForBreadcrumbs(topic.name), SITE_URL),
      ],
    };
  }

  // explore-by-{delivery-method,benefit,demographic}/:slug detail pages also
  // rendered bodies without meta (homepage FALLBACK). Title/description/
  // canonical are shared with the SPA hub pages (shared/explore-hubs.ts).
  const exploreDetailMatch = pathname.match(/^\/explore-by-(delivery-method|benefit|demographic)\/([^/]+)$/);
  if (exploreDetailMatch) {
    const meta = exploreDetailMeta(
      exploreDetailMatch[1] as "delivery-method" | "benefit" | "demographic",
      exploreDetailMatch[2],
    );
    const copy = exploreDetailCopy(exploreDetailMatch[2]);
    return {
      title: meta.title,
      description: meta.description,
      canonical: `${SITE_URL}${meta.path}`,
      ogType: "website",
      ogImage: `${SITE_URL}/logo.png`,
      jsonLd: listingJsonLd({
        name: copy.h1,
        description: meta.description,
        canonical: `${SITE_URL}${meta.path}`,
        crumbs: exploreDetailBreadcrumbs(exploreDetailMatch[1], copy.name),
      }),
    };
  }

  // Check explore-by-condition category pages
  const conditionMatch = pathname.match(/^\/explore-by-condition\/([^/]+)$/);
  if (conditionMatch) {
    // Evidence-graded hubs (shared/condition-hub-intros.ts): title,
    // description and JSON-LD from the record the SPA page renders too. The
    // FAQ is visible on the page (bot body + SPA), so FAQPage is allowed.
    const intro = getConditionHubIntro(conditionMatch[1]);
    if (intro) {
      const canonical = `${SITE_URL}/explore-by-condition/${intro.slug}`;
      return {
        title: intro.metaTitle,
        description: intro.metaDescription,
        canonical,
        ogType: "website",
        ogImage: `${SITE_URL}/logo.png`,
        jsonLd: conditionHubJsonLd(intro, { canonical, siteUrl: SITE_URL }),
      };
    }
    const category = conditionMatch[1].replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase());
    return {
      title: `Hydrogen Research for ${category} | ${SITE_NAME}`,
      description: `Explore peer-reviewed research studies on hydrogen therapy for ${category.toLowerCase()}. Evidence-based findings, study summaries, and clinical insights.`,
      canonical: `${SITE_URL}/explore-by-condition/${conditionMatch[1]}`,
      ogType: "website",
      ogImage: `${SITE_URL}/logo.png`,
    };
  }

  // Check explore-by-body-system category pages
  const bodySystemMatch = pathname.match(/^\/explore-by-body-system\/([^/]+)$/);
  if (bodySystemMatch) {
    // Hub label, "System" exactly once — was "Brain Nervous System System",
    // "Immune System System" (re-audit 2026-09-28).
    const system = bodySystemHubName(bodySystemMatch[1]);
    const description = `Research studies on molecular hydrogen's effects on the ${system.toLowerCase()}. Browse clinical trials, reviews, and findings.`;
    // The renderer's H1/crumb use the hub label (or the title-cased slug).
    const label = findBodySystemHub(bodySystemMatch[1])?.label ?? titleCaseSlug(bodySystemMatch[1]);
    return {
      title: `Hydrogen Research: ${system} | ${SITE_NAME}`,
      description,
      canonical: `${SITE_URL}${pathname}`,
      ogType: "website",
      ogImage: `${SITE_URL}/logo.png`,
      jsonLd: listingJsonLd({
        name: `Hydrogen Research: ${label}`,
        description,
        canonical: `${SITE_URL}${pathname}`,
        crumbs: bodySystemHubBreadcrumbs(label),
      }),
    };
  }

  // Check explore-by-mechanism pages
  const mechanismMatch = pathname.match(/^\/explore-by-mechanism\/([^/]+)$/);
  if (mechanismMatch) {
    // Shared with the SPA MechanismDetailPage so both emit the same title.
    const mechanism = mechanismHubMeta(mechanismMatch[1]);
    const copy = exploreDetailCopy(mechanismMatch[1]);
    return {
      title: mechanism.title,
      description: mechanism.description,
      canonical: `${SITE_URL}${mechanism.path}`,
      ogType: "website",
      ogImage: `${SITE_URL}/logo.png`,
      jsonLd: listingJsonLd({
        name: copy.h1,
        description: mechanism.description,
        canonical: `${SITE_URL}${mechanism.path}`,
        crumbs: exploreDetailBreadcrumbs("mechanism", copy.name),
      }),
    };
  }

  // Check explore-by-life-stage pages
  const lifeStageMatch = pathname.match(/^\/explore-by-life-stage\/([^/]+)$/);
  if (lifeStageMatch) {
    const stage = lifeStageMatch[1].replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase());
    const description = `Hydrogen therapy research studies relevant to ${stage.toLowerCase()}. Evidence-based findings and clinical applications.`;
    const copy = exploreDetailCopy(lifeStageMatch[1]);
    return {
      title: `Hydrogen Research for ${stage} | ${SITE_NAME}`,
      description,
      canonical: `${SITE_URL}${pathname}`,
      ogType: "website",
      ogImage: `${SITE_URL}/logo.png`,
      jsonLd: listingJsonLd({
        name: copy.h1,
        description,
        canonical: `${SITE_URL}${pathname}`,
        crumbs: exploreDetailBreadcrumbs("life-stage", copy.name),
      }),
    };
  }

  const pageMeta = pages[pathname];
  if (!pageMeta) return null;

  const jsonLd = staticPathJsonLd(pathname, pageMeta.description);
  return {
    title: pageMeta.title,
    description: pageMeta.description,
    robots: noindexFor(pathname),
    canonical: `${SITE_URL}${pathname}`,
    ogType: "website",
    ogImage: `${SITE_URL}/logo.png`,
    ...(jsonLd ? { jsonLd } : {}),
  };
}
