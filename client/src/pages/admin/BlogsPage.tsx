import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { 
  PlusCircle, 
  Loader2, 
  Search, 
  ArrowUpDown,
  Filter,
  Check,
  X,
  Edit,
  Eye
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";

export default function BlogsPage() {
  // Filter and search state
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [sortBy, setSortBy] = useState("date");
  const [sortDirection, setSortDirection] = useState("desc");
  
  // Fetch blogs
  const blogsQuery = useQuery({
    queryKey: ["/api/blogs"],
  });
  
  // Loading state
  if (blogsQuery.isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  
  // Error state
  if (blogsQuery.isError) {
    return (
      <Alert variant="destructive" className="mb-4">
        <AlertDescription>
          Failed to load blog articles. Please try again later.
        </AlertDescription>
      </Alert>
    );
  }
  
  const blogs = Array.isArray((blogsQuery.data as any)?.data) ? (blogsQuery.data as any).data : [];
  
  // Filter and sort blogs
  const filteredBlogs = blogs.filter((blog: any) => {
    // Apply status filter (using isPublished instead of status)
    if (selectedStatus !== "all") {
      const isPublished = selectedStatus === "published";
      if (blog.isPublished !== isPublished) {
        return false;
      }
    }
    
    // Apply search filter (case-insensitive)
    if (searchQuery && searchQuery.trim() !== "") {
      const query = searchQuery.toLowerCase();
      return (
        blog.title?.toLowerCase().includes(query) ||
        blog.summary?.toLowerCase().includes(query) ||
        blog.articleType?.toLowerCase().includes(query)
      );
    }
    
    return true;
  });
  
  // Sort filtered blogs
  const sortedBlogs = [...filteredBlogs].sort((a, b) => {
    let comparison = 0;
    
    if (sortBy === "date") {
      const dateA = new Date(a.publishDate || a.createdAt).getTime();
      const dateB = new Date(b.publishDate || b.createdAt).getTime();
      comparison = dateA - dateB;
    } else if (sortBy === "title") {
      comparison = a.title.localeCompare(b.title);
    } else if (sortBy === "type") {
      comparison = a.articleType.localeCompare(b.articleType);
    }
    
    // Apply sort direction
    return sortDirection === "desc" ? -comparison : comparison;
  });
  
  // Toggle sort
  const toggleSort = (field: string) => {
    if (sortBy === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortBy(field);
      setSortDirection("desc");
    }
  };
  
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col md:flex-row md:items-center justify-between space-y-2 md:space-y-0">
          <div>
            <CardTitle>Manage Blog Articles</CardTitle>
            <CardDescription>
              Create, edit, and manage blog content
            </CardDescription>
          </div>
          <Button asChild>
            <Link href="/admin/blogs/add">
              <PlusCircle className="mr-2 h-4 w-4" /> Create New Blog
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
              placeholder="Search articles..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          
          <div className="flex gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  <Filter className="h-4 w-4 mr-2" />
                  Status
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem 
                  onClick={() => setSelectedStatus("all")}
                  className="flex items-center justify-between"
                >
                  All Statuses
                  {selectedStatus === "all" && (
                    <Check className="h-4 w-4" />
                  )}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  onClick={() => setSelectedStatus("published")}
                  className="flex items-center justify-between"
                >
                  Published
                  {selectedStatus === "published" && (
                    <Check className="h-4 w-4" />
                  )}
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => setSelectedStatus("draft")}
                  className="flex items-center justify-between"
                >
                  Draft
                  {selectedStatus === "draft" && (
                    <Check className="h-4 w-4" />
                  )}
                </DropdownMenuItem>
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
                <DropdownMenuItem onClick={() => toggleSort("date")}>
                  Date {sortBy === "date" && (sortDirection === "asc" ? "(Oldest)" : "(Newest)")}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => toggleSort("title")}>
                  Title {sortBy === "title" && (sortDirection === "asc" ? "(A-Z)" : "(Z-A)")}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => toggleSort("type")}>
                  Type {sortBy === "type" && (sortDirection === "asc" ? "(A-Z)" : "(Z-A)")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        
        {/* Blogs table */}
        {sortedBlogs.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground mb-4">
              No blog articles found matching your criteria.
            </p>
            {searchQuery || selectedStatus !== "all" ? (
              <Button 
                variant="outline" 
                onClick={() => {
                  setSearchQuery("");
                  setSelectedStatus("all");
                }}
              >
                <X className="h-4 w-4 mr-2" /> Clear Filters
              </Button>
            ) : (
              <Button asChild>
                <Link href="/admin/blogs/add">Create Your First Blog</Link>
              </Button>
            )}
          </div>
        ) : (
          <div className="border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[350px]">Title</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Published</TableHead>
                  <TableHead>Views</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedBlogs.map((blog) => (
                  <TableRow key={blog.id}>
                    <TableCell className="font-medium">
                      <div className="max-w-xs truncate">{blog.title}</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{blog.articleType}</Badge>
                    </TableCell>
                    <TableCell>
                      {blog.isPublished ? (
                        <Badge className="bg-green-100 text-green-800 hover:bg-green-200">
                          Published
                        </Badge>
                      ) : (
                        <Badge variant="outline">Draft</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {blog.publishDate ? new Date(blog.publishDate).toLocaleDateString() : "Not published"}
                    </TableCell>
                    <TableCell>
                      {blog.viewCount || 0}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" asChild className="mr-1">
                        <Link href={`/admin/blogs/edit/${blog.id}`}>
                          <Edit className="h-4 w-4 mr-1" /> Edit
                        </Link>
                      </Button>
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/blog/${blog.id}`}>
                          <Eye className="h-4 w-4 mr-1" /> View
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
      <CardFooter>
        <p className="text-sm text-muted-foreground">
          Showing {sortedBlogs.length} of {blogs.length} blog articles
        </p>
      </CardFooter>
    </Card>
  );
}