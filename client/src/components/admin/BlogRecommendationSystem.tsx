import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { 
  Brain, 
  FileText, 
  Clock, 
  TrendingUp, 
  Users, 
  Tag, 
  CheckCircle2, 
  AlertCircle, 
  Loader2,
  Sparkles,
  Download,
  Eye
} from 'lucide-react';

interface BlogRecommendation {
  studyId: number;
  studyTitle: string;
  studyAbstract: string;
  studyAuthors: string;
  studyJournal: string;
  studyCategory: string;
  studyPublishDate: string;
  priority: 'high' | 'medium' | 'low';
  reasonForRecommendation: string;
  suggestedBlogTypes: string[];
  estimatedReadership: string;
  seoKeywords: string[];
  potentialTitle: string;
  hasExistingBlogs: boolean;
  existingBlogCount: number;
}

interface GenerationOptions {
  articleTypes: string[];
  readingLevel: string;
  includeImages: boolean;
  includeSEO: boolean;
  saveToDatabase: boolean;
}

interface GenerationProgress {
  isGenerating: boolean;
  currentStudy: string;
  progress: number;
  totalStudies: number;
  completedStudies: number;
  generatedBlogs: number;
  errors: string[];
}

const ARTICLE_TYPES = [
  { value: 'explainer', label: 'Explainer Article', description: 'Comprehensive breakdown of the research' },
  { value: 'summary', label: 'Research Summary', description: 'Concise overview of key findings' },
  { value: 'implications', label: 'Health Implications', description: 'Real-world applications and benefits' },
  { value: 'benefits', label: 'Benefits Guide', description: 'Focus on potential health advantages' },
  { value: 'how-to', label: 'Practical Guide', description: 'How to apply research insights' }
];

const READING_LEVELS = [
  { value: '6th', label: '6th Grade (Ages 11-12)', description: 'Simple language, short sentences' },
  { value: 'high-school', label: 'High School (Ages 14-18)', description: 'Moderate complexity' },
  { value: 'general', label: 'General Adult', description: 'Accessible but comprehensive' }
];

