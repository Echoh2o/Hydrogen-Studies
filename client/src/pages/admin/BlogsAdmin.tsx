import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Eye, FileEdit, FilePlus, Search, Trash2 } from "lucide-react";
import BlogForm from "@/components/admin/BlogForm";

export default function BlogsAdmin() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("published");
  const [selectedBlogId, setSelectedBlogId] = useState<number | undefined>(undefined);
  const [selectedStudyId, setSelectedStudyId] = useState<number | undefined>(undefined);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [sortField, setSortField] = useState<string>("createdAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  // Fetch all blog articles
  const { data: blogs = [], isLoading } = useQuery({
    queryKey: ['/api/blogs'],
    staleTime: 30000, // 30 seconds
  });
  
  // Fetch studies for the filter dropdown
  const { data: studies = [] } = useQuery({
    queryKey: ['/api/studies'],
    staleTime: 60000, // 1 minute
    enabled: activeTab === 'byStudy', // Only fetch when byStudy tab is active
  });

  // Filter blogs based on search query and active tab
  const filteredBlogs = blogs.filter((blog: any) => {
    const matchesSearch = 
      blog.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      blog.summary.toLowerCase().includes(searchQuery.toLowerCase());
    
    // Filter based on the active tab
    if (activeTab === 'published') {
      return matchesSearch && blog.isPublished === true;
    } else if (activeTab === 'drafts') {
      return matchesSearch && blog.isPublished === false;
    } else if (activeTab === 'withImages') {
      return matchesSearch && blog.imageUrl;
    } else if (activeTab === 'withoutImages') {
      return matchesSearch && !blog.imageUrl;
    } else if (activeTab === 'byStudy') {
      // Filter by selected study if one is selected
      if (selectedStudyId) {
        return matchesSearch && blog.studyId === selectedStudyId;
      }
      return matchesSearch;
    } else {
      // 'all' tab or default
      return matchesSearch;
    }
  });
  
  // Sort the filtered blogs
  const sortedBlogs = [...filteredBlogs].sort((a, b) => {
    // Handle special sorting for date fields
    if (sortField === 'createdAt' || sortField === 'updatedAt') {
      const dateA = new Date(a[sortField]).getTime();
      const dateB = new Date(b[sortField]).getTime();
      return sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
    }
    
    // Handle numeric fields
    if (sortField === 'id' || sortField === 'studyId') {
      return sortOrder === 'asc' 
        ? a[sortField] - b[sortField] 
        : b[sortField] - a[sortField];
    }
    
    // Handle special case for articleType field
    if (sortField === 'articleType') {
      const valueA = a.type?.toString().toLowerCase() || '';
      const valueB = b.type?.toString().toLowerCase() || '';
      return sortOrder === 'asc'
        ? valueA.localeCompare(valueB)
        : valueB.localeCompare(valueA);
    }
    
    // Default string comparison for other fields like title
    const valueA = a[sortField]?.toString().toLowerCase() || '';
    const valueB = b[sortField]?.toString().toLowerCase() || '';
    return sortOrder === 'asc'
      ? valueA.localeCompare(valueB)
      : valueB.localeCompare(valueA);
  });

  // Delete blog mutation
  const deleteBlogMutation = useMutation({
    mutationFn: async (blogId: number) => {
      const response = await apiRequest("DELETE", `/api/blogs/${blogId}`);
      if (!response.ok) {
        throw new Error("Failed to delete blog article");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Blog article deleted",
        description: "The blog article has been deleted successfully",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/blogs'] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete blog article",
        variant: "destructive",
      });
    }
  });

  // Handle delete blog
  const handleDeleteBlog = (blogId: number) => {
    deleteBlogMutation.mutate(blogId);
  };

  // Function to open edit dialog with the selected blog
  const openEditDialog = (blogId: number) => {
    setSelectedBlogId(blogId);
    setIsEditDialogOpen(true);
  };

  // Format reading level for display
  const formatReadingLevel = (level: string) => {
    switch (level) {
      case "elementary": return "Elementary (Grades 1-5)";
      case "middle": return "Middle School (Grades 6-8)";
      case "high": return "High School (Grades 9-12)";
      case "general": return "General Audience";
      case "professional": return "Professional";
      case "academic": return "Academic";
      default: return level;
    }
  };
  
  // Helper to reset search and filters
  const clearFilters = () => {
    setSearchQuery("");
    if (activeTab === 'byStudy') {
      setSelectedStudyId(undefined);
    }
  };
  
  // Format article type for display
  const formatArticleType = (type: string) => {
    switch (type) {
      case "overview": return "Overview";
      case "practical_application": return "Practical App";
      case "comparison": return "Comparison";
      case "elon_simple": return "Elon Overview";
      case "elon_benefits": return "Elon Benefits";
      case "elon_future": return "Elon Future";
      case "elon_faq": return "Elon FAQ";
      default: return type || "Standard";
    }
  };
  
  // Get color class for article type
  const getArticleTypeColor = (type: string) => {
    if (!type) return "bg-blue-100 text-blue-700";
    
    if (type.startsWith("elon_")) {
      switch (type) {
        case "elon_simple": return "bg-purple-100 text-purple-700";
        case "elon_benefits": return "bg-fuchsia-100 text-fuchsia-700";
        case "elon_future": return "bg-violet-100 text-violet-700";
        case "elon_faq": return "bg-pink-100 text-pink-700";
        default: return "bg-purple-100 text-purple-700";
      }
    }
    
    switch (type) {
      case "overview": return "bg-blue-100 text-blue-700";
      case "practical_application": return "bg-emerald-100 text-emerald-700";
      case "comparison": return "bg-indigo-100 text-indigo-700";
      default: return "bg-blue-100 text-blue-700";
    }
  };

  return (
    <div className="container py-6">
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-2xl font-bold">Blog Articles</CardTitle>
              <CardDescription>Manage all blog articles</CardDescription>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex gap-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="search"
                    placeholder="Search articles..."
                    className="pl-8 w-full md:w-[300px]"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                  {(searchQuery || (activeTab === 'byStudy' && selectedStudyId)) && (
                    <button 
                      className="absolute right-2 top-2.5 text-muted-foreground hover:text-foreground"
                      onClick={clearFilters}
                      type="button"
                      aria-label="Clear search"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
                      </svg>
                    </button>
                  )}
                </div>
                
                {activeTab === 'byStudy' && (
                  <select 
                    className="h-10 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
                    value={selectedStudyId || ""}
                    onChange={(e) => setSelectedStudyId(e.target.value ? parseInt(e.target.value, 10) : undefined)}
                  >
                    <option value="">All Studies</option>
                    {studies.map((study: any) => (
                      <option key={study.id} value={study.id}>
                        {study.title.substring(0, 40)}{study.title.length > 40 ? '...' : ''}
                      </option>
                    ))}
                  </select>
                )}
              </div>
              <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <FilePlus className="mr-2 h-4 w-4" />
                    New Article
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[900px] max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Create New Blog Article</DialogTitle>
                    <DialogDescription>
                      Fill out the form below to create a new blog article
                    </DialogDescription>
                  </DialogHeader>
                  <BlogForm 
                    onSuccess={() => {
                      setIsCreateDialogOpen(false);
                      queryClient.invalidateQueries({ queryKey: ['/api/blogs'] });
                    }} 
                  />
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="all" className="w-full" onValueChange={setActiveTab}>
            <TabsList className="w-full md:w-auto grid grid-cols-6 md:inline-flex mb-4">
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="published">Published</TabsTrigger>
              <TabsTrigger value="drafts">Drafts</TabsTrigger>
              <TabsTrigger value="withImages">With Images</TabsTrigger>
              <TabsTrigger value="withoutImages">Without Images</TabsTrigger>
              <TabsTrigger value="byStudy">By Study</TabsTrigger>
            </TabsList>
            
            <div className="flex flex-col md:flex-row gap-2 mb-4">
              <div className="flex items-center space-x-2">
                <span className="text-sm font-medium">Sort by:</span>
                <select 
                  className="h-8 rounded-md border border-input bg-background px-2 py-1 text-sm shadow-sm"
                  value={sortField}
                  onChange={(e) => setSortField(e.target.value)}
                >
                  <option value="createdAt">Created Date</option>
                  <option value="title">Title</option>
                  <option value="studyId">Study ID</option>
                  <option value="articleType">Article Type</option>
                </select>
                <button
                  className="p-1 rounded-md border border-input bg-background"
                  onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
                  aria-label={sortOrder === "asc" ? "Sort descending" : "Sort ascending"}
                  title={sortOrder === "asc" ? "Sort descending" : "Sort ascending"}
                >
                  {sortOrder === "asc" ? (
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="m3 8 4-4 4 4"/>
                      <path d="M7 4v16"/>
                      <path d="M11 12h10"/>
                      <path d="M11 16h7"/>
                      <path d="M11 20h4"/>
                      <path d="M11 8h10"/>
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="m3 16 4 4 4-4"/>
                      <path d="M7 20V4"/>
                      <path d="M11 12h10"/>
                      <path d="M11 16h7"/>
                      <path d="M11 20h4"/>
                      <path d="M11 8h10"/>
                    </svg>
                  )}
                </button>
              </div>
            </div>
            
            {isLoading ? (
              <div className="flex justify-center p-4">Loading blog articles...</div>
            ) : sortedBlogs.length === 0 ? (
              <div className="text-center p-6 border rounded-md bg-muted/40">
                <p className="text-muted-foreground">
                  {searchQuery 
                    ? "No blog articles match your search" 
                    : "No blog articles found. Create your first article!"}
                </p>
              </div>
            ) : (
              <div className="border rounded-md overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/50 border-b">
                      <th className="text-left p-3 font-medium">
                        <button 
                          className="font-medium flex items-center gap-1"
                          onClick={() => {
                            if (sortField === 'title') {
                              setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                            } else {
                              setSortField('title');
                              setSortOrder('asc');
                            }
                          }}
                        >
                          Title
                          {sortField === 'title' && (
                            <span className="text-xs">
                              {sortOrder === 'asc' ? '↑' : '↓'}
                            </span>
                          )}
                        </button>
                      </th>
                      <th className="text-left p-3 font-medium">
                        <button 
                          className="font-medium flex items-center gap-1"
                          onClick={() => {
                            if (sortField === 'studyId') {
                              setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                            } else {
                              setSortField('studyId');
                              setSortOrder('asc');
                            }
                          }}
                        >
                          Study
                          {sortField === 'studyId' && (
                            <span className="text-xs">
                              {sortOrder === 'asc' ? '↑' : '↓'}
                            </span>
                          )}
                        </button>
                      </th>
                      <th className="text-left p-3 font-medium hidden md:table-cell">
                        <button 
                          className="font-medium flex items-center gap-1"
                          onClick={() => {
                            if (sortField === 'articleType') {
                              setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                            } else {
                              setSortField('articleType');
                              setSortOrder('asc');
                            }
                          }}
                        >
                          Type
                          {sortField === 'articleType' && (
                            <span className="text-xs">
                              {sortOrder === 'asc' ? '↑' : '↓'}
                            </span>
                          )}
                        </button>
                      </th>
                      <th className="text-left p-3 font-medium hidden md:table-cell">Status</th>
                      <th className="text-left p-3 font-medium hidden md:table-cell">
                        <button 
                          className="font-medium flex items-center gap-1"
                          onClick={() => {
                            if (sortField === 'createdAt') {
                              setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                            } else {
                              setSortField('createdAt');
                              setSortOrder('desc');
                            }
                          }}
                        >
                          Created
                          {sortField === 'createdAt' && (
                            <span className="text-xs">
                              {sortOrder === 'asc' ? '↑' : '↓'}
                            </span>
                          )}
                        </button>
                      </th>
                      <th className="text-left p-3 font-medium">Image</th>
                      <th className="text-right p-3 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedBlogs.map((blog: any) => (
                      <tr key={blog.id} className="border-b hover:bg-muted/20">
                        <td className="p-3">
                          <div>
                            <p className="font-medium text-foreground">{blog.title}</p>
                            <p className="text-xs text-muted-foreground max-w-[300px] truncate">{blog.summary}</p>
                            {blog.editorNotes && (
                              <div className="mt-1 text-xs bg-amber-50 border border-amber-200 p-1 rounded text-amber-700">
                                <span className="font-semibold">Editor Notes:</span> {truncateText(blog.editorNotes, 100)}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="p-3">
                          <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full">
                            {blog.studyId}
                          </span>
                        </td>
                        <td className="p-3 hidden md:table-cell">
                          <span className={`text-xs ${getArticleTypeColor(blog.articleType)} px-2 py-1 rounded-full`}>
                            {formatArticleType(blog.articleType)}
                          </span>
                        </td>
                        <td className="p-3 hidden md:table-cell">
                          {blog.isPublished ? (
                            <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">
                              Published
                            </span>
                          ) : (
                            <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded-full">
                              Draft
                            </span>
                          )}
                        </td>
                        <td className="p-3 hidden md:table-cell">
                          {formatDate(blog.createdAt)}
                        </td>
                        <td className="p-3">
                          {blog.imageUrl ? (
                            <div className="relative h-10 w-10 rounded-md overflow-hidden">
                              <img 
                                src={blog.imageUrl} 
                                alt={blog.imageAlt || "Blog image"} 
                                className="object-cover h-full w-full"
                              />
                            </div>
                          ) : (
                            <span className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded-full">
                              No image
                            </span>
                          )}
                        </td>
                        <td className="p-3 text-right">
                          <div className="flex justify-end gap-2">
                            <Button 
                              variant="outline" 
                              size="icon" 
                              title="View"
                              onClick={() => window.open(`/blogs/${blog.slug}`, '_blank')}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button 
                              variant="outline" 
                              size="icon" 
                              title="Edit"
                              onClick={() => openEditDialog(blog.id)}
                            >
                              <FileEdit className="h-4 w-4" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button 
                                  variant="outline" 
                                  size="icon" 
                                  className="text-destructive hover:bg-destructive/10"
                                  title="Delete"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete Blog Article</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to delete this blog article? This action cannot be undone.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => handleDeleteBlog(blog.id)}
                                    className="bg-destructive hover:bg-destructive/90"
                                  >
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Tabs>
        </CardContent>
      </Card>

      {/* Edit Blog Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[900px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Blog Article</DialogTitle>
            <DialogDescription>
              Edit the blog article details
            </DialogDescription>
          </DialogHeader>
          {selectedBlogId && (
            <BlogForm 
              blogId={selectedBlogId}
              onSuccess={() => {
                setIsEditDialogOpen(false);
                queryClient.invalidateQueries({ queryKey: ['/api/blogs'] });
              }} 
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}