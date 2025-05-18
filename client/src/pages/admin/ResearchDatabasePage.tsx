import { useState, useEffect } from 'react';
import { Helmet } from "react-helmet";
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'wouter';
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
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { DoiEnhancer } from '@/components/admin/DoiEnhancer';
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  ArrowLeft, 
  Search, 
  Loader2, 
  BookOpen, 
  BookOpenCheck, 
  BookCheck, 
  Database, 
  Clock, 
  AlertCircle, 
  CheckCircle2,
  FileDown,
  Upload,
  FileSpreadsheet,
  Table as TableIcon,
  FilePlus2,
  RefreshCw,
  FileCheck
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { queryClient } from '@/lib/queryClient';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Pagination } from '@/components/ui/pagination';

export default function ResearchDatabasePage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeQuery, setActiveQuery] = useState('');
  const [selectedPapers, setSelectedPapers] = useState<{[key: string]: any}>({});
  const [page, setPage] = useState(1);
  const [dataSource, setDataSource] = useState<string>('pubmed');
  const [searchResults, setSearchResults] = useState<any>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>('search');
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [importedStudy, setImportedStudy] = useState<any>(null);
  const [selectedDatabases, setSelectedDatabases] = useState<string[]>(['pubmed']);
  
  const pageSize = 10;
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const handleSearch = async () => {
    if (!searchQuery) return;
    
    setIsSearching(true);
    setSearchError(null);
    setActiveQuery(searchQuery);
    setPage(1);
    setSelectedPapers({});
    
    try {
      const queryParams = new URLSearchParams({
        query: searchQuery,
        page: '1',
        pageSize: pageSize.toString(),
        sources: selectedDatabases.join(',')
      });
      
      const response = await fetch(`/api/research/search?${queryParams}`, {
        method: 'GET',
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${await response.text() || response.statusText}`);
      }
      
      const data = await response.json();
      setSearchResults(data);
    } catch (error: any) {
      console.error('Search error:', error);
      setSearchError(error.message || 'Failed to search research databases');
      toast({
        title: 'Search Error',
        description: error.message || 'Failed to search research databases',
        variant: 'destructive'
      });
    } finally {
      setIsSearching(false);
    }
  };
  
  const importPaperMutation = useMutation({
    mutationFn: async (paperData: any) => {
      const response = await fetch('/api/research/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(paperData),
        credentials: 'include'
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || `Error ${response.status}: ${response.statusText}`);
      }
      
      return await response.json();
    },
    onSuccess: (data) => {
      if (data && data.study) {
        setImportedStudy(data.study);
        setShowSuccessDialog(true);
        queryClient.invalidateQueries({ queryKey: ['/api/studies'] });
        toast({
          title: 'Success',
          description: 'Study imported successfully',
          variant: 'default'
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to import study',
        variant: 'destructive'
      });
    }
  });
  
  const handleImport = (paper: any, source: string) => {
    const paperData = {
      ...paper,
      source
    };
    importPaperMutation.mutate(paperData);
  };
  
  const handlePageChange = async (newPage: number) => {
    setPage(newPage);
    setIsSearching(true);
    setSearchError(null);
    
    try {
      const queryParams = new URLSearchParams({
        query: activeQuery,
        page: newPage.toString(),
        pageSize: pageSize.toString(),
        sources: selectedDatabases.join(',')
      });
      
      const response = await fetch(`/api/research/search?${queryParams}`, {
        method: 'GET',
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${await response.text() || response.statusText}`);
      }
      
      const data = await response.json();
      setSearchResults(data);
    } catch (error: any) {
      console.error('Pagination error:', error);
      setSearchError(error.message || 'Failed to load page');
      toast({
        title: 'Error',
        description: error.message || 'Failed to load page',
        variant: 'destructive'
      });
    } finally {
      setIsSearching(false);
    }
  };
  
  const handleDatabaseChange = (checked: boolean, value: string) => {
    setSelectedDatabases(prev => {
      if (checked) {
        return [...prev, value];
      } else {
        return prev.filter(db => db !== value);
      }
    });
  };
  
  const togglePaperSelection = (paperId: string, paper: any) => {
    setSelectedPapers(prev => {
      const newSelection = {...prev};
      if (newSelection[paperId]) {
        delete newSelection[paperId];
      } else {
        newSelection[paperId] = paper;
      }
      return newSelection;
    });
  };
  
  const renderPagination = () => {
    if (!searchResults) return null;
    
    const totalResults = searchResults.metadata?.total || 0;
    const totalPages = Math.ceil(totalResults / pageSize);
    
    if (totalPages <= 1) return null;
    
    return (
      <Pagination 
        currentPage={page}
        totalPages={totalPages}
        onPageChange={handlePageChange}
      />
    );
  };
  
  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Research Database Search</h1>
          <p className="text-muted-foreground mt-1">
            Search across multiple research databases for hydrogen studies
          </p>
        </div>
        <Link href="/admin">
          <Button variant="outline" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Button>
        </Link>
      </div>
      
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3 md:grid-cols-5">
          <TabsTrigger value="search">
            <Search className="mr-2 h-4 w-4" />
            <span className="hidden md:inline">Search</span>
            <span className="md:hidden">Search</span>
          </TabsTrigger>
          <TabsTrigger value="excel">
            <FileDown className="mr-2 h-4 w-4" />
            <span className="hidden md:inline">Excel Import</span>
            <span className="md:hidden">Excel</span>
          </TabsTrigger>
          <TabsTrigger value="data-quality">
            <FileCheck className="mr-2 h-4 w-4" />
            <span className="hidden md:inline">Data Quality</span>
            <span className="md:hidden">Quality</span>
          </TabsTrigger>
          <TabsTrigger value="scheduled" className="hidden md:flex">
            <Clock className="mr-2 h-4 w-4" />
            Scheduled Searches
          </TabsTrigger>
          <TabsTrigger value="imported" className="hidden md:flex">
            <Database className="mr-2 h-4 w-4" />
            Imported Studies
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="search" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Search Databases</CardTitle>
              <CardDescription>
                Search across multiple scientific databases for hydrogen research
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-medium mb-2">Select Databases</h3>
                  <div className="flex flex-wrap gap-4">
                    <div className="flex items-center space-x-2">
                      <Checkbox 
                        id="pubmed"
                        checked={selectedDatabases.includes('pubmed')}
                        onCheckedChange={(checked) => 
                          handleDatabaseChange(checked as boolean, 'pubmed')
                        }
                      />
                      <Label htmlFor="pubmed">PubMed</Label>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <Checkbox 
                        id="europepmc"
                        checked={selectedDatabases.includes('europepmc')}
                        onCheckedChange={(checked) => 
                          handleDatabaseChange(checked as boolean, 'europepmc')
                        }
                      />
                      <Label htmlFor="europepmc">Europe PMC</Label>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <Checkbox 
                        id="semanticscholar"
                        checked={selectedDatabases.includes('semanticscholar')}
                        onCheckedChange={(checked) => 
                          handleDatabaseChange(checked as boolean, 'semanticscholar')
                        }
                      />
                      <Label htmlFor="semanticscholar">Semantic Scholar</Label>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <Checkbox 
                        id="crossref"
                        checked={selectedDatabases.includes('crossref')}
                        onCheckedChange={(checked) => 
                          handleDatabaseChange(checked as boolean, 'crossref')
                        }
                      />
                      <Label htmlFor="crossref">CrossRef</Label>
                    </div>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="search-query">Search Query</Label>
                  <div className="flex">
                    <Input
                      id="search-query"
                      placeholder="E.g., hydrogen therapy cancer, hydrogen water inflammation"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                      className="flex-1"
                    />
                    <Button 
                      onClick={handleSearch}
                      disabled={isSearching || !searchQuery || selectedDatabases.length === 0}
                      className="ml-2"
                    >
                      {isSearching ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Search className="mr-2 h-4 w-4" />
                      )}
                      Search
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Tip: The search will automatically include hydrogen-related terms if not specified
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          {isSearching ? (
            <div className="flex justify-center items-center h-40">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <span className="ml-3 text-lg">Searching databases...</span>
            </div>
          ) : searchError ? (
            <Card className="border-destructive">
              <CardContent className="pt-6">
                <div className="flex items-center text-destructive">
                  <AlertCircle className="h-5 w-5 mr-2" />
                  <h3 className="font-medium">Error searching databases</h3>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{searchError}</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSearch}
                  className="mt-4"
                >
                  Try Again
                </Button>
              </CardContent>
            </Card>
          ) : searchResults ? (
            <Card>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle>Search Results</CardTitle>
                    <CardDescription>
                      Found {searchResults.total || 0} results for "{activeQuery}"
                    </CardDescription>
                  </div>
                  
                  {Object.keys(selectedPapers).length > 0 && (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        // Implement batch import
                        toast({
                          title: "Batch Import",
                          description: `Importing ${Object.keys(selectedPapers).length} selected papers`,
                        });
                      }}
                    >
                      <FileDown className="mr-2 h-4 w-4" />
                      Import Selected ({Object.keys(selectedPapers).length})
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {!searchResults.articles || searchResults.articles.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    No results found for your search query
                  </div>
                ) : (
                  <>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[5%]"></TableHead>
                          <TableHead className="w-[40%]">Title</TableHead>
                          <TableHead className="w-[25%]">Authors</TableHead>
                          <TableHead className="w-[10%]">Year</TableHead>
                          <TableHead className="w-[10%]">Source</TableHead>
                          <TableHead className="w-[10%]">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {searchResults.articles.map((paper: any) => {
                          const paperId = paper.id || paper.paperId || paper.pmid || `${paper.source}-${paper.title}`;
                          return (
                            <TableRow key={paperId} className={selectedPapers[paperId] ? "bg-primary/5" : ""}>
                              <TableCell>
                                <Checkbox 
                                  checked={!!selectedPapers[paperId]}
                                  onCheckedChange={(checked) => 
                                    togglePaperSelection(paperId, paper)
                                  }
                                />
                              </TableCell>
                              <TableCell className="font-medium">{paper.title}</TableCell>
                              <TableCell>
                                {paper.authors || paper.authorString || "Unknown"}
                              </TableCell>
                              <TableCell>
                                {paper.year || paper.pubYear || (paper.publishDate && paper.publishDate.split('-')[0]) || "Unknown"}
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline">
                                  {paper.source || "Unknown"}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleImport(paper, paper.source)}
                                  disabled={importPaperMutation.isPending}
                                >
                                  {importPaperMutation.isPending ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    "Import"
                                  )}
                                </Button>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                    
                    <div className="mt-4 flex justify-center">
                      {renderPagination()}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          ) : null}
        </TabsContent>
        
        <TabsContent value="excel">
          <Card>
            <CardHeader>
              <CardTitle>Excel & Spreadsheet Import</CardTitle>
              <CardDescription>
                Import hydrogen studies from Excel, CSV, or Google Sheets
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-6 md:grid-cols-2">
                <div className="flex flex-col space-y-4 border rounded-lg p-4">
                  <div className="flex items-center space-x-2">
                    <FileSpreadsheet className="h-5 w-5 text-primary" />
                    <h3 className="text-lg font-medium">Upload Excel File</h3>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Upload Excel (.xlsx) or CSV files containing research data
                  </p>
                  <div className="grid w-full max-w-sm items-center gap-1.5">
                    <Label htmlFor="file-upload">File</Label>
                    <Input
                      id="file-upload"
                      type="file"
                      accept=".xlsx,.csv"
                      className="cursor-pointer"
                    />
                    <p className="text-xs text-muted-foreground">
                      Max file size: 10MB
                    </p>
                  </div>
                  <Button className="w-full mt-2">
                    <Upload className="mr-2 h-4 w-4" />
                    Upload & Analyze
                  </Button>
                </div>

                <div className="flex flex-col space-y-4 border rounded-lg p-4">
                  <div className="flex items-center space-x-2">
                    <TableIcon className="h-5 w-5 text-primary" />
                    <h3 className="text-lg font-medium">Google Sheets Import</h3>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Import studies directly from a Google Sheets document
                  </p>
                  <div className="grid w-full max-w-sm items-center gap-1.5">
                    <Label htmlFor="sheets-url">Google Sheets URL</Label>
                    <Input
                      id="sheets-url"
                      type="url"
                      placeholder="https://docs.google.com/spreadsheets/d/..."
                    />
                    <p className="text-xs text-muted-foreground">
                      Spreadsheet must be publicly accessible or shared
                    </p>
                  </div>
                  <Button className="w-full mt-2">
                    <TableIcon className="mr-2 h-4 w-4" />
                    Connect & Import
                  </Button>
                </div>
              </div>

              <div className="border rounded-lg p-4 space-y-4">
                <div className="flex items-center space-x-2">
                  <FilePlus2 className="h-5 w-5 text-primary" />
                  <h3 className="text-lg font-medium">Column Mapping & Advanced Options</h3>
                </div>
                <p className="text-sm text-muted-foreground">
                  Configure how your spreadsheet data maps to study fields
                </p>
                
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <Label className="text-sm">Required Fields</Label>
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      <div className="flex items-center space-x-2 text-sm">
                        <span className="font-medium">Title</span>
                        <Select defaultValue="title">
                          <SelectTrigger className="h-8">
                            <SelectValue placeholder="Map to column" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="title">Title</SelectItem>
                            <SelectItem value="study_title">Study Title</SelectItem>
                            <SelectItem value="paper_title">Paper Title</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex items-center space-x-2 text-sm">
                        <span className="font-medium">Authors</span>
                        <Select defaultValue="authors">
                          <SelectTrigger className="h-8">
                            <SelectValue placeholder="Map to column" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="authors">Authors</SelectItem>
                            <SelectItem value="researcher">Researcher</SelectItem>
                            <SelectItem value="author_list">Author List</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                  
                  <div>
                    <Label className="text-sm">Optional Fields</Label>
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      <div className="flex items-center space-x-2 text-sm">
                        <span className="font-medium">DOI</span>
                        <Select defaultValue="doi">
                          <SelectTrigger className="h-8">
                            <SelectValue placeholder="Map to column" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="doi">DOI</SelectItem>
                            <SelectItem value="digital_id">Digital ID</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex items-center space-x-2 text-sm">
                        <span className="font-medium">PMID</span>
                        <Select defaultValue="pmid">
                          <SelectTrigger className="h-8">
                            <SelectValue placeholder="Map to column" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pmid">PMID</SelectItem>
                            <SelectItem value="pubmed_id">PubMed ID</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center space-x-4 mt-4">
                  <Checkbox id="auto-enrich" />
                  <div className="grid gap-1.5 leading-none">
                    <Label
                      htmlFor="auto-enrich"
                      className="text-sm font-medium leading-none"
                    >
                      Auto-enrich from multiple sources
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Automatically fetch missing study data from PubMed, Europe PMC, and other sources
                    </p>
                  </div>
                </div>
                
                <div className="flex justify-end space-x-2 mt-4">
                  <Button variant="outline">Reset</Button>
                  <Button>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Update Mapping
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="scheduled">
          <Card>
            <CardHeader>
              <CardTitle>Scheduled Searches</CardTitle>
              <CardDescription>
                Set up automated searches to run at scheduled intervals
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12">
                <Clock className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">Scheduled Searches Coming Soon</h3>
                <p className="text-muted-foreground max-w-md mx-auto">
                  This feature will allow you to schedule regular automated searches across multiple databases for hydrogen research.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="data-quality">
          <DoiEnhancer />
        </TabsContent>
        
        <TabsContent value="imported">
          <Card>
            <CardHeader>
              <CardTitle>Recently Imported Studies</CardTitle>
              <CardDescription>
                View and manage studies recently imported from research databases
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <div className="flex gap-2">
                    <Select defaultValue="all">
                      <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Filter by source" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Sources</SelectItem>
                        <SelectItem value="pubmed">PubMed</SelectItem>
                        <SelectItem value="europepmc">Europe PMC</SelectItem>
                        <SelectItem value="semanticscholar">Semantic Scholar</SelectItem>
                        <SelectItem value="crossref">CrossRef</SelectItem>
                        <SelectItem value="excel">Excel Import</SelectItem>
                      </SelectContent>
                    </Select>
                    
                    <Select defaultValue="recent">
                      <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Sort by" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="recent">Most Recent</SelectItem>
                        <SelectItem value="title">Title (A-Z)</SelectItem>
                        <SelectItem value="date">Publication Date</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <Button variant="outline" size="sm" className="flex items-center gap-1">
                    <RefreshCw className="h-4 w-4" />
                    Refresh
                  </Button>
                </div>
                
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[40%]">Title</TableHead>
                      <TableHead className="w-[20%]">Authors</TableHead>
                      <TableHead className="w-[15%]">Source</TableHead>
                      <TableHead className="w-[15%]">Imported Date</TableHead>
                      <TableHead className="w-[10%]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell className="font-medium">
                        Hydrogen-rich saline alleviates early brain injury via reducing oxidative stress and brain edema
                      </TableCell>
                      <TableCell>Wang C, Li J, Liu Q, et al.</TableCell>
                      <TableCell>
                        <Badge variant="outline">PubMed</Badge>
                      </TableCell>
                      <TableCell>5 min ago</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <BookOpen className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">
                        Molecular hydrogen reduces LPS-induced neuroinflammation
                      </TableCell>
                      <TableCell>Chen H, Xie K, Han H</TableCell>
                      <TableCell>
                        <Badge variant="outline">CrossRef</Badge>
                      </TableCell>
                      <TableCell>10 min ago</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <BookOpen className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">
                        Hydrogen as a novel therapeutic agent in Cerebral Vascular Disease
                      </TableCell>
                      <TableCell>Yang M, Dong Y, He Q, et al.</TableCell>
                      <TableCell>
                        <Badge variant="outline">Excel Import</Badge>
                      </TableCell>
                      <TableCell>25 min ago</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <BookOpen className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
                
                <div className="flex items-center justify-between">
                  <div className="text-sm text-muted-foreground">
                    Showing 3 of 48 recent imports
                  </div>
                  <div className="flex">
                    <Button variant="outline" size="sm" disabled>
                      Previous
                    </Button>
                    <Button variant="outline" size="sm" className="ml-2">
                      Next
                    </Button>
                  </div>
                </div>
                
                <div className="mt-6 border rounded-lg p-4">
                  <div className="flex items-center space-x-2">
                    <RefreshCw className="h-5 w-5 text-primary" />
                    <h3 className="text-lg font-medium">Multi-Source Enrichment</h3>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    Enhance existing studies by pulling in missing data from all available research databases
                  </p>
                  
                  <div className="mt-4 flex flex-wrap gap-2">
                    <div className="flex items-center space-x-2">
                      <Checkbox id="enrich-pubmed" defaultChecked />
                      <Label htmlFor="enrich-pubmed">PubMed</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox id="enrich-europepmc" defaultChecked />
                      <Label htmlFor="enrich-europepmc">Europe PMC</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox id="enrich-semantic" defaultChecked />
                      <Label htmlFor="enrich-semantic">Semantic Scholar</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox id="enrich-crossref" defaultChecked />
                      <Label htmlFor="enrich-crossref">CrossRef</Label>
                    </div>
                  </div>
                  
                  <div className="mt-4">
                    <Button className="w-full">
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Start Multi-Source Enrichment
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      
      <AlertDialog open={showSuccessDialog} onOpenChange={setShowSuccessDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center text-primary">
              <CheckCircle2 className="mr-2 h-5 w-5" />
              Paper Imported Successfully
            </AlertDialogTitle>
            <AlertDialogDescription>
              The paper has been added to your hydrogen studies database and is now available for viewing.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {importedStudy && (
            <div className="bg-muted/50 p-4 rounded-md my-4">
              <p className="font-medium">{importedStudy.title}</p>
              <p className="text-sm text-muted-foreground mt-1">{importedStudy.authors}</p>
              <p className="text-sm mt-3">
                <span className="font-medium">Category:</span> {importedStudy.category}
              </p>
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => {
              setShowSuccessDialog(false);
            }}>
              Continue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}