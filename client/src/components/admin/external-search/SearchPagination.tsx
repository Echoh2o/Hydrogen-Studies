import { Button } from "@/components/ui/button";

interface SearchPaginationProps {
  page: number;
  totalPages: number;
  isLoading: boolean;
  onPageChange: (newPage: number) => void;
}

/**
 * Prev/Next pagination shared by the external-search components.
 * Renders nothing when totalPages <= 1.
 */
export function SearchPagination({
  page,
  totalPages,
  isLoading,
  onPageChange,
}: SearchPaginationProps) {
  if (totalPages <= 1) return null;

  return (
    <div className="flex justify-between mt-4">
      <Button
        variant="outline"
        size="sm"
        onClick={() => page > 1 && onPageChange(page - 1)}
        disabled={page === 1 || isLoading}
      >
        Previous
      </Button>
      <div className="text-sm py-2">
        Page {page} of {totalPages}
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={() => page < totalPages && onPageChange(page + 1)}
        disabled={page >= totalPages || isLoading}
      >
        Next
      </Button>
    </div>
  );
}
