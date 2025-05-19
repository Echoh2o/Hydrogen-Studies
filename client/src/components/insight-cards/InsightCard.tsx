import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Download, Share2, Copy, ExternalLink } from 'lucide-react';
import { motion } from 'framer-motion';
import { Study } from '@/types';
import { useToast } from '@/hooks/use-toast';

interface InsightCardProps {
  study: Study;
  insight?: string;
  isEditable?: boolean;
  onSave?: (data: any) => void;
  className?: string;
}

export default function InsightCard({ 
  study, 
  insight,
  isEditable = false,
  onSave,
  className = ''
}: InsightCardProps) {
  const { toast } = useToast();
  const [text, setText] = useState(insight || '');
  const [theme, setTheme] = useState('medical');
  const [style, setStyle] = useState('minimalist');
  const [includeSource, setIncludeSource] = useState(true);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  
  useEffect(() => {
    if (insight) {
      setText(insight);
    }
  }, [insight]);
  
  const handleGenerateImage = async () => {
    if (!text) {
      toast({
        title: "Insight Required",
        description: "Please enter an insight or select one from the suggestions",
        variant: "destructive",
      });
      return;
    }
    
    try {
      setIsGeneratingImage(true);
      
      const response = await fetch('/api/insight-cards/generate-image', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          studyId: study.id,
          insight: text,
          theme,
          style,
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to generate image');
      }
      
      const data = await response.json();
      setImageUrl(data.imageUrl);
      
      toast({
        title: "Image Generated",
        description: "Custom image created for your research insight",
      });
      
    } catch (error) {
      console.error('Error generating image:', error);
      toast({
        title: "Generation Failed",
        description: "Unable to generate image. Please try again later.",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingImage(false);
    }
  };
  
  const handleShare = async () => {
    if (!imageUrl || !text) {
      toast({
        title: "Missing Content",
        description: "Please generate an image and provide insight text before sharing",
        variant: "destructive",
      });
      return;
    }
    
    try {
      const response = await fetch('/api/insight-cards/share', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          studyId: study.id,
          insight: text,
          imageUrl,
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to share insight card');
      }
      
      const data = await response.json();
      
      if (onSave) {
        onSave({
          text,
          imageUrl,
          shareUrl: data.shareUrl,
          shareId: data.shareId,
        });
      }
      
      toast({
        title: "Insight Shared",
        description: "Your research insight is now shareable",
      });
      
      // Copy share URL to clipboard
      navigator.clipboard.writeText(window.location.origin + data.shareUrl)
        .then(() => {
          toast({
            title: "Link Copied",
            description: "Share link copied to clipboard",
          });
        })
        .catch(err => {
          console.error('Failed to copy link:', err);
        });
      
    } catch (error) {
      console.error('Error sharing insight card:', error);
      toast({
        title: "Sharing Failed",
        description: "Unable to share insight card. Please try again later.",
        variant: "destructive",
      });
    }
  };
  
  const handleDownloadImage = () => {
    if (!imageUrl) {
      toast({
        title: "No Image",
        description: "Please generate an image first",
        variant: "destructive",
      });
      return;
    }
    
    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = `hydrogen-insight-${study.id}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  
  const handleCopyText = () => {
    navigator.clipboard.writeText(text)
      .then(() => {
        toast({
          title: "Text Copied",
          description: "Insight text copied to clipboard",
        });
      })
      .catch(err => {
        console.error('Failed to copy text:', err);
        toast({
          title: "Copy Failed",
          description: "Unable to copy text to clipboard",
          variant: "destructive",
        });
      });
  };
  
  return (
    <motion.div
      className={`w-full ${className}`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <div className="flex flex-col">
            {/* Image Area */}
            <div className="bg-gray-100 aspect-video relative flex items-center justify-center">
              {imageUrl ? (
                <img 
                  src={imageUrl} 
                  alt="Research insight visualization"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="text-center p-6 flex flex-col items-center justify-center h-full">
                  <div className="text-primary/60 mb-3">
                    <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M2 12a5 5 0 0 0 5 5 8 8 0 0 1 5 2 8 8 0 0 1 5-2 5 5 0 0 0 5-5c0-8-7-9-10-3-3-6-10-5-10 3"></path>
                      <path d="M12 13c0 .83-.67 1.5-1.5 1.5S9 13.83 9 13s.67-1.5 1.5-1.5c.83 0 1.5.67 1.5 1.5z"></path>
                    </svg>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {isGeneratingImage ? 'Generating custom visualization...' : 'Custom visualization will appear here'}
                  </p>
                  {!isGeneratingImage && (
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="mt-3"
                      onClick={handleGenerateImage}
                    >
                      Generate Image
                    </Button>
                  )}
                </div>
              )}
            </div>
            
            {/* Content Area */}
            <div className="p-4">
              {isEditable ? (
                <Textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Enter research insight..."
                  className="mb-4 resize-none min-h-[100px]"
                />
              ) : (
                <div className="mb-4">
                  <p className="text-sm font-medium leading-6">{text}</p>
                </div>
              )}
              
              {includeSource && (
                <div className="text-xs text-muted-foreground mt-2">
                  <span className="font-medium">Source:</span> {study.authors} ({new Date(study.publishDate).getFullYear()}). {study.journal}.
                </div>
              )}
              
              {isEditable && (
                <div className="mt-4 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="theme">Theme</Label>
                      <Select
                        value={theme}
                        onValueChange={setTheme}
                      >
                        <SelectTrigger id="theme">
                          <SelectValue placeholder="Select theme" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="medical">Medical</SelectItem>
                          <SelectItem value="scientific">Scientific</SelectItem>
                          <SelectItem value="technical">Technical</SelectItem>
                          <SelectItem value="abstract">Abstract</SelectItem>
                          <SelectItem value="wellness">Wellness</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="style">Style</Label>
                      <Select
                        value={style}
                        onValueChange={setStyle}
                      >
                        <SelectTrigger id="style">
                          <SelectValue placeholder="Select style" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="minimalist">Minimalist</SelectItem>
                          <SelectItem value="modern">Modern</SelectItem>
                          <SelectItem value="illustrated">Illustrated</SelectItem>
                          <SelectItem value="geometric">Geometric</SelectItem>
                          <SelectItem value="gradient">Gradient</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="include-source"
                      checked={includeSource}
                      onCheckedChange={setIncludeSource}
                    />
                    <Label htmlFor="include-source">Include source citation</Label>
                  </div>
                  
                  <div className="flex flex-wrap gap-2 pt-4">
                    <Button
                      variant="default"
                      size="sm"
                      onClick={handleGenerateImage}
                      disabled={!text || isGeneratingImage}
                    >
                      {isGeneratingImage ? 'Generating...' : 'Generate Image'}
                    </Button>
                    
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={handleDownloadImage}
                      disabled={!imageUrl}
                    >
                      <Download className="h-4 w-4 mr-1" />
                      Download
                    </Button>
                    
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={handleCopyText}
                    >
                      <Copy className="h-4 w-4 mr-1" />
                      Copy Text
                    </Button>
                    
                    <Button 
                      variant="secondary" 
                      size="sm"
                      onClick={handleShare}
                      disabled={!imageUrl || !text}
                    >
                      <Share2 className="h-4 w-4 mr-1" />
                      Share
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}