/**
 * Admin GA4 Analytics page.
 *
 * Two views:
 *   • Top-engaged pages — engagement_rate × sessions, last 30d
 *   • Internal search — what users typed into the on-site search bar
 *
 * Connection panel mirrors the GSC page: click Connect → server-side
 * OAuth dance → refresh token persists encrypted → cron drives sync.
 */

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2,
  Activity,
  Search,
  RefreshCw,
  Link2Off,
  CheckCircle2,
  ExternalLink,
} from "lucide-react";

interface Ga4Status {
  connected: boolean;
  accountEmail: string | null;
  propertyId: string;
  connectedAt: string | null;
  lastSyncAt: string | null;
  lastRun: {
    startedAt: string;
    completedAt: string | null;
    status: "running" | "success" | "failed";
    daysPulled: number;
    rowsInserted: number;
    rowsUpdated: number;
    error: string | null;
  } | null;
}

interface TopEngagedRow {
  page: string;
  sessions: number;
  engaged_sessions: number;
  engagement_rate: number;
  avg_engagement_time: number;
  conversions: number;
}

interface SearchTermRow {
  search_term: string;
  event_count: number;
}

function formatRelative(iso: string | null) {
  if (!iso) return "never";
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000) return "just now";
  if (ms < 3_600_000) return `${Math.round(ms / 60_000)}m ago`;
  if (ms < 86_400_000) return `${Math.round(ms / 3_600_000)}h ago`;
  return `${Math.round(ms / 86_400_000)}d ago`;
}

function formatSeconds(s: number) {
  if (!s || s < 1) return "—";
  if (s < 60) return `${s.toFixed(0)}s`;
  return `${Math.floor(s / 60)}m ${Math.round(s % 60)}s`;
}

