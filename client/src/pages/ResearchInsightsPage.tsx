import { Helmet } from "react-helmet";
import ResearchTrendsChart from "@/components/visualizations/ResearchTrendsChart";
import HealthOutcomesMap from "@/components/visualizations/HealthOutcomesMap";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  BarChart3,
  TrendingUp,
  Activity,
  Database,
  Calendar,
  Users,
  Heart,
  Brain,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import SiteHeader from "@/components/layout/SiteHeader";

export default function ResearchInsightsPage() {
  // Get database statistics
  const { data: statsData, isLoading: statsLoading } = useQuery<Record<string, any>>({
    queryKey: ["/api/public-stats"],
    staleTime: 5 * 60 * 1000,
  });

  // Get category counts for insight cards
  const { data: categoryStats } = useQuery<Record<string, any>>({
    queryKey: ["/api/consumer-categories/counts"],
    staleTime: 5 * 60 * 1000,
  });

  return (
    <>
      <SiteHeader />
      <Helmet>
        <title>Research Insights & Analytics - Hydrogen Studies Database</title>
        <meta
          name="description"
          content="Explore insights and analytics from our hydrogen health research database. Discover publication trends, health outcomes, and research patterns."
        />
      </Helmet>

      <div className="min-h-screen bg-gradient-to-br from-teal-50 via-white to-purple-50">
        {/* Hero Section */}
        <div className="bg-gradient-to-r from-teal-600 to-purple-600 text-white py-16">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto text-center">
              <div className="flex justify-center mb-6">
                <div className="p-4 bg-white/20 rounded-full">
                  <BarChart3 className="w-12 h-12" />
                </div>
              </div>
              <h1 className="text-4xl md:text-5xl font-bold mb-6">
                Research Insights & Analytics
              </h1>
              <p className="text-xl text-teal-100 mb-8 leading-relaxed">
                Discover patterns, trends, and breakthrough insights from our
                comprehensive hydrogen health research database
              </p>

              {/* Quick Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-12">
                <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
                  <Database className="w-6 h-6 mx-auto mb-2" />
                  <div className="text-2xl font-bold">{statsData?.totalStudies?.toLocaleString() || "1,300+"}</div>
                  <div className="text-sm text-teal-100">Total Studies</div>
                </div>
                <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
                  <Calendar className="w-6 h-6 mx-auto mb-2" />
                  <div className="text-2xl font-bold">{statsData?.yearsOfResearch || "20"}+</div>
                  <div className="text-sm text-teal-100">Years Covered</div>
                </div>
                <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
                  <Users className="w-6 h-6 mx-auto mb-2" />
                  <div className="text-2xl font-bold">{statsData?.countries || "25"}+</div>
                  <div className="text-sm text-teal-100">Countries</div>
                </div>
                <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
                  <TrendingUp className="w-6 h-6 mx-auto mb-2" />
                  <div className="text-2xl font-bold">{statsData?.peerReviewedPercent || "90"}%</div>
                  <div className="text-sm text-teal-100">Peer-Reviewed</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="container mx-auto px-4 py-12">
          <div className="max-w-7xl mx-auto space-y-12">
            {/* Research Trends Section */}
            <section>
              <div className="text-center mb-8">
                <h2 className="text-3xl font-bold text-gray-900 mb-4">
                  Publication Trends & Research Categories
                </h2>
                <p className="text-lg text-gray-600 max-w-3xl mx-auto">
                  Track the evolution of hydrogen health research over time and
                  explore the distribution across different health areas
                </p>
              </div>
              <ResearchTrendsChart className="w-full" />
            </section>

            {/* Health Outcomes Section */}
            <section>
              <div className="text-center mb-8">
                <h2 className="text-3xl font-bold text-gray-900 mb-4">
                  Health Outcomes by Body System
                </h2>
                <p className="text-lg text-gray-600 max-w-3xl mx-auto">
                  Explore how hydrogen research shows benefits across different
                  body systems and discover the most promising areas of research
                </p>
              </div>
              <HealthOutcomesMap />
            </section>

            {/* Key Insights Cards */}
            <section>
              <div className="text-center mb-8">
                <h2 className="text-3xl font-bold text-gray-900 mb-4">
                  Key Research Insights
                </h2>
                <p className="text-lg text-gray-600 max-w-3xl mx-auto">
                  Highlighted findings from our comprehensive analysis of
                  hydrogen health studies
                </p>
              </div>

              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* Cardiovascular Insights */}
                <Card className="border-red-200 hover:shadow-lg transition-shadow">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-3 text-red-700">
                      <Heart className="w-6 h-6" />
                      Cardiovascular Health
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="text-2xl font-bold text-red-600">
                        {(() => {
                          const count = categoryStats?.data?.body_system?.find((s: any) => s.name === "Cardiovascular System")?.count;
                          return count ? `${count}+ Studies` : "Top Category";
                        })()}
                      </div>
                      <p className="text-gray-600 text-sm">
                        Hydrogen shows significant cardioprotective effects,
                        with studies demonstrating reduced oxidative stress and
                        improved circulation.
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="secondary" className="text-xs">
                          Reduced Inflammation
                        </Badge>
                        <Badge variant="secondary" className="text-xs">
                          Better Circulation
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Neurological Insights */}
                <Card className="border-purple-200 hover:shadow-lg transition-shadow">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-3 text-purple-700">
                      <Brain className="w-6 h-6" />
                      Neurological Health
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="text-2xl font-bold text-purple-600">
                        {(() => {
                          const count = categoryStats?.data?.body_system?.find((s: any) => s.name === "Nervous System")?.count;
                          return count ? `${count}+ Studies` : "Top Category";
                        })()}
                      </div>
                      <p className="text-gray-600 text-sm">
                        Strong neuroprotective effects shown across multiple
                        studies, with promising results for cognitive function
                        and brain health.
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="secondary" className="text-xs">
                          Neuroprotection
                        </Badge>
                        <Badge variant="secondary" className="text-xs">
                          Cognitive Support
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Growth Trends */}
                <Card className="border-green-200 hover:shadow-lg transition-shadow">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-3 text-green-700">
                      <TrendingUp className="w-6 h-6" />
                      Research Growth
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="text-2xl font-bold text-green-600">
                        {statsData?.totalStudies ? `${statsData.totalStudies.toLocaleString()}+ Studies` : "Growing Fast"}
                      </div>
                      <p className="text-gray-600 text-sm">
                        Hydrogen health research has grown dramatically since
                        2010, with accelerating interest from the scientific
                        community worldwide.
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="secondary" className="text-xs">
                          Global Interest
                        </Badge>
                        <Badge variant="secondary" className="text-xs">
                          Peer-Reviewed
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </section>

            {/* Call to Action */}
            <section className="bg-gradient-to-r from-teal-600 to-purple-600 rounded-2xl p-8 text-white text-center">
              <h2 className="text-2xl font-bold mb-4">
                Explore the Research Yourself
              </h2>
              <p className="text-teal-100 mb-6 max-w-2xl mx-auto">
                Dive deeper into our comprehensive database of hydrogen health
                studies. Search by condition, body system, or research area to
                find the studies most relevant to you.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <a
                  href="/studies"
                  className="bg-white text-teal-600 px-6 py-3 rounded-lg font-semibold hover:bg-teal-50 transition-colors"
                >
                  Browse Studies
                </a>
                <a
                  href="/explore-by-benefit"
                  className="bg-teal-500 text-white px-6 py-3 rounded-lg font-semibold hover:bg-teal-400 transition-colors"
                >
                  Explore by Health Benefit
                </a>
              </div>
            </section>
          </div>
        </div>
      </div>
    </>
  );
}
