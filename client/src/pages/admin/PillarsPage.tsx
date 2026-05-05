/**
 * Admin Pillars dashboard.
 *
 * Top-level view of every blog promoted to a pillar, with cluster
 * counts (total / published / draft / scheduled) and quick links into
 * the per-pillar editor. The promote/demote actions live on the blog
 * list and edit pages — this page is read-only by design, focused on
 * answering "are my anchor pages working?"
 *
 * Phase D cross-wires (GSC impressions, GA4 engagement per pillar)
 * are deliberately deferred — they belong to Option 2 and will land
 * once the Phase A.5 observation period tells us which signals matter.
 */

import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Anchor, ExternalLink, Pencil, FileText } from "lucide-react";

interface PillarRow {
  id: number;
  title: string;
  slug: string;
  isPublished: boolean;
  publishedAt: string | null;
  promotedToPillarAt: string | null;
  viewCount: number | null;
  totalClusters: number;
  publishedClusters: number;
  draftClusters: number;
  scheduledClusters: number;
  lastClusterPublishedAt: string | null;
  // 30-day metrics — 0 when no GSC/GA4 data; null gscAvgPosition when
  // the page hasn't accumulated rank data yet.
  gscClicks30d: number;
  gscImpressions30d: number;
  gscAvgPosition: number | null;
  ga4Sessions30d: number;
  ga4EngagedSessions30d: number;
  // Engagement: rate is the session-weighted ratio (0–1); avg time is in
  // seconds. Both null when GA4 has no data for the URL.
  ga4EngagementRate: number | null;
  ga4AvgEngagementTime: number | null;
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatRelative(iso: string | null): string {
  if (!iso) return "never";
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 86_400_000) return `${Math.round(ms / 3_600_000)}h ago`;
  const days = Math.floor(ms / 86_400_000);
  if (days < 30) return `${days}d ago`;
  return formatDate(iso);
}

