import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Helmet } from "react-helmet";
import { exploreDetailCopy, exploreDetailMeta } from "@shared/explore-hubs";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import SiteHeader from "@/components/layout/SiteHeader";
import Footer from "@/components/layout/Footer";
import PageBreadcrumb from "@/components/seo/PageBreadcrumb";
import NotFound from "@/pages/not-found";
import { ApiError } from "@/lib/queryClient";

const SITE_URL = "https://hydrogenstudies.com";

/** Row of GET /api/explore/:type/:slug/studies (seo-body-renderer ExploreDetailStudy). */
export interface ExploreHubStudy {
  slug: string;
  title: string;
  publish_year: number | null;
  journal: string | null;
}

interface ExploreHubDetailProps {
  type: "delivery-method" | "demographic" | "benefit";
  /** Route param; lowercased here, as the studies API and canonical expect. */
  slug: string;
  /** Breadcrumb parent — the same label/link the crawler breadcrumb uses. */
  parent: { label: string; href: string };
  icon?: React.ReactNode;
}

/**
 * /explore-by-{demographic,delivery-method,benefit}/:slug as a browser renders it.
 *
 * These pages used to read taxonomy tables (/api/demographics/:slug,
 * /api/delivery-methods/:slug — both empty in production; the demographic
 * page even matched the unmounted route /demographics/:slug), so browsers got
 * an empty H1, no canonical and "No studies found" while crawlers got the full
 * hub. Title, H1, intro, canonical and the study list now come from the same
 * helpers/query as the crawler renderer (shared/explore-hubs.ts +
 * GET /api/explore/:type/:slug/studies), like the mechanism hubs (#74).
 *
 * A slug that isn't a hub (the studies API answers 404 — the same predicate
 * that makes the server send this shell with HTTP 404 and crawlers a hard 404)
 * renders the site's NotFound page (noindex), never an empty hub.
 */
export default function ExploreHubDetail({ type, slug: rawSlug, parent, icon }: ExploreHubDetailProps) {
  const slug = rawSlug.toLowerCase();
  const { name, h1, intro } = exploreDetailCopy(slug);
  const meta = exploreDetailMeta(type, slug);
  const canonicalUrl = `${SITE_URL}${meta.path}`;

  const { data, isLoading, isError, error } = useQuery<{ studies: ExploreHubStudy[] }>({
    queryKey: [`/api/explore/${type}/${slug}/studies`],
    enabled: !!slug,
    retry: retryUnlessNotFound,
  });
  const studies = data?.studies ?? [];

  if (!slug || isNotFoundError(error)) return <NotFound />;

  return (
    <>
      <SiteHeader />
      <Helmet>
        <title>{meta.title}</title>
        <meta name="description" content={meta.description} />
        <meta property="og:title" content={meta.title} />
        <meta property="og:description" content={meta.description} />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={canonicalUrl} />
        <link rel="canonical" href={canonicalUrl} />
      </Helmet>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        <PageBreadcrumb items={[
          { label: "Home", href: "/" },
          parent,
          { label: name },
        ]} />
      </div>
      <div className="container mx-auto px-4 py-10">
        <div className="mb-8 flex items-center space-x-4">
          {icon ? <div className="bg-primary/10 p-3 rounded-md">{icon}</div> : null}
          <div>
            <h1 className="text-3xl font-bold">{h1}</h1>
            <p className="text-muted-foreground">{intro}</p>
          </div>
        </div>

        {isLoading ? (
          // min-h-screen keeps the footer below the fold until the list
          // arrives (CLS).
          <div className="space-y-4 min-h-screen" aria-busy="true">
            <Skeleton className="h-8 w-64" />
            {Array(6)
              .fill(0)
              .map((_, i) => (
                <Skeleton key={i} className="h-16" />
              ))}
          </div>
        ) : isError ? (
          <p className="text-red-600">Error loading studies. Please try again.</p>
        ) : studies.length > 0 ? (
          <section>
            <h2 className="text-2xl font-semibold mb-4">Research Studies</h2>
            <ul className="space-y-3">
              {studies.map((study) => (
                <li key={study.slug}>
                  <Card className="hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <Link href={`/study/${study.slug}`} className="font-medium text-primary hover:underline">
                        {study.title}
                      </Link>
                      {study.publish_year ? (
                        <span className="text-muted-foreground"> ({study.publish_year})</span>
                      ) : null}
                    </CardContent>
                  </Card>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
      <Footer />
    </>
  );
}

/** True for the 404 an explore API answers when the hub doesn't exist. */
export function isNotFoundError(error: unknown): boolean {
  return error instanceof ApiError && error.status === 404;
}

/**
 * react-query `retry`: a 404 is an answer (the hub doesn't exist → NotFound
 * right away); anything else gets the app's usual single retry.
 */
export function retryUnlessNotFound(failureCount: number, error: unknown): boolean {
  return !isNotFoundError(error) && failureCount < 1;
}
