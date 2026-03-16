import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import {
  Search,
  Filter,
  Calendar,
  MapPin,
  FileText,
  Users,
  Award,
  ChevronDown,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Link } from "wouter";
import { Helmet } from "react-helmet";
import SiteHeader from "@/components/layout/SiteHeader";
import Footer from "@/components/layout/Footer";

interface Study {
  id: number;
  title: string;
  abstract: string;
  authors: string;
  journal: string;
  publish_year: number;
  category: string;
  country: string;
  study_type: string;
  sample_size: number;
  citation_count: number;
  peer_reviewed: boolean;
  has_full_text: boolean;
  image_url: string;
  doi: string;
  plain_language_title: string;
  slug?: string;
}


export default function SearchPage() {
  const [location] = useLocation();
  const [studies, setStudies] = useState<Study[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [country, setCountry] = useState("all");
  const [showFilters, setShowFilters] = useState(false);
  const pageSize = 20;

  // Parse URL parameters
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const initialQuery = params.get("search") || params.get("q") || "";
    setSearchQuery(initialQuery);
    setCurrentPage(1);
    performSearch(initialQuery, {}, 1);
  }, [location]);

  const performSearch = async (
    query: string,
    filters: any = {},
    page: number = 1,
  ) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (query) params.set("q", query);
      params.set("page", page.toString());
      params.set("limit", pageSize.toString());

      const categoryValue = filters.category || category;
      const countryValue = filters.country || country;

      if (categoryValue !== "all") params.set("category", categoryValue);
      if (countryValue !== "all") params.set("country", countryValue);

      const response = await fetch(`/api/unified-search?${params}`);
      if (!response.ok) throw new Error(`Search failed (${response.status})`);
      const data = await response.json();

      setStudies(data.studies || []);
      setTotal(data.total || 0);
      setError(null);
    } catch (err) {
      console.error("Search error:", err);
      setError("Failed to load search results. Please try again.");
      setStudies([]);
      setTotal(0);
    }
    setLoading(false);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
    performSearch(searchQuery, { category, country }, 1);
  };

  const handleFilterChange = () => {
    setCurrentPage(1);
    performSearch(searchQuery, { category, country }, 1);
  };

  const goToPage = (page: number) => {
    const totalPages = Math.ceil(total / pageSize);
    const newPage = Math.max(1, Math.min(page, totalPages));
    setCurrentPage(newPage);
    performSearch(searchQuery, { category, country }, newPage);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const getPageNumbers = () => {
    const totalPages = Math.ceil(total / pageSize);
    const pages: number[] = [];
    const maxVisible = 7;
    let start = Math.max(1, currentPage - Math.floor(maxVisible / 2));
    let end = Math.min(totalPages, start + maxVisible - 1);
    if (end - start + 1 < maxVisible) {
      start = Math.max(1, end - maxVisible + 1);
    }
    for (let i = start; i <= end; i++) pages.push(i);
    return pages;
  };

  const totalPages = Math.ceil(total / pageSize);

  return (
    <>
      <SiteHeader />
      <Helmet>
        <title>Search Studies - Hydrogen Studies Database</title>
        <meta name="description" content="Search our comprehensive database of molecular hydrogen research studies. Find peer-reviewed studies by condition, body system, or keyword." />
        <meta property="og:title" content="Search Studies - Hydrogen Studies Database" />
        <meta property="og:description" content="Search our comprehensive database of molecular hydrogen research studies. Find peer-reviewed studies by condition, body system, or keyword." />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://hydrogenstudies.com/search" />
        <meta name="twitter:card" content="summary" />
        <link rel="canonical" href="https://hydrogenstudies.com/search" />
      </Helmet>
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-white border-b sticky top-0 z-10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex items-center justify-between mb-4">
              <Link
                href="/"
                className="flex items-center text-teal-600 hover:text-teal-700"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Home
              </Link>
              <Badge variant="secondary" className="px-3 py-1">
                {total.toLocaleString()} studies found
              </Badge>
            </div>

            {/* Search Bar */}
            <form onSubmit={handleSearch} className="flex gap-2 items-center">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  type="text"
                  placeholder="Search hydrogen research studies... (e.g., 'hydrogen water for diabetes' or 'anti-inflammatory effects')"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Button type="submit" disabled={loading}>
                {loading ? "Searching..." : "Search"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowFilters(!showFilters)}
                className="flex items-center gap-2"
              >
                <Filter className="h-4 w-4" />
                Filters
                <ChevronDown
                  className={`h-4 w-4 transition-transform ${showFilters ? "rotate-180" : ""}`}
                />
              </Button>
            </form>

            {/* Quick search suggestions */}
            {!searchQuery && (
              <div className="flex flex-wrap gap-2 mt-3">
                <span className="text-xs text-gray-500 py-1">Try:</span>
                {[
                  "hydrogen water benefits",
                  "anti-inflammatory",
                  "exercise recovery",
                  "brain health",
                  "diabetes",
                  "cardiovascular",
                ].map((term) => (
                  <button
                    key={term}
                    onClick={() => {
                      setSearchQuery(term);
                      setCurrentPage(1);
                      performSearch(term, { category, country }, 1);
                    }}
                    className="text-xs px-2 py-1 bg-teal-50 text-teal-700 rounded-full hover:bg-teal-100 transition-colors"
                  >
                    {term}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {/* Filters */}
          <Collapsible open={showFilters} onOpenChange={setShowFilters}>
            <CollapsibleContent className="mb-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Filter Results</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid md:grid-cols-4 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">
                        Category
                      </label>
                      <Select
                        value={category}
                        onValueChange={(value) => {
                          setCategory(value);
                          setTimeout(handleFilterChange, 100);
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="All categories" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All categories</SelectItem>
                          <SelectItem value="cardiovascular">
                            Cardiovascular
                          </SelectItem>
                          <SelectItem value="diabetes">Diabetes</SelectItem>
                          <SelectItem value="neurological">
                            Neurological
                          </SelectItem>
                          <SelectItem value="cancer">Cancer</SelectItem>
                          <SelectItem value="kidney">Kidney</SelectItem>
                          <SelectItem value="exercise">Exercise</SelectItem>
                          <SelectItem value="inflammation">
                            Inflammation
                          </SelectItem>
                          <SelectItem value="general">General</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2">
                        Country
                      </label>
                      <Select
                        value={country}
                        onValueChange={(value) => {
                          setCountry(value);
                          setTimeout(handleFilterChange, 100);
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="All countries" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All countries</SelectItem>
                          <SelectItem value="Japan">Japan</SelectItem>
                          <SelectItem value="China">China</SelectItem>
                          <SelectItem value="United States">
                            United States
                          </SelectItem>
                          <SelectItem value="South Korea">
                            South Korea
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex items-end">
                      <Button
                        variant="outline"
                        onClick={() => {
                          setCategory("all");
                          setCountry("all");
                          setCurrentPage(1);
                          setTimeout(
                            () => performSearch(searchQuery, {}, 1),
                            100,
                          );
                        }}
                        className="w-full"
                      >
                        Clear Filters
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </CollapsibleContent>
          </Collapsible>

          {/* Results */}
          {error ? (
            <div className="text-center py-12">
              <p className="text-red-600 mb-4">{error}</p>
              <Button
                variant="outline"
                onClick={() =>
                  performSearch(searchQuery, { category, country })
                }
              >
                Try Again
              </Button>
            </div>
          ) : loading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Searching studies...</p>
            </div>
          ) : studies.length > 0 ? (
            <div className="space-y-6">
              {/* Local study results */}
              {studies.map((study) => (
                <Link key={study.id} href={study.slug ? `/study/${study.slug}` : `/study/id/${study.id}`}>
                  <Card className="hover:shadow-lg transition-shadow cursor-pointer hover:border-primary/50">
                    <CardContent className="p-6">
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex-1">
                          <h3 className="text-xl font-semibold text-gray-900 mb-2 line-clamp-2 hover:text-teal-600">
                            {study.plain_language_title || study.title}
                          </h3>
                          <p className="text-gray-600 mb-3 line-clamp-3">
                            {study.abstract}
                          </p>
                        </div>
                        {study.image_url && (
                          <img
                            src={study.image_url}
                            alt="Study illustration"
                            className="w-24 h-24 object-cover rounded-lg ml-4 flex-shrink-0"
                            loading="lazy"
                          />
                        )}
                      </div>

                      <div className="flex flex-wrap gap-2 mb-4">
                        {study.publish_year && (
                          <Badge
                            variant="secondary"
                            className="flex items-center gap-1"
                          >
                            <Calendar className="h-3 w-3" />
                            {study.publish_year}
                          </Badge>
                        )}
                        {study.country && (
                          <Badge
                            variant="outline"
                            className="flex items-center gap-1"
                          >
                            <MapPin className="h-3 w-3" />
                            {study.country}
                          </Badge>
                        )}
                        {study.sample_size > 0 && (
                          <Badge
                            variant="outline"
                            className="flex items-center gap-1"
                          >
                            <Users className="h-3 w-3" />
                            {study.sample_size} participants
                          </Badge>
                        )}
                        {study.peer_reviewed && (
                          <Badge
                            variant="outline"
                            className="flex items-center gap-1"
                          >
                            <Award className="h-3 w-3" />
                            Peer Reviewed
                          </Badge>
                        )}
                        {study.has_full_text && (
                          <Badge
                            variant="outline"
                            className="flex items-center gap-1"
                          >
                            <FileText className="h-3 w-3" />
                            Full Text
                          </Badge>
                        )}
                      </div>

                      <div className="flex justify-between items-center text-sm text-gray-500">
                        <div>
                          <strong>Journal:</strong> {study.journal}
                        </div>
                        <div className="flex items-center gap-4">
                          {study.citation_count > 0 && (
                            <span>
                              <strong>Citations:</strong> {study.citation_count}
                            </span>
                          )}
                          {study.category && (
                            <span>
                              <strong>Category:</strong> {study.category}
                            </span>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex flex-col items-center gap-4 py-6">
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => goToPage(1)}
                      disabled={currentPage === 1}
                    >
                      <ChevronsLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => goToPage(currentPage - 1)}
                      disabled={currentPage === 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    {getPageNumbers().map((p) => (
                      <Button
                        key={p}
                        variant={p === currentPage ? "default" : "outline"}
                        size="sm"
                        onClick={() => goToPage(p)}
                        className="min-w-[36px]"
                      >
                        {p}
                      </Button>
                    ))}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => goToPage(currentPage + 1)}
                      disabled={currentPage === totalPages}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => goToPage(totalPages)}
                      disabled={currentPage === totalPages}
                    >
                      <ChevronsRight className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-sm text-gray-500">
                    Page {currentPage} of {totalPages} ({total.toLocaleString()}{" "}
                    total results)
                  </p>
                </div>
              )}

            </div>
          ) : (
            <div className="text-center py-12">
              <Search className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                No studies found
              </h3>
              <p className="text-gray-600 mb-4">
                Try adjusting your search terms or filters to find relevant
                studies.
              </p>
              <div className="flex gap-3 justify-center">
                <Button
                  onClick={() => {
                    setSearchQuery("");
                    setCategory("all");
                    setCountry("all");
                    setCurrentPage(1);
                    performSearch("", {}, 1);
                  }}
                >
                  Browse All Studies
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
      <Footer />
    </>
  );
}
