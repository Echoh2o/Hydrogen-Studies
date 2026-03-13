import { useState, useEffect } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  Baby,
  User,
  CalendarClock,
  Users,
  Ruler,
  ArrowRight,
  Loader2,
  School,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Helmet } from "react-helmet";
import SiteHeader from "@/components/layout/SiteHeader";
import Footer from "@/components/layout/Footer";

interface LifeStageCategory {
  name: string;
  count: number;
  description?: string;
  icon?: React.ReactNode;
}

interface ApiResponse {
  success: boolean;
  data?: {
    life_stage: Array<{
      name: string;
      count: number;
    }>;
  };
  error?: string;
}

const ExploreByLifeStage = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [categories, setCategories] = useState<LifeStageCategory[]>([]);
  const [error, setError] = useState<string | null>(null);

  const { data: categoriesData } = useQuery<ApiResponse>({
    queryKey: ["/api/consumer-categories/counts"],
  });

  useEffect(() => {
    if (
      categoriesData &&
      categoriesData.success &&
      categoriesData.data &&
      categoriesData.data.life_stage
    ) {
      // Map icons to each category
      const mappedCategories = categoriesData.data.life_stage.map(
        (cat: LifeStageCategory) => {
          let icon;

          switch (cat.name) {
            case "Infants & Newborns":
              icon = <Baby className="h-12 w-12 text-teal-400" />;
              break;
            case "Children & Adolescents":
              icon = <School className="h-12 w-12 text-green-500" />;
              break;
            case "Adults":
              icon = <User className="h-12 w-12 text-purple-500" />;
              break;
            case "Older Adults":
              icon = <CalendarClock className="h-12 w-12 text-amber-600" />;
              break;
            case "Pregnant Women":
              icon = <Users className="h-12 w-12 text-pink-500" />;
              break;
            case "Athletes":
              icon = <Ruler className="h-12 w-12 text-teal-600" />;
              break;
            default:
              icon = <User className="h-12 w-12 text-teal-500" />;
          }

          return {
            ...cat,
            icon,
            description: getLifeStageDescription(cat.name),
          };
        },
      );

      setCategories(mappedCategories);
      setIsLoading(false);
    } else if (categoriesData?.error) {
      setError("Failed to load life stage categories");
      setIsLoading(false);
    }
  }, [categoriesData]);

  // Add descriptions for each life stage category
  const getLifeStageDescription = (name: string): string => {
    const descriptions: { [key: string]: string } = {
      "Infants & Newborns":
        "Research on how hydrogen therapy may affect the health and development of babies in their first months of life.",
      "Children & Adolescents":
        "Studies investigating hydrogen's potential benefits for growth, development, and pediatric health conditions.",
      Adults:
        "Research examining hydrogen therapy for general wellness and specific health concerns in the adult population.",
      "Older Adults":
        "Studies focused on hydrogen's effects on age-related conditions, cognitive health, and overall wellness in seniors.",
      "Pregnant Women":
        "Research on the safety and potential benefits of hydrogen therapy during pregnancy and for maternal health.",
      Athletes:
        "Studies investigating how hydrogen supplementation may affect athletic performance, recovery, and sports-related health.",
      "People with Chronic Conditions":
        "Research focused on how hydrogen therapy may benefit those with long-term health conditions.",
    };

    return (
      descriptions[name] ||
      "Scientific research exploring how molecular hydrogen therapy affects individuals in this life stage."
    );
  };

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
      <Helmet>
        <title>
          Explore Hydrogen Studies by Life Stage | HydrogenStudies.com
        </title>
        <meta
          name="description"
          content="Browse hydrogen research organized by different life stages and demographics. Find studies about how hydrogen therapy affects infants, children, adults, seniors, pregnant women, and athletes."
        />
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
            {categories.map((category) => (
              <Card
                key={category.name}
                className="overflow-hidden hover:shadow-md transition-shadow duration-200"
              >
                <div className="flex justify-center pt-8">{category.icon}</div>
                <CardContent className="pt-6 text-center">
                  <h2 className="text-xl font-bold mb-2">{category.name}</h2>
                  <p className="text-neutral-600 text-sm mb-4">
                    {category.description}
                  </p>
                  <div className="flex items-center justify-center">
                    <span className="text-sm bg-primary/10 text-primary px-3 py-1 rounded-full">
                      {category.count}{" "}
                      {category.count === 1 ? "study" : "studies"}
                    </span>
                  </div>
                </CardContent>
                <CardFooter className="flex justify-center pb-6">
                  <Link
                    href={`/search?q=${encodeURIComponent(category.name)}`}
                  >
                    <Button className="mt-2">
                      Browse Studies <ArrowRight className="h-4 w-4 ml-2" />
                    </Button>
                  </Link>
                </CardFooter>
              </Card>
            ))}
          </div>
        )}

        <div className="mt-16 bg-neutral-50 rounded-lg p-6 max-w-4xl mx-auto">
          <h2 className="text-xl font-bold mb-4">
            About Life Stage Categorization
          </h2>
          <p className="text-neutral-600 mb-4">
            Our life stage categorization organizes hydrogen research based on
            how it affects people at different stages of life and in specific
            demographic groups. This approach recognizes that molecular hydrogen
            may have varying effects depending on age, development stage, and
            other demographic factors.
          </p>
          <p className="text-neutral-600">
            Understanding these differences is crucial for healthcare providers
            and individuals looking to make informed decisions about hydrogen
            therapy for themselves or their loved ones in specific life stages.
          </p>
        </div>
      </div>
      <Footer />
    </>
  );
};

export default ExploreByLifeStage;
