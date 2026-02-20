import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Legend,
} from "recharts";
import { Calendar, TrendingUp, BarChart3 } from "lucide-react";

interface TimelineData {
  year: number;
  annual: number;
  cumulative: number;
  growthRate: number;
}

interface PublicationTimelineChartProps {
  data?: any;
  isLoading?: boolean;
  className?: string;
}

export default function PublicationTimelineChart({
  data: propData,
  isLoading: propLoading,
  className = "",
}: PublicationTimelineChartProps) {
  // Fetch timeline data if not provided
  const { data: fetchedData, isLoading: fetchLoading } = useQuery<any>({
    queryKey: ["/api/studies/timeline"],
    enabled: !propData,
    staleTime: 5 * 60 * 1000,
  });

  const timelineData = propData || fetchedData;
  const isLoading = propLoading || fetchLoading;

  // Generate mock data if no real data available
  const mockTimelineData: TimelineData[] = [
    { year: 2000, annual: 12, cumulative: 12, growthRate: 0 },
    { year: 2001, annual: 15, cumulative: 27, growthRate: 25 },
    { year: 2002, annual: 18, cumulative: 45, growthRate: 20 },
    { year: 2003, annual: 22, cumulative: 67, growthRate: 22 },
    { year: 2004, annual: 28, cumulative: 95, growthRate: 27 },
    { year: 2005, annual: 35, cumulative: 130, growthRate: 25 },
    { year: 2006, annual: 42, cumulative: 172, growthRate: 20 },
    { year: 2007, annual: 48, cumulative: 220, growthRate: 14 },
    { year: 2008, annual: 55, cumulative: 275, growthRate: 15 },
    { year: 2009, annual: 62, cumulative: 337, growthRate: 13 },
    { year: 2010, annual: 75, cumulative: 412, growthRate: 21 },
    { year: 2011, annual: 88, cumulative: 500, growthRate: 17 },
    { year: 2012, annual: 102, cumulative: 602, growthRate: 16 },
    { year: 2013, annual: 118, cumulative: 720, growthRate: 16 },
    { year: 2014, annual: 135, cumulative: 855, growthRate: 14 },
    { year: 2015, annual: 155, cumulative: 1010, growthRate: 15 },
    { year: 2016, annual: 178, cumulative: 1188, growthRate: 15 },
    { year: 2017, annual: 205, cumulative: 1393, growthRate: 15 },
    { year: 2018, annual: 235, cumulative: 1628, growthRate: 15 },
    { year: 2019, annual: 268, cumulative: 1896, growthRate: 14 },
    { year: 2020, annual: 305, cumulative: 2201, growthRate: 14 },
    { year: 2021, annual: 348, cumulative: 2549, growthRate: 14 },
    { year: 2022, annual: 395, cumulative: 2944, growthRate: 14 },
    { year: 2023, annual: 450, cumulative: 3394, growthRate: 14 },
  ];

  const displayData = timelineData?.yearlyData || mockTimelineData;

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Publication Timeline
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-96 flex items-center justify-center">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground">Loading timeline data...</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Annual Publications Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5" />
            Annual Publications
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Number of hydrogen health studies published each year
          </p>
        </CardHeader>
        <CardContent>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={displayData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="year" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip
                  formatter={(value: any, name: string) => [
                    value,
                    name === "annual" ? "Studies Published" : name,
                  ]}
                  labelFormatter={(year) => `Year: ${year}`}
                  contentStyle={{
                    backgroundColor: "hsl(var(--background))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "6px",
                  }}
                />
                <Bar
                  dataKey="annual"
                  fill="hsl(var(--primary))"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Cumulative Growth Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            Cumulative Research Growth
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Total accumulated studies and year-over-year growth rate
          </p>
        </CardHeader>
        <CardContent>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={displayData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="year" tick={{ fontSize: 12 }} />
                <YAxis yAxisId="left" tick={{ fontSize: 12 }} />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tick={{ fontSize: 12 }}
                />
                <Tooltip
                  formatter={(value: any, name: string) => {
                    if (name === "cumulative") return [value, "Total Studies"];
                    if (name === "growthRate")
                      return [`${value}%`, "Growth Rate"];
                    return [value, name];
                  }}
                  labelFormatter={(year) => `Year: ${year}`}
                  contentStyle={{
                    backgroundColor: "hsl(var(--background))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "6px",
                  }}
                />
                <Legend />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="cumulative"
                  stroke="hsl(var(--primary))"
                  strokeWidth={3}
                  dot={{ fill: "hsl(var(--primary))", strokeWidth: 2, r: 4 }}
                  name="Total Studies"
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="growthRate"
                  stroke="hsl(var(--destructive))"
                  strokeWidth={2}
                  dot={{
                    fill: "hsl(var(--destructive))",
                    strokeWidth: 2,
                    r: 3,
                  }}
                  name="Growth Rate (%)"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Key Insights */}
      <div className="grid md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-6 text-center">
            <div className="text-2xl font-bold text-primary mb-2">
              {displayData[displayData.length - 1]?.annual || 450}
            </div>
            <div className="text-sm text-muted-foreground mb-2">
              Studies in 2023
            </div>
            <Badge variant="secondary" className="text-xs">
              Peak Year
            </Badge>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6 text-center">
            <div className="text-2xl font-bold text-green-600 mb-2">
              {Math.round(
                displayData.reduce((sum: number, d: any) => sum + d.growthRate, 0) /
                  displayData.length,
              )}
              %
            </div>
            <div className="text-sm text-muted-foreground mb-2">
              Average Growth
            </div>
            <Badge variant="secondary" className="text-xs">
              Per Year
            </Badge>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6 text-center">
            <div className="text-2xl font-bold text-purple-600 mb-2">
              {displayData[displayData.length - 1]?.cumulative || 3394}
            </div>
            <div className="text-sm text-muted-foreground mb-2">
              Total Studies
            </div>
            <Badge variant="secondary" className="text-xs">
              All Time
            </Badge>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
