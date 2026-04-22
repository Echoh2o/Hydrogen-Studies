import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { formatAuthors } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import AdminLayout from "@/components/admin/AdminLayout";
import {
  Plus,
  Search,
  Edit3,
  BookOpen,
  FileText,
  Database,
  BarChart3,
  AlertCircle,
  Clock,
  Target,
  TrendingUp,
  ArrowRight,
} from "lucide-react";

interface Study {
  id: number;
  title: string;
  authors: string;
  isPublished: boolean;
  publishDate?: string;
}

interface BlogArticle {
  id: number;
  title: string;
  articleType?: string;
  readingLevel?: string;
  isPublished: boolean;
  createdAt: string;
}

interface DashboardStats {
  totalBlogs: number;
  publishedBlogs: number;
  draftBlogs: number;
  totalStudies: number;
}

interface PipelineStatus {
  queue: {
    pending: number;
    processing: number;
    awaitingApproval: number;
    completed: number;
    rejected: number;
    failed: number;
  };
  citations: number;
  publishedDigests: number;
  lastDiscoveryRun: {
    id: number;
    status: string;
    createdAt: string;
    newCount: number;
    queuedCount: number;
  } | null;
}

function relativeTime(iso: string | null | undefined): string {
  if (!iso) return "never";
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000) return "just now";
  const min = Math.floor(ms / 60_000);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const d = Math.floor(hr / 24);
  return `${d}d ago`;
}

