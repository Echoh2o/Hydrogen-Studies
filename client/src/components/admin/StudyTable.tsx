import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { Study } from "@/types";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Edit, Trash2, FileText, ExternalLink, Eye } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { truncateText } from "@/lib/utils";
import StudyForm from "./StudyForm";

interface StudyTableProps {
  searchQuery?: string;
}

export default function StudyTable({ searchQuery = "" }: StudyTableProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [currentPage, setCurrentPage] = useState(1);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [currentStudy, setCurrentStudy] = useState<Study | null>(null);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  
  const itemsPerPage = 10;
  
  // Fetch studies with search filtering
  const { data: studies = [], isLoading } = useQuery<Study[]>({
    queryKey: ['/api/studies', searchQuery],
    select: (data) => {
      if (!searchQuery) return data;
      
      const query = searchQuery.toLowerCase();
      return data.filter(study => 
        study.title.toLowerCase().includes(query) ||
        study.abstract.toLowerCase().includes(query) ||
        study.authors.toLowerCase().includes(query) ||
        study.category.toLowerCase().includes(query)
      );
    }
  });
  
  // Delete study mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string | number) => {
      await apiRequest("DELETE", `/api/studies/${id}`);
    },
    onSuccess: () => {
      toast({
        title: "Study deleted",
        description: "The study was successfully deleted.",
      });
      
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['/api/studies'] });
      setIsDeleteDialogOpen(false);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete study",
        variant: "destructive",
      });
    }
  });
  
  // Handle pagination
  const totalPages = Math.ceil(studies.length / itemsPerPage);
  const paginatedStudies = studies.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );
  
  // Handle edit button click
  const handleEdit = (study: Study) => {
    setCurrentStudy(study);
    setIsEditDialogOpen(true);
  };
  
  // Handle view button click
  const handleView = (study: Study) => {
    setCurrentStudy(study);
    setIsViewDialogOpen(true);
  };
  
  // Handle delete button click
  const handleDelete = (study: Study) => {
    setCurrentStudy(study);
    setIsDeleteDialogOpen(true);
  };
  
  // Handle edit dialog close
  const handleEditSuccess = () => {
    setIsEditDialogOpen(false);
    setCurrentStudy(null);
  };
  
  // Handle confirm delete
  const handleConfirmDelete = () => {
    if (currentStudy) {
      deleteMutation.mutate(currentStudy.id);
    }
  };
  
  // Format date for display
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };
  
  if (isLoading) {
    return <div className="text-center py-4">Loading studies...</div>;
  }
  
  if (studies.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-neutral-500 mb-2">No studies found</p>
        {searchQuery && (
          <p className="text-sm text-neutral-400">
            Try a different search query or clear the search
          </p>
        )}
      </div>
    );
  }
  
  return (
    <div>
      {/* Studies Table */}
      <div className="border rounded-md overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Authors</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Date</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedStudies.map((study) => (
              <TableRow key={study.id}>
                <TableCell className="font-medium">{truncateText(study.title, 50)}</TableCell>
                <TableCell>{truncateText(study.authors, 30)}</TableCell>
                <TableCell>
                  <Badge variant="outline">{study.category}</Badge>
                </TableCell>
                <TableCell>{formatDate(study.publishDate)}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end items-center space-x-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleView(study)}
                      title="View details"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleEdit(study)}
                      title="Edit study"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(study)}
                      title="Delete study"
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
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
        <div className="mt-4">
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                />
              </PaginationItem>
              
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                <PaginationItem key={page}>
                  <PaginationLink
                    onClick={() => setCurrentPage(page)}
                    isActive={page === currentPage}
                  >
                    {page}
                  </PaginationLink>
                </PaginationItem>
              ))}
              
              <PaginationItem>
                <PaginationNext
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}
      
      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Study</DialogTitle>
            <DialogDescription>
              Make changes to the study information.
            </DialogDescription>
          </DialogHeader>
          
          {currentStudy && (
            <StudyForm
              studyId={Number(currentStudy.id)}
              onSuccess={handleEditSuccess}
            />
          )}
        </DialogContent>
      </Dialog>
      
      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Deletion</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this study? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          
          {currentStudy && (
            <div className="py-4">
              <p className="font-medium">{currentStudy.title}</p>
              <p className="text-sm text-neutral-500">{currentStudy.authors}</p>
            </div>
          )}
          
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsDeleteDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmDelete}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete Study"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* View Study Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Study Details</DialogTitle>
          </DialogHeader>
          
          {currentStudy && (
            <div className="space-y-6">
              <div>
                <h3 className="text-xl font-bold">{currentStudy.title}</h3>
                <p className="text-neutral-500">{currentStudy.authors}</p>
                <div className="flex items-center mt-2">
                  <Badge variant="outline" className="mr-2">{currentStudy.category}</Badge>
                  {currentStudy.peerReviewed && (
                    <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Peer Reviewed</Badge>
                  )}
                </div>
              </div>
              
              <div>
                <h4 className="font-semibold mb-2">Abstract</h4>
                <p className="text-neutral-700">{currentStudy.abstract}</p>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="font-semibold mb-1">Journal</h4>
                  <p>{currentStudy.journal}</p>
                </div>
                <div>
                  <h4 className="font-semibold mb-1">Publish Date</h4>
                  <p>{formatDate(currentStudy.publishDate)}</p>
                </div>
              </div>
              
              {currentStudy.methods && (
                <div>
                  <h4 className="font-semibold mb-2">Methods</h4>
                  <p className="text-neutral-700">{currentStudy.methods}</p>
                </div>
              )}
              
              {currentStudy.results && (
                <div>
                  <h4 className="font-semibold mb-2">Results</h4>
                  <p className="text-neutral-700">{currentStudy.results}</p>
                </div>
              )}
              
              {currentStudy.conclusion && (
                <div>
                  <h4 className="font-semibold mb-2">Conclusion</h4>
                  <p className="text-neutral-700">{currentStudy.conclusion}</p>
                </div>
              )}
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {currentStudy.doi && (
                  <div>
                    <h4 className="font-semibold mb-1">DOI</h4>
                    <p>{currentStudy.doi}</p>
                  </div>
                )}
                
                <div className="flex flex-col space-y-2">
                  {currentStudy.pdfUrl && (
                    <Button variant="outline" size="sm" asChild>
                      <a href={currentStudy.pdfUrl} target="_blank" rel="noopener noreferrer">
                        <FileText className="h-4 w-4 mr-2" />
                        View PDF
                      </a>
                    </Button>
                  )}
                  
                  {currentStudy.citationUrl && (
                    <Button variant="outline" size="sm" asChild>
                      <a href={currentStudy.citationUrl} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-4 w-4 mr-2" />
                        View Citation
                      </a>
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}