/**
 * Admin Shopify Sync page.
 *
 * Definitive view of "is Shopify customer sync working?" — config
 * state, total accounts created, recent activity, and a one-click
 * backfill trigger so the admin doesn't have to SSH or curl.
 *
 * Auto-refreshes every 10s while a backfill is running so the count
 * climbs visibly. Drops to 30s otherwise.
 */

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { errMessage } from "@/lib/utils";
import {
  CheckCircle2,
  XCircle,
  RefreshCw,
  Download,
  Users,
  ShoppingBag,
  Loader2,
  AlertTriangle,
} from "lucide-react";

interface SyncStatus {
  apiConfigured: boolean;
  webhookSecretConfigured: boolean;
  totalCustomerAccounts: number;
  mostRecent: Array<{
    id: string;
    email: string;
    username: string;
    createdAt: string;
  }>;
}

function formatRelative(iso: string | null | undefined): string {
  if (!iso) return "never";
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000) return "just now";
  if (ms < 3_600_000) return `${Math.round(ms / 60_000)}m ago`;
  if (ms < 86_400_000) return `${Math.round(ms / 3_600_000)}h ago`;
  const days = Math.floor(ms / 86_400_000);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

export default function ShopifySyncPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  // While a backfill is in-flight on the server, poll faster so the
  // admin sees the customer count climb in near-real-time.
  const [activelyBackfilling, setActivelyBackfilling] = useState(false);
  const [backfillSince, setBackfillSince] = useState<string>("");
  const [backfillMax, setBackfillMax] = useState<string>("");

  const { data: status, isLoading } = useQuery<SyncStatus>({
    queryKey: ["/api/webhooks/shopify/sync-status"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/webhooks/shopify/sync-status");
      return res.json();
    },
    refetchInterval: activelyBackfilling ? 10_000 : 30_000,
  });

  const backfillMutation = useMutation({
    mutationFn: async () => {
      const body: Record<string, any> = {};
      if (backfillSince.trim()) body.since = new Date(backfillSince).toISOString();
      if (backfillMax.trim()) {
        const n = parseInt(backfillMax, 10);
        if (!isNaN(n) && n > 0) body.max = n;
      }
      const res = await apiRequest("POST", "/api/webhooks/shopify/backfill", body);
      return res.json();
    },
    onSuccess: (data: any) => {
      toast({
        title: "Backfill started",
        description:
          data?.message ??
          "Customer count below will climb as Shopify pagination is walked. Refreshes every 10s.",
      });
      setActivelyBackfilling(true);
      // Invalidate immediately so the count starts updating; the
      // refetchInterval keeps it polling.
      queryClient.invalidateQueries({ queryKey: ["/api/webhooks/shopify/sync-status"] });
      // Stop the fast poll after 10 minutes — at 2 req/sec Shopify can
      // process ~7,200 customers in that window which covers nearly any
      // realistic store size.
      setTimeout(() => setActivelyBackfilling(false), 10 * 60_000);
    },
    onError: (error: unknown) => {
      toast({
        title: "Backfill failed to start",
        description: errMessage(error),
        variant: "destructive",
      });
    },
  });

  const apiOk = !!status?.apiConfigured;
  const webhookOk = !!status?.webhookSecretConfigured;
  const allHealthy = apiOk && webhookOk;

  return (
    <AdminLayout
      title="Shopify Sync"
      description="Customer-account sync between echowater.com and hydrogenstudies.com"
    >
      <div className="space-y-6">
        {/* Configuration health */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShoppingBag className="h-5 w-5" />
              Configuration
            </CardTitle>
            <CardDescription>
              Required env vars + webhook secret. Both must be green for the sync to function.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-5 w-64" />
                <Skeleton className="h-5 w-64" />
              </div>
            ) : (
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  {apiOk ? (
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-600" />
                  )}
                  <span className="font-medium">Admin API access</span>
                  <span className="text-muted-foreground text-xs">
                    {apiOk ? "SHOPIFY_ACCESS_TOKEN + SHOPIFY_STORE_URL set" : "missing env vars"}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {webhookOk ? (
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-600" />
                  )}
                  <span className="font-medium">Webhook signing secret</span>
                  <span className="text-muted-foreground text-xs">
                    {webhookOk ? "SHOPIFY_WEBHOOK_SECRET set" : "missing — Shopify will be rejected with 401"}
                  </span>
                </div>
                {!allHealthy && (
                  <div className="mt-3 rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                      <div>
                        Sync won't work until the missing env var(s) above are set in Railway.
                        After setting, redeploy and refresh this page.
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Customer accounts created */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Customer accounts
            </CardTitle>
            <CardDescription>
              hydrogenstudies.com accounts with role = "customer" (created via Shopify webhook,
              backfill, or reconciliation cron).
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-12 w-32" />
            ) : (
              <div className="flex items-baseline gap-3">
                <span className="text-4xl font-bold tabular-nums">
                  {status?.totalCustomerAccounts.toLocaleString()}
                </span>
                <span className="text-sm text-muted-foreground">total accounts</span>
                {activelyBackfilling && (
                  <Badge variant="outline" className="border-blue-400 text-blue-700">
                    <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                    Backfill running…
                  </Badge>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Backfill control */}
        <Card>
          <CardHeader>
            <CardTitle>Historical backfill</CardTitle>
            <CardDescription>
              Pull existing Shopify customers and create matching accounts. Idempotent — existing
              emails are skipped. Safe to re-run.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="backfill-since" className="text-xs text-muted-foreground">
                  Updated since (optional)
                </Label>
                <Input
                  id="backfill-since"
                  type="date"
                  value={backfillSince}
                  onChange={(e) => setBackfillSince(e.target.value)}
                  className="h-9"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="backfill-max" className="text-xs text-muted-foreground">
                  Max customers (optional, dry-run cap)
                </Label>
                <Input
                  id="backfill-max"
                  type="number"
                  placeholder="e.g. 10 for a smoke test"
                  value={backfillMax}
                  onChange={(e) => setBackfillMax(e.target.value)}
                  className="h-9"
                />
              </div>
            </div>
            <div className="flex items-center gap-3 pt-1">
              <Button
                onClick={() => backfillMutation.mutate()}
                disabled={!apiOk || backfillMutation.isPending}
              >
                {backfillMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    Starting…
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4 mr-1" />
                    Run backfill
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/webhooks/shopify/sync-status"] })}
              >
                <RefreshCw className="h-4 w-4 mr-1" />
                Refresh status
              </Button>
              <p className="text-xs text-muted-foreground">
                Runs in the background — server returns 202 immediately.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Recent customers — proof the sync is actually creating accounts */}
        <Card>
          <CardHeader>
            <CardTitle>Most recent customer accounts</CardTitle>
            <CardDescription>
              Last 10 accounts created with role = "customer". A long tail here means the sync is
              working; a stale top entry means nothing has happened recently.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : (status?.mostRecent ?? []).length === 0 ? (
              <div className="text-center py-8 text-sm text-muted-foreground">
                No customer accounts yet. Run the backfill above to import existing Shopify
                customers, or wait for new signups to come in via webhook.
              </div>
            ) : (
              <div className="border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Email</TableHead>
                      <TableHead>Username</TableHead>
                      <TableHead className="w-[140px]">Created</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(status?.mostRecent ?? []).map((c) => (
                      <TableRow key={c.id}>
                        <TableCell className="font-mono text-xs">{c.email}</TableCell>
                        <TableCell className="text-sm">{c.username}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatRelative(c.createdAt)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
