import { useState } from 'react';
import { Helmet } from 'react-helmet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import AdminLayout from '@/components/admin/AdminLayout';
import UrlScraperForm from '@/components/admin/UrlScraperForm';
import PubMedSearch from '@/components/admin/PubMedSearch';
import EuropePmcSearch from '@/components/admin/EuropePmcSearch';
import CrossRefSearch from '@/components/admin/CrossRefSearch';
import SemanticScholarSearch from '@/components/admin/SemanticScholarSearch';
import { AlertCircle, Link as LinkIcon, FileSearch } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export default function ResearchImportPage() {
  const [activeTab, setActiveTab] = useState('url');
  
  return (
    <AdminLayout title="Research Import" description="Import research from various sources">
      <Helmet>
        <title>Research Import | HydrogenStudies Admin</title>
      </Helmet>
      
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Research Import</h2>
          <p className="text-muted-foreground">
            Import hydrogen research studies from external sources
          </p>
        </div>
        
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Research Platform Status</AlertTitle>
          <AlertDescription>
            ✅ **PubMed** - Fully operational with authentic research data<br/>
            ⚠️ **Europe PMC, CrossRef, Semantic Scholar** - Connected but may need API authentication<br/>
            Start with PubMed to search and import hydrogen studies with complete metadata.
          </AlertDescription>
        </Alert>
        
        <Tabs defaultValue="url" value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="grid grid-cols-2 md:grid-cols-5 lg:w-auto">
            <TabsTrigger value="url" className="flex items-center gap-2">
              <LinkIcon className="h-4 w-4" />
              <span>URL Scraper</span>
            </TabsTrigger>
            <TabsTrigger value="pubmed" className="flex items-center gap-2">
              <FileSearch className="h-4 w-4" />
              <span>PubMed</span>
            </TabsTrigger>
            <TabsTrigger value="europepmc" className="flex items-center gap-2">
              <FileSearch className="h-4 w-4" />
              <span>Europe PMC</span>
            </TabsTrigger>
            <TabsTrigger value="crossref" className="flex items-center gap-2">
              <FileSearch className="h-4 w-4" />
              <span>CrossRef</span>
            </TabsTrigger>
            <TabsTrigger value="semanticscholar" className="flex items-center gap-2">
              <FileSearch className="h-4 w-4" />
              <span>Semantic Scholar</span>
            </TabsTrigger>
          </TabsList>
          
          <Card>
            <CardHeader>
              <CardTitle>
                {activeTab === 'url' && 'URL Scraper'}
                {activeTab === 'pubmed' && 'PubMed Search'}
                {activeTab === 'europepmc' && 'Europe PMC Search'}
                {activeTab === 'crossref' && 'CrossRef Search'}
                {activeTab === 'semanticscholar' && 'Semantic Scholar Search'}
              </CardTitle>
              <CardDescription>
                {activeTab === 'url' && 'Import a study by pasting its URL from any supported platform'}
                {activeTab === 'pubmed' && 'Search and import studies from PubMed database'}
                {activeTab === 'europepmc' && 'Search and import studies from Europe PMC database'}
                {activeTab === 'crossref' && 'Search and import studies from CrossRef database'}
                {activeTab === 'semanticscholar' && 'Search and import studies from Semantic Scholar database'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <TabsContent value="url" className="mt-0">
                <UrlScraperForm />
              </TabsContent>
              
              <TabsContent value="pubmed" className="mt-0">
                <PubMedSearch />
              </TabsContent>
              
              <TabsContent value="europepmc" className="mt-0">
                <EuropePmcSearch />
              </TabsContent>
              
              <TabsContent value="crossref" className="mt-0">
                <CrossRefSearch />
              </TabsContent>
              
              <TabsContent value="semanticscholar" className="mt-0">
                <SemanticScholarSearch />
              </TabsContent>
            </CardContent>
          </Card>
        </Tabs>
        
        <div className="space-y-4">
          <Separator />
          <h3 className="text-lg font-medium">Supported Platforms</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="p-4 border rounded-lg">
              <h4 className="font-medium">PubMed</h4>
              <p className="text-sm text-muted-foreground">Biomedical literature, citations, abstracts</p>
            </div>
            <div className="p-4 border rounded-lg">
              <h4 className="font-medium">Europe PMC</h4>
              <p className="text-sm text-muted-foreground">Life sciences research and literature</p>
            </div>
            <div className="p-4 border rounded-lg">
              <h4 className="font-medium">CrossRef</h4>
              <p className="text-sm text-muted-foreground">DOI-registered academic publications</p>
            </div>
            <div className="p-4 border rounded-lg">
              <h4 className="font-medium">Semantic Scholar</h4>
              <p className="text-sm text-muted-foreground">AI-powered scientific research papers</p>
            </div>
            <div className="p-4 border rounded-lg">
              <h4 className="font-medium">CORE API</h4>
              <p className="text-sm text-muted-foreground">Open access research papers</p>
            </div>
            <div className="p-4 border rounded-lg">
              <h4 className="font-medium">arXiv</h4>
              <p className="text-sm text-muted-foreground">Pre-print archive for scientific papers</p>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}