export default function PillarsPage() {
  const { data, isLoading, error } = useQuery<{ data: PillarRow[] }>({
    queryKey: ["/api/blogs/pillars"],
    queryFn: async () => {
      const res = await fetch("/api/blogs/pillars");
      if (!res.ok) throw new Error("Failed to load pillars");
      return res.json();
    },
  });

  const pillars = data?.data ?? [];
  const totals = pillars.reduce(
    (acc, p) => {
      acc.clusters += p.totalClusters;
      acc.published += p.publishedClusters;
      acc.draft += p.draftClusters;
      acc.scheduled += p.scheduledClusters;
      return acc;
    },
    { clusters: 0, published: 0, draft: 0, scheduled: 0 },
  );

  return (
    <AdminLayout
      title="Pillars"
      description="Anchor pages and the cluster posts supporting them. Promote or demote from the blog list or editor."
    >
      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {isLoading ? (
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
                <p className="text-sm text-muted-foreground">Pillars</p>
                <p className="text-2xl font-bold">{pillars.length}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-sm text-muted-foreground">Cluster posts</p>
                <p className="text-2xl font-bold">{totals.clusters.toLocaleString()}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-sm text-muted-foreground">Published</p>
                <p className="text-2xl font-bold text-green-600">{totals.published.toLocaleString()}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-sm text-muted-foreground">Draft / Scheduled</p>
                <p className="text-2xl font-bold text-amber-600">
                  {(totals.draft + totals.scheduled).toLocaleString()}
                </p>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Pillar table */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      ) : error ? (
        <div className="text-center py-12 text-destructive">
          Failed to load pillars. Try refreshing the page.
        </div>
      ) : pillars.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Anchor className="h-10 w-10 mx-auto mb-3 opacity-50" />
          <p className="font-medium">No pillars yet.</p>
          <p className="text-sm mt-2 max-w-md mx-auto">
            Promote a blog to a pillar from the blog list (
            <code className="font-mono text-xs">⋯</code> menu → "Promote to Pillar"
            ). The system will auto-generate cluster post drafts for related studies.
          </p>
          <Button variant="outline" className="mt-4" asChild>
            <Link href="/admin/blogs">
              <FileText className="h-4 w-4 mr-1" />
              Browse blogs
            </Link>
          </Button>
        </div>
      ) : (
        <div className="border rounded-md">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[280px]">Pillar</TableHead>
                <TableHead className="w-[110px]">Status</TableHead>
                <TableHead className="w-[120px]">Promoted</TableHead>
                <TableHead className="w-[80px] text-right">Total</TableHead>
                <TableHead className="w-[80px] text-right">Pub'd</TableHead>
                <TableHead className="w-[80px] text-right">Draft</TableHead>
                <TableHead className="w-[80px] text-right">Sched.</TableHead>
                <TableHead className="w-[120px]">Last cluster</TableHead>
                <TableHead className="w-[100px] text-right" title="Search Console clicks (last 30 days)">GSC 30d</TableHead>
                <TableHead className="w-[100px] text-right" title="GA4 sessions (last 30 days)">GA4 30d</TableHead>
                <TableHead className="w-[100px] text-right" title="Engagement rate × avg time on page (last 30 days)">Engagement</TableHead>
                <TableHead className="w-[110px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pillars.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>
                    <div className="flex flex-col gap-0.5">
                      <span className="font-medium truncate max-w-[280px]" title={p.title}>
                        {p.title}
                      </span>
                      <span className="font-mono text-xs text-muted-foreground truncate max-w-[280px]">
                        /blog/{p.slug}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {p.isPublished ? (
                      <Badge variant="default" className="bg-green-600 hover:bg-green-700">Live</Badge>
                    ) : (
                      <Badge variant="secondary">Draft</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDate(p.promotedToPillarAt)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums font-medium">
                    {p.totalClusters}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-green-600">
                    {p.publishedClusters}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {p.draftClusters}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-amber-600">
                    {p.scheduledClusters}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatRelative(p.lastClusterPublishedAt)}
                  </TableCell>
                  <TableCell
                    className="text-right text-xs"
                    title={`${p.gscImpressions30d.toLocaleString()} impressions${
                      p.gscAvgPosition != null ? ` · avg position ${p.gscAvgPosition.toFixed(1)}` : ""
                    }`}
                  >
                    {p.gscClicks30d > 0 ? (
                      <span className="font-medium tabular-nums text-emerald-700">
                        {p.gscClicks30d.toLocaleString()} clicks
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell
                    className="text-right text-xs"
                    title={`${p.ga4EngagedSessions30d.toLocaleString()} engaged sessions`}
                  >
                    {p.ga4Sessions30d > 0 ? (
                      <span className="font-medium tabular-nums text-blue-700">
                        {p.ga4Sessions30d.toLocaleString()}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell
                    className="text-right text-xs"
                    title={
                      p.ga4AvgEngagementTime != null
                        ? `${Math.round(p.ga4AvgEngagementTime)}s avg time on page`
                        : "no GA4 engagement data yet"
                    }
                  >
                    {p.ga4EngagementRate != null ? (
                      <span
                        className={`font-medium tabular-nums ${
                          p.ga4EngagementRate >= 0.6
                            ? "text-emerald-700"
                            : p.ga4EngagementRate >= 0.4
                            ? "text-blue-700"
                            : "text-amber-700"
                        }`}
                      >
                        {(p.ga4EngagementRate * 100).toFixed(0)}%
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button size="icon" variant="ghost" className="h-7 w-7" asChild>
                        <Link href={`/admin/blogs/${p.id}/edit`} title="Edit pillar">
                          <Pencil className="h-3.5 w-3.5" />
                        </Link>
                      </Button>
                      {p.isPublished && (
                        <Button size="icon" variant="ghost" className="h-7 w-7" asChild>
                          <a
                            href={`/blog/${p.slug}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="View live page"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </AdminLayout>
  );
}
