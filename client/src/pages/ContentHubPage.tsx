import { useParams, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
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
  BookOpen,
  Search,
  ArrowRight,
  FlaskConical,
  ExternalLink,
  Loader2,
} from "lucide-react";
import { Helmet } from "react-helmet";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import SiteHeader from "@/components/layout/SiteHeader";
import Footer from "@/components/layout/Footer";
import PageBreadcrumb from "@/components/seo/PageBreadcrumb";
import JsonLd from "@/components/seo/JsonLd";

// Topic configuration mapping slugs to display data
const TOPIC_CONFIG: Record<
  string,
  {
    title: string;
    searchQuery: string;
    description: string;
    icon: React.ReactNode;
    color: string;
    intro: string;
  }
> = {
  "heart-health": {
    title: "Hydrogen & Heart Health",
    searchQuery: "cardiovascular heart",
    description:
      "Explore how molecular hydrogen research is advancing cardiovascular health, including studies on heart disease, blood pressure, and vascular function.",
    icon: <Heart className="h-8 w-8" />,
    color: "text-red-600",
    intro:
      "Cardiovascular disease remains the leading cause of death globally. Molecular hydrogen has emerged as a promising research area for heart health, with studies exploring its effects on oxidative stress in cardiac tissue, blood pressure regulation, and vascular endothelial function. Explore the latest peer-reviewed research below.",
  },
  "brain-health": {
    title: "Hydrogen & Brain Health",
    searchQuery: "brain cognitive neurological",
    description:
      "Discover research on molecular hydrogen's potential neuroprotective effects, including studies on cognitive function, neurodegeneration, and brain health.",
    icon: <Brain className="h-8 w-8" />,
    color: "text-purple-600",
    intro:
      "The brain is particularly vulnerable to oxidative stress due to its high oxygen consumption. Researchers are investigating how molecular hydrogen may support neuroprotection, cognitive function, and neurological health. Browse the growing body of peer-reviewed studies on hydrogen and brain health.",
  },
  "athletic-performance": {
    title: "Hydrogen & Athletic Performance",
    searchQuery: "exercise athlete",
    description:
      "Research on molecular hydrogen for exercise performance, recovery, muscle fatigue, and sports science applications.",
    icon: <Zap className="h-8 w-8" />,
    color: "text-yellow-600",
    intro:
      "Athletes and fitness enthusiasts are increasingly interested in molecular hydrogen for its potential to reduce exercise-induced oxidative stress, support faster recovery, and improve athletic performance. Explore studies examining hydrogen's effects on muscle fatigue, lactate levels, and endurance.",
  },
  "anti-aging": {
    title: "Hydrogen & Anti-Aging",
    searchQuery: "aging longevity",
    description:
      "Studies on molecular hydrogen's role in longevity, cellular aging, telomere health, and age-related disease prevention.",
    icon: <Clock className="h-8 w-8" />,
    color: "text-amber-600",
    intro:
      "Aging is closely linked to accumulated oxidative damage at the cellular level. Molecular hydrogen research in longevity science examines how this selective antioxidant may influence cellular senescence, mitochondrial function, and age-related biomarkers. Review the latest findings below.",
  },
  "gut-health": {
    title: "Hydrogen & Gut Health",
    searchQuery: "digestive gut gastrointestinal",
    description:
      "Research exploring molecular hydrogen's effects on digestive health, gut microbiome, intestinal inflammation, and gastrointestinal conditions.",
    icon: <Droplets className="h-8 w-8" />,
    color: "text-green-600",
    intro:
      "The gut plays a central role in overall health, from nutrient absorption to immune function. Studies are investigating how molecular hydrogen may support gastrointestinal health, influence the gut microbiome, and address intestinal inflammation. Explore the research connecting hydrogen to digestive wellness.",
  },
  diabetes: {
    title: "Hydrogen & Diabetes",
    searchQuery: "diabetes metabolic",
    description:
      "Peer-reviewed studies on molecular hydrogen and metabolic health, including diabetes management, insulin sensitivity, and blood sugar regulation.",
    icon: <Flame className="h-8 w-8" />,
    color: "text-orange-600",
    intro:
      "Metabolic syndrome and diabetes affect hundreds of millions worldwide. Researchers are exploring how molecular hydrogen may influence insulin sensitivity, glucose metabolism, and oxidative stress markers associated with diabetes. Discover the latest studies in this critical health area.",
  },
  inflammation: {
    title: "Hydrogen & Inflammation",
    searchQuery: "inflammation anti-inflammatory",
    description:
      "Research on molecular hydrogen's anti-inflammatory properties, including studies on chronic inflammation, inflammatory biomarkers, and immune response.",
    icon: <Shield className="h-8 w-8" />,
    color: "text-blue-600",
    intro:
      "Chronic inflammation underlies many modern diseases, from arthritis to cardiovascular disease. Molecular hydrogen has shown promise as a selective modulator of inflammatory pathways. Explore peer-reviewed research examining hydrogen's effects on inflammatory biomarkers and immune response.",
  },
  "cancer-research": {
    title: "Hydrogen & Cancer Research",
    searchQuery: "cancer tumor",
    description:
      "Scientific studies exploring molecular hydrogen in cancer research, including tumor biology, treatment side effects, and supportive care.",
    icon: <Ribbon className="h-8 w-8" />,
    color: "text-pink-600",
    intro:
      "Cancer research is exploring molecular hydrogen from multiple angles, including its potential to mitigate treatment side effects, modulate oxidative stress in tumor microenvironments, and support quality of life during therapy. Browse the peer-reviewed studies in this developing field.",
  },
  "skin-health": {
    title: "Hydrogen & Skin Health",
    searchQuery: "skin dermatological",
    description:
      "Studies on molecular hydrogen for skin health, including UV protection, wound healing, dermatological conditions, and skin aging.",
    icon: <Sparkles className="h-8 w-8" />,
    color: "text-rose-500",
    intro:
      "The skin is the body's largest organ and a frontline defense against environmental stressors. Research is investigating how molecular hydrogen may support skin health through UV protection, wound healing acceleration, and reduction of dermatological inflammation. Review the studies below.",
  },
  respiratory: {
    title: "Hydrogen & Respiratory Health",
    searchQuery: "respiratory lung",
    description:
      "Research on molecular hydrogen for respiratory health, including lung function, airway inflammation, and pulmonary conditions.",
    icon: <Wind className="h-8 w-8" />,
    color: "text-cyan-600",
    intro:
      "Respiratory health is essential for overall wellbeing, and molecular hydrogen is being studied for its potential to support lung function and modulate airway inflammation. Explore the growing collection of studies on hydrogen and respiratory health conditions.",
  },
};

