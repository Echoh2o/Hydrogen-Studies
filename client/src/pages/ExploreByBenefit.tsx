import { abstractExcerpt } from "@shared/seo-markup";
import {
  exploreIndexCopy,
  studyCountLabel,
  type ExploreHubSummary,
} from "@shared/explore-hubs";
import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import AnchorContent from "@/components/AnchorContent";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link, useRoute } from "wouter";
import { Loader2 } from "lucide-react";
import { Helmet } from "react-helmet";
import SiteHeader from "@/components/layout/SiteHeader";
import Footer from "@/components/layout/Footer";
import PageBreadcrumb from "@/components/seo/PageBreadcrumb";
import { Skeleton } from "@/components/ui/skeleton";
import ExploreHubDetail from "@/components/explore/ExploreHubDetail";

const SITE_URL = "https://hydrogenstudies.com";
const INDEX_PATH = "/explore-by-benefit";

// Condition-focused categories
const conditionCategories = [
  "General Wellness",
  "Brain & Mental Health",
  "Energy & Metabolism",
  "Breathing & Lungs",
  "Heart Health",
  "Skin Health",
  "Digestive Health",
];

// Define icons for each category
const categoryIcons: Record<string, string> = {
  "General Wellness": "🌟",
  "Brain & Mental Health": "🧠",
  "Energy & Metabolism": "⚡",
  "Breathing & Lungs": "🫁",
  "Heart Health": "❤️",
  "Skin Health": "✨",
  "Digestive Health": "🍃",
  "Cancer Support": "🎗️",
  "Kidney Health": "🩺",
  "Liver Health": "🔬",
  "Athletic Performance": "🏃",
  "Anti-Aging": "⏰",
  "Inflammation Support": "🛡️",
};

// TypeScript interfaces for our data structures
interface Study {
  id: number;
  title: string;
  abstract: string;
  category: string;
  publishDate: string;
  journal: string;
  authors: string;
  doi?: string;
  imageUrl?: string;
  slug?: string;
}

interface ConsumerCategory {
  condition: string[];
  bodySystem: string[];
  lifeStage: string[];
}

/**
 * /explore-by-benefit. Title, description, H1, intro and the linked benefit
 * hubs match the crawler index: the hubs come from
 * GET /api/explore/benefit/hubs (= seo-body-renderer getLiveExploreHubs — the
 * curated BENEFIT_HUB_SLUGS whose page lists ≥1 study), so browsers and bots
 * link exactly the same /explore-by-benefit/<slug> URLs with the same counts.
 * The condition / body-system / life-stage tabs below are an in-page browser
 * (cards are buttons, not links).
 */
