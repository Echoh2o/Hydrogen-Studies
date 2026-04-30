import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { errMessage } from "@/lib/utils";
import AdminLayout from "@/components/admin/AdminLayout";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Plus,
  Pencil,
  Trash2,
  Loader2,
  ArrowRight,
  AlertTriangle,
  Wand2,
  ExternalLink,
  CheckSquare,
  XSquare,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────

interface Redirect {
  id: number;
  fromPath: string;
  toPath: string;
  statusCode: number;
  hitCount: number;
  lastHitAt: string | null;
  isActive: boolean;
  note: string | null;
  createdAt: string;
}

interface RedirectSuggestion {
  target: string;
  contentType: "study" | "blog" | "condition";
  title: string | null;
  score: number;
  reasons: string[];
}

interface NotFoundEntry {
  id: number;
  path: string;
  referrer: string | null;
  hitCount: number;
  firstSeenAt: string;
  lastSeenAt: string;
  resolved: boolean;
  suggestedTarget: string | null;
  suggestions: RedirectSuggestion[] | null;
  createdAt: string;
}

// ── Component ─────────────────────────────────────────────────

export default function RedirectsPage() {
  const { toast } = useToast();

  // Tab state
  const [activeTab, setActiveTab] = useState<"redirects" | "404s">("redirects");

  // Dialog states
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingRedirect, setEditingRedirect] = useState<Redirect | null>(null);
  const [resolveEntry, setResolveEntry] = useState<NotFoundEntry | null>(null);

  // Create form
  const [newRedirect, setNewRedirect] = useState({
    fromPath: "",
    toPath: "",
    statusCode: 301,
    note: "",
  });

  // 404 filter
  const [show404Resolved, setShow404Resolved] = useState<string>("false");

  // Redirects table filters. Server applies them via GET /api/admin/redirects?...
  const [redirectSearch, setRedirectSearch] = useState<string>("");
  const [redirectType, setRedirectType] = useState<"all" | "auto" | "manual">("all");
  const [redirectActive, setRedirectActive] = useState<"all" | "true" | "false">("all");

  // ── Queries ───────────────────────────────────────────────

  const {
    data: redirectsData,
    isLoading: redirectsLoading,
  } = useQuery<{ data: Redirect[] }>({
    // queryKey includes filter values so changing them refetches.
    queryKey: ["/api/admin/redirects", redirectSearch, redirectType, redirectActive],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (redirectSearch.trim()) params.set("search", redirectSearch.trim());
      if (redirectType !== "all") params.set("type", redirectType);
      if (redirectActive !== "all") params.set("active", redirectActive);
      const qs = params.toString();
      const res = await apiRequest("GET", `/api/admin/redirects${qs ? `?${qs}` : ""}`);
      return res.json();
    },
  });

  const {
    data: notFoundData,
    isLoading: notFoundLoading,
  } = useQuery<{ data: NotFoundEntry[] }>({
    queryKey: ["/api/admin/redirects/404s", show404Resolved],
    queryFn: async () => {
      const params = new URLSearchParams({ resolved: show404Resolved, limit: "100" });
      const res = await apiRequest("GET", `/api/admin/redirects/404s?${params}`);
      return res.json();
    },
  });

  const redirectsList = redirectsData?.data || [];
  const notFoundList = notFoundData?.data || [];

  const totalRedirects = redirectsList.length;
  const activeRedirects = redirectsList.filter((r) => r.isActive).length;
  const totalHits = redirectsList.reduce((sum, r) => sum + r.hitCount, 0);
  const unresolved404s = notFoundList.filter((e) => !e.resolved).length;

  // ── Mutations ─────────────────────────────────────────────

  const createMutation = useMutation({
    mutationFn: async (data: typeof newRedirect) => {
      const res = await apiRequest("POST", "/api/admin/redirects", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/redirects"] });
      toast({ title: "Redirect created" });
      setShowCreateDialog(false);
      setNewRedirect({ fromPath: "", toPath: "", statusCode: 301, note: "" });
    },
    onError: (error: unknown) => {
      toast({ title: "Failed to create redirect", description: errMessage(error), variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<Redirect> }) => {
      const res = await apiRequest("PUT", `/api/admin/redirects/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/redirects"] });
      toast({ title: "Redirect updated" });
      setEditingRedirect(null);
    },
    onError: (error: unknown) => {
      toast({ title: "Failed to update redirect", description: errMessage(error), variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/admin/redirects/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/redirects"] });
      toast({ title: "Redirect deleted" });
    },
    onError: (error: unknown) => {
      toast({ title: "Failed to delete redirect", description: errMessage(error), variant: "destructive" });
    },
  });

  const resolveMutation = useMutation({
    mutationFn: async ({ id, toPath, statusCode }: { id: number; toPath: string; statusCode: number }) => {
      const res = await apiRequest("POST", `/api/admin/redirects/404s/${id}/resolve`, { toPath, statusCode });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/redirects"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/redirects/404s"] });
      toast({ title: "404 resolved with redirect" });
      setResolveEntry(null);
    },
    onError: (error: unknown) => {
      toast({ title: "Failed to resolve 404", description: errMessage(error), variant: "destructive" });
    },
  });

  const backfillMutation = useMutation({
    mutationFn: async () => {
      // Server returns 202 immediately; the actual batch runs in the
      // background. We used to await here and trip the 30s fetch timeout
      // on a 500-entry batch (~100s of work). Now we just confirm it
      // started and refetch the lists shortly after.
      const res = await apiRequest("POST", "/api/admin/redirects/404s/backfill", { limit: 500 });
      return res.json();
    },
    onSuccess: (data: any) => {
      toast({
        title: "Backfill started",
        description:
          data.message ??
          `Processing up to ${data.batchSize ?? 500} entries in the background. Lists refresh in a moment.`,
      });
      // The batch runs server-side in the background. Refetch a couple
      // of times so the admin sees results land without a manual reload.
      // 8s catches small/fast batches; 45s catches the full 500-entry case.
      const refetch = () => {
        queryClient.invalidateQueries({ queryKey: ["/api/admin/redirects/404s"] });
        queryClient.invalidateQueries({ queryKey: ["/api/admin/redirects"] });
      };
      setTimeout(refetch, 8_000);
      setTimeout(refetch, 45_000);
    },
    onError: (error: unknown) => {
      toast({ title: "Backfill failed to start", description: errMessage(error), variant: "destructive" });
    },
  });

  // Selection state for bulk 404 actions. Keyed by id so stable across
  // re-renders even when row order shifts.
  const [selected404s, setSelected404s] = useState<Set<number>>(new Set());
  const clearSelection = () => setSelected404s(new Set());
  const toggleOne = (id: number) => {
    setSelected404s((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const bulkResolveMutation = useMutation({
    mutationFn: async (ids: number[]) => {
      const res = await apiRequest("POST", "/api/admin/redirects/404s/bulk-resolve", { ids });
      return res.json();
    },
    onSuccess: (data: any) => {
      const parts = [`Resolved ${data.resolved}`];
      if (data.skippedNoSuggestion > 0) parts.push(`skipped ${data.skippedNoSuggestion} (no suggestion)`);
      if (data.errors > 0) parts.push(`${data.errors} errored`);
      toast({ title: "Bulk resolve complete", description: parts.join(", ") });
      clearSelection();
      queryClient.invalidateQueries({ queryKey: ["/api/admin/redirects"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/redirects/404s"] });
    },
    onError: (error: unknown) => {
      toast({ title: "Bulk resolve failed", description: errMessage(error), variant: "destructive" });
    },
  });

  const bulkIgnoreMutation = useMutation({
    mutationFn: async (ids: number[]) => {
      const res = await apiRequest("POST", "/api/admin/redirects/404s/bulk-ignore", { ids });
      return res.json();
    },
    onSuccess: (data: any) => {
      toast({ title: "Bulk ignore complete", description: `Marked ${data.ignored} entries as resolved without redirect.` });
      clearSelection();
      queryClient.invalidateQueries({ queryKey: ["/api/admin/redirects/404s"] });
    },
    onError: (error: unknown) => {
      toast({ title: "Bulk ignore failed", description: errMessage(error), variant: "destructive" });
    },
  });

  const [diagnostics, setDiagnostics] = useState<any | null>(null);
  const diagnosticsMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("GET", "/api/admin/redirects/diagnostics");
      return res.json();
    },
    onSuccess: (data: any) => {
      setDiagnostics(data);
      toast({ title: "Diagnostics fetched" });
    },
    onError: (error: unknown) => {
      toast({ title: "Diagnostics failed", description: errMessage(error), variant: "destructive" });
    },
  });

  const toggleActive = (redirect: Redirect) => {
    updateMutation.mutate({ id: redirect.id, data: { isActive: !redirect.isActive } });
  };

  // ── Helpers ───────────────────────────────────────────────

  function formatDate(dateStr: string | null) {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  function formatRelative(dateStr: string | null) {
    if (!dateStr) return "never";
    const diff = Date.now() - new Date(dateStr).getTime();
    const hours = Math.floor(diff / 3600000);
    if (hours < 1) return "< 1h ago";
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days}d ago`;
    return formatDate(dateStr);
  }

  // ── Render ────────────────────────────────────────────────

  return (
    <AdminLayout title="Redirects" description="Manage 301/302 redirects and view 404 errors">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {redirectsLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <Skeleton className="h-4 w-24 mb-2" />
                <Skeleton className="h-8 w-16" />
              </CardContent>
            </Card>
          ))
        ) : (
          <>
            <Card>
              <CardContent className="p-4">
                <p className="text-sm text-muted-foreground">Total Redirects</p>
                <p className="text-2xl font-bold">{totalRedirects}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-sm text-muted-foreground">Active</p>
                <p className="text-2xl font-bold">{activeRedirects}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-sm text-muted-foreground">Total Hits</p>
                <p className="text-2xl font-bold">{totalHits.toLocaleString()}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-sm text-muted-foreground">Unresolved 404s</p>
                <p className="text-2xl font-bold text-orange-600">{unresolved404s}</p>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Tab bar */}
      <div className="flex items-center gap-4 mb-4 border-b">
        <button
          className={`pb-2 px-1 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "redirects"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-primary"
          }`}
          onClick={() => setActiveTab("redirects")}
        >
          Redirects ({totalRedirects})
        </button>
        <button
          className={`pb-2 px-1 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "404s"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-primary"
          }`}
          onClick={() => setActiveTab("404s")}
        >
          404 Log
        </button>
      </div>

      {/* ── Redirects Tab ─────────────────────────────────── */}
      {activeTab === "redirects" && (
        <>
          <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
            <div className="flex flex-wrap items-end gap-2">
              <div className="flex flex-col gap-1">
                <Label className="text-xs text-muted-foreground">Search</Label>
                <Input
                  placeholder="from or to path…"
                  value={redirectSearch}
                  onChange={(e) => setRedirectSearch(e.target.value)}
                  className="h-8 w-[220px] text-sm"
                />
              </div>
              <div className="flex flex-col gap-1">
                <Label className="text-xs text-muted-foreground">Type</Label>
                <Select value={redirectType} onValueChange={(v) => setRedirectType(v as typeof redirectType)}>
                  <SelectTrigger className="h-8 w-[140px] text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="auto">Auto-promoted</SelectItem>
                    <SelectItem value="manual">Manual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1">
                <Label className="text-xs text-muted-foreground">Active</Label>
                <Select value={redirectActive} onValueChange={(v) => setRedirectActive(v as typeof redirectActive)}>
                  <SelectTrigger className="h-8 w-[120px] text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="true">Active</SelectItem>
                    <SelectItem value="false">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {(redirectSearch || redirectType !== "all" || redirectActive !== "all") && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8"
                  onClick={() => {
                    setRedirectSearch("");
                    setRedirectType("all");
                    setRedirectActive("all");
                  }}
                >
                  Clear filters
                </Button>
              )}
              <p className="text-xs text-muted-foreground self-center ml-2">
                {totalRedirects} match{totalRedirects !== 1 ? "es" : ""}
              </p>
            </div>
            <Button size="sm" onClick={() => setShowCreateDialog(true)}>
              <Plus className="h-4 w-4 mr-1" />
              Add Redirect
            </Button>
          </div>

          {redirectsLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : redirectsList.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <ArrowRight className="h-10 w-10 mx-auto mb-3 opacity-50" />
              {redirectSearch || redirectType !== "all" || redirectActive !== "all" ? (
                <>
                  <p>No redirects match these filters.</p>
                  <p className="text-sm mt-1">Try clearing them.</p>
                </>
              ) : (
                <>
                  <p>No redirects configured yet.</p>
                  <p className="text-sm mt-1">Create one to start redirecting old URLs.</p>
                </>
              )}
            </div>
          ) : (
            <div className="border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[200px]">From</TableHead>
                    <TableHead className="min-w-[200px]">To</TableHead>
                    <TableHead className="w-[70px]">Code</TableHead>
                    <TableHead className="w-[80px] text-right">Hits</TableHead>
                    <TableHead className="w-[100px]">Last Hit</TableHead>
                    <TableHead className="w-[70px]">Active</TableHead>
                    <TableHead className="w-[90px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {redirectsList.map((r) => {
                    const isAutoPromoted = r.note?.startsWith("auto-promoted from 404") ?? false;
                    return (
                    <TableRow key={r.id}>
                      <TableCell className="font-mono text-sm truncate max-w-[250px]" title={r.fromPath}>
                        <div className="flex items-center gap-2">
                          <span className="truncate">{r.fromPath}</span>
                          {isAutoPromoted && (
                            <Badge
                              variant="outline"
                              className="text-[10px] px-1 py-0 h-4 border-amber-400 text-amber-700 bg-amber-50 shrink-0"
                              title={r.note ?? ""}
                            >
                              AUTO
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-sm truncate max-w-[250px]" title={r.toPath}>
                        {r.toPath}
                      </TableCell>
                      <TableCell>
                        <Badge variant={r.statusCode === 301 ? "default" : "secondary"}>
                          {r.statusCode}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{r.hitCount.toLocaleString()}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatRelative(r.lastHitAt)}
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={r.isActive}
                          onCheckedChange={() => toggleActive(r)}
                          disabled={updateMutation.isPending}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            onClick={() => setEditingRedirect(r)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-destructive hover:text-destructive"
                            onClick={() => {
                              if (confirm(`Delete redirect from ${r.fromPath}?`)) {
                                deleteMutation.mutate(r.id);
                              }
                            }}
                            disabled={deleteMutation.isPending}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </>
      )}

      {/* ── 404 Log Tab ───────────────────────────────────── */}
      {activeTab === "404s" && (
        <>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Select value={show404Resolved} onValueChange={setShow404Resolved}>
                <SelectTrigger className="w-[160px] h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="false">Unresolved</SelectItem>
                  <SelectItem value="true">Resolved</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground">
                {notFoundList.length} entries
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => diagnosticsMutation.mutate()}
                disabled={diagnosticsMutation.isPending}
                title="Probe pg_trgm + schema state to see why suggestions might be empty"
              >
                {diagnosticsMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <AlertTriangle className="h-4 w-4 mr-1" />
                )}
                Diagnostics
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => backfillMutation.mutate()}
                disabled={backfillMutation.isPending}
              >
                {backfillMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <Wand2 className="h-4 w-4 mr-1" />
                )}
                Auto-Suggest Targets
              </Button>
            </div>
          </div>

          {diagnostics && (
            <div className="mb-4 border rounded-md p-3 bg-muted/30 text-xs">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium">Diagnostics</span>
                <button
                  className="text-muted-foreground hover:text-foreground"
                  onClick={() => setDiagnostics(null)}
                >
                  dismiss
                </button>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-1 font-mono">
                <div>
                  pg_trgm:{" "}
                  <span className={diagnostics.pgTrgmAvailable ? "text-green-600" : "text-red-600"}>
                    {diagnostics.pgTrgmAvailable ? "available" : "unavailable"}
                  </span>
                </div>
                <div>
                  suggestions col:{" "}
                  <span className={diagnostics.suggestionsColumnExists ? "text-green-600" : "text-red-600"}>
                    {diagnostics.suggestionsColumnExists ? "exists" : "missing"}
                  </span>
                </div>
                <div>
                  sample sim:{" "}
                  <span>{diagnostics.sampleSimilarity != null ? diagnostics.sampleSimilarity.toFixed(3) : "—"}</span>
                </div>
                <div>studies indexed: {diagnostics.studiesIndexed}</div>
                <div>blogs indexed: {diagnostics.blogsIndexed}</div>
                <div>conditions indexed: {diagnostics.conditionsIndexed}</div>
                <div>unresolved 404s: {diagnostics.unresolvedTotal}</div>
                <div>with suggestions: {diagnostics.unresolvedWithSuggestions}</div>
                <div>without: {diagnostics.unresolvedWithoutSuggestions}</div>
                <div>min trgm threshold: {diagnostics.minTrgmThreshold}</div>
                <div>min overall score: {diagnostics.minOverallScore}</div>
              </div>
              {diagnostics.pgTrgmError && (
                <div className="mt-2 text-red-600 break-words">
                  pg_trgm error: {diagnostics.pgTrgmError}
                </div>
              )}
              {!diagnostics.pgTrgmAvailable && (
                <div className="mt-2 text-muted-foreground">
                  Fix: run <code>CREATE EXTENSION pg_trgm;</code> on the production Postgres
                  as a role with the privilege (often the DB owner or superuser).
                </div>
              )}
            </div>
          )}

          {/* Bulk action toolbar — appears when any 404 row is selected.
              The unresolved view is the only place selections make sense
              (resolved entries can't be re-resolved). */}
          {selected404s.size > 0 && show404Resolved === "false" && (
            <div className="mb-3 flex items-center justify-between gap-3 rounded-md border border-primary/30 bg-primary/5 px-3 py-2">
              <span className="text-sm font-medium">
                {selected404s.size} selected
              </span>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="default"
                  onClick={() => bulkResolveMutation.mutate(Array.from(selected404s))}
                  disabled={bulkResolveMutation.isPending || bulkIgnoreMutation.isPending}
                  title="Create a 301 redirect from each selected entry's path to its top suggestion. Skips entries with no suggestion."
                >
                  {bulkResolveMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  ) : (
                    <CheckSquare className="h-4 w-4 mr-1" />
                  )}
                  Resolve to Top Suggestion
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    if (confirm(`Mark ${selected404s.size} entries as resolved WITHOUT creating redirects? Visitors will continue to get 404 for these URLs.`)) {
                      bulkIgnoreMutation.mutate(Array.from(selected404s));
                    }
                  }}
                  disabled={bulkResolveMutation.isPending || bulkIgnoreMutation.isPending}
                  title="Mark as resolved with no redirect — use when no good target exists"
                >
                  {bulkIgnoreMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  ) : (
                    <XSquare className="h-4 w-4 mr-1" />
                  )}
                  Ignore
                </Button>
                <Button size="sm" variant="ghost" onClick={clearSelection}>
                  Clear
                </Button>
              </div>
            </div>
          )}

          {notFoundLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : notFoundList.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <AlertTriangle className="h-10 w-10 mx-auto mb-3 opacity-50" />
              <p>No 404 entries {show404Resolved === "true" ? "resolved" : "found"} yet.</p>
            </div>
          ) : (
            <div className="border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    {show404Resolved === "false" && (
                      <TableHead className="w-[40px]">
                        <Checkbox
                          checked={
                            notFoundList.length > 0 &&
                            notFoundList.every((e) => e.resolved || selected404s.has(e.id))
                          }
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSelected404s(new Set(notFoundList.filter((e) => !e.resolved).map((e) => e.id)));
                            } else {
                              clearSelection();
                            }
                          }}
                          aria-label="Select all visible 404 entries"
                        />
                      </TableHead>
                    )}
                    <TableHead className="min-w-[250px]">Path</TableHead>
                    <TableHead className="w-[80px] text-right">Hits</TableHead>
                    <TableHead className="w-[100px]">First Seen</TableHead>
                    <TableHead className="w-[100px]">Last Seen</TableHead>
                    <TableHead className="min-w-[200px]">Suggested Target</TableHead>
                    <TableHead className="w-[120px]">Referrer</TableHead>
                    <TableHead className="w-[90px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {notFoundList.map((entry) => (
                    <TableRow key={entry.id} data-state={selected404s.has(entry.id) ? "selected" : undefined}>
                      {show404Resolved === "false" && (
                        <TableCell className="w-[40px]">
                          {!entry.resolved && (
                            <Checkbox
                              checked={selected404s.has(entry.id)}
                              onCheckedChange={() => toggleOne(entry.id)}
                              aria-label={`Select ${entry.path}`}
                            />
                          )}
                        </TableCell>
                      )}
                      <TableCell className="font-mono text-sm truncate max-w-[300px]" title={entry.path}>
                        {entry.path}
                      </TableCell>
                      <TableCell className="text-right tabular-nums font-medium">
                        {entry.hitCount.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(entry.firstSeenAt)}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatRelative(entry.lastSeenAt)}
                      </TableCell>
                      <TableCell className="max-w-[280px]" title={entry.suggestedTarget || ""}>
                        {entry.suggestions && entry.suggestions.length > 0 ? (
                          <div className="flex flex-col gap-0.5">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs truncate text-green-600">
                                {entry.suggestions[0].target}
                              </span>
                              <ConfidenceBadge score={entry.suggestions[0].score} />
                            </div>
                            {entry.suggestions.length > 1 && (
                              <span className="text-[10px] text-muted-foreground">
                                +{entry.suggestions.length - 1} alternative{entry.suggestions.length > 2 ? "s" : ""}
                              </span>
                            )}
                          </div>
                        ) : entry.suggestedTarget ? (
                          <span className="font-mono text-xs text-green-600 truncate">{entry.suggestedTarget}</span>
                        ) : (
                          <span className="text-muted-foreground text-xs">No confident match</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground truncate max-w-[150px]" title={entry.referrer || ""}>
                        {entry.referrer || "-"}
                      </TableCell>
                      <TableCell>
                        {!entry.resolved && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs"
                            onClick={() => setResolveEntry(entry)}
                          >
                            <ExternalLink className="h-3 w-3 mr-1" />
                            Resolve
                          </Button>
                        )}
                        {entry.resolved && (
                          <Badge variant="secondary">Resolved</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </>
      )}

      {/* ── Create Redirect Dialog ────────────────────────── */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Redirect</DialogTitle>
            <DialogDescription>
              Add a new 301 or 302 redirect rule.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="fromPath">From Path</Label>
              <Input
                id="fromPath"
                placeholder="/old-page"
                value={newRedirect.fromPath}
                onChange={(e) => setNewRedirect({ ...newRedirect, fromPath: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="toPath">To Path</Label>
              <Input
                id="toPath"
                placeholder="/new-page"
                value={newRedirect.toPath}
                onChange={(e) => setNewRedirect({ ...newRedirect, toPath: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="statusCode">Status Code</Label>
              <Select
                value={String(newRedirect.statusCode)}
                onValueChange={(v) => setNewRedirect({ ...newRedirect, statusCode: Number(v) })}
              >
                <SelectTrigger id="statusCode">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="301">301 (Permanent)</SelectItem>
                  <SelectItem value="302">302 (Temporary)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="note">Note (optional)</Label>
              <Input
                id="note"
                placeholder="Why this redirect exists"
                value={newRedirect.note}
                onChange={(e) => setNewRedirect({ ...newRedirect, note: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => createMutation.mutate(newRedirect)}
              disabled={!newRedirect.fromPath || !newRedirect.toPath || createMutation.isPending}
            >
              {createMutation.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Edit Redirect Dialog ──────────────────────────── */}
      <Dialog open={!!editingRedirect} onOpenChange={(open) => !open && setEditingRedirect(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Redirect</DialogTitle>
            <DialogDescription>
              Update redirect from <code className="text-xs">{editingRedirect?.fromPath}</code>
            </DialogDescription>
          </DialogHeader>
          {editingRedirect && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="editToPath">To Path</Label>
                <Input
                  id="editToPath"
                  value={editingRedirect.toPath}
                  onChange={(e) => setEditingRedirect({ ...editingRedirect, toPath: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="editStatusCode">Status Code</Label>
                <Select
                  value={String(editingRedirect.statusCode)}
                  onValueChange={(v) => setEditingRedirect({ ...editingRedirect, statusCode: Number(v) })}
                >
                  <SelectTrigger id="editStatusCode">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="301">301 (Permanent)</SelectItem>
                    <SelectItem value="302">302 (Temporary)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="editNote">Note</Label>
                <Input
                  id="editNote"
                  value={editingRedirect.note || ""}
                  onChange={(e) => setEditingRedirect({ ...editingRedirect, note: e.target.value })}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingRedirect(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (!editingRedirect) return;
                updateMutation.mutate({
                  id: editingRedirect.id,
                  data: {
                    toPath: editingRedirect.toPath,
                    statusCode: editingRedirect.statusCode,
                    note: editingRedirect.note,
                  },
                });
              }}
              disabled={updateMutation.isPending}
            >
              {updateMutation.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Resolve 404 Dialog ────────────────────────────── */}
      <Dialog open={!!resolveEntry} onOpenChange={(open) => !open && setResolveEntry(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Resolve 404</DialogTitle>
            <DialogDescription>
              Create a redirect for <code className="text-xs">{resolveEntry?.path}</code>
              {resolveEntry?.hitCount && (
                <span className="ml-1">({resolveEntry.hitCount} hits)</span>
              )}
            </DialogDescription>
          </DialogHeader>
          {resolveEntry && (
            <ResolveForm
              entry={resolveEntry}
              onSubmit={(toPath, statusCode) => {
                resolveMutation.mutate({ id: resolveEntry.id, toPath, statusCode });
              }}
              onCancel={() => setResolveEntry(null)}
              isPending={resolveMutation.isPending}
            />
          )}
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}

/** Confidence badge for a suggestion score (0–1). */
function ConfidenceBadge({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  const tier = score >= 0.7 ? "high" : score >= 0.45 ? "med" : "low";
  const cls =
    tier === "high"
      ? "bg-green-100 text-green-800"
      : tier === "med"
      ? "bg-amber-100 text-amber-800"
      : "bg-muted text-muted-foreground";
  return (
    <span className={`inline-flex items-center rounded px-1.5 py-0 text-[10px] font-medium tabular-nums ${cls}`}>
      {pct}%
    </span>
  );
}

/** Small sub-component for the resolve form so we can have local state */
function ResolveForm({
  entry,
  onSubmit,
  onCancel,
  isPending,
}: {
  entry: NotFoundEntry;
  onSubmit: (toPath: string, statusCode: number) => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  const [suggestions, setSuggestions] = useState<RedirectSuggestion[]>(entry.suggestions ?? []);
  const [toPath, setToPath] = useState(
    entry.suggestions?.[0]?.target || entry.suggestedTarget || "",
  );
  const [statusCode, setStatusCode] = useState(301);
  const [refreshing, setRefreshing] = useState(false);

  async function refreshSuggestions() {
    setRefreshing(true);
    try {
      const res = await apiRequest(
        "GET",
        `/api/admin/redirects/suggest?path=${encodeURIComponent(entry.path)}`,
      );
      const json = (await res.json()) as { data: RedirectSuggestion[] };
      setSuggestions(json.data ?? []);
      if (!toPath && json.data?.[0]?.target) setToPath(json.data[0].target);
    } finally {
      setRefreshing(false);
    }
  }

  const contentTypeLabel = (ct: RedirectSuggestion["contentType"]) =>
    ct === "study" ? "Study" : ct === "blog" ? "Blog" : "Condition";

  return (
    <>
      <div className="space-y-4">
        {/* Ranked candidates */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <Label className="text-sm">Suggested Targets</Label>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-7 text-xs"
              onClick={refreshSuggestions}
              disabled={refreshing}
            >
              {refreshing ? (
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
              ) : (
                <Wand2 className="h-3 w-3 mr-1" />
              )}
              Refresh
            </Button>
          </div>
          {suggestions.length === 0 ? (
            <div className="text-xs text-muted-foreground border rounded-md p-3 bg-muted/30">
              No confident match found. Enter a target manually below, or click Refresh to try again.
            </div>
          ) : (
            <div className="space-y-1 max-h-[260px] overflow-y-auto">
              {suggestions.map((s, i) => {
                const selected = toPath === s.target;
                return (
                  <button
                    type="button"
                    key={s.target}
                    onClick={() => setToPath(s.target)}
                    className={`w-full text-left border rounded-md p-2 transition-colors ${
                      selected
                        ? "border-primary bg-primary/5"
                        : "border-border hover:bg-muted/50"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <ConfidenceBadge score={s.score} />
                      <Badge variant="outline" className="text-[10px] h-5 px-1.5">
                        {contentTypeLabel(s.contentType)}
                      </Badge>
                      {i === 0 && (
                        <Badge variant="default" className="text-[10px] h-5 px-1.5">Top pick</Badge>
                      )}
                      <span className="ml-auto font-mono text-xs truncate text-muted-foreground" title={s.target}>
                        {s.target}
                      </span>
                    </div>
                    {s.title && (
                      <p className="text-xs mt-1 line-clamp-1" title={s.title}>
                        {s.title}
                      </p>
                    )}
                    {s.reasons.length > 0 && (
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {s.reasons.join(" · ")}
                      </p>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Manual override / final target */}
        <div>
          <Label htmlFor="resolveToPath" className="text-sm">Redirect To</Label>
          <Input
            id="resolveToPath"
            placeholder="/correct-page"
            value={toPath}
            onChange={(e) => setToPath(e.target.value)}
            className="font-mono text-sm"
          />
          <p className="text-[11px] text-muted-foreground mt-1">
            Click a suggestion above to fill this, or type a custom path.
          </p>
        </div>

        <div>
          <Label htmlFor="resolveStatusCode">Status Code</Label>
          <Select value={String(statusCode)} onValueChange={(v) => setStatusCode(Number(v))}>
            <SelectTrigger id="resolveStatusCode">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="301">301 (Permanent — preferred for SEO)</SelectItem>
              <SelectItem value="302">302 (Temporary)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          onClick={() => onSubmit(toPath, statusCode)}
          disabled={!toPath || isPending}
        >
          {isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
          Create Redirect
        </Button>
      </DialogFooter>
    </>
  );
}
