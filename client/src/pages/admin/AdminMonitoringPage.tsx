import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertCircle,
  CheckCircle,
  Clock,
  Play,
  Square,
  RefreshCw,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import AdminLayout from "@/components/admin/AdminLayout";

interface ContentStats {
  totalStudies: number;
  plainLanguageTitles: {
    complete: number;
    percentage: number;
    missing: number;
  };
  consumerContent: {
    methods: { complete: number; percentage: number; missing: number };
    results: { complete: number; percentage: number; missing: number };
    conclusions: { complete: number; percentage: number; missing: number };
  };
  researchEnrichment: {
    complete: number;
    percentage: number;
    missing: number;
  };
  visualContent: {
    complete: number;
    percentage: number;
    missing: number;
  };
  lastUpdated: string;
  completionStatus: {
    phase1Complete: boolean;
    phase2Complete: boolean;
    phase3Complete: boolean;
    allComplete: boolean;
  };
}

interface ProcessStatus {
  isRunning: boolean;
  lastRun?: string;
  studiesProcessed: number;
  estimatedCompletion?: string;
}

interface EnhancementProcessStatus {
  consumerContentGeneration: ProcessStatus;
  researchEnrichment: ProcessStatus;
  visualEnhancement: ProcessStatus;
}

interface MonitoringStatus {
  stats: ContentStats | null;
  processes: EnhancementProcessStatus;
  lastCheck: string | null;
}