const AdminDashboard: React.FC = () => {
  const { data: dashboardStats } = useQuery<DashboardStats>({
    queryKey: ["/api/admin/dashboard-stats"],
    staleTime: 30_000,
  });

  const { data: pipeline } = useQuery<PipelineStatus>({
    queryKey: ["/api/pipeline/status"],
    staleTime: 15_000,
    refetchInterval: 30_000,
  });

  const { data: studies = [] } = useQuery<Study[]>({
    queryKey: ["/api/studies"],
    staleTime: 60_000,
    select: (response: any) => {
      const data = Array.isArray(response)
        ? response
        : response?.data || response?.studies || [];
      return Array.isArray(data) ? data.slice(0, 5) : [];
    },
  });

  const { data: blogs = [] } = useQuery<BlogArticle[]>({
    queryKey: ["/api/blogs"],
    staleTime: 60_000,
    select: (response: any) => {
      const data = Array.isArray(response) ? response : response?.data || [];
      return Array.isArray(data) ? data.slice(0, 5) : [];
    },
  });

  const totalStudies = dashboardStats?.totalStudies ?? 0;
  const totalBlogs = dashboardStats?.totalBlogs ?? 0;
  const draftBlogs = dashboardStats?.draftBlogs ?? 0;
  const awaitingApproval = pipeline?.queue.awaitingApproval ?? 0;
  const failedInPipeline = pipeline?.queue.failed ?? 0;
  const pendingInPipeline =
    (pipeline?.queue.pending ?? 0) + (pipeline?.queue.processing ?? 0);

  const attentionItems = [
    {
      count: awaitingApproval,
      label: "studies awaiting approval",
      href: "/admin/pipeline",
      tone: "warning" as const,
    },
    {
      count: failedInPipeline,
      label: "pipeline items failed",
      href: "/admin/pipeline",
      tone: "danger" as const,
    },
    {
      count: draftBlogs,
      label: "blog drafts",
      href: "/admin/blogs",
      tone: "info" as const,
    },
  ].filter((item) => item.count > 0);

  return (
    <AdminLayout title="Admin Dashboard">
      <div className="space-y-6">
        {/* Stat tiles */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatTile
            label="Studies"
            value={totalStudies}
            hint={`${pendingInPipeline} queued for processing`}
            icon={<Database className="h-4 w-4 text-muted-foreground" />}
          />
          <StatTile
            label="Blog articles"
            value={totalBlogs}
            hint={`${draftBlogs} drafts`}
            icon={<FileText className="h-4 w-4 text-muted-foreground" />}
          />
          <StatTile
            label="Citations mapped"
            value={pipeline?.citations ?? 0}
            hint={`${pipeline?.publishedDigests ?? 0} digests published`}
            icon={<BarChart3 className="h-4 w-4 text-muted-foreground" />}
          />
          <StatTile
            label="Last discovery"
            value={pipeline?.lastDiscoveryRun?.newCount ?? 0}
            hint={`${relativeTime(pipeline?.lastDiscoveryRun?.createdAt)} — ${pipeline?.lastDiscoveryRun?.queuedCount ?? 0} queued`}
            icon={<TrendingUp className="h-4 w-4 text-muted-foreground" />}
          />
        </div>

        {/* Needs attention */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5" />
              Needs attention
            </CardTitle>
            <CardDescription>
              Items the automation surfaced that a human should look at.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {attentionItems.length === 0 ? (
              <div className="text-sm text-muted-foreground py-3">
                Nothing pending — automation is caught up.
              </div>
            ) : (
              <ul className="divide-y">
                {attentionItems.map((item) => (
                  <li key={item.label}>
                    <Link
                      href={item.href}
                      className="flex items-center justify-between py-3 hover:bg-accent/50 -mx-2 px-2 rounded"
                    >
                      <div className="flex items-center gap-3">
                        <AttentionBadge tone={item.tone} count={item.count} />
                        <span className="text-sm">{item.label}</span>
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Pipeline activity (replaces hardcoded automation status) */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Pipeline activity
            </CardTitle>
            <CardDescription>
              Background automation runs on a schedule. See{" "}
              <Link href="/admin/pipeline" className="underline">
                Pipeline Monitor
              </Link>{" "}
              for full history.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-center">
              <PipelineCell
                label="Pending"
                value={pipeline?.queue.pending ?? 0}
              />
              <PipelineCell
                label="Processing"
                value={pipeline?.queue.processing ?? 0}
              />
              <PipelineCell
                label="Awaiting approval"
                value={pipeline?.queue.awaitingApproval ?? 0}
                tone={awaitingApproval > 0 ? "warning" : undefined}
              />
              <PipelineCell
                label="Completed"
                value={pipeline?.queue.completed ?? 0}
              />
              <PipelineCell
                label="Failed"
                value={pipeline?.queue.failed ?? 0}
                tone={failedInPipeline > 0 ? "danger" : undefined}
              />
            </div>
          </CardContent>
        </Card>

        {/* Recent content */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <RecentList
            title="Recent studies"
            icon={<BookOpen className="h-5 w-5" />}
            emptyLabel="No studies yet"
            items={studies.map((study) => ({
              id: study.id,
              primary: study.title,
              secondary: formatAuthors(study.authors),
              published: study.isPublished,
              editHref: `/admin/studies/edit/${study.id}`,
            }))}
          />
          <RecentList
            title="Recent blog posts"
            icon={<FileText className="h-5 w-5" />}
            emptyLabel="No blog posts yet"
            items={blogs.map((blog) => ({
              id: blog.id,
              primary: blog.title,
              secondary: `${blog.articleType || "article"} • ${blog.readingLevel || "general"}`,
              published: blog.isPublished,
              editHref: `/admin/blogs/edit/${blog.id}`,
            }))}
          />
        </div>

        {/* Quick actions */}
        <Card>
          <CardHeader>
            <CardTitle>Quick actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <QuickAction
                href="/admin/studies/add"
                icon={<Plus className="h-5 w-5" />}
                label="New study"
                primary
              />
              <QuickAction
                href="/admin/blogs/add"
                icon={<Plus className="h-5 w-5" />}
                label="New blog post"
                primary
              />
              <QuickAction
                href="/admin/research-import"
                icon={<Search className="h-5 w-5" />}
                label="Import studies"
              />
              <QuickAction
                href="/admin/seo-strategy"
                icon={<Target className="h-5 w-5" />}
                label="SEO strategy"
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
};

function StatTile({
  label,
  value,
  hint,
  icon,
}: {
  label: string;
  value: number;
  hint?: string;
  icon: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{label}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value.toLocaleString()}</div>
        {hint && (
          <p className="text-xs text-muted-foreground mt-1">{hint}</p>
        )}
      </CardContent>
    </Card>
  );
}

function AttentionBadge({
  tone,
  count,
}: {
  tone: "warning" | "danger" | "info";
  count: number;
}) {
  const styles =
    tone === "danger"
      ? "bg-destructive/10 text-destructive"
      : tone === "warning"
        ? "bg-amber-100 text-amber-800"
        : "bg-primary/10 text-primary";
  return (
    <span
      className={`inline-flex items-center justify-center min-w-[2rem] h-7 px-2 rounded text-sm font-semibold ${styles}`}
    >
      {count}
    </span>
  );
}

function PipelineCell({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "warning" | "danger";
}) {
  const bg =
    tone === "danger"
      ? "bg-destructive/10"
      : tone === "warning"
        ? "bg-amber-50"
        : "bg-muted/50";
  return (
    <div className={`p-3 rounded-lg ${bg}`}>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs text-muted-foreground mt-1">{label}</div>
    </div>
  );
}

function RecentList({
  title,
  icon,
  emptyLabel,
  items,
}: {
  title: string;
  icon: React.ReactNode;
  emptyLabel: string;
  items: Array<{
    id: number;
    primary: string;
    secondary: string;
    published: boolean;
    editHref: string;
  }>;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {icon}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <div className="text-sm text-muted-foreground py-3">{emptyLabel}</div>
        ) : (
          <div className="space-y-2">
            {items.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between gap-3 p-3 bg-muted/40 rounded"
              >
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate">
                    {item.primary}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {item.secondary}
                  </div>
                </div>
                <Badge variant={item.published ? "default" : "secondary"}>
                  {item.published ? "Published" : "Draft"}
                </Badge>
                <Button variant="ghost" size="sm" asChild>
                  <Link href={item.editHref}>
                    <Edit3 className="h-4 w-4" />
                  </Link>
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function QuickAction({
  href,
  icon,
  label,
  primary,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  primary?: boolean;
}) {
  return (
    <Button
      asChild
      variant={primary ? "default" : "outline"}
      className="h-20 flex-col gap-2"
    >
      <Link href={href}>
        {icon}
        <span className="text-sm">{label}</span>
      </Link>
    </Button>
  );
}

export default AdminDashboard;
