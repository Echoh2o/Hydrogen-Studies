import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Helmet } from "react-helmet";
import JsonLd from "@/components/seo/JsonLd";
import { useQuery } from "@tanstack/react-query";
import {
  Search,
  Droplets,
  Heart,
  Brain,
  Shield,
  Zap,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Footer from "@/components/layout/Footer";
import SiteHeader from "@/components/layout/SiteHeader";
import JsonLd, { generateOrganizationSchema, generateFaqSchema } from "@/components/seo/JsonLd";

export default function HomePage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [, navigate] = useLocation();

  const { data: siteStats } = useQuery<{
    totalStudies: number;
    countries: number;
    humanTrials: number;
    yearsOfResearch: number;
    peerReviewedPct: number;
  }>({
    queryKey: ["/api/public-stats"],
    staleTime: 5 * 60 * 1000,
  });

  const { data: categoryStats } = useQuery<Record<string, any>>({
    queryKey: ["/api/consumer-categories/counts"],
    staleTime: 5 * 60 * 1000,
  });

  // Derive dynamic study counts from API data
  const getStudyCount = (systemName: string, fallback: string) => {
    const count = categoryStats?.data?.body_system?.find(
      (s: any) => s.name === systemName
    )?.count;
    return count ? `${count} studies` : fallback;
  };

  const benefits = [
    {
      icon: <Heart className="h-8 w-8 text-red-500" />,
      title: "Heart Health",
      description:
        "Studies show hydrogen water may support cardiovascular function and reduce oxidative stress on heart tissue.",
      studyCount: getStudyCount("Cardiovascular System", "47 studies"),
    },
    {
      icon: <Brain className="h-8 w-8 text-teal-500" />,
      title: "Brain Function",
      description:
        "Research indicates potential cognitive benefits and neuroprotective effects from molecular hydrogen.",
      studyCount: getStudyCount("Nervous System", "32 studies"),
    },
    {
      icon: <Shield className="h-8 w-8 text-green-500" />,
      title: "Antioxidant Power",
      description:
        "Hydrogen acts as a selective antioxidant, targeting harmful free radicals while preserving beneficial ones.",
      studyCount: getStudyCount("Immune System", "89 studies"),
    },
    {
      icon: <Zap className="h-8 w-8 text-yellow-500" />,
      title: "Energy & Recovery",
      description:
        "Athletes report improved performance and faster recovery times with hydrogen water supplementation.",
      studyCount: getStudyCount("Musculoskeletal System", "23 studies"),
    },
  ];

  const stats = [
    { number: siteStats ? siteStats.totalStudies.toLocaleString() : "1,300+", label: "Scientific Studies" },
    { number: siteStats ? `${siteStats.countries}+` : "25+", label: "Countries Researching" },
    { number: siteStats ? siteStats.humanTrials.toLocaleString() : "300+", label: "Human Clinical Trials" },
    { number: siteStats ? `${siteStats.yearsOfResearch}+` : "15+", label: "Years of Research" },
  ];

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/search?search=${encodeURIComponent(searchQuery)}`);
    }
  };

  return (
    <div className="min-h-screen bg-white">
      <Helmet>
        <title>Hydrogen Studies - Science-Backed Hydrogen Health Research</title>
        <meta name="description" content="Explore peer-reviewed research on hydrogen therapy, hydrogen water, and molecular hydrogen health benefits. Browse hundreds of scientific studies." />
        <meta property="og:title" content="Hydrogen Studies - Science-Backed Hydrogen Health Research" />
        <meta property="og:description" content="Explore peer-reviewed research on hydrogen therapy, hydrogen water, and molecular hydrogen health benefits. Browse hundreds of scientific studies." />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://hydrogenstudies.com" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Hydrogen Studies - Science-Backed Hydrogen Health Research" />
        <meta name="twitter:description" content="Explore peer-reviewed research on hydrogen therapy, hydrogen water, and molecular hydrogen health benefits." />
        <link rel="canonical" href="https://hydrogenstudies.com" />
      </Helmet>
      <JsonLd
        type="Organization"
        data={generateOrganizationSchema({
          name: "Hydrogen Studies",
          url: "https://hydrogenstudies.com",
          logo: "https://hydrogenstudies.com/logo.png",
          description: "The most comprehensive database of peer-reviewed molecular hydrogen health research. Powered by Echo Water.",
          socialLinks: ["https://echowater.com"],
        })}
      />
      <JsonLd
        type="WebSite"
        data={{
          name: "Hydrogen Studies",
          url: "https://hydrogenstudies.com",
          description: "Science-backed hydrogen health research database powered by Echo Water",
          potentialAction: {
            "@type": "SearchAction",
            target: "https://hydrogenstudies.com/search?search={search_term_string}",
          description: "Comprehensive database of peer-reviewed research on molecular hydrogen therapy and hydrogen water health benefits.",
          potentialAction: {
            "@type": "SearchAction",
            target: "https://hydrogenstudies.com/search?q={search_term_string}",
            "query-input": "required name=search_term_string",
          },
        }}
      />
      <JsonLd
        type="Organization"
        data={{
          name: "Hydrogen Studies",
          url: "https://hydrogenstudies.com",
          logo: "https://hydrogenstudies.com/logo.png",
          description: "Science-backed hydrogen health research database featuring peer-reviewed studies on molecular hydrogen therapy.",
        }}
      />
      <SiteHeader />

      {/* Hero Section */}
      <section className="relative py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h1 className="text-4xl md:text-6xl font-bold text-gray-900 mb-6">
              Discover the Science Behind
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-600 to-cyan-600 block">
                Hydrogen Water
              </span>
            </h1>
            <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
              Molecular hydrogen has been studied in {siteStats ? `over ${siteStats.totalStudies.toLocaleString()} peer-reviewed papers across ${siteStats.countries}+ countries` : "over 1,000 peer-reviewed papers across 25+ countries"}.
              {" "}Here's what the science actually says.
            </p>

            {/* Search Bar */}
            <form onSubmit={handleSearch} className="max-w-2xl mx-auto mb-8">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
                <Input
                  type="text"
                  placeholder="Search studies by condition, benefit, or keyword..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-12 pr-4 py-4 text-lg rounded-full border-2 border-gray-200 focus:border-teal-500 shadow-lg"
                />
                <button
                  type="submit"
                  className="btn-primary btn-rounded-full absolute right-2 top-1/2 transform -translate-y-1/2"
                >
                  Search
                </button>
              </div>
            </form>

            <div className="flex flex-wrap justify-center gap-4 mb-12">
              <Badge variant="outline" className="px-4 py-2">
                {siteStats ? `${siteStats.peerReviewedPct}% Peer-Reviewed` : "Peer-Reviewed Research"}
              </Badge>
              <Badge variant="outline" className="px-4 py-2">
                Updated Weekly
              </Badge>
              <Badge variant="outline" className="px-4 py-2">
                Free Access
              </Badge>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-20">
            {stats.map((stat, index) => (
              <Card
                key={index}
                className="text-center border-none shadow-lg bg-white/70 backdrop-blur-sm"
              >
                <CardContent className="p-6">
                  <div className="text-3xl font-bold text-teal-600 mb-2">
                    {stat.number}
                  </div>
                  <div className="text-sm text-gray-600">{stat.label}</div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Science-Backed Health Benefits
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Discover what thousands of peer-reviewed studies reveal about
              hydrogen water's potential to support your health and wellness
              goals.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 mb-12">
            {benefits.map((benefit, index) => {
              type BenefitTitle =
                | "Heart Health"
                | "Brain Function"
                | "Antioxidant Power"
                | "Energy & Recovery";

              const searchQueries: Record<BenefitTitle, string> = {
                "Heart Health": "cardiovascular heart",
                "Brain Function": "brain cognitive",
                "Antioxidant Power": "antioxidant oxidative",
                "Energy & Recovery": "exercise athlete",
              };

              const detailedBenefits: Record<BenefitTitle, string[]> = {
                "Heart Health": [
                  "May reduce blood pressure in hypertensive individuals",
                  "Potential improvement in arterial flexibility",
                  "Reduction in markers of cardiovascular inflammation",
                  "Support for healthy cholesterol levels",
                ],
                "Brain Function": [
                  "May improve cognitive function in elderly adults",
                  "Potential neuroprotective effects against oxidative damage",
                  "Support for mental clarity and focus",
                  "Possible benefits for neurodegenerative conditions",
                ],
                "Antioxidant Power": [
                  "Selective neutralization of hydroxyl radicals",
                  "Reduction in oxidative stress markers",
                  "Support for cellular protection",
                  "May help reduce inflammation",
                ],
                "Energy & Recovery": [
                  "Reduced exercise-induced fatigue",
                  "Faster recovery between training sessions",
                  "Decreased muscle damage markers",
                  "Improved endurance capacity",
                ],
              };

              const benefitTitle = benefit.title as BenefitTitle;
              return (
                <Link
                  key={index}
                  href={`/search?q=${encodeURIComponent(searchQueries[benefitTitle] || "")}`}
                  className="block h-full"
                >
                  <Card className="group hover:shadow-xl transition-all duration-300 border-none bg-gradient-to-br from-white to-gray-50 h-full cursor-pointer hover:scale-105">
                    <CardHeader className="text-center pb-4">
                      <div className="mx-auto mb-4 p-3 rounded-full bg-gray-50 group-hover:bg-white transition-colors">
                        {benefit.icon}
                      </div>
                      <CardTitle className="text-xl mb-2 group-hover:text-teal-600 transition-colors">
                        {benefit.title}
                      </CardTitle>
                      <Badge
                        variant="secondary"
                        className="mx-auto group-hover:bg-teal-100 group-hover:text-teal-700"
                      >
                        {benefit.studyCount}
                      </Badge>
                    </CardHeader>
                    <CardContent>
                      <CardDescription className="text-center text-gray-600 leading-relaxed mb-4">
                        {benefit.description}
                      </CardDescription>

                      {/* Detailed Benefits List */}
                      <div className="mb-4">
                        <h4 className="text-sm font-semibold text-gray-700 mb-3 text-center">
                          Potential Benefits
                        </h4>
                        <ul className="space-y-2">
                          {(detailedBenefits[benefitTitle] || []).map(
                            (benefitItem: string, benefitIndex: number) => (
                              <li
                                key={benefitIndex}
                                className="flex items-start gap-2 text-sm text-gray-600"
                              >
                                <div className="w-1.5 h-1.5 bg-teal-500 rounded-full mt-2 flex-shrink-0"></div>
                                <span>{benefitItem}</span>
                              </li>
                            ),
                          )}
                        </ul>
                      </div>

                      {/* Click to explore indicator */}
                      <div className="text-center pt-2">
                        <Badge
                          variant="outline"
                          className="group-hover:bg-teal-600 group-hover:text-white transition-colors"
                        >
                          Click to explore studies
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>

          <div className="text-center">
            <Link href="/benefits">
              <button className="btn-primary btn-lg btn-rounded-full btn-icon-right">
                Explore All Benefits
                <ChevronRight className="ml-2 h-4 w-4" />
              </button>
            </Link>
          </div>
        </div>
      </section>

      {/* Research Credibility */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-r from-teal-600 to-cyan-600 text-white">
        <div className="max-w-7xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-6">
            Trusted by Leading Research Institutions
          </h2>
          <p className="text-xl mb-12 opacity-90 max-w-3xl mx-auto">
            Our database includes studies from Harvard, Mayo Clinic, Tokyo
            Medical University, and hundreds of other prestigious institutions
            worldwide.
          </p>

          <div className="grid md:grid-cols-3 gap-8 mb-12">
            <Card className="bg-white/10 backdrop-blur-sm border-white/20 text-white">
              <CardContent className="p-8 text-center">
                <div className="text-3xl font-bold mb-2">{siteStats ? `${siteStats.countries}+` : "25+"}</div>
                <div className="text-lg opacity-90">Countries</div>
                <div className="text-sm opacity-70 mt-2">
                  Conducting hydrogen research
                </div>
              </CardContent>
            </Card>
            <Card className="bg-white/10 backdrop-blur-sm border-white/20 text-white">
              <CardContent className="p-8 text-center">
                <div className="text-3xl font-bold mb-2">{siteStats ? siteStats.humanTrials.toLocaleString() : "300+"}</div>
                <div className="text-lg opacity-90">Human Clinical Trials</div>
                <div className="text-sm opacity-70 mt-2">
                  Testing hydrogen on real patients
                </div>
              </CardContent>
            </Card>
            <Card className="bg-white/10 backdrop-blur-sm border-white/20 text-white">
              <CardContent className="p-8 text-center">
                <div className="text-3xl font-bold mb-2">{siteStats ? `${siteStats.peerReviewedPct}%` : "95%+"}</div>
                <div className="text-lg opacity-90">Peer-Reviewed</div>
                <div className="text-sm opacity-70 mt-2">
                  Studies in our database
                </div>
              </CardContent>
            </Card>
          </div>

          <Link href="/studies">
            <button className="btn-secondary btn-lg btn-rounded-full btn-icon-right bg-white/20 hover:bg-white/30 border-white text-white hover:text-white">
              Browse Research Database
              <ChevronRight className="ml-2 h-4 w-4" />
            </button>
          </Link>
        </div>
      </section>

      {/* Browse by Topic Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Browse Research by Topic
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Explore hydrogen therapy research organized by health condition, body system, or delivery method.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 mb-12">
            <Link href="/explore-by-condition" className="block">
              <Card className="hover:shadow-xl transition-all duration-300 cursor-pointer hover:scale-105 h-full">
                <CardContent className="p-8 text-center">
                  <Heart className="h-12 w-12 text-red-500 mx-auto mb-4" />
                  <CardTitle className="text-xl mb-2">By Health Condition</CardTitle>
                  <CardDescription>
                    Heart disease, diabetes, neurological conditions, cancer support, and more
                  </CardDescription>
                </CardContent>
              </Card>
            </Link>
            <Link href="/explore-by-body-system" className="block">
              <Card className="hover:shadow-xl transition-all duration-300 cursor-pointer hover:scale-105 h-full">
                <CardContent className="p-8 text-center">
                  <Brain className="h-12 w-12 text-teal-500 mx-auto mb-4" />
                  <CardTitle className="text-xl mb-2">By Body System</CardTitle>
                  <CardDescription>
                    Cardiovascular, nervous, respiratory, digestive, immune, and more
                  </CardDescription>
                </CardContent>
              </Card>
            </Link>
            <Link href="/explore-by-delivery-method" className="block">
              <Card className="hover:shadow-xl transition-all duration-300 cursor-pointer hover:scale-105 h-full">
                <CardContent className="p-8 text-center">
                  <Droplets className="h-12 w-12 text-cyan-500 mx-auto mb-4" />
                  <CardTitle className="text-xl mb-2">By Delivery Method</CardTitle>
                  <CardDescription>
                    Hydrogen water, inhalation therapy, bathing, tablets, and more
                  </CardDescription>
                </CardContent>
              </Card>
            </Link>
          </div>

          <div className="flex flex-wrap justify-center gap-4">
            <Link href="/explore-by-life-stage">
              <Button variant="outline" className="rounded-full px-6">By Life Stage</Button>
            </Link>
            <Link href="/explore-by-benefit">
              <Button variant="outline" className="rounded-full px-6">By Health Benefit</Button>
            </Link>
            <Link href="/explore-by-mechanism">
              <Button variant="outline" className="rounded-full px-6">By Mechanism</Button>
            </Link>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6">
            Explore the Research for Yourself
          </h2>
          <p className="text-xl text-gray-600 mb-8">
            Browse our curated collection of peer-reviewed studies, read plain-language summaries, and explore what the science actually says about molecular hydrogen.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/studies">
              <Button size="lg" className="rounded-full px-8">
                Browse All Studies
                <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Link href="/hydrogen-therapy-guide">
              <Button variant="outline" size="lg" className="rounded-full px-8">
                Complete Science Guide
              </Button>
            </Link>
            <Link href="/products">
              <Button variant="outline" size="lg" className="rounded-full px-8">
                Shop Hydrogen Products
              </Button>
            </Link>
          </div>
        </div>
      </section>
      <Footer />
    </div>
  );
}
