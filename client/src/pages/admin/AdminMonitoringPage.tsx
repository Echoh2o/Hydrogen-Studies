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

interface SystemHealth {
  reviewQueue: {
    pending: number;
    approved: number;
    rejected: number;
    pendingWithFlags: number;
  };
  qualityScores: {
    totalStudies: number;
    scored: number;
    high: number;
    medium: number;
    low: number;
    withFlags: number;
    staleRubric: number;
    currentRubric: string;
  };
  cron: {
    running: boolean;
    checkIntervalMs: number;
    jobs: Array<{
      name: string;
      lastRun: string | null;
      intervalMs: number;
    }>;
  };
  redirects: {
    total: number;
    active: number;
    totalHits: number;
    unresolved404s: number;
    resolved404s: number;
    hitsLast7d: number;
    topUnresolved: Array<{
      path: string;
      hitCount: number;
      lastSeenAt: string;
    }>;
  };
  ai: {
    anthropic: boolean;
    openai: boolean;
    xai: boolean;
    primary: string;
    imageProvider: string;
  };
  gsc: {
    connected: boolean;
    accountEmail: string | null;
    lastSyncAt: string | null;
    rowCount: number;
  };
  generatedAt: string;
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

  // Query for the new system-health metrics (review queue, scores, cron, redirects, AI)
  const { data: systemHealth } = useQuery<SystemHealth>({
    queryKey: ["/api/admin/monitoring/system-health"],
    refetchInterval: autoRefresh ? 60000 : false,
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
      <div className="min-h-screen bg-muted/50 p-6">
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
            <h1 className="text-3xl font-bold text-foreground">
              Database Monitoring Dashboard
            </h1>
            <p className="text-muted-foreground mt-1">
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

        {/* System Health — review queue, scores, cron, redirects, AI. The
            content-pipeline section below is the legacy view; this is the
            higher-level "is production actually healthy?" snapshot. */}
        {systemHealth && (
          <div className="space-y-3">
            <h2 className="text-lg font-semibold">System Health</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Review Queue */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">
                    Review Queue
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Pre-publish items pending curator decision
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex items-baseline gap-2">
                    <div className="text-2xl font-bold">
                      {systemHealth.reviewQueue.pending}
                    </div>
                    <div className="text-xs text-muted-foreground">pending</div>
                  </div>
                  {systemHealth.reviewQueue.pendingWithFlags > 0 && (
                    <Badge variant="destructive" className="text-[10px]">
                      {systemHealth.reviewQueue.pendingWithFlags} with red flags
                    </Badge>
                  )}
                  <div className="text-xs text-muted-foreground pt-1">
                    {systemHealth.reviewQueue.approved} approved ·{" "}
                    {systemHealth.reviewQueue.rejected} rejected all-time
                  </div>
                </CardContent>
              </Card>

              {/* Score Distribution */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">
                    Quality Score Distribution
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Rubric {systemHealth.qualityScores.currentRubric} ·{" "}
                    {systemHealth.qualityScores.scored} of{" "}
                    {systemHealth.qualityScores.totalStudies} scored
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-1.5">
                  <div className="flex items-center gap-2 text-xs">
                    <div className="w-16 text-green-700 font-medium">High</div>
                    <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-green-500 h-full"
                        style={{
                          width: `${systemHealth.qualityScores.scored > 0 ? (systemHealth.qualityScores.high / systemHealth.qualityScores.scored) * 100 : 0}%`,
                        }}
                      />
                    </div>
                    <div className="w-10 text-right tabular-nums">
                      {systemHealth.qualityScores.high}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <div className="w-16 text-amber-700 font-medium">Medium</div>
                    <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-amber-500 h-full"
                        style={{
                          width: `${systemHealth.qualityScores.scored > 0 ? (systemHealth.qualityScores.medium / systemHealth.qualityScores.scored) * 100 : 0}%`,
                        }}
                      />
                    </div>
                    <div className="w-10 text-right tabular-nums">
                      {systemHealth.qualityScores.medium}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <div className="w-16 text-red-700 font-medium">Low</div>
                    <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-red-500 h-full"
                        style={{
                          width: `${systemHealth.qualityScores.scored > 0 ? (systemHealth.qualityScores.low / systemHealth.qualityScores.scored) * 100 : 0}%`,
                        }}
                      />
                    </div>
                    <div className="w-10 text-right tabular-nums">
                      {systemHealth.qualityScores.low}
                    </div>
                  </div>
                  <div className="text-[10px] text-muted-foreground pt-1 flex flex-wrap gap-2">
                    <span>
                      {systemHealth.qualityScores.withFlags} with red flags
                    </span>
                    {systemHealth.qualityScores.staleRubric > 0 && (
                      <span className="text-amber-700">
                        {systemHealth.qualityScores.staleRubric} awaiting rescore
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Cron Job Status */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">
                    Background Jobs
                  </CardTitle>
                  <CardDescription className="text-xs">
                    {systemHealth.cron.running
                      ? `Scheduler active · checks every ${Math.round(systemHealth.cron.checkIntervalMs / 60000)}m`
                      : "Scheduler not running"}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-1 max-h-40 overflow-y-auto text-xs">
                    {systemHealth.cron.jobs.map((j) => {
                      const lastRunMs = j.lastRun ? new Date(j.lastRun).getTime() : 0;
                      const age = Date.now() - lastRunMs;
                      const overdue = lastRunMs > 0 && age > j.intervalMs * 2;
                      const neverRun = lastRunMs === 0;
                      return (
                        <div
                          key={j.name}
                          className="flex items-center justify-between gap-2"
                        >
                          <span className="truncate" title={j.name}>
                            {j.name}
                          </span>
                          <span
                            className={`text-[10px] tabular-nums ${
                              overdue
                                ? "text-red-600"
                                : neverRun
                                ? "text-muted-foreground"
                                : "text-muted-foreground"
                            }`}
                          >
                            {neverRun
                              ? "—"
                              : age < 60000
                              ? "just now"
                              : age < 3600000
                              ? `${Math.round(age / 60000)}m ago`
                              : age < 86400000
                              ? `${Math.round(age / 3600000)}h ago`
                              : `${Math.round(age / 86400000)}d ago`}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              {/* Redirects + AI */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">
                    Traffic & AI
                  </CardTitle>
                  <CardDescription className="text-xs">
                    {systemHealth.redirects.active} active redirects ·{" "}
                    {systemHealth.redirects.unresolved404s} unresolved 404s
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex items-baseline gap-2">
                    <div className="text-xl font-bold tabular-nums">
                      {systemHealth.redirects.hitsLast7d.toLocaleString()}
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      404 hits last 7d
                    </div>
                  </div>
                  {systemHealth.redirects.topUnresolved.length > 0 && (
                    <div className="space-y-0.5">
                      <div className="text-[10px] font-medium text-muted-foreground uppercase">
                        Top unresolved
                      </div>
                      {systemHealth.redirects.topUnresolved.slice(0, 3).map((r) => (
                        <div
                          key={r.path}
                          className="flex items-center justify-between gap-2 text-[11px]"
                        >
                          <span
                            className="truncate font-mono text-muted-foreground"
                            title={r.path}
                          >
                            {r.path}
                          </span>
                          <span className="tabular-nums">{r.hitCount}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="pt-1 border-t text-[10px] text-muted-foreground space-y-0.5">
                    <div>
                      AI text: <span className="font-medium">{systemHealth.ai.primary}</span>
                      {" · "}
                      Images: <span className="font-medium">{systemHealth.ai.imageProvider}</span>
                    </div>
                    <div>
                      GSC:{" "}
                      {systemHealth.gsc.connected ? (
                        <>
                          <span className="font-medium text-green-700">connected</span>
                          {" · "}
                          {systemHealth.gsc.rowCount.toLocaleString()} rows
                          {systemHealth.gsc.lastSyncAt && (
                            <>
                              {" · "}
                              synced{" "}
                              {(() => {
                                const ms = Date.now() - new Date(systemHealth.gsc.lastSyncAt).getTime();
                                if (ms < 3_600_000) return `${Math.round(ms / 60_000)}m ago`;
                                if (ms < 86_400_000) return `${Math.round(ms / 3_600_000)}h ago`;
                                return `${Math.round(ms / 86_400_000)}d ago`;
                              })()}
                            </>
                          )}
                        </>
                      ) : (
                        <span className="text-amber-700">not connected</span>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

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
                    <div className="text-sm text-muted-foreground">
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
                    <div className="text-sm text-muted-foreground">
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
                    <div className="text-sm text-muted-foreground">
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
                <CardTitle className="text-destructive">
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
          <div className="text-center text-sm text-muted-foreground">
            Last updated: {new Date(stats.lastUpdated).toLocaleString()}
            {autoRefresh && " • Auto-refreshing every 30 seconds"}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
