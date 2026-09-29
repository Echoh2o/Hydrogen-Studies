import {
  exploreDetailCopy,
  mechanismHubMeta,
  studyCountLabel,
  type ExploreHubSummary,
} from "@shared/explore-hubs";
import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useRoute } from "wouter";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Helmet } from "react-helmet";
import SiteHeader from "@/components/layout/SiteHeader";
import Footer from "@/components/layout/Footer";
import PageBreadcrumb from "@/components/seo/PageBreadcrumb";
import NotFound from "@/pages/not-found";
import { isNotFoundError, retryUnlessNotFound } from "@/components/explore/ExploreHubDetail";

// Icons for mechanisms
import { Zap, HeartPulse, Shield, Droplets } from "lucide-react";

const getMechanismIcon = (slug: string, className: string = "") => {
  switch (slug) {
    case "hydrogen-water":
    case "hydrogen-bath":
      return <Droplets className={className} />;
    case "hydrogen-inhalation":
    case "hydrogen-gas":
      return <Zap className={className} />;
    case "hydrogen-rich-saline":
      return <HeartPulse className={className} />;
    default:
      return <Shield className={className} />;
  }
};

/**
 * /explore-by-mechanism — links exactly the hubs the crawler index links
 * (GET /api/explore/mechanism/hubs = seo-body-renderer getLiveExploreHubs):
 * the sitemap mechanism hubs whose page lists ≥1 study. It used to link rows
 * of the `mechanisms` table (empty in production), whose slugs aren't hubs —
 * those URLs are 404s.
 */
const ExploreByMechanismPage: React.FC = () => {
  const { data, isLoading: mechanismsLoading } = useQuery<{ hubs: ExploreHubSummary[] }>({
    queryKey: ["/api/explore/mechanism/hubs"],
  });
  const hubs = data?.hubs ?? [];

  return (
    <>
      <SiteHeader />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        <PageBreadcrumb items={[
          { label: "Home", href: "/" },
          { label: "Studies", href: "/studies" },
          { label: "By Mechanism" },
        ]} />
      </div>
      <div className="container mx-auto py-10">
        <Helmet>
          <title>
            Explore Hydrogen Studies by Mechanism | HydrogenStudies.com
          </title>
          <meta
            name="description"
            content="Discover hydrogen research organized by biological mechanisms including antioxidant effects, gene expression, mitochondrial function, and more."
          />
          <meta property="og:title" content="Explore Hydrogen Studies by Mechanism | HydrogenStudies.com" />
          <meta property="og:description" content="Discover hydrogen research organized by biological mechanisms including antioxidant effects, gene expression, mitochondrial function, and more." />
          <meta property="og:type" content="website" />
          <meta property="og:url" content="https://hydrogenstudies.com/explore-by-mechanism" />
          <meta name="twitter:card" content="summary" />
          <link rel="canonical" href="https://hydrogenstudies.com/explore-by-mechanism" />
        </Helmet>

        <div className="space-y-8">
          <div className="text-center space-y-2">
            <h1 className="text-4xl font-bold tracking-tight">
              Explore by Mechanism
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Find hydrogen research studies organized by their biological
              mechanisms of action
            </p>
          </div>

          {mechanismsLoading ? (
            // Reserve the grid's height so the footer doesn't jump (CLS).
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 min-h-[50vh]" aria-busy="true">
              {Array(8)
                .fill(0)
                .map((_, i) => (
                  <Card key={i} className="overflow-hidden">
                    <CardHeader className="p-4 pb-2">
                      <Skeleton className="h-6 w-3/4" />
                    </CardHeader>
                    <CardContent className="p-4 pt-2">
                      <Skeleton className="h-20" />
                    </CardContent>
                  </Card>
                ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {hubs.map((hub) => (
                <Link key={hub.slug} href={hub.path}>
                  <Card className="overflow-hidden cursor-pointer hover:shadow-md transition-shadow">
                    <CardHeader className="p-4 pb-2 flex flex-row items-start space-x-4">
                      <div className="bg-primary/10 p-2 rounded-md">
                        {getMechanismIcon(hub.slug, "h-6 w-6 text-primary")}
                      </div>
                      <div>
                        <CardTitle className="text-xl">{hub.name}</CardTitle>
                        <Badge variant="outline" className="mt-1">
                          {studyCountLabel(hub.studyCount)}
                        </Badge>
                      </div>
                    </CardHeader>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
      <Footer />
    </>
  );
};

export default ExploreByMechanismPage;

const SITE_URL = "https://hydrogenstudies.com";

interface ExploreHubStudy {
  slug: string;
  title: string;
  publish_year: number | null;
  journal: string | null;
}

/**
 * /explore-by-mechanism/:mechanism — the six sitemap hubs (hydrogen-water,
 * hydrogen-inhalation, …) are delivery modes, not rows of the `mechanisms`
 * table. This page used to read useRoute("/mechanisms/:slug") (never
 * matched: App mounts it at /explore-by-mechanism/:mechanism) and
 * /api/mechanisms/:slug, so browsers got an empty H1, a broken title, no
 * canonical and "No studies found" while crawlers got the full hub
 * (re-audit 2026-09-28). Title, H1, intro, canonical and the study list now
 * come from the same helpers/query as the crawler renderer.
 */
export const MechanismDetailPage: React.FC = () => {
  const [, params] = useRoute("/explore-by-mechanism/:mechanism");
  const slug = (params?.mechanism || "").toLowerCase();
  const { name, h1, intro } = exploreDetailCopy(slug);
  const meta = mechanismHubMeta(slug);
  const canonicalUrl = `${SITE_URL}${meta.path}`;

  const { data, isLoading, isError, error } = useQuery<{ studies: ExploreHubStudy[] }>({
    queryKey: [`/api/explore/mechanism/${slug}/studies`],
    enabled: !!slug,
    retry: retryUnlessNotFound,
  });
  const studies = data?.studies ?? [];

  // Not one of the mechanism hubs: the studies API 404s (same predicate as
  // the server's HTTP 404 for this URL) → the site's NotFound page (noindex).
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
          { label: "Mechanisms", href: "/explore-by-mechanism" },
          { label: name },
        ]} />
      </div>
      <div className="container mx-auto px-4 py-10">
        <div className="mb-8 flex items-center space-x-4">
          <div className="bg-primary/10 p-3 rounded-md">
            {getMechanismIcon(slug, "h-8 w-8 text-primary")}
          </div>
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
};
