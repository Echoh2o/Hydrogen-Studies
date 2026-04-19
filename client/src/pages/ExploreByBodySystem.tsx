import { useState, useEffect } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  Heart,
  Brain,
  Microscope,
  Dumbbell,
  Bone,
  ArrowRight,
  Loader2,
  Pill,
  Wind,
  Activity,
  Baby,
  Droplets,
  Sparkles,
} from "lucide-react";
import { ConsumerCategoriesResponse } from "@/types/consumer-categories";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Helmet } from "react-helmet";
import SiteHeader from "@/components/layout/SiteHeader";
import Footer from "@/components/layout/Footer";

interface BodySystemCategory {
  name: string;
  count: number;
  description?: string;
  icon?: React.ReactNode;
}

const ExploreByBodySystem = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [categories, setCategories] = useState<BodySystemCategory[]>([]);
  const [error, setError] = useState<string | null>(null);

  const { data: categoriesData } = useQuery<ConsumerCategoriesResponse>({
    queryKey: ["/api/consumer-categories/counts"],
  });

  useEffect(() => {
    if (
      categoriesData &&
      categoriesData.success &&
      categoriesData.data &&
      categoriesData.data.body_system
    ) {
      // Map icons to each category
      const mappedCategories = categoriesData.data.body_system.map(
        (cat: BodySystemCategory) => {
          let icon;

          switch (cat.name) {
            case "Cardiovascular System":
              icon = <Heart className="h-12 w-12 text-red-500" />;
              break;
            case "Nervous System":
              icon = <Brain className="h-12 w-12 text-teal-500" />;
              break;
            case "Respiratory System":
              icon = <Wind className="h-12 w-12 text-teal-500" />;
              break;
            case "Digestive System":
              icon = <Microscope className="h-12 w-12 text-yellow-600" />;
              break;
            case "Immune System":
              icon = <Pill className="h-12 w-12 text-purple-500" />;
              break;
            case "Musculoskeletal System":
              icon = <Dumbbell className="h-12 w-12 text-gray-600" />;
              break;
            case "Renal System":
              icon = <Droplets className="h-12 w-12 text-blue-500" />;
              break;
            case "Integumentary System":
              icon = <Sparkles className="h-12 w-12 text-pink-500" />;
              break;
            case "Endocrine System":
              icon = <Activity className="h-12 w-12 text-orange-500" />;
              break;
            case "Reproductive System":
              icon = <Baby className="h-12 w-12 text-rose-400" />;
              break;
            case "Hematological System":
              icon = <Heart className="h-12 w-12 text-red-700" />;
              break;
            case "Whole Body":
              icon = <Sparkles className="h-12 w-12 text-indigo-500" />;
              break;
            default:
              icon = <Microscope className="h-12 w-12 text-teal-500" />;
          }

          return {
            ...cat,
            icon,
            description: getBodySystemDescription(cat.name),
          };
        },
      );

      setCategories(mappedCategories);
      setIsLoading(false);
    } else if ((categoriesData as any)?.error) {
      setError("Failed to load body system categories");
      setIsLoading(false);
    }
  }, [categoriesData]);

  // Add descriptions for each body system
  const getBodySystemDescription = (name: string): string => {
    const descriptions: { [key: string]: string } = {
      "Cardiovascular System":
        "Research on how hydrogen therapy affects heart health, blood pressure, circulation, and vascular function.",
      "Nervous System":
        "Studies investigating hydrogen's effects on brain health, cognitive function, and neurological disorders.",
      "Respiratory System":
        "Research examining hydrogen's impact on lung function, respiratory conditions, and breathing disorders.",
      "Digestive System":
        "Studies on hydrogen's effects on gut health, digestive disorders, and the microbiome.",
      "Immune System":
        "Research on how hydrogen therapy influences inflammation, immune response, and autoimmune conditions.",
      "Musculoskeletal System":
        "Research on hydrogen's effects on muscle recovery, strength, bone health, and exercise performance.",
      "Renal System":
        "Studies examining hydrogen's impact on kidney function, nephropathy, and renal protection.",
      "Integumentary System":
        "Research on hydrogen's effects on skin health, wound healing, burns, and dermal conditions.",
      "Endocrine System":
        "Studies investigating how hydrogen affects metabolism, diabetes, insulin sensitivity, and metabolic syndrome.",
      "Reproductive System":
        "Research on hydrogen's effects on fertility, reproductive health, and pregnancy outcomes.",
      "Hematological System":
        "Studies examining hydrogen's impact on blood cells, platelet function, hemoglobin, and coagulation.",
      "Whole Body":
        "Research on systemic effects of hydrogen including aging, oxidative stress, and multi-organ protection.",
    };

    return (
      descriptions[name] ||
      "Scientific research exploring how molecular hydrogen therapy affects this body system."
    );
  };

  if (isLoading) {
    return (
      <>
        <SiteHeader />
        <div className="container mx-auto px-4 py-12 flex flex-col items-center justify-center min-h-[60vh]">
          <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
          <p className="text-neutral-600">Loading body system categories...</p>
        </div>
        <Footer />
      </>
    );
  }

  return (
    <>
      <SiteHeader />
      <Helmet>
        <title>
          Explore Hydrogen Studies by Body System | HydrogenStudies.com
        </title>
        <meta
          name="description"
          content="Browse hydrogen research organized by body systems. Find studies about how hydrogen therapy affects different systems in the body including cardiovascular, nervous, immune, and more."
        />
        <meta property="og:title" content="Explore Hydrogen Studies by Body System" />
        <meta
          property="og:description"
          content="Browse hydrogen research organized by body systems — cardiovascular, nervous, immune, and more."
        />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://hydrogenstudies.com/explore-by-body-system" />
        <link rel="canonical" href="https://hydrogenstudies.com/explore-by-body-system" />
      </Helmet>
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-4xl mx-auto mb-12 text-center">
          <h1 className="text-3xl md:text-4xl font-bold mb-4 text-primary">
            Explore by Body System
          </h1>
          <p className="text-xl text-neutral-600 max-w-2xl mx-auto">
            Discover hydrogen research focused on specific body systems. Click
            on a system to see relevant studies.
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
                    href={`/explore-by-body-system/${category.name.toLowerCase().replace(/\s+/g, "-")}`}
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

      </div>
      <Footer />
    </>
  );
};

export default ExploreByBodySystem;
