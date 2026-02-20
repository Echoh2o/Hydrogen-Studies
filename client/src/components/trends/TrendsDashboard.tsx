/**
 * AI-Powered Trends Dashboard Component
 * Displays emerging topics, breakthrough studies, and research momentum
 */

import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  TrendingUp,
  TrendingDown,
  Award,
  Zap,
  AlertTriangle,
  Info,
  RefreshCw,
  ChevronUp,
  ChevronDown,
  Sparkles,
  Brain,
  Target,
  Clock,
  Activity,
  BarChart3,
  LineChart,
  Search,
} from "lucide-react";
import { format } from "date-fns";
import {
  LineChart as RechartsLineChart,
  Line,
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Area,
  AreaChart,
} from "recharts";

// Types for trend data
interface EmergingTopic {
  name: string;
  growth: string;
  studyCount: number;
  previousCount: number;
  significance: "high" | "medium" | "low";
  relatedKeywords: string[];
  studyIds: number[];
}

interface BreakthroughStudy {
  id: number;
  title: string;
  impactScore: number;
  citations: number;
  views: number;
  reason: string;
  publishedDate: string;
}

interface MomentumArea {
  name: string;
  change: string;
  currentActivity: number;
  previousActivity: number;
  studyIds: number[];
}

interface KeywordTrend {
  keyword: string;
  trend: "rising" | "falling" | "stable";
  change: string;
  currentFrequency: number;
  previousFrequency: number;
  relatedStudies: number[];
}

interface TrendReport {
  period: string;
  emergingTopics: EmergingTopic[];
  breakthroughStudies: BreakthroughStudy[];
  momentum: {
    accelerating: MomentumArea[];
    declining: MomentumArea[];
    stable: MomentumArea[];
  };
  keywordTrends: KeywordTrend[];
  summary: string;
  insights: string[];
  recommendations: string[];
  metrics: {
    totalStudiesAnalyzed: number;
    newStudiesCount: number;
    avgCitationCount: number;
    topResearchAreas: string[];
  };
  generatedAt: string;
}

interface TrendAlert {
  id: number;
  type: "breakthrough" | "emerging_topic" | "momentum_shift";
  level: "info" | "warning" | "critical";
  title: string;
  message: string;
  relatedStudies: string[];
  actionRequired: boolean;
  acknowledged: boolean;
  createdAt: string;
}

