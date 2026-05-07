/**
 * Admin Jobs page — surface blog-generation jobs that got paused or
 * stuck and need an admin's attention.
 *
 * The worker auto-pauses any job that was running when the server
 * restarted (server/services/blog-lifecycle.ts:67) — historically
 * those jobs had no UI surface, so admins had to know to look at the
 * blog_generation_jobs table directly. This page lists them, shows
 * progress, and provides Resume / Cancel buttons.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { errMessage } from "@/lib/utils";
import {
  Play,
  Pause,
  X,
  RefreshCw,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Clock,
} from "lucide-react";

interface BlogJob {
  id: number;
  status: "pending" | "running" | "paused" | "completed" | "failed" | "cancelled";
  totalItems: number;
  completedItems: number;
  failedItems: number;
  savedItems: number;
  currentStudyIndex: number;
  currentTypeIndex: number;
  lastError: string | null;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  updatedAt: string;
}

interface WorkerState {
  busy: boolean;
  currentJobId: number | null;
}

interface JobsResponse {
  success: boolean;
  jobs: BlogJob[];
  worker: WorkerState;
}

const STATUS_BADGES: Record<BlogJob["status"], { label: string; className: string; icon: typeof Play }> = {
  pending: { label: "Pending", className: "border-slate-400 text-slate-700 bg-slate-50", icon: Clock },
  running: { label: "Running", className: "border-blue-400 text-blue-700 bg-blue-50", icon: Loader2 },
  paused: { label: "Paused", className: "border-amber-400 text-amber-700 bg-amber-50", icon: Pause },
  completed: { label: "Completed", className: "border-green-400 text-green-700 bg-green-50", icon: CheckCircle2 },
  failed: { label: "Failed", className: "border-red-400 text-red-700 bg-red-50", icon: AlertTriangle },
  cancelled: { label: "Cancelled", className: "border-slate-400 text-slate-500 bg-slate-50", icon: X },
};

function formatRelative(iso: string | null): string {
  if (!iso) return "—";
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000) return "just now";
  if (ms < 3_600_000) return `${Math.round(ms / 60_000)}m ago`;
  if (ms < 86_400_000) return `${Math.round(ms / 3_600_000)}h ago`;
  return `${Math.floor(ms / 86_400_000)}d ago`;
}

export default function JobsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery<JobsResponse>({
    queryKey: ["/api/blog-recommendations/jobs"],
    queryFn: async () => {
      const res = await fetch("/api/blog-recommendations/jobs");
      if (!res.ok) throw new Error("Failed to fetch jobs");
      return res.json();
    },
    // Refetch every 5s so progress moves visibly while a job is running.
    refetchInterval: 5_000,
  });

  const startMutation = useMutation({
    mutationFn: async (jobId: number) => {
      const res = await apiRequest("POST", `/api/blog-recommendations/jobs/${jobId}/start`);
      return res.json();
    },
    onSuccess: (data: any) => {
      toast({
        title: data.success ? "Job resumed" : "Could not resume",
        description: data.message,
        variant: data.success ? undefined : "destructive",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/blog-recommendations/jobs"] });
    },
    onError: (err: unknown) => {
      toast({ title: "Resume failed", description: errMessage(err), variant: "destructive" });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: async (jobId: number) => {
      const res = await apiRequest("POST", `/api/blog-recommendations/jobs/${jobId}/cancel`);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Job cancelled" });
      queryClient.invalidateQueries({ queryKey: ["/api/blog-recommendations/jobs"] });
    },
    onError: (err: unknown) => {
      toast({ title: "Cancel failed", description: errMessage(err), variant: "destructive" });
    },
  });

  const pauseMutation = useMutation({
    mutationFn: async (jobId: number) => {
      const res = await apiRequest("POST", `/api/blog-recommendations/jobs/${jobId}/pause`);
      return res.json();
    },
    onSuccess: (data: any) => {
      toast({
        title: data.success ? "Pause requested" : "Could not pause",
        description: data.message,
        variant: data.success ? undefined : "destructive",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/blog-recommendations/jobs"] });
    },
    onError: (err: unknown) => {
      toast({ title: "Pause failed", description: errMessage(err), variant: "destructive" });
    },
  });

  const jobs = data?.jobs ?? [];
  // Surface paused jobs first since they're what the admin most likely
  // came here to deal with. Running next, then everything else by date.
  const sortedJobs = [...jobs].sort((a, b) => {
    const order: Record<BlogJob["status"], number> = {
      paused: 0, running: 1, pending: 2, failed: 3, completed: 4, cancelled: 5,
    };
    if (order[a.status] !== order[b.status]) return order[a.status] - order[b.status];
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });

  const pausedCount = jobs.filter((j) => j.status === "paused").length;
  const runningCount = jobs.filter((j) => j.status === "running").length;
  const failedCount = jobs.filter((j) => j.status === "failed").length;

  return (
    <AdminLayout
      title="Blog generation jobs"
      description="Resume paused jobs (typically left over from server restarts) or cancel ones that are no longer wanted"
    >
      <div className="grid gap-4 md:grid-cols-3 mb-6">
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Paused (need attention)</p>
            <p className="text-3xl font-bold tabular-nums text-amber-600">{pausedCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Running</p>
            <p className="text-3xl font-bold tabular-nums text-blue-600">{runningCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Failed</p>
            <p className="text-3xl font-bold tabular-nums text-red-600">{failedCount}</p>
          </CardContent>
        </Card>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      ) : sortedJobs.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            <CheckCircle2 className="h-10 w-10 mx-auto mb-3 opacity-50" />
            <p className="font-medium">No blog generation jobs.</p>
            <p className="text-sm mt-1">
              Jobs appear here when bulk generation is triggered from the
              recommendations admin.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {sortedJobs.map((job) => {
            const badge = STATUS_BADGES[job.status];
            const Icon = badge.icon;
            const progressPct = job.totalItems > 0
              ? ((job.completedItems + job.failedItems) / job.totalItems) * 100
              : 0;
            return (
              <Card key={job.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <CardTitle className="text-base">Job #{job.id}</CardTitle>
                      <Badge variant="outline" className={`text-xs ${badge.className}`}>
                        <Icon className={`h-3 w-3 mr-1 ${job.status === "running" ? "animate-spin" : ""}`} />
                        {badge.label}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      {job.status === "paused" && (
                        <Button
                          size="sm"
                          onClick={() => startMutation.mutate(job.id)}
                          disabled={startMutation.isPending || (data?.worker.busy ?? false)}
                          title={data?.worker.busy ? "Worker is busy with another job" : "Resume from where it left off"}
                        >
                          <Play className="h-3 w-3 mr-1" />
                          Resume
                        </Button>
                      )}
                      {job.status === "running" && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => pauseMutation.mutate(job.id)}
                          disabled={pauseMutation.isPending}
                        >
                          <Pause className="h-3 w-3 mr-1" />
                          Pause
                        </Button>
                      )}
                      {(job.status === "paused" || job.status === "running" || job.status === "pending") && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            if (confirm(`Cancel job #${job.id}? Progress so far is preserved.`)) {
                              cancelMutation.mutate(job.id);
                            }
                          }}
                          disabled={cancelMutation.isPending}
                        >
                          <X className="h-3 w-3 mr-1" />
                          Cancel
                        </Button>
                      )}
                    </div>
                  </div>
                  <CardDescription className="font-mono text-xs">
                    Created {formatRelative(job.createdAt)}
                    {job.startedAt && ` · Started ${formatRelative(job.startedAt)}`}
                    {job.completedAt && ` · Finished ${formatRelative(job.completedAt)}`}
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-0 space-y-3">
                  <div>
                    <Progress value={progressPct} className="h-2" />
                    <div className="flex items-center justify-between mt-1.5 text-xs text-muted-foreground tabular-nums">
                      <span>
                        {job.completedItems + job.failedItems} / {job.totalItems} items processed
                      </span>
                      <span>
                        {job.savedItems} saved · {job.failedItems} failed
                      </span>
                    </div>
                  </div>
                  {job.lastError && (
                    <div className="rounded-md border border-red-200 bg-red-50 p-2 text-xs">
                      <span className="font-medium text-red-900">Last error:</span>{" "}
                      <span className="text-red-800 break-words">{job.lastError.slice(0, 300)}</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {data?.worker.busy && (
        <p className="mt-4 text-xs text-muted-foreground text-center">
          <RefreshCw className="inline h-3 w-3 mr-1 animate-spin" />
          Worker is busy with job #{data.worker.currentJobId}. Refreshing every 5s.
        </p>
      )}
    </AdminLayout>
  );
}
