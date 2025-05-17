import { useState } from 'react';
import { useLocation } from 'wouter';
import { Helmet } from 'react-helmet';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import AdminLayout from '@/components/admin/AdminLayout';
import { ArrowLeft, Search, BookOpen, FileText, Loader2, AlertCircle } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import type { Study } from '@/types';

export default function BlogGeneratePage() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStudyId, setSelectedStudyId] = useState<number | null>(null);
  const [blogOptions, setBlogOptions] = useState({
    standardCount: 2,
    elonCount: 1,
    includeElonStyle: true,
    includeExplainer: true,
    includeImplications: true,
    includeHistorical: false,
    readingLevel: '6th',
    includeImages: true
  });
  
  // Get the 20 most recent studies
  const { data: recentStudies, isLoading: loadingStudies } = useQuery({
    queryKey: ['/api/studies/latest', { limit: 20 }],
    retry: false,
  });
  
  // Search studies
  const { data: searchResults, isLoading: searchLoading } = useQuery({
    queryKey: ['/api/studies/search', { query: searchQuery }],
    enabled: !!searchQuery.trim(),
    retry: false,
  });
  
  // If a study is selected, get more details
  const { data: selectedStudy, isLoading: loadingSelectedStudy } = useQuery({
    queryKey: ['/api/studies', selectedStudyId],
    enabled: !!selectedStudyId,
    retry: false,
  });
  
  // Generate blog articles mutation
  const generateMutation = useMutation({
    mutationFn: async () => {
      if (!selectedStudyId) {
        throw new Error('No study selected');
      }
      
      const response = await apiRequest('POST', `/api/studies/${selectedStudyId}/generate-blogs`, {
        count: blogOptions.standardCount + blogOptions.elonCount,
        includeElonStyle: blogOptions.includeElonStyle,
        standardCount: blogOptions.standardCount,
        elonCount: blogOptions.elonCount,
        includeExplainer: blogOptions.includeExplainer,
        includeImplications: blogOptions.includeImplications, 
        includeHistorical: blogOptions.includeHistorical,
        readingLevel: blogOptions.readingLevel,
        includeImages: blogOptions.includeImages,
      });
      
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: 'Blog articles generated successfully',
        description: `Created ${data.blogs ? data.blogs.length : 0} blog articles based on the selected study.`,
      });
      
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: ['/api/blogs'] });
      queryClient.invalidateQueries({ queryKey: ['/api/studies', selectedStudyId, 'blogs'] });
      
      // Navigate to blog management
      navigate('/admin/blogs');
    },
    onError: (error: any) => {
      toast({
        title: 'Failed to generate blog articles',
        description: error.message || 'An error occurred. Please try again.',
        variant: 'destructive',
      });
    }
  });
  
  // Handle study selection
  const handleSelectStudy = (study: Study) => {
    setSelectedStudyId(study.id);
  };
  
  // Handle search
  const handleSearch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    // The actual search is triggered by the useQuery with searchQuery dependency
  };
  
  // Handle generate blogs
  const handleGenerateBlogs = () => {
    generateMutation.mutate();
  };
  
  return (
    <AdminLayout title="Generate Blog Articles" description="Create AI-generated blog content from research studies">
      <Helmet>
        <title>Generate Blog Articles | HydrogenStudies Admin</title>
      </Helmet>
      
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold tracking-tight">Generate Blog Articles</h1>
          <Button variant="outline" onClick={() => navigate('/admin/blogs')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Blogs
          </Button>
        </div>
        
        <Tabs defaultValue="search" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="search">Search for a Study</TabsTrigger>
            <TabsTrigger value="recent">Recent Studies</TabsTrigger>
          </TabsList>
          
          {/* Search tab */}
          <TabsContent value="search" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Search for a Research Study</CardTitle>
                <CardDescription>
                  Find a study to generate blog articles from
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSearch} className="space-y-4">
                  <div className="flex space-x-2">
                    <Input
                      placeholder="Search by title, author, or keywords..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="flex-1"
                    />
                    <Button type="submit" disabled={!searchQuery.trim() || searchLoading}>
                      {searchLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Search className="h-4 w-4" />
                      )}
                      <span className="ml-2">Search</span>
                    </Button>
                  </div>
                </form>
                
                {searchQuery.trim() && searchResults && (
                  <div className="mt-6 space-y-4">
                    <h3 className="text-sm font-medium">Search Results</h3>
                    
                    {searchResults.length === 0 ? (
                      <div className="rounded-lg border border-dashed p-6 text-center">
                        <AlertCircle className="mx-auto h-8 w-8 text-muted-foreground" />
                        <p className="mt-2 text-sm text-muted-foreground">No studies found matching your search terms.</p>
                      </div>
                    ) : (
                      <div className="rounded-md border divide-y">
                        {searchResults.map((study: Study) => (
                          <div key={study.id} className="p-4 hover:bg-muted/50">
                            <div className="flex items-start justify-between">
                              <div className="space-y-1">
                                <h4 className="font-medium">{study.title}</h4>
                                <p className="text-sm text-muted-foreground">
                                  {study.authors && study.authors.split(',')[0]} et al. • {study.journal} • {new Date(study.publishDate).getFullYear()}
                                </p>
                              </div>
                              <Button 
                                variant="outline" 
                                size="sm" 
                                onClick={() => handleSelectStudy(study)}
                              >
                                Select
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          
          {/* Recent tab */}
          <TabsContent value="recent" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Recent Studies</CardTitle>
                <CardDescription>
                  Select from recently added research studies
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loadingStudies ? (
                  <div className="flex justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : !recentStudies || recentStudies.length === 0 ? (
                  <div className="rounded-lg border border-dashed p-6 text-center">
                    <AlertCircle className="mx-auto h-8 w-8 text-muted-foreground" />
                    <p className="mt-2 text-sm text-muted-foreground">No studies found in the database.</p>
                  </div>
                ) : (
                  <div className="rounded-md border divide-y">
                    {recentStudies.map((study: Study) => (
                      <div key={study.id} className="p-4 hover:bg-muted/50">
                        <div className="flex items-start justify-between">
                          <div className="space-y-1">
                            <h4 className="font-medium">{study.title}</h4>
                            <p className="text-sm text-muted-foreground">
                              {study.authors && study.authors.split(',')[0]} et al. • {study.journal} • {new Date(study.publishDate).getFullYear()}
                            </p>
                          </div>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => handleSelectStudy(study)}
                          >
                            Select
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
        
        {/* Selected study card */}
        {selectedStudyId && (
          <Card>
            <CardHeader>
              <CardTitle>Selected Study</CardTitle>
              <CardDescription>
                The following study will be used to generate blog articles
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingSelectedStudy ? (
                <div className="flex justify-center py-6">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : selectedStudy ? (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-medium">{selectedStudy.title}</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      {selectedStudy.authors} • {selectedStudy.journal} • {new Date(selectedStudy.publishDate).getFullYear()}
                    </p>
                  </div>
                  
                  <div>
                    <h4 className="text-sm font-medium mb-2">Abstract</h4>
                    <p className="text-sm text-muted-foreground">{selectedStudy.abstract}</p>
                  </div>
                  
                  <div className="flex space-x-4">
                    <div>
                      <span className="text-xs font-medium">Category:</span>
                      <span className="text-xs ml-1">{selectedStudy.category}</span>
                    </div>
                    
                    {selectedStudy.peerReviewed && (
                      <div>
                        <span className="text-xs font-medium">Peer-reviewed</span>
                      </div>
                    )}
                    
                    {selectedStudy.methods && (
                      <div>
                        <span className="text-xs font-medium">Methods:</span>
                        <span className="text-xs ml-1">{selectedStudy.methods}</span>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Error</AlertTitle>
                  <AlertDescription>
                    Could not load study details. Please try selecting another study.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        )}
        
        {/* Blog generation options */}
        {selectedStudyId && (
          <Card>
            <CardHeader>
              <CardTitle>Blog Generation Options</CardTitle>
              <CardDescription>
                Customize the blog articles to be generated
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="space-y-4">
                  <h3 className="text-sm font-medium">Article Types</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <Checkbox 
                          id="includeExplainer" 
                          checked={blogOptions.includeExplainer}
                          onCheckedChange={(checked) => 
                            setBlogOptions({...blogOptions, includeExplainer: !!checked})
                          }
                        />
                        <Label htmlFor="includeExplainer">Include explainer article</Label>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <Checkbox 
                          id="includeImplications" 
                          checked={blogOptions.includeImplications}
                          onCheckedChange={(checked) => 
                            setBlogOptions({...blogOptions, includeImplications: !!checked})
                          }
                        />
                        <Label htmlFor="includeImplications">Include health implications article</Label>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <Checkbox 
                          id="includeHistorical" 
                          checked={blogOptions.includeHistorical}
                          onCheckedChange={(checked) => 
                            setBlogOptions({...blogOptions, includeHistorical: !!checked})
                          }
                        />
                        <Label htmlFor="includeHistorical">Include historical context article</Label>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <Checkbox 
                          id="includeElonStyle" 
                          checked={blogOptions.includeElonStyle}
                          onCheckedChange={(checked) => 
                            setBlogOptions({...blogOptions, includeElonStyle: !!checked})
                          }
                        />
                        <Label htmlFor="includeElonStyle">Include Elon Musk style article</Label>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <Checkbox 
                          id="includeImages" 
                          checked={blogOptions.includeImages}
                          onCheckedChange={(checked) => 
                            setBlogOptions({...blogOptions, includeImages: !!checked})
                          }
                        />
                        <Label htmlFor="includeImages">Auto-generate images for articles</Label>
                      </div>
                    </div>
                  </div>
                </div>
                
                <Separator />
                
                <div className="space-y-4">
                  <h3 className="text-sm font-medium">Article Counts</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <Label htmlFor="standardCount">Standard Articles: {blogOptions.standardCount}</Label>
                      <Slider
                        id="standardCount"
                        min={1}
                        max={5}
                        step={1}
                        value={[blogOptions.standardCount]}
                        onValueChange={([val]) => setBlogOptions({...blogOptions, standardCount: val})}
                      />
                    </div>
                    
                    {blogOptions.includeElonStyle && (
                      <div className="space-y-4">
                        <Label htmlFor="elonCount">Elon Musk Style Articles: {blogOptions.elonCount}</Label>
                        <Slider
                          id="elonCount"
                          min={0}
                          max={3}
                          step={1}
                          value={[blogOptions.elonCount]}
                          onValueChange={([val]) => setBlogOptions({...blogOptions, elonCount: val})}
                        />
                      </div>
                    )}
                  </div>
                </div>
                
                <Separator />
                
                <div className="space-y-4">
                  <h3 className="text-sm font-medium">Reading Level</h3>
                  
                  <Select 
                    value={blogOptions.readingLevel}
                    onValueChange={(value) => setBlogOptions({...blogOptions, readingLevel: value})}
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
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex justify-between">
              <Button variant="outline" onClick={() => setSelectedStudyId(null)}>
                Select Different Study
              </Button>
              <Button 
                onClick={handleGenerateBlogs}
                disabled={generateMutation.isPending}
              >
                {generateMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <FileText className="mr-2 h-4 w-4" />
                    Generate Blog Articles
                  </>
                )}
              </Button>
            </CardFooter>
          </Card>
        )}
      </div>
    </AdminLayout>
  );
}