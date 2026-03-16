import { Link } from "wouter";
import {
  Heart,
  Brain,
  Zap,
  Clock,
  Droplets,
  Flame,
  Shield,
  Ribbon,
  Sparkles,
  Wind,
  ChevronRight,
  FlaskConical,
} from "lucide-react";
import { Helmet } from "react-helmet";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import SiteHeader from "@/components/layout/SiteHeader";
import Footer from "@/components/layout/Footer";
import PageBreadcrumb from "@/components/seo/PageBreadcrumb";
import JsonLd from "@/components/seo/JsonLd";

const HUBS = [
  {
    slug: "heart-health",
    title: "Heart Health",
    description:
      "Research on molecular hydrogen and cardiovascular health, blood pressure, and vascular function.",
    icon: <Heart className="h-7 w-7" />,
    color: "text-red-600",
    bgColor: "bg-red-50",
    borderColor: "border-red-200",
  },
  {
    slug: "brain-health",
    title: "Brain Health",
    description:
      "Studies on neuroprotection, cognitive function, and neurological conditions.",
    icon: <Brain className="h-7 w-7" />,
    color: "text-purple-600",
    bgColor: "bg-purple-50",
    borderColor: "border-purple-200",
  },
  {
    slug: "athletic-performance",
    title: "Athletic Performance",
    description:
      "Research on exercise performance, recovery, muscle fatigue, and sports science.",
    icon: <Zap className="h-7 w-7" />,
    color: "text-yellow-600",
    bgColor: "bg-yellow-50",
    borderColor: "border-yellow-200",
  },
  {
    slug: "anti-aging",
    title: "Anti-Aging",
    description:
      "Studies on longevity, cellular aging, and age-related disease prevention.",
    icon: <Clock className="h-7 w-7" />,
    color: "text-amber-600",
    bgColor: "bg-amber-50",
    borderColor: "border-amber-200",
  },
  {
    slug: "gut-health",
    title: "Gut Health",
    description:
      "Research on digestive health, gut microbiome, and gastrointestinal conditions.",
    icon: <Droplets className="h-7 w-7" />,
    color: "text-green-600",
    bgColor: "bg-green-50",
    borderColor: "border-green-200",
  },
  {
    slug: "diabetes",
    title: "Diabetes",
    description:
      "Studies on metabolic health, insulin sensitivity, and blood sugar regulation.",
    icon: <Flame className="h-7 w-7" />,
    color: "text-orange-600",
    bgColor: "bg-orange-50",
    borderColor: "border-orange-200",
  },
  {
    slug: "inflammation",
    title: "Inflammation",
    description:
      "Research on anti-inflammatory properties, chronic inflammation, and immune response.",
    icon: <Shield className="h-7 w-7" />,
    color: "text-blue-600",
    bgColor: "bg-blue-50",
    borderColor: "border-blue-200",
  },
  {
    slug: "cancer-research",
    title: "Cancer Research",
    description:
      "Studies on hydrogen in cancer biology, treatment side effects, and supportive care.",
    icon: <Ribbon className="h-7 w-7" />,
    color: "text-pink-600",
    bgColor: "bg-pink-50",
    borderColor: "border-pink-200",
  },
  {
    slug: "skin-health",
    title: "Skin Health",
    description:
      "Research on UV protection, wound healing, and dermatological conditions.",
    icon: <Sparkles className="h-7 w-7" />,
    color: "text-rose-500",
    bgColor: "bg-rose-50",
    borderColor: "border-rose-200",
  },
  {
    slug: "respiratory",
    title: "Respiratory Health",
    description:
      "Studies on lung function, airway inflammation, and pulmonary conditions.",
    icon: <Wind className="h-7 w-7" />,
    color: "text-cyan-600",
    bgColor: "bg-cyan-50",
    borderColor: "border-cyan-200",
  },
];

const canonicalUrl = "https://hydrogenstudies.com/hub";

