import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import type { ExploreHubSummary } from "@shared/explore-hubs";
import { Heart, ArrowRight, Loader2 } from "lucide-react";
import { Helmet } from "react-helmet";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import SiteHeader from "@/components/layout/SiteHeader";
import Footer from "@/components/layout/Footer";

/**
 * /explore-by-condition — links exactly the condition hubs the crawler index
 * links (GET /api/explore/condition/hubs = seo-body-renderer
 * getConditionHubSummaries: health_conditions rows with studies, most-studied
 * first). It used to link /api/consumer-categories names ("Heart Disease &
 * Hypertension" → /explore-by-condition/heart-disease-hypertension), none of
 * which is a hub: crawlers got a 404 there, and browsers now do too.
 */
const ExploreByCondition = () => {
  const { data, isLoading, isError } = useQuery<{ hubs: ExploreHubSummary[] }>({
    queryKey: ["/api/explore/condition/hubs"],
  });
  const conditions = data?.hubs ?? [];
  const error = isError;

  // Top conditions (most studied) highlighted; the full list below.
  const topConditions = conditions.slice(0, 6);

  return (
    <>
      <SiteHeader />
      <div className="container mx-auto px-4 py-8">
        <Helmet>
          <title>Explore by Health Condition | HydrogenStudies.com</title>
          <meta
            name="description"
            content="Browse hydrogen therapy research studies by health condition. Find the latest research on how molecular hydrogen may benefit specific health conditions and diseases."
          />
          <meta property="og:title" content="Explore by Health Condition" />
          <meta
            property="og:description"
            content="Browse hydrogen therapy research studies organized by health condition."
          />
          <meta property="og:type" content="website" />
          <meta property="og:url" content="https://hydrogenstudies.com/explore-by-condition" />
          <link rel="canonical" href="https://hydrogenstudies.com/explore-by-condition" />
        </Helmet>

        <div className="text-center mb-12">
          <h1 className="text-3xl font-bold text-primary mb-4 flex items-center justify-center">
            <Heart className="h-8 w-8 mr-3 text-red-500" />
            Explore Hydrogen Research by Health Condition
          </h1>
          <p className="text-neutral-600 max-w-2xl mx-auto">
            Browse our collection of hydrogen therapy research studies organized
            by health condition. Discover how molecular hydrogen may benefit
            specific health conditions through its antioxidant,
            anti-inflammatory, and cell-signaling properties.
          </p>
        </div>

        {isLoading ? (
          // min-h-screen keeps the footer below the fold until the list
          // arrives, so it doesn't jump when it renders (CLS).
          <div className="flex justify-center items-start py-16 min-h-screen">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="ml-2 text-neutral-700">
              Loading health conditions...
            </span>
          </div>
        ) : error ? (
          <div className="text-center py-16">
            <p className="text-red-500">
              Error loading health conditions. Please try again.
            </p>
          </div>
        ) : (
          <>
            {/* Highlighted top health conditions */}
            <h2 className="text-2xl font-bold text-neutral-800 mb-6">
              Top Health Conditions
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
              {topConditions.map((condition) => {
                return (
                <Card
                  key={condition.slug}
                  className="shadow-md hover:shadow-lg transition-shadow duration-200"
                >
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xl font-bold text-primary">
                      {condition.name}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-neutral-600">
                      Explore {condition.studyCount}{" "}
                      {condition.studyCount === 1 ? "study" : "studies"} on how
                      hydrogen therapy may benefit{" "}
                      {condition.name.toLowerCase()} conditions.
                    </p>
                  </CardContent>
                  <CardFooter>
                    <Link href={condition.path}>
                      <Button className="w-full">
                        Search Studies
                        <ArrowRight className="h-4 w-4 ml-2" />
                      </Button>
                    </Link>
                  </CardFooter>
                </Card>
                );
              })}
            </div>

            {/* All health conditions */}
            <h2 className="text-2xl font-bold text-neutral-800 mb-6">
              All Health Conditions
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {conditions.map((condition) => {
                return (
                <Link
                  key={condition.slug}
                  href={condition.path}
                  className="block"
                >
                  <div className="bg-white p-4 rounded-lg border border-neutral-200 hover:border-primary hover:bg-primary/5 transition-colors duration-200">
                    <div className="flex justify-between items-center">
                      <h3 className="font-medium text-neutral-800">
                        {condition.name}
                      </h3>
                      <span className="bg-primary/10 text-primary text-xs font-medium px-2 py-1 rounded-full">
                        {condition.studyCount}
                      </span>
                    </div>
                  </div>
                </Link>
                );
              })}
            </div>

          </>
        )}
      </div>
      <Footer />
    </>
  );
};

export default ExploreByCondition;