export default function AdminMonitoringPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Query for monitoring status
  const { data: monitoringStatus, isLoading: statusLoading } =
    useQuery<MonitoringStatus>({
      queryKey: ["/api/admin/monitoring/status"],
      refetchInterval: autoRefresh ? 30000 : false, // Refresh every 30 seconds
    });

  // Query for fresh analysis
  const { data: contentStats, isLoading: analysisLoading } =
    useQuery<ContentStats>({
      queryKey: ["/api/admin/monitoring/analyze"],
      refetchInterval: autoRefresh ? 60000 : false, // Refresh every minute
    });

  // Mutations for triggering processes
  const consumerContentMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/admin/trigger/consumer-content"),
    onSuccess: (data: any) => {
      toast({
        title: data.started ? "Process Started" : "Process Failed",
        description: data.message,
        variant: data.started ? "default" : "destructive",
      });
      queryClient.invalidateQueries({
        queryKey: ["/api/admin/monitoring/status"],
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to start consumer content generation",
        variant: "destructive",
      });
    },
  });

  const researchEnrichmentMutation = useMutation({
    mutationFn: () =>
      apiRequest("POST", "/api/admin/trigger/research-enrichment"),
    onSuccess: (data: any) => {
      toast({
        title: data.started ? "Process Started" : "Process Failed",
        description: data.message,
        variant: data.started ? "default" : "destructive",
      });
      queryClient.invalidateQueries({
        queryKey: ["/api/admin/monitoring/status"],
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to start research enrichment",
        variant: "destructive",
      });
    },
  });

  const visualEnhancementMutation = useMutation({
    mutationFn: () =>
      apiRequest("POST", "/api/admin/trigger/visual-enhancement"),
    onSuccess: (data: any) => {
      toast({
        title: data.started ? "Process Started" : "Process Failed",
        description: data.message,
        variant: data.started ? "default" : "destructive",
      });
      queryClient.invalidateQueries({
        queryKey: ["/api/admin/monitoring/status"],
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to start visual enhancement",
        variant: "destructive",
      });
    },
  });

  const stopProcessesMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/admin/stop-processes"),
    onSuccess: (data: any) => {
      toast({
        title: "Processes Stopped",
        description: data.message,
      });
      queryClient.invalidateQueries({
        queryKey: ["/api/admin/monitoring/status"],
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to stop processes",
        variant: "destructive",
      });
    },
  });

  const refreshAnalysis = () => {
    queryClient.invalidateQueries({
      queryKey: ["/api/admin/monitoring/analyze"],
    });
    queryClient.invalidateQueries({
      queryKey: ["/api/admin/monitoring/status"],
    });
  };

  const stats = contentStats || monitoringStatus?.stats;

  const getStatusBadge = (percentage: number, isComplete: boolean) => {
    if (isComplete || percentage >= 99) {
      return (
        <Badge variant="default" className="bg-green-500">
          <CheckCircle className="w-3 h-3 mr-1" />
          Complete
        </Badge>
      );
    } else if (percentage >= 95) {
      return (
        <Badge variant="secondary" className="bg-yellow-500">
          <AlertCircle className="w-3 h-3 mr-1" />
          Nearly Complete
        </Badge>
      );
    } else if (percentage >= 50) {
      return (
        <Badge variant="secondary">
          <Clock className="w-3 h-3 mr-1" />
          In Progress
        </Badge>
      );
    } else {
      return (
        <Badge variant="destructive">
          <AlertCircle className="w-3 h-3 mr-1" />
          Needs Work
        </Badge>
      );
    }
  };

  const getProcessStatusBadge = (process: ProcessStatus) => {
    if (process.isRunning) {
      return (
        <Badge variant="default" className="bg-teal-500">
          <Play className="w-3 h-3 mr-1" />
          Running
        </Badge>
      );
    } else {
      return (
        <Badge variant="secondary">
          <Square className="w-3 h-3 mr-1" />
          Stopped
        </Badge>
      );
    }
  };

  if (statusLoading || analysisLoading) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-center h-64">
            <RefreshCw className="w-8 h-8 animate-spin mr-2" />
            <span>Loading monitoring dashboard...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <AdminLayout title="System Monitoring" description="Content pipeline status and health checks">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Database Monitoring Dashboard
            </h1>
            <p className="text-gray-600 mt-1">
              Monitor and maintain 100% completion across all content types
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={refreshAnalysis}
              disabled={analysisLoading}
            >
              <RefreshCw
                className={`w-4 h-4 mr-2 ${analysisLoading ? "animate-spin" : ""}`}
              />
              Refresh
            </Button>
            <Button
              variant="outline"
              onClick={() => setAutoRefresh(!autoRefresh)}
            >
              {autoRefresh ? "Disable" : "Enable"} Auto-refresh
            </Button>
          </div>
        </div>

        {/* Overview Cards */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">
                  Total Studies
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {stats.totalStudies.toLocaleString()}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">
                  Phase 1 Status
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="text-2xl font-bold">
                    {stats.plainLanguageTitles.percentage}%
                  </div>
                  {getStatusBadge(
                    stats.plainLanguageTitles.percentage,
                    stats.completionStatus.phase1Complete,
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">
                  Phase 2 Status
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="text-2xl font-bold">
                    {Math.round(
                      (stats.consumerContent.methods.percentage +
                        stats.consumerContent.results.percentage +
                        stats.consumerContent.conclusions.percentage) /
                        3,
                    )}
                    %
                  </div>
                  {getStatusBadge(
                    (stats.consumerContent.methods.percentage +
                      stats.consumerContent.results.percentage +
                      stats.consumerContent.conclusions.percentage) /
                      3,
                    stats.completionStatus.phase2Complete,
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">
                  Overall Status
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="text-2xl font-bold">
                    {stats.completionStatus.allComplete ? "100" : "In Progress"}
                    %
                  </div>
                  {stats.completionStatus.allComplete ? (
                    <Badge variant="default" className="bg-green-500">
                      <CheckCircle className="w-3 h-3 mr-1" />
                      All Complete
                    </Badge>
                  ) : (
                    <Badge variant="secondary">
                      <Clock className="w-3 h-3 mr-1" />
                      In Progress
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        <Tabs defaultValue="content-status" className="space-y-6">
          <TabsList>
            <TabsTrigger value="content-status">Content Status</TabsTrigger>
            <TabsTrigger value="process-control">Process Control</TabsTrigger>
          </TabsList>

          <TabsContent value="content-status" className="space-y-6">
            {stats && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Phase 1: Plain Language Titles */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      Phase 1: Plain Language Titles
                      {getStatusBadge(
                        stats.plainLanguageTitles.percentage,
                        stats.completionStatus.phase1Complete,
                      )}
                    </CardTitle>
                    <CardDescription>
                      SEO-optimized, consumer-friendly study titles
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Progress</span>
                        <span>
                          {stats.plainLanguageTitles.complete}/
                          {stats.totalStudies}
                        </span>
                      </div>
                      <Progress value={stats.plainLanguageTitles.percentage} />
                    </div>
                    <div className="text-sm text-gray-600">
                      {stats.plainLanguageTitles.missing} studies need plain
                      language titles
                    </div>
                  </CardContent>
                </Card>

                {/* Phase 2: Consumer Content */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      Phase 2: Consumer Content
                      {getStatusBadge(
                        (stats.consumerContent.methods.percentage +
                          stats.consumerContent.results.percentage +
                          stats.consumerContent.conclusions.percentage) /
                          3,
                        stats.completionStatus.phase2Complete,
                      )}
                    </CardTitle>
                    <CardDescription>
                      Simplified explanations for general audience
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-3">
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span>Methods</span>
                          <span>
                            {stats.consumerContent.methods.complete}/
                            {stats.totalStudies}
                          </span>
                        </div>
                        <Progress
                          value={stats.consumerContent.methods.percentage}
                        />
                      </div>
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span>Results</span>
                          <span>
                            {stats.consumerContent.results.complete}/
                            {stats.totalStudies}
                          </span>
                        </div>
                        <Progress
                          value={stats.consumerContent.results.percentage}
                        />
                      </div>
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span>Conclusions</span>
                          <span>
                            {stats.consumerContent.conclusions.complete}/
                            {stats.totalStudies}
                          </span>
                        </div>
                        <Progress
                          value={stats.consumerContent.conclusions.percentage}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Research Enrichment */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      Research Enrichment
                      {getStatusBadge(
                        stats.researchEnrichment.percentage,
                        false,
                      )}
                    </CardTitle>
                    <CardDescription>
                      Academic database links and citations
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Progress</span>
                        <span>
                          {stats.researchEnrichment.complete}/
                          {stats.totalStudies}
                        </span>
                      </div>
                      <Progress value={stats.researchEnrichment.percentage} />
                    </div>
                    <div className="text-sm text-gray-600">
                      {stats.researchEnrichment.missing} studies need research
                      links
                    </div>
                  </CardContent>
                </Card>

                {/* Visual Content */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      Visual Content
                      {getStatusBadge(
                        stats.visualContent.percentage,
                        stats.completionStatus.phase3Complete,
                      )}
                    </CardTitle>
                    <CardDescription>
                      Generated scientific illustrations
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Progress</span>
                        <span>
                          {stats.visualContent.complete}/{stats.totalStudies}
                        </span>
                      </div>
                      <Progress value={stats.visualContent.percentage} />
                    </div>
                    <div className="text-sm text-gray-600">
                      {stats.visualContent.missing} studies need visual content
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>

          <TabsContent value="process-control" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Consumer Content Generation */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    Consumer Content
                    {monitoringStatus?.processes &&
                      getProcessStatusBadge(
                        monitoringStatus.processes.consumerContentGeneration,
                      )}
                  </CardTitle>
                  <CardDescription>
                    Generate simplified explanations
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {monitoringStatus?.processes?.consumerContentGeneration && (
                    <div className="space-y-2 text-sm">
                      <div>
                        Studies Processed:{" "}
                        {
                          monitoringStatus.processes.consumerContentGeneration
                            .studiesProcessed
                        }
                      </div>
                      {monitoringStatus.processes.consumerContentGeneration
                        .lastRun && (
                        <div>
                          Last Run:{" "}
                          {new Date(
                            monitoringStatus.processes.consumerContentGeneration.lastRun,
                          ).toLocaleString()}
                        </div>
                      )}
                    </div>
                  )}
                  <Button
                    onClick={() => consumerContentMutation.mutate()}
                    disabled={
                      consumerContentMutation.isPending ||
                      monitoringStatus?.processes?.consumerContentGeneration
                        ?.isRunning
                    }
                    className="w-full"
                  >
                    {consumerContentMutation.isPending
                      ? "Starting..."
                      : "Start Consumer Content"}
                  </Button>
                </CardContent>
              </Card>

              {/* Research Enrichment */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    Research Enrichment
                    {monitoringStatus?.processes &&
                      getProcessStatusBadge(
                        monitoringStatus.processes.researchEnrichment,
                      )}
                  </CardTitle>
                  <CardDescription>
                    Enrich with academic database links
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {monitoringStatus?.processes?.researchEnrichment && (
                    <div className="space-y-2 text-sm">
                      <div>
                        Studies Processed:{" "}
                        {
                          monitoringStatus.processes.researchEnrichment
                            .studiesProcessed
                        }
                      </div>
                      {monitoringStatus.processes.researchEnrichment
                        .lastRun && (
                        <div>
                          Last Run:{" "}
                          {new Date(
                            monitoringStatus.processes.researchEnrichment.lastRun,
                          ).toLocaleString()}
                        </div>
                      )}
                    </div>
                  )}
                  <Button
                    onClick={() => researchEnrichmentMutation.mutate()}
                    disabled={
                      researchEnrichmentMutation.isPending ||
                      monitoringStatus?.processes?.researchEnrichment?.isRunning
                    }
                    className="w-full"
                  >
                    {researchEnrichmentMutation.isPending
                      ? "Starting..."
                      : "Start Research Enrichment"}
                  </Button>
                </CardContent>
              </Card>

              {/* Visual Enhancement */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    Visual Enhancement
                    {monitoringStatus?.processes &&
                      getProcessStatusBadge(
                        monitoringStatus.processes.visualEnhancement,
                      )}
                  </CardTitle>
                  <CardDescription>
                    Generate scientific illustrations
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {monitoringStatus?.processes?.visualEnhancement && (
                    <div className="space-y-2 text-sm">
                      <div>
                        Studies Processed:{" "}
                        {
                          monitoringStatus.processes.visualEnhancement
                            .studiesProcessed
                        }
                      </div>
                      {monitoringStatus.processes.visualEnhancement.lastRun && (
                        <div>
                          Last Run:{" "}
                          {new Date(
                            monitoringStatus.processes.visualEnhancement.lastRun,
                          ).toLocaleString()}
                        </div>
                      )}
                    </div>
                  )}
                  <Button
                    onClick={() => visualEnhancementMutation.mutate()}
                    disabled={
                      visualEnhancementMutation.isPending ||
                      monitoringStatus?.processes?.visualEnhancement?.isRunning
                    }
                    className="w-full"
                  >
                    {visualEnhancementMutation.isPending
                      ? "Starting..."
                      : "Start Visual Enhancement"}
                  </Button>
                </CardContent>
              </Card>
            </div>

            {/* Emergency Controls */}
            <Card>
              <CardHeader>
                <CardTitle className="text-red-600">
                  Emergency Controls
                </CardTitle>
                <CardDescription>
                  Stop all running processes if needed
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  variant="destructive"
                  onClick={() => stopProcessesMutation.mutate()}
                  disabled={stopProcessesMutation.isPending}
                >
                  {stopProcessesMutation.isPending
                    ? "Stopping..."
                    : "Stop All Processes"}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Last Updated */}
        {stats && (
          <div className="text-center text-sm text-gray-500">
            Last updated: {new Date(stats.lastUpdated).toLocaleString()}
            {autoRefresh && " • Auto-refreshing every 30 seconds"}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
