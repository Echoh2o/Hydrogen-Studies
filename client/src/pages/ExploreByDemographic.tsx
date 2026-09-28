import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useRoute } from "wouter";
import {
  exploreIndexCopy,
  studyCountLabel,
  type ExploreHubSummary,
} from "@shared/explore-hubs";
import {
  Card,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Helmet } from "react-helmet";

// Icons for demographics
import {
  Users,
  Baby,
  Heart,
  MoveRight,
  Award,
} from "lucide-react";
import SiteHeader from "@/components/layout/SiteHeader";
import Footer from "@/components/layout/Footer";
import PageBreadcrumb from "@/components/seo/PageBreadcrumb";
import ExploreHubDetail from "@/components/explore/ExploreHubDetail";

const getDemographicIcon = (slug: string, className: string = "") => {
  switch (slug) {
    case "athletes":
      return <MoveRight className={className} />;
    case "elderly":
    case "older-adults":
      return <Award className={className} />;
    case "children":
      return <Baby className={className} />;
    case "women":
      return <Heart className={className} />;
    default:
      return <Users className={className} />;
  }
};

const SITE_URL = "https://hydrogenstudies.com";
const INDEX_PATH = "/explore-by-demographic";

/**
 * /explore-by-demographic — links exactly the hubs the crawler index links
 * (GET /api/explore/demographic/hubs = seo-body-renderer getLiveExploreHubs):
 * the curated DEMOGRAPHIC_HUB_SLUGS whose page lists ≥1 study. It used to
 * list rows of the `demographics` table (empty in production) and link them
 * to the unrouted /demographics/<slug>.
 */
const ExploreByDemographicPage: React.FC = () => {
  const copy = exploreIndexCopy("demographic");
  const { data, isLoading } = useQuery<{ hubs: ExploreHubSummary[] }>({
    queryKey: ["/api/explore/demographic/hubs"],
  });
  const hubs = data?.hubs ?? [];

  return (
    <>
      <SiteHeader />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        <PageBreadcrumb items={[
          { label: "Home", href: "/" },
          { label: "Studies", href: "/studies" },
          { label: "By Demographic" },
        ]} />
      </div>
      <div className="container mx-auto py-10">
        <Helmet>
          <title>{copy.title}</title>
          <meta name="description" content={copy.description} />
          <meta property="og:title" content={copy.title} />
          <meta property="og:description" content={copy.description} />
          <meta property="og:type" content="website" />
          <meta property="og:url" content={`${SITE_URL}${INDEX_PATH}`} />
          <meta name="twitter:card" content="summary" />
          <link rel="canonical" href={`${SITE_URL}${INDEX_PATH}`} />
        </Helmet>

        <div className="space-y-8">
          <div className="text-center space-y-2">
            <h1 className="text-4xl font-bold tracking-tight">{copy.h1}</h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              {copy.intro}
            </p>
          </div>

          {isLoading ? (
            // Reserve the grid's height so the footer doesn't jump (CLS).
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 min-h-[50vh]" aria-busy="true">
              {Array(6)
                .fill(0)
                .map((_, i) => (
                  <Card key={i} className="overflow-hidden">
                    <CardHeader className="p-4">
                      <Skeleton className="h-6 w-3/4" />
                      <Skeleton className="h-5 w-24 mt-2" />
                    </CardHeader>
                  </Card>
                ))}
            </div>
          ) : hubs.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {hubs.map((hub) => (
                <Link key={hub.slug} href={hub.path}>
                  <Card className="overflow-hidden cursor-pointer hover:shadow-md transition-shadow">
                    <CardHeader className="p-4 flex flex-row items-start space-x-4">
                      <div className="bg-primary/10 p-2 rounded-md">
                        {getDemographicIcon(hub.slug, "h-6 w-6 text-primary")}
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
          ) : null}
        </div>
      </div>
      <Footer />
    </>
  );
};

export default ExploreByDemographicPage;

/**
 * /explore-by-demographic/:demographic — App mounts it at this route (it used
 * to read useRoute("/demographics/:slug"), which never matched, so every
 * demographic hub showed an empty H1 and "No studies found" to browsers).
 */
export const DemographicDetailPage: React.FC = () => {
  const [, params] = useRoute("/explore-by-demographic/:demographic");
  const slug = (params?.demographic || "").toLowerCase();
  return (
    <ExploreHubDetail
      type="demographic"
      slug={slug}
      parent={{ label: "Demographics", href: INDEX_PATH }}
      icon={getDemographicIcon(slug, "h-8 w-8 text-primary")}
    />
  );
};
