import { useState } from "react";
import { Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import AdminLayout from "@/components/admin/AdminLayout";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Eye,
  Edit,
  Trash2,
  Plus,
  Search,
  Calendar,
  User,
  BookOpen,
  Filter,
  MoreHorizontal,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  AlertTriangle,
  Loader2,
  ArrowUpDown,
  Eye as EyeIcon,
  Archive,
  ArchiveRestore,
  Clock,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface BlogArticle {
  id: number;
  title: string;
  slug: string;
  summary: string;
  content: string;
  articleType: string;
  readingLevel: string;
  studyId: number;
  studyTitle?: string;
  isPublished: boolean;
  publishedAt: string | null;
  scheduledFor: string | null;
  isArchived: boolean;
  viewCount: number | null;
  createdAt: string;
  updatedAt: string;
}

interface StatusCounts {
  drafts: number;
  scheduled: number;
  published: number;
  archived: number;
}

type StatusFilter = "all" | "draft" | "scheduled" | "published" | "archived";
type SortField = "createdAt" | "publishedAt" | "viewCount" | "title" | "articleType";

export default function BlogListPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [filterStatus, setFilterStatus] = useState<StatusFilter>("all");
  const [sortField, setSortField] = useState<SortField>("createdAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  // Bulk-select state
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Build query parameters for pagination and filtering
  const queryParams = new URLSearchParams();
  queryParams.set("page", currentPage.toString());
  queryParams.set("limit", pageSize.toString());
  queryParams.set("sort", sortField);
  queryParams.set("order", sortOrder);

  if (searchTerm) queryParams.set("search", searchTerm);
  if (filterType !== "all") queryParams.set("filterType", filterType);
  if (filterStatus !== "all") queryParams.set("filterStatus", filterStatus);

  // Fetch blogs with pagination
  const { data, isLoading, error } = useQuery<any>({
    queryKey: [
      "/api/blogs",
      currentPage,
      pageSize,
      searchTerm,
      filterType,
      filterStatus,
      sortField,
      sortOrder,
    ],
    queryFn: async () => {
      const response = await fetch(`/api/blogs?${queryParams.toString()}`);
      if (!response.ok) throw new Error("Failed to fetch blogs");
      return response.json();
    },
  });

  // Status counts for tab badges
  const { data: statusCounts } = useQuery<StatusCounts>({
    queryKey: ["/api/blogs/status-counts"],
    queryFn: async () => {
      const res = await fetch("/api/blogs/status-counts");
      if (!res.ok) throw new Error("Failed to fetch status counts");
      return res.json();
    },
  });

  // Extract paginated data
  const blogs = data?.data || [];
  const totalBlogs = data?.total || 0;
  const totalPages = data?.totalPages || 1;

  // Delete blog mutation
  const deleteBlogMutation = useMutation({
    mutationFn: async (blogId: number) => {
      const res = await fetch(`/api/blogs/${blogId}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || `Delete failed (${res.status})`);
      }
      return res.json().catch(() => ({}));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/blogs"] });
      toast({
        title: "Success",
        description: "Blog post deleted successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete blog post",
        variant: "destructive",
      });
    },
  });

  // Toggle publish status mutation — uses the focused PATCH /:id/status
  // endpoint (was using full PUT /:id which fails on partial body).
  const togglePublishMutation = useMutation({
    mutationFn: async ({
      blogId,
      isPublished,
    }: {
      blogId: number;
      isPublished: boolean;
    }) => {
      const res = await fetch(`/api/blogs/${blogId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPublished }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || body.message || `Update failed (${res.status})`);
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/blogs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/blogs/status-counts"] });
      toast({
        title: "Success",
        description: "Blog post status updated",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update blog post status",
        variant: "destructive",
      });
    },
  });

  // Bulk-update mutation — handles publish/unpublish/archive/unarchive/delete/schedule
  type BulkAction =
    | "publish"
    | "unpublish"
    | "archive"
    | "unarchive"
    | "delete"
    | "schedule";
  const bulkUpdateMutation = useMutation({
    mutationFn: async ({
      ids,
      action,
      scheduledFor,
    }: {
      ids: number[];
      action: BulkAction;
      scheduledFor?: string;
    }) => {
      const res = await fetch("/api/blogs/bulk-update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids, action, scheduledFor }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Bulk update failed (${res.status})`);
      }
      return res.json() as Promise<{ affected: number }>;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/blogs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/blogs/status-counts"] });
      setSelectedIds(new Set());
      toast({
        title: "Bulk update complete",
        description: `${data.affected} blog${data.affected === 1 ? "" : "s"} updated`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Bulk update failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Handle search input change
  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
    setCurrentPage(1); // Reset to first page on new search
  };

  // Handle filter changes
  const handleFilterTypeChange = (value: string) => {
    setFilterType(value);
    setCurrentPage(1); // Reset to first page on filter change
  };

  // (filterStatus changes happen inline via the tab buttons; no longer
  // need a dedicated handler.)

  // Pagination handlers
  const goToFirstPage = () => setCurrentPage(1);
  const goToLastPage = () => setCurrentPage(totalPages);
  const goToPreviousPage = () => setCurrentPage(Math.max(1, currentPage - 1));
  const goToNextPage = () =>
    setCurrentPage(Math.min(totalPages, currentPage + 1));

  const handlePageSizeChange = (newSize: string) => {
    setPageSize(parseInt(newSize));
    setCurrentPage(1); // Reset to first page on page size change
  };

  // Generate page numbers for pagination
  const getPageNumbers = () => {
    const pages = [];
    const maxVisiblePages = 5;

    if (totalPages <= maxVisiblePages) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      if (currentPage <= 3) {
        for (let i = 1; i <= 4; i++) pages.push(i);
        pages.push(-1); // Ellipsis
        pages.push(totalPages);
      } else if (currentPage >= totalPages - 2) {
        pages.push(1);
        pages.push(-1); // Ellipsis
        for (let i = totalPages - 3; i <= totalPages; i++) pages.push(i);
      } else {
        pages.push(1);
        pages.push(-1); // Ellipsis
        for (let i = currentPage - 1; i <= currentPage + 1; i++) pages.push(i);
        pages.push(-1); // Ellipsis
        pages.push(totalPages);
      }
    }

    return pages;
  };

  const handleDeleteBlog = (blogId: number) => {
    deleteBlogMutation.mutate(blogId);
  };

  const handleTogglePublish = (blogId: number, currentStatus: boolean) => {
    togglePublishMutation.mutate({ blogId, isPublished: !currentStatus });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  if (isLoading && !data) {
    return (
      <AdminLayout title="Blog Posts">
        <div className="flex items-center justify-center h-64 gap-2 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>Loading blog posts…</span>
        </div>
      </AdminLayout>
    );
  }

  if (error) {
    return (
      <AdminLayout title="Blog Posts">
        <div className="text-center py-8">
          <p className="text-destructive">Error loading blogs: {error.message}</p>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Blog Posts">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              Blog Posts
            </h1>
            <p className="text-muted-foreground">
              Manage your blog posts and generated content
            </p>
          </div>
          <div className="flex gap-2">
            <Link href="/admin/blogs/add">
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                New Post
              </Button>
            </Link>
            <Link href="/admin/blogs/generate">
              <Button variant="secondary">
                <BookOpen className="mr-2 h-4 w-4" />
                Generate Post
              </Button>
            </Link>
            <Link href="/admin/blog-categories">
              <Button variant="outline">Categories</Button>
            </Link>
          </div>
        </div>

        {/* Status tabs — Drafts / Scheduled / Published / Archived / All
            with live counts. Replaces the old All/Published/Draft Select. */}
        <div className="flex items-center gap-1 border-b">
          {(
            [
              { key: "draft", label: "Drafts", count: statusCounts?.drafts },
              { key: "scheduled", label: "Scheduled", count: statusCounts?.scheduled },
              { key: "published", label: "Published", count: statusCounts?.published },
              { key: "archived", label: "Archived", count: statusCounts?.archived },
              { key: "all", label: "All" },
            ] as Array<{ key: StatusFilter; label: string; count?: number }>
          ).map((tab) => (
            <button
              key={tab.key}
              onClick={() => {
                setFilterStatus(tab.key);
                setCurrentPage(1);
                setSelectedIds(new Set());
              }}
              className={cn(
                "flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors",
                filterStatus === tab.key
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {tab.label}
              {typeof tab.count === "number" && (
                <Badge variant="secondary" className="text-[10px]">
                  {tab.count}
                </Badge>
              )}
            </button>
          ))}
        </div>

        {/* Search + secondary filters + sort */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          <div className="relative md:col-span-5">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search blogs by title or summary..."
              value={searchTerm}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={filterType} onValueChange={handleFilterTypeChange}>
            <SelectTrigger className="md:col-span-3">
              <SelectValue placeholder="All Types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="science_explainer">Science Explainer</SelectItem>
              <SelectItem value="practical_guide">Practical Guide</SelectItem>
              <SelectItem value="faq">FAQ</SelectItem>
              <SelectItem value="condition_deep_dive">Condition Deep Dive</SelectItem>
              <SelectItem value="protocol_guide">Protocol Guide</SelectItem>
              <SelectItem value="myth_buster">Myth Buster</SelectItem>
              <SelectItem value="listicle">Listicle</SelectItem>
              <SelectItem value="news_post">Research News</SelectItem>
              <SelectItem value="manual">Manual</SelectItem>
              <SelectItem value="generated">Legacy: Generated</SelectItem>
              <SelectItem value="ai-assisted">Legacy: AI-Assisted</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={`${sortField}:${sortOrder}`}
            onValueChange={(v) => {
              const [f, o] = v.split(":") as [SortField, "asc" | "desc"];
              setSortField(f);
              setSortOrder(o);
              setCurrentPage(1);
            }}
          >
            <SelectTrigger className="md:col-span-2">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="createdAt:desc">Newest first</SelectItem>
              <SelectItem value="createdAt:asc">Oldest first</SelectItem>
              <SelectItem value="publishedAt:desc">Recently published</SelectItem>
              <SelectItem value="viewCount:desc">Most views</SelectItem>
              <SelectItem value="viewCount:asc">Fewest views</SelectItem>
              <SelectItem value="title:asc">Title A→Z</SelectItem>
              <SelectItem value="articleType:asc">Type A→Z</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={pageSize.toString()}
            onValueChange={handlePageSizeChange}
          >
            <SelectTrigger className="md:col-span-2">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="20">20 per page</SelectItem>
              <SelectItem value="50">50 per page</SelectItem>
              <SelectItem value="100">100 per page</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Bulk action bar — appears when at least one row is selected.
            Single source of action for publish/unpublish/archive/delete
            across many rows at once. */}
        {selectedIds.size > 0 && (
          <div className="flex items-center justify-between bg-accent/50 rounded-md border p-3">
            <span className="text-sm font-medium">
              {selectedIds.size} selected
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  bulkUpdateMutation.mutate({
                    ids: Array.from(selectedIds),
                    action: "publish",
                  })
                }
                disabled={bulkUpdateMutation.isPending}
              >
                <EyeIcon className="h-3.5 w-3.5 mr-1" />
                Publish
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  bulkUpdateMutation.mutate({
                    ids: Array.from(selectedIds),
                    action: "unpublish",
                  })
                }
                disabled={bulkUpdateMutation.isPending}
              >
                Unpublish
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  bulkUpdateMutation.mutate({
                    ids: Array.from(selectedIds),
                    action: filterStatus === "archived" ? "unarchive" : "archive",
                  })
                }
                disabled={bulkUpdateMutation.isPending}
              >
                {filterStatus === "archived" ? (
                  <><ArchiveRestore className="h-3.5 w-3.5 mr-1" />Unarchive</>
                ) : (
                  <><Archive className="h-3.5 w-3.5 mr-1" />Archive</>
                )}
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button size="sm" variant="destructive" disabled={bulkUpdateMutation.isPending}>
                    <Trash2 className="h-3.5 w-3.5 mr-1" />
                    Delete
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>
                      Delete {selectedIds.size} blog{selectedIds.size === 1 ? "" : "s"}?
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      This permanently deletes the selected blog post
                      {selectedIds.size === 1 ? "" : "s"}. Cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() =>
                        bulkUpdateMutation.mutate({
                          ids: Array.from(selectedIds),
                          action: "delete",
                        })
                      }
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Delete {selectedIds.size}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setSelectedIds(new Set())}
              >
                Clear
              </Button>
            </div>
          </div>
        )}

        {/* Results info + select-all */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Checkbox
              checked={
                blogs.length > 0 &&
                blogs.every((b: BlogArticle) => selectedIds.has(b.id))
              }
              onCheckedChange={(checked) => {
                if (checked) {
                  const next = new Set(selectedIds);
                  for (const b of blogs as BlogArticle[]) next.add(b.id);
                  setSelectedIds(next);
                } else {
                  const next = new Set(selectedIds);
                  for (const b of blogs as BlogArticle[]) next.delete(b.id);
                  setSelectedIds(next);
                }
              }}
            />
            <p className="text-sm text-muted-foreground">
              Showing {totalBlogs === 0 ? 0 : (currentPage - 1) * pageSize + 1} to{" "}
              {Math.min(currentPage * pageSize, totalBlogs)} of {totalBlogs} posts
            </p>
          </div>
        </div>

        {/* Blog List */}
        {blogs.length === 0 ? (
          <Card>
            <CardContent className="py-8">
              <div className="text-center">
                <BookOpen className="mx-auto h-12 w-12 text-muted-foreground" />
                <h3 className="mt-2 text-lg font-semibold">No blogs found</h3>
                <p className="text-muted-foreground mb-4">
                  {searchTerm || filterType !== "all" || filterStatus !== "all"
                    ? "Try adjusting your filters"
                    : "Get started by creating your first blog post"}
                </p>
                <div className="flex gap-2 justify-center">
                  {(searchTerm ||
                    filterType !== "all" ||
                    filterStatus !== "all") && (
                    <Button
                      variant="outline"
                      onClick={() => {
                        setSearchTerm("");
                        setFilterType("all");
                        setFilterStatus("all");
                      }}
                    >
                      Clear Filters
                    </Button>
                  )}
                  <Link href="/admin/blogs/add">
                    <Button>
                      <Plus className="mr-2 h-4 w-4" />
                      Create Post
                    </Button>
                  </Link>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {blogs.map((blog: BlogArticle) => (
              <Card
                key={blog.id}
                className={cn(
                  "hover:shadow-lg transition-shadow",
                  selectedIds.has(blog.id) && "ring-2 ring-primary",
                )}
              >
                <CardContent className="p-6">
                  <div className="flex justify-between items-start gap-4">
                    {/* Per-row select checkbox — anchors to top of card */}
                    <Checkbox
                      checked={selectedIds.has(blog.id)}
                      onCheckedChange={(checked) => {
                        const next = new Set(selectedIds);
                        if (checked) next.add(blog.id);
                        else next.delete(blog.id);
                        setSelectedIds(next);
                      }}
                      className="mt-1"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <h3 className="text-xl font-semibold">{blog.title}</h3>
                        {blog.isArchived ? (
                          <Badge variant="secondary">
                            <Archive className="h-3 w-3 mr-1" />
                            Archived
                          </Badge>
                        ) : blog.isPublished ? (
                          <Badge variant="default">Published</Badge>
                        ) : blog.scheduledFor ? (
                          <Badge variant="outline" className="border-blue-500 text-blue-700">
                            <Clock className="h-3 w-3 mr-1" />
                            Scheduled
                          </Badge>
                        ) : (
                          <Badge variant="secondary">Draft</Badge>
                        )}
                        {blog.articleType && (
                          <Badge variant="outline">{blog.articleType}</Badge>
                        )}
                      </div>

                      <p className="text-muted-foreground mb-4 line-clamp-2">
                        {blog.summary}
                      </p>

                      <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-4 w-4" />
                          <span>
                            {blog.publishedAt
                              ? `Published ${formatDate(blog.publishedAt)}`
                              : blog.scheduledFor
                              ? `Scheduled ${formatDate(blog.scheduledFor)}`
                              : `Created ${formatDate(blog.createdAt)}`}
                          </span>
                        </div>
                        {typeof blog.viewCount === "number" && (
                          <div className="flex items-center gap-1">
                            <Eye className="h-4 w-4" />
                            <span className="tabular-nums">
                              {blog.viewCount.toLocaleString()} view{blog.viewCount === 1 ? "" : "s"}
                            </span>
                          </div>
                        )}
                        {blog.readingLevel && (
                          <div className="flex items-center gap-1">
                            <BookOpen className="h-4 w-4" />
                            <span>{blog.readingLevel}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <Link href={`/blog/${blog.slug}`}>
                        <Button size="sm" variant="outline">
                          <Eye className="h-4 w-4 mr-1" />
                          View
                        </Button>
                      </Link>

                      <Link href={`/admin/blogs/edit/${blog.id}`}>
                        <Button size="sm" variant="outline">
                          <Edit className="h-4 w-4 mr-1" />
                          Edit
                        </Button>
                      </Link>

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button size="sm" variant="ghost">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() =>
                              handleTogglePublish(blog.id, blog.isPublished)
                            }
                          >
                            {blog.isPublished ? "Unpublish" : "Publish"}
                          </DropdownMenuItem>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onSelect={(e) => e.preventDefault()}
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle className="flex items-center gap-2">
                                  <AlertTriangle className="h-5 w-5 text-destructive" />
                                  Delete blog post
                                </AlertDialogTitle>
                                <AlertDialogDescription asChild>
                                  <div className="space-y-3">
                                    <p>
                                      You are about to delete{" "}
                                      <strong>{blog.title}</strong>.
                                    </p>
                                    <p className="text-destructive font-medium text-sm">
                                      This action cannot be undone.
                                    </p>
                                  </div>
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDeleteBlog(blog.id)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <Card>
            <CardFooter className="flex items-center justify-between pt-6">
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={goToFirstPage}
                  disabled={currentPage === 1}
                >
                  <ChevronsLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={goToPreviousPage}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>

                {/* Page numbers */}
                <div className="flex items-center gap-1">
                  {getPageNumbers().map((page, index) =>
                    page === -1 ? (
                      <span key={`ellipsis-${index}`} className="px-2">
                        ...
                      </span>
                    ) : (
                      <Button
                        key={page}
                        variant={currentPage === page ? "default" : "outline"}
                        size="sm"
                        onClick={() => setCurrentPage(page)}
                        className="min-w-[40px]"
                      >
                        {page}
                      </Button>
                    ),
                  )}
                </div>

                <Button
                  variant="outline"
                  size="icon"
                  onClick={goToNextPage}
                  disabled={currentPage === totalPages}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={goToLastPage}
                  disabled={currentPage === totalPages}
                >
                  <ChevronsRight className="h-4 w-4" />
                </Button>
              </div>

              <p className="text-sm text-muted-foreground">
                Page {currentPage} of {totalPages}
              </p>
            </CardFooter>
          </Card>
        )}
      </div>
    </AdminLayout>
  );
}
