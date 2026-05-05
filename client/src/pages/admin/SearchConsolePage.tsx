/**
 * Admin Search Console page.
 *
 * Three opportunity views drive the workflow:
 *   • Climbers — queries at position 11–30 (almost-page-1 lifts)
 *   • Low-CTR pages — title/meta-description rewrites
 *   • Orphan queries — Google sends us traffic for queries we don't
 *     have a dedicated page for (gap = build it)
 *
 * The connection panel is intentionally minimal — clicking Connect kicks
 * off a server-side OAuth redirect; the user authorizes once, the refresh
 * token gets encrypted and stored, and the cron takes over from there.
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
  TrendingUp,
  AlertTriangle,
  Search,
  RefreshCw,
  Link2Off,
  CheckCircle2,
  ExternalLink,
} from "lucide-react";

interface GscStatus {
  connected: boolean;
  accountEmail: string | null;
  siteUrl: string;
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

interface ClimberRow {
  query: string;
  page: string;
  impressions: number;
  clicks: number;
  avg_position: number;
  best_position: number;
}
interface LowCtrRow {
  page: string;
  impressions: number;
  clicks: number;
  ctr: number;
  avg_position: number;
}
interface OrphanRow {
  query: string;
  impressions: number;
  clicks: number;
  avg_position: number;
  best_page: string;
}
interface InternalSearchRow {
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

export default function SearchConsolePage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<"climbers" | "low-ctr" | "orphan" | "internal-search">("climbers");

  // ── Connection status ───────────────────────────────────────
  const { data: status, isLoading: statusLoading } = useQuery<GscStatus>({
    queryKey: ["/api/admin/gsc/status"],
    queryFn: async () => {
      const res = await fetch("/api/admin/gsc/status");
      if (!res.ok) throw new Error("Failed to fetch GSC status");
      return res.json();
    },
    refetchInterval: 30_000,
  });

  const disconnectMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/admin/gsc/disconnect", { method: "POST" });
      if (!res.ok) throw new Error("Failed to disconnect");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Disconnected from Google Search Console" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/gsc/status"] });
    },
  });

  const syncMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/admin/gsc/sync", { method: "POST" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Sync failed");
      return body as { daysPulled: number; rowsInserted: number; rowsUpdated: number };
    },
    onSuccess: (data) => {
      toast({
        title: "Sync complete",
        description: `${data.daysPulled} day(s) pulled, ${data.rowsInserted} new rows, ${data.rowsUpdated} updated`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/gsc/status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/gsc/opportunities"] });
    },
    onError: (err: any) => {
      toast({ title: "Sync failed", description: err.message, variant: "destructive" });
    },
  });

  // ── Opportunity queries (only fetch when connected) ─────────
  const enabled = !!status?.connected;
  const { data: climbers, isLoading: climbersLoading } = useQuery<{ data: ClimberRow[] }>({
    queryKey: ["/api/admin/gsc/opportunities/climbers"],
    queryFn: async () => {
      const res = await fetch("/api/admin/gsc/opportunities/climbers");
      if (!res.ok) throw new Error("Failed to fetch climbers");
      return res.json();
    },
    enabled,
  });
  const { data: lowCtr, isLoading: lowCtrLoading } = useQuery<{ data: LowCtrRow[] }>({
    queryKey: ["/api/admin/gsc/opportunities/low-ctr"],
    queryFn: async () => {
      const res = await fetch("/api/admin/gsc/opportunities/low-ctr");
      if (!res.ok) throw new Error("Failed to fetch low-CTR pages");
      return res.json();
    },
    enabled,
  });
  const { data: orphan, isLoading: orphanLoading } = useQuery<{ data: OrphanRow[] }>({
    queryKey: ["/api/admin/gsc/opportunities/orphan-queries"],
    queryFn: async () => {
      const res = await fetch("/api/admin/gsc/opportunities/orphan-queries");
      if (!res.ok) throw new Error("Failed to fetch orphan queries");
      return res.json();
    },
    enabled,
  });
  // Internal search comes from GA4, not GSC — the tab lives here because
  // it complements the Google-search story (what users typed once they
  // landed). Query is GA4-gated, but we don't surface a separate "GA4
  // not connected" state — just an empty table with a helpful note.
  const { data: internalSearch, isLoading: internalSearchLoading } = useQuery<{ data: InternalSearchRow[] }>({
    queryKey: ["/api/admin/ga4/search-terms"],
    queryFn: async () => {
      const res = await fetch("/api/admin/ga4/search-terms");
      if (!res.ok) throw new Error("Failed to fetch internal search");
      return res.json();
    },
    enabled: activeTab === "internal-search",
  });

  // ── Render ─────────────────────────────────────────────────
  return (
    <AdminLayout
      title="Search Console"
      description="Monitor what's working in Google search and find content opportunities"
    >
      <div className="space-y-6">
        {/* Connection card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="h-5 w-5" />
              Google Search Console
            </CardTitle>
            <CardDescription>
              {status?.siteUrl ?? "—"}
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
                  Not connected. Click below to authorize with the Google
                  account that has access to{" "}
                  <code className="font-mono">{status?.siteUrl}</code>.
                </p>
                <Button onClick={() => (window.location.href = "/api/admin/gsc/oauth/start")}>
                  Connect Google Search Console
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Opportunities */}
        {status?.connected && (
          <Card>
            <CardHeader>
              <CardTitle>Opportunities</CardTitle>
              <CardDescription>
                Last 30 days of Search Console data. Three views, three
                actions.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
                <TabsList className="grid grid-cols-4 w-full md:w-auto">
                  <TabsTrigger value="climbers" className="gap-1.5">
                    <TrendingUp className="h-3.5 w-3.5" />
                    Climbers
                    {climbers?.data && (
                      <Badge variant="secondary" className="ml-1 text-[10px]">
                        {climbers.data.length}
                      </Badge>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="low-ctr" className="gap-1.5">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    Low CTR
                    {lowCtr?.data && (
                      <Badge variant="secondary" className="ml-1 text-[10px]">
                        {lowCtr.data.length}
                      </Badge>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="orphan" className="gap-1.5">
                    <Search className="h-3.5 w-3.5" />
                    Orphan Queries
                    {orphan?.data && (
                      <Badge variant="secondary" className="ml-1 text-[10px]">
                        {orphan.data.length}
                      </Badge>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="internal-search" className="gap-1.5">
                    <Search className="h-3.5 w-3.5" />
                    Internal Search
                    {internalSearch?.data && (
                      <Badge variant="secondary" className="ml-1 text-[10px]">
                        {internalSearch.data.length}
                      </Badge>
                    )}
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="climbers" className="mt-4">
                  <p className="text-xs text-muted-foreground mb-3">
                    Queries you rank for at position 11–30 with ≥100 impressions in the
                    past 30 days. Small content lift moves these to page 1.
                  </p>
                  <OpportunityTable
                    loading={climbersLoading}
                    rows={climbers?.data ?? []}
                    columns={[
                      { key: "query", label: "Query", className: "font-medium" },
                      {
                        key: "page",
                        label: "Page",
                        className: "font-mono text-xs text-muted-foreground truncate max-w-[280px]",
                        render: (v: string) => (
                          <a
                            href={v}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:underline inline-flex items-center gap-1"
                          >
                            {new URL(v).pathname}
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        ),
                      },
                      { key: "impressions", label: "Impr.", numeric: true },
                      { key: "clicks", label: "Clicks", numeric: true },
                      {
                        key: "avg_position",
                        label: "Position",
                        numeric: true,
                        render: (v: number) => v.toFixed(1),
                      },
                    ]}
                  />
                </TabsContent>

                <TabsContent value="low-ctr" className="mt-4">
                  <p className="text-xs text-muted-foreground mb-3">
                    Pages with CTR &lt;2% AND ≥500 impressions in the past 30 days.
                    These usually need a better title or meta description — not new content.
                  </p>
                  <OpportunityTable
                    loading={lowCtrLoading}
                    rows={lowCtr?.data ?? []}
                    columns={[
                      {
                        key: "page",
                        label: "Page",
                        className: "font-mono text-xs",
                        render: (v: string) => (
                          <a
                            href={v}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:underline inline-flex items-center gap-1"
                          >
                            {new URL(v).pathname}
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        ),
                      },
                      { key: "impressions", label: "Impr.", numeric: true },
                      { key: "clicks", label: "Clicks", numeric: true },
                      {
                        key: "ctr",
                        label: "CTR",
                        numeric: true,
                        render: (v: number) => `${(v * 100).toFixed(2)}%`,
                      },
                      {
                        key: "avg_position",
                        label: "Position",
                        numeric: true,
                        render: (v: number) => v.toFixed(1),
                      },
                    ]}
                  />
                </TabsContent>

                <TabsContent value="orphan" className="mt-4">
                  <p className="text-xs text-muted-foreground mb-3">
                    Queries (≥50 impressions) where Google sends us traffic but we
                    don't have a study or blog post with a matching slug. Build the page,
                    win the click.
                  </p>
                  <OpportunityTable
                    loading={orphanLoading}
                    rows={orphan?.data ?? []}
                    columns={[
                      { key: "query", label: "Query", className: "font-medium" },
                      { key: "impressions", label: "Impr.", numeric: true },
                      { key: "clicks", label: "Clicks", numeric: true },
                      {
                        key: "avg_position",
                        label: "Position",
                        numeric: true,
                        render: (v: number) => v.toFixed(1),
                      },
                      {
                        key: "best_page",
                        label: "Currently lands on",
                        className: "font-mono text-xs text-muted-foreground truncate max-w-[260px]",
                        render: (v: string) => {
                          try {
                            return new URL(v).pathname;
                          } catch {
                            return v;
                          }
                        },
                      },
                    ]}
                  />
                </TabsContent>

                <TabsContent value="internal-search" className="mt-4">
                  <p className="text-xs text-muted-foreground mb-3">
                    What visitors typed into the on-site search bar over the past 30 days
                    (from GA4's <code className="font-mono">search</code> event). Often
                    distinct from what brings them in via Google — a goldmine for content
                    you should add or surface better in nav.
                  </p>
                  <OpportunityTable
                    loading={internalSearchLoading}
                    rows={internalSearch?.data ?? []}
                    columns={[
                      { key: "search_term", label: "Search term", className: "font-medium" },
                      { key: "event_count", label: "Searches", numeric: true },
                    ]}
                  />
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        )}
      </div>
    </AdminLayout>
  );
}

interface ColumnDef {
  key: string;
  label: string;
  numeric?: boolean;
  className?: string;
  render?: (value: any, row: any) => React.ReactNode;
}

function OpportunityTable({
  loading,
  rows,
  columns,
}: {
  loading: boolean;
  rows: any[];
  columns: ColumnDef[];
}) {
  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (rows.length === 0) {
    return (
      <div className="text-center py-8 text-sm text-muted-foreground">
        No opportunities in this category. Either nothing matches the
        thresholds yet, or sync hasn't pulled enough data.
      </div>
    );
  }
  return (
    <div className="border rounded-md overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-muted/40">
          <tr>
            {columns.map((c) => (
              <th
                key={c.key}
                className={`px-3 py-2 text-left text-xs font-medium text-muted-foreground ${
                  c.numeric ? "text-right" : ""
                }`}
              >
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-t hover:bg-muted/20">
              {columns.map((c) => {
                const v = row[c.key];
                return (
                  <td
                    key={c.key}
                    className={`px-3 py-2 ${c.numeric ? "text-right tabular-nums" : ""} ${c.className ?? ""}`}
                  >
                    {c.render ? c.render(v, row) : v}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
