import { useRef, useState } from "react";
import { Helmet } from "react-helmet";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Study } from "@/types";
import { Loader2, Upload, RefreshCw, Database, FileText, Search, BookOpen } from "lucide-react";
import StudyForm from "@/components/admin/StudyForm";
import StudyTable from "@/components/admin/StudyTable";
import BlogsAdmin from "@/pages/admin/BlogsAdmin";

export default function AdminPage() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("dashboard");
  const [isImporting, setIsImporting] = useState(false);
  const [isScraping, setIsScraping] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  
  // Fetch studies count for the dashboard
  const { data: studies = [] } = useQuery<Study[]>({
    queryKey: ['/api/studies'],
    staleTime: 60000, // 1 minute
    enabled: activeTab === "dashboard"
  });
  
  const { data: categories = [] } = useQuery({
    queryKey: ['/api/categories'],
    staleTime: 60000, // 1 minute
    enabled: activeTab === "dashboard"
  });
  
  // Import file mutation
  const importFileMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const response = await apiRequest("POST", "/api/admin/import", formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Import successful",
        description: `Successfully imported ${data.success} out of ${data.total} studies.`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/studies'] });
    },
    onError: (error) => {
      toast({
        title: "Import failed",
        description: error.message || "Failed to import studies",
        variant: "destructive",
      });
    },
    onSettled: () => {
      setIsImporting(false);
    }
  });
  
  // Web scrape mutation
  const scrapeMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/admin/scrape");
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Scraping successful",
        description: `Successfully scraped ${data.success} out of ${data.total} studies.`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/studies'] });
    },
    onError: (error) => {
      toast({
        title: "Scraping failed",
        description: error.message || "Failed to scrape studies",
        variant: "destructive",
      });
    },
    onSettled: () => {
      setIsScraping(false);
    }
  });
  
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const formData = new FormData();
    formData.append('file', file);
    
    // Determine file type from extension
    const fileType = file.name.endsWith('.csv') 
      ? 'csv' 
      : file.name.endsWith('.json') 
        ? 'json' 
        : '';
        
    if (!fileType) {
      toast({
        title: "Invalid file format",
        description: "Please upload a CSV or JSON file",
        variant: "destructive",
      });
      return;
    }
    
    formData.append('fileType', fileType);
    setIsImporting(true);
    importFileMutation.mutate(formData);
  };
  
  const handleScrapeWebsite = () => {
    setIsScraping(true);
    scrapeMutation.mutate();
  };
  
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    // Update query
    queryClient.invalidateQueries({ queryKey: ['/api/studies', searchQuery] });
  };
  
  const refreshData = () => {
    queryClient.invalidateQueries({ queryKey: ['/api/studies'] });
    queryClient.invalidateQueries({ queryKey: ['/api/categories'] });
  };
  
  return (
    <>
      <Helmet>
        <title>Admin Dashboard - Hydrogen Studies</title>
      </Helmet>
      
      <div className="bg-neutral-100 py-8 min-h-screen">
        <div className="container mx-auto px-4">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-3xl font-bold">Admin Dashboard</h1>
            <Button 
              variant="outline" 
              size="sm"
              onClick={refreshData}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh Data
            </Button>
          </div>
          
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="grid grid-cols-6 gap-2">
              <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
              <TabsTrigger value="studies">Manage Studies</TabsTrigger>
              <TabsTrigger value="blogs">Manage Blogs</TabsTrigger>
              <TabsTrigger value="import">Import Data</TabsTrigger>
              <TabsTrigger value="add">Add Study</TabsTrigger>
              <TabsTrigger asChild>
                <Link href="/admin/researchdb">Research Database</Link>
              </TabsTrigger>
            </TabsList>
            
            {/* Dashboard Tab */}
            <TabsContent value="dashboard" className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle>Total Studies</CardTitle>
                    <CardDescription>Number of studies in the database</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-4xl font-bold text-primary">{studies.length}</div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle>Categories</CardTitle>
                    <CardDescription>Available research categories</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-4xl font-bold text-primary">{categories.length}</div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle>Peer Reviewed</CardTitle>
                    <CardDescription>Studies with peer review</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-4xl font-bold text-primary">
                      {studies.filter(s => s.peerReviewed).length}
                    </div>
                  </CardContent>
                </Card>
              </div>
              
              <Card>
                <CardHeader>
                  <CardTitle>Recent Studies</CardTitle>
                  <CardDescription>Latest studies added to the database</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {studies.slice(0, 5).map(study => (
                      <div key={study.id} className="border-b pb-2">
                        <div className="font-medium">{study.title}</div>
                        <div className="text-sm text-neutral-500">
                          {study.authors} • {new Date(study.publishDate).toLocaleDateString()}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
            
            {/* Manage Studies Tab */}
            <TabsContent value="studies" className="space-y-6">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle>Manage Studies</CardTitle>
                  <CardDescription>Search, edit or delete studies in the database</CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSearch} className="mb-6 flex">
                    <Input
                      placeholder="Search studies..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="mr-2"
                    />
                    <Button type="submit">
                      <Search className="h-4 w-4 mr-2" />
                      Search
                    </Button>
                  </form>
                  
                  <StudyTable searchQuery={searchQuery} />
                </CardContent>
              </Card>
            </TabsContent>
            
            {/* Import Data Tab */}
            <TabsContent value="import" className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Import from File</CardTitle>
                    <CardDescription>Import studies from a CSV or JSON file</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <p className="text-sm text-neutral-600">
                        Upload a CSV or JSON file containing study data. The file should 
                        have columns/fields matching the study schema (title, abstract, authors, etc).
                      </p>
                      
                      <div className="flex flex-col items-center justify-center border-2 border-dashed rounded-md p-6">
                        <FileText className="h-10 w-10 text-neutral-400 mb-2" />
                        <p className="text-sm text-neutral-500 mb-4">Upload a CSV or JSON file</p>
                        <Input
                          type="file"
                          ref={fileInputRef}
                          className="hidden"
                          accept=".csv,.json"
                          onChange={handleFileUpload}
                        />
                        <div className="space-y-2">
                          <Button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={isImporting}
                          >
                            {isImporting ? (
                              <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Importing...
                              </>
                            ) : (
                              <>
                                <Upload className="h-4 w-4 mr-2" />
                                Upload File
                              </>
                            )}
                          </Button>
                          
                          <Button 
                            variant="outline" 
                            className="ml-2" 
                            onClick={() => window.location.href = '/admin/import'}
                          >
                            Import Excel Format
                          </Button>
                        </div>
                      </div>
                      
                      <div className="mt-4 text-sm text-blue-600">
                        <a href="/admin/import" className="hover:underline">
                          Advanced Excel Import →
                        </a>
                        <p className="text-xs text-neutral-500 mt-1">
                          Use our specialized Excel importer for hydrogen research databases
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader>
                    <CardTitle>Research Database Search</CardTitle>
                    <CardDescription>Import studies from PubMed, Europe PMC, and other research sources</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <p className="text-sm text-neutral-600">
                        Search for hydrogen-related research articles in major academic databases.
                        You can review and approve articles before adding them to your database.
                      </p>
                      
                      <div className="flex flex-col items-center justify-center border-2 border-dashed rounded-md p-6">
                        <Search className="h-10 w-10 text-neutral-400 mb-2" />
                        <p className="text-sm text-neutral-500 mb-4">Search for hydrogen research articles</p>
                        <div className="space-y-2">
                          <Button
                            type="button"
                            className="w-full"
                            onClick={() => window.location.href = '/admin/articles'}
                          >
                            <Search className="h-4 w-4 mr-2" />
                            Search PubMed Articles
                          </Button>
                          
                          <Button
                            type="button"
                            className="w-full"
                            variant="outline"
                            onClick={() => window.location.href = '/admin/europepmc'}
                          >
                            <BookOpen className="h-4 w-4 mr-2" />
                            Europe PMC Search
                          </Button>
                          
                          <Button
                            type="button"
                            className="w-full"
                            variant="outline"
                            onClick={() => window.location.href = '/admin/semanticscholar'}
                          >
                            <BookOpen className="h-4 w-4 mr-2" />
                            Semantic Scholar Search
                          </Button>
                          
                          <Button
                            type="button"
                            className="w-full"
                            variant="outline"
                            onClick={() => window.location.href = '/admin/crossref'}
                          >
                            <BookOpen className="h-4 w-4 mr-2" />
                            CrossRef DOI Search
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader>
                    <CardTitle>Scrape Website</CardTitle>
                    <CardDescription>Import studies from the original website</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <p className="text-sm text-neutral-600">
                        Automatically scrape study data from the original hydrogen studies website.
                        This process will run in the background and may take several minutes depending
                        on the number of studies.
                      </p>
                      
                      <div className="flex flex-col items-center justify-center border-2 border-dashed rounded-md p-6">
                        <Database className="h-10 w-10 text-neutral-400 mb-2" />
                        <p className="text-sm text-neutral-500 mb-4">Start the scraping process</p>
                        <Button
                          type="button"
                          onClick={handleScrapeWebsite}
                          disabled={isScraping}
                        >
                          {isScraping ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Scraping...
                            </>
                          ) : (
                            <>
                              <Database className="h-4 w-4 mr-2" />
                              Start Scraping
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
              
              <Card>
                <CardHeader>
                  <CardTitle>Import Instructions</CardTitle>
                  <CardDescription>Guidelines for importing study data</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <h3 className="font-semibold">CSV Format</h3>
                      <p className="text-sm text-neutral-600">
                        The CSV file should have the following columns:
                      </p>
                      <code className="text-xs block bg-neutral-100 p-2 rounded-md mt-2 overflow-x-auto">
                        title,abstract,authors,journal,publishDate,category,methods,results,conclusion,doi,pdfUrl,citationUrl,peerReviewed
                      </code>
                    </div>
                    
                    <div>
                      <h3 className="font-semibold">JSON Format</h3>
                      <p className="text-sm text-neutral-600">
                        The JSON file should contain an array of study objects with the following structure:
                      </p>
                      <code className="text-xs block bg-neutral-100 p-2 rounded-md mt-2 overflow-x-auto">
                        {`[
  {
    "title": "Study Title",
    "abstract": "Study abstract text...",
    "authors": "Author names",
    "journal": "Journal name",
    "publishDate": "2023-01-01",
    "category": "Category name",
    "methods": "Methods description",
    "results": "Results description",
    "conclusion": "Conclusion text",
    "doi": "DOI identifier",
    "pdfUrl": "https://example.com/study.pdf",
    "citationUrl": "https://example.com/citation",
    "peerReviewed": true
  }
]`}
                      </code>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
            
            {/* Blog Management Tab */}
            <TabsContent value="blogs" className="space-y-6">
              <BlogsAdmin />
            </TabsContent>
            
            {/* Add Study Tab */}
            <TabsContent value="add" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Add New Study</CardTitle>
                  <CardDescription>Create a new study entry</CardDescription>
                </CardHeader>
                <CardContent>
                  <StudyForm />
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </>
  );
}