export function BlogRecommendationSystem() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [selectedStudies, setSelectedStudies] = useState<Set<number>>(new Set());
  const [generationOptions, setGenerationOptions] = useState<GenerationOptions>({
    articleTypes: ['explainer', 'summary'],
    readingLevel: 'general',
    includeImages: true,
    includeSEO: true,
    saveToDatabase: false
  });
  const [generationProgress, setGenerationProgress] = useState<GenerationProgress>({
    isGenerating: false,
    currentStudy: '',
    progress: 0,
    totalStudies: 0,
    completedStudies: 0,
    generatedBlogs: 0,
    errors: []
  });

  // Fetch blog recommendations
  const { data: recommendationsResponse, isLoading: isLoadingRecommendations, refetch } = useQuery({
    queryKey: ['/api/blog-recommendations/recommendations'],
    staleTime: 300000, // 5 minutes
  });
  
  const recommendations: BlogRecommendation[] = recommendationsResponse?.data || [];

  // Preview generation mutation
  const previewMutation = useMutation({
    mutationFn: async () => {
      const selectedStudyIds = Array.from(selectedStudies);
      return apiRequest('POST', '/api/blog-recommendations/preview', {
        selectedStudyIds,
        articleTypes: generationOptions.articleTypes
      });
    },
    onSuccess: (data) => {
      toast({
        title: 'Generation Preview',
        description: `Will generate ${data.totalBlogsToGenerate} blogs for ${data.selectedStudiesCount} studies. Estimated time: ${data.estimatedTimeDisplay}`,
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Preview Failed',
        description: error.message || 'Failed to create generation preview',
        variant: 'destructive',
      });
    }
  });

  // Bulk generation mutation
  const generateMutation = useMutation({
    mutationFn: async () => {
      const selectedStudyIds = Array.from(selectedStudies);
      
      setGenerationProgress({
        isGenerating: true,
        currentStudy: 'Initializing...',
        progress: 0,
        totalStudies: selectedStudyIds.length,
        completedStudies: 0,
        generatedBlogs: 0,
        errors: []
      });

      const response = await apiRequest('POST', '/api/blog-recommendations/bulk-generate', {
        selectedStudyIds,
        ...generationOptions
      });

      return response.json();
    },
    onSuccess: (data) => {
      setGenerationProgress(prev => ({
        ...prev,
        isGenerating: false,
        progress: 100,
        completedStudies: data.summary.successfulStudies,
        generatedBlogs: data.summary.totalBlogs
      }));

      toast({
        title: 'Generation Complete',
        description: `Generated ${data.summary.totalBlogs} blog articles for ${data.summary.successfulStudies} studies.`,
      });

      // Clear selections and refresh data
      setSelectedStudies(new Set());
      queryClient.invalidateQueries({ queryKey: ['/api/blogs'] });
      refetch();
    },
    onError: (error: any) => {
      setGenerationProgress(prev => ({
        ...prev,
        isGenerating: false
      }));
      
      toast({
        title: 'Generation Failed',
        description: error.message || 'Failed to generate blog articles',
        variant: 'destructive',
      });
    }
  });

  const toggleStudySelection = (studyId: number) => {
    setSelectedStudies(prev => {
      const newSet = new Set(prev);
      if (newSet.has(studyId)) {
        newSet.delete(studyId);
      } else {
        newSet.add(studyId);
      }
      return newSet;
    });
  };

  const selectAllStudies = () => {
    setSelectedStudies(new Set(recommendations.map((r) => r.studyId)));
  };

  const clearAllSelections = () => {
    setSelectedStudies(new Set());
  };

  const selectByPriority = (priority: 'high' | 'medium' | 'low') => {
    const studyIds = recommendations
      .filter((r) => r.priority === priority)
      .map((r) => r.studyId);
    setSelectedStudies(new Set(studyIds));
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-800 border-red-200';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low': return 'bg-green-100 text-green-800 border-green-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  if (isLoadingRecommendations) {
    return (
      <Card>
        <CardContent className="p-8">
          <div className="flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin mr-3" />
            <span>Loading blog recommendations...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Brain className="h-6 w-6" />
            AI Blog Recommendations
          </h2>
          <p className="text-muted-foreground">
            AI-powered recommendations for high-impact blog articles
          </p>
        </div>
        <Button onClick={() => refetch()} variant="outline">
          Refresh Recommendations
        </Button>
      </div>

      <Tabs defaultValue="recommendations" className="space-y-4">
        <TabsList>
          <TabsTrigger value="recommendations">Recommendations</TabsTrigger>
          <TabsTrigger value="generation">Bulk Generation</TabsTrigger>
          {generationProgress.isGenerating && (
            <TabsTrigger value="progress">Generation Progress</TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="recommendations" className="space-y-4">
          {/* Selection Controls */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Study Selection</CardTitle>
              <CardDescription>
                Choose studies for blog article generation
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                <Button onClick={selectAllStudies} variant="outline" size="sm">
                  Select All ({recommendations.length})
                </Button>
                <Button onClick={clearAllSelections} variant="outline" size="sm">
                  Clear All
                </Button>
                <Button onClick={() => selectByPriority('high')} variant="outline" size="sm">
                  High Priority ({recommendations.filter((r) => r.priority === 'high').length})
                </Button>
                <Button onClick={() => selectByPriority('medium')} variant="outline" size="sm">
                  Medium Priority ({recommendations.filter((r) => r.priority === 'medium').length})
                </Button>
                <Button onClick={() => selectByPriority('low')} variant="outline" size="sm">
                  Low Priority ({recommendations.filter((r) => r.priority === 'low').length})
                </Button>
              </div>
              {selectedStudies.size > 0 && (
                <div className="mt-4 p-3 bg-primary/5 rounded-lg">
                  <p className="text-sm font-medium">
                    {selectedStudies.size} studies selected for generation
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recommendations List */}
          <ScrollArea className="h-[600px]">
            <div className="space-y-4">
              {recommendations.map((recommendation) => (
                <Card key={recommendation.studyId} className={`transition-all ${
                  selectedStudies.has(recommendation.studyId) 
                    ? 'ring-2 ring-primary shadow-md' 
                    : 'hover:shadow-sm'
                }`}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start gap-3">
                      <Checkbox 
                        checked={selectedStudies.has(recommendation.studyId)}
                        onCheckedChange={() => toggleStudySelection(recommendation.studyId)}
                        className="mt-1"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge className={getPriorityColor(recommendation.priority)}>
                            {recommendation.priority.toUpperCase()}
                          </Badge>
                          <Badge variant="outline">
                            {recommendation.estimatedReadership} Interest
                          </Badge>
                          {recommendation.hasExistingBlogs && (
                            <Badge variant="secondary">
                              {recommendation.existingBlogCount} existing
                            </Badge>
                          )}
                        </div>
                        <h3 className="font-semibold text-lg leading-tight mb-2">
                          {recommendation.potentialTitle}
                        </h3>
                        <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                          {recommendation.studyTitle}
                        </p>
                        <p className="text-sm mb-3">
                          {recommendation.reasonForRecommendation}
                        </p>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                      <div>
                        <Label className="text-xs font-medium text-muted-foreground">SUGGESTED TYPES</Label>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {recommendation.suggestedBlogTypes.map(type => (
                            <Badge key={type} variant="outline" className="text-xs">
                              {type}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      <div>
                        <Label className="text-xs font-medium text-muted-foreground">SEO KEYWORDS</Label>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {recommendation.seoKeywords.slice(0, 4).map(keyword => (
                            <Badge key={keyword} variant="secondary" className="text-xs">
                              {keyword}
                            </Badge>
                          ))}
                          {recommendation.seoKeywords.length > 4 && (
                            <Badge variant="secondary" className="text-xs">
                              +{recommendation.seoKeywords.length - 4} more
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    <Separator className="my-3" />
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{recommendation.studyAuthors}</span>
                      <span>{recommendation.studyJournal} • {recommendation.studyPublishDate}</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="generation" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Generation Options</CardTitle>
              <CardDescription>
                Configure how blog articles will be generated
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Article Types */}
              <div>
                <Label className="text-base font-medium">Article Types</Label>
                <p className="text-sm text-muted-foreground mb-3">
                  Select which types of articles to generate for each study
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {ARTICLE_TYPES.map(type => (
                    <div key={type.value} className="flex items-start space-x-3">
                      <Checkbox 
                        checked={generationOptions.articleTypes.includes(type.value)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setGenerationOptions(prev => ({
                              ...prev,
                              articleTypes: [...prev.articleTypes, type.value]
                            }));
                          } else {
                            setGenerationOptions(prev => ({
                              ...prev,
                              articleTypes: prev.articleTypes.filter(t => t !== type.value)
                            }));
                          }
                        }}
                      />
                      <div className="space-y-1">
                        <p className="text-sm font-medium">{type.label}</p>
                        <p className="text-xs text-muted-foreground">{type.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <Separator />

              {/* Reading Level */}
              <div>
                <Label className="text-base font-medium">Reading Level</Label>
                <p className="text-sm text-muted-foreground mb-3">
                  Target audience complexity level
                </p>
                <Select 
                  value={generationOptions.readingLevel} 
                  onValueChange={(value) => 
                    setGenerationOptions(prev => ({ ...prev, readingLevel: value }))
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select reading level" />
                  </SelectTrigger>
                  <SelectContent>
                    {READING_LEVELS.map(level => (
                      <SelectItem key={level.value} value={level.value}>
                        <div>
                          <div className="font-medium">{level.label}</div>
                          <div className="text-xs text-muted-foreground">{level.description}</div>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Separator />

              {/* Additional Options */}
              <div className="space-y-3">
                <Label className="text-base font-medium">Additional Features</Label>
                
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    checked={generationOptions.includeImages}
                    onCheckedChange={(checked) => 
                      setGenerationOptions(prev => ({ ...prev, includeImages: !!checked }))
                    }
                  />
                  <div>
                    <p className="text-sm font-medium">Generate Images</p>
                    <p className="text-xs text-muted-foreground">Create AI-generated images for each article</p>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox 
                    checked={generationOptions.includeSEO}
                    onCheckedChange={(checked) => 
                      setGenerationOptions(prev => ({ ...prev, includeSEO: !!checked }))
                    }
                  />
                  <div>
                    <p className="text-sm font-medium">SEO Optimization</p>
                    <p className="text-xs text-muted-foreground">Generate meta descriptions, keywords, and tags</p>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox 
                    checked={generationOptions.saveToDatabase}
                    onCheckedChange={(checked) => 
                      setGenerationOptions(prev => ({ ...prev, saveToDatabase: !!checked }))
                    }
                  />
                  <div>
                    <p className="text-sm font-medium">Save to Database</p>
                    <p className="text-xs text-muted-foreground">Automatically save generated articles as drafts</p>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Action Buttons */}
              <div className="flex gap-3">
                <Button 
                  onClick={() => previewMutation.mutate()}
                  disabled={selectedStudies.size === 0 || generationOptions.articleTypes.length === 0}
                  variant="outline"
                >
                  <Eye className="h-4 w-4 mr-2" />
                  Preview Generation
                </Button>
                <Button 
                  onClick={() => generateMutation.mutate()}
                  disabled={selectedStudies.size === 0 || generationOptions.articleTypes.length === 0 || generateMutation.isPending}
                >
                  {generateMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4 mr-2" />
                  )}
                  Generate Blog Articles
                </Button>
              </div>

              {selectedStudies.size > 0 && generationOptions.articleTypes.length > 0 && (
                <div className="p-4 bg-primary/5 rounded-lg">
                  <p className="text-sm font-medium">
                    Will generate {selectedStudies.size * generationOptions.articleTypes.length} total articles
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {selectedStudies.size} studies × {generationOptions.articleTypes.length} article types
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {generationProgress.isGenerating && (
          <TabsContent value="progress" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Generation Progress</CardTitle>
                <CardDescription>
                  Generating blog articles for selected studies
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span>Overall Progress</span>
                    <span>{generationProgress.completedStudies} / {generationProgress.totalStudies} studies</span>
                  </div>
                  <Progress value={generationProgress.progress} className="w-full" />
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <Label>Current Study</Label>
                    <p className="text-muted-foreground">{generationProgress.currentStudy}</p>
                  </div>
                  <div>
                    <Label>Generated Articles</Label>
                    <p className="text-muted-foreground">{generationProgress.generatedBlogs}</p>
                  </div>
                </div>

                {generationProgress.errors.length > 0 && (
                  <div>
                    <Label className="text-destructive">Errors</Label>
                    <ScrollArea className="h-20">
                      <div className="space-y-1">
                        {generationProgress.errors.map((error, index) => (
                          <p key={index} className="text-xs text-destructive">{error}</p>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}