import { useParams } from 'wouter';
import { useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import AdminLayout from '@/components/admin/AdminLayout';
import { ArrowLeft, FileEdit, Image, Loader } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { MediaUpload } from '@/components/common/MediaUpload';
import { BlogImageGenerator } from '@/components/admin/BlogImageGenerator';
import { BlogContentSuggestions } from '@/components/admin/BlogContentSuggestions';
import { WysiwygEditor } from '@/components/ui/wysiwyg-editor';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

export default function BlogEditPage() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const blogId = Number(id);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('content');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Fetch blog data
  const { data: blog, isLoading: isBlogLoading, error: blogError } = useQuery({
    queryKey: [`/api/blogs/${blogId}`],
    enabled: !!blogId && !isNaN(blogId)
  });
  
  // Fetch related study data
  const { data: relatedStudy, isLoading: isStudyLoading } = useQuery({
    queryKey: [`/api/studies/${blog?.studyId}`],
    enabled: !!blog?.studyId
  });
  
  // Fetch all studies for dropdown
  const { data: studies = [] } = useQuery({
    queryKey: ['/api/studies'],
    staleTime: 300000, // 5 minutes
  });
  
  // Blog data state
  const [blogData, setBlogData] = useState({
    title: '',
    slug: '',
    summary: '',
    content: '',
    readingLevel: '',
    articleType: '',
    studyId: 0,
    editorNotes: '',
    isPublished: false,
  });
  
  // Update local state when blog data is fetched
  useEffect(() => {
    if (blog) {
      setBlogData({
        title: blog.title || '',
        slug: blog.slug || '',
        summary: blog.summary || '',
        content: blog.content || '',
        readingLevel: blog.readingLevel || '6th',
        articleType: blog.articleType || 'manual',
        studyId: blog.studyId || 0,
        editorNotes: blog.editorNotes || '',
        isPublished: blog.isPublished || false,
      });
    }
  }, [blog]);
  
  // Function to generate slug from title
  const generateSlug = (title: string): string => {
    return title
      .toLowerCase()
      .replace(/[^\w\s]/g, '')  // Remove special characters
      .replace(/\s+/g, '-')     // Replace spaces with hyphens
      .replace(/-+/g, '-')      // Replace multiple hyphens with single hyphen
      .trim();
  };
  
  // Handle input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    
    // If title is being changed, update slug automatically (if slug hasn't been manually edited)
    if (name === 'title') {
      setBlogData(prev => ({
        ...prev,
        title: value,
        slug: generateSlug(value),
      }));
    } else {
      setBlogData(prev => ({
        ...prev,
        [name]: value,
      }));
    }
  };
  
  // Handle rich text editor changes
  const handleRichTextChange = (name: string, value: string) => {
    setBlogData(prev => ({
      ...prev,
      [name]: value,
    }));
  };
  
  // Handle select changes
  const handleSelectChange = (name: string, value: string) => {
    setBlogData(prev => ({
      ...prev,
      [name]: name === 'studyId' ? parseInt(value) : value,
    }));
  };
  
  // Handle checkbox/switch changes
  const handleToggleChange = (name: string, checked: boolean) => {
    setBlogData(prev => ({
      ...prev,
      [name]: checked,
    }));
  };
  
  // Update blog mutation
  const updateBlogMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('PUT', `/api/blogs/${blogId}`, blogData);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Blog article updated',
        description: 'The blog article was successfully updated.',
      });
      
      // Invalidate blogs queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['/api/blogs'] });
      queryClient.invalidateQueries({ queryKey: [`/api/blogs/${blogId}`] });
    },
    onError: (error: any) => {
      toast({
        title: 'Failed to update blog article',
        description: error.message || 'An error occurred. Please try again.',
        variant: 'destructive',
      });
    },
    onSettled: () => {
      setIsSubmitting(false);
    }
  });
  
  // Handle form submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    updateBlogMutation.mutate();
  };
  
  // Handle image upload success
  const handleImageUploadSuccess = (mediaUrl: string) => {
    toast({
      title: 'Image uploaded',
      description: 'The featured image has been successfully updated.',
    });
    
    // Refresh blog data
    queryClient.invalidateQueries({ queryKey: [`/api/blogs/${blogId}`] });
  };
  
  if (isBlogLoading) {
    return (
      <AdminLayout title="Edit Blog" description="Edit blog article">
        <div className="flex items-center justify-center h-64">
          <Loader className="h-8 w-8 animate-spin" />
          <span className="ml-2">Loading blog data...</span>
        </div>
      </AdminLayout>
    );
  }
  
  if (blogError || !blog) {
    return (
      <AdminLayout title="Blog Not Found" description="Could not find the requested blog article">
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold tracking-tight">Blog Not Found</h1>
            <Button variant="outline" onClick={() => navigate('/admin/blogs')}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Blogs
            </Button>
          </div>
          
          <Card>
            <CardHeader>
              <CardTitle>Error</CardTitle>
              <CardDescription>
                The blog article you are looking for could not be found or there was an error loading it.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p>Please check that the blog ID is correct and try again.</p>
              <Button 
                className="mt-4" 
                onClick={() => navigate('/admin/blogs')}
              >
                Return to Blogs
              </Button>
            </CardContent>
          </Card>
        </div>
      </AdminLayout>
    );
  }
  
  return (
    <AdminLayout title={`Edit Blog: ${blog.title}`} description="Edit blog article">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold tracking-tight">Edit Blog</h1>
          <Button variant="outline" onClick={() => navigate('/admin/blogs')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Blogs
          </Button>
        </div>
        
        <form onSubmit={handleSubmit}>
          <div className="grid gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Blog Details</CardTitle>
                <CardDescription>
                  Edit the basic information for your blog article
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* AI Content Suggestions Component */}
                <BlogContentSuggestions 
                  blogId={blogId}
                  onSuggestionApply={(suggestion) => {
                    if (suggestion.length < 50) {
                      // Likely a title suggestion
                      setBlogData({
                        ...blogData,
                        title: suggestion
                      });
                      toast({
                        title: 'Title Updated',
                        description: 'The AI-suggested title has been applied to your blog.'
                      });
                    } else {
                      // Content suggestion
                      setBlogData({
                        ...blogData,
                        content: suggestion
                      });
                      toast({
                        title: 'Content Updated',
                        description: 'The AI-suggested content has been applied to your blog.'
                      });
                    }
                  }}
                />

                <div className="space-y-2">
                  <Label htmlFor="title">Title <span className="text-red-500">*</span></Label>
                  <Input
                    id="title"
                    name="title"
                    value={blogData.title}
                    onChange={handleInputChange}
                    placeholder="Enter blog title"
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="slug">URL Slug <span className="text-red-500">*</span></Label>
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-muted-foreground">/blog/</span>
                    <Input
                      id="slug"
                      name="slug"
                      value={blogData.slug}
                      onChange={handleInputChange}
                      placeholder="enter-url-slug"
                      required
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    This will be used in the URL of your blog article
                  </p>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="summary">Summary <span className="text-red-500">*</span></Label>
                  <WysiwygEditor
                    id="summary"
                    name="summary"
                    value={blogData.summary}
                    onChange={(value) => handleRichTextChange('summary', value)}
                    placeholder="Enter a brief summary of the blog article"
                    height="150px"
                    required
                    description="A short summary that will appear in blog lists and search results"
                  />
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="articleType">Article Type</Label>
                    <Select 
                      value={blogData.articleType} 
                      onValueChange={(value) => handleSelectChange('articleType', value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select article type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="manual">Manual Article</SelectItem>
                        <SelectItem value="summary">Summary</SelectItem>
                        <SelectItem value="explainer">Explainer</SelectItem>
                        <SelectItem value="implications">Health Implications</SelectItem>
                        <SelectItem value="timeline">Historical Context</SelectItem>
                        <SelectItem value="elon">Elon Musk Style</SelectItem>
                        <SelectItem value="elon_simple">Elon-Style Overview</SelectItem>
                        <SelectItem value="elon_benefits">Elon-Style Benefits</SelectItem>
                        <SelectItem value="elon_future">Elon-Style Future Impact</SelectItem>
                        <SelectItem value="elon_faq">Elon-Style FAQ</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="readingLevel">Reading Level</Label>
                    <Select 
                      value={blogData.readingLevel} 
                      onValueChange={(value) => handleSelectChange('readingLevel', value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select reading level" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="6th">6th Grade (Ages 11-12)</SelectItem>
                        <SelectItem value="8th">8th Grade (Ages 13-14)</SelectItem>
                        <SelectItem value="10th">10th Grade (Ages 15-16)</SelectItem>
                        <SelectItem value="12th">12th Grade (Ages 17-18)</SelectItem>
                        <SelectItem value="college">College Level</SelectItem>
                        <SelectItem value="elementary">Elementary (Grades 1-5)</SelectItem>
                        <SelectItem value="middle">Middle School (Grades 6-8)</SelectItem>
                        <SelectItem value="high">High School (Grades 9-12)</SelectItem>
                        <SelectItem value="general">General Audience</SelectItem>
                        <SelectItem value="professional">Professional</SelectItem>
                        <SelectItem value="academic">Academic</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="studyId">Related Study</Label>
                  <Select 
                    value={blogData.studyId.toString()} 
                    onValueChange={(value) => handleSelectChange('studyId', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select related study" />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.isArray(studies) && studies.map((study: any) => (
                        <SelectItem key={study.id} value={study.id.toString()}>
                          {study.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    The study this blog article is related to
                  </p>
                </div>
                
                <div className="pt-2">
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="isPublished"
                      checked={blogData.isPublished}
                      onCheckedChange={(checked) => handleToggleChange('isPublished', checked)}
                    />
                    <Label htmlFor="isPublished">Published</Label>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    When enabled, this blog article will be visible to the public
                  </p>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Blog Content</CardTitle>
                <CardDescription>
                  Edit the content for your blog article
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="content">Content</TabsTrigger>
                    <TabsTrigger value="notes">Editor Notes</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="content" className="space-y-4 pt-4">
                    <WysiwygEditor
                      id="content"
                      name="content"
                      label="Content"
                      value={blogData.content}
                      onChange={(value) => handleRichTextChange('content', value)}
                      placeholder="Enter the full content of your blog article"
                      height="400px"
                      required
                      description="Use the toolbar above to format your content"
                    />
                  </TabsContent>
                  
                  <TabsContent value="notes" className="space-y-4 pt-4">
                    <WysiwygEditor
                      id="editorNotes"
                      name="editorNotes"
                      label="Editor Notes"
                      value={blogData.editorNotes}
                      onChange={(value) => handleRichTextChange('editorNotes', value)}
                      placeholder="Internal notes, sources, or review comments"
                      height="250px"
                      description="These notes are only visible to editors and not shown publicly"
                    />
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Featured Image</CardTitle>
                <CardDescription>
                  Update or generate a featured image for this blog article
                </CardDescription>
              </CardHeader>
              <CardContent>
                {blog.imageUrl ? (
                  <div className="mb-4">
                    <p className="text-sm mb-2">Current Featured Image:</p>
                    <div className="relative aspect-video w-full max-w-md overflow-hidden rounded-lg border">
                      <img 
                        src={blog.imageUrl} 
                        alt={blog.imageAlt || blog.title} 
                        className="h-full w-full object-cover"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      {blog.imageAlt || 'No alt text provided for this image'}
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground mb-4">
                    This blog article doesn't have a featured image yet. Upload or generate one below.
                  </p>
                )}
                
                <Tabs defaultValue="upload" className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="upload">Upload Image</TabsTrigger>
                    <TabsTrigger value="generate">Generate with AI</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="upload" className="space-y-4 pt-4">
                    <MediaUpload 
                      entityId={blogId} 
                      entityType="blog"
                      onSuccess={handleImageUploadSuccess}
                    />
                  </TabsContent>
                  
                  <TabsContent value="generate" className="space-y-4 pt-4">
                    <BlogImageGenerator 
                      blogId={blogId}
                      onSuccess={(imageUrl, imageAlt) => {
                        toast({
                          title: 'Image generated',
                          description: 'AI has created a featured image based on your blog content.',
                        });
                        // Refresh blog data
                        queryClient.invalidateQueries({ queryKey: [`/api/blogs/${blogId}`] });
                      }}
                    />
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
            
            <div className="flex justify-between">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => navigate('/admin/blogs')}
              >
                Cancel
              </Button>
              <Button 
                type="submit"
                disabled={isSubmitting}
                className="px-6"
              >
                {isSubmitting ? (
                  <>
                    <Loader className="mr-2 h-4 w-4 animate-spin" />
                    Updating...
                  </>
                ) : (
                  <>
                    <FileEdit className="mr-2 h-4 w-4" />
                    Update Blog
                  </>
                )}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </AdminLayout>
  );
}