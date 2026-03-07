import { useState, useEffect } from "react";
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

interface Study {
  id: number;
  title: string;
  abstract: string;
  publishDate: string;
  journal: string;
  slug?: string;
  doi?: string | null;
  fullText?: string | null;
  methods?: string | null;
  results?: string | null;
  conclusions?: string | null;
  imageUrl?: string | null;
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

  const exactCategoryName = categoryMap[decodedName] || decodedName;
  const displayName = exactCategoryName;

  const [studies, setStudies] = useState<Study[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch studies for this condition category using the consumer categories API
  useEffect(() => {
    const fetchStudies = async () => {
      setIsLoading(true);
      try {
        // Use the consumer categories API with the model and category parameters
        const response = await fetch(
          `/api/consumer-categories/studies?model=condition&category=${encodeURIComponent(displayName)}`,
        );

        if (response.ok) {
          const data = await response.json();
          if (data.success && data.data) {
            setStudies(data.data);
            console.log("Studies for condition:", data.data);
          } else {
            console.warn("No studies found or invalid response format:", data);
            setStudies([]);
          }
        } else {
          console.error(
            "Failed API response:",
            response.status,
            response.statusText,
          );
          setError("Failed to load studies for this condition");
          setStudies([]);
        }
      } catch (err) {
        console.error(`Error fetching studies for ${displayName}:`, err);
        setError("Error loading studies. Please try again.");
        setStudies([]);
      } finally {
        setIsLoading(false);
      }
    };

    if (displayName) {
      fetchStudies();
    }
  }, [displayName]);

  // Format a date string to a readable format
  const formatDate = (dateString: string) => {
    if (!dateString) return "Date unknown";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  // Truncate text if it's too long
  const truncateText = (text: string, maxLength: number = 200) => {
    if (!text) return "No abstract available";
    return text.length > maxLength
      ? `${text.substring(0, maxLength)}...`
      : text;
  };

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
            href={`https://hydrogenstudies.com/condition/${name}`}
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
            content={`https://hydrogenstudies.com/condition/${name}`}
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
              url: `https://hydrogenstudies.com/condition/${name}`,
              mainEntity: {
                "@type": "ItemList",
                itemListElement: studies.map((study, index) => ({
                  "@type": "ListItem",
                  position: index + 1,
                  url: `https://hydrogenstudies.com/study/${study.slug || `id/${study.id}`}`,
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
          <div className="flex justify-center items-center py-16">
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
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {studies.map((study) => (
                  <Card
                    key={study.id}
                    className="overflow-hidden hover:shadow-md transition-shadow duration-200"
                  >
                    <CardHeader className="pb-2">
                      <CardTitle className="text-xl">{study.title}</CardTitle>
                      <div className="flex items-center text-sm text-neutral-500 mt-2">
                        <Calendar className="h-4 w-4 mr-1" />
                        <span>{formatDate(study.publishDate)}</span>
                        {study.journal && (
                          <>
                            <span className="mx-2">•</span>
                            <Book className="h-4 w-4 mr-1" />
                            <span>{study.journal}</span>
                          </>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-neutral-700">
                        {truncateText(study.abstract)}
                      </p>
                    </CardContent>
                    <CardFooter>
                      <Link href={study.slug ? `/study/${study.slug}` : `/study/id/${study.id}`}>
                        <Button>View Full Study</Button>
                      </Link>
                    </CardFooter>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-16 bg-neutral-50 rounded-lg border border-neutral-200">
                <Heart className="h-12 w-12 text-neutral-300 mx-auto mb-4" />
                <h2 className="text-xl font-semibold text-neutral-700 mb-2">
                  No Studies Found
                </h2>
                <p className="text-neutral-600 max-w-md mx-auto">
                  We don't have any studies categorized for {displayName} yet.
                  Check back later as we're continually updating our research
                  database.
                </p>
              </div>
            )}

            <div className="mt-16 p-6 bg-neutral-50 rounded-lg border border-neutral-200">
              <h2 className="text-xl font-semibold text-primary mb-4">
                About {displayName} Studies
              </h2>
              <p className="text-neutral-600 mb-4">
                Research on hydrogen therapy for {displayName.toLowerCase()} is
                an evolving field. Studies explore how molecular hydrogen may
                influence various biological pathways related to{" "}
                {displayName.toLowerCase()}
                conditions through its antioxidant, anti-inflammatory, and
                signaling properties.
              </p>
              <p className="text-neutral-600">
                Our database is regularly updated with new research as it
                becomes available. If you're a researcher in this field, please
                contact us to contribute your work to our database.
              </p>
            </div>
          </>
        )}
      </div>
    </>
  );
};

export default ConditionCategoryPage;
