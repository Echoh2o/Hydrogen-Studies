import React, { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ExternalLink, Loader2, AlertCircle, CheckCircle, Globe, Search, Beaker, BookOpen } from 'lucide-react';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { apiRequest } from '@/lib/queryClient';
import { queryClient } from '@/lib/queryClient';

const urlFormSchema = z.object({
  url: z.string().url('Please enter a valid URL')
});

type UrlFormValues = z.infer<typeof urlFormSchema>;

const UrlScraperForm: React.FC = () => {
  const { toast } = useToast();
  const [url, setUrl] = useState('');
  const [detectedPlatform, setDetectedPlatform] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [previewData, setPreviewData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  
  const supportedPlatforms = [
    { name: 'PubMed', url: 'pubmed.ncbi.nlm.nih.gov', icon: Search },
    { name: 'Europe PMC API', url: 'europepmc.org', icon: BookOpen, featured: true },
    { name: 'HydrogenStudies', url: 'hydrogenstudies.com', icon: Beaker },
    { name: 'CrossRef / DOI', url: 'doi.org', icon: Globe },
    { name: 'Semantic Scholar', url: 'semanticscholar.org', icon: Search },
    { name: 'CORE', url: 'core.ac.uk', icon: Search }
  ];

  const handlePreview = async () => {
    if (!url) {
      setError('Please enter a URL');
      return;
    }
    
    try {
      setIsLoading(true);
      setError(null);
      setPreviewData(null);
      
      // Check platform
      detectPlatform(url);
      
      const response = await apiRequest('/api/scraper/preview-url', {
        method: 'POST',
        data: { url }
      });
      
      if (response.success && response.study) {
        setPreviewData(response.study);
        toast({
          title: 'Study preview loaded',
          description: 'The study data was successfully extracted from the URL.',
        });
      } else {
        setError(response.message || 'Failed to extract study data from the URL');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred while fetching the study data');
      toast({
        variant: 'destructive',
        title: 'Error',
        description: err.message || 'Failed to extract study data'
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleSave = async () => {
    if (!previewData) {
      setError('No study data to save. Please preview a URL first.');
      return;
    }
    
    try {
      setIsLoading(true);
      
      const response = await apiRequest('/api/scraper/save-url', {
        method: 'POST',
        data: { url }
      });
      
      if (response.success && response.study) {
        toast({
          title: 'Study saved',
          description: 'The study was successfully saved to the database.',
        });
        
        // Reset form
        setUrl('');
        setPreviewData(null);
        setDetectedPlatform(null);
        
        // Invalidate studies cache
        queryClient.invalidateQueries({ queryKey: ['/api/studies'] });
      } else {
        setError(response.message || 'Failed to save the study');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred while saving the study');
      toast({
        variant: 'destructive',
        title: 'Error',
        description: err.message || 'Failed to save study'
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  const detectPlatform = (inputUrl: string) => {
    const lowerCaseUrl = inputUrl.toLowerCase();
    
    for (const platform of supportedPlatforms) {
      if (lowerCaseUrl.includes(platform.url)) {
        setDetectedPlatform(platform.name);
        return;
      }
    }
    
    setDetectedPlatform(null);
  };
  
  const form = useForm<UrlFormValues>({
    resolver: zodResolver(urlFormSchema),
    defaultValues: {
      url: ''
    }
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>URL Scraper</CardTitle>
          <CardDescription>
            Extract study data directly from supported research platforms
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <div className="space-y-4">
              <FormField
                control={form.control}
                name="url"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Study URL</FormLabel>
                    <FormControl>
                      <div className="flex space-x-2">
                        <Input 
                          placeholder="Enter URL from a supported platform" 
                          value={url}
                          onChange={(e) => {
                            setUrl(e.target.value);
                            field.onChange(e);
                            detectPlatform(e.target.value);
                          }}
                        />
                        <Button 
                          type="button" 
                          onClick={handlePreview}
                          disabled={isLoading}
                        >
                          {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                          Preview
                        </Button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              {detectedPlatform && (
                <div className="flex items-center mt-2">
                  <Globe className="mr-2 h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Detected platform: </span>
                  <Badge variant="outline" className="ml-2">{detectedPlatform}</Badge>
                </div>
              )}
              
              <div className="mt-4">
                <h4 className="text-sm font-medium mb-2">Supported Platforms:</h4>
                <div className="flex flex-wrap gap-2">
                  {supportedPlatforms.map((platform) => (
                    <Badge 
                      key={platform.name} 
                      variant={platform.featured ? "default" : "secondary"}
                      className={platform.featured ? "bg-blue-600 hover:bg-blue-700" : ""}
                    >
                      {React.createElement(platform.icon, { 
                        className: "w-3.5 h-3.5 mr-1 inline", 
                        "aria-hidden": true 
                      })}
                      {platform.name}
                      {platform.featured && <span className="ml-1 text-xs">★</span>}
                    </Badge>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Europe PMC API provides direct access to over 40 million publications with enhanced metadata
                </p>
              </div>
            </div>
          </Form>
        </CardContent>
      </Card>
      
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      
      {previewData && (
        <Card>
          <CardHeader>
            <CardTitle>Study Preview</CardTitle>
            <CardDescription>
              Review the extracted study data before saving
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <h3 className="font-medium text-lg">{previewData.title}</h3>
                <p className="text-sm text-muted-foreground mt-1">Authors: {previewData.authors}</p>
                <div className="flex items-center mt-2">
                  <span className="text-sm">{previewData.journal}</span>
                  <span className="mx-2">•</span>
                  <span className="text-sm">{previewData.publishDate}</span>
                  {previewData.peerReviewed && (
                    <>
                      <span className="mx-2">•</span>
                      <Badge variant="outline" className="text-xs">Peer Reviewed</Badge>
                    </>
                  )}
                </div>
              </div>
              
              <Separator />
              
              <div>
                <h4 className="font-medium mb-1">Abstract</h4>
                <p className="text-sm">{previewData.abstract}</p>
              </div>
              
              {(previewData.methods || previewData.results || previewData.conclusion) && (
                <>
                  <Separator />
                  
                  {previewData.methods && (
                    <div>
                      <h4 className="font-medium mb-1">Methods</h4>
                      <p className="text-sm">{previewData.methods}</p>
                    </div>
                  )}
                  
                  {previewData.results && (
                    <div>
                      <h4 className="font-medium mb-1">Results</h4>
                      <p className="text-sm">{previewData.results}</p>
                    </div>
                  )}
                  
                  {previewData.conclusion && (
                    <div>
                      <h4 className="font-medium mb-1">Conclusion</h4>
                      <p className="text-sm">{previewData.conclusion}</p>
                    </div>
                  )}
                </>
              )}
              
              <Separator />
              
              <div className="flex items-center justify-between">
                <div className="flex flex-col space-y-1">
                  {previewData.doi && (
                    <div className="flex items-center">
                      <span className="text-sm font-medium mr-2">DOI:</span>
                      <span className="text-sm">{previewData.doi}</span>
                    </div>
                  )}
                  {previewData.pdfUrl && (
                    <div className="flex items-center">
                      <span className="text-sm font-medium mr-2">PDF:</span>
                      <a href={previewData.pdfUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-primary flex items-center">
                        View PDF <ExternalLink className="ml-1 h-3 w-3" />
                      </a>
                    </div>
                  )}
                </div>
                
                <Button 
                  onClick={handleSave}
                  disabled={isLoading}
                >
                  {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle className="mr-2 h-4 w-4" />}
                  Save Study
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default UrlScraperForm;