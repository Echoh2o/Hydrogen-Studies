import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import {
  EDITORIAL_TEAM,
  excerptAtWord,
  formatLongDate,
  isoDate,
  normalizeDoi,
  realContent,
  studyDescription,
  studyJsonLd,
  studyPageTitle,
  studyUpdatedAt,
  type StudyLike,
} from "@shared/seo-markup";
import { citationLine, studyBreadcrumbs, studyDetails, studyEvidence, type HubLink } from "@shared/study-page";
import { LAST_CRUMB_MAX, truncateLabel } from "@shared/breadcrumbs";
import { PageDataError, SITE_URL, pageData, type FooterCondition } from "@web/lib/page-data";
import { SiteHeader } from "@web/components/SiteHeader";
import { SiteFooter } from "@web/components/SiteFooter";

/** Studies change rarely: page data is cached for a day; the page itself
 *  renders per request for a fresh CSP nonce. */
const revalidate = 86400;
export const dynamic = "force-dynamic";

interface StudyPageData {
  study: StudyLike & Record<string, any> & {
    id: number;
    slug: string;
    title: string;
    abstractExcerpt: string;
    sourceLink: { href: string; label: string } | null;
  };
  hubLinks: HubLink[];
  authorLinks?: { name: string; href: string | null }[];
  related: { slug: string; title: string; year: number | null }[];
  relatedBlogs: { slug: string; title: string }[];
  footerConditions: FooterCondition[];
}

async function load(slug: string): Promise<StudyPageData> {
  let data: StudyPageData;
  try {
    data = await pageData<StudyPageData>(`/study/${encodeURIComponent(slug)}`, revalidate, [`/study/${slug}`]);
  } catch (err) {
    // 410s are answered by middleware before rendering; 404 here.
    if (err instanceof PageDataError && (err.status === 404 || err.status === 410)) notFound();
    throw err;
  }
  // PLAN 3.3: Express resolved the study by its permanent-ID suffix (or a
  // legacy numeric id / unicode-dash variant), but this URL isn't the slug the
  // page declares canonical — one 301 to it, never two copies of the page.
  if (data.study.slug && slug !== data.study.slug) permanentRedirect(`/study/${data.study.slug}`);
  return data;
}

function absoluteUrl(path: string): string {
  return /^https?:\/\//i.test(path) ? path : `${SITE_URL}${path.startsWith("/") ? "" : "/"}${path}`;
}

/** Fields the shared helpers read the abstract from get the excerpt only. */
function helperInput(study: StudyPageData["study"]) {
  return { ...study, abstract: study.abstractExcerpt };
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const { study } = await load(params.slug);
  const input = helperInput(study);
  const title = studyPageTitle(input);
  const description = excerptAtWord(studyDescription(input, 300), 160);
  const canonical = `${SITE_URL}/study/${study.slug}`;
  const image = absoluteUrl(study.ogImage || study.imageUrl || "/logo.png");
  return {
    title: { absolute: title },
    description,
    alternates: { canonical },
    robots: { index: true, follow: true },
    openGraph: { type: "article", title, description, url: canonical, siteName: "Hydrogen Studies", locale: "en_US", images: [image] },
    twitter: { card: "summary_large_image", title, description, images: [image] },
  };
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="mb-3 text-xl font-semibold text-neutral-900">{title}</h2>
      <div className="leading-relaxed text-neutral-700">{children}</div>
    </section>
  );
}

