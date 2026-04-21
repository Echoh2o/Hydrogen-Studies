import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

interface SearchResponse<T> {
  items: T[];
  totalResults?: number;
}

interface UseExternalSearchArgs<TItem, TImportId> {
  /** Human-readable name of the source ("PubMed", "CrossRef") for toasts. */
  sourceName: string;
  /** Fetch a page of results. */
  search: (query: string, page: number) => Promise<SearchResponse<TItem>>;
  /** Import a single result; returns `{ success, message?, study? }`. */
  import: (id: TImportId) => Promise<{ success: boolean; message?: string; study?: { title?: string } }>;
  /** Results per page — used to compute totalPages from totalResults. */
  pageSize?: number;
}

/**
 * Shared state + mutations for external-research search components.
 * Handles the search/import/toast pattern that PubMed, EuropePMC, CrossRef,
 * and SemanticScholar all implement identically.
 */
export function useExternalSearch<TItem, TImportId>(args: UseExternalSearchArgs<TItem, TImportId>) {
  const { toast } = useToast();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<TItem[]>([]);
  const [totalResults, setTotalResults] = useState(0);
  const [page, setPage] = useState(1);
  const [selectedImportId, setSelectedImportId] = useState<TImportId | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  const searchMutation = useMutation({
    mutationFn: ({ q, p }: { q: string; p: number }) => args.search(q, p),
    onSuccess: (data) => {
      setResults(data.items ?? []);
      setTotalResults(data.totalResults ?? (data.items?.length ?? 0));
      setHasSearched(true);
    },
    onError: (error: unknown) => {
      toast({
        title: "Search failed",
        description: error instanceof Error ? error.message : `Failed to search ${args.sourceName}`,
        variant: "destructive",
      });
    },
  });

  const importMutation = useMutation({
    mutationFn: (id: TImportId) => args.import(id),
    onSuccess: (data) => {
      if (data.success) {
        toast({
          title: "Study imported",
          description: `Successfully imported: ${data.study?.title ?? "study"}`,
        });
      } else {
        toast({
          title: "Import failed",
          description: data.message ?? "Failed to import study",
          variant: "destructive",
        });
      }
    },
    onError: (error: unknown) => {
      toast({
        title: "Import failed",
        description: error instanceof Error ? error.message : "Failed to import study",
        variant: "destructive",
      });
    },
  });

  const runSearch = (newPage = page) => {
    if (!query.trim()) {
      toast({
        title: "Search query required",
        description: "Please enter a search term",
        variant: "destructive",
      });
      return;
    }
    setPage(newPage);
    searchMutation.mutate({ q: query, p: newPage });
  };

  const runImport = (id: TImportId) => {
    setSelectedImportId(id);
    importMutation.mutate(id);
  };

  const pageSize = args.pageSize ?? 10;
  const totalPages = Math.max(1, Math.ceil(totalResults / pageSize));

  return {
    query,
    setQuery,
    results,
    totalResults,
    page,
    totalPages,
    runSearch,
    runImport,
    selectedImportId,
    isSearching: searchMutation.isPending,
    isImporting: importMutation.isPending,
    hasSearched,
  };
}
