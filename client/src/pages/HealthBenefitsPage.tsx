import React from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  Heart,
  Brain,
  Zap,
  Shield,
  Droplet,
  Users,
  TrendingUp,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import SiteHeader from "@/components/layout/SiteHeader";
import Footer from "@/components/layout/Footer";
import { Helmet } from "react-helmet";

export default function HealthBenefitsPage() {
  // Fetch real study counts from the API
  const { data: countData } = useQuery<{
    success: boolean;
    data: {
      condition: { name: string; count: string }[];
      body_system: { name: string; count: string }[];
    };
  }>({
    queryKey: ["/api/consumer-categories/counts"],
    staleTime: 1000 * 60 * 10,
  });

  // Map health page categories to API category names
  const getStudyCount = (apiName: string): number => {
    if (!countData?.data) return 0;
    const all = [...(countData.data.condition || []), ...(countData.data.body_system || [])];
    const found = all.find((c) => c.name === apiName);
    return found ? parseInt(found.count) || 0 : 0;
  };

  const healthCategories = [
    {
      category: "Cardiovascular Health",
      searchCategory: "cardiovascular",
      icon: <Heart className="h-8 w-8 text-red-600" />,
      description: "Heart health, circulation, and vascular function",
      studyCount: getStudyCount("Heart Disease & Hypertension"),
      evidence: "low",
      benefits: [
        "Blood vessel function (small trials)",
        "Blood lipid markers (small trials, mixed)",
        "Oxidative stress markers",
        "Blood pressure (few, small studies)",
      ],
      keyFindings:
        "A few small human trials report changes in blood vessel function and blood markers. Outcomes like heart attacks and strokes haven't been studied.",
      population: "Mostly small, short human trials",
    },
    {
      category: "Neurological Health",
      searchCategory: "neurological",
      icon: <Brain className="h-8 w-8 text-purple-600" />,
      description: "Brain function, cognitive health, and neuroprotection",
      studyCount: getStudyCount("Brain & Neurological Disorders"),
      evidence: "very-low",
      benefits: [
        "Oxidative damage to brain cells (animal studies)",
        "Cognitive tests (few, small human trials)",
        "Brain injury models (animal studies)",
        "Inflammation in the brain (animal studies)",
      ],
      keyFindings:
        "Hydrogen crosses the blood-brain barrier, and animal studies report protective effects. Human trials are few and small, so benefits in people haven't been shown.",
      population: "Mostly animal research",
    },
    {
      category: "Athletic Performance",
      searchCategory: "exercise",
      icon: <Zap className="h-8 w-8 text-green-600" />,
      description: "Exercise performance, recovery, and fatigue reduction",
      studyCount: getStudyCount("Musculoskeletal System"),
      evidence: "low",
      benefits: [
        "Perceived fatigue after exercise",
        "Blood lactate after hard exercise",
        "Muscle soreness",
        "Endurance and power output",
      ],
      keyFindings:
        "Some small exercise trials report lower blood lactate or perceived fatigue; others found no difference.",
      population: "Small trials in athletes and active adults",
    },
    {
      category: "Inflammation",
      searchCategory: "inflammation",
      icon: <Shield className="h-8 w-8 text-orange-600" />,
      description: "Inflammatory and immune markers",
      studyCount: getStudyCount("Arthritis & Inflammation"),
      evidence: "very-low",
      benefits: [
        "Inflammatory markers in blood",
        "Immune cell signaling",
        "Tissue injury models (animal studies)",
        "Recovery after injury (animal studies)",
      ],
      keyFindings:
        "Anti-inflammatory effects are common in animal studies. Human trials are small and their results are mixed.",
      population: "Mostly animal research",
    },
    {
      category: "Metabolic Health",
      searchCategory: "metabolic",
      icon: <TrendingUp className="h-8 w-8 text-teal-600" />,
      description: "Blood sugar, blood lipids and body weight",
      studyCount: getStudyCount("Diabetes & Metabolic Health"),
      evidence: "very-low",
      benefits: [
        "Blood sugar and insulin markers",
        "Blood lipids",
        "Body weight and liver fat",
        "Mitochondrial function (lab studies)",
      ],
      keyFindings:
        "The main double-blind trial in type 2 diabetes found no change in insulin resistance. Small trials report modest changes in some blood lipid and metabolic markers.",
      population: "Small human trials; much is animal research",
    },
    {
      category: "Skin Health",
      searchCategory: "dermatology",
      icon: <Droplet className="h-8 w-8 text-cyan-600" />,
      description: "Skin appearance and UV exposure",
      studyCount: getStudyCount("Integumentary System"),
      evidence: "very-low",
      benefits: [
        "UV-related skin damage (lab and animal studies)",
        "Skin hydration",
        "Wrinkles and skin aging",
        "Wound healing (animal studies)",
      ],
      keyFindings:
        "A few small studies have tested hydrogen water or baths on skin. There's no placebo-controlled trial showing a clear benefit.",
      population: "Few, small studies",
    },
  ];

  // Evidence grades follow the topic hubs: no area has more than low-certainty
  // human evidence yet.
  const getEvidenceLevelColor = (level: string) =>
    level === "low" ? "text-yellow-600" : "text-orange-600";

  const getEvidenceLevelText = (level: string) =>
    level === "low" ? "Low" : "Very low";

  return (
    <>
      <SiteHeader />
      <Helmet>
        <title>Molecular Hydrogen Research by Health Area - What the Evidence Shows</title>
        <meta name="description" content="What research on molecular hydrogen has looked at — heart, brain, exercise, inflammation, metabolism and skin — and how strong the evidence is in people." />
        <meta property="og:title" content="Molecular Hydrogen Research by Health Area - What the Evidence Shows" />
        <meta property="og:description" content="What research on molecular hydrogen has looked at — heart, brain, exercise, inflammation, metabolism and skin — and how strong the evidence is in people." />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://hydrogenstudies.com/learn/health-benefits" />
        <meta name="twitter:card" content="summary" />
        <link rel="canonical" href="https://hydrogenstudies.com/learn/health-benefits" />
      </Helmet>
      <div className="min-h-screen bg-gradient-to-b from-teal-50 to-white">
        {/* Navigation */}
        <div className="bg-white border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <Link
              href="/learn"
              className="flex items-center text-teal-600 hover:text-teal-700"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Learn
            </Link>
          </div>
        </div>

        {/* Hero */}
        <section className="py-16 px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto text-center">
            <Heart className="h-16 w-16 text-red-600 mx-auto mb-6" />
            <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-6">
              Research by
              <span className="bg-gradient-to-r from-red-600 to-purple-600 bg-clip-text text-transparent">
                {" "}
                Health Area
              </span>
            </h1>
            <p className="text-xl text-gray-600 mb-8">
              What researchers have studied, and how strong the evidence is in
              people. Most of it is early-stage.
            </p>
            <Badge className="bg-red-100 text-red-800 px-4 py-2">
              {healthCategories.reduce((sum, c) => sum + c.studyCount, 0) > 0
                ? `${healthCategories.reduce((sum, c) => sum + c.studyCount, 0).toLocaleString("en-US")} studies in these areas`
                : "Studies grouped by health area"}
            </Badge>
          </div>
        </section>

        {/* Health Categories */}
        <section className="py-16 px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold text-gray-900 mb-4">
                Health Areas
              </h2>
              <p className="text-lg text-gray-600">
                What has been measured in each area — not proven benefits
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {healthCategories.map((category) => (
                <Card
                  key={category.category}
                  className="hover:shadow-lg transition-shadow border-l-4 border-l-teal-600"
                >
                  <CardHeader>
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center space-x-3">
                        {category.icon}
                        <div>
                          <CardTitle className="text-xl">
                            {category.category}
                          </CardTitle>
                          <CardDescription>
                            {category.description}
                          </CardDescription>
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge variant="outline" className="mb-1">
                          {category.studyCount} studies
                        </Badge>
                        <p
                          className={`text-sm font-medium ${getEvidenceLevelColor(category.evidence)}`}
                        >
                          {getEvidenceLevelText(category.evidence)}-certainty
                          evidence
                        </p>
                      </div>
                    </div>

                  </CardHeader>

                  <CardContent className="space-y-4">
                    <div>
                      <p className="font-medium text-gray-700 mb-2">
                        What's been studied:
                      </p>
                      <ul className="space-y-1">
                        {category.benefits.map((benefit) => (
                          <li
                            key={benefit}
                            className="text-sm text-gray-600 flex items-start"
                          >
                            <div className="h-1.5 w-1.5 bg-teal-600 rounded-full mr-2 mt-2 flex-shrink-0"></div>
                            {benefit}
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="bg-gray-50 p-4 rounded-lg">
                      <p className="font-medium text-gray-700 mb-2">
                        Key Research Finding:
                      </p>
                      <p className="text-sm text-gray-600">
                        {category.keyFindings}
                      </p>
                    </div>

                    <div className="flex items-center justify-between pt-4 border-t">
                      <div className="flex items-center text-sm text-gray-500">
                        <Users className="h-4 w-4 mr-1" />
                        {category.population}
                      </div>
                      <Link
                        href={`/studies?category=${encodeURIComponent(category.searchCategory)}`}
                      >
                        <Badge
                          variant="outline"
                          className="hover:bg-teal-50 cursor-pointer"
                        >
                          View Studies
                        </Badge>
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Important Notes */}
        <section className="py-16 px-4 sm:px-6 lg:px-8 bg-yellow-50">
          <div className="max-w-4xl mx-auto">
            <div className="bg-white p-8 rounded-lg border border-yellow-200">
              <h3 className="text-xl font-bold text-gray-900 mb-4">
                Important Considerations
              </h3>
              <div className="space-y-4 text-gray-700">
                <p>
                  <strong>Not a Treatment:</strong> Molecular hydrogen is not
                  approved to treat, cure or prevent any disease. The areas above
                  are what researchers have measured, not established benefits.
                </p>
                <p>
                  <strong>Not Medical Advice:</strong> This information is for
                  educational purposes only and should not be considered medical
                  advice. Always consult with qualified healthcare professionals
                  before starting any new health regimen, especially if you are
                  pregnant, have a medical condition or take medications.
                </p>
                <p>
                  <strong>Research is Early:</strong> Most studies are in
                  animals or cells. Human trials are mostly small and short,
                  and several found little or no difference from placebo.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Next Steps */}
        <section className="py-16 px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-3xl font-bold text-gray-900 mb-8">
              Explore Further
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Link href="/learn/basics">
                <Card className="hover:shadow-lg transition-shadow cursor-pointer">
                  <CardHeader>
                    <Shield className="h-8 w-8 text-teal-600 mx-auto mb-2" />
                    <CardTitle className="text-center">
                      Hydrogen Basics
                    </CardTitle>
                    <CardDescription className="text-center">
                      What hydrogen is and what researchers are studying
                    </CardDescription>
                  </CardHeader>
                </Card>
              </Link>

              <Link href="/studies">
                <Card className="hover:shadow-lg transition-shadow cursor-pointer">
                  <CardHeader>
                    <TrendingUp className="h-8 w-8 text-green-600 mx-auto mb-2" />
                    <CardTitle className="text-center">
                      Browse Research
                    </CardTitle>
                    <CardDescription className="text-center">
                      Explore studies by health condition or benefit
                    </CardDescription>
                  </CardHeader>
                </Card>
              </Link>

              <Link href="/blog">
                <Card className="hover:shadow-lg transition-shadow cursor-pointer">
                  <CardHeader>
                    <Brain className="h-8 w-8 text-purple-600 mx-auto mb-2" />
                    <CardTitle className="text-center">Read Articles</CardTitle>
                    <CardDescription className="text-center">
                      Plain-language summaries of hydrogen research
                    </CardDescription>
                  </CardHeader>
                </Card>
              </Link>
            </div>
          </div>
        </section>
      </div>
      <Footer />
    </>
  );
}