const ExploreByBenefit: React.FC = () => {
  const copy = exploreIndexCopy("benefit");
  const { data: hubsData, isLoading: hubsLoading } = useQuery<{ hubs: ExploreHubSummary[] }>({
    queryKey: ["/api/explore/benefit/hubs"],
  });
  const hubs = hubsData?.hubs ?? [];
  const [selectedModel, setSelectedModel] = useState<string>("condition");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // Fetch all available consumer categories
  const { data: categoryData, isLoading: categoriesLoading } = useQuery<{
    success: boolean;
    data: {
      condition: string[];
      body_system: string[];
      life_stage: string[];
    };
  }>({
    queryKey: ["/api/consumer-categories/list"],
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  // Fetch category counts
  const { data: countData, isLoading: countsLoading } = useQuery<{
    success: boolean;
    data: {
      condition: { name: string; count: number }[];
      body_system: { name: string; count: number }[];
      life_stage: { name: string; count: number }[];
    };
  }>({
    queryKey: ["/api/consumer-categories/counts"],
    staleTime: 1000 * 60 * 5, // 5 minutes
    // Fallback to empty data if API fails
    placeholderData: {
      success: true,
      data: {
        condition: [
          { name: "Heart Disease & Hypertension", count: 18 },
          { name: "Brain & Neurological Disorders", count: 34 },
          { name: "Diabetes & Metabolic Health", count: 21 },
          { name: "Arthritis & Inflammation", count: 9 },
          { name: "Lung & Respiratory Conditions", count: 19 },
          { name: "Digestive Health (Gut/Liver)", count: 24 },
          { name: "Cancer Supportive Care", count: 10 },
        ],
        body_system: [
          { name: "Cardiovascular System", count: 18 },
          { name: "Nervous System", count: 34 },
          { name: "Respiratory System", count: 19 },
          { name: "Digestive System", count: 24 },
          { name: "Immune System", count: 9 },
          { name: "Musculoskeletal System", count: 9 },
          { name: "Renal System", count: 8 },
          { name: "Integumentary System", count: 17 },
        ],
        life_stage: [
          { name: "Infants & Newborns", count: 5 },
          { name: "Children & Adolescents", count: 8 },
          { name: "Adults", count: 42 },
          { name: "Older Adults", count: 28 },
          { name: "Athletes & Fitness", count: 18 },
        ],
      },
    },
  });

  // Fetch studies for selected category when it changes
  const { data: studies, isLoading: studiesLoading } = useQuery<{
    success: boolean;
    data: Study[];
  }>({
    queryKey: [
      "/api/studies/by-consumer-category",
      selectedModel,
      selectedCategory,
    ],
    queryFn: async () => {
      if (!selectedCategory || !selectedModel)
        return { success: true, data: [] };

      // Make direct fetch request to ensure proper URL formatting
      const response = await fetch(
        `/api/studies/by-consumer-category/${selectedModel}/${encodeURIComponent(selectedCategory)}`,
      );
      return response.json();
    },
    enabled: !!selectedCategory && !!selectedModel,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  // Get counts for rendering badges
  const getCategoryCount = (model: string, category: string): number => {
    if (!countData?.success) return 0;

    switch (model) {
      case "condition":
        // Find the count by matching the category name
        const conditionItem = countData.data.condition.find(
          (item: any) => item.name === category,
        );
        return conditionItem ? conditionItem.count : 0;
      case "body_system":
        const bodySystemItem = countData.data.body_system.find(
          (item: any) => item.name === category,
        );
        return bodySystemItem ? bodySystemItem.count : 0;
      case "life_stage":
        const lifeStageItem = countData.data.life_stage.find(
          (item: any) => item.name === category,
        );
        return lifeStageItem ? lifeStageItem.count : 0;
      default:
        return 0;
    }
  };

  // Get categories for current model
  const getCurrentCategories = (): string[] => {
    if (!categoryData?.success) return [];

    switch (selectedModel) {
      case "condition":
        return categoryData.data.condition || [];
      case "body_system":
        return categoryData.data.body_system || [];
      case "life_stage":
        return categoryData.data.life_stage || [];
      default:
        return [];
    }
  };

  // Handle category selection
  const handleCategorySelect = (category: string) => {
    setSelectedCategory(category);
  };

  return (
    <>
      <SiteHeader />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        <PageBreadcrumb items={[
          { label: "Home", href: "/" },
          { label: "Studies", href: "/studies" },
          { label: "Explore by Benefit" },
        ]} />
      </div>
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
      <div className="container mx-auto py-8">
        <h1 className="text-3xl font-bold mb-6 text-center">{copy.h1}</h1>

        <p className="text-center mb-8 max-w-3xl mx-auto text-muted-foreground">
          {copy.intro}
        </p>

        {hubsLoading ? (
          // Reserve the grid's height so the tabs/footer don't jump (CLS).
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-12 min-h-[40vh]" aria-busy="true">
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
          <section className="mb-12" aria-label="Benefit hubs">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {hubs.map((hub) => (
                <Link key={hub.slug} href={hub.path}>
                  <Card className="overflow-hidden cursor-pointer hover:shadow-md transition-shadow">
                    <CardHeader className="p-4">
                      <CardTitle className="text-xl">{hub.name}</CardTitle>
                      <div>
                        <Badge variant="outline" className="mt-1">
                          {studyCountLabel(hub.studyCount)}
                        </Badge>
                      </div>
                    </CardHeader>
                  </Card>
                </Link>
              ))}
            </div>
          </section>
        ) : null}

        <h2 className="text-2xl font-semibold mb-2 text-center">
          Browse by Condition, Body System or Life Stage
        </h2>
        <p className="text-center mb-8 max-w-3xl mx-auto text-muted-foreground">
          Browse hydrogen health studies organized by health conditions, body
          systems, and life stages to find research most relevant to your
          interests.
        </p>

        <Tabs
          defaultValue="condition"
          className="mb-8"
          onValueChange={(value) => {
            setSelectedModel(value);
            setSelectedCategory(null);
          }}
        >
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="condition">By Health Condition</TabsTrigger>
            <TabsTrigger value="body_system">By Body System</TabsTrigger>
            <TabsTrigger value="life_stage">By Life Stage</TabsTrigger>
          </TabsList>

          <TabsContent value="condition" className="mt-6">
            <h2 className="text-xl font-semibold mb-4">
              Select a Health Condition
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {categoriesLoading ? (
                <div className="col-span-full flex justify-center p-8">
                  <Loader2 className="w-8 h-8 animate-spin" />
                </div>
              ) : (
                getCurrentCategories().map((category: string) => (
                  <Card
                    key={category}
                    className={`cursor-pointer hover:shadow-md transition-shadow ${
                      selectedCategory === category
                        ? "border-primary border-2"
                        : ""
                    }`}
                    onClick={() => handleCategorySelect(category)}
                  >
                    <CardHeader className="pb-2">
                      <CardTitle className="flex items-center text-lg">
                        <span className="mr-2">
                          {categoryIcons[category] || "🔬"}
                        </span>
                        {category}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Badge variant="outline">
                        {getCategoryCount("condition", category)} studies
                      </Badge>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>

          <TabsContent value="body_system" className="mt-6">
            <h2 className="text-xl font-semibold mb-4">Select a Body System</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {categoriesLoading ? (
                <div className="col-span-full flex justify-center p-8">
                  <Loader2 className="w-8 h-8 animate-spin" />
                </div>
              ) : (
                getCurrentCategories().map((category: string) => (
                  <Card
                    key={category}
                    className={`cursor-pointer hover:shadow-md transition-shadow ${
                      selectedCategory === category
                        ? "border-primary border-2"
                        : ""
                    }`}
                    onClick={() => handleCategorySelect(category)}
                  >
                    <CardHeader className="pb-2">
                      <CardTitle className="flex items-center text-lg">
                        <span className="mr-2">
                          {categoryIcons[category] || "🔬"}
                        </span>
                        {category}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Badge variant="outline">
                        {getCategoryCount("body_system", category)} studies
                      </Badge>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>

          <TabsContent value="life_stage" className="mt-6">
            <h2 className="text-xl font-semibold mb-4">
              Select a Life Stage or Demographic
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {categoriesLoading ? (
                <div className="col-span-full flex justify-center p-8">
                  <Loader2 className="w-8 h-8 animate-spin" />
                </div>
              ) : (
                getCurrentCategories().map((category: string) => (
                  <Card
                    key={category}
                    className={`cursor-pointer hover:shadow-md transition-shadow ${
                      selectedCategory === category
                        ? "border-primary border-2"
                        : ""
                    }`}
                    onClick={() => handleCategorySelect(category)}
                  >
                    <CardHeader className="pb-2">
                      <CardTitle className="flex items-center text-lg">
                        <span className="mr-2">
                          {categoryIcons[category] || "🔬"}
                        </span>
                        {category}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Badge variant="outline">
                        {getCategoryCount("life_stage", category)} studies
                      </Badge>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>
        </Tabs>

        {/* Display studies for selected category */}
        {selectedCategory && (
          <div className="mt-8">
            {/* SEO anchor content for category */}
            <AnchorContent categoryType={selectedModel} category={selectedCategory} />

            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold">
                {categoryIcons[selectedCategory] || "🔬"} {selectedCategory}{" "}
                Research
              </h2>
              <Button
                variant="outline"
                onClick={() => setSelectedCategory(null)}
              >
                Back to Categories
              </Button>
            </div>

            {studiesLoading ? (
              <div className="flex justify-center p-12">
                <Loader2 className="w-10 h-10 animate-spin" />
              </div>
            ) : (
              <>
                {!studies?.success || studies?.data?.length === 0 ? (
                  <Card className="bg-muted/50">
                    <CardContent className="pt-6 text-center">
                      <p>
                        No studies found for this category yet. We're
                        continuously adding new research.
                      </p>
                      <Button className="mt-4" asChild>
                        <Link to="/studies">Browse All Studies</Link>
                      </Button>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="grid gap-6">
                    {studies?.data?.map((study: Study) => (
                      <Card key={study.id} className="overflow-hidden">
                        <div className="md:flex">
                          {study.imageUrl && (
                            <div className="md:w-1/4 min-h-[160px] bg-muted">
                              <img
                                src={study.imageUrl}
                                alt={`Illustration for study: ${study.title}`}
                                loading="lazy"
                                decoding="async"
                                className="w-full h-full object-cover"
                              />
                            </div>
                          )}
                          <div
                            className={`${study.imageUrl ? "md:w-3/4" : "w-full"}`}
                          >
                            <CardHeader>
                              <CardTitle className="text-xl hover:text-primary transition-colors">
                                <Link to={study.slug ? `/study/${study.slug}` : `/study/id/${study.id}`}>
                                  {study.title}
                                </Link>
                              </CardTitle>
                              <CardDescription>
                                {new Date(
                                  study.publishDate,
                                ).toLocaleDateString()}{" "}
                                | {study.journal}
                              </CardDescription>
                            </CardHeader>
                            <CardContent>
                              <p className="line-clamp-3">{abstractExcerpt(study.abstract)}</p>
                              <div className="mt-4 flex flex-wrap gap-2">
                                <Badge variant="secondary">
                                  {study.category}
                                </Badge>
                                {study.doi && (
                                  <Badge variant="outline">
                                    <a
                                      href={`https://doi.org/${study.doi}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                    >
                                      DOI: {study.doi}
                                    </a>
                                  </Badge>
                                )}
                              </div>
                            </CardContent>
                          </div>
                        </div>
                      </Card>
                    ))}

                    <div className="flex justify-center mt-6">
                      <Button asChild>
                        <Link to="/studies">View All Studies</Link>
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
      <Footer />
    </>
  );
};

export default ExploreByBenefit;

/**
 * /explore-by-benefit/:benefit — had no browser route (crawlers got the hub,
 * browsers the SPA NotFound). Same shared hub page as the demographic and
 * delivery-method hubs: title, H1, intro, canonical and study list match the
 * crawler HTML; a slug that isn't a benefit hub renders NotFound (HTTP 404
 * from the server too).
 */
export const BenefitDetailPage: React.FC = () => {
  const [, params] = useRoute("/explore-by-benefit/:benefit");
  const slug = (params?.benefit || "").toLowerCase();
  return (
    <ExploreHubDetail
      type="benefit"
      slug={slug}
      parent={{ label: "Benefits", href: INDEX_PATH }}
    />
  );
};
