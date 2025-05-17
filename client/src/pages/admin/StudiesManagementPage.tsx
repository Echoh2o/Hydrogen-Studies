import { useState, useEffect } from 'react';
import { Link } from 'wouter';
import { Helmet } from 'react-helmet';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Badge } from '@/components/ui/badge';
import { Checkbox } from "@/components/ui/checkbox";
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from '@/hooks/use-toast';
import AdminLayout from '@/components/admin/AdminLayout';
import { 
  Plus, 
  Search, 
  Filter, 
  ArrowUpDown, 
  Pencil, 
  Trash2,
  ChevronLeft,
  ChevronRight,
  Loader2,
  AlertCircle,
  BarChart2,
  Download,
  FileText,
  ListFilter,
  ArrowUp as ArrowUpIcon,
  ArrowDown as ArrowDownIcon,
  Check,
  X,
  Calendar,
  Eye,
  RefreshCw,
  MoreHorizontal,
  FileIcon
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

interface Study {
  id: number;
  title: string;
  journal: string;
  publishDate: string;
  category: string;
  isPeerReviewed: boolean;
  healthImplications: boolean;
  hasMedia: boolean;
  authors: string;
  abstract: string;
  methods: string | null;
  results: string | null;
  conclusion: string | null;
  healthConditions?: string[];
  bodySystems?: string[];
  keywords?: string[];
  doi?: string;
  citationCount?: number;
  viewCount?: number;
}

// Filter types
type FilterState = {
  isPeerReviewed: boolean | null;
  hasHealthImplications: boolean | null;
  hasMedia: boolean | null;
  dateRange: {
    from: string | null;
    to: string | null;
  };
  healthConditions: string[];
  bodySystems: string[];
};

// Local storage key for saved filters
const STORAGE_KEY = 'hydrogen-studies-admin-filters';

export default function StudiesManagementPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  
  // Search and filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [sortField, setSortField] = useState('publishDate');
  const [sortOrder, setSortOrder] = useState('desc');
  
  // Advanced filters
  const [filters, setFilters] = useState<FilterState>({
    isPeerReviewed: null,
    hasHealthImplications: null,
    hasMedia: null,
    dateRange: {
      from: null,
      to: null
    },
    healthConditions: [],
    bodySystems: []
  });
  
  // Selected studies for bulk operations
  const [selectedStudies, setSelectedStudies] = useState<number[]>([]);
  const [selectAll, setSelectAll] = useState(false);

  // Load saved filters from localStorage
  useEffect(() => {
    const savedFilters = localStorage.getItem(STORAGE_KEY);
    if (savedFilters) {
      try {
        const parsedFilters = JSON.parse(savedFilters);
        setSearchQuery(parsedFilters.searchQuery || '');
        setCategoryFilter(parsedFilters.categoryFilter || '');
        setSortField(parsedFilters.sortField || 'publishDate');
        setSortOrder(parsedFilters.sortOrder || 'desc');
        setPageSize(parsedFilters.pageSize || 10);
        
        if (parsedFilters.filters) {
          setFilters(parsedFilters.filters);
        }
      } catch (error) {
        console.error('Error loading saved filters:', error);
      }
    }
  }, []);

  // Save filters to localStorage when they change
  useEffect(() => {
    const filtersToSave = {
      searchQuery,
      categoryFilter,
      sortField,
      sortOrder,
      pageSize,
      filters
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtersToSave));
  }, [searchQuery, categoryFilter, sortField, sortOrder, pageSize, filters]);
  
  // Fetch studies with all query parameters
  const { data: studiesData, isLoading: isLoadingStudies } = useQuery({
    queryKey: ['/api/studies', { 
      page: currentPage, 
      pageSize,
      searchQuery, 
      categoryFilter,
      sortField,
      sortOrder,
      isPeerReviewed: filters.isPeerReviewed,
      hasHealthImplications: filters.hasHealthImplications,
      hasMedia: filters.hasMedia,
      dateFrom: filters.dateRange.from,
      dateTo: filters.dateRange.to,
      healthConditions: filters.healthConditions.length > 0 ? filters.healthConditions.join(',') : undefined,
      bodySystems: filters.bodySystems.length > 0 ? filters.bodySystems.join(',') : undefined
    }],
    retry: false,
  });

  // Fetch categories for filter
  const { data: categories, isLoading: isLoadingCategories } = useQuery({
    queryKey: ['/api/categories'],
    retry: false,
  });
  
  // Process studies data
  const studies = studiesData ? {
    data: studiesData.data || studiesData,
    totalCount: studiesData.totalCount || studiesData.length,
    totalPages: studiesData.totalPages || Math.ceil((studiesData.totalCount || studiesData.length) / pageSize),
    peerReviewedCount: studiesData.peerReviewedCount || studiesData.filter((s: Study) => s.isPeerReviewed).length,
    healthImplicationsCount: studiesData.healthImplicationsCount || studiesData.filter((s: Study) => s.healthImplications).length,
    withMediaCount: studiesData.withMediaCount || studiesData.filter((s: Study) => s.hasMedia).length
  } : { 
    data: [], 
    totalCount: 0, 
    totalPages: 0,
    peerReviewedCount: 0,
    healthImplicationsCount: 0,
    withMediaCount: 0
  };
  
  // Format date for display
  const formatDate = (dateString: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };
  
  // Clear all filters
  const clearFilters = () => {
    setSearchQuery('');
    setCategoryFilter('');
    setFilters({
      isPeerReviewed: null,
      hasHealthImplications: null,
      hasMedia: null,
      dateRange: {
        from: null,
        to: null
      },
      healthConditions: [],
      bodySystems: []
    });
    setCurrentPage(1);
    
    toast({
      title: "Filters cleared",
      description: "All search filters have been reset."
    });
  };
  
  // Handle search
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1); // Reset to first page on new search
  };
  
  // Handle filter badge clicks
  const toggleFilter = (filter: keyof Omit<FilterState, 'dateRange' | 'healthConditions' | 'bodySystems'>) => {
    setFilters(prev => {
      // If it's null, set to true, if true, set to false, if false, set to null
      const newValue = prev[filter] === null ? true : prev[filter] === true ? false : null;
      return {
        ...prev,
        [filter]: newValue
      };
    });
    setCurrentPage(1);
  };
  
  // Toggle study selection
  const toggleStudySelection = (id: number) => {
    setSelectedStudies(prev => {
      if (prev.includes(id)) {
        return prev.filter(studyId => studyId !== id);
      } else {
        return [...prev, id];
      }
    });
  };
  
  // Toggle select all studies
  const toggleSelectAll = () => {
    if (selectAll) {
      setSelectedStudies([]);
    } else {
      const allIds = studies.data.map((study: Study) => study.id);
      setSelectedStudies(allIds);
    }
    setSelectAll(!selectAll);
  };
  
  // Generate blogs for selected studies
  const generateBlogsForSelected = () => {
    if (selectedStudies.length === 0) {
      toast({
        title: "No studies selected",
        description: "Please select at least one study to generate blogs.",
        variant: "destructive"
      });
      return;
    }
    
    toast({
      title: "Generating blogs",
      description: `Generating blog articles for ${selectedStudies.length} selected studies.`,
    });
    
    // Navigate to the generate blogs page with selected studies
    // This is just a placeholder - we'd implement the actual navigation
  };
  
  // Export selected studies
  const exportSelectedStudies = (format: 'csv' | 'json' | 'excel') => {
    if (selectedStudies.length === 0) {
      toast({
        title: "No studies selected",
        description: "Please select at least one study to export.",
        variant: "destructive"
      });
      return;
    }
    
    toast({
      title: "Exporting studies",
      description: `Exporting ${selectedStudies.length} studies to ${format.toUpperCase()} format.`,
    });
    
    // This would be implemented to call an API endpoint for export
  };
  
  // Placeholder for delete action
  const handleDelete = (id: number) => {
    toast({
      title: "Not implemented",
      description: "Delete functionality is not implemented yet.",
      variant: "destructive"
    });
  };
  
  // Mutate for bulk delete
  const deleteStudiesMutation = useMutation({
    mutationFn: async (ids: number[]) => {
      // This would actually call an API endpoint
      return { success: true, message: `Deleted ${ids.length} studies` };
    },
    onSuccess: () => {
      // Clear selection and refetch data
      setSelectedStudies([]);
      setSelectAll(false);
      queryClient.invalidateQueries({ queryKey: ['/api/studies'] });
      
      toast({
        title: "Studies deleted",
        description: `Successfully deleted ${selectedStudies.length} studies.`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error deleting studies",
        description: error.message || "Failed to delete studies. Please try again.",
        variant: "destructive"
      });
    }
  });
  
  // Handler for bulk delete
  const handleBulkDelete = () => {
    if (selectedStudies.length === 0) {
      toast({
        title: "No studies selected",
        description: "Please select at least one study to delete.",
        variant: "destructive"
      });
      return;
    }
    
    // In a real implementation, we'd show a confirmation dialog
    // For now we just simulate it with a toast
    toast({
      title: "Confirm deletion",
      description: `Are you sure you want to delete ${selectedStudies.length} studies? This action cannot be undone.`,
      variant: "destructive"
    });
    
    // Normally we'd wait for confirmation, but for this demo we'll just fake it
    // deleteStudiesMutation.mutate(selectedStudies);
  };
  
  // Total pages calculation
  const totalItems = studies.totalCount || 0;
  const totalPages = studies.totalPages || Math.ceil(totalItems / pageSize);
  
  return (
    <AdminLayout title="Studies Management" description="Manage research studies database">
      <Helmet>
        <title>Studies Management | HydrogenStudies Admin</title>
      </Helmet>
      
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Studies Management</h2>
            <p className="text-muted-foreground">
              Manage your database of hydrogen research studies
            </p>
          </div>
          <Button asChild>
            <Link href="/admin/studies/add">
              <a className="flex items-center">
                <Plus className="mr-2 h-4 w-4" />
                Add Study
              </a>
            </Link>
          </Button>
        </div>
        
        {/* Search and filters */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Search Studies</CardTitle>
                <CardDescription>
                  Find studies using advanced filters
                </CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={clearFilters}>
                <X className="mr-2 h-4 w-4" />
                Clear Filters
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSearch} className="space-y-4">
              <div className="flex flex-col space-y-4 md:flex-row md:space-x-4 md:space-y-0">
                <div className="flex-1">
                  <Input
                    placeholder="Search by title, author, or keywords..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full"
                  />
                </div>
                
                <div className="w-full md:w-64">
                  <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="All Categories" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">All Categories</SelectItem>
                      {categories && categories.map((category: any) => (
                        <SelectItem key={category.id} value={category.id.toString()}>
                          {category.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Button type="submit" className="w-full md:w-auto">
                    <Search className="mr-2 h-4 w-4" />
                    Search
                  </Button>
                </div>
              </div>
              
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground mr-1">Filters:</span>
                
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Badge 
                        variant={filters.isPeerReviewed === true ? "default" : 
                                filters.isPeerReviewed === false ? "destructive" : "outline"} 
                        className="cursor-pointer hover:opacity-80"
                        onClick={() => toggleFilter('isPeerReviewed')}
                      >
                        {filters.isPeerReviewed === true ? 
                          <Check className="mr-1 h-3 w-3" /> : 
                          filters.isPeerReviewed === false ? 
                          <X className="mr-1 h-3 w-3" /> : null}
                        Peer-reviewed
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Click to toggle: include/exclude/any</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Badge 
                        variant={filters.hasHealthImplications === true ? "default" : 
                                filters.hasHealthImplications === false ? "destructive" : "outline"} 
                        className="cursor-pointer hover:opacity-80"
                        onClick={() => toggleFilter('hasHealthImplications')}
                      >
                        {filters.hasHealthImplications === true ? 
                          <Check className="mr-1 h-3 w-3" /> : 
                          filters.hasHealthImplications === false ? 
                          <X className="mr-1 h-3 w-3" /> : null}
                        Health Implications
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Click to toggle: include/exclude/any</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Badge 
                        variant={filters.hasMedia === true ? "default" : 
                                filters.hasMedia === false ? "destructive" : "outline"} 
                        className="cursor-pointer hover:opacity-80"
                        onClick={() => toggleFilter('hasMedia')}
                      >
                        {filters.hasMedia === true ? 
                          <Check className="mr-1 h-3 w-3" /> : 
                          filters.hasMedia === false ? 
                          <X className="mr-1 h-3 w-3" /> : null}
                        With Media
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Click to toggle: include/exclude/any</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="h-6 gap-1 text-xs px-2"
                      >
                        <Calendar className="h-3 w-3" />
                        Date Range
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Date range picker (coming soon)</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="h-6 gap-1 text-xs px-2"
                  onClick={() => {
                    toast({
                      title: "Advanced filters",
                      description: "Health conditions and body systems filters will be available soon.",
                    });
                  }}
                >
                  <ListFilter className="h-3 w-3" />
                  More Filters
                </Button>
              </div>
              
              {/* Filter metrics */}
              {(filters.isPeerReviewed !== null || 
                filters.hasHealthImplications !== null || 
                filters.hasMedia !== null ||
                filters.dateRange.from !== null || 
                filters.dateRange.to !== null ||
                searchQuery ||
                categoryFilter) && (
                <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm mt-2 pt-2 border-t">
                  <span className="text-muted-foreground">Active filters:</span>
                  {searchQuery && (
                    <div className="flex items-center gap-1.5">
                      <Search className="h-3 w-3 text-muted-foreground" />
                      <span className="font-medium">{searchQuery}</span>
                    </div>
                  )}
                  {categoryFilter && categories && (
                    <div className="flex items-center gap-1.5">
                      <FileIcon className="h-3 w-3 text-muted-foreground" />
                      <span className="font-medium">
                        {categories.find((c: any) => c.id.toString() === categoryFilter)?.name || 'Category'}
                      </span>
                    </div>
                  )}
                  {filters.isPeerReviewed !== null && (
                    <div className="flex items-center gap-1.5">
                      <Check className="h-3 w-3 text-muted-foreground" />
                      <span className="font-medium">
                        {filters.isPeerReviewed ? 'Peer-reviewed only' : 'Non-peer-reviewed only'}
                      </span>
                    </div>
                  )}
                  {filters.hasHealthImplications !== null && (
                    <div className="flex items-center gap-1.5">
                      <Check className="h-3 w-3 text-muted-foreground" />
                      <span className="font-medium">
                        {filters.hasHealthImplications ? 'With health implications' : 'Without health implications'}
                      </span>
                    </div>
                  )}
                  {filters.hasMedia !== null && (
                    <div className="flex items-center gap-1.5">
                      <Check className="h-3 w-3 text-muted-foreground" />
                      <span className="font-medium">
                        {filters.hasMedia ? 'With media' : 'Without media'}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </form>
          </CardContent>
        </Card>
        
        {/* Studies table */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Studies</CardTitle>
                <CardDescription>
                  {totalItems > 0 ? 
                    `Showing ${Math.min((currentPage - 1) * pageSize + 1, totalItems)} to ${Math.min(currentPage * pageSize, totalItems)} of ${totalItems} studies` : 
                    'No studies found'
                  }
                </CardDescription>
              </div>
              
              <div className="flex items-center space-x-2">
                {/* Display metrics */}
                <div className="hidden md:flex gap-4 mr-4 text-sm">
                  <div className="flex items-center">
                    <Badge variant="outline" className="bg-blue-50 text-blue-700 mr-2">
                      <Check className="h-3 w-3 mr-1" />
                    </Badge>
                    <span>{studies.peerReviewedCount} peer-reviewed</span>
                  </div>
                  <div className="flex items-center">
                    <Badge variant="outline" className="bg-green-50 text-green-700 mr-2">
                      <Check className="h-3 w-3 mr-1" />
                    </Badge>
                    <span>{studies.healthImplicationsCount} health</span>
                  </div>
                  <div className="flex items-center">
                    <Badge variant="outline" className="bg-purple-50 text-purple-700 mr-2">
                      <Check className="h-3 w-3 mr-1" />
                    </Badge>
                    <span>{studies.withMediaCount} with media</span>
                  </div>
                </div>
                
                {/* Study actions */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" disabled={selectedStudies.length === 0}>
                      Bulk Actions
                      <ChevronRight className="ml-2 h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuLabel>{selectedStudies.length} studies selected</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={generateBlogsForSelected}
                      disabled={selectedStudies.length === 0}
                    >
                      <FileText className="mr-2 h-4 w-4" />
                      Generate Blog Articles
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => exportSelectedStudies('csv')}
                      disabled={selectedStudies.length === 0}
                    >
                      <Download className="mr-2 h-4 w-4" />
                      Export to CSV
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => exportSelectedStudies('json')}
                      disabled={selectedStudies.length === 0}
                    >
                      <Download className="mr-2 h-4 w-4" />
                      Export to JSON
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={handleBulkDelete}
                      disabled={selectedStudies.length === 0}
                      className="text-red-600"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete Selected
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                
                <Button variant="outline" size="sm" asChild>
                  <Link href="/admin/analytics/studies">
                    <a className="flex items-center gap-2">
                      <BarChart2 className="h-4 w-4" />
                      <span>Analytics</span>
                    </a>
                  </Link>
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoadingStudies ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : !studies.data || studies.data.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <AlertCircle className="h-12 w-12 text-muted-foreground" />
                <h3 className="mt-4 text-lg font-medium">No studies found</h3>
                <p className="mt-2 text-sm text-muted-foreground max-w-md">
                  {searchQuery || categoryFilter || 
                   filters.isPeerReviewed !== null || 
                   filters.hasHealthImplications !== null || 
                   filters.hasMedia !== null ? 
                    'Try changing your search terms or filters.' : 
                    'Start by adding studies or importing research data.'
                  }
                </p>
                <div className="mt-6 flex space-x-4">
                  <Button asChild>
                    <Link href="/admin/studies/add">
                      <a>Add Study</a>
                    </Link>
                  </Button>
                  <Button variant="outline" asChild>
                    <Link href="/admin/research-import">
                      <a>Import Research</a>
                    </Link>
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[30px]">
                          <Checkbox 
                            checked={selectAll}
                            onCheckedChange={toggleSelectAll}
                            aria-label="Select all studies"
                          />
                        </TableHead>
                        <TableHead className="cursor-pointer" onClick={() => {
                          if (sortField === 'title') {
                            setSortOrder(current => current === 'asc' ? 'desc' : 'asc');
                          } else {
                            setSortField('title');
                            setSortOrder('asc');
                          }
                        }}>
                          <div className="flex items-center">
                            Title
                            {sortField === 'title' && (
                              sortOrder === 'asc' ? 
                              <ArrowUpIcon className="ml-2 h-4 w-4" /> : 
                              <ArrowDownIcon className="ml-2 h-4 w-4" />
                            )}
                          </div>
                        </TableHead>
                        <TableHead className="cursor-pointer" onClick={() => {
                          if (sortField === 'journal') {
                            setSortOrder(current => current === 'asc' ? 'desc' : 'asc');
                          } else {
                            setSortField('journal');
                            setSortOrder('asc');
                          }
                        }}>
                          <div className="flex items-center">
                            Journal
                            {sortField === 'journal' && (
                              sortOrder === 'asc' ? 
                              <ArrowUpIcon className="ml-2 h-4 w-4" /> : 
                              <ArrowDownIcon className="ml-2 h-4 w-4" />
                            )}
                          </div>
                        </TableHead>
                        <TableHead className="cursor-pointer" onClick={() => {
                          if (sortField === 'publishDate') {
                            setSortOrder(current => current === 'asc' ? 'desc' : 'asc');
                          } else {
                            setSortField('publishDate');
                            setSortOrder('desc');  // Default to newest first
                          }
                        }}>
                          <div className="flex items-center">
                            Published
                            {sortField === 'publishDate' && (
                              sortOrder === 'asc' ? 
                              <ArrowUpIcon className="ml-2 h-4 w-4" /> : 
                              <ArrowDownIcon className="ml-2 h-4 w-4" />
                            )}
                          </div>
                        </TableHead>
                        <TableHead className="cursor-pointer" onClick={() => {
                          if (sortField === 'category') {
                            setSortOrder(current => current === 'asc' ? 'desc' : 'asc');
                          } else {
                            setSortField('category');
                            setSortOrder('asc');
                          }
                        }}>
                          <div className="flex items-center">
                            Category
                            {sortField === 'category' && (
                              sortOrder === 'asc' ? 
                              <ArrowUpIcon className="ml-2 h-4 w-4" /> : 
                              <ArrowDownIcon className="ml-2 h-4 w-4" />
                            )}
                          </div>
                        </TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {studies.data && studies.data.map((study: Study) => (
                        <TableRow key={study.id} className={selectedStudies.includes(study.id) ? "bg-muted/50" : ""}>
                          <TableCell>
                            <Checkbox 
                              checked={selectedStudies.includes(study.id)}
                              onCheckedChange={() => toggleStudySelection(study.id)}
                              aria-label={`Select study ${study.title}`}
                            />
                          </TableCell>
                          <TableCell className="font-medium max-w-xs truncate">
                            <Link href={`/admin/studies/edit/${study.id}`} className="hover:underline">
                                {study.title}
                            </Link>
                          </TableCell>
                          <TableCell>{study.journal}</TableCell>
                          <TableCell>{formatDate(study.publishDate)}</TableCell>
                          <TableCell>{study.category}</TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {study.isPeerReviewed && (
                                <Badge variant="outline" className="bg-blue-50 text-blue-700 hover:bg-blue-50">Peer-reviewed</Badge>
                              )}
                              {study.healthImplications && (
                                <Badge variant="outline" className="bg-green-50 text-green-700 hover:bg-green-50">Health</Badge>
                              )}
                              {study.hasMedia && (
                                <Badge variant="outline" className="bg-purple-50 text-purple-700 hover:bg-purple-50">Media</Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end space-x-1">
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button variant="ghost" size="icon" asChild>
                                      <Link href={`/admin/studies/edit/${study.id}`}>
                                        <a>
                                          <Pencil className="h-4 w-4" />
                                        </a>
                                      </Link>
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>Edit study</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                              
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button variant="ghost" size="icon">
                                      <Eye className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>Preview study</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                              
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon">
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem 
                                    onClick={() => {
                                      toast({
                                        title: "Generate Blog",
                                        description: `Generating blog article for "${study.title.substring(0, 30)}..."`,
                                      });
                                    }}
                                  >
                                    <FileText className="mr-2 h-4 w-4" />
                                    Generate Blog Article
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => {
                                      toast({
                                        title: "Generate Image",
                                        description: "Generating scientific image...",
                                      });
                                    }}
                                  >
                                    <RefreshCw className="mr-2 h-4 w-4" />
                                    Generate Image
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem onClick={() => handleDelete(study.id)} className="text-red-600">
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Delete
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                
                {/* Enhanced Pagination */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <p className="text-sm text-muted-foreground whitespace-nowrap">
                      Items per page
                    </p>
                    <Select 
                      value={pageSize.toString()} 
                      onValueChange={(value) => {
                        setPageSize(Number(value));
                        setCurrentPage(1); // Reset to first page when changing page size
                      }}
                    >
                      <SelectTrigger className="h-8 w-[70px]">
                        <SelectValue placeholder="10" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="10">10</SelectItem>
                        <SelectItem value="25">25</SelectItem>
                        <SelectItem value="50">50</SelectItem>
                        <SelectItem value="100">100</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="flex items-center justify-center">
                    <div className="flex items-center gap-1 text-sm">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setCurrentPage(1)}
                        disabled={currentPage <= 1}
                      >
                        <ChevronLeft className="h-4 w-4" />
                        <ChevronLeft className="h-4 w-4 -ml-2" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage <= 1}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      
                      <span className="px-2 text-muted-foreground">
                        Page {currentPage} of {totalPages}
                      </span>
                      
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        disabled={currentPage >= totalPages}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setCurrentPage(totalPages)}
                        disabled={currentPage >= totalPages}
                      >
                        <ChevronRight className="h-4 w-4" />
                        <ChevronRight className="h-4 w-4 -ml-2" />
                      </Button>
                    </div>
                  </div>
                  
                  <div className="text-sm text-muted-foreground">
                    {totalItems > 0 && 
                      `Showing ${Math.min((currentPage - 1) * pageSize + 1, totalItems)} to ${Math.min(currentPage * pageSize, totalItems)} of ${totalItems} items`
                    }
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}