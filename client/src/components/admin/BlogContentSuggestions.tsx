import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Loader2, Check, RefreshCw, Wand2 } from 'lucide-react';

// Types of suggestions available
const suggestionTypes = [
  { value: 'improve', label: 'Improve Writing', description: 'Enhance clarity and engagement while maintaining scientific accuracy' },
  { value: 'expand', label: 'Expand Content', description: 'Add more relevant details and explanations' },
  { value: 'simplify', label: 'Simplify Language', description: 'Make content more accessible to general audience' },
  { value: 'add_examples', label: 'Add Examples', description: 'Include practical examples that illustrate concepts' },
  { value: 'add_research_context', label: 'Add Research Context', description: 'Include more scientific background and related research' },
  { value: 'elon_style', label: 'Elon Musk Style', description: 'Rewrite in Elon Musk\'s straightforward, visionary style' },
  { value: 'add_conclusion', label: 'Add Conclusion', description: 'Generate a strong concluding paragraph' }
];

type BlogContentSuggestionsProps = {
  blogId: number;
  onSuggestionApply: (suggestion: string) => void;
};

export function BlogContentSuggestions({ blogId, onSuggestionApply }: BlogContentSuggestionsProps) {
  const { toast } = useToast();
  const [selectedType, setSelectedType] = useState('improve');
  const [selectedContent, setSelectedContent] = useState('');
  const [showTitleDialog, setShowTitleDialog] = useState(false);
  const [titleSuggestions, setTitleSuggestions] = useState<string[]>([]);
  
  // Generate content suggestion
  const { mutate: generateSuggestion, isPending: isGeneratingSuggestion } = useMutation({
    mutationFn: async ({ type, content }: { type: string, content?: string }) => {
      return apiRequest(`/api/blogs/${blogId}/generate-suggestion`, {
        method: 'POST',
        data: {
          suggestionType: type,
          selectedContent: content,
        },
      });
    },
    onSuccess: (data) => {
      toast({
        title: 'Suggestion Generated',
        description: 'AI has created a content suggestion based on your blog.',
      });
      onSuggestionApply(data.suggestion);
    },
    onError: (error) => {
      toast({
        title: 'Error Generating Suggestion',
        description: error.message || 'Failed to generate suggestion. Please try again.',
        variant: 'destructive',
      });
    },
  });
  
  // Generate title suggestions
  const { mutate: generateTitles, isPending: isGeneratingTitles } = useMutation({
    mutationFn: async () => {
      return apiRequest(`/api/blogs/${blogId}/generate-titles`, {
        method: 'POST',
      });
    },
    onSuccess: (data) => {
      setTitleSuggestions(data.suggestions);
      setShowTitleDialog(true);
    },
    onError: (error) => {
      toast({
        title: 'Error Generating Titles',
        description: error.message || 'Failed to generate title suggestions. Please try again.',
        variant: 'destructive',
      });
    },
  });
  
  // Handle applying content suggestion
  const handleGenerateSuggestion = () => {
    generateSuggestion({
      type: selectedType,
      content: selectedContent.trim() !== '' ? selectedContent : undefined,
    });
  };
  
  // Handle applying title suggestion
  const handleSelectTitle = (title: string) => {
    onSuggestionApply(title);
    setShowTitleDialog(false);
    toast({
      title: 'Title Applied',
      description: 'The selected title has been applied to your blog.',
    });
  };
  
  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle>AI Content Assistant</CardTitle>
        <CardDescription>
          Use AI to improve your blog content or generate title suggestions
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="content" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="content">Content Suggestions</TabsTrigger>
            <TabsTrigger value="titles">Title Suggestions</TabsTrigger>
          </TabsList>
          
          <TabsContent value="content" className="space-y-4 pt-4">
            <div className="space-y-4">
              <div>
                <Label htmlFor="suggestion-type">Suggestion Type</Label>
                <Select
                  value={selectedType}
                  onValueChange={setSelectedType}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select type of suggestion" />
                  </SelectTrigger>
                  <SelectContent>
                    {suggestionTypes.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">
                  {suggestionTypes.find(t => t.value === selectedType)?.description}
                </p>
              </div>
              
              <div>
                <Label htmlFor="selected-content">
                  Selected Content (Optional)
                </Label>
                <Textarea
                  id="selected-content"
                  placeholder="Paste specific content to improve here, or leave blank to generate suggestion for the entire blog"
                  className="min-h-[100px]"
                  value={selectedContent}
                  onChange={(e) => setSelectedContent(e.target.value)}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  If left blank, AI will analyze the entire blog content.
                </p>
              </div>
              
              <Button
                type="button"
                onClick={handleGenerateSuggestion}
                disabled={isGeneratingSuggestion}
                className="w-full"
              >
                {isGeneratingSuggestion ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generating Suggestion...
                  </>
                ) : (
                  <>
                    <Wand2 className="mr-2 h-4 w-4" />
                    Generate Content Suggestion
                  </>
                )}
              </Button>
            </div>
          </TabsContent>
          
          <TabsContent value="titles" className="space-y-4 pt-4">
            <div className="space-y-4">
              <p className="text-sm">
                Generate alternative title suggestions based on your blog content. 
                The AI will analyze your article and propose engaging titles that match the subject matter.
              </p>
              
              <Button
                type="button"
                onClick={() => generateTitles()}
                disabled={isGeneratingTitles}
                className="w-full"
              >
                {isGeneratingTitles ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generating Titles...
                  </>
                ) : (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Generate Title Suggestions
                  </>
                )}
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
      
      {/* Title suggestions dialog */}
      <Dialog open={showTitleDialog} onOpenChange={setShowTitleDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Title Suggestions</DialogTitle>
            <DialogDescription>
              Choose one of these AI-generated titles for your blog.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-3 my-4">
            {titleSuggestions.map((title, index) => (
              <div 
                key={index}
                className="p-3 border rounded-md hover:bg-secondary cursor-pointer transition-colors"
                onClick={() => handleSelectTitle(title)}
              >
                {title}
              </div>
            ))}
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTitleDialog(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}