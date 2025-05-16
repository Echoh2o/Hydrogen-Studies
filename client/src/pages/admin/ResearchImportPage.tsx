import { useState } from 'react';
import { Tab } from '@headlessui/react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import AdminLayout from '@/components/admin/AdminLayout';
import EuropePmcSearch from '@/components/admin/EuropePmcSearch';
import CrossRefSearch from '@/components/admin/CrossRefSearch';
import SemanticScholarSearch from '@/components/admin/SemanticScholarSearch';
import PubMedSearch from '@/components/admin/PubMedSearch';
import { Loader2, Search, Database, AlertCircle, RotateCw } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

function classNames(...classes: string[]) {
  return classes.filter(Boolean).join(' ');
}

export default function ResearchImportPage() {
  const { toast } = useToast();
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [urlToScrape, setUrlToScrape] = useState('');
  const [isScrapingUrl, setIsScrapingUrl] = useState(false);
  
  // Direct URL scraping mutation
  const scrapeUrlMutation = useMutation({
    mutationFn: async (url: string) => {
      const response = await apiRequest('POST', '/api/scraper/url', { url });
      return response.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        toast({
          title: "Study imported successfully",
          description: `${data.study.title} has been added to your database.`,
        });
      } else {
        toast({
          title: "Import failed",
          description: data.message || "Failed to scrape study from URL",
          variant: "destructive",
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Import failed",
        description: error.message || "Failed to scrape study from URL",
        variant: "destructive",
      });
    },
    onSettled: () => {
      setIsScrapingUrl(false);
    }
  });

  const handleScrapeUrl = () => {
    if (!urlToScrape) {
      toast({
        title: "URL required",
        description: "Please enter a URL to scrape",
        variant: "destructive",
      });
      return;
    }
    
    setIsScrapingUrl(true);
    scrapeUrlMutation.mutate(urlToScrape);
  };

  return (
    <AdminLayout 
      title="Research Import" 
      description="Search and import research from multiple academic databases"
    >
      <div className="space-y-6">
        {/* URL Scraper */}
        <Card>
          <CardContent className="p-6">
            <h3 className="text-lg font-medium mb-4">Direct URL Import</h3>
            <p className="text-sm text-gray-500 mb-4">
              Enter a URL from a supported source (PubMed, Europe PMC, CrossRef DOI, Semantic Scholar)
              to directly import that study.
            </p>
            
            <div className="flex space-x-2">
              <Input
                placeholder="Enter article URL (https://pubmed.ncbi.nlm.nih.gov/12345678/)"
                value={urlToScrape}
                onChange={(e) => setUrlToScrape(e.target.value)}
                className="flex-1"
              />
              <Button onClick={handleScrapeUrl} disabled={isScrapingUrl}>
                {isScrapingUrl ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Importing...
                  </>
                ) : (
                  <>
                    <Database className="mr-2 h-4 w-4" />
                    Import
                  </>
                )}
              </Button>
            </div>
            
            <div className="mt-3 flex items-center text-sm text-amber-700">
              <AlertCircle className="h-4 w-4 mr-1" />
              <span>Supported URLs: PubMed, Europe PMC, CrossRef DOI, Semantic Scholar</span>
            </div>
          </CardContent>
        </Card>
        
        {/* Database Search Tabs */}
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <Tab.Group selectedIndex={selectedIndex} onChange={setSelectedIndex}>
            <Tab.List className="flex border-b">
              <Tab 
                className={({ selected }) =>
                  classNames(
                    'py-4 px-6 text-sm font-medium focus:outline-none',
                    selected
                      ? 'border-b-2 border-primary text-primary'
                      : 'text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  )
                }
              >
                PubMed
              </Tab>
              <Tab 
                className={({ selected }) =>
                  classNames(
                    'py-4 px-6 text-sm font-medium focus:outline-none',
                    selected
                      ? 'border-b-2 border-primary text-primary'
                      : 'text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  )
                }
              >
                Europe PMC
              </Tab>
              <Tab 
                className={({ selected }) =>
                  classNames(
                    'py-4 px-6 text-sm font-medium focus:outline-none',
                    selected
                      ? 'border-b-2 border-primary text-primary'
                      : 'text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  )
                }
              >
                Semantic Scholar
              </Tab>
              <Tab 
                className={({ selected }) =>
                  classNames(
                    'py-4 px-6 text-sm font-medium focus:outline-none',
                    selected
                      ? 'border-b-2 border-primary text-primary'
                      : 'text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  )
                }
              >
                CrossRef DOI
              </Tab>
            </Tab.List>
            <Tab.Panels>
              {/* PubMed Search Panel */}
              <Tab.Panel className="p-6">
                <PubMedSearch />
              </Tab.Panel>
              
              {/* Europe PMC Search Panel */}
              <Tab.Panel className="p-6">
                <EuropePmcSearch />
              </Tab.Panel>
              
              {/* Semantic Scholar Search Panel */}
              <Tab.Panel className="p-6">
                <SemanticScholarSearch />
              </Tab.Panel>
              
              {/* CrossRef DOI Search Panel */}
              <Tab.Panel className="p-6">
                <CrossRefSearch />
              </Tab.Panel>
            </Tab.Panels>
          </Tab.Group>
        </div>
        
        {/* Recent Imports - Placeholder for future enhancement */}
        <Card>
          <CardContent className="p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium">Recent Imports</h3>
              <Button variant="outline" size="sm">
                <RotateCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
            </div>
            
            <div className="text-center py-8 text-gray-500">
              <Database className="h-12 w-12 mx-auto text-gray-300 mb-3" />
              <p>Your recent imports will appear here</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}