export default function AnalyticsGa4Page() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<"engaged" | "search">("engaged");

  const { data: status, isLoading: statusLoading } = useQuery<Ga4Status>({
    queryKey: ["/api/admin/ga4/status"],
    queryFn: async () => {
      const res = await fetch("/api/admin/ga4/status");
      if (!res.ok) throw new Error("Failed to fetch GA4 status");
      return res.json();
    },
    refetchInterval: 30_000,
  });

  const disconnectMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/admin/ga4/disconnect", { method: "POST" });
      if (!res.ok) throw new Error("Failed to disconnect");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Disconnected from Google Analytics" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/ga4/status"] });
    },
  });

  const syncMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/admin/ga4/sync", { method: "POST" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Sync failed");
      return body as { daysPulled: number; rowsInserted: number; rowsUpdated: number };
    },
    onSuccess: (data) => {
      toast({
        title: "Sync complete",
        description: `${data.daysPulled} day(s) pulled, ${data.rowsInserted} new rows, ${data.rowsUpdated} updated`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/ga4/status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/ga4/top-engaged"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/ga4/search-terms"] });
    },
    onError: (err: any) => {
      toast({ title: "Sync failed", description: err.message, variant: "destructive" });
    },
  });

  const enabled = !!status?.connected;
  const { data: topEngaged, isLoading: engagedLoading } = useQuery<{ data: TopEngagedRow[] }>({
    queryKey: ["/api/admin/ga4/top-engaged"],
    queryFn: async () => {
      const res = await fetch("/api/admin/ga4/top-engaged");
      if (!res.ok) throw new Error("Failed to fetch engaged pages");
      return res.json();
    },
    enabled,
  });
  const { data: searchTerms, isLoading: searchLoading } = useQuery<{ data: SearchTermRow[] }>({
    queryKey: ["/api/admin/ga4/search-terms"],
    queryFn: async () => {
      const res = await fetch("/api/admin/ga4/search-terms");
      if (!res.ok) throw new Error("Failed to fetch search terms");
      return res.json();
    },
    enabled,
  });

  return (
    <AdminLayout
      title="Analytics (GA4)"
      description="Engagement and on-site search behavior — what readers do once they land"
    >
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Google Analytics 4
            </CardTitle>
            <CardDescription>
              Property: <code className="font-mono">{status?.propertyId || "—"}</code>
            </CardDescription>
          </CardHeader>
          <CardContent>
            {statusLoading ? (
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            ) : status?.connected ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <span className="text-sm font-medium">Connected</span>
                  <Badge variant="outline" className="text-xs">
                    {status.accountEmail}
                  </Badge>
                </div>
                <div className="text-xs text-muted-foreground space-y-1">
                  <div>
                    Last sync: {formatRelative(status.lastSyncAt)}
                    {status.lastRun && (
                      <span className="ml-2">
                        ({status.lastRun.daysPulled} day(s),{" "}
                        {status.lastRun.rowsInserted} new + {status.lastRun.rowsUpdated} updated)
                      </span>
                    )}
                  </div>
                  {status.lastRun?.status === "failed" && (
                    <div className="text-destructive">
                      Last sync failed: {status.lastRun.error ?? "unknown error"}
                    </div>
                  )}
                </div>
                <div className="flex gap-2 pt-1">
                  <Button
                    size="sm"
                    onClick={() => syncMutation.mutate()}
                    disabled={syncMutation.isPending}
                  >
                    {syncMutation.isPending ? (
                      <><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Syncing...</>
                    ) : (
                      <><RefreshCw className="h-3 w-3 mr-1" /> Sync now</>
                    )}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => disconnectMutation.mutate()}
                    disabled={disconnectMutation.isPending}
                  >
                    <Link2Off className="h-3 w-3 mr-1" />
                    Disconnect
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Not connected. Click below to authorize with the Google account
                  that has access to property{" "}
                  <code className="font-mono">{status?.propertyId || "(unset)"}</code>.
                </p>
                {!status?.propertyId && (
                  <p className="text-xs text-destructive">
                    Set <code className="font-mono">GA4_PROPERTY_ID</code> in
                    Railway env vars before connecting.
                  </p>
                )}
                <Button
                  onClick={() => (window.location.href = "/api/admin/ga4/oauth/start")}
                  disabled={!status?.propertyId}
                >
                  Connect Google Analytics
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {status?.connected && (
          <Card>
            <CardHeader>
              <CardTitle>Engagement insights</CardTitle>
              <CardDescription>
                Last 30 days. Engagement = the half of the picture GSC can't show.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
                <TabsList className="grid grid-cols-2 w-full md:w-auto">
                  <TabsTrigger value="engaged" className="gap-1.5">
                    <Activity className="h-3.5 w-3.5" />
                    Top Engaged
                    {topEngaged?.data && (
                      <Badge variant="secondary" className="ml-1 text-[10px]">
                        {topEngaged.data.length}
                      </Badge>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="search" className="gap-1.5">
                    <Search className="h-3.5 w-3.5" />
                    Internal Search
                    {searchTerms?.data && (
                      <Badge variant="secondary" className="ml-1 text-[10px]">
                        {searchTerms.data.length}
                      </Badge>
                    )}
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="engaged" className="mt-4">
                  <p className="text-xs text-muted-foreground mb-3">
                    Pages with ≥50 sessions in the past 30 days, sorted by
                    engagement rate. High engagement on a thin page = pillar
                    candidate; low engagement on a hero page = rewrite target.
                  </p>
                  {engagedLoading ? (
                    <div className="flex items-center justify-center p-8">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : (topEngaged?.data ?? []).length === 0 ? (
                    <div className="text-center py-8 text-sm text-muted-foreground">
                      No qualifying pages yet. Either nothing has hit 50 sessions
                      or the first sync hasn't pulled enough data.
                    </div>
                  ) : (
                    <div className="border rounded-md overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-muted/40">
                          <tr>
                            <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Page</th>
                            <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">Sessions</th>
                            <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">Engaged</th>
                            <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">Rate</th>
                            <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">Avg time</th>
                            <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">Conv.</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(topEngaged?.data ?? []).map((row, i) => (
                            <tr key={i} className="border-t hover:bg-muted/20">
                              <td className="px-3 py-2 font-mono text-xs truncate max-w-[300px]">
                                <a
                                  href={row.page}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="hover:underline inline-flex items-center gap-1"
                                >
                                  {row.page}
                                  <ExternalLink className="h-3 w-3" />
                                </a>
                              </td>
                              <td className="px-3 py-2 text-right tabular-nums">{row.sessions.toLocaleString()}</td>
                              <td className="px-3 py-2 text-right tabular-nums">{row.engaged_sessions.toLocaleString()}</td>
                              <td className="px-3 py-2 text-right tabular-nums">
                                {row.engagement_rate != null ? `${(row.engagement_rate * 100).toFixed(1)}%` : "—"}
                              </td>
                              <td className="px-3 py-2 text-right tabular-nums">
                                {formatSeconds(row.avg_engagement_time)}
                              </td>
                              <td className="px-3 py-2 text-right tabular-nums">{row.conversions.toLocaleString()}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="search" className="mt-4">
                  <p className="text-xs text-muted-foreground mb-3">
                    Top queries typed into the on-site search bar (past 30 days).
                    Often a goldmine for content gaps — what visitors expect to find
                    but can't surface via existing nav.
                  </p>
                  {searchLoading ? (
                    <div className="flex items-center justify-center p-8">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : (searchTerms?.data ?? []).length === 0 ? (
                    <div className="text-center py-8 text-sm text-muted-foreground">
                      No search terms recorded. Either site search isn't enabled
                      in GA4's enhanced measurement, or no one's used it yet.
                    </div>
                  ) : (
                    <div className="border rounded-md overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-muted/40">
                          <tr>
                            <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Search term</th>
                            <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">Searches</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(searchTerms?.data ?? []).map((row, i) => (
                            <tr key={i} className="border-t hover:bg-muted/20">
                              <td className="px-3 py-2 font-medium">{row.search_term}</td>
                              <td className="px-3 py-2 text-right tabular-nums">{row.event_count.toLocaleString()}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        )}
      </div>
    </AdminLayout>
  );
}