export default function ContentHubIndexPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Helmet>
        <title>
          Research Hubs - Molecular Hydrogen Health Topics | Hydrogen Studies
        </title>
        <meta
          name="description"
          content="Explore comprehensive research hubs on molecular hydrogen health topics. Browse curated studies and articles on heart health, brain health, athletic performance, anti-aging, and more."
        />
        <link rel="canonical" href={canonicalUrl} />
        <meta
          property="og:title"
          content="Research Hubs - Molecular Hydrogen Health Topics | Hydrogen Studies"
        />
        <meta
          property="og:description"
          content="Explore comprehensive research hubs on molecular hydrogen health topics. Browse curated studies and articles organized by health area."
        />
        <meta property="og:url" content={canonicalUrl} />
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="Hydrogen Studies" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta
          name="twitter:title"
          content="Research Hubs | Hydrogen Studies"
        />
        <meta
          name="twitter:description"
          content="Explore comprehensive research hubs on molecular hydrogen health topics."
        />
      </Helmet>

      <JsonLd
        type="WebPage"
        data={{
          name: "Research Hubs - Molecular Hydrogen Health Topics",
          description:
            "Explore comprehensive research hubs on molecular hydrogen health topics. Browse curated studies and articles organized by health area.",
          url: canonicalUrl,
          isPartOf: {
            "@type": "WebSite",
            name: "Hydrogen Studies",
            url: "https://hydrogenstudies.com",
          },
          breadcrumb: {
            "@type": "BreadcrumbList",
            itemListElement: [
              {
                "@type": "ListItem",
                position: 1,
                name: "Home",
                item: "https://hydrogenstudies.com",
              },
              {
                "@type": "ListItem",
                position: 2,
                name: "Research Hubs",
                item: canonicalUrl,
              },
            ],
          },
        }}
      />

      <SiteHeader />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Breadcrumb */}
        <PageBreadcrumb
          items={[{ label: "Home", href: "/" }, { label: "Research Hubs" }]}
        />

        {/* Hero Section */}
        <section className="mt-8 mb-12">
          <div className="bg-white rounded-2xl shadow-sm border p-8 md:p-12 text-center">
            <div className="flex justify-center mb-4">
              <div className="p-3 rounded-xl bg-teal-50 text-teal-600">
                <FlaskConical className="h-10 w-10" />
              </div>
            </div>
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Hydrogen Research Hubs
            </h1>
            <p className="text-lg text-gray-600 max-w-3xl mx-auto">
              Explore our comprehensive research hubs, each focused on a major
              health topic. Every hub aggregates peer-reviewed studies, blog
              articles, and educational content to give you a complete picture of
              molecular hydrogen research in that area.
            </p>
          </div>
        </section>

        {/* Hub Cards Grid */}
        <section className="mb-12">
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {HUBS.map((hub) => (
              <Link key={hub.slug} href={`/hub/${hub.slug}`}>
                <Card
                  className={`h-full hover:shadow-lg transition-all duration-200 cursor-pointer border ${hub.borderColor} hover:scale-[1.02]`}
                >
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      <div
                        className={`p-2.5 rounded-lg ${hub.bgColor} ${hub.color} shrink-0`}
                      >
                        {hub.icon}
                      </div>
                      <CardTitle className="text-lg">
                        Hydrogen & {hub.title}
                      </CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <CardDescription className="text-sm leading-relaxed">
                      {hub.description}
                    </CardDescription>
                    <div className="mt-4 flex items-center text-teal-600 text-sm font-medium">
                      Explore Research
                      <ChevronRight className="ml-1 h-4 w-4" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </section>

        {/* Additional Navigation */}
        <section className="mb-12">
          <div className="bg-white rounded-2xl shadow-sm border p-8 text-center">
            <h2 className="text-xl font-bold text-gray-900 mb-3">
              Looking for something specific?
            </h2>
            <p className="text-gray-600 mb-6 max-w-2xl mx-auto">
              Use our advanced search to find specific studies, or browse by
              condition, body system, or delivery method.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <Link href="/search">
                <Button variant="default">
                  Search Studies
                  <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <Link href="/explore-by-condition">
                <Button variant="outline">Browse by Condition</Button>
              </Link>
              <Link href="/explore-by-body-system">
                <Button variant="outline">Browse by Body System</Button>
              </Link>
              <Link href="/explore-by-delivery-method">
                <Button variant="outline">Browse by Delivery Method</Button>
              </Link>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
