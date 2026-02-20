import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Brush,
  ReferenceLine,
  ComposedChart,
} from "recharts";
import {
  Loader2,
  TrendingUp,
  TrendingDown,
  Award,
  Calendar,
  Filter,
  ZoomIn,
  ZoomOut,
  Download,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

interface TimelineData {
  year: number;
  count: number;
  categories: Record<string, number>;
  breakthroughs: Array<{
    id: number;
    title: string;
    impact: number;
  }>;
}

interface ResearchTimelineProps {
  onStudyClick?: (studyId: number) => void;
  onYearClick?: (year: number) => void;
  className?: string;
}

export default function ResearchTimeline({
  onStudyClick,
  onYearClick,
  className,
}: ResearchTimelineProps) {
  const currentYear = new Date().getFullYear();
  const [startYear, setStartYear] = useState(2000);
  const [endYear, setEndYear] = useState(currentYear);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"area" | "bar" | "stacked">("area");
  const [zoomLevel, setZoomLevel] = useState(1);

  const { data: timelineData, isLoading } = useQuery<TimelineData[]>({
    queryKey: ["/api/explorer/timeline-data", { startYear, endYear }],
    queryFn: async () => {
      const response = await fetch(
        `/api/explorer/timeline-data?startYear=${startYear}&endYear=${endYear}`,
      );
      if (!response.ok) throw new Error("Failed to fetch timeline data");
      return response.json();
    },
  });

  // Process data for visualization
  const chartData = useMemo(() => {
    if (!timelineData) return [];

    return timelineData.map((yearData) => {
      const processedData: any = {
        year: yearData.year,
        total: yearData.count,
        ...yearData.categories,
      };

      // Add momentum calculation
      const prevYearData = timelineData.find(
        (d) => d.year === yearData.year - 1,
      );
      if (prevYearData) {
        processedData.momentum = (
          ((yearData.count - prevYearData.count) / prevYearData.count) *
          100
        ).toFixed(1);
      } else {
        processedData.momentum = 0;
      }

      return processedData;
    });
  }, [timelineData]);

  // Get unique categories
  const categories = useMemo(() => {
    if (!timelineData) return [];
    const categorySet = new Set<string>();
    timelineData.forEach((yearData) => {
      Object.keys(yearData.categories).forEach((cat) => categorySet.add(cat));
    });
    return Array.from(categorySet);
  }, [timelineData]);

  // Calculate research momentum trends
  const researchTrends = useMemo(() => {
    if (!chartData || chartData.length < 3)
      return { accelerating: [], declining: [] };

    const trends: { accelerating: string[]; declining: string[] } = {
      accelerating: [],
      declining: [],
    };

    categories.forEach((category) => {
      const recentData = chartData.slice(-5);
      const earlierData = chartData.slice(-10, -5);

      const recentAvg =
        recentData.reduce((sum, d) => sum + (d[category] || 0), 0) /
        recentData.length;
      const earlierAvg =
        earlierData.reduce((sum, d) => sum + (d[category] || 0), 0) /
        earlierData.length;

      if (earlierAvg > 0) {
        const change = ((recentAvg - earlierAvg) / earlierAvg) * 100;
        if (change > 20) trends.accelerating.push(category);
        else if (change < -20) trends.declining.push(category);
      }
    });

    return trends;
  }, [chartData, categories]);

  // Find breakthrough studies
  const breakthroughStudies = useMemo(() => {
    if (!timelineData) return [];

    const allBreakthroughs: Array<{ year: number; study: any }> = [];
    timelineData.forEach((yearData) => {
      yearData.breakthroughs.forEach((study) => {
        allBreakthroughs.push({ year: yearData.year, study });
      });
    });

    return allBreakthroughs
      .sort((a, b) => b.study.impact - a.study.impact)
      .slice(0, 10);
  }, [timelineData]);

  const handleZoomIn = () => {
    const range = endYear - startYear;
    const newRange = Math.max(5, Math.floor(range / 1.5));
    const midPoint = startYear + Math.floor(range / 2);
    setStartYear(Math.max(2000, midPoint - Math.floor(newRange / 2)));
    setEndYear(Math.min(currentYear, midPoint + Math.floor(newRange / 2)));
    setZoomLevel(zoomLevel + 1);
  };

  const handleZoomOut = () => {
    const range = endYear - startYear;
    const newRange = Math.min(currentYear - 2000, Math.floor(range * 1.5));
    const midPoint = startYear + Math.floor(range / 2);
    setStartYear(Math.max(2000, midPoint - Math.floor(newRange / 2)));
    setEndYear(Math.min(currentYear, midPoint + Math.floor(newRange / 2)));
    setZoomLevel(Math.max(1, zoomLevel - 1));
  };

  const handleExport = () => {
    const dataStr = JSON.stringify(chartData, null, 2);
    const dataUri =
      "data:application/json;charset=utf-8," + encodeURIComponent(dataStr);
    const exportFileDefaultName = `hydrogen-research-timeline-${startYear}-${endYear}.json`;

    const linkElement = document.createElement("a");
    linkElement.setAttribute("href", dataUri);
    linkElement.setAttribute("download", exportFileDefaultName);
    linkElement.click();
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const yearData = timelineData?.find((d) => d.year === label);

      return (
        <Card className="p-3 shadow-lg">
          <p className="font-bold text-lg">{label}</p>
          <p className="text-sm text-gray-600 mb-2">
            Total Studies: {payload[0]?.value || 0}
          </p>
          {yearData?.breakthroughs && yearData.breakthroughs.length > 0 && (
            <div className="mt-2 border-t pt-2">
              <p className="text-sm font-semibold mb-1">Breakthrough Study:</p>
              <p className="text-xs text-teal-600">
                {yearData.breakthroughs[0].title.substring(0, 50)}...
              </p>
            </div>
          )}
        </Card>
      );
    }
    return null;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-teal-500" />
      </div>
    );
  }

  return (
    <div className={cn("space-y-6", className)}>
      {/* Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              Research Timeline
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleZoomIn}
                disabled={endYear - startYear <= 5}
                data-testid="timeline-zoom-in"
              >
                <ZoomIn className="w-4 h-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleZoomOut}
                disabled={startYear <= 2000 && endYear >= currentYear}
                data-testid="timeline-zoom-out"
              >
                <ZoomOut className="w-4 h-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExport}
                data-testid="timeline-export"
              >
                <Download className="w-4 h-4" />
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4 mb-6">
            {/* View Mode Selector */}
            <Select value={viewMode} onValueChange={(v: any) => setViewMode(v)}>
              <SelectTrigger className="w-40" data-testid="timeline-view-mode">
                <SelectValue placeholder="View mode" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="area">Area Chart</SelectItem>
                <SelectItem value="bar">Bar Chart</SelectItem>
                <SelectItem value="stacked">Stacked View</SelectItem>
              </SelectContent>
            </Select>

            {/* Category Filter */}
            <Select
              value={selectedCategory || "all"}
              onValueChange={(v) => setSelectedCategory(v === "all" ? null : v)}
            >
              <SelectTrigger
                className="w-48"
                data-testid="timeline-category-filter"
              >
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Year Range Slider */}
            <div className="flex-1 min-w-[200px]">
              <div className="flex justify-between text-sm mb-2">
                <span>{startYear}</span>
                <span className="text-gray-500">Year Range</span>
                <span>{endYear}</span>
              </div>
              <Slider
                value={[startYear, endYear]}
                onValueChange={([start, end]) => {
                  setStartYear(start);
                  setEndYear(end);
                }}
                min={2000}
                max={currentYear}
                step={1}
                className="w-full"
                data-testid="timeline-year-slider"
              />
            </div>
          </div>

          {/* Main Chart */}
          <Tabs value={viewMode} className="w-full">
            <TabsContent value="area" className="mt-4">
              <ResponsiveContainer width="100%" height={400}>
                <AreaChart
                  data={chartData}
                  onClick={(e) => e && e.activeLabel && onYearClick?.(Number(e.activeLabel))}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="year" />
                  <YAxis />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey={selectedCategory || "total"}
                    stroke="#3b82f6"
                    fill="#3b82f6"
                    fillOpacity={0.6}
                    animationDuration={500}
                  />
                  {/* Breakthrough markers */}
                  {breakthroughStudies.map(({ year, study }) => (
                    <ReferenceLine
                      key={study.id}
                      x={year}
                      stroke="#ef4444"
                      strokeDasharray="5 5"
                      label={{ value: "★", position: "top" }}
                    />
                  ))}
                </AreaChart>
              </ResponsiveContainer>
            </TabsContent>

            <TabsContent value="bar" className="mt-4">
              <ResponsiveContainer width="100%" height={400}>
                <BarChart
                  data={chartData}
                  onClick={(e) => e && e.activeLabel && onYearClick?.(Number(e.activeLabel))}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="year" />
                  <YAxis />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  <Bar
                    dataKey={selectedCategory || "total"}
                    fill="#3b82f6"
                    animationDuration={500}
                  />
                </BarChart>
              </ResponsiveContainer>
            </TabsContent>

            <TabsContent value="stacked" className="mt-4">
              <ResponsiveContainer width="100%" height={400}>
                <ComposedChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="year" />
                  <YAxis yAxisId="left" />
                  <YAxis yAxisId="right" orientation="right" />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  {categories.slice(0, 5).map((category, index) => (
                    <Area
                      key={category}
                      yAxisId="left"
                      type="monotone"
                      dataKey={category}
                      stackId="1"
                      stroke={`hsl(${index * 60}, 70%, 50%)`}
                      fill={`hsl(${index * 60}, 70%, 50%)`}
                      fillOpacity={0.6}
                    />
                  ))}
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="momentum"
                    stroke="#ef4444"
                    strokeWidth={2}
                    dot={false}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Research Trends */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-600">
              <TrendingUp className="w-5 h-5" />
              Accelerating Research Areas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {researchTrends.accelerating.length > 0 ? (
                researchTrends.accelerating.map((topic) => (
                  <Badge key={topic} variant="secondary" className="mr-2">
                    {topic}
                  </Badge>
                ))
              ) : (
                <p className="text-sm text-gray-500">
                  No significantly accelerating areas detected
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-600">
              <TrendingDown className="w-5 h-5" />
              Declining Research Areas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {researchTrends.declining.length > 0 ? (
                researchTrends.declining.map((topic) => (
                  <Badge key={topic} variant="secondary" className="mr-2">
                    {topic}
                  </Badge>
                ))
              ) : (
                <p className="text-sm text-gray-500">
                  No significantly declining areas detected
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Breakthrough Studies */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Award className="w-5 h-5" />
            Top Breakthrough Studies
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {breakthroughStudies.slice(0, 5).map(({ year, study }) => (
              <motion.div
                key={study.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer transition-colors"
                onClick={() => onStudyClick?.(study.id)}
                data-testid={`breakthrough-study-${study.id}`}
              >
                <div className="flex-1">
                  <p className="font-semibold text-sm">{study.title}</p>
                  <p className="text-xs text-gray-500">Published in {year}</p>
                </div>
                <Badge className="ml-3">{study.impact} citations</Badge>
              </motion.div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