export default async function StudyPage({ params }: { params: { slug: string } }) {
  const { study, hubLinks, authorLinks, related, relatedBlogs, footerConditions } = await load(params.slug);
  const input = helperInput(study);
  const plainTitle = realContent(study.plainLanguageTitle);
  const pageTitle = plainTitle || study.title;
  // The current-page crumb is truncated once, here, so the visible trail and the
  // BreadcrumbList in studyJsonLd carry the same label (schema = what is shown).
  const crumbs = studyBreadcrumbs(pageTitle, hubLinks).map((c, i, all) =>
    i === all.length - 1 ? { label: truncateLabel(c.label, LAST_CRUMB_MAX) } : c,
  );
  const evidence = studyEvidence({
    studyDesign: study.studyDesign,
    studyType: study.studyType,
    isHumanTrial: study.isHumanTrial,
  });
  const updated = studyUpdatedAt(study);
  const canonical = `${SITE_URL}/study/${study.slug}`;
  const image = study.imageUrl ? `/${String(study.imageUrl).replace(/^\/+/, "")}` : null;
  const ld = studyJsonLd(input, {
    canonical,
    siteUrl: SITE_URL,
    image: absoluteUrl(study.ogImage || study.imageUrl || "/logo.png"),
    breadcrumbs: crumbs,
  });
  const doi = normalizeDoi(study.doi);
  const summary = study.plainSummary || study.summary100Words || study.summary50Words;
  const details: [string, React.ReactNode][] = [];
  if (evidence) details.push(["Evidence type", evidence.label]);
  if (authorLinks?.length) {
    // PLAN 4.7: authors with a profile page link to it.
    details.push([
      "Authors",
      <span key="authors">
        {authorLinks.map((a, i) => (
          <span key={`${a.name}-${i}`}>
            {i > 0 && ", "}
            {a.href ? <a href={a.href} className="text-primary underline">{a.name}</a> : a.name}
          </span>
        ))}
      </span>,
    ]);
  } else if (study.authors) details.push(["Authors", study.authors]);
  if (study.journal) details.push(["Journal", study.journal]);
  if (study.publishYear) details.push(["Year", study.publishYear]);
  if (doi) details.push(["DOI", <a key="doi" href={`https://doi.org/${doi}`} rel="noopener" className="text-primary underline">{doi}</a>]);
  const pmid = String(study.pmid ?? "").match(/^\d{4,}$/)?.[0];
  if (pmid) details.push(["PMID", <a key="pmid" href={`https://pubmed.ncbi.nlm.nih.gov/${pmid}/`} rel="noopener" className="text-primary underline">{pmid}</a>]);
  if (study.studyType) details.push(["Study Type", study.studyType]);
  for (const d of studyDetails(study as Parameters<typeof studyDetails>[0])) details.push([d.label, d.value]);
  if (study.outcome) details.push(["Outcome", study.outcome]);
  if (study.peerReviewed) details.push(["Peer Reviewed", "Yes"]);
  // PLAN 4.4: citation count with its source and freshness (OpenAlex, free).
  const cited = citationLine(study as Parameters<typeof citationLine>[0]);
  if (cited) {
    details.push([
      "Cited by",
      <span key="cited">
        {cited.href ? (
          <a href={cited.href} rel="noopener" className="text-primary underline">{cited.count.toLocaleString("en-US")}</a>
        ) : (
          cited.count.toLocaleString("en-US")
        )}
        <span className="text-neutral-500"> ({cited.sourceLabel}, as of {cited.asOf})</span>
      </span>,
    ]);
  }
  if (study.country) details.push(["Country", study.country]);

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />
      <SiteHeader />
      <main id="main" className="container mx-auto max-w-4xl px-4 py-8">
        <nav aria-label="Breadcrumb" className="mb-6 text-sm text-neutral-500">
          <ol className="flex flex-wrap items-center">
            {crumbs.map((c, i) => (
              <li key={i} className="inline-flex items-center">
                {c.href ? (
                  <>
                    <a href={c.href} className="hover:text-primary">{c.label}</a>
                    <span className="mx-2" aria-hidden="true">/</span>
                  </>
                ) : (
                  <span aria-current="page" className="line-clamp-1 text-neutral-800">{c.label}</span>
                )}
              </li>
            ))}
          </ol>
        </nav>

        <article>
          <h1 className="mb-3 text-3xl font-bold leading-tight text-primary md:text-4xl">{pageTitle}</h1>
          {plainTitle && plainTitle !== study.title && (
            <h2 className="original-title mb-4 text-lg font-medium leading-snug text-neutral-700 md:text-xl">{study.title}</h2>
          )}
          <p className="byline mb-3 text-sm text-neutral-600">
            Summary by <a href="/methodology" className="underline hover:text-primary">{EDITORIAL_TEAM}</a>
            {updated && (
              <>
                {" "}· Updated <time dateTime={isoDate(updated)}>{formatLongDate(updated)}</time>
              </>
            )}
          </p>
          {hubLinks.length > 0 && (
            <p className="topic-hubs mb-3 text-sm text-neutral-600">
              Research hubs:{" "}
              {hubLinks.map((l, i) => (
                <span key={l.href}>
                  {i > 0 && " · "}
                  <a href={l.href} className="underline hover:text-primary">{l.label}</a>
                </span>
              ))}
            </p>
          )}
          {evidence?.note && (
            <p className="evidence-note mb-6 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              {evidence.note}
            </p>
          )}

          {image && (
            <figure className="mb-8 overflow-hidden rounded-lg shadow-md">
              {/* eslint-disable-next-line @next/next/no-img-element -- /uploads is served (and WebP-negotiated) by Express */}
              <img
                src={image}
                alt={study.imageAlt || `Scientific visualization for ${study.title}`}
                width={1280}
                height={720}
                className="h-auto w-full object-cover"
                fetchPriority="high"
              />
            </figure>
          )}

          {details.length > 0 && (
            <dl className="mb-8 grid grid-cols-1 gap-x-6 gap-y-2 rounded-lg border border-neutral-200 p-4 text-sm sm:grid-cols-[max-content_1fr]">
              {details.map(([k, v]) => (
                <div key={k} className="contents">
                  <dt className="font-medium text-neutral-500">{k}</dt>
                  <dd className="text-neutral-800">{v}</dd>
                </div>
              ))}
            </dl>
          )}

          {study.tldr && <Section title="TL;DR"><p>{study.tldr}</p></Section>}
          {study.keyFinding && <Section title="Key Finding"><p>{study.keyFinding}</p></Section>}
          {summary && <Section title="Summary"><p>{summary}</p></Section>}
          {study.practicalTakeaway && <Section title="Practical Takeaway"><p>{study.practicalTakeaway}</p></Section>}
          {study.howToApply && <Section title="How to Apply This Research"><p>{study.howToApply}</p></Section>}
          {(study.abstractExcerpt || study.sourceLink) && (
            <Section title="Abstract (excerpt)">
              {study.abstractExcerpt && <p>{study.abstractExcerpt}</p>}
              {study.sourceLink && (
                <p className="mt-2">
                  <a href={study.sourceLink.href} rel="noopener" className="text-primary underline">{study.sourceLink.label}</a>
                </p>
              )}
            </Section>
          )}
        </article>

        {related.length > 0 && (
          <nav aria-label="Related Studies" className="mt-12">
            <h2 className="mb-3 text-xl font-semibold">Related Studies</h2>
            <ul className="space-y-2">
              {related.map((r) => (
                <li key={r.slug}>
                  <a href={`/study/${r.slug}`} className="text-primary hover:underline">{r.title}</a>
                  {r.year ? <span className="text-neutral-500"> ({r.year})</span> : null}
                </li>
              ))}
            </ul>
          </nav>
        )}
        {relatedBlogs.length > 0 && (
          <nav aria-label="Related Articles" className="mt-8">
            <h2 className="mb-3 text-xl font-semibold">Related Articles</h2>
            <ul className="space-y-2">
              {relatedBlogs.map((b) => (
                <li key={b.slug}>
                  <a href={`/blog/${b.slug}`} className="text-primary hover:underline">{b.title}</a>
                </li>
              ))}
            </ul>
          </nav>
        )}
      </main>
      <SiteFooter conditions={footerConditions} pageType="study" slug={study.slug} />
    </>
  );
}
