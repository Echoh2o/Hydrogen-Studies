import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRoute, Link } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { 
  ExternalLink, BookOpen, Users, Calendar, Eye, Share2, 
  Heart, Bookmark, Download, ChevronRight, Sparkles,
  TrendingUp, Clock, Star
} from "lucide-react";

interface StudyDetails {
  id: number;
  title: string;
  abstract: string;
  authors: string;
  journal: string;
  publishDate: string;
  doi?: string;
  category: string;
  methods?: string;
  results?: string;
  conclusion?: string;
  keywords?: string[];
  imageUrl?: string;
  imageCaptions?: string[];
  viewCount: number;
  tags: Array<{
    id: number;
    name: string;
    category: string;
    confidence: number;
    source: string;
  }>;
  relatedStudies: Array<{
    id: number;
    title: string;
    relevanceScore: number;
    sharedTags: number;
  }>;
  citationInfo: {
    apa: string;
    mla: string;
    chicago: string;
  };
}

interface StudyRecommendations {
  similarStudies: Array<{
    id: number;
    title: string;
    authors: string;
    relevanceScore: number;
    reason: string;
  }>;
  relatedTopics: string[];
  trendingInCategory: Array<{
    id: number;
    title: string;
    viewCount: number;
  }>;
}

export default function EnhancedStudyPage() {
  const [match, params] = useRoute("/study/:id");
  const [activeTab, setActiveTab] = useState("overview");
  const queryClient = useQueryClient();
  
  const studyId = params?.id ? parseInt(params.id) : null;

  // Get study details with enhanced content
  const { data: study, isLoading: studyLoading, error } = useQuery<StudyDetails>({
    queryKey: ["/api/studies", studyId, "detailed"],
    enabled: !!studyId,
  });

  // Get personalized recommendations based on this study
  const { data: recommendations } = useQuery<StudyRecommendations>({
    queryKey: ["/api/studies", studyId, "recommendations"],
    enabled: !!studyId,
  });

  // Track study view for analytics
  const recordView = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/studies/${studyId}/view`, { method: "POST" });
      if (!response.ok) throw new Error("Failed to record view");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/studies", studyId] });
    },
  });

  // Record view when component mounts
  useEffect(() => {
    if (studyId && !studyLoading && study) {
      recordView.mutate();
    }
  }, [studyId, studyLoading, study]);

  const getCategoryColor = (category: string) => {
    switch (category) {
      case "health_condition": return "bg-red-100 text-red-800";
      case "study_type": return "bg-blue-100 text-blue-800";
      case "body_system": return "bg-green-100 text-green-800";
      case "mechanism": return "bg-purple-100 text-purple-800";
      case "delivery_method": return "bg-orange-100 text-orange-800";
      case "outcome": return "bg-emerald-100 text-emerald-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return "text-green-600";
    if (confidence >= 0.6) return "text-yellow-600";
    return "text-gray-600";
  };

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card>
          <CardContent className="p-12 text-center">
            <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">Study not found</h3>
            <p className="text-muted-foreground mb-4">
              The study you're looking for doesn't exist or has been removed.
            </p>
            <Button asChild>
              <Link href="/studies">Browse Studies</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (studyLoading || !study) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <div className="h-8 bg-gray-200 rounded animate-pulse" />
              <div className="h-4 bg-gray-200 rounded animate-pulse w-1/2" />
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="h-4 bg-gray-200 rounded animate-pulse" />
                <div className="h-4 bg-gray-200 rounded animate-pulse" />
                <div className="h-4 bg-gray-200 rounded animate-pulse w-3/4" />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Study Header */}
      <div className="mb-8">
        <div className="flex items-center space-x-2 text-sm text-muted-foreground mb-4">
          <Link href="/studies" className="hover:text-primary">Studies</Link>
          <ChevronRight className="h-4 w-4" />
          <span>Study Details</span>
        </div>
        
        <div className="space-y-4">
          <h1 className="text-3xl font-bold leading-tight">{study.title}</h1>
          
          <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
            <div className="flex items-center space-x-1">
              <Users className="h-4 w-4" />
              <span>{study.authors}</span>
            </div>
            <div className="flex items-center space-x-1">
              <BookOpen className="h-4 w-4" />
              <span>{study.journal}</span>
            </div>
            <div className="flex items-center space-x-1">
              <Calendar className="h-4 w-4" />
              <span>{study.publishDate}</span>
            </div>
            <div className="flex items-center space-x-1">
              <Eye className="h-4 w-4" />
              <span>{study.viewCount} views</span>
            </div>
          </div>

          {/* Study Tags */}
          <div className="flex flex-wrap gap-2">
            {study.tags && study.tags.length > 0 ? study.tags.map((tag) => (
              <Badge 
                key={tag.id}
                variant="outline"
                className={`text-xs ${getCategoryColor(tag.category)}`}
                title={`Confidence: ${Math.round(tag.confidence * 100)}% | Source: ${tag.source}`}
              >
                {tag.name}
                <span className={`ml-1 ${getConfidenceColor(tag.confidence)}`}>
                  {Math.round(tag.confidence * 100)}%
                </span>
              </Badge>
            )) : (
              <span className="text-sm text-muted-foreground">No tags available</span>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center space-x-3">
            {study.doi && (
              <Button variant="outline" size="sm" asChild>
                <a href={`https://doi.org/${study.doi}`} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  View Original
                </a>
              </Button>
            )}
            <Button variant="outline" size="sm">
              <Bookmark className="h-4 w-4 mr-2" />
              Save Study
            </Button>
            <Button variant="outline" size="sm">
              <Share2 className="h-4 w-4 mr-2" />
              Share
            </Button>
            <Button variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" />
              Export Citation
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Content */}
        <div className="lg:col-span-2">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="methods">Methods</TabsTrigger>
              <TabsTrigger value="results">Results</TabsTrigger>
              <TabsTrigger value="citations">Citations</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Abstract</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm leading-relaxed">{study.abstract}</p>
                </CardContent>
              </Card>

              {study.conclusion && (
                <Card>
                  <CardHeader>
                    <CardTitle>Key Conclusions</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm leading-relaxed">{study.conclusion}</p>
                  </CardContent>
                </Card>
              )}

              {study.keywords && study.keywords.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Keywords</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {study.keywords.map((keyword, index) => (
                        <Badge key={index} variant="secondary">
                          {keyword}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="methods" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Research Methods</CardTitle>
                  <CardDescription>Study design and methodology</CardDescription>
                </CardHeader>
                <CardContent>
                  {study.methods ? (
                    <p className="text-sm leading-relaxed">{study.methods}</p>
                  ) : (
                    <p className="text-sm text-muted-foreground italic">
                      Detailed methodology information available in the original publication.
                    </p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="results" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Study Results</CardTitle>
                  <CardDescription>Key findings and outcomes</CardDescription>
                </CardHeader>
                <CardContent>
                  {study.results ? (
                    <p className="text-sm leading-relaxed">{study.results}</p>
                  ) : (
                    <p className="text-sm text-muted-foreground italic">
                      Detailed results and statistical analysis available in the original publication.
                    </p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="citations" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Citation Formats</CardTitle>
                  <CardDescription>Ready-to-use citations for your research</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <h4 className="font-medium mb-2">APA Style</h4>
                    <div className="bg-gray-50 p-3 rounded text-sm font-mono">
                      {study.citationInfo?.apa || `${study.authors} (${new Date(study.publishDate).getFullYear()}). ${study.title}. ${study.journal}.`}
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="font-medium mb-2">MLA Style</h4>
                    <div className="bg-gray-50 p-3 rounded text-sm font-mono">
                      {study.citationInfo?.mla || `${study.authors}. "${study.title}." ${study.journal}, ${new Date(study.publishDate).getFullYear()}.`}
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="font-medium mb-2">Chicago Style</h4>
                    <div className="bg-gray-50 p-3 rounded text-sm font-mono">
                      {study.citationInfo?.chicago || `${study.authors}. "${study.title}." ${study.journal} (${new Date(study.publishDate).getFullYear()}).`}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Study Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Sparkles className="h-5 w-5" />
                <span>Study Insights</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Research Quality</span>
                  <span className="font-medium">High</span>
                </div>
                <Progress value={85} className="h-2" />
              </div>
              
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Tag Confidence</span>
                  <span className="font-medium">
                    {study.tags && study.tags.length > 0 
                      ? Math.round((study.tags.reduce((sum, tag) => sum + tag.confidence, 0) / study.tags.length) * 100)
                      : 0}%
                  </span>
                </div>
                <Progress 
                  value={study.tags && study.tags.length > 0 
                    ? (study.tags.reduce((sum, tag) => sum + tag.confidence, 0) / study.tags.length) * 100
                    : 0} 
                  className="h-2" 
                />
              </div>

              <Separator />

              <div className="text-sm">
                <div className="font-medium mb-1">Category</div>
                <Badge variant="outline" className={getCategoryColor(study.category)}>
                  {study.category ? study.category.replace(/_/g, ' ') : 'Uncategorized'}
                </Badge>
              </div>

              {study.doi && (
                <div className="text-sm">
                  <div className="font-medium mb-1">DOI</div>
                  <div className="font-mono text-xs bg-gray-50 p-2 rounded">
                    {study.doi}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Related Studies */}
          {recommendations?.similarStudies && recommendations.similarStudies.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <TrendingUp className="h-5 w-5" />
                  <span>Related Studies</span>
                </CardTitle>
                <CardDescription>
                  Studies with similar topics and tags
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {recommendations.similarStudies.slice(0, 5).map((relatedStudy) => (
                    <div key={relatedStudy.id} className="space-y-1">
                      <Link 
                        href={`/study/${relatedStudy.id}`}
                        className="text-sm font-medium hover:text-primary line-clamp-2"
                      >
                        {relatedStudy.title}
                      </Link>
                      <div className="text-xs text-muted-foreground">
                        {relatedStudy.authors}
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">{relatedStudy.reason}</span>
                        <Badge variant="outline" className="text-xs">
                          {Math.round(relatedStudy.relevanceScore * 100)}% match
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Trending in Category */}
          {recommendations?.trendingInCategory && recommendations.trendingInCategory.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Clock className="h-5 w-5" />
                  <span>Trending Research</span>
                </CardTitle>
                <CardDescription>
                  Popular studies in this category
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {recommendations.trendingInCategory.slice(0, 3).map((trending) => (
                    <div key={trending.id} className="space-y-1">
                      <Link 
                        href={`/study/${trending.id}`}
                        className="text-sm font-medium hover:text-primary line-clamp-2"
                      >
                        {trending.title}
                      </Link>
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>{trending.viewCount} views</span>
                        <Star className="h-3 w-3" />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}