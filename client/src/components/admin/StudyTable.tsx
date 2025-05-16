import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  ChevronLeft, 
  ChevronRight, 
  Edit, 
  Trash2, 
  Eye, 
  CheckCircle, 
  XCircle,
  Loader2,
  Sparkles
} from 'lucide-react';
import { type Study } from '@/types';
import { Link } from 'wouter';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';

interface StudyTableProps {
  searchQuery?: string;
}

export default function StudyTable({ searchQuery = '' }: StudyTableProps) {
  const { toast } = useToast();
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  
  // Fetch studies with pagination
  const { data, isLoading, error } = useQuery<Study[]>({
    queryKey: ['/api/studies', searchQuery, page, limit],
    staleTime: 60000, // 1 minute
  });
  
  // Format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };
  
  // Truncate text
  const truncate = (text: string, maxLength: number) => {
    if (!text) return '';
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
  };
  
  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="text-center py-12 text-red-500">
        Error loading studies. Please try again.
      </div>
    );
  }
  
  const filteredStudies = data?.filter(study => 
    study.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    study.authors.toLowerCase().includes(searchQuery.toLowerCase()) ||
    study.abstract.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];
  
  const totalPages = Math.ceil(filteredStudies.length / limit);
  const startIndex = (page - 1) * limit;
  const paginatedStudies = filteredStudies.slice(startIndex, startIndex + limit);
  
  return (
    <div>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Authors</TableHead>
              <TableHead>Journal</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedStudies.length > 0 ? (
              paginatedStudies.map((study) => (
                <TableRow key={study.id}>
                  <TableCell className="font-medium max-w-md">
                    {truncate(study.title, 80)}
                  </TableCell>
                  <TableCell>{truncate(study.authors, 30)}</TableCell>
                  <TableCell>{truncate(study.journal, 30)}</TableCell>
                  <TableCell>{formatDate(study.publishDate)}</TableCell>
                  <TableCell>
                    {study.peerReviewed ? (
                      <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Peer Reviewed
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
                        <XCircle className="h-3 w-3 mr-1" />
                        Not Peer Reviewed
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <span className="sr-only">Open menu</span>
                          Actions
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <Link href={`/study/${study.id}`}>
                            <a className="flex items-center cursor-pointer">
                              <Eye className="h-4 w-4 mr-2" />
                              View
                            </a>
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link href={`/admin/studies/edit/${study.id}`}>
                            <a className="flex items-center cursor-pointer">
                              <Edit className="h-4 w-4 mr-2" />
                              Edit
                            </a>
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          className="text-red-600"
                          onClick={() => {
                            toast({
                              title: "Feature not implemented",
                              description: "Delete functionality will be added in a future update",
                            });
                          }}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => {
                            toast({
                              title: "Feature not implemented",
                              description: "Enrichment functionality will be added in a future update",
                            });
                          }}
                        >
                          <Sparkles className="h-4 w-4 mr-2" />
                          Enrich Data
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-6 text-gray-500">
                  No studies found. Try a different search term.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      
      {/* Pagination */}
      {filteredStudies.length > 0 && totalPages > 1 && (
        <div className="flex items-center justify-end space-x-2 py-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(page - 1)}
            disabled={page === 1}
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(page + 1)}
            disabled={page === totalPages}
          >
            Next
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      )}
    </div>
  );
}