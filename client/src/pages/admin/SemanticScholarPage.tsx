import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
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
import { Loader2, Search, FileImport, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { Pagination } from '@/components/ui/pagination';

export default function SemanticScholarPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeQuery, setActiveQuery] = useState('');
  const [page, setPage] = useState(0);
  const [selectedPaper, setSelectedPaper] = useState<any>(null);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [importedStudy, setImportedStudy] = useState<any>(null);
  
  const pageSize = 10;
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Search query
  const { 
    data: searchResults, 
    isLoading: isSearching,
    error: searchError
  } = useQuery({
    queryKey: ['/api/semanticscholar/search', activeQuery, page, pageSize],
    queryFn: async () => {
      if (!activeQuery) return { total: 0, data: [] };
      const response = await apiRequest(`/api/semanticscholar/search?query=${encodeURIComponent(activeQuery)}&page=${page}&pageSize=${pageSize}`);
      return response;
    },
    enabled: !!activeQuery
  });
  
  // Paper details query
  const {
    data: paperDetails,
    isLoading: isLoadingPaper,
    error: paperError
  } = useQuery({
    queryKey: ['/api/semanticscholar/paper', selectedPaper?.paperId],
    queryFn: async () => {
      if (!selectedPaper?.paperId) return null;
      const response = await apiRequest(`/api/semanticscholar/paper/${selectedPaper.paperId}`);
      return response;
    },
    enabled: !!selectedPaper?.paperId
  });
  
  // Import paper mutation
  const importPaperMutation = useMutation({
    mutationFn: async (paperId: string) => {
      return await apiRequest('/api/semanticscholar/import', {
        method: 'POST',
        data: { id: paperId }
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
  
  // Preview paper mutation
  const previewPaperMutation = useMutation({
    mutationFn: async (paperId: string) => {
      return await apiRequest('/api/semanticscholar/preview', {
        method: 'POST',
        data: { id: paperId }
      });
    },
    onSuccess: (data) => {
      setSelectedPaper(data.paperData);
    },
    onError: (error: any) => {
      if (error.status === 409) {
        toast({
          title: 'Paper already exists',
          description: 'This paper is already in your database',
          variant: 'default'
        });
      } else {
        toast({
          title: 'Error',
          description: error.message || 'Failed to preview paper',
          variant: 'destructive'
        });
      }
    }
  });
  
  // Handle search
  const handleSearch = () => {
    setActiveQuery(searchQuery);
    setPage(0);
  };
  
  // Handle preview
  const handlePreview = (paper: any) => {
    previewPaperMutation.mutate(paper.paperId);
  };
  
  // Handle import
  const handleImport = () => {
    if (selectedPaper?.paperId) {
      importPaperMutation.mutate(selectedPaper.paperId);
    }
  };
  
  // Calculate pagination
  const totalResults = searchResults?.total || 0;
  const totalPages = Math.ceil(totalResults / pageSize);
  
  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex flex-col space-y-2">
        <h1 className="text-3xl font-bold">Semantic Scholar Integration</h1>
        <p className="text-muted-foreground">
          Search and import hydrogen research papers from Semantic Scholar's database of scientific literature.
        </p>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle>Search Papers</CardTitle>
          <CardDescription>
            Enter keywords to search for relevant hydrogen research papers. The search will automatically include hydrogen-related terms if not specified.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <div className="flex-1">
              <Label htmlFor="search-query">Search Query</Label>
              <div className="flex mt-2">
                <Input
                  id="search-query"
                  placeholder="E.g., molecular hydrogen inflammation"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                />
                <Button 
                  className="ml-2" 
                  onClick={handleSearch}
                  disabled={!searchQuery || isSearching}
                >
                  {isSearching ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Search className="mr-2 h-4 w-4" />
                  )}
                  Search
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {activeQuery && (
        <Card>
          <CardHeader>
            <CardTitle>Search Results</CardTitle>
            <CardDescription>
              {searchResults?.total 
                ? `Found ${searchResults.total} papers matching "${activeQuery}"`
                : `Searching for papers matching "${activeQuery}"...`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isSearching ? (
              <div className="flex justify-center items-center h-40">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : searchError ? (
              <div className="flex justify-center items-center h-40 text-destructive">
                <AlertCircle className="h-6 w-6 mr-2" />
                <span>Error loading search results. Please try again.</span>
              </div>
            ) : searchResults?.data?.length === 0 ? (
              <div className="flex justify-center items-center h-40 text-muted-foreground">
                No papers found matching your query.
              </div>
            ) : (
              <Table>
                <TableCaption>Hydrogen research papers from Semantic Scholar</TableCaption>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[40%]">Title</TableHead>
                    <TableHead className="w-[25%]">Authors</TableHead>
                    <TableHead className="w-[15%]">Year</TableHead>
                    <TableHead className="w-[20%]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {searchResults?.data?.map((paper: any) => (
                    <TableRow key={paper.paperId}>
                      <TableCell className="font-medium">{paper.title}</TableCell>
                      <TableCell>
                        {paper.authors?.map((author: any) => author.name).join(', ')}
                      </TableCell>
                      <TableCell>{paper.year}</TableCell>
                      <TableCell>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => handlePreview(paper)}
                          disabled={previewPaperMutation.isPending}
                        >
                          {previewPaperMutation.isPending && selectedPaper?.paperId === paper.paperId ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <Search className="mr-2 h-4 w-4" />
                          )}
                          Preview
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
            
            {totalPages > 1 && (
              <Pagination 
                currentPage={page + 1}
                totalPages={totalPages}
                onPageChange={(p) => setPage(p - 1)}
              />
            )}
          </CardContent>
        </Card>
      )}
      
      {selectedPaper && (
        <Card>
          <CardHeader>
            <CardTitle>{selectedPaper.title}</CardTitle>
            <CardDescription>
              {selectedPaper.authors?.map((author: any) => author.name).join(', ')} • {selectedPaper.year || 'Unknown Year'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h3 className="font-medium mb-1">Abstract</h3>
              <p className="text-sm text-muted-foreground">{selectedPaper.abstract || 'No abstract available'}</p>
            </div>
            
            {selectedPaper.venue && (
              <div>
                <h3 className="font-medium mb-1">Journal/Venue</h3>
                <p className="text-sm text-muted-foreground">{selectedPaper.venue}</p>
              </div>
            )}
            
            {selectedPaper.fieldsOfStudy && selectedPaper.fieldsOfStudy.length > 0 && (
              <div>
                <h3 className="font-medium mb-1">Fields of Study</h3>
                <div className="flex flex-wrap gap-2">
                  {selectedPaper.fieldsOfStudy.map((field: string) => (
                    <span key={field} className="bg-muted text-muted-foreground rounded-full px-3 py-1 text-xs">
                      {field}
                    </span>
                  ))}
                </div>
              </div>
            )}
            
            {selectedPaper.externalIds && (
              <div>
                <h3 className="font-medium mb-1">Identifiers</h3>
                <div className="text-sm space-y-1">
                  {selectedPaper.externalIds.DOI && (
                    <p>DOI: <a href={`https://doi.org/${selectedPaper.externalIds.DOI}`} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{selectedPaper.externalIds.DOI}</a></p>
                  )}
                  {selectedPaper.externalIds.PMID && (
                    <p>PMID: {selectedPaper.externalIds.PMID}</p>
                  )}
                  {selectedPaper.externalIds.PMCID && (
                    <p>PMCID: {selectedPaper.externalIds.PMCID}</p>
                  )}
                </div>
              </div>
            )}
          </CardContent>
          <CardFooter className="flex justify-between">
            <Button variant="outline" onClick={() => setSelectedPaper(null)}>
              Back to Results
            </Button>
            <Button onClick={handleImport} disabled={importPaperMutation.isPending}>
              {importPaperMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <FileImport className="mr-2 h-4 w-4" />
              )}
              Import Paper
            </Button>
          </CardFooter>
        </Card>
      )}
      
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
          <div className="bg-muted/50 p-4 rounded-md my-4">
            <p className="font-medium">{importedStudy?.title}</p>
            <p className="text-sm text-muted-foreground mt-1">{importedStudy?.authors}</p>
            <p className="text-sm mt-3">
              <span className="font-medium">Category:</span> {importedStudy?.category}
            </p>
          </div>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => {
              setShowSuccessDialog(false);
              setSelectedPaper(null);
            }}>
              Return to Search
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}