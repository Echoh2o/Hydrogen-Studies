import React, { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { queryClient } from '@/lib/queryClient';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, ExternalLink, CheckCircle2, AlertTriangle } from 'lucide-react';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

const UrlScraperForm = () => {
  const { toast } = useToast();
  const [url, setUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [previewData, setPreviewData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  
  const supportedPlatforms = [
    { name: 'PubMed', url: 'pubmed.ncbi.nlm.nih.gov' },
    { name: 'HydrogenStudies', url: 'hydrogenstudies.com' },
    { name: 'Europe PMC', url: 'europepmc.org' },
    { name: 'CrossRef / DOI', url: 'doi.org' },
    { name: 'Semantic Scholar', url: 'semanticscholar.org' },
    { name: 'CORE', url: 'core.ac.uk' },
    { name: 'Dimensions', url: 'dimensions.ai' }
  ];

  const handlePreview = async () => {
    if (!url) {
      setError('Please enter a URL');
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await apiRequest('/api/research/preview-url', {
        method: 'POST',
        body: JSON.stringify({ url })
      });
      
      if (!response.success) {
        throw new Error(response.message || 'Failed to extract study data');
      }
      
      setPreviewData(response.study);
      toast({
        title: 'Preview successful',
        description: 'Study data extracted successfully.'
      });
    } catch (err: any) {
      setError(err.message || 'Failed to extract study data from the URL');
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
      setError('No data to save. Please preview the URL first.');
      return;
    }
    
    setIsLoading(true);
    
    try {
      const response = await apiRequest('/api/research/scrape-url', {
        method: 'POST',
        body: JSON.stringify({ url })
      });
      
      if (!response.success) {
        throw new Error(response.message || 'Failed to save study');
      }
      
      // Reset form and show success message
      setUrl('');
      setPreviewData(null);
      
      // Invalidate studies query to refresh the list
      queryClient.invalidateQueries({ queryKey: ['/api/studies'] });
      
      toast({
        title: 'Success',
        description: 'Study successfully added to the database.'
      });
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: err.message || 'Failed to save study'
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <Card className="w-full mb-8">
      <CardHeader>
        <CardTitle>Extract Study from URL</CardTitle>
        <CardDescription>
          Automatically extract study data from research platforms like PubMed, CrossRef, Europe PMC, and more.
        </CardDescription>
      </CardHeader>
      
      <CardContent>
        <div className="space-y-4">
          <div className="flex flex-col space-y-2">
            <label htmlFor="url" className="text-sm font-medium">URL</label>
            <div className="flex space-x-2">
              <Input
                id="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="Enter URL to a research paper (e.g., https://pubmed.ncbi.nlm.nih.gov/12345678/)"
                className="flex-1"
              />
              <Button 
                onClick={handlePreview} 
                disabled={isLoading || !url}
                variant="secondary"
              >
                {isLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                Preview
              </Button>
            </div>
            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
          </div>
          
          <div className="mt-4">
            <h3 className="font-medium text-sm mb-2">Supported Platforms</h3>
            <div className="flex flex-wrap gap-2">
              {supportedPlatforms.map((platform) => (
                <TooltipProvider key={platform.name}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Badge variant="outline" className="cursor-help">
                        {platform.name}
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{platform.url}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ))}
            </div>
          </div>
          
          {previewData && (
            <>
              <Separator className="my-4" />
              
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">Preview</h3>
                  <div className="flex items-center space-x-1">
                    <Badge variant="outline">
                      {previewData.sourcePlatform || 'External Source'}
                    </Badge>
                  </div>
                </div>
                
                <Table>
                  <TableBody>
                    <TableRow>
                      <TableCell className="font-medium w-1/4">Title</TableCell>
                      <TableCell>{previewData.title}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">Authors</TableCell>
                      <TableCell>{previewData.authors}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">Journal</TableCell>
                      <TableCell>{previewData.journal}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">Publication Date</TableCell>
                      <TableCell>{previewData.publishDate}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">DOI</TableCell>
                      <TableCell>{previewData.doi || 'Not available'}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">Peer Reviewed</TableCell>
                      <TableCell>
                        {previewData.peerReviewed ? 
                          <CheckCircle2 className="h-5 w-5 text-green-500" /> : 
                          <AlertTriangle className="h-5 w-5 text-amber-500" />}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">Abstract</TableCell>
                      <TableCell className="whitespace-normal">
                        <div className="max-h-32 overflow-y-auto text-sm">
                          {previewData.abstract}
                        </div>
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </div>
      </CardContent>
      
      <CardFooter className="flex justify-between">
        <Button
          variant="outline"
          onClick={() => {
            setUrl('');
            setPreviewData(null);
            setError(null);
          }}
        >
          Clear
        </Button>
        
        <Button
          onClick={handleSave}
          disabled={isLoading || !previewData}
        >
          {isLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
          Save to Database
        </Button>
      </CardFooter>
    </Card>
  );
};

export default UrlScraperForm;