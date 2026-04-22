import { useState } from "react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  RefreshCw,
  Search,
  Zap,
  GitBranch,
  FileText,
  Clock,
  CheckCircle,
  XCircle,
  Loader2,
  ChevronDown,
  Wrench,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import AdminLayout from "@/components/admin/AdminLayout";

function statusBadge(status: string) {
  const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
    pending: "outline",
    processing: "secondary",
    completed: "default",
    failed: "destructive",
    running: "secondary",
  };
  return <Badge variant={variants[status] || "outline"}>{status}</Badge>;
}

function formatDate(date: string | null) {
  if (!date) return "—";
  return new Date(date).toLocaleString();
}

export default function PipelineDashboardPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [queueFilter, setQueueFilter] = useState<string>("");

  // Status overview
  const { data: status, isLoading: statusLoading } = useQuery({
    queryKey: ["/api/pipeline/status"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/pipeline/status");
      return res.json();
    },
    refetchInterval: 30000,
  });

  // Queue items
  const { data: queueData, isLoading: queueLoading } = useQuery({
    queryKey: ["/api/pipeline/queue", queueFilter],
    queryFn: async () => {
      const url = queueFilter
        ? `/api/pipeline/queue?status=${queueFilter}&limit=50`
        : "/api/pipeline/queue?limit=50";
      const res = await apiRequest("GET", url);
      return res.json();
    },
  });

  // Discovery runs
  const { data: runsData } = useQuery({
    queryKey: ["/api/pipeline/runs"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/pipeline/runs?limit=20");
      return res.json();
    },
  });

  // Digests
  const { data: digestsData } = useQuery({
    queryKey: ["/api/pipeline/digests"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/pipeline/digests?limit=20");
      return res.json();
    },
  });

  // Mutations
  const discoverMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/pipeline/discover");
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: "Discovery Complete", description: `Found ${data.found} papers, ${data.queued} queued for processing.` });
      queryClient.invalidateQueries({ queryKey: ["/api/pipeline"] });
    },
    onError: () => { toast({ title: "Discovery Failed", variant: "destructive" }); },
  });

  const processMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/pipeline/process");
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: "Processing Complete", description: `${data.succeeded} succeeded, ${data.failed} failed of ${data.processed} processed.` });
      queryClient.invalidateQueries({ queryKey: ["/api/pipeline"] });
    },
    onError: () => { toast({ title: "Processing Failed", variant: "destructive" }); },
  });

  const citationMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/pipeline/citations/build");
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: "Citation Build Complete", description: `Processed ${data.studiesProcessed} studies.` });
      queryClient.invalidateQueries({ queryKey: ["/api/pipeline"] });
    },
    onError: () => { toast({ title: "Citation Build Failed", variant: "destructive" }); },
  });

  const digestMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/pipeline/digests/generate");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Digest Generated" });
      queryClient.invalidateQueries({ queryKey: ["/api/pipeline"] });
    },
    onError: () => { toast({ title: "Digest Generation Failed", variant: "destructive" }); },
  });

  const reprocessMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("POST", `/api/pipeline/reprocess/${id}`);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Item Queued for Reprocessing" });
      queryClient.invalidateQueries({ queryKey: ["/api/pipeline/queue"] });
    },
  });

  const anyMutating = discoverMutation.isPending || processMutation.isPending || citationMutation.isPending || digestMutation.isPending;

  return (
    <AdminLayout
      title="Pipeline Monitor"
      description="Observe the autonomous research discovery, analysis, and publishing pipeline. Jobs run automatically on a schedule."
    >
      <div className="space-y-6">

        <Tabs defaultValue="overview">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="queue">Pipeline Queue</TabsTrigger>
            <TabsTrigger value="runs">Discovery Runs</TabsTrigger>
            <TabsTrigger value="digests">Weekly Digests</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Pending</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <Clock className="h-5 w-5 text-yellow-500" />
                    <span className="text-2xl font-bold">{status?.queue?.pending ?? "—"}</span>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Processing</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />
                    <span className="text-2xl font-bold">{status?.queue?.processing ?? "—"}</span>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Completed</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-green-500" />
                    <span className="text-2xl font-bold">{status?.queue?.completed ?? "—"}</span>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Failed</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <XCircle className="h-5 w-5 text-destructive" />
                    <span className="text-2xl font-bold">{status?.queue?.failed ?? "—"}</span>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Citations Tracked</CardTitle>
                </CardHeader>
                <CardContent>
                  <span className="text-2xl font-bold">{status?.citations ?? "—"}</span>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Published Digests</CardTitle>
                </CardHeader>
                <CardContent>
                  <span className="text-2xl font-bold">{status?.publishedDigests ?? "—"}</span>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Last Discovery Run</CardTitle>
                </CardHeader>
                <CardContent>
                  {status?.lastDiscoveryRun ? (
                    <div className="space-y-1">
                      {statusBadge(status.lastDiscoveryRun.status)}
                      <p className="text-sm text-muted-foreground">
                        {formatDate(status.lastDiscoveryRun.createdAt)}
                      </p>
                      <p className="text-sm">
                        {status.lastDiscoveryRun.newCount} new, {status.lastDiscoveryRun.queuedCount} queued
                      </p>
                    </div>
                  ) : (
                    <span className="text-muted-foreground">No runs yet</span>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Queue Tab */}
          <TabsContent value="queue" className="space-y-4">
            <div className="flex gap-2">
              {["", "pending", "processing", "completed", "failed"].map((f) => (
                <Button
                  key={f}
                  variant={queueFilter === f ? "default" : "outline"}
                  size="sm"
                  onClick={() => setQueueFilter(f)}
                >
                  {f || "All"}
                </Button>
              ))}
            </div>

            <Card className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Step</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {queueData?.items?.map((item: any) => (
                    <TableRow key={item.id}>
                      <TableCell>{item.id}</TableCell>
                      <TableCell className="max-w-xs truncate" title={item.title}>
                        {item.title}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{item.sourcePlatform || "—"}</Badge>
                      </TableCell>
                      <TableCell>{statusBadge(item.status)}</TableCell>
                      <TableCell>{item.currentStep}/6</TableCell>
                      <TableCell className="text-sm">{formatDate(item.createdAt)}</TableCell>
                      <TableCell>
                        {item.status === "failed" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => reprocessMutation.mutate(item.id)}
                            disabled={reprocessMutation.isPending}
                          >
                            <RefreshCw className="h-3 w-3 mr-1" />
                            Retry
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {(!queueData?.items || queueData.items.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                        No items in queue
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </Card>
            {queueData?.total > 0 && (
              <p className="text-sm text-muted-foreground">
                Showing {queueData.items.length} of {queueData.total} items
              </p>
            )}
          </TabsContent>

          {/* Discovery Runs Tab */}
          <TabsContent value="runs" className="space-y-4">
            <Card className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Found</TableHead>
                    <TableHead>New</TableHead>
                    <TableHead>Duplicates</TableHead>
                    <TableHead>Queued</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {runsData?.runs?.map((run: any) => (
                    <TableRow key={run.id}>
                      <TableCell>{run.id}</TableCell>
                      <TableCell>{run.source}</TableCell>
                      <TableCell>{statusBadge(run.status)}</TableCell>
                      <TableCell>{run.foundCount}</TableCell>
                      <TableCell>{run.newCount}</TableCell>
                      <TableCell>{run.duplicateCount}</TableCell>
                      <TableCell>{run.queuedCount}</TableCell>
                      <TableCell>{run.durationMs ? `${(run.durationMs / 1000).toFixed(1)}s` : "—"}</TableCell>
                      <TableCell className="text-sm">{formatDate(run.createdAt)}</TableCell>
                    </TableRow>
                  ))}
                  {(!runsData?.runs || runsData.runs.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                        No discovery runs yet
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>

          {/* Digests Tab */}
          <TabsContent value="digests" className="space-y-4">
            {digestsData?.digests?.map((digest: any) => (
              <Card key={digest.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-lg">{digest.title}</CardTitle>
                      <CardDescription>
                        {digest.weekStart} to {digest.weekEnd} | {digest.studyCount} studies
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      {digest.isPublished ? (
                        <Badge>Published</Badge>
                      ) : (
                        <Badge variant="outline">Draft</Badge>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {digest.trendingTopics && (
                    <div className="flex flex-wrap gap-1 mb-2">
                      {JSON.parse(digest.trendingTopics).map((topic: string, i: number) => (
                        <Badge key={i} variant="secondary">{topic}</Badge>
                      ))}
                    </div>
                  )}
                  <p className="text-sm text-muted-foreground">
                    {digest.metaDescription || "No description"}
                  </p>
                </CardContent>
              </Card>
            ))}
            {(!digestsData?.digests || digestsData.digests.length === 0) && (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  No digests generated yet
                </CardContent>
              </Card>
            )}
          </TabsContent>

        </Tabs>

        {/* Ops controls — hidden by default. Jobs run automatically on a schedule;
            force-run buttons are for troubleshooting only. */}
        <Collapsible>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="text-muted-foreground">
              <Wrench className="h-4 w-4 mr-2" />
              Ops controls (advanced)
              <ChevronDown className="h-4 w-4 ml-2" />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-4">
            <Card>
              <CardHeader className="pb-3">
                <CardDescription>
                  These jobs run automatically on a schedule. Force-run only when debugging.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => discoverMutation.mutate()}
                    disabled={anyMutating}
                  >
                    {discoverMutation.isPending ? (
                      <Loader2 className="h-3 w-3 mr-2 animate-spin" />
                    ) : (
                      <Search className="h-3 w-3 mr-2" />
                    )}
                    Discovery
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => processMutation.mutate()}
                    disabled={anyMutating}
                  >
                    {processMutation.isPending ? (
                      <Loader2 className="h-3 w-3 mr-2 animate-spin" />
                    ) : (
                      <Zap className="h-3 w-3 mr-2" />
                    )}
                    Process queue
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => citationMutation.mutate()}
                    disabled={anyMutating}
                  >
                    {citationMutation.isPending ? (
                      <Loader2 className="h-3 w-3 mr-2 animate-spin" />
                    ) : (
                      <GitBranch className="h-3 w-3 mr-2" />
                    )}
                    Build citations
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => digestMutation.mutate()}
                    disabled={anyMutating}
                  >
                    {digestMutation.isPending ? (
                      <Loader2 className="h-3 w-3 mr-2 animate-spin" />
                    ) : (
                      <FileText className="h-3 w-3 mr-2" />
                    )}
                    Generate digest
                  </Button>
                </div>
              </CardContent>
            </Card>
          </CollapsibleContent>
        </Collapsible>
      </div>
    </AdminLayout>
  );
}
