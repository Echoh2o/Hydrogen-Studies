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
  FileDown 
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
      
      const response = await apiRequest(`/api/research/search?${queryParams}`);
      setSearchResults(response);
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
      return await apiRequest('/api/research/import', {
        method: 'POST',
        data: paperData
      });
    },
    onSuccess: (data) => {
      setImportedStudy(data.study);
      setShowSuccessDialog(true);
      queryClient.invalidateQueries({ queryKey: ['/api/studies'] });
      toast({
        title: 'Success',
        description: 'Study imported successfully',
        variant: 'default'
      });
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
      
      const response = await apiRequest(`/api/research/search?${queryParams}`);
      setSearchResults(response);
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
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="search">
            <Search className="mr-2 h-4 w-4" />
            Search
          </TabsTrigger>
          <TabsTrigger value="scheduled">
            <Clock className="mr-2 h-4 w-4" />
            Scheduled Searches
          </TabsTrigger>
          <TabsTrigger value="imported">
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
                      Found {searchResults.metadata?.total || 0} results for "{activeQuery}"
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
                {searchResults.data?.length === 0 ? (
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
                        {searchResults.data.map((paper: any) => {
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
        
        <TabsContent value="imported">
          <Card>
            <CardHeader>
              <CardTitle>Recently Imported Studies</CardTitle>
              <CardDescription>
                View and manage studies recently imported from research databases
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12">
                <Database className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">Recently Imported Studies</h3>
                <p className="text-muted-foreground max-w-md mx-auto">
                  This tab will show a list of studies recently imported from various research databases.
                </p>
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