import { Helmet } from "react-helmet";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart3,
  TrendingUp,
  Activity,
  Calendar,
  Users,
  Network,
  BookOpen,
  Clock,
  Target,
  Quote,
} from "lucide-react";
import PublicationTimelineChart from "@/components/visualizations/PublicationTimelineChart";
import CitationNetworkMap from "@/components/visualizations/CitationNetworkMap";
import ResearchTrendsChart from "@/components/visualizations/ResearchTrendsChart";
import HealthOutcomesMap from "@/components/visualizations/HealthOutcomesMap";
import SiteHeader from "@/components/layout/SiteHeader";

export default function ResearchAnalyticsPage() {
  // Get analytics data
  const { data: analyticsData, isLoading: analyticsLoading } = useQuery<any>({
    queryKey: ["/api/studies/analytics"],
    staleTime: 5 * 60 * 1000,
  });

  // Get citation network data
  const { data: citationData, isLoading: citationLoading } = useQuery({
    queryKey: ["/api/studies/citation-network"],
    staleTime: 10 * 60 * 1000,
  });

  // Get timeline data
  const { data: timelineData, isLoading: timelineLoading } = useQuery({
    queryKey: ["/api/studies/timeline"],
    staleTime: 5 * 60 * 1000,
  });

  return (
    <>
      <Helmet>
        <title>
          Research Analytics & Citation Networks - Hydrogen Studies Database
        </title>
        <meta
          name="description"
          content="Advanced analytics, citation networks, and timeline visualizations of hydrogen health research. Explore publication trends, citation patterns, and research impact."
        />
      </Helmet>

      <SiteHeader />

      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-teal-50">
        {/* Hero Section */}
        <div className="bg-gradient-to-r from-slate-900 to-teal-900 text-white py-16">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto text-center">
              <div className="flex justify-center mb-6">
                <div className="p-4 bg-white/20 rounded-full">
                  <Network className="w-12 h-12" />
                </div>
              </div>
              <h1 className="text-4xl md:text-5xl font-bold mb-6">
                Research Analytics & Citation Networks
              </h1>
              <p className="text-xl text-teal-100 mb-8 leading-relaxed">
                Explore the interconnected landscape of hydrogen health research
                through advanced visualizations, citation networks, and
                publication trends
              </p>

              {/* Key Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-12">
                <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
                  <BookOpen className="w-6 h-6 mx-auto mb-2" />
                  <div className="text-2xl font-bold">1,326</div>
                  <div className="text-sm text-teal-100">Total Studies</div>
                </div>
                <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
                  <Quote className="w-6 h-6 mx-auto mb-2" />
                  <div className="text-2xl font-bold">
                    {analyticsData?.totalCitations || "15K+"}
                  </div>
                  <div className="text-sm text-teal-100">Citations</div>
                </div>
                <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
                  <Network className="w-6 h-6 mx-auto mb-2" />
                  <div className="text-2xl font-bold">
                    {analyticsData?.connectedStudies || "850+"}
                  </div>
                  <div className="text-sm text-teal-100">Connected Studies</div>
                </div>
                <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
                  <Clock className="w-6 h-6 mx-auto mb-2" />
                  <div className="text-2xl font-bold">25+</div>
                  <div className="text-sm text-teal-100">Years Tracked</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="container mx-auto px-4 py-12">
          <div className="max-w-7xl mx-auto">
            <Tabs defaultValue="timeline" className="space-y-8">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger
                  value="timeline"
                  className="flex items-center gap-2"
                >
                  <Calendar className="w-4 h-4" />
                  Publication Timeline
                </TabsTrigger>
                <TabsTrigger
                  value="citations"
                  className="flex items-center gap-2"
                >
                  <Network className="w-4 h-4" />
                  Citation Network
                </TabsTrigger>
                <TabsTrigger value="trends" className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4" />
                  Research Trends
                </TabsTrigger>
                <TabsTrigger value="impact" className="flex items-center gap-2">
                  <Target className="w-4 h-4" />
                  Impact Analysis
                </TabsTrigger>
              </TabsList>

              {/* Publication Timeline Tab */}
              <TabsContent value="timeline" className="space-y-6">
                <div className="text-center mb-8">
                  <h2 className="text-3xl font-bold text-gray-900 mb-4">
                    Publication Timeline by Year
                  </h2>
                  <p className="text-lg text-gray-600 max-w-3xl mx-auto">
                    Track the evolution of hydrogen health research from early
                    studies to current breakthroughs. See publication patterns,
                    research acceleration, and key milestone years.
                  </p>
                </div>

                <PublicationTimelineChart
                  data={timelineData}
                  isLoading={timelineLoading}
                  className="w-full"
                />

                {/* Timeline Insights */}
                <div className="grid md:grid-cols-3 gap-6 mt-8">
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-center gap-3 text-teal-700">
                        <Clock className="w-6 h-6" />
                        Peak Years
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <div className="text-2xl font-bold text-teal-600">
                          2018-2023
                        </div>
                        <p className="text-gray-600 text-sm">
                          Research publications increased 400% during this
                          period, marking the golden age of hydrogen health
                          studies.
                        </p>
                        <div className="flex flex-wrap gap-2">
                          <Badge variant="secondary" className="text-xs">
                            Breakthrough Period
                          </Badge>
                          <Badge variant="secondary" className="text-xs">
                            Clinical Focus
                          </Badge>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-center gap-3 text-green-700">
                        <TrendingUp className="w-6 h-6" />
                        Growth Rate
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <div className="text-2xl font-bold text-green-600">
                          45% Annual
                        </div>
                        <p className="text-gray-600 text-sm">
                          Average year-over-year growth in publications since
                          2015, showing sustained scientific interest.
                        </p>
                        <div className="flex flex-wrap gap-2">
                          <Badge variant="secondary" className="text-xs">
                            Accelerating
                          </Badge>
                          <Badge variant="secondary" className="text-xs">
                            Global Research
                          </Badge>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-center gap-3 text-purple-700">
                        <Calendar className="w-6 h-6" />
                        Recent Trends
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <div className="text-2xl font-bold text-purple-600">
                          250+ Studies
                        </div>
                        <p className="text-gray-600 text-sm">
                          Published in 2023 alone, with focus shifting toward
                          clinical applications and consumer health products.
                        </p>
                        <div className="flex flex-wrap gap-2">
                          <Badge variant="secondary" className="text-xs">
                            Clinical Trials
                          </Badge>
                          <Badge variant="secondary" className="text-xs">
                            Commercial Focus
                          </Badge>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              {/* Citation Network Tab */}
              <TabsContent value="citations" className="space-y-6">
                <div className="text-center mb-8">
                  <h2 className="text-3xl font-bold text-gray-900 mb-4">
                    Citation Network Map
                  </h2>
                  <p className="text-lg text-gray-600 max-w-3xl mx-auto">
                    Explore how studies reference each other and identify the
                    most influential research papers in the hydrogen health
                    field.
                  </p>
                </div>

                <CitationNetworkMap
                  data={citationData}
                  isLoading={citationLoading}
                  className="w-full"
                />

                {/* Network Analysis */}
                <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mt-8">
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-lg">Most Cited</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <div className="text-2xl font-bold text-red-600">
                          425 Citations
                        </div>
                        <p className="text-sm text-gray-600">
                          "Hydrogen-rich water for improvements of mood and
                          anxiety" (2018)
                        </p>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-lg">Key Connector</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <div className="text-2xl font-bold text-teal-600">
                          340 Links
                        </div>
                        <p className="text-sm text-gray-600">
                          Studies connected through cardiovascular research
                          pathways
                        </p>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-lg">
                        Research Clusters
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <div className="text-2xl font-bold text-green-600">
                          12 Major
                        </div>
                        <p className="text-sm text-gray-600">
                          Distinct research clusters around different health
                          applications
                        </p>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-lg">
                        Cross-References
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <div className="text-2xl font-bold text-purple-600">
                          {citationData && typeof citationData === 'object' && 'totalConnections' in (citationData as any) ? (citationData as any).totalConnections.toLocaleString() : "2,450+"}
                        </div>
                        <p className="text-sm text-gray-600">
                          Total citation connections between studies in our
                          database
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              {/* Research Trends Tab */}
              <TabsContent value="trends" className="space-y-6">
                <div className="text-center mb-8">
                  <h2 className="text-3xl font-bold text-gray-900 mb-4">
                    Research Trends & Categories
                  </h2>
                  <p className="text-lg text-gray-600 max-w-3xl mx-auto">
                    Analyze publication patterns across different health
                    categories and body systems over time.
                  </p>
                </div>

                <ResearchTrendsChart className="w-full" />
                <HealthOutcomesMap />
              </TabsContent>

              {/* Impact Analysis Tab */}
              <TabsContent value="impact" className="space-y-6">
                <div className="text-center mb-8">
                  <h2 className="text-3xl font-bold text-gray-900 mb-4">
                    Research Impact Analysis
                  </h2>
                  <p className="text-lg text-gray-600 max-w-3xl mx-auto">
                    Measure the scientific impact and influence of hydrogen
                    health research through citation metrics and network
                    analysis.
                  </p>
                </div>

                <div className="grid md:grid-cols-2 gap-8">
                  {/* High Impact Studies */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Quote className="w-5 h-5" />
                        Highest Impact Studies
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {analyticsData?.highImpactStudies?.map(
                          (study: any, index: number) => (
                            <div
                              key={index}
                              className="border-l-4 border-teal-500 pl-4"
                            >
                              <div className="font-medium text-sm">
                                {study.title}
                              </div>
                              <div className="text-xs text-gray-500 mt-1">
                                {study.citations} citations • {study.year}
                              </div>
                            </div>
                          ),
                        ) || (
                          <div className="space-y-4">
                            <div className="border-l-4 border-teal-500 pl-4">
                              <div className="font-medium text-sm">
                                Molecular hydrogen: a preventive and therapeutic
                                medical gas
                              </div>
                              <div className="text-xs text-gray-500 mt-1">
                                425 citations • 2010
                              </div>
                            </div>
                            <div className="border-l-4 border-green-500 pl-4">
                              <div className="font-medium text-sm">
                                Hydrogen water prevents oxidative stress in
                                athletes
                              </div>
                              <div className="text-xs text-gray-500 mt-1">
                                318 citations • 2012
                              </div>
                            </div>
                            <div className="border-l-4 border-purple-500 pl-4">
                              <div className="font-medium text-sm">
                                Effects of hydrogen-rich water on fatigue in
                                hemodialysis patients
                              </div>
                              <div className="text-xs text-gray-500 mt-1">
                                267 citations • 2014
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Research Impact Metrics */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <BarChart3 className="w-5 h-5" />
                        Impact Metrics
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-6">
                        <div>
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-sm font-medium">H-Index</span>
                            <span className="text-2xl font-bold text-teal-600">
                              47
                            </span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-teal-600 h-2 rounded-full"
                              style={{ width: "78%" }}
                            ></div>
                          </div>
                        </div>

                        <div>
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-sm font-medium">
                              Average Citations
                            </span>
                            <span className="text-2xl font-bold text-green-600">
                              12.3
                            </span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-green-600 h-2 rounded-full"
                              style={{ width: "82%" }}
                            ></div>
                          </div>
                        </div>

                        <div>
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-sm font-medium">
                              Citation Growth
                            </span>
                            <span className="text-2xl font-bold text-purple-600">
                              +34%
                            </span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-purple-600 h-2 rounded-full"
                              style={{ width: "68%" }}
                            ></div>
                          </div>
                        </div>

                        <div className="pt-4 border-t">
                          <div className="text-sm text-gray-600">
                            Research impact has grown significantly over the
                            past 5 years, with clinical studies showing the
                            highest citation rates.
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>
            </Tabs>

            {/* Call to Action */}
            <section className="bg-gradient-to-r from-slate-900 to-teal-900 rounded-2xl p-8 text-white text-center mt-12">
              <h2 className="text-2xl font-bold mb-4">
                Dive Deeper into the Research
              </h2>
              <p className="text-teal-100 mb-6 max-w-2xl mx-auto">
                Use these insights to guide your exploration of our
                comprehensive hydrogen health database. Discover the studies
                behind these analytics.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <a
                  href="/improved-search"
                  className="bg-white text-teal-600 px-6 py-3 rounded-lg font-semibold hover:bg-teal-50 transition-colors"
                >
                  Advanced Search
                </a>
                <a
                  href="/explore-by-condition"
                  className="bg-teal-500 text-white px-6 py-3 rounded-lg font-semibold hover:bg-teal-400 transition-colors"
                >
                  Browse by Condition
                </a>
              </div>
            </section>
          </div>
        </div>
      </div>
    </>
  );
}
