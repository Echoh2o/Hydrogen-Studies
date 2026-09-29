import { useQuery } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { Heart, Calendar, Book, ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Helmet } from "react-helmet";
import SiteHeader from "@/components/layout/SiteHeader";
import Footer from "@/components/layout/Footer";
import { excerptAtWord } from "@shared/seo-markup";
import { retryUnlessNotFound } from "@/components/explore/ExploreHubDetail";

/** Row of GET /api/explore/condition/:slug/studies (seo-body-renderer ConditionHubStudy). */
interface Study {
  slug: string;
  title: string;
  publish_year: number | null;
  journal: string | null;
  study_type: string | null;
  /** ≤300-char abstract excerpt, "" when there is no real abstract. */
  excerpt: string;
}

interface ConditionHubStudies {
  hub: { slug: string; name: string; description: string | null };
  studies: Study[];
}

const ConditionCategoryPage = () => {
  const params = useParams();
  const paramValue = (params as any).category || (params as any).name || "";
  const decodedName = paramValue ? decodeURIComponent(paramValue) : "";

  // Map URL slugs to exact database category names
  const categoryMap: Record<string, string> = {
    "general-wellness": "General Wellness",
    "brain-mental-health": "Brain & Mental Health",
    "brain-neurological-disorders": "Brain & Neurological Disorders",
    "heart-disease-hypertension": "Heart Disease & Hypertension",
    "lung-respiratory-conditions": "Lung & Respiratory Conditions",
    "digestive-health-gut-liver": "Digestive Health (Gut/Liver)",
    "diabetes-metabolic-health": "Diabetes & Metabolic Health",
    "cancer-supportive-care": "Cancer Supportive Care",
    "arthritis-inflammation": "Arthritis & Inflammation",
    "energy-metabolism": "Energy & Metabolism",
    "breathing-lungs": "Breathing & Lungs",
    "heart-health": "Heart Health",
    "skin-health": "Skin Health",
    "digestive-health": "Digestive Health",
    "cancer-support": "Cancer Support",
    "kidney-health": "Kidney Health",
    "liver-health": "Liver Health",
    "athletic-performance": "Athletic Performance",
    "anti-aging": "Anti-Aging",
    "inflammation-support": "Inflammation Support",
  };

  // If not in the map, convert slug back to Title Case (e.g., "allergic-rhinitis" → "Allergic Rhinitis")
  const slugToTitle = (slug: string) =>
    slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  const exactCategoryName = categoryMap[decodedName] || slugToTitle(decodedName);

  // The ONE condition-hub study query the crawler page lists too
  // (seo-body-renderer getConditionHubStudies: name tag OR hub synonyms), so
  // browsers and bots list the same studies in the same order. This page used
  // to read /api/consumer-categories/studies (different matching: 50 studies
  // on kidney-health where the crawler listed 0). Unknown hubs 404 there and
  // App's ExploreHubGate renders NotFound.
  const hubSlug = decodedName.toLowerCase();
  const { data, isLoading, isError } = useQuery<ConditionHubStudies>({
    queryKey: [`/api/explore/condition/${encodeURIComponent(hubSlug)}/studies`],
    enabled: !!hubSlug,
    retry: retryUnlessNotFound,
  });
  const studies = data?.studies ?? [];
  const error = isError;
  // The hub's own name ("Anxiety & Stress") once loaded — same as the crawler H1.
  const displayName = data?.hub.name ?? exactCategoryName;

  // Short abstract excerpt; "" when there is no real abstract (no
  // "No abstract available" placeholder — CLAUDE.md).
  const truncateText = (text: string, maxLength: number = 200) =>
    excerptAtWord(text, maxLength);

  return (
    <>
      <SiteHeader />
      <div className="container mx-auto px-4 py-8">
        <Helmet>
          <title>{`Hydrogen Therapy for ${displayName} | Research on Health Benefits & Treatment`}</title>
          <meta
            name="description"
            content={`Evidence-based research on hydrogen therapy for ${displayName.toLowerCase()}. Discover how molecular hydrogen may help treat and prevent ${displayName.toLowerCase()} conditions with scientific studies.`}
          />
          <meta
            name="keywords"
            content={`hydrogen therapy, ${displayName.toLowerCase()}, molecular hydrogen, h2 treatment, hydrogen water, ${displayName.toLowerCase()} treatment`}
          />
          <link
            rel="canonical"
            href={`https://hydrogenstudies.com/explore-by-condition/${encodeURIComponent(decodedName)}`}
          />

          {/* Open Graph Tags */}
          <meta
            property="og:title"
            content={`Hydrogen Therapy Research for ${displayName} | Scientific Evidence`}
          />
          <meta
            property="og:description"
            content={`Discover the latest research on using hydrogen therapy to treat ${displayName.toLowerCase()} conditions. Evidence-based studies on molecular hydrogen benefits.`}
          />
          <meta property="og:type" content="website" />
          <meta
            property="og:url"
            content={`https://hydrogenstudies.com/explore-by-condition/${encodeURIComponent(decodedName)}`}
          />
          <meta property="og:image" content="/og-category-image.jpg" />

          {/* Twitter Card Tags */}
          <meta
            name="twitter:title"
            content={`Hydrogen Therapy for ${displayName} | Research Database`}
          />
          <meta
            name="twitter:description"
            content={`Scientific studies on hydrogen therapy benefits for ${displayName.toLowerCase()}. Evidence-based research database.`}
          />

          {/* Schema.org structured data */}
          <script type="application/ld+json">
            {JSON.stringify({
              "@context": "https://schema.org",
              "@type": "CollectionPage",
              headline: `Hydrogen Therapy Research for ${displayName}`,
              description: `Scientific studies on how hydrogen therapy may benefit and treat ${displayName.toLowerCase()} conditions. Evidence-based research database.`,
              keywords: `hydrogen therapy, ${displayName.toLowerCase()}, molecular hydrogen, h2 treatment`,
              url: `https://hydrogenstudies.com/explore-by-condition/${encodeURIComponent(decodedName)}`,
              mainEntity: {
                "@type": "ItemList",
                itemListElement: studies.map((study, index) => ({
                  "@type": "ListItem",
                  position: index + 1,
                  url: `https://hydrogenstudies.com/study/${study.slug}`,
                  name: study.title,
                })),
              },
              about: {
                "@type": "MedicalCondition",
                name: displayName,
              },
            })}
          </script>
        </Helmet>

        <div className="mb-8">
          <Link href="/explore-by-condition">
            <Button
              variant="ghost"
              className="px-0 text-primary hover:text-primary/80 hover:bg-transparent"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to All Health Conditions
            </Button>
          </Link>
        </div>

        <div className="text-center mb-12">
          <h1 className="text-3xl font-bold text-primary mb-4 flex items-center justify-center">
            <Heart className="h-8 w-8 mr-3 text-red-500" />
            Hydrogen Studies for {displayName}
          </h1>
          <p className="text-neutral-600 max-w-2xl mx-auto">
            Explore scientific research investigating the effects of hydrogen
            therapy on {displayName.toLowerCase()}
            conditions. Learn about methodologies, results, and key findings.
          </p>
        </div>

        {isLoading ? (
          // min-h-screen: keeps the footer below the fold until the results
          // arrive, so it doesn't jump down when they render (CLS).
          <div className="flex justify-center items-start py-16 min-h-screen">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="ml-2 text-neutral-700">Loading studies...</span>
          </div>
        ) : error ? (
          <div className="text-center py-16">
            <p className="text-red-500">
              Error loading studies. Please try again.
            </p>
          </div>
        ) : (
          <>
            {studies.length > 0 ? (
              <>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {studies.map((study) => (
                    <Card
                      key={study.slug}
                      className="overflow-hidden hover:shadow-md transition-shadow duration-200"
                    >
                      <CardHeader className="pb-2">
                        <CardTitle className="text-xl">{study.title}</CardTitle>
                        {study.publish_year || study.journal ? (
                          <div className="flex items-center text-sm text-neutral-500 mt-2">
                            {study.publish_year ? (
                              <>
                                <Calendar className="h-4 w-4 mr-1" />
                                <span>{study.publish_year}</span>
                              </>
                            ) : null}
                            {study.publish_year && study.journal ? <span className="mx-2">•</span> : null}
                            {study.journal ? (
                              <>
                                <Book className="h-4 w-4 mr-1" />
                                <span>{study.journal}</span>
                              </>
                            ) : null}
                          </div>
                        ) : null}
                      </CardHeader>
                      {truncateText(study.excerpt) && (
                        <CardContent>
                          <p className="text-neutral-700">
                            {truncateText(study.excerpt)}
                          </p>
                        </CardContent>
                      )}
                      <CardFooter>
                        <Link href={`/study/${study.slug}`}>
                          <Button>View Full Study</Button>
                        </Link>
                      </CardFooter>
                    </Card>
                  ))}
                </div>
                <div className="mt-8 text-center">
                  <Link href={`/search?q=${encodeURIComponent(displayName)}`}>
                    <Button size="lg" className="rounded-full px-8">
                      See All Hydrogen Research for {displayName}
                    </Button>
                  </Link>
                </div>
              </>
            ) : (
              <div className="text-center py-16 bg-neutral-50 rounded-lg border border-neutral-200">
                <Heart className="h-12 w-12 text-neutral-300 mx-auto mb-4" />
                <h2 className="text-xl font-semibold text-neutral-700 mb-2">
                  No Studies Found
                </h2>
                <p className="text-neutral-600 max-w-md mx-auto mb-6">
                  We don't have any studies specifically categorized for {displayName} yet.
                  Try searching our full database for related research.
                </p>
                <Link href={`/search?q=${encodeURIComponent(displayName)}`}>
                  <Button size="lg" className="rounded-full px-8">
                    Search All Studies for {displayName}
                  </Button>
                </Link>
              </div>
            )}
          </>
        )}
      </div>
      <Footer />
    </>
  );
};

export default ConditionCategoryPage;
