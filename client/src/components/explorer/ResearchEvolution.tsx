import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sankey,
  Treemap,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  RadialBarChart,
  RadialBar,
} from "recharts";
import {
  Loader2,
  GitBranch,
  Globe,
  Network,
  Play,
  Pause,
  ZoomIn,
  ZoomOut,
  MapPin,
  Activity,
  ChevronRight,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

interface ResearchEvolution {
  year: number;
  topics: string[];
  connections: Array<{
    from: string;
    to: string;
    weight: number;
  }>;
}

interface GeographicData {
  country: string;
  count: number;
  years: number[];
  topics: string[];
}

interface StudyConnection {
  source: number;
  target: number;
  strength: number;
  type: string;
}

interface ResearchEvolutionProps {
  onTopicClick?: (topic: string) => void;
  onCountryClick?: (country: string) => void;
  className?: string;
}

export default function ResearchEvolution({
  onTopicClick,
  onCountryClick,
  className,
}: ResearchEvolutionProps) {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear - 5);
  const [isPlaying, setIsPlaying] = useState(false);
  const [viewMode, setViewMode] = useState<"flow" | "network" | "geographic">(
    "flow",
  );
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);

  // Fetch evolution data
  const { data: evolutionData, isLoading: evolutionLoading } = useQuery<
    ResearchEvolution[]
  >({
    queryKey: ["/api/explorer/research-evolution"],
    queryFn: async () => {
      const response = await fetch("/api/explorer/research-evolution");
      if (!response.ok) throw new Error("Failed to fetch evolution data");
      return response.json();
    },
  });

  // Fetch geographic data
  const { data: geoData, isLoading: geoLoading } = useQuery<GeographicData[]>({
    queryKey: ["/api/explorer/geographic-distribution"],
    queryFn: async () => {
      const response = await fetch("/api/explorer/geographic-distribution");
      if (!response.ok) throw new Error("Failed to fetch geographic data");
      return response.json();
    },
  });

  // Fetch network connections
  const { data: connectionsData, isLoading: connectionsLoading } = useQuery<
    StudyConnection[]
  >({
    queryKey: ["/api/explorer/study-connections"],
    queryFn: async () => {
      const response = await fetch("/api/explorer/study-connections");
      if (!response.ok) throw new Error("Failed to fetch connections");
      return response.json();
    },
  });

  // Animation playback
  useEffect(() => {
    if (!isPlaying || !evolutionData) return;

    const interval = setInterval(() => {
      setSelectedYear((prev) => {
        const maxYear = Math.max(...evolutionData.map((d) => d.year));
        if (prev >= maxYear) {
          setIsPlaying(false);
          return 2000;
        }
        return prev + 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isPlaying, evolutionData]);

  // Process data for current year
  const currentYearData = useMemo(() => {
    if (!evolutionData) return null;
    return evolutionData.find((d) => d.year === selectedYear);
  }, [evolutionData, selectedYear]);

  // Build flow diagram data
  const flowData = useMemo(() => {
    if (!evolutionData) return { nodes: [], links: [] };

    const nodes = new Map<string, { id: string; group: number }>();
    const links: Array<{ source: string; target: string; value: number }> = [];

    evolutionData.forEach((yearData, idx) => {
      yearData.topics.forEach((topic) => {
        if (!nodes.has(topic)) {
          nodes.set(topic, { id: topic, group: Math.floor(idx / 5) });
        }
      });

      yearData.connections.forEach((conn) => {
        links.push({
          source: conn.from,
          target: conn.to,
          value: conn.weight,
        });
      });
    });

    return {
      nodes: Array.from(nodes.values()),
      links: links.filter(
        (link) => nodes.has(link.source) && nodes.has(link.target),
      ),
    };
  }, [evolutionData]);

  // Process geographic data for visualization
  const geoChartData = useMemo(() => {
    if (!geoData) return [];
    return geoData.map((country) => ({
      name: country.country,
      value: country.count,
      topics: country.topics.length,
    }));
  }, [geoData]);

  // Topic clustering
  const topicClusters = useMemo(() => {
    if (!evolutionData) return [];

    const clusters = new Map<string, Set<string>>();

    evolutionData.forEach((yearData) => {
      yearData.connections.forEach((conn) => {
        if (!clusters.has(conn.from)) {
          clusters.set(conn.from, new Set());
        }
        clusters.get(conn.from)!.add(conn.to);
      });
    });

    return Array.from(clusters.entries())
      .map(([topic, related]) => ({
        topic,
        relatedCount: related.size,
        relatedTopics: Array.from(related),
      }))
      .sort((a, b) => b.relatedCount - a.relatedCount);
  }, [evolutionData]);

  const isLoading = evolutionLoading || geoLoading || connectionsLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
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
              <GitBranch className="w-5 h-5" />
              Research Evolution Visualizer
            </span>
            <div className="flex gap-2">
              <Select
                value={viewMode}
                onValueChange={(v: any) => setViewMode(v)}
              >
                <SelectTrigger
                  className="w-40"
                  data-testid="evolution-view-mode"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="flow">Topic Flow</SelectItem>
                  <SelectItem value="network">Collaboration Network</SelectItem>
                  <SelectItem value="geographic">
                    Geographic Distribution
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Timeline Controls */}
          {viewMode === "flow" && (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsPlaying(!isPlaying)}
                  data-testid="evolution-play-button"
                >
                  {isPlaying ? (
                    <Pause className="w-4 h-4" />
                  ) : (
                    <Play className="w-4 h-4" />
                  )}
                </Button>
                <div className="flex-1">
                  <div className="flex justify-between text-sm mb-2">
                    <span>2000</span>
                    <span className="font-bold">{selectedYear}</span>
                    <span>{currentYear}</span>
                  </div>
                  <input
                    type="range"
                    min="2000"
                    max={currentYear}
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                    className="w-full"
                    data-testid="evolution-year-slider"
                  />
                </div>
              </div>

              {/* Current Year Topics */}
              {currentYearData && (
                <div className="border-t pt-4">
                  <h4 className="font-semibold mb-3">
                    Active Topics in {selectedYear}
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {currentYearData.topics.map((topic) => (
                      <Badge
                        key={topic}
                        variant={
                          selectedTopic === topic ? "default" : "secondary"
                        }
                        className="cursor-pointer"
                        onClick={() => {
                          setSelectedTopic(
                            selectedTopic === topic ? null : topic,
                          );
                          onTopicClick?.(topic);
                        }}
                        data-testid={`evolution-topic-${topic}`}
                      >
                        {topic}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Topic Connections */}
              {currentYearData && currentYearData.connections.length > 0 && (
                <div className="border-t pt-4">
                  <h4 className="font-semibold mb-3">Topic Evolution Paths</h4>
                  <div className="space-y-2">
                    {currentYearData.connections
                      .slice(0, 5)
                      .map((conn, idx) => (
                        <motion.div
                          key={idx}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: idx * 0.1 }}
                          className="flex items-center gap-2 p-2 bg-gray-50 rounded"
                        >
                          <Badge variant="outline">{conn.from}</Badge>
                          <ChevronRight className="w-4 h-4 text-gray-400" />
                          <Badge variant="outline">{conn.to}</Badge>
                          <span className="ml-auto text-sm text-gray-500">
                            {conn.weight} studies
                          </span>
                        </motion.div>
                      ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Visualization Tabs */}
      <Tabs value={viewMode} className="w-full">
        <TabsContent value="flow" className="mt-0">
          <Card>
            <CardHeader>
              <CardTitle>Research Topic Flow</CardTitle>
            </CardHeader>
            <CardContent>
              {/* Topic Clustering Treemap */}
              <ResponsiveContainer width="100%" height={400}>
                <Treemap
                  data={topicClusters.slice(0, 15).map((cluster) => ({
                    name: cluster.topic,
                    size: cluster.relatedCount,
                    children: cluster.relatedTopics.slice(0, 5).map((t) => ({
                      name: t,
                      size: 1,
                    })),
                  }))}
                  dataKey="size"
                  aspectRatio={4 / 3}
                  stroke="#fff"
                  fill="#3b82f6"
                />
              </ResponsiveContainer>

              {/* Topic Connections Over Time */}
              <div className="mt-6">
                <h4 className="font-semibold mb-3">Topic Connectivity</h4>
                <div className="space-y-2">
                  {topicClusters.slice(0, 10).map((cluster) => (
                    <div
                      key={cluster.topic}
                      className="flex items-center gap-3"
                    >
                      <span className="w-32 text-sm truncate">
                        {cluster.topic}
                      </span>
                      <Progress
                        value={(cluster.relatedCount / 20) * 100}
                        className="flex-1"
                      />
                      <span className="text-sm text-gray-500">
                        {cluster.relatedCount} connections
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="network" className="mt-0">
          <Card>
            <CardHeader>
              <CardTitle>Research Collaboration Network</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="bg-gray-50 rounded-lg p-8 min-h-[400px] flex items-center justify-center">
                <div className="text-center">
                  <Network className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                  <p className="text-gray-600">
                    Interactive network visualization would be rendered here
                  </p>
                  <p className="text-sm text-gray-500 mt-2">
                    Shows connections between research studies and authors
                  </p>
                </div>
              </div>

              {/* Connection Statistics */}
              <div className="grid grid-cols-3 gap-4 mt-6">
                <div className="text-center p-4 bg-blue-50 rounded">
                  <p className="text-2xl font-bold text-blue-600">
                    {connectionsData?.length || 0}
                  </p>
                  <p className="text-sm text-gray-600">Total Connections</p>
                </div>
                <div className="text-center p-4 bg-green-50 rounded">
                  <p className="text-2xl font-bold text-green-600">
                    {connectionsData?.filter((c) => c.type === "topic")
                      .length || 0}
                  </p>
                  <p className="text-sm text-gray-600">Topic Links</p>
                </div>
                <div className="text-center p-4 bg-purple-50 rounded">
                  <p className="text-2xl font-bold text-purple-600">
                    {connectionsData?.filter((c) => c.strength > 0.7).length ||
                      0}
                  </p>
                  <p className="text-sm text-gray-600">Strong Connections</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="geographic" className="mt-0">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="w-5 h-5" />
                Geographic Distribution of Research
              </CardTitle>
            </CardHeader>
            <CardContent>
              {/* Country Bar Chart */}
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={geoChartData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis dataKey="name" type="category" width={100} />
                  <Tooltip />
                  <Bar dataKey="value" fill="#3b82f6" />
                </BarChart>
              </ResponsiveContainer>

              {/* Geographic Statistics */}
              <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div>
                  <h4 className="font-semibold mb-3">Top Research Countries</h4>
                  <div className="space-y-2">
                    {geoData?.slice(0, 5).map((country, idx) => (
                      <div
                        key={country.country}
                        className="flex items-center justify-between p-2 bg-gray-50 rounded hover:bg-gray-100 cursor-pointer"
                        onClick={() => onCountryClick?.(country.country)}
                        data-testid={`geo-country-${country.country}`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-lg font-bold text-gray-400">
                            #{idx + 1}
                          </span>
                          <MapPin className="w-4 h-4 text-gray-400" />
                          <span>{country.country}</span>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold">
                            {country.count} studies
                          </p>
                          <p className="text-xs text-gray-500">
                            {country.topics.length} topics
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h4 className="font-semibold mb-3">
                    Research Activity by Region
                  </h4>
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie
                        data={geoChartData.slice(0, 5)}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        fill="#3b82f6"
                      >
                        {geoChartData.slice(0, 5).map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={`hsl(${index * 60}, 70%, 50%)`}
                          />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Research Diversification Metrics */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Topic Diversity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-600">
              {evolutionData
                ? new Set(evolutionData.flatMap((d) => d.topics)).size
                : 0}
            </div>
            <p className="text-sm text-gray-600 mt-1">Unique research topics</p>
            <Progress value={75} className="mt-3" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Geographic Spread</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">
              {geoData?.length || 0}
            </div>
            <p className="text-sm text-gray-600 mt-1">Countries involved</p>
            <Progress value={(geoData?.length || 0) * 5} className="mt-3" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Research Growth</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-purple-600">
              +
              {evolutionData
                ? Math.round(
                    (evolutionData[evolutionData.length - 1]?.topics.length /
                      evolutionData[0]?.topics.length -
                      1) *
                      100,
                  )
                : 0}
              %
            </div>
            <p className="text-sm text-gray-600 mt-1">Topic expansion rate</p>
            <Progress value={85} className="mt-3" />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
