
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  Area,
  AreaChart,
  ComposedChart
} from 'recharts';
import { Calendar, TrendingUp, Activity } from 'lucide-react';

interface PublicationTimelineChartProps {
  data?: any;
  isLoading?: boolean;
  className?: string;
}

export default function PublicationTimelineChart({ data, isLoading, className }: PublicationTimelineChartProps) {
  // Fetch timeline data if not provided
  const { data: timelineData, isLoading: loading } = useQuery({
    queryKey: ['/api/studies/timeline'],
    staleTime: 5 * 60 * 1000,
    enabled: !data
  });

  const actualData = data || timelineData;
  const actualLoading = isLoading !== undefined ? isLoading : loading;

  if (actualLoading) {
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
            <div className="animate-pulse text-muted-foreground">Loading timeline data...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const yearlyData = actualData?.yearlyData || [];
  const cumulativeData = actualData?.cumulativeData || [];
  const categoryBreakdown = actualData?.categoryBreakdown || [];

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Main Timeline Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Annual Publications & Cumulative Growth
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Track hydrogen health research publications year by year with cumulative totals
          </p>
        </CardHeader>
        <CardContent>
          <div className="h-96">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={yearlyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="year" 
                  tick={{ fontSize: 12 }}
                />
                <YAxis 
                  yAxisId="left"
                  tick={{ fontSize: 12 }}
                  label={{ value: 'Annual Publications', angle: -90, position: 'insideLeft' }}
                />
                <YAxis 
                  yAxisId="right"
                  orientation="right"
                  tick={{ fontSize: 12 }}
                  label={{ value: 'Cumulative Total', angle: 90, position: 'insideRight' }}
                />
                <Tooltip 
                  formatter={(value: any, name: string) => [
                    value, 
                    name === 'annual' ? 'Studies Published' : 'Total Studies'
                  ]}
                  labelFormatter={(label: any) => `Year: ${label}`}
                  contentStyle={{
                    backgroundColor: 'hsl(var(--background))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '6px'
                  }}
                />
                <Bar 
                  yAxisId="left"
                  dataKey="annual" 
                  fill="hsl(var(--primary))"
                  radius={[4, 4, 0, 0]}
                  opacity={0.8}
                />
                <Line 
                  yAxisId="right"
                  type="monotone" 
                  dataKey="cumulative" 
                  stroke="hsl(var(--chart-2))" 
                  strokeWidth={3}
                  dot={{ fill: 'hsl(var(--chart-2))', strokeWidth: 2, r: 4 }}
                  activeDot={{ r: 6, stroke: 'hsl(var(--chart-2))', strokeWidth: 2 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Category Timeline */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="w-5 h-5" />
            Research Categories Over Time
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            See how different research categories have evolved over the years
          </p>
        </CardHeader>
        <CardContent>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={categoryBreakdown}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="year" 
                  tick={{ fontSize: 12 }}
                />
                <YAxis 
                  tick={{ fontSize: 12 }}
                />
                <Tooltip 
                  formatter={(value: any, name: string) => [value, name]}
                  labelFormatter={(label: any) => `Year: ${label}`}
                  contentStyle={{
                    backgroundColor: 'hsl(var(--background))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '6px'
                  }}
                />
                <Area 
                  type="monotone" 
                  dataKey="cardiovascular" 
                  stackId="1"
                  stroke="#ef4444" 
                  fill="#ef4444" 
                  fillOpacity={0.6}
                />
                <Area 
                  type="monotone" 
                  dataKey="neurological" 
                  stackId="1"
                  stroke="#8b5cf6" 
                  fill="#8b5cf6" 
                  fillOpacity={0.6}
                />
                <Area 
                  type="monotone" 
                  dataKey="metabolic" 
                  stackId="1"
                  stroke="#10b981" 
                  fill="#10b981" 
                  fillOpacity={0.6}
                />
                <Area 
                  type="monotone" 
                  dataKey="inflammatory" 
                  stackId="1"
                  stroke="#f59e0b" 
                  fill="#f59e0b" 
                  fillOpacity={0.6}
                />
                <Area 
                  type="monotone" 
                  dataKey="other" 
                  stackId="1"
                  stroke="#6b7280" 
                  fill="#6b7280" 
                  fillOpacity={0.6}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          
          {/* Legend */}
          <div className="flex flex-wrap gap-4 mt-4 justify-center">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-red-500 rounded"></div>
              <span className="text-sm">Cardiovascular</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-purple-500 rounded"></div>
              <span className="text-sm">Neurological</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-green-500 rounded"></div>
              <span className="text-sm">Metabolic</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-yellow-500 rounded"></div>
              <span className="text-sm">Inflammatory</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-gray-500 rounded"></div>
              <span className="text-sm">Other</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Growth Rate Analysis */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            Year-over-Year Growth Rate
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Annual percentage change in publication volume
          </p>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={yearlyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="year" 
                  tick={{ fontSize: 12 }}
                />
                <YAxis 
                  tick={{ fontSize: 12 }}
                  label={{ value: 'Growth Rate (%)', angle: -90, position: 'insideLeft' }}
                />
                <Tooltip 
                  formatter={(value: any) => [`${value}%`, 'Growth Rate']}
                  labelFormatter={(label: any) => `Year: ${label}`}
                  contentStyle={{
                    backgroundColor: 'hsl(var(--background))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '6px'
                  }}
                />
                <Bar 
                  dataKey="growthRate" 
                  fill={(entry: any) => entry.growthRate > 0 ? "#10b981" : "#ef4444"}
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
