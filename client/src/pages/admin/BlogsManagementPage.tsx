import { useState } from 'react';
import { Link } from 'wouter';
import { Helmet } from 'react-helmet';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import AdminLayout from '@/components/admin/AdminLayout';
import { 
  Plus, 
  Search, 
  Filter, 
  ArrowUpDown, 
  Pencil, 
  Trash2,
  ChevronLeft,
  ChevronRight,
  Loader2,
  AlertCircle,
  Eye,
  MoveRight,
  FileText,
  Image,
  BarChart2
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';

interface BlogArticle {
  id: number;
  title: string;
  studyId: number;
  studyTitle: string;
  summary: string;
  publishDate: string;
  readingLevel: string;
  articleType: string;
  isPublished: boolean;
  viewCount: number;
  imageUrl: string;
}

export default function BlogsManagementPage() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [articleTypeFilter, setArticleTypeFilter] = useState('');
  const [publishedFilter, setPublishedFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [activeTab, setActiveTab] = useState('all');
  
  // Track items per page
  const [pageSize, setPageSize] = useState(10);
  const [sortField, setSortField] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState('desc');
  
  // Fetch blogs
  const { data: blogs, isLoading: isLoadingBlogs } = useQuery({
    queryKey: ['/api/blogs', { 
      page: currentPage, 
      pageSize, 
      searchQuery, 
      articleTypeFilter, 
      publishedFilter, 
      status: activeTab,
      sortField,
      sortOrder
    }],
    retry: false,
  });
  
  // Format date for display
  const formatDate = (dateString: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };
  
  // Handle search
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1); // Reset to first page on new search
  };
  
  // Truncate text helper
  const truncateText = (text: string, maxLength: number) => {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength) + '...';
  };
  
  // Toggle publish status
  const togglePublishStatus = (id: number, currentStatus: boolean) => {
    toast({
      title: `Blog ${currentStatus ? 'unpublished' : 'published'}`,
      description: `Blog has been ${currentStatus ? 'unpublished' : 'published'} successfully.`,
    });
  };
  
  // Placeholder for delete action
  const handleDelete = (id: number) => {
    toast({
      title: "Not implemented",
      description: "Delete functionality is not implemented yet.",
      variant: "destructive"
    });
  };
  
  // Placeholder to generate blog
  const handleGenerateBlog = (studyId: number) => {
    toast({
      title: "Generating blog articles",
      description: `Generating new blog articles for study #${studyId}. This may take a moment.`,
    });
  };
  
  // Total pages calculation
  const totalItems = blogs?.totalCount || 0;
  const totalPages = Math.ceil(totalItems / pageSize);
  
  return (
    <AdminLayout title="Blogs Management" description="Manage blog articles">
      <Helmet>
        <title>Blogs Management | HydrogenStudies Admin</title>
      </Helmet>
      
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Blogs Management</h2>
            <p className="text-muted-foreground">
              Create and manage AI-generated blog articles from research studies
            </p>
          </div>
          <div className="flex space-x-4">
            <Button asChild>
              <Link href="/admin/blogs/generate" className="flex items-center">
                <FileText className="mr-2 h-4 w-4" />
                Generate Blogs
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/admin/blogs/add" className="flex items-center">
                <Plus className="mr-2 h-4 w-4" />
                Add Manual Blog
              </Link>
            </Button>
          </div>
        </div>
        
        {/* Search and filters */}
        <Card>
          <CardHeader>
            <CardTitle>Search Blog Articles</CardTitle>
            <CardDescription>
              Find blog articles by title, content, or study
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSearch} className="space-y-4">
              <div className="flex flex-col space-y-4 md:flex-row md:space-x-4 md:space-y-0">
                <div className="flex-1">
                  <Input
                    placeholder="Search by title, content, or study title..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full"
                  />
                </div>
                
                <div className="w-full md:w-48">
                  <Select value={articleTypeFilter} onValueChange={setArticleTypeFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="All Types" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Types</SelectItem>
                      <SelectItem value="summary">Summary</SelectItem>
                      <SelectItem value="elon">Elon Musk Style</SelectItem>
                      <SelectItem value="explainer">Explainer</SelectItem>
                      <SelectItem value="implications">Health Implications</SelectItem>
                      <SelectItem value="timeline">Historical Context</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="w-full md:w-48">
                  <Select value={publishedFilter} onValueChange={setPublishedFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="All Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="published">Published</SelectItem>
                      <SelectItem value="unpublished">Unpublished</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Button type="submit" className="w-full md:w-auto">
                    <Search className="mr-2 h-4 w-4" />
                    Search
                  </Button>
                </div>
              </div>
              
              <div className="flex items-center space-x-2 text-sm">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Available filters:</span>
                <Badge variant="outline" className="cursor-pointer">With Image</Badge>
                <Badge variant="outline" className="cursor-pointer">6th Grade</Badge>
                <Badge variant="outline" className="cursor-pointer">Most Viewed</Badge>
              </div>
            </form>
          </CardContent>
        </Card>
        
        {/* Tab filter */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="all">All Articles</TabsTrigger>
            <TabsTrigger value="published">Published</TabsTrigger>
            <TabsTrigger value="unpublished">Pending Review</TabsTrigger>
            <TabsTrigger value="draft">Drafts</TabsTrigger>
          </TabsList>
          
          <TabsContent value={activeTab}>
            {/* Blogs table */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>
                    {activeTab === 'all' && 'All Blog Articles'}
                    {activeTab === 'published' && 'Published Articles'}
                    {activeTab === 'unpublished' && 'Articles Pending Review'}
                    {activeTab === 'draft' && 'Draft Articles'}
                  </CardTitle>
                  <div className="flex items-center space-x-2">
                    <Button variant="outline" size="sm" asChild>
                      <Link href="/admin/analytics/blogs" className="flex items-center space-x-2">
                          <BarChart2 className="h-4 w-4" />
                          <span>Analytics</span>
                      </Link>
                    </Button>
                    <Button variant="outline" size="sm">
                      <ArrowUpDown className="mr-2 h-4 w-4" />
                      Sort
                    </Button>
                  </div>
                </div>
                <CardDescription>
                  {totalItems > 0 ? 
                    `Showing ${Math.min((currentPage - 1) * pageSize + 1, totalItems)} to ${Math.min(currentPage * pageSize, totalItems)} of ${totalItems} blog articles` : 
                    'No blog articles found'
                  }
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoadingBlogs ? (
                  <div className="flex justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : !blogs || blogs.data?.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <AlertCircle className="h-12 w-12 text-muted-foreground" />
                    <h3 className="mt-4 text-lg font-medium">No blog articles found</h3>
                    <p className="mt-2 text-sm text-muted-foreground max-w-md">
                      {searchQuery || articleTypeFilter || publishedFilter ? 
                        'Try changing your search terms or filters.' : 
                        'Generate blog articles from research studies to get started.'
                      }
                    </p>
                    <div className="mt-6 flex space-x-4">
                      <Button asChild>
                        <Link href="/admin/blogs/generate" className="w-full">
                          Generate Blogs
                        </Link>
                      </Button>
                      <Button variant="outline" asChild>
                        <Link href="/admin/blogs/add" className="w-full">
                          Create Manual Blog
                        </Link>
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-[300px]">Title</TableHead>
                            <TableHead>Based On</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead>Reading Level</TableHead>
                            <TableHead className="w-[120px]">Published</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {/* This would map over blogs.data in a real app */}
                          {/* Using placeholder data for development */}
                          {[
                            {
                              id: 1,
                              title: "Hydrogen May Help Combat Cancer Cell Growth According to New Study",
                              studyId: 123,
                              studyTitle: "Effects of Hydrogen-Rich Saline on Cancer Cells",
                              summary: "Recent research suggests hydrogen therapy may inhibit cancer cell growth through antioxidant pathways.",
                              publishDate: "2024-04-15",
                              readingLevel: "6th Grade",
                              articleType: "explainer",
                              isPublished: true,
                              viewCount: 254,
                              imageUrl: "https://example.com/image1.jpg"
                            },
                            {
                              id: 2,
                              title: "Why Hydrogen Therapy Might Be The Next Big Thing In Disease Prevention",
                              studyId: 456,
                              studyTitle: "Molecular Hydrogen as a Novel Antioxidant",
                              summary: "Examining the evidence behind hydrogen's potential role in preventing oxidative stress-related diseases.",
                              publishDate: "",
                              readingLevel: "8th Grade",
                              articleType: "elon",
                              isPublished: false,
                              viewCount: 0,
                              imageUrl: ""
                            },
                            {
                              id: 3,
                              title: "The Science Behind Hydrogen's Anti-Inflammatory Properties",
                              studyId: 789,
                              studyTitle: "Hydrogen Gas Reduces Inflammatory Cytokine Production",
                              summary: "A detailed look at how molecular hydrogen reduces inflammatory markers in clinical studies.",
                              publishDate: "2024-05-02",
                              readingLevel: "6th Grade",
                              articleType: "summary",
                              isPublished: true,
                              viewCount: 187,
                              imageUrl: "https://example.com/image3.jpg"
                            }
                          ].map((blog: BlogArticle) => (
                            <TableRow key={blog.id}>
                              <TableCell className="font-medium">
                                <div className="flex flex-col">
                                  <Link href={`/admin/blogs/edit/${blog.id}`} className="hover:underline truncate max-w-xs block">
                                      {blog.title}
                                  </Link>
                                  <span className="text-xs text-muted-foreground truncate max-w-xs">
                                    {truncateText(blog.summary, 60)}
                                  </span>
                                </div>
                              </TableCell>
                              <TableCell>
                                <Link href={`/admin/studies/edit/${blog.studyId}`} className="text-sm hover:underline flex items-center">
                                  <span className="truncate max-w-[150px]">{blog.studyTitle}</span>
                                  <MoveRight className="ml-1 h-3 w-3" />
                                </Link>
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline" className={
                                  blog.articleType === 'summary' ? 'bg-blue-50 text-blue-700' :
                                  blog.articleType === 'elon' ? 'bg-purple-50 text-purple-700' :
                                  blog.articleType === 'explainer' ? 'bg-green-50 text-green-700' :
                                  blog.articleType === 'implications' ? 'bg-amber-50 text-amber-700' :
                                  'bg-gray-50 text-gray-700'
                                }>
                                  {blog.articleType === 'summary' ? 'Summary' :
                                   blog.articleType === 'elon' ? 'Elon Style' :
                                   blog.articleType === 'explainer' ? 'Explainer' :
                                   blog.articleType === 'implications' ? 'Health' :
                                   blog.articleType}
                                </Badge>
                              </TableCell>
                              <TableCell>{blog.readingLevel}</TableCell>
                              <TableCell>
                                <div className="flex items-center space-x-2">
                                  <Switch 
                                    checked={blog.isPublished}
                                    onCheckedChange={() => togglePublishStatus(blog.id, blog.isPublished)}
                                  />
                                  <span className="text-xs">
                                    {blog.isPublished ? formatDate(blog.publishDate) : 'Draft'}
                                  </span>
                                </div>
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex justify-end space-x-2">
                                  {blog.isPublished && (
                                    <Button variant="ghost" size="icon" asChild>
                                      <Link href={`/blog/${blog.id}`}>
                                        <a>
                                          <Eye className="h-4 w-4" />
                                          <span className="sr-only">View</span>
                                        </a>
                                      </Link>
                                    </Button>
                                  )}
                                  {!blog.imageUrl && (
                                    <Button variant="ghost" size="icon" asChild>
                                      <Link href={`/admin/blogs/generate-image/${blog.id}`}>
                                          <Image className="h-4 w-4" />
                                          <span className="sr-only">Generate Image</span>
                                      </Link>
                                    </Button>
                                  )}
                                  <Button variant="ghost" size="icon" asChild>
                                    <Link href={`/admin/blogs/edit/${blog.id}`}>
                                      <Pencil className="h-4 w-4" />
                                      <span className="sr-only">Edit</span>
                                    </Link>
                                  </Button>
                                  <Button 
                                    variant="ghost" 
                                    size="icon"
                                    onClick={() => handleDelete(blog.id)}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                    <span className="sr-only">Delete</span>
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                    
                    {/* Pagination */}
                    {totalPages > 1 && (
                      <div className="flex items-center justify-between">
                        <div className="text-sm text-muted-foreground">
                          Page {currentPage} of {totalPages}
                        </div>
                        <div className="flex space-x-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                            disabled={currentPage <= 1}
                          >
                            <ChevronLeft className="h-4 w-4" />
                            <span className="sr-only">Previous Page</span>
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                            disabled={currentPage >= totalPages}
                          >
                            <ChevronRight className="h-4 w-4" />
                            <span className="sr-only">Next Page</span>
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
        
        {/* Blog generation from studies */}
        <Card>
          <CardHeader>
            <CardTitle>Generate Blogs from Studies</CardTitle>
            <CardDescription>
              Automatically generate blog articles from hydrogen research studies
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <p className="text-sm">
                Select a research study to generate multiple blog articles with different styles and reading levels.
                Once generated, you can review and publish them.
              </p>
              
              <div className="flex items-end space-x-4">
                <div className="flex-1">
                  <label className="text-sm font-medium mb-1 block">Select Research Study</label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a study..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="123">Effects of Hydrogen-Rich Saline on Cancer Cells</SelectItem>
                      <SelectItem value="456">Molecular Hydrogen as a Novel Antioxidant</SelectItem>
                      <SelectItem value="789">Hydrogen Gas Reduces Inflammatory Cytokine Production</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <Button onClick={() => handleGenerateBlog(123)}>
                  <FileText className="mr-2 h-4 w-4" />
                  Generate Blog Articles
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}