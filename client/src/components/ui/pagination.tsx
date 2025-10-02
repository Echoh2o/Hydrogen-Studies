import React from "react";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, MoreHorizontal } from "lucide-react";

// Main pagination component
interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  showPageNumbers?: boolean;
  className?: string;
}

// Add pagination sub-components for compatibility with other components
export function PaginationContent({
  children,
  className,
}: React.HTMLAttributes<HTMLUListElement>) {
  return (
    <ul className={`flex flex-row items-center gap-1 ${className || ""}`}>
      {children}
    </ul>
  );
}

export function PaginationItem({
  children,
  className,
}: React.HTMLAttributes<HTMLLIElement>) {
  return <li className={className}>{children}</li>;
}

export function PaginationLink({
  children,
  isActive = false,
  className,
  ...props
}: React.ComponentProps<typeof Button> & { isActive?: boolean }) {
  return (
    <Button
      variant={isActive ? "default" : "outline"}
      size="icon"
      className={`h-8 w-8 p-0 ${className || ""}`}
      {...props}
    >
      {children}
    </Button>
  );
}

export function PaginationPrevious({
  className,
  ...props
}: React.ComponentProps<typeof Button>) {
  return (
    <Button variant="outline" size="icon" className={className} {...props}>
      <ChevronLeft className="h-4 w-4" />
      <span className="sr-only">Previous Page</span>
    </Button>
  );
}

export function PaginationNext({
  className,
  ...props
}: React.ComponentProps<typeof Button>) {
  return (
    <Button variant="outline" size="icon" className={className} {...props}>
      <ChevronRight className="h-4 w-4" />
      <span className="sr-only">Next Page</span>
    </Button>
  );
}

export function PaginationEllipsis({ className }: { className?: string }) {
  return (
    <div
      className={`flex h-8 w-8 items-center justify-center ${className || ""}`}
    >
      <MoreHorizontal className="h-4 w-4" />
      <span className="sr-only">More pages</span>
    </div>
  );
}

export function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  showPageNumbers = true,
  className,
}: PaginationProps) {
  // Calculate visible page numbers
  const getVisiblePageNumbers = () => {
    // Always show first and last page
    // For small number of pages, show all
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    // For many pages, show current page, neighbors, first, last and ellipses
    const pages: (number | string)[] = [];

    // Always show first page
    pages.push(1);

    // Handle start ellipsis
    if (currentPage > 3) {
      pages.push("...");
    }

    // Calculate neighbor pages (current page and 1 on each side)
    const startPage = Math.max(2, currentPage - 1);
    const endPage = Math.min(totalPages - 1, currentPage + 1);

    // Add page numbers
    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }

    // Handle end ellipsis
    if (currentPage < totalPages - 2) {
      pages.push("...");
    }

    // Always show last page if not already included
    if (totalPages > 1) {
      pages.push(totalPages);
    }

    return pages;
  };

  const visiblePages = showPageNumbers ? getVisiblePageNumbers() : [];

  return (
    <div
      className={`flex items-center justify-center space-x-2 mt-6 ${className || ""}`}
    >
      <Button
        variant="outline"
        size="icon"
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
      >
        <ChevronLeft className="h-4 w-4" />
        <span className="sr-only">Previous Page</span>
      </Button>

      {showPageNumbers &&
        visiblePages.map((page, index) =>
          typeof page === "number" ? (
            <Button
              key={index}
              variant={currentPage === page ? "default" : "outline"}
              size="sm"
              onClick={() => onPageChange(page)}
              className="h-8 w-8 p-0"
            >
              {page}
            </Button>
          ) : (
            <Button
              key={index}
              variant="ghost"
              size="sm"
              disabled
              className="h-8 w-8 p-0"
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          ),
        )}

      <Button
        variant="outline"
        size="icon"
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
      >
        <ChevronRight className="h-4 w-4" />
        <span className="sr-only">Next Page</span>
      </Button>
    </div>
  );
}
