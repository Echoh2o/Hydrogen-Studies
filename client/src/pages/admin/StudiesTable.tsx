import React, { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { formatAuthors } from "@/lib/utils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { DeletionConfirmDialog } from "@/components/admin/DeletionConfirmDialog";

import {
  PlusCircle,
  Loader2,
  Search,
  ArrowUpDown,
  Filter,
  Check,
  X,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Edit,
  Eye,
  MoreHorizontal,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function StudiesTable() {
  const [, navigate] = useLocation();
  // Filter and search state
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [sortBy, setSortBy] = useState("id");
  const [sortOrder, setSortOrder] = useState("desc");

  // Selection state
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null);
  const [showBulkDelete, setShowBulkDelete] = useState(false);

  const { toast } = useToast();

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  // Build query parameters
  const queryParams = new URLSearchParams();
  queryParams.set("page", currentPage.toString());
  queryParams.set("limit", pageSize.toString());
  queryParams.set("sortBy", sortBy);
  queryParams.set("sortOrder", sortOrder);

  if (searchQuery) {
    queryParams.set("search", searchQuery);
  }

  if (selectedCategory && selectedCategory !== "all") {
    queryParams.set("category", selectedCategory);
  }

  // Fetch studies with pagination
  const studiesQuery = useQuery<any>({
    queryKey: [
      "/api/studies",
      currentPage,
      pageSize,
      searchQuery,
      selectedCategory,
      sortBy,
      sortOrder,
    ],
    queryFn: async () => {
      const response = await fetch(`/api/studies?${queryParams.toString()}`);
      if (!response.ok) throw new Error("Failed to fetch studies");
      return response.json();
    },
  });

  // Fetch categories for filtering
  const categoriesQuery = useQuery({
    queryKey: ["/api/categories"],
  });

  // Clear selection when filters/page change
  useEffect(() => {
    setSelectedIds(new Set());
  }, [currentPage, searchQuery, selectedCategory, sortBy, sortOrder]);

  // Extract data from the paginated response upfront so the helpers
  // below (toggleSelectAll, render code, etc.) close over a fresh value
  // on each render. Previously these were declared after the mutation
  // hooks — the closures still worked because JS hoists const through
  // closure capture, but the order made it look like a bug.
  const studies: any[] = studiesQuery.data?.data || [];
  const totalStudies = studiesQuery.data?.total || 0;
  const totalPages = studiesQuery.data?.totalPages || 1;
  const categories = Array.isArray(categoriesQuery.data)
    ? categoriesQuery.data
    : [];

  // Single delete mutation
  const deleteMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: number; reason?: string }) => {
      const res = await apiRequest("DELETE", `/api/studies/${id}`, { reason });
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/studies"] });
      toast({ title: "Study deleted", description: data.studyTitle || "Study has been removed." });
      setDeleteTarget(null);
    },
    onError: (error: Error) => {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
    },
  });

  // Bulk delete mutation
  const bulkDeleteMutation = useMutation({
    mutationFn: async ({ studyIds, reason }: { studyIds: number[]; reason?: string }) => {
      const res = await apiRequest("DELETE", "/api/studies/bulk", { studyIds, reason });
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/studies"] });
      const msg = `Deleted ${data.deleted?.length ?? 0} studies.${data.failed?.length ? ` ${data.failed.length} failed.` : ""}`;
      toast({ title: "Bulk delete complete", description: msg });
      setSelectedIds(new Set());
      setShowBulkDelete(false);
    },
    onError: (error: Error) => {
      toast({ title: "Bulk delete failed", description: error.message, variant: "destructive" });
    },
  });

  // Selection helpers
  const toggleSelectAll = () => {
    if (selectedIds.size === studies.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(studies.map((s: any) => s.id)));
    }
  };

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Loading state
  if (studiesQuery.isLoading && !studiesQuery.data) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Error state
  if (studiesQuery.isError) {
    return (
      <Alert variant="destructive" className="mb-4">
        <AlertDescription>
          Failed to load studies. Please try again later.
        </AlertDescription>
      </Alert>
    );
  }

  // Handle search input change with debounce effect
  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setCurrentPage(1); // Reset to first page on new search
  };

  // Handle category change
  const handleCategoryChange = (category: string) => {
    setSelectedCategory(category);
    setCurrentPage(1); // Reset to first page on filter change
  };

  // Toggle sort
  const toggleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(field);
      setSortOrder("desc");
    }
    setCurrentPage(1); // Reset to first page on sort change
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

  // Format date for display
  const formatDate = (dateString: string) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col md:flex-row md:items-center justify-between space-y-2 md:space-y-0">
          <div>
            <CardTitle>Manage Studies</CardTitle>
            <CardDescription>
              View, edit, and manage hydrogen research studies in the database
            </CardDescription>
          </div>
          <Button asChild>
            <Link href="/admin/studies/add">
              <PlusCircle className="mr-2 h-4 w-4" /> Add New Study
            </Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {/* Filters and search */}
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="relative flex-grow">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search studies..."
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="pl-9"
            />
          </div>

          <div className="flex gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  <Filter className="h-4 w-4 mr-2" />
                  Category
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem
                  onClick={() => handleCategoryChange("all")}
                  className="flex items-center justify-between"
                  key="all"
                >
                  All Categories
                  {selectedCategory === "all" && <Check className="h-4 w-4" />}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {categories.map((category) => (
                  <DropdownMenuItem
                    key={category.name}
                    onClick={() => handleCategoryChange(category.name)}
                    className="flex items-center justify-between"
                  >
                    {category.name}
                    {selectedCategory === category.name && (
                      <Check className="h-4 w-4" />
                    )}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  <ArrowUpDown className="h-4 w-4 mr-2" />
                  Sort
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => toggleSort("publish_date")}>
                  Date{" "}
                  {sortBy === "publish_date" &&
                    (sortOrder === "asc" ? "(Oldest)" : "(Newest)")}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => toggleSort("title")}>
                  Title{" "}
                  {sortBy === "title" &&
                    (sortOrder === "asc" ? "(A-Z)" : "(Z-A)")}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => toggleSort("category")}>
                  Category{" "}
                  {sortBy === "category" &&
                    (sortOrder === "asc" ? "(A-Z)" : "(Z-A)")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Results info */}
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-muted-foreground">
            Showing {(currentPage - 1) * pageSize + 1} to{" "}
            {Math.min(currentPage * pageSize, totalStudies)} of {totalStudies}{" "}
            studies
          </p>
          <div className="flex items-center gap-2">
            <label className="text-sm text-muted-foreground">
              Items per page:
            </label>
            <Select
              value={pageSize.toString()}
              onValueChange={handlePageSizeChange}
            >
              <SelectTrigger className="w-20">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="20">20</SelectItem>
                <SelectItem value="50">50</SelectItem>
                <SelectItem value="100">100</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Bulk action bar */}
        {selectedIds.size > 0 && (
          <div className="flex items-center gap-3 mb-4 p-3 bg-muted rounded-md">
            <Badge variant="secondary">{selectedIds.size} selected</Badge>
            <Button variant="ghost" size="sm" onClick={() => setSelectedIds(new Set())}>
              Deselect All
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setShowBulkDelete(true)}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete Selected
            </Button>
          </div>
        )}

        {/* Studies table */}
        {studies.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground mb-4">
              No studies found matching your criteria.
            </p>
            {searchQuery || selectedCategory !== "all" ? (
              <Button
                variant="outline"
                onClick={() => {
                  setSearchQuery("");
                  setSelectedCategory("all");
                }}
              >
                <X className="h-4 w-4 mr-2" /> Clear Filters
              </Button>
            ) : (
              <Button asChild>
                <Link href="/admin/research-import">Find New Studies</Link>
              </Button>
            )}
          </div>
        ) : (
          <div className="border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40px]">
                    <Checkbox
                      checked={studies.length > 0 && selectedIds.size === studies.length}
                      onCheckedChange={toggleSelectAll}
                      aria-label="Select all"
                    />
                  </TableHead>
                  <TableHead className="w-[350px]">Title</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Authors</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {studies.map((study: any) => (
                  <TableRow
                    key={study.id}
                    tabIndex={0}
                    role="link"
                    aria-label={`Edit study: ${study.title}`}
                    className="cursor-pointer hover:bg-accent/50 focus:outline-none focus:bg-accent"
                    onClick={() => navigate(`/admin/studies/edit/${study.id}`)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        navigate(`/admin/studies/edit/${study.id}`);
                      }
                    }}
                  >
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={selectedIds.has(study.id)}
                        onCheckedChange={() => toggleSelect(study.id)}
                        aria-label={`Select study ${study.id}`}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="max-w-[350px]">
                        <p className="font-medium truncate">{study.title}</p>
                        {study.journal && (
                          <p className="text-sm text-muted-foreground truncate">
                            {study.journal}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {study.category ? (
                        <Badge variant="outline">{study.category}</Badge>
                      ) : (
                        <span className="text-muted-foreground">
                          Uncategorized
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <p className="text-sm truncate max-w-[200px]">
                        {formatAuthors(study.authors) || "N/A"}
                      </p>
                    </TableCell>
                    <TableCell>
                      <p className="text-sm">{formatDate(study.publishDate)}</p>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link href={study.slug ? `/study/${study.slug}` : `/study/id/${study.id}`}>
                              <Eye className="h-4 w-4 mr-2" /> View
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <Link href={`/admin/studies/edit/${study.id}`}>
                              <Edit className="h-4 w-4 mr-2" /> Edit
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteTarget(study.id);
                            }}
                          >
                            <Trash2 className="h-4 w-4 mr-2" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
      {/* Pagination */}
      {totalPages > 1 && (
        <CardFooter className="flex items-center justify-between">
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
      )}
      {/* Single delete dialog */}
      <DeletionConfirmDialog
        mode="single"
        studyId={deleteTarget ?? undefined}
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={(reason) => deleteTarget && deleteMutation.mutate({ id: deleteTarget, reason })}
        isDeleting={deleteMutation.isPending}
      />

      {/* Bulk delete dialog */}
      <DeletionConfirmDialog
        mode="bulk"
        studyIds={Array.from(selectedIds)}
        open={showBulkDelete}
        onClose={() => setShowBulkDelete(false)}
        onConfirm={(reason) => bulkDeleteMutation.mutate({ studyIds: Array.from(selectedIds), reason })}
        isDeleting={bulkDeleteMutation.isPending}
      />
    </Card>
  );
}
