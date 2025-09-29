/**
 * Content Analytics Dashboard
 * Comprehensive dashboard for viewing content performance metrics and insights
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  BarChart, 
  Bar, 
  LineChart, 
  Line, 
  PieChart, 
  Pie, 
  Cell,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend,
  ResponsiveContainer,
  Area,
  AreaChart,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar
} from 'recharts';
import { 
  TrendingUp, 
  TrendingDown, 
  Eye, 
  Clock, 
  Share2, 
  Download, 
  Heart,
  ArrowRight,
  Users,
  BarChart3,
  Activity,
  Target,
  Zap,
  AlertCircle,
  CheckCircle,
  RefreshCw
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';

interface ContentMetrics {
  contentType: string;
  contentId: number;
  title: string;
  viewCount: number;
  uniqueViewers: number;
  avgTimeSpent: number;
  bounceRate: number;
  shareCount: number;
  conversionRate: number;
  performanceScore: number;
}

interface ContentInsights {
  headlinePattern?: string;
  optimalLength?: number;
  bestKeywords?: string[];
  bestTags?: string[];
  improvementSuggestions?: string[];
  optimalPublishTime?: string;
}

interface ABTestResult {
  testId: string;
  status: string;
  winner?: string;
  control?: string;
  improvement?: string;
  isSignificant?: boolean;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

export function ContentAnalyticsDashboard() {
  const [selectedPeriod, setSelectedPeriod] = useState('7d');
  const [selectedContentType, setSelectedContentType] = useState<string>('all');
  const [refreshKey, setRefreshKey] = useState(0);

  // Fetch top content
  const { data: topContent, isLoading: topContentLoading, refetch: refetchTopContent } = useQuery({
    queryKey: ['/api/analytics/top-content', selectedContentType, selectedPeriod],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append('limit', '10');
      if (selectedContentType !== 'all') {
        params.append('contentType', selectedContentType);
      }
      
      // Calculate date range
      const endDate = new Date();
      const startDate = new Date();
      switch (selectedPeriod) {
        case '24h':
          startDate.setDate(startDate.getDate() - 1);
          break;
        case '7d':
          startDate.setDate(startDate.getDate() - 7);
          break;
        case '30d':
          startDate.setDate(startDate.getDate() - 30);
          break;
        case '90d':
          startDate.setDate(startDate.getDate() - 90);
          break;
      }
      params.append('startDate', startDate.toISOString());
      params.append('endDate', endDate.toISOString());
      
      const response = await fetch(`/api/analytics/top-content?${params}`);
      if (!response.ok) throw new Error('Failed to fetch top content');
      const data = await response.json();
      return data.content || [];
    },
  });

  // Fetch recommendations
  const { data: recommendations } = useQuery({
    queryKey: ['/api/analytics/recommendations'],
    queryFn: async () => {
      const response = await fetch('/api/analytics/recommendations?limit=5');
      if (!response.ok) return [];
      const data = await response.json();
      return data.recommendations || [];
    },
  });

  const handleRefresh = () => {
    setRefreshKey(prev => prev + 1);
    refetchTopContent();
  };

  // Calculate summary statistics
  const summaryStats = {
    totalViews: topContent?.reduce((sum: number, item: ContentMetrics) => sum + item.viewCount, 0) || 0,
    totalUniqueViewers: topContent?.reduce((sum: number, item: ContentMetrics) => sum + item.uniqueViewers, 0) || 0,
    avgEngagement: topContent?.reduce((sum: number, item: ContentMetrics) => sum + item.avgTimeSpent, 0) / (topContent?.length || 1) || 0,
    avgBounceRate: topContent?.reduce((sum: number, item: ContentMetrics) => sum + item.bounceRate, 0) / (topContent?.length || 1) || 0,
  };

  // Prepare chart data
  const engagementData = topContent?.slice(0, 5).map((item: ContentMetrics) => ({
    name: item.title?.substring(0, 30) + '...',
    views: item.viewCount,
    timeSpent: item.avgTimeSpent,
    shares: item.shareCount,
  })) || [];

  const contentTypeDistribution = [
    { name: 'Studies', value: topContent?.filter((c: ContentMetrics) => c.contentType === 'study').length || 0 },
    { name: 'Blogs', value: topContent?.filter((c: ContentMetrics) => c.contentType === 'blog').length || 0 },
    { name: 'Articles', value: topContent?.filter((c: ContentMetrics) => c.contentType === 'article').length || 0 },
  ];

  return (
    <div className="space-y-6 p-6" data-testid="analytics-dashboard">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Content Analytics</h1>
          <p className="text-muted-foreground">Track and optimize your content performance</p>
        </div>
        <div className="flex gap-2">
          <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
            <SelectTrigger className="w-[120px]" data-testid="period-selector">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="24h">Last 24h</SelectItem>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
          <Select value={selectedContentType} onValueChange={setSelectedContentType}>
            <SelectTrigger className="w-[120px]" data-testid="type-selector">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="study">Studies</SelectItem>
              <SelectItem value="blog">Blogs</SelectItem>
              <SelectItem value="article">Articles</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={handleRefresh} variant="outline" size="icon" data-testid="refresh-button">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Views</CardTitle>
            <Eye className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="total-views">
              {summaryStats.totalViews.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              <TrendingUp className="inline h-3 w-3 mr-1 text-green-500" />
              +12% from last period
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Unique Viewers</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="unique-viewers">
              {summaryStats.totalUniqueViewers.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              <TrendingUp className="inline h-3 w-3 mr-1 text-green-500" />
              +8% from last period
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg. Time Spent</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="avg-time">
              {Math.round(summaryStats.avgEngagement)}s
            </div>
            <p className="text-xs text-muted-foreground">
              Target: 120s
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Bounce Rate</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="bounce-rate">
              {Math.round(summaryStats.avgBounceRate)}%
            </div>
            <p className="text-xs text-muted-foreground">
              <TrendingDown className="inline h-3 w-3 mr-1 text-green-500" />
              -5% from last period
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="engagement">Engagement</TabsTrigger>
          <TabsTrigger value="content">Top Content</TabsTrigger>
          <TabsTrigger value="insights">Insights</TabsTrigger>
          <TabsTrigger value="abtests">A/B Tests</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Engagement Over Time */}
            <Card>
              <CardHeader>
                <CardTitle>Engagement Metrics</CardTitle>
                <CardDescription>Views, time spent, and shares for top content</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={engagementData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="views" fill="#0088FE" />
                    <Bar dataKey="timeSpent" fill="#00C49F" />
                    <Bar dataKey="shares" fill="#FFBB28" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Content Type Distribution */}
            <Card>
              <CardHeader>
                <CardTitle>Content Distribution</CardTitle>
                <CardDescription>Breakdown by content type</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={contentTypeDistribution}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {contentTypeDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Engagement Tab */}
        <TabsContent value="engagement" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Engagement Funnel</CardTitle>
              <CardDescription>User engagement through the content journey</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between mb-2">
                    <span className="text-sm font-medium">Page Views</span>
                    <span className="text-sm text-muted-foreground">100%</span>
                  </div>
                  <Progress value={100} className="h-2" />
                </div>
                <div>
                  <div className="flex justify-between mb-2">
                    <span className="text-sm font-medium">Engaged (>30s)</span>
                    <span className="text-sm text-muted-foreground">65%</span>
                  </div>
                  <Progress value={65} className="h-2" />
                </div>
                <div>
                  <div className="flex justify-between mb-2">
                    <span className="text-sm font-medium">Scrolled >50%</span>
                    <span className="text-sm text-muted-foreground">45%</span>
                  </div>
                  <Progress value={45} className="h-2" />
                </div>
                <div>
                  <div className="flex justify-between mb-2">
                    <span className="text-sm font-medium">Interacted</span>
                    <span className="text-sm text-muted-foreground">28%</span>
                  </div>
                  <Progress value={28} className="h-2" />
                </div>
                <div>
                  <div className="flex justify-between mb-2">
                    <span className="text-sm font-medium">Converted</span>
                    <span className="text-sm text-muted-foreground">12%</span>
                  </div>
                  <Progress value={12} className="h-2" />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Top Content Tab */}
        <TabsContent value="content" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Top Performing Content</CardTitle>
              <CardDescription>Content ranked by performance score</CardDescription>
            </CardHeader>
            <CardContent>
              {topContentLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map(i => (
                    <Skeleton key={i} className="h-20 w-full" />
                  ))}
                </div>
              ) : (
                <ScrollArea className="h-[400px] pr-4">
                  <div className="space-y-4">
                    {topContent?.map((content: ContentMetrics, index: number) => (
                      <div key={`${content.contentType}-${content.contentId}`} 
                           className="flex items-start space-x-4 p-4 rounded-lg border hover:bg-muted/50 transition-colors"
                           data-testid={`content-item-${index}`}>
                        <div className="flex-shrink-0">
                          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                            <span className="text-sm font-bold">#{index + 1}</span>
                          </div>
                        </div>
                        <div className="flex-1 space-y-1">
                          <p className="text-sm font-medium leading-none">
                            {content.content?.title || 'Untitled'}
                          </p>
                          <div className="flex gap-2">
                            <Badge variant="outline">
                              {content.contentType}
                            </Badge>
                            <Badge variant="outline">
                              Score: {content.performanceScore}
                            </Badge>
                          </div>
                          <div className="flex gap-4 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Eye className="h-3 w-3" />
                              {content.viewCount}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {Math.round(content.avgTimeSpent)}s
                            </span>
                            <span className="flex items-center gap-1">
                              <Share2 className="h-3 w-3" />
                              {content.shareCount}
                            </span>
                            <span className="flex items-center gap-1">
                              <Target className="h-3 w-3" />
                              {content.conversionRate}%
                            </span>
                          </div>
                        </div>
                        <Button variant="ghost" size="sm">
                          <ArrowRight className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Insights Tab */}
        <TabsContent value="insights" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Optimization Suggestions</CardTitle>
                <CardDescription>AI-powered recommendations</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-start gap-2">
                    <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium">Optimal publish time identified</p>
                      <p className="text-xs text-muted-foreground">Best engagement at 10:00 AM EST</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-5 w-5 text-yellow-500 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium">Content length optimization needed</p>
                      <p className="text-xs text-muted-foreground">Aim for 800-1200 words for better engagement</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <Zap className="h-5 w-5 text-blue-500 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium">High-performing headline pattern detected</p>
                      <p className="text-xs text-muted-foreground">Numbers and "how-to" titles perform 40% better</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Content Recommendations</CardTitle>
                <CardDescription>Suggested content to create</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {recommendations?.slice(0, 3).map((rec: any, index: number) => (
                    <div key={index} className="flex items-start gap-2">
                      <Badge className="mt-0.5">{rec.score}</Badge>
                      <div>
                        <p className="text-sm font-medium">{rec.title}</p>
                        <p className="text-xs text-muted-foreground">{rec.reason}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* A/B Tests Tab */}
        <TabsContent value="abtests" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Active A/B Tests</CardTitle>
              <CardDescription>Monitor your content experiments</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="p-4 border rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium">Headline Test - Study #123</h4>
                    <Badge variant="outline">Running</Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-4 mt-3">
                    <div>
                      <p className="text-sm text-muted-foreground">Variant A (Control)</p>
                      <p className="text-sm font-medium">Original headline</p>
                      <Progress value={45} className="h-2 mt-2" />
                      <p className="text-xs text-muted-foreground mt-1">45% conversion</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Variant B</p>
                      <p className="text-sm font-medium">Optimized headline</p>
                      <Progress value={62} className="h-2 mt-2" />
                      <p className="text-xs text-muted-foreground mt-1">62% conversion</p>
                    </div>
                  </div>
                  <div className="mt-3 pt-3 border-t">
                    <p className="text-sm">
                      <span className="font-medium text-green-600">Winner: Variant B</span>
                      <span className="text-muted-foreground"> - 38% improvement</span>
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}