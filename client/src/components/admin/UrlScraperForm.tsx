import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useToast } from '@/hooks/use-toast';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Loader2, CheckCircle2, AlertCircle, Globe } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

// Form schema
const urlScraperSchema = z.object({
  url: z.string().url('Please enter a valid URL')
});

type UrlScraperFormValues = z.infer<typeof urlScraperSchema>;

interface StudyPreview {
  title: string;
  authors: string;
  journal: string;
  publishDate: string;
  abstract: string;
  doi?: string;
  source: string;
}

export const UrlScraperForm = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [studyPreview, setStudyPreview] = useState<StudyPreview | null>(null);
  const [scrapeError, setScrapeError] = useState<string | null>(null);
  
  const form = useForm<UrlScraperFormValues>({
    resolver: zodResolver(urlScraperSchema),
    defaultValues: {
      url: ''
    }
  });

  // Mutation for scraping URL
  const scrapeUrlMutation = useMutation({
    mutationFn: async (url: string) => {
      const response = await fetch('/api/research/scrape-url', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ url })
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to scrape URL');
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      setStudyPreview(data.study);
      setScrapeError(null);
      toast({
        title: 'URL scraped successfully',
        description: 'Study details have been extracted and are ready for review.',
        variant: 'default',
      });
    },
    onError: (error: Error) => {
      setScrapeError(error.message);
      setStudyPreview(null);
      toast({
        title: 'Failed to scrape URL',
        description: error.message,
        variant: 'destructive',
      });
    }
  });

  // Mutation for importing study
  const importStudyMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/research/approve', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ study: studyPreview })
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to import study');
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/studies'] });
      setStudyPreview(null);
      form.reset();
      toast({
        title: 'Study imported successfully',
        description: 'The study has been added to the database.',
        variant: 'default',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to import study',
        description: error.message,
        variant: 'destructive',
      });
    }
  });

  // Function to handle form submission
  const onSubmit = (values: UrlScraperFormValues) => {
    setStudyPreview(null);
    setScrapeError(null);
    scrapeUrlMutation.mutate(values.url);
  };

  // Function to determine supported platforms badge color
  const getPlatformBadgeColor = (source: string): string => {
    switch (source.toLowerCase()) {
      case 'pubmed':
        return 'bg-blue-100 text-blue-800 hover:bg-blue-200';
      case 'hydrogen studies':
        return 'bg-green-100 text-green-800 hover:bg-green-200';
      case 'crossref':
        return 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200';
      case 'europe pmc':
        return 'bg-purple-100 text-purple-800 hover:bg-purple-200';
      case 'semantic scholar':
        return 'bg-orange-100 text-orange-800 hover:bg-orange-200';
      default:
        return 'bg-gray-100 text-gray-800 hover:bg-gray-200';
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Import from URL</CardTitle>
        <CardDescription>
          Paste a URL from a supported platform to automatically extract study data
        </CardDescription>
        <div className="flex flex-wrap gap-2 mt-2">
          <Badge variant="outline" className="bg-blue-100 text-blue-800 hover:bg-blue-200">PubMed</Badge>
          <Badge variant="outline" className="bg-green-100 text-green-800 hover:bg-green-200">Hydrogen Studies</Badge>
          <Badge variant="outline" className="bg-purple-100 text-purple-800 hover:bg-purple-200">Europe PMC</Badge>
          <Badge variant="outline" className="bg-yellow-100 text-yellow-800 hover:bg-yellow-200">CrossRef</Badge>
          <Badge variant="outline" className="bg-orange-100 text-orange-800 hover:bg-orange-200">Semantic Scholar</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="url"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>URL</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="https://pubmed.ncbi.nlm.nih.gov/12345678/" 
                      {...field}
                      disabled={scrapeUrlMutation.isPending || importStudyMutation.isPending}
                    />
                  </FormControl>
                  <FormDescription>
                    Enter the full URL to the study page
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button 
              type="submit" 
              disabled={scrapeUrlMutation.isPending || importStudyMutation.isPending}
              className="w-full"
            >
              {scrapeUrlMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Scraping...
                </>
              ) : (
                <>
                  <Globe className="mr-2 h-4 w-4" />
                  Scrape URL
                </>
              )}
            </Button>
          </form>
        </Form>

        {scrapeError && (
          <Alert variant="destructive" className="mt-4">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{scrapeError}</AlertDescription>
          </Alert>
        )}

        {studyPreview && (
          <div className="mt-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Study Preview</h3>
              <Badge 
                variant="outline"
                className={getPlatformBadgeColor(studyPreview.source)}
              >
                {studyPreview.source}
              </Badge>
            </div>
            
            <div className="space-y-3 border rounded-md p-4">
              <div>
                <h4 className="text-sm font-medium text-gray-500">Title</h4>
                <p className="font-medium">{studyPreview.title}</p>
              </div>
              
              <div>
                <h4 className="text-sm font-medium text-gray-500">Authors</h4>
                <p>{studyPreview.authors}</p>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <h4 className="text-sm font-medium text-gray-500">Journal</h4>
                  <p>{studyPreview.journal}</p>
                </div>
                
                <div>
                  <h4 className="text-sm font-medium text-gray-500">Publication Date</h4>
                  <p>{studyPreview.publishDate}</p>
                </div>
              </div>
              
              {studyPreview.doi && (
                <div>
                  <h4 className="text-sm font-medium text-gray-500">DOI</h4>
                  <p>{studyPreview.doi}</p>
                </div>
              )}
              
              <div>
                <h4 className="text-sm font-medium text-gray-500">Abstract</h4>
                <p className="text-sm text-gray-700">{studyPreview.abstract}</p>
              </div>
            </div>
            
            <Button 
              onClick={() => importStudyMutation.mutate()} 
              disabled={importStudyMutation.isPending} 
              className="w-full"
              variant="default"
            >
              {importStudyMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Importing...
                </>
              ) : (
                <>
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Import Study
                </>
              )}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default UrlScraperForm;