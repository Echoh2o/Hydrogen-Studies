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
} from "lucide-react";
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
  createdAt: string;
  updatedAt: string;
}

export default function BlogListPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Build query parameters for pagination and filtering
  const queryParams = new URLSearchParams();
  queryParams.set("page", currentPage.toString());
  queryParams.set("limit", pageSize.toString());

  if (searchTerm) {
    queryParams.set("search", searchTerm);
  }

  if (filterType !== "all") {
    queryParams.set("filterType", filterType);
  }

  if (filterStatus !== "all") {
    queryParams.set("filterStatus", filterStatus);
  }

  // Fetch blogs with pagination
  const { data, isLoading, error } = useQuery({
    queryKey: [
      "/api/blogs",
      currentPage,
      pageSize,
      searchTerm,
      filterType,
      filterStatus,
    ],
    queryFn: async () => {
      const response = await fetch(`/api/blogs?${queryParams.toString()}`);
      if (!response.ok) throw new Error("Failed to fetch blogs");
      return response.json();
    },
    keepPreviousData: true,
  });

  // Extract paginated data
  const blogs = data?.data || [];
  const totalBlogs = data?.total || 0;
  const totalPages = data?.totalPages || 1;

  // Delete blog mutation
  const deleteBlogMutation = useMutation({
    mutationFn: (blogId: number) =>
      fetch(`/api/blogs/${blogId}`, {
        method: "DELETE",
      }).then((res) => res.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/blogs"] });
      toast({
        title: "Success",
        description: "Blog article deleted successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete blog article",
        variant: "destructive",
      });
    },
  });

  // Toggle publish status mutation
  const togglePublishMutation = useMutation({
    mutationFn: ({
      blogId,
      isPublished,
    }: {
      blogId: number;
      isPublished: boolean;
    }) =>
      fetch(`/api/blogs/${blogId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPublished }),
      }).then((res) => res.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/blogs"] });
      toast({
        title: "Success",
        description: "Blog status updated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update blog status",
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

  const handleFilterStatusChange = (value: string) => {
    setFilterStatus(value);
    setCurrentPage(1); // Reset to first page on filter change
  };

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
      <AdminLayout title="Blog Management">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-2 text-muted-foreground">Loading blogs...</p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  if (error) {
    return (
      <AdminLayout title="Blog Management">
        <div className="text-center py-8">
          <p className="text-red-500">Error loading blogs: {error.message}</p>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Blog Management">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              Blog Management
            </h1>
            <p className="text-muted-foreground">
              Manage your blog articles and generated content
            </p>
          </div>
          <div className="flex gap-2">
            <Link href="/admin/blog/add">
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                New Article
              </Button>
            </Link>
            <Link href="/admin/blog/generate">
              <Button variant="secondary">
                <BookOpen className="mr-2 h-4 w-4" />
                Generate Article
              </Button>
            </Link>
          </div>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle>Filter Blogs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search blogs..."
                  value={searchTerm}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  className="pl-9"
                />
              </div>

              {/* Type Filter */}
              <Select value={filterType} onValueChange={handleFilterTypeChange}>
                <SelectTrigger>
                  <SelectValue placeholder="All Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="manual">Manual</SelectItem>
                  <SelectItem value="generated">Generated</SelectItem>
                  <SelectItem value="ai-assisted">AI-Assisted</SelectItem>
                </SelectContent>
              </Select>

              {/* Status Filter */}
              <Select
                value={filterStatus}
                onValueChange={handleFilterStatusChange}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="published">Published</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                </SelectContent>
              </Select>

              {/* Page Size */}
              <Select
                value={pageSize.toString()}
                onValueChange={handlePageSizeChange}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="20">20 per page</SelectItem>
                  <SelectItem value="50">50 per page</SelectItem>
                  <SelectItem value="100">100 per page</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Results info */}
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {(currentPage - 1) * pageSize + 1} to{" "}
            {Math.min(currentPage * pageSize, totalBlogs)} of {totalBlogs} blogs
          </p>
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
                    : "Get started by creating your first blog article"}
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
                  <Link href="/admin/blog/add">
                    <Button>
                      <Plus className="mr-2 h-4 w-4" />
                      Create Article
                    </Button>
                  </Link>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {blogs.map((blog: BlogArticle) => (
              <Card key={blog.id} className="hover:shadow-lg transition-shadow">
                <CardContent className="p-6">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="text-xl font-semibold">{blog.title}</h3>
                        <Badge
                          variant={blog.isPublished ? "success" : "secondary"}
                        >
                          {blog.isPublished ? "Published" : "Draft"}
                        </Badge>
                        {blog.articleType && (
                          <Badge variant="outline">{blog.articleType}</Badge>
                        )}
                      </div>

                      <p className="text-muted-foreground mb-4 line-clamp-2">
                        {blog.summary}
                      </p>

                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-4 w-4" />
                          <span>{formatDate(blog.createdAt)}</span>
                        </div>
                        {blog.readingLevel && (
                          <div className="flex items-center gap-1">
                            <BookOpen className="h-4 w-4" />
                            <span>{blog.readingLevel} grade reading level</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 ml-4">
                      <Link href={`/blog/${blog.slug}`}>
                        <Button size="sm" variant="outline">
                          <Eye className="h-4 w-4 mr-1" />
                          View
                        </Button>
                      </Link>

                      <Link href={`/admin/blog/edit/${blog.id}`}>
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
                                className="text-red-600 focus:text-red-600"
                                onSelect={(e) => e.preventDefault()}
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>
                                  Delete Blog Article
                                </AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to delete "{blog.title}
                                  "? This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDeleteBlog(blog.id)}
                                  className="bg-red-600 hover:bg-red-700"
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
