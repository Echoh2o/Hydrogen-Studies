import type { ReactNode } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  Baby,
  User,
  CalendarClock,
  ArrowRight,
  Loader2,
  Dumbbell,
  Heart,
  Sparkles,
} from "lucide-react";
import { studyCountLabel, type ExploreHubSummary } from "@shared/explore-hubs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Helmet } from "react-helmet";
import SiteHeader from "@/components/layout/SiteHeader";
import Footer from "@/components/layout/Footer";
import PageBreadcrumb from "@/components/seo/PageBreadcrumb";

const LIFE_STAGE_ICONS: Record<string, ReactNode> = {
  pregnancy: <Heart className="h-12 w-12 text-pink-500" />,
  "infants-children": <Baby className="h-12 w-12 text-teal-400" />,
  adults: <User className="h-12 w-12 text-purple-500" />,
  "elderly-aging": <CalendarClock className="h-12 w-12 text-amber-600" />,
  athletes: <Dumbbell className="h-12 w-12 text-teal-600" />,
};

const LIFE_STAGE_DESCRIPTIONS: Record<string, string> = {
  pregnancy:
    "Research on the safety and potential benefits of hydrogen therapy during pregnancy and for maternal health.",
  "infants-children":
    "Studies investigating hydrogen's potential benefits for growth, development, and pediatric health conditions.",
  adults:
    "Research examining hydrogen therapy for general wellness and specific health concerns in the adult population.",
  "elderly-aging":
    "Studies focused on hydrogen's effects on age-related conditions, cognitive health, and overall wellness in seniors.",
  athletes:
    "Studies investigating how hydrogen supplementation may affect athletic performance, recovery, and sports-related health.",
};

/**
 * /explore-by-life-stage — links exactly the hubs the crawler index links
 * (GET /api/explore/life-stage/hubs = seo-body-renderer getLiveExploreHubs:
 * the sitemap life-stage hubs whose page lists ≥1 study). It used to link
 * /api/consumer-categories names (adolescents, older-adults, men's-health,
 * women's-health, …) — none of them a hub, so those URLs are 404s.
 */
const ExploreByLifeStage = () => {
  const { data, isLoading, isError } = useQuery<{ hubs: ExploreHubSummary[] }>({
    queryKey: ["/api/explore/life-stage/hubs"],
  });
  const hubs = data?.hubs ?? [];
  const error = isError ? "Failed to load life stage categories" : null;

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-12 flex flex-col items-center justify-center min-h-[60vh]">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-neutral-600">Loading life stage categories...</p>
      </div>
    );
  }

  return (
    <>
      <SiteHeader />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        <PageBreadcrumb items={[
          { label: "Home", href: "/" },
          { label: "Studies", href: "/studies" },
          { label: "By Life Stage" },
        ]} />
      </div>
      <Helmet>
        <title>
          Explore Hydrogen Studies by Life Stage | HydrogenStudies.com
        </title>
        <meta
          name="description"
          content="Browse hydrogen research organized by different life stages and demographics. Find studies about how hydrogen therapy affects infants, children, adults, seniors, pregnant women, and athletes."
        />
        <meta property="og:title" content="Explore Hydrogen Studies by Life Stage | HydrogenStudies.com" />
        <meta property="og:description" content="Browse hydrogen research organized by different life stages and demographics. Find studies about how hydrogen therapy affects infants, children, adults, seniors, pregnant women, and athletes." />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://hydrogenstudies.com/explore-by-life-stage" />
        <meta name="twitter:card" content="summary" />
        <link rel="canonical" href="https://hydrogenstudies.com/explore-by-life-stage" />
      </Helmet>
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-4xl mx-auto mb-12 text-center">
          <h1 className="text-3xl md:text-4xl font-bold mb-4 text-primary">
            Explore by Life Stage & Demographic
          </h1>
          <p className="text-xl text-neutral-600 max-w-2xl mx-auto">
            Discover hydrogen research focused on specific life stages and
            demographic groups. Click on a category to see relevant studies.
          </p>
        </div>

        {error ? (
          <div className="text-center p-8 bg-red-50 rounded-lg border border-red-200 max-w-md mx-auto">
            <p className="text-red-600">{error}</p>
            <Button className="mt-4" onClick={() => window.location.reload()}>
              Try Again
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {hubs.map((hub) => (
              <Card
                key={hub.slug}
                className="overflow-hidden hover:shadow-md transition-shadow duration-200"
              >
                <div className="flex justify-center pt-8">
                  {LIFE_STAGE_ICONS[hub.slug] ?? <Sparkles className="h-12 w-12 text-teal-500" />}
                </div>
                <CardContent className="pt-6 text-center">
                  <h2 className="text-xl font-bold mb-2">{hub.name}</h2>
                  {LIFE_STAGE_DESCRIPTIONS[hub.slug] ? (
                    <p className="text-neutral-600 text-sm mb-4">{LIFE_STAGE_DESCRIPTIONS[hub.slug]}</p>
                  ) : null}
                  <div className="flex items-center justify-center">
                    <span className="text-sm bg-primary/10 text-primary px-3 py-1 rounded-full">
                      {studyCountLabel(hub.studyCount)}
                    </span>
                  </div>
                </CardContent>
                <CardFooter className="flex justify-center pb-6">
                  <Link href={hub.path}>
                    <Button className="mt-2">
                      Browse Studies <ArrowRight className="h-4 w-4 ml-2" />
                    </Button>
                  </Link>
                </CardFooter>
              </Card>
            ))}
          </div>
        )}

      </div>
      <Footer />
    </>
  );
};

export default ExploreByLifeStage;
