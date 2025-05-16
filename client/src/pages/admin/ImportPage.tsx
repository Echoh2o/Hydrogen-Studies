import React, { useState } from 'react';
import { ImportForm } from '@/components/admin/ImportForm';
import ExcelImportForm from '@/components/admin/ExcelImportForm';
import SimpleImportForm from '@/components/admin/SimpleImportForm';
import UrlScraperForm from '@/components/admin/UrlScraperForm';
import { Button } from '@/components/ui/button';
import { Link } from 'wouter';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from '@/hooks/use-toast';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Loader2 } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export default function ImportPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [scraperId, setScraperId] = useState<string | null>(null);
  
  // Mutation to start the scraper
  const startScraperMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/scraper/start");
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Scraper started",
        description: "The hydrogen studies scraper has been started successfully",
      });
      // Set a polling interval to check status
      queryClient.invalidateQueries({ queryKey: ['/api/scraper/status'] });
    },
    onError: (error) => {
      toast({
        title: "Failed to start scraper",
        description: error.message || "An error occurred while starting the scraper",
        variant: "destructive",
      });
    }
  });
  
  // Query to get scraper status
  const { data: scraperStatus, isLoading: isStatusLoading } = useQuery({
    queryKey: ['/api/scraper/status'],
    refetchInterval: scraperId ? 5000 : false, // Poll every 5 seconds if we have a scraper ID
    enabled: !!scraperId
  });
  
  const handleStartScraper = () => {
    startScraperMutation.mutate();
  };
  
  return (
    <div className="container mx-auto py-8 max-w-4xl">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Import Research Database</h1>
          <p className="text-muted-foreground mt-2">
            Import hydrogen research studies from Excel files and other sources
          </p>
        </div>
        <div>
          <Button variant="outline" asChild>
            <Link href="/admin">Back to Admin</Link>
          </Button>
        </div>
      </div>

      <div className="space-y-6">
        <Tabs defaultValue="simple" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="simple">Simple Import</TabsTrigger>
            <TabsTrigger value="excel">Excel Import</TabsTrigger>
            <TabsTrigger value="url">URL Scraper</TabsTrigger>
            <TabsTrigger value="general">General Import</TabsTrigger>
          </TabsList>
          
          <TabsContent value="simple" className="mt-4">
            <SimpleImportForm />
          </TabsContent>
          
          <TabsContent value="excel" className="mt-4">
            <ExcelImportForm />
          </TabsContent>
          
          <TabsContent value="url" className="mt-4">
            <UrlScraperForm />
          </TabsContent>
          
          <TabsContent value="general" className="mt-4">
            <ImportForm />
          </TabsContent>
        </Tabs>
        
        <div className="bg-muted p-4 rounded-lg">
          <h3 className="font-medium mb-2">Excel File Format Guide</h3>
          <p className="text-sm mb-3">
            Your Excel file should contain columns that match our database structure. The system supports
            specific column names from your Hydrogen Research Database format.
          </p>
          <div className="text-xs space-y-1">
            <p><strong>Required columns:</strong> Title, Abstract, Authors/First Author, Journal, Publish Date/Year</p>
            <p><strong>Optional columns:</strong> Primary Topic, Secondary Topic, Model, Category, Methods, Results, Conclusion, DOI, PDF URL, 
            Peer Reviewed, Country, Region, Study Type, Sample Size, Duration, Health Conditions, Body Systems</p>
          </div>
        </div>
        
        <div className="mt-8">
          <h2 className="text-xl font-semibold mb-4">Alternative Import Methods</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Button 
              variant="outline" 
              className="h-auto p-4 justify-start" 
              onClick={handleStartScraper}
              disabled={startScraperMutation.isPending || !!scraperId}
            >
              <div className="text-left flex items-center">
                {startScraperMutation.isPending && (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                )}
                <div>
                  <div className="font-medium">Run Hydrogen Studies Scraper</div>
                  <div className="text-sm text-muted-foreground">
                    Automatically discover and import studies from hydrogenstudies.com
                  </div>
                </div>
              </div>
            </Button>
            <Button variant="outline" className="h-auto p-4 justify-start" onClick={() => alert('Coming soon...')}>
              <div className="text-left">
                <div className="font-medium">Import from PubMed</div>
                <div className="text-sm text-muted-foreground">
                  Search and import studies directly from PubMed database
                </div>
              </div>
            </Button>
          </div>
          
          {scraperStatus && scraperStatus.status?.isRunning && (
            <div className="mt-4">
              <Alert>
                <AlertTitle>Scraper Running</AlertTitle>
                <AlertDescription>
                  <div className="text-sm">
                    {scraperStatus.status.current?.currentStep || 'Processing...'}
                    <div className="mt-2 text-xs">
                      Processed: {scraperStatus.status.current?.processedItems || 0} / 
                      {scraperStatus.status.current?.totalItems || '?'}
                      {scraperStatus.status.current?.successItems > 0 && 
                        ` (${scraperStatus.status.current.successItems} successful)`}
                    </div>
                  </div>
                </AlertDescription>
              </Alert>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}