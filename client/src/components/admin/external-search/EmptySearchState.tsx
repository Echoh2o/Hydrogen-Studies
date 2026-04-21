import { AlertCircle, Loader2 } from "lucide-react";

interface EmptySearchStateProps {
  isLoading: boolean;
  hasSearched: boolean;
}

export function EmptySearchState({ isLoading, hasSearched }: EmptySearchStateProps) {
  if (isLoading) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="h-10 w-10 animate-spin text-gray-400" />
      </div>
    );
  }

  if (hasSearched) {
    return (
      <div className="text-center py-10 text-gray-500">
        <AlertCircle className="h-10 w-10 mx-auto text-gray-300 mb-3" />
        <p>No results found. Try different search terms.</p>
      </div>
    );
  }

  return null;
}
