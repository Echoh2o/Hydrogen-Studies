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
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Helmet } from "react-helmet";

// Icons for delivery methods
import {
  Droplet,
  Wind,
  Bath,
  Beaker,
  Pill,
  Stethoscope,
  Soup,
} from "lucide-react";
import SiteHeader from "@/components/layout/SiteHeader";
import Footer from "@/components/layout/Footer";
import PageBreadcrumb from "@/components/seo/PageBreadcrumb";
import ExploreHubDetail from "@/components/explore/ExploreHubDetail";
import { echoProductUrl, ECHO_PRODUCTS } from "@shared/echo-products";
import { trackOutboundClick } from "@/lib/analytics";
import { useEchoPageContext } from "@/hooks/use-echo-link";

const getDeliveryMethodIcon = (slug: string, className: string = "") => {
  switch (slug) {
    case "drinking-water":
      return <Droplet className={className} />;
    case "inhalation":
      return <Wind className={className} />;
    case "bathing":
      return <Bath className={className} />;
    case "saline-injection":
      return <Stethoscope className={className} />;
    case "tablets":
      return <Pill className={className} />;
    case "infused-liquids":
      return <Soup className={className} />;
    default:
      return <Droplet className={className} />;
  }
};

/** Group card for the three primary delivery method categories */
const DeliveryMethodGroup: React.FC<{
  title: string;
  description: string;
  icon: React.ReactNode;
  bgClass: string;
  hubs: ExploreHubSummary[];
}> = ({ title, description, icon, bgClass, hubs }) => {
  const totalStudies = hubs.reduce((sum, h) => sum + h.studyCount, 0);

  return (
    <Card className={`overflow-hidden bg-gradient-to-br ${bgClass} border-0`}>
      <CardHeader className="p-6 pb-3">
        <div className="flex items-center gap-3 mb-2">
          {icon}
          <CardTitle className="text-2xl">{title}</CardTitle>
        </div>
        {totalStudies > 0 ? (
          <Badge variant="secondary" className="w-fit">
            {studyCountLabel(totalStudies)}
          </Badge>
        ) : null}
      </CardHeader>
      <CardContent className="p-6 pt-2">
        <p className="text-muted-foreground text-sm mb-4">{description}</p>
        {hubs.length > 0 ? (
          <div className="space-y-2">
            {hubs.map((hub) => (
              <Link key={hub.slug} href={hub.path}>
                <div className="flex items-center justify-between p-2 rounded-md hover:bg-white/60 transition-colors cursor-pointer">
                  <div className="flex items-center gap-2">
                    {getDeliveryMethodIcon(hub.slug, "h-4 w-4")}
                    <span className="text-sm font-medium">{hub.name}</span>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {hub.studyCount}
                  </Badge>
                </div>
              </Link>
            ))}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
};

const SITE_URL = "https://hydrogenstudies.com";
const INDEX_PATH = "/explore-by-delivery-method";

/** Group membership for the index cards; every other hub is an "other" method. */
const WATER_SLUGS = ["drinking-water"];
const INHALATION_SLUGS = ["inhalation"];

/**
 * /explore-by-delivery-method — links exactly the hubs the crawler index
 * links (GET /api/explore/delivery-method/hubs = seo-body-renderer
 * getLiveExploreHubs): the curated DELIVERY_METHOD_HUB_SLUGS whose page lists
 * ≥1 study. It used to read the `delivery_methods` table, which is empty in
 * production, so the groups showed "0 studies" and linked nothing.
 */
const ExploreByDeliveryMethodPage: React.FC = () => {
  // UTM rule: utm_campaign/utm_content = this page's type/slug.
  const flaskPromoUrl = echoProductUrl(ECHO_PRODUCTS.flask, useEchoPageContext());
  const copy = exploreIndexCopy("delivery-method");
  const { data, isLoading } = useQuery<{ hubs: ExploreHubSummary[] }>({
    queryKey: ["/api/explore/delivery-method/hubs"],
  });
  const hubs = data?.hubs ?? [];
  const inGroup = (slugs: string[]) => hubs.filter((h) => slugs.includes(h.slug));
  const otherHubs = hubs.filter(
    (h) => !WATER_SLUGS.includes(h.slug) && !INHALATION_SLUGS.includes(h.slug),
  );

  return (
    <>
      <SiteHeader />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        <PageBreadcrumb items={[
          { label: "Home", href: "/" },
          { label: "Studies", href: "/studies" },
          { label: "By Delivery Method" },
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
            // Reserve the groups' height so the promo/footer don't jump (CLS).
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 min-h-[24rem]" aria-busy="true">
              {Array(3)
                .fill(0)
                .map((_, i) => (
                  <Card key={i} className="overflow-hidden">
                    <CardHeader className="p-6">
                      <Skeleton className="h-8 w-3/4" />
                    </CardHeader>
                    <CardContent className="p-6 pt-2">
                      <Skeleton className="h-32" />
                    </CardContent>
                  </Card>
                ))}
            </div>
          ) : (
            // Three primary delivery method groups; together they hold every
            // hub the crawler index lists.
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <DeliveryMethodGroup
                title="Hydrogen Water"
                description="The most accessible way to consume molecular hydrogen — through hydrogen-enriched drinking water."
                icon={<Droplet className="h-8 w-8 text-blue-600" />}
                bgClass="from-blue-50 to-blue-100"
                hubs={inGroup(WATER_SLUGS)}
              />
              <DeliveryMethodGroup
                title="Hydrogen Inhalation"
                description="Therapeutic hydrogen gas administered through nasal cannula or mask, studied in clinical settings."
                icon={<Wind className="h-8 w-8 text-teal-600" />}
                bgClass="from-teal-50 to-teal-100"
                hubs={inGroup(INHALATION_SLUGS)}
              />
              <DeliveryMethodGroup
                title="Other Methods"
                description="Bathing, saline injection, and tablet forms of hydrogen delivery used in research."
                icon={<Bath className="h-8 w-8 text-purple-600" />}
                bgClass="from-purple-50 to-purple-100"
                hubs={otherHubs}
              />
            </div>
          )}

          {/* Echo Flask promotion */}
          <div className="bg-gradient-to-r from-teal-50 to-teal-100 p-6 rounded-lg mt-12">
            <div className="flex flex-col md:flex-row items-center">
              <div className="mb-4 md:mb-0 md:mr-6">
                <Beaker className="h-16 w-16 text-primary" />
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-semibold mb-2">
                  Echo Flask - The Optimal Hydrogen Delivery System
                </h3>
                <p className="text-muted-foreground mb-4">
                  Echo Flask delivers optimal hydrogen-enriched water backed by
                  scientific research. Learn why our delivery method is
                  preferred by researchers.
                </p>
                <div>
                  <Button asChild>
                    <a
                      href={flaskPromoUrl}
                      target="_blank"
                      rel="noopener"
                      onClick={() =>
                        trackOutboundClick(flaskPromoUrl, "delivery-method-promo")
                      }
                    >
                      Learn More
                    </a>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </>
  );
};

export default ExploreByDeliveryMethodPage;

/**
 * /explore-by-delivery-method/:method — same shared title/H1/canonical and
 * study list as the crawler hub. It used to read /api/delivery-methods/:slug
 * (a table that is empty in production → empty H1, no canonical and "No
 * studies found"), rendered no site header/footer, and showed an Echo Flask
 * sales block on /explore-by-delivery-method/echoh-flask that crawlers never
 * saw (and that is not an Appendix E bridge context).
 */
export const DeliveryMethodDetailPage: React.FC = () => {
  const [, params] = useRoute("/explore-by-delivery-method/:method");
  const slug = (params?.method || "").toLowerCase();
  return (
    <ExploreHubDetail
      type="delivery-method"
      slug={slug}
      parent={{ label: "Delivery Methods", href: INDEX_PATH }}
      icon={getDeliveryMethodIcon(slug, "h-8 w-8 text-primary")}
    />
  );
};
