import { Link } from "wouter";
import {
  ArrowLeft,
  Heart,
  Brain,
  Shield,
  Zap,
  Users,
  Microscope,
  Activity,
  Sparkles,
  BookOpen,
  FlaskConical,
  CheckCircle,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Helmet } from "react-helmet";
import SiteHeader from "@/components/layout/SiteHeader";
import Footer from "@/components/layout/Footer";

export default function BenefitsPage() {
  const learningTopics = [
    {
      id: "basics",
      title: "Hydrogen Therapy Basics",
      description:
        "Understanding the fundamentals of molecular hydrogen and its health applications",
      icon: <FlaskConical className="h-8 w-8 text-teal-600" />,
      topics: [
        "What is molecular hydrogen?",
        "How does it work in the body?",
        "Safety and dosage",
      ],
      studyCount: 1326,
      difficulty: "Beginner",
    },
    {
      id: "health-benefits",
      title: "Health Benefits & Applications",
      description:
        "Explore the wide range of health conditions hydrogen therapy may support",
      icon: <Heart className="h-8 w-8 text-red-600" />,
      topics: [
        "Cardiovascular health",
        "Anti-inflammatory effects",
        "Neurological support",
      ],
      studyCount: 850,
      difficulty: "Intermediate",
    },
    {
      id: "mechanisms",
      title: "Scientific Mechanisms",
      description:
        "Deep dive into how hydrogen works at the cellular and molecular level",
      icon: <Brain className="h-8 w-8 text-purple-600" />,
      topics: [
        "Antioxidant properties",
        "Cellular signaling",
        "Gene expression",
      ],
      studyCount: 420,
      difficulty: "Advanced",
    },
    {
      id: "delivery-methods",
      title: "Delivery Methods",
      description:
        "Learn about different ways to consume hydrogen for health benefits",
      icon: <Zap className="h-8 w-8 text-green-600" />,
      topics: ["Hydrogen water", "Inhalation therapy", "Hydrogen baths"],
      studyCount: 380,
      difficulty: "Beginner",
    },
  ];

  const quickFacts = [
    "Hydrogen is the smallest and lightest molecule in the universe",
    "It can easily penetrate cell membranes and reach mitochondria",
    "Acts as a selective antioxidant targeting harmful free radicals",
    "Over 1,300 scientific studies have been published on hydrogen therapy",
    "Safe with no known toxic effects at therapeutic concentrations",
    "Multiple delivery methods available including water, inhalation, and baths",
  ];

  const benefitCategories = [
    {
      id: "cardiovascular",
      title: "Heart Health",
      searchQuery: "cardiovascular hydrogen",
      icon: <Heart className="h-8 w-8 text-red-500" />,
      description:
        "Research shows hydrogen water may support cardiovascular function and reduce oxidative stress.",
      benefits: [
        "May reduce blood pressure in hypertensive individuals",
        "Potential improvement in arterial flexibility",
        "Reduction in markers of cardiovascular inflammation",
        "Support for healthy cholesterol levels",
      ],
      keyStudies: [
        "Effects on metabolic syndrome patients (2020)",
        "Hypertension reduction study (2018)",
        "Cardiovascular risk factors analysis (2019)",
      ],
    },
    {
      id: "neurological",
      title: "Brain Function",
      searchQuery: "neurological hydrogen brain",
      icon: <Brain className="h-8 w-8 text-teal-500" />,
      description:
        "Studies indicate potential cognitive benefits and neuroprotective effects.",
      benefits: [
        "May improve cognitive function in elderly adults",
        "Potential neuroprotective effects against oxidative damage",
        "Support for mental clarity and focus",
        "Possible benefits for neurodegenerative conditions",
      ],
      keyStudies: [
        "Cognitive improvement in mild cognitive impairment (2021)",
        "Neuroprotective effects study (2019)",
        "Memory and attention enhancement (2020)",
      ],
    },
    {
      id: "antioxidant",
      title: "Antioxidant Power",
      searchQuery: "antioxidant oxidative stress hydrogen",
      icon: <Shield className="h-8 w-8 text-green-500" />,
      description:
        "Hydrogen acts as a selective antioxidant, targeting harmful free radicals.",
      benefits: [
        "Selective neutralization of hydroxyl radicals",
        "Reduction in oxidative stress markers",
        "Support for cellular protection",
        "May help reduce inflammation",
      ],
      keyStudies: [
        "Selective antioxidant properties (2017)",
        "Oxidative stress reduction in athletes (2019)",
        "Cellular protection mechanisms (2020)",
      ],
    },
    {
      id: "exercise",
      title: "Athletic Performance",
      searchQuery: "exercise athletic hydrogen performance",
      icon: <Zap className="h-8 w-8 text-yellow-500" />,
      description:
        "Athletes report improved performance and faster recovery times.",
      benefits: [
        "Reduced exercise-induced fatigue",
        "Faster recovery between training sessions",
        "Decreased muscle damage markers",
        "Improved endurance capacity",
      ],
      keyStudies: [
        "Exercise performance in soccer players (2018)",
        "Recovery enhancement in cyclists (2019)",
        "Muscle damage reduction study (2020)",
      ],
    },
  ];

  const researchHighlights = [
    {
      stat: "1,304+",
      label: "Published Studies",
      description: "Peer-reviewed research papers",
    },
    {
      stat: "25+",
      label: "Countries",
      description: "Conducting hydrogen research",
    },
    {
      stat: "15+",
      label: "Years",
      description: "Of scientific investigation",
    },
    {
      stat: "98%",
      label: "Peer-Reviewed",
      description: "Studies in our database",
    },
  ];

  return (
    <>
      <Helmet>
        <title>
          Hydrogen Benefits & Education - Complete Guide to Hydrogen Therapy
        </title>
        <meta
          name="description"
          content="Learn about hydrogen therapy benefits backed by 1,300+ studies. Comprehensive guide covering health benefits, mechanisms, delivery methods, and scientific research."
        />
      </Helmet>

      <SiteHeader />

      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-white border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <Link
              href="/"
              className="flex items-center text-teal-600 hover:text-teal-700 mb-6"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Home
            </Link>
            <div className="text-center">
              <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
                Hydrogen Benefits & Education
              </h1>
              <p className="text-xl text-gray-600 max-w-3xl mx-auto mb-8">
                Learn about hydrogen therapy and discover what thousands of
                peer-reviewed studies reveal about hydrogen's potential to
                support your health and wellness goals.
              </p>

              {/* Research Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-8">
                {researchHighlights.map((stat, index) => (
                  <Card
                    key={index}
                    className="text-center border-none shadow-lg"
                  >
                    <CardContent className="p-4">
                      <div className="text-2xl md:text-3xl font-bold text-teal-600 mb-1">
                        {stat.stat}
                      </div>
                      <div className="text-sm font-medium text-gray-900 mb-1">
                        {stat.label}
                      </div>
                      <div className="text-xs text-gray-600">
                        {stat.description}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          {/* Benefit Categories */}
          <Tabs defaultValue="cardiovascular" className="mb-16">
            <TabsList className="grid w-full grid-cols-2 md:grid-cols-4 mb-8">
              {benefitCategories.map((category) => (
                <TabsTrigger
                  key={category.id}
                  value={category.id}
                  className="flex items-center gap-2"
                >
                  <span className="hidden sm:inline">{category.icon}</span>
                  <span className="text-sm">{category.title}</span>
                </TabsTrigger>
              ))}
            </TabsList>

            {benefitCategories.map((category) => (
              <TabsContent key={category.id} value={category.id}>
                <Card>
                  <CardHeader>
                    <div className="flex items-center gap-4 mb-4">
                      {category.icon}
                      <div>
                        <CardTitle className="text-2xl">
                          {category.title}
                        </CardTitle>
                        <Badge variant="secondary" className="mt-2">
                          Research-backed
                        </Badge>
                      </div>
                    </div>
                    <CardDescription className="text-lg">
                      {category.description}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid md:grid-cols-2 gap-8">
                      <div>
                        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                          <Sparkles className="h-5 w-5 text-teal-500" />
                          Potential Benefits
                        </h3>
                        <ul className="space-y-3">
                          {category.benefits.map((benefit, index) => (
                            <li key={index} className="flex items-start gap-3">
                              <div className="w-2 h-2 bg-teal-500 rounded-full mt-2 flex-shrink-0"></div>
                              <span className="text-gray-700">{benefit}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                          <Microscope className="h-5 w-5 text-green-500" />
                          Key Research Studies
                        </h3>
                        <ul className="space-y-3">
                          {category.keyStudies.map((study, index) => (
                            <li key={index} className="flex items-start gap-3">
                              <div className="w-2 h-2 bg-green-500 rounded-full mt-2 flex-shrink-0"></div>
                              <span className="text-gray-700">{study}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                    <div className="mt-8 pt-6 border-t">
                      <Link href={`/search?q=${encodeURIComponent(category.searchQuery)}`}>
                        <Button className="mr-4">
                          Search {category.title} Studies
                        </Button>
                      </Link>
                      <Link href="/studies">
                        <Button variant="outline">
                          Browse Research Database
                        </Button>
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            ))}
          </Tabs>

          {/* Quick Facts Section */}
          <Card className="mb-16">
            <CardHeader className="text-center">
              <CardTitle className="text-3xl mb-4">
                Quick Facts About Hydrogen
              </CardTitle>
              <CardDescription className="text-lg max-w-3xl mx-auto">
                Essential facts about molecular hydrogen therapy based on
                scientific research.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {quickFacts.map((fact, index) => (
                  <div
                    key={index}
                    className="flex items-start space-x-3 p-4 bg-teal-50 rounded-lg"
                  >
                    <CheckCircle className="h-5 w-5 text-teal-600 mt-1 flex-shrink-0" />
                    <p className="text-gray-700">{fact}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Learning Pathways Section */}
          <Card className="mb-16">
            <CardHeader className="text-center">
              <CardTitle className="text-3xl mb-4">Learning Pathways</CardTitle>
              <CardDescription className="text-lg max-w-3xl mx-auto">
                Choose your learning journey based on your background and
                interests
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {learningTopics.map((topic) => (
                  <Card
                    key={topic.id}
                    className="hover:shadow-lg transition-shadow border-2 hover:border-teal-200 h-full"
                  >
                    <CardHeader>
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center space-x-3">
                          {topic.icon}
                          <div>
                            <Badge variant="outline" className="mb-2">
                              {topic.difficulty}
                            </Badge>
                            <CardTitle className="text-xl">
                              {topic.title}
                            </CardTitle>
                          </div>
                        </div>
                      </div>
                      <CardDescription className="text-base">
                        {topic.description}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div>
                          <p className="font-medium text-gray-700 mb-2">
                            What you'll learn:
                          </p>
                          <ul className="space-y-1">
                            {topic.topics.map((subtopic, index) => (
                              <li
                                key={index}
                                className="text-sm text-gray-600 flex items-center"
                              >
                                <CheckCircle className="h-3 w-3 text-green-600 mr-2" />
                                {subtopic}
                              </li>
                            ))}
                          </ul>
                        </div>
                        <div className="flex items-center justify-between pt-4 border-t">
                          <span className="text-sm text-gray-500">
                            {topic.studyCount} supporting studies
                          </span>
                          <div className="flex items-center text-teal-600 font-medium">
                            Learn more <ChevronRight className="h-4 w-4 ml-1" />
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* How It Works Section */}
          <Card className="mb-16">
            <CardHeader className="text-center">
              <CardTitle className="text-3xl mb-4">
                How Hydrogen Water Works
              </CardTitle>
              <CardDescription className="text-lg max-w-3xl mx-auto">
                Understanding the science behind molecular hydrogen's potential
                health benefits.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-3 gap-8">
                <div className="text-center">
                  <div className="mx-auto mb-4 p-4 rounded-full bg-teal-100 w-fit">
                    <Activity className="h-8 w-8 text-teal-600" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">
                    Selective Antioxidant
                  </h3>
                  <p className="text-gray-600">
                    Hydrogen selectively neutralizes harmful hydroxyl radicals
                    while preserving beneficial reactive oxygen species.
                  </p>
                </div>
                <div className="text-center">
                  <div className="mx-auto mb-4 p-4 rounded-full bg-green-100 w-fit">
                    <Shield className="h-8 w-8 text-green-600" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">
                    Cellular Protection
                  </h3>
                  <p className="text-gray-600">
                    Small molecular size allows hydrogen to penetrate cell
                    membranes and protect cellular structures.
                  </p>
                </div>
                <div className="text-center">
                  <div className="mx-auto mb-4 p-4 rounded-full bg-purple-100 w-fit">
                    <Zap className="h-8 w-8 text-purple-600" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">
                    Anti-Inflammatory
                  </h3>
                  <p className="text-gray-600">
                    Research suggests hydrogen may help modulate inflammatory
                    responses in various body systems.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* CTA Section */}
          <Card className="bg-gradient-to-r from-teal-600 to-teal-500 text-white">
            <CardContent className="p-12 text-center">
              <h2 className="text-3xl font-bold mb-4">
                Ready to Experience These Benefits?
              </h2>
              <p className="text-xl mb-8 opacity-90 max-w-2xl mx-auto">
                Explore our research-backed product recommendations and start
                your hydrogen water journey today.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link href="/products">
                  <Button variant="secondary" size="lg">
                    View Products
                  </Button>
                </Link>
                <Link href="/studies">
                  <Button
                    variant="outline"
                    size="lg"
                    className="text-white border-white hover:bg-white hover:text-teal-600"
                  >
                    Browse All Studies
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>

          {/* Disclaimer */}
          <div className="mt-12 p-6 bg-gray-100 rounded-lg">
            <p className="text-sm text-gray-600 text-center">
              <strong>Important:</strong> The information presented here is
              based on scientific research and is for educational purposes only.
              This content is not intended to diagnose, treat, cure, or prevent
              any disease. Individual results may vary. Always consult with your
              healthcare provider before making changes to your health regimen.
            </p>
          </div>
        </div>
      </div>

      <Footer />
    </>
  );
}
