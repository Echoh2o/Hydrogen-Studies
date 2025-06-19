import { useState } from 'react';
import { Link } from 'wouter';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
  MoreHorizontal
} from 'lucide-react';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

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
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Fetch all blogs
  const { data: blogs = [], isLoading, error } = useQuery({
    queryKey: ['/api/blogs'],
    select: (data: any) => data?.blogs || []
  });

  // Delete blog mutation
  const deleteBlogMutation = useMutation({
    mutationFn: (blogId: number) => 
      apiRequest(`/api/blogs/${blogId}`, {
        method: 'DELETE'
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/blogs'] });
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
    }
  });

  // Toggle publish status mutation
  const togglePublishMutation = useMutation({
    mutationFn: ({ blogId, isPublished }: { blogId: number; isPublished: boolean }) =>
      apiRequest(`/api/blogs/${blogId}`, {
        method: 'PUT',
        body: { isPublished }
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/blogs'] });
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
    }
  });

  // Filter blogs
  const filteredBlogs = blogs.filter((blog: BlogArticle) => {
    const matchesSearch = blog.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         blog.summary.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesType = filterType === 'all' || blog.articleType === filterType;
    
    const matchesStatus = filterStatus === 'all' || 
                         (filterStatus === 'published' && blog.isPublished) ||
                         (filterStatus === 'draft' && !blog.isPublished);
    
    return matchesSearch && matchesType && matchesStatus;
  });

  const handleDeleteBlog = (blogId: number) => {
    deleteBlogMutation.mutate(blogId);
  };

  const handleTogglePublish = (blogId: number, currentStatus: boolean) => {
    togglePublishMutation.mutate({ blogId, isPublished: !currentStatus });
  };

  if (isLoading) {
    return (
      <AdminLayout>
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
      <AdminLayout>
        <div className="text-center py-8">
          <p className="text-red-500">Error loading blogs: {error.message}</p>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Blog Management</h1>
            <p className="text-muted-foreground">
              Manage your blog articles and generated content
            </p>
          </div>
          <div className="flex gap-2">
            <Link href="/admin/blog/add">
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Add Blog
              </Button>
            </Link>
            <Link href="/admin/blog-recommendations">
              <Button variant="outline">
                <BookOpen className="mr-2 h-4 w-4" />
                AI Recommendations
              </Button>
            </Link>
          </div>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Filter & Search</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4 flex-wrap">
              <div className="flex-1 min-w-64">
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search blogs by title or content..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Filter by type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="explainer">Explainer</SelectItem>
                  <SelectItem value="implications">Implications</SelectItem>
                  <SelectItem value="benefits">Benefits</SelectItem>
                  <SelectItem value="summary">Summary</SelectItem>
                </SelectContent>
              </Select>

              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="published">Published</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Blog List */}
        <div className="space-y-4">
          {filteredBlogs.length === 0 ? (
            <Card>
              <CardContent className="py-8">
                <div className="text-center">
                  <BookOpen className="mx-auto h-12 w-12 text-muted-foreground" />
                  <h3 className="mt-2 text-lg font-semibold">No blogs found</h3>
                  <p className="text-muted-foreground">
                    {blogs.length === 0 
                      ? "No blog articles have been created yet."
                      : "No blogs match your current filters."
                    }
                  </p>
                  <div className="mt-4">
                    <Link href="/admin/blog/add">
                      <Button>
                        <Plus className="mr-2 h-4 w-4" />
                        Create your first blog
                      </Button>
                    </Link>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            filteredBlogs.map((blog: BlogArticle) => (
              <Card key={blog.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-6">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="text-xl font-semibold hover:text-blue-600">
                          <Link href={`/admin/blog/edit/${blog.id}`}>
                            {blog.title}
                          </Link>
                        </h3>
                        <Badge variant={blog.isPublished ? "default" : "secondary"}>
                          {blog.isPublished ? "Published" : "Draft"}
                        </Badge>
                        <Badge variant="outline" className="capitalize">
                          {blog.articleType}
                        </Badge>
                      </div>
                      
                      <p className="text-muted-foreground mb-3 line-clamp-2">
                        {blog.summary}
                      </p>
                      
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-4 w-4" />
                          {new Date(blog.createdAt).toLocaleDateString()}
                        </div>
                        <div className="flex items-center gap-1">
                          <User className="h-4 w-4" />
                          {blog.readingLevel} level
                        </div>
                        {blog.studyTitle && (
                          <div className="flex items-center gap-1">
                            <BookOpen className="h-4 w-4" />
                            <span className="truncate max-w-48">{blog.studyTitle}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2 ml-4">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleTogglePublish(blog.id, blog.isPublished)}
                        disabled={togglePublishMutation.isPending}
                      >
                        {blog.isPublished ? "Unpublish" : "Publish"}
                      </Button>
                      
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                          <Link href={`/blog/${blog.slug}`}>
                            <DropdownMenuItem>
                              <Eye className="mr-2 h-4 w-4" />
                              View
                            </DropdownMenuItem>
                          </Link>
                          <Link href={`/admin/blog/edit/${blog.id}`}>
                            <DropdownMenuItem>
                              <Edit className="mr-2 h-4 w-4" />
                              Edit
                            </DropdownMenuItem>
                          </Link>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <DropdownMenuItem 
                                className="text-red-600 focus:text-red-600"
                                onSelect={(e) => e.preventDefault()}
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete
                              </DropdownMenuItem>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete Blog Article</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to delete "{blog.title}"? This action cannot be undone.
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
            ))
          )}
        </div>

        {/* Summary */}
        {filteredBlogs.length > 0 && (
          <Card>
            <CardContent className="py-4">
              <div className="flex justify-between items-center text-sm text-muted-foreground">
                <span>
                  Showing {filteredBlogs.length} of {blogs.length} blog articles
                </span>
                <div className="flex gap-4">
                  <span>
                    {blogs.filter((b: BlogArticle) => b.isPublished).length} published
                  </span>
                  <span>
                    {blogs.filter((b: BlogArticle) => !b.isPublished).length} drafts
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AdminLayout>
  );
}