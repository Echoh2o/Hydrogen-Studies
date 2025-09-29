/**
 * Admin Dashboard for Multi-Format Content Generation
 */

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { 
  FileText, 
  Mic, 
  BarChart3, 
  Share2, 
  Video, 
  Mail, 
  Download,
  Eye,
  Edit,
  Trash,
  RefreshCw,
  Calendar,
  CheckCircle,
  XCircle,
  AlertCircle,
  Zap,
  Twitter,
  Linkedin,
  Instagram,
  Facebook,
  Hash
} from "lucide-react";

// Content format types
const ContentFormats = {
  PODCAST: 'podcast',
  INFOGRAPHIC: 'infographic',
  SOCIAL_TWITTER: 'social_twitter',
  SOCIAL_LINKEDIN: 'social_linkedin',
  SOCIAL_INSTAGRAM: 'social_instagram',
  SOCIAL_FACEBOOK: 'social_facebook',
  SOCIAL_TIKTOK: 'social_tiktok',
  VIDEO_YOUTUBE: 'video_youtube',
  VIDEO_SHORT: 'video_short',
  NEWSLETTER: 'newsletter'
};

// Format icons mapping
const formatIcons = {
  [ContentFormats.PODCAST]: <Mic className="h-4 w-4" />,
  [ContentFormats.INFOGRAPHIC]: <BarChart3 className="h-4 w-4" />,
  [ContentFormats.SOCIAL_TWITTER]: <Twitter className="h-4 w-4" />,
  [ContentFormats.SOCIAL_LINKEDIN]: <Linkedin className="h-4 w-4" />,
  [ContentFormats.SOCIAL_INSTAGRAM]: <Instagram className="h-4 w-4" />,
  [ContentFormats.SOCIAL_FACEBOOK]: <Facebook className="h-4 w-4" />,
  [ContentFormats.SOCIAL_TIKTOK]: <Hash className="h-4 w-4" />,
  [ContentFormats.VIDEO_YOUTUBE]: <Video className="h-4 w-4" />,
  [ContentFormats.VIDEO_SHORT]: <Video className="h-4 w-4" />,
  [ContentFormats.NEWSLETTER]: <Mail className="h-4 w-4" />
};

// Format display names
const formatNames = {
  [ContentFormats.PODCAST]: 'Podcast Script',
  [ContentFormats.INFOGRAPHIC]: 'Infographic Data',
  [ContentFormats.SOCIAL_TWITTER]: 'Twitter/X Thread',
  [ContentFormats.SOCIAL_LINKEDIN]: 'LinkedIn Post',
  [ContentFormats.SOCIAL_INSTAGRAM]: 'Instagram Post',
  [ContentFormats.SOCIAL_FACEBOOK]: 'Facebook Post',
  [ContentFormats.SOCIAL_TIKTOK]: 'TikTok Caption',
  [ContentFormats.VIDEO_YOUTUBE]: 'YouTube Script',
  [ContentFormats.VIDEO_SHORT]: 'Short Video Script',
  [ContentFormats.NEWSLETTER]: 'Email Newsletter'
};

