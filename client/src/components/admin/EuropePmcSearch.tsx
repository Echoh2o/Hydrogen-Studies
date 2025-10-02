import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  BookOpen,
  Loader2,
  AlertCircle,
  CheckCircle,
  ArrowLeft,
  ArrowRight,
  Search,
  Download,
} from "lucide-react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

const searchFormSchema = z.object({
  query: z.string().min(1, "Search query is required"),
  sortBy: z.string().optional(),
});

type SearchFormValues = z.infer<typeof searchFormSchema>;

const EuropePmcSearch: React.FC = () => {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(10);
  const [sortBy, setSortBy] = useState("");
  const [selectedArticle, setSelectedArticle] = useState<any>(null);

  const form = useForm<SearchFormValues>({
    resolver: zodResolver(searchFormSchema),
    defaultValues: {
      query: "",
      sortBy: "relevance",
    },
  });

  const {
    data: searchResults,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: [
      "/api/research/europe-pmc/search",
      searchQuery,
      currentPage,
      pageSize,
      sortBy,
    ],
    queryFn: async () => {
      if (!searchQuery)
        return { data: { resultList: { result: [] } }, metadata: { total: 0 } };

      // Important: The server expects 'query' parameter, not 'q'
      const url = `/api/research/europe-pmc/search?query=${encodeURIComponent(searchQuery)}&page=${currentPage}&pageSize=${pageSize}${sortBy ? `&sortBy=${sortBy}` : ""}`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error("Failed to search Europe PMC");
      }

      return response.json();
    },
    enabled: searchQuery.length > 0,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const { data: articleDetails, isLoading: isLoadingDetails } = useQuery({
    queryKey: [
      "/api/europepmc/article",
      selectedArticle?.id,
      selectedArticle?.source,
    ],
    queryFn: async () => {
      if (!selectedArticle) return null;

      const url = `/api/europepmc/article/${selectedArticle.id}${selectedArticle.source ? `?source=${selectedArticle.source}` : ""}`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error("Failed to fetch article details from Europe PMC");
      }

      return response.json();
    },
    enabled: !!selectedArticle,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const handleSearch = (values: SearchFormValues) => {
    setSearchQuery(values.query);
    setSortBy(values.sortBy || "");
    setCurrentPage(1);
    setSelectedArticle(null);
  };

  const handleArticleSelect = (article: any) => {
    setSelectedArticle(article);
  };

  const handleSaveArticle = async () => {
    if (!selectedArticle) return;

    try {
      const response = await apiRequest("POST", "/api/europepmc/save", {
        id: selectedArticle.id,
        source: selectedArticle.source,
      });

      if (response.success) {
        toast({
          title: "Study saved",
          description: "The study was successfully added to your database",
          variant: "default",
        });

        // Invalidate studies list
        queryClient.invalidateQueries({ queryKey: ["/api/studies"] });
      } else {
        toast({
          title: "Error",
          description: response.message || "Failed to save study",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "An unexpected error occurred",
        variant: "destructive",
      });
    }
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const renderPagination = () => {
    if (!searchResults || !searchResults.data) return null;

    const totalPages = searchResults.metadata?.totalPages || 1;
    if (totalPages <= 1) return null;

    const visiblePages = 5;
    const halfVisible = Math.floor(visiblePages / 2);

    let startPage = Math.max(1, currentPage - halfVisible);
    let endPage = Math.min(totalPages, startPage + visiblePages - 1);

    if (endPage - startPage + 1 < visiblePages) {
      startPage = Math.max(1, endPage - visiblePages + 1);
    }

    const pages = [];
    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }

    return (
      <Pagination>
        <PaginationContent>
          <PaginationItem>
            <PaginationPrevious
              onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
              className={
                currentPage === 1
                  ? "pointer-events-none opacity-50"
                  : "cursor-pointer"
              }
            />
          </PaginationItem>

          {startPage > 1 && (
            <>
              <PaginationItem>
                <PaginationLink onClick={() => handlePageChange(1)}>
                  1
                </PaginationLink>
              </PaginationItem>
              {startPage > 2 && <PaginationEllipsis />}
            </>
          )}

          {pages.map((page) => (
            <PaginationItem key={page}>
              <PaginationLink
                onClick={() => handlePageChange(page)}
                isActive={page === currentPage}
              >
                {page}
              </PaginationLink>
            </PaginationItem>
          ))}

          {endPage < totalPages && (
            <>
              {endPage < totalPages - 1 && <PaginationEllipsis />}
              <PaginationItem>
                <PaginationLink onClick={() => handlePageChange(totalPages)}>
                  {totalPages}
                </PaginationLink>
              </PaginationItem>
            </>
          )}

          <PaginationItem>
            <PaginationNext
              onClick={() =>
                handlePageChange(Math.min(totalPages, currentPage + 1))
              }
              className={
                currentPage === totalPages
                  ? "pointer-events-none opacity-50"
                  : "cursor-pointer"
              }
            />
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    );
  };

  const renderSearchResults = () => {
    if (isLoading) {
      return Array(5)
        .fill(0)
        .map((_, index) => (
          <Card key={index} className="mb-4">
            <CardContent className="p-4">
              <Skeleton className="h-6 w-3/4 mb-2" />
              <Skeleton className="h-4 w-full mb-2" />
              <Skeleton className="h-4 w-full mb-2" />
              <Skeleton className="h-4 w-2/3" />
            </CardContent>
          </Card>
        ));
    }

    if (error) {
      return (
        <Alert variant="destructive" className="mb-4">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>
            Failed to search Europe PMC. Please try again.
          </AlertDescription>
        </Alert>
      );
    }

    if (
      !searchResults ||
      !searchResults.data ||
      !searchResults.data.resultList ||
      !searchResults.data.resultList.result ||
      searchResults.data.resultList.result.length === 0
    ) {
      if (searchQuery) {
        return (
          <Alert className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>No results found</AlertTitle>
            <AlertDescription>
              Your search did not match any articles in Europe PMC.
            </AlertDescription>
          </Alert>
        );
      }
      return null;
    }

    return (
      <>
        <div className="mb-2 text-sm text-muted-foreground">
          Found {searchResults.metadata?.total || 0} results
        </div>

        {searchResults.data.resultList.result.map((article: any) => (
          <Card
            key={article.id}
            className={`mb-4 cursor-pointer hover:border-primary transition-colors ${
              selectedArticle?.id === article.id
                ? "border-primary bg-primary/5"
                : ""
            }`}
            onClick={() => handleArticleSelect(article)}
          >
            <CardContent className="p-4">
              <h3 className="font-medium text-base mb-1">
                {article.title || "Untitled Article"}
              </h3>

              <div className="text-sm mb-2">
                {article.authorString || "Unknown Authors"}
              </div>

              <div className="flex items-center text-xs text-muted-foreground mb-2">
                <span>{article.journalTitle || "Unknown Journal"}</span>
                {article.pubYear && (
                  <>
                    <span className="mx-1">•</span>
                    <span>{article.pubYear}</span>
                  </>
                )}
                {article.pubType && (
                  <>
                    <span className="mx-1">•</span>
                    <Badge variant="outline" size="sm">
                      {article.pubType}
                    </Badge>
                  </>
                )}
              </div>

              {article.abstractText && (
                <p className="text-sm line-clamp-2 text-muted-foreground">
                  {article.abstractText}
                </p>
              )}
            </CardContent>
          </Card>
        ))}

        {renderPagination()}
      </>
    );
  };

  const renderArticleDetails = () => {
    if (!selectedArticle) return null;

    if (isLoadingDetails) {
      return (
        <Card>
          <CardContent className="p-4">
            <Skeleton className="h-6 w-3/4 mb-4" />
            <Skeleton className="h-4 w-full mb-2" />
            <Skeleton className="h-4 w-full mb-2" />
            <Skeleton className="h-4 w-full mb-2" />
            <Skeleton className="h-4 w-full mb-2" />
            <Skeleton className="h-4 w-2/3 mb-4" />
            <Skeleton className="h-10 w-32" />
          </CardContent>
        </Card>
      );
    }

    if (!articleDetails || !articleDetails.article) {
      return (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>
            Failed to load article details. Please try again.
          </AlertDescription>
        </Alert>
      );
    }

    const article = articleDetails.article;
    const study = articleDetails.study;

    return (
      <Card>
        <CardHeader>
          <div className="flex justify-between items-start">
            <CardTitle className="text-lg font-semibold">
              {article.title || selectedArticle.title}
            </CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedArticle(null)}
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back to results
            </Button>
          </div>
          <CardDescription>
            {article.authorString || selectedArticle.authorString}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="font-medium">Journal:</span>
            <span>
              {article.journalInfo?.journal?.title ||
                selectedArticle.journalTitle}
            </span>

            {article.journalInfo?.dateOfPublication && (
              <>
                <span className="mx-1">•</span>
                <span>{article.journalInfo.dateOfPublication}</span>
              </>
            )}

            {article.pmid && (
              <>
                <span className="mx-1">•</span>
                <span className="font-medium">PMID:</span>
                <span>{article.pmid}</span>
              </>
            )}

            {article.pmcid && (
              <>
                <span className="mx-1">•</span>
                <span className="font-medium">PMCID:</span>
                <span>{article.pmcid}</span>
              </>
            )}

            {article.doi && (
              <>
                <span className="mx-1">•</span>
                <span className="font-medium">DOI:</span>
                <span>{article.doi}</span>
              </>
            )}
          </div>

          <Separator />

          {article.abstractText && (
            <div>
              <h3 className="font-medium mb-2">Abstract</h3>
              <p className="text-sm">{article.abstractText}</p>
            </div>
          )}

          {article.fullTextUrlList?.fullTextUrl &&
            article.fullTextUrlList.fullTextUrl.length > 0 && (
              <div>
                <h3 className="font-medium mb-2">Full Text</h3>
                <div className="flex flex-wrap gap-2">
                  {article.fullTextUrlList.fullTextUrl.map(
                    (url: any, index: number) => (
                      <a
                        key={index}
                        href={url.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center text-sm text-primary hover:underline"
                      >
                        {url.documentStyle === "pdf" ? (
                          <>
                            <Download className="h-4 w-4 mr-1" />
                            PDF
                          </>
                        ) : (
                          <>
                            <BookOpen className="h-4 w-4 mr-1" />
                            {url.availability} {url.documentStyle}
                          </>
                        )}
                      </a>
                    ),
                  )}
                </div>
              </div>
            )}

          <Separator />

          <div className="flex flex-col gap-2">
            <h3 className="font-medium">Keywords</h3>
            <div className="flex flex-wrap gap-2">
              {article.keywordList?.keyword?.map(
                (keyword: string, index: number) => (
                  <Badge key={index} variant="secondary">
                    {keyword}
                  </Badge>
                ),
              ) || (
                <span className="text-sm text-muted-foreground">
                  No keywords available
                </span>
              )}
            </div>
          </div>
        </CardContent>

        <CardFooter>
          <Button onClick={handleSaveArticle} className="w-full sm:w-auto">
            <CheckCircle className="h-4 w-4 mr-2" />
            Save to Database
          </Button>
        </CardFooter>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <BookOpen className="mr-2 h-5 w-5" />
            Europe PMC Search
          </CardTitle>
          <CardDescription>
            Search over 40 million publications in Europe PMC and save them to
            your database
          </CardDescription>
        </CardHeader>

        <CardContent>
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(handleSearch)}
              className="space-y-4"
            >
              <FormField
                control={form.control}
                name="query"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Search Query</FormLabel>
                    <FormControl>
                      <div className="flex space-x-2">
                        <Input
                          placeholder="Enter search terms (e.g. hydrogen therapy cancer)"
                          {...field}
                        />
                        <Button type="submit" disabled={isLoading}>
                          {isLoading ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <Search className="mr-2 h-4 w-4" />
                          )}
                          Search
                        </Button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="sortBy"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Sort By</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select sort order" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="relevance">Relevance</SelectItem>
                        <SelectItem value="date">
                          Date (newest first)
                        </SelectItem>
                        <SelectItem value="cited">Most Cited</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="text-xs text-muted-foreground">
                <p className="mb-1">Search tips:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>Use quotes for exact phrases: "hydrogen therapy"</li>
                  <li>
                    Use AND, OR, NOT for boolean logic: hydrogen AND therapy
                  </li>
                  <li>
                    Use parentheses for complex queries: (hydrogen OR H2) AND
                    therapy
                  </li>
                  <li>
                    Add a hydrogen-related term if you're searching for hydrogen
                    studies
                  </li>
                </ul>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="space-y-4">{renderSearchResults()}</div>

        <div>{renderArticleDetails()}</div>
      </div>
    </div>
  );
};

export default EuropePmcSearch;
