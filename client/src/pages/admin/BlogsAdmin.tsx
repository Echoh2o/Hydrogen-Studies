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
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  // Fetch all blog articles
  const { data: blogs = [], isLoading } = useQuery({
    queryKey: ['/api/blogs'],
    staleTime: 30000, // 30 seconds
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
      // TODO: Implement study filter when needed
      return matchesSearch;
    } else {
      // 'all' tab or default
      return matchesSearch;
    }
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
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Search articles..."
                  className="pl-8 w-full md:w-[300px]"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
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
            
            {isLoading ? (
              <div className="flex justify-center p-4">Loading blog articles...</div>
            ) : filteredBlogs.length === 0 ? (
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
                      <th className="text-left p-3 font-medium">Title</th>
                      <th className="text-left p-3 font-medium">Study</th>
                      <th className="text-left p-3 font-medium hidden md:table-cell">Reading Level</th>
                      <th className="text-left p-3 font-medium hidden md:table-cell">Created</th>
                      <th className="text-left p-3 font-medium">Image</th>
                      <th className="text-right p-3 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredBlogs.map((blog: any) => (
                      <tr key={blog.id} className="border-b hover:bg-muted/20">
                        <td className="p-3">
                          <div>
                            <p className="font-medium text-foreground">{blog.title}</p>
                            <p className="text-xs text-muted-foreground max-w-[300px] truncate">{blog.summary}</p>
                          </div>
                        </td>
                        <td className="p-3">
                          <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full">
                            {blog.studyId}
                          </span>
                        </td>
                        <td className="p-3 hidden md:table-cell">
                          {formatReadingLevel(blog.readingLevel)}
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