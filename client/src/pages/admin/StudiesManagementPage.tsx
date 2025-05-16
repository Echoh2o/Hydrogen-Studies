import { useState } from 'react';
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
import { Badge } from '@/components/ui/badge';
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
  BarChart2
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';

interface Study {
  id: number;
  title: string;
  journal: string;
  publishDate: string;
  category: string;
  isPeerReviewed: boolean;
  healthImplications: boolean;
  hasMedia: boolean;
}

export default function StudiesManagementPage() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;
  
  // Fetch studies
  const { data: studiesData, isLoading: isLoadingStudies } = useQuery({
    queryKey: ['/api/studies', { page: currentPage, searchQuery, categoryFilter }],
    retry: false,
  });

  // Fetch categories for filter
  const { data: categories, isLoading: isLoadingCategories } = useQuery({
    queryKey: ['/api/categories'],
    retry: false,
  });
  
  // Process studies data
  const studies = studiesData ? {
    data: studiesData,
    totalCount: studiesData.length
  } : { data: [], totalCount: 0 };
  
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
  
  // Handle search
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1); // Reset to first page on new search
  };
  
  // Placeholder for delete action
  const handleDelete = (id: number) => {
    toast({
      title: "Not implemented",
      description: "Delete functionality is not implemented yet.",
      variant: "destructive"
    });
  };
  
  // Total pages calculation
  const totalItems = studies.totalCount || 0;
  const totalPages = Math.ceil(totalItems / pageSize);
  
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
          <CardHeader>
            <CardTitle>Search Studies</CardTitle>
            <CardDescription>
              Find studies using advanced filters
            </CardDescription>
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
                      <SelectItem value="all">All Categories</SelectItem>
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
              
              <div className="flex items-center space-x-2 text-sm">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Available filters:</span>
                <Badge variant="outline" className="cursor-pointer">Peer-reviewed</Badge>
                <Badge variant="outline" className="cursor-pointer">Health Implications</Badge>
                <Badge variant="outline" className="cursor-pointer">With Media</Badge>
                <Badge variant="outline" className="cursor-pointer">Latest</Badge>
              </div>
            </form>
          </CardContent>
        </Card>
        
        {/* Studies table */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Studies</CardTitle>
              <div className="flex items-center space-x-2">
                <Button variant="outline" size="sm" asChild>
                  <Link href="/admin/analytics/studies">
                    <a className="flex items-center space-x-2">
                      <BarChart2 className="h-4 w-4" />
                      <span>Analytics</span>
                    </a>
                  </Link>
                </Button>
                <Button variant="outline" size="sm">
                  <ArrowUpDown className="mr-2 h-4 w-4" />
                  Sort
                </Button>
              </div>
            </div>
            <CardDescription>
              {totalItems > 0 ? 
                `Showing ${Math.min((currentPage - 1) * pageSize + 1, totalItems)} to ${Math.min(currentPage * pageSize, totalItems)} of ${totalItems} studies` : 
                'No studies found'
              }
            </CardDescription>
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
                  {searchQuery || categoryFilter ? 
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
                        <TableHead>Title</TableHead>
                        <TableHead>Journal</TableHead>
                        <TableHead>Published</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {studies.data && studies.data.map((study: Study) => (
                        <TableRow key={study.id}>
                          <TableCell className="font-medium max-w-xs truncate">
                            <Link href={`/admin/studies/edit/${study.id}`} className="hover:underline">
                                {study.title}
                            </Link>
                          </TableCell>
                          <TableCell>{study.journal}</TableCell>
                          <TableCell>{formatDate(study.publishDate)}</TableCell>
                          <TableCell>{study.category}</TableCell>
                          <TableCell>
                            <div className="flex space-x-1">
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
                            <div className="flex justify-end space-x-2">
                              <Button variant="ghost" size="icon" asChild>
                                <Link href={`/admin/studies/edit/${study.id}`}>
                                  <a>
                                    <Pencil className="h-4 w-4" />
                                    <span className="sr-only">Edit</span>
                                  </a>
                                </Link>
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="icon"
                                onClick={() => handleDelete(study.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                                <span className="sr-only">Delete</span>
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                
                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-muted-foreground">
                      Page {currentPage} of {totalPages}
                    </div>
                    <div className="flex space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage <= 1}
                      >
                        <ChevronLeft className="h-4 w-4" />
                        <span className="sr-only">Previous Page</span>
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        disabled={currentPage >= totalPages}
                      >
                        <ChevronRight className="h-4 w-4" />
                        <span className="sr-only">Next Page</span>
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}