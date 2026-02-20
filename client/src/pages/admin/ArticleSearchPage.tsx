import React, { useState } from "react";
import { Helmet } from "react-helmet";
import { Link } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2,
  Search,
  Check,
  X,
  ExternalLink,
  Database,
  Download,
  Filter,
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

export default function ArticleSearchPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("hydrogen therapy");
  const [activeTab, setActiveTab] = useState("search");
  const [selectedSource, setSelectedSource] = useState("pubmed");
  const [maxResults, setMaxResults] = useState(10);
  const [startIndex, setStartIndex] = useState(0);
  const [sortBy, setSortBy] = useState<"relevance" | "pub_date">("relevance");
  const [autoApprove, setAutoApprove] = useState(false);
  const [pendingApproval, setPendingApproval] = useState<any[]>([]);
  const [approving, setApproving] = useState(false);
  const [runningDiscovery, setRunningDiscovery] = useState(false);

  // State for selected articles for batch operations
  const [selectedArticles, setSelectedArticles] = useState<
    Record<string, boolean>
  >({});

  // Track if all articles are selected
  const [selectAll, setSelectAll] = useState(false);

  // Handle article search
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    refetch();
  };

  // Query for article search
  const {
    data: searchResults,
    isLoading,
    refetch,
  } = useQuery<any>({
    queryKey: [
      "/api/research/search",
      selectedSource,
      searchQuery,
      maxResults,
      startIndex,
      sortBy,
    ],
    enabled: false,
    staleTime: 60000, // 1 minute
  });

  // Run discovery job
  const handleRunDiscovery = async () => {
    try {
      setRunningDiscovery(true);

      const response = await apiRequest("POST", "/api/research/discover", {
          source: selectedSource,
          query: searchQuery,
          maxResults: maxResults,
      });
      const result = await response.json();

      if (result.success) {
        toast({
          title: "Discovery complete",
          description: `Discovered ${result.discovered} new articles, imported ${result.imported}`,
        });
        queryClient.invalidateQueries({ queryKey: ["/api/studies"] });
      } else {
        toast({
          title: "Discovery failed",
          description: result.message || "Failed to run discovery job",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      toast({
        title: "Discovery failed",
        description: error.message || "Failed to run discovery job",
        variant: "destructive",
      });
    } finally {
      setRunningDiscovery(false);
    }
  };

  // Handle article approval
  const handleApproveArticle = async (article: any) => {
    try {
      const response = await apiRequest("POST", "/api/research/approve", {
          source: selectedSource,
          article: article,
      });
      const result = await response.json();

      if (result.success) {
        toast({
          title: "Article approved",
          description: "Article has been added to the database",
        });
        queryClient.invalidateQueries({ queryKey: ["/api/studies"] });

        // Remove from pending approval if it's there
        setPendingApproval((prev) => prev.filter((a) => a.id !== article.id));
      } else {
        toast({
          title: "Approval failed",
          description: result.message || "Failed to approve article",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      toast({
        title: "Approval failed",
        description: error.message || "Failed to approve article",
        variant: "destructive",
      });
    }
  };

  // Handle batch approval
  const handleBatchApprove = async () => {
    try {
      setApproving(true);

      const selectedArticlesToApprove = (searchResults?.articles || []).filter(
        (article: any) => selectedArticles[article.id],
      );

      if (selectedArticlesToApprove.length === 0) {
        toast({
          title: "No articles selected",
          description: "Please select at least one article to approve",
          variant: "destructive",
        });
        setApproving(false);
        return;
      }

      const response = await apiRequest("POST", "/api/research/bulk-approve", {
          source: selectedSource,
          articles: selectedArticlesToApprove,
      });
      const result = await response.json();

      toast({
        title: "Batch approval complete",
        description: `Successfully approved ${result.success} of ${result.total} articles`,
      });

      queryClient.invalidateQueries({ queryKey: ["/api/studies"] });

      // Reset selection
      setSelectedArticles({});
      setSelectAll(false);
    } catch (error: any) {
      toast({
        title: "Batch approval failed",
        description: error.message || "Failed to approve articles",
        variant: "destructive",
      });
    } finally {
      setApproving(false);
    }
  };

  // Toggle article selection
  const toggleArticleSelection = (article: any) => {
    setSelectedArticles((prev) => ({
      ...prev,
      [article.id]: !prev[article.id],
    }));
  };

  // Toggle select all articles
  const toggleSelectAll = () => {
    if (!searchResults?.articles) return;

    const newSelectAll = !selectAll;
    setSelectAll(newSelectAll);

    const newSelection: Record<string, boolean> = {};
    searchResults.articles.forEach((article: any) => {
      newSelection[article.id] = newSelectAll;
    });

    setSelectedArticles(newSelection);
  };

  // Pagination handlers
  const handleNextPage = () => {
    if (searchResults?.nextIndex) {
      setStartIndex(searchResults.nextIndex);
      window.scrollTo(0, 0);
    }
  };

  const handlePrevPage = () => {
    if (startIndex > 0) {
      setStartIndex(Math.max(0, startIndex - maxResults));
      window.scrollTo(0, 0);
    }
  };

  return (
    <>
      <Helmet>
        <title>Article Search - Hydrogen Studies</title>
      </Helmet>

      <div className="bg-neutral-100 py-8 min-h-screen">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
            <div>
              <h1 className="text-3xl font-bold">Research Article Search</h1>
              <p className="text-neutral-600">
                Search and import articles from PubMed and other sources
              </p>
            </div>
            <div className="mt-4 md:mt-0">
              <Button variant="outline" asChild>
                <Link href="/admin">Back to Admin</Link>
              </Button>
            </div>
          </div>

          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="space-y-6"
          >
            <TabsList className="grid grid-cols-2">
              <TabsTrigger value="search">Search Articles</TabsTrigger>
              <TabsTrigger value="discover">Discovery Job</TabsTrigger>
            </TabsList>

            {/* Search Articles Tab */}
            <TabsContent value="search" className="space-y-6">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle>Search for Research Articles</CardTitle>
                  <CardDescription>
                    Search for hydrogen-related research articles in PubMed and
                    other sources
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSearch} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div className="md:col-span-2">
                        <Label htmlFor="searchQuery">Search Query</Label>
                        <Input
                          id="searchQuery"
                          placeholder="e.g., hydrogen therapy"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="mt-1"
                        />
                      </div>

                      <div>
                        <Label htmlFor="source">Source</Label>
                        <Select
                          value={selectedSource}
                          onValueChange={setSelectedSource}
                        >
                          <SelectTrigger id="source" className="mt-1">
                            <SelectValue placeholder="Select source" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pubmed">PubMed</SelectItem>
                            <SelectItem value="google-scholar" disabled>
                              Google Scholar (Coming Soon)
                            </SelectItem>
                            <SelectItem value="hydrogen-studies" disabled>
                              HydrogenStudies.com (Coming Soon)
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <Label htmlFor="sortBy">Sort By</Label>
                        <Select
                          value={sortBy}
                          onValueChange={(value) =>
                            setSortBy(value as "relevance" | "pub_date")
                          }
                        >
                          <SelectTrigger id="sortBy" className="mt-1">
                            <SelectValue placeholder="Sort by" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="relevance">Relevance</SelectItem>
                            <SelectItem value="pub_date">
                              Publication Date
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="flex flex-col md:flex-row justify-between space-y-4 md:space-y-0">
                      <div className="flex items-center space-x-2">
                        <Label htmlFor="auto-approve">
                          Auto-approve articles
                        </Label>
                        <Switch
                          id="auto-approve"
                          checked={autoApprove}
                          onCheckedChange={setAutoApprove}
                        />
                      </div>

                      <div className="flex space-x-2">
                        <Button type="submit" disabled={isLoading}>
                          {isLoading ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Searching...
                            </>
                          ) : (
                            <>
                              <Search className="h-4 w-4 mr-2" />
                              Search Articles
                            </>
                          )}
                        </Button>

                        {searchResults?.articles &&
                          searchResults.articles.length > 0 && (
                            <Button
                              type="button"
                              variant="outline"
                              onClick={handleBatchApprove}
                              disabled={
                                approving ||
                                Object.keys(selectedArticles).filter(
                                  (k) => selectedArticles[k],
                                ).length === 0
                              }
                            >
                              {approving ? (
                                <>
                                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                  Approving...
                                </>
                              ) : (
                                <>
                                  <Database className="h-4 w-4 mr-2" />
                                  Approve Selected
                                </>
                              )}
                            </Button>
                          )}
                      </div>
                    </div>
                  </form>
                </CardContent>
              </Card>

              {/* Search Results */}
              {isLoading ? (
                <div className="space-y-4">
                  {[...Array(3)].map((_, i) => (
                    <Card key={i}>
                      <CardContent className="pt-6">
                        <div className="space-y-3">
                          <Skeleton className="h-4 w-3/4" />
                          <Skeleton className="h-4 w-full" />
                          <Skeleton className="h-4 w-full" />
                          <Skeleton className="h-4 w-2/3" />
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : searchResults?.articles &&
                searchResults.articles.length > 0 ? (
                <>
                  <div className="flex justify-between items-center mb-4">
                    <div className="text-sm text-neutral-600">
                      Showing {startIndex + 1}-
                      {startIndex + searchResults.articles.length} of{" "}
                      {searchResults.total} results
                    </div>

                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="select-all"
                        checked={selectAll}
                        onChange={toggleSelectAll}
                        className="rounded text-primary"
                      />
                      <label
                        htmlFor="select-all"
                        className="text-sm font-medium"
                      >
                        Select All
                      </label>
                    </div>
                  </div>

                  <div className="space-y-4">
                    {searchResults.articles.map((article: any, index: number) => (
                      <Card
                        key={article.id || index}
                        className={
                          selectedArticles[article.id] ? "border-primary" : ""
                        }
                      >
                        <CardContent className="pt-6">
                          <div className="flex flex-col md:flex-row justify-between space-y-4 md:space-y-0">
                            <div className="flex items-start space-x-3 flex-1">
                              <input
                                type="checkbox"
                                id={`select-${article.id}`}
                                checked={!!selectedArticles[article.id]}
                                onChange={() => toggleArticleSelection(article)}
                                className="mt-1 rounded text-primary"
                              />
                              <div className="space-y-2 flex-1">
                                <div className="flex justify-between items-start">
                                  <h3 className="font-semibold text-lg">
                                    {article.title}
                                  </h3>
                                </div>

                                <div className="flex flex-wrap gap-2 text-sm text-neutral-600">
                                  <span>{article.authors}</span>
                                  <span>•</span>
                                  <span>{article.journal}</span>
                                  <span>•</span>
                                  <span>{article.publishDate}</span>
                                </div>

                                <p className="text-sm text-neutral-700">
                                  {article.abstract?.substring(0, 300)}
                                  {article.abstract?.length > 300 ? "..." : ""}
                                </p>

                                <div className="flex flex-wrap gap-2 mt-2">
                                  {article.doi && (
                                    <Badge
                                      variant="outline"
                                      className="text-xs"
                                    >
                                      DOI: {article.doi}
                                    </Badge>
                                  )}

                                  {article.pmid && (
                                    <Badge
                                      variant="outline"
                                      className="text-xs"
                                    >
                                      PMID: {article.pmid}
                                    </Badge>
                                  )}

                                  {article.articleType && (
                                    <Badge
                                      variant="secondary"
                                      className="text-xs"
                                    >
                                      {article.articleType}
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            </div>

                            <div className="flex flex-row md:flex-col space-x-2 md:space-x-0 md:space-y-2">
                              <Button
                                size="sm"
                                variant="default"
                                onClick={() => handleApproveArticle(article)}
                              >
                                <Check className="h-4 w-4 mr-1" />
                                Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                  window.open(article.url, "_blank")
                                }
                              >
                                <ExternalLink className="h-4 w-4 mr-1" />
                                View
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>

                  {/* Pagination */}
                  <div className="flex justify-between items-center mt-6">
                    <Button
                      variant="outline"
                      onClick={handlePrevPage}
                      disabled={startIndex === 0}
                    >
                      Previous
                    </Button>

                    <span className="text-neutral-600">
                      Page {Math.floor(startIndex / maxResults) + 1}
                    </span>

                    <Button
                      variant="outline"
                      onClick={handleNextPage}
                      disabled={!searchResults.nextIndex}
                    >
                      Next
                    </Button>
                  </div>
                </>
              ) : searchResults?.articles ? (
                <div className="bg-white p-8 rounded-lg text-center">
                  <p className="text-lg text-neutral-600">
                    No articles found for your search query
                  </p>
                </div>
              ) : (
                <div className="bg-white p-8 rounded-lg text-center">
                  <p className="text-lg text-neutral-600">
                    Enter a search query and click "Search Articles" to find
                    hydrogen research
                  </p>
                </div>
              )}
            </TabsContent>

            {/* Discovery Job Tab */}
            <TabsContent value="discover" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Automated Discovery Job</CardTitle>
                  <CardDescription>
                    Automatically discover and import hydrogen research articles
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <p className="text-sm text-neutral-600">
                      The discovery job will search for hydrogen research
                      articles, filter them based on relevance, and
                      automatically import them into your database. You can
                      customize the search parameters below.
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="discovery-query">Search Query</Label>
                        <Input
                          id="discovery-query"
                          placeholder="e.g., hydrogen therapy neurology"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="mt-1"
                        />
                      </div>

                      <div>
                        <Label htmlFor="discovery-source">Source</Label>
                        <Select
                          value={selectedSource}
                          onValueChange={setSelectedSource}
                        >
                          <SelectTrigger id="discovery-source" className="mt-1">
                            <SelectValue placeholder="Select source" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pubmed">PubMed</SelectItem>
                            <SelectItem value="google-scholar" disabled>
                              Google Scholar (Coming Soon)
                            </SelectItem>
                            <SelectItem value="hydrogen-studies" disabled>
                              HydrogenStudies.com (Coming Soon)
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <Label htmlFor="max-results">Maximum Results</Label>
                        <Select
                          value={maxResults.toString()}
                          onValueChange={(value) =>
                            setMaxResults(parseInt(value))
                          }
                        >
                          <SelectTrigger id="max-results" className="mt-1">
                            <SelectValue placeholder="Max results" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="10">10 results</SelectItem>
                            <SelectItem value="20">20 results</SelectItem>
                            <SelectItem value="50">50 results</SelectItem>
                            <SelectItem value="100">100 results</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="flex items-center space-x-2 mt-8">
                        <Switch id="auto-filter" checked={true} disabled />
                        <Label htmlFor="auto-filter">Auto-filter results</Label>
                      </div>

                      <div className="flex items-center space-x-2 mt-8">
                        <Switch
                          id="import-immediately"
                          checked={autoApprove}
                          onCheckedChange={setAutoApprove}
                        />
                        <Label htmlFor="import-immediately">
                          Import immediately
                        </Label>
                      </div>
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="flex justify-end">
                  <Button
                    onClick={handleRunDiscovery}
                    disabled={runningDiscovery}
                  >
                    {runningDiscovery ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Running Discovery...
                      </>
                    ) : (
                      <>
                        <Search className="h-4 w-4 mr-2" />
                        Run Discovery Job
                      </>
                    )}
                  </Button>
                </CardFooter>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Schedule Regular Discovery</CardTitle>
                  <CardDescription>
                    Set up automated discovery jobs to run on a schedule
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <p className="text-sm text-neutral-600">
                      Schedule regular discovery jobs to keep your database
                      up-to-date with the latest hydrogen research. You can set
                      up multiple schedules with different search parameters.
                    </p>

                    <div className="bg-neutral-100 p-4 rounded-md text-center">
                      <p className="text-sm font-medium">Coming Soon</p>
                      <p className="text-xs text-neutral-600 mt-1">
                        Scheduled discovery jobs will be available in a future
                        update
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </>
  );
}
