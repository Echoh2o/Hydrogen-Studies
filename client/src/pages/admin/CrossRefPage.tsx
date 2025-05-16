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
import { Loader2, Search, FileDown, AlertCircle, CheckCircle2, BookCopy } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious, PaginationEllipsis } from '@/components/ui/pagination';

export default function CrossRefPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedPaper, setSelectedPaper] = useState<any>(null);
  const pageSize = 10;
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Search query for CrossRef API
  const { data: searchResults, isLoading: isSearching, error: searchError } = useQuery({
    queryKey: ['/api/crossref/search', searchQuery, currentPage, pageSize],
    queryFn: async () => {
      if (!searchQuery) return { items: [], totalResults: 0, page: 1, pageSize };
      return apiRequest(`/api/crossref/search?q=${encodeURIComponent(searchQuery)}&page=${currentPage}&pageSize=${pageSize}`);
    },
    enabled: !!searchQuery,
    keepPreviousData: true
  });

  // Get paper details when a paper is selected
  const { data: paperDetails, isLoading: isLoadingDetails } = useQuery({
    queryKey: ['/api/crossref/article', selectedPaper?.doi],
    queryFn: async () => {
      if (!selectedPaper?.doi) return null;
      return apiRequest(`/api/crossref/article/${encodeURIComponent(selectedPaper.doi)}`);
    },
    enabled: !!selectedPaper?.doi
  });

  // Import paper mutation
  const importPaperMutation = useMutation({
    mutationFn: async () => {
      if (!selectedPaper?.doi) throw new Error('No paper selected');
      return apiRequest(`/api/crossref/import/${encodeURIComponent(selectedPaper.doi)}`, {
        method: 'POST'
      });
    },
    onSuccess: (data) => {
      toast({
        title: "Success",
        description: "Paper imported successfully",
        variant: "success"
      });
      
      // Clear selected paper and refresh studies list
      setSelectedPaper(null);
      queryClient.invalidateQueries({ queryKey: ['/api/studies'] });
    },
    onError: (error: any) => {
      if (error.status === 409) {
        toast({
          title: "Paper already exists",
          description: "This paper is already in your database",
          variant: "warning"
        });
      } else {
        toast({
          title: "Error",
          description: "Failed to import paper",
          variant: "destructive"
        });
      }
    }
  });

  // Handle search form submission
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      setCurrentPage(1);
    }
  };

  // Handle paper selection
  const handleSelectPaper = (paper: any) => {
    setSelectedPaper(paper);
  };

  // Handle paper import
  const handleImport = () => {
    importPaperMutation.mutate();
  };

  // Calculate total pages for pagination
  const totalPages = searchResults?.totalResults 
    ? Math.ceil(searchResults.totalResults / pageSize) 
    : 0;

  // Handle page change
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">CrossRef Integration</h1>
      </div>
      
      <p className="text-muted-foreground">
        Search for articles on CrossRef and import them directly into your hydrogen studies database.
        CrossRef provides access to millions of scholarly articles with reliable metadata.
      </p>
      
      <Card>
        <CardHeader>
          <CardTitle>Search Articles</CardTitle>
          <CardDescription>
            Search for hydrogen-related articles in the CrossRef database
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSearch} className="flex gap-2">
            <div className="flex-1">
              <Label htmlFor="search" className="sr-only">Search Query</Label>
              <Input
                id="search"
                placeholder="Search by title, author, keyword..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Button type="submit" disabled={isSearching}>
              {isSearching ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Search className="h-4 w-4 mr-2" />}
              Search
            </Button>
          </form>
        </CardContent>
      </Card>
      
      {searchError ? (
        <Card className="border-destructive">
          <CardHeader className="text-destructive">
            <CardTitle className="flex items-center">
              <AlertCircle className="h-5 w-5 mr-2" />
              Error
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p>Failed to search CrossRef. Please try again.</p>
          </CardContent>
        </Card>
      ) : null}
      
      {searchResults?.items && searchResults.items.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Search Results</CardTitle>
            <CardDescription>
              Found {searchResults.totalResults} articles
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableCaption>Page {currentPage} of {totalPages}</TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Authors</TableHead>
                  <TableHead>Journal</TableHead>
                  <TableHead>Year</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {searchResults.items.map((paper: any) => (
                  <TableRow key={paper.id} className={selectedPaper?.id === paper.id ? "bg-muted" : ""}>
                    <TableCell className="font-medium max-w-md truncate">
                      {paper.title}
                    </TableCell>
                    <TableCell className="max-w-xs truncate">{paper.authors}</TableCell>
                    <TableCell className="max-w-xs truncate">{paper.journal}</TableCell>
                    <TableCell>{paper.year}</TableCell>
                    <TableCell>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleSelectPaper(paper)}
                      >
                        <BookCopy className="h-4 w-4 mr-2" />
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            
            {totalPages > 1 && (
              <div className="mt-4 flex justify-center">
                <Pagination>
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious 
                        onClick={() => handlePageChange(currentPage - 1)}
                        disabled={currentPage === 1}
                      />
                    </PaginationItem>
                    
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      // Show first page, last page, current page and neighbors
                      let pageNum = i + 1;
                      if (totalPages > 5) {
                        if (currentPage <= 3) {
                          // Near the start
                          pageNum = i + 1;
                        } else if (currentPage >= totalPages - 2) {
                          // Near the end
                          pageNum = totalPages - 4 + i;
                        } else {
                          // In the middle
                          pageNum = currentPage - 2 + i;
                        }
                      }
                      
                      return (
                        <PaginationItem key={pageNum}>
                          <PaginationLink
                            isActive={currentPage === pageNum}
                            onClick={() => handlePageChange(pageNum)}
                          >
                            {pageNum}
                          </PaginationLink>
                        </PaginationItem>
                      );
                    })}
                    
                    {totalPages > 5 && (currentPage < totalPages - 2) && (
                      <>
                        <PaginationItem>
                          <PaginationEllipsis />
                        </PaginationItem>
                        <PaginationItem>
                          <PaginationLink onClick={() => handlePageChange(totalPages)}>
                            {totalPages}
                          </PaginationLink>
                        </PaginationItem>
                      </>
                    )}
                    
                    <PaginationItem>
                      <PaginationNext 
                        onClick={() => handlePageChange(currentPage + 1)}
                        disabled={currentPage >= totalPages}
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              </div>
            )}
          </CardContent>
        </Card>
      ) : searchQuery && !isSearching && searchResults?.items ? (
        <Card>
          <CardHeader>
            <CardTitle>No Results</CardTitle>
          </CardHeader>
          <CardContent>
            <p>No articles found for your search query. Try different keywords.</p>
          </CardContent>
        </Card>
      ) : null}
      
      {selectedPaper && (
        <Card>
          <CardHeader>
            <CardTitle>Paper Details</CardTitle>
            <CardDescription>
              Review the paper details before importing
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoadingDetails ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : paperDetails ? (
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-semibold">Title</h3>
                  <p>{paperDetails.title}</p>
                </div>
                
                <div>
                  <h3 className="text-lg font-semibold">Authors</h3>
                  <p>{paperDetails.authors}</p>
                </div>
                
                <div>
                  <h3 className="text-lg font-semibold">Journal</h3>
                  <p>{paperDetails.journal}</p>
                </div>
                
                <div>
                  <h3 className="text-lg font-semibold">Year</h3>
                  <p>{paperDetails.year}</p>
                </div>
                
                <div>
                  <h3 className="text-lg font-semibold">DOI</h3>
                  <p>{paperDetails.doi}</p>
                </div>
                
                {paperDetails.abstract && (
                  <div>
                    <h3 className="text-lg font-semibold">Abstract</h3>
                    <p className="text-sm text-muted-foreground">{paperDetails.abstract}</p>
                  </div>
                )}
              </div>
            ) : (
              <p>Failed to load paper details</p>
            )}
          </CardContent>
          <CardFooter className="flex justify-between">
            <Button variant="outline" onClick={() => setSelectedPaper(null)}>
              Close
            </Button>
            <Button onClick={handleImport} disabled={importPaperMutation.isPending}>
              {importPaperMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <FileDown className="mr-2 h-4 w-4" />
              )}
              Import Paper
            </Button>
          </CardFooter>
        </Card>
      )}
    </div>
  );
}