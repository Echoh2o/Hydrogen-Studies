import { Link } from "wouter";
import PageBreadcrumb from "@/components/seo/PageBreadcrumb";
import {
  Heart,
  Brain,
  Shield,
  Zap,
  Activity,
  Sparkles,
  FlaskConical,
  CheckCircle,
  ChevronRight,
  Lightbulb,
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
import JsonLd, { generateFaqSchema } from "@/components/seo/JsonLd";

export default function BenefitsPage() {
  const didYouKnow = [
    {
      emoji: "🫧",
      title: "Natural Production",
      fact: "A healthy adult human gut produces approximately 1-12 liters of hydrogen gas per day through bacterial fermentation of dietary fiber.",
    },
    {
      emoji: "⚡",
      title: "Smallest Molecule",
      fact: "Molecular hydrogen (H\u2082) is the smallest and lightest molecule in existence, allowing it to rapidly diffuse across cell membranes and reach virtually every compartment of the body.",
    },
    {
      emoji: "🛡️",
      title: "Selective Antioxidant",
      fact: "Unlike conventional antioxidants, hydrogen selectively targets the hydroxyl radical (\u00B7OH) \u2014 the most cytotoxic reactive oxygen species \u2014 while leaving beneficial signaling molecules like H\u2082O\u2082 and NO\u00B7 intact.",
    },
    {
      emoji: "🔬",
      title: "Research Milestone",
      fact: "Modern biomedical interest in hydrogen exploded after Ohsawa et al. published a landmark paper in Nature Medicine in 2007 demonstrating hydrogen's therapeutic potential.",
    },
    {
      emoji: "🌍",
      title: "Global Research",
      fact: "Molecular hydrogen has been studied in over 40 countries, with Japan, China, and the United States leading in published research volume.",
    },
    {
      emoji: "✅",
      title: "Strong Safety Profile",
      fact: "Hydrogen has demonstrated a robust safety profile in human studies, with no reported toxic effects even at concentrations well above therapeutic levels.",
    },
  ];

  const benefitCategories = [
    {
      id: "cardiovascular",
      title: "Heart Health",
      icon: <Heart className="h-8 w-8 text-red-500" />,
      description:
        "Research suggests molecular hydrogen may support vascular function and overall cardiometabolic health.",
      benefits: [
        "Supports healthy blood vessel function",
        "Helps maintain balanced glucose and lipid levels",
        "Reduces markers associated with inflammation",
        "Supports healthy blood pressure regulation",
      ],
      keywords: ["cardiac", "heart", "myocardial", "ischemia", "reperfusion", "infarction", "endothelial", "vascular", "artery", "atherosclerosis", "hypertension", "blood pressure", "glucose", "lipid", "cholesterol", "triglyceride"],
      link: "/explore-by-body-system/cardiovascular-system",
    },
    {
      id: "neurological",
      title: "Brain Function",
      icon: <Brain className="h-8 w-8 text-teal-500" />,
      description:
        "Molecular hydrogen is being studied for its role in supporting brain health and cognitive function.",
      benefits: [
        "Supports cognitive performance",
        "Helps protect brain cells from oxidative stress",
        "Supports healthy inflammatory balance in the brain",
        "Contributes to overall neurological resilience",
      ],
      keywords: ["brain", "cerebral", "neural", "neuron", "neurological", "cognitive", "memory", "learning", "Alzheimer", "Parkinson", "stroke", "ischemia", "reperfusion", "brain injury"],
      link: "/explore-by-body-system/nervous-system",
    },
    {
      id: "antioxidant",
      title: "Oxidative Stress & Inflammation",
      icon: <Shield className="h-8 w-8 text-green-500" />,
      description:
        "Molecular hydrogen plays a role in maintaining oxidative balance and supporting the body's response to inflammation.",
      benefits: [
        "Helps reduce oxidative stress",
        "Supports the body's natural antioxidant defenses",
        "Promotes balanced inflammatory signaling",
        "Supports cellular protection under stress",
      ],
      keywords: ["oxidative stress", "ROS", "reactive oxygen species", "antioxidant", "redox", "Nrf2", "inflammation", "inflammatory", "cytokine", "NF-\u03BAB", "apoptosis", "cell death"],
      link: "/explore-by-body-system/immune-system",
    },
    {
      id: "exercise",
      title: "Athletic Performance",
      icon: <Zap className="h-8 w-8 text-yellow-500" />,
      description:
        "Molecular hydrogen is studied for its effects on physical performance and recovery.",
      benefits: [
        "Helps reduce exercise-related fatigue",
        "Supports recovery after physical activity",
        "Reduces markers of muscle stress",
        "Supports endurance and performance capacity",
      ],
      keywords: ["exercise", "fatigue", "endurance", "performance", "training", "lactate", "creatine kinase", "CK", "muscle", "muscle damage"],
      link: "/explore-by-body-system/musculoskeletal-system",
    },
  ];

  const quickFacts = [
    "Hydrogen is the smallest and lightest molecule, allowing it to diffuse rapidly throughout the body",
    "It can cross biological membranes and distribute widely, including into cells",
    "Studied for its role in supporting oxidative balance and cellular signaling",
    "Modern biomedical interest accelerated following a landmark 2007 paper in Nature Medicine",
    "Demonstrated a strong safety profile across a wide range of studied concentrations",
    "Investigated through multiple delivery methods, including dissolved in water, inhaled gas, and topical applications",
  ];

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
      link: "/hydrogen-basics",
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
      link: "/explore-by-benefit",
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
      link: "/explore-by-mechanism",
      difficulty: "Advanced",
    },
    {
      id: "delivery-methods",
      title: "Delivery Methods",
      description:
        "Learn about different ways to consume hydrogen for health benefits",
      icon: <Zap className="h-8 w-8 text-green-600" />,
      topics: ["Hydrogen water", "Inhalation therapy", "Hydrogen baths"],
      link: "/explore-by-delivery-method",
      difficulty: "Beginner",
    },
  ];

  return (
    <>
      <Helmet>
        <title>
          Learn the Basics of Molecular Hydrogen and Health
        </title>
        <meta
          name="description"
          content="Learn how molecular hydrogen interacts with the body. Explore research-backed insights on heart health, brain function, oxidative stress, and athletic performance."
        />
        <meta property="og:title" content="Learn the Basics of Molecular Hydrogen and Health" />
        <meta property="og:description" content="Learn how molecular hydrogen interacts with the body. Explore research-backed insights." />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://hydrogenstudies.com/benefits" />
        <link rel="canonical" href="https://hydrogenstudies.com/benefits" />
      </Helmet>
      <JsonLd
        type="FAQPage"
        data={generateFaqSchema([
          { question: "What is molecular hydrogen?", answer: "Molecular hydrogen (H2) is the smallest and lightest molecule in existence. It can cross biological membranes and distribute widely throughout the body, where it has been studied for its role in supporting oxidative balance and cellular signaling." },
          { question: "How does molecular hydrogen interact with the body?", answer: "Hydrogen works through multiple mechanisms: it interacts with reactive species to help regulate oxidative balance, acts as a signaling molecule influencing stress response and inflammation pathways, and helps modulate inflammatory signaling to support a balanced immune response." },
          { question: "Is molecular hydrogen safe?", answer: "Molecular hydrogen has demonstrated a strong safety profile across a wide range of studied concentrations, with no reported toxic effects in human studies." },
          { question: "What are the delivery methods for molecular hydrogen?", answer: "Molecular hydrogen can be delivered through multiple methods including hydrogen-rich water (the most widely studied), hydrogen gas inhalation, hydrogen bathing, and hydrogen-releasing compounds like magnesium tablets." },
        ])}
      />

      <SiteHeader />

      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-white border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <PageBreadcrumb items={[
              { label: "Home", href: "/" },
              { label: "Learn" },
            ]} />
            <div className="text-center">
              <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
                Learn the Basics of Molecular Hydrogen and Health
              </h1>
              <p className="text-xl text-gray-600 max-w-3xl mx-auto mb-8">
                Discover what peer-reviewed research reveals about how molecular
                hydrogen interacts with the body and its potential biological effects.
              </p>

              {/* Did You Know Facts */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8 text-left">
                {didYouKnow.map((item, index) => (
                  <Card
                    key={index}
                    className="border-none shadow-md hover:shadow-lg transition-shadow"
                  >
                    <CardContent className="p-5">
                      <div className="flex items-start gap-3">
                        <span className="text-2xl flex-shrink-0">{item.emoji}</span>
                        <div>
                          <p className="font-semibold text-gray-900 text-sm mb-1">
                            Did you know? {item.title}
                          </p>
                          <p className="text-xs text-gray-600 leading-relaxed">
                            {item.fact}
                          </p>
                        </div>
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
                          <Lightbulb className="h-5 w-5 text-amber-500" />
                          Keywords
                        </h3>
                        <div className="flex flex-wrap gap-2">
                          {category.keywords.map((keyword, index) => (
                            <Badge key={index} variant="outline" className="text-xs">
                              {keyword}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="mt-8 pt-6 border-t">
                      <Link href={category.link}>
                        <Button>
                          Browse {category.title} Studies
                          <ChevronRight className="ml-2 h-4 w-4" />
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
                Quick Facts About Molecular Hydrogen
              </CardTitle>
              <CardDescription className="text-lg max-w-3xl mx-auto">
                Key insights from scientific research on molecular hydrogen.
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

          {/* How It Works Section */}
          <Card className="mb-16">
            <CardHeader className="text-center">
              <CardTitle className="text-3xl mb-4">
                How Molecular Hydrogen Interacts with the Body
              </CardTitle>
              <CardDescription className="text-lg max-w-3xl mx-auto">
                Key mechanisms identified across peer-reviewed research.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-3 gap-8">
                <div className="text-center">
                  <div className="mx-auto mb-4 p-4 rounded-full bg-teal-100 w-fit">
                    <Activity className="h-8 w-8 text-teal-600" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">
                    Redox Modulation
                  </h3>
                  <p className="text-gray-600">
                    Molecular hydrogen interacts with reactive species and helps
                    regulate oxidative balance, both through direct reactions and
                    by influencing the body's own antioxidant systems.
                  </p>
                </div>
                <div className="text-center">
                  <div className="mx-auto mb-4 p-4 rounded-full bg-green-100 w-fit">
                    <Shield className="h-8 w-8 text-green-600" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">
                    Cellular Signaling & Gene Expression
                  </h3>
                  <p className="text-gray-600">
                    Hydrogen acts as a signaling molecule, influencing pathways
                    involved in stress response, inflammation, and cellular
                    protection.
                  </p>
                </div>
                <div className="text-center">
                  <div className="mx-auto mb-4 p-4 rounded-full bg-purple-100 w-fit">
                    <Zap className="h-8 w-8 text-purple-600" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">
                    Inflammatory Regulation
                  </h3>
                  <p className="text-gray-600">
                    Hydrogen has been shown to help modulate inflammatory signaling,
                    supporting a balanced immune response across different tissues.
                  </p>
                </div>
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
                  <Link key={topic.id} href={topic.link}>
                    <Card
                      className="hover:shadow-lg transition-shadow border-2 hover:border-teal-200 h-full cursor-pointer"
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
                          <div className="flex items-center justify-end pt-4 border-t">
                            <div className="flex items-center text-teal-600 font-medium">
                              Explore research <ChevronRight className="h-4 w-4 ml-1" />
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* CTA Section */}
          <Card className="bg-gradient-to-r from-teal-600 to-teal-500 text-white">
            <CardContent className="p-12 text-center">
              <h2 className="text-3xl font-bold mb-4">
                Explore the Research Yourself
              </h2>
              <p className="text-xl mb-8 opacity-90 max-w-2xl mx-auto">
                Search our database of peer-reviewed hydrogen studies by health condition,
                delivery method, or keyword.
              </p>
              <Link href="/studies">
                <Button variant="secondary" size="lg">
                  Browse All Studies
                  <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
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