export default function MultiFormatGeneratorPage() {
  const [selectedStudy, setSelectedStudy] = useState<number | null>(null);
  const [selectedFormats, setSelectedFormats] = useState<string[]>([]);
  const [previewContent, setPreviewContent] = useState<any>(null);
  const [editingContent, setEditingContent] = useState<any>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch studies
  const { data: studiesData, isLoading: studiesLoading } = useQuery({
    queryKey: ['/api/studies'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/studies?limit=100');
      return response.json();
    }
  });

  // Fetch generated content for selected study
  const { data: generatedContent, refetch: refetchContent } = useQuery({
    queryKey: ['/api/multi-format/study', selectedStudy],
    enabled: !!selectedStudy,
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/multi-format/study/${selectedStudy}`);
      return response.json();
    }
  });

  // Fetch statistics
  const { data: statsData } = useQuery({
    queryKey: ['/api/multi-format/stats'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/multi-format/stats');
      return response.json();
    }
  });

  // Generate content mutation
  const generateContent = useMutation({
    mutationFn: async ({ studyId, formats }: { studyId: number; formats: string[] }) => {
      const response = await apiRequest('POST', '/api/multi-format/generate', {
        studyId,
        formats,
        options: { fallbackToBasic: true }
      });
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Content Generated!",
        description: `Successfully generated ${data.data.generated.length} format(s)`,
      });
      refetchContent();
      queryClient.invalidateQueries({ queryKey: ['/api/multi-format/stats'] });
    },
    onError: (error) => {
      toast({
        title: "Generation Failed",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Batch generate all formats
  const batchGenerate = useMutation({
    mutationFn: async (studyId: number) => {
      const response = await apiRequest('POST', '/api/multi-format/batch-generate', { studyId });
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Batch Generation Complete!",
        description: `Generated ${data.data.generated} formats`,
      });
      refetchContent();
      queryClient.invalidateQueries({ queryKey: ['/api/multi-format/stats'] });
    },
    onError: (error) => {
      toast({
        title: "Batch Generation Failed",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Update content mutation
  const updateContent = useMutation({
    mutationFn: async ({ id, updates }: { id: number; updates: any }) => {
      const response = await apiRequest('PUT', `/api/multi-format/${id}`, updates);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Content Updated",
        description: "Changes saved successfully",
      });
      refetchContent();
      setEditingContent(null);
    },
    onError: (error) => {
      toast({
        title: "Update Failed",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Delete content mutation
  const deleteContent = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest('DELETE', `/api/multi-format/${id}`);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Content Deleted",
        description: "Content removed successfully",
      });
      refetchContent();
    },
    onError: (error) => {
      toast({
        title: "Delete Failed",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Publish/unpublish content
  const togglePublish = useMutation({
    mutationFn: async ({ id, isPublished }: { id: number; isPublished: boolean }) => {
      const response = await apiRequest('POST', `/api/multi-format/${id}/publish`, { isPublished });
      return response.json();
    },
    onSuccess: (data, variables) => {
      toast({
        title: variables.isPublished ? "Published!" : "Unpublished",
        description: data.message,
      });
      refetchContent();
    }
  });

  // Export content
  const exportContent = async (id: number, format: 'json' | 'txt' | 'html') => {
    try {
      const response = await fetch(`/api/multi-format/${id}/export?format=${format}`);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `content_${id}.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast({
        title: "Export Successful",
        description: `Content exported as ${format.toUpperCase()}`,
      });
    } catch (error) {
      toast({
        title: "Export Failed",
        description: "Failed to export content",
        variant: "destructive",
      });
    }
  };

  // Handle format selection
  const handleFormatToggle = (format: string) => {
    setSelectedFormats(prev => 
      prev.includes(format) 
        ? prev.filter(f => f !== format)
        : [...prev, format]
    );
  };

  // Handle generate button click
  const handleGenerate = () => {
    if (selectedStudy && selectedFormats.length > 0) {
      generateContent.mutate({ studyId: selectedStudy, formats: selectedFormats });
    }
  };

  // Handle batch generate
  const handleBatchGenerate = () => {
    if (selectedStudy) {
      batchGenerate.mutate(selectedStudy);
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Multi-Format Content Generator</h1>
        <p className="text-gray-600">
          Transform research studies into multiple engaging content formats
        </p>
      </div>

      {/* Statistics Cards */}
      {statsData && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Total Content</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{statsData.data.totalContent}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Published</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {statsData.data.publishedCount}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Drafts</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">
                {statsData.data.unpublishedCount}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Formats</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {Object.keys(ContentFormats).length}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main Content Area */}
      <Tabs defaultValue="generate" className="space-y-4">
        <TabsList className="grid grid-cols-3 w-[400px]">
          <TabsTrigger value="generate">Generate</TabsTrigger>
          <TabsTrigger value="manage">Manage</TabsTrigger>
          <TabsTrigger value="preview">Preview</TabsTrigger>
        </TabsList>

        {/* Generate Tab */}
        <TabsContent value="generate">
          <Card>
            <CardHeader>
              <CardTitle>Generate New Content</CardTitle>
              <CardDescription>
                Select a study and choose which formats to generate
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Study Selection */}
              <div>
                <label className="text-sm font-medium mb-2 block">Select Study</label>
                <Select value={selectedStudy?.toString()} onValueChange={(v) => setSelectedStudy(parseInt(v))}>
                  <SelectTrigger className="w-full" data-testid="select-study">
                    <SelectValue placeholder="Choose a study..." />
                  </SelectTrigger>
                  <SelectContent>
                    {studiesLoading ? (
                      <div className="p-2">Loading studies...</div>
                    ) : (
                      studiesData?.studies?.map((study: any) => (
                        <SelectItem key={study.id} value={study.id.toString()}>
                          {study.title.substring(0, 80)}...
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              {/* Format Selection */}
              <div>
                <label className="text-sm font-medium mb-2 block">Select Formats</label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {Object.entries(ContentFormats).map(([key, value]) => (
                    <div
                      key={key}
                      className={`border rounded-lg p-3 cursor-pointer transition-colors ${
                        selectedFormats.includes(value)
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                      onClick={() => handleFormatToggle(value)}
                      data-testid={`format-${value}`}
                    >
                      <div className="flex items-center space-x-2">
                        <div className={selectedFormats.includes(value) ? 'text-blue-600' : 'text-gray-500'}>
                          {formatIcons[value]}
                        </div>
                        <span className="text-sm font-medium">
                          {formatNames[value]}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex space-x-3">
                <Button
                  onClick={handleGenerate}
                  disabled={!selectedStudy || selectedFormats.length === 0 || generateContent.isPending}
                  data-testid="button-generate"
                >
                  {generateContent.isPending ? (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Zap className="mr-2 h-4 w-4" />
                      Generate Selected
                    </>
                  )}
                </Button>
                
                <Button
                  variant="outline"
                  onClick={handleBatchGenerate}
                  disabled={!selectedStudy || batchGenerate.isPending}
                  data-testid="button-batch-generate"
                >
                  {batchGenerate.isPending ? (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                      Generating All...
                    </>
                  ) : (
                    <>
                      <FileText className="mr-2 h-4 w-4" />
                      Generate All Formats
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Manage Tab */}
        <TabsContent value="manage">
          <Card>
            <CardHeader>
              <CardTitle>Manage Generated Content</CardTitle>
              <CardDescription>
                View and manage all generated content for the selected study
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!selectedStudy ? (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Please select a study from the Generate tab first
                  </AlertDescription>
                </Alert>
              ) : generatedContent?.data?.length === 0 ? (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    No content generated yet for this study
                  </AlertDescription>
                </Alert>
              ) : (
                <div className="space-y-4">
                  {generatedContent?.data?.map((content: any) => (
                    <Card key={content.id} className="border-l-4 border-l-blue-500">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center space-x-3">
                            <div className="text-blue-600">
                              {formatIcons[content.formatType]}
                            </div>
                            <div>
                              <h4 className="font-medium">{formatNames[content.formatType]}</h4>
                              <p className="text-sm text-gray-500">
                                Created: {new Date(content.createdAt).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Badge variant={content.isPublished ? "default" : "outline"}>
                              {content.isPublished ? 'Published' : 'Draft'}
                            </Badge>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setPreviewContent(content)}
                              data-testid={`preview-${content.id}`}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setEditingContent(content)}
                              data-testid={`edit-${content.id}`}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => togglePublish.mutate({
                                id: content.id,
                                isPublished: !content.isPublished
                              })}
                              data-testid={`publish-${content.id}`}
                            >
                              {content.isPublished ? (
                                <XCircle className="h-4 w-4" />
                              ) : (
                                <CheckCircle className="h-4 w-4" />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => exportContent(content.id, 'txt')}
                              data-testid={`export-${content.id}`}
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => deleteContent.mutate(content.id)}
                              className="text-red-600"
                              data-testid={`delete-${content.id}`}
                            >
                              <Trash className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Preview Tab */}
        <TabsContent value="preview">
          <Card>
            <CardHeader>
              <CardTitle>Preview Content</CardTitle>
              <CardDescription>
                Preview generated content before publishing
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!previewContent ? (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Select content to preview from the Manage tab
                  </AlertDescription>
                </Alert>
              ) : (
                <ContentPreview content={previewContent} />
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Edit Dialog */}
      {editingContent && (
        <ContentEditDialog
          content={editingContent}
          onClose={() => setEditingContent(null)}
          onSave={(updates) => updateContent.mutate({ id: editingContent.id, updates })}
        />
      )}
    </div>
  );
}

// Content Preview Component
function ContentPreview({ content }: { content: any }) {
  const renderContent = () => {
    switch (content.formatType) {
      case ContentFormats.PODCAST:
        return (
          <div className="space-y-4">
            <div>
              <h3 className="font-medium mb-2">Introduction</h3>
              <p className="text-gray-700 whitespace-pre-wrap">{content.podcastIntro}</p>
            </div>
            <div>
              <h3 className="font-medium mb-2">Script</h3>
              <p className="text-gray-700 whitespace-pre-wrap">{content.podcastScript}</p>
            </div>
            {content.podcastQA && (
              <div>
                <h3 className="font-medium mb-2">Q&A Segment</h3>
                {JSON.parse(content.podcastQA).map((qa: any, index: number) => (
                  <div key={index} className="mb-3 p-3 bg-gray-50 rounded">
                    <p className="font-medium">Q: {qa.question}</p>
                    <p className="mt-1">A: {qa.answer}</p>
                  </div>
                ))}
              </div>
            )}
            <div>
              <h3 className="font-medium mb-2">Outro</h3>
              <p className="text-gray-700 whitespace-pre-wrap">{content.podcastOutro}</p>
            </div>
            <div>
              <h3 className="font-medium mb-2">Show Notes</h3>
              <p className="text-gray-700 whitespace-pre-wrap">{content.podcastShowNotes}</p>
            </div>
          </div>
        );
        
      case ContentFormats.INFOGRAPHIC:
        return (
          <div className="space-y-4">
            <div>
              <h3 className="font-medium mb-2">Title</h3>
              <p className="text-xl font-bold">{content.infographicTitle}</p>
            </div>
            {content.keyStatistics && (
              <div>
                <h3 className="font-medium mb-2">Key Statistics</h3>
                <div className="grid grid-cols-2 gap-3">
                  {JSON.parse(content.keyStatistics).map((stat: any, index: number) => (
                    <div key={index} className="p-3 bg-blue-50 rounded">
                      <p className="text-2xl font-bold text-blue-600">{stat.value}</p>
                      <p className="text-sm font-medium">{stat.label}</p>
                      <p className="text-xs text-gray-500">{stat.context}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
        
      case ContentFormats.SOCIAL_TWITTER:
        return (
          <div className="space-y-4">
            {content.threadContent ? (
              <div>
                <h3 className="font-medium mb-2">Thread</h3>
                {JSON.parse(content.threadContent).map((tweet: string, index: number) => (
                  <div key={index} className="mb-3 p-3 bg-gray-50 rounded">
                    <p className="text-sm text-gray-500 mb-1">Tweet {index + 1}</p>
                    <p>{tweet}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div>
                <h3 className="font-medium mb-2">Post</h3>
                <p>{content.socialContent}</p>
              </div>
            )}
            {content.hashtags && (
              <div className="flex flex-wrap gap-2 mt-3">
                {content.hashtags.map((tag: string, index: number) => (
                  <Badge key={index} variant="secondary">#{tag}</Badge>
                ))}
              </div>
            )}
          </div>
        );
        
      case ContentFormats.VIDEO_YOUTUBE:
      case ContentFormats.VIDEO_SHORT:
        return (
          <div className="space-y-4">
            <div>
              <h3 className="font-medium mb-2">Script</h3>
              <p className="text-gray-700 whitespace-pre-wrap">{content.videoScript}</p>
            </div>
            {content.videoStoryboard && (
              <div>
                <h3 className="font-medium mb-2">Storyboard</h3>
                {JSON.parse(content.videoStoryboard).map((scene: any, index: number) => (
                  <div key={index} className="mb-3 p-3 bg-gray-50 rounded">
                    <p className="font-medium">{scene.time} - {scene.scene}</p>
                    <p className="text-sm mt-1">Visuals: {scene.visuals}</p>
                    <p className="text-sm">Narration: {scene.narration}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
        
      case ContentFormats.NEWSLETTER:
        return (
          <div className="space-y-4">
            <div>
              <h3 className="font-medium mb-2">Subject Line</h3>
              <p className="font-medium">{content.newsletterSubjectLine}</p>
            </div>
            <div>
              <h3 className="font-medium mb-2">Preheader</h3>
              <p className="text-gray-600">{content.newsletterPreheader}</p>
            </div>
            {content.newsletterHtml && (
              <div>
                <h3 className="font-medium mb-2">HTML Preview</h3>
                <div 
                  className="border p-4 rounded bg-white"
                  dangerouslySetInnerHTML={{ __html: content.newsletterHtml }}
                />
              </div>
            )}
            <div>
              <h3 className="font-medium mb-2">Plain Text</h3>
              <p className="text-gray-700 whitespace-pre-wrap">{content.newsletterPlainText}</p>
            </div>
          </div>
        );
        
      default:
        return (
          <div>
            <p className="text-gray-700">{content.socialContent || 'No preview available'}</p>
          </div>
        );
    }
  };
  
  return (
    <div className="max-h-[600px] overflow-y-auto">
      <div className="mb-4 flex items-center space-x-2">
        <div className="text-blue-600">{formatIcons[content.formatType]}</div>
        <h2 className="text-lg font-medium">{formatNames[content.formatType]}</h2>
        <Badge variant={content.isPublished ? "default" : "outline"}>
          {content.isPublished ? 'Published' : 'Draft'}
        </Badge>
      </div>
      {renderContent()}
    </div>
  );
}

// Content Edit Dialog Component
function ContentEditDialog({ 
  content, 
  onClose, 
  onSave 
}: { 
  content: any; 
  onClose: () => void; 
  onSave: (updates: any) => void;
}) {
  const [edits, setEdits] = useState<any>({});
  
  const handleSave = () => {
    onSave(edits);
  };
  
  const renderEditForm = () => {
    switch (content.formatType) {
      case ContentFormats.PODCAST:
        return (
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Introduction</label>
              <textarea
                className="w-full mt-1 p-2 border rounded"
                rows={3}
                defaultValue={content.podcastIntro}
                onChange={(e) => setEdits({ ...edits, podcastIntro: e.target.value })}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Script</label>
              <textarea
                className="w-full mt-1 p-2 border rounded"
                rows={10}
                defaultValue={content.podcastScript}
                onChange={(e) => setEdits({ ...edits, podcastScript: e.target.value })}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Outro</label>
              <textarea
                className="w-full mt-1 p-2 border rounded"
                rows={3}
                defaultValue={content.podcastOutro}
                onChange={(e) => setEdits({ ...edits, podcastOutro: e.target.value })}
              />
            </div>
          </div>
        );
        
      case ContentFormats.SOCIAL_TWITTER:
      case ContentFormats.SOCIAL_LINKEDIN:
      case ContentFormats.SOCIAL_INSTAGRAM:
      case ContentFormats.SOCIAL_FACEBOOK:
      case ContentFormats.SOCIAL_TIKTOK:
        return (
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Content</label>
              <textarea
                className="w-full mt-1 p-2 border rounded"
                rows={5}
                defaultValue={content.socialContent}
                onChange={(e) => setEdits({ ...edits, socialContent: e.target.value })}
              />
            </div>
          </div>
        );
        
      default:
        return <p>Edit form not available for this content type</p>;
    }
  };
  
  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit {formatNames[content.formatType]}</DialogTitle>
          <DialogDescription>
            Make changes to your generated content
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          {renderEditForm()}
        </div>
        <div className="flex justify-end space-x-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave}>
            Save Changes
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}