// Type definitions
interface Study {
  id: number;
  title: string;
  abstract?: string;
  category?: string;
  publishDate?: string;
  journal?: string;
  authors?: string;
  slug?: string;
  imageUrl?: string;
}

interface BlogArticle {
  id: number;
  title: string;
  summary?: string;
  slug?: string;
  imageUrl?: string;
  articleType?: string;
  createdAt?: string;
  isPublished?: boolean;
}

export default function ContentHubPage() {
  const params = useParams<{ topic: string }>();
  const topic = params.topic || "";
  const config = TOPIC_CONFIG[topic];

  // Fetch related studies
  const { data: studyData, isLoading: studiesLoading } = useQuery<{
    studies: Study[];
    total: number;
  }>({
    queryKey: ["/api/unified-search", { q: config?.searchQuery, limit: 10 }],
    queryFn: async () => {
      if (!config) return { studies: [], total: 0 };
      const params = new URLSearchParams({
        q: config.searchQuery,
        limit: "10",
      });
      const res = await fetch(`/api/unified-search?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch studies");
      return res.json();
    },
    enabled: !!config,
    staleTime: 5 * 60 * 1000,
  });

  // Fetch related blog articles
  const { data: blogData, isLoading: blogsLoading } = useQuery<{
    data: BlogArticle[];
    total: number;
  }>({
    queryKey: ["/api/blogs", { search: config?.searchQuery, limit: 6 }],
    queryFn: async () => {
      if (!config) return { data: [], total: 0 };
      const params = new URLSearchParams({
        search: config.searchQuery,
        limit: "6",
        filterStatus: "published",
      });
      const res = await fetch(`/api/blogs?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch blogs");
      return res.json();
    },
    enabled: !!config,
    staleTime: 5 * 60 * 1000,
  });

  const studies = studyData?.studies || [];
  const blogs = (blogData?.data || []).filter((b) => b.isPublished !== false);
  const totalStudies = studyData?.total || 0;

  // Get other hub topics for cross-linking
  const otherHubs = Object.entries(TOPIC_CONFIG)
    .filter(([slug]) => slug !== topic)
    .slice(0, 6);

  // 404 for unknown topics
  if (!config) {
    return (
      <div className="min-h-screen bg-gray-50">
        <SiteHeader />
        <div className="max-w-4xl mx-auto px-4 py-20 text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            Topic Not Found
          </h1>
          <p className="text-gray-600 mb-8">
            The research hub you're looking for doesn't exist yet.
          </p>
          <Link href="/hub">
            <Button>Browse All Research Hubs</Button>
          </Link>
        </div>
        <Footer />
      </div>
    );
  }

  const canonicalUrl = `https://hydrogenstudies.com/hub/${topic}`;

  return (
    <div className="min-h-screen bg-gray-50">
      <Helmet>
        <title>{config.title} | Research Hub - Hydrogen Studies</title>
        <meta name="description" content={config.description} />
        <link rel="canonical" href={canonicalUrl} />
        <meta
          property="og:title"
          content={`${config.title} | Research Hub - Hydrogen Studies`}
        />
        <meta property="og:description" content={config.description} />
        <meta property="og:url" content={canonicalUrl} />
        <meta property="og:type" content="website" />
        <meta
          property="og:site_name"
          content="Hydrogen Studies"
        />
        <meta name="twitter:card" content="summary_large_image" />
        <meta
          name="twitter:title"
          content={`${config.title} | Research Hub`}
        />
        <meta name="twitter:description" content={config.description} />
      </Helmet>

      <JsonLd
        type="WebPage"
        data={{
          name: config.title,
          description: config.description,
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
                item: "https://hydrogenstudies.com/hub",
              },
              {
                "@type": "ListItem",
                position: 3,
                name: config.title,
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
          items={[
            { label: "Home", href: "/" },
            { label: "Research Hubs", href: "/hub" },
            { label: config.title },
          ]}
        />

        {/* Hero Section */}
        <section className="mt-8 mb-12">
          <div className="bg-white rounded-2xl shadow-sm border p-8 md:p-12">
            <div className="flex items-start gap-4 mb-6">
              <div
                className={`p-3 rounded-xl bg-gray-50 ${config.color} shrink-0`}
              >
                {config.icon}
              </div>
              <div>
                <h1 className="text-3xl md:text-4xl font-bold text-gray-900">
                  {config.title}
                </h1>
                {totalStudies > 0 && (
                  <p className="text-sm text-gray-500 mt-2">
                    {totalStudies} studies found in our database
                  </p>
                )}
              </div>
            </div>
            <p className="text-lg text-gray-600 leading-relaxed max-w-4xl">
              {config.intro}
            </p>
          </div>
        </section>

        {/* Key Research Findings */}
        <section className="mb-12">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <FlaskConical className="h-6 w-6 text-teal-600" />
              Key Research Findings
            </h2>
            {totalStudies > 10 && (
              <Link
                href={`/search?q=${encodeURIComponent(config.searchQuery)}`}
              >
                <Button variant="outline" size="sm">
                  View All {totalStudies} Studies
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            )}
          </div>

          {studiesLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
              <span className="ml-3 text-gray-600">
                Loading research studies...
              </span>
            </div>
          ) : studies.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2">
              {studies.map((study) => (
                <Card
                  key={study.id}
                  className="hover:shadow-md transition-shadow"
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-base leading-snug">
                        <Link
                          href={
                            study.slug
                              ? `/study/${study.slug}`
                              : `/study/id/${study.id}`
                          }
                          className="hover:text-teal-600 transition-colors"
                        >
                          {study.title}
                        </Link>
                      </CardTitle>
                    </div>
                    {study.category && (
                      <Badge variant="secondary" className="w-fit text-xs">
                        {study.category}
                      </Badge>
                    )}
                  </CardHeader>
                  <CardContent>
                    {study.abstract && (
                      <CardDescription className="line-clamp-3 text-sm">
                        {study.abstract}
                      </CardDescription>
                    )}
                    <div className="flex items-center gap-3 mt-3 text-xs text-gray-500">
                      {study.journal && <span>{study.journal}</span>}
                      {study.publishDate && (
                        <span>
                          {new Date(study.publishDate).getFullYear()}
                        </span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="p-8 text-center">
              <p className="text-gray-500">
                No studies found for this topic yet. Try{" "}
                <Link
                  href={`/search?q=${encodeURIComponent(config.searchQuery)}`}
                  className="text-teal-600 hover:underline"
                >
                  searching our full database
                </Link>
                .
              </p>
            </Card>
          )}
        </section>

        {/* Related Articles */}
        {blogs.length > 0 && (
          <section className="mb-12">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <BookOpen className="h-6 w-6 text-teal-600" />
                Related Articles
              </h2>
              <Link href="/blog">
                <Button variant="outline" size="sm">
                  All Articles
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </div>

            {blogsLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {blogs.map((blog) => (
                  <Card
                    key={blog.id}
                    className="hover:shadow-md transition-shadow"
                  >
                    {blog.imageUrl && (
                      <div className="aspect-video overflow-hidden rounded-t-lg">
                        <img
                          src={blog.imageUrl}
                          alt={blog.title}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      </div>
                    )}
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base leading-snug">
                        <Link
                          href={
                            blog.slug
                              ? `/blog/${blog.id}/${blog.slug}`
                              : `/blog/${blog.id}`
                          }
                          className="hover:text-teal-600 transition-colors"
                        >
                          {blog.title}
                        </Link>
                      </CardTitle>
                      {blog.articleType && (
                        <Badge variant="outline" className="w-fit text-xs">
                          {blog.articleType.replace(/-/g, " ")}
                        </Badge>
                      )}
                    </CardHeader>
                    {blog.summary && (
                      <CardContent>
                        <CardDescription className="line-clamp-2 text-sm">
                          {blog.summary}
                        </CardDescription>
                      </CardContent>
                    )}
                  </Card>
                ))}
              </div>
            )}
          </section>
        )}

        {/* Explore More */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">
            Explore More
          </h2>
          <div className="grid gap-4 md:grid-cols-3">
            {/* Search CTA */}
            <Card className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Search className="h-5 w-5 text-teal-600" />
                  <CardTitle className="text-base">Search Studies</CardTitle>
                </div>
                <CardDescription>
                  Search our database of peer-reviewed hydrogen studies.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Link
                  href={`/search?q=${encodeURIComponent(config.searchQuery)}`}
                >
                  <Button variant="outline" className="w-full" size="sm">
                    Search Database
                    <ChevronRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              </CardContent>
            </Card>

            {/* Explore by Condition */}
            <Card className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <FlaskConical className="h-5 w-5 text-teal-600" />
                  <CardTitle className="text-base">
                    Browse by Condition
                  </CardTitle>
                </div>
                <CardDescription>
                  Explore studies organized by health condition and body system.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Link href="/explore-by-condition">
                  <Button variant="outline" className="w-full" size="sm">
                    Explore Conditions
                    <ChevronRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              </CardContent>
            </Card>

            {/* Other Hubs */}
            <Card className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <BookOpen className="h-5 w-5 text-teal-600" />
                  <CardTitle className="text-base">Research Hubs</CardTitle>
                </div>
                <CardDescription>
                  Explore our other topic-focused research hubs.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Link href="/hub">
                  <Button variant="outline" className="w-full" size="sm">
                    All Hubs
                    <ChevronRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>

          {/* Other Hub Links */}
          {otherHubs.length > 0 && (
            <div className="mt-6">
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
                Other Research Hubs
              </h3>
              <div className="flex flex-wrap gap-2">
                {otherHubs.map(([slug, hub]) => (
                  <Link key={slug} href={`/hub/${slug}`}>
                    <Badge
                      variant="outline"
                      className="cursor-pointer hover:bg-teal-50 hover:border-teal-300 transition-colors py-1.5 px-3"
                    >
                      {hub.title.replace("Hydrogen & ", "")}
                    </Badge>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* CTA Section */}
        <section className="mb-12">
          <div className="bg-gradient-to-r from-teal-600 to-cyan-600 rounded-2xl p-8 md:p-12 text-white text-center">
            <h2 className="text-2xl md:text-3xl font-bold mb-4">
              Experience Hydrogen Water
            </h2>
            <p className="text-lg text-white/90 max-w-2xl mx-auto mb-6">
              Discover Echo Water's hydrogen water systems, backed by the
              research you've explored above. Premium molecular hydrogen
              technology for your home.
            </p>
            <a
              href="https://www.echowater.com"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button
                size="lg"
                className="bg-white text-teal-700 hover:bg-gray-100"
              >
                Shop Echo Water Products
                <ExternalLink className="ml-2 h-4 w-4" />
              </Button>
            </a>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
