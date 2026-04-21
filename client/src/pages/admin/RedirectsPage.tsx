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
import {
  Plus,
  Pencil,
  Trash2,
  Loader2,
  ArrowRight,
  AlertTriangle,
  Wand2,
  ExternalLink,
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

interface NotFoundEntry {
  id: number;
  path: string;
  referrer: string | null;
  hitCount: number;
  firstSeenAt: string;
  lastSeenAt: string;
  resolved: boolean;
  suggestedTarget: string | null;
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

  // ── Queries ───────────────────────────────────────────────

  const {
    data: redirectsData,
    isLoading: redirectsLoading,
  } = useQuery<{ data: Redirect[] }>({
    queryKey: ["/api/admin/redirects"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/redirects");
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
      const res = await apiRequest("POST", "/api/admin/redirects/404s/backfill", { limit: 100 });
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/redirects/404s"] });
      toast({ title: "Backfill complete", description: `Processed ${data.processed}, suggested ${data.suggested}` });
    },
    onError: (error: unknown) => {
      toast({ title: "Backfill failed", description: errMessage(error), variant: "destructive" });
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
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-muted-foreground">
              {totalRedirects} redirect{totalRedirects !== 1 ? "s" : ""} configured
            </p>
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
              <p>No redirects configured yet.</p>
              <p className="text-sm mt-1">Create one to start redirecting old URLs.</p>
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
                  {redirectsList.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-mono text-sm truncate max-w-[250px]" title={r.fromPath}>
                        {r.fromPath}
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
                  ))}
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
                    <TableRow key={entry.id}>
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
                      <TableCell className="font-mono text-sm truncate max-w-[250px]" title={entry.suggestedTarget || ""}>
                        {entry.suggestedTarget ? (
                          <span className="text-green-600">{entry.suggestedTarget}</span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
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
  const [toPath, setToPath] = useState(entry.suggestedTarget || "");
  const [statusCode, setStatusCode] = useState(301);

  return (
    <>
      <div className="space-y-4">
        <div>
          <Label htmlFor="resolveToPath">Redirect To</Label>
          <Input
            id="resolveToPath"
            placeholder="/correct-page"
            value={toPath}
            onChange={(e) => setToPath(e.target.value)}
          />
          {entry.suggestedTarget && toPath === entry.suggestedTarget && (
            <p className="text-xs text-green-600 mt-1">Using auto-suggested target</p>
          )}
        </div>
        <div>
          <Label htmlFor="resolveStatusCode">Status Code</Label>
          <Select value={String(statusCode)} onValueChange={(v) => setStatusCode(Number(v))}>
            <SelectTrigger id="resolveStatusCode">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="301">301 (Permanent)</SelectItem>
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
