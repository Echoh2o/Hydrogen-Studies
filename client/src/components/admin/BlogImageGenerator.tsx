import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, ImagePlus, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface BlogImageGeneratorProps {
  blogId: number;
  onSuccess?: (imageUrl: string, imageAlt: string) => void;
  className?: string;
}

export function BlogImageGenerator({ blogId, onSuccess, className }: BlogImageGeneratorProps) {
  const { toast } = useToast();
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [generatedImage, setGeneratedImage] = useState<{ url: string; alt: string } | null>(null);
  
  const handleGenerate = async () => {
    if (isGenerating) return;
    
    setIsGenerating(true);
    
    try {
      const response = await apiRequest('POST', `/api/blogs/${blogId}/generate-image`);
      const data = await response.json();
      
      if (response.ok) {
        setGeneratedImage({
          url: data.imageUrl,
          alt: data.imageAlt || 'Generated blog image'
        });
        
        toast({
          title: "Image generated successfully",
          description: "The AI has created a unique image for your blog post."
        });
        
        if (onSuccess) {
          onSuccess(data.imageUrl, data.imageAlt);
        }
      } else {
        toast({
          title: "Image generation failed",
          description: data.message || "There was an error generating the image. Please try again.",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error("Error generating image:", error);
      toast({
        title: "Image generation failed",
        description: "There was an error generating the image. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsGenerating(false);
    }
  };
  
  return (
    <div className={`space-y-4 ${className}`}>
      <div className="flex flex-col space-y-4">
        <Button
          type="button"
          onClick={handleGenerate}
          disabled={isGenerating}
          className="flex items-center"
          variant={generatedImage ? "outline" : "default"}
        >
          {isGenerating ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Generating AI Image...
            </>
          ) : generatedImage ? (
            <>
              <RefreshCw className="mr-2 h-4 w-4" />
              Regenerate Image
            </>
          ) : (
            <>
              <ImagePlus className="mr-2 h-4 w-4" />
              Generate Image with AI
            </>
          )}
        </Button>
        
        <p className="text-sm text-muted-foreground">
          AI will create a unique image based on your blog content. This may take a moment.
        </p>
      </div>
      
      {generatedImage && (
        <Card className="overflow-hidden">
          <CardContent className="p-0">
            <div className="relative pt-4">
              <img 
                src={generatedImage.url} 
                alt={generatedImage.alt}
                className="w-full h-auto rounded-md object-contain"
              />
              <p className="text-xs text-muted-foreground mt-2 px-4 pb-4">
                {generatedImage.alt}
              </p>
            </div>
          </CardContent>
        </Card>
      )}
      
      {isGenerating && (
        <div className="flex flex-col items-center justify-center p-6 border border-dashed rounded-md">
          <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
          <p className="text-sm font-medium">Creating your image...</p>
          <p className="text-xs text-muted-foreground text-center mt-1">
            This typically takes 10-20 seconds as we generate a unique image for your content
          </p>
        </div>
      )}
    </div>
  );
}