export default function TrendsDashboard() {
  const [selectedPeriod, setSelectedPeriod] = useState<
    "weekly" | "monthly" | "quarterly"
  >("monthly");
  const [selectedTab, setSelectedTab] = useState("overview");
  const [expandedTopics, setExpandedTopics] = useState<Set<string>>(new Set());

  // Fetch comprehensive trend report
  const {
    data: trendReport,
    isLoading: reportLoading,
    refetch: refetchReport,
  } = useQuery({
    queryKey: ["/api/trends/report", selectedPeriod],
    queryFn: async () => {
      const response = await fetch(
        `/api/trends/report?period=${selectedPeriod}`,
      );
      if (!response.ok) throw new Error("Failed to fetch trend report");
      const data = await response.json();
      return data.report as TrendReport;
    },
    staleTime: 5 * 60 * 1000, // Consider data fresh for 5 minutes
  });

  // Fetch trend alerts
  const { data: alerts } = useQuery({
    queryKey: ["/api/trends/alerts"],
    queryFn: async () => {
      const response = await fetch(
        "/api/trends/alerts?unacknowledged=true&limit=10",
      );
      if (!response.ok) throw new Error("Failed to fetch alerts");
      const data = await response.json();
      return data.alerts as TrendAlert[];
    },
  });

  // Fetch popular searches
  const { data: popularSearches } = useQuery({
    queryKey: ["/api/trends/search-queries"],
    queryFn: async () => {
      const response = await fetch("/api/trends/search-queries?limit=10");
      if (!response.ok) throw new Error("Failed to fetch search queries");
      const data = await response.json();
      return data.queries as { query: string; count: number }[];
    },
  });

  // Trigger new analysis
  const analysisMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/trends/analyze", { period: selectedPeriod, type: "comprehensive" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/trends/report"] });
    },
  });

  // Acknowledge alert
  const acknowledgeAlert = useMutation({
    mutationFn: async (alertId: number) => {
      return apiRequest("PUT", `/api/trends/alerts/${alertId}/acknowledge`, { userId: "current-user" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/trends/alerts"] });
    },
  });

  // Prepare chart data
  const prepareKeywordChartData = () => {
    if (!trendReport?.keywordTrends) return [];
    return trendReport.keywordTrends.slice(0, 10).map((trend) => ({
      keyword: trend.keyword,
      current: trend.currentFrequency,
      previous: trend.previousFrequency,
      change: parseFloat(trend.change),
    }));
  };

  const prepareMomentumChartData = () => {
    if (!trendReport?.momentum) return [];
    const data: Array<{ area: string; type: string; change: number; activity: number }> = [];

    trendReport.momentum.accelerating.slice(0, 5).forEach((area) => {
      data.push({
        area: area.name,
        type: "Accelerating",
        change: parseFloat(area.change),
        activity: area.currentActivity,
      });
    });

    trendReport.momentum.declining.slice(0, 5).forEach((area) => {
      data.push({
        area: area.name,
        type: "Declining",
        change: parseFloat(area.change),
        activity: area.currentActivity,
      });
    });

    return data;
  };

  const toggleTopicExpansion = (topicName: string) => {
    const newExpanded = new Set(expandedTopics);
    if (newExpanded.has(topicName)) {
      newExpanded.delete(topicName);
    } else {
      newExpanded.add(topicName);
    }
    setExpandedTopics(newExpanded);
  };

  const getSignificanceColor = (significance: string) => {
    switch (significance) {
      case "high":
        return "text-red-500";
      case "medium":
        return "text-yellow-500";
      case "low":
        return "text-teal-500";
      default:
        return "text-gray-500";
    }
  };

  const getAlertIcon = (level: string) => {
    switch (level) {
      case "critical":
        return <AlertTriangle className="h-4 w-4 text-red-500" />;
      case "warning":
        return <Zap className="h-4 w-4 text-yellow-500" />;
      default:
        return <Info className="h-4 w-4 text-teal-500" />;
    }
  };

  if (reportLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-full" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="trends-dashboard">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Research Trends Analysis
          </h1>
          <p className="text-muted-foreground">
            AI-powered insights into emerging topics and breakthrough research
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select
            value={selectedPeriod}
            onValueChange={(value: any) => setSelectedPeriod(value)}
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="weekly">Weekly</SelectItem>
              <SelectItem value="monthly">Monthly</SelectItem>
              <SelectItem value="quarterly">Quarterly</SelectItem>
            </SelectContent>
          </Select>
          <Button
            onClick={() => refetchReport()}
            variant="outline"
            size="icon"
            data-testid="button-refresh-trends"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button
            onClick={() => analysisMutation.mutate()}
            disabled={analysisMutation.isPending}
            data-testid="button-run-analysis"
          >
            {analysisMutation.isPending ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <Brain className="mr-2 h-4 w-4" />
                Run Analysis
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Alerts Section */}
      {alerts && alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.map((alert) => (
            <Alert key={alert.id} className="flex items-start justify-between">
              <div className="flex items-start gap-2">
                {getAlertIcon(alert.level)}
                <div>
                  <AlertTitle>{alert.title}</AlertTitle>
                  <AlertDescription>{alert.message}</AlertDescription>
                </div>
              </div>
              {alert.actionRequired && !alert.acknowledged && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => acknowledgeAlert.mutate(alert.id)}
                  data-testid={`button-acknowledge-alert-${alert.id}`}
                >
                  Acknowledge
                </Button>
              )}
            </Alert>
          ))}
        </div>
      )}

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Studies Analyzed
            </CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {trendReport?.metrics.totalStudiesAnalyzed || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              {trendReport?.metrics.newStudiesCount || 0} new this period
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Emerging Topics
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {trendReport?.emergingTopics.length || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              {trendReport?.emergingTopics.filter(
                (t) => t.significance === "high",
              ).length || 0}{" "}
              high significance
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Breakthrough Studies
            </CardTitle>
            <Award className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {trendReport?.breakthroughStudies.length || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Avg impact score:{" "}
              {trendReport?.breakthroughStudies.length
                ? Math.round(
                    trendReport.breakthroughStudies.reduce(
                      (sum, s) => sum + s.impactScore,
                      0,
                    ) / trendReport.breakthroughStudies.length,
                  )
                : 0}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Citations</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {trendReport?.metrics.avgCitationCount || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Per study this period
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs
        value={selectedTab}
        onValueChange={setSelectedTab}
        className="space-y-4"
      >
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="emerging">Emerging Topics</TabsTrigger>
          <TabsTrigger value="breakthrough">Breakthroughs</TabsTrigger>
          <TabsTrigger value="momentum">Momentum</TabsTrigger>
          <TabsTrigger value="keywords">Keywords</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          {/* AI Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5" />
                AI-Generated Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-relaxed">
                {trendReport?.summary || "No summary available"}
              </p>
            </CardContent>
          </Card>

          {/* Insights & Recommendations */}
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Brain className="h-5 w-5" />
                  Key Insights
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {trendReport?.insights.map((insight, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <ChevronUp className="h-4 w-4 text-green-500 mt-0.5" />
                      <span className="text-sm">{insight}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5" />
                  Recommendations
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {trendReport?.recommendations.map((rec, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <Target className="h-4 w-4 text-teal-500 mt-0.5" />
                      <span className="text-sm">{rec}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>

          {/* Top Research Areas */}
          <Card>
            <CardHeader>
              <CardTitle>Top Research Areas</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {trendReport?.metrics.topResearchAreas.map((area, idx) => (
                  <Badge key={idx} variant="secondary">
                    {area}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Emerging Topics Tab */}
        <TabsContent value="emerging" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Emerging Research Topics</CardTitle>
              <CardDescription>
                Topics showing significant growth in research activity
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[600px] pr-4">
                <div className="space-y-4">
                  {trendReport?.emergingTopics.map((topic, idx) => (
                    <Card
                      key={idx}
                      className="cursor-pointer"
                      onClick={() => toggleTopicExpansion(topic.name)}
                    >
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between">
                          <div className="space-y-1">
                            <CardTitle className="text-base font-medium">
                              {topic.name}
                            </CardTitle>
                            <div className="flex items-center gap-4 text-sm">
                              <span className="flex items-center gap-1">
                                <TrendingUp className="h-3 w-3 text-green-500" />
                                <span className="font-medium text-green-500">
                                  {topic.growth}
                                </span>
                              </span>
                              <span className="text-muted-foreground">
                                {topic.studyCount} studies (
                                {topic.previousCount} previously)
                              </span>
                              <Badge
                                variant="outline"
                                className={getSignificanceColor(
                                  topic.significance,
                                )}
                              >
                                {topic.significance}
                              </Badge>
                            </div>
                          </div>
                          {expandedTopics.has(topic.name) ? (
                            <ChevronUp className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          )}
                        </div>
                      </CardHeader>
                      {expandedTopics.has(topic.name) && (
                        <CardContent className="pt-0">
                          <div className="space-y-2">
                            <div>
                              <p className="text-sm font-medium mb-1">
                                Related Keywords:
                              </p>
                              <div className="flex flex-wrap gap-1">
                                {topic.relatedKeywords.map((kw, kidx) => (
                                  <Badge
                                    key={kidx}
                                    variant="secondary"
                                    className="text-xs"
                                  >
                                    {kw}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {topic.studyIds.length} studies contributing to
                              this trend
                            </p>
                          </div>
                        </CardContent>
                      )}
                    </Card>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Breakthrough Studies Tab */}
        <TabsContent value="breakthrough" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Breakthrough Studies</CardTitle>
              <CardDescription>
                High-impact studies with significant research implications
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {trendReport?.breakthroughStudies.map((study, idx) => (
                  <Card key={idx}>
                    <CardHeader>
                      <div className="space-y-2">
                        <CardTitle className="text-base">
                          <a
                            href={`/study/${study.id}`}
                            className="hover:underline"
                            data-testid={`link-study-${study.id}`}
                          >
                            {study.title}
                          </a>
                        </CardTitle>
                        <div className="flex items-center gap-4 text-sm">
                          <div className="flex items-center gap-1">
                            <Award className="h-3 w-3 text-yellow-500" />
                            <span>Impact Score: {study.impactScore}</span>
                          </div>
                          <span>Citations: {study.citations}</span>
                          <span>Views: {study.views}</span>
                          <span className="text-muted-foreground">
                            Published:{" "}
                            {format(
                              new Date(study.publishedDate),
                              "MMM d, yyyy",
                            )}
                          </span>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground">
                        {study.reason}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Momentum Tab */}
        <TabsContent value="momentum" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Research Momentum Analysis</CardTitle>
              <CardDescription>
                Areas showing acceleration or decline in research activity
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={prepareMomentumChartData()}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="area"
                    angle={-45}
                    textAnchor="end"
                    height={100}
                  />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar
                    dataKey="change"
                    fill="#3b82f6"
                    name="Change (%)"
                  >
                    {prepareMomentumChartData().map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={entry.type === "Accelerating" ? "#10b981" : "#ef4444"}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-3">
            {/* Accelerating Areas */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-green-500" />
                  Accelerating Areas
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {trendReport?.momentum.accelerating
                    .slice(0, 5)
                    .map((area, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between text-sm"
                      >
                        <span className="truncate">{area.name}</span>
                        <span className="font-medium text-green-500">
                          {area.change}
                        </span>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>

            {/* Declining Areas */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingDown className="h-4 w-4 text-red-500" />
                  Declining Areas
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {trendReport?.momentum.declining
                    .slice(0, 5)
                    .map((area, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between text-sm"
                      >
                        <span className="truncate">{area.name}</span>
                        <span className="font-medium text-red-500">
                          {area.change}
                        </span>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>

            {/* Stable Areas */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Activity className="h-4 w-4 text-teal-500" />
                  Stable Areas
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {trendReport?.momentum.stable.slice(0, 5).map((area, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between text-sm"
                    >
                      <span className="truncate">{area.name}</span>
                      <span className="text-muted-foreground">
                        {area.currentActivity} studies
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Keywords Tab */}
        <TabsContent value="keywords" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Keyword Trends</CardTitle>
              <CardDescription>
                Tracking keyword frequency changes over time
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <AreaChart data={prepareKeywordChartData()}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="keyword"
                    angle={-45}
                    textAnchor="end"
                    height={100}
                  />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="previous"
                    stackId="1"
                    stroke="#94a3b8"
                    fill="#94a3b8"
                    name="Previous Period"
                  />
                  <Area
                    type="monotone"
                    dataKey="current"
                    stackId="1"
                    stroke="#3b82f6"
                    fill="#3b82f6"
                    name="Current Period"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Popular Searches */}
          {popularSearches && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Search className="h-5 w-5" />
                  Popular Search Queries
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {popularSearches.map((search, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between"
                    >
                      <span className="text-sm">{search.query}</span>
                      <Badge variant="secondary">{search.count} searches</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Last Updated */}
      {trendReport?.generatedAt && (
        <div className="text-center text-sm text-muted-foreground">
          <Clock className="inline-block h-3 w-3 mr-1" />
          Last updated: {format(new Date(trendReport.generatedAt), "PPpp")}
        </div>
      )}
    </div>
  );
}
